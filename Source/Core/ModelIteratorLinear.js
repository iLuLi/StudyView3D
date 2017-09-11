define([
    './Renderer/RenderBatch',
    './Constants/DeviceType'
], function(RenderBatch, DeviceType) {
    'use strict';
    //TODO: better heuristic for group size might be needed
    //But it should be based on polygon count as well as
    //fragment count. But polygon count is not known
    //until we get the meshes later on.
    var MAX_FRAGS_PER_GROUP = 333;
    
    /**
     * All rendering and other scene related data associated with a 3D model or 2D Drawing.
     * The "linear" variant uses simple non-hierarchical linear scene traversal when rendering a frame.
     * Good for small scenes, incrementally loaded scenes, and 2D drawings where draw order matters.
     */
    function ModelIteratorLinear(renderModel) {

        var _frags = renderModel.getFragmentList();
        var fragCount = _frags.getCount();

        // index of the scene in _geomScenes that the next nextBatch() call will return.
        var _currentScene = 0;

        //Custom re-order of the fragments for optimized rendering.
        //those are indices into the immutable vizmeshes fragment list.
        //NOTE: We use the array container as reference to pass to RenderBatches, because the
        //typed array can get resized when loading data with unknown size
        var _fragOrder = [new Int32Array(fragCount)];

        //Trivial initial order
        var i;
        for (i = 0; i < fragCount; i++) {
            _fragOrder[0][i] = i;
        }

        //Create a RenderBatch for each batch of fragments.
        //We will then draw each batch in turn to get a progressive
        //effect. The number of fragments per batch should be close
        //to what we can draw in a single frame while maintaining interactivity.
        //This linear list of batches is used for 2D scenes and for 3D scenes
        //while they are loading. After load is done, the linear traversal is replaced
        //by a view-based bounding volume hierarchy traversal.

        // choose _fragsPerScene based on scene type and device
        var fragsPerScene = MAX_FRAGS_PER_GROUP;
        if (renderModel.is2d())
            fragsPerScene /= 6; //2d meshes are all fully packed, so we can't draw so many per batch.
        if (DeviceType.isMobileDevice)
            fragsPerScene /= 3; //This is tuned for ~15fps on Nexus 7.
        fragsPerScene = fragsPerScene | 0;
        var _fragsPerScene = fragsPerScene > 0 ? fragsPerScene : MAX_FRAGS_PER_GROUP;

        // Given the maximum fragCount per batch, compute the required number of batches to fit in all fragments
        var numScenes = 0 | ((fragCount + _fragsPerScene - 1) / _fragsPerScene);

        // create array with a RenderBatch per fragment group.
        // Note that this will only create all batches if the full fragCount is known in advance. Otherwise, they have to be created 
        // later via addFragment() calls.
        var _geomScenes = new Array(numScenes);
        for (i = 0; i < numScenes; i++) {
            var startIndex = i * _fragsPerScene;
            var scene = _geomScenes[i] = new RenderBatch(_frags, _fragOrder, startIndex, _fragsPerScene);
            var lastIndex = startIndex + _fragsPerScene;

            // Crop last batch at the end, so that it does not exceed the fragment count. The last batch has usually not full
            // length, unless fragCount is a multiple of 
            if (lastIndex > fragCount)
                lastIndex = fragCount;
            scene.lastItem = lastIndex;
        }


        // Only needed if the full fragment count is not known in advance.
        // For incremental loading, this method makes sure that 
        //  - fragOrder has required size 
        //  - fragOrder defines trivial orderning of all frags added so far
        //  - _geomScenes contains a batch containing the new fragment
        //
        // Assumptions: Fragments are currently added by increasing fragId. Otherwise, _geomScenes might contain null-elements,
        //              which may cause exceptions, e.g., in nextBatch() and getVisibleBounds().
        this.addFragment = function (fragId) {

            //The frag order indices array will not auto-resize (it's ArrayBuffer)
            //so we have to do it manually
            if (_fragOrder[0].length <= fragId) {
                var nlen = 2 * _fragOrder[0].length;
                if (nlen <= fragId)
                    nlen = fragId + 1;

                var ninds = new Int32Array(nlen);
                ninds.set(_fragOrder[0]);
                _fragOrder[0] = ninds;

                //We only set this when the fragment index goes
                //beyond the initial fragment size -- assuming
                //that the initial bounds passed into the RenderQueue constructor
                //is valid for the initial fragment list.
                this.visibleBoundsDirty = true;
            }
            //Note: this assumes trivial ordering
            //We cannot set/add meshes if reordering of the indices has already happened.
            //This is OK, because trivial ordering with unknown initial fragment count
            //happens only for 2D models where we preserve trivial draw order anyway.
            _fragOrder[0][fragId] = fragId;


            //Find a parent for the mesh -- in the case of SVF
            //fragments we just map fragment index to increasing
            //scene index, since fragments are already ordered
            //in the way we want to draw them
            var sceneIndex = 0 | (fragId / _fragsPerScene);
            if (_geomScenes) {
                var scene = _geomScenes[sceneIndex];
                if (!scene) {
                    // Note that it's okay that the batch may also reference fragments that were not added yet. 
                    // The RenderBatch does not require all fragments to be in memory already.
                    _geomScenes[sceneIndex] = scene = new RenderBatch(_frags, _fragOrder, sceneIndex * _fragsPerScene, _fragsPerScene);
                }
                // did scene get set reasonably?
                if (scene) {
                    // notify batch about new fragment, so that the batch updates internal state like summed bbox and material sorting
                    scene.onFragmentAdded(fragId);
                }
            }

        };

        // restart iterator
        this.reset = function () {
            _currentScene = 0;
        };

        // Returns the next RenderBatch from _geomScenes or null when reaching the end.
        this.nextBatch = function () {

            if (_currentScene == _geomScenes.length)
                return null;

            // as long as fragments are added in order of increasing id, res will never be null.
            var res = _geomScenes[_currentScene++];

            // Render importance is used to decide what to render next when using progressive rendering with multiple models. (see RenderScene.renderSome)
            // For linear iterator, is treated as equally important.
            res.renderImportance = 0;
            return res;
        };


        // Computes the summed bboxes of all batches of the iterator and writes them to the out params:
        // - visibleBounds:           instanceof THREE.Box3, bbox of all fragments excluding the ghosted ones.
        // - visibleBoundsWithHidden: instanceof THREE.Box3, bbox of all fragments 
        //
        // [HB:] BBoxes are computed without considering MESH_HIDE flag in any way, see RenderBatch.calculateBounds(). Is this intended?
        this.getVisibleBounds = function (visibleBounds, visibleBoundsWithHidden) {

            //Case where we are not using BVH

            for (var i = 0; i < _geomScenes.length; i++) {

                // make sure that the bboxes of the batch is up-to-date
                _geomScenes[i].calculateBounds();

                // sum up bbox of fragments excluding ghosted
                visibleBounds.union(_geomScenes[i].boundingBox);

                // sum up bbox of all fragments
                visibleBoundsWithHidden.union(_geomScenes[i].boundingBox);
                visibleBoundsWithHidden.union(_geomScenes[i].boundingBoxHidden);

            }

        };

        // Perform raycast on all batches. See RenderBatch.raycast() for params.
        this.rayCast = function (raycaster, intersects, dbIdFilter) {
            for (var i = 0; i < _geomScenes.length; i++) {
                _geomScenes[i].raycast(raycaster, intersects, dbIdFilter);
            }
        };
        /*
            this.getRenderProgress = function() {
                return _currentScene / _geomScenes.length;
            };
        */
        this.getSceneCount = function () {
            return _geomScenes.length;
        };

        this.getGeomScenes = function () {
            return _geomScenes;
        };

        this.done = function () {
            return _currentScene === _geomScenes.length;
        };


    }

    return ModelIteratorLinear;
});