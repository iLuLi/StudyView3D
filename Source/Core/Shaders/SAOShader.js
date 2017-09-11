define([
    './Chunks/PackDepthShaderChunk'
], function(PackDepthShaderChunk) {
    'use strict';
    var SAOShader = {

        uniforms: {

            "tDepth": { type: "t", value: null },
            "size": { type: "v2", value: new THREE.Vector2(512, 512) },
            "resolution": { type: "v2", value: new THREE.Vector2(1 / 512, 1 / 512) },
            "cameraNear": { type: "f", value: 1 },
            "cameraFar": { type: "f", value: 100 },
            "radius": { type: "f", value: 10.0 },	// width of AO effect in native geometry units (meters or whatever)
            "bias": { type: "f", value: 0.1 },  // set to be 0.01 * radius for non-mobile devices, 0.1 * radius for mobile, see setAOOptions
            "projScale": { type: "f", value: 500 },
            //"clipInfo":     { type: "v3", value: new THREE.Vector3(100, 99, -100) }, /* zf*zn, zn-zf, zf */
            "projInfo": { type: "v4", value: new THREE.Vector4(0, 0, 0, 0) },
            "intensity": { type: "f", value: 0.4 },	// darkness (higher is darker)
            "isOrtho": { type: "f", value: 1.0 },

            "tDepth_mip1": { type: "t", value: null },
            "tDepth_mip2": { type: "t", value: null },
            "tDepth_mip3": { type: "t", value: null },
            "tDepth_mip4": { type: "t", value: null },
            "tDepth_mip5": { type: "t", value: null }
        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

            "vUv = uv;",

            "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

            "}"

        ].join("\n"),

        fragmentShader: [
            "#define USE_MIPMAP 1",

            "uniform float cameraNear;",
            "uniform float cameraFar;",


            "uniform vec2 size;",        // texture width, height
            "uniform vec2 resolution;", //inverse of texture width, height

            "uniform float lumInfluence;",  // how much luminance affects occlusion

            "varying vec2 vUv;",

            // Total number of direct samples to take at each pixel
            "#define NUM_SAMPLES (17)",

            // If using depth mip levels, the log of the maximum pixel offset before we need to switch to a lower
            // miplevel to maintain reasonable spatial locality in the cache
            // If this number is too small (< 3), too many taps will land in the same pixel, and we'll get bad variance that manifests as flashing.
            // If it is too high (> 5), we'll get bad performance because we're not using the MIP levels effectively
            "#define LOG_MAX_OFFSET (3)",

            // This must be less than or equal to the MAX_MIP_LEVEL defined in SSAO.cpp
            "#define MAX_MIP_LEVEL (5)",

            // This is the number of turns around the circle that the spiral pattern makes.  This should be prime to prevent
            // taps from lining up.  This particular choice (5) was tuned for NUM_SAMPLES == 17
            // Here is the table. The one's digit is the column, the ten's is the row to look at.
            // +0   1   2   3   4   5   6   7   8   9
            //  1,  1,  1,  2,  3,  2,  5,  2,  3,  2,  // 00
            //  3,  3,  5,  5,  3,  4,  7,  5,  5,  7,  // 10
            //  9,  8,  5,  5,  7,  7,  7,  8,  5,  8,  // 20
            // 11, 12,  7, 10, 13,  8, 11,  8,  7, 14,  // 30
            // 11, 11, 13, 12, 13, 19, 17, 13, 11, 18,  // 40
            // 19, 11, 11, 14, 17, 21, 15, 16, 17, 18,  // 50
            // 13, 17, 11, 17, 19, 18, 25, 18, 19, 19,  // 60
            // 29, 21, 19, 27, 31, 29, 21, 18, 17, 29,  // 70
            // 31, 31, 23, 18, 25, 26, 25, 23, 19, 34,  // 80
            // 19, 27, 21, 25, 39, 29, 17, 21, 27, 29}; // 90

            "#define NUM_SPIRAL_TURNS (5)",

            "#define MIN_RADIUS (3.0)", // pixels

            //////////////////////////////////////////////////

            /** The height in pixels of a 1m object if viewed from 1m away.
             You can compute it from your projection matrix.  The actual value is just
                a scale factor on radius; you can simply hardcode this to a constant (~500)
                and make your radius value unitless (...but resolution dependent.)  */
            "uniform float           projScale;",

            /** Negative, "linear" values in world-space units */
            "uniform sampler2D tDepth;",

            //The mip levels of the depth -- with WebGL
            //we can't sample specific mips, so we have to
            //declare them explicitly
            "#ifdef USE_MIPMAP",
            "uniform sampler2D tDepth_mip1;",
            "uniform sampler2D tDepth_mip2;",
            "uniform sampler2D tDepth_mip3;",
            "uniform sampler2D tDepth_mip4;",
            "uniform sampler2D tDepth_mip5;",
            "#endif",

            /** World-space AO radius in scene units (r).  e.g., 1.0m */
            "uniform float radius;",

            /** Bias to avoid AO in smooth corners, e.g., 0.01m */
            "uniform float bias;",

            "uniform float intensity;",

            "uniform float isOrtho;",

            /** intensity / radius^6 */
            //"uniform float intensityDivR6;",
            //"float intensityDivR6 = intensity / pow(radius, 6.0);",

            /** Returns a unit vector and a screen-space radius for the tap on a unit disk (the caller should scale by the actual disk radius) */
            "vec2 tapLocation(int sampleNumber, float spinAngle, out float ssR){",
                // Radius relative to ssR
                "float alpha = float(float(sampleNumber) + 0.5) * (1.0 / float(NUM_SAMPLES));",
                "float angle = alpha * (float(NUM_SPIRAL_TURNS) * 6.28) + spinAngle;",

                "ssR = alpha;",
                "return vec2(cos(angle), sin(angle));",
            "}",


            /** Used for packing Z into the GB channels */
            "float CSZToKey(float z) {",
                // convert from z in camera space to 0-1 space:
                // z is a negative value, near and far are positive
                // (-z-cameraNear) / (cameraFar-cameraNear)
                "return clamp( (z+cameraNear) / (cameraNear-cameraFar), 0.0, 1.0);",
            "}",


            /** Used for packing Z into the GB channels */
            "void packKey(float key, out vec2 p) {",
                // Round to the nearest 1/256.0
                "float temp = floor(key * 256.0);",

                // Integer part
                "p.x = temp * (1.0 / 256.0);",

                // Fractional part
                "p.y = key * 256.0 - temp;",
            "}",

            PackDepthShaderChunk,

            //Used to unpack depth value when input depth texture is RGBA8
            "float unpackDepthNearFar( const in vec4 rgba_depth ) {",
                "float depth = unpackDepth( rgba_depth );",
                "if (depth == 0.0)",
                    "return -cameraFar * 1.0e10;",
                "return depth * (cameraNear - cameraFar) - cameraNear;",
            "}",

            /*
                Clipping plane constants for use by reconstructZ
    
                clipInfo = (z_f == -inf()) ? Vector3(z_n, -1.0f, 1.0f) : Vector3(z_n * z_f,  z_n - z_f,  z_f);
                */
            //"uniform vec3      clipInfo;",
            //"vec3 clipInfo = vec3(cameraNear * cameraFar, cameraNear - cameraFar, cameraFar);",

            //"float reconstructCSZ(float d) {",
            //    "return clipInfo[0] / (clipInfo[1] * d + clipInfo[2]);",
            //"}",

            /**  vec4(-2.0f / (width*P[0][0]),
             -2.0f / (height*P[1][1]),
                ( 1.0f - P[0][2]) / P[0][0],
                ( 1.0f + P[1][2]) / P[1][1])
    
    
                where P is the projection matrix that maps camera space points
                to [-1, 1] x [-1, 1].  That is, GCamera::getProjectUnit(). */
            "uniform vec4 projInfo;",

        /** Reconstruct camera-space P.xyz from screen-space S = (x, y) in
             pixels and camera-space z < 0.  Assumes that the upper-left pixel center
                is at (0.5, 0.5) [but that need not be the location at which the sample tap
                was placed!]
    
                Costs 3 MADD.  Error is on the order of 10^3 at the far plane, partly due to z precision.
                */
            "vec3 reconstructCSPosition(vec2 S, float z) {",
                "return vec3((S.xy * projInfo.xy + projInfo.zw) * mix(z, -1.0, isOrtho), z);",
            "}",

            /** Reconstructs screen-space unit normal from screen-space position */
            "vec3 reconstructCSFaceNormal(vec3 C) {",
                "return normalize(cross(dFdy(C), dFdx(C)));",
            "}",

            "vec3 reconstructNonUnitCSFaceNormal(vec3 C) {",
                "return cross(dFdy(C), dFdx(C));",
            "}",

            /** Read the camera-space position of the point at screen-space pixel ssP */
            "vec3 getPosition(ivec2 ssP, float depth) {",
                "vec3 P;",

                // Offset to pixel center
                "P = reconstructCSPosition(vec2(ssP) + vec2(0.5), depth);",
                "return P;",
            "}",

        /** Read the camera-space position of the point at screen-space pixel ssP + unitOffset * ssR.  Assumes length(unitOffset) == 1 */
            "vec3 getOffsetPosition(ivec2 ssC, vec2 unitOffset, float ssR) {",

                "ivec2 ssP = ivec2(ssR * unitOffset) + ssC;",

                "vec3 P;",

                // We need to divide by 2^mipLevel to read the appropriately scaled coordinate from a MIP-map.
                // Manually clamp to the texture size because texelFetch bypasses the texture unit
                //"ivec2 mipP = clamp(ssP >> mipLevel, ivec2(0), textureSize(CS_Z_buffer, mipLevel) - ivec2(1));",
                //"ivec2 mipP = ssP;",
                //"P.z = texelFetch(tDepth, mipP, 0).w;",

                "vec2 screenUV = (vec2(ssP) + vec2(0.5)) * resolution;",

                "#ifdef USE_MIPMAP",
                    //"int mipLevel = clamp(int(floor(log2(ssR))) - LOG_MAX_OFFSET, 0, MAX_MIP_LEVEL);",
                    "int mipLevel = int(max(0.0, min(floor(log2(ssR)) - float(LOG_MAX_OFFSET), float(MAX_MIP_LEVEL))));",

                    "if (mipLevel == 0) {",
                        "P.z = texture2D(tDepth, screenUV).z;",
                        "if (P.z == 0.0) P.z = -cameraFar * 1.0e10;",
                    "}",
                    "else if (mipLevel == 1)",
                        "P.z = unpackDepthNearFar(texture2D(tDepth_mip1, screenUV));",
                    "else if (mipLevel == 2)",
                        "P.z = unpackDepthNearFar(texture2D(tDepth_mip2, screenUV));",
                    "else if (mipLevel == 3)",
                        "P.z = unpackDepthNearFar(texture2D(tDepth_mip3, screenUV));",
                    "else if (mipLevel == 4)",
                        "P.z = unpackDepthNearFar(texture2D(tDepth_mip4, screenUV));",
                    "else if (mipLevel == 5)",
                        "P.z = unpackDepthNearFar(texture2D(tDepth_mip5, screenUV));",
                "#else",
                    "P.z = texture2D(tDepth, screenUV).z;",
                    "if (P.z == 0.0) P.z = -cameraFar * 1.0e10;",
                "#endif",

                // Offset to pixel center
                "P = reconstructCSPosition(vec2(ssP) + vec2(0.5), P.z);",

                "return P;",
            "}",

            /** Compute the occlusion due to sample with index \a i about the pixel at \a ssC that corresponds
             to camera-space point \a C with unit normal \a n_C, using maximum screen-space sampling radius \a ssDiskRadius
    
                Note that units of H() in the HPG12 paper are meters, not
                unitless.  The whole falloff/sampling function is therefore
                unitless.  In this implementation, we factor out (9 / radius).
    
                Four versions of the falloff function are implemented below
                */
            "float sampleAO(in ivec2 ssC, in vec3 C, in vec3 n_C, in float ssDiskRadius, in int tapIndex, in float randomPatternRotationAngle) {",
                // Offset on the unit disk, spun for this pixel
                "float ssR;",
                "vec2 unitOffset = tapLocation(tapIndex, randomPatternRotationAngle, ssR);",

                // Ensure that the taps are at least 1 pixel away
                "ssR = max(0.75, ssR * ssDiskRadius);",

                // The occluding point in camera space
                "vec3 Q = getOffsetPosition(ssC, unitOffset, ssR);",

                // aoValueFromPositionsAndNormal() in original code
                "vec3 v = Q - C;",

                "float vv = dot(v, v);",
                "float vn = dot(v, n_C);",

                "const float epsilon = 0.001;",	// was 0.01, but in G3D code it's 0.001

                // Without the angular adjustment term, surfaces seen head-on have less AO
                "float angAdjust = mix(1.0, max(0.0, 1.5 * n_C.z), 0.35);",

                // fallOffFunction()
                // comment out this line for lower quality function:
                "#define HIGH_QUALITY",
                // A: From the HPG12 paper
                // Note large epsilon to avoid overdarkening within cracks
                //"return angAdjust * float(vv < radius * radius) * max((vn - bias) / (epsilon + vv), 0.0) * (radius * radius) * 0.6;",

                // B: Smoother transition to zero (lowers contrast, smoothing out corners). [Recommended]
                "#ifdef HIGH_QUALITY",

                // Higher quality version:
                // Epsilon inside the sqrt for rsqrt operation
                "float f = max(1.0 - vv / (radius * radius), 0.0); return angAdjust * f * max((vn - bias) / sqrt(epsilon + vv), 0.0);",
                "#else",
                // Avoid the square root from above.
                //  Assumes the desired result is intensity/radius^6 in main()
                "float f = max(radius * radius - vv, 0.0); return angAdjust * f * f * f * max((vn - bias) / (epsilon + vv), 0.0);",
                "#endif",

                // C: Medium contrast (which looks better at high radii), no division.  Note that the
                // contribution still falls off with radius^2, but we've adjusted the rate in a way that is
                // more computationally efficient and happens to be aesthetically pleasing.
                //"return angAdjust * 4.0 * max(1.0 - vv / (radius * radius), 0.0) * max(vn - bias, 0.0);",

                // D: Low contrast, no division operation
                //"return angAdjust * 2.0 * float(vv < radius * radius) * max(vn - bias, 0.0);",
            "}",


            // user variables

            "const bool useNoise = true;",      // use noise instead of pattern for sample dithering


            // random angle in radians between 0 and 2 PI
            "float getRandomAngle(vec2 pos) {",
                // from http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
                "float dt= dot(pos ,vec2(12.9898,78.233));",
                "return 6.28318 * fract(sin(mod(dt,3.14)) * 43758.5453);",
            "}",


            "void main() {",

            // Pixel being shaded
            "ivec2 ssC = ivec2(gl_FragCoord.xy);",

            //get the normal and depth from our normal+depth texture
            "vec4 nrmz = texture2D(tDepth, vUv);",

            // Unneccessary with depth test.
            "if (nrmz.z == 0.0) {",
                // We're on the skybox
                "gl_FragColor.r = 1.0;",
                "gl_FragColor.a = 0.0;",
                "packKey(1.0, gl_FragColor.gb);",
                "return;",
            "}",

            // Camera space point being shaded
            "vec3 C = getPosition(ssC, nrmz.z);",

            "packKey(CSZToKey(C.z), gl_FragColor.gb);",

            // Choose the screen-space sample radius
            // proportional to the projected area of the sphere.
            // If orthographic, use -1.0 for the divisor, else use the world-space point's Z value.
            "float ssDiskRadius = -projScale * radius / mix(C.z, -1.0, isOrtho);",

            "float A;",
            "if (ssDiskRadius <= MIN_RADIUS) {",
                // There is no way to compute AO at this radius
                "A = 1.0;",
            "} else {",

                "float sum = 0.0;",

                // Hash function used in the HPG12 AlchemyAO paper
                // Cannot use it because it uses ^, which needs an integer bitwise operation "^", not available until GLSL 3.0.
                //"float randomPatternRotationAngle = (((3.0 * ssC.x) ^ (ssC.y + ssC.x * ssC.y))) * 10.0;",

                //No integer stuff on WebGL, so we have to use an alternative jitter pattern
                "float randomPatternRotationAngle = getRandomAngle(vUv);",

                // Reconstruct normals from positions. These will lead to 1-pixel black lines
                // at depth discontinuities, however the blur will wipe those out so they are not visible
                // in the final image.
                //"vec3 n_C = reconstructCSFaceNormal(C);",
                "vec3 n_C = vec3(nrmz.x, nrmz.y, sqrt(1.0 - dot(nrmz.xy, nrmz.xy)));",

                //NOTE: The loop below is unrolled in extremely ugly way, in order to avoid a Chrome/Windows codegen
                //issue that results in linker errors when the loop is not unrolled. My best guess
                //is that it has to do with the integer precision setting of the loop variable and then
                //later using that with another expected precision.
                /*
                "for (int i = 0; i < NUM_SAMPLES; ++i) {",
                    "sum += sampleAO(ssC, C, n_C, ssDiskRadius, i, randomPatternRotationAngle);",
                "}",
                */
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 0, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 1, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 2, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 3, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 4, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 5, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 6, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 7, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 8, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 9, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 10, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 11, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 12, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 13, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 14, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 15, randomPatternRotationAngle);",
                "sum += sampleAO(ssC, C, n_C, ssDiskRadius, 16, randomPatternRotationAngle);",

                "float intensityDivR6 = intensity / pow(radius, 6.0);",
                // high quality:
                "#ifdef HIGH_QUALITY",
                "A = pow(max(0.0, 1.0 - sqrt(sum * (3.0 / float(NUM_SAMPLES)))), intensity);",

                "#else",
                // lower quality:
                "A = max(0.0, 1.0 - sum * intensityDivR6 * (5.0 / float(NUM_SAMPLES)));",
                // Use the following line only with the lower quality formula.
                // Anti-tone map to reduce contrast and drag dark region farther
                // (x^0.2 + 1.2 * x^4)/2.2
                "A = (pow(A, 0.2) + 1.2 * A*A*A*A) / 2.2;",
                "#endif",

                // Bilateral box-filter over a quad for free, respecting depth edges
                // (the difference that this makes is subtle)
                //"if (abs(dFdx(C.z)) < 0.02) {",
                //    "A -= dFdx(A) * ((ssC.x & 1) - 0.5);",
                //"}",
                //"if (abs(dFdy(C.z)) < 0.02) {",
                //    "A -= dFdy(A) * ((ssC.y & 1) - 0.5);",
                //"}",
                //ARGH no integer ops in WebGL, fake the & 1 here
                // This code has been removed by the creator of the algorithm, see:
                // http://g3d.cs.williams.edu/websvn/filedetails.php?repname=g3d&path=%2FG3D10%2Fdata-files%2Fshader%2FAmbientOcclusion%2FAmbientOcclusion_AO.pix
                // In practice it seems to make no difference visually, but matters for
                // time spent in the benchmark! We see drops on 80 spheres metal and red of 20%. Weird.
                // So, we'll leave it in.
                "if (abs(dFdx(C.z)) < 0.02) {",
                    "A -= dFdx(A) * (mod(float(ssC.x), 2.0) - 0.5);",
                "}",
                "if (abs(dFdy(C.z)) < 0.02) {",
                    "A -= dFdy(A) * (mod(float(ssC.y), 2.0) - 0.5);",
                "}",

                // Fade in as the radius reaches 2 pixels
                "A = mix(1.0, A, clamp(ssDiskRadius - MIN_RADIUS,0.0,1.0));",
            "}",

            "gl_FragColor.r = A;",
            "gl_FragColor.a = 1.0;",

            // to show depths instead of SAO, uncomment:
            //"gl_FragColor.r = CSZToKey(C.z);",
            // to show normal component (pick one, x or y):
            //"gl_FragColor.r = nrmz.x;",

            "}"

        ].join("\n")


    };

    return SAOShader;
});