define([
    '../Core/Manager/theExtensionManager',
    './Extension',
    '../Core/Utils/FullscreenTool',
    '../Core/Logger',
    '../Core/Constants/EventType',
    './StereoRenderContext'
], function(theExtensionManager, Extension, FullscreenTool, Logger, EventType, StereoRenderContext) {
    'use strict';
    var launchFullscreen = FullscreenTool.launchFullscreen;
    var exitFullscreen = FullscreenTool.exitFullscreen;
    var _vrHMD = null, _vrSensor = null;
    
    
        function HeadTrackingTool(viewer) {
    
            var _camera;
            var _viewer = viewer;
    
            var _headPos = new THREE.Vector3(0, 0, 0);
            var _headQuat = new THREE.Quaternion();
            var _turnQuat = new THREE.Quaternion();
            var _mView = new THREE.Matrix4();
            var _headPosBase = new THREE.Vector3(0, 0, 0);
            var _mViewBase = new THREE.Matrix4();
            var _mTmp = new THREE.Matrix4();
            var _sensorData, _lastId = 0;
            var _toModelUnits = 1.0;
    
            var SPEED_SCALE = 10.0;
            var LOOK_SCALE = 0.001;
            var _lastTime = -1.0;
            var _baseAzimuth = 0.0;
    
            var _W = 0, _A = 0, _S = 0, _D = 0, _Q = 0, _E = 0;
    
            var _ws;
    
            if (!_vrSensor)
                initWebSocket();
            else
                _sensorData = [0, 0, 0, 0, 0, 0, 0, 0];
    
    
            this.getNames = function () {
                return ["headtracker"];
            };
    
            this.getName = function () {
                return "headtracker";
            };
    
            var _gamepadModule;
            this.activate = function (name) {
    
                _camera = _viewer.navigation.getCamera();
    
                resetOrientation();
    
                if (_viewer.model) {
                    _toModelUnits = 1.0 / _viewer.model.getUnitScale();
                    var box = _viewer.model.getBoundingBox();
                    SPEED_SCALE = box.size().length() * 0.0001;
    
                }
    
                //if this browser supports gamepad, instantiate GamepadModule
                if (navigator.getGamepads || !!navigator.webkitGetGamepads || !!navigator.webkitGamepads) {
                    _gamepadModule = new Autodesk.Viewing.Extensions.GamepadModule(_viewer);
                    _gamepadModule.activate(this.getName());
                }
            };
    
            this.deactivate = function (name) {
                _camera = null;
                if (_gamepadModule)
                    _gamepadModule.deactivate();
            };
    
            this.update = function (timeStamp) {
    
                if (_lastTime < 0)
                    _lastTime = timeStamp;
    
                var timeDelta = timeStamp - _lastTime;
    
                //the "go home" call may change the camera back to ortho... and we can't do ortho while walking...
                //HACK: Really, the home view should be set once when launch the extension, then set it back.
                if (!_camera.isPerspective)
                    viewer.navigation.toPerspective();
    
                if (_vrSensor) {
    
                    var state = _vrSensor.getState();
                    _sensorData[0] = _lastId + 1;
                    if (state.orientation) {
                        _sensorData[4] = state.orientation.x;
                        _sensorData[5] = state.orientation.y;
                        _sensorData[6] = state.orientation.z;
                        _sensorData[7] = state.orientation.w;
                    }
                    if (state.position) {
                        _sensorData[1] = state.position.x;
                        _sensorData[2] = state.position.y;
                        _sensorData[3] = state.position.z;
                    }
                }
    
                if (_sensorData) {
                    var id = _sensorData[0];
                    if (id > _lastId) {
    
                        //Process head position offset
                        _camera.position.sub(_headPos);
    
                        _headPos.set(_sensorData[1], _sensorData[2], _sensorData[3]);
                        _headPos.sub(_headPosBase);
                        _headPos.multiplyScalar(_toModelUnits);
                        _headPos.applyMatrix4(_mViewBase);
    
                        _camera.position.add(_headPos);
    
                        _baseAzimuth += (_Q - _E) * timeDelta * LOOK_SCALE;
                        _turnQuat.setFromAxisAngle(_camera.worldup, _baseAzimuth);
    
                        //Derive the orientation matrix from the head tracking quaternion,
                        //the head turning quaternion, and the base orientation
                        _headQuat.set(_sensorData[4], _sensorData[5], _sensorData[6], _sensorData[7]);
                        _turnQuat.multiply(_headQuat);
                        _mTmp.makeRotationFromQuaternion(_turnQuat);
                        _mView.multiplyMatrices(_mViewBase, _mTmp);
                        var e = _mView.elements;
    
                        //Direction vector is the Z row of the view matrix
                        var dir = new THREE.Vector3(-e[8], -e[9], -e[10]);
                        var distance = _camera.target.clone().sub(_camera.position).length();
    
                        //Up vector is the Y row of the view matrix
                        _camera.up.set(e[4], e[5], e[6]);
    
                        //Process displacement motion due to WASD keys
                        var right = new THREE.Vector3(e[0], e[1], e[2]);
                        var moveForward = dir.clone().multiplyScalar((_W - _S) * timeDelta * SPEED_SCALE);
                        _camera.position.add(moveForward);
    
                        var moveRight = right.multiplyScalar((_D - _A) * timeDelta * SPEED_SCALE);
                        _camera.position.add(moveRight);
    
                        _camera.target.set(_camera.position.x, _camera.position.y, _camera.position.z);
                        _camera.target.add(dir.multiplyScalar(distance));
                    }
                    _lastId = id;
                }
    
                if (_ws) {
                    if (_ws.readyState === 1) {
                        _ws.send("get\n");
                    }
                }
    
    
                if (_gamepadModule) {
                    _camera = _gamepadModule.update(_camera);
                }
    
                _lastTime = timeStamp;
    
                return true;
            };
    
            this.handleSingleClick = function (event, button) { return false; };
            this.handleDoubleClick = function (event, button) { return false; };
            this.handleSingleTap = function (tap) { return false; };
            this.handleDoubleTap = function (tap1, tap2) { return false; };
    
            this.handleKeyDown = function (event, keyCode) {
    
                var handled = false;
    
                switch (keyCode) {
                    case 38:
                    case 87: _W = 1; handled = true; break;
                    case 40:
                    case 83: _S = 1; handled = true; break;
                    case 37:
                    case 65: _A = 1; handled = true; break;
                    case 39:
                    case 68: _D = 1; handled = true; break;
    
                    case 81: _Q = 1; handled = true; break;
                    case 69: _E = 1; handled = true; break;
                }
    
                return handled;
            };
    
            this.handleKeyUp = function (event, keyCode) {
    
                var handled = false;
    
                switch (keyCode) {
                    case 38:
                    case 87: _W = 0; handled = true; break;
                    case 40:
                    case 83: _S = 0; handled = true; break;
                    case 37:
                    case 65: _A = 0; handled = true; break;
                    case 39:
                    case 68: _D = 0; handled = true; break;
    
                    case 81: _Q = 0; handled = true; break;
                    case 69: _E = 0; handled = true; break;
    
                    case 32: resetOrientation(); handled = true; break;
                }
    
                return handled;
            };
    
            this.handleWheelInput = function (delta) { return false; };
            this.handleButtonDown = function (event, button) { return false; };
            this.handleButtonUp = function (event, button) { return false; };
            this.handleMouseMove = function (event) { return false; };
            this.handleGesture = function (event, touches) { return false; };
            this.handleTouchChange = function (event, touches) { return false; };
            this.handleBlur = function (event) { return false; };
            this.handleResize = function () { };
    
    
            function resetOrientation() {
    
                _mViewBase.copy(_camera.matrixWorld);
                _mViewBase.elements[12] = 0;
                _mViewBase.elements[13] = 0;
                _mViewBase.elements[14] = 0;
    
                if (_sensorData)
                    _headPosBase.set(_sensorData[1], _sensorData[2], _sensorData[3]);
            }
    
            function initWebSocket() {
    
                //====================
                // This headtracker requires the following Oculus-WebSocket bridge library:
                // https://github.com/gyohk/threejs-typescript-oculusdk2
                // (Only need the OculusWebSocket part)
                //====================
                var ws = new WebSocket("ws://localhost:8888/ws");
                ws.onopen = function () {
                    console.log("### Oculus Connected ####");
                };
    
                ws.onmessage = function (evt) {
                    var message = evt.data;
                    try {
                        _sensorData = JSON.parse(message);
                    } catch (err) {
                        console.log(message);
                    }
                };
    
                ws.onclose = function () {
                    console.log("### Oculus Connection Closed ####");
                };
                //====================
    
                _ws = ws;
            }
    
        };
    
    
        //==================================================================================
        //Extension interface
    
        /** @constructor */
        var Oculus = function (viewer, options) {
            Extension.call(this, viewer, options);
    
            this.viewer = viewer;
            this.context = null;
            this.initialized = false;
        };
    
        Oculus.prototype = Object.create(Extension.prototype);
        Oculus.prototype.constructor = Oculus;
    
    
        Oculus.prototype.toggleOculus = function (state) {
    
            var viewer = this.viewer;
    
            if (state) {
    
                if (!this.context) {
                    this.context = new StereoRenderContext({ useWarp: !_vrHMD });
                    this.context.saveCameraState(this.viewer.navigation.getCamera());
                    viewer.impl.setUserRenderContext(this.context);
    
                    //TODO: Not sure why we need this call in order to force the
                    //stereo layout to fix itself.
                    viewer.resize(viewer.canvas.clientWidth, viewer.canvas.clientHeight);
    
                    viewer.displayViewCube(false, false);
    
                    if (!viewer.navigation.isPerspective)
                        viewer.navigation.toPerspective();
    
                    if (_vrHMD) {
                        launchFullscreen(viewer.impl.canvas, { vrDisplay: _vrHMD });
                    } else {
                        launchFullscreen(viewer.impl.canvas);
                    }
    
                    if (!this.headTracker) {
                        this.headTracker = new HeadTrackingTool(viewer);
                        viewer.toolController.registerTool(this.headTracker);
                    }
    
                    viewer.toolController.activateTool("headtracker");
                }
    
            }
            else {
    
                if (this.context) {
                    this.viewer.navigation.setCamera(this.context.revertCameraChanges());
                    this.context = null;
                    viewer.impl.setUserRenderContext(null);
    
                    viewer.displayViewCube(viewer.prefs.get("viewCube"), false);
    
                    viewer.toolController.deactivateTool("headtracker");
    
                    exitFullscreen();
                }
            }
    
    
        };
    
    
        Oculus.prototype.createUI = function () {
            var scope = this;
            var viewer = this.viewer;
    
            this.oculusButton = new avu.Button('toolbar-oculusTool');
            this.oculusButton.setToolTip('Oculus VR Mode');
            this.oculusButton.setIcon("oculusIcon");
    
            this.oculusButton.onClick = function (e) {
                scope.toggleOculus(!scope.context);
            };
    
            viewer.modelTools.addControl(this.oculusButton);
        };
    
    
        Oculus.prototype.load = function () {
    
            var viewer = this.viewer;
            var scope = this;
            //scope.createUI(); comment in to test w/o oculus connection
    
            function onToolbarCreated(e) {
                viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, onToolbarCreated);
                scope.createUI();
            }
    
            function onHMDDetected() {
    
                // add the button to the toolbar
                if (viewer.modelTools && viewer.modelTools.getNumberOfControls() > 0) {
                    scope.createUI();
                } else {
                    viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, onToolbarCreated);
                }
            }
    
            function EnumerateVRDevices(vrdevs) {
                // First, find a HMD -- just use the first one we find
                for (var i = 0; i < vrdevs.length; ++i) {
                    if (vrdevs[i] instanceof HMDVRDevice) {
                        _vrHMD = vrdevs[i];
                        break;
                    }
                }
    
                if (!_vrHMD)
                    return;
    
                // Then, find that HMD's position sensor
                for (var i = 0; i < vrdevs.length; ++i) {
                    if (vrdevs[i] instanceof PositionSensorVRDevice &&
                        vrdevs[i].hardwareUnitId == _vrHMD.hardwareUnitId) {
                        _vrSensor = vrdevs[i];
                        break;
                    }
                }
    
                if (!_vrHMD || !_vrSensor) {
                    Logger.warn("Didn't find a HMD and sensor!");
                } else {
                    onHMDDetected();
                }
    
                scope.initialized = true;
            }
    
    
            if (navigator.getVRDevices) {
                navigator.getVRDevices().then(EnumerateVRDevices);
            } else if (navigator.mozGetVRDevices) {
                navigator.mozGetVRDevices(EnumerateVRDevices);
            } else {
                this.initialized = true;
            }
    
    
            return true;
        };
    
        Oculus.prototype.unload = function () {
    
            this.toggleOculus(false);
    
            return true;
        };
    
        theExtensionManager.registerExtension('Autodesk.Viewing.Oculus', Oculus);
});