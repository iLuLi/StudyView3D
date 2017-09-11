define([
    '../Manager/FileLoaderManager',
    '../Logger',
    '../Renderer/RenderModel',
    '../TexQuad'
], function (FileLoaderManager, Logger, RenderModel, TexQuad) {
    'use strict';
    /** Loader for leaflet image pyramids and simple image files. 
     *   @param {Viewer3DImpl} parent
     */

    var ModelIteratorTexQuad = TexQuad.ModelIteratorTexQuad,
        TexQuadConfig = TexQuad.TexQuadConfig;
    function LeafletLoader(parent) {

        var _parent = parent;

        /** 
         * @callback LoadSuccessCB
         *   @param {RenderModel}
         *
         * @callback LoadErrorCB
         *   @param {number} errorCode
         *   @param {string} errorMsg
         *   @param {number} statusCode
         *   @param {string} statusText
         */

        /*
        * @param {string}        path
        * @param {Object}        [options]              Dictionary with options parsed from query string. 
        * @para  {Object}        [options.loadOptions]  For leaflets, this must contain additional params like tileSize, texWidth etc. (see TexQuadConfig.initFromLoadOptions)
        * @param {number}        [options.acmSessionId] Required when requesting non-public image files. 
        * @param {LoadSuccessCB} onSuccess 
        * @param {LoadErrorCB}   onError   
        */
        this.loadFile = function (path, options, onSuccess, onError, onWorkerStart) {

            // get leaflet params from loader options. Note that it's no error if we don't find them,
            // because simple image files can be loaded without any extra options
            var config = new TexQuadConfig();
            config.initFromLoadOptions(path, options.loadOptions, options.acmSessionId);

            var iter = null;

            //The Leaflet loader has no long running worker thread initialization,
            //so we can call back the viewer to continue its renderer initialization.
            if (onWorkerStart)
                onWorkerStart();

            //The code below requires the renderer (and the materials manager in particular)
            //to exist, which happens when we call back onWorkerStart above.
            function onLoad() {

                // Create ModelData. Will be returned when calling model.getData() on the data model
                function LeafletModelData(loadOptions) {
                    // used by Viewer3DImpl for initial camera adjustment     
                    this.bbox = new THREE.Box3();

                    this.basePath = path;

                    // run viewer in 2D mode
                    this.is2d = true;

                    // get paper extent. If not specified in the load options, use the texture resolution so that
                    // measurement works in pixels
                    var paperWidth = (loadOptions && loadOptions.paperWidth >= 0.0) ? loadOptions.paperWidth : config.texWidth;
                    var paperHeight = (loadOptions && loadOptions.paperHeight >= 0.0) ? loadOptions.paperHeight : config.texHeight;

                    // transform for measurement tools
                    this.pageToModelTransform = config.getPageToModelTransform(paperWidth, paperHeight);

                    // make page dimensions available to viewer and tools. We store this in an own object metadata.page_dimensions.
                    // This is done for consistency with F2D, so that functions like Model.getMetaData() and Model.getDisplayUnits() can use it.
                    this.metadata = new Object();
                    this.metadata.page_dimensions = new Object();
                    var pd = this.metadata.page_dimensions;
                    pd.page_width = paperWidth;
                    pd.page_height = paperHeight;
                    pd.page_units = loadOptions.paperUnits;

                    // signal that the model is ready to use, e.g., to do measurements
                    this.loadDone = true;
                };
                var modelData = new LeafletModelData(options.loadOptions);
                iter.getVisibleBounds(modelData.bbox);

                // Create RenderModel with texQuad iterator
                var model = new RenderModel(modelData);
                model.initFromCustomIterator(iter);

                onSuccess(model);
            }

            // if we have no leaflet params, handle it as a single image
            var isSimpleImage = !config.valid();
            if (isSimpleImage) {
                // when displaying a single image, we don't know the extents in advance.
                // But we need them to determine the bbox for the initial camera placement.
                // Therefore, we defer the loading for this case until the image is loaded.
                // The image dimensions are then derived from the image file.
                config.initForSimpleImage(path, onLoad);
            }

            // create iterator 
            iter = new ModelIteratorTexQuad(config, _parent.getMaterials());

            // when loading leaflets, we know texWidth/texHeight in advance and can
            // add finish loading right away. 
            if (!isSimpleImage) {
                onLoad();
            }

        }
    }

    // For standard leaflet hierarchies, the root level 0 is the only one with only one tile,
    // i.e., there are already 2-4 tiles at level 1. 
    // In contrast, the hierarchies produced by cloud translation start at a root resolution of 1x1,
    // thus containing several levels that we have to skip. The number of skipped levels is controlled 
    // by the 'levelOffset' parameter. 
    // The level offset that we need for a hierarchy with a root resolution of 1x1 resolution depends
    // on the tileSize and is computed by this function,
    LeafletLoader.computeLevelOffset = function (tileSize) {

        // when reaching this, we abort the loop, because there is something strange
        // with the tileSize parameter.
        var MaxCycles = 20;

        var pixelSize = 1;
        var level = 0;
        for (var i = 0; i < MaxCycles; i++) {
            // will the next level still fit into a single tile?
            pixelSize *= 2;

            // if no, stop here
            if (pixelSize > tileSize) {
                return level;
            }
            level++;
        }

        Logger.log("unexpected leaflet tileSize");
        return 0;
    }



    FileLoaderManager.registerFileLoader("Leaflet", ["jpeg", "jpg", "png"], LeafletLoader);

    return LeafletLoader;
});