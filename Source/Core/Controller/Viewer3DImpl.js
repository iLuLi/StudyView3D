define([
    '../Logger',
    '../Constants/EventType',
    '../Constants/Global',
    '../Constants/LightPresets',
    '../Constants/DeviceType',
    '../Constants/BackgroundPresets',
    '../Renderer/RenderScene',
    '../Renderer/RenderContext',
    '../Renderer/MaterialManager',
    '../Renderer/UnifiedCamera',
    '../Renderer/FragmentPointer',
    '../Renderer/FragmentList',
    '../Renderer/GroundShadow',
    '../Renderer/FireflyWebGLRenderer',
    '../Renderer/Utils/GroundReflection',
    '../Shaders/SAOShader',
    '../Animation/KeyFrameAnimator',
    '../Utils/getResourceUrl',
    '../Math/VBIntersector',
    './MultiModelSelector',
    './MultiModelVisibilityManager',
    './Navigation'
], function(
    Logger,
    EventType, 
    Global,
    LightPresets,
    DeviceType,
    BackgroundPresets,
    RenderScene,
    RenderContext,
    MaterialManager,
    UnifiedCamera,
    FragmentPointer,
    FragmentList,
    GroundShadow,
    FireflyWebGLRenderer,
    GroundReflection,
    SAOShader,
    KeyFrameAnimator,
    getResourceUrl,
    VBIntersector,
    MultiModelSelector,
    MultiModelVisibilityManager,
    Navigation,
) {
    'use strict';

    //default parameters for WebGL initialization
    var initParametersSetting = {
        canvas: null,
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
        depth: false,
        devicePixelRatio: null
    }

    /** @constructor */
    function Viewer3DImpl(thecanvas, theapi) {
        var _this = this;

        //Frame time cutoffs in milliseconds. We target the middle value,
        //but adjust the CPU-side work in the give min/max range
        //once we measure actual frame times (including async GPU work, system load, etc).
        //NOTE: These are doubled for mobile devices at construction time (end of this file).
        var MAX_FRAME_TIME = 1000 / 15,
            TARGET_FRAME_TIME = 1000 / 30,
            MIN_FRAME_TIME = 1000 / 120; //We aren't hoping for 120 fps -- this is just how often tick() gets called
        //not counting GPU latency, etc.

        var _phase = Global.RENDER_NORMAL;

        var _currentLightPreset = -1;
        var _oldLightPreset = -1;

        var _lastTickMoved = false;

        var _worldUp;
        var _worldUpName = "y";

        var _reqid, _needsResize, _newWidth, _newHeight, _materials;
        var _webglrender, _renderer;

        var _needsClear = false,
            _needsRender = false,
            _overlayDirty = false;

        var _progressEvent = { type: EventType.PROGRESS_UPDATE_EVENT, percent: 0 };

        var _sceneDirty = false;

        var _cameraUpdated;

        var _explodeScale = 0;

        var _lastBeginFrameTimeStamp = 0, _beginFrameAvg = 0;

        var _lastHighResTimeStamp = 0;

        var _frameTimeAvg = 1000.0 / 60.0;
        var _frameTimeSamples = 0;

        var _isLoading = true;  // turned off in onLoadComplete()

        var _groundShadow, _groundReflection;

        var _envMapBackground = false;

        var _modelQueue;

        var _AOsuppressed = false;
        var _turnAOonAndRender = false;

        if (thecanvas) {
            setInterval(function () {
                // Only start reporting the framerate to ADP when there's been "enough" samples
                if (_isLoading || _frameTimeSamples < 60) {
                    return;
                }
                _this.track({ name: 'fps', value: Number(_this.fps().toFixed(2)), aggregate: 'last' });
            }, 30000);
        }

        this.api = theapi;
        this.canvas = thecanvas;
        this.loader = null;

        //Slower initialization pieces can be delayed until after
        //we start loading data, so they are separated out here.
        this.initialize = function () {

            _worldUp = new THREE.Vector3(0, 1, 0);
            _modelQueue = new RenderScene();

            //TODO: node webgl renderer
            _webglrender = createRenderer(thecanvas);
            _renderer = new RenderContext();
            _renderer.init(_webglrender, thecanvas ? thecanvas.clientWidth : 0, thecanvas ? thecanvas.clientHeight : 0);

            _materials = new MaterialManager(this);

            //this.camera = new THREE.CombinedCamera( w, h, VIEW_ANGLE, NEAR, FAR, NEAR, FAR);
            // this.camera = new THREE.PerspectiveCamera( VIEW_ANGLE, thecanvas.clientWidth/thecanvas.clientHeight, NEAR, FAR);
            // this.cameraChangedEvent = {type: Autodesk.Viewing.CAMERA_CHANGE_EVENT, camera: this.camera};
            //this.camera = new THREE.CombinedCamera( w, h, VIEW_ANGLE, NEAR, FAR, NEAR, FAR);
            // avp.init_UnifiedCamera(THREE);
            this.camera = new UnifiedCamera(thecanvas ? thecanvas.clientWidth : 512, thecanvas ? thecanvas.clientHeight : 512);
            this.lights = [];

            // this.camera = this.unicam.getOrthographicCamera();
            this.cameraChangedEvent = this.camera.getCameraChangedEvent();

            //This scene will just hold the camera and lights, while
            //we keep groups of progressively rendered geometry in
            //separate geometry scenes.
            this.scene = new THREE.Scene();
            this.sceneAfter = new THREE.Scene();
            this.sceneAfter.sortObjects = false;

            this.overlayScenes = {};

            this.selectionMaterial2d = null;

            this.selectionMaterialBase = new THREE.MeshPhongMaterial({ color: 0x6699ff, specular: 0x080808, emissive: 0x334c77, ambient: 0, opacity: 1.0, transparent: false });
            this.selectionMaterialTop = new THREE.MeshPhongMaterial({ color: 0x6699ff, specular: 0x080808, emissive: 0x334c77, ambient: 0, opacity: 0.15, transparent: true });
            this.selectionMaterialTop.packedNormals = true;
            this.selectionMaterialBase.packedNormals = true;
            createSelectionScene("selection", this.selectionMaterialBase, this.selectionMaterialTop);
            this.selectionMeshes = {};

            this.fadeMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, opacity: 0.1, reflectivity: 0, transparent: true, depthWrite: false });
            this.fadeMaterial.packedNormals = true;
            _materials.addMaterial("__fadeMaterial__", this.fadeMaterial, true);

            this.highlightMaterial = new THREE.MeshPhongMaterial({ color: 0x6699ff, specular: 0x080808, emissive: 0x334c77, ambient: 0, opacity: 1.0, transparent: false });
            this.highlightMaterial.packedNormals = true;
            _materials.addMaterial("__highlightMaterial__", this.highlightMaterial, true);

            //Settings exposed to GUI:
            this.progressiveRender = true;
            this.swapBlackAndWhite = false;

            if (Global.isMobileDevice) {
                MAX_FRAME_TIME *= 2;
                MIN_FRAME_TIME *= 2;
                TARGET_FRAME_TIME *= 2;
            }
            this.targetFrameTime = TARGET_FRAME_TIME;

            this.controls = {
                update: function (timeStamp) {
                    this.camera.lookAt(this.camera.target);
                    this.camera.updateProjectionMatrix();
                    this.camera.dirty = false;
                },
                handleResize: function () { },
                recordHomeView: function () { },
                uninitialize: function () { }
            };

            this.selector = new MultiModelSelector(this);

            this.visibilityManager = new MultiModelVisibilityManager(this);

            this.showGhosting = true;
            this.showOverlaysWhileMoving = true;
            this.skipAOWhenMoving = false;

            this.keyFrameAnimator = null;

            var cc = LightPresets[Global.DefaultLightPreset].bgColorGradient;
            this.setClearColors(cc[0], cc[1], cc[2], cc[3], cc[4], cc[5]);

            _groundShadow = new GroundShadow(_webglrender);
            _groundShadow.enabled = true;

            // TODO_NOP: hack register materials for cutplanes
            _materials.addMaterialNonHDR("groundShadowDepthMaterial", _groundShadow.getDepthMaterial());
            _materials.addMaterialNonHDR("normalsMaterial", _renderer.getDepthMaterial());

            // Finally

            //just meant to do an initial clear to the background color we want.
            _renderer.beginScene(this.scene, this.camera, this.lights, true);
            _renderer.composeFinalFrame(true);
        };


        function createRenderer(canvas) {

            if (!DeviceType.isBrowser)
                return null;

            //TODO: improve the pixel scale heuristics below
            var dpr = window.devicePixelRatio;
            if (!dpr) dpr = 1;

            //High density display -- turn off antialiasing since
            //it's not worth the slowdown in that case.
            //if (dpr >= 2.0)
            //    _settings.antialias = false;

            //Expose the pramaters to outside so that we could set these params on HTML.
            var params = initParametersSetting;
            params.canvas = canvas;
            params.devicePixelRatio = dpr;

            var renderer = new FireflyWebGLRenderer(params);

            if (!renderer.context)
                return null;

            renderer.autoClear = false;

            //Turn off scene sorting by THREE -- this is ok if we
            //do progressive draw in an order that makes sense
            //transparency-wise. If we start drawing using a frustum culling
            //r-tree or there are problems with transparency we'd have to turn on sorting.
            renderer.sortObjects = false;

            return renderer;
        }


        //Bridge between the render queue and render context
        //For passing pieces of model to the renderer during
        //timed progressive rendering, while also taking into account
        //the current rendering mode of the viewer
        function renderSomeCallback(scene) {

            //Ideally, here we only want the piece of the
            //render function that specifically renders geometries,
            //and none of the camera update stuff that we already do
            //once in beginProgressive() -- but this requires
            //some refactoring of THREE.WebGLRenderer.
            var phase = _phase;
            var wantColor = true;
            var wantSAO = phase == Global.RENDER_NORMAL;
            var wantID = _renderer.settings.idbuffer && phase != Global.RENDER_HIDDEN;

            if (phase == Global.RENDER_HIDDEN)
                scene.overrideMaterial = _this.fadeMaterial;
            else if (phase == Global.RENDER_HIGHLIGHTED)
                scene.overrideMaterial = _this.highlightMaterial;

            _renderer.renderScenePart(scene, wantColor, wantSAO, wantID);

            scene.overrideMaterial = null;

        }

        function updateFPS(highResTimeStamp) {
            _frameTimeSamples++;

            if (_lastHighResTimeStamp > 0)
                _frameTimeAvg = _frameTimeAvg * 0.8 + (highResTimeStamp - _lastHighResTimeStamp) * 0.2;

            if (_this.fpsCallback)
                _this.fpsCallback(_this.fps());
        }

        function updateAnimations(highResTimeStamp) {
            if (_this.keyFrameAnimator) {
                var delta = _lastHighResTimeStamp > 0 ? (highResTimeStamp - _lastHighResTimeStamp) / 1000 : 0;
                var updateFlags = _this.keyFrameAnimator.update(delta);
                if (updateFlags) {
                    _this.sceneUpdated(true);
                    if (updateFlags & _this.keyFrameAnimator.UPDATE_CAMERA)
                        return true;
                }
            }
            return false;
        }

        function updateCanvasSize() {
            if (_needsResize) {
                _this.camera.aspect = _newWidth / _newHeight;
                _this.camera.clientWidth = _newWidth;
                _this.camera.clientHeight = _newHeight;
                _renderer.setSize(_newWidth, _newHeight);
                _this.controls.handleResize();
                if (_groundReflection)
                    _groundReflection.setSize(_newWidth, _newHeight);
                _this.invalidate(true, true, true);
                _needsResize = false;
                _this.api.fireEvent({
                    type: EventType.VIEWER_RESIZE_EVENT,
                    width: _newWidth,
                    height: _newHeight
                });
            }
        }

        var updateGroundShadow = (function () {
            var MAX_PROCESS_FRAMES = 10;    // max number of frames over which shadows take to process
            var MIN_SCENES_PER_FRAME = 10;  // minimum number of scenes to process each frame

            var qScenes;
            var qSceneCount = 0;
            var qSceneIdx = 0;
            var maxScenesPerFrame = 0;

            return function updateGroundShadow(colorClear, drawAll) {

                if (!_groundShadow.enabled ||
                    _this.is2d ||
                    _modelQueue.isEmpty() ||
                    _isLoading)
                    return false;

                // color buffer was cleared, need to draw shadow
                if (colorClear)
                    _groundShadow.rendered = false;

                //this will happen once the linear render list is replaced
                //by the BVH.
                if (qScenes != _modelQueue.getGeomScenes())
                    _groundShadow.needClear = true;

                // reset
                if (_groundShadow.needClear) {
                    _groundShadow.clear();
                    _groundShadow.needClear = false;

                    qScenes = _modelQueue.getGeomScenes();
                    qSceneCount = qScenes.length;
                    qSceneIdx = 0;
                    maxScenesPerFrame = Math.max(Math.ceil(qSceneCount / MAX_PROCESS_FRAMES), MIN_SCENES_PER_FRAME);
                }

                // ready to render
                if (_groundShadow.isValid()) {
                    if (!_groundShadow.rendered &&
                        !_groundReflection) {
                        _groundShadow.renderShadow(_this.camera, _renderer.getColorTarget());
                        _groundShadow.rendered = true;
                    }
                }

                    // progressive draw into shadow
                else {
                    var i = 0;
                    while (((i < maxScenesPerFrame) || drawAll) && qSceneIdx < qSceneCount) {
                        var qScene = qScenes[qSceneIdx];

                        if (qScene) {
                            // passing forceVisible to FireflyWebGLRenderer.projectObject()
                            qScene.forceVisible = true;
                            _groundShadow.renderIntoShadow(qScene);
                            qScene.forceVisible = false;
                            i++;
                        }

                        qSceneIdx++;
                    }

                    // finish
                    if (qSceneIdx >= qSceneCount) {
                        _groundShadow.postprocess();

                        if (!_groundShadow.rendered &&
                            !_groundReflection) {
                            _groundShadow.renderShadow(_this.camera, _renderer.getColorTarget());
                            _groundShadow.rendered = true;
                        }

                        return true;
                    }
                }

                return false;
            };
        })();

        var updateGroundReflection = (function () {
            var MAX_PROCESS_FRAMES = 20;
            var MIN_SCENES_PER_FRAME = 1;

            var qScenes;
            var qSceneCount = 0;
            var qSceneIdx = 0;
            var maxScenesPerFrame = 0;

            return function updateGroundReflection(needClear) {

                if (!_groundReflection ||
                    (_groundReflection.finished && !needClear) ||
                    _this.is2d ||
                    _modelQueue.isEmpty() ||
                    _isLoading)
                    return;

                // reset
                if (needClear) {
                    _groundReflection.clear();
                    _groundReflection.updateCamera(_this.camera);
                    _groundReflection.rendered = false;
                    _groundReflection.finished = false;

                    if (_groundReflection.isGroundCulled())
                        return;

                    qScenes = _modelQueue.getGeomScenes();
                    qSceneCount = qScenes.length;
                    qSceneIdx = 0;
                    maxScenesPerFrame = Math.max(Math.ceil(qSceneCount / MAX_PROCESS_FRAMES), MIN_SCENES_PER_FRAME);
                }

                if (_groundReflection.isGroundCulled())
                    return;

                // progressive draw into reflection
                var i = 0;
                // if progressive rendering is off, or it's on and i < maxScenesPerFrame, then render
                // the ground reflection; also check that the scene index is less than the scene count
                // for the loop itself.
                while ((!_this.progressiveRender || (i < maxScenesPerFrame)) &&
                    (qSceneIdx < qSceneCount)) {
                    var qScene = qScenes[qSceneIdx];

                    if (qScene) {
                        // passing forceVisible to FireflyWebGLRenderer.projectObject()
                        qScene.forceVisible = true;
                        _groundReflection.renderIntoReflection(qScene);
                        qScene.forceVisible = false;
                        i++;
                    }

                    qSceneIdx++;
                }

                // reflection was dirtied (rendered into)
                if (qSceneIdx < qSceneCount)
                    _groundReflection.rendered = false;
                else
                    _groundReflection.finished = true;

                // draw out reflection
                //
                // if not rendered
                // if not below ground
                //   if finished or
                //   if progressive reflections, color pass has to be processing
                //   i.e., if color pass done then only draw the finished reflections
                if (!_groundReflection.rendered &&
                    !_groundReflection.isGroundCulled() && (
                        _groundReflection.finished ||
                        !_modelQueue.isDone()
                    )) {

                    _groundReflection.postprocess(_this.camera, _materials);

                    if (_groundShadow.enabled && _groundShadow.isValid()) {
                        _groundShadow.renderShadow(_this.camera, _groundReflection.outTarget);
                        _groundShadow.rendered = true;
                    }

                    _groundReflection.renderReflection(_this.camera, _renderer.getColorTarget());
                    // Reflections are rendered now, but only when things are really finished should we not re-render;
                    // otherwise what happens is that ".finished" gets set above to true later, when we're done, but
                    // ".rendered" is already true, so this area right here of the code doe not execute, and the
                    // "_phase" variable will never get set to avp.RENDER_HIDDEN, so causing the
                    // ghosted objects to not get rendered in tick() about 200 lines later, see the "if"
                    // "if (_phase === avp.RENDER_NORMAL" for the logic that tests for RENDER_NORMAL; we want to 
                    // get into the "else" code there or the final rendering is not done. It's just that simple.
                    _groundReflection.rendered = _groundReflection.finished;

                    // if color pass already finished, non-progressive case
                    if (_modelQueue.isDone()) {
                        // if ghosting, draw after refls are done
                        if (_this.showGhosting && !_modelQueue.areAllVisible()) {
                            _phase = Global.RENDER_HIDDEN;
                            _modelQueue.reset(_this.camera, _phase);
                        }
                            // else, just draw result
                        else {
                            _renderer.presentBuffer();
                        }
                    }
                }

            };
        })();

        function updateGroundTransform() {
            if (!_groundShadow.enabled && !_groundReflection || _this.is2d)
                return;

            var groundBox;
            if (_this.model && !_this.model.isLoadDone()) {
                groundBox = _this.model.getData().bbox;
            }
            else {
                groundBox = _this.getVisibleBounds(true, false);
            }
            if (!groundBox)
                return;

            _groundShadow.needClear = true;

            var camera = _this.camera;
            var bbox = groundBox.clone();

            var rightAxis = new THREE.Vector3(1, 0, 0);
            var bcenter = bbox.center();
            var bsize = bbox.size();
            if (camera.worldUpTransform) {
                rightAxis.applyMatrix4(camera.worldUpTransform);
                bbox.applyMatrix4(camera.worldUpTransform);
                //bcenter.applyMatrix4(camera.worldUpTransform);
                bsize = bbox.size();
            }
            bsize.multiply(new THREE.Vector3(1.25, 1.01, 1.25));
            bsize.x = bsize.z = Math.max(bsize.x, bsize.z); // maintain square texture
            _groundShadow.setTransform(
                bcenter,
                bsize,
                camera.worldup,
                rightAxis
            );

            if (_groundReflection) {
                var groundPos = (new THREE.Vector3()).subVectors(bcenter, camera.worldup.clone().multiplyScalar(bsize.y / 2));
                _groundReflection.setTransform(groundPos, camera.worldup, bsize);
            }
        }

        function updateScene(highResTimeStamp) {
            if (_sceneDirty) {
                updateGroundTransform();
                _sceneDirty = false;
            }
        }

        function updateOverlays(highResTimeStamp) {

            //Update the selection set cloned meshes
            for (var id in _this.selectionMeshes) {

                var m = _this.selectionMeshes[id];
                m.model.getFragmentList().getWorldMatrix(m.fragId, m.matrix);

            }

        }


        //Main animation loop -- update camera,
        //advance animations, render if needed.
        function tick(highResTimeStamp) {
            //Did the window resize since last tick?
            if (_needsResize) updateCanvasSize();

            //Texture uploads of newly received textures
            _materials.updateMaterials();

            //Do animations -- this has to be done
            //before the scene update below
            var animationMoved = updateAnimations(highResTimeStamp);

            var controlsMoved = _this.controls.update(highResTimeStamp);

            var sceneChanged = _modelQueue && _modelQueue.update(highResTimeStamp);

            var moved = controlsMoved || animationMoved || _cameraUpdated || sceneChanged;

            _needsClear = _needsClear || moved;
            _overlayDirty = _overlayDirty || moved;

            if (_overlayDirty)
                updateOverlays(highResTimeStamp);

            _overlayDirty = _overlayDirty || _renderer.overlayUpdate(highResTimeStamp);

            // ??? By adding on demand loading geometry, the progress of rendering now
            // ??? will proceed back and forth a few times.
            var signalProgressByRendering = _this.model && (_this.model.isLoadDone() ||
                (_this.model.myData.partPacksLoadDone === true));

            var frameBudget = _this.progressiveRender ? _this.targetFrameTime : 1e10;
            var frameRemaining = frameBudget;
            var q = _modelQueue;

            //Has the geometry changed since the last frame.
            //Note this is not the same as just the camera moving, it indicates
            //that meshes have changed position, e.g. like during explode.
            if (_sceneDirty) updateScene(highResTimeStamp);

            //Whether we will reset the render queue -- we could
            //do that without a screen clear in case we are just
            //loading new data without motion.
            if (_needsClear || _needsRender) {

                // Is SAO on? It should be turned off if we're moving and using smooth navigation.
                if (moved && _this.skipAOWhenMoving && _renderer.settings.sao && !_AOsuppressed) {
                    // force SAO off in the renderer when performing smooth navigation, so that the normal/depth buffer
                    // is not cleared *in future renders*, nor rendered to later on.
                    _renderer.settings.sao = false;
                    _AOsuppressed = true;
                }

                if (signalProgressByRendering)
                    _this.signalProgress(0); //zero out the progress bar for when rendering begins

                //Measure actual frame time between two consecutive initial frames.
                //This is used to correct measured per-scene times to what they actually take
                //once the async processing of the graphics thread is taken into account.
                if (_lastBeginFrameTimeStamp > 0) {
                    var delta = highResTimeStamp - _lastBeginFrameTimeStamp;
                    _beginFrameAvg = 0.75 * _beginFrameAvg + 0.25 * delta;
                }
                _lastBeginFrameTimeStamp = highResTimeStamp;

                //Adjust frame time allowance based on actual frame rate,
                //but stay within the given boundaries.
                if (_beginFrameAvg < TARGET_FRAME_TIME && frameBudget < MAX_FRAME_TIME)
                    _this.targetFrameTime += 1;
                else if (_beginFrameAvg > TARGET_FRAME_TIME && frameBudget > MIN_FRAME_TIME)
                    _this.targetFrameTime -= 1;

                _this.updateCameraMatrices();

                _renderer.beginScene(_this.scene, _this.camera, _this.lights, _needsClear);

                if (moved) {
                    _this.api.fireEvent(_this.cameraChangedEvent);
                }

                if (q) {
                    if (q.hasHighlighted()) {
                        //If we have objects in the render queue that are set
                        //to draw as "highlighted", render them first
                        _phase = Global.RENDER_HIGHLIGHTED;
                        q.reset(_this.camera, _phase, moved | _needsClear);
                    } else {
                        // If nothing is highlighted just skip the highlighted phase
                        _phase = Global.RENDER_NORMAL;
                        q.reset(_this.camera, _phase, moved | _needsClear);
                    }
                }
            } else {
                _lastBeginFrameTimeStamp = -1;
            }

            // process shadows before color pass draw but after color clear
            // so that if it finishes it can immediately render to the current frame
            var shadowDone = updateGroundShadow(_needsClear, !moved);
            _overlayDirty = _overlayDirty || shadowDone;

            // process reflections after shadows, if it finishes it can render on top of reflections
            updateGroundReflection(_needsClear);

            //Render some meshes until we run out of time
            if (!q.isEmpty() && !q.isDone()) {

                frameRemaining = q.renderSome(renderSomeCallback, frameRemaining);

                if (q.isDone() && _phase === Global.RENDER_HIGHLIGHTED) {
                    _phase = Global.RENDER_NORMAL;
                    q.reset(_this.camera, _phase);

                    // Allow the use of the remaining frame time to draw normal objects.
                    frameRemaining = q.renderSome(renderSomeCallback, frameRemaining);
                }

                //if needed apply post-process to copy render target to screen
                if (!moved && !_overlayDirty) {
                    updateFPS(highResTimeStamp);
                    _renderer.composeFinalFrame();
                }

                if (q.isDone()) {
                    if (_phase === Global.RENDER_NORMAL &&
                        !q.areAllVisible() &&
                        _this.showGhosting) {
                        // delay render hidden until reflections are done
                        if (!_groundReflection || _groundReflection.finished) {
                            _phase = Global.RENDER_HIDDEN;
                            q.reset(_this.camera, _phase);

                            // Allow the use of the remaining time to draw ghosted objects.
                            frameRemaining = q.renderSome(renderSomeCallback, frameRemaining);
                        }
                    }
                    else {
                        // final render - we should always get to here eventually.
                        _phase = Global.RENDER_FINISHED;
                        _renderer.renderScenePart(_this.sceneAfter, true, true, true);
                        _renderer.composeFinalFrame(moved && _this.skipAOWhenMoving, true);
                    }

                    if (signalProgressByRendering)
                        _this.signalProgress(100.0);
                }
                else {
                    if (signalProgressByRendering)
                        _this.signalProgress(100.0 * q.getRenderProgress());
                }
            }
            //Render selection highlight / pivot / HUD overlays and post-processing stuff
            if (_overlayDirty) {

                _renderer.renderScenePart(_this.sceneAfter, true, true, true);

                if ((!q.isEmpty() && q.isDone()) || _this.showOverlaysWhileMoving) {
                    _this.renderOverlays();

                    //During progressive rendering, we want to
                    //continue rendering overlays until the queue is done
                    //because adding more to the scene will affect the z buffer
                    //which would change which parts of the overlays is visible.
                    if (!q.isEmpty() && !q.isDone())
                        _overlayDirty = true;
                } else {
                    _renderer.clearAllOverlays();
                }

                _renderer.composeFinalFrame((moved || q.isEmpty() || !q.isDone()) && _this.skipAOWhenMoving, q && q.isDone());

                updateFPS(highResTimeStamp);
            }

            //Finally, draw the AO pass, in case we skip AO pass when moving or progressive repaint.
            if (_lastTickMoved && !moved && _this.skipAOWhenMoving) {
                // we've stopped moving; finish up
                _renderer.composeFinalFrame();
                // if doing smooth navigation, prepare to turn AO back on if it was off
                if (_this.skipAOWhenMoving && _AOsuppressed) {
                    // if smooth navigation is on, and AO is on, then we'll need
                    // to do a full render (not just compose the final frame) in
                    // order to generate the normal/depth map.
                    _turnAOonAndRender = true;
                }
            }
            _lastTickMoved = moved;

            _lastHighResTimeStamp = highResTimeStamp;

            // At the end of this tick, lets see whether need a re-render,
            // if page out started but failed, we need a re-run.
            if (q && q.needsRender()) {
                _needsRender = true;
                q.resetNeedsRender();
            }
            else {
                _needsRender = false;
            }

            _needsClear = false;
            _cameraUpdated = false;

            // if AO is to be turned back on, we'll need a full draw from the start.
            if (_turnAOonAndRender) {
                _turnAOonAndRender = false;
                // Turn AO back on. This could be done where _turnAOonAndRender was set to true, above, but
                // it's more maintainable to keep AO off until the very last moment.
                _renderer.settings.sao = true;
                _AOsuppressed = false;
                // signal that a full clear and render is needed, so that AO is generated.
                _this.invalidate(true, true);
            }
        }


        this.run = function () {
            //Begin the render loop (but delay first repaint until the following frame, so that
            //data load gets kicked off as soon as possible
            _reqid = 0;
            setTimeout(function () {
                (function animloop(highResTimeStamp) {
                    _reqid = window.requestAnimationFrame(animloop);
                    tick(highResTimeStamp);
                })();
            }, 1);
        };

        this.toggleProgressive = function (value) {
            this.progressiveRender = value;
            _needsClear = true;
        };

        this.toggleSwapBlackAndWhite = function (value) {
            this.swapBlackAndWhite = value;
            _needsClear = true;
        };

        this.toggleGhosting = function (value) {
            this.showGhosting = value;
            _needsClear = true;
        };

        this.toggleOverlaysWhileMoving = function (value) {
            this.showOverlaysWhileMoving = value;
        };

        this.togglePostProcess = function (useSAO, useFXAA) {
            _renderer.initPostPipeline(useSAO, useFXAA);
            this.fireRenderOptionChanged();
            _needsClear = true;
        };

        this.toggleCelShading = function (value) {
            _renderer.toggleCelShading(value);
            this.fireRenderOptionChanged();
            _needsClear = true;
        };

        this.toggleGroundShadow = function (value) {
            if (_groundShadow.enabled === value)
                return;

            _groundShadow.enabled = value;
            _groundShadow.needClear = true;
            updateGroundTransform();
            this.fireRenderOptionChanged();
            this.invalidate(true, false, false);
        };

        this.setGroundShadowColor = function (color) {
            if (!_groundShadow.enabled) return;

            _groundShadow.setColor(color);
            this.invalidate(true, false, false);
        };

        this.setGroundShadowAlpha = function (alpha) {
            if (!_groundShadow.enabled) return;

            _groundShadow.setAlpha(alpha);
            this.invalidate(true, false, false);
        };

        this.toggleGroundReflection = function (enable) {
            if ((enable && !!_groundReflection) ||
                (!enable && !_groundReflection))
                return;

            if (enable) {
                _groundReflection = new GroundReflection(_webglrender, this.canvas.clientWidth, this.canvas.clientHeight);
                _groundReflection.setClearColors(this.clearColorTop, this.clearColorBottom);
                _groundReflection.toggleEnvMapBackground(_envMapBackground);
                _groundReflection.setEnvRotation(_renderer.getEnvRotation());
                updateGroundTransform();
            }
            else {
                _groundReflection.cleanup();
                _groundReflection = undefined;
            }

            this.fireRenderOptionChanged();
            this.invalidate(true, false, false);
        };

        this.setGroundReflectionColor = function (color) {
            if (!_groundReflection) return;

            _groundReflection.setColor(color);
            this.invalidate(true, false, false);
        };

        this.setGroundReflectionAlpha = function (alpha) {
            if (!_groundReflection) return;

            _groundReflection.setAlpha(alpha);
            this.invalidate(true, false, false);
        };

        this.toggleEnvMapBackground = function (value) {
            _envMapBackground = value;
            _renderer.toggleEnvMapBackground(value);

            if (_groundReflection) {
                _groundReflection.toggleEnvMapBackground(value);
            }
            this.invalidate(true, true, false);
        };

        this.isEnvMapBackground = function () {
            return _envMapBackground;
        };

        this.toggleRenderPrism = function (value) {
            _materials.setRenderPrism(value);

            //TODO: support switching at run-time.
        };

        this.setOptimizeNavigation = function (value) {
            this.skipAOWhenMoving = value;
        };

        this.renderOverlays = function () {

            //The overlays (selection, pivot, etc) get lighted using
            //the default lights, even if IBL is on
            var lightsOn = this.lightsOn;
            if (!lightsOn)
                this.toggleLights(true, true);

            var oldIntensity;
            if (this.dir_light1) {
                oldIntensity = this.dir_light1.intensity;
                this.dir_light1.intensity = 1;
            }

            _renderer.renderOverlays(this.overlayScenes, this.lights);

            if (!lightsOn)
                this.toggleLights(false, true);

            if (this.dir_light1)
                this.dir_light1.intensity = oldIntensity;

            _overlayDirty = false;
        };

        this.setLayerVisible = function (layerIndexes, visible) {
            this.matman().setLayerVisible(layerIndexes, visible);
        };

        this.isLayerVisible = function (layerIndex) {
            return this.matman().isLayerVisible(layerIndex);
        };

        this.updateCameraMatrices = (function () {

            var tmpCameraMatrix;
            var tmpViewMatrix;
            var tmpBox;

            function init_three() {
                tmpCameraMatrix = new THREE.Matrix4();
                tmpViewMatrix = new THREE.Matrix4();
                tmpBox = new THREE.Box3();
            }

            return function () {

                if (!tmpBox)
                    init_three();

                var camera = this.camera;

                //NOTE: This is not computing the same matrix as what we use for rendering,
                //in cases where we are in ORTHO mode and the camera is inside the model,
                //which would result in negative near plane. For the purposes of computing
                //the near/far planes, we have to skip the logic that adjusts the view matrix
                //based on the near/far planes. See UnifiedCamera.updateMatrix for the related
                //adjustment to the view matrix.
                tmpCameraMatrix.compose(camera.position, camera.quaternion, camera.scale);
                tmpViewMatrix.getInverse(tmpCameraMatrix);

                //TODO: Would be nice if this got called by the world up tool instead,
                //so that we don't have to update it every frame.
                if (camera.worldup)
                    this.setWorldUp(camera.worldup);

                //Fix near and far to fit the current view
                if (this.model) {
                    var worldBox = this.getVisibleBounds(true, _overlayDirty);
                    tmpBox.copy(worldBox);

                    //If reflection is on, then we need to double the worldBox size in the Y
                    //direction, the reflection direction, otherwise the reflected view can be
                    //clipped.
                    if (_groundReflection) {
                        // Increase bounding box to include ground reflection geometry. The idea
                        // here is to extend the bounding box in the direction of reflection, based
                        // on the "up" vector.
                        var tmpVecReflect = new THREE.Vector3();
                        tmpVecReflect.multiplyVectors(tmpBox.max, camera.worldup);
                        var tmpVecMin = new THREE.Vector3();
                        tmpVecMin.multiplyVectors(tmpBox.min, camera.worldup);
                        tmpVecReflect.sub(tmpVecMin);
                        // tmpVecReflect holds how much to increase the bounding box.
                        // Negative values means the "up" vector is upside down along that axis,
                        // so we increase the maximum bounds of the bounding box in this case.
                        if (tmpVecReflect.x >= 0.0) {
                            tmpBox.min.x -= tmpVecReflect.x;
                        } else {
                            tmpBox.max.x -= tmpVecReflect.x;
                        }
                        if (tmpVecReflect.y >= 0.0) {
                            tmpBox.min.y -= tmpVecReflect.y;
                        } else {
                            tmpBox.max.y -= tmpVecReflect.y;
                        }
                        if (tmpVecReflect.z >= 0.0) {
                            tmpBox.min.z -= tmpVecReflect.z;
                        } else {
                            tmpBox.max.z -= tmpVecReflect.z;
                        }
                    }

                    //Transform the world bounds to camera space
                    //to estimate the near/far planes we need for this frame
                    tmpBox.applyMatrix4(tmpViewMatrix);

                    //Expand the range by a small amount to avoid clipping when
                    //the object is perfectly aligned with the axes and has faces at its boundaries.
                    var sz = 1e-5 * (tmpBox.max.z - tmpBox.min.z);

                    //TODO: expand for ground shadow. This just matches what the
                    //ground shadow needs, but we need a better way to take into account
                    //the ground shadow scene's bounds
                    var expand = (tmpBox.max.y - tmpBox.min.y) * 0.5;

                    var dMin = -(tmpBox.max.z + sz) - expand;
                    var dMax = -(tmpBox.min.z - sz) + expand;

                    //Camera is inside the model?
                    if (camera.isPerspective)
                        dMin = Math.max(dMin, Math.min(1, Math.abs(dMax - dMin) * 1e-4));
                    else {
                        //TODO:
                        //Do nothing in case of ortho. While this "fixes" near plane clipping too early,
                        //it effectively disallows moving through walls to go inside the object.
                        //So we may need some heuristic based on how big we want the object to be
                        //on screen before we let it clip out.
                        //dMin = Math.max(dMin, 0);
                    }

                    //The whole thing is behind us -- nothing will display anyway?
                    dMax = Math.max(dMax, dMin);

                    camera.near = dMin;
                    camera.far = dMax;
                    camera.updateProjectionMatrix();

                    //Update the line width scale with the
                    //new pixels per unit scale
                    var distance;
                    if (this.model.is2d()) {
                        //Here we base pixel scale on the point at the center of the view.
                        //However, this might not always be the most appropriate point,
                        //e.g. at oblique angles or when the drawing is off to one side.
                        //It might make more sense to base the scale on the distance of the
                        //camera to the nearest part of the world bounding box, which requires
                        //a more generic ray-aabb test.
                        var groundPt = this.intersectGroundViewport(new THREE.Vector3(0, 0, 1));

                        if (groundPt)
                            distance = camera.position.distanceTo(groundPt);
                        else
                            distance = camera.position.distanceTo(worldBox.center()); //degenerate case: camera direction is parallel to the ground plane

                        //NOTE: In case of ortho projection, we set FOV such that tan(fov/2) = 0.5,
                        //so here we don't need separate code path for ortho.
                        var pixelsPerUnit = _renderer.settings.deviceHeight / (2 * distance * Math.tan(THREE.Math.degToRad(camera.fov * 0.5)));

                        //If we want to take into account devicePixelRatio for line weights (so that lines are not too thin)
                        //we can do this here, but it's less esthetically pleasing:
                        //pixelsPerUnit /= _webglrenderer.getPixelRatio();

                        _materials.updatePixelScale(pixelsPerUnit);

                        // AutoCAD drawings are commonly displayed with white lines on a black background. Setting reverse swaps (just)
                        // these two colors.
                        _materials.updateSwapBlackAndWhite(this.swapBlackAndWhite);
                    } else {

                        //If there is a cutting plane, get a point on that plane
                        //for by the pixel scale computation.
                        var cp = _materials.getCutPlanesRaw();

                        var pt;
                        if (cp && cp.length) {
                            var p = cp[0];

                            var dir = camera.target.clone().sub(camera.position).normalize();
                            var denominator = dir.dot(p);

                            if (denominator === 0)
                                pt = worldBox.center();
                            else {
                                var t = -(camera.position.clone().dot(p) + p.w) / denominator;
                                pt = worldBox.clampPoint(dir.multiplyScalar(t).add(camera.position));
                            }
                        } else {
                            pt = worldBox.center();
                        }

                        distance = camera.position.distanceTo(pt);

                        //NOTE: In case of ortho projection, we set FOV such that tan(fov/2) = 0.5,
                        //so here we don't need separate code path for ortho.
                        var pixelsPerUnit = _renderer.settings.deviceHeight / (2 * distance * Math.tan(THREE.Math.degToRad(camera.fov * 0.5)));

                        _materials.updatePixelScale(pixelsPerUnit);
                    }

                }
            }
        })();


        this.initLights = function (dist) {
            var lightIntensity = LightPresets[_currentLightPreset].lightMultiplier;

            this.lightNode = new THREE.Object3D();

            this.dir_light1 = new THREE.DirectionalLight(new THREE.Color().setRGB(
                1.0, 1.0, 1.0),//Note this color will be overridden by various light presets
                lightIntensity);

            this.dir_light1.position.set(-1, 0, 1);
            //for whatever reason we need to move the light far out to make it draw correctly,
            //even though it's a directional light
            this.dir_light1.position.multiplyScalar(dist * 1000);
            this.lightNode.add(this.dir_light1);

            //Note this color will be overridden by various light presets
            this.amb_light = new THREE.AmbientLight(new THREE.Color().setRGB(1, 1, 1));

            //We do not add the lights to any scene, because we need to use them
            //in multiple scenes during progressive render.
            //this.scene.add(this.amb_light);

            //Attach the light to the camera so the light moves with the camera
            this.camera.add(this.lightNode);

            this.toggleLights(lightIntensity !== 0);
        };

        this.toggleLights = function (state, isForOverlay) {

            //This can happen during initial construction
            if (!this.amb_light || !this.lightNode)
                return;

            //Light on or off? Add/remove from the scene accordingly.
            if (state && !this.lightsOn) {
                this.lights = [this.dir_light1, this.amb_light];
                this.lightsOn = true;
            }
            else if (!state && this.lightsOn) {
                this.lightsOn = false;
                this.lights = [];
            }

            //Update the light colors based on the current preset
            var preset = LightPresets[_currentLightPreset];
            var ac = preset.ambientLightColor;
            var dc = preset.directLightColor;

            if (this.lightsOn) {
                if (isForOverlay && this.amb_light)
                    this.amb_light.color.setRGB(dc[0] * 0.5, dc[1] * 0.5, dc[2] * 0.5);
                else if (ac && this.amb_light)
                    this.amb_light.color.setRGB(ac[0], ac[1], ac[2]);
                if (dc && this.dir_light1)
                    this.dir_light1.color.setRGB(dc[0], dc[1], dc[2]);
            }
            else {
                //Restores the ambient for the main scene after drawing overlays
                if (ac && this.amb_light && isForOverlay)
                    this.amb_light.color.setRGB(ac[0], ac[1], ac[2]);
            }
        };

        //Forces the view controller to update when the camera
        //changes programmatically (instead of via mouse events).
        this.syncCamera = function (syncWorldUp) {
            this.camera.updateProjectionMatrix();

            if (syncWorldUp)
                this.setWorldUp(this.api.navigation.getWorldUpVector());

            _cameraUpdated = true;
        };


        this.setViewFromFile = function (model, skipTransition) {

            var camera;

            var defaultCamera = model.getDefaultCamera();

            if (defaultCamera) {

                camera = defaultCamera;

            } else {

                //Model has no default view. Make one up based on the bounding box.

                camera = {};

                var bbox = model.getBoundingBox();
                var size = bbox.size();
                camera.target = bbox.center();

                if (!model.is2d()) {
                    camera.isPerspective = true;
                    camera.fov = this.camera.fov;
                    camera.up = this.camera.up.clone();

                    camera.position = camera.target.clone();
                    camera.position.z += 1.5 * Math.max(size.x, size.y, size.z);
                }
                else {
                    camera.isPerspective = false;

                    var pageAspect = size.x / size.y;
                    var screenAspect = this.camera.aspect;

                    //Fit the page to the screen
                    if (screenAspect > pageAspect)
                        camera.orthoScale = size.y;
                    else
                        camera.orthoScale = size.x / screenAspect;

                    //2D case -- ground plane / up vector is Z
                    camera.up = new THREE.Vector3(0, 0, 1);

                    camera.position = camera.target.clone();
                    camera.position.z += camera.orthoScale;

                    //This is to avoid freaking out the camera / controller with co-linear up and direction
                    camera.target.y += 1e-6 * size.y;

                }

            }

            this.setViewFromCamera(camera, skipTransition);
        };

        //Camera is expected to have the properties of a THREE.Camera.
        this.adjustOrthoCamera = function (camera) {

            //Sometimes (Revit) the camera target is unspecified/infinite
            //for ortho. So we pick target and distance such that
            //initial view and orbit is about right
            if (!camera.isPerspective && this.model) {
                var bbox = this.model.getBoundingBox();
                var size = bbox.size();

                var at = camera.target.clone().sub(camera.position);
                if (at.length() > 1000 * size.length()) {
                    //We will try to set a target point that is a similar
                    //distance away as camera->bbox center, but is in the
                    //direction of the at vector (which is not necessarily looking at the center)
                    var dist = camera.position.distanceTo(bbox.center());
                    camera.target.copy(camera.position).add(at.normalize().multiplyScalar(dist));
                }
                else {
                    //TODO: UnifiedCamera does not actually look at the orthoScale property. It bases
                    //the ortho projection on value derived from the position-target distance and an
                    //assumed field of view. Here we apply the inverse so that the initial view is
                    //right, without affecting the initial orbit target.
                    camera.position.copy(camera.target).add(at.normalize().multiplyScalar(-camera.orthoScale));
                }
            }
        };

        //Camera is expected to have the properties of a THREE.Camera.
        this.setViewFromCamera = function (camera, skipTransition) {
            this.adjustOrthoCamera(camera);

            //If up vector is given explicitly (in world space)
            //then use that instead
            //TODO: Is that desired now that we allow heads-down situations?
            //or should we accept the camera exactly as given.
            var upVectorArray = this.model ? this.model.getUpVector() : null;

            //HACK for local testing copy of SaRang
            if (this.model && this.model.getData().basePath.indexOf("SaRang") != -1)
                upVectorArray = [0, 0, 1];

            var up;
            if (upVectorArray)
                up = new THREE.Vector3().fromArray(upVectorArray);
            else
                up = Navigation.snapToAxis(camera.up.clone());

            camera.up = up;


            var navapi = this.api.navigation;
            if (navapi) {
                if (!skipTransition) {
                    this.camera.isPerspective = camera.isPerspective;
                    up = navapi.computeOrthogonalUp(camera.position, camera.target);
                    navapi.setRequestTransitionWithUp(true, camera.position, camera.target, camera.fov, up, camera.up);
                }
                else {

                    //This code path used during initial load -- it sets the view directly
                    //without doing a transition. Transitions require that the camera is set explicitly

                    var tc = this.camera;
                    tc.up.copy(camera.up);
                    tc.position.copy(camera.position);
                    tc.target.copy(camera.target);
                    if (camera.isPerspective) {
                        tc.fov = camera.fov;
                    }
                    else {
                        tc.saveFov = camera.fov;    // Stash original fov
                        tc.fov = UnifiedCamera.ORTHO_FOV;
                    }
                    tc.isPerspective = camera.isPerspective;
                    tc.orthoScale = camera.orthoScale;
                    tc.dirty = true;

                    navapi.setWorldUpVector(tc.up);
                    navapi.setView(tc.position, tc.target);
                    navapi.setPivotPoint(tc.target);

                    this.syncCamera(true);
                }
            }
            _cameraUpdated = true;
        };

        this.setViewFromViewBox = function (model, viewbox, name, skipTransition) {
            if (!model.is2d()) {
                return;
            }


            var camera = {};

            var bbox = model.getBoundingBox();

            var box = {
                width: viewbox[2] - viewbox[0],
                height: viewbox[3] - viewbox[1]
            };
            box.aspect = box.width / box.height;
            box.centerX = viewbox[0] + box.width / 2;
            box.centerY = viewbox[1] + box.height / 2;

            var screenAspect = this.camera.aspect;

            //Fit the viewbox to the screen
            if (screenAspect > box.aspect)
                camera.orthoScale = box.height;
            else
                camera.orthoScale = box.width / screenAspect;

            camera.isPerspective = false;
            camera.position = new THREE.Vector3(box.centerX, box.centerY, bbox.center().z + camera.orthoScale);
            camera.target = new THREE.Vector3(box.centerX, box.centerY, bbox.center().z);
            camera.target.y += 1e-6 * box.height;

            camera.up = new THREE.Vector3(0, 0, 1);

            this.setViewFromCamera(camera, skipTransition);
        };

        this.setWorldUp = function (upVector) {

            if (_worldUp.equals(upVector))
                return;

            _worldUp.copy(upVector);

            // get the (max) up axis and sign
            var maxVal = Math.abs(upVector.x);
            _worldUpName = "x";
            if (Math.abs(upVector.y) > maxVal) {
                _worldUpName = "y";
                maxVal = Math.abs(upVector.y);
            }
            if (Math.abs(upVector.z) > maxVal) {
                _worldUpName = "z";
            }

            var getRotation = function (vFrom, vTo) {
                var rotAxis = (new THREE.Vector3()).crossVectors(vTo, vFrom).normalize();  // not sure why this is backwards
                var rotAngle = Math.acos(vFrom.dot(vTo));
                return (new THREE.Matrix4()).makeRotationAxis(rotAxis, rotAngle);
            };

            var identityUp = new THREE.Vector3(0, 1, 0);
            _this.camera.worldUpTransform = getRotation(identityUp, upVector);

            this.sceneUpdated(false);
        };


        this.addModel = function (model) {
            if (!model)
                return;

            //Is it the first model being loaded into the scene?
            var isOverlay = !!this.model;
            var is2d = model.is2d();

            var diagonalLength = 0;
            if (!this.model) {
                this.model = model;

                _renderer.setUnitScale(model.getUnitScale());

                // Compute a rough size for the model, so that we can set a reasonable AO radius.
                // This simple approach is reasonable for mechanical models, but is probably too
                // large a value for architectural models, where the viewer is inside the model
                // and so the model itself is relatively large compared to the viewer.
                var bbox = model.getData().bbox;
                diagonalLength = bbox.size().length();
            }

            //Create a render list for progressive rendering of the
            //scene fragments
            _modelQueue.addModel(model);
            this.selector.addModel(model);
            this.visibilityManager.addModel(model);

            if (is2d) {
                //In case of a 2D drawing
                //initialize the common line shader
                //and the layers texture

                _materials.initLayersTexture(model);

                var idMatName = _materials.create2DMaterial(model.getData(), {}, true);
                var idMaterial = _materials.findMaterial(model.getData(), idMatName);

                _renderer.enter2DMode(idMaterial);

                if (!isOverlay) {
                    this.is2d = true;

                    //Rememeber the light preset so we can restore is
                    //when we unload the 2d sheet -- the light preset for 2d
                    //is not persisted.
                    _oldLightPreset = _currentLightPreset;
                    this.setLightPreset(Global.DefaultLightPreset2d);

                    var svf = model.getData();
                    if (svf.hidePaper) {
                        var bg = svf.bgColor;
                        var r = (bg >> 16) & 0xff;
                        var g = (bg >> 8) & 0xff;
                        var b = bg & 0xff;
                        this.setClearColors(r, g, b, r, g, b);
                    }
                }
            }

            if (this.api.navigation) {
                this.api.navigation.setIs2D(is2d && !isOverlay);
                this.api.setActiveNavigationTool(); // use default nav tool
            }


            if (!isOverlay) {
                this.setViewFromFile(model, true);
                this.controls.recordHomeView();

                //Currently the lights need to know
                //the overall size of the scene
                //since they are point lights
                var bbox = model.getBoundingBox();
                var radius = 0.5 * bbox.size().length();
                this.initLights(radius);
            }

            // grab the environment preset data from the file.
            if (!is2d && !this.setLightPresetFromFile(model)) {
                //When switching from a 2D sheet back to a 3D view,
                //we restore the environment map that was used for the
                //last 3D view displayed. The operation is delayed until here
                //so that switching between 2D sheets does not incur this unnecessary overhead.
                if (_oldLightPreset >= 0) {
                    this.setLightPreset(_oldLightPreset, true);
                    _oldLightPreset = -1;
                } else {
                    this.setLightPreset(_currentLightPreset, false);
                }
            }

            // however, we override the AO radius, as we want to
            // set our own scaled version
            if (diagonalLength > 0) {
                // 10 works well as a default for most models, including
                // architectural scenes. Surprising! But, for small models,
                // where for some reason the model is not in "human-sized units",
                // 0.05 says the ambient occlusion should extend 5% of the
                // diagonal length of the model.
                // The 10 here should match the SAOShader.js radius of 10.
                _renderer.setAOOptions(Math.min(10.0, 0.05 * diagonalLength));
            }

            this.fireRenderOptionChanged();
            this.invalidate(true);
        };

        this.getSvfMaterialId = function (fragId) {
            return this.model.getFragmentList().getSvfMaterialId(fragId);
        };

        this.getMaterials = function () { return _materials; };


        //Creates a THREE.Mesh representation of a fragment. Currently this is only
        //used as vehicle for activating a fragment instance for rendering once its geometry is received
        //or changing the fragment data (matrix, material). So, it's mostly vestigial.
        this.setupMesh = function (model, threegeom, materialId, matrix) {

            var svf = model.getData();

            var m = {
                geometry: threegeom,
                matrix: matrix,
                isLine: threegeom.isLines,
                is2d: threegeom.is2d
            };

            // Check if this geometry is to be rendered with a line mesh
            if (threegeom.isLines) {
                // Check to see if there are vertex colors
                var vertexColors = !!threegeom.attributes.color;
                // Create a new LineBasicMaterial with vertexColors true/false depending on above
                //TODO: this material also needs to be added to the materials set, but first
                //make sure this will not cause line display side effects.
                var material = new THREE.LineBasicMaterial({ vertexColors: vertexColors });

                // If there are no vertex colors, default to the material color
                if (!vertexColors) {
                    var svfmat = _materials.findMaterial(svf, materialId);
                    material.color = svfmat.color;
                }

                //Register it with material manager so that cutplanes get updated
                _materials.addMaterialNonHDR(svf.basePath + materialId + "_line_" + material.id, material);

                // Use line mesh
                m.material = material;

                svf.hasLines = true;
            } else {
                var material = _materials.findMaterial(svf, materialId);

                if (material) // Save in material so we can map back from material to SVF id.
                    material.svfMatId = materialId;

                _materials.applyGeometryFlagsToMaterial(material, threegeom);

                m.material = material;
            }

            return m;
        };


        // Gets called by the active Loader
        this.onLoadComplete = function (model) {
            _isLoading = false;

            this.signalProgress(100);

            this.sceneUpdated(false);

            //In the case of 2d drawing, initialize the dbIds texture
            //to be used for selection highlighting. Initially,
            //nothing is highlighted
            if (this.is2d) {
                this.selectionMaterial2d = _materials.init2DSelectionMaterial(model);
                this.createOverlayScene("selection2d", this.selectionMaterial2d);
            }

            var svf = model.getData();

            _modelQueue.getGeometryList().printStats();

            //If the model has line geometries
            //set polygon offset on the solid materials
            //so that we avoid z-fighting between solids and
            //their outlines.
            if (svf.hasLines) {
                _materials.togglePolygonOffset(true);
            }

            // Init animations
            var that = this;
            function initAnimations() {
                if (svf.animations) {
                    that.keyFrameAnimator = new KeyFrameAnimator(that, svf.animations.duration);
                    for (var a in svf.animations.animations) {
                        that.keyFrameAnimator.add(svf.animations.animations[a]);
                    }
                    that.keyFrameAnimator.goto(0);
                    that.api.fireEvent({ type: EventType.ANIMATION_READY_EVENT });
                }
                that.api.removeEventListener(EventType.OBJECT_TREE_CREATED_EVENT, initAnimations);
            }
            // init animations after object tree created and geometry loaded
            if (model.isObjectTreeCreated()) {
                initAnimations();
            } else {
                this.api.addEventListener(EventType.OBJECT_TREE_CREATED_EVENT, initAnimations);
            }


            // Fire the event so we know the geometry is done loading.
            this.api.fireEvent({
                type: EventType.GEOMETRY_LOADED_EVENT,
                model: model
            });
        };

        this.signalProgress = function (percent) {
            if (_progressEvent.percent === percent)
                return;
            _progressEvent.percent = percent;
            this.api.fireEvent(_progressEvent);
        };

        this.resize = function (w, h) {
            _needsResize = true;
            _newWidth = w;
            _newHeight = h;
        };


        this.unloadModel = function (model) {

            if (!_modelQueue.removeModel(model))
                return; //model was not found

            if (this.keyFrameAnimator) {
                this.keyFrameAnimator.destroy();
                this.keyFrameAnimator = null;
            }

            model.dtor(this.glrenderer());

            _materials.cleanup(model.getData());

            if (model.isLoadDone())
                model.getData().propWorker.dtor();
            if (model.loader)
                model.loader.dtor();

            this.selector.removeModel(model);
            this.visibilityManager.removeModel(model);

            if (model === this.model) {
                this.model = null;

                if (!_modelQueue.isEmpty())
                    this.model = _modelQueue.getModels()[0];
            }

            this.api.fireEvent({ type: EventType.MODEL_UNLOADED_EVENT, model: model });

            this.invalidate(true);
        };

        this.unloadCurrentModel = function () {
            //Before loading a new model, restore states back to what they
            //need to be when loading a new model. This means restoring transient
            //changes to the render state made when entering 2d mode,
            //like light preset, antialias and SAO settings,
            //and freeing GL objects specific to the old model.
            if (this.is2d) {
                this.is2d = undefined;
                this.selectionMaterial2d = null;
                this.removeOverlayScene("selection2d");
                _renderer.exit2DMode();

                //Restore the state, but do not actually switch it here, because
                //we don't want to spend the time on it
                //when switching from 2d to 2d. See corresponding
                //logic in addModel().
                _currentLightPreset = _oldLightPreset;
            }

            _renderer.beginScene(this.scene, this.camera, this.lights, true);
            _renderer.composeFinalFrame();

            this.model = null;

            var models = _modelQueue.getModels();
            for (var i = models.length - 1; i >= 0; i--)
                this.unloadModel(models[i]);
        };

        var createSelectionScene = function (name, materialPre, materialPost) {
            materialPre.depthWrite = false;
            materialPre.depthTest = true;
            materialPre.side = THREE.DoubleSide;

            materialPost.depthWrite = false;
            materialPost.depthTest = true;
            materialPost.side = THREE.DoubleSide;

            _this.createOverlayScene(name, materialPre, materialPost);
        };

        this.createOverlayScene = function (name, materialPre, materialPost, camera) {
            if (materialPre) {
                _materials.addMaterialNonHDR(name + "_pre", materialPre);
            }
            if (materialPost) {
                _materials.addMaterialNonHDR(name + "_post", materialPost);
            }

            var s = new THREE.Scene();
            s.__lights = this.scene.__lights;
            this.overlayScenes[name] = {
                scene: s,
                camera: camera,
                materialPre: materialPre,
                materialPost: materialPost
            };
        };

        this.removeOverlayScene = function (name) {

            var overlay = this.overlayScenes[name];
            if (overlay) {
                delete this.overlayScenes[name];
                this.invalidate(false, false, true);
            }
        };

        this.addOverlay = function (overlayName, mesh) {
            this.overlayScenes[overlayName].scene.add(mesh);
            this.invalidate(false, false, true);
        };

        this.addMultipleOverlays = function (overlayName, meshes) {
            for (var i in meshes) {
                if (!meshes.hasOwnProperty(i)) continue;
                this.addOverlay(overlayName, meshes[i]);
            }
        };

        this.removeOverlay = function (overlayName, mesh) {
            this.overlayScenes[overlayName].scene.remove(mesh);
            this.invalidate(false, false, true);
        };

        this.removeMultipleOverlays = function (overlayName, meshes) {
            for (var i in meshes) {
                if (!meshes.hasOwnProperty(i)) continue;
                this.removeOverlay(overlayName, meshes[i]);
            }
        };

        this.clearOverlay = function (overlayName) {

            if (!this.overlayScenes[overlayName])
                return;

            var scene = this.overlayScenes[overlayName].scene;
            var obj, i;
            for (i = scene.children.length - 1; i >= 0; --i) {
                obj = scene.children[i];
                if (obj) {
                    scene.remove(obj);
                }
            }

            this.invalidate(false, false, true);
        };

        this.setClearColors = function (r, g, b, r2, g2, b2) {
            this.clearColorTop = new THREE.Vector3(r / 255.0, g / 255.0, b / 255.0);
            this.clearColorBottom = new THREE.Vector3(r2 / 255.0, g2 / 255.0, b2 / 255.0);

            //If we are using the background color as environment also,
            //create an environment map texture from the new colors
            if (!_materials.reflectionCube || _materials.reflectionCube.isBgColor) {
                var cubeMap = _materials.setCubeMapFromColors(this.clearColorTop, this.clearColorBottom);
                _renderer.setCubeMap(cubeMap);
            }

            _renderer.setClearColors(this.clearColorTop, this.clearColorBottom);
            if (_groundReflection) _groundReflection.setClearColors(this.clearColorTop, this.clearColorBottom);
            _needsClear = true;
            this.fireRenderOptionChanged();
        };

        //Similar to THREE.Box3.setFromObject, but uses the precomputed bboxes of the
        //objects instead of doing it per vertex.
        var _box3;
        function computeObjectBounds(dst, object) {

            _box3 = _box3 || new THREE.Box3();

            object.updateMatrixWorld(true);

            object.traverse(function (node) {

                var geometry = node.geometry;

                if (geometry !== undefined && geometry.visible) {

                    if (!geometry.boundingBox)
                        geometry.computeBoundingBox();

                    _box3.copy(geometry.boundingBox);
                    _box3.applyMatrix4(node.matrixWorld);
                    dst.union(_box3);
                }

            });
        }

        function getOverlayBounds() {
            var bounds = new THREE.Box3();
            var overlays = _this.overlayScenes;

            for (var key in overlays) {
                if (!overlays.hasOwnProperty(key))
                    continue;

                computeObjectBounds(bounds, overlays[key].scene);
            }

            //Also add the root scene -- people add overlays there too
            computeObjectBounds(bounds, _this.scene);

            return bounds;
        }

        this.getVisibleBounds = function (includeGhosted, includeOverlays) {
            var result = new THREE.Box3();
            if (!_modelQueue.isEmpty()) {
                computeObjectBounds(result, this.scene);
                result = _modelQueue.getVisibleBounds(includeGhosted).union(result);

                if (includeOverlays) {
                    result = getOverlayBounds().union(result);
                }
            }
            return result;
        };

        this.getFitBounds = function (ignoreSelection) {
            var bounds;

            // If there is a valid selection, use its bounds
            // unless this is a 2d file
            //
            if (this.is2d) {
                ignoreSelection = true;
            }
            if (!ignoreSelection && this.selector !== null) {
                bounds = this.selector.getSelectionBounds();
            }

            // Otherwise, if there is a valid isolation, use its bounds
            if (!bounds || bounds.empty()) {
                bounds = this.getVisibleBounds();
            }

            return bounds;
        };

        this.getRenderProxy = function (model, fragId) {
            //currently there is a single model so the mapping
            //of fragId to render mesh is 1:1.
            return model.getFragmentList().getVizmesh(fragId);
        };

        this.getFragmentProxy = function (model, fragId) {
            return new FragmentPointer(model.getFragmentList(), fragId);
        };

        this.getRenderProxyCount = function (model) {
            return model.getFragmentList().getCount();
        };

        this.getRenderProxyDbIds = function (model, fragId) {
            return model.getFragmentList().getDbIds(fragId);
        };

        this.isWholeModelVisible = function (model) {
            return _modelQueue ? _modelQueue.areAllVisible() : true;
        };

        this.highlightObjectNode = function (model, dbId, value, simpleHighlight) {

            if (model.is2d()) {
                _materials.highlightObject2D(dbId, value); //update the 2d object id texture
            }

            var scope = this;
            var it = model.getData().instanceTree;

            //TODO: There can be instance tree in the case of 2D drawing, but
            //we do not currently populate the node tree with the virtual fragment ids
            //that map 2d objects to 2d consolidated meshes, hence the use of dbId2fragId in the else condition
            if (it && !model.is2d()) {

                it.enumNodeFragments(dbId, function (fragId) {
                    scope.highlightFragment(model, fragId, value, simpleHighlight);
                }, false);

            } else {
                var fragId = dbId;

                if (model.is2d())
                    fragId = model.getData().fragments.dbId2fragId[dbId];

                if (Array.isArray(fragId))
                    for (var i = 0; i < fragId.length; i++)
                        scope.highlightFragment(model, fragId[i], value, simpleHighlight);
                else
                    scope.highlightFragment(model, fragId, value, simpleHighlight);

            }

        };

        this.highlightFragment = function (model, fragId, value, simpleHighlight) {

            var mesh = this.getRenderProxy(model, fragId);

            if (!mesh)
                return;

            //And also add a mesh to the overlays in case we need that.
            //For 2D that is always the case, while for 3D it's done
            //for "fancy" single-selection where we draw an outline for the object
            //as post-processing step.
            var useOverlay = !simpleHighlight || mesh.is2d;

            var highlightId = model.id + ":" + fragId;

            if (useOverlay) {
                var overlayName = model.is2d() ? "selection2d" : "selection";

                if (value) {
                    var selectionProxy = new THREE.Mesh(mesh.geometry, mesh.material);
                    selectionProxy.matrix.copy(mesh.matrixWorld);
                    selectionProxy.matrixAutoUpdate = false;
                    selectionProxy.matrixWorldNeedsUpdate = true;

                    selectionProxy.frustumCulled = false;
                    selectionProxy.model = model;
                    selectionProxy.fragId = fragId;

                    this.addOverlay(overlayName, selectionProxy);

                    this.selectionMeshes[highlightId] = selectionProxy;
                }
                else {
                    if (this.selectionMeshes[highlightId]) {
                        this.removeOverlay(overlayName, this.selectionMeshes[highlightId]);
                        delete this.selectionMeshes[highlightId];
                    }
                }
            }

            if (!useOverlay || !value) {
                //Case where highlighting was done directly in the primary render queue
                //and we need to repaint to clear it. This happens when multiple
                //nodes are highlighted using e.g. right click in the tree view
                if (model.setHighlighted(fragId, value)) //or update the vizflags in the render queue for 3D objects
                    this.invalidate(true);
            }
        };

        this.explode = function (scale) {

            if (scale == _explodeScale)
                return;

            _explodeScale = scale;

            _modelQueue.explode(scale);

            //force a repaint and a clear
            this.sceneUpdated(true);

            this.api.fireEvent({ type: EventType.EXPLODE_CHANGE_EVENT, scale: scale });
        };

        /**
         * Gets the last applied explode scale
         */
        this.getExplodeScale = function () {
            return _explodeScale;
        };


        /* simple function to set the brightness of the ghosting.
         * Simply sets another colour that is better for brighter environments
         */
        this.setGhostingBrightness = function (darkerFade) {
            if (darkerFade) {
                this.fadeMaterial.color = new THREE.Color(0x101010);
            }
            else {
                this.fadeMaterial.color = new THREE.Color(0xffffff);
            }
            this.fadeMaterial.needsUpdate = true;
        };


        this.setLightPreset = function (index, force) {
            if (_currentLightPreset == index && !force)
                return;

            // Reset index in cases the index out of range.
            // This could happen, if we update the light preset list and user
            // has a local web storage which stores the last accessed preset index which is potentially
            // out of range with respect to the new preset list.
            if (index < 0 || LightPresets.length <= index) {
                index = Global.DefaultLightPreset;
            }

            _currentLightPreset = index;
            var preset = LightPresets[index];
            if (preset && preset.path) {
                var pathPrefix = "res/environments/" + preset.path;
                var reflPath = getResourceUrl(pathPrefix + "_mipdrop." + (preset.type || "") + ".dds");
                var irrPath = getResourceUrl(pathPrefix + "_irr." + (preset.type || "") + ".dds");

                _materials.setIrradianceMap(irrPath, preset.E_bias);
                var cubeMap = _materials.setCubeMap(reflPath, preset.E_bias);
                _renderer.setCubeMap(cubeMap);

                //Set exposure that the environment was baked with.
                //This has to be known at baking time and is applied
                //by the shader.
                _materials.setEnvExposure(-preset.E_bias);

                this.setTonemapExposureBias(preset.E_bias);
                this.setTonemapMethod(preset.tonemap);

                this.setGhostingBrightness(preset.darkerFade);
            }
            else {
                _materials.setIrradianceMap(null);
                var cubeMap = _materials.setCubeMap(null);
                _renderer.setCubeMap(cubeMap);
                _materials.setEnvExposure(0);

                this.setTonemapExposureBias(0);
                this.setTonemapMethod(0);

                this.setGhostingBrightness(false);
            }


            //To begin with, get the SAO defaults from the shader uniforms definition
            //Note the scaling we apply to inverse scaling done by the setAOOptions API internally.
            //This is not pretty....
            var saoRadius = SAOShader.uniforms.radius.value;
            var saoIntensity = SAOShader.uniforms.intensity.value;

            //Check if the preset overrides the SAO settings
            if (preset.hasOwnProperty("saoRadius"))
                saoRadius = preset.saoRadius;
            if (preset.hasOwnProperty("saoIntensity"))
                saoIntensity = preset.saoIntensity;
            _renderer.setAOOptions(saoRadius, saoIntensity);

            //if the light preset has a specific background color, set that
            var c = preset.bgColorGradient;
            if (!c)
                c = BackgroundPresets["Custom"];
            this.setClearColors(c[0], c[1], c[2], c[3], c[4], c[5]);

            var lightIntensity = 1;
            if (preset.lightMultiplier !== null && preset.lightMultiplier !== undefined) {
                lightIntensity = preset.lightMultiplier;
            }

            if (this.dir_light1) {
                this.toggleLights(lightIntensity !== 0);
                this.dir_light1.intensity = lightIntensity;

                if (preset.lightDirection) {

                    this.dir_light1.position.set(-preset.lightDirection[0], -preset.lightDirection[1], -preset.lightDirection[2]);
                    //for whatever reason we need to move the light far out to make it draw correctly,
                    //even though it's a directional light
                    this.dir_light1.position.multiplyScalar(this.model.getData().bbox.size().length() * 1000);

                }

            }

            _materials.setEnvRotation(preset.rotation || 0.0);
            _renderer.setEnvRotation(preset.rotation || 0.0);

            if (_groundReflection) _groundReflection.setEnvRotation(preset.rotation || 0.0);

            this.invalidate(true, false, true);

            this.fireRenderOptionChanged();
        };

        this.setLightPresetFromFile = function (model) {

            var style = model.getMetadata('renderEnvironmentStyle', 'value', null);

            if ((style === null) || (style === ""))
                return false;

            // TODO add more control for environments
            // the user cannot set anything expect the style from current UI
            // currently only the style can be selected.
            // TODO We cannot control these values so comment out for now
            //var grndReflection = this.getMetadata('renderEnvironmentGroundReflection', 'value', null);
            // default value = false
            //var grndShadow = this.getMetadata('renderEnvironmentGroundShadow', 'value', null);
            // default value = false

            var exposureBias = model.getMetadata('renderEnvironmentExposureBias', 'value', null);
            var exposureBase = model.getMetadata('renderEnvironmentExposureBase', 'value', null);

            var found = false;
            for (var i = 0; i < LightPresets.length; i++) {
                if (style === LightPresets[i].name) {
                    if (exposureBias !== null && exposureBase !== null) {
                        //TODO: This is overwriting the setting in our main Environment definitions array.
                        //In fact, the setting should probably be transient for the viewable only we
                        //we should not be writing it back the definition.
                        LightPresets[i].E_bias = exposureBias + exposureBase;
                    }
                    this.setLightPreset(i);
                    found = true;
                    break;
                }
            }

            var bgColor = model.getMetadata('renderEnvironmentBackgroundColor', 'value', null);
            if (bgColor) {
                this.setClearColors(
                    255.0 * bgColor[0], 255.0 * bgColor[1], 255.0 * bgColor[2],
                    255.0 * bgColor[0], 255.0 * bgColor[1], 255.0 * bgColor[2]);
            }

            var bgEnvironment = model.getMetadata('renderEnvironmentBackgroundFromEnvironment', 'value', null);
            if (bgEnvironment !== null) {
                this.toggleEnvMapBackground(bgEnvironment);
            }

            // Environment rotation, assumed to be in radians
            var envRotation = model.getMetadata('renderEnvironmentRotation', 'value', null);
            if (envRotation) {
                _materials.setEnvRotation(envRotation);
                _renderer.setEnvRotation(envRotation);

                if (_groundReflection) _groundReflection.setEnvRotation(envRotation);
            }

            return found;
        };


        this.setTonemapMethod = function (index) {

            if (index == _renderer.getToneMapMethod())
                return;

            _renderer.setTonemapMethod(index);
            _materials.setTonemapMethod(index);

            this.fireRenderOptionChanged();
            this.invalidate(true);
        };

        this.setTonemapExposureBias = function (bias) {

            if (bias == _renderer.getExposureBias())
                return;

            _renderer.setTonemapExposureBias(bias);
            _materials.setTonemapExposureBias(bias);

            this.fireRenderOptionChanged();
            this.invalidate(true);
        };


        /**
         * Unloads model, frees memory, as much as possible.
         */
        this.dtor = function () {
            window.cancelAnimationFrame(_reqid);

            this.unloadCurrentModel();

            // this.controls is uninitialized by Viewer3D, since it was initialized there
            this.controls = null;
            this.canvas = null;

            this.loader = null;

            this.selector.dtor();
            this.selector = null;

            this.model = null;
            this.visibilityManager = null;

            _modelQueue = null;
            _renderer = null;
            _materials.dtor();
            _materials = null;
        };

        this.hideLines = function (hide) {
            if (_modelQueue && !_modelQueue.isEmpty()) {
                _modelQueue.hideLines(hide);
                this.sceneUpdated(true);
                return true;
            }
            return false;
        };

        this.getCutPlanes = function () {
            return _materials.getCutPlanes();
        };

        this.setCutPlanes = function (planes) {
            _materials.setCutPlanes(planes);
            this.sceneUpdated();
            this.api.fireEvent({ type: EventType.CUTPLANES_CHANGE_EVENT });
        };

        this.fireRenderOptionChanged = function () {

            //If SAO is changing and we are using multiple
            //render targets in the main material pass, we have
            //to update the materials accordingly.
            _materials.toggleMRTSetting();

            this.api.fireEvent({ type: EventType.RENDER_OPTION_CHANGED_EVENT });
        };

        this.viewportToRay = function (vpVec, ray) {
            var camera = this.camera;

            // set two vectors with opposing z values
            vpVec.z = -1.0;
            var end = new THREE.Vector3(vpVec.x, vpVec.y, 1.0);
            vpVec = vpVec.unproject(camera);
            end = end.unproject(camera);

            // find direction from vector to end
            end.sub(vpVec).normalize();

            if (!ray)
                ray = new THREE.Ray();

            ray.set(!camera.isPerspective ? vpVec : camera.position, end);

            return ray;
        };

        // Add "meshes" parameter, after we get meshes of the object using id buffer,
        // then we just need to ray intersect this object instead of all objects of the model.
        this.rayIntersect = function (ray, ignoreTransparent, dbIds, modelIds) {
            var result = _modelQueue.rayIntersect(ray.origin, ray.direction, ignoreTransparent, dbIds, modelIds);

            if (this.sceneAfter.children.length) {
                var raycaster = new THREE.Raycaster(ray.origin, ray.direction, this.camera.near, this.camera.far);
                var intersects = [];
                VBIntersector.intersectObject(this.sceneAfter, raycaster, intersects, true);

                if (intersects.length) {
                    if (!result || intersects[0].distance < result.distance) {
                        result = intersects[0];
                    }
                }
            }

            if (!result)
                return null;

            var fragId = result.fragId,
                intersectPoint = result.point,
                face = result.face,
                model = result.model;

            var dbId = result.dbId;
            if (dbId === undefined && fragId !== undefined /* 0 is a valid fragId */) {

                dbId = model.getFragmentList().getDbIds(fragId);
                var instanceTree = model.getData().instanceTree;

                if (!instanceTree) {
                    //Case where there is no object tree hierarchy. Create a 'virtual' node
                    //with node Id = fragment Id, so that selection works like
                    //each scene fragment is a scene node by itself.
                    dbId = fragId;
                }
            }

            return { dbId: dbId, fragId: fragId, "intersectPoint": intersectPoint, "face": face, "model": model };
        };

        this.castRayViewport = function () {

            var _ray;

            // Add "meshes" parameter, after we get meshes of the object using id buffer,
            // then we just need to ray intersect this object instead of all objects of the model.
            return function (vpVec, ignoreTransparent, dbIds, modelIds) {

                _ray = _ray || new THREE.Ray();

                if (!_modelQueue) {
                    return {};
                }

                this.viewportToRay(vpVec, _ray);

                return this.rayIntersect(_ray, ignoreTransparent, dbIds, modelIds);
            };

        }();

        this.clientToViewport = function (clientX, clientY) {
            var rect = _this.canvas.getBoundingClientRect();
            return new THREE.Vector3(
                ((clientX + 0.5) / rect.width) * 2 - 1,
               -((clientY + 0.5) / rect.height) * 2 + 1, 1);
        };

        this.viewportToClient = function (viewportX, viewportY) {
            var rect = _this.canvas.getBoundingClientRect();
            return new THREE.Vector3(
                (viewportX + 1) * 0.5 * rect.width - 0.5,
                (viewportY - 1) * -0.5 * rect.height - 0.5, 0);
        };

        this.castRay = function (clientX, clientY, ignoreTransparent) {
            // Use the offsets based on the client rectangle, which is relative to the browser's client
            // rectangle, unlike offsetLeft and offsetTop, which are relative to a parent element.
            //
            return this.castRayViewport(this.clientToViewport(clientX, clientY), ignoreTransparent);
        };


        this.intersectGroundViewport = function (vpVec) {

            var camera = this.camera;

            var worldUp = "z";

            //In 2D mode, the roll tool can be used to change the orientation
            //of the sheet, which will also set the world up vector to the new orientation.
            //However, this is not what we want in case of a 2d sheet -- its ground plane is always Z.
            //TODO: It's not clear if checking here or in setWorldUp is better. Also I don't see
            //a way to generalize the math in a way to make it work without such check (e.g. by using camera up only).
            if (!this.is2d) {
                worldUp = _worldUpName;
            }

            var vector = vpVec;

            // set two vectors with opposing z values
            vector.z = -1.0;
            var end = new THREE.Vector3(vector.x, vector.y, 1.0);
            vector = vector.unproject(camera);
            end = end.unproject(camera);

            // find direction from vector to end
            end.sub(vector).normalize();

            var dir = end;

            //Is the direction parallel to the ground plane?
            //Then we fail.
            if (Math.abs(dir[worldUp]) < 1e-6)
                return null;

            var rayOrigin;
            if (camera.isPerspective) {
                rayOrigin = camera.position;
            }
            else {
                rayOrigin = vector;
            }

            var baseElev = this.model ? this.model.getBoundingBox().min[worldUp] : 0;

            var distance = (baseElev - rayOrigin[worldUp]) / dir[worldUp];

            //2D drawing, intersect the plane
            dir.multiplyScalar(distance);
            dir.add(rayOrigin);

            return dir;
        };

        this.intersectGround = function (clientX, clientY) {
            return this.intersectGroundViewport(this.clientToViewport(clientX, clientY));
        };


        this.hitTestViewport = function (vpVec, ignoreTransparent) {

            var result;

            if (_this.is2d) {

                var dbId;
                var ids = [];
                if (DeviceType.isMobileDevice) {
                    // Set the detection area to 44*44 pixel rectangle according to Apple's iOS Human Interface Guidelines
                    dbId = _renderer.idAtPixels(vpVec.x, vpVec.y, 45, ids);
                }
                else {
                    // Set the detection area to 5*5 pixel search rectangle
                    dbId = _renderer.idAtPixels(vpVec.x, vpVec.y, 5, ids);
                }

                if (dbId <= 0)
                    return null;

                //Note this function will destructively modify vpVec,
                //so it's unusable after that.
                var point = this.intersectGroundViewport(vpVec);

                var model = _modelQueue.findModel(ids[1]) || _this.model;

                //var node = dbId ? { dbId : dbId, fragIds : _this.model.getData().fragments.dbId2fragId[dbId] } : null;
                result = {
                    intersectPoint: point,
                    dbId: dbId,
                    fragId: model.getData().fragments.dbId2fragId[dbId],
                    model: model
                };
            }
            else {

                result = this.castRayViewport(vpVec, ignoreTransparent);

            }

            return result;
        };


        this.hitTest = function (clientX, clientY, ignoreTransparent) {

            return _this.hitTestViewport(this.clientToViewport(clientX, clientY), ignoreTransparent);

        };

        this.snappingHitTestViewport = function (vpVec, ignoreTransparent) {

            var result;

            if (_this.is2d) {

                var dbId;
                if (DeviceType.isMobileDevice) {
                    //Set the detection area to 44*44 pixel rectangle according to Apple's iOS Human Interface Guidelines
                    //Notice: The amount of pixels per line should correspond to pixelSize in setDetectRadius of Snapper.js,
                    //the shape of detection area is square in idAtPixels, but circle in snapper, should make their areas match roughly.
                    dbId = _renderer.idAtPixels(vpVec.x, vpVec.y, 45);
                }
                else {
                    //Notice: The amount of pixels per line should correspond to pixelSize in setDetectRadius of Snapper.js,
                    //the shape of detection area is square in idAtPixels, but circle in snapper, should make their areas match roughly.
                    dbId = _renderer.idAtPixels(vpVec.x, vpVec.y, 17);
                }

                // Need to do hitTest in snapping when dbId = 0
                if (dbId < 0)
                    return null;

                //Note this function will destructively modify vpVec,
                //so it's unusable after that.
                var point = this.intersectGroundViewport(vpVec);

                // get fragment ID if there is a fragment list
                var fragments = _this.model.getData().fragments;
                var fragId = (fragments ? fragments.dbId2fragId[dbId] : -1);

                //var node = dbId ? { dbId : dbId, fragIds : _this.model.getData().fragments.dbId2fragId[dbId] } : null;
                result = { intersectPoint: point, dbId: dbId, fragId: fragId };

                if (dbId) {
                    //result.node = ... get the node for the dbId here
                }

            }
            else {

                var dbId = _renderer.idAtPixel(vpVec.x, vpVec.y);

                result = this.castRayViewport(vpVec, ignoreTransparent, dbId > 0 ? [dbId] : null);

            }

            return result;
        };

        // Used for snapping
        // firstly, find the intersect object using pre-computed ID buffer
        // secondly, find the intersect point and face using intersection test
        this.snappingHitTest = function (clientX, clientY, ignoreTransparent) {

            return this.snappingHitTestViewport(this.clientToViewport(clientX, clientY), ignoreTransparent);
        };

        //Used for rollover highlighting using pre-computed ID buffer
        //Currently only the 2D code path can do this.
        this.rolloverObjectViewport = function (vpVec) {

            //Not supported for 3d.
            //if (!this.is2d)
            //    return;

            if (_renderer.rolloverObjectViewport(vpVec.x, vpVec.y))
                this.invalidate(false, false, true);
        };

        this.rolloverObject = function (clientX, clientY) {

            if (!this.rolloverDisabled)
                this.rolloverObjectViewport(this.clientToViewport(clientX, clientY));
        };

        this.disableRollover = function (disable) {

            this.rolloverDisabled = disable;
        };

        this.rolloverObjectNode = function (dbId) {

            var dbIds = [];
            var it = _this.model.getData().instanceTree;

            if (it) {

                it.enumNodeChildren(dbId, function (childId) {
                    dbIds.push(childId);
                }, true);

                // Sort the array to get the dbIds range, it should exclude the first node which
                // is local root, since its dbId may not be serial number like its descendants.
                if (dbIds.length > 1) {
                    var temp = dbIds.shift();
                    dbIds.sort(function (a, b) { return a - b; });
                    dbIds.unshift(temp);
                }

            }
            else {
                dbIds.push(dbId);
            }

            if (_renderer.rolloverObjectViewport(null, null, dbIds))
                this.invalidate(false, false, true);
        };

        // https://github.com/ebidel/filer.js/blob/master/src/filer.js
        function dataURLToBlob(dataURL) {
            var BASE64_MARKER = ';base64,';
            var parts, contentType, raw;
            if (dataURL.indexOf(BASE64_MARKER) == -1) {
                parts = dataURL.split(',');
                contentType = parts[0].split(':')[1];
                raw = decodeURIComponent(parts[1]);

                return new Blob([raw], { type: contentType });
            }

            parts = dataURL.split(BASE64_MARKER);
            contentType = parts[0].split(':')[1];
            raw = window.atob(parts[1]);
            var rawLength = raw.length;

            var uInt8Array = new Uint8Array(rawLength);

            for (var i = 0; i < rawLength; ++i) {
                uInt8Array[i] = raw.charCodeAt(i);
            }

            return new Blob([uInt8Array], { type: contentType });
        }

        //this function get a blob object
        this.getScreenShotBuffer = function (w, h, cb) {
            _renderer.presentBuffer();
            var blobobj = _this.canvas.toDataURL("image/png");

            if (!w || !h)
                return blobobj;

            // calc resize and center
            var nw, nh, nx = 0, ny = 0;
            if (w > h || (_newWidth / _newHeight < w / h)) {
                nw = w;
                nh = _newHeight / _newWidth * w;
                ny = h / 2 - nh / 2;
            }
            else {
                nh = h;
                nw = _newWidth / _newHeight * h;
                nx = w / 2 - nw / 2;
            }

            var blobURL = window.URL.createObjectURL(dataURLToBlob(_this.canvas.toDataURL("image/png")));
            // new image from blobURL
            var img = new Image();
            img.src = blobURL;

            // create working canvas
            var tmpCanvas = document.createElement("canvas");
            var ctx = tmpCanvas.getContext("2d");
            tmpCanvas.width = w;
            tmpCanvas.height = h;

            // draw image on canvas
            img.onload = function () {
                ctx.drawImage(img, nx, ny, nw, nh);
                var newobj = tmpCanvas.toDataURL("image/png");
                var newBlobURL = window.URL.createObjectURL(dataURLToBlob(tmpCanvas.toDataURL("image/png")));
                if (cb)
                    cb(newobj);
                else
                    window.open(newBlobURL);
            };
        };

        // we use Blob URL, Chrome crashes when opening dataURL that is too large
        // https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
        this.getScreenShot = function (w, h, cb) {
            _renderer.presentBuffer();
            var blobURL = window.URL.createObjectURL(dataURLToBlob(_this.canvas.toDataURL("image/png")));

            if (!w || !h)
                return blobURL;

            // calc resize and center
            var nw, nh, nx = 0, ny = 0;
            if (w > h || (_newWidth / _newHeight < w / h)) {
                nw = w;
                nh = _newHeight / _newWidth * w;
                ny = h / 2 - nh / 2;
            }
            else {
                nh = h;
                nw = _newWidth / _newHeight * h;
                nx = w / 2 - nw / 2;
            }

            // new image from blobURL
            var img = new Image();
            img.src = blobURL;

            // create working canvas
            var tmpCanvas = document.createElement("canvas");
            var ctx = tmpCanvas.getContext("2d");
            tmpCanvas.width = w;
            tmpCanvas.height = h;

            // draw image on canvas
            img.onload = function () {
                ctx.drawImage(img, nx, ny, nw, nh);
                var newBlobURL = window.URL.createObjectURL(dataURLToBlob(tmpCanvas.toDataURL("image/png")));
                if (cb)
                    cb(newBlobURL);
                else
                    window.open(newBlobURL);
            };
        };

        //This accessor is only used for debugging purposes a.t.m.
        this.modelQueue = function () { return _modelQueue; };

        this.glrenderer = function () { return _webglrender; };

        this.renderer = function () { return _renderer; };

        this.worldUp = function () { return _worldUp; };
        this.worldUpName = function () { return _worldUpName; };

        this.setUserRenderContext = function (ctx) {

            //restore our own render context
            if (!ctx) {
                _renderer = new RenderContext();
            }
            else {
                _renderer = ctx;
            }

            _renderer.init(_webglrender, this.canvas.clientWidth, this.canvas.clientHeight);
            _renderer.setClearColors(this.clearColorTop, this.clearColorBottom);
            this.invalidate(true);
            this.sceneUpdated(false); //to reset world boxes needed by new RenderContext for shadows, etc
        };

        this.invalidate = function (needsClear, needsRender, overlayDirty) {
            _needsClear = _needsClear || needsClear;
            _needsRender = _needsRender || needsRender;
            _overlayDirty = _overlayDirty || overlayDirty;
        };

        this.sceneUpdated = function (objectsMoved) {

            this.invalidate(true, false, true);

            // Mark the scene bounds for update
            if (_modelQueue && objectsMoved)
                _modelQueue.invalidateVisibleBounds();

            _sceneDirty = true;

        };

        this.currentLightPreset = function () { return _currentLightPreset; };

        this.matman = function () { return _materials; };

        this.fps = function () { return 1000.0 / _frameTimeAvg; };

        this.setFPSTargets = function (min, target, max) {
            MAX_FRAME_TIME = 1000 / max;
            MIN_FRAME_TIME = 1000 / min;
            TARGET_FRAME_TIME = 1000 / target;
            this.targetFrameTime = TARGET_FRAME_TIME;
        };

        //========================================================================


        // Record fragments transformation in explode mode for RaaS rendering
        //this.fragTransformConfig = [];

        this.track = function (event) {
            Logger.track(event);
        };

        this.worldToClient = function (point) {
            var p = new THREE.Vector4(point.x, point.y, point.z, 1);
            p.applyMatrix4(this.camera.matrixWorldInverse);
            p.applyMatrix4(this.camera.projectionMatrix);

            // Don't want to mirror values with negative z (behind camera)
            if (p.w > 0) {
                p.x /= p.w;
                p.y /= p.w;
                p.z /= p.w;
            }

            return this.viewportToClient(p.x, p.y);
        };

        this.clientToWorld = function (clientX, clientY, ignoreTransparent) {

            var result = null;
            var model = this.model;
            var modelData = model.getData();

            if (model.is2d()) {

                var collision = this.intersectGround(clientX, clientY);
                if (collision) {
                    collision.z = 0;
                    var bbox = modelData.bbox;
                    if (modelData.hidePaper || bbox.containsPoint(collision)) {
                        result = {
                            point: collision,
                            model: model
                        };
                    }
                }
            } else {

                // hitTest handles multiple scenes
                result = this.hitTest(clientX, clientY, ignoreTransparent);
                if (result) {
                    result.point = result.intersectPoint; // API expects attribute point to have the return value too.
                }
            }

            return result;
        };

        /**
         *
         * @param {THREE.Color} color
         */
        this.setSelectionColor = function (color) {
            this.selectionMaterialBase.color.set(color);
            this.selectionMaterialTop.color.set(color);
            this.invalidate(false, false, true);
        };

        // Update the viewport Id for the first selection in 2d measure
        this.updateViewportId = function (vpId) {

            _materials.updateViewportId(vpId);
        };

    }

    Viewer3DImpl.prototype.constructor = Viewer3DImpl;

    return Viewer3DImpl;
});