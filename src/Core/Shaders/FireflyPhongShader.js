define([
    './Chunks/PackNormalsShaderChunk',
    './Chunks/EnvSamplingShaderChunk',
    './Chunks/TonemapShaderChunk',
    './Declarations/IdFragmentDeclaration',
    './Declarations/ThemingFragmentDeclaration',
    './Chunks/HatchPatternShaderChunk',
    './Chunks/CutPlanesShaderChunk',
    './Chunks/ThemingFragmentShaderChunk',
    './Chunks/FinalOutputShaderChunk',
    './Uniforms/CutPlanesUniforms',
    './Uniforms/IdUniforms',
    './Uniforms/ThemingUniform'
], function(
    PackNormalsShaderChunk,
    EnvSamplingShaderChunk,
    TonemapShaderChunk,
    IdFragmentDeclaration,
    ThemingFragmentDeclaration,
    HatchPatternShaderChunk,
    CutPlanesShaderChunk,
    ThemingFragmentShaderChunk,
    FinalOutputShaderChunk,
    CutPlanesUniforms,
    IdUniforms,
    ThemingUniform
) {
    'use strict';
    
    var FireflyPhongShader = {
        
        uniforms: THREE.UniformsUtils.merge([

            THREE.UniformsLib["common"],
            THREE.UniformsLib["bump"],
            THREE.UniformsLib["normalmap"],
            THREE.UniformsLib["lights"],
            CutPlanesUniforms,
            IdUniforms,
            ThemingUniform,

            {
                "emissive": { type: "c", value: new THREE.Color(0x000000) },
                "specular": { type: "c", value: new THREE.Color(0x111111) },
                "shininess": { type: "f", value: 30 },
                "reflMipIndex": { type: "f", value: 0 },

                "texMatrix": { type: "m3", value: new THREE.Matrix3() },
                "texMatrixBump": { type: "m3", value: new THREE.Matrix3() },
                "texMatrixAlpha": { type: "m3", value: new THREE.Matrix3() },

                "irradianceMap": { type: "t", value: null },
                "exposureBias": { type: "f", value: 1.0 },
                "envMapExposure": { type: "f", value: 1.0 },
                "envRotationSin": { type: "f", value: 0.0 },
                "envRotationCos": { type: "f", value: 1.0 },
            }

        ]),

        vertexShader: [

            "varying vec3 vViewPosition;",
            "#ifndef FLAT_SHADED",
                "varying vec3 vNormal;",
            "#endif",

            "#if defined( USE_MAP ) || defined( USE_SPECULARMAP )",
                "varying vec2 vUv;",
                "uniform mat3 texMatrix;",
            "#endif",

            "#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )",
                "varying vec2 vUvBump;",
                "uniform mat3 texMatrixBump;",
            "#endif",

            "#if defined( USE_ALPHAMAP )",
                "varying vec2 vUvAlpha;",
                "uniform mat3 texMatrixAlpha;",
            "#endif",

            "#if defined( USE_ENVMAP )",
                "#if ! defined( USE_BUMPMAP ) && ! defined( USE_NORMALMAP )",
                    "uniform float refractionRatio;",
                "#endif",
            "#endif",

            "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",

            "#ifdef USE_COLOR",
                "varying vec3 vColor;",
            "#endif",

//TODO: vFragDepth and depth varyings are basically the same ( vFragDepth = 1.0 - depth ) so they can be combined into one
            "#ifdef USE_LOGDEPTHBUF",
                "#ifdef USE_LOGDEPTHBUF_EXT",
                    "varying float vFragDepth;",
                "#endif",
                "uniform float logDepthBufFC;",
            "#endif",

            "#ifdef MRT_NORMALS",
                "varying float depth;",
            "#endif",

            PackNormalsShaderChunk,

            "void main() {",

                "#if defined( USE_MAP ) || defined( USE_SPECULARMAP )",
                    "vUv = (texMatrix * vec3(uv, 1.0)).xy;",
                "#endif",

                "#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )",
                    "vUvBump = (texMatrixBump * vec3(uv, 1.0)).xy;",
                "#endif",

                "#if defined( USE_ALPHAMAP )",
                    "vUvAlpha = (texMatrixAlpha * vec3(uv, 1.0)).xy;",
                "#endif",


                "#ifdef USE_COLOR",
                    "#ifdef GAMMA_INPUT",
                        "vColor = color * color;",
                    "#else",
                        "vColor = color;",
                    "#endif",
                "#endif",

                "#ifdef UNPACK_NORMALS",
                    "vec3 objectNormal = decodeNormal(normal);",
                "#else",
                    "vec3 objectNormal = normal;",
                "#endif",

                "#ifdef FLIP_SIDED",
                    "objectNormal = -objectNormal;",
                "#endif",

                "vec3 transformedNormal = normalMatrix * objectNormal;",

                "#ifndef FLAT_SHADED",
                    "vNormal = normalize( transformedNormal );",
                "#endif",

                "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

                "gl_Position = projectionMatrix * mvPosition;",

                "vViewPosition = -mvPosition.xyz;",

                "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                    "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
                    "vWorldPosition = worldPosition.xyz;",
                "#endif",

//TODO: vFragDepth and depth varyings are basically the same ( vFragDepth = 1.0 - depth ) so they can be combined into one
                "#ifdef USE_LOGDEPTHBUF",
                    "if (projectionMatrix[3][3] == 0.0) {",
                        "gl_Position.z = log2(max(1.0e-6, gl_Position.w + 1.0)) * logDepthBufFC;",
                        "#ifdef USE_LOGDEPTHBUF_EXT",
                            "vFragDepth = 1.0 + gl_Position.w;",
                        "#else",
                            "gl_Position.z = (gl_Position.z - 1.0) * gl_Position.w;",
                        "#endif",
                    "} else {", //Ortho projection -- do we really want log here, or can we just go with linear depth?
                        //"gl_Position.z = log2(max(1e-6, vViewPosition.z + 1.0)) * logDepthBufFC;",
                        "#ifdef USE_LOGDEPTHBUF_EXT",
                            "vFragDepth = 1.0 + vViewPosition.z;",
                        "#else",
                            //"gl_Position.z = (gl_Position.z - 1.0) * vViewPosition.z;",
                        "#endif",
                    "}",
                "#endif",

                "#ifdef MRT_NORMALS",
                    "depth = mvPosition.z;",
                "#endif",

            "}"


        ].join("\n"),

        fragmentShader: [

            "uniform vec3 diffuse;",
            "uniform float opacity;",

            "uniform vec3 emissive;",
            "uniform vec3 specular;",
            "uniform float shininess;",

            EnvSamplingShaderChunk,

            "#ifdef USE_COLOR",
                "varying vec3 vColor;",
            "#endif",

            "#ifdef GAMMA_INPUT",
                "vec3 InputToLinear(vec3 c) {",
                    "return c * c;",
                "}",
                "float InputToLinear(float c) {",
                    "return c * c;",
                "}",
            "#else",
                "vec3 InputToLinear(vec3 c) {",
                    "return c;",
                "}",
                "float InputToLinear(float c) {",
                    "return c;",
                "}",
            "#endif",

            "#if defined( USE_MAP ) || defined( USE_SPECULARMAP )",
                "varying vec2 vUv;",
            "#endif",

            "#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )",
                "varying vec2 vUvBump;",
            "#endif",

            "#if defined( USE_ALPHAMAP )",
                "varying vec2 vUvAlpha;",
            "#endif",

            "#ifdef USE_MAP",
                "uniform sampler2D map;",
            "#endif",

            "#if TONEMAP_OUTPUT > 0",
                "uniform float exposureBias;",
                TonemapShaderChunk,
            "#endif",

            "#if defined(IRR_RGBM) || defined(ENV_RGBM) || defined(ENV_GAMMA) || defined(IRR_GAMMA)",
                "uniform float envMapExposure;",
            "#endif",

            IdFragmentDeclaration,
            ThemingFragmentDeclaration,

            //NOTE: This depends on the specific encoding used.
            //We use the environment preset's built in exposure correction,
            //a gamma of 2.0 and an extra factor of 16
            //when generating the cube map in the modified CubeMapGen tool
            //See this article by Karis for details: http://graphicrants.blogspot.ca/2009/04/rgbm-color-encoding.html
            "vec3 RGBMDecode(in vec4 vRGBM, in float exposure) {",
                "vec3 ret = vRGBM.rgb * (vRGBM.a * 16.0);", //vairable factor in alpha channel + fixed factor of 16.0
                "ret *= ret;", //remove gamma of 2.0 to go into linear space
                "ret *= exposure;", //apply exposure to get back original intensity
                "return ret;",
            "}",

            //Gamma encoded half-float or float input texture. See DecodeEnvMap in Environments.js for details.
            "vec3 GammaDecode(in vec4 vRGBA, in float exposure) {",
                "return vRGBA.xyz * vRGBA.xyz * exposure;",
            "}",

            "#ifdef USE_ENVMAP",

                "uniform float reflMipIndex;",

                "uniform float reflectivity;",
                "uniform samplerCube envMap;",

                "#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )",

                    "uniform float refractionRatio;",

                "#endif",

                "vec3 sampleReflection(vec3 dir, float mipIndex) {",

                    "vec3 adjDir = adjustLookupVector(dir);",

                    "#ifdef ENV_GAMMA",

                        "#ifdef HAVE_TEXTURE_LOD",
                            "vec4 envTexColor = textureCubeLodEXT( envMap, adjDir, mipIndex );",
                        "#else",
                            //NOTE that the computation in case the -LOD extension is not available is
                            //not really correct as the mip bias is not going to be equivalent in some cases.
                            "vec4 envTexColor = textureCube( envMap, adjDir, mipIndex );",
                        "#endif",

                        "return GammaDecode(envTexColor, envMapExposure);",

                    "#elif defined(ENV_RGBM)",

                        "#ifdef HAVE_TEXTURE_LOD",
                            "vec4 envTexColor = textureCubeLodEXT( envMap, adjDir, mipIndex );",
                        "#else",
                            //NOTE that the computation in case the -LOD extension is not available is
                            //not really correct as the mip bias is not going to be equivalent in some cases.
                            "vec4 envTexColor = textureCube( envMap, adjDir, mipIndex );",
                        "#endif",

                        "return RGBMDecode(envTexColor, envMapExposure);",

                    "#else",

                        //Assumes this code path is non-HDR and non-blurred reflection map, like vanilla three.js

                        "vec4 envTexColor = textureCube( envMap, adjDir );",
                        "vec3 cubeColor = envTexColor.xyz;",

                        "#ifdef GAMMA_INPUT",
                            "cubeColor *= cubeColor;",
                        "#endif",

                        "return cubeColor;",

                    "#endif",

                "}",

            "#endif",


            "uniform vec3 ambientLightColor;",

            "#if MAX_DIR_LIGHTS > 0",

                "uniform vec3 directionalLightColor[ MAX_DIR_LIGHTS ];",
                "uniform vec3 directionalLightDirection[ MAX_DIR_LIGHTS ];",

            "#endif",

            "#if MAX_POINT_LIGHTS > 0",

                "uniform vec3 pointLightColor[ MAX_POINT_LIGHTS ];",

                "uniform vec3 pointLightPosition[ MAX_POINT_LIGHTS ];",
                "uniform float pointLightDistance[ MAX_POINT_LIGHTS ];",

            "#endif",

            "#if MAX_SPOT_LIGHTS > 0",

                "uniform vec3 spotLightColor[ MAX_SPOT_LIGHTS ];",
                "uniform vec3 spotLightPosition[ MAX_SPOT_LIGHTS ];",
                "uniform vec3 spotLightDirection[ MAX_SPOT_LIGHTS ];",
                "uniform float spotLightAngleCos[ MAX_SPOT_LIGHTS ];",
                "uniform float spotLightExponent[ MAX_SPOT_LIGHTS ];",

                "uniform float spotLightDistance[ MAX_SPOT_LIGHTS ];",

            "#endif",

            "#ifdef USE_IRRADIANCEMAP",
                "uniform samplerCube irradianceMap;",
            "#endif",

            "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                "varying highp vec3 vWorldPosition;",
            "#endif",

            "varying highp vec3 vViewPosition;",
            "#ifndef FLAT_SHADED",
                "varying highp vec3 vNormal;",
            "#endif",

            "#ifdef USE_BUMPMAP",

                "uniform sampler2D bumpMap;",
                "uniform float bumpScale;",

                // Derivative maps - bump mapping unparametrized surfaces by Morten Mikkelsen
                //  http://mmikkelsen3d.blogspot.sk/2011/07/derivative-maps.html

                // Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

                "vec2 dHdxy_fwd() {",

                    "vec2 dSTdx = dFdx( vUvBump );",
                    "vec2 dSTdy = dFdy( vUvBump );",

                    "float Hll = bumpScale * GET_BUMPMAP(vUvBump).x;",
                    "float dBx = bumpScale * GET_BUMPMAP(vUvBump + dSTdx).x - Hll;",
                    "float dBy = bumpScale * GET_BUMPMAP(vUvBump + dSTdy).x - Hll;",

                    "return vec2( dBx, dBy );",

                "}",

                "vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy ) {",

                    "vec3 vSigmaX = dFdx( surf_pos );",
                    "vec3 vSigmaY = dFdy( surf_pos );",
                    "vec3 vN = surf_norm;",     // normalized

                    "vec3 R1 = cross( vSigmaY, vN );",
                    "vec3 R2 = cross( vN, vSigmaX );",

                    "float fDet = dot( vSigmaX, R1 );",

                    "vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );",
                    "return normalize( abs( fDet ) * surf_norm - vGrad );",

                "}",

            "#endif",


            "#ifdef USE_NORMALMAP",

                "uniform sampler2D normalMap;",
                "uniform vec2 normalScale;",

                // Per-Pixel Tangent Space Normal Mapping
                // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html

                "vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm ) {",

                    "vec3 q0 = dFdx( eye_pos.xyz );",
                    "vec3 q1 = dFdy( eye_pos.xyz );",
                    "vec2 st0 = dFdx( vUvBump.st );",
                    "vec2 st1 = dFdy( vUvBump.st );",

                    "vec3 S = normalize(  q0 * st1.t - q1 * st0.t );",
                    "vec3 T = normalize( -q0 * st1.s + q1 * st0.s );",
                    "vec3 N = normalize( surf_norm );",

                    "vec3 mapN = GET_NORMALMAP(vUvBump).xyz * 2.0 - 1.0;",
                    "mapN.xy = normalScale * mapN.xy;",
                    "mat3 tsn = mat3( S, T, N );",
                    "return normalize( tsn * mapN );",

                "}",

            "#endif",


            "#ifdef USE_SPECULARMAP",
                "uniform sampler2D specularMap;",
            "#endif",

            "#ifdef USE_ALPHAMAP",
                "uniform sampler2D alphaMap;",
            "#endif",

            HatchPatternShaderChunk,

            "#ifdef USE_LOGDEPTHBUF",
                "uniform float logDepthBufFC;",
                "#ifdef USE_LOGDEPTHBUF_EXT",
                    "#extension GL_EXT_frag_depth : enable",
                    "varying highp float vFragDepth;",
                "#endif",
            "#endif",

            "vec3 Schlick_v3(vec3 v, float cosHV) {",
                "float facing = max(1.0 - cosHV, 0.0);",
                "float facing2 = facing * facing;",
                "return v + (1.0 - v) * facing * facing2 * facing2;",
            "}",

            "float Schlick_f(float v, float cosHV) {",
                "float facing = max(1.0 - cosHV, 0.0);",
                "float facing2 = facing * facing;",
                "return v + ( 1.0 - v ) * facing2 * facing2 * facing;",
            "}",

            CutPlanesShaderChunk,

            "void main() {",

                "#if NUM_CUTPLANES > 0",
                    "checkCutPlanes(vWorldPosition);",
                "#endif",

                "gl_FragColor = vec4( vec3 ( 1.0 ), opacity );",

                "#ifdef USE_MAP",
                    "vec4 texelColor = GET_MAP(vUv);",
                    "#ifdef MAP_INVERT",
                        "texelColor.xyz = 1.0-texelColor.xyz;",
                    "#endif",
                    "#ifdef GAMMA_INPUT",
                        "texelColor.xyz *= texelColor.xyz;",
                    "#endif",
                    "gl_FragColor = gl_FragColor * texelColor;",
                "#endif",

                "#ifdef USE_ALPHAMAP",
                    "vec4 texelAlpha = GET_ALPHAMAP(vUvAlpha);",
                    "gl_FragColor.a *= texelAlpha.r;",
                "#endif",

                "#ifdef ALPHATEST",
                    "if ( gl_FragColor.a < ALPHATEST ) discard;",
                "#endif",

                "float specularStrength;",

                "#ifdef USE_SPECULARMAP",
                    "vec4 texelSpecular = GET_SPECULARMAP(vUv);",
                    "specularStrength = texelSpecular.r;",
                "#else",
                    "specularStrength = 1.0;",
                "#endif",

                "#ifndef FLAT_SHADED",
                    "vec3 normal = normalize( vNormal );",
                    "#ifdef DOUBLE_SIDED",
                        "normal = normal * ( -1.0 + 2.0 * float( gl_FrontFacing ) );",
                    "#endif",
                "#else",
                    "vec3 fdx = dFdx( vViewPosition );",
                    "vec3 fdy = dFdy( vViewPosition );",
                    "vec3 normal = normalize( cross( fdx, fdy ) );",
                "#endif",

                "vec3 geomNormal = normal;",

                "#ifdef USE_NORMALMAP",
                    "normal = perturbNormal2Arb( -vViewPosition, normal );",
                "#elif defined( USE_BUMPMAP )",
                    "normal = perturbNormalArb( -vViewPosition, normal, dHdxy_fwd() );",
                "#endif",

                //With ortho projection, the view direction needs to be
                //adjusted so that all view direction rays (for all pixels) are parallel
                //instead of going from the camera position directly to the vertex like
                //in perspective. In view space, this is kind of easy -- the view vector is along Z.
                //TODO: Actially the vViewPosition varying is the position of the camers wrt the vertex
                //so the naming of the variable can be clarified.
                "vec3 viewDirection;",
                "if (projectionMatrix[3][3] == 0.0) {",
                    "viewDirection = normalize( vViewPosition );",
                "} else {",
                    "viewDirection = vec3(0.0, 0.0, 1.0);",
                "}",

                "vec3 totalDiffuse = vec3( 0.0 );",
                "vec3 totalSpecular = vec3( 0.0 );",

                //Convert shininess from Phong to Blinn. The blurred environment is
                //sampled using Phong exponent, while the light math uses Blinn model.
                "float shininessB = shininess * 4.0;",

                "#if MAX_POINT_LIGHTS > 0",

                    "vec3 pointDiffuse  = vec3( 0.0 );",
                    "vec3 pointSpecular = vec3( 0.0 );",

                    "for ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",

                        "vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",
                        "vec3 lVector = lPosition.xyz + vViewPosition.xyz;",

                        "float lDistance = 1.0;",
                        "if ( pointLightDistance[ i ] > 0.0 )",
                            "lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",

                        "lVector = normalize( lVector );",

                        // diffuse

                        "float dotProduct = dot( normal, lVector );",

                        "float pointDiffuseWeight = max( dotProduct, 0.0 );",


                        "pointDiffuse  += InputToLinear(diffuse) * InputToLinear(pointLightColor[ i ]) * pointDiffuseWeight * lDistance;",

                        // specular

                        "vec3 pointHalfVector = normalize( lVector + viewDirection );",
                        "float pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );",

                        "float pointSpecularWeight = specularStrength * max( pow( pointDotNormalHalf, shininessB ), 0.0 );",
                        "float specularNormalization = shininessB * 0.125 + 0.25;", //(shininess+2)/8
                        "vec3 schlick = Schlick_v3(InputToLinear(specular), dot( lVector, pointHalfVector ) );",
                        "pointSpecular += schlick * InputToLinear(pointLightColor[ i ]) * pointSpecularWeight * pointDiffuseWeight * lDistance * specularNormalization ;",

                    "}",

                    "totalDiffuse += pointDiffuse;",
                    "totalSpecular += pointSpecular;",

                "#endif",

                "#if MAX_SPOT_LIGHTS > 0",

                    "vec3 spotDiffuse  = vec3( 0.0 );",
                    "vec3 spotSpecular = vec3( 0.0 );",

                    "for ( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {",

                        "vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );",
                        "vec3 lVector = lPosition.xyz + vViewPosition.xyz;",

                        "float lDistance = 1.0;",
                        "if ( spotLightDistance[ i ] > 0.0 )",
                            "lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );",

                        "lVector = normalize( lVector );",

                        "float spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );",

                        "if ( spotEffect > spotLightAngleCos[ i ] ) {",

                            "spotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );",

                            // diffuse

                            "float dotProduct = dot( normal, lVector );",

                            "float spotDiffuseWeight = max( dotProduct, 0.0 );",

                            "spotDiffuse += InputToLinear(diffuse) * InputToLinear(spotLightColor[ i ]) * spotDiffuseWeight * lDistance * spotEffect;",

                            // specular

                            "vec3 spotHalfVector = normalize( lVector + viewDirection );",
                            "float spotDotNormalHalf = max( dot( normal, spotHalfVector ), 0.0 );",
                            "float spotSpecularWeight = specularStrength * max( pow( spotDotNormalHalf, shininessB ), 0.0 );",

                            "float specularNormalization = shininessB * 0.125 + 0.25;", //(shininess+2)/8
                            "vec3 schlick = Schlick_v3(InputToLinear(specular), dot( lVector, spotHalfVector ) );",
                            "spotSpecular += schlick * InputToLinear(spotLightColor[ i ]) * spotSpecularWeight * spotDiffuseWeight * lDistance * specularNormalization * spotEffect;",
                        "}",

                    "}",

                    "totalDiffuse += spotDiffuse;",
                    "totalSpecular += spotSpecular;",

                "#endif",

                "#if MAX_DIR_LIGHTS > 0",

                    "vec3 dirDiffuse  = vec3( 0.0 );",
                    "vec3 dirSpecular = vec3( 0.0 );",

                    "for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {",

                        "vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
                        "vec3 dirVector = normalize( lDirection.xyz );",

                        // diffuse

                        "float dotProduct = dot( normal, dirVector );",

                        "float dirDiffuseWeight = max( dotProduct, 0.0 );",

                        "dirDiffuse  += InputToLinear(diffuse) * InputToLinear(directionalLightColor[ i ]) * dirDiffuseWeight;",

                        // specular

                        "vec3 dirHalfVector = normalize( dirVector + viewDirection );",
                        "float dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );",
                        "float dirSpecularWeight = specularStrength * max( pow( dirDotNormalHalf, shininessB ), 0.0 );",

                        "float specularNormalization = shininessB * 0.125 + 0.25;", //(shininess+2)/8
                        "vec3 schlick = Schlick_v3(InputToLinear(specular), dot( dirVector, dirHalfVector ));",

                        "dirSpecular += schlick * InputToLinear(directionalLightColor[ i ]) * dirSpecularWeight * dirDiffuseWeight * specularNormalization;",

                    "}",

                    "totalDiffuse += dirDiffuse;",
                    "totalSpecular += dirSpecular;",

                "#endif",



                "#ifdef USE_IRRADIANCEMAP",
                    "vec3 worldNormal = mat3(viewMatrixInverse) * normal;",

                    "vec4 cubeColor4 = textureCube(irradianceMap, adjustLookupVector(worldNormal));",

                    "#ifdef IRR_GAMMA",

                        "vec3 indirectDiffuse = GammaDecode(cubeColor4, envMapExposure);",

                    "#elif defined(IRR_RGBM)",

                        "vec3 indirectDiffuse = RGBMDecode(cubeColor4, envMapExposure);",

                    "#else",

                        "vec3 indirectDiffuse = cubeColor4.xyz;",

                        "#ifdef GAMMA_INPUT",
                            "indirectDiffuse.xyz *= indirectDiffuse.xyz;",
                        "#endif",

                    "#endif",

                    "totalDiffuse += InputToLinear(diffuse) * indirectDiffuse;",
                "#endif",


                "#ifdef METAL",
                    "gl_FragColor.xyz = gl_FragColor.xyz * ( InputToLinear(emissive) + totalDiffuse + ambientLightColor * InputToLinear(diffuse) + totalSpecular );",
                "#else",
                    "gl_FragColor.xyz = gl_FragColor.xyz * ( InputToLinear(emissive) + totalDiffuse + ambientLightColor * InputToLinear(diffuse) ) + totalSpecular;",
                "#endif",


                //Modulate base color with vertex color, if any
                "#ifdef USE_COLOR",
                    "gl_FragColor = gl_FragColor * vec4( vColor, 1.0 );",
                "#endif",


                "#if defined(USE_ENVMAP)",

                    "vec3 reflectVec;",

                    "#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP )",

                        "#ifdef ENVMAP_MODE_REFLECTION",
                            "reflectVec = reflect( -viewDirection, normal );",
                        "#else ",
                            "reflectVec = refract( -viewDirection, normal, refractionRatio );",
                        "#endif",

                    "#else",

                        "reflectVec = reflect( -viewDirection, normal );",

                    "#endif",

                    "reflectVec = mat3(viewMatrixInverse) * reflectVec;",

                    //If the reflection vector points into the ground, we will scale
                    //down the reflection intensity, in order to fake interference with the
                    //ground plane and avoid an eclipse-like light-dark line between the object
                    //and its shadow.
                    //The actual scaling is made up so that it gets very dark near the ground facing faces
                    //"float reflectScale = 1.0 - clamp(-reflectVec.y, 0.0, 1.0);",
                    //"reflectScale *= (reflectScale * reflectScale);",
                    "float reflectScale = 1.0;",

                    //The environment cube map is blurred with the assumption that
                    //max shininess is 2048 and every mip drops that by a factor of 4
                    //"float MipmapIndex = log(shininess / 2048.0) / log(0.25);",
                    //The simplification below was given in the original source for this method.
                    //However, it does not seem to match the equation above, so we use a corrected one.
                    //"float MipmapIndex = max(0.0, -1.66096404744368 * logShiny + 5.5);",
                    //"float logShiny = log(max(1.0+1e-10, shininess));",
                    //"float reflMipIndex = max(0.0, -0.72134752 * logShiny + 5.5);",
                    //NOTE: The mip index is passed in as uniform in case where shininess is constant.
                    //If we get roughness map support, we'd have to sample the roughness map here to get a mip index.

                    "vec3 cubeColor = sampleReflection(reflectVec, reflMipIndex);",

                    "cubeColor *= reflectScale;",

                    "float facing = dot( viewDirection, geomNormal );",

                    //Argh. If facing is very much below the horizon, it's probably
                    //a backwards facing polygon, so turn off Fresnel completely.
                    //Otherwise, if it's just slightly below, it's probably some interpolation
                    //artifact, so we treat it as almost oblique facing.
                    "if (facing < -1e-2)",
                        "facing = 1.0;",
                    "else",
                        "facing = max(1e-6, facing);",

                    "vec3 schlickRefl;",

                    "#ifdef METAL",

                        //Metals do not generally have Fresnel reflection
                        "schlickRefl = InputToLinear(specular);",

                    "#else",

                        //Nonmetals reflect using Fresnel -- so they reflect a lot at grazing angles
                        "schlickRefl = Schlick_v3(InputToLinear(specular), facing);",

                        //Seems appropriate to also reduce transparency of the material as
                        //the view angle is more oblique:
                        //BOGUS: The scaling by reflectivity is not physical -- here
                        //we use reflectivity as a scale to make transparent ghosted objects look good
                        //while still retaining some physical Fresnel for glass materials.
                        //For ghosted objects the reflectivity is 0 while for physical glass
                        //it is a non-zero value.
                        "gl_FragColor.a = mix(gl_FragColor.a, Schlick_f(gl_FragColor.a, facing), reflectivity);",

                        //Scale down diffuse in order to keep energy conservation
                        //at grazing angles, where specular takes over. The actual equation is
                        //given here: http://www.cs.utah.edu/~shirley/papers/jgtbrdf.pdf.
                        //For the environment map, N.V and N.R are equal so we can just square the one factor
                        //instead of computing two and multiplying them, but we use just one factor instead,
                        //because things seem to get too dark otherwise.
                        //TODO: check further on the exact normalization factors needed.
                        //Also note that we drop a factor of PI (we drop that from the specular light as well,
                        //where we use n/8 instead of n/8pi as normalization).
                        "float invSchlick = (1.0 - facing * 0.5);",
                        "float invSchlick2 = invSchlick * invSchlick;",
                        "float norm_factor = 1.0 - invSchlick * invSchlick2 * invSchlick2;",

                        //If contrast is too high, and RaaS complains, set this factor to 1.
                        "norm_factor = (28.0 / 23.0) * norm_factor;",

                        "gl_FragColor.xyz *= norm_factor * (1.0 - InputToLinear(specular));",

                    "#endif",

                    //Add environment contribution to direct lighting
                    "gl_FragColor.xyz += cubeColor.xyz * specularStrength * schlickRefl.xyz;",

                    "#ifdef CLEARCOAT",

                        "vec3 reflectVecClearcoat = reflect( -viewDirection, geomNormal );",
                        "reflectVecClearcoat = mat3(viewMatrixInverse) * reflectVecClearcoat;",

                        "vec3 cubeColorClearcoat = sampleReflection(reflectVecClearcoat, 0.0);",

                        //Fresnel for the clearcoat
                        "float schlickClearcoat = Schlick_f(InputToLinear(reflectivity), facing);",

                        //Mix in specular of the clearcoat -- note the 0.5 factor is hardcoded
                        //from the Prism paint material.
                        "gl_FragColor.xyz = mix(gl_FragColor.xyz, cubeColorClearcoat * schlickClearcoat, 0.5);",

                    "#endif", //CLEARCOAT

                    //DEBUG
                    //"gl_FragColor.xyz = cubeColor.xyz;",

                "#endif", //USE_ENVMAP

                "#if TONEMAP_OUTPUT == 1",
                    "gl_FragColor.xyz = toneMapCanonOGS_WithGamma_WithColorPerserving(exposureBias * gl_FragColor.xyz);",
                "#elif TONEMAP_OUTPUT == 2",
                    "gl_FragColor.xyz = toneMapCanonFilmic_WithGamma( exposureBias * gl_FragColor.xyz );",
                "#endif",
                // to turn off all shading (helps in seeing SAO, for example), uncomment:
                //"gl_FragColor = vec4( vec3 ( 1.0 ), 1.0 );",

                ThemingFragmentShaderChunk,

                FinalOutputShaderChunk,

            "}"


        ].join("\n")

    };

    THREE.ShaderLib['firefly_phong'] = FireflyPhongShader;
    return FireflyPhongShader;
});