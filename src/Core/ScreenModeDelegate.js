define([
    './ScreenMode',
    './Fn/inFullscreen',
    './EventType'
], function(ScreenMode, inFullscreen, EventType) {
    'use strict';
    var fsNames = ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'];
    
    function addListener(listener) {
        for (var i = 0; i < fsNames.length; ++i)
            document.addEventListener(fsNames[i], listener, false);
    }

    function removeListener(listener) {
        for (var i = 0; i < fsNames.length; ++i)
            document.removeEventListener(fsNames[i], listener, false);
    }


    /**
     * ScreenModeDelegate virtual base class
     * Derive from this class and use it to allow viewer to go full screen
     * @constructor
     * @param {Autodesk.Viewing.Viewer} viewer
     * @memberof Autodesk.Viewing
     * @alias Autodesk.Viewing.ScreenModeDelegate
     */
    function ScreenModeDelegate(viewer) {
        this.viewer = viewer;
        this.bindFullscreenEventListener = this.fullscreenEventListener.bind(this);

        if (this.getMode() === ScreenMode.kFullScreen) {
            addListener(this.bindFullscreenEventListener);
        }
    }

    /**
     * Perform any cleanup required for a ScreenModeDelegate instance
     */
    ScreenModeDelegate.prototype.uninitialize = function () {

        removeListener(this.bindFullscreenEventListener);
        this.viewer = null;
    };

    /**
     * Is screen mode supported?
     * Returning false for kNormal means no screen mode changes are supported
     * @param {Autodesk.Viewing.ScreenMode} mode
     * @returns {boolean} true if screen mode is supported
     */
    ScreenModeDelegate.prototype.isModeSupported = function (mode) {
        return true;
    };

    /**
     * Set new screen mode
     * @param {Autodesk.Viewing.ScreenMode} mode - New screen mode
     * @returns {boolean} true if screen mode was changed
     */
    ScreenModeDelegate.prototype.setMode = function (mode) {
        var currentMode = this.getMode();
        if ((mode !== currentMode) && this.isModeSupported(mode)) {
            this.doScreenModeChange(currentMode, mode);
            this.onScreenModeChanged(currentMode, mode);
            return true;
        }
        return false;
    };

    /**
     * Override this method to get the current screen mode
     * @returns {Autodesk.Viewing.ScreenMode} Current screen mode
     */
    ScreenModeDelegate.prototype.getMode = function () {
        throw 'Implement getMode() in derived class';
    };

    /**
     * Return next screen mode in sequence
     * Depending upon isModeSupported(), this may be a toggle or a 3-state
     * @returns {Autodesk.Viewing.ScreenMode|undefined} Next screen mode in sequence or undefined if no change
     */
    ScreenModeDelegate.prototype.getNextMode = function () {
        var currentMode = this.getMode(),
            newMode;

        var SM = ScreenMode;

        if (currentMode === SM.kNormal &&
            this.isModeSupported(SM.kFullBrowser)) {

            newMode = SM.kFullBrowser;

        } else if (currentMode === SM.kNormal &&
            this.isModeSupported(SM.kFullScreen)) {

            newMode = SM.kFullScreen;

        } else if (currentMode === SM.kFullBrowser &&
            this.isModeSupported(SM.kFullScreen)) {

            newMode = SM.kFullScreen;

        } else if (currentMode === SM.kFullBrowser &&
            this.isModeSupported(SM.kNormal)) {

            newMode = SM.kNormal;

        } else if (currentMode === SM.kFullScreen &&
            this.isModeSupported(SM.kNormal)) {

            newMode = SM.kNormal;

        } else if (currentMode === SM.kFullScreen &&
            this.isModeSupported(SM.kFullBrowser)) {

            newMode = SM.kFullBrowser;
        }
        return newMode;
    };

    /**
     * Return new screen mode on escape
     * @returns {Autodesk.Viewing.ScreenMode|undefined} New screen mode or undefined if no change
     */
    ScreenModeDelegate.prototype.getEscapeMode = function () {
        return (this.getMode() !== ScreenMode.kNormal) ?
            ScreenMode.kNormal : undefined;
    };

    /**
     * Full screen event listener.
     */
    ScreenModeDelegate.prototype.fullscreenEventListener = function () {
        if (inFullscreen()) {
            this.viewer.resize();
        } else {
            var ScreenMode = ScreenMode;
            this.doScreenModeChange(ScreenMode.kFullScreen, ScreenMode.kNormal);
            this.onScreenModeChanged(ScreenMode.kFullScreen, ScreenMode.kNormal);
        }
    };

    /**
     * Override this method to make the screen mode change occur
     * @param {Autodesk.Viewing.ScreenMode} oldMode - Old screen mode
     * @param {Autodesk.Viewing.ScreenMode} newMode - New screen mode
     */
    ScreenModeDelegate.prototype.doScreenModeChange = function (oldMode, newMode) {
        throw 'Implement doScreenModeChange() in derived class';
    };

    /**
     * Called after the screen mode changes
     * @param {Autodesk.Viewing.ScreenMode} oldMode - Old screen mode
     * @param {Autodesk.Viewing.ScreenMode} newMode - New screen mode
     */
    ScreenModeDelegate.prototype.onScreenModeChanged = function (oldMode, newMode) {
        if (oldMode === ScreenMode.kFullScreen) {
            removeListener(this.bindFullscreenEventListener);
        } else if (newMode === ScreenMode.kFullScreen) {
            addListener(this.bindFullscreenEventListener);
        }

        this.viewer.resize();
        this.viewer.fireEvent({ type: EventType.FULLSCREEN_MODE_EVENT, mode: newMode });
    };

    return ScreenModeDelegate;
});