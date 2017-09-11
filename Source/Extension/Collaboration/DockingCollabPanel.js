define([
    '../../UI/Base/DockingPanel'
], function(DockingPanel) {
    'use strict';
    var USE_PRESENCE = true;
    
        //==================================================================================
    
        function DockingCollabPanel(viewer, client, p2p, viewtx) {
    
            this.viewer = viewer;
            this.client = client;
            this.p2p = p2p;
            this.viewtx = viewtx;
    
            var panelId = 'CollabPanel';
            DockingPanel.call(this, viewer.container, panelId, 'Live review');
    
            this.container.classList.add('collabPanel');
    
            this.container.style.height = "auto";
            this.container.dockRight = true;
    
            this.content = document.createElement("div");
            this.container.appendChild(this.content);
            this.content.classList.add("collabPanelContent");
    
            //Users list
            this.tableContainer = document.createElement("div");
            this.tableContainer.classList.add("userListTable", "dockingPanelScroll");
    
            this.table = document.createElement("table");
            this.table.classList.add("adsk-lmv-tftable");
            this.tbody = document.createElement("tbody");
            this.table.appendChild(this.tbody);
    
            this.tableContainer.appendChild(this.table);
            this.content.appendChild(this.tableContainer);
    
            // Invite button
            this.inviteDiv = document.createElement('div');
            this.inviteDiv.className = 'collabBoxOK';
            this.inviteDiv.style.float = 'left';
            this.inviteDiv.style.width = '232px';
            this.inviteDiv.setAttribute("data-i18n", "Invite");
            this.inviteDiv.textContent = Autodesk.Viewing.i18n.translate("Invite");
            this.content.appendChild(this.inviteDiv);
            this.inviteDiv.addEventListener("click", function (event) {
                var w = new CollabPromptBox();
                var container = viewer.container;
                w.start(container, function () {
                    var subject = Autodesk.Viewing.i18n.translate("Please Join My Live Review");
                    document.location.href = "mailto:?subject=" + subject;
                }, "Invite Others", "Email Invite", true);
            });
    
            //Chat history
            this.chatHistory = document.createElement("div");
            this.chatHistory.classList.add("chatHistory");
            this.chatHistory.classList.add("textEntry");
            this.chatHistory.classList.add("dockingPanelScroll");
            this.content.appendChild(this.chatHistory);
    
    
            //Text input entry
            this.chatPanel = document.createElement("div");
            this.chatPanel.classList.add("chatPanel");
    
            this.textInput = document.createElement("input");
            this.textInput.type = "text";
            this.textInput.classList.add("textEntry");
            this.textInput.placeholder = Autodesk.Viewing.i18n.translate("Type a message");
            this.chatPanel.appendChild(this.textInput);
    
            this.content.appendChild(this.chatPanel);
    
            this.isCameraConnected = true;
    
            var scope = this;
    
            this.addEventListener(client, "userListChange", function (e) {
    
                //Collab panel only cares about events on the collaboration channel
                if (e.channelId && e.channelId !== scope.viewtx.channelId)
                    return;
    
                var ci = scope.client.getChannelInfo(scope.viewtx.channelId);
                if (!ci)
                    return;
    
                scope.updateUsers(ci.users);
            });
    
            this.addEventListener(this.viewtx, "controlChange", function (e) {
    
                //Collab panel only cares about events on the collaboration channel
                if (e.channelId !== scope.viewtx.channelId)
                    return;
    
                scope.updateUserInControl(e.data.lastInControl);
            });
    
            this.addEventListener(client, "chatReceived", function (e) {
    
                //Collab panel only cares about events on the collaboration channel
                if (e.channelId !== scope.viewtx.channelId)
                    return;
    
                scope.updateChatHistory(e);
            });
    
            this.textInput.onkeyup = function (e) {
                scope.handleChatInput(e);
            };
    
            this.addEventListener(this.p2p, "remoteStreamAdded", function (e) {
                if (!scope.videoPanel)
                    scope.createVideoPanel();
    
                scope.remoteVideo.src = window.URL.createObjectURL(e.data);
            });
    
            this.addEventListener(this.p2p, "localStreamAdded", function (e) {
                if (!scope.videoPanel)
                    scope.createVideoPanel();
    
                scope.localVideo.src = window.URL.createObjectURL(e.data);
            });
    
            this.addEventListener(this.p2p, "remoteHangup", function (e) {
                scope.removeVideoPanel();
            });
        }
    
        DockingCollabPanel.prototype = Object.create(DockingPanel.prototype);
        DockingCollabPanel.prototype.constructor = DockingCollabPanel;
    
        DockingCollabPanel.prototype.startSession = function () {
            var scope = this;
            var isVisible = this.isVisible();
            if (isVisible) return;
            var w = new CollabPromptBox();
            var container = this.viewer.container;
            w.start(container, function () {
                scope.setVisible(true, true);
            }, "Start a Live Review", "Start Review");
        };
    
        DockingCollabPanel.prototype.endSession = function () {
            var isVisible = this.isVisible();
            if (!isVisible) return;
            this.setVisible(false, true);
            this.reset();
        };
    
        DockingCollabPanel.prototype.updateUsers = function (users) {
    
            var scope = this;
    
            var tbody = document.createElement("tbody");
    
            for (var i = 0; i < users.length; i++) {
                var row = tbody.insertRow(-1);
                row.id = users[i].id;
    
                var statusCell = row.insertCell(0);
                statusCell.style.width = "14px";
                statusCell.style.cursor = "default";
                var statusIcon = document.createElement("div");
                statusIcon.classList.add("statusBase");
                statusIcon.classList.add("statusNormal");
                statusIcon.innerHTML = "&#9679";
                statusCell.appendChild(statusIcon);
    
                var nameCell = row.insertCell(1);
                nameCell.textContent = users[i].name;
    
                //Video calling disabled.
                /*
                if (!users[i].isSelf) {
                    var callCell = row.insertCell(2);
                    callCell.classList.add("callButton");
                    callCell.innerHTML = "&#9742";
                    callCell.title = "Start audio/video call";
    
                    callCell.onclick = function(e) {
                        var targetId = e.target.parentNode.id;
    
                        if (scope.p2p.getCurrentCallTarget() == targetId)
                            return;
    
                        if (scope.videoPanel) {
                            scope.p2p.hangup();
                            scope.removeVideoPanel();
                        }
    
                        scope.createVideoPanel();
                        scope.p2p.callUser(targetId);
                    };
                } else {
                    var callCell = row.insertCell(2);
                    callCell.classList.add(scope.isCameraConnected ? "cameraButton" : "cameraDisconnectButton");
                    callCell.innerHTML = "&#9788";
                    callCell.title = "Connect/Disconnect Camera";
    
                    callCell.onclick = function(e) {
                        var targetParent = e.target.parentNode;
                        var targetClassList = e.target.classList;
    
                        if (scope.isCameraConnected) {
                            targetClassList.remove("cameraButton");
                            targetClassList.add("cameraDisconnectButton");
                        } else {
                            targetClassList.remove("cameraDisconnectButton");
                            targetClassList.add("cameraButton");
                        }
    
                        scope.isCameraConnected = !scope.isCameraConnected;
                        scope.viewtx.connectCamera(scope.isCameraConnected);
                    };
                }
                */
            }
    
            this.table.replaceChild(tbody, this.tbody);
            this.tbody = tbody;
    
            this.fixComponentPlacement();
        };
    
        DockingCollabPanel.prototype.updateUserInControl = function (id) {
            for (var i = 0; i < this.tbody.rows.length; i++) {
                var r = this.tbody.rows[i];
                var icon = r.cells[0].childNodes[0];
                if (r.id == id) {
                    icon.classList.remove("statusNormal");
                    icon.classList.add("statusInControl");
                    icon.innerHTML = "&#9784";
                    r.cells[1].style.color = "#4CBA36";
                } else {
                    icon.classList.remove("statusInControl");
                    icon.classList.add("statusNormal");
                    icon.innerHTML = "&#9679";
                    r.cells[1].style.color = "#ffffff";
                }
    
            }
        };
    
        DockingCollabPanel.prototype.updateChatHistory = function (e) {
    
            var user = this.client.getUserById(e.data.from, e.channelId);
    
            //skip command strings
            if (e.data.msg.charAt(0) == "/")
                return;
    
            //        var line = user.name + ": " + e.data.msg;
    
            if (this.chatHistory.lastUser != user.name) {
    
                var pEl = document.createElement("p");
    
                var nameEl = document.createElement("div");
                nameEl.classList.add("heading");
                nameEl.style.float = "left";
                nameEl.style.fontStyle = "normal";
                nameEl.style.color = "#857E7E";
                nameEl.textContent = user.name;
                pEl.appendChild(nameEl);
    
                var timeEl = document.createElement("div");
                timeEl.classList.add("heading");
                timeEl.style.textAlign = "right";
                timeEl.style.fontStyle = "normal";
                timeEl.style.color = "#857E7E";
                timeEl.textContent = new Date().toLocaleTimeString();
                pEl.appendChild(timeEl);
    
                this.chatHistory.appendChild(pEl);
    
                this.chatHistory.lastUser = user.name;
            } else {
                var br = document.createElement("br");
                this.chatHistory.appendChild(br);
            }
    
            var msgEl = document.createElement("span");
            msgEl.classList.add("messageText");
            msgEl.textContent = e.data.msg;
            this.chatHistory.appendChild(msgEl);
    
            this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
        };
    
        DockingCollabPanel.prototype.handleChatInput = function (e) {
            if (e.which != 13)
                return;
            if (this.textInput.value.length == 0)
                return;
    
            this.client.sendChatMessage(this.textInput.value, this.viewtx.channelId);
            this.textInput.value = "";
            this.textInput.placeholder = "";
        };
    
        DockingCollabPanel.prototype.fixComponentPlacement = function (e) {
    
            var heightAdj = this.tableContainer.offsetHeight + this.chatPanel.offsetHeight;
    
            if (this.videoPanel) {
                heightAdj += this.videoPanel.offsetHeight;
                this.chatHistory.style.height = "calc(100% - " + heightAdj + "px)";
            }
            else {
                this.chatHistory.style.height = "calc(100% - " + heightAdj + "px)";
            }
    
        };
    
        DockingCollabPanel.prototype.createVideoPanel = function (e) {
            this.videoPanel = document.createElement("div");
            this.videoPanel.classList.add("videoPanel");
    
            this.localVideo = document.createElement("video");
            this.localVideo.autoplay = true;
            this.localVideo.muted = true;
            this.localVideo.classList.add("videoInset");
            this.videoPanel.appendChild(this.localVideo);
    
            this.remoteVideo = document.createElement("video");
            this.remoteVideo.autoplay = true;
            this.remoteVideo.classList.add("videoMain");
            this.videoPanel.appendChild(this.remoteVideo);
    
            var scope = this;
            var closer = document.createElement("div");
            closer.classList.add("dockingPanelClose");
            closer.innerHTML = "&times";
            closer.title = Autodesk.Viewing.i18n.translate("End video call");
            closer.onclick = function (e) {
                scope.p2p.hangup();
                scope.removeVideoPanel();
            };
            this.videoPanel.appendChild(closer);
    
            this.content.insertBefore(this.videoPanel, this.chatHistory);
    
            this.fixComponentPlacement();
        };
    
        DockingCollabPanel.prototype.removeCollabPrompt = function () {
            var box = document.getElementById("collabBox")
            if (box) {
                box.style.visibility = "hidden";
                this.viewer.container.removeChild(box);
            }
        };
    
        DockingCollabPanel.prototype.removeVideoPanel = function () {
            if (this.videoPanel)
                this.content.removeChild(this.videoPanel);
            this.videoPanel = null;
        };
    
        DockingCollabPanel.prototype.reset = function (e) {
            if (this.tbody) {
                var empty = document.createElement("tbody");
                this.table.replaceChild(empty, this.tbody);
                this.tbody = empty;
            }
            this.chatHistory.textContent = "";
            this.textInput.value = "";
            this.removeVideoPanel();
            this.removeCollabPrompt();
        };

        return DockingCollabPanel;
});