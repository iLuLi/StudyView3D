define([
    '../Core/Logger',
    '../Core/Controller/ViewerState'
], function (Logger, ViewerState) {
    'use strict';
    /***
    * GamepadModule is a tool (not an extension) that reacts to input from
    * a gamepad controller plugged into the hosting machine.
     *
    * @param viewerapi
    * @constructor
    */
    return function (viewerapi) {


        var _navapi = viewerapi.navigation;
        var _container = viewerapi.container;
        var _camera = _navapi.getCamera();

        var _modelScaleFactor = 1.0;

        var _explodeSpeed = 0;

        var _THRESHOLD = 0.1;
        var _SPEED_ADJUST = 5.5,
            _INITIAL_SPEED_SCALAR = 6,
            _speed_scalar = _INITIAL_SPEED_SCALAR;


        var _btnPressMap = {};
        var _gamepad;
        var _hudMessageStartShowTime;
        var _hudMessageShowTime;
        var _viewerState;
        var _savepoints;
        var _nextsavepoint;

        //Nav mode toggle
        var _lockInPlane;

        var _clock = new THREE.Clock(true);

        var VIEWER_STATE_FILTER = {
            seedURN: false,
            objectSet: true,
            viewport: true,
            renderOptions: {
                environment: false,
                ambientOcclusion: false,
                toneMap: {
                    exposure: false
                },
                appearance: false
            }
        };
        var _actualMoveSpeed;
        var _movementSpeed = 2.0;
        var _INITIAL_FOV = 75;
        var _ZOOM_SCALAR = -45;//smaller => closer zoom
        var _altitudeLockCoord;
        var _currentTool;

        /*Face Buttons*/
        var _BUTTONS = {
            SOUTH_BTN: 0,
            EAST_BTN: 1,
            WEST_BTN: 2,
            NORTH_BTN: 3,

            /*Shoulder and trigger buttons*/
            LEFT_SHOULDER: 4,
            RIGHT_SHOULDER: 5,
            LEFT_TRIGGER: 6,//ANALOG
            RIGHT_TRIGGER: 7,//ANALOG

            /*directional pad (DPad)*/
            SOUTH_DPAD: 13,
            EAST_DPAD: 15,
            WEST_DPAD: 14,
            NORTH_DPAD: 12,

            /*Joystick buttons (press joystick in)*/
            LEFT_STICK_BUTTON: 10,
            RIGHT_STICK_BUTTON: 11

        };

        var _STICKS = {
            //Axis//
            /*Left and right joysticks*/
            LEFT_STICK_X: 0,//ANALOG
            LEFT_STICK_Y: 1,//ANALOG
            RIGHT_STICK_X: 2,//ANALOG
            RIGHT_STICK_Y: 3//ANALOG
        };

        var _BLANK_FUNC = function () { };
        var _BUTTON_MAPPING = {};
        for (var k in _BUTTONS) {
            if (_BUTTONS.hasOwnProperty(k))
                _BUTTON_MAPPING[_BUTTONS[k]] = _BLANK_FUNC;
        }

        var init = function () {

        };

        this.activate = function (toolName) {
            // Calculate a movement scale factor based on the model bounds.
            var boundsSize = viewerapi.model.getBoundingBox().size();
            _modelScaleFactor = Math.max(Math.min(Math.min(boundsSize.x, boundsSize.y), boundsSize.z) / 10.0, 0.0001);
            _gamepad = navigator.getGamepads()[0];
            _viewerState = new ViewerState(viewerapi);
            _savepoints = [];
            _nextsavepoint = 0;
            _currentTool = toolName;
            setMapping(toolName);
        };

        this.deactivate = function () {
            //console.log("DEACTIVATE");
            _currentTool = null;
            _viewerState = null;
        };

        this.update = function (delta, camera) {

            if (camera)
                _camera = camera;
            delta = _clock.getDelta();

            //poll for gamepad connection
            _gamepad = navigator.getGamepads()[0];

            if (_hudMessageStartShowTime > -1) {
                var curTime = new Date().getTime();
                if (curTime - _hudMessageStartShowTime > _hudMessageShowTime) { // seconds
                    hideHUD();
                }
            }

            if (_gamepad) {
                _actualMoveSpeed = delta * _movementSpeed * _modelScaleFactor * _speed_scalar;// (_gamepad.buttons[_BUTTONS.RIGHT_TRIGGER].value > _THRESHOLD ? _SPEED_ADJUST * _gamepad.buttons[_BUTTONS.RIGHT_TRIGGER].value + _MAX_SPEED_SCALAR : _MAX_SPEED_SCALAR);
                // From the Collaboration extension:
                //the "go home" call may change the camera back to ortho... and we can't do ortho while walking...
                //HACK: Really, the home view should be set once when launch the extension, then set it back.
                if (!_camera.isPerspective) {
                    //console.log("Lost perspective mode: resetting view.");
                    _navapi.toPerspective();
                }
                if (_gamepad) {//TODO test for connection (change of state?)
                    if (inputDetected()) {//need to update camera scene
                        // console.log("needs update");
                        _camera.dirty = true;
                        if (_lockInPlane) {
                            _altitudeLockCoord = _camera.position.z;
                        }

                        var direction = _camera.target.clone().sub(_camera.position);
                        var distance = direction.length();
                        direction.multiplyScalar(1.0 / distance);
                        var right = direction.clone().cross(_camera.up).normalize();
                        if (Math.abs(_gamepad.axes[_STICKS.LEFT_STICK_Y]) > _THRESHOLD) {
                            var forwardMove = direction.clone().multiplyScalar(-_gamepad.axes[_STICKS.LEFT_STICK_Y] * _actualMoveSpeed);
                            _camera.position.add(forwardMove);
                            _camera.target.add(forwardMove);
                        }

                        if (Math.abs(_gamepad.axes[_STICKS.LEFT_STICK_X]) > _THRESHOLD) {
                            var strafeMove = right.clone().multiplyScalar(_gamepad.axes[_STICKS.LEFT_STICK_X] * _actualMoveSpeed);
                            _camera.position.add(strafeMove);
                            _camera.target.add(strafeMove);
                        }

                        var lookUpDown = new THREE.Quaternion();
                        var ndir = direction;
                        if (Math.abs(_gamepad.axes[_STICKS.RIGHT_STICK_Y]) > _THRESHOLD) {

                            var tempCam = _camera.clone();//modify this camera to see if it will be in viable range
                            var tempDir = direction.clone();

                            lookUpDown.setFromAxisAngle(right, -_gamepad.axes[_STICKS.RIGHT_STICK_Y] * _actualMoveSpeed / 2);//lookscale

                            tempDir.applyQuaternion(lookUpDown);
                            tempCam.up.applyQuaternion(lookUpDown);
                            var vertical = tempCam.worldup.clone();
                            var vertAngle = tempDir.angleTo(vertical);
                            var vertLimit = THREE.Math.degToRad(5);

                            // If new angle is within limits then update values; otherwise ignore
                            if (vertAngle >= vertLimit && vertAngle <= (Math.PI - vertLimit)) {
                                ndir = direction.clone().applyQuaternion(lookUpDown);
                                _camera.up.applyQuaternion(lookUpDown);
                            }
                        }

                        var lookLeftRight = new THREE.Quaternion();
                        if (Math.abs(_gamepad.axes[_STICKS.RIGHT_STICK_X]) > _THRESHOLD) {
                            lookLeftRight.setFromAxisAngle(_camera.worldup, -_gamepad.axes[_STICKS.RIGHT_STICK_X] * _actualMoveSpeed / 2);//lookscale
                            ndir.applyQuaternion(lookLeftRight);
                            _camera.up.applyQuaternion(lookLeftRight);
                        }

                        /*HANDLE ALL BUTTON INPUTS*/
                        handleGamepadFaceButtons();
                        /**************************/

                        if (_lockInPlane)
                            _camera.position.z = _altitudeLockCoord;

                        ndir.multiplyScalar(distance);
                        _camera.target.copy(_camera.position).add(ndir);
                    }
                }
            }
            return _camera;
        };


        // Show a HUD for a specific amount of time (showDelay > 0) or until closed.
        var showHUD = function (messageSpecs, showDelay, closeCB, buttonCB, checkboxCB) {
            Autodesk.Viewing.Private.HudMessage.displayMessage(_container, messageSpecs, closeCB, buttonCB, checkboxCB);

            if (showDelay > 0) {
                _hudMessageStartShowTime = new Date().getTime();
                _hudMessageShowTime = showDelay;
            }
            else {
                _hudMessageStartShowTime = -1;
                _hudMessageShowTime = 0;
            }
        };

        var hideHUD = function () {
            Autodesk.Viewing.Private.HudMessage.dismiss();  // in case it's still visible
            _hudMessageStartShowTime = -1;
        };

        var showDPadHud = function (direction) {
            hideHUD();
            var message;
            switch (direction) {
                case "up":
                    message = _lockInPlane ? "Vertical Lock Mode" : "Fly mode"; break;
                case "left":
                    break;
                case "right":
                    break;
                case "down":
                    break;
            }

            var messageSpecs = {
                "msgTitleKey": "View Orientation Drag Mode Toggled",
                "messageKey": "View Orientation Drag Mode Toggled",
                "messageDefaultValue": message

            };
            showHUD(messageSpecs, 2000);//show hud for 2secs

        };

        //checks for any button doing anything important
        function inputDetected() {
            //check to see if we pressed a button last frame
            //loop through mapping to only check buttons we care about
            for (var btn in _BUTTON_MAPPING) {
                if (_BUTTON_MAPPING.hasOwnProperty(btn)) {
                    if (_gamepad.buttons[btn].pressed) {
                        if (_gamepad.buttons[btn].value != 0.5) {
                            _btnPressMap[btn] = true;//its pressed!
                            return true;
                        }
                    }
                }
            }
            for (var btn in _btnPressMap) {
                if (_btnPressMap.hasOwnProperty(btn)) {
                    if (_btnPressMap[btn]) {
                        //_btnPressMap[btn] = false;//
                        return true;
                    }
                }
            }
            //now check movement
            return !(Math.abs(_gamepad.axes[_STICKS.LEFT_STICK_X]) < _THRESHOLD &&
                Math.abs(_gamepad.axes[_STICKS.LEFT_STICK_Y]) < _THRESHOLD &&
                Math.abs(_gamepad.axes[_STICKS.RIGHT_STICK_X]) < _THRESHOLD &&
                Math.abs(_gamepad.axes[_STICKS.RIGHT_STICK_Y]) < _THRESHOLD);

        }

        /*
        will check face buttons (including Directional Pad) for input
         */
        function handleGamepadFaceButtons() {
            for (var btn in _BUTTONS) {
                if (_BUTTONS.hasOwnProperty(btn)) {
                    handleGamepadButton(_BUTTONS[btn]);
                }
            }
        }

        function handleGamepadButton(buttonIdx) {
            //buttons in first IF are testing for being held (good for analog inputs and held down buttons)
            //ELSE IF will activate upon RELEASE of a button
            if (_gamepad.buttons[buttonIdx].value > _THRESHOLD) {
                _btnPressMap[buttonIdx] = true;//set was_pressed
                switch (buttonIdx) {
                    case _BUTTONS.LEFT_SHOULDER:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.RIGHT_SHOULDER:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.LEFT_TRIGGER:
                        _BUTTON_MAPPING[buttonIdx](_gamepad.buttons[_BUTTONS.LEFT_TRIGGER].value); break;
                    case _BUTTONS.RIGHT_TRIGGER:
                        _BUTTON_MAPPING[buttonIdx](_gamepad.buttons[_BUTTONS.RIGHT_TRIGGER].value); break;
                }
            }
            //ON RELEASE
            else if (_btnPressMap[buttonIdx]) {
                _btnPressMap[buttonIdx] = false;
                switch (buttonIdx) {
                    case _BUTTONS.SOUTH_BTN:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.EAST_BTN:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.WEST_BTN:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.NORTH_BTN:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.NORTH_DPAD:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.SOUTH_DPAD:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.WEST_DPAD:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.EAST_DPAD:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.RIGHT_STICK_BUTTON:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.LEFT_STICK_BUTTON:
                        _BUTTON_MAPPING[buttonIdx](); break;
                    case _BUTTONS.LEFT_TRIGGER:
                        _BUTTON_MAPPING[buttonIdx](_gamepad.buttons[_BUTTONS.LEFT_TRIGGER].value); break;
                    case _BUTTONS.RIGHT_TRIGGER:
                        _BUTTON_MAPPING[buttonIdx](_gamepad.buttons[_BUTTONS.RIGHT_TRIGGER].value); break;
                }
            }
        }

        var setMapping = function (mapping) {
            switch (mapping) {
                case "headtracker":
                    _BUTTON_MAPPING[_BUTTONS.SOUTH_BTN] = selectObject;
                    _BUTTON_MAPPING[_BUTTONS.SOUTH_DPAD] = goHome;
                    _BUTTON_MAPPING[_BUTTONS.NORTH_DPAD] = toggleNavMode;
                    _BUTTON_MAPPING[_BUTTONS.WEST_BTN] = hideObject;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_SHOULDER] = decAltitude;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_SHOULDER] = incAltitude;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_TRIGGER] = explode;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_TRIGGER] = fineSpeedAdjust;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_STICK_BUTTON] = deselectAll;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_STICK_BUTTON] = unhideAll;
                    break;
                default:
                    _BUTTON_MAPPING[_BUTTONS.SOUTH_BTN] = selectObject;
                    _BUTTON_MAPPING[_BUTTONS.EAST_BTN] = createSavePoint;
                    _BUTTON_MAPPING[_BUTTONS.WEST_BTN] = hideObject;
                    _BUTTON_MAPPING[_BUTTONS.NORTH_BTN] = showPropertyPanel;
                    _BUTTON_MAPPING[_BUTTONS.SOUTH_DPAD] = goHome;
                    _BUTTON_MAPPING[_BUTTONS.WEST_DPAD] = previousSavePoint;
                    _BUTTON_MAPPING[_BUTTONS.EAST_DPAD] = nextSavePoint;
                    _BUTTON_MAPPING[_BUTTONS.NORTH_DPAD] = toggleNavMode;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_SHOULDER] = decAltitude;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_SHOULDER] = incAltitude;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_TRIGGER] = triggerZoom;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_TRIGGER] = fineSpeedAdjust;
                    _BUTTON_MAPPING[_BUTTONS.RIGHT_STICK_BUTTON] = deselectAll;
                    _BUTTON_MAPPING[_BUTTONS.LEFT_STICK_BUTTON] = unhideAll;
                    break;
            }
        };

        //things buttons can do below
        var goHome = function () {
            viewerapi.navigation.setRequestHomeView(true);
            viewerapi.showAll();
            viewerapi.impl.selector.clearSelection();
            viewerapi.explode(0);
        };

        //Shoulder buttons and triggers
        var decAltitude = function () {
            if (_lockInPlane)
                _altitudeLockCoord += (-_gamepad.buttons[_BUTTONS.LEFT_SHOULDER].pressed) * _actualMoveSpeed;
            else
                _camera.translateY(-_gamepad.buttons[_BUTTONS.LEFT_SHOULDER].pressed * _actualMoveSpeed);
        };

        var incAltitude = function () {
            if (_lockInPlane)
                _altitudeLockCoord += (_gamepad.buttons[_BUTTONS.RIGHT_SHOULDER].pressed) * _actualMoveSpeed;
            else
                _camera.translateY(_gamepad.buttons[_BUTTONS.RIGHT_SHOULDER].pressed * _actualMoveSpeed);
        };

        var explode = function (analog_value) {
            if (analog_value > _THRESHOLD) {
                if (analog_value == 0.5) {//not set yet
                    viewerapi.explode(0);
                    return;
                }
                _explodeSpeed = analog_value;
                var ns = _explodeSpeed;
                if (ns > 1) ns = 1;
                if (ns < 0) ns = 0;
                viewerapi.explode(ns);
            }
            else
                viewerapi.explode(0);
        };


        //Triggers are analog, so pass in value of trigger
        var triggerZoom = function (analog_value) {
            if (analog_value > _THRESHOLD) {
                if (analog_value == 0.5) {
                    _camera.fov = _INITIAL_FOV;
                    _btnPressMap[_BUTTONS.LEFT_TRIGGER] = false;
                    return;
                }
                //linear interp: y = -40x + 75
                ///75 is original fov angle. smaller slope = greater max zoom.
                // equation will interpolate between based on trigger pressure (analog)
                _camera.fov = _ZOOM_SCALAR * analog_value + _INITIAL_FOV;
            }
            else {
                _camera.fov = _INITIAL_FOV;//originally 75
            }
        };

        var fineSpeedAdjust = function (analog_value) {
            if (analog_value > _THRESHOLD) {
                if (analog_value == 0.5) {//ignore
                    //TODO set speed correctly before input received AND have whole speedadjust down here!!
                    _btnPressMap[_BUTTONS.RIGHT_TRIGGER] = false;
                    return;
                }
                _speed_scalar = -(_SPEED_ADJUST * analog_value) + _INITIAL_SPEED_SCALAR;
            }
            else {
                _speed_scalar = _INITIAL_SPEED_SCALAR;
            }

        };

        var createSavePoint = function () {
            var state = _viewerState.getState(VIEWER_STATE_FILTER);
            _savepoints.push(state);
            Logger.log("Savepoint created.");
        };

        var previousSavePoint = function () {
            if (_savepoints.length) {
                _nextsavepoint--;
                if (_nextsavepoint < 0)
                    _nextsavepoint = _savepoints.length - 1;
                _viewerState.restoreState(_savepoints[_nextsavepoint]);
            }
        };

        var nextSavePoint = function () {
            if (_savepoints.length) {
                _nextsavepoint++;
                if (_nextsavepoint >= _savepoints.length)
                    _nextsavepoint = 0;
                _viewerState.restoreState(_savepoints[_nextsavepoint]);
            }
        };

        var selectObject = function () {
            var res = viewerapi.impl.hitTestViewport(new THREE.Vector3(0, 0, 0));
            if (_currentTool == "headtracker") {
                //vr tool forgets to do this, necessary for center selection
                _camera.updateMatrixWorld();
            }
            if (res) {
                viewerapi.impl.selector.toggleSelection(res.dbId, res.model);
                //viewerapi.fitToView(res.dbId);
            } else {
                viewerapi.impl.selector.clearSelection();
            }
        };

        var deselectAll = function () {
            viewerapi.impl.selector.clearSelection();
        };

        var unhideAll = function () {
            viewerapi.showAll();
            viewerapi.impl.selector.clearSelection();
            viewerapi.explode(0);
        };

        var hideObject = function () {
            var res = viewerapi.impl.hitTestViewport(new THREE.Vector3(0, 0, 0), false);
            if (res) {
                if (res.dbId in viewerapi.getHiddenNodes())
                    viewerapi.show(res.dbId);
                else
                    viewerapi.hide(res.dbId);
            }
        };

        var showPropertyPanel = function () {
            viewerapi.getPropertyPanel(true).setVisible(!viewerapi.getPropertyPanel(true).isVisible());
        };

        var toggleNavMode = function () {
            _lockInPlane = !_lockInPlane;
            if (_lockInPlane)
                _altitudeLockCoord = _camera.position.z;
            showDPadHud("up");
        };

        init();
    };
});