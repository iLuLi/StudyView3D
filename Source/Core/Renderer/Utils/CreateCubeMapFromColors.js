define(function() {;
    'use strict'
    return function (ctop, cbot) {
        var r1 = ctop.x * 255, g1 = ctop.y * 255, b1 = ctop.z * 255,
            r2 = cbot.x * 255, g2 = cbot.y * 255, b2 = cbot.z * 255;

        var pixelsTop = new Uint8Array(16);
        var pixelsBot = new Uint8Array(16);
        var pixelsSide = new Uint8Array(16);

        for (var i = 0; i < 4; i++) {
            pixelsTop[i * 4] = r1;
            pixelsTop[i * 4 + 1] = g1;
            pixelsTop[i * 4 + 2] = b1;
            pixelsTop[i * 4 + 3] = 255;

            pixelsBot[i * 4] = r2;
            pixelsBot[i * 4 + 1] = g2;
            pixelsBot[i * 4 + 2] = b2;
            pixelsBot[i * 4 + 3] = 255;

            // was this, which is wild: if (0 | (i / 2)) {
            if (i > 1) {
                // color sides 2 and 3 with the first color
                pixelsSide[i * 4] = r1;
                pixelsSide[i * 4 + 1] = g1;
                pixelsSide[i * 4 + 2] = b1;
                pixelsSide[i * 4 + 3] = 255;
            }
            else {
                // color sides 0 and 1 with the second color
                pixelsSide[i * 4] = r2;
                pixelsSide[i * 4 + 1] = g2;
                pixelsSide[i * 4 + 2] = b2;
                pixelsSide[i * 4 + 3] = 255;
            }
        }

        var x_neg = new THREE.DataTexture(pixelsSide, 2, 2, THREE.RGBAFormat);
        var x_pos = new THREE.DataTexture(pixelsSide, 2, 2, THREE.RGBAFormat);
        var y_neg = new THREE.DataTexture(pixelsBot, 2, 2, THREE.RGBAFormat);
        var y_pos = new THREE.DataTexture(pixelsTop, 2, 2, THREE.RGBAFormat);
        var z_neg = new THREE.DataTexture(pixelsSide, 2, 2, THREE.RGBAFormat);
        var z_pos = new THREE.DataTexture(pixelsSide, 2, 2, THREE.RGBAFormat);

        var texture = new THREE.Texture(null, THREE.CubeReflectionMapping,
                                        THREE.RepeatWrapping, THREE.RepeatWrapping,
                                        THREE.LinearFilter, THREE.LinearFilter,
                                        //THREE.NearestFilter, THREE.NearestFilter,
                                        THREE.RGBAFormat);
        texture.image = [x_pos, x_neg, y_pos, y_neg, z_pos, z_neg];
        texture.needsUpdate = true;

        return texture;
    };
});