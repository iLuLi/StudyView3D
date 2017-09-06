define([
    '../Model',
    './Global',
    './FragmentList',
    './GeometryList',
    './ModelIteratorLinear',
    './ModelIteratorBVH',
    './VBIntersector'
], function(
    Model, 
    Privite_Global, 
    FragmentList, 
    GeometryList,
    ModelIteratorLinear,
    ModelIteratorBVH,
    VBIntersector
) {
    'use strict';
    // Counter to assign individual numbers to RenderModel in order of their creation
    var nextModelId = 1;
    
        /** @class Extends application Model class by functionality for WebGL rendering.
         *         Currently produced by loaders (F2DLoader, SvfLoader)
         *
         *  @constructor
         *  @param {Object} svf - package containing model data. Stored by the base class
         *                        and exposed via getData(). Properties vary with source type:
         *                         - For Svf: See function Package (Package.js)
         *                         - For F2D: See F2DLoader.prototype.onF2dLoadDone (F2Loader.js)
         *                        Used/Required properties:
         *                          {Object}       svf.fragments     - see function FragList (Fragments.js)
         *                          [InstanceTree] svf.instanceTree_ - used for rayintersection. If not specified, we assume dbIds=fragId.
         */
        function RenderModel(svf) {
    
            Model.call(this, svf);
    
            var _this = this;
    
            // Cached bboxes.
            var _visibleBounds = new THREE.Box3();    // excluding ghosted once
            var _visibleBoundsWithHidden = new THREE.Box3();    // full bbox
            var _tmpBox = new THREE.Box3();    // temp for internal use
    
            this.visibleBoundsDirty = false; // triggers recomputation of _visibleBounds and _visibleBoundsWithHidden, e.g., if fragment visibility changes.
            this.enforceBvh = false; // currently ignored, see this.resetIterator()
    
            var _numHighlighted = 0; // number of currently highlighted fragments.    
    
            this.id = nextModelId++; // use next free Model id
    
            var _geoms = null; // {GeometryList} 
            var _frags = null; // {FragmentList}
    
            // Iterators used for scene traversal. 
            var _linearIterator = null;  // {ModelIteratorLinear}, used by default and created in this.initialize()
            var _bvhIterator = null;  // {ModelIteratorBVH},    used if setBVH() has been called and no new fragments have been added since then.
            var _iterator = null;  // currently used iterator. points to one of the iterators above
    
            // Maintained per scene traversal, initialized in ResetIterator()
            var _renderCounter = 0;                 // number of batches rendered since last resetIterator() call. Used to indicate rendering progress for progressive rendering.
            var _frustum = null;              // {FrustumIntersector}. Assigned in this.ResetIterator(). Passed to RenderBatches for culling and depth-sorting. 
            var _drawMode = Privite_Global.RENDER_NORMAL; // drawMode used in this traversal. See Viewer3DImpl.js
            var _bvhOn = false;             // true when using _bvhiterator in the current traversal. [HB:] Shouldn't this better be local variable in ResetIterator()?
    
    
            // Paging variables maintained per scene traversal:
            var _pageOutGeomCount = 0;                // number of geometries paged out within the current traversal
            var _pageOutStatus = Privite_Global.PAGEOUT_NONE; // always PAGEOUT_NONE when starting to draw. During traveral, it may change to
            //  - PAGEOUT_SUCCESS: if any geometry has been paged out
            //  - PAGEOUT_FAIL:    geometry has been paged out, but not enough yet.
            var _packIds = [];               // Collects packIds of all fragments for which geometry was missing in the last traveral.
    
    
            // Note: GeometryList or FragmentList are maintained by the RenderModel and should not be modified from outside.
            //       E.g., setting visibility or highlighting flags on FragmentList directly would break some state tracking. (e.g. see this.setVibility or this.setHighlighted)
            //       The only current exception is done by loaders that add geometry to _geoms directly.
            this.getGeometryList = function () { return _geoms; };
            this.getFragmentList = function () { return _frags; };
            this.getModelId = function () { return this.id; };
    
            /**
            *  @param {SvfLoader} loader - SVF loader used for on-demand loading.
            */
            this.initialize = function (loader) {
    
                // alloc GeometryList. Initially empty, but exposed via GetGeometryList().
                // The loaders use this to add LmvGeometryBuffers directly to the GeometryList later.
                _geoms = new GeometryList(this);
    
                //TODO: having the loader and passing it down sucks, find a way not to
                _frags = new FragmentList(this, loader);
    
                var initialBbox = this.getBoundingBox();
                if (initialBbox) {
                    _visibleBounds.copy(initialBbox);
                    _visibleBoundsWithHidden.copy(initialBbox);
                }
    
                _iterator = _linearIterator = new ModelIteratorLinear(this);
            };
    
            /**
             * Initialize from custom iterator. In this case, _geoms and _frags are not used and the 
             * iterator implementation is responsible for producing and maintaining the geometry.
             *
             *  @param {ModelIterator} iterator - iterator.nextBatch may return RenderBatch or THREE.Scene instances.
             *
             * Note: When using a custom iterator, per-fragment visiblity is not supported.
             */
            this.initFromCustomIterator = function (iterator) {
                _iterator = iterator;
                this.visibleBoundsDirty = true; // make sure that bbox is obtained from iterator
            };
    
            /** 
             *  Deletes all GPU resources.
             *
             *  @param {FireflyWebGLRenderer} glRenderer
             */
            this.dtor = function (glrenderer) {
                this.getFragmentList().dispose(glrenderer);
            };
    
    
            /** 
             * Activating a fragment means:
             *  - Store geometry in the FragmentList
             *  - Update summed RenderModel boxes
             *  - Add fragment to iterator, so that it is considered in next traversal
             * See FragmentList.setMesh(..) for param details.
             *
             * Note:
             *  - Can only be used with LinearIterator
             */
            this.activateFragment = function (fragId, meshInfo, overrideTransform) {
    
                _frags.setMesh(fragId, meshInfo, overrideTransform);
    
                //The linear iterator can be updated to add meshes incrementally.
                //The BVH iterator is not mutable, yet.
                _iterator.addFragment(fragId);
    
                //update the world bbox
                {
                    _frags.getWorldBounds(fragId, _tmpBox);
                    _visibleBounds.union(_tmpBox);
                    _visibleBoundsWithHidden.union(_tmpBox);
                }
    
            };
    
            // Used by the Fusion collaboration client
            this.setFragment = function (fragId, mesh) {
    
                if (fragId === undefined)
                    fragId = this.getFragmentList().getNextAvailableFragmentId();
    
                _frags.setMesh(fragId, mesh, true);
    
                //The linear iterator can be updated to add meshes incrementally.
                //The BVH iterator is not mutable, yet.
                if (_linearIterator)
                    _linearIterator.addFragment(fragId);
                if (_bvhIterator && !_frags.fragmentsHaveBeenAdded())
                    _bvhIterator.addFragment(fragId);
    
                //update the world bbox
                {
                    _frags.getWorldBounds(fragId, _tmpBox);
                    _visibleBounds.union(_tmpBox);
                    _visibleBoundsWithHidden.union(_tmpBox);
                }
    
                return fragId;
            };
    
    
            /** Replaces the default LinearIterator by a BVH iterator. */
            this.setBVH = function (nodes, primitives, options) {
    
                // Note that ResetIterator() might still set _iterator back to 
                // the linear one if the BVH one cannot be used.
                _iterator = _bvhIterator = new ModelIteratorBVH();
    
                _iterator.initialize(this, nodes, primitives, options);
    
            };
    
            /** 
             *  Starts the scene draw traversal, so that nextBatch() will return the first batch to render.
             *   @param: {UnifiedCamera}      camera   - camera.position was needed for the heuristic to choose between linear iterator and BVH.
             *                                           [HB:] The code is currently outcommented, so the param is currently unused.
             *   @param: {FrustumIntersector} frustum  - used by RenderBatches for frustum culling and z-sorting.
             *   @param: {number}             drawMode - E.g., avp.RENDER_NORMAL. See Viewer3DImpl.js
             *   @param: {bool}               [moved]  - Must be set to true if scene or camera have changed. When using paging, this 
             *                                           will discard any outdated information about which meshes are currently culled etc.
             */
            this.resetIterator = function (camera, frustum, drawMode, moved) {
    
                _pageOutGeomCount = 0;
    
                // If scene/camera has changed, we have to rebuild some data that we collected for paging, because the set of currently 
                // needed fragments may change.
                // Note that frags will be null when using a custom iterator. In this case, this
                // paging-related code is not used and can be skipped.
                if (moved && _frags) {
    
                    // restart collecting packIds of all missing fragments
                    _packIds = [];
    
                    // restart tracking of paging status
                    _pageOutStatus = Privite_Global.PAGEOUT_NONE;
    
                    // reset lists of culled and traversed geometry
                    _frags.traversedGeom = [];
                    _frags.culledGeom = [];
    
                    // reset MESH_TRAVERSED flag 
                    // [HB:] Check if we can replace this by just _frags.setFlagGlobal(MESH_TRAVERSED, false).
                    var len = _frags.vizflags.length;
                    for (var i = 0; i < len; ++i) {
                        _frags.setFlagFragment(i, Privite_Global.MESH_TRAVERSED, false);
                    }
    
                    // reset geomidsmap, which we use to track the number of traversed instances for multi-instanced geometry. (see FragmentList.geomids for details)
                    for (var p in _frags.geomidsmap) {
                        if (_frags.geomidsmap.hasOwnProperty(p)) {
                            _frags.geomidsmap[p].t = 0;
                        }
                    }
                }
    
                //Decide whether to use the BVH for traversal
                //If we are far out from the scene, use pure big-to-small
                //importance order instead of front to back.
                _bvhOn = false;
                if (_bvhIterator && !_frags.fragmentsHaveBeenAdded()) {
                    //TODO: BVH always on when available, because the linear iteration
                    //does not respect transparent objects drawing last -- it just
                    //draws in the order the fragments come in the SVF package
                    /*
                        if(this.enforceBvh || !_linearIterator) {
                            _bvhOn = true;
                        } else {
                            var diag = _visibleBoundsWithHidden.size().length();
                            var center = _visibleBoundsWithHidden.center();
                            var dist = camera.position.distanceTo(center);
                            if (dist < diag * 0.5)
                                _bvhOn = true;
                        }
                        */
                    _bvhOn = true;
                }
    
                // Note _linearIterator may also be null if a custom iterator is used.
                // in this case, we must leave _iterator unchanged.
                if (_bvhOn) {
                    _iterator = _bvhIterator;
                } else if (_linearIterator) {
                    _iterator = _linearIterator;
                }
    
                _renderCounter = 0;
                _drawMode = drawMode;
                _frustum = frustum;
                _iterator.reset(frustum, camera);
                return _iterator;
            };
    
    
    
            // Used for accumulating geom pack IDs that were needed in this frame, but were not in memory.
            function fragIdCallback(fragId) {
                var packId = _this.getFragmentList().fragments.packIds[fragId];
                if (_packIds.indexOf(packId) == -1) {
                    _packIds.push(packId);
                }
            }
    
            /** Returns the next RenderBatch for scene rendering travseral. Used in RenderScene.renderSome().
             *   Use this.resetIterator() to start traversal first.
             *
             *   @returns {RenderBatch|null} Next batch to render or null if traversal is finished.
             */
            this.nextBatch = function () {
    
                // If the next batch of the iterator is fully invisble, we inc it until we 
                // find a relevant batch to render or reach the end.
                while (1) {
                    // get next batch from iterator
                    var scene = _iterator.nextBatch();
    
                    // update render progress counter
                    _renderCounter++;
    
                    // stop if iterator reached the end           
                    if (!scene)
                        return null;
    
                    if (scene instanceof THREE.Scene) {
                        // The code for fragment visibility and sorting is only defined if scene is a RenderBatch.
                        // For the case of THREE.Scene, we are done here, because
                        //   - Sorting in THREE.Scene is done by FireFlyRenderer.
                        //   - Per-fragment visiblity is not supported in this case
                        return scene;
                    }
    
                    //TODO: move this into the iterator?
                    var allHidden = scene.applyVisibility(
                        _drawMode,
                        _frustum,
                        this.getFragmentList().fragments.packIds ? fragIdCallback : null);
    
                    // For 3D scenes, sort fragments of this batch. 
                    // Note that fragments of F2D scenes must be drawn in original order.
                    //TODO: Move this to the iterator?
                    if (!this.is2d()) {
                        //Generally opaque batches are sorted once by material, while
                        //transparent batches are sorted back to front each frame
                        if (scene.sortObjects && !this.getFragmentList().useThreeMesh)
                            scene.sortByDepth(_frustum);
                        else if (!scene.sortDone)
                            scene.sortByMaterial();
                    }
    
    
                    if (!allHidden)
                        return scene;
                }
            };
    
            /**
             * @param:  {bool}        includeGhosted
             * @returns {THREE.Box3} 
             *
             * NOTE: The returned box is just a pointer to a member, not a copy!
             */
            this.getVisibleBounds = function (includeGhosted) {
    
                if (this.visibleBoundsDirty) {
    
                    _visibleBounds.makeEmpty();
                    _visibleBoundsWithHidden.makeEmpty();
    
                    _iterator.getVisibleBounds(_visibleBounds, _visibleBoundsWithHidden, includeGhosted);
    
    
                    this.visibleBoundsDirty = false;
    
                }
    
                return includeGhosted ? _visibleBoundsWithHidden : _visibleBounds;
            };
    
    
            /**
             * Performs a raytest and returns an object providing information about the closest hit. 
             * 
             * NOTE: We currently ignore hitpoints of fragments that are visible (MESH_VISIBLE==true) and not highlighted (MESH_HIGHLIGHTED==false). 
             *
             * @param {THREE.RayCaster} raycaster
             * @param [bool]            ignoreTransparent 
             * @param {number[]=}       [dbIds]             - Array of dbIds. If specified, only fragments with dbIds inside the filter are checked.
             *                                                If the model data has no instanceTree, this is just a whitelist of explicit fragment ids.
             *                                                Note that a hitpoint will also be returned if it's actually occluded by a fragment outside the filter.
             *
             * @returns {Object|null}   Intersection result object r providing information about closest hit point. Properties:
             *                           - {number}   fragId
             *                           - {Vector3}  point
             *                           - {number}   dbId
             *                           - {model}    model - pointer to this RenderModel
             *                          (created/filled in VBIntersector.js, see for details)
             */
            // Add "meshes" parameter, after we get meshes of the object using id buffer,
            // then we just need to ray intersect this object instead of all objects of the model.
            this.rayIntersect = function (raycaster, ignoreTransparent, dbIds) {
    
                // make sure that the cached overall bboxes are up-to-date.
                // [HB:] Why are they updated here, but not used in this method?
                if (this.visibleBoundsDirty)
                    this.getVisibleBounds();
    
                // alloc array to collect intersection results
                var intersects = [];
                var i;
    
                // Restrict search to certain dbIds if specified...
                if (dbIds && dbIds.length > 0) {
    
                    //Collect the mesh fragments for the given database ID node filter.
                    var it = this.getData().instanceTree;
                    var fragIds = [];
                    if (it) {
                        for (i = 0; i < dbIds.length; i++) {
                            it.enumNodeFragments(dbIds[i], function (fragId) {
                                fragIds.push(fragId);
                            }, true);
                        }
                    } else {
                        //No instance tree -- treat dbIds as fragIds
                        fragIds = dbIds;
                    }
    
                    //If there are multiple fragments it pays to still use
                    //the bounding volume hierarchy to do the intersection,
                    //because it can cull away entire fragments by bounding box,
                    //instead of checking every single fragment triangle by triangle
                    if (fragIds.length > 2) { //2 is just an arbitrary value, assuming checking 2 fragments is still cheap than full tree traversal
                        _iterator.rayCast(raycaster, intersects, dbIds);
                    } else {
                        // The filter restricted the search to a very small number of fragments.
                        // => Perform raytest on these fragments directly instead.
                        for (i = 0; i < fragIds.length; i++) {
                            var mesh = _frags.getVizmesh(fragIds[i]);
                            if (!mesh)
                                continue;
                            var res = VBIntersector.rayCast(mesh, raycaster, intersects);
                            if (res) {
                                intersects.push(res);
                            }
                        }
                    }
    
                } else {
                    // no filter => perform raytest on all fragments
                    _iterator.rayCast(raycaster, intersects);
                }
    
                // stop here if no hit was found
                if (!intersects.length)
                    return null;
    
                // sort results by distance. 
                intersects.sort(function (a, b) { return a.distance - b.distance; });
    
                //pick the nearest object that is visible as the selected.
                var result;
                for (i = 0; i < intersects.length; i++) {
                    var fragId = intersects[i].fragId;
    
                    //skip past f2d consolidated meshes.
                    //TODO: we should completely avoid intersecting those in the ray caster.
                    if (this.is2d())
                        continue;
    
                    var isVisible = this.isFragVisible(fragId); //visible set,
    
                    // [HB:] Since we skip all meshes that are not flagged as visible, shouldn't we 
                    //       better exclude them from the raycast in the first place?
                    if (isVisible) {
    
                        // skip transparent hits if specified
                        var material = _frags.getMaterial(fragId);
                        if (ignoreTransparent && material.transparent)
                            continue;
    
                        result = intersects[i];
    
                        // check against cutplanes
                        var isCut = false;
                        var intersectPoint = intersects[i].point;
                        if (material.cutplanes) {
                            for (var j = 0; j < material.cutplanes.length; j++) {
                                isCut = isCut || (material.cutplanes[j].dot(new THREE.Vector4(
                                    intersectPoint.x, intersectPoint.y, intersectPoint.z, 1.0
                                    )) > 1e-6);
                            }
                        }
                        if (isCut) {
                            result = null;
                        }
                        else {
                            // result is the closest hit that passed all tests => done.
                            break;
                        }
                    }
                }
    
                // We might use multiple RenderModels => add this pointer as well.
                if (result)
                    result.model = this;
    
                return result;
            };
    
    
            /** Set highlighting flag for a fragment. 
             *   @param   {number} fragId
             *   @param   {bool}   value
             *   @returns {bool}   indicates if flag state changed
             */
            this.setHighlighted = function (fragId, value) {
                var changed = _frags.setFlagFragment(fragId, Privite_Global.MESH_HIGHLIGHTED, value);
    
                if (changed) {
                    if (value)
                        _numHighlighted++;
                    else
                        _numHighlighted--;
                }
    
                return changed;
            };
    
            /** Sets MESH_VISIBLE flag for a fragment (true=visible, false=ghosted) */
            // This function should probably not be called outside VisibityManager
            // in order to maintain node visibility state.
            this.setVisibility = function (fragId, value) {
                _frags.setVisibility(fragId, value);
                this.visibleBoundsDirty = true;
            };
    
            /** Sets MESH_VISIBLE flag for all fragments (true=visible, false=ghosted) */
            this.setAllVisibility = function (value) {
                _frags.setAllVisibility(value);
                this.visibleBoundsDirty = true;
            };
    
            /** Sets the MESH_HIDE flag for all fragments that a flagged as line geometry. 
             *  Note that the MESH_HIDE flag is independent of the MESH_VISIBLE flag (which switches between ghosted and fully visible) 
             *
             *  @param {bool} value to which the MESH_HIDE flag will be set.
             */
            // [HB:] A little trap here is: Calling this.hideLines() would SHOW the lines, because the undef param evaluates to false.
            this.hideLines = function (hide) {
                _frags.hideLines(hide);
            };
    
            /** Returns if one or more fragments are highlighed. 
             *   returns {bool}
             *
             * Note: This method will only work correctly as long as all highlighting changes are done via this.setHighlighted, not on FragmentList directly.
             */
            this.hasHighlighted = function () {
                return !!_numHighlighted;
            };
    
            /** Returns true if a fragment is tagged as MESH_VISIBLE and not as MESH_HIGHLIGHTED. */
            // 
            // [HB:] It's seems a bit unintuitive that the MESH_HIGHLIGHTED flag is checked here, but not considered by the other visibility-related methods.
            //       For instance, consider the following scenarioes:
            //        - After calling setVibility(frag, true), isFragVisible(frag) will still return false if frag was highlighed.
            //        - If areAllVisible() returns true, there may still be fragments for which isFragVisible(frag) returns false.
            this.isFragVisible = function (frag) {
                return _frags.isFragVisible(frag);
            };
    
            /** Returns true if MESH_VISIBLE flag is set for all fragments. */
            this.areAllVisible = function () {
    
                // When using a custom iterator, we don't have per-fragment visibility control. 
                // We assume constantly true in this case.
                if (!_frags) {
                    return true;
                }
    
                return _frags.areAllVisible();
            };
            /*
                this.getRenderProgress = function() {
                    return _iterator.getRenderProgress();
                };
            */
    
            /** Direct access to all RenderBatches. Used by ground shadows and ground reflection.
              * @returns {RenderBatch[]}
              */
            this.getGeomScenes = function () { return _iterator.getGeomScenes(); };
    
            /** Get progress of current rendering traversal.
              *  @returns {number} in [0,1]
              */
            this.getRenderProgress = function () {
                return _renderCounter / _iterator.getSceneCount();
            };
    
            // [HB:] Apparently not used anywhere.
            this.pageOutStatus = function () {
                return _pageOutStatus;
            };
    
            /** Page geometry out if memory is under pressure. This method is internally
             *  used by this.frameUpdatePaging() below. 
             *   @param [bool] forcePageOut  - By default, fragments can only be paged out if already traversed.
             *                                 If forcePageOut is set, we also allow to page-out geometry 
             *                                 of fragments that were not traversed yet.
             *   @returns {number} pageState - Possible values:
             *                                   avp.PAGEOUT_SUCCESS: We paged out enough, so that the number 
             *                                                        of geometries is within the limit.
             *                                   avp.PAGEOUT_FAIL:    Still exceeding the limit.
             */
            this.pageOutIfNeeded = function (forcePageOut) {
    
                // [HB:] Why not using _geoms and _frags directly?
                var _geoms = this.getGeometryList();
                var _frags = this.getFragmentList();
    
                // If over the limit, start page out
                var num = _geoms.numGeomsInMemory;
                if (num > Privite_Global.GEOMS_COUNT_LIMIT) {
    
                    var sum = 0; // number of bytes that we freed by removing geometry
                    var p = 0; // number of geometries removed
                    var i = 0, len, geomId, size; // tmp (see below)
    
                    // Goal is to page out avp.GEOMS_PAGEOUT_COUNT fragments
                    var remaining = Privite_Global.GEOMS_PAGEOUT_COUNT;
    
                    // [HB:] The steps 1.+2. always try to page out avp.GEOMS_PAGEOUT_COUNT geoms,
                    //       even if the limit is actually only exceeded by 1. This might cause more 
                    //       paging than actually needed. Is this intended for some reason?
    
                    // Step 1: Remove untraversed geometries first
                    // Number of culled geoms that we remove is: Min(#culledGeoms, remaining)             
                    len = _frags.culledGeom.length;
                    len = len > remaining ? remaining : len;
                    for (i = 0; i < len; i++) {
                        // remove culled geom
                        geomId = _frags.culledGeom[i];
                        size = _geoms.removeGeometry(geomId);
    
                        // track bytes and #removedGeoms
                        if (size > 0) {
                            sum += size;
                            p++;
                        }
                    }
                    // erase removed elements from _frags.culledGeom
                    _frags.culledGeom.splice(0, len);
                    remaining = remaining - len;
    
                    // Step 2: If not enough, continue to remove geometries that are already traversed.
                    if (remaining > 0) {
                        // Number of traversed geoms that we remove is: Min(#traversedGeoms, remaining)
                        len = _frags.traversedGeom.length;
                        i = len > remaining ? len - remaining : 0;
    
                        // Remove all geometries that have been traversed in a reversed order.
                        for (; i < len; ++i) {
                            // remove traversed geom
                            geomId = _frags.traversedGeom[i];
                            size = _geoms.removeGeometry(geomId);
    
                            // track bytes and #removedGeoms
                            if (size > 0) {
                                sum += size;
                                p++;
                            }
                        }
    
                        // erase removed elements from _frags.traversedGeoms
                        len = len > remaining ? remaining : len;
                        _frags.traversedGeom.splice(-len, len);
                    }
    
                    // While steps 1.+2. above page out solely based on avp.GEOMS_PAGEOUT_COUNT,
                    // step 3. below tracks numGeomsInMemory instead. If forcePageOut is set, 
                    // this could mean that we enter step 3. and remove relevant geometry, 
                    // even if culledGeom and traversedGeoms might still contain better candidates.
                    // However, this method is currently only culled with frorcePageOut if 
                    // calling without didn't help at all. (see this.frameUpdatePaging)
    
                    // Step 3: If existing geometries are still over the limitation, and force page out enabled,
                    //         run through the whole list and page out as much as needed.
                    num = _geoms.numGeomsInMemory;
                    if (forcePageOut && num > Privite_Global.GEOMS_COUNT_LIMIT) {
                        len = _geoms.geoms.length;
                        for (i = 0; i < len; ++i) {
                            size = _geoms.removeGeometry(i);
                            if (size > 0) {
                                sum += size;
                                p++;
                            }
                            // stop if we are within the limit again
                            if (_geoms.numGeomsInMemory < Privite_Global.GEOMS_COUNT_LIMIT)
                                break;
                        }
                        Logger.log("A force page out occur. ");
                    }
    
                    _pageOutGeomCount += p;
                    Logger.log("Unload: " + p + " , Size: " + sum / (1024 * 1024) + "MB. " + "Remaining: " + _geoms.numGeomsInMemory);
    
                    if (_geoms.numGeomsInMemory > Privite_Global.GEOMS_COUNT_LIMIT) {
                        // If still above the limit, then page out failed.
                        // This case illustrates that too many geometry get loaded,
                        // but haven't render yet.
                        // So, let's redo the rendering, and stop loading further more until
                        // there are more memory freed up.
                        _frags.reachLimit = true; // block FragmentList.requireGeometry from on-demand-loading
                        _packIds = [];   // For the current traversal, clear list of missing geoms,
                        // so that svf-loader does not continue to load these.
                        return Privite_Global.PAGEOUT_FAIL;
                    }
                }
    
                // re-enable on-demand loading again.
                _frags.reachLimit = false;
                return Privite_Global.PAGEOUT_SUCCESS;
            };
    
            /** 
             *  Triggers paging out of geometry if necessary.
             * 
             *  In each frame update, some more batches of the overall scene are rendered until time runs out. 
             *  This function is called at the end of each such frame update to page out stuff if needed.
             *  (see RenderScene.renderSome)
             *
             *   &param [bool] isBeginFrame - Indicates if the current frame update was the first one.
             */
            this.frameUpdatePaging = function (isBeginFrame) {
    
                // [HB:] The member _frags can be used directly instead.
                var _frags = this.getFragmentList();
    
                // Check if we should use paging.
                // [HB:] So far, _-prefix indicated private members, but is used here for a local variable.
                var _pageOutGeometryEnabled = Privite_Global.pageOutGeometryEnabled && (_frags.getCount() > Privite_Global.FRAGS_PERSISTENT_MAX_COUNT);
    
                // [HB:] Maybe it would be clearer to read if we just return here if paging out is disabled,
                //       because the code below does nothing in this case anyway.
    
                // [HB:] Why is the !isBeginFrame condition needed? 
                if (_pageOutGeometryEnabled && !isBeginFrame) {
                    if (_pageOutStatus == Privite_Global.PAGEOUT_FAIL) {
                        // The last time of paging out failed, which means that
                        // small part of the model get traversed, then let's wait until
                        // enough geometries are ready to recycle.
                        if (_frags.traversedGeom.length > Privite_Global.GEOMS_PAGEOUT_COUNT * 0.5) {
                            _pageOutStatus = this.pageOutIfNeeded();
                        }
                    }
                    else {
                        _pageOutStatus = this.pageOutIfNeeded();
                    }
                }
    
                // When scene rendering traversal is finished and we did not page out enough
                // in the previous frame updates yet, do some final paging-out and make sure that it succeeds.
                if (_iterator.done()) {
    
                    if (_pageOutGeometryEnabled) {
                        // We will give a last try of paging out,
                        // if still fail and traversed geometry is not empty, then will need another render.
                        // otherwise, need a hard page out no matter geometry get traversed or not.
                        _pageOutStatus = this.pageOutIfNeeded();
                        if (_pageOutStatus == Privite_Global.PAGEOUT_FAIL && _pageOutGeomCount === 0) {
                            this.pageOutIfNeeded(true);
                        }
                    }
                }
            };
    
            /** Used by SvfLoader to decide which fragments to load next.
             *  @returns {number[]} pack ids of all fragments that were missing in last frame.
             */
            this.geomPacksMissingLastFrame = function () {
                return _packIds;
            };
    
            /** Explicitly add the pack as missing from last frame. 
             *  Used by SvfLoader to delay-load fragments for which on-demand-load failed because all workers
             *  were busy.
             *   &param {number} packId
             */
            this.addGeomPackMissingLastFrame = function (packId) {
                if (_packIds.indexOf(packId) == -1) {
                    _packIds.push(packId);
                }
            };
    
            /** 
             *  @params  {number} timeStamp
             *  @returns {bool}   true if the model needs a redraw
             */
            this.update = function (timeStamp) {
                // if there is an iterator that implements update method...
                if (_iterator && _iterator.update) {
                    return _iterator.update(timeStamp);
                }
                // assume constant scene otherwise
                return false;
            };
    
    
            /** Highlight an object with a theming color that is blended with the original object's material.
             *   @param {number}        dbId
             *   @param {THREE.Vector4} themingColor (r, g, b, intensity), all in [0,1]
             */
            this.setThemingColor = function (dbId, color) {
                if (_frags) {
                    _frags.setThemingColor(dbId, color);
                } else {
                    Logger.warn("Theming colors are not supported by this model type.");
                }
            }
    
            /** Revert all theming colors.
             *   @param {number}        dbId
             *   @param {THREE.Vector4} themingColor (r, g, b, intensity), all in [0,1]
             */
            this.clearThemingColors = function () {
                if (_frags) {
                    _frags.clearThemingColors();
                }
            }
        }
    
        RenderModel.prototype = Object.create(Model.prototype);
        RenderModel.prototype.constructor = RenderModel;

        return RenderModel;
});