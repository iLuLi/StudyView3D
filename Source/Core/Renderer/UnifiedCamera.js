define([
    '../Constants/EventType'
], function(EventType) {
    'use strict';
        
    var UnifiedCamera = function (clientWidth, clientHeight) {
        THREE.Camera.call(this);

        this.fov = 45;
        this.near = 0.1;
        this.far = 100000;
        this.aspect = clientWidth / clientHeight;

        this.left = -clientWidth / 2;
        this.right = clientWidth / 2;
        this.top = clientHeight / 2;
        this.bottom = -clientHeight / 2;
        this.clientWidth = clientWidth;
        this.clientHeight = clientHeight;

        this.target = new THREE.Vector3(0, 0, -1);
        this.worldup = new THREE.Vector3(0, 1, 0);

        this.orthographicCamera = new THREE.OrthographicCamera(this.left, this.right, this.top, this.bottom, this.near, this.far);
        this.perspectiveCamera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);

        this.zoom = 1;

        this.toPerspective();
    };

    //Constant FOV used to make math right for Ortho cameras.
    UnifiedCamera.ORTHO_FOV = (2 * Math.atan(0.5)) * 180.0 / Math.PI;

    UnifiedCamera.prototype = Object.create(THREE.Camera.prototype);

    UnifiedCamera.prototype.clone = function () {
        var camera = new UnifiedCamera(this.right * 2.0, this.top * 2.0);

        THREE.Camera.prototype.clone.call(this, camera);

        camera.position.copy(this.position);
        camera.up.copy(this.up);
        if (this.target)
            camera.target = this.target.clone();
        if (this.worldup)
            camera.worldup = this.worldup.clone();
        if (this.worldUpTransform)
            camera.worldUpTransform = this.worldUpTransform.clone();

        camera.left = this.left;
        camera.right = this.right;
        camera.top = this.top;
        camera.bottom = this.bottom;

        camera.near = this.near;
        camera.far = this.far;
        camera.fov = this.fov;
        camera.aspect = this.aspect;
        camera.zoom = this.zoom;

        camera.isPerspective = this.isPerspective;

        this.updateProjectionMatrix();

        return camera;
    };

    UnifiedCamera.prototype.__computeFovPosition = function (fov) {
        if (Math.abs(this.fov - fov) <= 0.0001)
            return this.position.clone();

        var eye = this.target.clone().sub(this.position);

        var oldFOV = THREE.Math.degToRad(this.fov);
        var newFOV = THREE.Math.degToRad(fov);

        var distance = eye.length() * Math.tan(oldFOV * 0.5) / Math.tan(newFOV * 0.5);
        var offset = eye.normalize().multiplyScalar(-distance);

        return this.target.clone().add(offset);
    };

    UnifiedCamera.prototype.toPerspective = function () {
        // Switches to the Perspective Camera

        if (!this.isPerspective && this.saveFov) {
            this.position.copy(this.__computeFovPosition(this.saveFov));
            this.fov = this.saveFov;
        }

        this.perspectiveCamera.aspect = this.aspect;
        this.perspectiveCamera.near = this.near;
        this.perspectiveCamera.far = this.far;

        this.perspectiveCamera.fov = this.fov / this.zoom;
        this.perspectiveCamera.updateProjectionMatrix();

        this.projectionMatrix = this.perspectiveCamera.projectionMatrix;

        this.isPerspective = true;
    };

    UnifiedCamera.prototype.toOrthographic = function () {
        if (this.isPerspective) {
            this.saveFov = this.fov;
            var newFov = UnifiedCamera.ORTHO_FOV;
            this.position.copy(this.__computeFovPosition(newFov));
            this.fov = newFov;
        }

        this.orthoScale = this.target.clone().sub(this.position).length();

        var halfHeight = this.orthoScale * 0.5;
        var halfWidth = halfHeight * this.aspect;

        this.left = this.orthographicCamera.left = -halfWidth;
        this.right = this.orthographicCamera.right = halfWidth;
        this.top = this.orthographicCamera.top = halfHeight;
        this.bottom = this.orthographicCamera.bottom = -halfHeight;

        this.orthographicCamera.near = this.near;
        this.orthographicCamera.far = this.far;

        this.orthographicCamera.updateProjectionMatrix();

        this.projectionMatrix = this.orthographicCamera.projectionMatrix;

        this.isPerspective = false;
    };

    UnifiedCamera.prototype.updateProjectionMatrix = function () {
        if (this.isPerspective) {
            this.toPerspective();
        } else {
            this.toOrthographic();
        }
    };

    UnifiedCamera.prototype.setSize = function (width, height) {
        this.aspect = width / height;
        this.left = -width / 2;
        this.right = width / 2;
        this.top = height / 2;
        this.bottom = -height / 2;

    };


    UnifiedCamera.prototype.setFov = function (fov) {
        this.fov = fov;
        this.updateProjectionMatrix();
    };

    /*
    * Uses Focal Length (in mm) to estimate and set FOV
    * 35mm (fullframe) camera is used if frame size is not specified;
    * Formula based on http://www.bobatkins.com/photography/technical/field_of_view.html
    */
    UnifiedCamera.prototype.setLens = function (focalLength, frameHeight) {
        if (frameHeight === undefined) frameHeight = 24;

        var fov = 2 * THREE.Math.radToDeg(Math.atan(frameHeight / (focalLength * 2)));

        this.setFov(fov);

        return fov;
    };


    UnifiedCamera.prototype.getCameraChangedEvent = function () {
        return { type: EventType.CAMERA_CHANGE_EVENT, camera: this };
    };

    return UnifiedCamera;
    
});