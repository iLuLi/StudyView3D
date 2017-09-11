define([
    './Renderer/RenderBatch',
    './Constants/Global'
], function(RenderBatch, Privite_Global) {
    'use strict';
    function ModelIteratorBVH() {
        
        var _frags;

        var _bvhNodes = null;
        var _bvhFragOrder = null;
        var _bvhScenes = null;
        var _bvhNodeQueue = null, _bvhNodeAreas = null, _bvhHead, _bvhTail;
        var _bvhLIFO = 1;
        var _bvhPrioritizeScreenSize = true;
        var _bvhOpaqueDone = false;
        var _tmpBox = new THREE.Box3();
        var _tmpBox2 = new THREE.Box3();

        var _frustum;
        var _done = false;


        this.initialize = function (renderModelLinear, nodes, primitives, options) {

            _frags = renderModelLinear.getFragmentList();

            if (options && options.hasOwnProperty("prioritize_screen_size")) {
                _bvhPrioritizeScreenSize = options.prioritize_screen_size;
            }

            _bvhFragOrder = primitives;
            _bvhScenes = new Array(nodes.nodeCount);
            _bvhNodes = nodes;
            _bvhNodeQueue = new Int32Array(nodes.nodeCount + 1);
            _bvhNodeAreas = new Float32Array(nodes.nodeCount);

            for (var i = 0; i < nodes.nodeCount; i++) {
                var primCount = nodes.getPrimCount(i);
                if (primCount) {
                    _bvhScenes[i] = new RenderBatch(_frags, _bvhFragOrder, nodes.getPrimStart(i), primCount);
                    //Those are set manually, because we will not be adding fragments to the
                    //render batch one by one -- the fragments are already loaded.
                    _bvhScenes[i].lastItem = _bvhScenes[i].start + primCount;
                    _bvhScenes[i].numAdded = primCount;
                    if (nodes.getFlags(i) & 8) {
                        _bvhScenes[i].sortObjects = true; //scene contains transparent objects
                    }
                    nodes.getBoxThree(i, _bvhScenes[i].boundingBox);
                }
            }

        };

        // note: fragId and mesh are not used in this function
        this.addFragment = function (fragId, mesh) {
        };


        this.reset = function (frustum) {
            _frustum = frustum;
            _bvhHead = 0; _bvhTail = 0;
            _bvhNodeQueue[_bvhTail++] = 0;
            _bvhOpaqueDone = false;
            _done = false;
        };


        //Used to insert nodes into the (sorted) render queue based on
        //a heuristic other than strict front to back or back to front order.
        function insertNode(idx) {

            //This is basically a single sub-loop of an insertion sort.

            var val = _bvhNodeAreas[idx];
            var j = _bvhTail;

            if (_bvhLIFO) {
                while (j > _bvhHead && _bvhNodeAreas[_bvhNodeQueue[j - 1]] > val) {
                    _bvhNodeQueue[j] = _bvhNodeQueue[j - 1];
                    j--;
                }
            } else {
                while (j > _bvhHead && _bvhNodeAreas[_bvhNodeQueue[j - 1]] < val) {
                    _bvhNodeQueue[j] = _bvhNodeQueue[j - 1];
                    j--;
                }
            }

            _bvhNodeQueue[j] = idx;
            _bvhTail++;
        }

        this.nextBatch = function () {

            if (!_bvhOpaqueDone && _bvhHead === _bvhTail) {
                //If we are done with the opaque nodes, queue the transparent ones
                //before processing the contents of the last opaque node
                _bvhNodeQueue[_bvhTail++] = 1; //root of transparent subtree is at index 1
                _bvhOpaqueDone = true;
            }

            while (_bvhHead !== _bvhTail) {

                var nodeIdx = (_bvhLIFO || _bvhOpaqueDone) ? _bvhNodeQueue[--_bvhTail] : _bvhNodeQueue[_bvhHead++];

                _bvhNodes.getBoxThree(nodeIdx, _tmpBox);
                var intersects = _frustum.intersectsBox(_tmpBox);

                //Node is entirely outside, go on to the next node
                if (intersects !== Privite_Global.OUTSIDE) {
                    var child = _bvhNodes.getLeftChild(nodeIdx);
                    var isInner = (child !== -1);
                    var firstIdx, secondIdx;

                    //Is it inner node? Add children for processing.
                    if (isInner) {
                        var flags = _bvhNodes.getFlags(nodeIdx);
                        var reverseAxis = _frustum.viewDir[flags & 3] < 0 ? 1 : 0;
                        var firstChild = (flags >> 2) & 1;
                        var transparent = (flags >> 3) & 1;
                        var depthFirst = (_bvhLIFO || _bvhOpaqueDone) ? 1 : 0;
                        var areaFirst = 0, areaSecond = 0;

                        if (_bvhPrioritizeScreenSize && !_bvhOpaqueDone) {

                            //If traversing based on visible screen area, we have to
                            //compute the area for each child and insert them into
                            //the queue accordingly.

                            firstIdx = child + firstChild;
                            secondIdx = child + 1 - firstChild;

                            _bvhNodes.getBoxThree(firstIdx, _tmpBox);
                            _bvhNodeAreas[firstIdx] = areaFirst = _frustum.projectedArea(_tmpBox);
                            _bvhNodes.getBoxThree(secondIdx, _tmpBox);
                            _bvhNodeAreas[secondIdx] = areaSecond = _frustum.projectedArea(_tmpBox);

                            //insert each node in the right place based on screen area,
                            //so that the queue (or stack, if LIFO traversal) is kept sorted
                            //at every step of the way
                            if (areaFirst > 0)
                                insertNode(firstIdx);

                            if (areaSecond > 0)
                                insertNode(secondIdx);
                        } else {

                            //Traversal by view direction.

                            //Reverse order if looking in the negative of the child split axis
                            //Reverse order if we are traversing last first
                            //If node contains transparent objects, then reverse the result so we traverse back to front.
                            //In other words, reverse the order if an odd number of flags are true.
                            if (reverseAxis ^ depthFirst ^ transparent)
                                firstChild = 1 - firstChild;

                            firstIdx = child + firstChild;
                            secondIdx = child + 1 - firstChild;

                            _bvhNodeQueue[_bvhTail++] = firstIdx;
                            _bvhNodeAreas[firstIdx] = -1; //TODO: This has to be something based on camera distance
                            //so that we can draw transparent back to front when multiple models are mixed

                            _bvhNodeQueue[_bvhTail++] = secondIdx;
                            _bvhNodeAreas[secondIdx] = -1;
                        }

                    }

                    //Are there graphics in the node? Then return its scene.
                    var prims = _bvhNodes.getPrimCount(nodeIdx);
                    if (prims !== 0) {
                        var scene = _bvhScenes[nodeIdx];

                        scene.renderImportance = _frustum.projectedArea(scene.boundingBox);

                        //NOTE: Frustum culling for the RenderBatch is done in
                        //RenderBatch.applyVisibility, so we don't need it here.
                        //Just return the batch and it will get cull checked later.
                        //TODO: May be we want to move the check to here, but then the linear iterator will also need to start checking.
                        /*
                            var whichBox = (_drawMode === RENDER_HIDDEN) ? scene.boundingBoxHidden : scene.boundingBox;
    
                            //If the geometry is attached to an inner node and we know
                            //it's not fully contained, we can narrow down the intersection
                            //by checking the box of just the inner node's geometry.
                            //The check for the node box itself also includes the children so it could be bigger.
                            if (intersects !== CONTAINS && isInner)
                            intersects = _frustum.intersectsBox(whichBox);
    
                            //Turn off frustum culling for the batch if it's fully contained
                            scene.frustumCulled = (intersects !== avp.CONTAINS);
    
                            if (intersects !== avp.OUTSIDE)
                            return scene;
                            */

                        return scene;
                    }
                }

                if (!_bvhOpaqueDone && _bvhHead === _bvhTail) {
                    //If we are done with the opaque nodes, queue the transparent ones
                    //before processing the contents of the last opaque node
                    _bvhNodeQueue[_bvhTail++] = 1; //root of transparent subtree is at index 1
                    _bvhOpaqueDone = true;
                }

            }

            _done = true;
            return null;
        };


        function updateBVHRec(nodeIdx) {

            var child = _bvhNodes.getLeftChild(nodeIdx);

            if (child !== -1) {
                updateBVHRec(child);
                updateBVHRec(child + 1);
            }

            _tmpBox.makeEmpty();

            if (child !== -1) {
                _bvhNodes.getBoxThree(child, _tmpBox2);
                _tmpBox.union(_tmpBox2);

                _bvhNodes.getBoxThree(child + 1, _tmpBox2);
                _tmpBox.union(_tmpBox2);
            }

            var prims = _bvhNodes.getPrimCount(nodeIdx);
            if (prims) {
                _tmpBox.union(_bvhScenes[nodeIdx].boundingBox);
                _tmpBox.union(_bvhScenes[nodeIdx].boundingBoxHidden);
            }

            _bvhNodes.setBoxThree(nodeIdx, _tmpBox);
        }

        this.getVisibleBounds = function (visibleBounds, visibleBoundsWithHidden) {

            for (var i = 0; i < _bvhScenes.length; i++) {

                var s = _bvhScenes[i];

                if (!s)
                    continue;

                s.calculateBounds();

                visibleBounds.union(s.boundingBox);

                visibleBoundsWithHidden.union(s.boundingBox);
                visibleBoundsWithHidden.union(s.boundingBoxHidden);
            }

            //Also update all bounding volume tree nodes' bounds.
            //If objects move too much this will make the BVH less effective.
            //However, this only happens during explode or animation, so it shouldn't
            //be an issue. We can always rebuild the BVH in case objects really move a lot.
            updateBVHRec(0); //opaque root
            updateBVHRec(1); //transparent root

        };

        this.rayCast = function (raycaster, intersects, dbIdFilter) {

            var nodeStack = [1, 0];
            var pt = new THREE.Vector3();

            while (nodeStack.length) {
                var nodeIdx = nodeStack.pop();

                _bvhNodes.getBoxThree(nodeIdx, _tmpBox);
                var xPt = raycaster.ray.intersectBox(_tmpBox, pt);

                if (xPt === null)
                    continue;

                var child = _bvhNodes.getLeftChild(nodeIdx);
                if (child !== -1) {
                    nodeStack.push(child);
                    nodeStack.push(child + 1);
                }

                var prims = _bvhNodes.getPrimCount(nodeIdx);
                if (prims !== 0) {
                    var scene = _bvhScenes[nodeIdx];
                    scene.raycast(raycaster, intersects, dbIdFilter);
                }
            }

        };
        /*
            this.getRenderProgress = function() {
                return _renderCounter / _bvhScenes.length;
            };
        */
        this.getSceneCount = function () {
            return _bvhScenes.length;
        };

        this.getGeomScenes = function () {
            return _bvhScenes;
        };

        this.done = function () {
            return _done;
        };

    }

    return ModelIteratorBVH;
});