define(function() {;
    'use strict'
    //Trivial copy pass
    var CopyShader = {

        uniforms: {
            "tDiffuse": { type: "t", value: null }
        },

        vertexShader: [

            "varying vec2 vUv;",

            "void main() {",

                "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
                "vUv = uv;",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform sampler2D tDiffuse;",

            "varying vec2 vUv;",

            "void main() {",

                "gl_FragColor = texture2D(tDiffuse, vUv);",

            "}"

        ].join("\n")

    };

    return CopyShader;
});