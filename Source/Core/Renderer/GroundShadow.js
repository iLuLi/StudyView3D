define([
    './Pass/LmvShaderPass',
    '../Shaders/GroundDepthShader',
    '../Shaders/GroundShadowBlurShader',
    '../Shaders/GroundShadowAOShader',
    '../Shaders/GroundShadowColorShader'
], function(
    LmvShaderPass, 
    GroundDepthShader,
    GroundShadowBlurShader,
    GroundShadowAOShader,
    GroundShadowColorShader
) {
    'use strict';
    var GroundShadow = function (renderer, params) {
        
        // avs.init_GroundShader(THREE);

        var _renderer = renderer;
        var _camera;
        var _scene;
        var _planeMesh, _planeGeo;
        var _targetH, _targetV;
        var _matDepth, _matColor;
        var _blurPassH, _blurPassV, _aoPass;
        var _debugBox;

        var _bufferValid = false;

        var USE_AO_PASS = false;

        // param defaults
        var _params = {
            texSize: USE_AO_PASS ? 128.0 : 64.0,
            pixScale: 1.0,
            blurRadius: USE_AO_PASS ? 5.0 : 7.0,
            debug: false
        };

        // FUNCTIONS

        function createShaderMaterial(shader) {
            return new THREE.ShaderMaterial({
                uniforms: THREE.UniformsUtils.clone(shader.uniforms),
                vertexShader: shader.vertexShader,
                fragmentShader: shader.fragmentShader,
                defines: THREE.UniformsUtils.clone(shader.defines)
            });
        }

        /**
         * Set transform of the ground shadow system
         * @param {Vector3} center  center of bounding box
         * @param {Vector3} size    size in look&up coordinates, look = y
         * @param {Vector3} lookDir look direction, where ground camera is facing
         * @param {Vector3} upDir   up direction for ground camera
         */
        this.setTransform = function (center, size, lookDir, upDir) {
            // ortho frustrum
            _camera.left = -size.z / 2.0;
            _camera.right = size.z / 2.0;
            _camera.top = size.x / 2.0;
            _camera.bottom = -size.x / 2.0;
            _camera.near = 1.0;
            _camera.far = size.y + _camera.near;

            // update projection
            _camera.updateProjectionMatrix();

            // camera transform
            _camera.position.addVectors(center, lookDir.clone().multiplyScalar(-size.y / 2.0 - _camera.near));
            if (upDir) _camera.up.set(upDir.x, upDir.y, upDir.z);
            _camera.lookAt(center);

            // plane transform
            _planeMesh.position.set(center.x, center.y /*+ size.y * 0.05*/, center.z);
            _planeMesh.rotation.set(_camera.rotation.x, _camera.rotation.y, _camera.rotation.z);
            _planeMesh.scale.set(size.z, size.x, size.y);

            // debug box
            if (_params.debug) {
                _debugBox.position.set(center.x, center.y, center.z);
                _debugBox.rotation.set(_camera.rotation.x, _camera.rotation.y, _camera.rotation.z);
                _debugBox.scale.set(size.z, size.x, size.y);
            }

            _aoPass.uniforms['worldSize'].value.copy(size);
        };

        this.renderIntoShadow = function (scene) {
            //Skip ghosted objects
            if (scene.overrideMaterial && scene.overrideMaterial.transparent)
                return;

            var oldMat = scene.overrideMaterial;
            scene.overrideMaterial = _matDepth;
            _renderer.render(scene, _camera, _targetH, false);
            scene.overrideMaterial = oldMat;

            // avp.logger.log("GS render in");
        };

        this.renderShadow = function (camera, target) {
            if (!_bufferValid)
                return;

            if (target)
                _renderer.render(_scene, camera, target, false);
            else
                _renderer.render(_scene, camera);

            // avp.logger.log("GS render out");
        };

        this.postprocess = function () {
            if (USE_AO_PASS) {
                _aoPass.render(_renderer, _targetV, _targetH);
                _blurPassV.render(_renderer, _targetH, _targetV);
                _blurPassH.render(_renderer, _targetV, _targetH);
            } else {
                _blurPassV.render(_renderer, _targetV, _targetH);
                _blurPassH.render(_renderer, _targetH, _targetV);
            }

            _bufferValid = true;

            // avp.logger.log("GS postprocess");
        };

        this.clear = function () {
            var oldClearColor = _renderer.getClearColor().getHex();
            var oldClearAlpha = _renderer.getClearAlpha();
            _renderer.setClearColor(0, 0);
            _renderer.clearTarget(_targetH, true, true, false);
            _renderer.setClearColor(oldClearColor, oldClearAlpha);
            _bufferValid = false;

            // avp.logger.log("GS clear");
        };

        this.setColor = function (color) {
            _matColor.uniforms.uShadowColor.value.x = color.r;
            _matColor.uniforms.uShadowColor.value.y = color.g;
            _matColor.uniforms.uShadowColor.value.z = color.b;
        };

        this.getColor = function () {
            return new THREE.Color(
                _matColor.uniforms.uShadowColor.value.x,
                _matColor.uniforms.uShadowColor.value.y,
                _matColor.uniforms.uShadowColor.value.z
            );
        };

        this.setAlpha = function (alpha) {
            _matColor.uniforms.uShadowColor.value.w = alpha;
        };

        this.getAlpha = function () {
            return _matColor.uniforms.uShadowColor.value.w;
        };

        this.isValid = function () {
            return _bufferValid;
        };

        // TODO_NOP: hack exposing groundshadow material
        this.getDepthMaterial = function () {
            return _matDepth;
        };

        // INITIALIZATION

        if (params) {
            for (var i in _params) {
                _params[i] = params[i] || _params[i];
            }
        }

        // init scene
        _scene = new THREE.Scene();

        // init camera
        _camera = new THREE.OrthographicCamera();

        // init targets

        _targetH = new THREE.WebGLRenderTarget(_params.texSize, _params.texSize, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false,
        });
        _targetH.generateMipmaps = false;

        _targetV = new THREE.WebGLRenderTarget(_params.texSize, _params.texSize, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });
        _targetV.generateMipmaps = false;


        // init materials

        _matDepth = createShaderMaterial(GroundDepthShader);
        _matDepth.side = THREE.DoubleSide;
        _matDepth.blending = THREE.NoBlending;

        _blurPassH = new LmvShaderPass(GroundShadowBlurShader, "tDepth");
        _blurPassV = new LmvShaderPass(GroundShadowBlurShader, "tDepth");
        _aoPass = new LmvShaderPass(GroundShadowAOShader, "tDepth");

        // write defines
        _blurPassH.material.defines["KERNEL_SCALE"] = _blurPassV.material.defines["KERNEL_SCALE"] = (_params.pixScale / _params.texSize).toFixed(4);
        _blurPassH.material.defines["KERNEL_RADIUS"] = _blurPassV.material.defines["KERNEL_RADIUS"] = _params.blurRadius.toFixed(2);

        //Some standard GL setup for the blur passes.
        _aoPass.material.blending = _blurPassH.material.blending = _blurPassV.material.blending = THREE.NoBlending;
        _aoPass.material.depthWrite = _blurPassH.material.depthWrite = _blurPassV.material.depthWrite = false;
        _aoPass.material.depthTest = _blurPassH.material.depthTest = _blurPassV.material.depthTest = false;
        _blurPassH.material.defines["HORIZONTAL"] = 1;

        _matColor = createShaderMaterial(GroundShadowColorShader);
        _matColor.uniforms.tDepth.value = USE_AO_PASS ? _targetV : _targetH;
        _matColor.depthWrite = false;
        _matColor.transparent = true;

        // init plane

        _planeGeo = new THREE.BufferGeometry();
        _planeGeo.addAttribute("position", new THREE.BufferAttribute((new Float32Array([
            -0.5, -0.5, 0.5,
            -0.5, 0.5, 0.5,
                0.5, 0.5, 0.5,
                0.5, -0.5, 0.5
        ])), 3));
        _planeGeo.addAttribute("uv", new THREE.BufferAttribute((new Float32Array([
            0.0, 0.0,
            0.0, 1.0,
            1.0, 1.0,
            1.0, 0.0
        ])), 2));
        _planeGeo.addAttribute("index", new THREE.BufferAttribute((new Uint16Array([
            0, 1, 2,
            2, 3, 0
        ])), 1));
        _planeMesh = new THREE.Mesh(_planeGeo, _matColor);
        _scene.add(_planeMesh);

        // init debug box
        if (_params.debug) {
            _debugBox = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            _scene.add(_debugBox);
        }

        // init with default bounds and up
        this.setTransform(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(1, 1, 1),
            new THREE.Vector3(0, 1, 0)
        );
    };

    GroundShadow.prototype.constructor = GroundShadow;

    return GroundShadow;
});