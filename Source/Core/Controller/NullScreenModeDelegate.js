define([
    '../Base/ScreenModeDelegate',
    '../Constants/ScreenMode'
], function(ScreenModeDelegate, ScreenMode) {
    'use strict';
    /**
     * NullScreenModeDelegate class
     * No full screen functionality.
     * @constructor
     * @extends Autodesk.Viewing.ScreenModeDelegate
     * @memberof Autodesk.Viewing
     * @alias Autodesk.Viewing.NullScreenModeDelegate
     * @param {Autodesk.Viewing.Viewer} viewer
     */
    var NullScreenModeDelegate = function (viewer) {
        ScreenModeDelegate.call(this, viewer);
    };

    NullScreenModeDelegate.prototype = Object.create(ScreenModeDelegate.prototype);
    NullScreenModeDelegate.prototype.constructor = ScreenModeDelegate;


    NullScreenModeDelegate.prototype.isModeSupported = function (mode) {
        return false; // No screen modes supported
    };

    NullScreenModeDelegate.prototype.getMode = function () {
        return ScreenMode.kNormal;
    };

    return NullScreenModeDelegate;
});