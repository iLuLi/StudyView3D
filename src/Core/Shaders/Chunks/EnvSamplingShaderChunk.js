define(function() {;
    'use strict'
    return [
    // Precomputed sin/cos of the environment rotation
    "uniform float envRotationSin;",
    "uniform float envRotationCos;",
    "vec3 adjustLookupVector(in vec3 lookup) {",
        "return vec3(",
            "envRotationCos * lookup.x - envRotationSin * lookup.z,",
            "lookup.y,",
            "envRotationSin * lookup.x + envRotationCos * lookup.z);",
    "}"
    ].join("\n");
});