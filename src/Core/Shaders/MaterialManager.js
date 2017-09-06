define([
    '../Logger',
    './MaterialConverter',
    '../Privite/Fn/pathToURL',
    '../Privite/Fn/CreateCubeMapFromColors',
    '../Privite/Fn/DecodeEnvMap',
    '../Privite/Fn/CreateLinePatternTexture',
    './Fn/clonePrismMaterial',
    '../Global',
    './LineShader',
    '../Privite/Fn/loadTextureWithSecurity'
], function(
    Logger, 
    MaterialConverter, 
    pathToURL, 
    CreateCubeMapFromColors, 
    DecodeEnvMap,
    CreateLinePatternTexture,
    clonePrismMaterial,
    Global,
    LineShader,
    loadTextureWithSecurity
) {
    'use strict';
    /** @constructor */
    function MaterialManager(viewer) {
        this.viewer = viewer;
        var _this = this;

        var _materials = this.materials = {};
        var _materialsNonHDR = this.materialsNonHDR = {};
        this.textures = {};
        this.layerMaskTex = null;
        this.reflectionCube = null;
        this.irradianceMap = null;
        var _envMapExposure = 1;
        var _envRotationSin = 0.0;
        var _envRotationCos = 1.0;
        var _texturesToUpdate = [];
        this.hasPrism = false;
        this.renderPrism = true; //matches the default preferences setting

        // cutplanes array where all materials refer to
        var _cutplanes = [];

        this.defaultMaterial = new THREE.MeshPhongMaterial({
            ambient: 0x030303,
            color: 0x777777,
            specular: 0x333333,
            shininess: 30,
            shading: THREE.SmoothShading,
            reflectivity: 0
        });


        function is2dMaterial(name) {
            return name.indexOf("__lineMaterial__") != -1;
        }


        function getMaterialHash(svf, name) {

            if (is2dMaterial(name))
                return name;

            //In the Protein file, the materials have unhelpful names
            //like 0, 1, 2, so we prefix them with the SVF path to make them unique
            return svf.basePath + "|mat|" + name;
        }


        this.dtor = function () {

            this.cleanup();
            THREE.Cache.clear();
            this.viewer = null;
            _this = null;

        };


        this.findMaterial = function (model, name) {
            var mat = _materials[getMaterialHash(model, name)];

            //It's not expected that the material is null here, but in case
            //it is, warn and pick the first one available.
            if (!mat) {
                Logger.warn("Unknown material " + name + ". Using default.");
                mat = this.defaultMaterial;
            }

            return mat;
        };

        this.setRenderPrism = function (value) {
            this.renderPrism = value;
        };

        // Convert from LMV materials json to THREE.js materials
        this.convertMaterials = function (svf) {
            if (!svf.materials) {
                return 0;
            }

            if (svf.gltfMaterials) {

                var gltfmats = svf.materials["materials"];
                for (var p in gltfmats) {

                    var gltfMat = gltfmats[p];
                    var phongMat = MaterialConverter.convertMaterialGltf(gltfMat, svf);
                    var matName = getMaterialHash(svf, p);
                    this.addMaterial(matName, phongMat, false);

                }

                return;
            }

            //TODO: The code below needs to be refactored, with functions like isPrismMaterial moved
            //to MaterialConverter. Decal processing also.

            // get outer Protein materials block
            var prmats = svf.materials["materials"];
            var prismmats = svf.proteinMaterials ? svf.proteinMaterials["materials"] : null;
            var _renderPrism = this.renderPrism;
            var totalAdded = 0;

            for (var p in prmats) {

                var isPrism = false;

                if (prismmats) {
                    isPrism = _renderPrism && MaterialConverter.isPrismMaterial(prismmats[p]);
                }

                //If the definition is prism, use the prism object.
                var matObj = isPrism ? prismmats[p] : prmats[p];

                var phongMat = MaterialConverter.convertMaterial(matObj, isPrism);

                // TODO: do we want to check the global flag or drop that and rely on material only?
                if (!Global.isIE11 && svf.doubleSided)
                    phongMat.side = THREE.DoubleSide;

                var matName = getMaterialHash(svf, p);
                this.addMaterial(matName, phongMat, isPrism);
                totalAdded++;

                // Process decals
                if (matObj.decals) {
                    phongMat.decals = [];
                    for (var di = 0, dlen = matObj.decals.length; di < dlen; di++) {
                        var decal = matObj.decals[di];
                        isPrism = _renderPrism && MaterialConverter.isPrismMaterial(decal.material);
                        var material = MaterialConverter.convertMaterial(decal.material, isPrism);
                        phongMat.decals.push({
                            uv: decal.uv || 0,
                            material: material
                        });
                        this.addMaterial(matName + '|decal|' + di, material, isPrism);
                    }
                }
            }

            return totalAdded;
        };

        //Called at the beginning of every frame, to perform pending
        //operations like texture updates. This function also
        //has a chance to request full repaint at that time.
        this.updateMaterials = function () {

            while (_texturesToUpdate.length) {
                var def = _texturesToUpdate.pop();
                for (var j = 0; j < def.mats.length; j++) {
                    def.mats[j][def.slot] = def.tex;
                    def.mats[j].needsUpdate = true;

                    //If we knew that there are no transparent materials in the scene,
                    //we could just do a needsRender here instead of needsClear, to avoid flashing the model
                    //while loading textures.
                    this.viewer.invalidate(true/*clear*/, false/*render*/, false/*overlay*/);
                }
            }

        };



        this.loadTexture = function (material, svf) {

            if (!material.textureMaps)
                return;

            if (material.texturesLoaded)
                return;

            material.texturesLoaded = true;

            //TODO:NODE.JS
            if (Global.isNodeJS)
                return;

            // iterate and parse textures from ugly JSON
            // for each texture type in material
            //   if has URI and valid mapName
            //     load and initialize that texture
            var textures = material.textureMaps;
            for (var mapName in textures) {

                var map = textures[mapName];

                //TODO : It's possible that a texture is used as bitmap and bumpmap. In this situation,
                //if the bitmap is loaded first, the bumpscale won't be updated. To fix this, I added the
                //definition as part of the key. This is a easy fix but will make the texture loaded twice.
                //Ideally, we need to improve the current cache to save the texture properties like matrix,
                //invert flag, separately, because a texture can be used in many places and each of them can
                //have different properties.
                var texName = svf.basePath + map.uri + map.mapName/*this is the TODO above*/;

                var texEntry = _this.textures[texName];
                if (texEntry) {
                    //Is texture already loaded, then update the material immediately?
                    if (texEntry.tex) {
                        material[map.mapName] = texEntry.tex;
                        material.needsUpdate = true;
                    } else {
                        _this.textures[texName].mats.push(material);
                        _this.textures[texName].slots.push(map.mapName);
                    }
                } else {
                    var texPath = null;

                    //Of course, Prism uses a different CDN endpoint from Protein, so
                    //we have to distinguish between the two...
                    var isProteinMat = material.proteinType && material.proteinType.length;
                    var isPrism = isProteinMat && (material.proteinType.indexOf("Prism") === 0);

                    var isSharedTexture = (isPrism && PRISM_ROOT || isProteinMat && PROTEIN_ROOT) &&
                        (map.uri.indexOf("1/Mats") === 0 || map.uri.indexOf("2/Mats") === 0 || map.uri.indexOf("3/Mats") === 0);

                    if (isSharedTexture) {
                        if (isPrism) {
                            texPath = PRISM_ROOT + map.uri;
                        } else {
                            texPath = PROTEIN_ROOT + map.uri;
                        }
                    } else {

                        for (var j = 0; j < svf.manifest.assets.length; ++j) {
                            var asset = svf.manifest.assets[j];
                            if (asset.id == map.uri) {
                                texPath = pathToURL(svf.basePath + asset.URI);
                                break;
                            }
                        }

                        if (!texPath) {
                            texPath = pathToURL(svf.basePath + map.uri);
                        }
                    }

                    _this.textures[texName] = { mats: [material], slots: [map.mapName], tex: null };

                    //Annoying closure to capture the mutable loop variable texName for
                    //use in the load callback
                    var texture = (function (textureName, texturePath) {
                        return loadTextureWithSecurity(texturePath, THREE.UVMapping, function (tex) {

                            //It's possible MaterialManager got destroyed before the texture loads
                            if (!_this)
                                return;

                            tex.image = resizeImage(tex.image);

                            //Texture loaded successfully
                            var def = _this.textures[textureName];

                            //If the model was unloaded before the texture loaded,
                            //the texture def will no longer exist.
                            if (!def)
                                return;

                            if (!def.tex)
                                def.tex = tex;

                            //Set it on all materials that use it
                            for (var i = 0; i < def.mats.length; i++)
                                def.mats[i][def.slots[i]] = tex;

                            //Keep track of materials that need updating on the
                            //next frame. We can use this to throttle texture GPU upload
                            _texturesToUpdate.push(def);
                        }, svf.acmSessionId);
                    })(texName, texPath);

                    if (map.mapName == "bumpMap" || map.mapName == "normalMap") {
                        texture.anisotropy = 0;
                    }
                    else {
                        texture.anisotropy = this.viewer.renderer().getMaxAnisotropy();
                    }

                    // default params
                    texture.flipY = (map.flipY !== undefined) ? map.flipY : true;
                    texture.invert = false;
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;

                    // extract / construct texture params from JSON
                    MaterialConverter.convertTexture(map.textureObj, texture, svf.materials.scene.SceneUnit, map.isPrism);
                }
            }
        };


        //Textures delayed until all geometry is loaded,
        //hence not done in convertMaterials
        this.loadTextures = function (svf) {
            for (var p in _materials) {

                //Prevent textures for already loaded models from being loaded
                //again. Not elegant, and we can somehow only process the materials
                //per model.
                if (p.indexOf(svf.basePath) == -1)
                    continue;

                var material = _materials[p];
                this.loadTexture(material, svf);
            }
        };


        this.create2DMaterial = function (svf, material, isIdMaterial, isSelectionMaterial) {

            //Create a hash string of the material to see if we have
            //already created it
            var hash = "__lineMaterial__";
            if (material.image)
                hash += "|image:" + material.image.name;
            if (material.clip)
                hash += "|clip:" + JSON.stringify(material.clip);
            if (isIdMaterial)
                hash += "|id";
            if (isSelectionMaterial)
                hash += "|selection";
            if (material.skipEllipticals)
                hash += "|skipEllipticals";
            if (material.skipCircles)
                hash += "|skipCircles";
            if (material.skipTriangleGeoms)
                hash += "|skipTriangleGeoms";
            if (material.useInstancing)
                hash += "|useInstancing";
            if (svf)
                hash += "|" + svf ? svf.basePath : "runtime";

            hash = getMaterialHash(null, hash);

            if (!_materials.hasOwnProperty(hash)) {
                // var avs = av.Shaders;
                var lineMaterial = new THREE.ShaderMaterial(
                    {
                        fragmentShader: LineShader.fragmentShader,
                        vertexShader: LineShader.vertexShader,
                        uniforms: THREE.UniformsUtils.clone(LineShader.uniforms),
                        attributes: LineShader.attributes,
                        defines: THREE.UniformsUtils.clone(LineShader.defines),
                        transparent: true
                    }
                );

                lineMaterial.depthWrite = false;
                lineMaterial.depthTest = false;
                lineMaterial.side = THREE.DoubleSide;
                lineMaterial.blending = THREE.NormalBlending;

                if (isIdMaterial) {
                    //Is the caller requesting the special case of
                    //shader that outputs just IDs (needed when MRT not available)?
                    lineMaterial.defines["ID_COLOR"] = 1;
                    lineMaterial.blending = THREE.NoBlending;
                }
                else if (isSelectionMaterial) {
                    this.setSelectionTexture(lineMaterial);
                    lineMaterial.defines["SELECTION_RENDERER"] = 1;
                    lineMaterial.uniforms["selectionColor"].value = new THREE.Vector4(0, 0, 1, 1);
                }
                else {
                    if (this.viewer.renderer().hasMRT()) {
                        //If the renderer can do MRT, enable it in the shader
                        //so we don't have to draw the ID buffer separately.
                        lineMaterial.mrtIdBuffer = this.viewer.renderer().settings.numIdTargets;
                    }
                }

                if (!material.skipEllipticals) {
                    lineMaterial.defines["HAS_ELLIPTICALS"] = 1;
                }

                if (!material.skipCircles) {
                    lineMaterial.defines["HAS_CIRCLES"] = 1;
                }

                if (!material.skipTriangleGeoms) {
                    lineMaterial.defines["HAS_TRIANGLE_GEOMS"] = 1;
                }

                if (material.useInstancing) {
                    lineMaterial.defines["USE_INSTANCING"] = 1;
                }

                if (this.layerMaskTex) {
                    lineMaterial.defines["HAS_LAYERS"] = 1;
                    lineMaterial.uniforms["tLayerMask"].value = _this.layerMaskTex;
                }

                if (this.lineStyleTex) {
                    lineMaterial.defines["HAS_LINESTYLES"] = 1;
                    lineMaterial.defines["MAX_LINESTYLE_LENGTH"] = _this.lineStyleTex.image.width;
                    lineMaterial.uniforms["tLineStyle"].value = _this.lineStyleTex;
                    lineMaterial.uniforms["vLineStyleTexSize"].value.set(_this.lineStyleTex.image.width, _this.lineStyleTex.image.height);
                }

                if (material.image) {

                    //TODO:NODE.JS
                    if (!Global.isNodeJS) {

                        var scope = this;

                        var onTexLoad = function (texture) {

                            //Possibly, viewer was destroyed before texture load completed.
                            if (!scope.viewer)
                                return;

                            texture.image = resizeImage(texture.image);

                            texture.wrapS = THREE.ClampToEdgeWrapping;
                            texture.wrapT = THREE.ClampToEdgeWrapping;
                            texture.minFilter = THREE.LinearMipMapLinearFilter;
                            texture.magFilter = THREE.LinearFilter;
                            texture.anisotropy = 1;//this.viewer.renderer().getMaxAnisotropy();
                            texture.flipY = true;
                            texture.generateMipmaps = true;

                            texture.needsUpdate = true;

                            lineMaterial.defines["HAS_RASTER_QUADS"] = 1;
                            lineMaterial.uniforms["tRaster"].value = texture;
                            if (material.image.dataURI.indexOf("png") != -1)
                                lineMaterial.transparent = true;
                            lineMaterial.needsUpdate = true;
                            scope.viewer.invalidate(false, true, false);
                        };

                        loadTextureWithSecurity(material.image.dataURI, THREE.UVMapping, onTexLoad, svf.acmSessionId);
                    }
                }

                lineMaterial.modelScale = material.modelScale || 1;

                _materials[hash] = lineMaterial;
            }

            return hash;
        };


        //TODO: unify this logic with inittMaterials
        this.addMaterial = function (name, mat, skipHeuristics) {

            //Using post-gamma luminance, since input colors are assumed to
            //have gamma (non-linearized).
            function luminance(c) {
                return (0.299 * c.r) + (0.587 * c.g) + (0.114 * c.b);
            }

            var proteinMaterial = mat.proteinMat ? mat.proteinMat : null;
            var isPrism = (mat.proteinType && mat.proteinType.indexOf("Prism") != -1);

            this.hasPrism = isPrism || this.hasPrism;

            //apply various modifications to fit our rendering pipeline
            if (!skipHeuristics) {

                //This pile of crazy hacks maps the various flavors of materials
                //to the shader parameters that we can handle.

                if (mat.metal) {

                    if (!mat.reflectivity) {
                        mat.reflectivity = luminance(mat.specular);
                    }

                    //Special handling for Protein and Prism metals
                    if (proteinMaterial) {
                        //For Prism metals, reflectivity is set to 1 and
                        //the magnitude of the specular component acts
                        //as reflectivity.
                        if (mat.reflectivity === 1)
                            mat.reflectivity = luminance(mat.specular);

                        if (mat.color.r === 0 && mat.color.g === 0 && mat.color.b === 0) {
                            //Prism metals have no diffuse at all, but we need a very small
                            //amount of it to look reasonable
                            //mat.color.r = mat.specular.r * 0.1;
                            //mat.color.g = mat.specular.g * 0.1;
                            //mat.color.b = mat.specular.b * 0.1;
                        }
                        else {
                            //For Protein metals, we get a diffuse that is full powered, so we
                            //scale it down
                            mat.color.r *= 0.1;
                            mat.color.g *= 0.1;
                            mat.color.b *= 0.1;
                        }
                    }
                }
                else {
                    //Non-metal materials

                    if (isPrism) {
                        var isMetallic = false;

                        if (mat.proteinType == "PrismLayered") {
                            //For layered materials, the Prism->Simple translator
                            //stores something other than reflectivity in the
                            //reflectivity term. We also do special handling
                            //for paint clearcoat, and metallic paint. Longer term,
                            //the good solution is to add things we do support to the Simple
                            //representation, or failing that, support native Prism definitions.
                            mat.clearcoat = true;
                            mat.reflectivity = 0.06;

                            if (proteinMaterial) {
                                var matDef = proteinMaterial["materials"][proteinMaterial["userassets"][0]];
                                var cats = matDef.categories;
                                if (cats && cats.length && cats[0].indexOf("Metal") != -1) {
                                    isMetallic = true;
                                }
                            }
                        }

                        //De-linearize this value in case of Prism, since there it
                        //seems to be physical (unlike the color values)
                        mat.reflectivity = Math.sqrt(mat.reflectivity);

                        if (isMetallic) {
                            //metallic paint has specular = diffuse in Prism.
                            mat.specular.copy(mat.color);
                        }
                        else {
                            //Prism non-metals just leave the specular term as 1,
                            //relying on reflectivity alone, but our shader needs
                            //both in different code paths.
                            mat.specular.r = mat.reflectivity;
                            mat.specular.g = mat.reflectivity;
                            mat.specular.b = mat.reflectivity;
                        }
                    }
                    else {
                        //Get a reasonable reflectivity value if there isn't any
                        if (!mat.reflectivity) {
                            if (mat.color.r === 1 && mat.color.g === 1 && mat.color.b === 1 &&
                                mat.specular.r === 1 && mat.specular.g === 1 && mat.specular.b === 1 &&
                                (!mat.textureMaps || (!mat.textureMaps.map && !mat.textureMaps.specularMap))) {
                                //This covers specific cases in DWF where metals get diffuse=specular=1.
                                mat.metal = true;
                                mat.reflectivity = 0.7;

                                mat.color.r *= 0.1;
                                mat.color.g *= 0.1;
                                mat.color.b *= 0.1;
                            } else {

                                //General case
                                //For non-metallic materials, reflectivity
                                //varies very little in the range 0.03-0.06 or so
                                //and is never below 0.02.
                                mat.reflectivity = 0.01 + 0.06 * luminance(mat.specular);

                                //For non-metals, reflectivity is either set
                                //correctly or we estimate it above, and the specular color
                                //just carries the hue
                                //Note: Protein (but not Prism) seems to have consistently high reflectivity
                                //values for its non-metals.
                                mat.specular.r *= mat.reflectivity;
                                mat.specular.g *= mat.reflectivity;
                                mat.specular.b *= mat.reflectivity;
                            }

                        } else if (mat.reflectivity > 0.3) {
                            //If reflectivity is set explicitly to a high value, but metal is not, assume
                            //the material is metallic anyway and set specular=diffuse
                            //This covers specific cases in DWF.

                            mat.metal = true;
                            mat.specular.r = mat.color.r;
                            mat.specular.g = mat.color.g;
                            mat.specular.b = mat.color.b;

                            mat.color.r *= 0.1;
                            mat.color.g *= 0.1;
                            mat.color.b *= 0.1;
                        } else {
                            //For non-metals, reflectivity is either set
                            //correctly or we estimate it above, and the specular color
                            //just carries the hue
                            //Note: Protein (but not Prism) seems to have consistently high reflectivity
                            //values for its non-metals.
                            mat.specular.r *= mat.reflectivity;
                            mat.specular.g *= mat.reflectivity;
                            mat.specular.b *= mat.reflectivity;
                        }

                        //For transparent non-layered materials, the reflectivity uniform is
                        //used for scaling the Fresnel reflection at oblique angles
                        //This is a non-physical hack to make stuff like ghosting
                        //look reasonable, while having glass still reflect at oblique angles
                        if (mat.opacity < 1)
                            mat.reflectivity = 1.0;
                    }
                }

                //Alpha test for materials with textures that are potentially opacity maps
                if (mat.transparent ||
                    (mat.textureMaps && ((mat.textureMaps.map && mat.textureMaps.map.uri.toLowerCase().indexOf(".png") != -1) ||
                                          mat.textureMaps.opacityMap))) {
                    mat.alphaTest = 0.01;
                }
            }

            if (mat.textureMaps && mat.textureMaps.normalMap) {
                var scale = mat.bumpScale;
                if (scale === undefined || scale >= 1)
                    scale = 1;

                mat.normalScale = new THREE.Vector2(scale, scale);
            }
            else {
                if (mat.bumpScale === undefined && mat.textureMaps && (mat.textureMaps.map || mat.textureMaps.bumpMap))
                    mat.bumpScale = 0.03; //seems like a good subtle default if not given
                else if (mat.bumpScale >= 1) //Protein generic mat sometimes comes with just 1.0 which can't be right...
                    mat.bumpScale = 0.03;
            }

            if (mat.shininess !== undefined) {
                //Blinn to Phong (for blurred environment map sampling)
                mat.shininess *= 0.25;
            }

            if (_this.reflectionCube && !mat.disableEnvMap)
                mat.envMap = _this.reflectionCube;

            if (_this.irradianceMap)
                mat.irradianceMap = _this.irradianceMap;

            mat.exposureBias = Math.pow(2.0, this.viewer.renderer().getExposureBias());
            mat.tonemapOutput = this.viewer.renderer().getToneMapMethod();
            mat.envMapExposure = _envMapExposure;
            mat.envRotationSin = _envRotationSin;
            mat.envRotationCos = _envRotationCos;

            this.viewer.renderer().applyMRTFlags(mat);

            //if (mat.opacity < 1.0 || (mat.textureMaps && mat.textureMaps.opacityMap))
            //    mat.side = THREE.DoubleSide;

            if (mat.side == THREE.DoubleSide)
                this.viewer.renderer().toggleTwoSided(true);

            mat.cutplanes = _cutplanes;

            _materials[name] = mat;
        };

        this.addMaterialNonHDR = function (name, mat) {
            mat.cutplanes = _cutplanes;
            _materialsNonHDR[name] = mat;
        };

        this.togglePolygonOffset = function (state) {

            for (var p in _materials) {
                var mat = _materials[p];
                if (mat instanceof THREE.MeshPhongMaterial) {
                    mat.polygonOffset = true;
                    mat.polygonOffsetFactor = state ? 1 : 0;
                    mat.polygonOffsetUnits = state ? 0.1 : 0;  // 1.0 is much too high, see LMV-1072; may need more adjustment
                    mat.needsUpdate = true;
                }
            }

        };

        //Certain material properties only become available
        //once we see a geometry that uses the material. Here,
        //we modify the material based on a given geometry that's using it.
        this.applyGeometryFlagsToMaterial = function (material, threegeom) {

            if (threegeom.attributes.color) {
                //TODO: Are we likely to get the same
                //material used both with and without vertex colors?
                //If yes, then we need two versions of the material.
                material.vertexColors = THREE.VertexColors;
                material.needsUpdate = true;
            }

            //If we detect a repeating texture in the geometry, we assume
            //it is some kind of material roughness pattern and reuse
            //the texture as a low-perturbation bump map as well.
            if (!material.proteinType && threegeom.attributes.uv && threegeom.attributes.uv.isPattern) {
                if (material.map && !material.bumpMap) {
                    material.bumpMap = material.map;
                    material.needsUpdate = true;
                }
                if (material.textureMaps && material.textureMaps.map && !material.textureMaps.bumpMap) {
                    material.textureMaps.bumpMap = material.textureMaps.map;
                    material.needsUpdate = true;
                }
            }

        };

        //Turns MRT rendering on/off in each material's shader
        this.toggleMRTSetting = function () {

            for (var p in _materials) {
                var m = _materials[p];
                if (!is2dMaterial(p))
                    this.viewer.renderer().applyMRTFlags(m);
            }

        };

        this.updatePixelScale = function (pixelsPerUnit) {

            var mats = _materials;
            for (var p in mats) {
                if (is2dMaterial(p)) {
                    var m = mats[p];
                    m.uniforms["aaRange"].value = 0.5 / (pixelsPerUnit * m.modelScale);
                    m.uniforms["pixelsPerUnit"].value = (pixelsPerUnit * m.modelScale);
                }
            }

        };

        this.updateSwapBlackAndWhite = function (reverse) {

            var mats = _materials;
            for (var p in mats) {
                if (is2dMaterial(p)) {
                    var m = mats[p];
                    m.uniforms["swap"].value = reverse ? 1.0 : 0.0;
                }
            }

        };

        this.updateViewportId = function (vpId) {

            var mats = _materials;
            for (var p in mats) {
                if (is2dMaterial(p)) {
                    var m = mats[p];
                    m.uniforms["viewportId"].value = vpId;
                    m.needsUpdate = true;
                }
            }

            this.viewer.invalidate(true);
        };

        this.setCubeMapFromColors = function (ctop, cbot) {

            var texture = CreateCubeMapFromColors(ctop, cbot);

            _this.reflectionCube = texture;
            _this.reflectionCube.isBgColor = true;

            for (var p in _materials) {
                var m = _materials[p];
                if (!m.disableEnvMap) {
                    m.envMap = texture;
                    m.needsUpdate = true;
                }
            }

            this.viewer.invalidate(true);

            return _this.reflectionCube;
        };

        this.setCubeMap = function (path, exposure) {

            var self = this;

            var mapDecodeDone = function (map) {

                self.reflectionCube = map;

                if (self.reflectionCube) {
                    for (var p in _materials) {
                        var m = _materials[p];
                        if (!m.disableEnvMap) {
                            m.envMap = _this.reflectionCube;
                            m.needsUpdate = true;
                        }
                    }
                }
                else {
                    self.setCubeMapFromColors(self.viewer.clearColorTop, self.viewer.clearColorBottom);
                }

                self.viewer.invalidate(true);
            };

            var texLoadDone = function (map) {

                if (map) {
                    map.mapping = THREE.CubeReflectionMapping;
                    map.LogLuv = path.indexOf("logluv") != -1;
                    map.RGBM = path.indexOf("rgbm") != -1;

                    // TODO: Turn on use of half-float textures for envmaps. Disable due to blackness on Safari.
                    DecodeEnvMap(map, exposure, false /*isMobileDevice() ? false : this.viewer.glrenderer().supportsHalfFloatTextures()*/, mapDecodeDone);
                } else {
                    mapDecodeDone(map);
                }

            };

            if (Array.isArray(path)) {
                this.reflectionCube = THREE.ImageUtils.loadTextureCube(path, THREE.CubeReflectionMapping, texLoadDone);
                this.reflectionCube.format = THREE.RGBFormat;
            }
            else if (typeof path == "string") {
                if (path.toLowerCase().indexOf(".dds") != -1) {
                    this.reflectionCube = new THREE.DDSLoader().load(path, texLoadDone);
                }
                else {
                    this.reflectionCube = THREE.ImageUtils.loadTexture(path, THREE.SphericalReflectionMapping, mapDecodeDone);
                    this.reflectionCube.format = THREE.RGBFormat;
                }
            } else if (path) {
                //here we assume path is already a texture object
                mapDecodeDone(path);
            }
            else {
                mapDecodeDone(null);
            }

            return self.reflectionCube;
        };


        this.setIrradianceMap = function (path, exposure) {

            var self = this;

            var mapDecodeDone = function (map) {

                for (var p in _materials) {
                    var m = _materials[p];
                    m.irradianceMap = map;
                    m.needsUpdate = true;
                }

                self.irradianceMap = map;
                self.viewer.invalidate(true);
            };

            var texLoadDone = function (map) {
                if (map) {
                    map.mapping = THREE.CubeReflectionMapping;
                    map.LogLuv = path.indexOf("logluv") != -1;
                    map.RGBM = path.indexOf("rgbm") != -1;

                    // TODO: Turn on use of half-float textures for envmaps. Disable due to blackness on Safari.
                    DecodeEnvMap(map, exposure, false /*isMobileDevice() ? false : this.viewer.glrenderer().supportsHalfFloatTextures()*/, mapDecodeDone);

                }
                else {
                    if (self.irradianceMap)
                        mapDecodeDone(null);
                }
            };

            THREE.ImageUtils.crossOrigin = "";

            if (Array.isArray(path)) {
                _this.irradianceMap = THREE.ImageUtils.loadTextureCube(path, THREE.CubeReflectionMapping, mapDecodeDone);
                _this.irradianceMap.format = THREE.RGBFormat;
            }
            else if (typeof path == "string") {
                if (path.toLowerCase().indexOf(".dds") != -1) {
                    this.irradianceMap = new THREE.DDSLoader().load(path, texLoadDone);
                }
            } else if (path) {
                //here we assume path is already a texture object
                mapDecodeDone(path);
            }
            else {
                mapDecodeDone(null);
            }

            return self.irradianceMap;
        };


        this.setTonemapMethod = function (method) {

            for (var p in _materials) {
                var m = _materials[p];
                m.tonemapOutput = method;
                m.needsUpdate = true;
            }

        };

        /**
         * An additional multiplier of 2^envExposure will be applied
         * to the environment map intensities, in case RGBM environment map is used.
         */
        this.setEnvExposure = function (envExposure) {

            var scale = Math.pow(2.0, envExposure);
            _envMapExposure = scale;

            for (var p in _materials) {
                var m = _materials[p];
                m.envMapExposure = scale;
                m.needsUpdate = true;
            }

        };

        /*
         * Adjust orientation of the environment.
         * @param rotation Relative angle in radians (-Pi..Pi).
         */
        this.setEnvRotation = function (rotation) {
            _envRotationSin = Math.sin(rotation);
            _envRotationCos = Math.cos(rotation);
            for (var p in _materials) {
                var m = _materials[p];
                m.envRotationSin = _envRotationSin;
                m.envRotationCos = _envRotationCos;
                m.needsUpdate = true;
            }
        };

        /**
         * Exposure correction of 2^exposureBias applied to rendered output color before passing into
         * the tone mapper.
         */
        this.setTonemapExposureBias = function (exposureBias) {

            var bias = Math.pow(2.0, exposureBias);

            for (var p in _materials) {
                var m = _materials[p];
                m.exposureBias = bias;
                m.needsUpdate = true;
            }

        };


        //Creates a texture where each pixel corresponds to the visibility
        //of a 2D layer. The LineShader samples the texture to determine if
        //a geometry is visible based on its layer visibility.
        this.initLayersTexture = function (model) {

            //TODO: Once arbitrary layer texture size works
            //we can base the allocation size on the layerCount
            var count = model.getData().layerCount;
            var tw = 256;

            //TODO: Currently the shader math is limited to
            //a square 256x256 layers mask, since it just does a
            //scale of the two layer bytes by 1/255. We would need to
            //send the height of the layer texture to do something smarter,
            //or wait for texture size query in WebGL 2.
            //var th = 0 | Math.ceil((layersList.length) / 256.0);
            var th = 256;

            var layerMask = new Uint8Array(tw * th);
            for (var l = 0, lEnd = count; l < lEnd; l++) {
                layerMask[l] = 0xff;
            }

            var layerMaskTex = new THREE.DataTexture(layerMask, tw, th,
                                                     THREE.LuminanceFormat,
                                                     THREE.UnsignedByteType,
                                                     THREE.UVMapping,
                                                     THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
                                                     THREE.NearestFilter, THREE.NearestFilter, 0);
            layerMaskTex.generateMipmaps = false;
            layerMaskTex.flipY = false;
            layerMaskTex.needsUpdate = true;

            //TODO: These are per-model, so we will need
            //to remember multiple sets in case we support
            //multi-drawing views.
            this.layerMaskTex = layerMaskTex;
            this.layersMap = model.getData().layersMap;

        };


        this.initLineStyleTexture = function () {

            this.lineStyleTex = CreateLinePatternTexture();

        };

        /** @param {number} maxObjectCount Upper boundary of all ids we can expect. Used to determine required size. */
        this.initSelectionTexture = function (maxObjectCount) {

            var numObj = maxObjectCount || 1;

            // determine texture extents
            var tw = 4096; //NOTE: This size is assumed in the shader, so update the shader if this changes!
            var th = 0 | Math.ceil(numObj / tw);
            var p2 = 1;
            while (p2 < th)
                p2 *= 2;
            th = p2;

            // init all pixels with 0
            var selectionMask = new Uint8Array(tw * th);
            for (var i = 0; i < numObj; i++) {
                selectionMask[i] = 0;
            }

            // create texture
            var selectionTex = new THREE.DataTexture(selectionMask, tw, th,
                THREE.LuminanceFormat,
                THREE.UnsignedByteType,
                THREE.UVMapping,
                THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
                THREE.NearestFilter, THREE.NearestFilter, 0);
            selectionTex.generateMipmaps = false;
            selectionTex.flipY = false;
            selectionTex.needsUpdate = true;

            this.selectionTex = selectionTex;
        }

        /** Set shader params to make the selection texture available for a given 2D material shader. Used for ghosting and highlighting.
         *   @param {THREE.Material} material - A 2D material (see LineShader.js)*/
        this.setSelectionTexture = function (material) {

            // If selection texture is not initialized yet, the texture will be assigned later (see initSelectionTexture)
            if (!this.selectionTex) {
                return;
            }

            // Note that selectionTex is a THREE.DataTexture, so that selectionTex.image is not really an image object.
            // But width and height properties exist for the data object as well.
            var data = this.selectionTex.image;

            material.uniforms["tSelectionTexture"].value = this.selectionTex;
            material.uniforms["vSelTexSize"].value.set(data.width, data.height);
            material.needsUpdate = true;
        }

        this.init2DSelectionMaterial = function (model) {

            if (!this.selectionTex) {
                this.initSelectionTexture(model.myData.maxObjectNumber);
            }

            var hash = this.create2DMaterial(model.getData(), {}, false, true);
            var m = _materials[hash];

            return m;
        };

        //Toggles 2D layer visibility by setting the corresponding
        //pixel in the layers texture.
        this.setLayerVisible = function (layerIndexes, visible) {
            var layerMaskTex = this.layerMaskTex,
                layerMaskData = layerMaskTex.image.data,
                layersMap = this.layersMap,
                mask = visible ? 0xff : 0;

            for (var i = 0; i < layerIndexes.length; ++i) {
                var layerIndex = layerIndexes[i];
                layerMaskData[layersMap[layerIndex]] = mask;
            }

            layerMaskTex.needsUpdate = true;

            for (var p in _materials) {
                if (is2dMaterial(p))
                    _materials[p].needsUpdate = true;
            }

            this.viewer.invalidate(true);
        };

        this.isLayerVisible = function (layerIndex) {
            return !!this.layerMaskTex.image.data[this.layersMap[layerIndex]];
        };

        //Meshes for 2d drawings contain many objects in a single mesh.
        //So we use a mask texture to pick out which object specifically
        //to highlight or render in ghosted style. The shader samples this texture to deside whether
        //to draw or not.
        this.highlightObject2D = function (dbId, state) {
            var data = this.selectionTex.image.data;

            data[dbId] = state ? 0xff : 0;

            //TODO: partial texture update using TexSubImage possible?
            this.selectionTex.needsUpdate = true;

            this.viewer.invalidate(false, false, true);

        };

        this.cloneMaterial = function (mat) {

            var material = mat.isPrismMaterial ? clonePrismMaterial(mat) : mat.clone();

            // clone additional properties
            if (material instanceof THREE.MeshPhongMaterial || material.isPrismMaterial) {
                material.packedNormals = mat.packedNormals;
                material.exposureBias = mat.exposureBias;
                material.irradianceMap = mat.irradianceMap;
                material.envMapExposure = mat.envMapExposure;
                material.envRotationSin = mat.envRotationSin;
                material.envRotationCos = mat.envRotationCos;
                material.proteinType = mat.proteinType;
                material.proteinMat = mat.proteinMat;
                material.tonemapOutput = mat.tonemapOutput;
                material.cutplanes = mat.cutplanes;
            }

            this.viewer.renderer().applyMRTFlags(material);

            return material;
        };

        /**
         * Returns a copy of cut planes
         */
        this.getCutPlanes = function () {
            return _cutplanes.slice();
        };
        this.getCutPlanesRaw = function () {
            return _cutplanes;
        };


        /**
         * Sets cut planes for all materials
         * Clears any existing cutplanes and populates with the new ones
         * If empty array or undefined, cut planes will be turned off (cleared)
         */
        this.setCutPlanes = function (cutplanes) {
            // update mat shaders, if num of planes changed
            if (_cutplanes.length !== (cutplanes ? cutplanes.length || 0 : 0)) {
                var p;
                for (p in _materials) {
                    _materials[p].needsUpdate = true;
                    if (cutplanes && cutplanes.length > 0) _materials[p].side = THREE.DoubleSide;
                }
                for (p in _materialsNonHDR)
                    _materialsNonHDR[p].needsUpdate = true;
            }

            // empty array (http://jsperf.com/empty-javascript-array)
            while (_cutplanes.length > 0) _cutplanes.pop();

            // copy cutplanes
            if (cutplanes) {
                for (var i = 0; i < cutplanes.length; i++) {
                    _cutplanes.push(cutplanes[i].clone());
                }
            }
        };

        /**
         * Deallocates any material related GL objects associated with the given model.
         */
        this.cleanup = function (svf) {

            //Dispose all textures that were loaded as part of the given SVF
            var newTex = {};

            for (var t in this.textures) {
                var tdef = this.textures[t];
                if (t.indexOf(svf.basePath) === -1)
                    newTex[t] = tdef;
                else if (tdef.tex)
                    tdef.tex.dispose();
            }
            this.textures = newTex;

            //Remove all materials that were used by the given SVF
            var newMats = {};
            var DISPOSE_EVENT = { type: 'dispose' };

            for (var m in _materials) {
                if (svf && m.indexOf(svf.basePath) === -1) {
                    newMats[m] = _materials[m];
                } else {
                    var mat = _materials[m];
                    mat.dispatchEvent(DISPOSE_EVENT);
                    mat.needsUpdate = true; //in case it gets used again
                }
            }

            _materials = this.materials = newMats;
        };


        this.addSimpleMaterial = function (id, simpleMaterial, svf) {
            var phongMat = MaterialConverter.convertMaterial(simpleMaterial);
            var matName = getMaterialHash(svf, id);
            this.addMaterial(matName, phongMat);
            this.loadTexture(phongMat, svf);
        };

        //Register the default material
        this.addMaterial("__defaultMaterial__", this.defaultMaterial);

        this.removeMaterial = function (name) {
            delete _materials[name];
        };
        //this.initLineStyleTexture();


    }

    function resizeImage(img) {
        
        var ow = img.width;
        var oh = img.height;

        //It's a power of two already
        if (((ow & (ow - 1)) === 0) && ((oh & (oh - 1)) === 0)) {
            return img;
        }

        var w = 1; while (w * 2 < ow) w *= 2;
        var h = 1; while (h * 2 < oh) h *= 2;

        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(img, 0, 0, w, h);

        return canvas;

    }

    return MaterialManager;

});