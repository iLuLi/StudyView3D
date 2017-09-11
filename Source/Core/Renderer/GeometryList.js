define([
    '../Logger',
    '../Constants/Global'
], function(Logger, Global) {
    'use strict';
    /** @constructor
     * Maintains a list of buffer geometries and running totals of their memory usage, etc.
     * Each geometry gets an integer ID to be used as reference in packed fragment lists.
     */
    function GeometryList(model) { // model: instanceof RenderModel (required)
        
        // array of LmvBufferGeometry instances. Indexed by svfid.
        this.geoms = [null]; //keep index 0 reserved for invalid id

        this.numGeomsInMemory = 0; // total number of geoms added via addGeometry(..) (may be <this.geoms.length)
        this.geomMemory = 0; // total memory in bytes of all geoms 
        this.gpuMeshMemory = 0; // total memory in bytes of all geoms, exluding those that we draw from system memory
        this.gpuNumMeshes = 0; // total number of geoms etries that we fully upload to GPU for drawing
        this.geomPolyCount = 0; // summed number of polygons, where geometries with mulitple instances are counted only once.
        this.instancePolyCount = 0; // summed number of polygons, counted per instance
        this.is2d = model.is2d();

        this.svf = model.getData(); // Svf package (see svf/Package.js)
        var numObjects = this.svf.geomMetadata ? this.svf.geomMetadata.primCounts.length : 0;

        // 6 floats per geometry
        this.geomBoxes = new Float32Array(Math.max(1, numObjects) * 6);

        // Disable streaming for sufficiently small models (load all at once instead)
        // [HB:] I think this section has no effect atm, because it sets this.svf.disableStreaming instead of this.disableStreaming
        if (this.svf.packFileTotalSize) {

            //In pack files, primitive indices use 4 byte integers,
            //while we use 2 byte integers for rendering, so make this
            //correction when estimating GPU usage for geometry
            var estimatedGPUMem = this.svf.packFileTotalSize - this.svf.primitiveCount * 3 * 2;


            //If the model is certain to be below a certain size,
            //we will skip the heuristics that upload some meshes to
            //GPU and keep other in system mem, and just push it all to the GPU.
            if (estimatedGPUMem <= Global.GPU_MEMORY_LIMIT &&
                numObjects < Global.GPU_OBJECT_LIMIT)
                this.svf.disableStreaming = true;
        }

    }

    GeometryList.prototype.getGeometry = function (svfid) {
        return this.geoms[svfid];
    };

    /**
     * Stores geometry in this.geoms, updates overall GPU/CPU statistics (this.geometry etc.),
     * changes the geometry object:
     *      - Sets geometry.streamingDraw/streamingIndex (to control whether to draw the mesh from system mem or GPU)
     *      - Sets geometry.svfid, so that each geom knows its index.
     *      - Deletes the bbox and bsphere to safe memory
     * Assumptions:
     *      - It is not expected to be called multiple times for the same svfid. This would mess up some statistics.
     * @param {LmvBufferGeometry} geometry - Must not be null. A geometry cannot be added
     *      to more than one GeometryList. (see below why)
     * @param {number} numInstances - default 1 if undef.
     * @param {number} svfid - Geometry will be stored in this.geoms[svfid].
     *      If undef or <=0, geometry is appended at the end of this.geoms.
     */
    GeometryList.prototype.addGeometry = function (geometry, numInstances, svfid) {

        // Define GPU memory limits for heuristics below
        var GPU_MEMORY_LOW = Global.GPU_MEMORY_LIMIT;
        var GPU_MEMORY_HIGH = 2 * GPU_MEMORY_LOW;
        var GPU_MESH_MAX = Global.GPU_OBJECT_LIMIT;
        if (this.isf2d)
            GPU_MEMORY_HIGH *= 2; //there isn't much in terms of textures in 2d drawings, so we can afford to more room for geometry

        //this.disableStreaming = true;

        //Heuristically determine if we want to load this mesh onto the GPU
        //or use streaming draw from system memory
        if (this.disableStreaming ||
            (this.gpuMeshMemory < GPU_MEMORY_LOW && this.geoms.length < GPU_MESH_MAX)) {
            //We are below the lower limits, so the mesh automatically is
            //assigned to retained mode
            geometry.streamingDraw = false;
            geometry.streamingIndex = false;
        }
        else if (this.gpuMeshMemory >= GPU_MEMORY_HIGH) {
            //We are above the upper limit, so mesh is automatically
            //assigned to streaming draw
            geometry.streamingDraw = true;
            geometry.streamingIndex = true;
        }
        else {
            //Between the lower and upper limits,
            //Score mesh importance based on its size
            //and number of instances it has. If the score
            //is high, we will prefer to put the mesh on the GPU
            //so that we don't schlep it across the bus all the time.
            var weightScore;

            if (!this.is2d) {
                weightScore = geometry.byteSize * (numInstances || 1);
            } else {
                //In the case of 2D, there are no instances, so we just keep
                //piling into the GPU until we reach the "high" mark.
                weightScore = 100001;
            }

            if (weightScore < 100000) {
                geometry.streamingDraw = true;
                geometry.streamingIndex = true;
            }
        }

        // track overall GPU workload
        if (!geometry.streamingDraw) {
            this.gpuMeshMemory += geometry.byteSize;
            this.gpuNumMeshes += 1;
        }

        this.numGeomsInMemory++;

        // if no svfid is defined
        if (svfid === undefined || svfid <= 0)
            svfid = this.geoms.length;

        // store geometry (may increase array length)
        this.geoms[svfid] = geometry;

        // resize this.geombboxes if necessary
        if (this.geomBoxes.length / 6 < this.geoms.length) {
            var nb = new Float32Array(6 * (this.geoms.length * 3 / 2));
            nb.set(this.geomBoxes);
            this.geomBoxes = nb;
        }

        // copy geometry bbox to this.geomBoxes
        var bb = geometry.boundingBox;
        this.geomBoxes[svfid * 6] = bb.min.x;
        this.geomBoxes[svfid * 6 + 1] = bb.min.y;
        this.geomBoxes[svfid * 6 + 2] = bb.min.z;
        this.geomBoxes[svfid * 6 + 3] = bb.max.x;
        this.geomBoxes[svfid * 6 + 4] = bb.max.y;
        this.geomBoxes[svfid * 6 + 5] = bb.max.z;

        //Free the bbx objects if we don't want them.
        if (Global.memoryOptimizedLoading && !this.is2d) {
            geometry.boundingBox = null;
            geometry.boundingSphere = null;
        }

        // track system-side memory
        this.geomMemory += geometry.byteSize;

        // track polygon count
        //TODO: Asssignment into the svf is temporary until the dependencies
        //are unentangled
        var ib = geometry.attributes['index'].array || geometry.ib;
        var polyCount = ib.length / 3;
        this.svf.geomPolyCount = this.geomPolyCount += polyCount;
        this.instancePolyCount += polyCount * (numInstances || 1);

        geometry.svfid = svfid;

        return svfid;
    };

    /**
     * Removes the geometry with svfid 'idx' from the list.
     * Note: Unlike addGeometry, this method only updates this.numGeomsInMemory. All other statistics keep the same.
     * @param {int} idx - Geometry ID.
     * @returns {int} Size of the removed geometry, or 0.
     */
    GeometryList.prototype.removeGeometry = function (idx) {

        // if there is no geom assigned, just return 0
        var geometry = this.getGeometry(idx);
        if (!geometry) {
            return 0;
        }

        // remove geometry from the list
        this.geoms[idx] = null;

        // decrease mesh counter
        this.numGeomsInMemory--;

        return geometry.byteSize;
    };

    /**
     * Returns bounding box of a geometry.
     * @param {number} geomid - Geometry ID.
     * @param {THREE.Box3|LmvBox3} dst - Set to empty is there is no geometry of this id.
     */
    GeometryList.prototype.getModelBox = function (geomid, dst) {

        // return empty box if there is no geom
        if (!this.geoms[geomid]) {
            dst.makeEmpty();
            return;
        }

        // extract bbox values from Float32Array this.geomboxes
        var off = geomid * 6;
        var bb = this.geomBoxes;
        dst.min.x = bb[off];
        dst.min.y = bb[off + 1];
        dst.min.z = bb[off + 2];
        dst.max.x = bb[off + 3];
        dst.max.y = bb[off + 4];
        dst.max.z = bb[off + 5];
    };

    // Tell renderer to release all GPU buffers. 
    //  renderer: instaneof FireFlyWebGLRenderer
    GeometryList.prototype.dispose = function (renderer) {

        if (!renderer)
            return;

        for (var i = 0, iEnd = this.geoms.length; i < iEnd; i++)
            if (this.geoms[i])
                renderer.deallocateGeometry(this.geoms[i]);
    };

    GeometryList.prototype.printStats = function () {

        Logger.info("Total geometry size: " + (this.geomMemory / (1024 * 1024)) + " MB");
        Logger.info("Number of meshes: " + this.geoms.length);
        Logger.info("Num Meshes on GPU: " + this.gpuNumMeshes);
        Logger.info("Net GPU geom memory used: " + this.gpuMeshMemory);

    };

    return GeometryList;
});