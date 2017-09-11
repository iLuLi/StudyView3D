define([
    '../../Core/Utils/loadDependency',
    '../Extension',
    '../../Core/Manager/theExtensionManager',
    '../../Core/Constants/EventType',
    './ViewTransceiver',
    './InteractionInterceptor',
    '../../Core/Controller/P2PClient',
], function(loadDependency, Extension, theExtensionManager, EventType, ViewTransceiver, InteractionInterceptor, P2PClient) {
    'use strict';
    /** @constructor */
    var Collaboration = function (viewer, options) {
        Extension.call(this, viewer, options);
        if (options && options.rtc && options.rtc.disableRTCToolbarButton) {
            this.disableRTCToolbarButton = true;
        }
    };

    Collaboration.prototype = Object.create(Extension.prototype);
    Collaboration.prototype.constructor = Collaboration;


    Collaboration.prototype.initNetwork = function (force) {

        if (this.p2p && !force)
            return;

        this.viewtx = new ViewTransceiver(this.client);
        this.interceptor = new InteractionInterceptor(this.viewtx);
        this.viewer.toolController.registerTool(this.interceptor);

        this.p2p = new P2PClient(this.client);
    };

    Collaboration.prototype.createUI = function () {

        var scope = this;
        var viewer = this.viewer;

        this.initNetwork(false);

        this.panel = new avec.DockingCollabPanel(this.viewer, this.client, this.p2p, this.viewtx);
        Collaboration.Panel = this.panel;

        // Create a comment toolbar button.
        this.collabButton = new avu.Button('toolbar-collaborateTool');
        this.collabButton.setToolTip('Live review');
        this.collabButton.setIcon("adsk-icon-live-review");
        this.collabButton.onClick = function (e) {
            var isVisible = scope.panel.isVisible();

            // Prevent instantiating multiple 'enter your name' box by
            // spamming collab button.
            if (document.getElementById("collabBox")) {
                return;
            }

            if (!isVisible && !scope.inviteDivInstantiated) {
                var w = new avec.CollabPromptBox();
                var container = viewer.container;
                w.start(container, function () {
                    scope.panel.setVisible(true, true);
                }, "Start a Live Review", "Start Review");
            }
            else {
                scope.panel.setVisible(false, true);
                scope.panel.reset();
            }
        };
        if (this.disableRTCToolbarButton) {
            this.collabButton.setVisible(false, true);
        }

        this.panel.addVisibilityListener(function (state) {
            if (state) {

                if (viewer.model) {
                    var svf = viewer.model.getData();

                    scope.viewtx.channelId = svf.basePath;
                    scope.viewtx.attach(viewer);

                    scope.client.connect(scope.viewtx.channelId); //use the just the URN as load balancer session ID for now.
                    scope.client.join(scope.viewtx.channelId);
                }

                viewer.toolController.activateTool(scope.interceptor.getName());

                var getColumbusURL = function () {
                    var ret;
                    switch (window.location.hostname) {
                        case "columbus-dev.autodesk.com":
                            ret = "http://columbus-dev.autodesk.com/collab.html?";
                            break;
                        case "columbus-staging.autodesk.com":
                            ret = "http://columbus-staging.autodesk.com/collab-stg.html?";
                            break;
                        default:
                            ret = "http://columbus-dev.autodesk.com/collab.html?";
                    }

                    return ret + "document=urn:";
                };

                var generateSharedURL = function () {
                    var baseURL = getColumbusURL();
                    var urn = viewer.model.getData().urn;
                    var ret = baseURL + urn;
                    if (avp.comment2Token) {
                        ret += ("&comment2Token=" + encodeURIComponent(avp.comment2Token));
                    }
                    return ret;
                };

                /*
                window.prompt("Send this URL to people you want to share and collaborate on this file!",
                  generateSharedURL());
                */

                scope.collabButton.setState(avu.Button.State.ACTIVE);

                avp.logger.track({ category: "viewer_rtc_start" });
            }
            else {

                if (avp.logger && scope.client.isConnected())
                    avp.logger.track({ category: "viewer_rtc_stop" });

                scope.p2p.hangup();
                scope.viewtx.detach(viewer);
                scope.viewtx.channelId = null;
                scope.client.disconnect();
                scope.panel.reset();
                viewer.toolController.deactivateTool(scope.interceptor.getName());

                scope.collabButton.setState(avu.Button.State.INACTIVE);
            }
        });

        viewer.modelTools.addControl(this.collabButton);

        if (Autodesk.Viewing.Private.getParameterByName("invited")) {
            var w = new CollabPromptBox();
            var container = viewer.container;
            w.start(container, function () {
                scope.panel.setVisible(true, true);
            }, "Join a Live Review", "Join Review");
        }
    };


    Collaboration.prototype.close = function () {
        this.panel.setVisible(false, true);
        this.panel.reset();
    };

    Collaboration.prototype.load = function () {
        var viewer = this.viewer;
        var scope = this;

        function init() {

            scope.client = avp.MessageClient.GetInstance(scope.options ? scope.options.messageServerURL : undefined);

            scope.socketErrorHandler = function (evt) {
                avp.ErrorHandler.reportError(viewer.container, Autodesk.Viewing.ErrorCodes.RTC_ERROR, evt.data);
                scope.close();
            };

            scope.client.addEventListener("socketError", scope.socketErrorHandler);

            scope.presenceChannelId = window.location.host;

            if (scope.client.isConnected()) {
                //If the client is already connected, we assume that a presence service
                //is already joined by the embedding application.
                /*
                scope.client.addEventListener("userListChange", function(e) {
                    if (e.data.user && e.channelId == scope.presenceChannelId)
                        console.log(e.data.user.name + " is online.");
                    else if (e.userStatus == "left")
                        console.log(e.data.user.name + " went offline.");
                });
                */
            }
            else {
                //Standalone configuration, where no embedding application exists
                //Used for testing.
                //Moved to launch of the collaboration panel so we can connect with session ID for load balancing
                //this.client.connect();
                //this.client.join(this.presenceChannelId);
            }

            // add the button to the toolbar
            if (viewer.modelTools) {
                scope.createUI();
            } else {
                viewer.addEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
            }

            function onToolbarCreated(e) {
                viewer.removeEventListener(Autodesk.Viewing.TOOLBAR_CREATED_EVENT, onToolbarCreated);
                scope.createUI();
            }
        }

        //Load the socket.io library if needed
        loadDependency("lmv_io", "socket.io-1.3.5.js", init);

        return true;
    };

    Collaboration.prototype.unload = function () {

        var viewer = this.viewer;

        this.client.removeEventListener("socketError", this.socketErrorHandler);
        this.socketErrorHandler = null;

        this.p2p.hangup();
        this.viewtx.detach(viewer);
        this.client.disconnect();

        if (this.panel) {
            this.panel.reset();
            this.panel.setVisible(false);
            this.panel.uninitialize();
            this.panel = null;
        }

        viewer.toolController.deactivateTool(this.interceptor.getName());
        this.interceptor = null;

        viewer.modelTools.removeControl(this.collabButton.getId());
        this.collabButton = null;

        return true;
    };

    theExtensionManager.registerExtension('Autodesk.Viewing.Collaboration', Collaboration);
});