define([
    '../Core/Manager/theExtensionManager',
    '../Core/Constants/EventType',
    './Extension',
    './CAMModelStructurePanel'
], function(theExtensionManager, EventType, Extension, CAMModelStructurePanel) {
    'use strict';
    function CAM360Extension(viewer, options) {
        Extension.call(this, viewer, options);
    }

    CAM360Extension.prototype = Object.create(Extension.prototype);
    CAM360Extension.prototype.constructor = CAM360Extension;

    CAM360Extension.prototype.load = function () {
        var viewer = this.viewer;
        var modelStructurePanel = new CAMModelStructurePanel(this.viewer, 'CAM Model Structure Loading', this.options);
        viewer.setModelStructurePanel(modelStructurePanel);

        // Change these viewer settings for CAM files.
        //
        viewer.hideLines(false);
        viewer.setGhosting(false);
        viewer.setQualityLevel(false, true);

        // Wait till the geometry has loaded before changing the light preset, to ensure that
        // our light preset is the last applied.
        //
        function setLightPresetToSimpleGrey() {
            viewer.impl.setLightPreset(0, true);
            viewer.removeEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, setLightPresetToSimpleGrey);
        }
        viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, setLightPresetToSimpleGrey);

        return true;
    };

    CAM360Extension.prototype.unload = function () {
        // Remove the panel from the viewer.
        //
        this.viewer.setModelStructurePanel(null);
    };


    theExtensionManager.registerExtension('Autodesk.CAM360', CAM360Extension);

    return CAM360Extension;
});