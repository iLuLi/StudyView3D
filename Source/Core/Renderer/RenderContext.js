define([
    '../Shaders/FireflyPhongShader',
    '../Shaders/PrismShader',
    '../Shaders/BackgroundShader',
    '../Shaders/BlendShader',
    '../Shaders/CelShader',
    '../Shaders/CopyShader',
    '../Shaders/FXAAShader',
    '../Shaders/LineShader',
    '../Shaders/NormalsShader',
    '../Shaders/SAOBlurShader',
    '../Shaders/SAOMinifyFirstShader',
    '../Shaders/SAOMinifyShader',
    '../Shaders/SAOShader',
    '../Shaders/FireflyBasicShader',
    '../Logger',
    '../Constants/DeviceType',
    './Pass/LmvShaderPass'
], function(
    FireflyPhongShader,
    PrismShader,
    BackgroundShader,
    BlendShader,
    CelShader,
    CopyShader,
    FXAAShader,
    LineShader,
    NormalsShader,
    SAOBlurShader,
    SAOMinifyFirstShader,
    SAOMinifyShader,
    SAOShader,
    FireflyBasicShader,
    Logger,
    DeviceType,
    LmvShaderPass
) {
    'use strict';
    /**
     * NVIDIA FXAA 3.11 by TIMOTHY LOTTES
     * "PC VERSION" Quality, ported to WebGL
     * https://gist.githubusercontent.com/bkaradzic/6011431/raw/92a3737404c0e764fa554077b16e07a46442da51/Fxaa3_11.h
     */
    function RenderContext() {
        
        var _renderer;
        var _depthMaterial;
        var _idMaterial;

        //The camera and lights used for an entire progressive pass (potentially several GL frames)
        var _camera;
        var _lights;

        var _clearPass,
            _saoBlurPass,
            _saoPass,
            _saoMipPass,
            _saoMipFirstPass,
            _fxaaPass,
            _celPass,
            _blendPass,
            _copyPass;

        var _saoBufferValid = false;

        var _lastX, _lastY, _lastID, _lastModelID, _lastIDValid = false;

        var _depthTarget;
        var _depthMipMap = null;
        var _colorTarget = null;
        var _overlayTarget = null;
        var _postTarget1 = null;
        var _postTarget2 = null;
        var _idTargets = [];

        var _exposureBias = 0.0;
        var _envRotation = 0.0;
        var _tonemapMethod = 0;
        var _unitScale = 1.0;

        var _w, _h;
        var _warnedLeak = false;

        var _readbackBuffer = new Uint8Array(4);

        var _white = new THREE.Color().setRGB(1, 1, 1);
        var _black = new THREE.Color().setRGB(0, 0, 0);
        var _clearColor = null;
        var _blockMRT = false;
        var _isWeakDevice = false;

        var _mrtFloat32Works = false;
        var _mrtRGBA8Works = false;
        var _renderTargetFormat;

        var _lastObjTime = 0,
            _lastHighlightId = 0,
            _lastHighlightModelId = 0,
            _easeCurve = [0.42, 0, 1, 1],
            _easeSpeed = 0.004;

        //Rendering options
        var _settings = {
            antialias: true,
            sao: false,
            useHdrTarget: false,
            haveTwoSided: false,
            useSSAA: false, /* Whether to use supersampled targets when antialiasing is used (default is FXAA) */
            idbuffer: true,
            customPresentPass: false,
            toonShaded: false,
            envMapBg: false,
            numIdTargets: 1 //must be 1 or 2
        };

        var _oldSettings = {};

        // var avs = Autodesk.Viewing.Shaders;


        //TODO: hide this once there is a way
        //to obtain the current pipeline configuration
        this.settings = _settings;


        this.init = function (glrenderer, width, height) {

            // avs.init_ShaderChunks(THREE);
            // avs.init_FireflyPhongShader(THREE);
            // avs.init_FireflyPrismShader(THREE);
            // avs.init_BackgroundShader(THREE);
            // avs.init_BlendShader(THREE);
            // avs.init_CelShader(THREE);
            // avs.init_CopyShader(THREE);
            // avs.init_FXAAShader(THREE);
            // avs.init_LineShader(THREE);
            // avs.init_NormalsShader(THREE);
            // avs.init_SAOBlurShader(THREE);
            // avs.init_SAOMinifyShader(THREE);
            // avs.init_SAOShader(THREE);
            // avs.init_FireflyBasicShader(THREE);

            createRenderPasses();

            if (!glrenderer) {
                Logger.error("You need a gl context to make a renderer. Things will go downhill from here.");
                return;
            }

            //Firefox on Mac OSX reports it can do MRT, but it actually does not work in our case,
            //so we have to detect this case manually.
            _blockMRT = window.navigator.userAgent.indexOf("Firefox") != -1 && window.navigator.userAgent.indexOf("Mac OS") != -1;

            //Rendering to RGB32F is broken as of Firefox 45, so we use alternative render target format until it works again.
            var isBrokenFF = window.navigator.userAgent.indexOf("Firefox") != -1;

            //RGB32F is not renderable on Firefox/Windows now, so we use RGBA instead.
            //NOTE: This assumes MRT does not work on Firefox/Windows with RGB32F target either. If it does, then
            //we have to use the same format for the color and id targets.
            _renderTargetFormat = isBrokenFF ? THREE.RGBAFormat : THREE.RGBFormat;

            _isWeakDevice = DeviceType.isMobileDevice;

            _settings.idbuffer = !_isWeakDevice;

            _w = width;
            _h = height;

            _renderer = glrenderer;

            //delayed until first begin frame
            //this.initPostPipeline(_settings.sao, _settings.antialias);

        };


        function createRenderPasses() {

            function setNoDepthNoBlend(pass) {
                pass.material.blending = THREE.NoBlending;
                pass.material.depthWrite = false;
                pass.material.depthTest = false;
            }

            var depthShader = NormalsShader;

            _depthMaterial = new THREE.ShaderMaterial({
                fragmentShader: depthShader.fragmentShader,
                vertexShader: depthShader.vertexShader,
                uniforms: THREE.UniformsUtils.clone(depthShader.uniforms)
            });
            _depthMaterial.blending = THREE.NoBlending;
            _depthMaterial.packedNormals = true;

            // Prepare an alternative normal/depth material without cutplanes to render section caps
            _depthMaterial._noCutplanesMaterial = _depthMaterial.clone();
            _depthMaterial._noCutplanesMaterial.cutplanes = null;
            _depthMaterial._noCutplanesMaterial.blending = THREE.NoBlending;
            _depthMaterial._noCutplanesMaterial.packedNormals = true;

            _saoPass = new LmvShaderPass(SAOShader);
            setNoDepthNoBlend(_saoPass);

            _saoBlurPass = new LmvShaderPass(SAOBlurShader);
            setNoDepthNoBlend(_saoBlurPass);

            _saoMipFirstPass = new LmvShaderPass(SAOMinifyFirstShader);
            setNoDepthNoBlend(_saoMipFirstPass);

            _saoMipPass = new LmvShaderPass(SAOMinifyShader);
            setNoDepthNoBlend(_saoMipPass);

            _fxaaPass = new LmvShaderPass(FXAAShader);
            setNoDepthNoBlend(_fxaaPass);

            _celPass = new LmvShaderPass(CelShader);
            setNoDepthNoBlend(_celPass);

            _blendPass = new LmvShaderPass(BlendShader);
            setNoDepthNoBlend(_blendPass);

            _clearPass = new LmvShaderPass(BackgroundShader);
            setNoDepthNoBlend(_clearPass);

            _copyPass = new LmvShaderPass(CopyShader);
            setNoDepthNoBlend(_copyPass);
        }


        function cubicBezier(p, t) {
            //var cx = 3.0 * p[0];
            //var bx = 3.0 * (p[2] - p[0]) - cx;
            //var ax = 1.0 - cx -bx;
            var cy = 3.0 * p[1];
            var by = 3.0 * (p[3] - p[1]) - cy;
            var ay = 1.0 - cy - by;

            //return ((ax * t + bx) * t + cx) * t;
            return ((ay * t + by) * t + cy) * t;
        }

        // note: highResTimer is not used
        this.overlayUpdate = function (highResTimer) {

            if (_lastHighlightId === 0 || _lastHighlightId === -1)
                return false;

            var old = _blendPass.uniforms.highlightIntensity.value;

            var t = ((performance.now() - _lastObjTime) * _easeSpeed);
            t = Math.min(t, 1.0);

            var current = cubicBezier(_easeCurve, t);

            if (old != current) {
                _blendPass.uniforms.highlightIntensity.value = current;
                return true;
            }

            return false;
        };

        this.beginScene = function (prototypeScene, camera, customLights, needClear) {
            _camera = camera;
            _lights = customLights;
            _saoBufferValid = false;
            _lastIDValid = false;

            if (!_colorTarget && _w) {
                this.initPostPipeline(_settings.sao, _settings.antialias);
            } else if (!_colorTarget && !_w) {
                if (!_warnedLeak) {
                    Logger.error("Rendering to a canvas that was resized to zero. If you see this message you may be accidentally leaking a viewer instance.");
                    _warnedLeak = true;
                }
                return;
            }

            //We need to render once with the "prototype" scene which
            //only contains the cameras and lights, so that their positions
            //and transforms get updated to the latest camera. Hence the
            //call to render instead of just clear.


            //Clear the color target
            if (needClear) {

                if (_clearColor && !_settings.envMapBg) {
                    _renderer.setClearColor(_clearColor, 1.0);
                    _renderer.clearTarget(_colorTarget, true, true, false); //clear color and depth buffer
                } else {

                    _clearPass.uniforms['uCamDir'].value = _camera.worldUpTransform ? _camera.getWorldDirection().clone().applyMatrix4(_camera.worldUpTransform) : _camera.getWorldDirection();
                    _clearPass.uniforms['uCamUp'].value = _camera.worldUpTransform ? _camera.up.clone().applyMatrix4(_camera.worldUpTransform) : _camera.up;
                    _clearPass.uniforms['uResolution'].value.set(_w, _h);
                    _clearPass.uniforms['uHalfFovTan'].value = Math.tan(THREE.Math.degToRad(_camera.fov * 0.5));

                    _renderer.clearTarget(_colorTarget, false, true, false); //clear depth buffer
                    _clearPass.render(_renderer, _colorTarget, null); //clear the color buffer
                }
            }

            //Clear the id buffer(s)
            for (var i = 0; i < _idTargets.length; i++) {
                _renderer.setClearColor(_white, 1.0);
                _renderer.clearTarget(_idTargets[i], true, false, false);
            }

            //Clear the G-buffer target if needed and update the SSAO uniforms.
            if (_settings.sao || _settings.toonShaded) {

                if (needClear) {
                    _renderer.setClearColor(_black, 0.0);
                    //Skip clearing the depth buffer as it's shared with the color target
                    _renderer.clearTarget(_depthTarget, true, false, false);
                }

                var near = camera.near;
                var far = camera.far;

                _saoPass.uniforms['cameraNear'].value = near;
                _saoPass.uniforms['cameraFar'].value = far;
                _celPass.uniforms['cameraNear'].value = near;
                _celPass.uniforms['cameraFar'].value = far;

                _saoMipFirstPass.uniforms['cameraNear'].value = near;
                _saoMipFirstPass.uniforms['cameraInvNearFar'].value = 1.0 / (near - far);

                var P = camera.projectionMatrix.elements;

                //Scaling factor needed to increase contrast of our SSAO.
                if (camera.isPerspective) {
                    /*  vec4(-2.0f / (width*P[0][0]),
                        -2.0f / (height*P[1][1]),
                        ( 1.0f - P[0][2]) / P[0][0],
                        ( 1.0f + P[1][2]) / P[1][1])*/
                    _saoPass.uniforms['projInfo'].value.set(
                        -2.0 / (_colorTarget.width * P[0]),
                        -2.0 / (_colorTarget.height * P[5]),
                        (1.0 - P[8]) / P[0],
                        (1.0 + P[9]) / P[5]);   //TODO: Not certain if we need + or - here for OpenGL off-center matrix (original is DX-style)
                    //would have to verify if some day we have off-center projections.

                    _celPass.uniforms['projInfo'].value.copy(_saoPass.uniforms['projInfo'].value);

                    _saoPass.uniforms['isOrtho'].value = 0.0;

                    _celPass.uniforms['isOrtho'].value = 0.0;

                } else {
                    _saoPass.uniforms['projInfo'].value.set(
                        -2.0 / (_colorTarget.width * P[0]),
                        -2.0 / (_colorTarget.height * P[5]),
                        (1.0 - P[12]) / P[0],
                        (1.0 - P[13]) / P[5]);

                    _celPass.uniforms['projInfo'].value.copy(_saoPass.uniforms['projInfo'].value);

                    _saoPass.uniforms['isOrtho'].value = 1.0;

                    _celPass.uniforms['isOrtho'].value = 1.0;

                }

                var hack_scale = 0.25;
                _saoPass.uniforms['projScale'].value = hack_scale * 0.5 * (_colorTarget.height * P[5]);

                // an approximation of the size of the world; relies on the camera's near and far being reasonable.
                // This is not a great solution, as orbiting changes this number. Better would be the length of
                // the diagonal of the whole world, or perhaps the *shortest* dimension (so that cities get SAO).
                // This method is variable on the camera's view. Better is to do this in Viewer3dImpl.addModel,
                // which is where we do this now.
                //this.setAOOptions( 0.05*(camera.far-camera.near) );
            }

            if (!_settings.sao) {
                // Ensure that any previous SSAO computation post-process target is not blended in.
                // This looks redundant with computeSSAO()'s code setting this blend off. However, it's
                // possible for computeSSAO() to not be executed if (a) smooth navigation and AO are both on
                // and (b) the scene is moving. In that case, smooth navigation turns off AO entirely in
                // Viewer3DImpl.js and computSSAO() is never called at all.
                _blendPass.uniforms['useAO'].value = 0;
            }

            //Render the prototype/pre-model scene, which may also contain some user added custom geometry.
            this.renderScenePart(prototypeScene, true, true, false, true);
        };


        //Called incrementally by the scene traversal, potentially
        //across several frames.
        this.renderScenePart = function (scene, want_colorTarget, want_saoTarget, want_idTarget, updateLights) {

            //console.time("renderScenePart");
            _saoBufferValid = false;
            _lastIDValid = false;
            var lights = updateLights ? _lights : undefined;

            //Three possibilities here -- MRT fully supported (Mac OS or native GL backends on Windows).
            //MRT supported only for targets that have exactly equal number of bitplanes and bpp (ANGLE on Windows)
            //MRT not supported at all. (Not sure --> some mobile platforms?).

            var oldMat;
            if (_mrtFloat32Works && _mrtRGBA8Works) {
                //You lucky dog! Fast code path for you.

                //In case of MRT, we ignore the which target flags, because
                //we assume the shaders are set up to write to the multiple targets anyway.
                //NOP: except idTarget, since hidden pass doesn't want that
                if (_settings.idbuffer && want_idTarget && (_settings.sao || _settings.toonShaded)) {
                    _renderer.render(scene, _camera, [_colorTarget, _depthTarget].concat(_idTargets), false, lights);
                }
                else if ((_settings.sao || _settings.toonShaded)) {
                    _renderer.render(scene, _camera, [_colorTarget, _depthTarget], false, lights);
                }
                else if (_settings.idbuffer && want_idTarget) {
                    _renderer.render(scene, _camera, [_colorTarget].concat(_idTargets));
                }
                else /*if (_settings.antialias)*/ {
                    _renderer.render(scene, _camera, _colorTarget, false, lights);
                }
                //else {
                //    _renderer.render(scene, _camera, null);
                //}

            } else if (_mrtRGBA8Works) {
                //It's something...

                if (_settings.idbuffer && want_idTarget) {
                    _renderer.render(scene, _camera, [_colorTarget].concat(_idTargets), false, lights);
                }
                else /*if (_settings.antialias)*/ {
                    _renderer.render(scene, _camera, _colorTarget, false, lights);
                }

                //Float target has to be rendered separately in case we can't
                //bind MRT with different bpp targets.
                if ((_settings.sao || _settings.toonShaded) && want_saoTarget) {
                    //Render the depth pass
                    oldMat = scene.overrideMaterial;

                    scene.overrideMaterial = _depthMaterial;

                    _renderer.render(scene, _camera, _depthTarget, false, undefined);

                    scene.overrideMaterial = oldMat;
                }

            } else {
                //Poor sod. No MRT at all. Three passes.

                //Render the color target first -- actually this is slower
                //because the color shader is likely a lot slower than the
                //depth+normal shader, but if we render depth first, then
                //we lose stuff behind transparent objects (potentially).
                //So we cannot do this until the progressive render is split
                //into non-transparent and transparent worlds.
                if (want_colorTarget) {
                    _renderer.render(scene, _camera, _colorTarget, false, lights);
                }

                //TODO: In 3D we really don't want to get into
                //this situation -- we don't have a reasonable ID material that
                //will work for e.g. cutout maps. We'd have to run basically a full
                //shader, or at least one that support opacity and alpha map checks.
                if (_settings.idbuffer && want_idTarget && _idMaterial) {

                    oldMat = scene.overrideMaterial;

                    scene.overrideMaterial = _idMaterial;

                    //TODO: This code path does not work in case multiple id targets are attached
                    //We need a second ID material that renders modelId instead of dbId.
                    _renderer.render(scene, _camera, _idTargets[0], false, undefined);

                    scene.overrideMaterial = oldMat;
                }

                if ((_settings.sao || _settings.toonShaded) && want_saoTarget) {
                    //Render the depth pass
                    oldMat = scene.overrideMaterial;

                    scene.overrideMaterial = _depthMaterial;

                    _renderer.render(scene, _camera, _depthTarget, false, undefined);

                    scene.overrideMaterial = oldMat;
                }

            }

            //console.timeEnd("renderScenePart");
        };

        this.clearAllOverlays = function () {
            _renderer.clearTarget(_overlayTarget, true, false, false);
        };

        this.renderOverlays = function (overlays, lights) {
            var haveOverlays = 0;

            for (var key in overlays) {
                var p = overlays[key];
                var s = p.scene;
                var c = p.camera ? p.camera : _camera;
                if (s.children.length) {

                    if (!haveOverlays) {
                        haveOverlays = 1;

                        //clear the overlay target once we see
                        //the first non-empty overlay scene
                        _renderer.setClearColor(_black, 0.0);
                        _renderer.clearTarget(_overlayTarget, true, false, false);
                    }


                    if (p.materialPre) {
                        s.overrideMaterial = p.materialPre;
                    }
                    _renderer.render(s, c, _overlayTarget, false, lights);

                    if (p.materialPost) {
                        s.overrideMaterial = p.materialPost;
                        _renderer.context.depthFunc(_renderer.context.GREATER);
                        _renderer.render(s, c, _overlayTarget, false, lights);
                        _renderer.context.depthFunc(_renderer.context.LEQUAL);
                    }

                    s.overrideMaterial = null;
                }
            }

            _blendPass.uniforms['useOverlay'].value = haveOverlays;
        };


        this.computeSSAO = function (skipAOPass) {
            if (!skipAOPass && _settings.sao && !_settings.toonShaded) {

                //console.time("SAO");
                if (!_saoBufferValid) {
                    //Create mip levels for the depth/normals target
                    if (_depthMipMap) {
                        var prevMip = _depthMipMap[0];
                        _saoMipFirstPass.uniforms['resolution'].value.set(1.0 / prevMip.width, 1.0 / prevMip.height);
                        _saoMipFirstPass.render(_renderer, prevMip, _depthTarget);
                        for (var i = 1; i < _depthMipMap.length; i++) {
                            var curMip = _depthMipMap[i];
                            _saoMipPass.uniforms['resolution'].value.set(1.0 / curMip.width, 1.0 / curMip.height);
                            _saoMipPass.render(_renderer, curMip, prevMip);
                            prevMip = curMip;
                        }
                    }

                    _saoPass.render(_renderer, _postTarget2, _colorTarget);

                    //console.timeEnd("SAO");
                    //console.time("SAOblur");
                    //Do the bilateral blur
                    _saoBlurPass.uniforms['axis'].value.set(1, 0);
                    _saoBlurPass.render(_renderer, _postTarget1, _postTarget2);
                    _saoBlurPass.uniforms['axis'].value.set(0, 1);
                    _saoBlurPass.render(_renderer, _postTarget2, _postTarget1);

                    _saoBufferValid = true;
                }

                _blendPass.uniforms['useAO'].value = 1;
                //console.timeEnd("SAOblur");
            } else {
                // Ensure that any previous SSAO computation post-process target is not blended in.
                _blendPass.uniforms['useAO'].value = 0;
            }

        };

        this.presentBuffer = function (userFinalPass) {

            if (!_renderer)
                return;

            //See if the blend pass is trivial 1:1, in which
            //case we can just use the main color target for
            //the final pass and skip the blend pass.
            //NOTE: This needs to be adjusted if the blend pass ever
            //does the tone mapping again.
            //TODO: Another possible improvement is to support blending of the SAO
            //inside the FXAA pass, in case the blend pass is just modulating by the AO value.
            var canSkipBlendPass = !_settings.sao &&
                                    !_blendPass.uniforms['useOverlay'].value &&
                                    // idAtPixel can return -1 for the ID when nothing is there
                                    (_lastHighlightId === 0 || _lastHighlightId === -1) &&
                                    (_lastHighlightModelId === 0 || _lastHighlightModelId === -1);

            if (canSkipBlendPass) {

                if (_settings.antialias) {

                    if (userFinalPass) {
                        _fxaaPass.render(_renderer, _postTarget1, _colorTarget);
                        userFinalPass.render(_renderer, null, _postTarget1);
                    } else if (_settings.toonShaded) {
                        _celPass.render(_renderer, _postTarget1, _colorTarget);
                        _fxaaPass.render(_renderer, null, _postTarget1);
                    } else {
                        _fxaaPass.render(_renderer, null, _colorTarget);
                    }
                }
                else if (userFinalPass) {
                    userFinalPass.render(_renderer, null, _colorTarget);
                } else if (_settings.toonShaded) {
                    _celPass.render(_renderer, _postTarget1, _colorTarget);
                    _copyPass.render(_renderer, null, _postTarget1);
                } else {
                    _copyPass.render(_renderer, null, _colorTarget);
                }

            } else {

                //console.time("post");
                //If we have fxaa, do the blending into an offscreen target
                //then FXAA into the final target
                if (_settings.antialias) {
                    _blendPass.render(_renderer, _postTarget1, _colorTarget);

                    if (userFinalPass) {
                        _fxaaPass.render(_renderer, _postTarget2, _postTarget1);
                        userFinalPass.render(_renderer, null, _postTarget2);
                    } else if (_settings.toonShaded) {
                        _celPass.render(_renderer, _postTarget2, _postTarget1);
                        _fxaaPass.render(_renderer, null, _postTarget2);
                    } else {
                        _fxaaPass.render(_renderer, null, _postTarget1);
                    }
                }
                else {
                    if (userFinalPass) {

                        _blendPass.render(_renderer, _postTarget1, _colorTarget);
                        userFinalPass.render(_renderer, null, _postTarget1);

                    } else {
                        if (_settings.toonShaded) {
                            _blendPass.render(_renderer, _postTarget1, _colorTarget);
                            _celPass.render(_renderer, _postTarget2, _postTarget1);
                            _copyPass.render(_renderer, null, _postTarget2);
                        } else {
                            _blendPass.render(_renderer, null, _colorTarget);
                        }
                    }
                }
            }

        };


        this.composeFinalFrame = function (skipAOPass, progressiveDone, skipPresent) {
            //Apply the post pipeline and then show to screen.
            //Note that we must preserve the original color buffer
            //so that we can update it progressively
            if (_settings.sao && !_settings.toonShaded)
                this.computeSSAO(skipAOPass);

            if (!skipPresent)
                this.presentBuffer();

            //console.timeEnd("post");

        };

        this.cleanup = function () {
            if (_colorTarget) {
                _colorTarget.dispose();
                _colorTarget = null;
            }

            if (_depthTarget) {
                _depthTarget.dispose();
                _depthTarget = null;
            }

            if (_overlayTarget) {
                _overlayTarget.dispose();
                _overlayTarget = null;
            }

            if (_postTarget1) {
                _postTarget1.dispose();
                _postTarget1 = null;
            }

            if (_postTarget2) {
                _postTarget2.dispose();
                _postTarget2 = null;
            }

            if (_depthMipMap) {
                for (var i = 0; i < _depthMipMap.length; i++) {
                    _depthMipMap[i].dispose();
                }

                _depthMipMap = [];
            }
        };

        this.setSize = function (w, h, force) {

            _w = w;
            _h = h;

            _settings.logicalWidth = w;
            _settings.logicalHeight = h;

            //Just a way to release the targets in cases when
            //we use a custom render context and don't need this one
            //temporarily
            if ((w === 0 && h === 0) || !_renderer) {
                this.cleanup();
                return;
            }

            var sw = 0 | (w * _renderer.getPixelRatio());
            var sh = 0 | (h * _renderer.getPixelRatio());

            _settings.deviceWidth = sw;
            _settings.deviceHeight = sh;

            _renderer.setSize(w, h);

            Logger.log("width: " + sw + " height: " + sh);

            var resX = 1.0 / sw;
            var resY = 1.0 / sh;

            //supersample antialiasing
            //Create a somewhat larger render target, that is power of 2 size and has mipmap
            if (_settings.useSSAA || (_settings.toonShaded && _renderer.getPixelRatio() <= 1)) {
                /*
                    sw *= 3 / _renderer.getPixelRatio();
                    sh *= 3 / _renderer.getPixelRatio();
    
                    var w = 1;
                    while (w < sw) w *= 2;
                    var h = 1;
                    while (h < sh) h *= 2;
    
                    sw = w;
                    sh = h;
                    */
                sw *= 2;
                sh *= 2;

                force = true;
            }

            //Just the regular color target -- shares depth buffer
            //with the depth target.
            if (force || !_colorTarget || _colorTarget.width != sw || _colorTarget.height != sh) {

                Logger.log("Reallocating render targets.");
                this.cleanup();

                _colorTarget = new THREE.WebGLRenderTarget(sw, sh,
                    {
                        minFilter: THREE.LinearFilter,
                        magFilter: THREE.LinearFilter,
                        format: THREE.RGBFormat,
                        type: _settings.useHdrTarget ? THREE.FloatType : THREE.UnsignedByteType,
                        //anisotropy: Math.min(this.getMaxAnisotropy(), 4),
                        stencilBuffer: false,
                        generateMipmaps: false
                    });

                _overlayTarget = new THREE.WebGLRenderTarget(sw, sh,
                    {
                        minFilter: THREE.NearestFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBAFormat,
                        stencilBuffer: false,
                        generateMipmaps: false
                    });


                _overlayTarget.shareDepthFrom = _colorTarget;


                _depthTarget = null;
                _postTarget1 = null;
                _postTarget2 = null;
                _depthMipMap = [];
            }

            if (_settings.antialias || _settings.sao || _settings.customPresentPass || _settings.toonShaded) {
                if (force || !_postTarget1 || _postTarget1.width != sw || _postTarget1.height != sh) {
                    //We need one extra post target if FXAA is on, so
                    //to use as intermediate from Blend->FXAA pass.
                    _postTarget1 = new THREE.WebGLRenderTarget(sw, sh,
                        {
                            minFilter: THREE.LinearFilter,
                            magFilter: THREE.LinearFilter,
                            format: THREE.RGBAFormat,
                            //anisotropy: 0,
                            //anisotropy: Math.min(this.getMaxAnisotropy(), 4),
                            stencilBuffer: false,
                            depthBuffer: false,
                            generateMipmaps: false
                        });
                }
            }


            if (_settings.sao || _settings.toonShaded) {
                if (force || !_depthTarget || _depthTarget.width != sw || _depthTarget.height != sh) {

                    var format = THREE.FloatType;
                    if(DeviceType.isMobileDevice) {
                        format = THREE.HalfFloatType;
                    }

                    _depthTarget = new THREE.WebGLRenderTarget(sw, sh,
                        {
                            minFilter: THREE.NearestFilter,
                            magFilter: THREE.NearestFilter,
                            format: _renderTargetFormat,
                            type: format,
                            stencilBuffer: false
                        });
                    _depthTarget.shareDepthFrom = _colorTarget;

                    //SSAO depth/normals mip maps. Those are "manually" created
                    //because we use custom sampling. Also, they are separately bound into
                    //the shader because there doesn't seem to be an easy way to load them
                    //as mip levels of the same texture, in the case they were render buffers initially.
                    _depthMipMap = [];
                    for (var j = 0; j < 5; j++) {
                        var mip = new THREE.WebGLRenderTarget(0 | (sw / (2 << j)), 0 | (sh / (2 << j)),
                            {
                                minFilter: THREE.NearestFilter,
                                magFilter: THREE.NearestFilter,
                                format: THREE.RGBAFormat,
                                //type:THREE.FloatType,
                                depthBuffer: false,
                                stencilBuffer: false
                            });
                        mip.generateMipmaps = false;
                        _depthMipMap.push(mip);
                        _saoPass.uniforms['tDepth_mip' + (j + 1)].value = mip;
                    }

                    //Re-check this when render targets change
                    _mrtFloat32Works = !_blockMRT && _renderer.verifyMRTWorks([_colorTarget, _depthTarget]);

                    //We only need a second post target if SAO is on.
                    _postTarget2 = _postTarget1.clone();
                }

                if (!_postTarget2 && _settings.antialias && _settings.customPresentPass)
                    _postTarget2 = _postTarget1.clone();

                _saoPass.uniforms['size'].value.set(sw, sh);
                _saoPass.uniforms['resolution'].value.set(resX, resY);
                _saoPass.uniforms['tDepth'].value = _depthTarget;

                _saoBlurPass.uniforms['size'].value.set(sw, sh);
                _saoBlurPass.uniforms['resolution'].value.set(resX, resY);

                _celPass.uniforms['tDepth'].value = _depthTarget;
            }

            if (_settings.idbuffer) {
                if (force || !_idTargets[0] || _idTargets[0].width != sw || _idTargets[0].height != sh) {
                    _idTargets = [];
                    for (var i = 0; i < _settings.numIdTargets; i++) {
                        _idTargets[i] = new THREE.WebGLRenderTarget(sw, sh,
                            {
                                minFilter: THREE.NearestFilter,
                                magFilter: THREE.NearestFilter,
                                format: THREE.RGBFormat,
                                type: THREE.UnsignedByteType,
                                stencilBuffer: false,
                                generateMipmaps: false
                            });

                        _idTargets[i].shareDepthFrom = _colorTarget;

                        //Set this flag to avoid checking frame buffer status every time we read
                        //a pixel from the ID buffer. We know the ID target is compatible with readPixels.
                        _idTargets[i].canReadPixels = true;
                    }

                    //Re-check this when render targets change
                    _mrtRGBA8Works = !_blockMRT && _renderer.verifyMRTWorks([_colorTarget].concat(_idTargets));
                    if (!_mrtRGBA8Works) {
                        Logger.warn("ID buffer requested, but MRT is not supported. Some features will not work.");
                    }
                }

                _celPass.uniforms['tID'].value = _idTargets[0];

            } else if (_idTargets[0]) {
                for (var i = 0; i < _idTargets.length; i++) {
                    _idTargets[i].dispose();
                    _idTargets[i] = null;
                }
            }


            _fxaaPass.uniforms['uResolution'].value.set(resX, resY);
            _celPass.uniforms['resolution'].value.set(resX, resY);

            _blendPass.uniforms['tOverlay'].value = _overlayTarget;
            _blendPass.uniforms['tAO'].value = _postTarget2;
            _blendPass.uniforms['useAO'].value = _settings.sao ? 1 : 0;
            _blendPass.uniforms['resolution'].value.set(resX, resY);
            _blendPass.uniforms['tID'].value = _idTargets[0];

        };

        this.getMaxAnisotropy = function () {
            return _renderer.getMaxAnisotropy();
        };

        this.hasMRT = function () {
            return !_blockMRT && (_renderer && _renderer.supportsMRT());
        };

        this.applyMRTFlags = function (mat) {
            var oldN = mat.mrtNormals;
            var oldI = mat.mrtIdBuffer;

            mat.mrtNormals = this.hasMRT() && _mrtFloat32Works && (_settings.sao || _settings.toonShaded);
            mat.mrtIdBuffer = (this.hasMRT() && _mrtRGBA8Works && _settings.idbuffer) ? _settings.numIdTargets : undefined;

            if (mat.mrtNormals !== oldN || mat.mrtIdBuffer !== oldI)
                mat.needsUpdate = true;
        };

        this.initPostPipeline = function (useSAO, useFXAA) {

            //TODO: Do we want to move the IE check to higher level code?
            _settings.sao = useSAO && !DeviceType.isIE11;
            _settings.antialias = useFXAA && !DeviceType.isIE11;

            if (_settings.sao)
                _settings.toonShaded = false;

            if (_settings.haveTwoSided) {
                _depthMaterial.side = THREE.DoubleSide;
                _depthMaterial._noCutplanesMaterial.side = _depthMaterial.side;
            }

            //TODO: do we really need to update all these or just the depthMaterial?
            _depthMaterial.needsUpdate = true;
            _depthMaterial._noCutplanesMaterial.needsUpdate = true;
            _saoPass.material.needsUpdate = true;
            _saoBlurPass.material.needsUpdate = true;
            _saoMipFirstPass.material.needsUpdate = true;
            _saoMipPass.material.needsUpdate = true;
            _fxaaPass.material.needsUpdate = true;
            _celPass.material.needsUpdate = true;
            _blendPass.material.needsUpdate = true;
            _clearPass.material.needsUpdate = true;
            _copyPass.material.needsUpdate = true;

            //Also reallocate the render targets
            this.setSize(_w, _h);
        };

        this.setClearColors = function (colorTop, colorBot) {
            if (!colorBot) {
                _clearColor = colorTop.clone();
            }
                //If the gradient is trivial, we can use a simple clear instead.
            else if (colorTop.equals(colorBot) || _isWeakDevice) {
                _clearColor = new THREE.Color(
                    0.5 * (colorTop.x + colorBot.x),
                    0.5 * (colorTop.y + colorBot.y),
                    0.5 * (colorTop.z + colorBot.z));
            } else {
                _clearColor = undefined;
            }

            if (!_clearColor) {
                _clearPass.uniforms.color1.value.copy(colorTop);
                _clearPass.uniforms.color2.value.copy(colorBot);
            }
        };


        this.setAOOptions = function (radius, intensity) {

            if (radius !== undefined) {
                _saoPass.uniforms['radius'].value = radius;
                _saoPass.uniforms['bias'].value = radius * DeviceType.isMobileDevice ? 0.1 : 0.01;
                _saoBlurPass.uniforms['radius'].value = radius;
            }
            if (intensity !== undefined) {
                _saoPass.uniforms['intensity'].value = intensity;
            }
            _saoBufferValid = false;
        };

        this.getAORadius = function () {
            return _saoPass.uniforms['radius'].value;
        };

        this.getAOIntensity = function () {
            return _saoPass.uniforms['intensity'].value;
        };

        this.setCubeMap = function (map) {
            _clearPass.material.envMap = map;
        };

        this.setEnvRotation = function (rotation) {
            _envRotation = rotation;
            _clearPass.material.envRotationSin = Math.sin(rotation);
            _clearPass.material.envRotationCos = Math.cos(rotation);
        };

        this.getEnvRotation = function () {
            return _envRotation;
        };

        this.setTonemapExposureBias = function (bias) {
            _exposureBias = bias;

            //_blendPass.uniforms['exposureBias'].value = Math.pow(2.0, bias);
        };

        this.getExposureBias = function () {
            return _exposureBias;
        };

        this.setTonemapMethod = function (value) {

            _tonemapMethod = value;

            if (value === 0) {
                /*
                    if (_settings.useHdrTarget) {
                        //reallocate the render target if we are going from hdr to ldr
                        _settings.useHdrTarget = false;
                        this.setSize(_w, _h, true);
                    }
                    */
                _renderer.gammaInput = false;
            }
            else {
                /*
                    if (!_settings.useHdrTarget) {
                        //reallocate the render target if we are going from hdr to ldr
                        _settings.useHdrTarget = true;
                        this.setSize(_w, _h, true);
                    }
                */
                //Tell the renderer to linearize all material colors
                _renderer.gammaInput = true;
            }


            // _blendPass.uniforms['toneMapMethod'].value = value;

        };

        this.getToneMapMethod = function () {
            return _tonemapMethod;
        };

        this.toggleTwoSided = function (isTwoSided) {

            //In case the viewer encounters two-sided materials
            //it will let us know, so that we can update
            //the override material used for the SAO G-buffer to also
            //render two sided.
            if (_settings.haveTwoSided != isTwoSided) {
                if (_depthMaterial) {
                    _depthMaterial.side = isTwoSided ? THREE.DoubleSide : THREE.FrontSide;
                    _depthMaterial.needsUpdate = true;
                    _depthMaterial._noCutplanesMaterial.side = _depthMaterial.side;
                    _depthMaterial._noCutplanesMaterial.needsUpdate = true;
                }
            }
            _settings.haveTwoSided = isTwoSided;
        };

        this.toggleCelShading = function (value) {

            // This is a little odd: if cel shading is turned off, SAO is then turned on.
            // The assumption here is that SAO being on is the norm. Since cel shading is
            // experimental and not exposed in the normal UI, this is fine for now.
            _settings.sao = !value;
            _settings.toonShaded = value;
            _settings.idbuffer = value;

            this.initPostPipeline(_settings.sao, _settings.antialias);
        };

        this.toggleEnvMapBackground = function (value) {

            _settings.envMapBg = value;
            _clearPass.uniforms.envMapBackground.value = value;
        };

        this.enter2DMode = function (idMaterial) {
            _idMaterial = idMaterial;
            _oldSettings.sao = _settings.sao;
            _oldSettings.toonShaded = _settings.toonShaded;
            _oldSettings.antialias = _settings.antialias;
            _oldSettings.idbuffer = _settings.idbuffer;
            _settings.idbuffer = true;
            _settings.toonShaded = false;
            _blendPass.material.defines.IS_2D = "";
            this.initPostPipeline(false, false);
        };

        this.exit2DMode = function () {
            _idMaterial = null;
            _settings.idbuffer = _oldSettings.idbuffer;
            _settings.toonShaded = _oldSettings.toonShaded;
            delete _blendPass.material.defines.IS_2D;
            this.initPostPipeline(_oldSettings.sao, _oldSettings.antialias);
        };

        //Returns the value of the ID buffer at the given
        //viewport location. Note that the viewport location is in
        //OpenGL-style coordinates [-1, 1] range.
        //If the optional third parameter is passed in, it's assume to be a two integer array-like,
        //and the extended result of the hit test (including model ID) is stored in it.
        this.idAtPixel = function (vpx, vpy, res) {
            if (!_idTargets[0])
                return 0;

            var px = 0 | ((vpx + 1.0) * 0.5 * _idTargets[0].width);
            var py = 0 | ((vpy + 1.0) * 0.5 * _idTargets[0].height);

            if (_lastIDValid && px === _lastX && py === _lastY) {
                if (res) {
                    res[0] = _lastID;
                    res[1] = _lastModelID;
                }
                return _lastID;
            }

            _renderer.readRenderTargetPixels(_idTargets[0], px, py, 1, 1, _readbackBuffer);

            var id = (_readbackBuffer[2] << 16) | (_readbackBuffer[1] << 8) | _readbackBuffer[0];
            var modelId = 0;

            if (_idTargets[1]) {
                _renderer.readRenderTargetPixels(_idTargets[1], px, py, 1, 1, _readbackBuffer);

                modelId = (_readbackBuffer[1] << 8) | _readbackBuffer[0];

                //recover negative values when going from 16 -> 32 bits.
                modelId = (modelId << 16) >> 16;

                //Upper byte of 32 bit dbId encoded in the 3rd byte of the model ID target.
                //id = id | (_readbackBuffer[2] << 24);
                //TODO: ouch, the above does not work for 2d sheets, because each mesh contains many objects.
                //Do something about it...
                id = (id << 8) >> 8;

            } else {
                //sign extend the upper byte to get back negative numbers (since we clamp 32 bit to 24 bit when rendering ids)
                id = (id << 8) >> 8;
            }

            _lastX = px;
            _lastY = py;
            _lastID = id;
            _lastModelID = modelId;
            _lastIDValid = true;

            if (res) {
                res[0] = id;
                res[1] = modelId;
            }

            return id;
        };

        this.idAtPixels = function (vpx, vpy, res, result) {
            if (!_idTargets[0])
                return 0;

            var px = (vpx + 1.0) * 0.5 * _idTargets[0].width - (res - 1) * 0.5;
            var py = (vpy + 1.0) * 0.5 * _idTargets[0].height - (res - 1) * 0.5;

            var readbackBuffer = new Uint8Array(4 * res * res);

            _renderer.readRenderTargetPixels(_idTargets[0], px, py, res, res, readbackBuffer);

            var readbackBuffer2 = undefined;
            if (result && _idTargets[1]) {
                readbackBuffer2 = new Uint8Array(4 * res * res);
                _renderer.readRenderTargetPixels(_idTargets[1], px, py, res, res, readbackBuffer2);
            }
            // Start the search at the center of the region and then spiral.
            function spiral() {

                var id;
                var x = 0, y = 0;
                var dx = 0, dy = -1;

                for (var i = 0; i < res * res; i++) {

                    // Translate coordinates with top left as (0, 0)
                    var tx = x + (res - 1) / 2;
                    var ty = y + (res - 1) / 2;
                    if (tx >= 0 && tx <= res && ty >= 0 && ty <= res) {
                        var index = tx + ty * res;
                        id = (readbackBuffer[4 * index + 2] << 16) | (readbackBuffer[4 * index + 1] << 8) | readbackBuffer[4 * index];

                        //sign extend the upper byte to get back negative numbers (since we clamp 32 bit to 24 bit when rendering ids)
                        id = (id << 8) >> 8;
                        if (id >= 0) {
                            if (readbackBuffer2) {
                                var modelId = (readbackBuffer2[4 * index + 1] << 8) | readbackBuffer2[4 * index];
                                //recover negative values when going from 16 -> 32 bits.
                                modelId = (modelId << 16) >> 16;

                                result[0] = id;
                                result[1] = modelId;
                            }
                            break;
                        }
                    }

                    if ((x == y) || (x < 0 && x == -y) || (x > 0 && x == 1 - y)) {
                        var t = dx;
                        dx = -dy;
                        dy = t;
                    }
                    x += dx;
                    y += dy;
                }

                return id;
            }

            return spiral();

        };

        this.readbackTargetId = function () {
            if (!_idTargets[0])
                return null;

            var readbackBuffer = new Uint8Array(4 * _idTargets[0].width * _idTargets[0].height);
            _renderer.readRenderTargetPixels(_idTargets[0], 0, 0, _idTargets[0].width, _idTargets[0].height, readbackBuffer);

            return {
                buffer: readbackBuffer,
                width: _idTargets[0].width,
                height: _idTargets[0].height
            };
        };

        this.rolloverObjectViewport = function (vpx, vpy, dbIds) {
            var objId = dbIds ? dbIds[0] : this.idAtPixel(vpx, vpy);
            return this.rolloverObjectId(objId, dbIds);
        };

        this.rolloverObjectId = function (objId, dbIds, modelId) {

            modelId = modelId || 0;

            if (objId === _lastHighlightId && modelId === _lastHighlightModelId)
                return false;

            _blendPass.uniforms['highlightIntensity'].value = 0;
            _blendPass.uniforms['objID'].value = objId;

            _lastObjTime = performance.now();

            _lastHighlightId = objId;
            _lastHighlightModelId = modelId;

            // When dbIds is provided, highlight nodes in a range
            if (dbIds) {

                if (dbIds.length > 1)
                    dbIds.shift();
                _blendPass.uniforms['highlightRange'].value = 1;
                _blendPass.uniforms['objIDStart'].value = dbIds[0];
                _blendPass.uniforms['objIDEnd'].value = dbIds[dbIds.length - 1];
            }
            else {

                _blendPass.uniforms['highlightRange'].value = 0;

                //Check if nothing was at that pixel -- 0 means object
                //that has no ID, ffffff (-1) means background, and both result
                //in no highlight.
                if (objId <= 0) {
                    objId = 0;
                }

                _blendPass.uniforms['objIDv3'].value.set((objId & 0xFF) / 255,
                                                        ((objId >> 8) & 0xFF) / 255,
                                                        ((objId >> 16) & 0xFF) / 255);
            }

            return true;
        };

        this.setUnitScale = function (metersPerUnit) {
            _unitScale = metersPerUnit;
        };

        this.getUnitScale = function () {
            return _unitScale;
        };

        this.getBlendPass = function () {
            return _blendPass;
        };

        // TODO_NOP: hack expose colorTarget so shadow/reflection can draw into
        this.getColorTarget = function () {
            return _colorTarget;
        };

        // TODO_NOP: hack expose depthMaterial to register with matman for cutplanes
        this.getDepthMaterial = function () {
            return _depthMaterial;
        };
    }

    return RenderContext;
});