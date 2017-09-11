define([
    '../Pass/GaussianPass',
    '../Pass/LmvShaderPass',
    '../../Constants/DeviceType',
    '../../Shaders/GroundReflectionDrawShader',
    '../../Shaders/BackgroundShader'
], function(GaussianPass, LmvShaderPass, DeviceType, GroundReflectionDrawShader, BackgroundShader) {
    'use strict';

    var GroundReflection = function (renderer, width, height, params) {
        
        // init_GroundReflectionShader();

        var _renderer = renderer;
        var _gl = _renderer.getContext();
        var _width = width || 512;
        var _height = height || 512;
        var _gaussianPass, _drawPass;
        var _groundPlane, _groundCenter;
        var _reflCamera;
        var _isGroundCulled = false;
        var _clearColor = new THREE.Color(0, 0, 0);
        var _clearPass, _useClearPass = false;
        var _envMapBg = false;

        this.inTarget = undefined;
        this.outTarget = undefined;

        // param defaults
        var _params = {
            color: new THREE.Color(1.0, 1.0, 1.0),
            alpha: 0.3,
            texScale: 0.5,
            blurRadius: 2,
            blurTexScale: 0.5,
            fadeAngle: Math.PI / 18
        };

        // PRIVATE FUNCTIONS

        var getReflectionMatrix = function (plane) {
            var N = plane.normal;
            var C = plane.constant;
            return (new THREE.Matrix4()).set(
                1 - 2 * N.x * N.x, -2 * N.y * N.x, -2 * N.x * N.z, -2 * C * N.x,
                    -2 * N.x * N.y, 1 - 2 * N.y * N.y, -2 * N.y * N.z, -2 * C * N.y,
                    -2 * N.x * N.z, -2 * N.y * N.z, 1 - 2 * N.z * N.z, -2 * C * N.z,
                                0, 0, 0, 1
            );
        };

        // PUBLIC FUNCTIONS
        // note: currently scale is not used
        this.setTransform = function (center, upDir, scale) {
            _groundCenter = center;
            _groundPlane.normal = upDir;
            _groundPlane.constant = -center.dot(upDir);
        };

        this.cleanup = function () {
            if (_gaussianPass) _gaussianPass.cleanup();
            if (this.inTarget) this.inTarget.dispose();
            if (this.outTarget) this.outTarget.dispose();
        };

        this.setSize = function (width, height) {
            _width = width;
            _height = height;

            this.cleanup();

            // init targets

            this.inTarget = new THREE.WebGLRenderTarget(
                _width * _params.texScale,
                _height * _params.texScale,
                {
                    magFilter: THREE.LinearFilter,
                    minFilter: THREE.LinearFilter,
                    format: THREE.RGBAFormat,
                    stencilBuffer: false
                }
            );
            this.inTarget.generateMipmaps = false;

            this.outTarget = new THREE.WebGLRenderTarget(
                _width * _params.texScale,
                _height * _params.texScale,
                {
                    magFilter: THREE.LinearFilter,
                    minFilter: THREE.LinearFilter,
                    format: THREE.RGBAFormat,
                    stencilBuffer: false
                }
            );
            this.outTarget.generateMipmaps = false;

            // init gaussian pass

            if (!_gaussianPass)
                _gaussianPass = new GaussianPass(
                    _width * _params.texScale * _params.blurTexScale,
                    _height * _params.texScale * _params.blurTexScale,
                    _params.blurRadius,
                    1.0, {
                        hasAlpha: true,
                        blending: true,
                        flipUV: true
                    });
            else
                _gaussianPass.setSize(
                    _width * _params.texScale * _params.blurTexScale,
                    _height * _params.texScale * _params.blurTexScale);
        };

        this.updateCamera = function (camera) {
            // do not render if camera angle below zero
            var camDir = camera.position.clone().sub(_groundCenter).normalize();
            var camAngle = Math.PI / 2 - camDir.angleTo(_groundPlane.normal);
            _isGroundCulled = camAngle < 0;

            if (_isGroundCulled) return;

            // fade out
            if (_params.fadeAngle > 0) {
                var fadeAmount = Math.min(_params.fadeAngle, camAngle) / _params.fadeAngle;
                _gaussianPass.setAlpha(fadeAmount * _params.alpha);
            }

            // construct reflected camera
            var reflMatrix = getReflectionMatrix(_groundPlane);
            _reflCamera = camera.clone();
            _reflCamera.applyMatrix(reflMatrix);
            // MAGIC: scale negative Y and flip UV gives us correct result without messing with face winding
            _reflCamera.projectionMatrix.elements[5] *= -1;
            _reflCamera.matrixWorldNeedsUpdate = true;

            // copy worldUpTransform
            if (camera.worldUpTransform)
                _reflCamera.worldUpTransform = camera.worldUpTransform.clone();
            else
                _reflCamera.worldUpTransform = new THREE.Matrix4();
        };

        this.renderIntoReflection = function (scene) {
            if (_isGroundCulled) return;
            _renderer.render(scene, _reflCamera, this.inTarget);

            // avp.logger.log("GR render in");
        };

        this.renderReflection = function (camera, target) {
            if (_isGroundCulled) return;

            _gl.depthRange(0.999999, 1);
            _drawPass.render(_renderer, target, this.outTarget);
            _gl.depthRange(0, 1);

            // avp.logger.log("GR render out");
        };

        this.toggleEnvMapBackground = function (value) {

            _envMapBg = value;
            _clearPass.uniforms.envMapBackground.value = value;
        };

        this.postprocess = function (camera) {
            if (_isGroundCulled) return;

            // clear outTarget with bg color
            if (_useClearPass || _envMapBg) {

                _clearPass.uniforms['uCamDir'].value = camera.getWorldDirection();
                _clearPass.uniforms['uCamUp'].value = camera.up;
                _clearPass.uniforms['uResolution'].value.set(_width, _height);
                _clearPass.uniforms['uHalfFovTan'].value = Math.tan(THREE.Math.degToRad(camera.fov * 0.5));

                _clearPass.render(_renderer, this.outTarget);
                _renderer.clearTarget(this.outTarget, false, true, false);
            }
            else {
                _renderer.setClearColor(_clearColor, 1.0);
                _renderer.clearTarget(this.outTarget, true, true, false);
            }

            // blur inTarget with alpha blending over bg in outTarget
            _gaussianPass.render(_renderer, this.outTarget, this.inTarget);

            // avp.logger.log("GR postprocess");
        };

        this.clear = function () {
            // clear with bgColor otherwise there'll be outline problem
            // using the cheaper flat clear color in this case
            _renderer.setClearColor(_clearColor, 0);
            _renderer.clearTarget(this.inTarget, true, true, false);

            // avp.logger.log("GR clear");
        };

        // params are normalized clamped THREE.Vector3
        this.setClearColors = function (colorTop, colorBot) {
            if (!colorBot) {
                _clearColor.copy(colorTop);
                _useClearPass = false;
            }
            else {
                _clearColor.setRGB(
                    0.5 * (colorTop.x + colorBot.x),
                    0.5 * (colorTop.y + colorBot.y),
                    0.5 * (colorTop.z + colorBot.z));

                // same logic as RenderContext.setClearColors
                _useClearPass =
                    !colorTop.equals(colorBot) &&
                    !DeviceType.isAndroidDevice &&
                    !DeviceType.isIOSDevice;
            }

            if (_useClearPass) {
                _clearPass.uniforms.color1.value.copy(colorTop);
                _clearPass.uniforms.color2.value.copy(colorBot);
            }
        };

        this.setEnvRotation = function (rotation) {
            _clearPass.material.envRotationSin = Math.sin(rotation);
            _clearPass.material.envRotationCos = Math.cos(rotation);
        };

        this.isGroundCulled = function () {
            return _isGroundCulled;
        };

        this.setColor = function (color) {
            _gaussianPass.setColor(_params.color);
            _params.color.set(color);
        };

        this.setAlpha = function (alpha) {
            _gaussianPass.setAlpha(_params.alpha);
            _params.alpha = alpha;
        };

        // INITIALIZATION

        if (params) {
            for (var i in _params) {
                _params[i] = (params[i] !== undefined) ? params[i] : _params[i];
            }
        }

        // init passes

        _drawPass = new LmvShaderPass(GroundReflectionDrawShader);
        _drawPass.material.blending = THREE.NoBlending;
        _drawPass.material.depthTest = true;
        _drawPass.material.depthWrite = false;

        _clearPass = new LmvShaderPass(BackgroundShader);
        _clearPass.material.blending = THREE.NoBlending;
        _clearPass.material.depthWrite = false;
        _clearPass.material.depthTest = false;

        // init targets
        this.setSize(_width, _height);

        _gaussianPass.setAlpha(_params.color);
        _gaussianPass.setAlpha(_params.alpha);

        // init plane

        _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        _groundCenter = new THREE.Vector3(0, 0, 0);

    };

    GroundReflection.prototype.constructor = GroundReflection;

    return GroundReflection;
});