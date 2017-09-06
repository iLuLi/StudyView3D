define([
    './Chunks/PackDepthShaderChunk'
], function(PackDepthShaderChunk) {
    'use strict';
    return {
        uniforms: {
            tDepth: { type: "t", value: null },
            worldSize: { type: "v3", value: new THREE.Vector3(1, 1, 1) }
        },

        defines: {

        },

        vertexShader: [
            "varying vec2 vUv;",

            "void main() {",
                "vUv = vec2(uv.x, uv.y);",
                "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
            "}"
        ].join("\n"),

        fragmentShader: [

            "#define NUM_SAMPLES 29.0",
            "#define NUM_SPIRAL_TURNS 7.0",

            "uniform sampler2D tDepth;",
            "uniform vec3 worldSize;",

            "varying vec2 vUv;",

            //"#define PRESET_2",

            "#ifdef PRESET_2",
            "#define SAMPLE_RADIUS 0.3",
            "#define AO_GAMMA 1.0",
            "#define AO_INTENSITY 1.0",
            "#else",
            "#define SAMPLE_RADIUS 0.2",
            "#define AO_GAMMA 3.0",
            "#define AO_INTENSITY 0.8",
            "#endif",

            PackDepthShaderChunk,

            "#define PI 3.14159265358979",

            "float rand(vec2 co) {",
                "return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);",
            "}",

            "float getRandomAngle(vec2 pos) {",
                "return rand(pos) * (2.0 * PI);",
            "}",

            /** Returns a unit vector and a screen-space radius for the tap on a unit disk (the caller should scale by the actual disk radius) */
            "vec2 tapLocation(float sampleNumber, float spinAngle, out float ssR){",
                // Radius relative to ssR
                "float alpha = float(sampleNumber + 0.5) * (1.0 / NUM_SAMPLES);",
                "float angle = alpha * (NUM_SPIRAL_TURNS * PI * 2.0) + spinAngle;",

                "ssR = alpha;",
                "return vec2(cos(angle), sin(angle));",
            "}",


            "vec2 sampleAO(vec2 unitDirection, float radius) {",
                "vec2 sampleOffset = unitDirection * radius;",
                "float idepth = unpackDepth(texture2D(tDepth, vUv + sampleOffset));",
                "float depth = 1.0 - idepth;", //in our texture storage 1.0 is near, 0.0 is far

                "if (depth < 1e-6) {",
                     "if (radius == 0.0)",
                        "return vec2(1.0, 1.0);",
                     "else",
                        "return vec2(0.0, 1.0);",
                "}",

                //This is (a rough proxy for) the world space distance to the sample
                "vec3 dir = vec3(sampleOffset.x, depth, sampleOffset.y) * worldSize;",
                "float distance2 = dot(dir,dir);",
                "float idistance = 1.0 / sqrt(distance2);",

                //Normalized direction vector pointing to the sample
                "vec3 ndir = dir * idistance;",

                //If ndir.y is bigger, sample is more important (dot(normal,sample dir) is closer to vertical)
                //If distance2 is bigger, sample is less important as it's too far
                "#ifdef PRESET_2",
                "float importance = ndir.y * idistance;",
                "#else",
                "float importance = ndir.y / distance2;",
                "#endif",

                "vec2 ret;",
                "ret.x = (idepth == 0.0) ? 0.0 : importance;", //accumulate darkness -- 0 if sample is not obscured
                "ret.y = importance;", //accumulate scale factor for normalization of the sum
                "return ret;",
            "}",

            "void main() {",
                "vec2 sum = vec2(0.0);",
                "float angle = getRandomAngle(vUv);",
                //Take NUM_SAMPLES random-ish samples on the hemispehere of
                //the current ground point, similar to how it's done by the SAO algorithm.
                "for (float i = 0.0; i<NUM_SAMPLES; i+= 1.0) {",
                    "float ssR;",
                    "vec2 uv = tapLocation(i, angle, ssR);",
                    "sum += sampleAO(uv, ssR * SAMPLE_RADIUS);",
                "}",
                "float ao = sum.x / sum.y;", //normalize the sum
                "gl_FragColor = packDepth(AO_INTENSITY * clamp(pow(ao, AO_GAMMA), 0.0, 0.9999));",
            "}"
        ].join("\n")
    };
});