define(function () {
    'use strict';
    /**
     * Base class for file loaders.
     *
     * It is highly recommended that file loaders use worker threads to perform the actual loading in order to keep the
     * UI thread free. Once loading is complete, the loader should call viewer.impl.onLoadComplete(). During loading,
     * the loader can use viewer.impl.signalProgress(int) to indicate how far along the process is.
     *
     * To add geometry to the viewer, viewer.impl.addMeshInstance(geometry, meshId, materialId, matrix) should be used.
     * Geometry must be THREE.BufferGeometry, meshId is a number, materialId is a string, and matrix is the THREE.Matrix4
     * transformation matrix to be applied to the geometry.
     *
     * Remember to add draw calls to the BufferGeometry if the geometry has more than 65535 faces.
     *
     * @param {Autodesk.Viewing.Viewer3D} viewer - The viewer.
     * @constructor
     * @abstract
     */
    var FileLoader = function (viewer) {
        this.viewer = viewer;
    };

    FileLoader.prototype.constructor = FileLoader;

    /**
     * Initiates the loading of a file from the given URL.
     *
     * This method must be overridden.
     *
     * @param {String} url - The url for the file.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {String} [options.ids] A list of object id to load.
     * @param {String} [options.sharedPropertyDbPath] Optional path to shared property database
     * @param {Function} [onSuccess] - Callback function when the file begins loading successfully. Takes no arguments.
     * @param {Function} [onError] - Callback function when an error occurs. Passed an integer error code and a string description of the error.
     */
    FileLoader.prototype.loadFile = function (url, options, onSuccess, onError) {
        return false;
    };

    return FileLoader;
});