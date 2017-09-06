define([
    '../EventType',
    '../DeviceType',
    './InstanceTreeAccess',
    './InstanceTree',
    './Fn/pathToURL',
    './Fn/initLoadContext',
    '../../Worker/createWorkerWithIntercept'
], function(EventType, DeviceType, InstanceTreeAccess, InstanceTree, pathToURL, initLoadContext, createWorkerWithIntercept) {
    'use strict';
    var WORKER_GET_PROPERTIES = "GET_PROPERTIES";
    var WORKER_SEARCH_PROPERTIES = "SEARCH_PROPERTIES";
    var WORKER_BUILD_EXTERNAL_ID_MAPPING = "BUILD_EXTERNAL_ID_MAPPING";
    var WORKER_GET_OBJECT_TREE = "GET_OBJECT_TREE";
    var WORKER_ATTRIBUTES_MAP = "ATTRIBUTES_MAP";

    //TODO: pass in the model instead of the model.svf
    var PropDbLoader = function (sharedDbPath, model, eventTarget) {

        this.sharedDbPath = sharedDbPath;

        this.propWorker = null;
        this.eventTarget = eventTarget;
        this.model = model;
        this.svf = model.getData();


        //Sigh -- see SvfLoader for similar stuff
        var domainParam = (auth && !DeviceType.isNodeJS) ? ("domain=" + encodeURIComponent(window.location.origin)) : "";

        this.queryParam = domainParam;
        if (this.svf.acmSessionId) {
            if (this.queryParam)
                this.queryParam += "&";
            this.queryParam += "acmsession=" + this.svf.acmSessionId;
        }

    };

    PropDbLoader.prototype.dtor = function () {
        if (this.propWorker && !this.sharedDbPath) {
            this.propWorker.clearAllEventListenerWithIntercept();
            this.propWorker.terminate();
            this.propWorker = null;
        }
    };



    //Cache of property workers per property database path.
    //Many bubbles (Revit, AutoCAD) share the same property database
    //across all viewables, so we can reuse the same worker for all
    //sheets. This is particularly important for gigantic Revit property databases.
    var propWorkerCache = {};

    var PROPDB_CB_COUNTER = 1;
    var PROPDB_CALLBACKS = {};

    function propertyWorkerCallback(e) {

        var data = e.data;

        if (data && data.debug) {
            Logger.debug(data.message);
            return;
        }

        if (data.cbId) {
            var cbs = PROPDB_CALLBACKS[data.cbId];

            if (data && data.error) {
                if (cbs[1])
                    cbs[1](data.error);
            } else {
                if (cbs[0])
                    cbs[0](data.result);
            }

            delete PROPDB_CALLBACKS[data.cbId];
        }

    }

    function registerWorkerCallback(onSuccess, onError) {
        var cbId = PROPDB_CB_COUNTER++;

        PROPDB_CALLBACKS[cbId] = [onSuccess, onError];

        return cbId;
    }

    PropDbLoader.prototype.processLoadResult = function (result) {
        var scope = this;

        if (result.instanceTreeStorage) {

            var nodeAccess = new InstanceTreeAccess(result.instanceTreeStorage, result.rootId, result.instanceBoxes);

            scope.svf.instanceTree = new InstanceTree(nodeAccess, result.objectCount, result.maxTreeDepth);

            scope.svf.fragToNodeDone = true;
        }
        else if (result.objectCount) {
            //Case where there is no object tree, but objects
            //do still have properties. This is the case for F2D drawings.
            scope.svf.hasObjectProperties = result.objectCount;
        }

        scope.eventTarget.fireEvent({
            type: EventType.OBJECT_TREE_CREATED_EVENT,
            svf: scope.svf,
            model: scope.model
        });

    };

    PropDbLoader.prototype.processLoadError = function (error) {

        var scope = this;

        scope.propertyDbError = error;
        scope.eventTarget.fireEvent({
            type: EventType.OBJECT_TREE_UNAVAILABLE_EVENT,
            svf: scope.svf,
            model: scope.model
        });
    };


    PropDbLoader.prototype.load = function () {
        var scope = this;

        var onObjectTreeRead = function (result) {

            scope.processLoadResult(result);

            //If any other instance of PropDbLoader tried to load
            //the same property database while we were also loading it,
            //notify it with the result also.
            var cacheable = !!scope.sharedDbPath;
            var cached = cacheable && propWorkerCache[scope.sharedDbPath];
            if (cached && cached.waitingLoaders) {
                for (var i = 0; i < cached.waitingLoaders.length; i++) {
                    cached.waitingLoaders[i].processLoadResult(result);
                }
                cached.waitingLoaders = null;
                cached.workerResult = result;
            }
        };

        var onObjectTreeError = function (error) {
            scope.processLoadError(error);

            //If any other instance of PropDbLoader tried to load
            //the same property database while we were also loading it,
            //notify it with the result also.
            var cacheable = !!scope.sharedDbPath;
            var cached = cacheable && propWorkerCache[scope.sharedDbPath];
            if (cached && cached.waitingLoaders) {
                for (var i = 0; i < cached.waitingLoaders.length; i++) {
                    cached.waitingLoaders[i].processLoadError(error);
                }
                cached.waitingLoaders = null;
                cached.workerError = error;
            }

        };

        //See if we already loaded this property database once
        var cacheable = !!this.sharedDbPath;
        var cached = cacheable && propWorkerCache[this.sharedDbPath];

        if (cached) {
            Logger.log("Using cached property worker for ", this.sharedDbPath);
            this.propWorker = cached;
        } else {

            this.propWorker = createWorkerWithIntercept();
            this.propWorker.addEventListenerWithIntercept(propertyWorkerCallback);

            if (cacheable) {
                propWorkerCache[this.sharedDbPath] = this.propWorker;
            }
        }

        //In the case of glTF, the instance tree is immediately available
        if (this.svf.instanceTree && this.svf.instanceBoxes) {
            //Need this call to be async, because some state required
            //by object tree load event handlers is not et initialized
            //when the PropDbLoader.load() is called (in particular, viewer.model is not assigned at that point)
            var svf = this.svf;
            setTimeout(function () { onObjectTreeRead(svf); }, 0);
            return;
        }

        var cbId = registerWorkerCallback(onObjectTreeRead, onObjectTreeError);

        var reqPath = pathToURL(this.svf.basePath);

        //If there is a shared db path and there is no
        //per-SVF specific property database, use the shared one
        if (this.sharedDbPath && !this.svf.propertydb.values.length) {
            reqPath = this.sharedDbPath;
            Logger.log("Using shared property db: " + reqPath);
        }

        var xfer = {
            "operation": WORKER_GET_OBJECT_TREE,
            "url": reqPath,
            "propertydb": this.svf.propertydb,
            "fragToDbId": this.svf.fragments.fragId2dbId, //the 1:1 mapping of fragment to dbId we got from the SVF or the 1:many we built on the fly for f2d
            "fragBoxes": this.svf.fragments.boxes, //needed to precompute bounding box hierarchy for explode function (and possibly others)
            cbId: cbId,
            queryParams: this.queryParam
        };

        this.propWorker.doOperation(initLoadContext(xfer)); // Send data to our worker.

    };


    PropDbLoader.prototype.asyncPropertyOperation = function (opArgs, success, fail) {

        var scope = this;

        if (scope.svf.instanceTree || scope.svf.hasObjectProperties) {

            opArgs.cbId = registerWorkerCallback(success, fail);

            this.propWorker.doOperation(opArgs); // Send data to our worker.
        } else if (scope.propertyDbError) {
            if (fail)
                fail(scope.propertyDbError);
        } else {
            var onEvent = function (e) {
                scope.eventTarget.removeEventListener(EventType.OBJECT_TREE_CREATED_EVENT, onEvent);
                scope.eventTarget.removeEventListener(EventType.OBJECT_TREE_UNAVAILABLE_EVENT, onEvent);
                if (e.svf.instanceTree || e.svf.hasObjectProperties || scope.propertyDbError)
                    scope.asyncPropertyOperation(opArgs, success, fail);
                else if (fail)
                    fail({ code: EventType.UNKNOWN_FAILURE, msg: "Failed to load properties" }); //avoid infinite recursion.
            };
            scope.eventTarget.addEventListener(EventType.OBJECT_TREE_CREATED_EVENT, onEvent);
            scope.eventTarget.addEventListener(EventType.OBJECT_TREE_UNAVAILABLE_EVENT, onEvent);
        }
    };


    PropDbLoader.prototype.getProperties = function (dbId, onSuccess, onError) {

        this.asyncPropertyOperation(
            {
                "operation": WORKER_GET_PROPERTIES,
                "dbId": dbId
            },
            onSuccess, onError
        );
    };

    /**
     * Bulk property retrieval with property name filter.
     * dbIds -- array of object dbIds to return properties for.
     * propFilter -- array of property names to retrieve values for. If empty, all properties are returned.
     */
    PropDbLoader.prototype.getBulkProperties = function (dbIds, propFilter, onSuccess, onError) {

        this.asyncPropertyOperation(
            {
                "operation": WORKER_GET_PROPERTIES,
                "dbIds": dbIds,
                "propFilter": propFilter
            },
            onSuccess, onError
        );
    };


    PropDbLoader.prototype.searchProperties = function (searchText, attributeNames, onSuccess, onError) {

        this.asyncPropertyOperation(
            {
                "operation": WORKER_SEARCH_PROPERTIES,
                "searchText": searchText,
                "attributeNames": attributeNames
            },
            onSuccess, onError
        );
    };


    PropDbLoader.prototype.getExternalIdMapping = function (onSuccess, onError) {

        this.asyncPropertyOperation(
            {
                "operation": WORKER_BUILD_EXTERNAL_ID_MAPPING
            },
            onSuccess, onError
        );
    };


    PropDbLoader.prototype.getObjectTree = function (onSuccess, onError) {
        var scope = this;

        if (scope.svf.instanceTree) {
            onSuccess(scope.svf.instanceTree);
        } else if (scope.propertyDbError || 'hasObjectProperties' in scope.svf) {
            if (onError)
                onError(scope.propertyDbError);
        } else {
            // Property Db has been requested; waiting for worker to complete //
            var listener = function () {
                scope.eventTarget.removeEventListener(EventType.OBJECT_TREE_CREATED_EVENT, listener);
                scope.eventTarget.removeEventListener(EventType.OBJECT_TREE_UNAVAILABLE_EVENT, listener);
                scope.getObjectTree(onSuccess, onError);
            };
            scope.eventTarget.addEventListener(EventType.OBJECT_TREE_CREATED_EVENT, listener);
            scope.eventTarget.addEventListener(EventType.OBJECT_TREE_UNAVAILABLE_EVENT, listener);
        }
    };

    PropDbLoader.prototype.attributeToIdMap = function (onSuccess, onError) {

        this.asyncPropertyOperation(
            {
                "operation": WORKER_ATTRIBUTES_MAP
            },
            onSuccess, onError
        );
    };

    return PropDbLoader;
});