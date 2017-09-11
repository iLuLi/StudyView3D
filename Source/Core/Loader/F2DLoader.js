define([
    '../Logger',
    '../Constants/DeviceType',
    '../Constants/Global',
    '../Constants/EventType',
    '../Utils/initWorkerScript',
    '../Utils/pathToURL',
    '../Worker/createWorker',
    '../Utils/BufferGeometryUtils',
    '../Inits',
    '../Renderer/RenderModel',
    '../Manager/FileLoaderManager'
], function(Logger, DeviceType, Global, EventType, initWorkerScript, pathToURL, createWorker, BufferGeometryUtils, Inits, RenderModel, FileLoaderManager) {
    'use strict';
    var WORKER_PARSE_F2D = "PARSE_F2D";
    var WORKER_STREAM_F2D = "STREAM_F2D";
    var WORKER_PARSE_F2D_FRAME = "PARSE_F2D_FRAME";

    var initLoadContext = Inits.initLoadContext;

    /** @constructor */
    function F2DLoader(parent) {
        this.viewer3DImpl = parent;
        this.loading = false;
        this.tmpMatrix = new THREE.Matrix4();

        this.logger = Logger;
        this.loadTime = 0;
        this.domainParam = (Global.auth && !Global.isNodeJS) ? ("domain=" + encodeURIComponent(window.location.origin)) : "";
    }

    F2DLoader.prototype.dtor = function () {
        this.svf = null;
        this.options = null;

        if (this.parsingWorker) {
            this.parsingWorker.terminate();
            this.parsingWorker = null;
        }
        if (this.streamingWorker) {
            this.streamingWorker.terminate();
            this.streamingWorker = null;
        }
    };


    F2DLoader.prototype.loadFile = function (path, options, onSuccess, onError, onWorkerStart) {
        if (this.loading) {
            Logger.log("Loading of F2D already in progress. Ignoring new request.");
            return false;
        }

        this.dtor();

        var index = path.indexOf('urn:');
        if (index != -1) {
            // Extract urn:adsk.viewing:foo.bar.whateverjunks out of the path URL and bind it to logger.
            // From now on, we can send logs to viewing service, and logs are grouped by urn to make Splunk work.
            path = decodeURIComponent(path);
            var urn = path.substr(index, path.substr(index).indexOf('/'));
            Logger.log("Extracted URN: " + urn);

            // Extract urn(just base64 code)
            var _index = urn.lastIndexOf(':');
            this.svfUrn = urn.substr(_index + 1);
        } else {
            this.svfUrn = path;
        }

        this.sharedDbPath = options.sharedPropertyDbPath;
        this.currentLoadPath = path;
        this.acmSessionId = options.acmSessionId;

        this.queryParam = this.domainParam;
        if (this.acmSessionId) {
            if (this.queryParam)
                this.queryParam += "&";
            this.queryParam += "acmsession=" + this.acmSessionId;
        }

        this.options = options;

        if (this.options.placementTransform) {
            //NOTE: The scale of the placement transform is not always sufficient to
            //determine the correct scale for line widths. This is because when a 2D model (in inches) is
            //loaded into a 3d scene in feet, the transform includes all the scaling needed to get into feet
            //but the model space line weight for the drawing is relative to the drawing itself, so an extra
            //factor of 12 would be needed in such case to cancel out the 1/12 needed for inch->foot.
            //This could probably be automatically derived, but in an error prone way, so I'm leaving it
            //up to the application layer that does the model aggregation to pass in the right model scale as an option.
            this.modelScale = this.options.modelScale || this.options.placementTransform.getMaxScaleOnAxis();
        } else {
            this.modelScale = this.options.modelScale || 1;
        }

        this.isf2d = true;
        var scope = this;

        initWorkerScript(function () {
            scope.loadFydoCB(path, options, onSuccess, onError, onWorkerStart);
        });

        return true;
    };


    F2DLoader.prototype.loadFydoCB = function (path, options, onSuccess, onError, onWorkerStart) {
        this.t0 = Date.now();

        var svfPath = pathToURL(path);

        // Streaming worker as data producer that generates fydo frame streams.
        var streamingWorker = this.streamingWorker = createWorker();
        // Parsing worker as data consumer that consumes fydo frame streams and generate meshes.
        var parsingWorker = this.parsingWorker = createWorker();
        var scope = this;
        var first = true;

        var onStream = function (ew) {

            if (first && onWorkerStart) {
                first = false;
                onWorkerStart();
            }

            if (ew.data && ew.data.type == "F2DBLOB") {
                var msg = {
                    operation: WORKER_PARSE_F2D,
                    data: ew.data.buffer,
                    metadata: ew.data.metadata,
                    manifest: ew.data.manifest,
                    basePath: ew.data.basePath,
                    f2dLoadOptions: {
                        modelSpace: options.modelSpace,
                        bgColor: options.bgColor
                    },
                    url: svfPath
                };
                parsingWorker.doOperation(msg, [msg.data]);
                streamingWorker.terminate();

            } else if (ew.data && ew.data.type == "F2DSTREAM") {

                var msg = {
                    operation: WORKER_PARSE_F2D_FRAME,
                    data: ew.data.frames,
                    url: svfPath,
                    f2dLoadOptions: {
                        modelSpace: options.modelSpace,
                        bgColor: options.bgColor
                    }
                };

                //first frame
                if (ew.data.metadata) {
                    msg.metadata = ew.data.metadata;
                    msg.manifest = ew.data.manifest;
                }

                //last frame?
                if (ew.data.finalFrame)
                    msg.finalFrame = true;

                if (ew.data.progress)
                    scope.viewer3DImpl.signalProgress(100 * ew.data.progress);

                parsingWorker.doOperation(msg, msg.data ? [msg.data] : undefined);

                if (ew.data.finalFrame)
                    streamingWorker.terminate();
            } else if (ew.data && ew.data.type == "F2DAssetURL") {
                Global.assets = Global.assets.concat(ew.data.urls);
            } else if (ew.data && ew.data.assetRequest) {
                Global.assets.push(ew.data.assetRequest);
            } else if (ew.data && ew.data.progress) {
                //just ignore progress-only message, it's only needed by the initial worker start notification above
            } else if (ew.data && ew.data.debug) {
                Logger.debug(ew.data.message);
            } else if (ew.data && ew.data.error) {
                scope.loading = false;
                streamingWorker.terminate();
                if (onError)
                    onError.call(this, ew.data.error.code, ew.data.error.msg, ew.data.error.args.httpStatus, ew.data.error.args.httpStatusText);
            } else {
                Logger.error("F2D download failed.");
                scope.loading = false;
                streamingWorker.terminate();
            }
        };



        var onParse = function (ew) {

            if (first && onWorkerStart) {
                first = false;
                onWorkerStart();
            }

            if (ew.data && ew.data.f2d) {
                var f = scope.svf = ew.data.f2d;

                parsingWorker.terminate();

                Logger.info("Num polylines: " + f.numPolylines);
                Logger.info("Line segments: " + f.numLineSegs);
                Logger.info("Circular arcs: " + f.numCircles);
                Logger.info("Ellipitcal arcs:" + f.numEllipses);
                Logger.info("Plain triangles:" + f.numTriangles);
                Logger.info("Total # of op codes generated by fydo.parse: " + f.opCount);

                scope.onModelRootLoadDone(scope.svf);

                if (onSuccess)
                    onSuccess(scope.model);

                scope.viewer3DImpl.api.fireEvent({ type: EventType.MODEL_ROOT_LOADED_EVENT, svf: scope.svf, model: scope.model });


                for (var i = 0; i < f.meshes.length; i++) {
                    scope.processReceivedMesh2D(f.meshes[i], i);
                }

                f.meshes = null;

                scope.onGeomLoadDone();

                scope.loading = false;

            } else if (ew.data && ew.data.f2dframe) {
                var baseIndex = 0;

                if (!ew.data.meshes) {
                    //First message from the worker
                    scope.svf = ew.data.f2dframe;
                    baseIndex = ew.data.baseIndex;
                } else {
                    //Update the world box and current mesh index
                    //on subsequent messages from the worker.
                    var bbox = ew.data.bbox;
                    scope.svf.bbox = new THREE.Box3(bbox.min, bbox.max);
                    baseIndex = ew.data.baseIndex;
                }

                var f = scope.svf;

                if (!f.fragments || !f.fragments.initialized) {
                    //First message from the worker,
                    //initialize the load states, fragment lists, etc.
                    scope.onModelRootLoadDone(f);

                    if (onSuccess) {
                        onSuccess(scope.model);
                    }
                    scope.viewer3DImpl.api.fireEvent({ type: EventType.MODEL_ROOT_LOADED_EVENT, svf: f, model: scope.model });

                }

                if (ew.data.meshes && ew.data.meshes.length) {
                    for (var i = 0; i < ew.data.meshes.length; i++) {
                        scope.processReceivedMesh2D(ew.data.meshes[i], baseIndex + i);
                    }
                }

                if (ew.data.finalFrame) {
                    //Update the F2D properties which are accumulated
                    //while reading the F2D stream.
                    var cumulativeProps = ew.data.cumulativeProps;
                    for (var p in cumulativeProps) {
                        f[p] = cumulativeProps[p];
                    }

                    scope.onGeomLoadDone();

                    scope.loading = false;

                    parsingWorker.terminate();
                }

            } else if (ew.data && ew.data.progress) {
                //just ignore progress-only message, it's only needed by the initial worker start notification above
            } else if (ew.data && ew.data.debug) {
                Logger.debug(ew.data.message);
            } else if (ew.data && ew.data.error) {
                scope.loading = false;
                parsingWorker.terminate();

                Logger.error("Error while parsing F2d: " + JSON.stringify(ew.data.error.args));

                // TODO: in debug model, viewer3d.html does not have any on error callback.
                // So, any errors would be swallowed, instead of reported back.
                // Is this intended? We should at least print the stack on console to help make our life easier.
                if (onError)
                    onError.call(this, ew.data.error.code, ew.data.error.msg, ew.data.error.args.httpStatus, ew.data.error.args.httpStatusText);
            } else {
                Logger.error("F2D download failed.");
                //Download failed.
                scope.loading = false;
                parsingWorker.terminate();
            }
        };

        streamingWorker.addEventListener('message', onStream, false);
        parsingWorker.addEventListener('message', onParse, false);

        var msg = {
            operation: WORKER_STREAM_F2D,
            url: svfPath,
            objectIds: options.ids,
            queryParams: this.queryParam
        };  // For CORS caching issue.

        streamingWorker.doOperation(initLoadContext(msg));

        return true;
    };



    F2DLoader.prototype.processReceivedMesh = function (mdata) {

        //Find all fragments that instance this mesh
        var meshid = mdata.packId + ":" + mdata.meshIndex;

        var svf = this.svf;
        var fragments = svf.fragments;

        var fragIndexes = fragments.mesh2frag[meshid];
        if (fragIndexes === undefined) {
            Logger.warn("Mesh " + meshid + " was not referenced by any fragments.");
            return;
        }
        if (!Array.isArray(fragIndexes))
            fragIndexes = [fragIndexes];

        //Convert the received mesh to THREE buffer geometry
        BufferGeometryUtils.meshToGeometry(mdata);

        var numInstances = fragIndexes.length;

        var rm = this.model;

        //Reuse previous index of this geometry, if available
        var geomId = rm.getGeometryList().addGeometry(mdata.geometry, numInstances);

        var ib = mdata.geometry.attributes['index'].array || mdata.geometry.ib;
        var polyCount = ib.length / 3;

        //For each fragment, add a mesh instance to the renderer
        for (var i = 0; i < fragIndexes.length; i++) {
            var fragId = 0 | fragIndexes[i];

            //We get the matrix from the fragments and we set it back there
            //with the activateFragment call, but this is to maintain the
            //ability to add a plain THREE.Mesh -- otherwise it could be simpler
            rm.getFragmentList().getOriginalWorldMatrix(fragId, this.tmpMatrix);

            if (this.options.placementTransform) {
                this.tmpMatrix = new THREE.Matrix4().multiplyMatrices(this.options.placementTransform, this.tmpMatrix);
            }

            var materialId = fragments.materials[fragId].toString();

            if (fragments.polygonCounts)
                fragments.polygonCounts[fragId] = polyCount;

            var m = this.viewer3DImpl.setupMesh(this.model, mdata.geometry, materialId, this.tmpMatrix);
            rm.activateFragment(fragId, m);
        }

        //don't need this mapping anymore.
        fragments.mesh2frag[meshid] = null;

        //Repaint and progress reporting
        fragments.numLoaded += fragIndexes.length;

        var numLoaded = fragments.numLoaded;

        //repaint every once in a while -- more initially, less as the load drags on.
        if (svf.geomPolyCount > svf.nextRepaintPolys) {
            //Logger.log("num loaded " + numLoaded);
            svf.numRepaints++;
            svf.nextRepaintPolys += 10000 * Math.pow(1.5, svf.numRepaints);
            this.viewer3DImpl.invalidate(false, true);
        }

        if ((numLoaded % 20) == 0) {
            this.viewer3DImpl.invalidate(false, true);
        }
    };

    F2DLoader.prototype.processReceivedMesh2D = function (mesh, mindex) {

        var mdata = { mesh: mesh, is2d: true, packId: "0", meshIndex: mindex };

        var meshId = "0:" + mindex;

        var frags = this.svf.fragments;

        //Remember the list of all dbIds referenced by this mesh.
        //In the 2D case this is 1->many (1 frag = many dbIds) mapping instead of
        // 1 dbId -> many fragments like in the SVF 3D case.
        var dbIds = Object.keys(mdata.mesh.dbIds).map(function (item) { return parseInt(item); });
        frags.fragId2dbId[mindex] = dbIds;

        //TODO: dbId2fragId is not really necessary if we have a good instance tree for the 2D drawing (e.g. Revit, AutoCAD)
        //so we can get rid of this mapping if we can convert Viewer3DImpl.highlightFragment to use the same logic for 2D as for 3D.
        for (var j = 0; j < dbIds.length; j++) {
            var dbId = dbIds[j];
            var fragIds = frags.dbId2fragId[dbId];
            if (Array.isArray(fragIds))
                fragIds.push(mindex);
            else if (typeof fragIds !== "undefined") {
                frags.dbId2fragId[dbId] = [fragIds, mindex];
            }
            else {
                frags.dbId2fragId[dbId] = mindex;
            }
        }

        frags.mesh2frag[meshId] = mindex;
        mesh.material.modelScale = this.modelScale;
        frags.materials[mindex] = this.viewer3DImpl.matman().create2DMaterial(this.svf, mesh.material);

        frags.length++;

        this.processReceivedMesh(mdata);

    };

    F2DLoader.prototype.onModelRootLoadDone = function (svf) {

        //In the 2d case we create and build up the fragments mapping
        //on the receiving end.
        svf.fragments = {};
        svf.fragments.mesh2frag = {};
        svf.fragments.materials = [];
        svf.fragments.fragId2dbId = [];
        svf.fragments.dbId2fragId = [];
        svf.fragments.length = 0;
        svf.fragments.initialized = true;


        svf.geomPolyCount = 0;
        svf.instancePolyCount = 0;
        svf.geomMemory = 0;
        svf.fragments.numLoaded = 0;
        svf.meshCount = 0;
        svf.gpuNumMeshes = 0;
        svf.gpuMeshMemory = 0;

        svf.nextRepaintPolys = 10000;
        svf.numRepaints = 0;

        svf.urn = this.svfUrn;
        svf.acmSessionId = this.acmSessionId;

        svf.basePath = "";
        var lastSlash = this.currentLoadPath.lastIndexOf("/");
        if (lastSlash != -1)
            svf.basePath = this.currentLoadPath.substr(0, lastSlash + 1);

        svf.loadOptions = this.options;

        var t1 = Date.now();
        this.loadTime += t1 - this.t0;
        Logger.log("SVF load: " + (t1 - this.t0));

        this.t0 = t1;

        //The BBox object loses knowledge of its
        //type when going across the worker thread boundary...
        svf.bbox = new THREE.Box3().copy(svf.bbox);

        //Create the API Model object and its render proxy
        var model = this.model = new RenderModel(svf);
        model.initialize(this);
        model.loader = this;
        this.svf.propWorker = new PropDbLoader(this.sharedDbPath, this.model, this.viewer3DImpl.api);

        Logger.log("scene bounds: " + JSON.stringify(svf.bbox));

        var metadataStats = {
            category: "metadata_load_stats",
            urn: svf.urn,
            layers: svf.layerCount
        };
        Logger.track(metadataStats);

        this.viewer3DImpl.signalProgress(5);
        this.viewer3DImpl.invalidate(false, false);
    };


    F2DLoader.prototype.onGeomLoadDone = function () {
        this.svf.loadDone = true;

        // Don't need these anymore
        this.svf.fragments.entityIndexes = null;
        this.svf.fragments.mesh2frag = null;

        var t1 = Date.now();
        var msg = "Fragments load time: " + (t1 - this.t0);
        this.loadTime += t1 - this.t0;

        //Load the property database after all geometry is loaded (2D case). For 2D,
        //the fragId->dbId mapping is only fully known once geometry is loaded, as
        //it's built on the fly.
        //TODO: As an optimization we can split the property db logic into two calls -- one to load the files
        //in parallel with the geometry and a second to do the processing.
        this.loadPropertyDb();

        Logger.log(msg);

        var modelStats = {
            category: "model_load_stats",
            is_f2d: true,
            has_prism: this.viewer3DImpl.matman().hasPrism,
            load_time: this.loadTime,
            geometry_size: this.model.getGeometryList().geomMemory,
            meshes_count: this.model.getGeometryList().geoms.length,
            urn: this.svfUrn
        };
        Logger.track(modelStats, true);

        function sendMessage(data) {
            if (DeviceType.isBrowser) {
                var handler = window.webkit.messageHandlers.callbackHandler;
                // We add doOperation() function, but on some implementation
                // of the WebWorker, setting a new property on it is not allowed
                // so we fallback onto the wrapped function
                var fn = handler.doOperation || handler.postMessage;
                fn && fn({ 'command': 'assets', data: data });
            }
        }

        if (Global.assets) {
            // Callback to ios.
            if (DeviceType.isBrowser && window.webkit) {
                sendMessage(Global.assets);
                Global.assets = null;
            }
        }

        this.currentLoadPath = null;
        this.isf2d = undefined;

        this.viewer3DImpl.onLoadComplete(this.model);
    };


    F2DLoader.prototype.loadPropertyDb = function () {
        this.svf.propWorker.load();
    };


    FileLoaderManager.registerFileLoader("f2d", ["f2d"], F2DLoader);

    return F2DLoader;
});