define([
    '../FileLoaderManager',
    '../DeviceType',
    '../Logger',
    '../../Worker/createWorkerWithIntercept',
    './Fn/pathToURL',
    './Global',
    '../EventType',
    './Fn/initLoadContext',
    './BufferGeometryUtils',
    './NodeArray',
    './PropDbLoader',
    './RenderModel',
    './BVHBuilder',
    '../../Worker/initWorkerScript'
], function(
    FileLoaderManager, 
    DeviceType,
    Logger,
    createWorkerWithIntercept,
    pathToURL,
    Privite_Global,
    EventType,
    initLoadContext,
    BufferGeometryUtils,
    NodeArray,
    PropDbLoader,
    RenderModel,
    BVHBuilder,
    initWorkerScript
) {
    'use strict';
    var NUM_WORKER_THREADS = DeviceType.isNodeJS ? 10 : (DeviceType.isMobileDevice ? 2 : 6);
    var WORKER_LOAD_GEOMETRY = "LOAD_GEOMETRY";
    var WORKER_LOAD_SVF = "LOAD_SVF";
    var WORKER_LOAD_SVF_CONTD = "LOAD_SVF_CONTD";


    /** @constructor */
    var SvfLoader = function (parent) {
        this.viewer3DImpl = parent;
        this.next_pack = 0;
        this.loading = false;
        this.loadedPacksCount = 0;
        this.loadedPacks = [];
        this.tmpMatrix = new THREE.Matrix4();

        this.logger = Logger;
        this.loadTime = 0;
        this.domainParam = (auth && !DeviceType.isNodeJS) ? ("domain=" + encodeURIComponent(window.location.origin)) : "";

        // Local options inheriting from global options, but will change according to the size of the model.
        this.onDemandLoading = false;
        this.cullGeometryOnLoading = false;
        this.pageOutGeometryEnabled = false;
    };

    SvfLoader.prototype.dtor = function () {
        this.svf = null;
        this.options = null;

        if (this.svfWorker) {
            this.svfWorker.clearAllEventListenerWithIntercept();
            this.svfWorker.terminate();
            this.svfWorker = null;
        }
        if (this.pack_workers) {
            for (var i = 0; i < this.pack_workers.length; i++) {
                this.pack_workers[i].clearAllEventListenerWithIntercept();
                this.pack_workers[i].terminate();
            }
            this.pack_workers = null;
        }
    };

    

    SvfLoader.prototype.loadFile = function (path, options, onSuccess, onError, onWorkerStart) {
        if (this.loading) {
            Logger.log("Loading of SVF already in progress. Ignoring new request.");
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
        var lastSlash = this.currentLoadPath.lastIndexOf("/");
        if (lastSlash != -1)
            this.basePath = this.currentLoadPath.substr(0, lastSlash + 1);

        this.acmSessionId = options.acmSessionId;

        this.queryParam = this.domainParam;
        if (this.acmSessionId) {
            if (this.queryParam)
                this.queryParam += "&";
            this.queryParam += "acmsession=" + this.acmSessionId;
        }

        this.options = options;
        var scope = this;

        initWorkerScript(function () {
            scope.loadSvfCB(path, options, onSuccess, onError, onWorkerStart);
        });

        return true;
    };


    /**
     * Define this to manipulate the manifest before it is used.
     * Must be either undefined or a function that takes exactly one argument, the manifest.
     *
     * I.e.: Autodesk.Viewing.Private.SvfLoader.prototype.interceptManifest = function(manifest) { <your code> };
     *
     */
    SvfLoader.prototype.interceptManifest = undefined;

    SvfLoader.prototype.loadSvfCB = function (path, options, onSuccess, onError, onWorkerStart) {
        this.t0 = new Date().getTime();
        this.firstPixelTimestamp = null;
        this.failedToLoadSomeGeometryPacks = null;
        var first = true;

        var scope = this;
        var msg = {
            url: pathToURL(path),
            basePath: this.currentLoadPath,
            objectIds: options.ids,
            globalOffset: options.globalOffset,
            placementTransform: options.placementTransform,
            applyRefPoint: options.applyRefPoint,
            queryParams: this.queryParam,
            bvhOptions: options.bvhOptions || { isWeakDevice: DeviceType.isMobileDevice }
        };

        var w = this.svfWorker = createWorkerWithIntercept();

        var onSVFLoad = function (ew) {
            var cleaner = function () {
                w.clearAllEventListenerWithIntercept();
                w.terminate();
                scope.svfWorker = null;
                w = null;
            };

            if (first && onWorkerStart) {
                first = false;
                onWorkerStart();
            }

            if (ew.data && ew.data.manifest) {

                scope.interceptManifest(ew.data.manifest);
                msg.operation = WORKER_LOAD_SVF_CONTD;
                msg.manifest = ew.data.manifest;
                w.doOperation(msg);
            } else if (ew.data && ew.data.svf) {
                //Decompression is done.
                var svf = scope.svf = ew.data.svf;

                if (scope.failedToLoadSomeGeometryPacks) {
                    // Report a warning. It is not a fatal error.
                    if (onError)
                        onError(scope.failedToLoadSomeGeometryPacks.code, scope.failedToLoadSomeGeometryPacks.msg);
                    scope.failedToLoadSomeGeometryPacks = null;
                }

                scope.onModelRootLoadDone(svf);

                if (onSuccess)
                    onSuccess(scope.model);

                scope.viewer3DImpl.api.fireEvent({ type: EventType.MODEL_ROOT_LOADED_EVENT, svf: svf, model: scope.model });

                scope.svf.loadDone = false;

                var isGltf = false;
                if (scope.svf.metadata && scope.svf.metadata.gltf) {
                    isGltf = true;
                }

                if (!isGltf) {
                    var numGeomPacks = svf.geompacks.length;

                    if (numGeomPacks == 0) {
                        scope.onGeomLoadDone();
                    }
                    else {
                        // Dynamically determine whether need to enable on demand loading, according to the size of model roughly.
                        if (svf.fragments.length > Privite_Global.FRAGS_PERSISTENT_MAX_COUNT) {
                            scope.onDemandLoading = Privite_Global.onDemandLoading;
                            scope.cullGeometryOnLoading = Privite_Global.cullGeometryOnLoading;
                        }
                        else {
                            scope.onDemandLoading = false;
                            scope.cullGeometryOnLoading = false;
                        }

                        Logger.log("SVF on demand loading: " + scope.onDemandLoading);
                        Logger.log("SVF culling geometry on loading: " + scope.cullGeometryOnLoading);

                        if (scope.onDemandLoading) {
                            // On demand loading is enabled, then
                            // Defer to launch jobs for loading some geometry packs,
                            // until the viewer really need them.
                            scope.loadedPacksCount = 0;
                        }
                        else {
                            // On demand loading is disabled, then
                            // Require loading immediately
                            if (numGeomPacks) {
                                var count = Math.min(numGeomPacks, NUM_WORKER_THREADS);
                                for (var i = 0; i < count; i++) {
                                    var pf = svf.geompacks[scope.next_pack++];
                                    pf.loading = true;
                                    if (DeviceType.isNodeJS) {
                                        scope.loadGeometryPack(pf.id, pf.uri);
                                    } else {
                                        (function (pf) {
                                            setTimeout(function () { scope.loadGeometryPack(pf.id, pf.uri); }, i * 200);
                                        })(pf);
                                    }
                                }
                            }
                        }
                    }
                }

                if (ew.data.progress == 1) {
                    scope.loading = false;
                    cleaner();
                }

                if (!svf.fragments.polygonCounts)
                    svf.fragments.polygonCounts = new Int32Array(svf.fragments.length);
                else {
                }

            } else if (ew.data && ew.data.bvh) {
                //Spatial index was done by the worker:
                if (!scope.svf.bvh) {
                    scope.svf.bvh = ew.data.bvh;
                    scope.model.setBVH(new NodeArray(scope.svf.bvh.nodes, scope.svf.bvh.useLeanNodes), scope.svf.bvh.primitives, scope.options.bvhOptions);
                    scope.viewer3DImpl.invalidate(false, true);
                }
                scope.loading = false;
                cleaner();
            } else if (ew.data && ew.data.mesh) {
                //GLTF loader sends meshes from the main loader thread
                scope.processReceivedMesh(ew.data);

                if (ew.data.progress === 1) {
                    scope.onGeomLoadDone();
                    scope.loading = false;
                    cleaner();
                }
            } else if (ew.data && ew.data.progress) {
                if (ew.data.progress == 1) {
                    scope.loading = false;
                    cleaner();
                }
            } else if (ew.data && ew.data.error) {
                scope.loading = false;
                cleaner();
                if (onError)
                    onError(ew.data.error.code, ew.data.error.msg, ew.data.error.args.httpStatus, ew.data.error.args.httpStatusText);
            } else if (ew.data && ew.data.debug) {
                Logger.debug(ew.data.message);
            } else {
                Logger.error("SVF download failed.");
                //Download failed.
                scope.loading = false;
                cleaner();
            }
        };

        w.addEventListenerWithIntercept(onSVFLoad);

        msg.operation = WORKER_LOAD_SVF;
        msg.interceptManifest = !!this.interceptManifest;
        w.doOperation(initLoadContext(msg));

        return true;
    };


    SvfLoader.prototype.loadGeometryPackOnDemand = function (packId) {

        var scope = this;
        if (!scope.onDemandLoading) {
            // Return immediately if do not allow on demand loading.
            return;
        }

        // Do nothing if the geometry pack file is already in loading.
        var pf = scope.svf.geompacks[packId];
        if (pf.loading) {
            return;
        }

        var i;
        var onMeshLoad = function (ew) {
            if (ew.data && ew.data.meshes) {

                var meshes = ew.data.meshes;

                var mdata = {
                    packId: ew.data.packId,
                    meshIndex: 0,
                    mesh: null
                };

                for (var i = 0; i < meshes.length; i++) {
                    var mesh = meshes[i];

                    if (!mesh)
                        continue;

                    mdata.meshIndex = i;
                    mdata.mesh = mesh;

                    scope.processReceivedMesh(mdata);
                }

                if (ew.data.progress >= 1.0) {
                    scope.pack_workers[ew.data.workerId].queued -= 1;
                    scope.svf.geompacks[ew.data.packId].loading = false;

                    // Removing the loaded pack from missing last frame, if exist.
                    var missingPacks = scope.model.geomPacksMissingLastFrame();
                    var idx = missingPacks.indexOf(ew.data.packId);
                    if (idx >= 0) {
                        missingPacks.splice(idx, 1);
                    }

                    // Are all workers done?
                    var isdone = true;
                    for (var j = 0; j < scope.pack_workers.length; j++) {
                        if (scope.pack_workers[j].queued != 0) {
                            isdone = false;
                            break;
                        }
                    }

                    if (scope.loadedPacks.indexOf(ew.data.packId) == -1) {
                        // Recored which pack has been loaded.
                        scope.loadedPacks.push(ew.data.packId);
                    }

                    if (isdone && scope.model.geomPacksMissingLastFrame().length == 0) {
                        if (scope.loadedPacks.length == scope.svf.geompacks.length) {
                            // This is for whole geometry get loaded.
                            // Notice, if geometry page out is enabled, loaded geometry may be
                            // get deleted later. So, this event just notify that all geometry
                            // pack file get downloaded at least once.
                            scope.onGeomLoadDone();
                        }
                        else {
                            // Notify event for a bunch of geometry pack file loaded done.
                            // ??? May need add handlers to react on this event. Such as,
                            // ??? Currently view cube won't start because it is set up
                            // ??? at geom load done.
                            scope.onGeomPackFilesLoadDone();
                        }
                    }

                }
            } else if (ew.data && ew.data.progress) {
                scope.pack_workers[ew.data.workerId].queued -= 1;
                scope.loadedPacksCount++;

                // This load is done, then can start next one.
                var pf = null, packId;
                var missingPacks = scope.model.geomPacksMissingLastFrame();
                for (i = 0; i < missingPacks.length; ++i) {
                    packId = missingPacks[i];
                    pf = scope.svf.geompacks[packId];
                    if (!pf.loading) {
                        break;
                    }
                }

                // Find one that hasn't been loaded.
                if (pf && !pf.loading) {
                    scope.loadGeometryPackOnDemand(packId);
                }

                scope.viewer3DImpl.signalProgress(100 * scope.loadedPacks.length / scope.svf.geompacks.length);

            } else if (ew.data && ew.data.debug) {
                Logger.debug(ew.data.message);
            } else if (ew.data && ew.data.error) {
                scope.failedToLoadSomeGeometryPacks = { code: ew.data.error.code, msg: ew.data.error.msg };
            } else {
                //Download failed.
                scope.pack_workers[ew.data.workerId].queued -= 2;
                scope.svf.geompacks[ew.data.packId].loading = false;
            }
        };

        // Initialize pack workers if it is not ready yet.
        if (!this.pack_workers) {
            this.pack_workers = [];

            for (i = 0; i < NUM_WORKER_THREADS; i++) {
                var wr = createWorkerWithIntercept();
                wr.addEventListenerWithIntercept(onMeshLoad);

                wr.queued = 0;
                this.pack_workers.push(wr);
            }
        }

        //Find the least busy worker
        var which = 0;
        var queued = this.pack_workers[0].queued;
        for (i = 1; i < NUM_WORKER_THREADS; i++) {
            if (this.pack_workers[i].queued < queued) {
                which = i;
                queued = this.pack_workers[i].queued;
            }
        }

        // If worker is busy, queue this reqest for next try.
        if (queued > 2) {
            // All workers are busy, then queue it for next try.
            scope.model.addGeomPackMissingLastFrame(packId);
            return;
        }

        var w, workerId;
        var path = pf.uri;
        w = this.pack_workers[which];
        w.queued += 2;
        workerId = which;

        pf.loading = true;
        scope.svf.partPacksLoadDone = false; // Still loading geometry pack files.

        //Pass unzip job to the worker
        var reqPath = pathToURL(this.svf.basePath + path);
        var xfer = {
            "operation": WORKER_LOAD_GEOMETRY,
            "url": reqPath,
            "packId": parseInt(packId), /* mesh IDs treat the pack file id as integer to save on storage in the per-fragment arrays */
            "workerId": workerId,
            queryParams: this.queryParam
        };

        w.doOperation(initLoadContext(xfer)); // Send data to our worker.
    };


    SvfLoader.prototype.loadGeometryPack = function (packId, path) {
        var w;
        var workerId;
        var i, j;
        var scope = this;

        var onMeshLoad = function (ew) {
            if (ew.data && ew.data.meshes) {

                var meshes = ew.data.meshes;

                var mdata = {
                    packId: ew.data.packId,
                    meshIndex: 0,
                    mesh: null
                };

                for (var i = 0; i < meshes.length; i++) {
                    var mesh = meshes[i];

                    if (!mesh)
                        continue;

                    mdata.meshIndex = i;
                    mdata.mesh = mesh;

                    scope.processReceivedMesh(mdata);
                }

                //Is the worker done loading the geom pack?
                if (ew.data.progress >= 1.0) {
                    scope.pack_workers[ew.data.workerId].queued -= 1;

                    scope.loadedPacksCount++;
                    scope.viewer3DImpl.signalProgress(100 * scope.loadedPacksCount / scope.svf.geompacks.length);

                    //Are all workers done?
                    var isdone = true;
                    for (j = 0; j < scope.pack_workers.length; j++) {
                        if (scope.pack_workers[j].queued != 0) {
                            isdone = false;
                            break;
                        }
                    }

                    if (isdone) {
                        for (j = 0; j < scope.pack_workers.length; j++) {
                            scope.pack_workers[j].clearAllEventListenerWithIntercept();
                            scope.pack_workers[j].terminate();
                        }
                        scope.pack_workers = null;
                    }

                    if (scope.svf.fragments.numLoaded == scope.svf.fragments.length) { //all workers are done?
                        scope.onGeomLoadDone();
                    }
                }
            } else if (ew.data && ew.data.progress) {
                //download is done, queue the next download
                scope.pack_workers[ew.data.workerId].queued -= 1;

                if (scope.next_pack < scope.svf.geompacks.length) {

                    var pf = null;
                    var missingPacks = scope.model.geomPacksMissingLastFrame();
                    for (i = 0; i < missingPacks.length; ++i) {
                        pf = scope.svf.geompacks[missingPacks[i]];
                        if (pf && !pf.loading) {
                            break;
                        }
                    }

                    if (!pf || pf.loading) {
                        while (scope.next_pack < scope.svf.geompacks.length) {
                            pf = scope.svf.geompacks[scope.next_pack++];
                            if (!pf.loading) {
                                break;
                            }
                        }
                    }

                    if (pf && !pf.loading) {
                        pf.loading = true;
                        scope.loadGeometryPack(pf.id, pf.uri);
                    }
                    else {
                        scope.viewer3DImpl.modelQueue().enforceBvh = false;
                        scope.svf.fragments.packIds = null; // not needed anymore
                    }
                }
            } else if (ew.data && ew.data.debug) {
                Logger.debug(ew.data.message);
            } else if (ew.data && ew.data.error) {
                scope.failedToLoadSomeGeometryPacks = { code: ew.data.error.code, msg: ew.data.error.msg };
            } else {
                //Download failed.
                scope.pack_workers[ew.data.workerId].queued -= 2;
            }
        };

        var pw = this.pack_workers;
        if (!pw) {
            pw = this.pack_workers = [];
        }

        //If all workers are busy and we are allowed to create more, then create a new one
        if (pw.length < NUM_WORKER_THREADS) {
            var allBusy = true;
            for (var i = 0; i < pw.length; i++) {
                if (pw.queued === 0) {
                    allBusy = false;
                    break;
                }
            }

            if (allBusy) {
                var wr = createWorkerWithIntercept();
                wr.addEventListenerWithIntercept(onMeshLoad);

                wr.queued = 0;
                pw.push(wr);
            }
        }

        //Find the least busy worker
        var which = 0;
        var queued = pw[0].queued;
        for (i = 1; i < pw.length; i++) {
            if (pw[i].queued < queued) {
                which = i;
                queued = pw[i].queued;
            }
        }
        w = pw[which];
        w.queued += 2;
        workerId = which;


        //Pass unzip job to the worker
        var reqPath = pathToURL(this.svf.basePath + path);
        var xfer = {
            "operation": WORKER_LOAD_GEOMETRY,
            "url": reqPath,
            "packId": parseInt(packId), /* mesh IDs treat the pack file id as integer to save on storage in the per-fragment arrays */
            "workerId": workerId,
            queryParams: this.queryParam
        };

        w.doOperation(initLoadContext(xfer)); // Send data to our worker.
    };


    SvfLoader.prototype.processReceivedMesh = function (mdata) {

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

        // Let's do a culling when process the received meshes,
        // which cull those won't be rendered in current frame.
        if (this.cullGeometryOnLoading) {
            var culled = true;
            for (var i = 0; i < fragIndexes.length; ++i) {
                // Do not cull the first FRAGS_PERSISTENT_COUNT fragments.
                if (fragIndexes[i] < Privite_Global.FRAGS_PERSISTENT_COUNT) {
                    culled = false;
                    break;
                }

                culled = culled && this.viewer3DImpl.modelQueue().checkCull(fragIndexes[i], true, true);
                if (!culled)
                    break;
            }
            if (culled) {
                // Discard this mesh directly.
                mdata.mesh = null;
                return;
            }
        }

        //Convert the received mesh to THREE buffer geometry
        BufferGeometryUtils.meshToGeometry(mdata);

        var numInstances = fragIndexes.length;

        var rm = this.model;

        //Reuse previous index of this geometry, if available
        var idx = rm.getFragmentList().getGeometryId(fragIndexes[0]);
        var geomId = rm.getGeometryList().addGeometry(mdata.geometry, numInstances, idx);

        // This is to record how many instances this geometry has,
        // and the number of instances have been rendered in one frame.
        if (this.cullGeometryOnLoading && numInstances > 1 &&
            rm.getFragmentList().geomidsmap[geomId] == null) {
            rm.getFragmentList().geomidsmap[geomId] = { n: numInstances, t: 0 };
        }

        var ib = mdata.geometry.attributes['index'].array || mdata.geometry.ib;
        var polyCount = ib.length / 3;

        //For each fragment, add a mesh instance to the renderer
        for (var i = 0; i < fragIndexes.length; i++) {
            var fragId = 0 | fragIndexes[i];

            //We get the matrix from the fragments and we set it back there
            //with the activateFragment call, but this is to maintain the
            //ability to add a plain THREE.Mesh -- otherwise it could be simpler
            rm.getFragmentList().getOriginalWorldMatrix(fragId, this.tmpMatrix);

            var materialId = fragments.materials[fragId].toString();

            if (fragments.polygonCounts)
                fragments.polygonCounts[fragId] = polyCount;

            var m = this.viewer3DImpl.setupMesh(this.model, mdata.geometry, materialId, this.tmpMatrix);

            //If there is a placement transform, we tell activateFragment to also recompute the
            //world space bounding box of the fragment from the raw geometry model box, for a tighter
            //fit compared to what we get when loading the fragment list initially.
            rm.activateFragment(fragId, m, !!svf.placementTransform);
        }

        if (!this.onDemandLoading) {
            //don't need this mapping anymore.
            fragments.mesh2frag[meshid] = null;
        }

        //Repaint and progress reporting
        fragments.numLoaded += fragIndexes.length;

        //repaint every once in a while -- more initially, less as the load drags on.
        if (svf.geomPolyCount > svf.nextRepaintPolys) {
            //Logger.log("num loaded " + numLoaded);
            this.firstPixelTimestamp = this.firstPixelTimestamp || Date.now();
            svf.numRepaints++;
            svf.nextRepaintPolys += 10000 * Math.pow(1.5, svf.numRepaints);
            this.viewer3DImpl.invalidate(false, true);
        }
    };


    SvfLoader.prototype.onModelRootLoadDone = function (svf) {

        svf.geomPolyCount = 0;
        svf.instancePolyCount = 0;
        svf.geomMemory = 0;
        svf.fragments.numLoaded = 0;
        svf.meshCount = 0;
        svf.gpuNumMeshes = 0;
        svf.gpuMeshMemory = 0;

        svf.nextRepaintPolys = 0;
        svf.numRepaints = 0;

        svf.urn = this.svfUrn;
        svf.acmSessionId = this.acmSessionId;

        svf.basePath = this.basePath;

        svf.loadOptions = this.options;

        var t1 = Date.now();
        this.loadTime += t1 - this.t0;
        Logger.log("SVF load: " + (t1 - this.t0));

        //Create the API Model object and its render proxy
        var model = this.model = new RenderModel(svf);
        model.initialize(this);
        model.loader = this;

        //For 3D models, we can start loading the property database as soon
        //as we know the fragment list which contains the fragId->dbId map.
        //We would not load property db when we are on mobile device AND on demand loading is on (which
        //implies the model is not 'normal' in terms of its size.). This is only a temp solution that
        //allow big models loads on mobile without crash. Without property db loading selection could break.
        var shouldLoadPropertyDb = !(this.onDemandLoading && (DeviceType.isMobileDevice));
        if (shouldLoadPropertyDb) {
            this.loadPropertyDb();
        }

        var numMaterials = this.viewer3DImpl.matman().convertMaterials(svf);

        this.t0 = t1;

        //The BBox object loses knowledge of its
        //type when going across the worker thread boundary...
        svf.bbox = new THREE.Box3().copy(svf.bbox);

        if (svf.refPointTransform) {
            svf.refPointTransform = new LmvMatrix4(true).copy(svf.refPointTransform);
        }
        if (svf.placementTransform) {
            svf.placementTransform = new LmvMatrix4(true).copy(svf.placementTransform);
        }

        //Camera vectors also lose their prototypes when they
        //cross the thread boundary...
        if (svf.cameras) {
            for (var i = 0; i < svf.cameras.length; i++) {
                var camera = svf.cameras[i];
                camera.position = new THREE.Vector3().copy(camera.position);
                camera.target = new THREE.Vector3().copy(camera.target);
                camera.up = new THREE.Vector3().copy(camera.up);
            }
        }

        //If the textures are likely to come from the Protein CDN
        //load them in parallel with the geometry packs
        if (svf.proteinMaterials && PROTEIN_ROOT && PRISM_ROOT) {
            this.viewer3DImpl.matman().loadTextures(svf);
        }

        Logger.log("scene bounds: " + JSON.stringify(svf.bbox));

        var metadataStats = {
            category: "metadata_load_stats",
            urn: svf.urn,
            has_topology: !!svf.topology,
            has_animations: !!svf.animations,
            cameras: svf.cameras ? svf.cameras.length : 0,
            lights: svf.lights ? svf.lights.length : 0,
            materials: numMaterials
        };
        Logger.track(metadataStats);

        this.viewer3DImpl.signalProgress(5);
        this.viewer3DImpl.invalidate(false, false);
    };

    SvfLoader.prototype.addTransparencyFlagsToMaterials = function (mats) {
        for (var id in mats) {
            var mat = mats[id];
            var userAssets = mat["userassets"];
            //TODO: for GLTF materials, userAssets does not exist
            if (userAssets) {
                var innerMats = mat["materials"];
                var innerMat = innerMats[userAssets[0]];
                mat.transparent = innerMat["transparent"];
            }
        }
    };

    SvfLoader.prototype.makeBVH = function (svf) {
        var t0 = performance.now();
        var mats = svf.materials ? svf.materials["materials"] : null;
        if (mats)
            this.addTransparencyFlagsToMaterials(mats);
        svf.bvh = new BVHBuilder(svf.fragments, mats);
        svf.bvh.build(this.options.bvhOptions || { isWeakDevice: DeviceType.isMobileDevice });
        var t1 = performance.now();
        Logger.log("BVH build time: " + (t1 - t0));
    };

    SvfLoader.prototype.onGeomPackFilesLoadDone = function () {
        // This is to signal client that part of pack files are load done.
        Logger.log("Part of geom pack files are load done.");

        // ??? There may be other things need to be handled here per geom pack files loading done?
        // ???

        this.svf.partPacksLoadDone = true;
        this.viewer3DImpl.invalidate(false, true);
    };

    SvfLoader.prototype.onGeomLoadDone = function () {
        this.svf.loadDone = true;

        //launch the texture loads in case that was not done already
        if (!this.svf.proteinMaterials || !PROTEIN_ROOT || !PRISM_ROOT) {
            this.viewer3DImpl.matman().loadTextures(this.svf);
        }

        // We need to keep a copy of the original fragments
        // transforms in order to restore them after explosions, etc.
        // the rotation/scale 3x3 part.
        // TODO: consider only keeping the position vector and throwing out
        //
        //delete this.svf.fragments.transforms;

        // Don't need these anymore (except perhaps for out of core stuff?)
        if (!this.onDemandLoading) {
            // On demand loading still need this.
            this.svf.fragments.entityIndexes = null;
            this.svf.fragments.mesh2frag = null;
        }


        var t1 = Date.now();
        var msg = "Fragments load time: " + (t1 - this.t0);
        this.loadTime += t1 - this.t0;

        var firstPixelTime = this.firstPixelTimestamp - this.t0;
        msg += ' (first pixel time: ' + firstPixelTime + ')';

        //If there is a post-transform, the BVH has to be computed after
        //all the world transforms/boxes are updated
        if (!this.svf.bvh || this.svf.placementTransform) {
            this.makeBVH(this.svf);
            this.model.setBVH(this.svf.bvh.nodes, this.svf.bvh.primitives, this.options.bvhOptions);
        }
        Logger.log(msg);

        var modelStats = {
            category: "model_load_stats",
            is_f2d: false,
            has_prism: this.viewer3DImpl.matman().hasPrism,
            load_time: this.loadTime,
            geometry_size: this.model.getGeometryList().geomMemory,
            meshes_count: this.model.getGeometryList().geoms.length,
            fragments_count: this.model.getFragmentList().getCount(),
            urn: this.svfUrn
        };
        if (firstPixelTime > 0) {
            modelStats['first_pixel_time'] = firstPixelTime; // time [ms] from SVF load to first geometry rendered
        }
        Logger.track(modelStats, true);

        function sendMessage(data) {
            var aMessage = { 'command': 'assets', data: data };
            if (DeviceType.isBrowser)
                window.webkit.messageHandlers.callbackHandler.postMessage(aMessage);
        }

        if (Privite_Global.assets) {
            // Callback to ios.
            if (DeviceType.isBrowser && window.webkit) {
                sendMessage(Privite_Global.assets);
                Privite_Global.assets = null;
            }
        }

        this.currentLoadPath = null;

        this.viewer3DImpl.onLoadComplete(this.model);
    };

    SvfLoader.prototype.loadPropertyDb = function () {
        this.svf.propWorker = new PropDbLoader(this.sharedDbPath, this.model, this.viewer3DImpl.api);
        this.svf.propWorker.load();
    };


    FileLoaderManager.registerFileLoader("svf", ["svf", "gltf", "glb"], SvfLoader);

    return SvfLoader;
});