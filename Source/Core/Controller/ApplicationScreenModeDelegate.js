define([
    '../Base/ScreenModeDelegate',
    '../Constants/ScreenMode',
    '../Utils/FullscreenTool',
], function(ScreenModeDelegate, ScreenMode, FullscreenTool) {
    'use strict';

    var exitFullscreen = FullscreenTool.exitFullscreen,
        launchFullscreen = FullscreenTool.launchFullscreen,
        inFullscreen = FullscreenTool.inFullscreen;

    /**
     * ApplicationScreenModeDelegate class
     * Allows viewer to go full screen. Unlike ViewerScreenModeDelegate class, this delegate
     * doesn't use the full browser state, and it takes the entire page full screen, not just
     * the viewer.
     * @constructor
     * @extends Autodesk.Viewing.ScreenModeDelegate
     * @memberof Autodesk.Viewing
     * @alias Autodesk.Viewing.ApplicationScreenModeDelegate
     * @param {Autodesk.Viewing.Viewer} viewer
     */
    var ApplicationScreenModeDelegate = function (viewer) {
        ScreenModeDelegate.call(this, viewer);
    };

    ApplicationScreenModeDelegate.prototype = Object.create(ScreenModeDelegate.prototype);
    ApplicationScreenModeDelegate.prototype.constructor = ApplicationScreenModeDelegate;

    ApplicationScreenModeDelegate.prototype.isModeSupported = function (mode) {
        return mode !== ScreenMode.kFullBrowser;
    };

    ApplicationScreenModeDelegate.prototype.getMode = function () {
        return inFullscreen() ?
            ScreenMode.kFullScreen :
            ScreenMode.kNormal;
    };

    ApplicationScreenModeDelegate.prototype.doScreenModeChange = function (oldMode, newMode) {
        var container = this.viewer.container;
        if (newMode === ScreenMode.kNormal) {
            container.classList.remove('viewer-fill-browser');
            exitFullscreen();
        } else if (newMode === ScreenMode.kFullScreen) {
            container.classList.add('viewer-fill-browser');
            launchFullscreen(container);
        }
    };

    return ApplicationScreenModeDelegate;
});