define([
    '../Renderer/FireflyWebGLRenderer',
    '../Constants/DeviceType',
    '../Constants/Global',
    '../Utils/getResourceUrl'
], function(FireflyWebGLRenderer, DeviceType, Global, getResourceUrl) {
    'use strict';
    /**
     * Autocam is the container for the view cube and steering wheel classes.
     * It contains math for camera transformations and most of the functions are retrieved from SampleCAM.
     * Refer to their documentation for explanation.
     */
    var Autocam = function (camera, navApi) {
    
        var cam = this;
        var dropDownMenu = null;
        var cubeContainer = null;
        var _changing = false;
    
        this.cube = null;
        this.camera = camera;
        this.renderer = 'WEBGL';
        this.startState = {};
        this.navApi = navApi;   // TODO: use this for camera sync.
        this.orthographicFaces = false;
    
        this.cameraChangedCallback = null;
        this.pivotDisplayCallback = null;
        this.canvas = null;
    
        //delta Time
        var startTime = Date.now();
        var deltaTime;
        var setHomeDeferred = false;
    
        function changed(worldUpChanged) {
            _changing = true;
            camera.target.copy(cam.center);
            camera.pivot.copy(cam.pivot);
    
            if (camera.worldup)
                camera.worldup.copy(cam.sceneUpDirection);
            else
                camera.up.copy(cam.sceneUpDirection);
    
            if (cam.cameraChangedCallback)
                cam.cameraChangedCallback(worldUpChanged);
    
            _changing = false;
        }
    
        this.dtor = function () {
            this.cube = null;
            this.cameraChangedCallback = null;
            this.pivotDisplayCallback = null;
            this.canvas = null;
        };
    
        this.showPivot = function (state) {
            if (this.pivotDisplayCallback)
                this.pivotDisplayCallback(state);
        };
    
        this.setWorldUpVector = function (newUp) {
            if (_changing)
                return;
    
            if (newUp && (newUp.lengthSq() > 0) && !newUp.normalize().equals(this.sceneUpDirection)) {
                // Changing up resets the front face:
                this.sceneUpDirection.copy(newUp);
                this.sceneFrontDirection.copy(this.getWorldFrontVector());
                this.cubeFront.copy(this.sceneFrontDirection).cross(this.sceneUpDirection).normalize();
                if (this.cube)
                    requestAnimationFrame(this.cube.render);
            }
        };
    
        this.getWorldUpVector = function () {
            return this.sceneUpDirection.clone();
        };
    
        // Assumes sceneUpDirection is set.
        this.getWorldRightVector = function () {
            var vec = this.sceneUpDirection.clone();
    
            if (Math.abs(vec.z) <= Math.abs(vec.y)) {
                // Cross(Vertical, ZAxis)
                vec.set(vec.y, -vec.x, 0);
            }
            else if (vec.z >= 0) {
                // Cross(YAxis, Vertical)
                vec.set(vec.z, 0, -vec.x);
            }
            else {
                // Cross(Vertical, YAxis)
                vec.set(-vec.z, 0, vec.x);
            }
            return vec.normalize();
        };
    
        // Assumes sceneUpDirection is set.
        this.getWorldFrontVector = function () {
            var up = this.getWorldUpVector();
            return up.cross(this.getWorldRightVector()).normalize();
        };
    
        this.goToView = function (viewVector) {
            if (this.navApi.isActionEnabled('gotoview')) {
                var destination = {
                    position: viewVector.position.clone(),
                    up: viewVector.up.clone(),
                    center: viewVector.center.clone(),
                    pivot: viewVector.pivot.clone(),
                    fov: viewVector.fov,
                    worldUp: viewVector.worldUp.clone(),
                    isOrtho: viewVector.isOrtho
                };
                cam.elapsedTime = 0;
                this.animateTransition(destination);
            }
        };
    
        this.getCurrentView = function () {
            return {
                position: camera.position.clone(),
                up: camera.up.clone(),
                center: this.center.clone(),
                pivot: this.pivot.clone(),
                fov: camera.fov,
                worldUp: this.sceneUpDirection.clone(),
                isOrtho: (camera.isPerspective === false)
            };
        };
    
        this.setCurrentViewAsHome = function (focusFirst) {
            if (focusFirst) {
                this.navApi.setRequestFitToView(true);
                setHomeDeferred = true;
            }
            else {
                this.homeVector = this.getCurrentView();
            }
        };
    
        // This method sets both the "current" home and the "original" home.
        // The latter is used for the "reset home" function.
        this.setHomeViewFrom = function (camera) {
            var pivot = camera.pivot ? camera.pivot : this.center;
            var center = camera.target ? camera.target : this.pivot;
            var worldup = camera.worldup ? camera.worldup : this.sceneUpDirection;
    
            this.homeVector = {
                position: camera.position.clone(),
                up: camera.up.clone(),
                center: center.clone(),
                pivot: pivot.clone(),
                fov: camera.fov,
                worldUp: worldup.clone(),
                isOrtho: (camera.isPerspective === false)
            };
    
            this.originalHomeVector = {
                position: camera.position.clone(),
                up: camera.up.clone(),
                center: center.clone(),
                pivot: pivot.clone(),
                fov: camera.fov,
                worldUp: worldup.clone(),
                worldFront: this.sceneFrontDirection.clone(),  // Extra for reset orientation
                isOrtho: (camera.isPerspective === false)
            };
        };
    
        this.toPerspective = function () {
            if (!camera.isPerspective) {
                camera.toPerspective();
                changed(false);
            }
        };
    
        this.toOrthographic = function () {
            if (camera.isPerspective) {
                camera.toOrthographic();
                changed(false);
            }
        };
    
        this.setOrthographicFaces = function (state) {
            this.orthographicFaces = state;
        };
    
        this.goHome = function () {
            if (this.navApi.isActionEnabled('gotoview')) {
                this.navApi.setPivotSetFlag(false);
                this.goToView(this.homeVector);
            }
        };
    
        this.resetHome = function () {
            this.homeVector.position.copy(this.originalHomeVector.position);
            this.homeVector.up.copy(this.originalHomeVector.up);
            this.homeVector.center.copy(this.originalHomeVector.center);
            this.homeVector.pivot.copy(this.originalHomeVector.pivot);
            this.homeVector.fov = this.originalHomeVector.fov;
            this.homeVector.worldUp.copy(this.originalHomeVector.worldUp);
            this.homeVector.isOrtho = this.originalHomeVector.isOrtho;
            this.goHome();
        };
    
        this.getView = function () {
            return this.center.clone().sub(camera.position);
        };
    
        this.setCameraUp = function (up) {
            var view = this.dir.clone();
            var right = view.cross(up).normalize();
            if (right.lengthSq() === 0) {
                // Try again after perturbing eye direction:
                view.copy(this.dir);
                if (up.z > up.y)
                    view.y += 0.0001;
                else
                    view.z += 0.0001;
    
                right = view.cross(up).normalize();
            }
            // Orthogonal camera up direction:
            camera.up.copy(right).cross(this.dir).normalize();
        };
    
        /***
        this.render = function(){
            //renderer.render( scene, camera );
            //We need to remove all calls to this render
            Logger.log("Unrequired call to render within Autocam.js:17")
        };
        ***/
    
        (function animate() {
            requestAnimationFrame(animate);
            // Is there an assumption here about the order of animation frame callbacks?
            var now = Date.now();
            deltaTime = now - startTime;
            startTime = now;
        }());
    
        //Control variables
        this.ortho = false;
        this.center = camera.target ? camera.target.clone() : new THREE.Vector3(0, 0, 0);
        this.pivot = camera.pivot ? camera.pivot.clone() : this.center.clone();
    
        this.sceneUpDirection = camera.worldup ? camera.worldup.clone() : camera.up.clone();
        this.sceneFrontDirection = this.getWorldFrontVector();
    
        //
        //dir, up, left vector
        this.dir = this.getView();
    
        // Compute "real" camera up:
        this.setCameraUp(camera.up);
    
        this.saveCenter = this.center.clone();
        this.savePivot = this.pivot.clone();
        this.saveEye = camera.position.clone();
        this.saveUp = camera.up.clone();
        var prevEye, prevCenter, prevUp, prevPivot;
    
        this.cubeFront = this.sceneFrontDirection.clone().cross(this.sceneUpDirection).normalize();
    
        this.setHomeViewFrom(camera);
    
        var rotInitial = new THREE.Quaternion();
        var rotFinal = new THREE.Quaternion();
        var rotTwist = new THREE.Quaternion();
        var rotSpin = new THREE.Quaternion();
        var distInitial;
        var distFinal;
    
        /**
         * Holds the default pan speed multiplier of 0.5
         * @type {number}
         */
        this.userPanSpeed = 0.5;
    
        /**
         * Holds the default look speed multiplier of 2.0
         * @type {number}
         */
        this.userLookSpeed = 2.0;
    
        /**
         * Holds the default height speed multiplier of 5.0 (used in updown function)
         * @type {number}
         */
        this.userHeightSpeed = 5.0;
    
        /**
         * Holds the current walk speed multiplier, which can be altered in the steering wheel drop down menu (between 0.24 and 8)
         * @type {number}
         */
        this.walkMultiplier = 1.0;
    
        /**
         * Holds the default zoom speed multiplier of 1.015
         * @type {number}
         */
        this.userZoomSpeed = 1.015;
    
        /**
         * Holds the orbit multiplier of 5.0
         * @type {number}
         */
        this.orbitMultiplier = 5.0;
        this.currentlyAnimating = false;
    
        //look
        camera.keepSceneUpright = true;
    
        //orbit
        this.preserveOrbitUpDirection = true;
        this.alignOrbitUpDirection = true;
        this.constrainOrbitHorizontal = false;
        this.constrainOrbitVertical = false;
        this.doCustomOrbit = false;
        this.snapOrbitDeadZone = 0.045;
        this.snapOrbitThresholdH = this.snapOrbitThresholdV = THREE.Math.degToRad(15.0);
        this.snapOrbitAccelerationAX = this.snapOrbitAccelerationAY = 1.5;
        this.snapOrbitAccelerationBX = this.snapOrbitAccelerationBY = 2.0;
        this.snapOrbitAccelerationPointX = this.snapOrbitAccelerationPointY = 0.5;
        this.alignDirTable = new Array(26);
        this.alignDirTable[0] = new THREE.Vector3(-1, 0, 0);
        this.alignDirTable[1] = new THREE.Vector3(1, 0, 0);
        this.alignDirTable[2] = new THREE.Vector3(0, -1, 0);
        this.alignDirTable[3] = new THREE.Vector3(0, 1, 0);
        this.alignDirTable[4] = new THREE.Vector3(0, 0, -1);
        this.alignDirTable[5] = new THREE.Vector3(0, 0, 1);
    
        // fill edges
        this.alignDirTable[6] = new THREE.Vector3(-1, -1, 0);
        this.alignDirTable[7] = new THREE.Vector3(-1, 1, 0);
        this.alignDirTable[8] = new THREE.Vector3(1, -1, 0);
        this.alignDirTable[9] = new THREE.Vector3(1, 1, 0);
        this.alignDirTable[10] = new THREE.Vector3(0, -1, -1);
        this.alignDirTable[11] = new THREE.Vector3(0, -1, 1);
        this.alignDirTable[12] = new THREE.Vector3(0, 1, -1);
        this.alignDirTable[13] = new THREE.Vector3(0, 1, 1);
        this.alignDirTable[14] = new THREE.Vector3(-1, 0, -1);
        this.alignDirTable[15] = new THREE.Vector3(1, 0, -1);
        this.alignDirTable[16] = new THREE.Vector3(-1, 0, 1);
        this.alignDirTable[17] = new THREE.Vector3(1, 0, 1);
    
        // fill corners
        this.alignDirTable[18] = new THREE.Vector3(-1, -1, -1);
        this.alignDirTable[19] = new THREE.Vector3(-1, -1, 1);
        this.alignDirTable[20] = new THREE.Vector3(-1, 1, -1);
        this.alignDirTable[21] = new THREE.Vector3(-1, 1, 1);
        this.alignDirTable[22] = new THREE.Vector3(1, -1, -1);
        this.alignDirTable[23] = new THREE.Vector3(1, -1, 1);
        this.alignDirTable[24] = new THREE.Vector3(1, 1, -1);
        this.alignDirTable[25] = new THREE.Vector3(1, 1, 1);
    
        this.combined = false;
    
        //variables used for snapping
        this.useSnap = false;
        this.lockDeltaX = 0.0;
        this.lockedX = false;
        this.lastSnapRotateX = 0.0;
        this.lockDeltaY = 0.0;
        this.lockedY = false;
        this.lastSnapRotateY = 0.0;
        this.lastSnapDir = new THREE.Vector3(0, 0, 0);
    
        //up-down
        this.topLimit = false;
        this.bottomLimit = false;
        this.minSceneBound = 0;
        this.maxSceneBound = 0;
    
        //shot
        var shotParams = { destinationPercent: 1.0, duration: 1.0, zoomToFitScene: true, useOffAxis: false };
        this.shotParams = shotParams;   // Expose these for modification
        var camParamsInitial, camParamsFinal;
    
        //zoom
        this.zoomDelta = new THREE.Vector2();
        var unitAmount = 0.0;
    
        //walk
        var m_resetBiasX, m_resetBiasY, m_bias;
    
        //info about model object we need to save for fit to window
        var boundingBoxMin = new THREE.Vector3();
        var boundingBoxMax = new THREE.Vector3();
    
        /**
         * Parameters to control the saving and displaying of the rewind timeline
         * @example <caption> Changing the maximum number of stored rewind cameras from 25(default) to 50 </caption>
         * cam.rewindParams.maxHistorySize = 50;
         */
        this.rewindParams = {
            history: [],
            startTime: undefined,
            thumbnailSize: 56.0,
            thumbnailGapSize: 12.0,
            maxHistorySize: 25,
            snappingEnabled: true,
            timelineIndex: 0,
            timelineIndexSlide: 0,
            open: false,
            openLocation: new THREE.Vector2(0, 0),
            openBracket: new THREE.Vector2(0, 0),
            openBracketA: new THREE.Vector2(0, 0),
            openBracketB: new THREE.Vector2(0, 0),
            openLocationOrigin: new THREE.Vector2(0, 0),
            locationOffset: new THREE.Vector2(0, 0),
            snapOffset: new THREE.Vector2(0, 0),
            slideOffset: new THREE.Vector2(0, 0),
            snapped: true,
            resetWeights: false,
            recordEnabled: false,
            elementIsRecording: false
        };
    
        this.viewCubeMenuOpen = false;
        this.menuSize = new THREE.Vector2(0, 0);
        this.menuOrigin = new THREE.Vector2(0, 0);
    
        camera.lookAt(this.center);
    
        // function windowResize(){
        // refresh camera on size change
    
        // We handle this elsewhere
        /*
            renderer.setSize( window.innerWidth, window.innerHeight );
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.topFov = camera.bottomFov = camera.fov/2;
            camera.leftFov = camera.rightFov = (camera.aspect * camera.fov)/2;
            camera.updateProjectionMatrix();
        */
        // }
    
        /***
        windowResize();
        window.addEventListener('resize', windowResize, false);
        ***/
    
        this.setCube = function (viewcube) {
            this.cube = viewcube;    // DOH!!!
        };
    
        /**
         * Function which loads the JSON object to the scene
         * @param {JSONObject} model - The correctly formatted JSON model
         * @param {Vector3} scale - The scale multiplier for the input model
         * @param {Vector3} position - Where to load the model
         * @example <caption>Load an object called car.json to (0,0,0) with a scale of 50 </caption>
         * cam.loadObject('Objects/car.json', new THREE.Vector3(50,50,50), new THREE.Vector3(0,0,0));
         */
        this.loadObject = function (model, scale, position) {
            loader = new THREE.JSONLoader();
            loader.load(model, function (geometry, materials) {
                var faceMaterial = new THREE.MeshPhongMaterial(materials);
                mesh = new THREE.Mesh(geometry, faceMaterial);
                mesh.scale = scale;
                mesh.position.copy(position);
                mesh.geometry.computeBoundingBox();
                var bBox = mesh.geometry.boundingBox.clone();
                boundingBoxMax.set(bBox.max.x, bBox.max.y, bBox.max.z);
                boundingBoxMin.set(bBox.min.x, bBox.min.y, bBox.min.z);
                boundingBoxMax.multiply(scale);
                boundingBoxMin.multiply(scale);
                scene.add(mesh);
                objects.push(mesh);
            });
        };
    
    
        // Sync our local data from the given external camera:
        this.sync = function (clientCamera) {
            if (clientCamera.isPerspective !== camera.isPerspective) {
                if (clientCamera.isPerspective) {
                    camera.toPerspective();
                }
                else {
                    camera.toOrthographic();
                    if (clientCamera.saveFov)
                        camera.saveFov = clientCamera.saveFov;
                }
            }
            camera.fov = clientCamera.fov;
            camera.position.copy(clientCamera.position);
    
            if (clientCamera.target) {
                this.center.copy(clientCamera.target);
                camera.target.copy(clientCamera.target);
            }
            if (clientCamera.pivot) {
                this.pivot.copy(clientCamera.pivot);
                camera.pivot.copy(clientCamera.pivot);
            }
            this.dir.copy(this.center).sub(camera.position);
    
            this.setCameraUp(clientCamera.up);
    
            var worldUp = clientCamera.worldup ? clientCamera.worldup : clientCamera.up;
            if (worldUp.distanceToSquared(this.sceneUpDirection) > 0.0001) {
                this.setWorldUpVector(worldUp);
            }
    
            if (setHomeDeferred && !this.navApi.getTransitionActive()) {
                setHomeDeferred = false;
                this.setCurrentViewAsHome(false);
            }
            if (this.cube)
                requestAnimationFrame(this.cube.render);
        };
    
    
        this.refresh = function () {
            if (this.cube)
                this.cube.refreshCube();
        };
    
        /*        Prototyped Functions          */
    
        //extending Box2 to be used like AutoCam::Box2
        THREE.Box2.prototype.setCenter = function (center) {
            var halfSize = new THREE.Vector2((Math.abs(this.max.x - this.min.x) / 2.0), (Math.abs(this.max.y - this.min.y)) / 2.0);
            this.min.copy(center).sub(halfSize);
            this.max.copy(center).add(halfSize);
            return this;
        };
    
        //Using Box2 like an AutoCam::Icon2D
        THREE.Box2.prototype.getIcon2DCoords = function (Pscreen, PIcon2D) {
            var zero = this.center;
            PIcon2D.set((Pscreen.x - zero.x) / (this.size().x / 2.0), (Pscreen.y - zero.y) / (this.size().y / 2.0));
        };
    
        //so we dont need a matrix4 as an intermediate
        THREE.Matrix3.prototype.makeRotationFromQuaternion = function (q) {
            var te = this.elements;
    
            var x = q.x, y = q.y, z = q.z, w = q.w;
            var x2 = x + x, y2 = y + y, z2 = z + z;
            var xx = x * x2, xy = x * y2, xz = x * z2;
            var yy = y * y2, yz = y * z2, zz = z * z2;
            var wx = w * x2, wy = w * y2, wz = w * z2;
    
            te[0] = 1 - (yy + zz);
            te[3] = xy - wz;
            te[6] = xz + wy;
    
            te[1] = xy + wz;
            te[4] = 1 - (xx + zz);
            te[7] = yz - wx;
    
            te[2] = xz - wy;
            te[5] = yz + wx;
            te[8] = 1 - (xx + yy);
    
            return this;
        };
    
        // changed to accept a matrix3
        THREE.Quaternion.prototype.setFromRotationMatrix3 = function (m) {
            // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
    
            var te = m.elements,
                m11 = te[0], m12 = te[3], m13 = te[6],
                m21 = te[1], m22 = te[4], m23 = te[7],
                m31 = te[2], m32 = te[5], m33 = te[8],
    
                trace = m11 + m22 + m33,
                s;
    
            if (trace > 0) {
                s = 0.5 / Math.sqrt(trace + 1.0);
                this.w = 0.25 / s;
                this.x = (m32 - m23) * s;
                this.y = (m13 - m31) * s;
                this.z = (m21 - m12) * s;
            } else if (m11 > m22 && m11 > m33) {
                s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
                this.w = (m32 - m23) / s;
                this.x = 0.25 * s;
                this.y = (m12 + m21) / s;
                this.z = (m13 + m31) / s;
            } else if (m22 > m33) {
                s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
                this.w = (m13 - m31) / s;
                this.x = (m12 + m21) / s;
                this.y = 0.25 * s;
                this.z = (m23 + m32) / s;
            } else {
                s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
                this.w = (m21 - m12) / s;
                this.x = (m13 + m31) / s;
                this.y = (m23 + m32) / s;
                this.z = 0.25 * s;
            }
            return this;
        };
    
        // NOTE: This modifies the incoming vector!!
        // TODO: Change all calls to use Vector3.applyQuaternion instead.
        THREE.Quaternion.prototype.rotate = function (vector) {
            //From AutoCamMath.h file
            var kRot = new THREE.Matrix4().makeRotationFromQuaternion(this);
            var e = kRot.elements;
    
            //converting 4d matrix to 3d
            var viewRot = new THREE.Matrix3().set(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]);
    
            return vector.applyMatrix3(viewRot);
        };
    
        THREE.Vector3.prototype.findAngleWith = function (b, axis) {
            var angle = 0.0;
            var cosAngle = this.clone().normalize().clone().dot(b.clone().normalize());
    
            var axisCheck = (this.clone().cross(b)).clone().normalize();
            if (axisCheck.clone().length() < Number.MIN_VALUE) {
                if (cosAngle > 0.0) {
                    angle = 0.0;
                } else {
                    angle = 180.0;
                }
            } else {
    
                var cosCheck = axisCheck.clone().dot(axis.clone().normalize());
    
                //check to make sure user specified axis is orthogonal to vectors.
                //If it isn't we take the closer of the two choices.
                axis = cosCheck > 0.0 ? axisCheck : -axisCheck;
    
                var cosAngleNextQuadrant = new THREE.Quaternion().setFromAxisAngle(axis, 90.0 * THREE.Math.degToRad);
                cosAngleNextQuadrant = ((cosAngleNextQuadrant.clone().rotate(b)).clone().normalize()).clone().dot(this);
                angle = Math.acos(cosAngle) * THREE.Math.radToDeg;
    
                if (Math.abs(angle - 90.0) < Number.MIN_VALUE)
                    angle = 90.0;
    
                if ((angle < 90.0 && cosAngle * cosAngleNextQuadrant > 0.0) ||
                    (angle > 90.0 && cosAngle * cosAngleNextQuadrant < 0.0) ||
                    (angle == 90.0 && cosAngleNextQuadrant > 0.0))
                    angle = -1.0 * angle;	//figure out whether we need to turn left or right
            }
    
            angle = THREE.Math.degToRad(angle);
            return angle;
        };
    
        if (!('contains' in String.prototype))
            String.prototype.contains = function (str, startIndex) { return -1 !== String.prototype.indexOf.call(this, str, startIndex); };
    
        Math.linearClamp = function (x, a, b) {
            if (x <= a) { return 0.0; }
            if (x >= b) { return 1.0; }
    
            return (x - a) / (b - a);
        };
    
        Math.easeClamp = function (x, a, b) {
            if (x <= a) { return 0.0; }
            if (x >= b) { return 1.0; }
    
            var t = (x - a) / (b - a);
            return 0.5 * (Math.sin((t - 0.5) * Math.PI) + 1.0);
        };
    
        Math.linearInterp = function (t, a, b) {
            return a * (1.0 - t) + b * t;
        };
    
        Math.equalityClamp = function (x, a, b) {
            if (x <= a) { return a; }
            if (x >= b) { return b; }
    
            return x;
        };
    
        Math.round2 = function (x) {
            return (Math.round(x * 100)) / 100;
        };
    
        Math.round1 = function (x) {
            return (Math.round(x * 10)) / 10;
        };
    
    
        /*      SHOT OPERATION      */
    
        //transitions smoothly to destination
        this.animateTransition = function (destination) {
    
            if (!destination) { return; }
    
            var worldUpChanged = false;
            var unitTime = 0.0;
    
            this.setCameraOrtho(destination.isOrtho);
    
            if (cam.elapsedTime >= shotParams.duration) {
                unitTime = 1.0;
    
                cam.center.copy(destination.center);
                cam.pivot.copy(destination.pivot);
                camera.position.copy(destination.position);
                camera.up.copy(destination.up);
                camera.target.copy(destination.center);
                if (!destination.isOrtho)
                    camera.fov = destination.fov;
                camera.dirty = true;
    
                worldUpChanged = !destination.worldUp.equals(this.sceneUpDirection);
                if (worldUpChanged)
                    this.setWorldUpVector(destination.worldUp);
    
                this.currentlyAnimating = false;
                changed(worldUpChanged);
                this.showPivot(false);
                if (this.cube)
                    requestAnimationFrame(this.cube.render);
    
                this.addHistoryElement();
                this.navApi.setTransitionActive(false);
                return;
            }
            this.currentlyAnimating = true;
            this.showPivot(true);
            this.navApi.setTransitionActive(true);
    
            var tMax = shotParams.destinationPercent;
            unitTime = Math.easeClamp(cam.elapsedTime / shotParams.duration, 0.0, tMax);
            var oneMinusTime = 1.0 - unitTime;
            cam.elapsedTime += deltaTime / 500;
    
            var center = (cam.center.clone().multiplyScalar(oneMinusTime)).add(destination.center.clone().multiplyScalar(unitTime));
            var position = (camera.position.clone().multiplyScalar(oneMinusTime)).add(destination.position.clone().multiplyScalar(unitTime));
            var up = (camera.up.clone().multiplyScalar(oneMinusTime)).add(destination.up.clone().multiplyScalar(unitTime));
            var pivot = (camera.pivot.clone().multiplyScalar(oneMinusTime)).add(destination.pivot.clone().multiplyScalar(unitTime));
            var worldUp = (this.sceneUpDirection.clone().multiplyScalar(oneMinusTime)).add(destination.worldUp.clone().multiplyScalar(unitTime));
            var fov = camera.fov * oneMinusTime + destination.fov * unitTime;
    
            cam.center.copy(center);
            cam.pivot.copy(pivot);
            camera.position.copy(position);
            camera.up.copy(up);
            camera.target.copy(center);
            if (!destination.isOrtho)
                camera.fov = fov;
            camera.dirty = true;
    
            worldUpChanged = (worldUp.distanceToSquared(this.sceneUpDirection) > 0.0001);
            if (worldUpChanged)
                this.setWorldUpVector(worldUp);
    
            camera.lookAt(cam.center);
            changed(worldUpChanged);
    
            if (this.cube)
                requestAnimationFrame(this.cube.render);
    
            requestAnimationFrame(function () { cam.animateTransition(destination); });
        };
    
        //used for view cube transforms, to see difference between this and linear interpolation watch
        //http://www.youtube.com/watch?v=uNHIPVOnt-Y
        this.sphericallyInterpolateTransition = function (completionCallback) {
            var center, position, up;
            var unitTime = 0.0;
            this.currentlyAnimating = true;
            this.navApi.setTransitionActive(true);
    
            if (cam.elapsedTime >= shotParams.duration) {
                unitTime = 1.0;
                this.currentlyAnimating = false;
            }
            else {
                var tMax = shotParams.destinationPercent;
                unitTime = Math.easeClamp(cam.elapsedTime / shotParams.duration, 0.0, tMax);
                cam.elapsedTime += deltaTime / 500;
            }
    
            // This seems to avoid some error in the rotation:
            if (unitTime === 1.0) {
                position = camParamsFinal.position;
                center = camParamsFinal.center;
                up = camParamsFinal.up;
            }
            else {
                var M = new THREE.Matrix3();
                var rot = rotInitial.clone();
                rot.slerp(rotFinal, (unitTime));
                M.makeRotationFromQuaternion(rot);
                var dist = Math.linearInterp(unitTime, distInitial, distFinal);
    
                var e = M.elements;
    
                center = camParamsInitial.center.clone().multiplyScalar(1.0 - unitTime).add(camParamsFinal.center.clone().multiplyScalar(unitTime));
                position = center.clone().sub(new THREE.Vector3(e[0], e[1], e[2]).multiplyScalar(dist));
                up = new THREE.Vector3(e[3], e[4], e[5]);
            }
            cam.center.copy(center);
            camera.position.copy(position);
            camera.up.copy(up);
    
            // The above code will have to change if we want the proper rotation
            // to occur about the pivot point instead of the center.
            if (!cam.navApi.getUsePivotAlways())
                cam.pivot.copy(center);
    
            camera.lookAt(cam.center);
    
            if (this.currentlyAnimating === true) {
                this.showPivot(true);
                requestAnimationFrame(function () { cam.sphericallyInterpolateTransition(completionCallback); });
            }
            else {
                this.navApi.setTransitionActive(false);
                this.showPivot(false);
                this.addHistoryElement();
    
                if (this.orthographicFaces && this.isFaceView())
                    this.setCameraOrtho(true);
    
                if (completionCallback)
                    completionCallback();
            }
            changed(false);
            if (this.cube)
                requestAnimationFrame(this.cube.render);
        };
    
        //This is used to determine the relation between camera up vector and scene direction, used to determine which
        //face to translate to when clicking on a viewcube arrow
        this.getOrientation = function () {
            if (!this.cube)
                return;
    
            var camX = Math.round1(camera.up.x);
            var camY = Math.round1(camera.up.y);
            var camZ = Math.round1(camera.up.z);
            var sceneFront = this.sceneFrontDirection.clone();
            var sceneUp = this.sceneUpDirection.clone();
            var sceneRight = this.sceneFrontDirection.clone().cross(this.sceneUpDirection).normalize();
            sceneFront.x = Math.round1(sceneFront.x);
            sceneFront.y = Math.round1(sceneFront.y);
            sceneFront.z = Math.round1(sceneFront.z);
            sceneUp.x = Math.round1(sceneUp.x);
            sceneUp.y = Math.round1(sceneUp.y);
            sceneUp.z = Math.round1(sceneUp.z);
            sceneRight.x = Math.round1(sceneRight.x);
            sceneRight.y = Math.round1(sceneRight.y);
            sceneRight.z = Math.round1(sceneRight.z);
            var sceneLeft = sceneRight.clone().multiplyScalar(-1);
            var sceneDown = sceneUp.clone().multiplyScalar(-1);
            var sceneBack = sceneFront.clone().multiplyScalar(-1);
    
            switch (this.cube.currentFace) {
                case "front":
                    if (sceneUp.x == camX && sceneUp.y == camY && sceneUp.z == camZ)
                        return "up";
                    else if (sceneDown.x == camX && sceneDown.y == camY && sceneDown.z == camZ)
                        return "down";
                    else if (sceneRight.x == camX && sceneRight.y == camY && sceneRight.z == camZ)
                        return "right";
                    else if (sceneLeft.x == camX && sceneLeft.y == camY && sceneLeft.z == camZ)
                        return "left"
                    break;
                case "right":
                    if (sceneUp.x == camX && sceneUp.y == camY && sceneUp.z == camZ)
                        return "up";
                    else if (sceneDown.x == camX && sceneDown.y == camY && sceneDown.z == camZ)
                        return "down";
                    else if (sceneBack.x == camX && sceneBack.y == camY && sceneBack.z == camZ)
                        return "left";
                    else if (sceneFront.x == camX && sceneFront.y == camY && sceneFront.z == camZ)
                        return "right"
                    break;
                case "left":
                    if (sceneUp.x == camX && sceneUp.y == camY && sceneUp.z == camZ)
                        return "up";
                    else if (sceneDown.x == camX && sceneDown.y == camY && sceneDown.z == camZ)
                        return "down";
                    else if (sceneFront.x == camX && sceneFront.y == camY && sceneFront.z == camZ)
                        return "left";
                    else if (sceneBack.x == camX && sceneBack.y == camY && sceneBack.z == camZ)
                        return "right"
                    break;
                case "back":
                    if (sceneUp.x == camX && sceneUp.y == camY && sceneUp.z == camZ)
                        return "up";
                    else if (sceneDown.x == camX && sceneDown.y == camY && sceneDown.z == camZ)
                        return "down";
                    else if (sceneLeft.x == camX && sceneLeft.y == camY && sceneLeft.z == camZ)
                        return "right";
                    else if (sceneRight.x == camX && sceneRight.y == camY && sceneRight.z == camZ)
                        return "left"
                    break;
                case "top":
                    if (sceneBack.x == camX && sceneBack.y == camY && sceneBack.z == camZ)
                        return "down";
                    else if (sceneFront.x == camX && sceneFront.y == camY && sceneFront.z == camZ)
                        return "up";
                    else if (sceneRight.x == camX && sceneRight.y == camY && sceneRight.z == camZ)
                        return "right";
                    else if (sceneLeft.x == camX && sceneLeft.y == camY && sceneLeft.z == camZ)
                        return "left"
                    break;
                case "bottom":
                    if (sceneFront.x == camX && sceneFront.y == camY && sceneFront.z == camZ)
                        return "down";
                    else if (sceneBack.x == camX && sceneBack.y == camY && sceneBack.z == camZ)
                        return "up";
                    else if (sceneRight.x == camX && sceneRight.y == camY && sceneRight.z == camZ)
                        return "right";
                    else if (sceneLeft.x == camX && sceneLeft.y == camY && sceneLeft.z == camZ)
                        return "left"
                    break;
            }
        };
    
        this.setCameraOrtho = function (yes) {
            if (yes && camera.isPerspective)
                camera.toOrthographic();
    
            if (!yes && !camera.isPerspective)
                camera.toPerspective();
        };
    
        this.resetOrientation = function () {
            this.setCameraOrtho(this.originalHomeVector.isOrtho);
            this.sceneUpDirection.copy(this.originalHomeVector.worldUp);
            this.sceneFrontDirection.copy(this.originalHomeVector.worldFront);
            this.cubeFront.copy(this.sceneFrontDirection).cross(this.sceneUpDirection).normalize();
            this.setCameraUp(this.sceneUpDirection);
            changed(true);
        };
    
        this.setCurrentViewAsFront = function () {
            if (this.cube)
                this.cube.currentFace = "front";
    
            this.sceneUpDirection.copy(camera.up.clone());
            this.sceneFrontDirection.copy(this.getView()).normalize();
            this.cubeFront.copy(this.sceneFrontDirection).cross(this.sceneUpDirection).normalize();
    
            if (this.orthographicFaces)
                this.setCameraOrtho(true);
    
            changed(true);
        };
    
        this.setCurrentViewAsTop = function () {
            if (this.cube)
                this.cube.currentFace = "top";
    
            this.sceneUpDirection.copy(this.getView()).multiplyScalar(-1).normalize();
            this.sceneFrontDirection.copy(camera.up);
            this.cubeFront.copy(this.sceneFrontDirection).cross(this.sceneUpDirection).normalize();
            changed(true);
        };
    
        this.calculateCubeTransform = function (faceString) {
            var worldUp = this.sceneUpDirection.clone();
            var worldFront = this.sceneFrontDirection.clone();
            var worldRight = this.sceneFrontDirection.clone().cross(this.sceneUpDirection).normalize();
    
            camParamsInitial = camera.clone();
            camParamsInitial.center = cam.center.clone();
            camParamsInitial.pivot = cam.pivot.clone();
    
            camParamsFinal = camera.clone();
            camParamsFinal.center = cam.center.clone();
            camParamsFinal.pivot = cam.pivot.clone();
    
            // find movement offset based on given boolean flags
            var offset = new THREE.Vector3(0, 0, 0);
            if (faceString.contains('back')) {
                offset = offset.add(worldFront);
            }
            if (faceString.contains('front')) {
                offset = offset.sub(worldFront);
            }
            if (faceString.contains('top')) {
                offset = offset.add(worldUp);
            }
            if (faceString.contains('bottom')) {
                offset = offset.sub(worldUp);
            }
            if (faceString.contains('right')) {
                offset = offset.add(worldRight);
            }
            if (faceString.contains('left')) {
                offset = offset.sub(worldRight);
            }
            var upDir = worldUp;
    
            // view looking at top or bottom chosen
            var test = offset.clone().normalize();
    
            if ((1.0 - Math.abs(test.dot(worldUp))) < Number.MIN_VALUE) {
                //( offset == worldUp || offset == -worldUp )
                // find the principal view direction other than top/bottom closest to
                // the current view direction and use it as an up vector
    
                var viewDir = this.getView().normalize();
                var optUpDir = [worldFront.clone(), worldFront.clone().negate(), worldRight.clone(), worldRight.clone().negate()];
    
                // use both view and up vectors for test vector because transitioning from
                // top and bottom views, view direction is the same (but up direction is different)
    
                var sign = (test.dot(worldUp) > 0.0) ? +1.0 : -1.0; //( offset == worldUp ) ? +1.0 : -1.0;
                var testDir = viewDir.clone().add(camera.up.clone().multiplyScalar(sign)).normalize();
    
                var optValue = -2.0;
    
                for (var i = 0; i < 4; i++) {
                    var value = testDir.dot(optUpDir[i]);
    
                    if (value > optValue) {
                        optValue = value;
                        upDir = optUpDir[i].multiplyScalar(sign);
                    }
                }
            }
    
            distFinal = distInitial = this.getView().length();
            // WHY? camParamsFinal.center = this.originalCenter;
            camParamsFinal.position.copy(camParamsFinal.center.clone().add(offset.multiplyScalar(distFinal / offset.length())));
            camParamsFinal.up.copy(upDir);
    
            var D = camParamsInitial.center.clone().sub(camParamsInitial.position).normalize();
            var R = D.clone().cross(camParamsInitial.up).normalize();
            var U = R.clone().cross(D).normalize();
            var M = new THREE.Matrix3();
            M.set(D.x, U.x, R.x, D.y, U.y, R.y, D.z, U.z, R.z);
            rotInitial.setFromRotationMatrix3(M);
    
            D = camParamsFinal.center.clone().sub(camParamsFinal.position).normalize();
            R = D.clone().cross(camParamsFinal.up).normalize();
            U = R.clone().cross(D).normalize();
            M.set(D.x, U.x, R.x, D.y, U.y, R.y, D.z, U.z, R.z);
            //TODO: figure out when these angles aren't supposed to be 0, works for now
            rotTwist.setFromAxisAngle(D, 0.0);
            rotSpin.setFromAxisAngle(U, 0.0);
            rotFinal.setFromRotationMatrix3(M);
            rotFinal.multiply(rotTwist).multiply(rotSpin).normalize();
    
        };
    
        //used for center operation from steering wheel and steering wheel menu
        this.centerShot = function (fromWheelMenu) {
            //TODO: investigate the problem where it is not animating sometimes (due to lag)
    
            if (!camParamsInitial || fromWheelMenu) {
                cam.elapsedTime = 0;
                camParamsInitial = camParamsFinal = camera.clone();
                camParamsInitial.center = cam.center;
            }
    
            var pWorld = cam.pivot.clone();
            var P = pWorld.clone().sub(camParamsInitial.position);
            var D = (camParamsInitial.center.clone().sub(camParamsInitial.position)).normalize();
            var U = camParamsInitial.up.clone();
            var R = (D.clone().cross(U)).normalize();
            U = (R.clone().cross(D)).normalize();
    
    
            var PprojR = R.clone().multiplyScalar(R.dot(P));
            var PprojU = U.clone().multiplyScalar(U.dot(P));
            var PprojRU = PprojR.clone().add(PprojU);
    
            camParamsFinal.position.copy(camParamsInitial.position.clone().add(PprojRU));
    
            camParamsFinal.center = pWorld;
            camParamsFinal.pivot = pWorld;
    
            var unitTime = 0.0;
            if (cam.elapsedTime >= shotParams.duration) {
                unitTime = 1.0;
            } else {
                var tMax = shotParams.destinationPercent;
                unitTime = Math.easeClamp(cam.elapsedTime / shotParams.duration, 0.0, tMax);
                cam.elapsedTime += deltaTime / 2000;
            }
    
            var position = (camera.position.clone().multiplyScalar(1.0 - unitTime)).add(camParamsFinal.position.clone().multiplyScalar(unitTime));
            var center = (cam.center.clone().multiplyScalar(1.0 - unitTime)).add(camParamsFinal.center.clone().multiplyScalar(unitTime));
            var pivot = (cam.pivot.clone().multiplyScalar(1.0 - unitTime)).add(camParamsFinal.pivot.clone().multiplyScalar(unitTime));
            camera.position.copy(position);
            cam.center.copy(center);
            cam.pivot.copy(pivot);
    
            camera.lookAt(cam.center);
            changed(false);
    
            if (unitTime === 1.0)
                this.addHistoryElement();
            else
                requestAnimationFrame(function () { cam.centerShot(false); });
        };
    
        //This is for the level camera operation in steering wheel menu
        //Integrated from ViewManager::LevelCamera
        this.levelShot = function () {
    
            var view = this.getView();
            var dist = view.length();
            var worldUp = this.sceneUpDirection.clone();
            var vUp = camera.up.clone().normalize();
            var vView = view.normalize();
            var dotView = vView.dot(worldUp);
    
            if ((1.0 - Math.abs(dotView)) > Number.MIN_VALUE) {
                var vRight = vView.clone().cross(worldUp);
                vView = worldUp.clone().cross(vRight);
                vView.normalize();
            } else {
                vView = vUp.clone();
            }
            vView.multiplyScalar(dist);
    
            var destination = {
                center: vView.add(camera.position),
                up: worldUp,
                position: camera.position,
                pivot: cam.center.clone().add(vView),
                fov: camera.fov,
                worldUp: worldUp
            };
            cam.elapsedTime = 0;
            cam.animateTransition(destination);
        };
    
        //This is for the fit to window operation in the steering wheel drop down menu
        //Integrated from CameraOperations::FitBoundingBoxToView
        //Right now since we only load one mesh we can use the bounding box property of it, if multiple meshes loaded
        //we will need to find the bounding box around them
        this.fitToWindow = function () {
    
            var viewDir = this.getView();
            var upDir = camera.up.clone();
            viewDir.normalize();
            upDir.normalize();
            camParamsFinal = camera.clone();
            camParamsFinal.center = cam.center;
    
            upDir = getUpDirection(upDir, viewDir);
            upDir.normalize();
            camParamsFinal.up.copy(upDir);
    
            var rightDir = viewDir.clone().cross(upDir);
            rightDir.normalize();
    
            var boxMin = boundingBoxMin.clone();
            var boxMax = boundingBoxMax.clone();
            var boxPoints = [boxMin, boxMax];
            var boxMidpoint = new THREE.Vector3(boxMax.x - boxMin.x, boxMax.y - boxMin.y, boxMax.z - boxMin.z);
    
            boxPoints[2] = new THREE.Vector3(boxMax.x, boxMin.y, boxMax.z);
            boxPoints[3] = new THREE.Vector3(boxMax.x, boxMin.y, boxMin.z);
            boxPoints[4] = new THREE.Vector3(boxMax.x, boxMax.y, boxMin.z);
            boxPoints[5] = new THREE.Vector3(boxMin.x, boxMax.y, boxMax.z);
            boxPoints[6] = new THREE.Vector3(boxMin.x, boxMax.y, boxMin.z);
            boxPoints[7] = new THREE.Vector3(boxMin.x, boxMin.y, boxMax.z);
    
            //Move the box into camParams frame coordinates
            for (var j = 0; j < 8; j++) {
                var testVector = boxPoints[j].clone().sub(camera.position);
    
                boxPoints[j].setX(testVector.clone().dot(rightDir));
                boxPoints[j].setY(testVector.clone().dot(upDir));
                boxPoints[j].setZ(testVector.clone().dot(viewDir));
            }
    
            //This is to be used when ortho camera is implemented
            /*
            var minPointH = boxPoints[0], maxPointH = boxPoints[0], minPointV = boxPoints[0],maxPointV = boxPoints[0];
    
            //Solve for the eye position in ortho.  We take the position as the center point
            //Of the 2D projection.
            for(var k=0; k<8; k++){
                var testVertex = boxPoints[k];
                if(testVertex.x < minPointH.x){
                    minPointH = testVertex;
                }else if(testVertex.x > maxPointH.x){
                    maxPointH = testVertex;
                }
    
                if(testVertex.y < minPointV.y){
                    minPointV = testVertex;
                }else if(testVertex.y > maxPointV.y){
                    maxPointV = testVertex;
                }
            }
    
            var geomWidth = maxPointH.x - minPointH.x;
            var geomHeight = maxPointV.y - minPointV.y;
    
            //Set ortho width and height
            if (geomWidth/geomHeight > camera.aspect){
                camParams.orthoWidth = geomWidth;
                camParams.orthoHeight = geomWidth/viewAspect;
            }else{
                camParams.orthoWidth = geomHeight * viewAspect;
                camParams.orthoHeight = geomHeight;
            }
            var orthoOffset = new THREE.Vector3((minPointH.x + maxPointH.x)/2.0,(minPointV.y + maxPointV.y)/2.0,0.0);
            */
    
            //Find the eye position in perspective.
            //While working in 2D, find the equation of the line passing through each box corner of form z = mx + b
            //that is parallel to the sides of the viewing frustum.  Note that all of the coordinates of the box
            //are still defined in the camParams frame.  Compare the z intercept values (ie. b) to figure out which two lines
            //represent the outer edges of the bounding box, and solve for their intersection to find the desired eye (x,z) position
            //that would be required to make the object touch the left and right edges of the viewport (ie. the closest we can get
            //without losing horizontal view of the object).  Repeat with z = my + b to find the eye (y,z) position for the vertical frustum.
    
            //TODO:fovTop and fovBottom are ALWAYS the same b/c of camera declaration, this needs to change
            var fovTop = THREE.Math.degToRad(camera.topFov);
            var fovBottom = THREE.Math.degToRad(camera.bottomFov);
            var fovLeft = THREE.Math.degToRad(camera.leftFov);
            var fovRight = THREE.Math.degToRad(camera.rightFov);
    
            var BLeft, BRight, BTop, BBottom;
    
            BLeft = (fovLeft >= 0) ? Number.MAX_VALUE : Number.MIN_VALUE;
            BRight = (fovRight >= 0) ? Number.MAX_VALUE : Number.MIN_VALUE;
            BTop = (fovTop >= 0) ? Number.MAX_VALUE : Number.MIN_VALUE;
            BBottom = (fovBottom >= 0) ? Number.MAX_VALUE : Number.MIN_VALUE;
    
            var slopeRight = 1.0 / Math.tan(fovRight);
            var slopeLeft = -1.0 / Math.tan(fovLeft);
            var slopeTop = 1.0 / Math.tan(fovTop);
            var slopeBottom = -1.0 / Math.tan(fovBottom);
    
            for (var i = 0; i < 8; i++) {
                var testCorner = boxPoints[i].clone();
                var b = testCorner.z - (slopeLeft * testCorner.x);
                BLeft = (fovLeft >= 0) ? Math.min(BLeft, b) : Math.max(BLeft, b);
    
                b = testCorner.z - (slopeRight * testCorner.x);
                BRight = (fovRight >= 0) ? Math.min(BRight, b) : Math.max(BRight, b);
    
                //For vertical frustum
                b = testCorner.z - (slopeTop * testCorner.y);
                BTop = (fovTop >= 0) ? Math.min(BTop, b) : Math.max(BTop, b);
    
                b = testCorner.z - (slopeBottom * testCorner.y);
                BBottom = (fovBottom >= 0) ? Math.min(BBottom, b) : Math.max(BBottom, b);
            }
    
            //Solve for intersection of horizontal frustum
            var eyeX = (BRight - BLeft) / (slopeLeft - slopeRight);
            var eyeZH = (slopeLeft * eyeX) + BLeft;
    
            //Solve for intersection of vertical frustum
            var eyeY = (BBottom - BTop) / (slopeTop - slopeBottom);
            var eyeZV = slopeTop * eyeY + BTop;
    
            var eyeZ = 0.0;
    
            //With the two frustums solved, compare the two frustums to see which one is currently closer to the object based on z value.
            //Slide the closer frustum back along its median line (to ensure that the points stay within the frustum) until it's Z value
            //matches that of the further frustum. Take this as the final eye position.
    
            if (eyeZH <= eyeZV) {
                var medianAngleV = (fovTop - fovBottom) / 2.0;
                if (Math.abs(medianAngleV) > Number.MIN_VALUE) {
                    var medianSlopeV = 1.0 / Math.tan(medianAngleV);
                    eyeY = eyeY - eyeZV / medianSlopeV + eyeZH / medianSlopeV; //derived from z1 - my1 = z2 - my2
                }
                eyeZ = eyeZH;
            } else {
                var medianAngleH = (fovRight - fovLeft) / 2.0;
                if (Math.abs(medianAngleH) > Number.MIN_VALUE) {
                    var medianSlopeH = 1.0 / Math.tan(medianAngleH);
                    eyeX = eyeX - eyeZH / medianSlopeH + eyeZV / medianSlopeH;
                }
                eyeZ = eyeZV;
            }
    
            var eyeOffset = new THREE.Vector3(eyeX, eyeY, eyeZ);
    
            //Transform eyeoffset back into world frame
            var interim1 = (rightDir.clone().multiplyScalar(eyeOffset.x));
            var interim2 = (upDir.clone().multiplyScalar(eyeOffset.y));
            var interim3 = (viewDir.clone().multiplyScalar(eyeOffset.z));
            eyeOffset = interim1.clone().add(interim2.clone().add(interim3));
    
            camParamsFinal.position.add(eyeOffset);
            var interim = (boxMidpoint.clone().sub(camParamsFinal.position)).dot(viewDir);
            camParamsFinal.center = camParamsFinal.position.clone().add(viewDir.multiplyScalar(interim));
            camParamsFinal.pivot = boxMidpoint.clone();
    
            var destination = {
                center: camParamsFinal.center,
                up: camParamsFinal.up,
                position: camParamsFinal.position,
                pivot: camParamsFinal.pivot,
                fov: camera.fov,
                worldUp: cam.sceneUpDirection.clone()
            };
            cam.elapsedTime = 0;
            cam.animateTransition(destination);
        };
    
        /*         Functions for operation         */
    
        //used in fit to window
        function getUpDirection(upDir, viewDir) {
            var upp = upDir.clone();
    
            if ((Math.abs(upp.clone().dot(viewDir))) < Number.MIN_VALUE) {
                upp.normalize();
                return upp;
            }
    
            upp = getProjectionOnPlane(upDir, viewDir);
            if (upp.length() < Number.MIN_VALUE) {
                upp = getEmpiricalUpDirection(viewDir);
            }
            upp.normalize();
            return upp;
        }
    
        //used in getUpDirection
        function getProjectionOnPlane(vector, normal) {
            normal.normalize();
            var projToNormal = vector.clone().dot(normal);
            var projection = normal.clone().multiplyScalar(projToNormal);
            projection = vector.clone().sub(projection);
            return projection;
        }
    
        //used in getUpDirection
        function getEmpiricalUpDirection(normal) {
            var zeros = new THREE.Vector3(0, 0, 0);
            var directions = [new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, 0, 1),
                new THREE.Vector3(0, 1, 1),
                new THREE.Vector3(1, 0, 1),
                new THREE.Vector3(1, 1, 0),
                new THREE.Vector3(1, 1, 1)
            ];
    
            for (var i = 0; i < 7; i++) {
                if (Math.abs(directions[i].dot(normal)) < Number.MIN_VALUE) {
                    zeros = directions[i];
                    break;
                }
            }
            return zeros;
        }
    
        //convert screen coords to window coords
        function convertCoordsToWindow(pixelX, pixelY) {
            var delta = new THREE.Vector2(0, 0);
    
            delta.x = pixelX / window.innerWidth;
            delta.y = pixelY / window.innerHeight;
    
            return delta;
        }
    
        //picking ray intersection with the empty scene(not on object)
        function getScreenRay(mouse) {
            mouse.y = Math.abs(mouse.y - window.innerHeight);
            var rayOrigin, rayDirection;
            var eye = camera.position;
            var center = cam.center;
            var eyeToCenter = center.clone().sub(eye);
            var up = camera.up;
            var right = eyeToCenter.clone().cross(up);
            var dist = eyeToCenter.clone().length();
    
            var frustumLeft = dist * Math.tan(THREE.Math.degToRad(camera.leftFov));
            var frustumRight = dist * Math.tan(THREE.Math.degToRad(camera.rightFov));
            var frustumTop = dist * Math.tan(THREE.Math.degToRad(camera.topFov));
            var frustumBottom = dist * Math.tan(THREE.Math.degToRad(camera.bottomFov));
            var frustumWidth = (frustumLeft + frustumRight);
            var frustumHeight = (frustumTop + frustumBottom);
    
            var rightLength = mouse.x * frustumWidth / window.innerWidth;
            var centerToRightLength = rightLength - frustumLeft;
    
            var upLength = mouse.y * frustumHeight / window.innerHeight;
            var centerToUpLength = upLength - frustumBottom;
    
            up = up.clone().normalize().clone().multiplyScalar(centerToUpLength);
            right = right.clone().normalize().clone().multiplyScalar(centerToRightLength);
    
            /*
            // PRH -- account for difference in aspect ratio between camera FOV and viewport --
            AutoCam::AdjustForAspectRatio( params, screenWidth, screenHeight, mouseXunit, mouseYunit );
            */
    
            if (cam.ortho) {
                rayOrigin = eye.clone().add(right).clone().add(up);
                rayDirection = eyeToCenter;
            } else {
                rayOrigin = eye;
                rayDirection = eyeToCenter.clone().add(up).clone().add(right);
            }
    
            return {
                'rayO': rayOrigin,
                'rayD': rayDirection
            };
        }
    
        //get ray intersection point and set pivot
        this.updatePivotPosition = function (mouse) {
            //TODO: update pivot only when mouse down
    
            var raycaster;
            var intersects;
            //formula from online
            var direction = new THREE.Vector3((mouse.x / window.innerWidth) * 2 - 1, -(mouse.y / window.innerHeight) * 2 + 1, 0.5);
    
            direction = direction.unproject(camera);
            raycaster = new THREE.Raycaster(camera.position, direction.sub(camera.position).normalize());
            intersects = raycaster.intersectObjects(objects);
    
            if (cam.mode == 'zoom') {
                if (intersects[0] !== undefined) {
                    var point = intersects[0].point;
                    cam.pivot.copy(point);
                } else {
                    var result = getScreenRay(mouse);
                    cam.pivot.copy(result.rayO.clone().add(result.rayD));
                }
    
            } else if (intersects[0] !== undefined) {
                wheel.cursorImage('pivot');
                var point = intersects[0].point;
                if (!cam.isMouseDown) {
                    cam.pivot.copy(point);
                }
            } else {
                wheel.cursorImage('SWInvalidArea');
            }
        };
    
        function getNextRotation(rotationType, snapAngle, lastDelta) {
            var threshold, accelerationA, accelerationB, shiftZone;
            threshold = accelerationA = accelerationB = shiftZone = 0.0;
    
            var next = 0.0;
            var lockedAxis = null;
            var lockDelta = null;
    
            var deadZone = cam.snapOrbitDeadZone;
            var orbitMultiplier = cam.orbitMultiplier;
    
            if (rotationType == 'h') {
                threshold = cam.snapOrbitThresholdH;
                accelerationA = cam.snapOrbitAccelerationAX;
                accelerationB = cam.snapOrbitAccelerationBX;
                shiftZone = 1.0 - cam.snapOrbitAccelerationPointX;
                lockDelta = cam.lockDeltaX;
                lockedAxis = cam.lockedX;
            } else {
                threshold = cam.snapOrbitThresholdV;
                accelerationA = cam.snapOrbitAccelerationAY;
                accelerationB = cam.snapOrbitAccelerationBY;
                shiftZone = 1.0 - cam.snapOrbitAccelerationPointY;
                lockDelta = cam.lockDeltaY;
                lockedAxis = cam.lockedY;
            }
    
            if (!lockedAxis) {
                if (Math.abs(snapAngle) > threshold) {
                    next = lastDelta * orbitMultiplier;
                } else if (Math.abs(snapAngle) > shiftZone * threshold) {
                    if (lastDelta * snapAngle > 0.0) {
                        next = lastDelta * orbitMultiplier * accelerationA;
                    } else {
                        next = lastDelta * orbitMultiplier * 1.0 / accelerationA;
                    }
    
                } else {
                    if (lastDelta * snapAngle > 0.0) {
                        next = lastDelta * orbitMultiplier * accelerationB;
                    } else {
                        next = lastDelta * orbitMultiplier * 1.0 / accelerationB;
                    }
    
                }
    
                if (next * snapAngle > 0.0 && Math.abs(next) > Math.abs(snapAngle)) {
                    this.lockDeltaX = this.lockDeltaY = 0.0;	//want to reset both regardless of rotation axis
                    lockedAxis = true;
                    next = snapAngle;
                }
    
            } else {
                lockDelta += lastDelta;
    
                if (lockDelta < -deadZone) {
                    next = (lockDelta + deadZone) * orbitMultiplier * 1.0 / accelerationB;
                    lockedAxis = false;
                } else if (lockDelta > deadZone) {
                    next = (lockDelta - deadZone) * orbitMultiplier * 1.0 / accelerationB;
                    lockedAxis = false;
                }
            }
            return next;
        }
    
    
        function getClosestAlignDir(Dv, searchPrincipal) {
            var maxAngle = -Number.MAX_VALUE;
            var maxIndex = 0;
    
            for (var i = 0; i < (searchPrincipal ? 6 : 26) ; i++) {
                var Di = cam.alignDirTable[i].clone().multiplyScalar(-1);
                Di.normalize();
    
                var angle = Di.dot(Dv);
    
                if (angle > maxAngle) {
                    maxAngle = angle;
                    maxIndex = i;
                }
            }
            return cam.alignDirTable[maxIndex];
        }
    
        function snapToClosestView(up, snapAngleh, snapAnglev) {
            if (!cam.useSnap)
                return;
    
            if (cam.preserveOrbitUpDirection) {
                // Find closest view direction
                var lastViewDir = (cam.saveCenter.clone().sub(cam.saveEye)).clone().normalize();
                var snapDir = (getClosestAlignDir(lastViewDir, false)).clone().multiplyScalar(-1).clone().normalize();
    
                if (Math.abs(Math.abs(lastViewDir.clone().dot(up)) - 1.0) < Number.MIN_VALUE) {
                    //topdown or bottom up case
                    snapAnglev = 0.0;
                    var snapUp = (getClosestAlignDir(cam.saveUp, true)).clone().multiplyScalar(-1).clone().normalize();
                    snapAngleh = cam.saveUp.findAngleWith(snapUp, up);
                } else {
                    var lastViewDirProj = lastViewDir.clone().sub(up).multiplyScalar(up.clone().dot(lastViewDir));
                    var snapDirProj = snapDir.clone().sub(up).multiplyScalar(up.clone().dot(snapDir));
                    snapAngleh = lastViewDirProj.clone().findAngleWith(snapDirProj, up);
                    var testRotate = new THREE.Quaternion().setFromAxisAngle(up, snapAngleh);
                    var transitionDir = testRotate.clone().rotate(lastViewDir);
                    var transitionRight = testRotate.clone().rotate(lastViewDir.clone().cross(cam.saveUp));
                    snapAnglev = transitionDir.clone().findAngleWith(snapDir, transitionRight);
                }
    
                if (snapDir != cam.lastSnapDir) {
                    //If last and current snapDirs are not on the same plane, unlock vertical orbit
                    if (Math.abs(snapDir.clone().dot(up) - cam.lastSnapDir.clone().dot(up)) > Number.MIN_VALUE) {
                        cam.lockedY = false;
                    }
                    cam.lastSnapDir = snapDir;
                }
            } else {
                //Find closest view direction
                /*  var vDirView = cam.saveCenter.clone().sub(cam.saveEye);
                var vRight = vDirView.clone().cross( cam.saveUp );
                var snapDir = -getClosestAlignDir(vDirView, false).clone().normalize();
                var snapDirProj = snapDir.clone.sub(up.clone().multiplyScalar(up.clone().dot(snapDir)));
                snapAngleh = vDirView.findAngleWith(snapDirProj, up);
    
                var testRotate = new THREE.Quaternion().setFromAxisAngle(up,snapAngleh );
                var transitionDir = testRotate.clone().rotate(vDirView);
                var transitionRight = testRotate.clone().rotate(vRight);
                snapAnglev = transitionDir.findAngleWith(snapDir, transitionRight);
    
                if(snapDir != cam.lastSnapDir) {
                    cam.cam.lockedY = false;
                    cam.lockedX = false;
                    cam.lastSnapDir = snapDir;
                }*/
            }
        }
    
        /// Returns true if the operation belongs to a chain of combined operations; otherwise returns false.
        function IsCombined() {
            return cam.combined;
        }
    
        function isInDeadZone(currentCursor, startCursor) {
    
            var deadZone = 30;
            var res = false;
    
            var w = window.innerWidth;
            var x = currentCursor.x % w;
    
            var h = window.innerHeight;
            var y = currentCursor.y % h;
    
    
            var diffX = (x > 0) ? (x - startCursor.x) : (w + x - startCursor.x);
            var diffY = (y > 0) ? (y - startCursor.y) : (h + y - startCursor.y);
    
            if ((Math.abs(diffX) < deadZone) && (Math.abs(diffY) < deadZone))
                res = true;
    
            return res;
        }
    
        function GetXYAndWrapCounts(currentCursor, startCursor, wrapCount) {
            wrapCount.x = (currentCursor.x - startCursor.x) / window.innerWidth;
            currentCursor.x = startCursor.x + (currentCursor.x - startCursor.x) % window.innerWidth;
    
            wrapCount.y = (currentCursor.y - startCursor.y) / window.innerHeight;
            currentCursor.y = startCursor.y + (currentCursor.y - startCursor.y) % window.innerHeight;
        }
    
        function setBias(set, currentCursor, startCursor) {
            if (m_bias && set) {
                return;
    
            } else if (set) {
                var deadZone = 30;
                var wrapCount = new THREE.Vector2();
    
                var x = currentCursor.x;
                var y = currentCursor.y;
    
                GetXYAndWrapCounts(currentCursor, startCursor, wrapCount);
    
                m_resetBiasX = window.innerWidth * wrapCount.x;
                m_resetBiasY = window.innerHeight * wrapCount.y;
    
                if (x < startCursor.x)
                    x = x - 2 * deadZone;
                else
                    x = x + 2 * deadZone;
    
                if (y < startCursor.y)
                    y = y - 2 * deadZone;
                else
                    y = y + 2 * deadZone;
            }
            m_bias = set;
        }
    
        function checkBoundaryConditions(amount, cursorOffset, m_amount) {
            if (cursorOffset === 0)
                return 0;
    
            var deltaAmount = amount;
            var eye = cam.saveEye.clone().sub(worldUp.clone().multiplyScalar(m_amount + deltaAmount));
            var prevEye = cam.saveEye.clone().sub(worldUp.clone().multiplyScalar(m_amount));
    
            var eyeHeight = 0.0;
            var epsilon = (cam.maxSceneBound - cam.minSceneBound) / 1000;
    
            //Logger.log(m_amount);
            //Logger.log(deltaAmount);
    
    
            if (cam.topLimit && (cursorOffset > 0)) {
                // Cursor was on the top of the slider, but now is moving down.
                // Bring eyeHeight below maxSceneBound.
                eyeHeight = cam.maxSceneBound - epsilon;
                cam.topLimit = false;
            } else if (cam.bottomLimit && (cursorOffset < 0)) {
                // Cursor was on the bottom of the slider, but now is moving up.
                // Bring eyeHeight above minSceneBound.
                eyeHeight = cam.minSceneBound + epsilon;
                cam.bottomLimit = false;
            } else {
                eyeHeight = eye.dot(worldUp);
            }
    
            var prevEyeHeight = prevEye.dot(worldUp);
    
            //Logger.log(eyeHeight);
    
            if (eyeHeight < cam.minSceneBound) {
                if (prevEyeHeight < cam.minSceneBound) {
                    // this limits how far under the min we can go
                    cam.bottomLimit = true;
                    deltaAmount = 0.0;
                }
            } else if (eyeHeight > cam.maxSceneBound) {
                if (prevEyeHeight > cam.maxSceneBound) {
                    // This limits how far over the max we can go
                    cam.topLimit = true;
                    deltaAmount = 0.0;
                }
            }
    
            return deltaAmount;
        }
    
        function getMoveAmountFromCursorOffset(offset) {
            // Manipulating with power of 2 of cursor offset allows to amplify the visible change in the offset
            // when the offset is big to achieve the effect ofhigher sensitivity of the tool on small offsets
            // and lower sensitivity on big offsets.
            var derivedOffset = Math.pow(offset, 2.0);
            if (offset < 0) {
                derivedOffset = -derivedOffset;
            }
    
            //delta.y = derivedOffset;
            var delta = convertCoordsToWindow(0, derivedOffset);
            var sceneHeight = cam.maxSceneBound - cam.minSceneBound;
    
            // This empirical step provides a good motion of the scene when moving up/down.
            var p = sceneHeight * 0.01;
            delta.y *= p;
    
            var deltaAmount = cam.userHeightSpeed * delta.y;
            deltaAmount = checkBoundaryConditions(deltaAmount, offset, cam.m_amount);
    
            return deltaAmount;
        }
    
        //draw UI for up-down operation during mouse move
        this.onDrawHeight = function (mouse, pX, pY, dragged, path) {
            var sliderHeight = 86;
            var upDir = new THREE.Vector3(0, 1, 0);
            var h = camera.position.clone().dot(upDir);
            var unitHeight = Math.linearClamp(h, cam.minSceneBound, cam.maxSceneBound);
            var height = unitHeight - 0.5;
            if (cubeContainer) {
                cubeContainer.find("img#updownImageA").remove();
                cubeContainer.prepend('<img src="' + path + 'SWheighthandleA.png" id="updownImageA" style="position:fixed; z-index:9999; top:' + (pY - sliderHeight * height) + 'px; left:' + pX + 'px;"/>');
    
                if (!dragged) {
                    cubeContainer.prepend('<img src="' + path + 'SWheighthandleI.png" id="updownImageI" style="position:fixed; z-index:9998; top:' + (pY - sliderHeight * height) + 'px; left:' + (pX) + 'px;"/>');
                }
            }
        };
    
        /**
         * Draws a menu by appending an unordered list to the given container element.
         * @param {Array} menuOptions - string array of menu options, null meaning seperator
         * @param {Array} menuEnables - boolean array of menu enable flags indicating which corresponding menu entry in menuOptions should be enabled or disabled.
         * @param {Number} mousex - the x coordinate of the menu trigger point, used to position menu
         * @param {Number} mousey - the y coordinate of the menu trigger point, used to position menu
         * @param {HTMLElement} container - the container element to add the menu to.
         * @param {Object} position - object with x, y, w, h of the container element.
         */
        this.drawDropdownMenu = function (menuOptions, menuEnables, menuCallbacks, mousex, mousey, container, position) {
            var itemID = 0;
    
            if (!dropDownMenu) {
    
                dropDownMenu = document.createElement('div');
                dropDownMenu.className = 'dropDownMenu';
    
                // Initialize the top and left with some approximate values
                // so that the correct width can be returned by gerBoudningClientRect().
                dropDownMenu.style.top = '100px';
                dropDownMenu.style.left = '-400px';
    
                var menuHeight = 0;
                var menuMinWidth = 0;
                for (var i = 0; i < menuOptions.length; i++) {
                    var listItem;
                    if (menuOptions[i] === null) {                       // menu separator
                        listItem = document.createElement("li");
                        listItem.style.height = '1px';
                        menuHeight += 1;
                        listItem.style.backgroundColor = "#E0E0E0";
                    } else {
                        var content = Autodesk.Viewing.i18n.translate(menuOptions[i]);
                        menuMinWidth = content.length > menuMinWidth ? content.length : menuMinWidth;
    
                        if (menuCallbacks[i]) {
                            listItem = document.createElement("div");
                            var check = document.createElement("input");
                            var text = document.createElement("label");
                            check.type = "radio";
                            check.className = "dropDownMenuCheck";
                            text.innerHTML = content;
                            text.className = "dropDownMenuCheckText";
                            listItem.appendChild(check);
                            listItem.appendChild(text);
                            listItem.className = "dropDownMenuCheckbox";
                        }
                        else {
                            listItem = document.createElement("li");
                            listItem.textContent = content;
                            listItem.className = menuEnables[i] ? "dropDownMenuItem" : "dropDownMenuItemDisabled";
                        }
    
                        listItem.id = "menuItem" + itemID;
                        itemID++;
                        menuHeight += 25;       // HACK!!!
    
                        listItem.setAttribute("data-i18n", menuOptions[i]);
                    }
                    dropDownMenu.appendChild(listItem);
                }
    
                // Add the menu to the DOM before asking for boundingClientRect.
                // Otherwise, it will be zero.
                container.appendChild(dropDownMenu);
    
                dropDownMenu.style.minWidth = Math.max(256, menuMinWidth * 7.4) + 'px'; // approximate min width
                var menuWidth = dropDownMenu.getBoundingClientRect().width;
    
                this.menuSize.x = menuWidth;
                this.menuSize.y = menuHeight;
            }
            else {
                // Just add the drop down menu, It already exists.
                container.appendChild(dropDownMenu);
            }
            itemID = 0;
            for (var i = 0; i < menuOptions.length; i++) {
                if (menuOptions[i] === null)
                    continue;
    
                if (menuCallbacks[i]) {
                    var id = "menuItem" + itemID;
                    var element = document.getElementById(id);
                    if (element) {
                        element.children[0].checked = menuCallbacks[i]();
                    }
                }
                itemID++;
            }
            var top = mousey - 15;        // 15 offset so list appears @ button
            var left = mousex + 1;
    
            var rect = this.canvas.getBoundingClientRect();
    
            if ((left + this.menuSize.x) > rect.right)
                left = mousex - this.menuSize.x - 1;
            if ((top + this.menuSize.y) > rect.bottom)
                top = rect.bottom - this.menuSize.y;
    
            // Make relative to container:
            top -= position.y;
            left -= position.x;
    
            dropDownMenu.style.top = top + 'px';
            dropDownMenu.style.left = left + 'px';
    
            this.menuOrigin.x = left;
            this.menuOrigin.y = top;
        };
    
    
        this.removeDropdownMenu = function (container) {
            container.removeChild(dropDownMenu);
        };
    
        function isAxisAligned(vec) {
            var sceneRight = cam.sceneFrontDirection.clone().cross(cam.sceneUpDirection);
            var checkUp = Math.abs(Math.abs(vec.dot(cam.sceneUpDirection)) - 1.0);
            var checkFront = Math.abs(Math.abs(vec.dot(cam.sceneFrontDirection)) - 1.0);
            var checkRight = Math.abs(Math.abs(vec.dot(sceneRight)) - 1.0);
    
            return (checkUp < 0.00001 || checkFront < 0.00001 || checkRight < 0.00001);
        }
    
        this.isFaceView = function () {
            var dir = this.center.clone().sub(camera.position).normalize();
            return isAxisAligned(dir) && isAxisAligned(camera.up);
        };
    
        this.startInteraction = function (x, y) {
            this.startCursor = new THREE.Vector2(x, y);
    
            this.startState = {
                saveCenter: this.center.clone(),
                saveEye: this.camera.position.clone(),
                savePivot: this.pivot.clone(),
                saveUp: this.camera.up.clone()
            };
    
            this.lockDeltaX = 0.0;
            this.lockedX = false;
            this.lastSnapRotateX = 0.0;
            this.lockDeltaY = 0.0;
            this.lockedY = false;
            this.lastSnapRotateY = 0.0;
            this.lastSnapDir = new THREE.Vector3(0, 0, 0);
        };
    
        this.orbit = function (currentCursor, startCursor, distance, startState) {
            if (!this.navApi.isActionEnabled('orbit') || this.currentlyAnimating === true)
                return;
    
            var mode = 'wheel';
    
            // If orthofaces is enabled, and camera is ortho
            // then switch to perspective
            if (cam.orthographicFaces && !camera.isPerspective) {
                camera.toPerspective();
    
                // Hack: update the start state with the new position:
                if (startState)
                    startState.saveEye.copy(this.camera.position);
            }
            if (startState) {
                mode = 'cube';
            }
            if (mode == 'cube') {
                this.saveCenter.copy(startState.saveCenter);
                this.saveEye.copy(startState.saveEye);
                this.savePivot.copy(startState.savePivot);
                this.saveUp.copy(startState.saveUp);
                this.useSnap = true;
                this.doCustomOrbit = true;
            } else {
                this.saveCenter.copy(this.center);
                this.savePivot.copy(this.pivot);
                this.saveEye.copy(camera.position);
                this.saveUp.copy(camera.up);
                this.useSnap = false;
                this.doCustomOrbit = false;
            }
    
            if (IsCombined() && prevCenter == undefined) {
                prevCenter = this.saveCenter.clone();
                prevEye = this.saveEye.clone();
                prevPivot = this.savePivot.clone();
                prevUp = this.saveUp.clone();
            }
    
            // TODO: fold the two cases into one and prevent duplicate code
            if (this.preserveOrbitUpDirection) {
    
                var delta = convertCoordsToWindow(currentCursor.x - startCursor.x, currentCursor.y - startCursor.y);
                var lastDelta = convertCoordsToWindow(distance.x, distance.y);
    
                var worldUp = this.sceneUpDirection.clone();
                var worldFront = this.sceneFrontDirection.clone();
                var worldRight = this.sceneFrontDirection.clone().cross(this.sceneUpDirection).normalize();
    
                /* ????? WTF:
                var worldFront = new THREE.Vector3(1,0,0);
                var worldUp = new THREE.Vector3(0,1,0);
                */
    
                //viewcube
                // if (this.doCustomOrbit ) {
                //     worldUp = new THREE.Vector3(0,1,0);
                //     worldFront = new THREE.Vector3(1,0,0);
                // }
    
                /* ?????? WTF:
                var worldR = worldFront.clone().cross( worldUp );
                worldUp = worldR.clone().cross(worldFront);
                worldUp.clone().normalize();
                */
    
                var pivot = IsCombined() ? prevPivot : this.savePivot;
                var eye = IsCombined() ? prevEye : this.saveEye;
                var center = IsCombined() ? prevCenter : this.saveCenter;
                var camUp = IsCombined() ? prevUp : this.saveUp;
    
                var initViewDir = pivot.clone().sub(eye).normalize();
                var initViewDirV = center.clone().sub(eye).normalize();
                var initRightDir = initViewDirV.clone().cross(camUp);
    
                var fTargetDist = eye.clone().sub(pivot).length();
                var fTargetDistV = eye.clone().sub(center).length();
    
                var vLookUpdate = initViewDir.clone().multiplyScalar(-1);
                var vLookUpdateV = initViewDirV.clone().multiplyScalar(-1);
                var vRightUpdate = initRightDir;
                var vUpUpdate = camUp.clone();
    
                var snapAngleh = 0.0;
                var snapAnglev = 0.0;
    
                //viewcube
    
                // DOESN'T DO ANYTHING: snapToClosestView(worldUp, snapAngleh, snapAnglev);
    
                if (!this.constrainOrbitHorizontal) {
                    // Need to check if:
                    //  1. camera is "upside-down" (angle between world up and camera up is obtuse) or
                    //  2. camera is in top view (camera up perpendicular to world up and view angle acute to world up)
                    // These cases required a reversed rotation direction to maintain consistent mapping of tool:
                    //  left->clockwise, right->counter-clockwise
                    //
                    //  PHB June 2014 - #2 above makes no sense to me. If the camera up is perpendicular to the
                    //  world up then the view is parallel to world up (view dot up == 1). So the second test is
                    //  meaningless. There is no good way to determine the rotation direction in this case. If you
                    //  want it to feel like direct manipulation then it would be better to determine if the cursor
                    //  is above or below the pivot in screen space.
    
                    var worldUpDotCamUp = worldUp.dot(this.saveUp);
                    // var worldUpDotView  = worldUp.dot(this.saveCenter.clone().sub(this.saveEye).normalize());
    
                    // if ((worldUpDotCamUp < -Number.MIN_VALUE) ||
                    //     ((Math.abs(worldUpDotCamUp) < Number.MIN_VALUE) && (worldUpDotView > 0.0)))
                    //
                    var kFlipTolerance = 0.009;     // Must be flipped by more than about 0.5 degrees
                    if (worldUpDotCamUp < -kFlipTolerance) {
                        delta.x = -delta.x;
                        lastDelta.x = -lastDelta.x;
                    }
    
                    var dHorzAngle = 0.0;
                    if (IsCombined()) {
                        dHorzAngle = lastDelta.x * this.orbitMultiplier;
                    } else {
                        dHorzAngle = this.useSnap ? this.lastSnapRotateX + getNextRotation('h', snapAngleh, -lastDelta.x) :
                            delta.x * this.orbitMultiplier;
                    }
    
                    this.lastSnapRotateX = dHorzAngle;
                    // Define rotation transformation
    
                    var quatH = new THREE.Quaternion().setFromAxisAngle(worldUp, -dHorzAngle);
    
                    vLookUpdate.applyQuaternion(quatH);
                    vLookUpdateV.applyQuaternion(quatH);
                    vRightUpdate.applyQuaternion(quatH);
                    vUpUpdate.applyQuaternion(quatH);
                }
    
                if (!this.constrainOrbitVertical) {
                    var vRightProjF = worldFront.clone().multiplyScalar(worldFront.dot(vRightUpdate));
                    var vRightProjR = worldRight.clone().multiplyScalar(worldRight.dot(vRightUpdate));
                    var vRightProj = vRightProjF.clone().add(vRightProjR);
                    vRightProj.clone().normalize();
    
                    var dVertAngle = 0.0;
    
                    if (IsCombined()) {
                        dVertAngle = lastDelta.y * this.orbitMultiplier;
                    } else {
                        var next = getNextRotation('v', snapAnglev, lastDelta.y);
                        dVertAngle = this.useSnap ? this.lastSnapRotateY + next : delta.y * this.orbitMultiplier;
                    }
                    var quatV = new THREE.Quaternion().setFromAxisAngle(vRightProj, -dVertAngle);
    
                    if (!this.navApi.getOrbitPastWorldPoles()) {
    
                        var vUpUpdateTemp = vUpUpdate.clone();
                        vUpUpdateTemp.applyQuaternion(quatV).normalize();
    
                        // Check if we've gone over the north or south poles:
                        var wDotC = worldUp.dot(vUpUpdateTemp);
                        if (wDotC < 0.0) {
                            var vLookUpdateVtemp = vLookUpdateV.clone();
                            vLookUpdateVtemp.applyQuaternion(quatV).normalize();
    
                            // How far past Up are we?
                            var dVertAngle2 = vLookUpdateVtemp.angleTo(worldUp);
                            if (Math.abs(dVertAngle2) > (Math.PI * 0.5))
                                dVertAngle2 -= (dVertAngle2 > 0.0) ? Math.PI : -Math.PI;
    
                            dVertAngle -= dVertAngle2;
    
                            quatV.setFromAxisAngle(vRightProj, -dVertAngle);
                            vLookUpdate.applyQuaternion(quatV).normalize();
                            vLookUpdateV.applyQuaternion(quatV).normalize();
                            vUpUpdate.applyQuaternion(quatV).normalize();
    
                        }
                        else {
                            vLookUpdate.applyQuaternion(quatV).normalize();
                            vLookUpdateV.applyQuaternion(quatV).normalize();
                            vUpUpdate.applyQuaternion(quatV).normalize();
                        }
                    }
                    else {
                        vLookUpdate.applyQuaternion(quatV).normalize();
                        vLookUpdateV.applyQuaternion(quatV).normalize();
                        vUpUpdate.applyQuaternion(quatV).normalize();
                    }
                    this.lastSnapRotateY = dVertAngle;
                }
    
                // figure out new eye point
                var vNewEye = vLookUpdate.multiplyScalar(fTargetDist).add(pivot);
    
                camera.position.copy(vNewEye);
                camera.up.copy(vUpUpdate);
                this.center.copy(vNewEye);
                this.center.sub(vLookUpdateV.multiplyScalar(fTargetDistV));
    
                if (IsCombined()) {
                    prevCenter.copy(this.center);
                    prevEye.copy(camera.position);
                    prevPivot.copy(this.pivot);
                    prevUp.copy(camera.up);
                }
            }
            else {
                /*var lastDelta = convertCoordsToWindow(distance.x, distance.y);
                var vDir = prevPivot.clone().sub(prevEye);
                var vDirView = prevCenter.clone().sub(prevEye);
                var vRight = vDirView.clone().cross(prevUp);
                var vUp = vRight.clone().cross(vDirView);
                vUp.clone().normalize();
    
                var dist = (prevPivot.clone().sub(prevEye)).clone().length();
                var distView = (prevCenter.clone().sub(prevEye)).clone().length();
    
                var snapAngleh = 0.0;
                var snapAnglev = 0.0;
    
                //viewcube
                //snapToClosestView(vUp, snapAngleh, snapAnglev);
    
                if ( !this.constrainOrbitHorizontal ){
    
                var dHorzAngle = this.useSnap ? getNextRotation(HORIZONTAL, snapAngleh, lastDelta.x):
                lastDelta.x *this.orbitMultiplier;
    
                var quatH = new THREE.Quaternion().setFromAxisAngle( vUp.clone().normalize(), dHorzAngle );
                vDir = quatH.clone().rotate(vDir);
                vDirView = quatH.clone().rotate(vDirView);
                }
    
                if ( !this.constrainOrbitVertical ){
                var dVertAngle = this.useSnap ? getNextRotation(VERTICAL, snapAnglev, lastDelta.y) :
                lastDelta.y *this.orbitMultiplier;
    
                var quatV = new THREE.Quaternion().setFromAxisAngle( vRight.clone().normalize(), dVertAngle );
                vDir = quatV.clone().rotate(vDir);
                vDirView = quatV.clone().rotate(vDirView);
                vUp = quatV.clone().rotate(vUp);
                }
    
                camera.eye = this.pivot.clone().sub((vDir.clone().normalize()).clone().multiplyScalar(dist));
                this.center.copy(camera.eye.clone().add((vDirView.clone().normalize()).clone().multiplyScalar(distView)));
                camera.up.copy(vUp.clone().normalize());
    
                prevCenter = this.center;
                prevEye = camera.position;
                prevPivot = this.pivot;
                prevUp = camera.up;*/
            }
            camera.lookAt(this.center);
            changed(false);
    
            /*Logger.log("Camera Position: ( "+camera.position.x +", "+camera.position.y+", "+camera.position.z+" )");
            Logger.log("Up Vector: ( "+camera.up.x +", "+camera.up.y+", "+camera.up.z+" )");
            Logger.log("Center: ( "+this.center.x +", "+this.center.y+", "+this.center.z+" )");
            */
        };
    
        this.endInteraction = function () {
        };
    
        this.look = function (distance) {
            if (!this.navApi.isActionEnabled('walk'))
                return;
    
            var delta = convertCoordsToWindow(distance.x, distance.y);
            var multiplier = this.userLookSpeed;
    
            //if ( m_manager->GetApplicationParameters().lookInvertVerticalAxis ) { deltaY = -deltaY; }
    
            var eyeToCenter = this.getView();
    
            var camUp = camera.up;
            var camRight = eyeToCenter.clone().cross(camUp).normalize();
            var worldUp = this.sceneUpDirection.clone();
    
            // TODO: scale look by camera's FOV
            // vertical rotation around the camera right vector
            var angle = delta.clone();
            angle.x *= Math.PI;
            angle.y *= Math.PI / camera.aspect;
            angle.multiplyScalar(multiplier);
            var qRotY = new THREE.Quaternion().setFromAxisAngle(camRight, -angle.y);
    
            if (camera.keepSceneUpright && !this.navApi.getOrbitPastWorldPoles()) {
                var futureUp = camUp.clone();
                futureUp.applyQuaternion(qRotY).normalize();
    
                if (futureUp.dot(worldUp) < 0) {
                    var futureEyeToCenter = eyeToCenter.clone();
                    futureEyeToCenter.applyQuaternion(qRotY);
    
                    var deltaAngle = futureEyeToCenter.angleTo(worldUp);
    
                    if (Math.abs(deltaAngle) > (Math.PI * 0.5))
                        deltaAngle -= (deltaAngle > 0.0) ? Math.PI : -Math.PI;
    
                    angle.y -= deltaAngle;
    
                    qRotY.setFromAxisAngle(camRight, -angle.y);
                }
            }
    
            eyeToCenter = qRotY.clone().rotate(eyeToCenter);
            camUp = qRotY.clone().rotate(camUp);
            camUp.normalize();
    
            var vertAxis = camera.keepSceneUpright ? worldUp : camUp;
            var qRotX = new THREE.Quaternion().setFromAxisAngle(vertAxis, -angle.x);
    
            eyeToCenter = qRotX.clone().rotate(eyeToCenter);
            camUp = qRotX.clone().rotate(camUp);
    
            this.center.copy(eyeToCenter.add(camera.position));
            camera.up.copy(camUp);
    
            camera.lookAt(this.center);
            changed(false);
        };
    
        this.pan = function (distance) {
            if (!this.navApi.isActionEnabled('pan'))
                return;
    
            distance = convertCoordsToWindow(distance.x, distance.y);
    
            var W = this.getView();
            var U = camera.up.clone().cross(W);
            var V = W.clone().cross(U);
    
            U.normalize();
            V.normalize();
            W.normalize();
    
            var Pscreen = this.pivot.clone().sub(camera.position);
            var screenW = W.clone().dot(Pscreen);
            var screenU = screenW * (Math.tan(THREE.Math.degToRad(camera.leftFov)) + Math.tan(THREE.Math.degToRad(camera.rightFov)));
            var screenV = screenW * (Math.tan(THREE.Math.degToRad(camera.topFov)) + Math.tan(THREE.Math.degToRad(camera.bottomFov)));
    
            var offsetU = distance.x * Math.abs(screenU);
            var offsetV = distance.y * Math.abs(screenV);
    
            var offset = new THREE.Vector3();
            var u = U.clone().multiplyScalar(offsetU);
            var v = V.clone().multiplyScalar(offsetV);
    
            offset = (u.clone().add(v)).clone().multiplyScalar(this.userPanSpeed);
    
            camera.position.add(offset);
            this.center.add(offset);
    
            camera.lookAt(this.center);
            changed(false);
        };
    
        this.zoom = function (zoomDelta) {
            if (!this.navApi.isActionEnabled('zoom'))
                return;
    
            //TODO: bug - when pivot is set outside the object, object zooms past the pivot point
            var zoomMin = 0.05;
            var zoomBase = this.userZoomSpeed;
            var distMax = Number.MAX_VALUE;
            var deltaXY = zoomDelta.x + zoomDelta.y;
            var dist = Math.pow(zoomBase, deltaXY);
    
            var zoomPosition = (this.pivot.clone().sub((this.pivot.clone().sub(this.saveEye).clone()).multiplyScalar(dist)));
            var zoomCenter = zoomPosition.clone().add(cam.D.clone().multiplyScalar(cam.D.clone().dot((this.pivot.clone().sub(zoomPosition)).clone())));
    
            if (dist >= distMax)
                return;
    
            if (deltaXY > 0.0) {
                var snapSize = 0;
                var dist2 = Math.pow(zoomBase, deltaXY - snapSize);
    
                // PERSP zoom out
                if (deltaXY < snapSize) {
                    // inside the zoomout speedbump region
                    unitAmount = 0.0;
                    return;
    
                } else {
                    camera.position.copy(zoomPosition);
                    this.center.copy(zoomCenter);
    
                    var EprojD = (zoomPosition.clone().sub(this.saveEye)).dot(cam.D);
    
                    if (EprojD > distMax) {
                        camera.position.copy((this.saveEye.sub(cam.D)).clone().multiplyScalar(distMax));
                        unitAmount = (distMax > 0.0) ? -1.0 : 0.0;
                    } else {
                        unitAmount = -(EprojD / distMax);
                    }
                }
            } else {
    
    
                camera.position.copy(zoomPosition);
                this.center.copy(zoomCenter);
    
                //Zoom In
                /*if ( dist < zoomMin) {
                    //exponential zoom moved in as far as it can
                    var zoomMinLinear = ( Math.log(zoomMin) / Math.log(zoomBase) );
                    var distLinearXY = Math.abs(deltaXY) - Math.abs(zoomMinLinear);
                    var snapSize = 0;
    
                    // do linear zoomin
                    if ( distLinearXY > snapSize ) {
    
                        var distLinearXY = distLinearXY - snapSize/window.innerHeight;
                        var amount = -distLinearXY;
    
                        var multiplier = this.userZoomSpeed;
                        var dist2 = amount * multiplier;
    
                        var Esnap = this.pivot.clone().sub((this.pivot.clone().sub(this.saveEye)).clone().multiplyScalar(zoomMin));
                        var E = Esnap.clone().sub((this.pivot.clone().sub(this.saveEye)).clone().multiplyScalar(dist2));
    
                        this.center.copy(E.clone().add(cam.D.clone().multiplyScalar(zoomMin)));
                        camera.position.copy(E);
                    }
                } else {
                    cam.D = (this.saveCenter.clone().sub(this.saveEye)).clone().normalize();
                    camera.position.copy(zoomPosition);
                    this.center.copy(zoomCenter);
                }*/
            }
            camera.lookAt(this.center);
            changed(false);
        };
    
        this.walk = function (currentCursor, startCursor, movementX, movementY, deltaTime) {
            if (!this.navApi.isActionEnabled('walk'))
                return;
    
            var worldUp = this.sceneUpDirection.clone();
            var worldFront = this.sceneFrontDirection.clone();
            var worldRight = this.sceneFrontDirection.clone().cross(this.sceneUpDirection);
            //TODO: figure out what deltaTime does
    
            var flyPlanarMotion = true;
            var flyUpDownSensitivity = 0.01;
    
            if (isInDeadZone(currentCursor, startCursor)) {
                wheel.cursorImage('SWWalk');
                setBias(true, currentCursor, startCursor);
                x = startCursor.x;
                y = startCursor.y;
            } else {
                setBias(false, currentCursor, startCursor);
            }
    
            //x = currentCursor.x - m_resetBiasX;
            //y = currentCursor.y - m_resetBiasY;
            x = currentCursor.x;
            y = currentCursor.y;
    
            var delta = convertCoordsToWindow(x - startCursor.x, y - startCursor.y);
    
            var fInitialMoveX = -delta.x;
            var fInitialMoveY = -delta.y;
            var fSignX = (fInitialMoveX < 0.0) ? -1.0 : 1.0;
            var fSignY = (fInitialMoveY < 0.0) ? -1.0 : 1.0;
            var fMoveX = Math.abs(fInitialMoveX);
            var fMoveY = Math.abs(fInitialMoveY);
    
            var deadzoneRadius = new THREE.Vector2(30, 30);
            deadzoneRadius = convertCoordsToWindow(deadzoneRadius.x, deadzoneRadius.y);
    
            fMoveX = (isInDeadZone(currentCursor, startCursor)) ? 0.0 : Math.abs(fInitialMoveX) - deadzoneRadius.x;
            fMoveY = (isInDeadZone(currentCursor, startCursor)) ? 0.0 : Math.abs(fInitialMoveY) - deadzoneRadius.y;
    
            var rampRadius = 0.25;
            fMoveX /= rampRadius;
            fMoveY /= rampRadius;
    
            fMoveX = (fMoveX < 1.0) ? Math.easeClamp(fMoveX, 0.0, 1.0) : Math.pow(fMoveX, 1.0);
            fMoveY = (fMoveY < 1.0) ? Math.easeClamp(fMoveY, 0.0, 1.0) : Math.pow(fMoveY, 1.0);
    
    
            // scale by time
            //fMoveX *= deltaTime;
            //fMoveY *= deltaTime;
    
            var fDeltaX = (fMoveX > 0.0) ? fMoveX * fSignX : 0.0;
            var fDeltaY = (fMoveY > 0.0) ? fMoveY * fSignY : 0.0;
    
            var vViewDir = this.getView();
            var fViewDist = vViewDir.length();
            vViewDir.normalize();
    
            var vRightDir = vViewDir.clone().cross(camera.up);
            vRightDir.normalize();
    
            // project vViewDir onto plane perpendicular to up direction to get
            // better walking inside houses, etc
            // (but prevents flying down to model from 3/4 view...)
    
            var vYViewDirRight = worldRight.clone().multiplyScalar(worldRight.clone().dot(vViewDir));
            var vYviewDirFront = worldFront.clone().multiplyScalar(worldFront.clone().dot(vViewDir));
            var vYViewDir = vYviewDirFront.clone().add(vYViewDirRight);
    
            vYViewDir = (vYViewDir.clone().length() > Number.MIN_VALUE) ? vYViewDir.normalize() : camera.up;
    
            var scale = 1.0;
            var fDollyDist = fDeltaY * (this.walkMultiplier * scale);
    
            var dir = flyPlanarMotion ? vYViewDir : vViewDir;
    
    
            // Free-flying or constrained walk?
            if (flyPlanarMotion) {
                // Constrained Walk
                // To avoid perceptually confusing motion, force a reversal of flying direction along a shifted axis
    
                // Angle to offset threshold from up-axis
                // TODO: make cos(0.65) into an AutoCam Parameter
                var dDirThreshold = Math.cos(0.65);
    
                if ((dDirThreshold != 1) &&
                    (((worldUp.clone().dot(camera.up) < -Number.MIN_VALUE) && (worldUp.clone().dot(vViewDir) < -dDirThreshold)) ||
                        ((worldUp.clone().dot(camera.up) > Number.MIN_VALUE) && (worldUp.clone().dot(vViewDir) > dDirThreshold)))) {
                    dir = -dir;
                }
            }
    
    
            var fSpinAngle = -fDeltaX * this.walkMultiplier * 0.05;
    
            // rotate around world-up vector instead of CameraOperations up vector (more like head movement!)
            //Quaternion quat( m_cameraParams.up, (float)fSpinAngle );
    
            // Define rotation axis direction
            var vRotAxis = camera.up;
    
            // Free-flying or constrained walk?
            if (flyPlanarMotion) {
                // Constrained Walk
                // Need to check if:
                //  1. camera is "upside-down" (angle between world up and camera up is obtuse) or
                //  2. camera is in top view (camera up perpendicular to world up and view angle acute to world up)
                // These cases require a reversed rotation direction to maintain consistent mapping of tool:
                //  left->clockwise, right->counter-clockwise
                if ((worldUp.clone().dot(camera.up) < -Number.MIN_VALUE) ||
                    ((Math.abs(worldUp.clone().dot(camera.up)) < Number.MIN_VALUE)
                        && (worldUp.clone().dot(vViewDir) > Number.MIN_VALUE))) {
                    fSpinAngle = -fSpinAngle;
                }
                vRotAxis = worldUp;
            }
    
            // Define rotation transformation
    
            var quat = new THREE.Quaternion().setFromAxisAngle(vRotAxis, fSpinAngle);
            quat.normalize();
    
            vViewDir = quat.clone().rotate(vViewDir);
            vViewDir.normalize();
            camera.up.copy(quat.clone().rotate(camera.up));
            camera.up.normalize();
    
            camera.position.add(dir.clone().multiplyScalar(fDollyDist));
            this.center.copy(camera.position.clone().add(vViewDir.clone().multiplyScalar(fViewDist)));
    
            dir = flyPlanarMotion ? worldUp : camera.up;
            dir.normalize();
    
            if (fDollyDist === 0)
                fDollyDist = flyUpDownSensitivity;
    
            camera.lookAt(this.center);
            changed(false);
        };
    
        this.updown = function (movementY) {
            if (this.navApi.getIsLocked())
                return;
    
            var deltaCursor = movementY;
            var deltaAmount = getMoveAmountFromCursorOffset(deltaCursor);
    
            cam.m_amount += deltaAmount;
    
            var upDir = new THREE.Vector3(0, 1, 0);
    
            var eye = cam.saveEye.clone().sub(upDir.clone().multiplyScalar(cam.m_amount));
            var eyeHeight = eye.clone().dot(upDir);
    
            camera.position.copy(eye);
    
            if (eyeHeight < cam.minSceneBound) {
                camera.position.add(upDir.clone().multiplyScalar(cam.minSceneBound - eyeHeight));
            }
    
            if (eyeHeight > cam.maxSceneBound) {
                camera.position.add(upDir.clone().multiplyScalar(cam.maxSceneBound - eyeHeight));
            }
    
            this.center.copy(camera.position.clone().add(cam.saveCenter.clone().sub(cam.saveEye)));
            camera.lookAt(this.center);
            changed(false);
        };
    
    
        /*      REWIND FUNCTIONS */
    
        /**
         * This takes a snapshot of the current camera passed into Autocam and saves it to the history. A screenshot
         * is taken of the sceneContainer canvas
         */
        this.addHistoryElement = function () {
    
            // --- We don't require history being saved ---
    
            // if (cam.rewindParams.maxHistorySize > 0 && cam.rewindParams.history.length >= cam.rewindParams.maxHistorySize){
            //     this.rewindParams.history.shift();
            // }
    
            // //reset previous 1 or 2 weights to 0
            // if (cam.rewindParams.history.length == 1){
            //     cam.rewindParams.history[0].weight = 0.0;
            // }else if (cam.rewindParams.history.length > 1){
            //     cam.rewindParams.history[cam.rewindParams.history.length -1].weight = 0.0;
            //     cam.rewindParams.history[cam.rewindParams.history.length -2].weight = 0.0;
            // }
    
            // var element = {};
            // element.thumbnail = document.getElementById("sceneContainer").toDataURL("image/png");
            // element.thumbnailBounds = new THREE.Box2(new THREE.Vector2(0,0),new THREE.Vector2(56,56));
            // element.camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 10000 );
            // element.camera.position = camera.position.clone();
            // element.camera.up = camera.up.clone();
            // element.camera.rotation = camera.rotation.clone();
            // element.camera.leftFov = camera.leftFov;
            // element.camera.rightFov = camera.rightFov;
            // element.camera.topFov = camera.topFov;
            // element.camera.bottomFov = camera.bottomFov;
            // element.camera.center = cam.center.clone();
            // element.camera.pivot = cam.pivot.clone();
            // element.weight = 1.0;
            // element.isEmptyScene = false;
    
            // //IF SCENE OUTSIDE VIEW SET ISEMPTYSCENE TO TRUE
    
            // cam.rewindParams.history.push(element);
            // cam.rewindParams.snapped = true;
            // cam.rewindParams.slideOffset.x=0;
            // cam.rewindParams.timelineIndex = cam.rewindParams.history.length - 1;
            // cam.rewindParams.timelineIndexSlide = cam.rewindParams.timelineIndex;
        }
    
        /**
         * This handles any case where the user rewinds and then does any transformations, the history is sliced depending
         * on where the user rewinds to
         */
        this.addIntermediateHistoryElement = function () {
    
            if (this.rewindParams.snapped) {
                this.rewindParams.history = this.rewindParams.history.slice(0, this.rewindParams.timelineIndex);
            } else {
                if (this.rewindParams.slideOffset.x > 0) {
                    this.rewindParams.history = this.rewindParams.history.slice(0, this.rewindParams.timelineIndex);
                } else {
                    this.rewindParams.history = this.rewindParams.history.slice(0, this.rewindParams.timelineIndex + 1);
                }
            }
            this.addHistoryElement();
        };
    
        this.clearHistory = function () {
            this.rewindParams.history.length = 0;
            this.rewindParams.timelineIndex = 0;
            this.rewindParams.timelineIndexSlide = 0;
            this.rewindParams.resetWeights = true;
        };
    
        this.openTimeline = function (location) {
            this.rewindParams.timelineIndexSlide = this.rewindParams.timelineIndex;
    
            if (this.rewindParams.resetWeights) {
                this.rewindParams.slideOffset.x = 0;
                this.rewindParams.snapped = this.rewindParams.snappingEnabled;
            }
    
            //if haven't applied any transformations before clicking rewind
            if (this.rewindParams.history.length === 0) this.addHistoryElement();
    
            for (var i = 0; i < this.rewindParams.history.length; i++) {
                var index = i - this.rewindParams.timelineIndex;
                var size = this.rewindParams.thumbnailGapSize + this.rewindParams.thumbnailSize;
    
                this.rewindParams.history[i].thumbnailBounds.setCenter(new THREE.Vector2(location.x + index * size, location.y).add(this.rewindParams.slideOffset));
    
                if (this.rewindParams.resetWeights) {
                    this.rewindParams.history[i].weight = (i == this.rewindParams.timelineIndex) ? 1.0 : 0.0;
                }
            }
    
            if (this.rewindParams.resetWeights) {
                this.rewindParams.resetWeights = false;
            }
    
            var size = (this.rewindParams.thumbnailGapSize + this.rewindParams.thumbnailSize) * 2.0;
            this.rewindParams.open = true;
            this.rewindParams.openLocation = location.clone();
            this.rewindParams.openLocationOrigin = location.clone();
            this.rewindParams.openBracket = location.clone();
            this.rewindParams.openBracketA = new THREE.Vector2(size, location.y);
            this.rewindParams.openBracketB = new THREE.Vector2(window.innerWidth - size, location.y);
            // make sure dead-zone is well formed ... i.e. A.x < B.x
            if (this.rewindParams.openBracketA.x > this.rewindParams.openBracketB.x) {
                var swap = this.rewindParams.openBracketA.x;
                this.rewindParams.openBracketA.x = this.rewindParams.openBracketB.x;
                this.rewindParams.openBracketB.x = swap;
            }
            this.rewindParams.locationOffset = new THREE.Vector2(0, 0);
            this.rewindParams.snapOffset = new THREE.Vector2(0, 0);
        };
    
        this.slideTimeline = function (location_) {
            /*
             Basic Idea:
             Behaviour of the current rewind timeline is similar to a tracking menu. There is a "deadzone"
             region where cursor movement does not slide the thumbnails. As the cursor goes outside the
             region, thumbnails slide to align the closest edge of the timeline to the cursor ('extent'
             variable is this sliding amount). The edges of the deadzone region are stored in
             'm_openBracketA/B' variables, and slide around with the timeline. Draw some icons at bracket
             positions to visualize the process.
             */
    
            if (!this.rewindParams.open || this.rewindParams.history.length === 0) { return; }
    
            var location = location_.clone().add(this.rewindParams.locationOffset);
    
            var size = (this.rewindParams.thumbnailGapSize + this.rewindParams.thumbnailSize) * 2.0;
            var bracketA = size;
            var bracketB = window.innerWidth - size;
    
            var edgeA = this.rewindParams.history[0].thumbnailBounds.center().x;
            var edgeB = this.rewindParams.history[this.rewindParams.history.length - 1].thumbnailBounds.center().x;
    
            var extent = 0.0;
    
            if (location.x < this.rewindParams.openBracketA.x) {
                extent = location.x - this.rewindParams.openBracketA.x;
    
                // don't slide thumbnails past the edge of the timeline
                var edgeAnew = edgeA - extent;
    
                if (bracketA < edgeAnew) {
                    // only want to limit the influence of extent, not overshoot the other way
                    extent = Math.min(extent + (edgeAnew - bracketA), 0.0);
                }
            }
            if (location.x > this.rewindParams.openBracketB.x) {
                extent = location.x - this.rewindParams.openBracketB.x;
    
                // don't slide thumbnails past the edge of the timeline
                var edgeBnew = edgeB - extent;
    
                if (bracketB > edgeBnew) {
                    // only want to limit the influence of extent, not overshoot the other way
                    extent = Math.max(extent + (edgeBnew - bracketB), 0.0);
                }
            }
    
            this.rewindParams.openLocation.x += extent;
            this.rewindParams.openBracketA.x += extent;
            this.rewindParams.openBracketB.x += extent;
    
            this.rewindParams.openBracket.x = location.x - (this.rewindParams.openLocation.x - this.rewindParams.openLocationOrigin.x);
    
            var iconOffset = new THREE.Vector2(-extent, 0.0);
    
            var L = location.clone().sub(this.rewindParams.openLocation.clone().sub(this.rewindParams.openLocationOrigin));
    
            // snapping
    
            iconOffset.x += this.rewindParams.snapOffset.x;
            this.rewindParams.snapOffset.x = 0.0;
    
            var snapped = false;
    
            if (this.rewindParams.snappingEnabled) {
                var kEnterSnapDistance = 4.0;
                var kLeaveSnapDistance = 16.0;
    
                for (var i = 0; i < this.rewindParams.history.length; i++) {
                    var P = this.rewindParams.history[i].thumbnailBounds.center().add(iconOffset);
                    if (Math.abs(P.x - L.x) < kEnterSnapDistance || (this.rewindParams.snapped && Math.abs(P.x - L.x) < kLeaveSnapDistance)) {
                        snapped = true;
                        if (extent !== 0.0) {
                            this.rewindParams.snapOffset.x = P.x - L.x;
                            iconOffset.x -= this.rewindParams.snapOffset.x;
                        }
                        else {
                            this.rewindParams.openBracket.x += P.x - L.x;
                        }
                        L.x = P.x;
                        break;
                    }
                }
            }
    
            this.rewindParams.snapped = snapped;
    
            var weightMax = -1.0;
            var weightTotal = 0.0;
            for (var j = 0; j < this.rewindParams.history.length; j++) {
                var tempBox = this.rewindParams.history[j].thumbnailBounds.clone();
    
                // slide the thumbnails
                this.rewindParams.history[j].thumbnailBounds.setCenter(this.rewindParams.history[j].thumbnailBounds.center().add(iconOffset));
    
                if (this.rewindParams.history[j].thumbnail) {
                    var leftEdge = this.rewindParams.history[j].thumbnailBounds.center().x - this.rewindParams.thumbnailSize / 2.0;
                    $('#rewindFrame' + j).css('left', leftEdge);
                    $('#rewindBorder' + j).css('left', (leftEdge - 4));
                }
    
                // grow the copied Icon2D to touch the center of its neighbor
                //think about adding offset for frames here
                var newSize = new THREE.Vector2((this.rewindParams.thumbnailGapSize + this.rewindParams.thumbnailSize) * 2.0, (this.rewindParams.thumbnailGapSize + this.rewindParams.thumbnailSize) * 2.0);
                tempBox.setFromCenterAndSize(tempBox.center(), newSize);
    
                var Icon2DCoords = new THREE.Vector2(0, 0);
                tempBox.getIcon2DCoords(L, Icon2DCoords);
    
                var weight = 1.0 - Math.abs(Math.equalityClamp(Icon2DCoords.x, -1.0, 1.0));
                this.rewindParams.history[j].weight = weight;
    
                // check for out-of-range cases
                if (j === 0 && L.x < tempBox.center().x)
                { this.rewindParams.history[j].weight = 1.0; }
    
                if (j === this.rewindParams.history.length - 1 && L.x > tempBox.center().x)
                { this.rewindParams.history[j].weight = 1.0; }
    
                weightTotal = weightTotal + this.rewindParams.history[j].weight;
    
                // find dominant thumbnail
                if (this.rewindParams.history[j].weight > weightMax) {
                    weightMax = this.rewindParams.history[j].weight;
                    if (this.rewindParams.snappingEnabled && this.rewindParams.history[j].weight == 1.0) {
                        // snap to this element
                        this.rewindParams.slideOffset.x = 0;
                        this.rewindParams.snapped = true;
                    } else {
                        this.rewindParams.slideOffset.x = this.rewindParams.history[j].thumbnailBounds.center().x - L.x;
                    }
                    this.rewindParams.timelineIndexSlide = j;
                }
            }
    
            // normalize the weights just in case
            for (var k = 0; k < this.rewindParams.history.length; k++) {
                this.rewindParams.history[k].weight = this.rewindParams.history[k].weight / weightTotal;
            }
    
            // prevent the bracket from moving off the ends of the timeline
            var xBracketMin = this.rewindParams.history[0].thumbnailBounds.center().x;
            var xBracketMax = this.rewindParams.history[this.rewindParams.history.length - 1].thumbnailBounds.center().x;
            if (this.rewindParams.openBracket.x < xBracketMin) {
                this.rewindParams.locationOffset.x += xBracketMin - this.rewindParams.openBracket.x;
                this.rewindParams.openBracket.x = xBracketMin;
            }
            else if (this.rewindParams.openBracket.x > xBracketMax) {
                this.rewindParams.locationOffset.x += xBracketMax - this.rewindParams.openBracket.x;
                this.rewindParams.openBracket.x = xBracketMax;
            }
        };
    
        this.shiftBackOneElement = function () {
            if (this.rewindParams.history.length !== 0 && (this.rewindParams.timelineIndex > 0 || this.rewindParams.slideOffset.x !== 0)) {
                if (this.rewindParams.snapped || this.rewindParams.slideOffset.x > 0) {
                    this.rewindParams.timelineIndex--;
                }
                this.rewindParams.timelineIndexSlide = this.rewindParams.timelineIndex;
                this.rewindParams.resetWeights = true;
                cam.elapsedTime = 0;
                this.animateToRewindIndex();
            }
        };
    
        this.animateToRewindIndex = function () {
            var currentTimelineIndex = this.rewindParams.timelineIndex;
            var unitTime = 0.0;
            if (cam.elapsedTime >= shotParams.duration) {
                unitTime = 1.0;
            } else {
                var tMax = shotParams.destinationPercent;
                unitTime = Math.easeClamp(cam.elapsedTime / shotParams.duration, 0.0, tMax);
                cam.elapsedTime += deltaTime / 500;
            }
    
            cam.center.copy((cam.center.clone().multiplyScalar(1.0 - unitTime)).clone().add(this.rewindParams.history[currentTimelineIndex].camera.center.clone().multiplyScalar(unitTime)));
            camera.position.copy((camera.position.clone().multiplyScalar(1.0 - unitTime)).clone().add(this.rewindParams.history[currentTimelineIndex].camera.position.clone().multiplyScalar(unitTime)));
            camera.up.copy(this.rewindParams.history[currentTimelineIndex].camera.up);
            cam.pivot.copy(cam.center);
    
            camera.lookAt(cam.center);
            changed(false);
    
            if (this.cube)
                requestAnimationFrame(this.cube.render);
    
            if (unitTime !== 1.0)
                requestAnimationFrame(function () { cam.animateToRewindIndex(); });
        };
    
        this.closeTimeline = function () {
            if (this.rewindParams.timelineIndex != this.rewindParams.timelineIndexSlide) {
                this.rewindParams.timelineIndex = this.rewindParams.timelineIndexSlide;
            }
            this.rewindParams.open = false;
        };
    
        this.getInterpolatedCamera = function () {
            var interpolatedCam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
            interpolatedCam.center = new THREE.Vector3(0, 0, 0);
            interpolatedCam.pivot = new THREE.Vector3(0, 0, 0);
            interpolatedCam.leftFov = 0;
            interpolatedCam.rightFov = 0;
            interpolatedCam.topFov = 0;
            interpolatedCam.bottomFov = 0;
            interpolatedCam.up.set(0, 0, 0);
    
            for (var i = 0; i < this.rewindParams.history.length; i++) {
                var frameCam = this.rewindParams.history[i].camera;
                var wi = this.rewindParams.history[i].weight;
    
                interpolatedCam.center.add(frameCam.center.clone().multiplyScalar(wi));
                interpolatedCam.position.add(frameCam.position.clone().multiplyScalar(wi));
                interpolatedCam.up.add(frameCam.up.clone().multiplyScalar(wi));
                interpolatedCam.rotation.add(frameCam.rotation.clone().multiplyScalar(wi));
                interpolatedCam.pivot.add(frameCam.pivot.clone().multiplyScalar(wi));
                interpolatedCam.leftFov += (frameCam.leftFov * wi);
                interpolatedCam.rightFov += (frameCam.rightFov * wi);
                interpolatedCam.topFov += (frameCam.topFov * wi);
                interpolatedCam.bottomFov += (frameCam.bottomFov * wi);
            }
    
            camera.position.copy(interpolatedCam.position);
            camera.up.copy(interpolatedCam.up);
            camera.rotation = interpolatedCam.rotation;
            camera.leftFov = interpolatedCam.leftFov;
            camera.rightFov = interpolatedCam.rightFov;
            camera.topFov = interpolatedCam.topFov;
            camera.bottomFov = interpolatedCam.bottomFov;
            cam.center.copy(interpolatedCam.center);
            cam.pivot.copy(interpolatedCam.pivot);
            camera.lookAt(cam.center);
            camera.up.normalize();
            changed(false);
        };
    
    };
    
    /* All coordinates in three.js are right handed
     * when looking at the Front of the Cube in the regular upright position: */
    /**
     * This is the view cube class subset of Autocam
     * this class renders and provides all functionality for the view cube
     * @class
     * @param {string} tagId - html tag id where you want the view cube to render - OBSOLETE
     * @param {Object} autocam - the autocam controller object
     * @param {HTMLDivElement} cubeContainer - the HTML element to contain the view cube
     * @param {string} localizeResourcePath - relative path to localized texture images
     * */
    Autocam.ViewCube = function (tagId, autocam, cubeContainer, localizeResourcePath) {
    
        var self = this;
        var cam = autocam;
        var camera = autocam.camera;
        autocam.setCube(this);
    
        // $("body").prepend("<div id='"+tagId+"' style='position: absolute; z-index: 1000; border: 2px solid red;'></div>");
    
        self.currentFace = "front";
    
        var edgeNames = ["top,front", "top right", "top,left", "top,back", "bottom,front", "bottom,right", "bottom,left", "bottom,back", "left,front", "front,right", "right,back", "back,left"];
        var cornerNames = ["front,top,right", "back,top,right", "front,top,left", "back,top,left", "front,bottom,right", "back,bottom,right", "front,bottom,left", "back,bottom,left"];
    
        /**
          *  A string array which contains the options for the view cube menu. Use null to indicate a section separator
          * @type {Array}
          */
        var menuOptionList = [
            "Go Home",                          // localized by call to drawDropdownMenu
            null,
            "Orthographic",                     // localized by call to drawDropdownMenu
            "Perspective",                      // localized by call to drawDropdownMenu
            "Perspective with Ortho Faces",     // localized by call to drawDropdownMenu
            null,
            "Set current view as Home",         // localized by call to drawDropdownMenu
            "Focus and set as Home",            // localized by call to drawDropdownMenu
            "Reset Home",                       // localized by call to drawDropdownMenu
            null,
            "Set current view as Front",        // localized by call to drawDropdownMenu
            "Set current view as Top",          // localized by call to drawDropdownMenu
            "Reset orientation"                 // localized by call to drawDropdownMenu
            /*
            null,
            "Properties...",
            null,
            "Help..."
            */
        ];
        var menuEnableList = [
            true,
            null,
            true,
            true,
            true,
            null,
            true,
            true,
            true,
            null,
            true,
            true,
            true
            /*
            null,
            "Properties...",
            null,
            "Help..."
            */
        ];
        var menuStateCallbackList = [
            null,
            null,
            function () { return !cam.orthographicFaces && !camera.isPerspective; },
            function () { return !cam.orthographicFaces && camera.isPerspective; },
            function () { return cam.orthographicFaces; },
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
            /*
            null,
            "Properties...",
            null,
            "Help..."
            */
        ];
    
        // THREE.js Scenes
        var shadowScene, cubeScene, gridScene, lineScene, controlScene;
    
        var controlCamera;
        // self.camera = new THREE.PerspectiveCamera( camera.fov, window.innerWidth / window.innerHeight, 1, 10000 );
        self.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
        self.camera.position.copy(camera.position);
        self.center = new THREE.Vector3(0, 0, 0);
        self.camera.lookAt(self.center);
        // var length = camera.position.length();
    
        // THREE.js Meshes
        var cube, line, home, shadow, context;
        var gridMeshes = [];
        var arrowGroup;
    
        // Sizes for Three.js renderers
        var windowHalfX;
        var windowHalfY;
    
        // Buffers and past INTERSECTS used for mouse picking
        var arrowBuffer = [];
        var intersectsFace = [];
        var controlBuffer = [];
        var cubeBuffer = [];
        var INTERSECTED = null;
        var INTERSECTED_F = null;
        var INTERSECTED_C = null;
        var rollLeftOffset, rollRightOffset, rollOffset;
        var homeOffset, menuOffset;
    
        // Size of cube in relation to HTML tag
        var cubeSize = 0;
    
        // Position of HTML element
        var position;
    
        // Used to wait for textures to load before rendering the View Cube
        var loadedTextureCount = 0;
    
        // Flags
        var _orthogonalView = true;
        var _havePointerLockFeature = false;
        var _havePointerLock = false;
        var _pointerLockMoveBugSPK865 = false;
        var _isChrome = (navigator.userAgent.search("Chrome") != -1);
        var _isWindows = (navigator.platform.search("Win32") != -1);
        var _dragged = false;
        var _transparent = false;
    
        // store all loaded textures here so we are not constantly re-downloading them
        var changingTextures = [];
    
        // Height and Width of the renderer
        // may be referred to as self.width and self.height
        this.width = 0;
        this.height = 0;
    
        // Public changeable values
        /**
         * view cube animation speed (not 0 or negative),
         * specified in time (milliseconds) to complete an animation
         * @type {Number}
         */
        this.animSpeed = 500;
        /**
         * turn on and off animation
         * @type {Boolean}
         */
        this.animate = true;
        /**
         * turn on and off ability to drag the view cube
         * @type {Boolean}
         */
    
        this.compass = false;
        this.viewScaleFactorCompass = 1.5;
        this.viewScale = 1; // Set in Init based on cubeSize
    
        this.draggable = true;
    
        /**
         * turn on and off the availability of the home button
         * @type {Boolean}
         */
        this.wantHomeButton = false;
    
        /**
         * turn on and off the availability of the roll arrows
         * @type {Boolean}
         */
        this.wantRollArrows = true;
    
        /**
         * turn on and off the availability of the menu icon
         * @type {Boolean}
         */
        this.wantContextMenu = true;
    
        /**
         * opacity when inactive (transparency must be enabled)
         * @type {Number}
         */
        this.inactiveOpacity = 0.5;
    
        /** Function to get position of html element on screen
         *
         * @param element - HTML DOM element to find position of
         * @return {Object} - object which specifies x and y screen coordinates of location of input element
         */
        var getPosition = function (element) {
            var rect = element.getBoundingClientRect();
            return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    
            /*
            var xPosition = window.pageXOffset;
            var yPosition = window.pageYOffset;
    
            while (element) {
                xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
                yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
                element = element.offsetParent;
            }
            return { x:xPosition, y:yPosition };
            */
        };
    
        /** Used by pointer lock API
         *
         * @param {Object} e - event object
         */
        var pointerLockChange = function (e) {
            e.preventDefault();
            e.stopPropagation();
    
            _havePointerLock = (document.pointerLockElement === cubeContainer ||
                                document.mozPointerLockElement === cubeContainer ||
                                document.webkitPointerLockElement === cubeContainer);
        };
    
    
        /** Create ViewCube and set up renderer and camera
         * sets up all Three.js meshes for the View Cube
         * and initializes all event handlers such as mousemove
         * and mousedown and mouseup and pointerlock
         */
        var Init = function () {
    
            // parentTag = document.getElementById(tagId);
    
            // var element = $('#'+tagId); // ?? Is this different than the above?
            // element.width(300);
            // element.height(300);
    
            var bounds = cubeContainer.getBoundingClientRect();
            self.width = bounds.width;
            self.height = bounds.height;
    
            position = getPosition(cubeContainer);
    
            windowHalfX = self.width / 2;
            windowHalfY = self.height / 2;
    
            //camera for home and arrow
            controlCamera = new THREE.PerspectiveCamera(70, self.height / self.width, 1, 10000);
            controlCamera.position.set(0, 0, 500);
    
            shadowScene = new THREE.Scene();
            cubeScene = new THREE.Scene();
            gridScene = new THREE.Scene();
            lineScene = new THREE.Scene();
            controlScene = new THREE.Scene();
            _orthogonalView = true;
    
            // This size means that the cube is (cubeSize)x(cubeSize)x(cubeSize) big
            cubeSize = 200;
            self.viewScale = cubeSize * 3.5;
    
            /******************************************Create the View Cube***********************************************/
            var filteringType = THREE.LinearFilter;
    
            // Load in the faceMap textures for 6 faces
    
            // var getResourceUrl = getResourceUrl;
            var resRoot = 'res/textures/';
    
            //The face names texture is localized:
            var locTexPath = localizeResourcePath || resRoot;
    
            var texture = new THREE.DDSLoader().load(getResourceUrl(locTexPath + 'VCcrossRGBA8small.dds'));
            texture.minFilter = texture.maxFilter = filteringType;
    
            var shader = THREE.ShaderLib["cube"];
    
            var material = new THREE.ShaderMaterial({
                fragmentShader: shader.fragmentShader,
                vertexShader: shader.vertexShader,
                uniforms: THREE.UniformsUtils.clone(shader.uniforms),
                depthWrite: false
            });
    
            material.uniforms["tCube"].value = texture;
    
            var cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize, 4, 4, 4);
            var cubeLine = new THREE.BoxGeometry(cubeSize + 1, cubeSize + 1, cubeSize + 1, 4, 4, 4);
    
            // Create a cube object mesh with specified geometry and faceMap materials
            cube = new THREE.Mesh(cubeGeometry, material);
            cube.position.set(0.0, 0, 0);
            cubeScene.add(cube);
    
            // Set up a line segment for the cube border
            var borderTexture = loadTexture(getResourceUrl(resRoot + 'VCedge1.png'));
    
            borderTexture.minFilter = borderTexture.maxFilter = filteringType;
    
            line = new THREE.Mesh(cubeLine, new THREE.MeshBasicMaterial({ map: borderTexture, overdraw: false, transparent: true, shading: THREE.SmoothShading }));
            line.position.set(0.0, 0, 0);
            lineScene.add(line);
    
            /********************************************Set up the controls**********************************************/
    
            // Orthogonal Arrows
    
            var arrowDist = cubeSize;
    
            var arrowGeo = new THREE.Geometry();
    
            var v1 = new THREE.Vector3(-30, 0, 0);
            var v2 = new THREE.Vector3(30, 0, 0);
            var v3 = new THREE.Vector3(0, -30, 0);
    
            arrowGeo.vertices.push(v1);
            arrowGeo.vertices.push(v2);
            arrowGeo.vertices.push(v3);
    
            arrowGeo.faces.push(new THREE.Face3(1, 0, 2));
            arrowGeo.computeFaceNormals();
    
            var arrowMaterial1 = new THREE.MeshBasicMaterial({
                overdraw: true, color: 0xDDDDDD,
                transparent: false, opacity: 1, shading: THREE.FlatShading
            });
            var arrowMaterial2 = new THREE.MeshBasicMaterial({
                overdraw: true, color: 0xDDDDDD,
                transparent: false, opacity: 1, shading: THREE.FlatShading
            });
            var arrowMaterial3 = new THREE.MeshBasicMaterial({
                overdraw: true, color: 0xDDDDDD,
                transparent: false, opacity: 1, shading: THREE.FlatShading
            });
            var arrowMaterial4 = new THREE.MeshBasicMaterial({
                overdraw: true, color: 0xDDDDDD,
                transparent: false, opacity: 1, shading: THREE.FlatShading
            });
    
            var arrowSelection = new THREE.PlaneBufferGeometry(cubeSize * 0.5, cubeSize * 0.3, 2, 2);
            var arrowSelectionMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
    
            var upArrow = new THREE.Mesh(arrowGeo, arrowMaterial1);
            var upArrowSelect = new THREE.Mesh(arrowSelection, arrowSelectionMat);
            upArrow.position.set(0, arrowDist, 0.0);
            upArrowSelect.position.set(0, arrowDist * 0.9, 0.1);
    
            var downArrow = new THREE.Mesh(arrowGeo, arrowMaterial2);
            var downArrowSelect = new THREE.Mesh(arrowSelection, arrowSelectionMat);
            downArrow.position.set(0, -arrowDist, 0.0);
            downArrowSelect.position.set(0, -arrowDist * 0.9, 0.1);
            downArrow.rotation.z += Math.PI;
            downArrowSelect.rotation.z += Math.PI;
    
            var rightArrow = new THREE.Mesh(arrowGeo, arrowMaterial3);
            var rightArrowSelect = new THREE.Mesh(arrowSelection, arrowSelectionMat);
            rightArrow.position.set(arrowDist, 0, 0.0);
            rightArrowSelect.position.set(arrowDist * 0.9, 0, 0.1);
            rightArrow.rotation.z -= Math.PI / 2;
            rightArrowSelect.rotation.z -= Math.PI / 2;
    
            var leftArrow = new THREE.Mesh(arrowGeo, arrowMaterial4);
            var leftArrowSelect = new THREE.Mesh(arrowSelection, arrowSelectionMat);
            leftArrow.position.set(-arrowDist, 0, 0.0);
            leftArrowSelect.position.set(-arrowDist * 0.9, 0, 0.1);
            leftArrow.rotation.z += Math.PI / 2;
            leftArrowSelect.rotation.z += Math.PI / 2;
    
            arrowGroup = new THREE.Object3D();
            arrowGroup.position.set(0, 0, 0);
            arrowGroup.add(upArrow);
            arrowGroup.add(downArrow);
            arrowGroup.add(rightArrow);
            arrowGroup.add(leftArrow);
    
            controlScene.add(upArrowSelect);
            controlScene.add(downArrowSelect);
            controlScene.add(rightArrowSelect);
            controlScene.add(leftArrowSelect);
            controlScene.add(arrowGroup);
    
            arrowBuffer.push(upArrowSelect);
            arrowBuffer.push(downArrowSelect);
            arrowBuffer.push(rightArrowSelect);
            arrowBuffer.push(leftArrowSelect);
    
            // Home icon
            var homeGeo = new THREE.PlaneBufferGeometry(cubeSize / 3, cubeSize / 3, 2, 2);
            var homeMaterial = new THREE.MeshBasicMaterial({
                map: loadTexture(getResourceUrl(resRoot + 'VChome.png')),
                transparent: true, shading: THREE.FlatShading
            });
            //homeMaterial.needsUpdate = true;
            home = new THREE.Mesh(homeGeo, homeMaterial);
            home.position.set(-cubeSize, cubeSize, 0);
    
            homeOffset = controlBuffer.length;
            controlScene.add(home);
            controlBuffer.push(home);
    
            // Arrows for rolling
            var rollArrows = new THREE.PlaneBufferGeometry(cubeSize * 1.5, cubeSize * 1.5, 2, 2);
            var rollMaterial = new THREE.MeshBasicMaterial({ map: loadTexture(getResourceUrl(resRoot + 'VCarrows.png')), shading: THREE.FlatShading, transparent: true });
            var roll = new THREE.Mesh(rollArrows, rollMaterial);
            roll.position.set(cubeSize * 0.5 + 20, cubeSize * 0.5 + 20, 0);
    
            var rollSelectionLeft = new THREE.PlaneBufferGeometry(cubeSize * 0.6, cubeSize * 0.45, 2, 2);
            var rollSelectionLeftMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
            var rollLeft = new THREE.Mesh(rollSelectionLeft, rollSelectionLeftMat);
            rollLeft.position.set(cubeSize * 0.5 + 20, cubeSize + 20, 0.1);
    
            var rollSelectionRight = new THREE.PlaneBufferGeometry(cubeSize * 0.45, cubeSize * 0.6, 2, 2);
            var rollSelectionRightMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 });
            var rollRight = new THREE.Mesh(rollSelectionRight, rollSelectionRightMat);
            rollRight.position.set(cubeSize + 20, cubeSize * 0.5 + 20, 0.1);
    
            controlScene.add(roll);
            controlScene.add(rollLeft);
            controlScene.add(rollRight);
    
            rollLeftOffset = controlBuffer.length;
            controlBuffer.push(rollLeft);
            rollRightOffset = controlBuffer.length;
            controlBuffer.push(rollRight);
            rollOffset = controlBuffer.length;
            controlBuffer.push(roll);
    
            //Menu Icon
            var contextGeo = new THREE.PlaneBufferGeometry(cubeSize / 2.3, cubeSize / 2.3, 2, 2);
            var contextMaterial = new THREE.MeshBasicMaterial({
                map: loadTexture(getResourceUrl(resRoot + 'VCcontext.png')),
                transparent: true, shading: THREE.FlatShading
            });
            //homeMaterial.needsUpdate = true;
            context = new THREE.Mesh(contextGeo, contextMaterial);
            context.position.set(cubeSize, -cubeSize, 0);
    
            menuOffset = controlBuffer.length;
            controlScene.add(context);
            controlBuffer.push(context);
    
            // Cube Shadow (Plane)
    
            var shadowGeo = new THREE.Geometry();
    
            shadowGeo.vertices.push(new THREE.Vector3(0, 0, 0));
    
            shadowGeo.vertices.push(new THREE.Vector3(-cubeSize / 2, -cubeSize / 2 - 20, -cubeSize / 2));
            shadowGeo.vertices.push(new THREE.Vector3(cubeSize / 2, -cubeSize / 2 - 20, -cubeSize / 2));
            shadowGeo.vertices.push(new THREE.Vector3(cubeSize / 2, -cubeSize / 2 - 20, cubeSize / 2));
            shadowGeo.vertices.push(new THREE.Vector3(-cubeSize / 2, -cubeSize / 2 - 20, cubeSize / 2));
    
            shadowGeo.faces.push(new THREE.Face3(4, 3, 2));
            shadowGeo.faces.push(new THREE.Face3(4, 2, 1));
    
    
            var shadowMat;
    
            // if(cam.renderer === 'WEBGL') {
            //     var vertexShader = "void main() {gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}";
            //     var fragmentShader = "void main() {gl_FragColor = vec4(0, 0, 0, 0.5);}";
            //     shadowMat = new THREE.ShaderMaterial({vertexShader: vertexShader, fragmentShader: fragmentShader});
            // }else{
            //     shadowMat = new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity: 0.5});
            // }
            shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    
            shadow = new THREE.Mesh(shadowGeo, shadowMat);
            shadowScene.add(shadow);
    
            createCubeGrid();
    
            if (cam.renderer.toUpperCase() === 'CANVAS') {
                self.renderer = new THREE.CanvasRenderer();
    
            } else if (cam.renderer.toUpperCase() === 'WEBGL') {
                self.renderer = new FireflyWebGLRenderer({ alpha: true, antialias: true });
    
            } else {
                Logger.warn("Incorrect use of Autocam.renderer property");
                self.renderer = new THREE.CanvasRenderer();
            }
    
            self.useTransparency(true);
            self.setSize(self.width, self.height);
    
            self.camera.topFov = self.camera.bottomFov = self.camera.fov / 2;
            self.camera.leftFov = self.camera.rightFov = (self.camera.aspect * self.camera.fov) / 2;
    
            // Auto clear needed because of multiple scenes
            self.renderer.autoClear = false;
            self.renderer.setSize(self.width, self.height);
            self.renderer.sortObjects = false;
            cubeContainer.appendChild(self.renderer.domElement);
    
            // Initialize all event handlers
            cubeContainer.addEventListener('touchstart', onDocumentMouseDown, false);
            cubeContainer.addEventListener('mousedown', onDocumentMouseDown, false);
            cubeContainer.addEventListener('mousemove', onDocumentMouseMove, false);
    
            /*
                    _havePointerLockFeature = 'pointerLockElement' in document ||
                                              'mozPointerLockElement' in document ||
                                              'webkitPointerLockElement' in document;
            */
            //Disabling this because it causes an intrusive browser pop-up asking
            //whether I want to allow full screen mode to happen (huh?)
            _havePointerLockFeature = false;
    
            if (_havePointerLockFeature) {
                document.exitPointerLock = document.exitPointerLock ||
                                           document.mozExitPointerLock ||
                                           document.webkitExitPointerLock;
    
                cubeContainer.requestPointerLock = cubeContainer.requestPointerLock ||
                                                   cubeContainer.mozRequestPointerLock ||
                                                   cubeContainer.webkitRequestPointerLock;
    
                // Hook pointer lock state change events
                document.addEventListener('pointerlockchange', pointerLockChange, false);
                document.addEventListener('mozpointerlockchange', pointerLockChange, false);
                document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
            }
    
            // Changing textures (blue highlighting for home and roll arrows)
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VChomeS.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VCarrowsS0.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VCarrowsS1.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VChome.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VCarrows.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VCcontext.png')));
            changingTextures.push(loadTexture(getResourceUrl(resRoot + 'VCcontextS.png')));
        };
    
        /** Used to make cube visible again when using the transparency option   */
        var mouseOverCube = function () {
            if (cam.navApi.isActionEnabled('orbit')) {
                cubeContainer.style.opacity = "1.0";
                _transparent = false;
            }
            requestAnimationFrame(self.render);
        };
    
        /** Used to fade in and out the cube when using the transparency option */
        var mouseMoveOverCube = function (event) {
            if (!_transparent && !cam.viewCubeMenuOpen && cam.navApi.isActionEnabled('orbit')) {
                var x = Math.max(Math.abs((event.clientX - position.x) / position.w - 0.5) * 4.0 - 1.0, 0);
                var y = Math.max(Math.abs((event.clientY - position.y) / position.h - 0.5) * 4.0 - 1.0, 0);
                var d = Math.max(0, Math.min(Math.sqrt(x * x + y * y), 1.0));
                cubeContainer.style.opacity = 1.0 - d * (1.0 - self.inactiveOpacity);
            }
            else if (cam.navApi.isActionEnabled('orbit')) {
                cubeContainer.style.opacity = 1.0;
            }
        };
    
        /** Used to make cube transparent when using the transparency option */
        var mouseOutCube = function () {
            if (cam.viewCubeMenuOpen) {
                return;
            }
            cubeContainer.style.opacity = self.inactiveOpacity;
            _transparent = true;
            requestAnimationFrame(self.render);
        };
    
    
        /** Takes in a image url and outputs a THREE.texture to be used
         * by Three.js materials
         * @param {string} url - path to the image you want to load as a texture
         * @return {THREE.Texture}
         */
        var loadTexture = function (url) {
            var image = new Image();
            var useCredentials = Global.auth && (url.indexOf('://') === -1 || url.indexOf(window.location.host) !== -1);
            if (useCredentials) {
                image.crossOrigin = "use-credentials";
            } else {
                image.crossOrigin = "anonymous";
            }
            var texture = new THREE.Texture(image);
            image.onload = function () {
                texture.needsUpdate = true;
                loadedTextureCount++;
                if (loadedTextureCount >= 11) {
                    // all textures are now loaded
                    requestAnimationFrame(self.render);
                }
            };
    
            image.src = url;
            return texture;
        };
    
        /** Creates the click-able grid around the View Cube
         *  by running functions to create Three.js meshes
         */
        var createCubeGrid = function () {
            var currentGridLength;
            var cubeCorners = [];
            var cubeEdges = [];
    
            cubeCorners[0] = buildCubeCorner(0, 0);
            cubeCorners[1] = buildCubeCorner(0, Math.PI / 2);
            cubeCorners[2] = buildCubeCorner(0, -Math.PI / 2);
            cubeCorners[3] = buildCubeCorner(0, Math.PI);
            cubeCorners[4] = buildCubeCorner(Math.PI / 2, 0);
            cubeCorners[5] = buildCubeCorner(Math.PI / 2, Math.PI / 2);
            cubeCorners[6] = buildCubeCorner(Math.PI / 2, -Math.PI / 2);
            cubeCorners[7] = buildCubeCorner(Math.PI / 2, Math.PI);
    
            cubeEdges[0] = buildCubeEdge(0, 0, 0);
            cubeEdges[1] = buildCubeEdge(0, Math.PI / 2, 0);
            cubeEdges[2] = buildCubeEdge(0, -Math.PI / 2, 0);
            cubeEdges[3] = buildCubeEdge(0, Math.PI, 0);
            cubeEdges[4] = buildCubeEdge(Math.PI / 2, 0, 0);
            cubeEdges[5] = buildCubeEdge(Math.PI / 2, Math.PI / 2, 0);
            cubeEdges[6] = buildCubeEdge(Math.PI / 2, -Math.PI / 2, 0);
            cubeEdges[7] = buildCubeEdge(Math.PI / 2, Math.PI, 0);
            cubeEdges[8] = buildCubeEdge(0, 0, Math.PI / 2);
            cubeEdges[9] = buildCubeEdge(0, 0, -Math.PI / 2);
            cubeEdges[10] = buildCubeEdge(-Math.PI / 2, 0, -Math.PI / 2);
            cubeEdges[11] = buildCubeEdge(-Math.PI, 0, -Math.PI / 2);
    
            // Draw the front square on the grid
            gridMeshes.push(buildCubeFace(0, 0));
            gridMeshes[0].name = 'front';
            intersectsFace.push(gridMeshes[0]);
            cubeBuffer.push(gridMeshes[0]);
            gridScene.add(gridMeshes[0]);
    
            // Draw the right square on the grid
            gridMeshes.push(buildCubeFace(0, Math.PI / 2));
            gridMeshes[1].name = 'right';
            intersectsFace.push(gridMeshes[1]);
            cubeBuffer.push(gridMeshes[1]);
            gridScene.add(gridMeshes[1]);
    
            // Draw the back square on the grid
            gridMeshes.push(buildCubeFace(0, Math.PI));
            gridMeshes[2].name = 'back';
            intersectsFace.push(gridMeshes[2]);
            cubeBuffer.push(gridMeshes[2]);
            gridScene.add(gridMeshes[2]);
    
            // Draw the left grid
            gridMeshes.push(buildCubeFace(0, -Math.PI / 2));
            gridMeshes[3].name = 'left';
            intersectsFace.push(gridMeshes[3]);
            cubeBuffer.push(gridMeshes[3]);
            gridScene.add(gridMeshes[3]);
    
            // Draw the bottom grid
            gridMeshes.push(buildCubeFace(Math.PI / 2, 0));
            gridMeshes[4].name = 'bottom';
            intersectsFace.push(gridMeshes[4]);
            cubeBuffer.push(gridMeshes[4]);
            gridScene.add(gridMeshes[4]);
    
            // Draw the top grid
            gridMeshes.push(buildCubeFace(-Math.PI / 2, 0));
            gridMeshes[5].name = 'top';
            intersectsFace.push(gridMeshes[5]);
            cubeBuffer.push(gridMeshes[5]);
            gridScene.add(gridMeshes[5]);
    
            currentGridLength = gridMeshes.length;
    
            var i;
            for (i = 0; i < cubeCorners.length; i++) {
                gridMeshes.push(cubeCorners[i]);
                gridMeshes[currentGridLength + i].name = cornerNames[i];
                gridScene.add(gridMeshes[currentGridLength + i]);
                intersectsFace.push(gridMeshes[currentGridLength + i]);
                cubeBuffer.push(gridMeshes[currentGridLength + i]);
            }
    
            currentGridLength = gridMeshes.length;
    
            for (i = 0; i < cubeEdges.length; i++) {
                gridMeshes.push(cubeEdges[i]);
                gridMeshes[currentGridLength + i].name = edgeNames[i];
                gridScene.add(gridMeshes[currentGridLength + i]);
                intersectsFace.push(gridMeshes[currentGridLength + i]);
                cubeBuffer.push(gridMeshes[currentGridLength + i]);
            }
        };
    
    
        /**
         * Get intersections between a mesh and mouse position (mouse picking)
         * @param {THREE.Vector3} pickingVector - direction vector to find intersections
         * @param {THREE.Camera} camera
         * @param {THREE.Mesh[]} intersectionBuffer - an array of three.js meshes to check for intersections with these specific meshes
         * @return {Object[]} - objects which were intersected
         */
        var findPickingIntersects = function (pickingVector, camera, intersectionBuffer) {
            var raycaster;
            var intersects;
    
            var direction = new THREE.Vector3();
            direction.copy(pickingVector);
    
            direction = direction.unproject(camera);
            raycaster = new THREE.Raycaster(camera.position, direction.sub(camera.position).normalize());
    
            intersects = raycaster.intersectObjects(intersectionBuffer);
    
            return intersects;
    
        };
    
        var getPickVector = function (event, position) {
            var x = event.clientX - position.x;
            var y = event.clientY - position.y;
    
            x = (x / position.w * 2.0) - 1.0;
            y = ((position.h - y) / position.h * 2.0) - 1.0;
    
            return new THREE.Vector3(x, y, 0.5);
        };
    
        function isFullscreen() {
            return document.fullscreenElement ||
                   document.webkitFullscreenElement ||
                   document.mozFullScreenElement ||
                   document.msFullscreenElement;
        }
    
        function getEventCoords(event, self) {
            var coords = {}
    
            if (event.type.indexOf("touch") === 0) {
                if (event.touches.length > 0) {
                    coords.clientX = event.touches[0].clientX;
                    coords.clientY = event.touches[0].clientY;
                    coords.pageX = event.touches[0].pageX;
                    coords.pageY = event.touches[0].pageY;
                    coords.screenX = event.touches[0].screenX;
                    coords.screenY = event.touches[0].screenY;
                    coords.movementX = coords.screenX - self.prevX;
                    coords.movementY = coords.screenY - self.prevY;
                    coords.which = cam.navApi.getUseLeftHandedInput() ? 3 : 1;
                }
                else {
                    coords = self.prevCoords;
                }
            }
            else {
                coords.clientX = event.clientX;
                coords.clientY = event.clientY;
                coords.pageX = event.pageX;
                coords.pageY = event.pageY;
                coords.screenX = event.screenX;
                coords.screenY = event.screenY;
                coords.which = event.which;
    
                if (_havePointerLockFeature) {
                    coords.movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                    coords.movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
                }
                else {
                    coords.movementX = coords.screenX - self.prevX;
                    coords.movementY = coords.screenY - self.prevY;
                }
            }
            self.prevX = coords.screenX;
            self.prevY = coords.screenY;
            self.prevCoords = coords;
    
            return coords;
        }
    
        /** All functionality regarding cube clicks starts here
         *
         * @param {Object} event - event when mouse down occurs
         */
        var onDocumentMouseDown = function (event) {
            event.preventDefault();
            event.stopPropagation();
    
            if (!cam.navApi.isActionEnabled('orbit'))
                return;
    
            if (cam.currentlyAnimating) { return; }
    
            var coords = getEventCoords(event, self);
    
            // Make sure our position is up to date...
            position = getPosition(cubeContainer);
    
            cubeContainer.removeEventListener('mousemove', onDocumentMouseMove, false);
            document.addEventListener('mouseup', onDocumentMouseUp, false);
            document.addEventListener('touchend', onDocumentMouseUp, false);
            // Not needed: document.addEventListener('mousemove', onDocumentMouseMove, false);
    
            if (!cam.navApi.getUsePivotAlways()) {
                // If the usePivot option is not on, we pivot around the center of the view:
                cam.pivot.copy(cam.center);
                cam.navApi.setPivotPoint(cam.center);
                // This also clears the pivot set flag:
                cam.navApi.setPivotSetFlag(false);
            }
    
            cam.startInteraction(coords.pageX, coords.pageY);
    
            // Since this mouse down is for dragging the cube we should not be able do this if the cube is animating already
            var intersectsWithCube;
            var pickingVector;
    
            //If cube is first thing clicked, add the current shot to rewind history
            if (cam.rewindParams.history.length == 0) cam.addHistoryElement();
    
            //If clicking cube from anywhere other then end of timeline update history accordingly
            if (!cam.rewindParams.snapped || cam.rewindParams.timelineIndex + 1 != cam.rewindParams.history.length) cam.addIntermediateHistoryElement();
    
            var rightMouse = cam.navApi.getUseLeftHandedInput() ? 1 : 3;
            if (coords.which === rightMouse) // Right mouse click, handled on mouse up
                return;
    
            if (self.animSpeed <= 0) {
                Logger.error("animSpeed cannot be 0 or less, use ViewCube.animate flag to turn on and off animation");
                return;
            }
    
            // get mouse picking intersections
            pickingVector = getPickVector(coords, position);
            intersectsWithCube = findPickingIntersects(pickingVector, self.camera, cubeBuffer);
    
    
            if (intersectsWithCube.length > 0) {
    
                hideArrows();
                if (self.draggable) {
                    document.addEventListener('mousemove', onDocumentMouseMoveCube, false);
                    document.addEventListener('touchmove', onDocumentMouseMoveCube, false);
    
                    // Check if browser has pointer lock support
                    if (_havePointerLockFeature) {
                        // Ask the browser to lock the pointer
                        cubeContainer.requestPointerLock();
                        _pointerLockMoveBugSPK865 = (_isChrome && _isWindows);
                    }
                }
            }
        };
    
        /** Used for dragging the cube,
         * @param {Object} event - event when mouse move occurs (contains information about pointer position)
         */
        var onDocumentMouseMoveCube = function (event) {
    
            event.preventDefault();
            event.stopPropagation();
    
            // This is an error if user puts in self.animSpeed = 0 or less
            if (self.animSpeed <= 0) {
                document.removeEventListener("mousemove", onDocumentMouseMoveCube, false);
                document.removeEventListener("touchmove", onDocumentMouseMoveCube, false);
                Logger.error("animSpeed cannot be 0 or less");
                return;
            }
    
            if (cam.currentlyAnimating) {
                return;
            }
            var coords = getEventCoords(event, self);
    
            if (_havePointerLockFeature) {
                // We skip the first movement event after requesting pointer lock
                // because Chrome on Windows sends out a bogus motion value.
                if (_pointerLockMoveBugSPK865) {
                    _pointerLockMoveBugSPK865 = false;
                    coords.movementX = coords.movementY = 0;
                }
            }
    
            if (_havePointerLock) {
    
                // Ignore erroneous data sent from pointer lock
                // not sure why erroneous data gets received
                // could be bug in pointer lock
                if (coords.movementX > 300 || coords.movementY > 300) {
                    coords.movementX = 0;
                    coords.movementY = 0;
                }
            }
    
            // If the mouse hasn't moved ignore this current movement (not sure why the mouse move event gets called)
            // Also used for ignoring erroneous data
            if (coords.movementX === coords.movementY && coords.movementX === 0) {
                cam.currentlyAnimating = false;
                return;
            }
            _orthogonalView = false;
            _dragged = true;
            cam.showPivot(true);
            cam.currentCursor = new THREE.Vector2(coords.pageX, coords.pageY);
            cam.orbit(cam.currentCursor, cam.startCursor, new THREE.Vector3(-coords.movementX, coords.movementY, 0), cam.startState);
    
            self.camera.lookAt(self.center);
    
            requestAnimationFrame(self.render);
        };
    
    
        var endMouseUp = function (stillNeedUp) {
            if (!stillNeedUp) {
                document.removeEventListener('mouseup', onDocumentMouseUp, false);
                document.removeEventListener('touchend', onDocumentMouseUp, false);
            }
    
            document.removeEventListener('mousemove', onDocumentMouseMoveCube, false);
            document.removeEventListener('touchmove', onDocumentMouseMoveCube, false);
            cubeContainer.addEventListener('mousemove', onDocumentMouseMove, false);
    
            if (_havePointerLock) {
                document.exitPointerLock();
            }
    
        };
    
        /** Rotates the cube when a division of the cube grid is clicked,
         * also provides functionality for home button interaction, orthogonal arrows interaction,
         * and roll arrows interaction
         * @param {Object} event - event contains information about mouse position which is used in this function
         */
        var onDocumentMouseUp = function (event) {
            event.preventDefault();
            event.stopPropagation();
    
            var cubeIntersects;
            var arrowIntersects;
            var controlIntersects;
    
            if (cam.currentlyAnimating || _dragged) {
                cam.endInteraction();
                cam.showPivot(false);
                _dragged = false;
    
                endMouseUp(false);
                return;
            }
            var coords = getEventCoords(event, self);
    
            if (cam.viewCubeMenuOpen) {
                var x = coords.clientX - position.x;
                var y = coords.clientY - position.y;
    
                //if clicked on the menu
                if ((cam.menuOrigin.x <= x) && (x <= (cam.menuOrigin.x + cam.menuSize.x)) &&
                    (cam.menuOrigin.y <= y) && (y <= (cam.menuOrigin.y + cam.menuSize.y))) {
    
                    // HACK!!
                    // TODO: make this a bit more robust. It doesn't take the menu separators
                    // into account and makes a gross assumption about the menu entry size.
                    var menuItemNumber = Math.floor(((y - 5) - cam.menuOrigin.y) / 25);
    
                    var log = function (action) {
                        Logger.track({ name: 'navigation/' + action, aggregate: 'count' });
                    };
    
                    switch (menuItemNumber) {
                        case 0:                 //home
                            log('home');
                            cam.goHome();
                            break;
                        case 1:                 //orthographic
                            log('setortho');
                            cam.setOrthographicFaces(false);
                            cam.toOrthographic();
                            break;
                        case 2:                 //perspective
                            log('setpersp');
                            cam.setOrthographicFaces(false);
                            cam.toPerspective();
                            break;
                        case 3:                 //perspective with ortho faces
                            cam.setOrthographicFaces(true);
                            if (_orthogonalView)
                                cam.toOrthographic();
                            else
                                cam.toPerspective();
                            break;
                        case 4:                 //set current view as home
                            log('sethome');
                            cam.setCurrentViewAsHome(false);
                            break;
                        case 5:                 //focus and set current view as home
                            log('focushome');
                            cam.setCurrentViewAsHome(true);
                            break;
                        case 6:                 //reset home
                            log('resethome');
                            cam.resetHome();
                            break;
                        case 7:                 //set current view as front
                            log('setfront');
                            cam.setCurrentViewAsFront();
                            break;
                        case 8:                 //set current view as top
                            log('settop');
                            cam.setCurrentViewAsTop();
                            break;
                        case 9:                 //reset orientation
                            cam.resetOrientation();
                            break;
                    }
                }
    
                cam.viewCubeMenuOpen = false;
                cam.removeDropdownMenu(cubeContainer);
    
                //if clicked off the cube canvas
                if (coords.clientX < position.x || coords.clientX > (position.w + position.x)
                 || coords.clientY < position.y || coords.clientY > (position.h + position.y)) {
                    mouseOutCube();
                }
    
                // In case something needs a highlight change:
                if (self.mouseMoveSave)
                    self.processMouseMove(self.mouseMoveSave);
    
                endMouseUp(false);
                return;
            }
            var rightMouse = cam.navApi.getUseLeftHandedInput() ? 1 : 3;
            if (coords.which === rightMouse) {
                cam.viewCubeMenuOpen = true;
                cam.drawDropdownMenu(menuOptionList, menuEnableList, menuStateCallbackList, coords.clientX, coords.clientY, cubeContainer, position);
                endMouseUp(true);
                return;
            }
            var pickingVector = getPickVector(coords, position);
            cubeIntersects = findPickingIntersects(pickingVector, self.camera, cubeBuffer);
            arrowIntersects = findPickingIntersects(pickingVector, controlCamera, arrowBuffer);
            controlIntersects = findPickingIntersects(pickingVector, controlCamera, controlBuffer);
    
            // Apply logic for clicking on arrows
            if (arrowIntersects.length > 0 && _orthogonalView) {
                var orientation = cam.getOrientation();
    
                switch (self.currentFace) {
                    case "front":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                }
                                break;
                        }
                        break;
    
                    case "right":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                }
                                break;
                        }
                        break;
    
                    case "left":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                }
                                break;
                        }
                        break;
    
                    case "back":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("top");
                                    self.currentFace = "top";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("bottom");
                                    self.currentFace = "bottom";
                                }
                                break;
                        }
                        break;
    
                    case "top":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                }
                                break;
                        }
                        break;
    
                    case "bottom":
                        switch (orientation) {
                            case "up":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                }
                                break;
                            case "right":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                }
                                break;
                            case "down":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                }
                                break;
                            case "left":
                                if (arrowIntersects[0].object === arrowBuffer[0]) {
                                    cam.calculateCubeTransform("left");
                                    self.currentFace = "left";
                                } else if (arrowIntersects[0].object === arrowBuffer[1]) {
                                    cam.calculateCubeTransform("right");
                                    self.currentFace = "right";
                                } else if (arrowIntersects[0].object === arrowBuffer[2]) {
                                    cam.calculateCubeTransform("front");
                                    self.currentFace = "front";
                                } else if (arrowIntersects[0].object === arrowBuffer[3]) {
                                    cam.calculateCubeTransform("back");
                                    self.currentFace = "back";
                                }
                                break;
                        }
                        break;
                }
                cam.elapsedTime = 0;
                cam.sphericallyInterpolateTransition();
            }
    
            if (controlIntersects.length > 0) {
                cam.elapsedTime = 0;
    
                if (self.wantHomeButton && controlIntersects[0].object === controlBuffer[homeOffset]) {
                    cam.goHome();
                    endMouseUp(false);
                    return;
                }
                if (self.wantContextMenu && controlIntersects[0].object === controlBuffer[menuOffset]) {
                    cam.viewCubeMenuOpen = true;
                    cam.drawDropdownMenu(menuOptionList, menuEnableList, menuStateCallbackList, coords.clientX, coords.clientY, cubeContainer, position);
                    endMouseUp(true);
                    return;
                }
                if (self.wantRollArrows && _orthogonalView && (controlIntersects[0].object === controlBuffer[rollLeftOffset] || controlIntersects[0].object === controlBuffer[rollRightOffset])) {
                    //TODO: when panning, dir changes -> position
                    var clockwise = (controlIntersects[0].object === controlBuffer[rollRightOffset]);
                    var destination = {
                        center: cam.center.clone(),
                        position: camera.position.clone(),
                        pivot: camera.pivot.clone(),
                        fov: camera.fov,
                        worldUp: cam.sceneUpDirection.clone(),
                        isOrtho: (camera.isPerspective === false)
                    };
                    var dir = cam.center.clone().sub(camera.position).normalize();
    
                    if (clockwise) {
                        destination.up = camera.up.clone().cross(dir);
                    } else {
                        destination.up = camera.up.clone().multiplyScalar(-1);
                        destination.up.cross(dir);
                    }
                    destination.up.normalize();
    
                    cam.elapsedTime = 0.0;
                    cam.animateTransition(destination)
                }
            }
            if (cubeIntersects.length > 0) {
                var face = cubeIntersects[0].object.name;
                self.mouseMoveSave = event;
                self.cubeRotateTo(face);
            }
            endMouseUp(false);
        };
    
        this.cubeRotateTo = function (face) {
            self.currentFace = face;
    
            // If ortho faces is on and the target is not another face,
            // switch to perspective mode:
            if (cam.orthographicFaces && (self.currentFace.indexOf(',') !== -1)) {
                cam.setCameraOrtho(false);
            }
            cam.calculateCubeTransform(self.currentFace);
    
            cam.elapsedTime = 0;
    
            // After interpolating to the new target we may have to simulate
            // a mouse move event at the final location so that the appropriate
            // part of the cube is highlighted:
            cam.sphericallyInterpolateTransition(function () {
                if (self.mouseMoveSave)
                    self.processMouseMove(self.mouseMoveSave);
            });
        };
    
        /** Used to highlight cube grid divisions/arrows/home
         * @param {Object} event - event contains information about mouse position which is used in this function
         */
        this.processMouseMove = function (event) {
            var intersectsFaces;
            var arrowIntersects;
            var controlIntersects;
    
            if (cam.viewCubeMenuOpen || cam.currentlyAnimating) {
                self.mouseMoveSave = event;
                return;
            }
            self.mouseMoveSave = null;
    
            var coords = getEventCoords(event, self);
    
            var pickingVector = getPickVector(coords, position);
    
            intersectsFaces = findPickingIntersects(pickingVector, self.camera, intersectsFace);
            arrowIntersects = findPickingIntersects(pickingVector, controlCamera, arrowBuffer);
            controlIntersects = findPickingIntersects(pickingVector, controlCamera, controlBuffer);
    
            /**********Highlight arrows when hovered over************/
    
            if (INTERSECTED && !_dragged) {
                INTERSECTED.material.color.setHex(0xDDDDDD);
                INTERSECTED = null;
                requestAnimationFrame(self.render);
            }
    
            if (arrowIntersects.length > 0 && !_dragged) {
                INTERSECTED = arrowIntersects[0].object;
                for (var i = arrowGroup.children.length; --i >= 0;) {
                    if (INTERSECTED === arrowBuffer[i]) {
                        INTERSECTED = arrowGroup.children[i];
                        INTERSECTED.material.color.setHex(0x00afff);
                        break;
                    }
                }
                requestAnimationFrame(self.render);
            }
    
            /**************Highlight faces on cube******************/
    
            if (INTERSECTED_F && !_dragged) {
                // Make the previously selected face opacity: 0.0
                INTERSECTED_F.material.opacity = 0.0;
                INTERSECTED_F = null;
                requestAnimationFrame(self.render);
            }
    
            if (intersectsFaces.length > 0 && !_dragged) {
                // Make the currently selected face opacity: 0.3
                INTERSECTED_F = intersectsFaces[0].object;
                INTERSECTED_F.material.opacity = 0.3;
                requestAnimationFrame(self.render);
            }
    
            if (controlIntersects.length > 0 && !_dragged) {
                if (INTERSECTED_C !== controlIntersects[0].object) {
                    // home mouse over
                    if (self.wantHomeButton && controlIntersects[0].object === controlBuffer[homeOffset]) {
                        INTERSECTED_C = controlIntersects[0].object;
                        controlBuffer[homeOffset].material.map = changingTextures[0];
                    }
    
                        // Left roll arrow mouse over
                    else if (self.wantRollArrows && controlIntersects[0].object === controlBuffer[rollLeftOffset]) {
                        INTERSECTED_C = controlIntersects[0].object;
                        controlBuffer[rollOffset].material.map = changingTextures[1];
                    }
    
                        // Right roll arrow mouse over
                    else if (self.wantRollArrows && controlIntersects[0].object === controlBuffer[rollRightOffset]) {
                        INTERSECTED_C = controlIntersects[0].object;
                        controlBuffer[rollOffset].material.map = changingTextures[2];
                    }
    
                        // Menu Icon
                    else if (self.wantContextMenu && controlIntersects[0].object === controlBuffer[menuOffset]) {
                        INTERSECTED_C = controlIntersects[0].object;
                        controlBuffer[menuOffset].material.map = changingTextures[6];
                    }
    
                    else {
                        // home mouse over
                        if (self.wantHomeButton && INTERSECTED_C === controlBuffer[homeOffset]) {
                            INTERSECTED_C = null;
                            controlBuffer[homeOffset].material.map = changingTextures[3];
                        }
    
                            // Left roll and Right roll arrow
                        else if (self.wantRollArrows && (INTERSECTED_C === controlBuffer[rollLeftOffset] ||
                            INTERSECTED_C === controlBuffer[rollRightOffset] || INTERSECTED_C === controlBuffer[rollOffset])) {
                            INTERSECTED_C = null;
                            controlBuffer[rollOffset].material.map = changingTextures[4];
                        }
    
                            // menu icon
                        else if (self.wantContextMenu && INTERSECTED_C === controlBuffer[menuOffset]) {
                            INTERSECTED_C = null;
                            controlBuffer[menuOffset].material.map = changingTextures[5];
                        }
                    }
                    requestAnimationFrame(self.render);
                }
            } else if (INTERSECTED_C !== null && !_dragged) {
                // home mouse over
                if (self.wantHomeButton && INTERSECTED_C === controlBuffer[homeOffset]) {
                    INTERSECTED_C = null;
                    controlBuffer[homeOffset].material.map = changingTextures[3];
                }
    
                    // Left roll and Right roll arrow
                else if (self.wantRollArrows && (INTERSECTED_C === controlBuffer[rollLeftOffset] ||
                    INTERSECTED_C === controlBuffer[rollRightOffset] || INTERSECTED_C === controlBuffer[rollOffset])) {
                    INTERSECTED_C = null;
                    controlBuffer[rollOffset].material.map = changingTextures[4];
                }
    
                    // menu icon
                else if (self.wantContextMenu && INTERSECTED_C === controlBuffer[menuOffset]) {
                    INTERSECTED_C = null;
                    controlBuffer[menuOffset].material.map = changingTextures[5];
                }
    
                requestAnimationFrame(self.render);
            }
        };
    
        var onDocumentMouseMove = function (event) {
            if (cam.navApi.isActionEnabled('orbit'))
                self.processMouseMove(event);
        };
    
        /** Refreshes values so that renderer is correct size (in pixels) **/
        var onWindowResize = function () {
            position = getPosition(cubeContainer);
    
            // cubeContainer.style.width = self.width.toString() + "px";
            // cubeContainer.style.height = "inherit";
    
            self.width = cubeContainer.offsetWidth;
            self.height = cubeContainer.offsetHeight;
    
            windowHalfX = self.width / 2;
            windowHalfY = self.height / 2;
    
            self.camera.aspect = self.width / self.height;
            self.camera.updateProjectionMatrix();
    
            // PHB added. See Autocam.js windowResize
            self.camera.topFov = self.camera.bottomFov = self.camera.fov / 2;
            self.camera.leftFov = self.camera.rightFov = (self.camera.aspect * self.camera.fov) / 2;
    
            self.renderer.setSize(self.width, self.height);
            requestAnimationFrame(self.render);
        };
    
        /** Builds one square mesh of the grid (located on each face of the cube)
         *
         * @param {Number} rotationX - rotate shape by this amount in X
         * @param {Number} rotationY - rotate shape by this amount in Y
         * @return {THREE.Mesh} - mesh of the cube face (square part) rotated by params
         */
        var buildCubeFace = function (rotationX, rotationY) {
    
            // These sizes may be changed if cube size is changed
            var material;
            var edge = 45;
            var square = 60;
            var masterCubeSize = edge + square;
    
            var geo = new THREE.Geometry();
    
            // Center of the cube
            var v0 = new THREE.Vector3(0, 0, 0);
    
            /******************FRONT OF CUBE********************/
            var v1 = new THREE.Vector3(square, -square, masterCubeSize);
            var v2 = new THREE.Vector3(square, square, masterCubeSize);
            var v3 = new THREE.Vector3(-square, square, masterCubeSize);
            var v4 = new THREE.Vector3(-square, -square, masterCubeSize);
    
            geo.vertices.push(v0);
    
            geo.vertices.push(v1);
            geo.vertices.push(v2);
            geo.vertices.push(v3);
            geo.vertices.push(v4);
    
            /******************FRONT FACE********************/
    
            // Front square
            geo.faces.push(new THREE.Face3(1, 2, 3));
            geo.faces.push(new THREE.Face3(1, 3, 4));
    
    
            // Apply matrix rotations for sides which are not the front
            geo.applyMatrix(new THREE.Matrix4().makeRotationX(rotationX));
            geo.applyMatrix(new THREE.Matrix4().makeRotationY(rotationY));
    
            geo.computeFaceNormals();
            geo.computeVertexNormals();
    
            material = new THREE.MeshBasicMaterial({ overdraw: true, opacity: 0.0, color: 0x00afff, transparent: true });
            return new THREE.Mesh(geo, material);
        };
    
        /** Builds one edge mesh of the grid
         *
         * @param rotationX - rotate shape by this amount X
         * @param rotationY - rotate shape by this amount Y
         * @param rotationZ - rotate shape by this amount Z
         * @return {THREE.Mesh} - mesh of the cube edge rotated by params
         */
        var buildCubeEdge = function (rotationX, rotationY, rotationZ) {
            var material;
            var edge = 45;
            var square = 60;
            var masterCubeSize = edge + square;
            var meshReturn;
    
            var geo = new THREE.Geometry();
    
            var e0 = new THREE.Vector3(square, masterCubeSize, masterCubeSize);
            var e1 = new THREE.Vector3(-square, masterCubeSize, masterCubeSize);
            var e2 = new THREE.Vector3(-square, square, masterCubeSize);
            var e3 = new THREE.Vector3(square, square, masterCubeSize);
    
            var e4 = new THREE.Vector3(square, masterCubeSize, square);
            var e5 = new THREE.Vector3(-square, masterCubeSize, square);
            var e6 = new THREE.Vector3(-square, masterCubeSize, masterCubeSize);
            var e7 = new THREE.Vector3(square, masterCubeSize, masterCubeSize);
    
            geo.vertices.push(e0);
            geo.vertices.push(e1);
            geo.vertices.push(e2);
            geo.vertices.push(e3);
    
            geo.vertices.push(e4);
            geo.vertices.push(e5);
            geo.vertices.push(e6);
            geo.vertices.push(e7);
    
            geo.faces.push(new THREE.Face3(0, 1, 2));
            geo.faces.push(new THREE.Face3(0, 2, 3));
    
            geo.faces.push(new THREE.Face3(4, 5, 6));
            geo.faces.push(new THREE.Face3(4, 6, 7));
    
    
            geo.applyMatrix(new THREE.Matrix4().makeRotationX(rotationX));
            geo.applyMatrix(new THREE.Matrix4().makeRotationY(rotationY));
            geo.applyMatrix(new THREE.Matrix4().makeRotationZ(rotationZ));
    
            geo.computeFaceNormals();
            geo.computeVertexNormals();
    
            material = new THREE.MeshBasicMaterial({ overdraw: true, opacity: 0.0, color: 0x00afff, transparent: true });
            meshReturn = new THREE.Mesh(geo, material);
            return meshReturn;
        };
    
        /** Builds one corner mesh of the grid
         *
         * @param {Number} rotationX - rotate shape by this amount in X
         * @param {Number} rotationY - rotate shape by this amount in Y
         * @return {THREE.Mesh} - the cube corner mesh rotated by params
         */
        var buildCubeCorner = function (rotationX, rotationY) {
            var material;
            var edge = 45;
            var square = 60;
            var masterCubeSize = edge + square;
            var meshReturn;
    
            var geo = new THREE.Geometry();
    
            var c0 = new THREE.Vector3(masterCubeSize, masterCubeSize, masterCubeSize);
            var c1 = new THREE.Vector3(square, masterCubeSize, masterCubeSize);
            var c2 = new THREE.Vector3(square, square, masterCubeSize);
            var c3 = new THREE.Vector3(masterCubeSize, square, masterCubeSize);
    
            var c4 = new THREE.Vector3(masterCubeSize, masterCubeSize, square);
            var c5 = new THREE.Vector3(masterCubeSize, masterCubeSize, masterCubeSize);
            var c6 = new THREE.Vector3(masterCubeSize, square, masterCubeSize);
            var c7 = new THREE.Vector3(masterCubeSize, square, square);
    
            var c8 = new THREE.Vector3(masterCubeSize, masterCubeSize, masterCubeSize);
            var c9 = new THREE.Vector3(masterCubeSize, masterCubeSize, square);
            var c10 = new THREE.Vector3(square, masterCubeSize, square);
            var c11 = new THREE.Vector3(square, masterCubeSize, masterCubeSize);
    
            geo.vertices.push(c0);
            geo.vertices.push(c1);
            geo.vertices.push(c2);
            geo.vertices.push(c3);
    
            geo.vertices.push(c4);
            geo.vertices.push(c5);
            geo.vertices.push(c6);
            geo.vertices.push(c7);
    
            geo.vertices.push(c8);
            geo.vertices.push(c9);
            geo.vertices.push(c10);
            geo.vertices.push(c11);
    
            geo.faces.push(new THREE.Face3(0, 1, 2));
            geo.faces.push(new THREE.Face3(0, 2, 3));
    
            geo.faces.push(new THREE.Face3(4, 5, 6));
            geo.faces.push(new THREE.Face3(4, 6, 7));
    
            geo.faces.push(new THREE.Face3(8, 9, 10));
            geo.faces.push(new THREE.Face3(8, 10, 11));
    
    
            geo.applyMatrix(new THREE.Matrix4().makeRotationX(rotationX));
            geo.applyMatrix(new THREE.Matrix4().makeRotationY(rotationY));
    
            geo.computeFaceNormals();
            geo.computeVertexNormals();
    
            material = new THREE.MeshBasicMaterial({ overdraw: true, opacity: 0.0, color: 0x00afff, transparent: true });
            meshReturn = new THREE.Mesh(geo, material);
            return meshReturn;
        };
    
        var changeBasisWorldToStandard = function (V) {
            var worldD = cam.cubeFront.clone();
            var worldU = cam.sceneUpDirection.clone();
            var worldR = worldD.clone().cross(worldU);
            worldU.copy(worldR).cross(worldD);
    
            worldD.normalize();
            worldU.normalize();
            worldR.normalize();
    
            var answer = new THREE.Vector3(worldD.x, worldU.x, worldR.x).multiplyScalar(V.x);
            answer.add(new THREE.Vector3(worldD.y, worldU.y, worldR.y).multiplyScalar(V.y));
            answer.add(new THREE.Vector3(worldD.z, worldU.z, worldR.z).multiplyScalar(V.z));
    
            return answer;
        };
    
        /** Render the View Cube scenes and perform checks for control visibility **/
        this.render = function () {
            var scale = self.compass ? self.viewScaleFactorCompass * self.viewScale : self.viewScale;
            var viewDir = cam.center.clone().sub(camera.position).normalize();
            var upDir = camera.up.normalize();
    
            viewDir = changeBasisWorldToStandard(viewDir);
            upDir = changeBasisWorldToStandard(upDir);
    
            self.camera.position.copy(viewDir);
            self.camera.position.multiplyScalar(-scale / self.camera.position.length());
            self.camera.up = upDir.normalize();
            self.camera.lookAt(self.center);
    
            checkControlVisibility();
    
            var renderer = self.renderer;
            if (renderer) {
                renderer.clear();
                // There are 3 scenes: the first is the shadow, then the cube with textures, then the grid is on top
                renderer.render(shadowScene, self.camera);
                renderer.render(cubeScene, self.camera);
                renderer.render(lineScene, self.camera);
                renderer.render(gridScene, self.camera);
                // Different camera since these shouldn't move with the View Cube
                renderer.render(controlScene, controlCamera);
            }
        };
    
        /**
         * checks whether arrows (orthogonal and roll), drop down menus, and home button should be visible or not at
         * this current time
         */
        var checkControlVisibility = function () {
            // Arrow Visibility
    
            _orthogonalView = cam.isFaceView();
    
            (_orthogonalView && !_transparent && !cam.currentlyAnimating) ? showArrows() : hideArrows();
    
            // Menu Visibility
            _transparent ? hideContext() : showContext();
    
            // Home Visibility
            _transparent ? hideHome() : showHome();
        };
    
        /** Hide View Cube Arrows **/
        var hideArrows = function () {
            controlScene.remove(arrowGroup);
    
            controlBuffer[rollOffset].material.opacity = 0.0;
            controlBuffer[menuOffset].material.opacity = 0.0;
        };
    
        /** Show View Cube Arrows **/
        var showArrows = function () {
            controlScene.add(arrowGroup);
    
            var opacity = self.wantRollArrows ? 1.0 : 0.0;
            controlBuffer[rollOffset].material.opacity = opacity;
            controlBuffer[menuOffset].material.opacity = opacity;
        };
    
        /** Hide the view cube menu button **/
        var hideContext = function () {
            context.material.opacity = (DeviceType.isMobileDevice) ? 1.0 : 0.0;
        };
    
        /** Show the view cube menu button **/
        var showContext = function () {
            context.material.opacity = self.wantContextMenu ? 1.0 : 0.0;
        };
    
        /** Hide the home button **/
        var hideHome = function () {
            home.material.opacity = 0.0;
        };
    
        /** Show the home button **/
        var showHome = function () {
            home.material.opacity = self.wantHomeButton ? 1.0 : 0.0;
        };
    
        /* Public Methods */
        /** Update the View Cube camera to a new camera view
         * @public
         * @this ViewCube
         * @param {int[]} eye - client provided camera position (in their world coordinates)
         * @param {int[]} centre - client provided pivot point or centre (where the camera is looking at in their world coordinates)
         * @param {int[]} upVector - client provided up vector
         */
    
        /** Refresh height and width renderer sizes
         * @public
         * @this ViewCube
         */
        this.refreshCube = function () {
            onWindowResize();
        };
    
        /** Set the size of the View Cube
         * @public
         * @this ViewCube
         * @param {int} width - in pixels
         * @param {int} height - in pixels
         */
        this.setSize = function (width, height) {
            self.width = width;
            self.height = height;
    
            if (cubeContainer.children.length > 1) {
                for (var i = 1; i < cubeContainer.children.length; i++)
                    cubeContainer.children[i].style.bottom = (self.height / 5).toString() + "px";
            }
    
            onWindowResize();
        };
    
        /** Option to turn on and off transparency on mouse out for the view cube
         * @public
         * @this ViewCube
         * @param {boolean} transparent - true to use transparency, false to turn it off
         */
        this.useTransparency = function (transparent) {
            _transparent = transparent;
            if (transparent) {
                cubeContainer.onmouseover = mouseOverCube;
                cubeContainer.onmousemove = mouseMoveOverCube;
                cubeContainer.onmouseout = mouseOutCube;
                mouseOutCube();
            }
            else {
                cubeContainer.onmouseover = null;
                cubeContainer.onmouseout = null;
                cubeContainer.onmousemove = null;
                cubeContainer.style.opacity = "1.0";
            }
        };
    
    
        this.dtor = function () {
            this.renderer = null;
        };
    
    
        /* Build the cube */
        Init();
    };

    return Autocam;
});