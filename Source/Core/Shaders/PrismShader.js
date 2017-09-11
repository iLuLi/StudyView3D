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

    // This method sets up various uniforms for a given map, putting them
    // in an array called "uniforms" which are accessed by the name, such
    // as "uniforms[surface_albedo_map_texMatrix]".
    function GetPrismMapUniforms(mapName) {
        var mtxName = mapName + "_texMatrix";
        var mapInvt = mapName + "_invert";

        var uniforms = {};
        uniforms[mapName] = { type: "t", value: null };
        uniforms[mtxName] = { type: "m3", value: new THREE.Matrix3() };
        uniforms[mapInvt] = { type: "i", value: 0 };

        return uniforms;
    }

    function GetPrismBumpMapUniforms(mapName) {
        var mtxName = mapName + "_texMatrix";
        var mapScale = mapName + "_bumpScale";
        var mapType = mapName + "_bumpmapType";

        var uniforms = {};
        uniforms[mapName] = { type: "t", value: null };
        uniforms[mtxName] = { type: "m3", value: new THREE.Matrix3() };
        uniforms[mapScale] = { type: "v2", value: new THREE.Vector2(1, 1) };
        uniforms[mapType] = { type: "i", value: 0 };

        return uniforms;
    }

    // If any map type is defined, then do whatever "content" is;
    // typically it's "#define USE_MAP". In other words, if any map
    // is defined, then USE_MAP will also be defined. This constant
    // is then checked and determines whether a UV variable is defined, etc.
    function GetPrismMapsDefinitionChunk(content) {
        var def = ["#if defined( USE_SURFACE_ALBEDO_MAP )" +
                    " || defined( USE_SURFACE_ROUGHNESS_MAP )" +
                    " || defined( USE_SURFACE_CUTOUT_MAP )" +
                    " || defined( USE_SURFACE_ANISOTROPY_MAP )" +
                    " || defined( USE_SURFACE_ROTATION_MAP )" +
                    " || defined( USE_OPAQUE_ALBEDO_MAP )" +
                    " || defined( USE_OPAQUE_F0_MAP )" +
                    " || defined( USE_OPAQUE_LUMINANCE_MODIFIER_MAP )" +
                    " || defined( USE_LAYERED_BOTTOM_F0_MAP )" +
                    " || defined( USE_LAYERED_F0_MAP )" +
                    " || defined( USE_LAYERED_DIFFUSE_MAP )" +
                    " || defined( USE_LAYERED_FRACTION_MAP )" +
                    " || defined( USE_LAYERED_ROUGHNESS_MAP )" +
                    " || defined( USE_LAYERED_ANISOTROPY_MAP )" +
                    " || defined( USE_LAYERED_ROTATION_MAP )" +
                    " || defined( USE_METAL_F0_MAP )" +
                    " || defined( USE_SURFACE_NORMAL_MAP )" +
                    " || defined( USE_LAYERED_NORMAL_MAP )",
                    content,
                    "#endif"
        ].join("\n");

        return def;
    }

    // Set up code for texture access. If USE_SURFACE_ALBEDO_MAP is defined, for example, this texture access code gets executed.
    // If it's not defined, then a simply copy occurs, e.g. "surfaceAlbedo = surface_albedo;" from the variableName and mapType.
    function GetPrismMapSampleChunk(mapType, variableName, isFloat, linearize) {
        var suffix = isFloat ? "_v3" : "";
        var declare = isFloat ? "vec3 " : "";
        var average = isFloat ? variableName + " = averageOfFloat3(" + variableName + suffix + ");" : "";
        var colorLinearization = linearize ? variableName + suffix + " = SRGBToLinear(" + variableName + suffix + ");" : "";
        var shader = [
                        "#if defined( USE_" + mapType.toUpperCase() + "_MAP )",
                        "vec2 uv_" + mapType + "_map = (" + mapType + "_map_texMatrix * vec3(vUv, 1.0)).xy;",
                        mapType.toUpperCase() + "_CLAMP_TEST;",
                        declare + variableName + suffix + " = texture2D(" + mapType + "_map, uv_" + mapType + "_map).xyz;",
                        colorLinearization,
                        "if(" + mapType + "_map_invert) " + variableName + suffix + " = vec3(1.0) - " + variableName + suffix + ";",
                        average,
                        "#else",
                        variableName + " = " + mapType + ";",
                        "#endif"
        ].join("\n");

        return shader;
    }

    function GetPrismMapUniformChunk(mapName) {

        var mtxName = mapName + "_texMatrix";
        var mapInvt = mapName + "_invert";
        var macroName = "USE_" + mapName;

        var uniforms = [
            "#if defined( " + macroName.toUpperCase() + " )",
            "uniform sampler2D " + mapName + ";",
            "uniform mat3 " + mtxName + ";",
            "uniform bool " + mapInvt + ";",
            "#endif",
        ].join("\n");

        return uniforms;
    }

    function GetPrismBumpMapUniformChunk(mapName) {

        var mtxName = mapName + "_texMatrix";
        var mapScale = mapName + "_bumpScale";
        var mapType = mapName + "_bumpmapType";
        var macroName = "USE_" + mapName;

        var uniforms = [
            "#if defined( " + macroName.toUpperCase() + " )",
            "uniform sampler2D " + mapName + ";",
            "uniform mat3 " + mtxName + ";",
            "uniform vec2 " + mapScale + ";",
            "uniform int " + mapType + ";",
            "#endif",
        ].join("\n");

        return uniforms;
    }

    var PrismShader = {

        uniforms: THREE.UniformsUtils.merge([

            THREE.UniformsLib["common"],
            THREE.UniformsLib["lights"],
            CutPlanesUniforms,
            IdUniforms,
            ThemingUniform,

            GetPrismMapUniforms("surface_albedo_map"),
            GetPrismMapUniforms("surface_roughness_map"),
            GetPrismMapUniforms("surface_cutout_map"),
            GetPrismMapUniforms("surface_anisotropy_map"),
            GetPrismMapUniforms("surface_rotation_map"),
            GetPrismMapUniforms("opaque_albedo_map"),
            GetPrismMapUniforms("opaque_f0_map"),
            GetPrismMapUniforms("opaque_luminance_modifier_map"),
            GetPrismMapUniforms("layered_bottom_f0_map"),
            GetPrismMapUniforms("layered_f0_map"),
            GetPrismMapUniforms("layered_diffuse_map"),
            GetPrismMapUniforms("layered_fraction_map"),
            GetPrismMapUniforms("layered_roughness_map"),
            GetPrismMapUniforms("layered_anisotropy_map"),
            GetPrismMapUniforms("layered_rotation_map"),
            GetPrismMapUniforms("metal_f0_map"),

            GetPrismBumpMapUniforms("surface_normal_map"),
            GetPrismBumpMapUniforms("layered_normal_map"),

            {
                //Surface
                "surface_albedo": { type: "c", value: new THREE.Color(0x111111) },
                "surface_roughness": { type: "f", value: 1.0 },
                "surface_anisotropy": { type: "f", value: 1.0 },
                "surface_rotation": { type: "f", value: 1.0 },

                //Opaque
                "opaque_albedo": { type: "c", value: new THREE.Color(0x111111) },
                "opaque_f0": { type: "f", value: 1.0 },
                "opaque_luminance_modifier": { type: "c", value: new THREE.Color(0x111111) },
                "opaque_luminance": { type: "f", value: 1.0 },

                //Metal
                "metal_f0": { type: "c", value: new THREE.Color(0x111111) },

                //Layered
                "layered_f0": { type: "f", value: 1.0 },
                "layered_diffuse": { type: "c", value: new THREE.Color(0x000000) },
                "layered_fraction": { type: "f", value: 1.0 },
                "layered_bottom_f0": { type: "c", value: new THREE.Color(0x111111) },
                "layered_roughness": { type: "f", value: 1.0 },
                "layered_anisotropy": { type: "f", value: 1.0 },
                "layered_rotation": { type: "f", value: 1.0 },

                //Transparent
                "transparent_ior": { type: "f", value: 2.0 },
                "transparent_color": { type: "c", value: new THREE.Color(0x111111) },
                "transparent_distance": { type: "f", value: 1.0 },

                //Wood
                "wood_fiber_cosine_enable": { type: "i", value: 1 },
                "wood_fiber_cosine_bands": { type: "i", value: 2 },
                "wood_fiber_cosine_weights": { type: "v4", value: new THREE.Vector4(2.5, 0.5, 1, 1) },
                "wood_fiber_cosine_frequencies": { type: "v4", value: new THREE.Vector4(15, 4, 1, 1) },

                "wood_fiber_perlin_enable": { type: "i", value: 1 },
                "wood_fiber_perlin_bands": { type: "i", value: 3 },
                "wood_fiber_perlin_weights": { type: "v4", value: new THREE.Vector4(3.0, 1.0, 0.2, 1) },
                "wood_fiber_perlin_frequencies": { type: "v4", value: new THREE.Vector4(40, 20, 3.5, 1) },
                "wood_fiber_perlin_scale_z": { type: "f", value: 0.3 },

                "wood_growth_perlin_enable": { type: "i", value: 1 },
                "wood_growth_perlin_bands": { type: "i", value: 3 },
                "wood_growth_perlin_weights": { type: "v4", value: new THREE.Vector4(1.0, 2, 1, 1) },
                "wood_growth_perlin_frequencies": { type: "v4", value: new THREE.Vector4(1, 5, 13, 1) },

                "wood_latewood_ratio": { type: "f", value: 0.238 },
                "wood_earlywood_sharpness": { type: "f", value: 0.395 },
                "wood_latewood_sharpness": { type: "f", value: 0.109 },
                "wood_ring_thickness": { type: "f", value: 0.75 },

                "wood_earlycolor_perlin_enable": { type: "i", value: 1 },
                "wood_earlycolor_perlin_bands": { type: "i", value: 2 },
                "wood_earlycolor_perlin_weights": { type: "v4", value: new THREE.Vector4(0.3, 0.5, 0.15, 1) },
                "wood_earlycolor_perlin_frequencies": { type: "v4", value: new THREE.Vector4(8, 3, 0.35, 1) },
                "wood_early_color": { type: "c", value: new THREE.Color(0.286, 0.157, 0.076) },

                "wood_use_manual_late_color": { type: "i", value: 0 },
                "wood_manual_late_color": { type: "c", value: new THREE.Color(0.62, 0.35, 0.127) },

                "wood_latecolor_perlin_enable": { type: "i", value: 1 },
                "wood_latecolor_perlin_bands": { type: "i", value: 1 },
                "wood_latecolor_perlin_weights": { type: "v4", value: new THREE.Vector4(0.75, 0.55, 1, 1) },
                "wood_latecolor_perlin_frequencies": { type: "v4", value: new THREE.Vector4(4.5, 0.05, 1, 1) },
                "wood_late_color_power": { type: "f", value: 1.25 },

                "wood_diffuse_perlin_enable": { type: "i", value: 1 },
                "wood_diffuse_perlin_bands": { type: "i", value: 3 },
                "wood_diffuse_perlin_weights": { type: "v4", value: new THREE.Vector4(0.15, 0.2, 0.05, 1) },
                "wood_diffuse_perlin_frequencies": { type: "v4", value: new THREE.Vector4(0.05, 0.1, 3, 1) },
                "wood_diffuse_perlin_scale_z": { type: "f", value: 0.2 },

                "wood_use_pores": { type: "i", value: 1 },
                "wood_pore_type": { type: "i", value: 0 },
                "wood_pore_radius": { type: "f", value: 0.04 },
                "wood_pore_cell_dim": { type: "f", value: 0.15 },
                "wood_pore_color_power": { type: "f", value: 1.45 },
                "wood_pore_depth": { type: "f", value: 0.02 },

                "wood_use_rays": { type: "i", value: 1 },
                "wood_ray_color_power": { type: "f", value: 1.1 },
                "wood_ray_seg_length_z": { type: "f", value: 5.0 },
                "wood_ray_num_slices": { type: "f", value: 160 },
                "wood_ray_ellipse_z2x": { type: "f", value: 10 },
                "wood_ray_ellipse_radius_x": { type: "f", value: 0.2 },

                "wood_use_latewood_bump": { type: "i", value: 1 },
                "wood_latewood_bump_depth": { type: "f", value: 0.01 },

                "wood_use_groove_roughness": { type: "i", value: 1 },
                "wood_groove_roughness": { type: "f", value: 0.85 },
                "wood_diffuse_lobe_weight": { type: "f", value: 0.9 },

                "permutationMap": { type: "t", value: null },
                "gradientMap": { type: "t", value: null },
                "perm2DMap": { type: "t", value: null },
                "permGradMap": { type: "t", value: null },

                "irradianceMap": { type: "t", value: null },
                "envMap": { type: "t", value: null },
                "exposureBias": { type: "f", value: 1.0 },
                "envMapExposure": { type: "f", value: 1.0 },
                "envRotationSin": { type: "f", value: 0.0 },
                "envRotationCos": { type: "f", value: 1.0 },

                "envExponentMin": { type: "f", value: 1.0 },
                "envExponentMax": { type: "f", value: 512.0 },
                "envExponentCount": { type: "f", value: 10.0 },

            }

        ]),

        vertexShader: [

            "varying vec3 vViewPosition;",
            "varying vec3 vNormal;",

            "#if defined(PRISMWOOD) && !defined(NO_UVW)",
                "varying vec3 vUvw;",
            "#endif",

            "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",
            GetPrismMapsDefinitionChunk("#define USE_MAP"),
            "#ifdef USE_MAP",
                "varying vec2 vUv;",
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

            //Prism brdf calculation needs tangent/bitangent. If uv is not available,
            //calculate tangent/bitangent in vertex shader with a simplified algorithm.
            "#if !defined(USE_MAP) " +
            "&& (MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0)",
            "varying vec3 vTangent;",
            "varying vec3 vBitangent;",

            "void ComputeTangents(vec3 normal, out vec3 u, out vec3 v)",
            "{",
            "    float scale = normal.z < 0.0 ? -1.0 : 1.0;",
            "    vec3 temp = scale * normal;",
            "    float e    = temp.z;",
            "    float h    = 1.0/(1.0 + e);",
            "    float hvx  = h   *  temp.y;",
            "    float hvxy = hvx * -temp.x;",
            "    u = vec3(e + hvx * temp.y, hvxy,                -temp.x);",
            "    v = vec3(hvxy,             e + h * temp.x * temp.x, -temp.y);",

            "    u *= scale;",
            "    v *= scale;",
            "}",
            "#endif",

            "void main() {",
            "#ifdef USE_MAP",
                "vUv = uv;",
            "#endif",

            "#if defined(PRISMWOOD) && !defined(NO_UVW)",
                "vUvw = uvw;",
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

                "vNormal = normalize( transformedNormal );",

                "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

                "gl_Position = projectionMatrix * mvPosition;",

                "vViewPosition = -mvPosition.xyz;",

                "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                    "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
                    "vWorldPosition = worldPosition.xyz;",
                "#endif",

                "#if !defined(USE_MAP) " +
                "&& (MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0)",
                    "vec3 Tu, Tv;",
                    "ComputeTangents(vNormal, Tu, Tv);",
                    "vTangent = Tu;",
                    "vBitangent = Tv;",
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
            "//**************************************************************************/",
            "// Copyright 2015 Autodesk, Inc. ",
            "// All rights reserved.",
            "// ",
            "// This computer source code and related instructions and comments are the ",
            "// unpublished confidential and proprietary information of Autodesk, Inc. ",
            "// and are protected under Federal copyright and state trade secret law. ",
            "// They may not be disclosed to, copied or used by any third party without",
            "// the prior written consent of Autodesk, Inc. ",
            "//**************************************************************************/ ",
            "#define PI 3.141592654",
            "#define RECIPROCAL_PI 0.318309886",
            "#define RECIPROCAL_2PI 0.159154943",
            "#define ONE 0.00390625",// =1/256.0

            "uniform vec3 surface_albedo;",
            "uniform float surface_roughness;",
            "uniform float surface_anisotropy;",
            "uniform float surface_rotation;",

            "#if defined( PRISMOPAQUE )",
            //Opaque
            "uniform vec3 opaque_albedo;",
            "uniform float opaque_f0;",
            "uniform vec3 opaque_luminance_modifier;",
            "uniform float opaque_luminance;",

            "#elif defined( PRISMMETAL )",
            //Metal
            "uniform vec3 metal_f0;",

            "#elif defined( PRISMLAYERED )",
            //Layered
            "uniform float layered_f0;",
            "uniform vec3 layered_diffuse;",
            "uniform float layered_fraction;",
            "uniform vec3 layered_bottom_f0;",
            "uniform float layered_roughness;",
            "uniform float layered_anisotropy;",
            "uniform float layered_rotation;",

            "#elif defined( PRISMTRANSPARENT )",
            //Transparent
            "uniform float transparent_ior;",
            "uniform vec3 transparent_color;",
            "uniform float transparent_distance;",

            "#elif defined( PRISMWOOD )",
            //Wood
            "uniform bool wood_fiber_cosine_enable;",
            "uniform int wood_fiber_cosine_bands;",
            "uniform vec4 wood_fiber_cosine_weights;",
            "uniform vec4 wood_fiber_cosine_frequencies;",
            "uniform bool wood_fiber_perlin_enable;",
            "uniform int wood_fiber_perlin_bands;",
            "uniform vec4 wood_fiber_perlin_weights;",
            "uniform vec4 wood_fiber_perlin_frequencies;",
            "uniform float wood_fiber_perlin_scale_z;",
            "uniform bool wood_growth_perlin_enable;",
            "uniform int wood_growth_perlin_bands;",
            "uniform vec4 wood_growth_perlin_weights;",
            "uniform vec4 wood_growth_perlin_frequencies;",
            "uniform float wood_latewood_ratio;",
            "uniform float wood_earlywood_sharpness;",
            "uniform float wood_latewood_sharpness;",
            "uniform float wood_ring_thickness;",
            "uniform bool wood_earlycolor_perlin_enable;",
            "uniform int wood_earlycolor_perlin_bands;",
            "uniform vec4 wood_earlycolor_perlin_weights;",
            "uniform vec4 wood_earlycolor_perlin_frequencies;",
            "uniform vec3 wood_early_color;",
            "uniform bool wood_use_manual_late_color;",
            "uniform vec3 wood_manual_late_color;",
            "uniform bool wood_latecolor_perlin_enable;",
            "uniform int wood_latecolor_perlin_bands;",
            "uniform vec4 wood_latecolor_perlin_weights;",
            "uniform vec4 wood_latecolor_perlin_frequencies;",
            "uniform float wood_late_color_power;",
            "uniform bool wood_diffuse_perlin_enable;",
            "uniform int wood_diffuse_perlin_bands;",
            "uniform vec4 wood_diffuse_perlin_weights;",
            "uniform vec4 wood_diffuse_perlin_frequencies;",
            "uniform float wood_diffuse_perlin_scale_z;",
            "uniform bool wood_use_pores;",
            "uniform int wood_pore_type;",
            "uniform float wood_pore_radius;",
            "uniform float wood_pore_cell_dim;",
            "uniform float wood_pore_color_power;",
            "uniform float wood_pore_depth;",
            "uniform bool wood_use_rays;",
            "uniform float wood_ray_color_power;",
            "uniform float wood_ray_seg_length_z;",
            "uniform float wood_ray_num_slices;",
            "uniform float wood_ray_ellipse_z2x;",
            "uniform float wood_ray_ellipse_radius_x;",
            "uniform bool wood_use_latewood_bump;",
            "uniform float wood_latewood_bump_depth;",
            "uniform bool wood_use_groove_roughness;",
            "uniform float wood_groove_roughness;",
            "uniform float wood_diffuse_lobe_weight;",
            "uniform sampler2D permutationMap;",
            "uniform sampler2D gradientMap;",
            "uniform sampler2D perm2DMap;",
            "uniform sampler2D permGradMap;",
            "#endif",

            //Env
            "uniform float envExponentMin;",
            "uniform float envExponentMax;",
            "uniform float envExponentCount;",
            EnvSamplingShaderChunk,

            "#if TONEMAP_OUTPUT > 0",
                "uniform float exposureBias;",
                TonemapShaderChunk,
            "#endif",

            "#if MAX_SPOT_LIGHTS > 0 || NUM_CUTPLANES > 0",
                "varying vec3 vWorldPosition;",
            "#endif",

            "#ifdef USE_LOGDEPTHBUF",
                "uniform float logDepthBufFC;",
                "#ifdef USE_LOGDEPTHBUF_EXT",
                    "#extension GL_EXT_frag_depth : enable",
                    "varying highp float vFragDepth;",
                "#endif",
            "#endif",

            IdFragmentDeclaration,
            ThemingFragmentDeclaration,

            GetPrismMapsDefinitionChunk("#define USE_MAP"),
            "#ifdef USE_MAP",
                "varying vec2 vUv;",
            "#endif",

            "#if defined(PRISMWOOD) && !defined(NO_UVW)",
                "varying vec3 vUvw;",
            "#endif",

            GetPrismMapUniformChunk("surface_albedo_map"),
            GetPrismMapUniformChunk("surface_roughness_map"),
            GetPrismMapUniformChunk("surface_cutout_map"),
            GetPrismMapUniformChunk("surface_anisotropy_map"),
            GetPrismMapUniformChunk("surface_rotation_map"),

            GetPrismMapUniformChunk("opaque_albedo_map"),
            GetPrismMapUniformChunk("opaque_f0_map"),
            GetPrismMapUniformChunk("opaque_luminance_modifier_map"),
            GetPrismMapUniformChunk("layered_bottom_f0_map"),
            GetPrismMapUniformChunk("layered_f0_map"),
            GetPrismMapUniformChunk("layered_diffuse_map"),
            GetPrismMapUniformChunk("layered_fraction_map"),
            GetPrismMapUniformChunk("layered_roughness_map"),
            GetPrismMapUniformChunk("layered_anisotropy_map"),
            GetPrismMapUniformChunk("layered_rotation_map"),
            GetPrismMapUniformChunk("metal_f0_map"),

            GetPrismBumpMapUniformChunk("surface_normal_map"),
            GetPrismBumpMapUniformChunk("layered_normal_map"),

            "vec3 RGBMDecode(in vec4 vRGBM, in float exposure) {",
                "vec3 ret = vRGBM.rgb * (vRGBM.a * 16.0);", //vairable factor in alpha channel + fixed factor of 16.0
                "ret *= ret;", //remove gamma of 2.0 to go into linear space
                "ret *= exposure;", //apply exposure to get back original intensity
                "return ret;",
            "}",

            "vec3 GammaDecode(in vec4 vRGBA, in float exposure) {",
                "return vRGBA.xyz * vRGBA.xyz * exposure;",
            "}",

            "float SRGBToLinearComponent(float color) {",
                "float result = color;",
                // For the formula to transform sRGB value to linear space, please refer to http://en.wikipedia.org/wiki/SRGB
                "if (result<=0.04045)",
                    "result *= 0.07739938;",
                "else",
                    "result = pow(abs((result+0.055)*0.947867298), 2.4);",
                "return result;",
            "}",

            "vec3 SRGBToLinear(vec3 color) {",
                "vec3 result = color;",
                "result.x = SRGBToLinearComponent(result.x);",
                "result.y = SRGBToLinearComponent(result.y);",
                "result.z = SRGBToLinearComponent(result.z);",
                "return result;",
            "}",

            "#if defined( USE_ENVMAP )",
            "uniform float envMapExposure;",
            "uniform samplerCube envMap;",
            "#endif", //USE_ENVMAP

            "float averageOfFloat3(in vec3 value)",
            "{ ",
            "    const float oneThird = 1.0 / 3.0; ",
            "    return dot(value, vec3(oneThird, oneThird, oneThird)); ",
            "} ",

            "#if defined( USE_SURFACE_NORMAL_MAP ) || defined( USE_LAYERED_NORMAL_MAP )",
            "vec3 heightMapTransform(sampler2D bumpTexture, vec2 uv, mat3 transform, vec2 bumpScale, vec3 T, vec3 B, vec3 N) {",
                "vec2 st = (transform * vec3(uv, 1.0)).xy;",
                "mat3 mtxTangent = mat3(T, B, N);",
                "T = normalize(mtxTangent * (transform * vec3(1.0, 0.0, 0.0)));",
                "B = normalize(mtxTangent * (transform * vec3(0.0, 1.0, 0.0)));",
                "const float oneThird = 1.0 / 3.0;",
                "vec3 avg = vec3(oneThird, oneThird, oneThird);",
                "vec2 offset = fwidth(st);",
                "float h0 = dot(texture2D(bumpTexture, st).xyz, avg);",
                "float hx = dot(texture2D(bumpTexture, st + vec2(offset.x, 0.0)).xyz, avg);",
                "float hy = dot(texture2D(bumpTexture, st + vec2(0.0, offset.y)).xyz, avg);",
                "vec2 diff = vec2(h0 - hx, h0 - hy) / offset;",
                "return normalize(N + (diff.x * T * bumpScale.x + diff.y * B * bumpScale.y));",
            "}",

            "vec3 normalMapTransform(sampler2D bumpTexture, vec2 uv, mat3 transform, vec2 bumpScale, vec3 T, vec3 B, vec3 N) {",
                "vec2 st = (transform * vec3(uv, 1.0)).xy;",
                "vec3 NMap =  2.0 * texture2D( bumpTexture, st ).xyz - 1.0; ",
                "return normalize(bumpScale.x * (NMap.x * T + NMap.y * B) + NMap.z * N);",
            "}",
            "#endif",

            "#if !defined(USE_MAP)" +
            "&& (MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0)",
            "varying vec3 vTangent;",
            "varying vec3 vBitangent;",
            "#endif",

            "#if defined( USE_ENVMAP )",
            "vec3 sampleReflection(vec3 N, vec3 V, float mipIndex) {",

                "vec3 dir = (2.0 * dot(V, N)) * N - V;",
                "dir = adjustLookupVector(mat3(viewMatrixInverse) * dir);",

                "#ifdef ENV_GAMMA",

                    "#ifdef HAVE_TEXTURE_LOD",
                        "vec4 envTexColor = textureCubeLodEXT( envMap, dir, mipIndex );",
                    "#else",
                        //NOTE that the computation in case the -LOD extension is not available is
                        //not really correct as the mip bias is not going to be equivalent in some cases.
                        "vec4 envTexColor = textureCube( envMap, dir, mipIndex );",
                    "#endif",

                    "return GammaDecode(envTexColor, envMapExposure);",

                "#elif defined(ENV_RGBM)",
                    "#ifdef HAVE_TEXTURE_LOD",
                        "vec4 envTexColor = textureCubeLodEXT( envMap, dir, mipIndex );",
                    "#else",
                        //NOTE that the computation in case the -LOD extension is not available is
                        //not really correct as the mip bias is not going to be equivalent in some cases.
                        "vec4 envTexColor = textureCube( envMap, dir, mipIndex );",
                    "#endif",

                    "return RGBMDecode(envTexColor, envMapExposure);",

                "#else",

                    //Assumes this code path is non-HDR and non-blurred reflection map, like vanilla three.js

                    "vec4 envTexColor = textureCube( envMap, dir );",
                    "vec3 cubeColor = envTexColor.xyz;",

                    "#ifdef GAMMA_INPUT",
                        "cubeColor *= cubeColor;",
                    "#endif",

                    "return cubeColor;",

                "#endif",

            "}",
            "#endif",

            HatchPatternShaderChunk,

            "#if defined( USE_ENVMAP ) && defined( USE_IRRADIANCEMAP )",
            "uniform samplerCube irradianceMap;",

            "vec3 sampleNormal(vec3 normal) {",
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

            "return indirectDiffuse;}",
            "#endif",

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

            "float sqr(float x) {return x*x;}",

            "float aSqrd(float maxAlphaSqr, float cosTheta)",
            "{",
            "   float tan2 = 1.0/sqr(cosTheta) - 1.0;",
            "   return maxAlphaSqr * tan2;",
            "}",

            // Computes the Schlick Fresnel term, based on the normal reflectance (f0) and the cosine of the
            // angle between the light direction and half-angle vector.
            "vec3 Fresnel_Schlick(vec3 f0, float cosAngle)",
            "{",
            "    float x = 1.0 - cosAngle;",
            "    float x2 = x * x;",
            "    float x5 = x * x2 * x2;",
            "    return f0 + (1.0 - f0) * x5;",
            "}",

            // Computes the Schlick Fresnel term, with an adjustment to limit reflectance at grazing angles
            // based on roughness (in alpha units).
            // NOTE: This technically needs two versions, one for Beckman and one for GGX, but here we are
            // simply stopping the function at alpha of 0.7.
            "vec3 Fresnel_Rough(vec3 f0, float cosAngle, float alpha)",
            "{",
            "    float x = 1.0 - cosAngle;",
            "    float x2 = x * x;",
            "    float x5 = x * x2 * x2;",
            "    vec3 maxReflectance = mix(vec3(1.0), f0, vec3(min(0.7, alpha)) / 0.7);",
            "    return f0 + (maxReflectance - f0) * x5;",
            "}",

            // Computes the reflectance for the specified index of refraction.
            "float IORToReflectance(float ior)",
            "{",
            "    return sqr((1.0 - ior)/(1.0 + ior));",
            "}",

            // Converts a roughness value to (internal) alpha values (U and V), with anisotropy if desired.
            // NOTE: Set anisotropy to 0.0 to disable it.
            "vec2 RoughnessToAlpha(float roughness, float anisotropy)",
            "{",
                // Compute alpha as roughness squared.  Also apply anisotropy for the V component, relative to
                // the U component.
            "    vec2 alpha = roughness * vec2(1.0, 1.0 - anisotropy);",
            "    alpha = alpha * alpha;",

                // Enforce a small (non-zero) lower bound on alpha to avoid highlight aliasing and division by
                // zero.
            "    alpha = clamp(alpha, 0.001, 1.0);",

            "    return alpha;",
            "}",

            // Computes a Phong exponent that is comparable to the specified alpha (roughness).
            "float AlphaToPhong(float alpha)",
            "{",
            "    return max(0.0, 2.56/alpha - 7.0);",// GGX, exponent goes to 1 (diffuse) at alpha = 0.64
            "}",

            // Map the exponent to lmv env mipmap level(0~6?)
            "float ExponentToReflMipIndex(float exponent)",
            "{",
            "    float targetLog = log2(exponent);",
            "    float minLog = log2(envExponentMin); ",
            "    float maxLog = log2(envExponentMax); ",
            "    float deltaLog = clamp(targetLog - minLog, 0.0, maxLog - minLog);  ",
            "    float level = clamp((1.0-(deltaLog + 0.5) / envExponentCount), 0.0, 1.0) * 6.0; ",
            "    return level; ",
            "}",

            "#if defined( PRISMWOOD )",

            "vec3 NoiseWood(inout float roughness_inout)",
            "{",
            "//If the mesh has no uvw, use a const zero vector.",
            "//This is used by section tool.",
            "#ifdef NO_UVW",
            "   vec3 vUvw_uniform = vec3(0.0);",
            "#else",
            "   vec3 vUvw_uniform = vUvw;",
            "#endif",
            "  lowp float surfaceRoughness_1;",
            "  surfaceRoughness_1 = surface_roughness;",
            "  lowp float roughness_2;",
            "  roughness_2 = surfaceRoughness_1;",
            "  lowp vec3 diffAlbedo_3;",
            "  lowp vec3 lateColor_4;",
            "  lowp vec3 earlyColor_5;",
            "  lowp float radiusLength_6;",
            "  lowp vec3 p_7;",
            "  p_7 = vUvw_uniform;",
            "  if (wood_fiber_cosine_enable) {",
            "    lowp vec3 p_8;",
            "    p_8 = p_7;",
            "    lowp vec3 tmpvar_9;",
            "    lowp float weight_10;",
            "    lowp float radiusShift_11;",
            "    lowp float tmpvar_12;",
            "    tmpvar_12 = sqrt(dot (vUvw_uniform.xy, vUvw_uniform.xy));",
            "    if ((tmpvar_12 < 1e-05)) {",
            "      tmpvar_9 = p_7;",
            "    } else {",
            "      lowp vec2 tmpvar_13;",
            "      tmpvar_13 = (vUvw_uniform.xy / tmpvar_12);",
            "      radiusShift_11 = 0.0;",
            "      if ((0 < wood_fiber_cosine_bands)) {",
            "        radiusShift_11 = (wood_fiber_cosine_weights.x * cos((",
            "          (vUvw_uniform.z * 0.1591549)",
            "         * wood_fiber_cosine_frequencies.x)));",
            "        if ((1 < wood_fiber_cosine_bands)) {",
            "          radiusShift_11 = (radiusShift_11 + (wood_fiber_cosine_weights.y * cos(",
            "            ((vUvw_uniform.z * 0.1591549) * wood_fiber_cosine_frequencies.y)",
            "          )));",
            "          if ((2 < wood_fiber_cosine_bands)) {",
            "            radiusShift_11 = (radiusShift_11 + (wood_fiber_cosine_weights.z * cos(",
            "              ((vUvw_uniform.z * 0.1591549) * wood_fiber_cosine_frequencies.z)",
            "            )));",
            "            if ((3 < wood_fiber_cosine_bands)) {",
            "              radiusShift_11 = (radiusShift_11 + (wood_fiber_cosine_weights.w * cos(",
            "                ((vUvw_uniform.z * 0.1591549) * wood_fiber_cosine_frequencies.w)",
            "              )));",
            "            };",
            "          };",
            "        };",
            "      };",
            "      lowp float tmpvar_14;",
            "      tmpvar_14 = clamp ((tmpvar_12 / 1.5), 0.0, 1.0);",
            "      weight_10 = tmpvar_14;",
            "      if ((tmpvar_14 >= 0.5)) {",
            "        weight_10 = ((tmpvar_14 * tmpvar_14) * (3.0 - (tmpvar_14 + tmpvar_14)));",
            "      };",
            "      p_8.xy = (vUvw_uniform.xy + ((tmpvar_13 * radiusShift_11) * weight_10));",
            "      tmpvar_9 = p_8;",
            "    };",
            "    p_7 = tmpvar_9;",
            "  };",
            "  if (wood_fiber_perlin_enable) {",
            "    lowp vec3 p_15;",
            "    p_15 = p_7;",
            "    lowp vec3 tmpvar_16;",
            "    tmpvar_16.xy = p_7.xy;",
            "    tmpvar_16.z = (p_7.z * wood_fiber_perlin_scale_z);",
            "    lowp vec3 p_17;",
            "    p_17 = tmpvar_16;",
            "    highp int bands_18;",
            "    bands_18 = wood_fiber_perlin_bands;",
            "    highp vec4 w_19;",
            "    w_19 = wood_fiber_perlin_weights;",
            "    highp vec4 f_20;",
            "    f_20 = wood_fiber_perlin_frequencies;",
            "    lowp float noise_22;",
            "    noise_22 = 0.0;",
            "    for (int i_21 = 0; i_21 < 4; ++i_21) {",
            "      if ((i_21 >= bands_18)) {",
            "        break;",
            "      };",
            "      lowp vec3 p_23;",
            "      highp float f_20_value = i_21 == 0 ? f_20[0] : i_21 == 1 ? f_20[1] : i_21 == 2 ? f_20[2] : f_20[3];",
            "      p_23 = (p_17 * f_20_value);",
            "      lowp vec4 AA_24;",
            "      lowp vec3 modp_25;",
            "      lowp vec3 tmpvar_26;",
            "      tmpvar_26 = (vec3(mod (floor(p_23), 256.0)));",
            "      modp_25.z = tmpvar_26.z;",
            "      modp_25.xy = (tmpvar_26.xy * 0.00390625);",
            "      AA_24 = ((texture2D (perm2DMap, modp_25.xy, 0.0) * 255.0) + tmpvar_26.z);",
            "      AA_24 = ((vec4(mod (floor(AA_24), 256.0))) * 0.00390625);",
            "      lowp vec2 tmpvar_27;",
            "      tmpvar_27.y = 0.0;",
            "      tmpvar_27.x = AA_24.x;",
            "      lowp vec2 tmpvar_28;",
            "      tmpvar_28.y = 0.0;",
            "      tmpvar_28.x = AA_24.y;",
            "      lowp vec2 tmpvar_29;",
            "      tmpvar_29.y = 0.0;",
            "      tmpvar_29.x = AA_24.z;",
            "      lowp vec2 tmpvar_30;",
            "      tmpvar_30.y = 0.0;",
            "      tmpvar_30.x = AA_24.w;",
            "      lowp vec2 tmpvar_31;",
            "      tmpvar_31.y = 0.0;",
            "      tmpvar_31.x = (AA_24.x + 0.00390625);",
            "      lowp vec2 tmpvar_32;",
            "      tmpvar_32.y = 0.0;",
            "      tmpvar_32.x = (AA_24.y + 0.00390625);",
            "      lowp vec2 tmpvar_33;",
            "      tmpvar_33.y = 0.0;",
            "      tmpvar_33.x = (AA_24.z + 0.00390625);",
            "      lowp vec2 tmpvar_34;",
            "      tmpvar_34.y = 0.0;",
            "      tmpvar_34.x = (AA_24.w + 0.00390625);",
            "      p_23 = (p_23 - floor(p_23));",
            "      lowp vec3 tmpvar_35;",
            "      tmpvar_35 = (((p_23 * p_23) * p_23) * ((p_23 *",
            "        ((p_23 * 6.0) - 15.0)",
            "      ) + 10.0));",
            "      highp float w_19_value = i_21 == 0 ? w_19[0] : i_21 == 1 ? w_19[1] : i_21 == 2 ? w_19[2] : w_19[3];",
            "      noise_22 = (noise_22 + (w_19_value * mix (",
            "        mix (mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_27, 0.0).xyz * 2.0)",
            "         - 1.0), p_23), dot ((",
            "          (texture2D (permGradMap, tmpvar_29, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(-1.0, 0.0, 0.0))), tmpvar_35.x), mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_28, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(0.0, -1.0, 0.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_30, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(-1.0, -1.0, 0.0))), tmpvar_35.x), tmpvar_35.y)",
            "      ,",
            "        mix (mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_31, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(0.0, 0.0, -1.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_33, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(-1.0, 0.0, -1.0))), tmpvar_35.x), mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_32, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(0.0, -1.0, -1.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_34, 0.0).xyz * 2.0)",
            "         - 1.0), (p_23 + vec3(-1.0, -1.0, -1.0))), tmpvar_35.x), tmpvar_35.y)",
            "      , tmpvar_35.z)));",
            "    };",
            "    p_15.xy = (p_7.xy + noise_22);",
            "    p_7 = p_15;",
            "  };",
            "  lowp float tmpvar_36;",
            "  tmpvar_36 = sqrt(dot (p_7.xy, p_7.xy));",
            "  radiusLength_6 = tmpvar_36;",
            "  if (wood_growth_perlin_enable) {",
            "    lowp float radiusLength_37;",
            "    radiusLength_37 = tmpvar_36;",
            "    lowp float noise_38;",
            "    noise_38 = 0.0;",
            "    if ((0 < wood_growth_perlin_bands)) {",
            "      lowp float p_39;",
            "      p_39 = (tmpvar_36 * wood_growth_perlin_frequencies.x);",
            "      lowp float modp_40;",
            "      modp_40 = (((float(mod (",
            "        floor(p_39)",
            "      , 256.0))) + 256.0) * 0.00390625);",
            "      lowp vec2 tmpvar_41;",
            "      tmpvar_41.y = 0.0;",
            "      tmpvar_41.x = modp_40;",
            "      lowp vec2 tmpvar_42;",
            "      tmpvar_42.y = 0.0;",
            "      tmpvar_42.x = texture2D (permutationMap, tmpvar_41, 0.0).x;",
            "      lowp vec2 tmpvar_43;",
            "      tmpvar_43.y = 0.0;",
            "      tmpvar_43.x = (modp_40 + 0.00390625);",
            "      lowp vec2 tmpvar_44;",
            "      tmpvar_44.y = 0.0;",
            "      tmpvar_44.x = texture2D (permutationMap, tmpvar_43, 0.0).x;",
            "      p_39 = (p_39 - floor(p_39));",
            "      noise_38 = (wood_growth_perlin_weights.x * mix ((",
            "        ((texture2D (gradientMap, tmpvar_42, 0.0).x * 2.0) - 1.0)",
            "       * p_39), (",
            "        ((texture2D (gradientMap, tmpvar_44, 0.0).x * 2.0) - 1.0)",
            "       *",
            "        (p_39 - 1.0)",
            "      ), (",
            "        ((p_39 * p_39) * p_39)",
            "       *",
            "        ((p_39 * ((p_39 * 6.0) - 15.0)) + 10.0)",
            "      )));",
            "      if ((1 < wood_growth_perlin_bands)) {",
            "        lowp float p_45;",
            "        p_45 = (tmpvar_36 * wood_growth_perlin_frequencies.y);",
            "        lowp float modp_46;",
            "        modp_46 = (((float(mod (",
            "          floor(p_45)",
            "        , 256.0))) + 256.0) * 0.00390625);",
            "        lowp vec2 tmpvar_47;",
            "        tmpvar_47.y = 0.0;",
            "        tmpvar_47.x = modp_46;",
            "        lowp vec2 tmpvar_48;",
            "        tmpvar_48.y = 0.0;",
            "        tmpvar_48.x = texture2D (permutationMap, tmpvar_47, 0.0).x;",
            "        lowp vec2 tmpvar_49;",
            "        tmpvar_49.y = 0.0;",
            "        tmpvar_49.x = (modp_46 + 0.00390625);",
            "        lowp vec2 tmpvar_50;",
            "        tmpvar_50.y = 0.0;",
            "        tmpvar_50.x = texture2D (permutationMap, tmpvar_49, 0.0).x;",
            "        p_45 = (p_45 - floor(p_45));",
            "        noise_38 = (noise_38 + (wood_growth_perlin_weights.y * mix (",
            "          (((texture2D (gradientMap, tmpvar_48, 0.0).x * 2.0) - 1.0) * p_45)",
            "        ,",
            "          (((texture2D (gradientMap, tmpvar_50, 0.0).x * 2.0) - 1.0) * (p_45 - 1.0))",
            "        ,",
            "          (((p_45 * p_45) * p_45) * ((p_45 * (",
            "            (p_45 * 6.0)",
            "           - 15.0)) + 10.0))",
            "        )));",
            "        if ((2 < wood_growth_perlin_bands)) {",
            "          lowp float p_51;",
            "          p_51 = (tmpvar_36 * wood_growth_perlin_frequencies.z);",
            "          lowp float modp_52;",
            "          modp_52 = (((float(mod (",
            "            floor(p_51)",
            "          , 256.0))) + 256.0) * 0.00390625);",
            "          lowp vec2 tmpvar_53;",
            "          tmpvar_53.y = 0.0;",
            "          tmpvar_53.x = modp_52;",
            "          lowp vec2 tmpvar_54;",
            "          tmpvar_54.y = 0.0;",
            "          tmpvar_54.x = texture2D (permutationMap, tmpvar_53, 0.0).x;",
            "          lowp vec2 tmpvar_55;",
            "          tmpvar_55.y = 0.0;",
            "          tmpvar_55.x = (modp_52 + 0.00390625);",
            "          lowp vec2 tmpvar_56;",
            "          tmpvar_56.y = 0.0;",
            "          tmpvar_56.x = texture2D (permutationMap, tmpvar_55, 0.0).x;",
            "          p_51 = (p_51 - floor(p_51));",
            "          noise_38 = (noise_38 + (wood_growth_perlin_weights.z * mix (",
            "            (((texture2D (gradientMap, tmpvar_54, 0.0).x * 2.0) - 1.0) * p_51)",
            "          ,",
            "            (((texture2D (gradientMap, tmpvar_56, 0.0).x * 2.0) - 1.0) * (p_51 - 1.0))",
            "          ,",
            "            (((p_51 * p_51) * p_51) * ((p_51 * (",
            "              (p_51 * 6.0)",
            "             - 15.0)) + 10.0))",
            "          )));",
            "          if ((3 < wood_growth_perlin_bands)) {",
            "            lowp float p_57;",
            "            p_57 = (tmpvar_36 * wood_growth_perlin_frequencies.w);",
            "            lowp float modp_58;",
            "            modp_58 = (((float(mod (",
            "              floor(p_57)",
            "            , 256.0))) + 256.0) * 0.00390625);",
            "            lowp vec2 tmpvar_59;",
            "            tmpvar_59.y = 0.0;",
            "            tmpvar_59.x = modp_58;",
            "            lowp vec2 tmpvar_60;",
            "            tmpvar_60.y = 0.0;",
            "            tmpvar_60.x = texture2D (permutationMap, tmpvar_59, 0.0).x;",
            "            lowp vec2 tmpvar_61;",
            "            tmpvar_61.y = 0.0;",
            "            tmpvar_61.x = (modp_58 + 0.00390625);",
            "            lowp vec2 tmpvar_62;",
            "            tmpvar_62.y = 0.0;",
            "            tmpvar_62.x = texture2D (permutationMap, tmpvar_61, 0.0).x;",
            "            p_57 = (p_57 - floor(p_57));",
            "            noise_38 = (noise_38 + (wood_growth_perlin_weights.w * mix (",
            "              (((texture2D (gradientMap, tmpvar_60, 0.0).x * 2.0) - 1.0) * p_57)",
            "            ,",
            "              (((texture2D (gradientMap, tmpvar_62, 0.0).x * 2.0) - 1.0) * (p_57 - 1.0))",
            "            ,",
            "              (((p_57 * p_57) * p_57) * ((p_57 * (",
            "                (p_57 * 6.0)",
            "               - 15.0)) + 10.0))",
            "            )));",
            "          };",
            "        };",
            "      };",
            "    };",
            "    radiusLength_37 = (tmpvar_36 + noise_38);",
            "    if ((radiusLength_37 < 0.0)) {",
            "      radiusLength_37 = 0.0;",
            "    };",
            "    radiusLength_6 = radiusLength_37;",
            "  };",
            "  lowp float earlyWoodRatio_63;",
            "  highp float tmpvar_64;",
            "  tmpvar_64 = (1.0 - wood_latewood_ratio);",
            "  highp float tmpvar_65;",
            "  tmpvar_65 = (wood_earlywood_sharpness * tmpvar_64);",
            "  highp float tmpvar_66;",
            "  tmpvar_66 = (wood_latewood_sharpness * wood_latewood_ratio);",
            "  highp float tmpvar_67;",
            "  tmpvar_67 = (tmpvar_64 - tmpvar_65);",
            "  highp float tmpvar_68;",
            "  tmpvar_68 = (tmpvar_64 + tmpvar_66);",
            "  highp float tmpvar_69;",
            "  tmpvar_69 = (wood_latewood_ratio - tmpvar_66);",
            "  lowp float tmpvar_70;",
            "  tmpvar_70 = ((float(mod (radiusLength_6, wood_ring_thickness))) / wood_ring_thickness);",
            "  earlyWoodRatio_63 = 0.0;",
            "  if ((tmpvar_70 <= tmpvar_65)) {",
            "    earlyWoodRatio_63 = 1.0;",
            "  } else {",
            "    if ((tmpvar_70 <= tmpvar_64)) {",
            "      earlyWoodRatio_63 = (1.0 - ((tmpvar_70 - tmpvar_65) / tmpvar_67));",
            "    } else {",
            "      if ((tmpvar_70 <= tmpvar_68)) {",
            "        earlyWoodRatio_63 = 0.0;",
            "      } else {",
            "        earlyWoodRatio_63 = ((tmpvar_70 - tmpvar_68) / tmpvar_69);",
            "      };",
            "    };",
            "  };",
            "  earlyColor_5 = wood_early_color;",
            "  if (wood_earlycolor_perlin_enable) {",
            "    lowp float noise_71;",
            "    noise_71 = 0.0;",
            "    if ((0 < wood_earlycolor_perlin_bands)) {",
            "      lowp float p_72;",
            "      p_72 = (radiusLength_6 * wood_earlycolor_perlin_frequencies.x);",
            "      lowp float modp_73;",
            "      modp_73 = (((float(mod (",
            "        floor(p_72)",
            "      , 256.0))) + 256.0) * 0.00390625);",
            "      lowp vec2 tmpvar_74;",
            "      tmpvar_74.y = 0.0;",
            "      tmpvar_74.x = modp_73;",
            "      lowp vec2 tmpvar_75;",
            "      tmpvar_75.y = 0.0;",
            "      tmpvar_75.x = texture2D (permutationMap, tmpvar_74, 0.0).x;",
            "      lowp vec2 tmpvar_76;",
            "      tmpvar_76.y = 0.0;",
            "      tmpvar_76.x = (modp_73 + 0.00390625);",
            "      lowp vec2 tmpvar_77;",
            "      tmpvar_77.y = 0.0;",
            "      tmpvar_77.x = texture2D (permutationMap, tmpvar_76, 0.0).x;",
            "      p_72 = (p_72 - floor(p_72));",
            "      noise_71 = (wood_earlycolor_perlin_weights.x * mix ((",
            "        ((texture2D (gradientMap, tmpvar_75, 0.0).x * 2.0) - 1.0)",
            "       * p_72), (",
            "        ((texture2D (gradientMap, tmpvar_77, 0.0).x * 2.0) - 1.0)",
            "       *",
            "        (p_72 - 1.0)",
            "      ), (",
            "        ((p_72 * p_72) * p_72)",
            "       *",
            "        ((p_72 * ((p_72 * 6.0) - 15.0)) + 10.0)",
            "      )));",
            "      if ((1 < wood_earlycolor_perlin_bands)) {",
            "        lowp float p_78;",
            "        p_78 = (radiusLength_6 * wood_earlycolor_perlin_frequencies.y);",
            "        lowp float modp_79;",
            "        modp_79 = (((float(mod (",
            "          floor(p_78)",
            "        , 256.0))) + 256.0) * 0.00390625);",
            "        lowp vec2 tmpvar_80;",
            "        tmpvar_80.y = 0.0;",
            "        tmpvar_80.x = modp_79;",
            "        lowp vec2 tmpvar_81;",
            "        tmpvar_81.y = 0.0;",
            "        tmpvar_81.x = texture2D (permutationMap, tmpvar_80, 0.0).x;",
            "        lowp vec2 tmpvar_82;",
            "        tmpvar_82.y = 0.0;",
            "        tmpvar_82.x = (modp_79 + 0.00390625);",
            "        lowp vec2 tmpvar_83;",
            "        tmpvar_83.y = 0.0;",
            "        tmpvar_83.x = texture2D (permutationMap, tmpvar_82, 0.0).x;",
            "        p_78 = (p_78 - floor(p_78));",
            "        noise_71 = (noise_71 + (wood_earlycolor_perlin_weights.y * mix (",
            "          (((texture2D (gradientMap, tmpvar_81, 0.0).x * 2.0) - 1.0) * p_78)",
            "        ,",
            "          (((texture2D (gradientMap, tmpvar_83, 0.0).x * 2.0) - 1.0) * (p_78 - 1.0))",
            "        ,",
            "          (((p_78 * p_78) * p_78) * ((p_78 * (",
            "            (p_78 * 6.0)",
            "           - 15.0)) + 10.0))",
            "        )));",
            "        if ((2 < wood_earlycolor_perlin_bands)) {",
            "          lowp float p_84;",
            "          p_84 = (radiusLength_6 * wood_earlycolor_perlin_frequencies.z);",
            "          lowp float modp_85;",
            "          modp_85 = (((float(mod (",
            "            floor(p_84)",
            "          , 256.0))) + 256.0) * 0.00390625);",
            "          lowp vec2 tmpvar_86;",
            "          tmpvar_86.y = 0.0;",
            "          tmpvar_86.x = modp_85;",
            "          lowp vec2 tmpvar_87;",
            "          tmpvar_87.y = 0.0;",
            "          tmpvar_87.x = texture2D (permutationMap, tmpvar_86, 0.0).x;",
            "          lowp vec2 tmpvar_88;",
            "          tmpvar_88.y = 0.0;",
            "          tmpvar_88.x = (modp_85 + 0.00390625);",
            "          lowp vec2 tmpvar_89;",
            "          tmpvar_89.y = 0.0;",
            "          tmpvar_89.x = texture2D (permutationMap, tmpvar_88, 0.0).x;",
            "          p_84 = (p_84 - floor(p_84));",
            "          noise_71 = (noise_71 + (wood_earlycolor_perlin_weights.z * mix (",
            "            (((texture2D (gradientMap, tmpvar_87, 0.0).x * 2.0) - 1.0) * p_84)",
            "          ,",
            "            (((texture2D (gradientMap, tmpvar_89, 0.0).x * 2.0) - 1.0) * (p_84 - 1.0))",
            "          ,",
            "            (((p_84 * p_84) * p_84) * ((p_84 * (",
            "              (p_84 * 6.0)",
            "             - 15.0)) + 10.0))",
            "          )));",
            "          if ((3 < wood_earlycolor_perlin_bands)) {",
            "            lowp float p_90;",
            "            p_90 = (radiusLength_6 * wood_earlycolor_perlin_frequencies.w);",
            "            lowp float modp_91;",
            "            modp_91 = (((float(mod (",
            "              floor(p_90)",
            "            , 256.0))) + 256.0) * 0.00390625);",
            "            lowp vec2 tmpvar_92;",
            "            tmpvar_92.y = 0.0;",
            "            tmpvar_92.x = modp_91;",
            "            lowp vec2 tmpvar_93;",
            "            tmpvar_93.y = 0.0;",
            "            tmpvar_93.x = texture2D (permutationMap, tmpvar_92, 0.0).x;",
            "            lowp vec2 tmpvar_94;",
            "            tmpvar_94.y = 0.0;",
            "            tmpvar_94.x = (modp_91 + 0.00390625);",
            "            lowp vec2 tmpvar_95;",
            "            tmpvar_95.y = 0.0;",
            "            tmpvar_95.x = texture2D (permutationMap, tmpvar_94, 0.0).x;",
            "            p_90 = (p_90 - floor(p_90));",
            "            noise_71 = (noise_71 + (wood_earlycolor_perlin_weights.w * mix (",
            "              (((texture2D (gradientMap, tmpvar_93, 0.0).x * 2.0) - 1.0) * p_90)",
            "            ,",
            "              (((texture2D (gradientMap, tmpvar_95, 0.0).x * 2.0) - 1.0) * (p_90 - 1.0))",
            "            ,",
            "              (((p_90 * p_90) * p_90) * ((p_90 * (",
            "                (p_90 * 6.0)",
            "               - 15.0)) + 10.0))",
            "            )));",
            "          };",
            "        };",
            "      };",
            "    };",
            "    earlyColor_5 = pow (abs(wood_early_color), vec3((1.0 + noise_71)));",
            "  };",
            "  if (wood_use_manual_late_color) {",
            "    lateColor_4 = wood_manual_late_color;",
            "  } else {",
            "    lateColor_4 = pow (abs(earlyColor_5), vec3(wood_late_color_power));",
            "  };",
            "  if (wood_latecolor_perlin_enable) {",
            "    lowp float noise_96;",
            "    noise_96 = 0.0;",
            "    if ((0 < wood_latecolor_perlin_bands)) {",
            "      lowp float p_97;",
            "      p_97 = (radiusLength_6 * wood_latecolor_perlin_frequencies.x);",
            "      lowp float modp_98;",
            "      modp_98 = (((float(mod (",
            "        floor(p_97)",
            "      , 256.0))) + 256.0) * 0.00390625);",
            "      lowp vec2 tmpvar_99;",
            "      tmpvar_99.y = 0.0;",
            "      tmpvar_99.x = modp_98;",
            "      lowp vec2 tmpvar_100;",
            "      tmpvar_100.y = 0.0;",
            "      tmpvar_100.x = texture2D (permutationMap, tmpvar_99, 0.0).x;",
            "      lowp vec2 tmpvar_101;",
            "      tmpvar_101.y = 0.0;",
            "      tmpvar_101.x = (modp_98 + 0.00390625);",
            "      lowp vec2 tmpvar_102;",
            "      tmpvar_102.y = 0.0;",
            "      tmpvar_102.x = texture2D (permutationMap, tmpvar_101, 0.0).x;",
            "      p_97 = (p_97 - floor(p_97));",
            "      noise_96 = (wood_latecolor_perlin_weights.x * mix ((",
            "        ((texture2D (gradientMap, tmpvar_100, 0.0).x * 2.0) - 1.0)",
            "       * p_97), (",
            "        ((texture2D (gradientMap, tmpvar_102, 0.0).x * 2.0) - 1.0)",
            "       *",
            "        (p_97 - 1.0)",
            "      ), (",
            "        ((p_97 * p_97) * p_97)",
            "       *",
            "        ((p_97 * ((p_97 * 6.0) - 15.0)) + 10.0)",
            "      )));",
            "      if ((1 < wood_latecolor_perlin_bands)) {",
            "        lowp float p_103;",
            "        p_103 = (radiusLength_6 * wood_latecolor_perlin_frequencies.y);",
            "        lowp float modp_104;",
            "        modp_104 = (((float(mod (",
            "          floor(p_103)",
            "        , 256.0))) + 256.0) * 0.00390625);",
            "        lowp vec2 tmpvar_105;",
            "        tmpvar_105.y = 0.0;",
            "        tmpvar_105.x = modp_104;",
            "        lowp vec2 tmpvar_106;",
            "        tmpvar_106.y = 0.0;",
            "        tmpvar_106.x = texture2D (permutationMap, tmpvar_105, 0.0).x;",
            "        lowp vec2 tmpvar_107;",
            "        tmpvar_107.y = 0.0;",
            "        tmpvar_107.x = (modp_104 + 0.00390625);",
            "        lowp vec2 tmpvar_108;",
            "        tmpvar_108.y = 0.0;",
            "        tmpvar_108.x = texture2D (permutationMap, tmpvar_107, 0.0).x;",
            "        p_103 = (p_103 - floor(p_103));",
            "        noise_96 = (noise_96 + (wood_latecolor_perlin_weights.y * mix (",
            "          (((texture2D (gradientMap, tmpvar_106, 0.0).x * 2.0) - 1.0) * p_103)",
            "        ,",
            "          (((texture2D (gradientMap, tmpvar_108, 0.0).x * 2.0) - 1.0) * (p_103 - 1.0))",
            "        ,",
            "          (((p_103 * p_103) * p_103) * ((p_103 * (",
            "            (p_103 * 6.0)",
            "           - 15.0)) + 10.0))",
            "        )));",
            "        if ((2 < wood_latecolor_perlin_bands)) {",
            "          lowp float p_109;",
            "          p_109 = (radiusLength_6 * wood_latecolor_perlin_frequencies.z);",
            "          lowp float modp_110;",
            "          modp_110 = (((float(mod (",
            "            floor(p_109)",
            "          , 256.0))) + 256.0) * 0.00390625);",
            "          lowp vec2 tmpvar_111;",
            "          tmpvar_111.y = 0.0;",
            "          tmpvar_111.x = modp_110;",
            "          lowp vec2 tmpvar_112;",
            "          tmpvar_112.y = 0.0;",
            "          tmpvar_112.x = texture2D (permutationMap, tmpvar_111, 0.0).x;",
            "          lowp vec2 tmpvar_113;",
            "          tmpvar_113.y = 0.0;",
            "          tmpvar_113.x = (modp_110 + 0.00390625);",
            "          lowp vec2 tmpvar_114;",
            "          tmpvar_114.y = 0.0;",
            "          tmpvar_114.x = texture2D (permutationMap, tmpvar_113, 0.0).x;",
            "          p_109 = (p_109 - floor(p_109));",
            "          noise_96 = (noise_96 + (wood_latecolor_perlin_weights.z * mix (",
            "            (((texture2D (gradientMap, tmpvar_112, 0.0).x * 2.0) - 1.0) * p_109)",
            "          ,",
            "            (((texture2D (gradientMap, tmpvar_114, 0.0).x * 2.0) - 1.0) * (p_109 - 1.0))",
            "          ,",
            "            (((p_109 * p_109) * p_109) * ((p_109 * (",
            "              (p_109 * 6.0)",
            "             - 15.0)) + 10.0))",
            "          )));",
            "          if ((3 < wood_latecolor_perlin_bands)) {",
            "            lowp float p_115;",
            "            p_115 = (radiusLength_6 * wood_latecolor_perlin_frequencies.w);",
            "            lowp float modp_116;",
            "            modp_116 = (((float(mod (",
            "              floor(p_115)",
            "            , 256.0))) + 256.0) * 0.00390625);",
            "            lowp vec2 tmpvar_117;",
            "            tmpvar_117.y = 0.0;",
            "            tmpvar_117.x = modp_116;",
            "            lowp vec2 tmpvar_118;",
            "            tmpvar_118.y = 0.0;",
            "            tmpvar_118.x = texture2D (permutationMap, tmpvar_117, 0.0).x;",
            "            lowp vec2 tmpvar_119;",
            "            tmpvar_119.y = 0.0;",
            "            tmpvar_119.x = (modp_116 + 0.00390625);",
            "            lowp vec2 tmpvar_120;",
            "            tmpvar_120.y = 0.0;",
            "            tmpvar_120.x = texture2D (permutationMap, tmpvar_119, 0.0).x;",
            "            p_115 = (p_115 - floor(p_115));",
            "            noise_96 = (noise_96 + (wood_latecolor_perlin_weights.w * mix (",
            "              (((texture2D (gradientMap, tmpvar_118, 0.0).x * 2.0) - 1.0) * p_115)",
            "            ,",
            "              (((texture2D (gradientMap, tmpvar_120, 0.0).x * 2.0) - 1.0) * (p_115 - 1.0))",
            "            ,",
            "              (((p_115 * p_115) * p_115) * ((p_115 * (",
            "                (p_115 * 6.0)",
            "               - 15.0)) + 10.0))",
            "            )));",
            "          };",
            "        };",
            "      };",
            "    };",
            "    lateColor_4 = pow (abs(lateColor_4), vec3((1.0 + noise_96)));",
            "  };",
            "  lowp vec3 tmpvar_121;",
            "  tmpvar_121 = ((earlyWoodRatio_63 * earlyColor_5) + ((1.0 - earlyWoodRatio_63) * lateColor_4));",
            "  diffAlbedo_3 = tmpvar_121;",
            "  if (wood_diffuse_perlin_enable) {",
            "    lowp vec3 p_122;",
            "    p_122.xy = p_7.xy;",
            "    p_122.z = (p_7.z * wood_diffuse_perlin_scale_z);",
            "    lowp vec3 p_123;",
            "    p_123 = p_122;",
            "    highp int bands_124;",
            "    bands_124 = wood_diffuse_perlin_bands;",
            "    highp vec4 w_125;",
            "    w_125 = wood_diffuse_perlin_weights;",
            "    highp vec4 f_126;",
            "    f_126 = wood_diffuse_perlin_frequencies;",
            "    lowp float noise_128;",
            "    noise_128 = 0.0;",
            "    for (int i_127 = 0; i_127 < 4; ++i_127) {",
            "      if ((i_127 >= bands_124)) {",
            "        break;",
            "      };",
            "      lowp vec3 p_129;",
            "      highp float f_126_value = i_127 == 0 ? f_126[0] : i_127 == 1 ? f_126[1] : i_127 == 2 ? f_126[2] : f_126[3];",
            "      p_129 = (p_123 * f_126_value);",
            "      lowp vec4 AA_130;",
            "      lowp vec3 modp_131;",
            "      lowp vec3 tmpvar_132;",
            "      tmpvar_132 = (vec3(mod (floor(p_129), 256.0)));",
            "      modp_131.z = tmpvar_132.z;",
            "      modp_131.xy = (tmpvar_132.xy * 0.00390625);",
            "      AA_130 = ((texture2D (perm2DMap, modp_131.xy, 0.0) * 255.0) + tmpvar_132.z);",
            "      AA_130 = ((vec4(mod (floor(AA_130), 256.0))) * 0.00390625);",
            "      lowp vec2 tmpvar_133;",
            "      tmpvar_133.y = 0.0;",
            "      tmpvar_133.x = AA_130.x;",
            "      lowp vec2 tmpvar_134;",
            "      tmpvar_134.y = 0.0;",
            "      tmpvar_134.x = AA_130.y;",
            "      lowp vec2 tmpvar_135;",
            "      tmpvar_135.y = 0.0;",
            "      tmpvar_135.x = AA_130.z;",
            "      lowp vec2 tmpvar_136;",
            "      tmpvar_136.y = 0.0;",
            "      tmpvar_136.x = AA_130.w;",
            "      lowp vec2 tmpvar_137;",
            "      tmpvar_137.y = 0.0;",
            "      tmpvar_137.x = (AA_130.x + 0.00390625);",
            "      lowp vec2 tmpvar_138;",
            "      tmpvar_138.y = 0.0;",
            "      tmpvar_138.x = (AA_130.y + 0.00390625);",
            "      lowp vec2 tmpvar_139;",
            "      tmpvar_139.y = 0.0;",
            "      tmpvar_139.x = (AA_130.z + 0.00390625);",
            "      lowp vec2 tmpvar_140;",
            "      tmpvar_140.y = 0.0;",
            "      tmpvar_140.x = (AA_130.w + 0.00390625);",
            "      p_129 = (p_129 - floor(p_129));",
            "      lowp vec3 tmpvar_141;",
            "      tmpvar_141 = (((p_129 * p_129) * p_129) * ((p_129 *",
            "        ((p_129 * 6.0) - 15.0)",
            "      ) + 10.0));",
            "      highp float w_125_value = i_127 == 0 ? w_125[0] : i_127 == 1 ? w_125[1] : i_127 == 2 ? w_125[2] : w_125[3];",
            "      noise_128 = (noise_128 + (w_125_value * mix (",
            "        mix (mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_133, 0.0).xyz * 2.0)",
            "         - 1.0), p_129), dot ((",
            "          (texture2D (permGradMap, tmpvar_135, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(-1.0, 0.0, 0.0))), tmpvar_141.x), mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_134, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(0.0, -1.0, 0.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_136, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(-1.0, -1.0, 0.0))), tmpvar_141.x), tmpvar_141.y)",
            "      ,",
            "        mix (mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_137, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(0.0, 0.0, -1.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_139, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(-1.0, 0.0, -1.0))), tmpvar_141.x), mix (dot ((",
            "          (texture2D (permGradMap, tmpvar_138, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(0.0, -1.0, -1.0))), dot ((",
            "          (texture2D (permGradMap, tmpvar_140, 0.0).xyz * 2.0)",
            "         - 1.0), (p_129 + vec3(-1.0, -1.0, -1.0))), tmpvar_141.x), tmpvar_141.y)",
            "      , tmpvar_141.z)));",
            "    };",
            "    diffAlbedo_3 = pow (abs(tmpvar_121), vec3((1.0 + noise_128)));",
            "  };",
            "  if (wood_use_pores) {",
            "    lowp float woodWeight_142;",
            "    woodWeight_142 = 0.0;",
            "    if ((wood_pore_type == 0)) {",
            "      woodWeight_142 = 1.0;",
            "    } else {",
            "      if ((wood_pore_type == 1)) {",
            "        woodWeight_142 = earlyWoodRatio_63;",
            "      } else {",
            "        if ((wood_pore_type == 2)) {",
            "          woodWeight_142 = (1.0 - earlyWoodRatio_63);",
            "        } else {",
            "          woodWeight_142 = -1.0;",
            "        };",
            "      };",
            "    };",
            "    lowp vec3 p_143;",
            "    p_143 = p_7;",
            "    lowp float tmpvar_144;",
            "    lowp float invRsq_146;",
            "    lowp float weight_147;",
            "    lowp vec2 right_148;",
            "    lowp vec2 left_149;",
            "    if ((woodWeight_142 < 0.0)) {",
            "      tmpvar_144 = 0.0;",
            "    } else {",
            "      lowp float tmpvar_150;",
            "      tmpvar_150 = (wood_pore_radius * woodWeight_142);",
            "      left_149 = floor(((p_7.xy - tmpvar_150) / wood_pore_cell_dim));",
            "      right_148 = floor(((p_7.xy + tmpvar_150) / wood_pore_cell_dim));",
            "      weight_147 = 0.0;",
            "      invRsq_146 = (1.0/((tmpvar_150 * tmpvar_150)));",
            "      for (int j_145 = 0; j_145 <= 4; ++j_145) {",
            "        if ((j_145 > int((right_148.y - left_149.y)))) {",
            "          continue;",
            "        };",
            "        for (int i_151 = 0; i_151 <= 4; ++i_151) {",
            "          lowp float impPosY_152;",
            "          lowp float impPosX_153;",
            "          if ((i_151 > int((right_148.x - left_149.x)))) {",
            "            continue;",
            "          };",
            "          lowp vec2 tmpvar_154;",
            "          tmpvar_154.x = (float(i_151) + left_149.x);",
            "          tmpvar_154.y = (float(j_145) + left_149.y);",
            "          lowp float tmpvar_155;",
            "          lowp vec2 k_156;",
            "          k_156 = ((vec2(mod (tmpvar_154, vec2(256.0, 256.0)))) * 0.00390625);",
            "          lowp vec2 tmpvar_157;",
            "          tmpvar_157.y = 0.0;",
            "          tmpvar_157.x = k_156.x;",
            "          lowp vec2 tmpvar_158;",
            "          tmpvar_158.y = 0.0;",
            "          tmpvar_158.x = (texture2D (permutationMap, tmpvar_157).x + k_156.y);",
            "          tmpvar_155 = (texture2D (permutationMap, tmpvar_158).x * 255.0);",
            "          impPosX_153 = ((tmpvar_154.x + (",
            "            (float(mod (tmpvar_155, 16.0)))",
            "           * 0.06666667)) * wood_pore_cell_dim);",
            "          impPosY_152 = ((tmpvar_154.y + (",
            "            floor((tmpvar_155 / 16.0))",
            "           * 0.06666667)) * wood_pore_cell_dim);",
            "          lowp float rsq_159;",
            "          rsq_159 = (((",
            "            (p_143.x - impPosX_153)",
            "           *",
            "            (p_143.x - impPosX_153)",
            "          ) + (",
            "            (p_143.y - impPosY_152)",
            "           *",
            "            (p_143.y - impPosY_152)",
            "          )) * invRsq_146);",
            "          lowp float tmpvar_160;",
            "          if ((rsq_159 >= 1.0)) {",
            "            tmpvar_160 = 0.0;",
            "          } else {",
            "            lowp float tmpvar_161;",
            "            tmpvar_161 = (1.0 - rsq_159);",
            "            tmpvar_160 = ((tmpvar_161 * tmpvar_161) * tmpvar_161);",
            "          };",
            "          weight_147 = (weight_147 + tmpvar_160);",
            "        };",
            "      };",
            "      tmpvar_144 = weight_147;",
            "    };",
            "    diffAlbedo_3 = pow (abs(diffAlbedo_3), vec3(((",
            "      (wood_pore_color_power - 1.0)",
            "     * tmpvar_144) + 1.0)));",
            "  };",
            "  if (wood_use_rays) {",
            "    lowp vec3 p_162;",
            "    p_162 = p_7;",
            "    lowp float radialLength_164;",
            "    lowp float weight_165;",
            "    lowp ivec2 arrSegs_166;",
            "    lowp float sliceIdx_167;",
            "    lowp int segIdx1_168;",
            "    lowp int tmpvar_169;",
            "    tmpvar_169 = int(floor((p_7.z / wood_ray_seg_length_z)));",
            "    lowp float tmpvar_170;",
            "    tmpvar_170 = ((p_7.z / wood_ray_seg_length_z) - float(tmpvar_169));",
            "    segIdx1_168 = (tmpvar_169 - 1);",
            "    if ((tmpvar_170 > 0.5)) {",
            "      segIdx1_168 = (tmpvar_169 + 1);",
            "    };",
            "    lowp float tmpvar_171;",
            "    lowp float tmpvar_172;",
            "    tmpvar_172 = (min (abs(",
            "      (p_7.y / p_7.x)",
            "    ), 1.0) / max (abs(",
            "      (p_7.y / p_7.x)",
            "    ), 1.0));",
            "    lowp float tmpvar_173;",
            "    tmpvar_173 = (tmpvar_172 * tmpvar_172);",
            "    tmpvar_173 = (((",
            "      ((((",
            "        ((((-0.01213232 * tmpvar_173) + 0.05368138) * tmpvar_173) - 0.1173503)",
            "       * tmpvar_173) + 0.1938925) * tmpvar_173) - 0.3326756)",
            "     * tmpvar_173) + 0.9999793) * tmpvar_172);",
            "    tmpvar_173 = (tmpvar_173 + (float(",
            "      (abs((p_7.y / p_7.x)) > 1.0)",
            "    ) * (",
            "      (tmpvar_173 * -2.0)",
            "     + 1.570796)));",
            "    tmpvar_171 = (tmpvar_173 * sign((p_7.y / p_7.x)));",
            "    if ((abs(p_7.x) > (1e-08 * abs(p_7.y)))) {",
            "      if ((p_7.x < 0.0)) {",
            "        if ((p_7.y >= 0.0)) {",
            "          tmpvar_171 += 3.141593;",
            "        } else {",
            "          tmpvar_171 = (tmpvar_171 - 3.141593);",
            "        };",
            "      };",
            "    } else {",
            "      tmpvar_171 = (sign(p_7.y) * 1.570796);",
            "    };",
            "    lowp float tmpvar_174;",
            "    tmpvar_174 = floor(((",
            "      (tmpvar_171 + 3.141593)",
            "     * 0.1591549) * wood_ray_num_slices));",
            "    sliceIdx_167 = tmpvar_174;",
            "    if ((tmpvar_174 == wood_ray_num_slices)) {",
            "      sliceIdx_167 = (tmpvar_174 - 1.0);",
            "    };",
            "    lowp ivec2 tmpvar_175;",
            "    tmpvar_175.x = tmpvar_169;",
            "    tmpvar_175.y = segIdx1_168;",
            "    arrSegs_166 = tmpvar_175;",
            "    weight_165 = 0.0;",
            "    radialLength_164 = sqrt(dot (p_7.xy, p_7.xy));",
            "    for (int seg_163 = 0; seg_163 < 2; ++seg_163) {",
            "      lowp vec3 p1_176;",
            "      lowp float rayTheta_177;",
            "      lowp vec2 tmpvar_178;",
            "      tmpvar_178.x = sliceIdx_167;",
            "      lowp int arrSegs_166_value = seg_163 == 0 ? arrSegs_166[0] : arrSegs_166[1];",
            "      tmpvar_178.y = float(arrSegs_166_value);",
            "      lowp float tmpvar_179;",
            "      lowp vec2 k_180;",
            "      k_180 = ((vec2(mod (tmpvar_178, vec2(256.0, 256.0)))) * 0.00390625);",
            "      lowp vec2 tmpvar_181;",
            "      tmpvar_181.y = 0.0;",
            "      tmpvar_181.x = k_180.x;",
            "      lowp vec2 tmpvar_182;",
            "      tmpvar_182.y = 0.0;",
            "      tmpvar_182.x = (texture2D (permutationMap, tmpvar_181).x + k_180.y);",
            "      tmpvar_179 = (texture2D (permutationMap, tmpvar_182).x * 255.0);",
            "      lowp float tmpvar_183;",
            "      tmpvar_183 = ((float(mod (tmpvar_179, 16.0))) * 0.06666667);",
            "      if ((radialLength_164 < (5.0 * tmpvar_183))) {",
            "        continue;",
            "      };",
            "      rayTheta_177 = (((",
            "        (sliceIdx_167 + tmpvar_183)",
            "       / wood_ray_num_slices) * 6.283185) - 3.141593);",
            "      lowp vec3 tmpvar_184;",
            "      tmpvar_184.z = 0.0;",
            "      tmpvar_184.x = cos(rayTheta_177);",
            "      tmpvar_184.y = sin(rayTheta_177);",
            "      p1_176.xy = p_162.xy;",
            "      p1_176.z = (p_162.z - ((",
            "        float(arrSegs_166_value)",
            "       +",
            "        ((tmpvar_179 / 16.0) * 0.06666667)",
            "      ) * wood_ray_seg_length_z));",
            "      p1_176.z = (p1_176.z / wood_ray_ellipse_z2x);",
            "      lowp vec3 tmpvar_185;",
            "      tmpvar_185 = -(p1_176);",
            "      lowp vec3 tmpvar_186;",
            "      tmpvar_186 = ((tmpvar_184.yzx * tmpvar_185.zxy) - (tmpvar_184.zxy * tmpvar_185.yzx));",
            "      lowp float tmpvar_187;",
            "      tmpvar_187 = (sqrt(dot (tmpvar_186, tmpvar_186)) / sqrt(dot (tmpvar_184, tmpvar_184)));",
            "      lowp float rsq_188;",
            "      rsq_188 = ((tmpvar_187 * tmpvar_187) * (1.0/((wood_ray_ellipse_radius_x * wood_ray_ellipse_radius_x))));",
            "      lowp float tmpvar_189;",
            "      if ((rsq_188 >= 1.0)) {",
            "        tmpvar_189 = 0.0;",
            "      } else {",
            "        lowp float tmpvar_190;",
            "        tmpvar_190 = (1.0 - rsq_188);",
            "        tmpvar_189 = ((tmpvar_190 * tmpvar_190) * tmpvar_190);",
            "      };",
            "      weight_165 = (weight_165 + tmpvar_189);",
            "    };",
            "    diffAlbedo_3 = pow (abs(diffAlbedo_3), vec3(((",
            "      (wood_ray_color_power - 1.0)",
            "     * weight_165) + 1.0)));",
            "  };",
            "  if (wood_use_groove_roughness) {",
            "    roughness_2 = ((earlyWoodRatio_63 * wood_groove_roughness) + ((1.0 - earlyWoodRatio_63) * surface_roughness));",
            "  };",
            "  roughness_inout = roughness_2;",
            "  return diffAlbedo_3;",
            "}",

            "#endif",

            "#if MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0",
            "vec3 DiffuseLobe(vec3 diffuseColor)",
            "{",
                "return diffuseColor * RECIPROCAL_PI;",
            "}",

            "vec3 Rotate(vec3 vec, float angle)",
            "{",
                "float s = sin(angle);",
                "float c = cos(angle);",
                "return vec3(vec.x * c - vec.y * s, vec.x * s + vec.y * c, vec.z);",
            "}",

            // Computes the GGX normal distribution function term, using a tangent-space normal.
            // NOTE: Based on the evaluation code from the Spectrum renderer.
            "float NDF_GGX(float alphaU, float alphaV, vec3 normal)",
            "{",
                "float nx2 = sqr(normal.x);",
                "float ny2 = sqr(normal.y);",
                "float nz2 = sqr(normal.z);",
                "float scale = 1.0/(alphaU * alphaV * PI);",
                "return scale/sqr(nx2/sqr(alphaU) + ny2/sqr(alphaV) + nz2);",
            "}",

            // Computes the shadowing / masking term (G1) appropriate for the GGX NDF.
            // NOTE: Based on "Microfacet Models for Refraction through Rough Surfaces" (Walter, EGSR07).
            "float G1_GGX(float aSqrd)",
            "{",
            "    return 2.0 / (1.0 + sqrt(1.0 + aSqrd));",
            "}",

            "vec3 MicrofacetLobe(",
            "vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH,",
            "float roughness, float anisotropy, float rotation, vec3 reflectance)",
            "{",
                // Determine the "alpha" in each direction, based on anisotropy.
                "vec2 alpha = RoughnessToAlpha(roughness, anisotropy);",

                // Rotate the local half-angle vector.
                "Hlocal = Rotate(Hlocal, rotation);",

                // Compute the Fresnel (F) term.
                "vec3 F = Fresnel_Schlick(reflectance, VdotH);",

                // Compute the normal distribution function (D) term.
                "float D = NDF_GGX(alpha.x, alpha.y, Hlocal);",

                // Compute the shadowing / masking (G) term.
                // NOTE: Based on "Microfacet Models for Refraction through Rough Surfaces" (Walter, EGSR07).
                "float alpha2 = max(sqr(alpha.x), sqr(alpha.y));",
                "float alpha2NL = aSqrd(alpha2, NdotL);",
                "float alpha2NV = aSqrd(alpha2, NdotV);",
                "float G = G1_GGX(alpha2NL) * G1_GGX(alpha2NV);",

                // Compute and return the specular term using the microfacet model.
                "return max(F * D * G / (4.0 * NdotL * NdotV), vec3(0.0));",
            "}",

            "#if defined( PRISMOPAQUE )",
            // ==============================================
            // Opaque Material Type
            // ==============================================

            // Computes the BRDF for the Opaque material type.
            "vec3 BRDF_Opaque(vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH, ",
            "                 vec3 surfaceAlbedo, float surfaceRoughness, float surfaceAnisotropy, float surfaceRotation, ",
            "                 float opaqueF0, vec3 opaqueAlbedo)",
            "{",
                // Compute the diffuse term with a diffuse lobe.
            "    vec3 diffuse = DiffuseLobe(opaqueAlbedo);",
                // Compute the specular term with a microfacet lobe, scaled by the surface albedo.
            "    vec3 specular = surfaceAlbedo * MicrofacetLobe(",
            "        Hlocal, NdotL, NdotH, NdotV, VdotH,",
            "        surfaceRoughness, surfaceAnisotropy, surfaceRotation, vec3(opaqueF0));",

                // Return the sum of the diffuse and specular terms.
            "    return (specular+diffuse)*NdotL;",
            "}",
            "#elif defined( PRISMMETAL )",
            // ==============================================
            // Metal Material Type
            // ==============================================

            // Computes the BRDF for the Opaque material type
            "vec3 BRDF_Metal(vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH, ",
            "                vec3 surfaceAlbedo, float surfaceRoughness, float surfaceAnisotropy, float surfaceRotation, ",
            "                vec3 metalF0)",
            "{",
                // Compute the specular term with a microfacet lobe, scaled by the surface albedo.
            "    vec3 specular = surfaceAlbedo * MicrofacetLobe(",
            "        Hlocal, NdotL, NdotH, NdotV, VdotH,",
            "        surfaceRoughness, surfaceAnisotropy, surfaceRotation, metalF0);",

                // Return the specular term.
                // NOTE: Metal *only* reflects light, no scattering.
            "    return specular*NdotL;",
            "}",
            "#elif defined( PRISMLAYERED )",
            // ==============================================
            // Layered Material Type
            // ==============================================

            // Computes the BRDF for the Layered material type.
            "vec3 BRDF_Layered(vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH, ",
            "                  vec3 Hlocal2, float N2dotL, float N2dotH, float N2dotV, ",
            "                  vec3 surfaceAlbedo, float surfaceRoughness, float surfaceAnisotropy, float surfaceRotation,",
            "                  float layeredF0, vec3 layeredDiffuse, float layeredRoughness, float layeredAnisotropy,",
            "                  float layeredRotation, vec3 bottom_f0, float layeredFraction)",
            "{",
                // Compute the Fresnel reflectance of the top surface, using the incoming and outgoing
                // directions and the normal.  Use this to compute the amount of light passing into the surface
                // *and* not coming back out.
            "    vec3 Fl = Fresnel_Schlick(vec3(layeredF0), NdotL);",
            "    vec3 Fv = Fresnel_Schlick(vec3(layeredF0), NdotV);",
            "    vec3 amount = (1.0 - Fl) * (1.0 - Fv);",

                // Compute the specular term of the top layer, scaled by the surface albedo.
            "    vec3 topSpecular = surfaceAlbedo * MicrofacetLobe(",
            "        Hlocal, NdotL, NdotH, NdotV, VdotH,",
            "        surfaceRoughness, surfaceAnisotropy, surfaceRotation,",
            "        vec3(layeredF0));",

                // Compute the diffuse term of the top layer with a diffuse lobe.
            "    vec3 topDiffuse = DiffuseLobe(layeredDiffuse);",

                // Compute the specular term of the bottom (metal) layer.
            "    vec3 botSpecular = MicrofacetLobe(",
            "        Hlocal2, N2dotL, N2dotH, N2dotV, VdotH,",
            "        layeredRoughness, layeredAnisotropy, layeredRotation,",
            "        bottom_f0);",

                // Return the top specular term, added to a linear combination of the top diffuse term and
                // bottom specular term, using the fraction parameter, and scaled by the light amount.
            "    return topSpecular*NdotL + amount * mix(topDiffuse*NdotL, botSpecular*N2dotL, layeredFraction);",
            "}",

            "#elif defined( PRISMTRANSPARENT )",
            "vec3 BRDF_Transparent(vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH, ",
            "                vec3 surfaceAlbedo, float surfaceRoughness, float surfaceAnisotropy, float surfaceRotation)",
            "{",
                // Compute reflectance from the index of refraction.
            "    vec3 reflectance = vec3(IORToReflectance(transparent_ior));",

                // Compute the specular term with a microfacet lobe, scaled by the surface albedo.
            "    vec3 specular = surfaceAlbedo * MicrofacetLobe(",
            "        Hlocal, NdotL, NdotH, NdotV, VdotH,",
            "        surfaceRoughness, surfaceAnisotropy, surfaceRotation, reflectance);",

                // Return the specular term.
                // NOTE: The absorption color is handled as part of the environment component.
            "    return specular*NdotL;",
            "}",

            "#elif defined( PRISMWOOD )",
            // ==============================================
            // 3D Wood Material Type
            // ==============================================

            // Computes the BRDF for the 3D Wood material type.
            "vec3 BRDF_Wood(vec3 Hlocal, float NdotL, float NdotH, float NdotV, float VdotH, ",
            "                 vec3 surfaceAlbedo, float surfaceRoughness, vec3 woodDiffuse)",
            "{",
                // Compute the diffuse term with a diffuse lobe.
            "    vec3 diffuse = DiffuseLobe(woodDiffuse);",
                // Compute the specular term with a microfacet lobe.
            "    vec3 specular = surfaceAlbedo * MicrofacetLobe(",
            "        Hlocal, NdotL, NdotH, NdotV, VdotH,",
            "        surfaceRoughness, 0.0, 0.0, vec3(0.04));",

                // Return the sum of the diffuse and specular terms.
            "    return (specular+diffuse)*NdotL;",
            "}",
            "#endif",
            "#endif",

            "#if defined( USE_ENVMAP )",
            "#if defined( PRISMOPAQUE )",
            // ==============================================
            // Opaque Material Type
            // ==============================================
            // Computes the radiance for the Opaque material type under an image-based environment light.
            "vec3 Environment_Opaque(vec3 N, vec3 V, float NdotV, vec3 surfaceAlbedo, float surfaceRoughness,",
            "                        float opaqueF0, vec3 opaqueAlbedo)",
            "{",
                // Convert alpha to roughness, and convert that to a comparable Phong exponent.
            "    float alpha = RoughnessToAlpha(surfaceRoughness, 0.0).x;",
            "    float exponent = AlphaToPhong(alpha);",
            "    float reflMipIndex = ExponentToReflMipIndex(exponent);",

                // Compute the Fresnel (F) term from the mirror reflection angle.
            "    vec3 F = Fresnel_Rough(vec3(opaqueF0), NdotV, alpha);",

            "#if defined( USE_IRRADIANCEMAP )",
                // Sample the irradiance environment map using the surface normal, multiply by the diffuse
                // and balance with the Fresnel term to produce the diffuse term.
            "    vec3 envIrradiance = sampleNormal(N);",
            "#else",
            "    vec3 envIrradiance = vec3(1.0);",
            "#endif",
            "    vec3 diffuse = (1.0 - F) * opaqueAlbedo * envIrradiance;",

            "     vec3 luminanceModifier;",
            GetPrismMapSampleChunk("opaque_luminance_modifier", "luminanceModifier", false, true),
            "    vec3 emission = luminanceModifier * opaque_luminance;",

                // Sample the specular (glossy and radiance) environment maps, and multiply by the Fresnel term
                // and surface albedo to produce the specular term.
            "    vec3 envSpecular = sampleReflection(N, V, reflMipIndex);",
            "    vec3 specular = F* surfaceAlbedo * envSpecular;",

                // Return the sum of the diffuse and specular terms.
            "    return diffuse + specular + emission;",
            "}",

            "#elif defined( PRISMMETAL )",
            // ==============================================
            // Metal Material Type
            // ==============================================

            // Computes the radiance for the Metal material type under an image-based environment light.
            "vec3 Environment_Metal(vec3 N, vec3 V, float NdotV, vec3 surfaceAlbedo, float surfaceRoughness, vec3 metalF0)",
            "{",
                // Convert alpha to roughness, and convert that to a comparable Phong exponent.
            "    float alpha = RoughnessToAlpha(surfaceRoughness, 0.0).x;",
            "    float exponent = AlphaToPhong(alpha);",
            "    float reflMipIndex = ExponentToReflMipIndex(exponent);",

                // Compute the Fresnel (F) term from the mirror reflection angle.
            "    vec3 F = Fresnel_Rough(metalF0, NdotV, alpha);",

                // Sample the specular (glossy and radiance) environment maps, and multiply by the Fresnel term
                // and surface albedo to produce the specular term.
            "    vec3 envSpecular = sampleReflection(N, V, reflMipIndex);",
            "    vec3 specular = F * surfaceAlbedo * envSpecular;",

                // Return the specular term.
            "    return specular;",
            "}",

            "#elif defined( PRISMLAYERED )",
            // ==============================================
            // Layered Material Type
            // ==============================================

            // Computes the radiance for the Layered material type under an image-based environment light.
            "vec3 Environment_Layered(vec3 N, vec3 V, float NdotV, vec3 N2, float N2dotV, vec3 surfaceAlbedo, float surfaceRoughness,",
            "                         float layeredF0, vec3 layeredDiffuse, float layeredRoughness, float layeredAnisotropy,",
            "                         float layeredRotation, vec3 bottom_f0, float layeredFraction)",
            "{",
                // Compute the specular term of the top layer.
                // NOTE: See the Opaque implementation for detailed comments.
                // NOTE: This does not use the "rough" Fresnel term, just the Schlick one.
            "    float alpha = RoughnessToAlpha(surfaceRoughness, 0.0).x;",
            "    float exponent = AlphaToPhong(alpha);",
            "    float reflMipIndex = ExponentToReflMipIndex(exponent);",
            "    vec3 envSpecular = sampleReflection(N, V, reflMipIndex);",
            "    vec3 F = Fresnel_Schlick(vec3(layeredF0), NdotV);",
            "    vec3 topSpecular = F * surfaceAlbedo * envSpecular;",

                // Compute the amount of light passing into the surface.
            "    vec3 amount = (1.0 - F);",

                // Compute the diffuse term of the top layer.
                // NOTE: See the Opaque implementation for detailed comments.    
            "#if defined( USE_IRRADIANCEMAP )",
                // Sample the irradiance environment map using the surface normal.
            "    vec3 envIrradiance = sampleNormal(N);",
            "#else",
            "    vec3 envIrradiance = vec3(1.0);",
            "#endif",
            "    vec3 topDiffuse = layeredDiffuse * envIrradiance;",

                // Compute the specular term of the bottom layer.
                // NOTE: See the Opaque implementation for detailed comments.
            "    alpha = RoughnessToAlpha(layeredRoughness, 0.0).x;",
            "    exponent = AlphaToPhong(alpha);",
            "    reflMipIndex = ExponentToReflMipIndex(exponent);",
            "    envSpecular = sampleReflection(N2, V, reflMipIndex);",
            "    F = Fresnel_Rough(bottom_f0, N2dotV, alpha);",
            "    vec3 botSpecular = F * envSpecular;",

                // Return the top specular term, added to a linear combination of the top diffuse term and
                // bottom specular term, using the fraction parameter, and scaled the light amount.
            "    return topSpecular + amount * mix(topDiffuse, botSpecular, layeredFraction);",
            "}",

            "#elif defined( PRISMTRANSPARENT )",
            // ==============================================
            // Transparent Material Type
            // ==============================================

            "vec3 Environment_Transparent(vec3 N, vec3 V, float NdotV, vec3 surfaceAlbedo, float surfaceRoughness)",
            "{",
                // Convert alpha to roughness, and convert that to a comparable Phong exponent.
            "    float alpha = RoughnessToAlpha(surfaceRoughness, 0.0).x;",
            "    float exponent = AlphaToPhong(alpha);",
            "    float reflMipIndex = ExponentToReflMipIndex(exponent);",

                // Compute the Fresnel (F) term from the mirror reflection angle.
            "    vec3 reflectance = vec3(IORToReflectance(transparent_ior));",
            "    vec3 F = Fresnel_Rough(reflectance, NdotV, alpha);",

                // Sample the specular (glossy and radiance) environment maps, and multiply by the Fresnel term
                // and surface albedo to produce the specular term.
            "    vec3 envSpecular = sampleReflection(N, V, reflMipIndex);",
            "    vec3 specular = F * surfaceAlbedo * envSpecular;",

            "#if defined( USE_IRRADIANCEMAP )",
                // Sample the irradiance environment map using the surface normal.
            "    vec3 envIrradiance = sampleNormal(N);",
            "#else",
            "    vec3 envIrradiance = vec3(1.0);",
            "#endif",

                // Add a "color" term that take the absorption color into account.  This is basically a diffuse
                // component, so that some kind of lighting is included, which is needed for HDR consistency.
                // NOTE: This is *not* physical, and is just a cheap way to include the absorption color.
            "    vec3 color = 0.5 * (1.0 - F) * transparent_color * envIrradiance;",

                // Return the specular term, with the "color" term added.
            "    return specular + color;",
            "}",

            "#elif defined( PRISMWOOD )",
            // ==============================================
            // Wood Material Type
            // ==============================================
            "vec3 Environment_Wood(vec3 N, vec3 V, float NdotV, vec3 surfaceAlbedo, float surfaceRoughness, vec3 woodDiffuse)",
            "{",
                // Convert alpha to roughness, and convert that to a comparable Phong exponent.
            "    float alpha = RoughnessToAlpha(surfaceRoughness, 0.0).x;",
            "    float exponent = AlphaToPhong(alpha);",
            "    float reflMipIndex = ExponentToReflMipIndex(exponent);",

                // Compute the Fresnel (F) term from the mirror reflection angle.
            "    vec3 F = Fresnel_Rough(vec3(0.04), NdotV, alpha);",

            "#if defined( USE_IRRADIANCEMAP )",
                // Sample the irradiance environment map using the surface normal, multiply by the diffuse
                // and balance with the Fresnel term to produce the diffuse term.
            "    vec3 envIrradiance = sampleNormal(N);",
            "#else",
            "    vec3 envIrradiance = vec3(1.0);",
            "#endif",
            "    vec3 diffuse = (1.0 - F) * woodDiffuse * envIrradiance;",
                // Sample the specular (glossy and radiance) environment maps, and multiply by the Fresnel term
                // and surface albedo to produce the specular term.
            "    vec3 envSpecular = sampleReflection(N, V, reflMipIndex);",
            "    vec3 specular = F * surfaceAlbedo * envSpecular;",

                // Return the sum of the diffuse and specular terms.
            "    return diffuse + specular;",
            "}",
            "#endif",
            "#endif",

            "varying vec3 vNormal;",
            "varying vec3 vViewPosition;",
            CutPlanesShaderChunk,

            "void main() {",
            "#if NUM_CUTPLANES > 0",
                "checkCutPlanes(vWorldPosition);",
            "#endif",
                "vec3 N = normalize(vNormal);",
            "#if defined( USE_SURFACE_NORMAL_MAP ) || defined( USE_LAYERED_NORMAL_MAP )" +
            " || MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0",
            "#ifndef USE_MAP",
                "vec3 Tu = normalize(vTangent);",
                "vec3 Tv = normalize(vBitangent);",
            "#else",
                // Per-Pixel Tangent Space Normal Mapping
                // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html
                "vec3 q0 = dFdx( -vViewPosition );",
                "vec3 q1 = dFdy( -vViewPosition );",
                "vec2 st0 = dFdx( vUv );",
                "vec2 st1 = dFdy( vUv );",

                "vec3 Tu = normalize(  q0 * st1.t - q1 * st0.t );",
                "vec3 Tv = normalize( -q0 * st1.s + q1 * st0.s );",
            "#endif",
            "#endif",
                //With ortho projection, the view direction needs to be
                //adjusted so that all view direction rays (for all pixels) are parallel
                //instead of going from the camera position directly to the vertex like
                //in perspective. In view space, this is kind of easy -- the view vector is along Z.
                //TODO: Actially the vViewPosition varying is the position of the camers wrt the vertex
                //so the naming of the variable can be clarified.
                "vec3 V;",
                "if (projectionMatrix[3][3] == 0.0) {",
                    "V = normalize( vViewPosition );",
                "} else {",
                    "V = vec3(0.0, 0.0, 1.0);",
                "}",
                "N = faceforward(N, -V, N);",

            "#if defined(PRISMLAYERED)",
                "vec3 N2 = N;",
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

                "#if defined( USE_SURFACE_NORMAL_MAP )",
                "if (surface_normal_map_bumpmapType == 0)",
                "     N = heightMapTransform(surface_normal_map, vUv, surface_normal_map_texMatrix, surface_normal_map_bumpScale, Tu, Tv, N);",
                "else",
                "     N = normalMapTransform(surface_normal_map, vUv, surface_normal_map_texMatrix, surface_normal_map_bumpScale, Tu, Tv, N);",
                "#endif",

                "#if defined( USE_LAYERED_NORMAL_MAP )",
                "if (layered_normal_map_bumpmapType == 0)",
                "     N2 = heightMapTransform(layered_normal_map, vUv, layered_normal_map_texMatrix, layered_normal_map_bumpScale, Tu, Tv, N2);",
                "else",
                "     N2 = normalMapTransform(layered_normal_map, vUv, layered_normal_map_texMatrix, layered_normal_map_bumpScale, Tu, Tv, N2);",
                "#endif",

                // Compute NdotV, cosine of the angle between the normal and the view direction.  Clamp this to
                // avoid negative values, which would cause artifacts.
                // NOTE: The view direction could be below the surface normal due to interpolated normals or
                // bump mapping, even if the surface itself is visible.
                "float NdotV = dot(N, V);",
            "#if defined(PRISMLAYERED)",
                "float N2dotV = dot(N2, V);",
            "#endif",

                "vec3 surfaceAlbedo;",
                GetPrismMapSampleChunk("surface_albedo", "surfaceAlbedo", false, true),
                "float surfaceRoughness;",
                GetPrismMapSampleChunk("surface_roughness", "surfaceRoughness", true, false),
                "float surfaceAnisotropy;",
                GetPrismMapSampleChunk("surface_anisotropy", "surfaceAnisotropy", true, false),
                "float surfaceRotation;",
                GetPrismMapSampleChunk("surface_rotation", "surfaceRotation", true, false),

                "#if defined(PRISMOPAQUE)",
                "float opaqueF0;",
                GetPrismMapSampleChunk("opaque_f0", "opaqueF0", true, false),
                "vec3 opaqueAlbedo;",
                GetPrismMapSampleChunk("opaque_albedo", "opaqueAlbedo", false, true),

                "#elif defined(PRISMMETAL)",
                "vec3 metalF0;",
                GetPrismMapSampleChunk("metal_f0", "metalF0", false, true),

                "#elif defined(PRISMLAYERED)",
                "float layeredF0;",
                GetPrismMapSampleChunk("layered_f0", "layeredF0", true, false),
                "vec3 layeredDiffuse;",
                GetPrismMapSampleChunk("layered_diffuse", "layeredDiffuse", false, true),
                "float layeredRoughness;",
                GetPrismMapSampleChunk("layered_roughness", "layeredRoughness", true, false),
                "float layeredAnisotropy;",
                GetPrismMapSampleChunk("layered_anisotropy", "layeredAnisotropy", true, false),
                "float layeredRotation;",
                GetPrismMapSampleChunk("layered_rotation", "layeredRotation", true, false),
                "vec3 bottom_f0;",
                GetPrismMapSampleChunk("layered_bottom_f0", "bottom_f0", false, true),
                "float layeredFraction;",
                GetPrismMapSampleChunk("layered_fraction", "layeredFraction", true, false),
                "#elif defined(PRISMWOOD)",
                "vec3 woodDiffuse = NoiseWood(surfaceRoughness);",
                "#endif",

                "vec3 outRadianceLight = vec3(0.0);",
                "#if MAX_DIR_LIGHTS > 0 || MAX_POINT_LIGHTS > 0 || MAX_SPOT_LIGHTS > 0",
                "vec3 lightDirection[ MAX_DIR_LIGHTS + MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS ];",
                "vec3 lightColor[ MAX_DIR_LIGHTS + MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS ];",

                "#if MAX_DIR_LIGHTS > 0",
                "for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {",

                    "vec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );",
                    "lightDirection[i] = normalize( lDirection.xyz );",
                    "lightColor[i] = SRGBToLinear(directionalLightColor[ i ]);",
                "}",
                "#endif",

                "#if MAX_POINT_LIGHTS > 0",
                "for( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {",
                    "vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );",
                    "vec3 lVector = lPosition.xyz + vViewPosition.xyz;",
                    "lightDirection[MAX_DIR_LIGHTS + i] = normalize( lVector );",
                    "float lDistance = 1.0;",
                    "if ( pointLightDistance[ i ] > 0.0 )",
                        "lDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );",
                    "lightColor[MAX_DIR_LIGHTS + i] = SRGBToLinear(pointLightColor[ i ]) * lDistance;",
                "}",
                "#endif",

                "#if MAX_SPOT_LIGHTS > 0",
                "for( int i = 0; i < MAX_SPOT_LIGHTS; i ++ ) {",
                    "vec4 lPosition = viewMatrix * vec4( spotLightPosition[ i ], 1.0 );",
                    "vec3 lVector = lPosition.xyz + vViewPosition.xyz;",
                    "lightDirection[MAX_DIR_LIGHTS + MAX_POINT_LIGHTS + i] = normalize( lVector );",
                    "float lDistance = 1.0;",
                    "if ( spotLightDistance[ i ] > 0.0 )",
                        "lDistance = 1.0 - min( ( length( lVector ) / spotLightDistance[ i ] ), 1.0 );",
                    "float spotEffect = dot( spotLightDirection[ i ], normalize( spotLightPosition[ i ] - vWorldPosition ) );",
                    "if ( spotEffect > spotLightAngleCos[ i ] )",
                            "spotEffect = max( pow( spotEffect, spotLightExponent[ i ] ), 0.0 );",
                    "lightColor[MAX_DIR_LIGHTS + MAX_POINT_LIGHTS + i] = SRGBToLinear(spotLightColor[ i ]) * lDistance * spotEffect;",
                "}",
                "#endif",

                "for( int i = 0; i < MAX_DIR_LIGHTS + MAX_POINT_LIGHTS + MAX_SPOT_LIGHTS; i ++ ) {",
                    "vec3 L = lightDirection[i];",
                    "float NdotL = dot(N, L);",
                    "vec3 H = normalize(L + V);",
                    "float NdotH = dot(N, H);",
                    "float VdotH = dot(V, H);",
                    "float Hu = dot(H, Tu);",
                    "float Hv = dot(H, Tv);",
                    "vec3 Hlocal = vec3(Hu, Hv, NdotH);",
                    "#if defined(PRISMLAYERED)",
                        "float N2dotL = dot(N2, L);",
                        "float N2dotH = dot(N2, H);",
                        "vec3 Hlocal2 = vec3(Hu, Hv, N2dotH);",
                    "#endif",
                    "vec3 brdf = lightColor[i] * ",
                    "#if defined(PRISMOPAQUE)",
                    "    BRDF_Opaque(Hlocal, NdotL, NdotH, NdotV, VdotH,",
                    "                surfaceAlbedo, surfaceRoughness, surfaceAnisotropy, surfaceRotation,",
                    "                opaqueF0, opaqueAlbedo);",
                    "#elif defined(PRISMMETAL)",
                    "    BRDF_Metal(Hlocal, NdotL, NdotH, NdotV, VdotH, ",
                    "               surfaceAlbedo, surfaceRoughness, surfaceAnisotropy, surfaceRotation, ",
                    "               metalF0);",
                    "#elif defined(PRISMLAYERED)",
                    "    BRDF_Layered(Hlocal, NdotL, NdotH, NdotV, VdotH, Hlocal2, N2dotL, N2dotH, N2dotV,",
                    "                 surfaceAlbedo, surfaceRoughness, surfaceAnisotropy, surfaceRotation,",
                    "                 layeredF0, layeredDiffuse, layeredRoughness, layeredAnisotropy,",
                    "                 layeredRotation, bottom_f0, layeredFraction);",
                    "#elif defined(PRISMTRANSPARENT)",
                    "    BRDF_Transparent(Hlocal, NdotL, NdotH, NdotV, VdotH, surfaceAlbedo, surfaceRoughness, surfaceAnisotropy, surfaceRotation);",
                    "#elif defined(PRISMWOOD)",
                    "    BRDF_Wood(Hlocal, NdotL, NdotH, NdotV, VdotH, surfaceAlbedo, surfaceRoughness, woodDiffuse);",
                    "#endif",
                    "outRadianceLight += max(vec3(0.0), brdf);",
                "}",
                "#endif",

                "vec3 outRadianceEnv = vec3(0.0);",
                "#if defined( USE_ENVMAP )",
                // Compute the outgoing radiance due to the environment light.
                "outRadianceEnv =",
                "#if defined(PRISMOPAQUE)",
                "    Environment_Opaque(N, V, clamp(NdotV, 0.0, 1.0), surfaceAlbedo, surfaceRoughness,",
                "                        opaqueF0, opaqueAlbedo);",
                "#elif defined(PRISMMETAL)",
                "    Environment_Metal(N, V, clamp(NdotV, 0.0, 1.0), surfaceAlbedo, surfaceRoughness, metalF0);",
                "#elif defined(PRISMLAYERED)",
                "    Environment_Layered(N, V, clamp(NdotV, 0.0, 1.0), N2, clamp(N2dotV, 0.0, 1.0), surfaceAlbedo, surfaceRoughness,",
                "                layeredF0, layeredDiffuse, layeredRoughness, layeredAnisotropy,",
                "                layeredRotation, bottom_f0, layeredFraction);",
                "#elif defined(PRISMTRANSPARENT)",
                "    Environment_Transparent(N, V, clamp(NdotV, 0.0, 1.0), surfaceAlbedo, surfaceRoughness);",
                "#elif defined(PRISMWOOD)",
                "    Environment_Wood(N, V, clamp(NdotV, 0.0, 1.0), surfaceAlbedo, surfaceRoughness, woodDiffuse);",
                "#endif",
                "#endif",
                // Opacity is 1.0 by default.
                "float opacity = 1.0;",

                "float surface_cutout = 1.0;",
                GetPrismMapSampleChunk("surface_cutout", "surface_cutout", true, false),
                "#if defined( USE_SURFACE_CUTOUT_MAP )",
                "if(surface_cutout < 0.01) discard;",
                "#endif",

                // For transparent materials, vary the opacity based on the angle between the normal and view
                // vectors.  Also, increase opacity with surface roughness, and have a minimum opacity to avoid
                // dimming the specular component too much.
                // NOTE: This is *not* physical, and is just a cheap way to have opacity change with roughness.
                "#if defined(PRISMTRANSPARENT)",
                "if (transparent_ior == 1.0 && transparent_color == vec3(1.0,1.0,1.0))",//Prism Air, set alpha to 0;
                    "opacity = 0.0;",
                "else",
                    "opacity = max(0.5, mix(1.0, surfaceRoughness, NdotV));",
                "#endif",

                "gl_FragColor = vec4( outRadianceLight + outRadianceEnv, opacity*surface_cutout );",

                "#if TONEMAP_OUTPUT == 1",
                    "gl_FragColor.xyz = toneMapCanonOGS_WithGamma_WithColorPerserving(exposureBias * gl_FragColor.xyz);",
                "#elif TONEMAP_OUTPUT == 2",
                    "gl_FragColor.xyz = toneMapCanonFilmic_WithGamma(exposureBias * gl_FragColor.xyz);",
                "#endif",
                // to turn off all shading (helps in seeing SAO, for example), uncomment:
                //"gl_FragColor = vec4( vec3 ( 1.0 ), 1.0 );",

                ThemingFragmentShaderChunk,

                FinalOutputShaderChunk,
            "}"


        ].join("\n")

    };
    // currently not used
    function createShaderMaterial(shader) {
        return new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(shader.uniforms),
            vertexShader: shader.vertexShader,
            fragmentShader: shader.fragmentShader,
            defines: THREE.UniformsUtils.clone(shader.defines)
        });
    }
    THREE.ShaderLib['prism'] = PrismShader;

    return PrismShader;
});