define([
    './Extension',
    '../Core/Manager/theExtensionManager',
    '../Core/Controller/MessageClient',
    '../Core/Controller/P2PClient',
    '../UI/Base/Button',
    '../Core/Constants/Global',
    '../Core/Controller/ViewerState',
    '../Core/Logger',
    '../Core/Utils/stringToDOM',
    '../Core/Utils/loadDependency'
], function (Extension, theExtensionManager, MessageClient, P2PClient, Button, Global, ViewerState, Logger, stringToDOM, loadDependency) {
    'use strict';
    function RemoteControllerTool(viewer, client, p2p) {

        var _stick1 = new THREE.Vector2();
        var _stick2 = new THREE.Vector2();
        var _explodeSpeed = 0;
        var _flydir = null;
        var _camera;
        var _viewer = viewer;

        var MOVE_SCALE = 0.02;
        var AUTOMOVE_SCALE = 0.002;
        var LOOK_SCALE = 0.05;
        var EXPLODE_SCALE = 0.01;
        var _modelScale = 1.0;


        var _viewerState;
        var _savepoints = [];
        var _nextsavepoint = 0;
        var VIEWER_STATE_FILTER = {
            seedURN: false,
            objectSet: true,
            viewport: true,
            renderOptions: {
                environment: false,
                ambientOcclusion: false,
                toneMap: {
                    exposure: false
                },
                appearance: false
            }
        };

        var initScale = function () {
            if (!viewer.impl.model.is2d()) {
                var size = viewer.impl.model.getData().bbox.size();
                var diagLength = size.length();
                MOVE_SCALE *= diagLength;
                AUTOMOVE_SCALE *= diagLength;
                viewer.removeEventListener(Autodesk.Viewing.PROGRESS_UPDATE_EVENT, initScale);
            }
        };

        viewer.addEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, initScale);


        //viewtx.client.addEventListener("joystick", this.onJoystick);

        this.getNames = function () {
            return ["joystick"];
        };

        this.getName = function () {
            return "joystick";
        };


        this.activate = function (name) {
            client.addEventListener("joystick", onJoystick);
            p2p.addEventListener("joystick", onJoystick);
            _camera = _viewer.navigation.getCamera();

            if (_viewer.model) {
                var box = _viewer.model.getBoundingBox();
                _modelScale = box.size().length() * 0.001;
                _viewerState = new ViewerState(_viewer);
            }
        };

        this.deactivate = function (name) {
            client.removeEventListener("joystick", onJoystick);
            p2p.removeEventListener("joystick", onJoystick);
            _camera = null;
            _viewerState = null;
            _savepoints.length = 0;
        };

        this.update = function (timeStamp) {

            //the "go home" call may change the camera back to ortho... and we can't do ortho while walking...
            //HACK: Really, the home view should be set once when launch the extension, then set it back.
            if (!_camera.isPerspective)
                viewer.navigation.toPerspective();

            if (_flydir) {
                var automove = _flydir.clone().multiplyScalar(AUTOMOVE_SCALE);
                _camera.position.add(automove);
                _camera.target.add(automove);
            }

            if (_explodeSpeed != 0) {
                var ns = viewer.getExplodeScale() + _explodeSpeed * EXPLODE_SCALE;
                if (ns > 1) ns = 1;
                if (ns < 0) ns = 0;
                viewer.explode(ns);
            }

            if (_stick1.x == 0 && _stick1.y == 0 && _stick2.x == 0 && _stick2.y == 0)
                return !!(_flydir || _explodeSpeed);

            var direction = _camera.target.clone().sub(_camera.position);
            var distance = direction.length();
            direction.multiplyScalar(1.0 / distance);
            var right = direction.clone().cross(_camera.up).normalize();

            var forwardMove = direction.clone().multiplyScalar(_stick1.y * MOVE_SCALE);
            _camera.position.add(forwardMove);
            _camera.target.add(forwardMove);


            var strafeMove = right.clone().multiplyScalar(_stick1.x * MOVE_SCALE);
            _camera.position.add(strafeMove);
            _camera.target.add(strafeMove);

            var lookUpDown = new THREE.Quaternion();
            lookUpDown.setFromAxisAngle(right, _stick2.y * LOOK_SCALE);
            var ndir = direction.clone().applyQuaternion(lookUpDown);
            _camera.up.applyQuaternion(lookUpDown);

            var lookLeftRight = new THREE.Quaternion();
            lookLeftRight.setFromAxisAngle(_camera.worldup, -_stick2.x * LOOK_SCALE);
            ndir.applyQuaternion(lookLeftRight);
            _camera.up.applyQuaternion(lookLeftRight);

            ndir.multiplyScalar(distance);
            _camera.target.copy(_camera.position).add(ndir);

            // update automove direction
            if (_flydir)
                _flydir.copy(_camera.target).sub(_camera.position).normalize();

            return true;
        };

        this.handleSingleClick = function (event, button) { return false; };
        this.handleDoubleClick = function (event, button) { return false; };
        this.handleSingleTap = function (tap) { return false; };
        this.handleDoubleTap = function (tap1, tap2) { return false; };
        this.handleKeyDown = function (event, keyCode) { return false; };
        this.handleKeyUp = function (event, keyCode) { return false; };
        this.handleWheelInput = function (delta) { return false; };
        this.handleButtonDown = function (event, button) { return false; };
        this.handleButtonUp = function (event, button) { return false; };
        this.handleMouseMove = function (event) { return false; };
        this.handleGesture = function (event, touches) { return false; };
        this.handleTouchChange = function (event, touches) { return false; };
        this.handleBlur = function (event) { return false; };
        this.handleResize = function () { };


        function onJoystick(e) {
            var state = e.data.msg;
            _stick1.x = state.x1;
            _stick1.y = state.y1;
            _stick2.x = state.x2;
            _stick2.y = state.y2;
            _explodeSpeed = state.explode;

            if (state.command) {
                if (state.command == "gohome") {
                    _stick1.x = _stick1.y = 0;
                    _stick2.x = _stick2.y = 0;
                    viewer.navigation.setRequestHomeView(true);
                    viewer.showAll();
                    viewer.impl.selector.clearSelection();
                    viewer.explode(0);
                    _flydir = null;
                }
                else if (state.command == "select") {
                    var res = viewer.impl.hitTestViewport(new THREE.Vector3(0, 0, 0));

                    if (res) {
                        viewer.impl.selector.toggleSelection(res.dbId, res.model);
                    } else {
                        viewer.impl.selector.clearSelection();
                    }

                }
                else if (state.command == "hide") {
                    var res = viewer.impl.hitTestViewport(new THREE.Vector3(0, 0, 0));

                    if (res) {
                        viewer.hide(res.dbId);
                    }
                }
                else if (state.command == "fly") {
                    if (!_flydir) {
                        _flydir = _camera.target.clone().sub(_camera.position).normalize();
                    } else {
                        _flydir = null;
                    }
                } else if (state.command == "savepoint") {
                    var state = _viewerState.getState(VIEWER_STATE_FILTER);
                    _savepoints.push(state);
                    alertify.success("Savepoint created.");
                } else if (state.command == "nextsavepoint") {
                    if (_savepoints.length) {
                        if (_nextsavepoint >= _savepoints.length)
                            _nextsavepoint = 0;

                        _viewerState.restoreState(_savepoints[_nextsavepoint++]);
                    }
                }
            }

            //console.log(state);
        };

    };


    //==================================================================================
    //Extension interface

    /** @constructor */
    var RemoteControl = function (viewer, options) {
        Extension.call(this, viewer, options);

        this.viewer = viewer;
        this.client = MessageClient.GetInstance();
        this.p2p = new P2PClient(this.client);
        this.controllerTool = new RemoteControllerTool(viewer, this.client, this.p2p);
        viewer.toolController.registerTool(this.controllerTool);

    };

    RemoteControl.prototype = Object.create(Extension.prototype);
    RemoteControl.prototype.constructor = RemoteControl;


    RemoteControl.prototype.createUI = function () {
        var scope = this;
        var viewer = this.viewer;

        this.controlButton = new Button('toolbar-remoteControlTool');
        this.controlButton.setToolTip('Pair with controller device');
        this.controlButton.onClick = function () {
            if (this.getState() === Button.State.INACTIVE) {
                scope.connect();
                this.setState(Button.State.ACTIVE);
            }
            else {
                scope.disconnect();
                this.setState(Button.State.INACTIVE);
            }
        };

        this.controlButton.setIcon("adsk-icon-game-controller");
        viewer.modelTools.addControl(this.controlButton);

        this.panel = new Autodesk.Viewing.UI.DockingPanel(viewer.container, "remote-panel", "Remote Control");
        this.panel.width = 300;
        this.panel.height = 375;
        this.panel.container.style.width = this.panel.width + "px";
        this.panel.container.style.height = this.panel.height + "px";
        this.panel.container.style.top = (window.innerHeight - this.panel.height) / 2 + "px";
        this.panel.container.style.left = (window.innerWidth - this.panel.width) / 2 + "px";
        this.panel.body = document.createElement("div");
        this.panel.body.classList.add("body");
        this.panel.container.appendChild(this.panel.body);
        var text1 = Autodesk.Viewing.i18n.translate("Go to this link");
        var text2 = Autodesk.Viewing.i18n.translate("Scan the QR code with your device");
        var text3 = Autodesk.Viewing.i18n.translate("or");
        this.panel.body.innerHTML = [
            '<p data-i18n="' + text1 + '">' + text1 + '</p>',
            '<p><a class="url" target="_blank" href="#">Link</a></p>',
            '<p data-i18n="' + text3 + '">' + text3 + '</p>',
            '<p data-i18n="' + text2 + '">' + text2 + '</p>',
            '<img class="qr-img" src="">',
        ].join("\n");
        this.panel.link = this.panel.container.querySelector(".url");
        this.panel.code = this.panel.container.querySelector(".code");
        this.panel.qrImg = this.panel.container.querySelector(".qr-img");
    };

    RemoteControl.prototype.load = function () {
        var viewer = this.viewer;
        var scope = this;

        // add the button to the toolbar
        if (viewer.modelTools && viewer.modelTools.getNumberOfControls() > 0) {
            scope.createUI();
        } else {
            viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
        }

        function onToolbarCreated(e) {
            viewer.removeEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
            scope.createUI();
        }

        return true;
    };

    RemoteControl.prototype.unload = function () {

        var viewer = this.viewer;

        this.p2p.hangup();
        this.client.disconnect();

        viewer.toolController.deactivateTool(this.controllerTool.getName());

        if (this.panel) {
            this.panel.setVisible(false);
            this.panel = null;
        }

        // TODO_HACK: Find out why removing the button fails
        if (this.controlButton) {
            try {
                viewer.modelTools.removeControl(this.controlButton);
                this.controlButton = null;
            } catch (err) {
                Logger.error('RemoteControlReceiver - Failed to remove controlButton');
                this.controlButton = null;
            }
        }

        return true;
    };

    RemoteControl.prototype.addCrosshair = function () {
        this.crosshair = stringToDOM('<div id="remote-crosshair"><div class="crosshair-v"></div><div class="crosshair-h"></div></div>');
        this.viewer.canvasWrap.appendChild(this.crosshair);
    };

    RemoteControl.prototype.removeCrosshair = function () {
        if (this.crosshair) this.crosshair.remove();
    };

    RemoteControl.prototype.connect = function (cb) {
        if (this.client.isConnected()) {
            console.log("RemoteControl already connected");
            return;
        }

        var scope = this;
        loadDependency("lmv_io", "socket.io-1.3.5.js", function () {
            scope.connectAux(cb);
        });
    };

    RemoteControl.prototype.connectAux = function (cb) {
        var scope = this;
        var viewer = this.viewer;
        scope.client.addEventListener("connectSucceeded", function (e) {
            Logger.log("connect succeeded");
            var sessionId = e.data.id + "rc";
            scope.client.join(sessionId);

            var rcURL = (Global.LMV_RESOURCE_ROOT.length ? Global.LMV_RESOURCE_ROOT : window.location.origin + "/") + "rc.html?sessionId=" + sessionId + "&env=" + Global.env;

            var qrImgURL = "http://chart.googleapis.com/chart?cht=qr&chs=200x200&choe=UTF-8&chld=H|0&chl=" + escape(rcURL);

            var panel = scope.panel;
            if (panel) {
                panel.link.href = rcURL;
                panel.link.innerHTML = (Global.LMV_RESOURCE_ROOT.length ? Global.LMV_RESOURCE_ROOT : window.location.origin + "/") + "rc.html";
                panel.qrImg.src = qrImgURL;
                panel.setVisible(true);
            }

            function popupRemover() {
                if (panel) panel.setVisible(false);
                scope.p2p.removeEventListener("dataChannelAdded", popupRemover);
                scope.addCrosshair();
            }
            scope.p2p.addEventListener("dataChannelAdded", popupRemover);

            if (cb && cb instanceof Function)
                cb(rcURL);
        });

        viewer.navigation.toPerspective();
        scope.client.connect();

        viewer.toolController.activateTool(scope.controllerTool.getName());
    };

    RemoteControl.prototype.disconnect = function () {
        this.p2p.hangup();
        this.client.disconnect();
        this.viewer.toolController.deactivateTool(this.controllerTool.getName());
        this.removeCrosshair();
    };

    theExtensionManager.registerExtension('Autodesk.Viewing.RemoteControl', RemoteControl);
});