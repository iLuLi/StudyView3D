define(['../PrismShader'], function(PrismShader) {
    'use strict'
    var createPrismMaterial = function () {
        var prismMat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(PrismShader.uniforms),
            vertexShader: PrismShader.vertexShader,
            fragmentShader: PrismShader.fragmentShader
        });
        prismMat.defaultAttributeValues['uvw'] = [0, 0, 0];
        prismMat.mapList = {};
        prismMat.isPrismMaterial = true;

        return prismMat;
    };

    return createPrismMaterial;
});