define([
    '../Manager/theExtensionManager',
    '../Constants/EventType',
    '../Logger'
], function(theExtensionManager, EventType, Logger) {
    'use strict';
    /***
     * Augments a class by extension load/unload functionality.
     */
    var ExtensionMixin = function () { };
    
    ExtensionMixin.prototype = {

        /**
         * Loads the extension with the given id and options.
         * For internal use only.
         *
         * @param {string} extensionId - The string id of the extension.
         * @param {Object} options - An optional dictionary of options.
         *
         * @returns {boolean} - True if the extension was successfully loaded.
         */
        loadExtension: function (extensionId, options) {

            if (!this.loadedExtensions)
                this.loadedExtensions = {};

            var success = false;
            if (!this.getExtension(extensionId)) {
                var extensionClass = theExtensionManager.getExtension(extensionId);
                if (extensionClass) {
                    var extension = new extensionClass(this, options);
                    success = extension.load();
                    if (success) {
                        this.loadedExtensions[extensionId] = extension;
                        Logger.info('Extension loaded: ' + extensionId);
                        this.fireEvent({ type: EventType.EXTENSION_LOADED_EVENT, extensionId: extensionId });
                    }
                } else {
                    Logger.warn('Extension not found: ' + extensionId);
                }
            } else {
                Logger.info('Extension already loaded: ' + extensionId);
            }
            return success;
        },

        /**
         * Returns the loaded extension.
         * @param {string} extensionId - The string id of the extension.
         * @returns {?Object} - Extension.
         */
        getExtension: function (extensionId) {
            return (this.loadedExtensions && extensionId in this.loadedExtensions) ? this.loadedExtensions[extensionId] : null;
        },

        /**
         * Unloads the extension with the given id.
         * For internal use only.
         *
         * @param {string} extensionId - The string id of the extension.
         * @returns {boolean} - True if the extension was successfully unloaded.
         */
        unloadExtension: function (extensionId) {
            var success = false;
            var ext = this.getExtension(extensionId);
            if (ext) {
                success = ext.unload();
                Logger.info('Extension unloaded: ' + extensionId);
                delete this.loadedExtensions[extensionId];
                this.fireEvent({ type:EventType.EXTENSION_UNLOADED_EVENT, extensionId: extensionId });
            } else {
                Logger.warn('Extension not found: ' + extensionId);
            }
            return success;
        },


        apply: function (object) {

            var me = ExtensionMixin.prototype;

            object.loadExtension = me.loadExtension;
            object.getExtension = me.getExtension;
            object.unloadExtension = me.unloadExtension;
        }

    };
    
    return ExtensionMixin;
});