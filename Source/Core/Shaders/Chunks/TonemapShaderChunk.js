define(function() {;
    'use strict'
    return [
        //post-gamma luminance
        "float luminance_post(vec3 rgb) {",
        "return dot(rgb, vec3(0.299, 0.587, 0.114));",
        "}",

        //pre-gamma luminance
        "float luminance_pre(vec3 rgb) {",
            "return dot(rgb, vec3(0.212671, 0.715160, 0.072169));",
        "}",


        "vec3 xyz2rgb(vec3 xyz) {",
            //XYZ -> RGB conversion matrix using HDTV constants
            "vec3 R = vec3( 3.240479, -1.537150, -0.498535);",
            "vec3 G = vec3(-0.969256,  1.875992,  0.041556);",
            "vec3 B = vec3( 0.055648, -0.204043,  1.057311);",

            "vec3 rgb;",
            "rgb.b = dot(xyz, B);",
            "rgb.g = dot(xyz, G);",
            "rgb.r = dot(xyz, R);",

            "return rgb;",
        "}",

        "vec3 rgb2xyz(vec3 rgb) {",
            //RGB -> XYZ conversion matrix using HDTV constants
            "vec3 X = vec3(0.412453, 0.35758, 0.180423);",
            "vec3 Y = vec3(0.212671, 0.71516, 0.0721688);",
            "vec3 Z = vec3(0.0193338, 0.119194, 0.950227);",

            "vec3 xyz;",
            "xyz.x = dot(rgb, X);",
            "xyz.y = dot(rgb, Y);",
            "xyz.z = dot(rgb, Z);",

            "return xyz;",
        "}",

        "vec3 xyz2xyY(vec3 xyz) {",
            "float sum = xyz.x + xyz.y + xyz.z;",

            //Note in case of division by 0, the hardware
            //should output zero for sum, so we are still ok with the result
            "sum = 1.0 / sum;",

            "vec3 xyY;",
            "xyY.z = xyz.y;",
            "xyY.x = xyz.x * sum;",
            "xyY.y = xyz.y * sum;",

            "return xyY;",
        "}",

        "vec3 xyY2xyz(vec3 xyY) {",

            "float x = xyY.x;",
            "float y = xyY.y;",
            "float Y = xyY.z;",

            "vec3 xyz;",
            "xyz.y = Y;",
            "xyz.x = x * (Y / y);",
            "xyz.z = (1.0 - x - y) * (Y / y);",

            "return xyz;",
        "}",



        //OGS/RaaS Cannon tonemappong with ColorPerserving enabled.
        "float toneMapCanon_T(float x)",
        "{",
            // this function fits the measured Canon sigmoid *without gamma correction* through 0.0
            "float xpow = pow(x, 1.60525727);",
            "float tmp = ((1.05542877*4.68037409)*xpow) / (4.68037409*xpow + 1.0);",
            "return clamp(tmp, 0.0, 1.0);",
        "}",


        "const float Shift = 1.0 / 0.18;",

        //Best fit of John Hable's generalized filmic function parameters to the Canon curve
        //This is a significantly better and cheaper to compute fit than the power and polynomial
        //least squares fits from OGS/RaaS (which have larger max and average error, and also go negative near
        //the origin).
        "float toneMapCanonFilmic_NoGamma(float x) {",

            //This extra exposure by 1.0/0.18 mimics what is also done in OGS's implementation
            //and the curve fit was done with this scale in mind.
            "x *= Shift;",

            "const float A = 0.2;", //shoulder strength
            "const float B = 0.34;", //linear strength
            "const float C = 0.002;", //linear angle
            "const float D = 1.68;", //toe strength
            "const float E = 0.0005;", //toe numerator
            "const float F = 0.252;", //toe denominator (E/F = toe angle)
            "const float scale = 1.0/0.833837;",

            "return (((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F) * scale;",
        "}",


        //Same as above but with 2.2 gamma built into the fit and working on the
        //whole RGB triplet at once (i.e. non color preserving version).
        "vec3 toneMapCanonFilmic_WithGamma(vec3 x) {",

            //This extra exposure by 1.0/0.18 mimics what is also done in OGS's implementation
            //and the curve fit was done with this scale in mind.
            "x *= Shift;",

            //Best overall error params
    /*
            "const float A = 0.2;",
            "const float B = 0.23;",
            "const float C = 0.147;",
            "const float D = 0.26;",
            //"const float E = 0.0;",
            "const float F = 0.22;",
            "const float scale = 1.0/0.900202;",
    */

            //Best max deviation params
            "const float A = 0.27;",
            "const float B = 0.29;",
            "const float C = 0.052;",
            "const float D = 0.2;",
            //"const float E = 0.0;",
            "const float F = 0.18;",
            "const float scale = 1.0/0.897105;",

            "return (((x*(A*x+C*B))/(x*(A*x+B)+D*F))) * scale;",
        "}",


        "vec3 toneMapCanonOGS_WithGamma_WithColorPerserving(vec3 x) {",
            "vec3 outColor = x.rgb;",
            "outColor = min(outColor, vec3(3.0));",
            "float inLum = luminance_pre(outColor);",
            "if (inLum > 0.0) {",
                "float outLum = toneMapCanon_T(inLum);",
                "outColor = outColor * (outLum / inLum);",
                "outColor = clamp(outColor, vec3(0.0), vec3(1.0));",
            "}",
            "float gamma = 1.0/2.2;",
            "outColor = pow(outColor, vec3(gamma));",
            "return outColor;",
        "}"

    ].join("\n");

});