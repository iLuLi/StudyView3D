define([
    '../DeviceType',
    './FrustumIntersector',
    './Global'
], function(DeviceType, FrustumIntersector, Privite_Global) {
    'use strict';
    /** @constructor
     * RenderSceneRenderScene
     * Represents the full graphical scene.
     * Used for iterating through the scene for progressive rendering,
     * hit testing, etc.
     * */
    function RenderScene() {
        
        var _needsRender = false; // if true, scene needs a re-render due to a paging-failure in last render traversal

        var _done = false; // true indicates that progressive rendering has finished 
        // since last reset call, i.e. all batches have been traversed.

        // stable visbility (stable object count while moving the camera) (see this.renderSome)
        var _wantStableVisbility = !DeviceType.isMobileDevice;  // stable visbility is currently always active
        var _firstFrameLastBatch = null;  // If !=null, the first frame update is always continued up to this batch.
        var _wasBeginFrame = false; // Used to determine when reset _firstFrameLastBatch to null.
        // Set to false whenever a frame finishes after >1 frame update cycles, i.e., 
        // if the view didn't change long enough to fully finish a full traversal that took multiple updates.
        var _renderCounter = 0;     // counts RenderBatches processed so far in the current render traversal. 


        var _models = []; // {RenderModel[]} - All RenderModels to be rendered.
        var _candidateScenes = []; // {RenderBatch[]} - _candidateScenes[i] points to the next batch to be rendered from _models[i]. Same length as _models.
        var _tmpBox = new THREE.Box3(); // Reused for return values of getVisibleBounds() 

        var _frustum = new FrustumIntersector(); // updated for current camera in this.reset().
        var _raycaster = new THREE.Raycaster();

        var _frameStamp = 0;             // increased with each render traversal restart
        var _perf = performance;   // shortcut to browser-provided performance object


        //TODO: This should be removed, because the functionality that uses it
        //in the SvfLoader does not seem needed
        // If the given fragment is culled by either view frustum or
        // project area, then return true otherwise false.
        this.checkCull = function () {

            var box = new THREE.Box3();

            return function (idx, checkCull, checkArea) {
                _models[0].getFragmentList().getWorldBounds(idx, box);
                if (checkCull && !_frustum.intersectsBox(box)) {
                    return true;
                }
                else if (checkArea) {
                    var area = _frustum.projectedArea(box);
                    area *= _frustum.areaConv;
                    if (area < _frustum.areaCullThreshold) {
                        return true;
                    }
                }
                return false;
            }

        }();


        this.addModel = function (renderModel) {
            _models.push(renderModel);
            _candidateScenes.length = _models.length;
        };

        this.removeModel = function (renderModel) {
            var idx = _models.indexOf(renderModel);
            if (idx >= 0) {
                _models.splice(idx, 1);
            }
            _candidateScenes.length = _models.length;
            return idx >= 0;
        };

        this.isEmpty = function () {
            return _models.length === 0;
        };

        this.needsRender = function () {
            return _needsRender;
        };
        this.resetNeedsRender = function () {
            _needsRender = false;
        };


        /**
             * Incrementally render some meshes until we run out of time.
            *  @param {RenderCB} cb            - Called that does the actual rendering. Called for each RenderBatch to be rendered.
            *  @param {number}   timeRemaining - Time in milliseconds that can be spend in this function call.
            *  @returns {number} Remaining time left after the call. Usually <=0.0 if the frame could not be fully finished yet.
            * 
            * @callback RenderScene~RenderCB
            * @param {RenderBatch} scene
            */
        this.renderSome = function (renderObjectCB, timeRemaining) {

            var t0 = _perf.now(), t1;

            //If the render queue is just starting to render
            //we will remember how many items we draw on the first pass
            //and keep drawing the same number of items on subsequent first passes,
            //until we get to a second renderSome pass. This is to make sure that
            //while moving the camera in a single motion, the number of items we draw
            //does not vary, which causes some ugly flashing -- because the render time
            //per item varies a little from frame to frame.
            var isBeginFrame = (_renderCounter === 0);
            if (_wantStableVisbility && isBeginFrame && !_wasBeginFrame) {
                //case of a new initial frame when the previous frame was not initial
                _firstFrameLastBatch = null;
                _wasBeginFrame = true; // will change back to false as soon as the view keeps constant long enough
                // to finish a full scene traversal across 2 or more renderSome() calls.
            }

            // repeat until time budget is consumed...
            while (1) {

                //Find the best candidate render batch to render now -- in case
                //there are multiple models.
                //TODO: In case a huge number of models is loaded, we may have to
                //rethink the linear loop below and use some priority heap or somesuch.
                var candidateIdx = 0;
                var scene = _candidateScenes[0];
                for (var q = 1; q < _candidateScenes.length; q++) {

                    // candidate is the next RenderBatch to be processed from _models[q] 
                    var candidate = _candidateScenes[q];
                    if (candidate === null) {
                        // No more batches to render from this model
                        continue;
                    }

                    // If all previous candidates were null, _candidateScenes[q] is obviously the best one so far.
                    if (!scene) {
                        candidateIdx = q;
                        scene = candidate;
                    }

                    // Choose current candidate only if its renderImportance is higher.
                    // The renderImportance of RenderBatches is set by model iterators.
                    if (candidate.renderImportance > scene.renderImportance) {
                        candidateIdx = q;
                        scene = candidate;
                    }
                }

                // Render the batch we chose above and determine whether to continue the loop
                var outOfTime = false;
                if (scene) {
                    //Fetch a new render batch from the model that we took the
                    //current batch from.
                    _candidateScenes[candidateIdx] = _models[candidateIdx].nextBatch();

                    // do the actual rendering
                    renderObjectCB(scene);

                    // track how many batches we processed in the current traversal.
                    _renderCounter++;

                    // get time that we spent for rendering of the last batch
                    t1 = _perf.now();
                    var delta = t1 - t0; // in milliseconds
                    t0 = t1;

                    //For each sub-scene, keep a running average
                    //of how long it took to render over the
                    //last few frames.
                    if (scene.avgFrameTime === undefined)
                        scene.avgFrameTime = delta;
                    else
                        scene.avgFrameTime = 0.8 * scene.avgFrameTime + 0.2 * delta;

                    // update remaining time
                    // Note that we don't do accurate timing here, but compute with average values instead.
                    // In this way, the number of rendered batches is more consistent across different frames
                    timeRemaining -= scene.avgFrameTime;

                    // Check if we should exit the loop...
                    // Note that 'done' just refers to the current update cycle, while '_done' refers to the whole traversal.
                    var done = false;
                    if (_wantStableVisbility && isBeginFrame && _firstFrameLastBatch !== null) {
                        //In case we are drawing an initial frame, and the previous frame
                        //was also an initial frame, we will loop for as many items as we
                        //drew on the last pass.
                        if (scene == _firstFrameLastBatch)
                            done = true;
                    }
                    else //Otherwise (not first frame) draw based on timing.
                    {
                        if (timeRemaining <= 0)
                            done = true;
                    }

                    if (done) {
                        // [HB:] The code could be simplified a bit if we would just replace the "done = true" lines above
                        //       by 'break' directly. This would do the same as before, and we could remove the variables 'done' and 'outOfTime'
                        //       and the additional checks for them.
                        outOfTime = true;
                        break;
                    }

                }

                if (!scene) {
                    // No more batches => Frame rendering finished.
                    _done = true;
                    break;
                }

                // [HB:] This check has no effect, because it will only be reached if outOfTime is false.
                //       The only code that sets outOfTime to true is followed by a break (see above), so that the
                //       loop will be left already and this check is not reached anymore.
                if (outOfTime)
                    break;
            }

            //Remember how many items we drew on the first progressive frame, so that
            //we draw the same number if the next frame is also a first progressive frame
            //(e.g. camera moved and reset the render queue)
            if (_wantStableVisbility && isBeginFrame && _firstFrameLastBatch == null) {
                _firstFrameLastBatch = scene;
            }

            for (var q = 0; q < _models.length; q++) {
                // [HB:] The _needsRender below will never be reached, because
                //       RenderModel.frameUpdatePaging() does not return anything.
                if (_models[q].frameUpdatePaging(isBeginFrame) === Privite_Global.PAGEOUT_FAIL)
                    _needsRender = true;
            }

            // As long as _firstFrameLastBatch is set, we ignore timing and enforce the same batch count in each initial frame update.
            // This mechanism is only wanted in phases of permanent traversal restarts, where we never get the full frame finished (e.g., during a camera motion).
            // As soon as the view keeps constant again and we finish a progressive rendering with >1 update cycles, we reset 
            // _firstFrameLastBatch to null again, so that the number of batches in the next intial frame will be based purely on timing.
            if (_done || !isBeginFrame) {
                _firstFrameLastBatch = null;
                _wasBeginFrame = false;
            }

            return timeRemaining;
        };


        /** Resets the scene traversal 
         *   @param  {UnifiedCamera} 
         *   @param  {number}        drawMode - E.g., avp.RENDER_NORMAL. See Viewer3DImpl.js
         *   @param  {bool}          moved    - Must be set to true if scene or camera have changed. see RenderModel.resetIterator
         */
        this.reset = function (camera, drawMode, moved) {
            _frameStamp++;
            _done = false;

            _renderCounter = 0;
            this.resetNeedsRender();

            //Calculate the viewing frustum
            //TODO: same math is done in the renderer also. We could unify
            _frustum.reset(camera);

            if (!_models.length)
                return;

            //Begin the frustum based scene iteration process per model
            for (var i = 0; i < _models.length; i++) {
                _models[i].resetIterator(camera, _frustum, drawMode, moved);
                _candidateScenes[i] = _models[i].nextBatch();
            }
        };


        this.isDone = function () {
            return _done || this.isEmpty();
        };

        // Visibility and highlighting methods: see RenderModel.js for details.

        this.setAllVisibility = function (value) {
            for (var i = 0; i < _models.length; i++)
                _models[i].setAllVisibility(value);
        };

        this.hideLines = function (hide) {
            for (var i = 0; i < _models.length; i++)
                _models[i].hideLines(hide);
        };

        this.hasHighlighted = function () {
            for (var i = 0; i < _models.length; i++)
                if (_models[i].hasHighlighted())
                    return true;

            return false;
        };

        this.areAllVisible = function () {
            for (var i = 0; i < _models.length; i++)
                if (!_models[i].areAllVisible())
                    return false;

            return true;
        };

        /** Trigger bbox recomputation. See RenderModel.js for details. */
        this.invalidateVisibleBounds = function () {
            for (var i = 0; i < _models.length; i++)
                _models[i].visibleBoundsDirty = true;
        };

        /**
        * @param:  {bool}        includeGhosted
        * @returns {THREE.Box3} 
        *
        * NOTE: The returned box object is always the same, i.e. later calls
        *       affect previously returned values. E.g., for
        *        var box1 = getVisibleBounds(true);
        *        var box2 = getVisibleBounds(false);
        *       the second call would also change box1.
        */
        this.getVisibleBounds = function (includeGhosted) {
            if (_models.length === 1)
                return _models[0].getVisibleBounds(includeGhosted);

            _tmpBox.makeEmpty();
            for (var i = 0; i < _models.length; i++)
                _tmpBox.union(_models[i].getVisibleBounds(includeGhosted));

            return _tmpBox;
        };

        this.findModel = function (modelId) {
            for (var i = 0; i < _models.length; i++)
                if (_models[i].getModelId() === modelId)
                    return _models[i];

            return null;
        }

        /**
         * @param {THREE.Vector3} position            - Ray origin.
         * @param {THREE.Vector3} direction           - Ray direction.
         * @param {bool}          [ignoreTransparent] - Shoot trough transparent objects.
         * @param {number[]=}     [dbIds]             - Optional filter of fragments to be considered for testing. see RenderModel.rayIntersect().
         *
         * @returns {Object|null} Intersection result obect (see RenderModel.rayIntersect)
         */
        // Add "meshes" parameter, after we get meshes of the object using id buffer,
        // then we just need to ray intersect this object instead of all objects of the model.
        this.rayIntersect = function (position, direction, ignoreTransparent, dbIds, modelIds) {

            // init raycaster
            _raycaster.set(position, direction);

            // For multiple RenderModels, perform raytest on each of them and find the closest one.
            if (_models.length > 1) {

                // Collect raytest result objects from each 3D model
                var modelHits = [];

                if (modelIds) {
                    for (var i = 0; i < modelIds.length; i++) {
                        var model = this.findModel(modelIds[i]);
                        if (model) {
                            model.rayIntersect(_raycaster, ignoreTransparent, [dbIds[i]]);
                        }
                    }
                } else {
                    for (var i = 0; i < _models.length; i++) {

                        // Skip 2D models
                        if (_models[i].is2d())
                            continue;

                        // Perform raytest on model i                        
                        var res = _models[i].rayIntersect(_raycaster, ignoreTransparent, dbIds);
                        if (res)
                            modelHits.push(res);
                    }
                }

                if (!modelHits.length)
                    return null;

                // return closest hit
                modelHits.sort(function (a, b) { return a.distance - b.distance });
                return modelHits[0];

            } else {
                // If we don't have any 3D RenderModel, just return null.
                if (!_models.length || _models[0].is2d())
                    return null;

                // If we only have a single 3D RenderModel, just call rayIntersect() on it.
                return _models[0].rayIntersect(_raycaster, ignoreTransparent, dbIds);
            }
        };

        /**
         *  Progress of current frame rendering. 
         *  @returns {number} Value in [0,1], where 1 means finished.
         */
        this.getRenderProgress = function () {
            return _models[0].getRenderProgress();
        };

        /** @returns {RenderModel[]} */
        this.getModels = function () {
            return _models;
        };

        // ----------------------------
        // Warning: The methods in the section below assume that there is exactly one RenderModel.
        //          They will ignore any additional models and cause an exception if the model list is empty.
        // 

        // Direct access to FragmentList, GeometryList, and total number of RenderBatches.
        //
        // Note: 
        //  - The methods do only care for model 0 and ignore any additional ones.
        //  - Will cause an error when called if the RenderModel array is empty.
        this.getFragmentList = function () {
            return _models[0].getFragmentList();
        };
        this.getGeometryList = function () {
            return _models[0].getGeometryList();
        };
        this.getSceneCount = function () {
            return _models[0].getSceneCount();
        };

        //Used by ground shadow update
        //TODO: we need to allow multiple iterators over the render queue        
        this.getGeomScenes = function () {
            // Note that ground shadow will currently only work on RenderModel 0.
            return _models[0].getGeomScenes();
        };

        /** Used by SvfLoader to decide which fragments to load next.  */
        this.geomPacksMissingLastFrame = function () {
            return _models[0].geomPacksMissingLastFrame();
        };

        // ---------------- End of section of functions without support for multiple RenderModels

        /** Sets animation transforms for all fragments to create an "exploded view": Each fragment is displaced  
             * away from the model bbox center, so that you can distuinguish separate components. 
            *
            * If the model data provides a model hierarchy (given via model.getData().instanceTree), it is also considered for the displacement.
            * In this case, we recursively shift each object away from the center of its parent node's bbox. 
            *
            * @param {number} scale - In [0,1]. 0 means no displacement (= reset animation transforms). 
            *                                   1 means maximum displacement, where the shift distance of an object varies 
            *                                   depending on distance to model center and hierarchy level.
            */
        this.explode = function (scale) {

            if (!_models.length)
                return;

            var pt = new THREE.Vector3();

            for (var q = 0; q < _models.length; q++) {

                var model = _models[q];

                var it = model.getData().instanceTree;

                var fragList = model.getFragmentList();

                var mc = model.getVisibleBounds(true).center();


                //Input scale is in the range 0-1, where 0
                //means no displacement, and 1 maximum reasonable displacement.
                scale *= 2;

                //If we have a full part hierarchy we can use a
                //better grouping strategy when exploding
                if (it && it.nodeAccess.nodeBoxes && scale !== 0) {

                    // If scale is small (close to 0), the shift is only applied to the topmost levels of the hierarchy.
                    // With increasing s, we involve more and more hierarchy levels, i.e., children are recursively shifted 
                    // away from their parent node centers.
                    // Since explodeValue is integer, it will behave discontinous during a transition from s=0 to s=1.
                    // To keep the overall transition continuous, we use the fractional part of scaledExplodeDepth
                    // to smoothly fade-in the transition at each hierarchy level. 

                    // levels beyond explodeDepth, we stop shifting children away from their parent.
                    // 
                    var scaledExplodeDepth = scale * (it.maxDepth - 1) + 1;
                    var explodeDepth = 0 | scaledExplodeDepth;
                    var currentSegmentFraction = scaledExplodeDepth - explodeDepth;

                    var tmpBox = new Float32Array(6);

                    // Define recursive function to traverse object hierarchy. Each object is shifted away 
                    // from the bbox center of its parent.
                    //  number nodeId:   dbId of the current instanceTree node
                    //  int depth:       tracks hierarchy level (0 for root)
                    //  vec3 (cx,cy,cz): center of the parent object (after applying the displacement to the parent object) 
                    //  vec3 (ox,oy,oz): accumuled displacement from all parents on the path to root
                    (function explodeRec(nodeId, depth, cx, cy, cz, ox, oy, oz) {

                        var oscale = scale * 2; //TODO: also possibly related to depth
                        if (depth == explodeDepth)
                            oscale *= currentSegmentFraction; //smooth transition of this tree depth from non-exploded to exploded state

                        // get bbox center of this node
                        it.getNodeBox(nodeId, tmpBox);
                        var mycx = 0.5 * (tmpBox[0] + tmpBox[3]);
                        var mycy = 0.5 * (tmpBox[1] + tmpBox[4]);
                        var mycz = 0.5 * (tmpBox[2] + tmpBox[5]);

                        // The root node (depth==0) has no parent to shift away from.
                        // For child nodes with level > explodDepth, we don't apply additional displacement anymore - just pass the displacement of the parents.
                        if (depth > 0 && depth <= explodeDepth) {
                            // add displacement to move this object away from its parent's bbox center (cx, cy, cz)
                            var dx = (mycx - cx) * oscale;
                            var dy = (mycy - cy) * oscale;
                            var dz = (mycz - cz) * oscale;

                            //var omax = Math.max(dx, Math.max(dy, dz));
                            // sum up offsets: The final displacement of a node is accumulated by its own shift and 
                            // the shifts of all nodes up to the root.
                            ox += dx;
                            oy += dy;
                            oz += dz;
                        }

                        // continue recursion with child objects (if any)
                        it.enumNodeChildren(nodeId, function (dbId) {
                            explodeRec(dbId, depth + 1, mycx, mycy, mycz, ox, oy, oz);
                        }, false);

                        pt.x = ox;
                        pt.y = oy;
                        pt.z = oz;

                        // set translation as anim transform for all fragments associated with the current node
                        it.enumNodeFragments(nodeId, function (fragId) {

                            fragList.updateAnimTransform(fragId, null, null, pt);

                        }, false);

                    })(it.getRootId(), 0, mc.x, mc.y, mc.x, 0, 0, 0); // run on root to start recursion
                }
                else {
                    // Float32Array array with 6 floats per bbox.
                    var boxes = fragList.fragments.boxes;

                    for (var i = 0, iEnd = fragList.getCount() ; i < iEnd; i++) {

                        if (scale == 0) {
                            // reset to unexploded state, i.e., remove all animation transforms
                            fragList.updateAnimTransform(i);

                        } else {

                            // get start index of the bbox for fragment i. 
                            var box_offset = i * 6;

                            // get bbox center of fragment i
                            var cx = 0.5 * (boxes[box_offset] + boxes[box_offset + 3]);
                            var cy = 0.5 * (boxes[box_offset + 1] + boxes[box_offset + 4]);
                            var cz = 0.5 * (boxes[box_offset + 2] + boxes[box_offset + 5]);

                            // compute translation vector for this fragment:
                            // We shift the fragment's bbox center c=(cx,cy,cz) away from the overall model center mc,
                            // so that the distance between the two will finally be scaled up by a factor of (1.0 + scale).
                            //
                            pt.x = scale * (cx - mc.x);
                            pt.y = scale * (cy - mc.y);
                            pt.z = scale * (cz - mc.z);

                            fragList.updateAnimTransform(i, null, null, pt);
                        }
                    }
                }

            }

            this.invalidateVisibleBounds();

        };

        /** 
         *  @params  {number} timeStamp
         *  @returns {bool}   true if any of the models needs a redraw
         */
        this.update = function (timeStamp) {

            // call update for all RenderModels and track
            // if any of these needs a redraw
            var needsRedraw = false;
            for (var q = 0; q < _models.length; q++) {
                var model = _models[q];
                needsRedraw |= model.update(timeStamp);
            }
            return needsRedraw;
        };
    }


    return RenderScene;
        
});