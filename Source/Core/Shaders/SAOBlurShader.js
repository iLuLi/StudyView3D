define(function() {;
    'use strict'
    return {
        
        uniforms: {

            "tDiffuse": { type: "t", value: null },
            "size": { type: "v2", value: new THREE.Vector2(512, 512) },
            "resolution": { type: "v2", value: new THREE.Vector2(1.0 / 512, 1.0 / 512) },
            "axis": { type: "v2", value: new THREE.Vector2(1, 0) },
            // Width of AO effect in native geometry units (meters or whatever).
            // Same value as passed into SAOShader.js
            "radius": { type: "f", value: 50.0 }
        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "vUv = uv;",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [

        /** Increase to make depth edges crisper (though possibly noisier. Decrease to reduce flicker. */
        "#define EDGE_SHARPNESS     (3.0)",

        /** Step in 2-pixel intervals since we already blurred against neighbors in the
         first AO pass.  This constant can be increased while R decreases to improve
            performance at the expense of some dithering artifacts.
    
            Morgan found that a scale of 3 left a 1-pixel checkerboard grid that was
            unobjectionable after shading was applied but eliminated most temporal incoherence
            from using small numbers of sample taps.
            */
        "#define SCALE               (2)",

        /** Filter radius in pixels. This will be multiplied by SCALE. */
        // Don't change this value, as the loop using it had to be unwound and hardcoded.
        "#define R                   (4)",


        //////////////////////////////////////////////////////////////////////////////////////////////

        /** Type of data to read from source.  This macro allows
         the same blur shader to be used on different kinds of input data. */
        "#define VALUE_TYPE        float",

        /** Swizzle to use to extract the channels of source. This macro allows
         the same blur shader to be used on different kinds of input data. */
        "#define VALUE_COMPONENTS   r",

        "#define VALUE_IS_KEY       0",

        /** Channel encoding the bilateral key value (which must not be the same as VALUE_COMPONENTS) */
        "#define KEY_COMPONENTS     gb",


        "#if __VERSION__ >= 330",
        // Gaussian coefficients
            "const float gaussian[R + 1] =",
        //    float[](0.356642, 0.239400, 0.072410, 0.009869);
        //    float[](0.398943, 0.241971, 0.053991, 0.004432, 0.000134);  // stddev = 1.0
            "float[](0.153170, 0.144893, 0.122649, 0.092902, 0.062970);",  // stddev = 2.0
        //      float[](0.111220, 0.107798, 0.098151, 0.083953, 0.067458, 0.050920, 0.036108); // stddev = 3.0
        "#endif",

        "uniform sampler2D   tDiffuse;",
        "uniform vec2 size;",
        "uniform vec2 resolution;",

        /** (1, 0) or (0, 1)*/
        "uniform vec2       axis;",

        "uniform float radius;",

        "#define  result         gl_FragColor.VALUE_COMPONENTS",
        "#define  keyPassThrough gl_FragColor.KEY_COMPONENTS",

        /** Returns a number on (0, 1) */
        "float unpackKey(vec2 p) {",
            "return p.x * (256.0 / 257.0) + p.y * (1.0 / 257.0);",
        "}",

        "varying vec2 vUv;",

        "void main() {",

            "#   if __VERSION__ < 330",
                "float gaussian[R + 1];",
            "#       if R == 3",
                "gaussian[0] = 0.153170; gaussian[1] = 0.144893; gaussian[2] = 0.122649; gaussian[3] = 0.092902;",  // stddev = 2.0
            "#       elif R == 4",
            "gaussian[0] = 0.153170; gaussian[1] = 0.144893; gaussian[2] = 0.122649; gaussian[3] = 0.092902; gaussian[4] = 0.062970;",  // stddev = 2.0
            "#       elif R == 6",
            "gaussian[0] = 0.111220; gaussian[1] = 0.107798; gaussian[2] = 0.098151; gaussian[3] = 0.083953; gaussian[4] = 0.067458; gaussian[5] = 0.050920; gaussian[6] = 0.036108;",
            "#       endif",
            "#   endif",

            "ivec2 axisi = ivec2(axis);",

            "ivec2 ssC = ivec2(gl_FragCoord.xy);",
            //"vec4 temp = texelFetch(source, ssC, 0);",
            "vec4 temp = texture2D(tDiffuse, vUv);",

            "gl_FragColor.gb = temp.KEY_COMPONENTS;",
            "gl_FragColor.a = temp.a;",

            "VALUE_TYPE sum = temp.VALUE_COMPONENTS;",

            "if (temp.a == 0.0) {",
                // Sky pixel (we encoded that flag in the A component in the SAO shader)
                "result = sum;",
                "return;",
            "}",

            "float key = unpackKey(keyPassThrough);",

            // Base weight for depth falloff.  Increase this for more blurriness,
            // decrease it for better edge discrimination
            "float BASE = gaussian[0];",
            "float totalWeight = BASE;",
            "sum *= totalWeight;",

            "float scale = 1.5 / radius;",

            //NOTE: The loop below is unrolled in extremely ugly way, in order to avoid a Chrome/Windows codegen
            //issue that results in linker errors when the loop is not unrolled. My best guess
            //is that it has to do with the integer precision setting of the loop variable and then
            //later using that with another expected precision.
            /*
            "for (int r = -R; r <= R; ++r) {",
                // We already handled the zero case above.  This loop should be unrolled and the static branch optimized out,
                // so the IF statement has no runtime cost
                "if (r != 0) {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",
    
                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[r<0?-r:r];",
    
                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",
    
                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
            "}",
            */
                "int r = -4; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[4];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = -3; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[3];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = -2; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[2];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r=-1; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[1];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = 1; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[1];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = 2; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[2];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = 3; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[3];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",
                "r = 4; {",
                    //"temp = texelFetch(source, ssC + axis * (r * SCALE), 0);",
                    "vec2 ssUV = vec2(ssC + axisi * (r * SCALE))*resolution;",
                    "temp = texture2D(tDiffuse, ssUV);",
                    "float      tapKey = unpackKey(temp.KEY_COMPONENTS);",
                    "VALUE_TYPE value  = temp.VALUE_COMPONENTS;",

                    // spatial domain: offset gaussian tap
                    //"float weight = 0.3 + gaussian[abs(r)];",
                    "float weight = 0.3 + gaussian[4];",

                    // range domain (the "bilateral" weight). As depth difference increases, decrease weight.
                    "float dz = tapKey - key;",
                    "weight *= max(0.0, 1.0 - (EDGE_SHARPNESS * 2000.0) * abs(dz) * scale);",

                    "sum += value * weight;",
                    "totalWeight += weight;",
                "}",

            "const float epsilon = 0.0001;",
            "result = sum / (totalWeight + epsilon);",

        "}"

        ].join("\n")

    };

    return SAOBlurShader;
});