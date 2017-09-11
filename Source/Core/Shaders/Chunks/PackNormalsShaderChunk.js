define(function() {;
    'use strict'
    return [
        
    //See http://aras-p.info/texts/CompactNormalStorage.html
    //Currently using the slow and simple approach of mapping 3d normal to two spherical coords.
    //TODO try other, cheaper ways to encode the normal.

    "#define kPI 3.14159265358979",
    "vec2 encodeNormal (vec3 n)",
    "{",
        "return (vec2(atan(n.y,n.x)/kPI, n.z)+1.0)*0.5;",
    "}",

    "vec3 decodeNormal (vec2 enc)",
    "{",
        "vec2 ang = enc * 2.0 - 1.0;",
        "vec2 scth = vec2(sin(ang.x * kPI), cos(ang.x * kPI));",
        //"sincos(ang.x * kPI, scth.x, scth.y);",
        "vec2 scphi = vec2(sqrt(1.0 - ang.y * ang.y), ang.y);",
        "return vec3(scth.y * scphi.x, scth.x * scphi.x, scphi.y);",
    "}",

    ].join("\n");
});