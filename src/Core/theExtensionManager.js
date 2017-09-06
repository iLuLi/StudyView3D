define(function() {
    'use strict';
    /**
     * The ExtensionManager manages a set of extensions available to the viewer.
     * Register, retrieve, and unregister your extension using the singleton theExtensionManager.
     *
     * You can load/unload your registered extension into a Viewer by calling
     * {@link Autodesk.Viewing.Viewer#loadExtension|viewer.loadExtension(id, options)} and
     * {@link Autodesk.Viewing.Viewer#unloadExtension|viewer.unloadExtension(id)}, respectively.
     * @constructor
     */
    var ExtensionManager = function () {
        var extensions = {};

        /**
         * Registers a new extension with the given id.
         *
         * @param {string} extensionId - The string id of the extension.
         * @param {Extension} extension - The Extension-derived class representing the extension.
         * @returns {boolean} - True if the extension was successfully registered.
         */
        function registerExtension(extensionId, extension) {
            if (!extensions.hasOwnProperty(extensionId)) {
                extensions[extensionId] = extension;
                return true;
            }
            return false;
        }

        /**
         * Returns the class representing the extension with the given id.
         *
         * @param {string} extensionId - The string id of the extension.
         * @returns {!Extension} - The Extension-derived class if one was registered; null otherwise.
         */
        function getExtension(extensionId) {
            if (extensions.hasOwnProperty(extensionId)) {
                return extensions[extensionId];
            }
            return null;
        }

        /**
         * Unregisters an existing extension with the given id.
         *
         * @param {string} extensionId - The string id of the extension.
         * @returns {boolean} - True if the extension was successfully unregistered.
         */
        function unregisterExtension(extensionId) {
            if (extensions.hasOwnProperty(extensionId)) {
                delete extensions[extensionId];
                return true;
            }
            return false;
        }

        return {
            registerExtension: registerExtension,
            getExtension: getExtension,
            unregisterExtension: unregisterExtension
        };
    };

    return new ExtensionManager();
});