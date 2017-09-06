define(function() {;
    'use strict'
    /**
     * An Extension is a way to configure add functionality to the viewer.  Derive from this
     * class and implement the load and optionally the unload methods.
     *
     * Register this extension by calling:
     * `Autodesk.Viewing.theExtensionManager.registerExtension('your_extension_id', Autodesk.Viewing.Extensions.<your_extension_class>); `
     *
     * Extensions are registered and loaded automatically by adding the Extension ID to the
     * config object passed to the viewer constructor.
     *
     * An example Extension is available at viewingservice/v1/viewers/SampleExtension/, and includes
     * these files:
     * * SampleExtension.js
     * * SampleLayersPanel.js
     * * SampleModelStructurePanel.js
     * * SamplePropertyPanel.js
     * * SampleLayersPanel.css
     * * SampleModelStructurePanel.css
     * * SamplePropertyPanel.css
     * 
     * @alias Autodesk.Viewing.Extension
     * @param {Viewer} viewer - the viewer to be extended.
     * @param {Object} options - An optional dictionary of options for this extension.
     * @constructor
     */
    var Extension = function (viewer, options) {
        this.viewer = viewer;
        this.options = options;
    };

    /**
     * Override the load method to add functionality to the viewer.  Use the Viewer's APIs
     * to add/modify/replace/delete UI, register event listeners, etc.
     *
     * @returns {boolean} - True if the load was successful.
     */
    Extension.prototype.load = function () {
        return true;
    };

    /**
     * Override the unload method to perform some cleanup of operations that were done
     * in load.
     *
     * @returns {boolean} - True if the unload was successful.
     */
    Extension.prototype.unload = function () {
        return true;
    };

    /**
     * Gets the extension state as a plain object. Intended to be called when viewer state is requested.
     *
     * @param {Object} viewerState - Object to inject extension values.
     *
     * @virtual
     */
    Extension.prototype.getState = function (viewerState) {
    };

    /**
     * Restores the extension state from a given object.
     *
     * @param {Object} viewerState
     * @param {boolean} [immediate] - Whether the new view is applied with (true) or without transition (false)
     *
     * @returns {boolean} true if restore operation was successful.
     *
     * @virtual
     */
    Extension.prototype.restoreState = function (viewerState, immediate) {
        return true;
    };

    return Extension;
});