define(function() {;
    'use strict'
    return [
        
    "#ifdef HATCH_PATTERN",
    "uniform vec2 hatchParams;",
    "uniform vec3 hatchTintColor;",
    "uniform float hatchTintIntensity;",

    //Gaussian falloff function
    "float curveGaussian(float r, float invWidth) {",
        "float amt = clamp(r * invWidth, 0.0, 1.0);",
        "float exponent = amt * 3.5;",
        "return exp(-exponent*exponent);",
    "}",

    "vec4 calculateHatchPattern(vec2 hatchParams, vec2 coord, vec4 fragColor, vec3 hatchTintColor, float hatchTintIntensity ) {",
        "float hatchSlope = hatchParams.x;",
        "float hatchPeriod = hatchParams.y;",
        "if (abs(hatchSlope) <= 1.0) {",
            "float hatchPhase = coord.y - hatchSlope * coord.x;",
            "float dist = abs(mod((hatchPhase), (hatchPeriod)));",
            "if (dist < 1.0) {",
                "fragColor = vec4(0.0,0.0,0.0,1.0);",
            "} else {",
                "fragColor.xyz = mix(fragColor.xyz, hatchTintColor, hatchTintIntensity);",
            "}",
        "} else {",
            "float hatchPhase = - coord.y / hatchSlope + coord.x;",
            "float dist = abs(mod((hatchPhase), (hatchPeriod)));",
            "if (dist < 1.0) {",
                "fragColor = vec4(0.0,0.0,0.0,1.0);",
            "} else {",
                "fragColor.xyz = mix(fragColor.xyz, hatchTintColor, hatchTintIntensity);",
            "}",
        "}",
        "return fragColor;",
    "}",

    "#endif"

    ].join("\n");
});