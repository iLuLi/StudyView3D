define(function() {
    'use strict';
    var TileState_Missing = 0;
    var TileState_Loading = 1;
    var TileState_Loaded = 2;


    var TileInfo = function (timeStamp, mesh) {

        this.timeStamp = timeStamp;         // {number} frame timeStamp of last usage 
        this.mesh = mesh;              // {THREE.Mesh}
        this.state = TileState_Missing;
    };


    // @param {THREE.Vector3} p
    // @param {THREE.Vector3} bboxMin
    // @param {THREE.Vector3} bboxMax
    // @returns {number} Squared distance of the bbox to p
    function point2BoxDistance2(p, boxMin, boxMax) {

        // compute the point within bbox that is nearest to p by clamping against box
        var nearest = p.clone();
        nearest.max(boxMin);
        nearest.min(boxMax);

        // return squared length of the difference vector
        return nearest.distanceToSquared(p);
    };

    function TexQuadConfig() {
        this.urlPattern = null; // string pattern for image URLs, e.g., http://otile1.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg
        this.tileSize = null; // in;  width/height of tile images (always squared) in pixels. E.g., 256
        this.maxLevel = null; // int; maximum hierarchy level, e.g., 10    
        this.acmSessionId = null; // required if the texture URLs are not public

        // texture extent at max resolution. Must be integer between 1 and 2^(maxLevel)
        this.texWidth = 0;
        this.texHeight = 0;

        // {function()} optional callback that is triggered when the root image is loaded.
        // This is used when loading single images (maxLevel=0), where we obtain texWidth, texHeight, and tileSize
        // are obtained from the image dimensions.
        this.onRootLoaded = null;

        // In this code, root level 0 contains is defined as the largest miplevel for which whole image fits into a single tile. The translation service
        // currently produces additional levels with smaller mipmaps of this single tiles, which we don't use here. E.g., the actual root tile of our hierarchy
        // might be in a folder "9" instead of "0". Therefore, whenever we do image load requests, we add this level offset to the tile level to derive the image URL.
        this.levelOffset = 0;

        this.getRootTileSize = function () {
            // the root tile covers a squared pixel region of size tileSize * 2^maxLevel
            return 1.0 * (this.tileSize << this.maxLevel);
        }
        this.getQuadWidth = function () { return 1.0 * this.texWidth / this.getRootTileSize(); }
        this.getQuadHeight = function () { return 1.0 * this.texHeight / this.getRootTileSize(); }

        /** @returns {LmvMatrix4} Converts from quad geometry coords to paper units. */
        this.getPageToModelTransform = function (paperWidth, paperHeight) {

            // scale from page to model units
            var sx = paperWidth / this.getQuadWidth();
            var sy = paperHeight / this.getQuadHeight();

            return new LmvMatrix4(true).set(
                sx, 0, 0, 0,
                0, sy, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            );
        }

        // The root tile corresponds to [0,1] in x/y. The actual image may be smaller.
        this.getBBox = function () {

            // the image dimensions determine which fraction of the root tile is actually used.
            var quadWidth = this.getQuadWidth();
            var quadHeight = this.getQuadHeight();

            // If quadHeight is <1.0, it means that not the full root tile height is used by the image.
            // Since pixel y and worldY directions are opposite, the unused part of the [0,1] region is at 
            // the lower end of the y-range. 
            var cropYShift = (1.0 - quadHeight);

            return new THREE.Box3(new THREE.Vector3(0, cropYShift, 0), new THREE.Vector3(quadWidth, 1.0, 0.0));
        };

        this.valid = function () {
            return (typeof this.urlPattern == 'string' && this.urlPattern.length > 0 &&
                    typeof this.tileSize == 'number' && this.tileSize > 0 &&
                    typeof this.maxLevel == 'number' && this.maxLevel > 0 &&
                    typeof this.texWidth == 'number' && this.texWidth > 0 &&
                    typeof this.texHeight == 'number' && this.texHeight > 0);
        }

        /** Configures the iterator to display a single image file without leaflet hierarchy.
         *  For this case, the image dimensions are not known in advance, but set as soon as 
         *  the root tile is loaded. 
         *   @params {string}     imagePath
         *   @params {function()} [onImageLoaded] Called as soon as the root has been loaded and 
         *                        the image dimensions are available.
         */
        this.initForSimpleImage = function (imagePath, onImageLoaded) {
            this.urlPattern = imagePath;
            this.maxLevel = 0;
            this.levelOffset = 0;

            // indicate that these values are not available yet.
            // The iterator will set them based on the image extensions as soon as it is loaded
            this.tileSize = -1;
            this.texWidth = -1;
            this.texHeight = -1;

            // inform caller when actual extents are avaialble
            this.onRootLoaded = onImageLoaded;
        }

        // Returns the required maxLevel for a given texture resolution.
        // All params are int.
        function computeMaxLevel(w, h, tileSize) {

            // compute maxLevel that we would get for 1x1 resolution at level 0
            var lx = Math.ceil(Math.log2(w));
            var ly = Math.ceil(Math.log2(h));
            var maxLevel = Math.max(lx, ly);

            // since the actual root tile has tileSize x tileSize, we subtract the skipped levels.
            return maxLevel - Math.log2(tileSize);
        }

        // If a maxLevel is specified that is smaller than the one that we computed for the given
        // resolution, texWidth and texHeight must be set to the smaller resolution at this level.
        function applyMaxLevel(config, actualMaxLevel, restrictedMaxLevel) {
            var levelDiff = actualMaxLevel - restrictedMaxLevel;
            if (levelDiff > 0) {
                config.texWidth >>= levelDiff;
                config.texHeight >>= levelDiff;
                config.maxLevel = restrictedMaxLevel;
            }
        }

        /** Extracts all required params from a given options dictionary.
         *   @param {string} urlPattern
         *   @param {Object} options     Parameter dictionary
         *   @param {number} [sessionId]
         */
        this.initFromLoadOptions = function (urlPattern, options, sessionId) {

            this.urlPattern = urlPattern;
            this.acmSessionId = sessionId;

            if (options) {
                this.tileSize = options.tileSize;
                this.maxLevel = computeMaxLevel(options.texWidth, options.texHeight, options.tileSize);
                this.texWidth = options.texWidth;
                this.texHeight = options.texHeight;
                this.levelOffset = options.levelOffset;

                // If maxLevel is specified, scale down texSize to the resolution at this level
                if (typeof options.maxLevel == 'number') {
                    applyMaxLevel(this, this.maxLevel, options.maxLevel);
                }
            }
        }
    };

    /** @classDesc Produces a quad that is textured with a large image. 
     *             The image is stored as a hierarchy of image tiles, where each tile is stored as a separate file (e.g. jpg or png).
     *             Each hierarchy level represents a miplevel of the overall texture, subdivided into squared tiles 
     *             of fixed size (e.g., 256 x 256). Level 0 contains a single tile that represents the whole texture as a single tile at lowest resolution.
     *             At the leaf level n, the texture is represented at full resolution as a tile grid of up to (2^n x 2^n) tiles. 
     *
     *             Note that some tiles may be unused or cropped if the overall resolution is not squared and a pow2-multiple of the tilesize.
     *             
     * @class 
     *   @param {TexQuadConfig}   config
     *   @param {MaterialManager} materials
     */
    function ModelIteratorTexQuad(config, materials) {

        var _config = config;

        // The bbox of the quad keeps the same, because it is independent on how we subdivide the quad geometry.
        // However, for single images, its correct initialization will be deferred until the image is loaded.
        var _bbox = config.getBBox();

        // reused scene that we reconfigure on each iterator reset.
        var _scene = new THREE.Scene();

        // {MaterialManager}
        var _materials = materials;

        // This iterator returns only a single scene. Therefore, _done is set to false when on iteration start (this.reset()) 
        // and set to true again after first call of nextBatch. 
        var _done = true;

        // array of TileInfos for all tiles that are currently available for rendering.
        // caching of generated tiles. Tiles are addressed by int indices
        // computed by tile2Index (see TileCoords.js)
        var _tiles = [];

        // increased with each iterator reset. used for LRU timestamps.
        var _timeStamp = 0;

        // maximum number of tiles in memory
        var _cacheSize = 150;

        // used to limit the number of simultaneously loaded tiles
        var _maxRequests = 5;
        var _numRequests = 0; // currently running requests

        // For each frame, limit the number of new textures that enter the scene.
        // Otherwise, texture decode/upload in FireFlyRenderer may take too long.
        var _maxTextureUpdatesPerFrame = 5;

        // used to trigger redraw when new tiles are loaded
        var _sceneChanged = false;

        // Shared THREE.Geometry. A unit quad in xy plane with uv coords. Used for all tiles.
        var _quadGeom = null;

        // reused geometry for on-the-fly generated fallback tiles, which require individual uv-coords
        // It would be better to share _quadGeom for these as well. But this is would require a solution
        // first how we can use the same texture with different uvTransforms in a single frame.
        var _reusedGeoms = [];  // {THREE.Geometry}

        // index to the first elem in _reusedGeoms that has not been used for the current frame yet.
        var _nextFreeGeom = 0;

        // get image resolution at a given hierarchy level. We have full resolution at maxLevel and reduce it by half with each level. 
        function getMipmapWidth(level) {
            var levelDiff = _config.maxLevel - level;
            return _config.texWidth >> levelDiff;
        }
        function getMipmapHeight(level) {
            var levelDiff = _config.maxLevel - level;
            return _config.texHeight >> levelDiff;
        }

        // returns true if the pixel region of the tile is outside the given image dimensions.
        //  @param {TileCoords} tile
        //  @returns {bool}
        function tileOutside(tile) {
            // get dimensions
            var levelWidth = getMipmapWidth(tile.level);
            var levelHeight = getMipmapHeight(tile.level);

            // compute minPixel of the tile's pixel region
            var minPixelX = tile.x * _config.tileSize;
            var minPixelY = tile.y * _config.tileSize;

            return (minPixelX >= levelWidth || minPixelY >= levelHeight);
        }

        // The width/height of a mipLevel cannot be assumed to be a multiple of tileSize. Therefore, tiles containing the image boundary 
        // are cropped to the relevant pixels. E.g., the width of a boundary tile might be 500 while the tileSize is 512.
        // Since the image is cropped, we have to scale down the geometry as well to avoid stretching. This function contains the scale
        // factor in x/y to be applied to the geometry.
        //
        // @returns {THREE.Vector2} 
        function getCropScale(tile) {
            // get dimensions
            var levelWidth = getMipmapWidth(tile.level);
            var levelHeight = getMipmapHeight(tile.level);

            // compute first minPixel covered by this tile
            var minPixelX = tile.x * _config.tileSize;
            var minPixelY = tile.y * _config.tileSize;

            // crop tile to image dimensions
            var croppedWidth = 1.0 * Math.max(0, Math.min(_config.tileSize, levelWidth - minPixelX));
            var croppedHeight = 1.0 * Math.max(0, Math.min(_config.tileSize, levelHeight - minPixelY));

            var ts = 1.0 * _config.tileSize;

            return new THREE.Vector2(1.0 * croppedWidth / ts, croppedHeight / ts);
        }

        /** @returns {THREE.Scene|null} */
        this.nextBatch = function () {

            // first call since reset => return _scene 
            if (!_done) {
                _done = true;
                return _scene;
            }
            return null;
        }

        this.getSceneCount = function () {
            // TexQuadIterators are always rendered as a single batch
            return 1;
        }

        /** @returns {bool} */
        this.done = function () { return _done; }

        /** Perform raycast on the quad. 
          * @param {THREE.RayCaster} raycaster
          * @param {Object[]}        intersects - An object array that contains intersection result objects.
          *                                       Each result r stores properties like r.point, r.fragId, r.dbId. (see VBIntersector.js for details)
          */
        this.rayCast = function (raycaster, intersects) {

            // not implemented yet
            return null;
        }

        /** Copies visible bbox into the given output params. Since per-fragment visibility is not supported
         *  by this iterator, both bboxes are always identical.
         *
         *   @param {THREE.Box3} [visibleBounds]
         *   @param {THREE.Box3} [visibleBoundsWithHidden]
         */
        this.getVisibleBounds = function (visibleBounds, visibleBoundsWithHidden) {
            if (visibleBounds) visibleBounds.copy(_bbox);
            if (visibleBoundsWithHidden) visibleBoundsWithHidden.copy(_bbox);
        }

        // compute width/height of a tile, assuming that the root corresponds to [0,1]^2 in xy.
        // level is int.
        function getTileScale(level) { return 1.0 / (1 << level); };

        // Simple helper to describe uv offset and scale
        function UVTransform() {
            this.offsetX = 0.0;
            this.offsetY = 0.0;
            this.scaleX = 1.0;
            this.scaleY = 1.0;
        }
        var _uvTransformIdentity = new UVTransform();

        // Given a tile to be rendered and a (n-th-order) parent from which we use the material,
        // this method computes offset and scale in uv coords that we need to compute the texture coords.
        //  @returns {UVTransform}
        function getUVOffsetAndScale(tile, parentTile) {

            // compute the level difference between tile and parent
            var levelDiff = tile.level - parentTile.level;

            // at tile.level, compute the number of tiles in x and y that share the same parent tile
            var levelDiffScale = (1 << levelDiff);

            // compute width/height in uv-space
            var uvScaleX = 1.0 / levelDiffScale;
            var uvScaleY = uvScaleX;

            // uvScale means here: "which extent in the uv-space of the parent corresponds to a the size of a single tile at tile.level"
            // If the parent tile is cropped, the uvScale needs to be upscaled accordingly.        
            var parentCropScale = getCropScale(parentTile);
            uvScaleX /= parentCropScale.x; // Note that cropScale.x and cropScale.y are always >0. Otherwise, the whole parent tile would 
            uvScaleY /= parentCropScale.y; // be outside the image extent and it wouldn't make sense to compute any uv coords.

            // For l=tile.level, find the minimum x and y among all subtiles of parent at level l.
            var firstX = parentTile.x * levelDiffScale;
            var firstY = parentTile.y * levelDiffScale;

            // compute offsetX/Y within the subtile grid of size [levelDiffScale]^2
            var offsetX = tile.x - firstX;
            var offsetY = tile.y - firstY;

            // uvScale as computed above is the size of a full tile at tile.level, given in uv space of the parent.
            // If the (child) tile is cropped, its geometry will be cropped as well, so that its extent is less than a full tile
            // at this level. Therefore, we have to consider the cropScale of the tile for the final scale factor.
            var cropScale = getCropScale(tile);

            // transform offset from tile-grid to uv
            offsetX *= uvScaleX;
            offsetY *= uvScaleY;

            // apply y-flip. Note that a simple y-flip (1.0-val) swaps min/max v-value of the tile.
            // E.g., the uv-offset of the first tile would be 1.0 after the swap - which should actually 
            // the max-v of the tile. Since offset has to be the min-uv, we have to subtract the
            // v-extent of the tile afterwards.
            offsetY = 1.0 - offsetY - (uvScaleY * cropScale.y);

            var result = new UVTransform();
            result.offsetX = offsetX;
            result.offsetY = offsetY;
            result.scaleX = uvScaleX * cropScale.x;
            result.scaleY = uvScaleY * cropScale.y;
            return result;
        };

        // tile: TileCoords
        // Returns: float
        function getTileMinX(tile) {
            var tileScale = getTileScale(tile.level);

            return tileScale * tile.x;
        };

        // see getTileMinX
        function getTileMinY(tile) {
            var tileScale = getTileScale(tile.level);

            // invert tile order to match image layout.
            var maxY = (1 << tile.level) - 1;
            var yFlipped = maxY - tile.y;

            return tileScale * yFlipped;
        };

        // @returns {TileInfo|null}
        function getTileInfo(tile) {
            return _tiles[avp.tile2Index(tile)];
        };

        // Returns a true if a tile texture is in memory
        function tileLoaded(tile) {
            var tileInfo = getTileInfo(tile);
            return (tileInfo instanceof TileInfo) && tileInfo.state == TileState_Loaded;
        };

        // Finds a parent tile for which a texture is a available
        // Takes and returns TileCoord (or null if nothing found)
        //  @param {bool} [disableNewTextures] if true, we enforce to use a texture that
        //                                     has been used before and doesn't need to be decoded/uloaded anymore.
        function findLoadedParent(tile, disableNewTextures) {

            // step up the parent path until we find one in memory
            var parent = tile.getParent();
            while (parent) {
                var info = getTileInfo(parent);

                // tile loaded?
                var found = (info && info.state == TileState_Loaded);

                // if loaded, are we allowed to use the texture?
                if (found && disableNewTextures) {

                    // don't allow adding new tiles. Just the root is always accepted.
                    if (info.mesh.material.map.needsUpdate && parent.level > 0) {
                        found = false;
                    }
                }

                // stop if we found a usable parent
                if (found) {
                    break;
                }

                // Continue with next parent. Latest at the root,
                // we will usually succeed.
                parent = parent.getParent();
            }

            return parent;
        };

        /** Updates the uv-coords for a given quad geometry.
         *   @param {THREE.Geometry} geom
         *   @param {UVTransform}    [uvTransform] - default: identity
         */
        function setUVCoords(geom, uvTransform) {

            var tf = (uvTransform ? uvTransform : _uvTransformIdentity);

            var uvs = [];
            uvs.push(new THREE.Vector2(tf.offsetX, tf.offsetY));
            uvs.push(new THREE.Vector2(tf.offsetX + tf.scaleX, tf.offsetY));
            uvs.push(new THREE.Vector2(tf.offsetX + tf.scaleX, tf.offsetY + tf.scaleY));
            uvs.push(new THREE.Vector2(tf.offsetX, tf.offsetY + tf.scaleY));

            geom.faceVertexUvs[0].length = 0;
            geom.faceVertexUvs[0].push([uvs[0], uvs[1], uvs[2]]);
            geom.faceVertexUvs[0].push([uvs[0], uvs[2], uvs[3]]);

            geom.uvsNeedUpdate = true;
        }

        /** 
         *  @param {UVTransform} [uvTransform]
         *  @returns {THREE.Geometry} 
         */
        function createQuadGeom(uvTransform) {

            // vertices
            var geom = new THREE.Geometry();
            geom.vertices.push(
                new THREE.Vector3(0.0, 0.0, 0.0),
                new THREE.Vector3(1.0, 0.0, 0.0),
                new THREE.Vector3(1.0, 1.0, 0.0),
                new THREE.Vector3(0.0, 1.0, 0.0)
            );

            // indices
            geom.faces.push(new THREE.Face3(0, 1, 2));
            geom.faces.push(new THREE.Face3(0, 2, 3));

            setUVCoords(geom, uvTransform);

            geom.computeFaceNormals();

            return geom;
        };

        /** 
         * Returns a reusable geometry and recomputes its uv coords based on given scale and offset.
         *  @param   {UVTransform}    [uvOffsetX]
         *  @returns {THREE.Geometry} A geometry from _reusedGeoms
         */
        function acquireQuadGeom(uvTransform) {

            // get next reusable mesh and increase counter
            var geom = _reusedGeoms[_nextFreeGeom];

            // if not available yet, create it
            if (!geom) {
                geom = createQuadGeom(uvTransform);

                // keep it for reuse in later frames
                _reusedGeoms[_nextFreeGeom] = geom;
            } else {
                // reuse old geom and just update uv 
                setUVCoords(geom, uvTransform);
            }

            // inc counter so that this geom is not used for any other tile in this frame
            _nextFreeGeom++;
            return geom;
        }

        // creates a single quad shape (THREE.Mesh) representing a tile of the image.
        // If no image is provided, we use the material of a lower-resolution tile.
        function createTileShape(
            tile,              // TileCoords
            material,          // THREE.Material
            disableNewTextures // If material is null, this optional flag enforces that 
            // we use a fallback texture that does not require decode/upload
        ) {
            var geom;
            // for tiles with own texture, we can use the shared quad shape
            if (material) {
                // create shared quad geom on first use
                if (!_quadGeom) {
                    _quadGeom = createQuadGeom();
                }

                geom = _quadGeom;

            } else {
                // share texture of lower-resolution tile

                // if we have no image, find a parent tile from which we can reuse the material as a fallback
                var parentTile = findLoadedParent(tile);

                // by construction, parent is the first parent with texture 
                // in memory. So, parentShape must always be available.            
                var parentShape = getTileShape(parentTile);

                material = parentShape.material;

                // configure uv transform, because we are only using a subset of 
                // the texture for this tile
                var tmp = getUVOffsetAndScale(tile, parentTile, disableNewTextures);

                geom = acquireQuadGeom(tmp);
            }

            var mesh = new THREE.Mesh(geom, material);

            var tileScale = getTileScale(tile.level);

            // for boundary tiles with cropped images, scale down geometry accordingly. No effect for non-cropped tiles.
            var cropScaleFactor = getCropScale(tile);

            // since pixel y and worldY directions are opposite, y-cropped tiles also needs to be shifted.
            var cropYShift = (1.0 - cropScaleFactor.y) * tileScale;

            // compute offset and scale of the tile, where [0,1]^2 corresponds to the root
            var tileOffsetX = getTileMinX(tile);
            var tileOffsetY = getTileMinY(tile);
            mesh.position.set(tileOffsetX, tileOffsetY + cropYShift, 0.0);
            mesh.scale.set(tileScale * cropScaleFactor.x, tileScale * cropScaleFactor.y, 1.0);

            return mesh;
        };

        // Returns the URL string to request a single tile image
        function getTileTextureURL(tile) {

            var levelOffset = (_config.levelOffset ? _config.levelOffset : 0);

            var url = _config.urlPattern
                .replace("{x}", tile.x)
                .replace("{y}", tile.y)
                .replace("{z}", (tile.level + levelOffset));
            return url;
        };

        var self = this;

        // As soon as a tile is loaded, it will be available via getTileShape(tile).
        function requestTile(tile) {

            // get tileInfo
            var tileIndex = avp.tile2Index(tile);
            var tileInfo = _tiles[tileIndex];

            // if tile is already loading or in memory, do nothing
            if (tileInfo && tileInfo.state != TileState_Missing) {
                return;
            }

            // make sure that tileInfo exists
            if (!tileInfo) {
                tileInfo = new TileInfo(_timeStamp);
                _tiles[tileIndex] = tileInfo;
            }

            // mark tile as loading, so that we don't request it again
            tileInfo.state = TileState_Loading;

            var path = getTileTextureURL(tile);

            // Callback that updates the tile-shape as soon as the texture is loaded
            var onTexLoaded = function (tex) { // tex = THREE.Texture.

                // drop texture if the iterator has been deleted meanwhile
                if (!self) {
                    return;
                }

                // when using the iterator for displaying a single image, we get texWidth/texHeihgt/tileSize
                // from the actual image dimensions.
                if (_config.maxLevel == 0) {
                    if (_config.texWidth == -1) _config.texWidth = tex.image.width;
                    if (_config.texHeight == -1) _config.texHeight = tex.image.height;
                    if (_config.tileSize == -1) _config.tileSize = Math.max(tex.image.width, tex.image.height);

                    // update bbox - which depends on texture dimensions
                    _bbox = config.getBBox();
                }

                // Using mipmapping would be nice, but involve some issues with tile loading performance.
                // Also, we have to handle non-pow2 textures here, which is usually not supported.
                // 
                // Note that the oversampling artifacts are limited at least, because the tile-lod selection
                // chooses the tile-resolution based on estimated projected screen size.
                tex.generateMipmaps.false;

                // use linear filter, so that we can use non-pow2 textures.
                tex.minFilter = THREE.LinearFilter;
                tex.magFilter = THREE.LinearFilter;

                // create material
                var material = new THREE.MeshBasicMaterial({ color: 0xFFFFFFFF });
                material.map = tex;

                // set material name that we use to find and unregister 
                // this material in MaterialManager later
                // NOTE: Using the image URL as material name is simple,
                //       but would produce a trap if we ever use different 
                //       RenderModels that load from the same source.
                //       It would be safer to find some individual prefix for
                //       this iterator.
                material.name = path;

                // By default, MaterialManager assigns the environment texture for reflection to all
                // materials that support it. Setting this flag avoids this.
                material.disableEnvMap = true;

                // add material to material manager to make sure that the shader is
                // correctly configured. E.g., to configure in which render targets to write etc.
                _materials.addMaterial(material.name, material, true);

                // create tile mesh
                var mesh = createTileShape(tile, material);

                // make new tile available
                tileInfo.mesh = mesh;

                // mark tile as loaded, so that we know that its own texture is in memory.
                tileInfo.state = TileState_Loaded;

                // request finished
                _numRequests--;

                // trigger scene update
                _sceneChanged = true;

                // trigger custom callback when root is available
                if (tile.level == 0 && _config.onRootLoaded) {
                    _config.onRootLoaded();
                }
            };

            // track number of open requests
            _numRequests++;

            // load tile texture        
            avp.loadTextureWithSecurity(path, THREE.UVMapping, onTexLoaded, _config.acmSessionId);
        };

        // root tile is always needed
        requestTile(new avp.TileCoords(0, 0, 0));

        // returns a tile shape from memory cache. Returns null if the tile's own
        // texture is not loaded yet.
        function getTileShape(tile) {

            var index = avp.tile2Index(tile);
            var tileInfo = _tiles[index];

            if (!tileInfo || tileInfo.state != TileState_Loaded) {
                return null;
            }

            return tileInfo.mesh;
        };

        // tile:   TileCoords
        // outMin: Vector3 (z=0.0)
        function getTileMin(tile, outMin) {
            var x = getTileMinX(tile);
            var y = getTileMinY(tile);
            outMin.set(x, y, 0);
        };

        function getTileMax(tile, outMax) {
            var scale = getTileScale(tile.level);
            var x = getTileMinX(tile) + scale;
            var y = getTileMinY(tile) + scale;
            outMax.set(x, y, 0);
        };

        // Computes the priority of a tile based on camera distance and tile size.
        var computeTilePriority = (function () {
            var tileBox = new THREE.Box3();
            var tileMin = new THREE.Vector3();
            var tileMax = new THREE.Vector3();

            return function (
                tile,    // {TileCoords}
                frustum, // {FrustumIntersector}
                camPos   // {THREE.Vector3}
            ) {
                // compute xy-distance from camera
                var tileScale = getTileScale(tile.level);
                getTileMin(tile, tileMin);
                getTileMax(tile, tileMax);
                var dist2 = point2BoxDistance2(camPos, tileMin, tileMax);

                // scale-up priority for visible tiles
                tileBox.set(tileMin, tileMax);
                var tileVisible = frustum.intersectsBox(tileBox) > 0;
                var frustumFactor = (tileVisible ? 100.0 : 1.0);

                // avoid division by zero: for tiles below this distance, 
                // we only distinguish based on tile level
                var MinDist2 = 0.0001;
                dist2 = Math.max(dist2, MinDist2);

                // squared tile size
                var tileScale2 = tileScale * tileScale;

                // Priority = tileSize/dist 
                var priority = (frustumFactor * tileScale2) / dist2;

                return priority;
            };
        }());

        // Estimates for a tile the current screen size in pixels 
        var estimateScreenSize = (function () {

            var tileMin = new THREE.Vector3();
            var tileMax = new THREE.Vector3();

            return function (
                tile,       // {TileCoords}
                camPos,     // {THREE.Vector3}
                camFov,     // in degrees
                canvasWidth // in pixels
            ) {
                // get tile distance
                getTileMin(tile, tileMin);
                getTileMax(tile, tileMax);
                var dist = Math.sqrt(point2BoxDistance2(camPos, tileMin, tileMax));

                var edgeLength = tileMax.x - tileMin.x;

                // get tan(phi/2) for horizontal aperture angle
                var tanPhiHalf = Math.tan(THREE.Math.degToRad(camFov / 2.0));

                var projLength = edgeLength / (tanPhiHalf * dist);

                return 0.5 * projLength * canvasWidth;
            };
        }());

        // helper struct used to order tiles based on refinement priority
        function Candidate(tile, prio) {
            this.tile = tile;
            this.prio = prio;
        };

        // compare op to sort candidates by decreasing priority
        function moreImportant(c1, c2) {
            return c1.prio > c2.prio;
        };

        // Updates the timeStamp of the tile to the latest value.
        // If the tile is unknown, it has no effect.
        function updateTimeStamp(tile) {
            var tileInfo = _tiles[avp.tile2Index(tile)];
            if (tileInfo) {
                tileInfo.timeStamp = _timeStamp;
            }
        };

        // Given a list of required tiles, this method determines the most
        // important ones and triggers as many requests as simultaneously allowed.
        // Returns the number of newly sent requests
        function requestTiles(tiles, frustum, camPos) {

            // sort by decreasing priority
            tiles.sort(function (a, b) {
                var pa = computeTilePriority(a, frustum, camPos);
                var pb = computeTilePriority(b, frustum, camPos);
                return pb - pa;
            });

            // send as many requests as simultaneously allowed
            var newRequests = 0;
            for (var i = 0; i < tiles.length; i++) {

                // skip tiles for which there is already a running request
                var tileInfo = getTileInfo(tiles[i]);
                if (tileInfo && tileInfo.state == TileState_Loading) {
                    continue;
                }

                // wait for some requests to finish before we request more
                if (_numRequests >= _maxRequests) {
                    break;
                }

                requestTile(tiles[i]);

                newRequests++;
            }
            return newRequests;
        };

        function disposeMaterial(tileInfo) {
            // nothing to do if there is no material
            if (!tileInfo || !tileInfo.mesh || !tileInfo.mesh.material) {
                return;
            }

            // don't leak material in MaterialManager
            var mat = tileInfo.mesh.material;
            _materials.removeMaterial(mat.name);

            // free GPU resource. We need the memory right now and should
            // not wait for the garbage collector.
            mat.map.dispose();
        }

        /** Unregister all material from material texture and disposes textures. 
            Must be called when removing a RenderModel with this iterator.
         */
        this.dipose = function () {
            for (var i in _tiles) {
                disposeMaterial(_tiles[i]);
            }
        }

        // Delete tiles cached from previous frames to give space for new ones without
        // exceeding the maximum cache size.
        //
        //  @param {number}             requiredFreeSlots 
        //  @param {FrustumIntersector} frustum
        //  @param {THREE.Vector3}      camPos
        function cacheCleanup(requiredFreeSlots, frustum, camPos) {

            // collect indices of all tiles in memory
            var tileIndices = Object.keys(_tiles);

            // check how many free slots we have already
            var numTilesInMemory = tileIndices.length;
            var availableSlots = _cacheSize - numTilesInMemory;
            var missingSlots = requiredFreeSlots - availableSlots;

            if (missingSlots <= 0) {
                // No need to delete any tile from cache
                return;
            }

            // sort by increasing timeStamp and tile priority
            tileIndices.sort(function (a, b) {

                // compare based on timeStamps
                var tsa = _tiles[a].timeStamp;
                var tsb = _tiles[b].timeStamp;
                if (tsa != tsb) return tsa - tsb;

                // if timeStamps are equal, use priorites instead
                var tileA = avp.index2Tile(a);
                var tileB = avp.index2Tile(b);
                var prioA = computeTilePriority(tileA, frustum, camPos);
                var prioB = computeTilePriority(tileB, frustum, camPos);
                return prioA - prioB;
            });

            // delete tiles 
            var tilesToDelete = Math.min(missingSlots, tileIndices.length);
            for (var i = 0; i < tilesToDelete; i++) {
                var index = tileIndices[i];

                // don't remove tiles that are currently in use. It's better to
                // exceed the cache limit a bit than to permanently delete and load
                // the same tiles.
                if (_tiles[index].timeStamp == _timeStamp) {
                    break;
                }

                // dispose texture and unregister material from MaterialManager
                // Note that it is important here that each material is unique per tile.
                disposeMaterial(_tiles[index]);

                delete _tiles[index];
            }
        };

        /** Start iterator 
         *   @param: {FrustumIntersector} frustum  
         *   @param: {UnifiedCamera}      camera
         */
        this.reset = function (frustum, camera) {

            // clear scene
            _scene.children.length = 0;

            // track iterator restarts for LRU cache cleanup
            _timeStamp++;

            // reset counter for reused temp geometry.
            _nextFreeGeom = 0;

            // scene is empty as long as the root tile is not loaded
            var root = new avp.TileCoords(0, 0, 0);
            if (!tileLoaded(root)) {
                _done = true;
                return;
            }

            // Set of candidates, sorted by decreasing priority.                
            var candidates = new avp.SortedList(moreImportant);

            // start with root tile as only candidate
            var rootTile = new avp.TileCoords(0, 0, 0);
            var prio = computeTilePriority(rootTile, frustum, camera.position);
            candidates.add(new Candidate(rootTile, prio));

            // tiles that we will add to the scene
            var tiles = []; // {TileCoords[]}

            // Maximum allowed number of split operations starting at the root.
            // A single split operation refines a tile into its 4 child tiles.
            var MaxSplits = 100;

            // we collect requested tiles in an array. At the end, we sort them by 
            // importance and request the most important ones.
            var newRequests = []; // {TileCoords[]}

            for (var i = 0; i < MaxSplits; i++) {

                if (candidates.size() == 0) {
                    break;
                }

                // get and remove max-priority candidate
                var candidate = candidates.get(0);
                var maxPrioTile = candidate.tile;
                candidates.removeAt(0);

                // check if all 4 children are in memory
                var canBeRefined = true;

                // if the screen size of the tile is already smaller than its
                // image resolution, there is no point in further refinement.
                var screenSize = estimateScreenSize(maxPrioTile, camera.position, camera.fov, camera.clientWidth);
                if (screenSize < _config.tileSize) {
                    canBeRefined = false;
                }

                // With respect to resolution, the tile should be refined. 
                // Check if we have all children in memory.
                if (canBeRefined) {
                    canBeRefined = false;
                    for (var c = 0; c < 4; c++) {

                        var child = maxPrioTile.getChild(c);
                        var info = getTileInfo(child);

                        // ignore any tiles outside the image dimensions
                        if (tileOutside(child)) {
                            continue;
                        }

                        if (!tileLoaded(child)) {
                            // tile missing 
                            // => trigger request 
                            newRequests.push(child);
                        } else {
                            // if one or more children exist, we can 
                            // refine this tile.
                            canBeRefined = true;
                        }
                    }
                }

                if (!canBeRefined) {
                    // we cannot refine this tile yet. Just add tile directly.
                    tiles.push(maxPrioTile);
                } else {

                    // add 4 children as candidates
                    for (var c = 0; c < 4; c++) {
                        var child = maxPrioTile.getChild(c);
                        var prio = computeTilePriority(child, frustum, camera.position);

                        // skip tiles outside the image dimensions
                        if (tileOutside(child)) {
                            continue;
                        }

                        if (child.level == _config.maxLevel) {
                            // max-level reached. just collect tile, but don't refine more.
                            tiles.push(child);
                        } else {
                            // consider child as new candidate
                            candidates.add(new Candidate(child, prio));
                        }
                    }
                }
            }

            // add all remaining candidates that we could not refine anymore
            for (var i = 0; i < candidates.size() ; i++) {
                tiles.push(candidates.get(i).tile);
            }

            // track how many new textures we add in this frame.
            var numNewTextures = 0;

            // any redraws would produce the same result until a new tile arrives.
            _sceneChanged = false;

            // add tile shapes for all selected tiles to the scene
            for (var i = 0; i < tiles.length; ++i) {
                var tile = tiles[i];
                var shape = getTileShape(tile);

                if (shape && shape.material.map.needsUpdate) {
                    // this shape will trigger a new texture decode/upload in FireFlyRenderer
                    if (numNewTextures < _maxTextureUpdatesPerFrame) {
                        // just track number of new textures
                        numNewTextures++;
                    } else {
                        // don't allow more texture upload in this frame.
                        // use a fallback texture instead.
                        shape = createTileShape(tile, null, true);
                    }
                }

                // Some tiles might not be loaded yet, but already needed in 
                // order to show their loaded siblings at higher resolution.
                if (!shape) {
                    // For these tiles, we create a "fallback" tile that
                    // is using the material of a lower-resolution parent,
                    // but is instantly available. This makes tile loading significantly 
                    // faster, because we don't have wait for all siblings of tiles we need.
                    shape = createTileShape(tile, null);

                    // trigger redraw, so that the remaining texture uploads
                    // are done in subsequent frames.
                    _sceneChanged = true;
                }
                _scene.add(shape);

                // update timestamp for all tiles that we render
                updateTimeStamp(tile);

                // also include timeStamps of parent tiles, because
                //  - a parent's texture may actually be in the scene when used for a fallback tile.
                //  - parent tiles must be instantly available when deleting the higher-resolution tiles.
                var parent = tile.getParent();
                while (parent) {
                    updateTimeStamp(parent);
                    parent = parent.getParent();
                }
            }

            // return _scene in next nextBatch() call.
            _done = false;

            // send requests for missing tiles
            var numNewRequests = requestTiles(newRequests, frustum, camera.position);

            // clear tiles from LRU cache if needed
            // Note that we must not dispose any material that is used in this
            // frame. This is ensured, because we never delete tiles with
            // the current frame timestamp.
            cacheCleanup(numNewRequests, frustum, camera.position);
        };

        /** @returns {bool} Indicates that a full redraw is required to see the latest state. */
        this.update = function () {
            return _sceneChanged;
        }
    }

    return {
        TexQuadConfig: TexQuadConfig,
        ModelIteratorTexQuad: ModelIteratorTexQuad
    }
});