define([
    './MessageClient',
    './Fn/ViewTransceiver',
    './Fn/InteractionInterceptor',
    './P2PClient'
], function(MessageClient, ViewTransceiver, InteractionInterceptor, P2PClient) {
    'use strict';
    var LiveReviewClient = function (viewer) {

        this.viewer = viewer;
        this.messageClient = null;
        this.presenceChannelId = null;
        this.p2p = null;
        this.viewtx = null;
        this.interceptor = null;
    };

    LiveReviewClient.prototype.destroy = function () {
        this.leaveLiveReviewSession();
    };

    LiveReviewClient.prototype.joinLiveReviewSession = function (sessionId) {

        if (!this.messageClient)
            this.messageClient = MessageClient.GetInstance();
        if (!this.presenceChannelId)
            this.presenceChannelId = window.location.host;
        if (!this.messageClient.isConnected()) {
            this.messageClient.connect(sessionId);
        }

        if (!this.viewtx)
            this.viewtx = new ViewTransceiver(this.messageClient);
        this.viewtx.channelId = sessionId;
        this.viewtx.attach(this.viewer);

        if (!this.p2p)
            this.p2p = new P2PClient(this.messageClient);

        this.messageClient.join(this.viewtx.channelId);

        if (!this.interceptor)
            this.interceptor = new InteractionInterceptor(this.viewtx);
        this.viewer.toolController.registerTool(this.interceptor);
        this.viewer.toolController.activateTool(this.interceptor.getName());
    };

    LiveReviewClient.prototype.leaveLiveReviewSession = function () {
        this.p2p && this.p2p.hangup();
        this.viewtx && this.viewtx.detach(this.viewer);
        this.messageClient && this.messageClient.disconnect();
        if (this.interceptor) {
            this.viewer.toolController.deactivateTool(this.interceptor.getName());
        }

        this.p2p = null;
        this.viewtx = null;
        this.messageClient = null;
        this.interceptor = null;
    };
});