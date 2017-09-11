define([
    '../Logger',
    '../Constants/Global',
    '../Math/VBIntersector'
], function(Logger, Global, VBIntersector) {
    'use strict';
    var _tmpBox;
    
    function init_three() {

        if (!_tmpBox)
            _tmpBox = new THREE.Box3();

    }

    /** @constructor
     * Represents a subset of objects from a larger list, for e.g. a draw call batch
     * to send to the renderer. It's like a small view into an ordered FragmentList.
     *
     * frags     -- FragmentList of all available meshes (1:1 correspondance with LMV fragments)
     * fragOrder -- Array of indices, pointing into the array of fragments
     * start     -- start index in the array of indices
     * count     -- how many mesh indices (after start index) are contained in the subset.
     *
     */
    function RenderBatch(frags, fragOrder, start, count) {

        this.frags = frags;
        this.indices = fragOrder; // may be a typed array (usually, Int32Array) or generic Array containing 
        // the actual typed array in index 0, see getIndices(). May be null, which means indices[i]==i.
        this.start = start;
        this.count = count;
        this.lastItem = start; // Defines the (exclusive) range end used in this.forEach(). If a batch is complete, i.e. all fragments are added, 
        // we usually have this.lastItem = this.start + this.count. But it may be smaller if dynamic adding is being used.
        // The final value of this.lastItem is set from outside by the creator (see e.g., ModelIteratorLinear or ModelIteratorBVH)
        // NOTE: this.lastItem must be set before this.forEach() has any effect.

        //Compatibility with THREE.Scene. Optional override material (instanceof THREE.ShaderMaterial) temporarily used by renderers.
        this.overrideMaterial = null;

        //Whether sort by material ID has been done
        this.sortDone = false;
        this.numAdded = 0; // number of added batches since last material sort

        this.avgFrameTime = undefined; // Average time spent for rendering this batch. Maintained externally by RenderScene.renderSome()

        // Summed worldBoxes 
        this.boundingBox = new THREE.Box3();
        this.boundingBoxHidden = new THREE.Box3(); //bbox counting hidden/ghosted


        //Tells the renderer whether to sort by Z before drawing.
        //We only set this for RenderBatches containing transparent objects.
        this.sortObjects = false;

        this.sortDone = false;
        this.sortByShaderDone = false;

        // Only internally (re)used by this.sortByDepth() to avoid reallocation.
        this.depths = null; // Float32Array, depths[i] stores the last computed depth for the framgent with fragId==this.indices[this.startIndex + i]. see this.sortByDepth().
        this.indicesView = null; // array view into this.indices, reduced to the range [this.start, this.start+this.count]

        //Tells the renderer whether to do per-mesh frustum culling.
        //In some cases when we know the whole batch is completely
        //contained in the viewing frustum, we turn this off.
        this.frustumCulled = true;

        //Used by ground shadow code path
        this.forceVisible = false;

        // FragmentList do not always contain THREE.Meshes for each shape. They may also just contain plain LmvBufferGeometry 
        // and THREE.ShaderMaterial. In this case, the renderer must handle the this batch using immediate mode rendering.
        // (see FragmentList.getVizmesh() and FireflyWebGLRenderer.render() for details)
        this.renderImmediate = !frags.useThreeMesh;

        //Set per frame during scene traversal
        this.renderImportance = 0.0;

        // make sure that static temp-variable _tmpBox exists (used to reduce new Box allocations in several methods below)
        init_three();
    }

    RenderBatch.prototype.getIndices = function () {
        // Note that isArray returns false for typed arrays like Int32Array. 
        // isArray() is used to here to check whether indices is
        //  a) a typed array itself or
        //  b) a generic array containing the actual typed array in index 0.
        return Array.isArray(this.indices) ? this.indices[0] : this.indices;
    };

    // Sorts 
    RenderBatch.prototype.sortByMaterial = function () {

        //Render batch must be complete before we can sort it
        if (this.numAdded < this.count)
            return;

        var frags = this.frags;
        var indices = this.getIndices();

        if (!indices) {
            Logger.warn("Only indexed RenderSubsets can be sorted.");
            return;
        }

        // apply sort only to the range used by this batch
        var tmp = indices.subarray(this.start, this.start + this.count);
        Array.prototype.sort.call(tmp, function (a, b) {
            var ma = frags.getMaterialId(a);
            var mb = frags.getMaterialId(b);

            if (ma === undefined)
                return mb ? 1 : 0;
            if (mb === undefined)
                return -1;

            return ma - mb;
        });

        //indices.set(tmp, this.start); // not needed because tmp already points to the same buffer

        // indicate that indices are sorted by material and no batches have beend added since then.
        this.numAdded = 0;
        this.sortDone = true;
    };

    //Sorts meshes in the render batch by shader ID, to avoid
    //unnecessary shader switching in the renderer when looping over a batch.
    //This can only be performed once the RenderBatch is full/complete and
    //all shaders are known.
    RenderBatch.prototype.sortByShader = function () {

        //Render batch must be complete before we can sort it
        if (!this.sortDone || this.sortByShaderDone)
            return;

        var frags = this.frags;
        var indices = this.getIndices();

        var tmp = indices.subarray(this.start, this.start + this.count);

        Array.prototype.sort.call(tmp, function (a, b) {
            var ma = frags.getMaterial(a);
            var mb = frags.getMaterial(b);

            var pd = ma.program.id - mb.program.id;
            if (pd)
                return pd;

            return ma.id - mb.id;
        });

        //indices.set(tmp, this.start);

        this.numAdded = 0;
        this.sortByShaderDone = true;
    };


    // Sorts this.indices by increasing depth for the current view.
    // Input: frustumIn instanceof FrustumIntersector
    RenderBatch.prototype.sortByDepth = (function () {

        var frags;
        var indices;
        var frustum;
        var bbox;
        var depths; // just a pointer to this.depths 

        // use frustum to calculate depth per fragment
        function calDepth(fragId, i) {
            if (!frags.getGeometry(fragId))
                depths[i] = -Infinity;
            else {
                frags.getWorldBounds(fragId, bbox);
                depths[i] = frustum.estimateDepth(bbox);
            }
        }

        //function sortCB(a, b) {
        //    return depths[b] - depths[a];
        //}

        return function (frustumIn) {

            frags = this.frags;
            indices = this.getIndices();
            frustum = frustumIn;
            bbox = _tmpBox;

            if (!indices) {
                Logger.warn("Only indexed RenderSubsets can be sorted.");
                return;
            }

            // init indicesView as a view to the relevant range in this.indices, i.e., the range [start, start+count)
            if (!this.indicesView || this.indicesView.length < this.count)
                this.indicesView = indices.subarray(this.start, this.start + this.count);

            // allocate this.depth to store a depth value for each fragment index in indicesView
            if (!this.depths || this.depths.length < this.count)
                this.depths = new Float32Array(this.count);

            depths = this.depths;

            // For each fragId indicesView[i], compute the depth and store it in depth[i]
            this.forEachNoMesh(calDepth);

            // Does not work, this call sorts on depths[indicesViews[i]], not depths[i],
            // where 'i' is an index into both the depths and indicesViews lists.
            //Array.prototype.sort.call(this.indicesView, sortCB);

            // Insertion sort appears to be about 7x or more faster
            // for lists of 64 or less objects vs. defining a sort() function.
            // Asking if there's a faster way. Traian mentioned quicksort > 8
            // objects; I might give this a try.
            var tempDepth, tempIndex;
            for (var j = 1; j < depths.length; j++) {
                var k = j;
                while (k > 0 && depths[k - 1] < depths[k]) {
                    // swap elem at position k one position backwards (for indicesView and depths)
                    tempDepth = depths[k - 1];
                    depths[k - 1] = depths[k];
                    depths[k] = tempDepth;
                    tempIndex = this.indicesView[k - 1];
                    this.indicesView[k - 1] = this.indicesView[k];
                    this.indicesView[k] = tempIndex;
                    k--;
                }
            }

            //indices.set(this.indicesView, this.start); // Not needed because indicesView is already a view into this range
        };
    })();

    //Use only for incremental adding to linearly ordered (non-BVH) scenes!
    RenderBatch.prototype.onFragmentAdded = (function () {

        return function (fragId) {

            // update bbox
            this.frags.getWorldBounds(fragId, _tmpBox);
            this.boundingBox.union(_tmpBox);

            // mark 
            this.sortDone = false;

            //NOTE: This only works with trivial fragment ordering (linear render queues).
            //Otherwise the item index does not necessarily match the fragId due to the 
            //reordering jump table (this.indices).
            if (this.lastItem <= fragId) {
                this.lastItem = fragId + 1;
                this.numAdded++;
            }
        };
    })();


    //Use the complex implementation of forEach only when paging is enabled.
    //TODO: This might be better done using inheritance from RenderBatch
    if (Global.pageOutGeometryEnabled) {

        /**
         * Iterates over fragments.
         * @param {function} callback - function(mesh, id) called for each fragment geometry.
         *      - mesh: instanceof THREE.Mesh (as obtained from FragmentList.getVizmesh)
         *      - id:   fragment id
         * @param {number} drawMode - Optional flag (see FragmentList.js), e.g., avp.MESH_VISIBLE. If specified, we only traverse fragments for which this flag is set.
         * @param {bool} includeEmpty - Default: false, i.e. fragments are skipped if they have no mesh available via getVizmesh().
         * What's different from the simple forEach() impl below?:
         *      If the overall fragment count is within the limit FRAGS_PERSISTENT_MAX_COUNT, the method is identical with the simple one.
         *      For larger ones, some extra work is done to support paging:
         *          1. Track traversed fragments: For drawMode==MESH_RENDERFLAG, we use the MESH_TRAVERSED flag to tag meshes that have already been rendered.
         *          2. Track traversed instances/geometries:
         *             > In frags.geomidsmap,    we track for each geometry, how many instances we already traversed.
         *             > In frags.traversedGeom, we collect the ids of all geometries, for which all instances have been traversed.
         */
        RenderBatch.prototype.forEach = function (callback, drawMode, includeEmpty) {

            var indices = this.getIndices();

            var frags = this.frags;
            var sortByShaderPossible = !this.sortByShaderDone;

            var pageOutGeometryEnabled = (frags.getCount() > Global.FRAGS_PERSISTENT_MAX_COUNT);

            for (var i = this.start, iEnd = this.lastItem; i < iEnd; i++) {
                var idx = indices ? indices[i] : i;
                var m;

                // Only do this when page out enabled.
                if (pageOutGeometryEnabled) {

                    // If already traversed for rendering, ignore this fragment.
                    if ((frags.isFlagSet(idx, Global.MESH_TRAVERSED)) && (drawMode == Global.MESH_RENDERFLAG)) {
                        continue;
                    }

                    m = frags.getVizmesh(idx);

                    // If geometry of this fragment is required...
                    if (!includeEmpty && (drawMode && frags.isFlagSet(idx, drawMode))) {

                        if (!m.geometry) {
                            // Require geometry only when truly need it, so that it is available on later runs.
                            // Note that m.geometry will usually be null here.
                            m.geometry = frags.requireGeometry(idx);
                        }
                        else {
                            // Set traversed flag for this fragment.
                            if (drawMode == Global.MESH_RENDERFLAG)
                                frags.setFlagFragment(idx, Global.MESH_TRAVERSED, true);

                            // For fragments that may be paged out, check if this fragment was the
                            // last one 
                            if (idx > Global.FRAGS_PERSISTENT_COUNT) {
                                // Only do this if using optimized memory for geometry rendering, 
                                // and ignore the first FRAGS_PERSISTENT_COUNT fragments that are more improtant
                                // to persistent in memory all the time.
                                // let's check whether this geometry has been fully used.
                                // If so then add it to the traversed geometry list for recycle.

                                // get id of the geometry used by this fragment
                                var geomId = frags.geomids[idx];

                                // check if all instances of this geometry have been traversed
                                var geomTraversed = true;
                                var map = frags.geomidsmap[geomId];
                                if (map != null) {
                                    // increase counter of traversed geometry instances
                                    map.t++;

                                    // if counter reaches the the instance count, this was the last instance 
                                    // of this geometry that needed to be processed.
                                    geomTraversed = (map.n == map.t);
                                }

                                if (geomTraversed)
                                    // add geometry id to the list of geoms, for which all instances are traversed.
                                    frags.traversedGeom.push(geomId);
                            }

                        }
                    }
                }
                else {
                    // fragment list is small enough => just get the mesh without any paging work.
                    m = frags.getVizmesh(idx);
                }

                if (sortByShaderPossible && (!m || !m.material || !m.material.program))
                    sortByShaderPossible = false;


                // if drawMode is given, iterate vizflags that match
                if ((includeEmpty || (m && m.geometry)) &&
                    (!drawMode || frags.isFlagSet(idx, drawMode))) {

                    callback(m, idx);
                }
            }

            //If all materials shaders are already available, we can sort by shader
            //to minimize shader switches during rendering. This sort will only
            //execute once and changing materials later will break the sorted order again.
            if (sortByShaderPossible)
                this.sortByShader();
        };


    } else {

        /**
         * Iterates over fragments.
         * @param {function} callback - function(mesh, id) called for each fragment geometry.
         *      - mesh: instanceof THREE.Mesh (as obtained from FragmentList.getVizmesh)
         *      - id:   fragment id
         * @param {number} drawMode - Optional flag (see FragmentList.js), e.g., avp.MESH_VISIBLE. If specified, we only traverse fragments for which this flag is set.
         * @param {bool} includeEmpty - Default: false, i.e. fragments are skipped if they have no mesh available via getVizmesh().
         */
        RenderBatch.prototype.forEach = function (callback, drawMode, includeEmpty) {

            var indices = this.getIndices();

            var frags = this.frags;
            var sortByShaderPossible = !this.sortByShaderDone;

            //If the most likely rendering flags are true, use a shortened version of the for-loop.
            if (!drawMode && !includeEmpty && !sortByShaderPossible) {
                for (var i = this.start, iEnd = this.lastItem; i < iEnd; i++) {
                    var idx = indices ? indices[i] : i;

                    var m = frags.getVizmesh(idx);

                    if (m && m.geometry) {
                        callback(m, idx);
                    }
                }
            } else {
                for (var i = this.start, iEnd = this.lastItem; i < iEnd; i++) {
                    var idx = indices ? indices[i] : i;

                    var m = frags.getVizmesh(idx);

                    if (sortByShaderPossible && (!m || !m.material || !m.material.program))
                        sortByShaderPossible = false;

                    // if drawMode is given, iterate vizflags that match
                    if ((includeEmpty || (m && m.geometry)) &&
                        (!drawMode || frags.isFlagSet(idx, drawMode))) {

                        callback(m, idx);
                    }
                }
            }

            //If all materials shaders are already available, we can sort by shader
            //to minimize shader switches during rendering.  This sort will only
            //execute once and changing materials later will break the sorted order again.
            if (sortByShaderPossible)
                this.sortByShader();
        };

    }

    /**
     * Iterates over fragments. Like forEach(), but takes a different callback.
     * @param {function} callback - function(fragId, idx) called for each fragment geometry.
     *      - fragId:   fragment id
     *      - idx:      running index from 0 .. (lastItem-start)
     * @param {number} drawMode - Optional flag (see FragmentList.js), e.g., avp.MESH_VISIBLE. If specified, we only traverse fragments for which this flag is set.
     * @param {bool} includeEmpty - Default: false, i.e. fragments are skipped if they have no mesh available via getVizmesh().
     */
    RenderBatch.prototype.forEachNoMesh = function (callback, drawMode, includeEmpty) {

        var indices = this.getIndices();
        var frags = this.frags;

        for (var i = this.start, iEnd = this.lastItem; i < iEnd; i++) {
            var fragId = indices ? indices[i] : i;

            // get geometry - in this case just to check if it is available
            var geometry;
            if (frags.useThreeMesh) {
                var m = frags.getVizmesh(fragId);
                if (m)
                    geometry = m.geometry;
            }
            else {
                geometry = frags.getGeometry(fragId);
            }

            // if drawMode is given, iterate vizflags that match
            if ((includeEmpty || geometry) &&
                (!drawMode || frags.isFlagSet(fragId, drawMode))) {

                callback(fragId, i - this.start);
            }
        }
    };

    /**
     * Checks if given ray hits a bounding box of any of the fragments.
     * @param {THREE.RayCaster} raycaster
     * @param {Object[]}        intersects - An object array that contains intersection result objects.
     *                                       Each result r stores properties like r.point, r.fragId, r.dbId. (see VBIntersector.js for details)
     * @param {number[]=}       dbIdFilter - Array of dbIds. If specieed, only fragments with dbIds inside the filter are checked.
     */
    RenderBatch.prototype.raycast = (function () {

        return function (raycaster, intersects, dbIdFilter) {

            //Assumes bounding box is up to date.
            if (raycaster.ray.isIntersectionBox(this.boundingBox) === false)
                return;

            var self = this;
            var tmpBox = _tmpBox;

            // traverse all visible meshes
            this.forEach(function (m, fragId) {

                //Check the dbIds filter if given
                if (dbIdFilter && dbIdFilter.length) {
                    //Theoretically this can return a list of IDs (for 2D meshes)
                    //but this code will not be used for 2D geometry intersection.
                    var dbId = 0 | self.frags.getDbIds(fragId);

                    //dbIDs will almost always have just one integer in it, so
                    //indexOf should be fast enough.
                    if (dbIdFilter.indexOf(dbId) === -1)
                        return;
                }

                // raycast worldBox first.
                self.frags.getWorldBounds(fragId, tmpBox);

                if (raycaster.ray.isIntersectionBox(tmpBox)) {
                    // worldbox was hit. do raycast with actucal geometry.
                    VBIntersector.rayCast(m, raycaster, intersects);
                }
            }, Global.MESH_VISIBLE);
        };
    })();

    /**
     * Computes/updates the members:
     *      - this.boundingBox 
     *      - this.boundingBoxHidden (bbox of ghosted fragments)
     */
    RenderBatch.prototype.calculateBounds = (function () {

        // pointers to make some objects available for the callback below.
        var vizflags;
        var bounds;
        var boundsH;
        var frags;
        var tmpBox;

        // adds box of a fragment to bounds or bounds, depennding on its vizflags.
        function cb(fragId) {

            frags.getWorldBounds(fragId, tmpBox);

            var f = vizflags[fragId];
            if (f & 1/*MESH_VISIBLE*/)
                bounds.union(tmpBox);
            else
                boundsH.union(tmpBox); //mesh is "ghosted"
        }

        return function () {
            // init boxes for visible and ghosted meshes
            this.boundingBox.makeEmpty();
            this.boundingBoxHidden.makeEmpty();

            // make members and tempBox accessible for cb
            vizflags = this.frags.vizflags;
            bounds = this.boundingBox;
            boundsH = this.boundingBoxHidden;
            frags = this.frags;
            tmpBox = _tmpBox;

            this.forEachNoMesh(cb);
        };
    })();

    /**
     * Sets the avp.MESH_RENDERFLAG for a single fragment, depeneding on the drawMode and the other flags of the fragment.
     * @param {number} drawMode - One of the modes defined in Viewer3DImpl.js, e.g. avp.RENDER_NORMAL
     * @param {number} vizflags - vizflags bitmask. 
     * @param {number} idx - index into vizflags, for which we want to determine the MESH_RENDERFLAG.
     * @returns {bool} Final, evaluated visibility.
     */
    function evalVisbility(drawMode, vizflags, idx) {

        var v;
        var vfin = vizflags[idx] & 0x7f;
        switch (drawMode) {

            case Global.RENDER_HIDDEN:
                v = !(vfin & Global.MESH_VISIBLE); //visible (bit 0 on)
                break;
            case Global.RENDER_HIGHLIGHTED:
                v = (vfin & Global.MESH_HIGHLIGHTED); //highlighted (bit 1 on)
                break;
            default:
                v = ((vfin & (Global.MESH_VISIBLE | Global.MESH_HIGHLIGHTED | Global.MESH_HIDE)) == 1); //visible but not highlighted, and not a hidden line (bit 0 on, bit 1 off, bit 2 off)
                break;
        }

        //Store evaluated visibility into bit 7 of the vizflags
        //to use for immediate rendering
        vizflags[idx] = vfin | (v ? Global.MESH_RENDERFLAG : 0);

        return v;
    }


    /**
     * Checks if fragment is outside the frustum.
     * @param {bool} checkCull - indicates if culling is enabled. If false, return value is always false. 
     * @param {FrustumIntersector} frustum
     * @param {FragmentList} frags
     * @param {number} idx - index into frags.
     * @returns {bool} True if the given fragment is outside the frustum and culling is enabled.
     */
    function evalCulling(checkCull, frustum, frags, idx) {

        var culled = false;

        frags.getWorldBounds(idx, _tmpBox);
        if (checkCull && !frustum.intersectsBox(_tmpBox)) {
            culled = true;
        }
        //This code path disabled because it was found to slow things down overall.
        /*
        else {
            // Check whether the projected area is smaller than a threshold,
            // if yes, do not render it.
            var area = frustum.projectedArea(_tmpBox);
            area *= frustum.areaConv;
            if (area < frustum.areaCullThreshold) {
                culled = true;
            }
        }
        */

        return culled;
    }


    //Use the complex implementation only when paging is enabled.
    //TODO: This might be better done using inheritance from RenderBatch
    if (Global.pageOutGeometryEnabled || Global.onDemandLoading) {

        // This implementation is mostly identical with the one further below.
        // => see other variant for comments.
        //
        // The only difference is:
        //   In this.frags.culledGeometry, we collect the geometry ids of all meshes 
        //   that are invisible due to culling or vizflags. This is used for paging geometry out.
        RenderBatch.prototype.applyVisibility = function () {

            var frags, vizflags, frustum, drawMode, fragIdCb, checkCull, allHidden;

            function applyVisCB(m, idx) {
                if (!m && frags.useThreeMesh) {
                    if (fragIdCb)
                        fragIdCb(idx);
                    return;
                }

                var culled = evalCulling(checkCull, frustum, frags, idx);

                if (culled) {
                    if (m) {
                        m.visible = false;
                    } else {
                        Logger.warn("Unexpected null mesh");
                    }
                    vizflags[idx] = vizflags[idx] & ~Global.MESH_RENDERFLAG;

                    // Record culled geometries for paging out.
                    if (idx > Global.FRAGS_PERSISTENT_COUNT) {
                        // This fragment is culled, then move its geometry to culled geomtry list.
                        var geomId = frags.geomids[idx];
                        if (frags.geoms.getGeometry(geomId)) {
                            var map = frags.geomidsmap[geomId];
                            // Let's only record the geometries that are not used by more than one fragments.
                            // As multiple referenced geometry are more important.
                            if (!map)
                                frags.culledGeom.push(geomId);
                        }
                    }

                    return;
                }

                var v = evalVisbility(drawMode, vizflags, idx);

                if (m)
                    m.visible = !!v;

                allHidden = allHidden && !v;
            }


            return function (drawModeIn, frustumIn, fragIdCbIn) {

                //Used when parts of the same scene
                //have to draw in separate passes (e.g. during isolate).
                //Consider maintaining two render queues instead if the
                //use cases get too complex, because this approach
                //is not very scalable as currently done (it traverses
                //the entire scene twice, plus the flag flipping for each item).

                allHidden = true;
                frustum = frustumIn;
                drawMode = drawModeIn;
                fragIdCb = fragIdCbIn;

                //Check if the entire render batch is contained inside
                //the frustum. This will save per-object checks.
                var containment = frustum.intersectsBox((drawMode === Global.RENDER_HIDDEN) ? this.boundingBoxHidden : this.boundingBox);
                if (containment === Global.OUTSIDE)
                    return allHidden; //nothing to draw

                vizflags = this.frags.vizflags;
                frags = this.frags;
                checkCull = (containment !== Global.CONTAINS);

                this.forEach(applyVisCB, null, fragIdCb);

                return allHidden;
            };
        }();


    } else {

        /**
         * Updates visibility for all fragments of this RenderBatch. 
         * This means:
         *  1. It returns true if all meshes are hidden (false otherwise)
         *
         *  2. If the whole batch box is outside the frustum, nothing else is done.
         *     (using this.boundingBox or this.boundingBoxHidden, depending on drawMode)
         *
         *  3. For all each checked fragment with fragId fid and mesh m, the final visibility is stored...
         *      a) In the m.visible flag.
         *      b) In the MESH_RENDERFLAG of the vizflags[fid]
         *     This is only done for fragments with geometry.   
         *  
         *  4. If a custom callback is specified (fragIdCb), this callback is triggered for all fragments
         *     for which mesh or mesh.geometry is missing.
         * @param {number} drawMode - One of the modes defined in Viewer3DImpl.js, e.g. avp.RENDER_NORMAL
         * @param {FrustumIntersector} frustum
         * @param {function=} fragIdCb - callback that is called for all empty fragments. It is used for on-demand-loading.
         * @returns {bool} True if all meshes are hidden (false otherwise).
         */
        RenderBatch.prototype.applyVisibility = function () {

            var frags, vizflags, frustum, drawMode, fragIdCb, checkCull, allHidden;

            // Callback to apply visibility for a single fragment
            //
            // Input: Geometry and index of a fragment, i.e.
            //  m:   instanceof THREE.Mesh (see FragmentList.getVizmesh). May be null.
            //  idx: index of the fragment in the fragment list. 
            //
            // What is does:
            //  1. bool m.visible is updated based on flags and frustum check (if m!=null)
            //  2. The MESH_RENDERFLAG flag is updated for this fragment, i.e., is true for meshes with m.visible==true
            //  3. If there is no geometry and there is a custom callback (checkCull) 
            //  4. Set allHidden to false if any mesh passes as visible.
            function applyVisCB(m, idx) {

                // if there's no mesh or no geometry, just call the custom callback.
                // [HB:] I think it would be clearer to remove the frags.useThreeMesh condition here.
                //       It's not really intuitive that for (m==0) the callback is only called for frags.useThreeMesh.
                //       Probably the reason is just that this code section has just been implemented for the useThreeMesh
                //       case and the other one was irrelevant.
                if ((!m && frags.useThreeMesh) || (!m.geometry)) {
                    // if a custom callback is specified, call it with the fragId
                    if (fragIdCb)
                        fragIdCb(idx);
                    return;
                }

                // apply frustum check for this fragment
                var culled = evalCulling(checkCull, frustum, frags, idx);

                // if outside, set m.visbile and the MESH_RENDERFLAG of the fragment to false
                if (culled) {
                    if (m) {
                        m.visible = false;
                    } else {
                        Logger.warn("Unexpected null mesh");
                    }
                    // unset MESH_RENDERFLAG
                    vizflags[idx] = vizflags[idx] & ~Global.MESH_RENDERFLAG;

                    return;
                }

                // frustum check passed. But it might still be invisible due to vizflags and/or drawMode. 
                // Note that evalVisbility also updates the MESH_RENDERFLAG already.
                var v = evalVisbility(drawMode, vizflags, idx);

                if (m)
                    m.visible = !!v;

                // Set to false if any mesh passes as visible
                allHidden = allHidden && !v;
            }

            // Similar to applyVisCB above, but without geometry param, so that we don't set any m.visible property.
            function applyVisCBNoMesh(idx) {

                // if no geometry is assigned, just call custom cb (if specified) and stop here.
                if (!frags.getGeometryId(idx)) {
                    // [HB:] Actually, this callback is only used if fragIdCb is not set. So, the check below will
                    //       always be false.
                    if (fragIdCb)
                        fragIdCb(idx);
                    return;
                }

                // apply frustum check for this fragment
                var culled = evalCulling(checkCull, frustum, frags, idx);

                // if culled, set visflags MESH_RENDERFLAG to false 
                if (culled) {
                    vizflags[idx] = vizflags[idx] & ~Global.MESH_RENDERFLAG;
                    return;
                }

                // frustum check passed. But it might still be invisible due to vizflags and/or drawMode. 
                // Note that evalVisbility also updates the MESH_RENDERFLAG already.
                var v = evalVisbility(drawMode, vizflags, idx);

                // Set to false if any mesh passes as visible
                allHidden = allHidden && !v;
            }

            return function (drawModeIn, frustumIn, fragIdCbIn) {

                //Used when parts of the same scene
                //have to draw in separate passes (e.g. during isolate).
                //Consider maintaining two render queues instead if the
                //use cases get too complex, because this approach
                //is not very scalable as currently done (it traverses
                //the entire scene twice, plus the flag flipping for each item).

                allHidden = true;
                frustum = frustumIn;
                drawMode = drawModeIn;
                fragIdCb = fragIdCbIn;

                //Check if the entire render batch is contained inside
                //the frustum. This will save per-object checks.
                var containment = frustum.intersectsBox((drawMode === Global.RENDER_HIDDEN) ? this.boundingBoxHidden : this.boundingBox);
                if (containment === Global.OUTSIDE)
                    return allHidden; //nothing to draw

                vizflags = this.frags.vizflags;
                frags = this.frags;
                checkCull = (containment !== Global.CONTAINS);

                // The main difference between applyVisCB and applyVisCBNoMesh is that applyVisCB also updates mesh.visible for each mesh.
                // This does only make sense when using THREE.Mesh. Otherwise, the mesh containers are volatile anyway (see FragmentList.getVizmesh)
                //
                // [HB:] If frags.useThreeMesh is false, it does never make sense to use the cb version with mesh. So, it's not really clear
                //       here why the check condition is not just (!frags.useThreeMesh).
                if (!fragIdCbIn && !frags.useThreeMesh) {
                    // Use callback that does not set mesh.visible
                    this.forEachNoMesh(applyVisCBNoMesh, null);
                } else {
                    // Use callback that also sets mesh.visible.
                    // Skip fragments without geometry unless a custom callback is defined (fragIdCB)
                    this.forEach(applyVisCB, null, fragIdCb);
                }

                return allHidden;
            };
        }();


    }

    return RenderBatch;
});