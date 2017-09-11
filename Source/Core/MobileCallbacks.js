define(function() {
    'use strict';
    function MobileCallbacks() {
        this.ios = window.webkit;
        this.android = window.JSINTERFACE;
    
        this.iosSend = function (commandName, args) {
            window.webkit.messageHandlers.callbackHandler.postMessage({ 'command': commandName, 'data': args });
        };
    
        this.androidSend = window.JSINTERFACE;
    }
    
    var proto = MobileCallbacks.prototype;
    
    proto.animationReady = function () {
        if (this.ios)
            this.iosSend('animationReady');
        else if (this.android)
            this.androidSend.animationReady();
    };
    
    proto.onSelectionChanged = function (dbId) {
        if (this.ios)
            this.iosSend('selectionChanged', dbId);
        else if (this.android)
            this.androidSend.onSelectionChanged(dbId);
    };
    
    proto.onLongTap = function (clientX, clientY) {
        if (this.ios)
            this.iosSend('onLongTap', [clientX, clientY]);
        else if (this.android)
            this.androidSend.onLongTap(clientX, clientY);
    };
    
    proto.onSingleTap = function (clientX, clientY) {
        if (this.ios)
            this.iosSend('onSingleTap', [clientX, clientY]);
        else if (this.android)
            this.androidSend.onSingleTap(clientX, clientY);
    };
    
    proto.onDoubleTap = function (clientX, clientY) {
        if (this.ios)
            this.iosSend('onDoubleTap', [clientX, clientY]);
        else if (this.android)
            this.androidSend.onDoubleTap(clientX, clientY);
    };
    
    proto.setRTCSession = function (id) {
        if (this.ios)
            this.iosSend('setRTCSession', { 'id': id });
        else if (this.android)
            this.androidSend.setRTCSessionID(id);
    };
    
    proto.putProperties = function (name, value) {
        if (this.ios)
            this.iosSend('putProperties', { 'name': name, 'value': value });
        else if (this.android)
            this.androidSend.putProperties(name, value);
    };
    
    proto.onPropertyRetrievedSuccess = function () {
        if (this.ios)
            this.iosSend('onPropertyRetrievedSuccess');
        else if (this.android)
            this.androidSend.onPropertyRetrievedSuccess();
    };
    
    proto.onPropertyRetrievedFailOrEmptyProperties = function () {
        if (this.ios)
            this.iosSend('onPropertyRetrievedFailOrEmptyProperties');
        else if (this.android)
            this.androidSend.onPropertyRetrievedFailOrEmptyProperties();
    };
    
    proto.resetAnimationStatus = function () {
        if (this.ios)
            this.iosSend('resetAnimationStatus');
        else if (this.android)
            this.androidSend.resetAnimationStatus();
    };
    
    proto.setPauseUI = function () {
        if (this.ios)
            this.iosSend('setPauseUI');
        else if (this.android)
            this.androidSend.setToPaused();
    };
    
    proto.updateAnimationTime = function (time) {
        if (this.ios)
            this.iosSend('updateAnimationTime', time);
        else if (this.android)
            this.androidSend.updateAnimationTime(time);
    };
    
    
    proto.setLoadingProgress = function (progress) {
        if (this.ios)
            this.iosSend('setLoadingProgress', progress);
        else if (this.android)
            this.androidSend.setLoadingProgress(progress);
    };
    
    proto.objectTreeCreated = function () {
        if (this.ios)
            this.iosSend('objectTreeCreated');
        else if (this.android)
            this.androidSend.objectTreeCreated();
    };
    
    proto.geometryLoaded = function () {
        if (this.ios)
            this.iosSend('geometryLoaded');
        else if (this.android)
            this.androidSend.geometryLoaded();
    };
    
    proto.putSheets = function (geomName, geomGuid) {
        if (this.ios)
            this.iosSend('putSheets', [geomName, geomGuid]);
        else if (this.android)
            this.androidSend.putSheets(geomName, geomGuid);
    };
    
    proto.hideLoadingView = function () {
        if (this.android)
            this.androidSend.hideLoadingView();
    };

    return MobileCallbacks;
});