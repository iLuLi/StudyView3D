define(function() {;
    'use strict'
    return [
        //Packs a float in the range 0-1 to an RGBA8
        "vec4 packDepth( const in float depth ) {",
            "vec4 enc = vec4(1.0, 255.0, 65025.0, 160581375.0) * depth;",
            "enc = fract(enc);",
            "enc -= enc.yzww * vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);",
            "return enc;",
        "}",

        //Used to unpack depth value when input depth texture is RGBA8
        "float unpackDepth( const in vec4 rgba_depth ) {",
            "return dot( rgba_depth, vec4(1.0, 1.0/255.0, 1.0/65025.0, 1.0/160581375.0) );",
        "}",
    ].join("\n");
});