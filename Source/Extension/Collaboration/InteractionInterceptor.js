define(function () {
    'use strict';
    return function (viewtx) {

        this.getNames = function () {
            return ["intercept"];
        };

        this.getName = function () {
            return "intercept";
        };

        this.activate = function (name) { };
        this.deactivate = function (name) { };
        this.update = function (timeStamp) { return false; };

        this.handleSingleClick = function (event, button) { return false; };
        this.handleDoubleClick = function (event, button) { return false; };
        this.handleSingleTap = function (tap) { return false; };
        this.handleDoubleTap = function (tap1, tap2) { return false; };
        this.handleKeyDown = function (event, keyCode) { return false; };
        this.handleKeyUp = function (event, keyCode) { return false; };

        this.handleWheelInput = function (delta) {
            viewtx.takeControl();
            return false;
        };

        this.handleButtonDown = function (event, button) {
            viewtx.takeControl();
            return false;
        };

        this.handleButtonUp = function (event, button) { return false; };
        this.handleMouseMove = function (event) {
            viewtx.updatePointer(event);
            return false;
        };

        this.handleGesture = function (event) {
            viewtx.takeControl();
            return false;
        };

        this.handleBlur = function (event) { return false; };
        this.handleResize = function () { };
    };


});