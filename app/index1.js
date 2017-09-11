define([
    '../Source/UI/GuiViewer3D',
    '../Source/Core/Inits',
    '../Source/HY'
], function(GuiViewer3D, Inits) {
    'use strict';
     //ENABLE_DEBUG = false;
    var config = {
        extensions: [],
        disabledExtensions: {
            measure: false,
            section: false,
        }
    };

    var path = "./model/3d.svf";
    var element = document.getElementById('viewer-local');
    var viewer = new GuiViewer3D(element, config);
    //var viewer = new Autodesk.Viewing.Viewer3D(element, config);

    var options = {
        docid: path,
        env: 'Local',
        offline: 'true',
        useADP: false
    };

    Inits.Initializer(options, function () {
        //viewer.initialize();
        viewer.start();
        viewer.load(options.docid, undefined, onLoadSuccess, onLoadError);
    });

    function onLoadSuccess(event) {
        console.log('success');
    }

    function onLoadError(event) {
        console.log('fail');
    }
});