define([
    './Global',
    '../Logger'
], function(Privite_Global, Logger) {
    'use strict';


    var //visibility/highlight bitmask flags
        //NOTE: This is confusing and it should be fixed, but when the MESH_VISIBLE bit is off, the mesh
        //will draw in ghosted mode. To completely skip drawing a mesh, set the HIDE flag.
        MESH_VISIBLE = Privite_Global.MESH_VISIBLE = 1,
        MESH_HIGHLIGHTED = Privite_Global.MESH_HIGHLIGHTED = 2,
        MESH_HIDE = Privite_Global.MESH_HIDE = 4,
        MESH_ISLINE = Privite_Global.MESH_ISLINE = 8,
        MESH_MOVED = Privite_Global.MESH_MOVED = 16,   // indicates if an animation matrix is set
        MESH_TRAVERSED = Privite_Global.MESH_TRAVERSED = 0x20, // only used for paging: drawn fragments are tagged and then skipped by forEach() until the flag is being reset (e.g. on scene/camera changes)
        MESH_RENDERFLAG = Privite_Global.MESH_RENDERFLAG = 0x80;
    /**
     * @constructor
     * Represents the full list of all geometry instances associated with
     * a particular model. The order in the list is 1:1 with fragment list
     * in the source LMV/SVF package file.
     * @param {Object} fragments - Fragment data parsed from an SVF file.
     * @param {GeometryList} geoms - Geometry data parsed from an SVF file.
     * @param {SvfLoader} loader - SVF loader used for on-demand loading.
     */
    function FragmentList(model, loader) {
        
        this.model = model;
        this.fragments = model.getData().fragments;
        this.svfLoader = loader;
        this.geoms = model.getGeometryList();

        //3D SVF files are of known initial size and known world bounds.
        //2D F2D files start out with nothing and get filled up as we load.
        this.isFixedSize = this.fragments.length > 0;
        if (this.isFixedSize) {
            this.boxes = this.fragments.boxes;       // Float32Array, stores Boxes as 6 floats per fragment (after applying mesh matrix)
            this.transforms = this.fragments.transforms;  // Float32Array, stores transforms as 12 floats per fragment (Matrix4 with omitted last row)
            this.useThreeMesh = !Privite_Global.memoryOptimizedLoading;
        } else {
            this.boxes = null;
            this.transforms = null;
            this.useThreeMesh = true;
        }

        // initial length for arrays of meshes/geometries/flags
        var initialSize = this.fragments.length;
        if (initialSize <= 0)
            initialSize = 1;

        this.vizflags = new Uint8Array(initialSize); // visibility/highlight mode flags

        //This will be the list of all mesh instances in the model.
        //Corresponds to all fragments in the case of SVF.
        if (this.useThreeMesh)
            this.vizmeshes = new Array(initialSize);
        this.geomids = new Int32Array(initialSize); // geomid per fragId. geomids are resolved by this.geoms.GetGeometry(geomid) to obtain LmvBufferGeometry.
        this.materialids = new Int32Array(initialSize); // material per fragId. matIds  are resolved by this.materialmap[matId] 
        this.materialmap = {};                          // map from material ids to THREE.ShaderMaterial instances

        // theming (coloring based on id)
        this.db2ThemingColor = []; // empty if no theming is applied. A theming color db2ThemingColor[dbId] is stored as THREE.Vector4 with values in [0,1].
        this.originalColors = []; // if vizmesh[i] has modified vertex-colors  due to theming,  originalColors[i]  stores a copy of the original colors.
        this.themingOrGhostingNeedsUpdate = []; // indicates if vertex-colors of vizmesh[i] needs to be updated based on recent theming or ghosting changes.

        // ghosting for 2d objects: A ghosted object is reduced in transparency and blended with the pageColor. This
        this.dbIdIsGhosted = [];
        this.originalLayerVp = []; // if vizmesh[i] has modified layerVb coords due to ghosting, originalLayerVp[i] stores a copy of the original layerVp.

        // used for on-demand loading
        this.reachLimit = false; // Controlled from outside when maximum number of geometries 
        // in memory is reached (see RenderModel.pageOutIfNeeded). If true, load-requests to svfLoader are blocked.
        this.traversedGeom = [];    // Array of geometryIds collected in RenderBatch.forEach if avp.pageOutGeometryEnabled
        // Used in RenderModel to page-out geometry that has been rendered already.
        this.culledGeom = [];    // Array of geometryIds that have been culled in the current frame and are not paged out yet. 
        // Filled by RenderBatch.applyVisibility. Used by RenderModel for paging decisions 
        // (see RenderModel.pageOutIfNeeded)
        this.geomidsmap = {};    // Used only for geometry used by multiple instances, geomIds[geomId]==0 for single-instance geometry.
        // Maps a geometry id to an object {n: numInstances, t: numTraversedInstances}. Elems are added by SvfLoader.
        // The .t property of each element is updated per frame in RenderBatch.forEach. 
        // If t reaches n, the geom is added to traversedGeom. 

        this.animxforms = null; // If animation is used, this is a Float32Array storing 10 floats per fragment to describe scale (3), rotation (4), and translation (3).
        // See this.updateAnimTransform.

        for (var i = 0; i < initialSize; i++) {
            this.vizflags[i] = 1; //MESH_VISIBLE initially
            this.geomids[i] = -1; //0 is a valid geom index, so use -1 as starting value
        }

        this.allVisible = true;        // see this.areAllVisible(..). Indicates if MESH_VISIBLE flag is set for all meshes (i.e., not considering culling)
        this.allVisibleDirty = false;       // if false, this.allVisible is outdated and must be recomputed in this.areAllVisible.
        this.nextAvailableFragID = initialSize;
    }

    // [HB:] This method is only used in RenderModel.setFragment(), which seems to be not called at all. Can we remove this?
    //       (including the nextAvailableFragID member and RenderModel.setFragment).
    FragmentList.prototype.getNextAvailableFragmentId = function () {
        return this.nextAvailableFragID++;
    };

    // [HB:] When does this method ever return true? vizflags is resized in SetMesh, which only used in RenderModel.activateFragment and 
    //       RenderModel.setFragment (never called). RenderModel.activateFragment(..) is only used by loaders when new fragments have been loaded.
    //       However, for SvfLoader, fragments.length is always the full fragments count and for F2D, new stuff is first added to fragments, then
    //       to VisFlags. 
    //       Maybe this should actually be a "<" and is only relevant for F2D case?
    FragmentList.prototype.fragmentsHaveBeenAdded = function () {
        return this.vizflags.length > this.fragments.length;
    };

    // Returns undefined if fragId has no material 
    FragmentList.prototype.getSvfMaterialId = function (fragId) {
        var mat = this.getMaterial(fragId);
        return mat ? mat.svfMatId : undefined;
    };

    // Requests the geometry of a fragment for loading, unless it is already in memory or the request limit is reached.
    // If already in memory, it just returns the geometry directly.
    FragmentList.prototype.requireGeometry = function (fragId) {
        var geom = null;
        var geomId = this.geomids[fragId];
        if (geomId >= 0) {
            // A valid geometry id, then get corresponding geometry
            geom = this.geoms.getGeometry(geomId);
        }

        if (geom == null && !this.reachLimit) {
            // Request to load this geometry.
            var packId = this.fragments.packIds[fragId];
            this.svfLoader.loadGeometryPackOnDemand(packId);
        }

        return geom;
    };

    /**
     * Set mesh for a fragment, replacing any temporary previous one.
     * @param {number} fragId - Fragment ID
     * @param {Object} meshinfo - Object as defined in Viewer3DImpl.setupMesh(..). Contains:
     *      geometry: instanceof LmvBufferGeometry
     *      matrix:   instanceof THREE.Matrix4
     *      isLine:   bool to mark line geometry
     *      is2D:     bool to indicate 2D geometry (e.g., set by F2DLoader) 
     * @param {bool} updateFragmentData - If true, this.bbox and this.transforms is also updated for this fragment.
     *      Only allowed if this.isFixedSize==true. (otherwise, this.boxes and this.transforms is null)
     */
    FragmentList.prototype.setMesh = function (fragId, meshInfo, updateFragmentData) {

        //Remove any temporary geometry we used for the fragment
        //while it was loading
        if (this.vizmeshes) {
            var oldGeom = this.vizmeshes[fragId];
            if (oldGeom && oldGeom.parent) {
                oldGeom.parent.remove(oldGeom);
            }
        }

        //The various data arrays need to be re-sized if the fragment is new
        //so we have to do it manually in case this happens. 
        if (this.vizflags.length <= fragId) {

            // Gradually should only used if isFixedSize is false (as used for F2D geometry)
            if (this.isFixedSize) {
                Logger.warn("Attempting to resize a fragments list that was initialized with fixed data. This will have a performance impact.");
                this.isFixedSize = false;
            }

            // determine new length of all per-fragmentId arrays
            var nlen = Math.ceil(1.5 * this.vizflags.length);
            if (this.useThreeMesh && nlen < this.vizmeshes.length)
                nlen = this.vizmeshes.length;

            // re-allocate vizflags
            var nflags = new Uint8Array(nlen);
            nflags.set(this.vizflags);
            this.vizflags = nflags;

            // re-allocate other per-fragmentId arrays...

            if (this.transforms) {
                var ntransforms = new Float32Array(nlen * 12);
                ntransforms.set(this.transforms);
                this.transforms = ntransforms;
            }

            if (this.boxes) {
                var nboxes = new Float32Array(nlen * 6);
                nboxes.set(this.boxes);
                this.boxes = nboxes;
            }

            if (this.geomids) {
                var nids = new Int32Array(nlen);
                nids.set(this.geomids);
                this.geomids = nids;

            }

            if (this.materialids) {
                var nmids = new Int32Array(nlen);
                nmids.set(this.materialids);
                this.materialids = nmids;
            }
        }

        //Remember the mesh in the frag->viz mesh array
        if (this.useThreeMesh) {
            var mesh = new THREE.Mesh(meshInfo.geometry, meshInfo.material);

            // Copy matrix to mesh.matrix and mesh.matrixWorld
            // [HB:] Why copying twice?
            if (meshInfo.matrix) {
                if (mesh.matrix) {
                    mesh.matrix.copy(meshInfo.matrix);
                }
                mesh.matrixWorld.copy(meshInfo.matrix);
            }

            mesh.is2d = meshInfo.is2d;
            mesh.isLine = meshInfo.isLine;

            // If we would leave that true, THREE.js would call UpdateMatrix() for this mesh and 
            // overwrite the matrix with another one computed by position, scale, and quaternion.
            mesh.matrixAutoUpdate = false;

            //Add the mesh to the render group for this fragment
            //Note each render group renders potentially many fragments.
            mesh.frustumCulled = false; //we do our own culling in RenderQueue, the renderer doesn't need to

            // keep fragId and dbId
            mesh.fragId = fragId;
            mesh.dbId = this.fragments.fragId2dbId[fragId] | 0;
            mesh.modelId = this.model.getModelId();

            // cache the mesh in this.vizmeshes
            this.vizmeshes[fragId] = mesh;

        } else {
            // When not using THREE.Mesh, store ids of LmvBufferGeometry and material instead
            this.geomids[fragId] = meshInfo.geometry.svfid;
            this.materialids[fragId] = meshInfo.material.id;

            // add material to the map (if not known already)
            if (!this.materialmap[meshInfo.material.id])
                this.materialmap[meshInfo.material.id] = meshInfo.material;
        }


        this.vizflags[fragId] = 1 | (meshInfo.isLine ? MESH_ISLINE : 0); // 1 = visible, but not highlighted

        if (updateFragmentData) {
            // Update transform and bb
            var transform = meshInfo.matrix;

            // Copy the transform to the fraglist array
            // We store in column-major order like the elements of the Matrix4, but skip row 3.
            var i = fragId * 12;
            var cur = transform.elements;
            var orig = this.transforms;
            orig[i] = cur[0];
            orig[i + 1] = cur[1];
            orig[i + 2] = cur[2];
            orig[i + 3] = cur[4];
            orig[i + 4] = cur[5];
            orig[i + 5] = cur[6];
            orig[i + 6] = cur[8];
            orig[i + 7] = cur[9];
            orig[i + 8] = cur[10];
            orig[i + 9] = cur[12];
            orig[i + 10] = cur[13];
            orig[i + 11] = cur[14];


            // Transform the local BB to world
            var b = new THREE.Box3();
            if (meshInfo.geometry && meshInfo.geometry.boundingBox) {
                b.copy(meshInfo.geometry.boundingBox);
            } else {
                this.geoms.getModelBox(this.geomids[fragId], b);
            }
            b.applyMatrix4(transform);

            // Write bounding box to this.boxes
            var boffset = fragId * 6;
            var bb = this.boxes;
            bb[boffset] = b.min.x;
            bb[boffset + 1] = b.min.y;
            bb[boffset + 2] = b.min.z;
            bb[boffset + 3] = b.max.x;
            bb[boffset + 4] = b.max.y;
            bb[boffset + 5] = b.max.z;
        }
    };


    FragmentList.prototype.isFlagSet = function (fragId, flag) {
        return !!(this.vizflags[fragId] & flag);
    };

    /**
     * Set/unset flag of a fragment.
     * Note: Changing MESH_VISIBLE requires to update allVisibleDirty as well => Use setVisibility() for this case.
     * @param {number} fragId - Fragment ID.
     * @param {number} flag - Must be one of the flags defined at the beginning of this file, e.g., MESH_HIGHLIGHTED.
     * @returns {bool} False if nothing changed.
     */
    FragmentList.prototype.setFlagFragment = function (fragId, flag, value) {

        // If flag is already defined and has this value, just return false.
        var old = this.vizflags[fragId];
        if (!!(old & flag) == value) // "!!" casts to boolean
            return false;

        // set or unset flag
        if (value)
            this.vizflags[fragId] = old | flag;
        else
            this.vizflags[fragId] = old & ~flag;

        return true;
    };

    /**
     * Set/unset flag for all fragments, e.g. setFlagGlobal(MESH_VISIBLE, true);
     * Note: Changing MESH_VISIBLE requires to update allVisibleDirty as well => use setAllVisibility() for this case.
     * @param {number} flag - Must be one of the flags defined at the beginning of this file, e.g., MESH_HIGHLIGHTED.
     * @param {bool} value - Value to be set to the flag
     */
    FragmentList.prototype.setFlagGlobal = function (flag, value) {
        var vizflags = this.vizflags;
        var i = 0, iEnd = vizflags.length;
        if (value) {
            for (; i < iEnd; i++) {
                vizflags[i] = vizflags[i] | flag;
            }
        } else {
            var notflag = ~flag;
            for (; i < iEnd; i++) {
                vizflags[i] = vizflags[i] & notflag;
            }
        }
    };

    /**
     * Marks all lines as visible or hidden.
     * Works like this.setFlagGlobal(MESH_HIDE, hide), but only affects fragments with MESH_ISLINE flag.
     * @param {bool} hide - Desired visibility status.
     */
    FragmentList.prototype.hideLines = function (hide) {

        var flag = MESH_HIDE;

        var vizflags = this.vizflags;
        var i = 0, iEnd = vizflags.length;
        if (hide) {
            for (; i < iEnd; i++) {
                if (vizflags[i] & MESH_ISLINE)
                    vizflags[i] = vizflags[i] | flag;
            }
        } else {
            var notflag = ~flag;
            for (; i < iEnd; i++) {
                if (vizflags[i] & MESH_ISLINE)
                    vizflags[i] = vizflags[i] & notflag;
            }
        }

        // Mark allVisible as outdated        
        this.allVisibleDirty = true;
    };

    /**
     * Checks visibility of a fragment.
     * [HB:] Why do we also return true if MESH_HIDE is set?
     * @param {number} frag - Fragment ID.
     * @returns {bool} True if the fragment is visible and not highlighted.
     */
    FragmentList.prototype.isFragVisible = function (frag) {
        return (this.vizflags[frag] & 3/*MESH_VISIBLE|MESH_HIGHLIGHTED*/) == 1;
    };

    FragmentList.prototype.isFragOff = function (frag) {
        return !!(this.vizflags[frag] & MESH_HIDE);
    };

    FragmentList.prototype.isLine = function (frag) {
        return !!(this.vizflags[frag] & MESH_ISLINE/*MESH_VISIBLE|MESH_HIGHLIGHTED*/);
    };


    // [HB:] This method does not consider the MESH_HIDE flag, but this.setFragOff seems to expect this, because it sets allVisibleDirty.
    //       Is this a bug?
    FragmentList.prototype.areAllVisible = function () {

        // update allVisible if any flags have changed
        if (this.allVisibleDirty) {

            // allVisible <=> MESH_VISIBLE is set for all fragments
            var vizflags = this.vizflags;
            var allVisible = true;
            for (var i = 0, iEnd = vizflags.length; i < iEnd; i++) {
                if ((vizflags[i] & 1/*MESH_VISIBLE*/) === 0) {
                    allVisible = false;
                    break;
                }
            }

            this.allVisible = allVisible;
            this.allVisibleDirty = false;
        }

        return this.allVisible;
    };

    // Swaps r/b channels in a THREE.Color object.
    function swapRBChannels(color) {
        var tmp = color.r;
        color.r = color.b;
        color.b = tmp;
        return color;
    }

    /** Linear interpolation between original color and theming color based on theming intensity.
     * @param origColor    {number}        original uint32 color from vertex-buffer. alpha is vertex-opacity
     * @param themingColor {THREE.Vector4} theming color as vec4f. Channels are (r,g,b,a) where alpha is theming intensity.
     * @returns finalColor {number}        final color as uint32
     */
    var applyThemingColorAndGhosting = (function () {
        var tmp1 = null;
        var tmp2 = null;
        var rgbMask = parseInt("00FFFFFF", 16);
        var alphaMask = parseInt("FF000000", 16);
        return function (origColor, themingColor) {
            if (!tmp1) {
                tmp1 = new THREE.Color();
                tmp2 = new THREE.Color();
            }

            tmp1.set(origColor & rgbMask);

            // THREE.Color denotes uint color in BGRA order (i.e., Blue in the lowest byte).
            // In the vertex-buffer, we use RGBA - so we have to swap when converting between these two.
            swapRBChannels(tmp1);

            // set tmp2 to theming color
            tmp2.setRGB(themingColor.x, themingColor.y, themingColor.z);

            // blend original color with theming color
            tmp1.lerp(tmp2, themingColor.w);

            // convert back to color-buffer uint32 and preserve original alpha bits
            return swapRBChannels(tmp1).getHex() | (origColor & alphaMask);
        };
    })();

    // Updates the per-vertex array of a mesh to reflect latest theming and ghosting state.
    // Note that this can only work on F2D meshes with known attributes and interleaved vertex buffer.
    function updateVertexBufferForThemingAndGhosting(fragList, fragId) {

        // get backup of original per-vertex colors (undef if color array is currently not modified)
        var origColors = fragList.originalColors[fragId];
        var origLayerVp = fragList.originalLayerVp[fragId];

        // check if anything changed
        if (!fragList.themingOrGhostingNeedsUpdate[fragId]) {
            return;
        }

        // get values to access colors and ids
        var mesh = fragList.vizmeshes[fragId];
        var geom = (mesh ? mesh.geometry : null);
        var attr = (geom ? geom.attributes : null);
        var atColors = (attr ? attr.color4b : null);
        var atIds = (attr ? attr.dbId4b : null);
        var atLayerVp = (attr ? attr.layerVp4b : null);

        if (!atColors || !atIds || !geom.vb || !atLayerVp) {
            // we cannot work on this mesh.
            return;
        }

        // get uint32 view on interleaved vertex buffer
        var vertexData = new Uint32Array(geom.vb.buffer);
        var stride = geom.vbstride; // elems per vertex
        var vertexCount = vertexData.length / geom.vbstride;

        // Track if any colors/layers are affected by theming/ghosting. If not, we can drop the color/layer array backup at the end.
        var themingApplied = false;
        var ghostingApplied = false;

        // Constants used for ghosting of 2D objects
        var PaperLayer = 0;    // we use the paper layer to determine the paper sheet background (see F2d.js initSheet). This shape must be excluded from ghosting.

        // update vertex-color for each vertex
        var colOffset = atColors.itemOffset;
        var idOffset = atIds.itemOffset;
        var layerOffset = atLayerVp.itemOffset;
        for (var i = 0; i < vertexCount; i++) {

            // get vertex-id and original color
            var dbId = vertexData[i * stride + idOffset];
            var color = (origColors ? origColors[i] : vertexData[i * stride + colOffset]);
            var layerVp = (origLayerVp ? origLayerVp[i] : vertexData[i * stride + layerOffset]);

            // sign extend the upper byte to get back negative numbers (since per-vertex ids are clamped from 32 bit to 24 bit)
            dbId = (dbId << 8) >> 8;

            var isPaper = dbId == -1 && (layerVp & parseInt("FFFF", 16)) == PaperLayer;

            // is this id affected by theming?
            var themeColor = fragList.db2ThemingColor[dbId];
            if (!themeColor) {
                // no theming for this vertex
                if (origColors) {
                    // restore original color
                    color = origColors[i];
                } // else: if there is no backup array, the vertex-color is already the original.
            } else {
                // this vertex-color will be affected by theming.
                // make sure that we have backup.
                if (!origColors) {
                    // backup original colors before we modify them.
                    origColors = new Uint32Array(vertexCount);
                    for (var j = 0; j < vertexCount; j++) {
                        origColors[j] = vertexData[j * stride + colOffset];
                    }
                    fragList.originalColors[fragId] = origColors;
                }

                // replace vertex-color based on theming and ghosting
                color = applyThemingColorAndGhosting(color, themeColor, isGhosted, fragList.pageColor);

                // signal that the color backup array is still needed
                themingApplied = true;
            }

            // color -> vertexBuffer
            vertexData[i * stride + colOffset] = color;

            // is this id affected by theming?
            var isGhosted = fragList.dbIdIsGhosted[dbId] && !isPaper;
            if (!isGhosted) {
                // no ghosting for this vertex
                if (origLayerVp) {
                    // restore original value
                    layerVp = origLayerVp[i];
                } // else: if there is no backup array, the layerVp is already the original
            } else {
                // this layer will be affected by ghosting.
                // make sure that we have a backup.
                if (!origLayerVp) {
                    // backup original layers before we modify them
                    origLayerVp = new Uint32Array(vertexCount);
                    for (var j = 0; j < vertexCount; j++) {
                        origLayerVp[j] = vertexData[j * stride + layerOffset];
                    }
                    fragList.originalLayerVp[fragId] = origLayerVp;
                }

                // NOTE when changing:
                //  - This must be consistent with the ghostingLayer constant in LineShader.
                //  - When not using 0xFFFF, you have to unset the original layer bits first, i.e.,
                //    layerVp &= parseInt("FFFF0000");
                var GhostingLayer = parseInt("0xFFFF", 16);

                // move this vertex to the ghosting layer.
                layerVp |= GhostingLayer;

                // signal that layerVP backup is still needed
                ghostingApplied = true;
            }

            // layer -> vertexBuffer
            vertexData[i * stride + layerOffset] = layerVp;
        }

        // if theming is off for all vertices, drop the backup array
        if (!themingApplied) {
            fragList.originalColors[fragId] = null;
        }
        if (!ghostingApplied) {
            fragList.originalLayerVp[fragId] = null;
        }

        // trigger refresh of GPU-side vertex buffer
        geom.vbNeedsUpdate = true;

        // don't touch this mesh again until new theming changes are done
        fragList.themingOrGhostingNeedsUpdate[fragId] = false;
    }

    /**
     * Provides an actual mesh for specific fragment.
     * NOTE: For (this.useThreeMesh==false), the returned value is volatile and will be overwritten on next call!
     * @param {number} fragId - Fragment ID.
     * @returns {THREE.Mesh} Mesh for the given fragment.
     */
    FragmentList.prototype.getVizmesh = (function () {

        //A scratch object that we fill in and return in the case
        //we don't use THREE.Mesh for persistent storage. If the caller
        //needs to hold on to the mesh outside the callback scope, it has to clone it.
        var m;

        function init_three() {
            if (!m) {
                m = new THREE.Mesh(undefined, undefined, true);
                m.isTemp = true;
                m.dbId = 0;
                m.modelId = 0;
                m.fragId = -1;
                m.hide = false;
                m.isLine = false;
            }
        }

        return function (fragId) {

            if (this.useThreeMesh) {
                // make sure that vertex-colors reflect the latest theming-state
                updateVertexBufferForThemingAndGhosting(this, fragId);

                return this.vizmeshes[fragId];
            } else {
                // create temporary mesh object
                init_three();

                // init temp mesh object from geometry, material etc. 
                m.geometry = this.getGeometry(fragId); // LmvBufferGeometry
                m.material = this.getMaterial(fragId); // THREE.ShaderMaterial
                m.dbId = this.getDbIds(fragId);
                m.modelId = this.model.getModelId();
                m.fragId = fragId;
                m.visible = true;
                m.isLine = this.isLine(fragId);
                m.hide = this.isFragOff(fragId);
                m.themingColor = this.db2ThemingColor[m.dbId];

                this.getWorldMatrix(fragId, m.matrixWorld);

                return m;
            }
        };

    })();

    FragmentList.prototype.getMaterialId = function (fragId) {
        return this.useThreeMesh ? this.vizmeshes[fragId].material.id : this.materialids[fragId];
    };

    FragmentList.prototype.getMaterial = function (fragId) {
        // material ids are either stored with vizmeshes or in the material map.
        return this.useThreeMesh ? this.vizmeshes[fragId].material : this.materialmap[this.materialids[fragId]];
    };

    FragmentList.prototype.getGeometry = function (fragId) {
        // geometry is either stored in with vizmoeshes or obtained from this.geoms.
        return this.useThreeMesh ? this.vizmeshes[fragId].geometry : this.geoms.getGeometry(this.geomids[fragId]);
    };

    FragmentList.prototype.getGeometryId = function (fragId) {
        // When using THREE.Meshes, fragIds and geomids are the same and this.geomids is not used.
        return this.useThreeMesh ? fragId : this.geomids[fragId];
    };

    FragmentList.prototype.setMaterial = function (fragId, material) {

        if (this.useThreeMesh) {

            this.vizmeshes[fragId].material = material;

        } else {

            this.materialids[fragId] = material.id;
            this.materialmap[material.id] = material;

        }
    };

    FragmentList.prototype.getCount = function () {
        return this.vizflags.length;
    };

    FragmentList.prototype.getDbIds = function (fragId) {
        return this.fragments.fragId2dbId[fragId];
    };

    // glRenderer: instanceof FireflyWebGLRenderer (only neeeded when for this.useThreeMesh==false)
    FragmentList.prototype.dispose = function (glrenderer) {

        if (this.useThreeMesh) {

            // dispatch remove event to all meshes and dispose events to all LmvBufferGeometry buffers
            // This will trigger EventListeners added by FireflyWebGLRenderer that deallocate the geometry later.
            // (see onGeometryDispose(..) in FireflyWebGLRenderer.js)
            var DISPOSE_EVENT = { type: 'dispose' };
            var REMOVED_EVENT = { type: 'removed' };
            for (var i = 0; i < this.vizmeshes.length; i++) {
                var m = this.vizmeshes[i];
                if (m) {
                    m.dispatchEvent(REMOVED_EVENT);
                    m.geometry.dispatchEvent(DISPOSE_EVENT);
                }
            }
        } else {
            // Delete all geometry data immediately (see FireflyWebGLRenderer.deallocateGeometry)
            this.geoms.dispose(glrenderer);
        }
    };

    // This function should probably not be called outside VisibityManager
    // in order to maintain node visibility state.
    FragmentList.prototype.setVisibility = function (fragId, value) {
        this.setFlagFragment(fragId, MESH_VISIBLE, value);
        this.allVisibleDirty = true;
    };


    FragmentList.prototype.setFragOff = function (fragId, value) {
        this.setFlagFragment(fragId, MESH_HIDE, value);
        this.allVisibleDirty = true; // [HB:] Either this should be removed or this.areAllVisible should consider MESH_HIDE
    };


    FragmentList.prototype.setAllVisibility = function (value) {
        if (this.useThreeMesh) {
            var frags = this.fragments;
            if (frags && frags.dbId2fragId) {
                for (var id in frags.dbId2fragId) {
                    this.setObject2DGhosted(id, !value);
                }
            }
        } else {
            this.setFlagGlobal(MESH_VISIBLE, value);

            this.allVisible = value;
            this.allVisibleDirty = false;
        }
    };

    /**
     * Updates animation transform of a specific fragment.
     * Note: 
     *      - If scale/rotation/translation are all null, the call resets the whole transform, i.e., no anim transform is assigned anymore.
     *      - Leaving some of them null means to leave them unchanged.
     * @param {number} fragId - Fragment ID.
     * @param {Vector3=} scale
     * @param {Quaternion=} rotationQ
     * @param {Vector3=} translation
     */
    FragmentList.prototype.updateAnimTransform = function (fragId, scale, rotationQ, translation) {

        var ax = this.animxforms;
        var off;

        //Allocate animation transforms on first use.
        if (!ax) {
            var count = this.getCount();
            ax = this.animxforms = new Float32Array(10 * count); //3 scale + 4 rotation + 3 translation
            for (var i = 0; i < count; i++) {
                // get start index of the anim transform of fragment i
                off = i * 10;

                // init as identity transform
                ax[off] = 1;        // scale.x
                ax[off + 1] = 1;    // scale.y
                ax[off + 2] = 1;    // scale.z
                ax[off + 3] = 0;    // rot.x
                ax[off + 4] = 0;    // rot.y
                ax[off + 5] = 0;    // rot.z
                ax[off + 6] = 1;    // rot.w
                ax[off + 7] = 0;    // trans.x
                ax[off + 8] = 0;    // trans.y
                ax[off + 9] = 0;    // trans.z
            }
        }

        off = fragId * 10;
        var moved = false;

        if (scale) {
            ax[off] = scale.x;
            ax[off + 1] = scale.y;
            ax[off + 2] = scale.z;
            moved = true;
        }

        if (rotationQ) {
            ax[off + 3] = rotationQ.x;
            ax[off + 4] = rotationQ.y;
            ax[off + 5] = rotationQ.z;
            ax[off + 6] = rotationQ.w;
            moved = true;
        }

        if (translation) {
            ax[off + 7] = translation.x;
            ax[off + 8] = translation.y;
            ax[off + 9] = translation.z;
            moved = true;
        }

        // Set MESH_MOVED if an animation transform has been assigned. Just if scale/rotation/translation are all null, unset the flag.
        this.setFlagFragment(fragId, MESH_MOVED, moved);

        //Assume that if we are called with null everything the caller wants to reset the transform.
        if (!moved) {
            // reset to identity transform
            ax[off] = 1;
            ax[off + 1] = 1;
            ax[off + 2] = 1;
            ax[off + 3] = 0;
            ax[off + 4] = 0;
            ax[off + 5] = 0;
            ax[off + 6] = 1;
            ax[off + 7] = 0;
            ax[off + 8] = 0;
            ax[off + 9] = 0;
        }
    };

    /**
     * Returns animation transform of a specific fragment.
     * @param {number} fragId - Fragment ID.
     * @param {Vector3=} scale - Output param.
     * @param {Quaternion=} rotationQ - Output param.
     * @param {Vector3=} translation - Output param.
     * @returns {bool} True if an anim transform is assigned to the given fragment.
     *      If so, it is written to the given out params. False otherwise (outparams not changed).
     */
    FragmentList.prototype.getAnimTransform = function (fragId, scale, rotationQ, translation) {

        if (!this.animxforms)
            return false;

        if (!this.isFlagSet(fragId, MESH_MOVED))
            return false;

        var off = fragId * 10;
        var ax = this.animxforms;

        if (scale) {
            scale.x = ax[off];
            scale.y = ax[off + 1];
            scale.z = ax[off + 2];
        }

        if (rotationQ) {
            rotationQ.x = ax[off + 3];
            rotationQ.y = ax[off + 4];
            rotationQ.z = ax[off + 5];
            rotationQ.w = ax[off + 6];
        }

        if (translation) {
            translation.x = ax[off + 7];
            translation.y = ax[off + 8];
            translation.z = ax[off + 9];
        }

        return true;
    };

    /**
     * Returns world matrix of a fragment.
     * @param {number} index - Fragment ID.
     * @param {THREE.Matrix4} dstMtx - Out param to receive the matrix.
     */
    FragmentList.prototype.getOriginalWorldMatrix = function (index, dstMtx) {
        var i = index * 12;

        var cur = dstMtx.elements;
        var orig = this.transforms;

        if (orig) {
            // If this.transforms is defined, copy transform from this array            

            // In this.transforms, we only store the upper 3 rows explicitly. 
            // The last row is alway (0,0,0,1).
            cur[0] = orig[i];
            cur[1] = orig[i + 1];
            cur[2] = orig[i + 2];
            cur[3] = 0;
            cur[4] = orig[i + 3];
            cur[5] = orig[i + 4];
            cur[6] = orig[i + 5];
            cur[7] = 0;
            cur[8] = orig[i + 6];
            cur[9] = orig[i + 7];
            cur[10] = orig[i + 8];
            cur[11] = 0;
            cur[12] = orig[i + 9];
            cur[13] = orig[i + 10];
            cur[14] = orig[i + 11];
            cur[15] = 1;
        } else if (this.useThreeMesh) {
            // get matrix directly from THREE.Mesh
            var m = this.getVizmesh(index);
            if (m)
                dstMtx.copy(m.matrixWorld);
            else
                dstMtx.identity();
        } else {
            dstMtx.identity();
        }
    };


    /**
     * Writes the final world matrix of a fragment to out param dstMtx.
     * The world matrix results from original transform and anim transform (if any).
     * @param {number} index - Fragment ID.
     * @param {THREE.Matrix4} dstMtx - Out param to receive the matrix.
     */
    FragmentList.prototype.getWorldMatrix = (function () {

        var tmp, pos, rot, scale;

        function init_three() {
            tmp = new THREE.Matrix4();
            pos = new THREE.Vector3();
            rot = new THREE.Quaternion();
            scale = new THREE.Vector3();
        }

        return function (index, dstMtx) {

            if (!tmp)
                init_three();

            this.getOriginalWorldMatrix(index, dstMtx);

            //If mesh hasn't moved from its original location, just use that.
            if (!this.isFlagSet(index, MESH_MOVED)) {
                return;
            }

            //Otherwise construct the overall world matrix
            this.getAnimTransform(index, scale, rot, pos);

            // compose matrix from pos, rotation, and scale
            tmp.compose(pos, rot, scale);

            // First apply original matrix (in dstMtx), then anim matrix (in tmp).
            // Note that tmp muist be multipled from left for this.
            dstMtx.multiplyMatrices(tmp, dstMtx);
        };

    })();

    /**
     * Writes the world box to dstBox outparams, considering matrix and anim transform (if specified).
     * @param {number} index - Fragment ID.
     * @param {THREE.Box3|LmvBox3}
     */
    FragmentList.prototype.getWorldBounds = (function () {

        var tmp;

        function init_three() {
            tmp = new THREE.Matrix4();
        }

        return function (index, dstBox) {

            if (!tmp)
                init_three();

            //Check if the world transform of the mesh is unchanged from
            //the original LMV file -- in such case we can use the original
            //bounding box from the LMV package, which is presumably more precise (tighter)
            //than just transforming the model box.
            //This is important if we want to keep our bounding volume hierarchy efficient.
            if (this.boxes && !this.isFlagSet(index, MESH_MOVED)) {
                var b = this.boxes;
                var boffset = index * 6;
                dstBox.min.x = b[boffset];
                dstBox.min.y = b[boffset + 1];
                dstBox.min.z = b[boffset + 2];
                dstBox.max.x = b[boffset + 3];
                dstBox.max.y = b[boffset + 4];
                dstBox.max.z = b[boffset + 5];
                return;
            }

            // get original model box
            if (this.useThreeMesh) {
                // either from THREE.Mesh
                var m = this.getVizmesh(index);
                if (m && m.geometry) {
                    dstBox.copy(m.geometry.boundingBox);
                }
            }
            else {
                // or from GeometryList
                this.geoms.getModelBox(this.geomids[index], dstBox);
            }

            if (!dstBox.empty()) {
                // apply world matrix to dstBox
                this.getWorldMatrix(index, tmp);
                dstBox.applyMatrix4(tmp);
            }
        };

    })();

    // set themingNeedsUpdate flag for all vizmeshes that contain a given dbId
    function setThemingOrGhostingNeedsUpdateFlag(fragList, dbId) {

        if (!fragList.useThreeMesh) {
            // In this case (3D model), we just have theming colors per mesh and don't need to update vertex buffers.
            return;
        }

        // get id(s) of affected mesh(es) that needs a vertex-color update
        var fragIds = fragList.fragments.dbId2fragId[dbId];

        //  trigger update for single id or an array of ids
        if (Array.isArray(fragIds)) {
            for (var i = 0; i < fragIds.length; i++) {
                fragList.themingOrGhostingNeedsUpdate[fragIds[i]] = true;
            }
        } else if (typeof fragIds === 'number') {
            fragList.themingOrGhostingNeedsUpdate[fragIds] = true;
        }
    }

    /**
     * Applies a theming color that is blended with the final fragment color of a material shader.
     * @param {number}        dbId
     * @param {THREE.Vector4} color - theming color (in xyz) and intensity (in w). All components in [0,1]
     */
    FragmentList.prototype.setThemingColor = function (dbId, color) {
        this.db2ThemingColor[dbId] = color;
        setThemingOrGhostingNeedsUpdateFlag(this, dbId);
    }

    /** Restore original colors for all themed shapes. */
    FragmentList.prototype.clearThemingColors = function () {

        // trigger update for all meshes that were affected by theming before
        for (var dbId in this.fragments.dbId2fragId) {
            setThemingOrGhostingNeedsUpdateFlag(this, dbId);
        }

        // clear theming-color map
        this.db2ThemingColor.length = 0;
    }

    /** Set ghosting flag for a 2D object. This reduces the objects opacity, blends it with pageColor, and excludes it from selection.
     *  @param {number} dbId
     *  @param {bool}   state
     */
    FragmentList.prototype.setObject2DGhosted = function (dbId, state) {
        this.dbIdIsGhosted[dbId] = state;
        setThemingOrGhostingNeedsUpdateFlag(this, dbId);
    }

    return FragmentList;
});