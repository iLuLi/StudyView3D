define([
    './Chunks/PackNormalsShaderChunk',
    './Chunks/CutPlanesShaderChunk'
], function(PackNormalsShaderChunk, CutPlanesShaderChunk) {
    'use strict';
    var NormalsShader = {
        
        uniforms: {

            //"opacity" : { type: "f", value: 1.0 }
            "cutplanes": { type: "v4v", value: [] }
        },

        vertexShader: [

            "varying vec3 vNormal;",
            "varying float depth;",

            "#if NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",

            PackNormalsShaderChunk,

            "void main() {",

                "#ifdef UNPACK_NORMALS",
                    "vec3 objectNormal = decodeNormal(normal);",
                "#else",
                    "vec3 objectNormal = normal;",
                "#endif",

                "#ifdef FLIP_SIDED",
                    "objectNormal = -objectNormal;",
                "#endif",

                "vec3 transformedNormal = normalMatrix * objectNormal;",

                "vNormal = normalize( transformedNormal );",

            "#if NUM_CUTPLANES > 0",
            "    vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
            "    vWorldPosition = worldPosition.xyz;",
            "#endif",

                "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
                "depth = mvPosition.z;",

                "vec4 p_Position = projectionMatrix * mvPosition;",
                "gl_Position = p_Position;",
            "}"

        ].join("\n"),

        fragmentShader: [

            "varying highp vec3 vNormal;",
            "varying highp float depth;",

            "#if NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",
            CutPlanesShaderChunk,

            "void main() {",
                "#if NUM_CUTPLANES > 0",
                    "checkCutPlanes(vWorldPosition);",
                "#endif",

                "vec3 n = vNormal;",
                //Invert normal in case of back side
                //"#ifdef DOUBLE_SIDED",
                "n = n * ( -1.0 + 2.0 * float( gl_FrontFacing ) );",
                //"#endif",

                // If a model has reversed normals, this line will fix it:
                //"if ( n.z < 0.0 ) { n = -n; }",
                // To be honest, better yet might be
                //"if ( n.z < -0.05 ) { n = -n; }",
                // because you *can* have interpolated normals that really do
                // point away a bit, along the silhouettes, and it's good to not reverse these.
                // Really, it's a case of GIGO - the model itself should be fixed.
                // Also, you'd have to reverse the normals for shading itself in the various
                // shaders, in a similar way: "if pointing mostly away, reverse", which will not
                // work properly near silhouette edges.

                //TODO: it's possible that we have to clamp the values
                //to range 0-1 -- check no weaker GL ES platforms.
                "n = normalize( n );",

                //NOTE: Dropping the Z coordinate of the normal entirely means
                //that we lose information about its sign (we use sqrt to restore it later).
                //This is OK in this case because in view space surfaces that we see will have
                //positive Z component in all cases. If that changes we have to also
                //encode the sign bit in the x or y.
                "gl_FragColor = vec4(n.x, n.y, depth, 1.0);",
            "}"

        ].join("\n")

    };

    return NormalsShader;
});