define([
    '../Controller/NullScreenModeDelegate',
    '../Controller/ApplicationScreenModeDelegate',
    '../Logger',
    '../Constants/ScreenMode'
], function(NullScreenModeDelegate, ApplicationScreenModeDelegate, Logger, ScreenMode) {
    'use strict';
    var ScreenModeMixin = function () {
    };


    ScreenModeMixin.prototype = {

        /**
         * Set new screen mode delegate
         * @param {ScreenModeDelegate} delegate - New screen mode delegate class
         */
        setScreenModeDelegate: function (delegate) {
            if (this.screenModeDelegate) {
                this.screenModeDelegate.uninitialize();
                this.screenModeDelegate = null;
            }

            // null -> Fullscreen not available
            // undefined -> Use default ApplicationScreenModeDelegate
            //
            if (delegate) {
                this.screenModeDelegateClass = delegate;
            } else if (delegate === null) {
                this.screenModeDelegateClass = NullScreenModeDelegate;
            } else { // undefined
                this.screenModeDelegateClass = ApplicationScreenModeDelegate;
            }
        },

        /**
         * Get current screen mode delegate
         * If no screen mode delegate has been set, then use Autodesk.Viewing.ViewerScreenModeDelegate.
         * @returns {ScreenModeDelegate} Current screen mode delegate
         */
        getScreenModeDelegate: function () {
            if (!this.screenModeDelegate) {
                this.screenModeDelegate = new this.screenModeDelegateClass(this);
            }
            return this.screenModeDelegate;
        },


        /**
         * Is specified screen mode supported?
         * @param {ScreenMode} mode
         * @returns {boolean} true if screen mode is supported
         */
        isScreenModeSupported: function (mode) {
            return this.getScreenModeDelegate().isModeSupported(mode);
        },

        /**
         * Is changing screen modes supported?
         * @returns {boolean} true if viewer supports changing screen modes
         */
        canChangeScreenMode: function () {
            return this.isScreenModeSupported(ScreenMode.kNormal);
        },

        /**
         * Set new screen mode
         * @param {ScreenMode} mode - New screen mode
         * @returns {boolean} true if screen mode was changed
         */
        setScreenMode: function (mode) {
            var msg = {
                category: "screen_mode",
                value: mode
            };
            Logger.track(msg);

            return this.getScreenModeDelegate().setMode(mode);
        },

        /**
         * Get current screen mode
         * @returns {ScreenMode} Current screen mode
         */
        getScreenMode: function () {
            return this.getScreenModeDelegate().getMode();
        },

        /**
         * Set screen mode to next in sequence
         * @returns {boolean} true if screen mode was changed
         */
        nextScreenMode: function () {
            var mode = this.getScreenModeDelegate().getNextMode();
            return (mode !== undefined) ? this.setScreenMode(mode) : false;
        },

        /**
         * Screen mode escape key handler
         * @returns {boolean} true if screen mode was changed
         */
        escapeScreenMode: function () {
            var mode = this.getScreenModeDelegate().getEscapeMode();
            return (mode !== undefined) ? this.setScreenMode(mode) : false;
        },


        apply: function (object) {

            var p = ScreenModeMixin.prototype;
            object.setScreenModeDelegate = p.setScreenModeDelegate;
            object.getScreenModeDelegate = p.getScreenModeDelegate;
            object.isScreenModeSupported = p.isScreenModeSupported;
            object.canChangeScreenMode = p.canChangeScreenMode;
            object.setScreenMode = p.setScreenMode;
            object.getScreenMode = p.getScreenMode;
            object.nextScreenMode = p.nextScreenMode;
            object.escapeScreenMode = p.escapeScreenMode;
        }

    };

    return ScreenModeMixin;
});