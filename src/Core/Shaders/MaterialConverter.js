define([
    './Fn/createPrismMaterial'
], function(createPrismMaterial) {
    'use strict';
    // Helper functions to parse ugly Protein JSON
    function parseMaterialColor(props, name) {
        if (!props || !props["colors"])
            return new THREE.Color(1, 0, 0); //error -- return red

        var cobj = props["colors"][name];
        if (!cobj)
            return new THREE.Color(0, 0, 0); //ok -- color is not defined
        //which in the C++ LMVTK is equal to DEFAULT_COLOR, which is black

        var vals = cobj["values"];
        if (!vals || !vals.length)
            return new THREE.Color(1, 0, 0); //error

        var rgb = vals[0];
        return new THREE.Color(rgb["r"], rgb["g"], rgb["b"]);
    }

    function parseMaterialScalar(props, name, undefVal) {
        if (!props || !props["scalars"])
            return undefVal;

        var vobj = props["scalars"][name];
        if (!vobj)
            return undefVal;

        return vobj["values"][0];
    }

    function parseMaterialBoolean(props, name, undefVal) {
        if (!props || !props["booleans"])
            return undefVal;

        var vobj = props["booleans"];
        if (!vobj)
            return undefVal;

        return vobj[name];
    }

    function parseMaterialGeneric(props, category, name, undefVal) {
        if (!props || !props[category])
            return undefVal;

        var vobj = props[category][name];
        if (!vobj)
            return undefVal;

        return vobj["values"][0];
    }

    function parseWoodProfile(props, category, name) {
        //Init a default object.
        var ret = {
            bands: 0,
            weights: new THREE.Vector4(1, 1, 1, 1),
            frequencies: new THREE.Vector4(1, 1, 1, 1)
        };

        if (!props || !props[category])
            return ret;

        var vobj = props[category][name];
        if (!vobj || !vobj.values || !(vobj.values instanceof Array))
            return ret;

        var values = vobj.values;
        ret.bands = values.length / 2;
        for (var i = 0; i < ret.bands; ++i) {
            ret.frequencies.setComponent(i, 1 / values[2 * i]);
            ret.weights.setComponent(i, values[2 * i + 1]);
        }

        return ret;
    }

    function parseMaterialScalarWithSceneUnit(props, name, sceneUnit, undefVal) {
        if (!props || !props["scalars"])
            return undefVal;

        var vobj = props["scalars"][name];
        if (!vobj)
            return undefVal;

        return ConvertDistance(vobj["values"][0], vobj["units"], sceneUnit);
    }

    function parseMaterialGenericConnection(props, category, name, undefVal) {
        if (!props || !props[category])
            return undefVal;

        var vobj = props[category][name];
        if (!vobj)
            return undefVal;

        var connections = vobj["connections"];
        if (!connections)
            return undefVal;

        return vobj["connections"][0];
    }

    function SRGBToLinearFloat(component) {
        var result = component;

        if (result <= 0.04045)
            result /= 12.92;
        else
            result = Math.pow((result + 0.055) / 1.055, 2.4);

        return result;
    }

    function SRGBToLinear(color) {
        var r, g, b;

        r = SRGBToLinearFloat(color.r);
        g = SRGBToLinearFloat(color.g);
        b = SRGBToLinearFloat(color.b);

        return new THREE.Color(r, g, b);
    }

    // TODO, since web doesn't use AdCoreUnits dependencies, only 9 units are supported in web now.
    var UnitPerMeter = {
        MilliMeter: 1000, mm: 1000, 8206: 1000,
        DeciMeter: 10, dm: 10, 8204: 10,
        CentiMeter: 100, cm: 100, 8205: 100,
        Meter: 1, m: 1, 8193: 1,
        KiloMeter: 0.001, km: 0.001, 8201: 0.001,
        Inch: 39.37008, in: 39.37008, 8214: 39.37008,
        Foot: 3.28084, ft: 3.28084, 8215: 3.28084,
        Mile: 0.00062137, mi: 0.00062137, 8225: 0.00062137,
        Yard: 1.09361, yard: 1.09361, 8221: 1.09361
    };

    // Convert meter to the new unit.
    function ConvertDistance(distance, currentUnit, newUnit) {

        var factor = UnitPerMeter[newUnit];
        if (!factor) {
            factor = 1;
            Logger.warn('Unsupported unit: ' + newUnit);
        }

        var divisor = UnitPerMeter[currentUnit];
        if (!divisor) {
            divisor = 1;
            Logger.warn('Unsupported unit: ' + currentUnit);
        }

        return distance * factor / divisor;
    }

    function GetBumpScale(props, type, sceneUnit) {
        if (type === 0) {
            var depth = parseMaterialScalarWithSceneUnit(props, "bumpmap_Depth", sceneUnit, 0);

            var scale_x = 1;
            var scale_y = 1;
            if (parseMaterialGeneric(props, "scalars", "texture_RealWorldScale") != null) {
                scale_x = scale_y = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScale", sceneUnit, 1);
            }
            else {
                scale_x = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScaleX", sceneUnit, 1);
                scale_y = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScaleY", sceneUnit, 1);
            }
            scale_x = (scale_x === 0) ? 1 : 1 / scale_x;
            scale_y = (scale_y === 0) ? 1 : 1 / scale_y;

            return new THREE.Vector2(scale_x * depth, scale_y * depth);
        }
        else {
            var normalScale = parseMaterialGeneric(props, "scalars", "bumpmap_NormalScale", 1);
            return new THREE.Vector2(normalScale, normalScale);
        }
    }

    function Get2DMapTransform(props, sceneUnit) {

        var offset_x = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldOffsetX", sceneUnit, 0);
        var offset_y = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldOffsetY", sceneUnit, 0);
        var uoffset = parseMaterialGeneric(props, "scalars", "texture_UOffset", 0);
        var voffset = parseMaterialGeneric(props, "scalars", "texture_VOffset", 0);

        // include the additional U and V Offsets
        offset_x += uoffset;
        offset_y += voffset;

        // Get the real-world size, i.e. the size of the map in a real unit, and use the reciprocal as
        // the scale.  If the scale is zero, use one instead.
        var scale_x = 1;
        var scale_y = 1;
        if (parseMaterialGeneric(props, "scalars", "texture_RealWorldScale") != null) {
            scale_x = scale_y = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScale", sceneUnit, 1);
        }
        else {
            scale_x = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScaleX", sceneUnit, 1);
            scale_y = parseMaterialScalarWithSceneUnit(props, "texture_RealWorldScaleY", sceneUnit, 1);
        }
        scale_x = (scale_x === 0) ? 1 : 1 / scale_x;
        scale_y = (scale_y === 0) ? 1 : 1 / scale_y;

        // include the additional U and V scales
        var uscale = parseMaterialGeneric(props, "scalars", "texture_UScale", 1);
        var vscale = parseMaterialGeneric(props, "scalars", "texture_VScale", 1);
        scale_x *= uscale;
        scale_y *= vscale;

        // Get the rotation angle and convert it from degrees to radians.
        var angle = parseMaterialGeneric(props, "scalars", "texture_WAngle", 1);
        angle *= Math.PI / 180.0;

        var matrix = {
            elements: [
                Math.cos(angle) * scale_x, Math.sin(angle) * scale_y, 0,
               -Math.sin(angle) * scale_x, Math.cos(angle) * scale_y, 0,
                offset_x, offset_y, 1
            ]
        };

        return matrix;
    }


    var PrismWoodTexture;
    //Init the prism wood textures. They are used in all prism 3d wood materials, so keep them
    //in the material manager.
    function InitPrism3DWoodTextures() {
        var permutation = [
            151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
            140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
            247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
             57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
             74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
             60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
             65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
            200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
             52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
            207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
            119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
            129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
            218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
             81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
            184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
            222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
        ];
        var permutationBuffer = new Uint8Array(permutation);
        var permutationTex = new THREE.DataTexture(permutationBuffer, 256, 1,
                                                THREE.LuminanceFormat,
                                                THREE.UnsignedByteType,
                                                THREE.UVMapping,
                                                THREE.RepeatWrapping, THREE.RepeatWrapping,
                                                THREE.NearestFilter, THREE.NearestFilter, 0);
        permutationTex.generateMipmaps = false;
        permutationTex.flipY = false;
        permutationTex.needsUpdate = true;
        //This is different with OGS desktop. OGS uses a float texture. I map these number to
        //unsight byte, since some platform may not support float texture. Test result shows that
        //the pixel diffrence is very small.
        var gradientData = [
            225, 39, 122, 231, 29, 173, 15, 159, 75, 88, 233, 19, 179, 79, 72, 94,
             54, 73, 151, 161, 171, 113, 221, 144, 127, 83, 168, 19, 88, 122, 62, 225,
            109, 128, 246, 247, 172, 101, 61, 139, 211, 168, 64, 210, 224, 82, 87, 97,
            119, 250, 201, 44, 242, 239, 154, 99, 126, 13, 44, 70, 246, 170, 100, 52,
            135, 28, 187, 22, 207, 119, 199, 1, 235, 187, 55, 131, 190, 124, 222, 249,
            236, 53, 225, 231, 71, 30, 173, 185, 153, 47, 79, 133, 225, 10, 140, 62,
             17, 99, 100, 29, 137, 95, 142, 244, 76, 5, 83, 124, 38, 216, 253, 195,
             44, 210, 148, 185, 188, 39, 78, 195, 132, 30, 60, 73, 92, 223, 133, 80,
            230, 56, 118, 207, 79, 15, 251, 211, 111, 21, 79, 23, 240, 146, 150, 207,
              3, 61, 103, 27, 148, 6, 31, 127, 235, 58, 173, 244, 116, 81, 34, 120,
            192, 213, 188, 226, 97, 23, 16, 161, 106, 80, 242, 148, 35, 37, 91, 117,
             51, 216, 97, 193, 126, 222, 39, 38, 133, 217, 215, 23, 237, 57, 205, 42,
            222, 165, 126, 133, 33, 8, 227, 154, 27, 18, 56, 11, 192, 120, 80, 92,
            236, 38, 210, 207, 128, 31, 135, 39, 123, 5, 49, 127, 107, 200, 34, 14,
            153, 239, 134, 19, 248, 162, 58, 201, 159, 198, 243, 158, 72, 5, 138, 184,
            222, 200, 34, 141, 233, 40, 195, 238, 191, 122, 171, 32, 66, 254, 229, 197
        ];
        var gradientBuffer = new Uint8Array(gradientData);
        var gradientTex = new THREE.DataTexture(gradientBuffer, 256, 1,
                                                THREE.LuminanceFormat,
                                                THREE.UnsignedByteType,
                                                THREE.UVMapping,
                                                THREE.RepeatWrapping, THREE.RepeatWrapping,
                                                THREE.NearestFilter, THREE.NearestFilter, 0);

        gradientTex.generateMipmaps = false;
        gradientTex.flipY = false;
        gradientTex.needsUpdate = true;

        var perm = function (x) {
            return permutation[x % 256];
        };

        var perm2D = new Array(256 * 256 * 4);
        var A, AA, AB, B, BA, BB, index, x;
        for (var y = 0; y < 256; ++y)
            for (x = 0; x < 256; ++x) {
                A = perm(x) + y;
                AA = perm(A);
                AB = perm(A + 1);
                B = perm(x + 1) + y;
                BA = perm(B);
                BB = perm(B + 1);

                // Store (AA, AB, BA, BB) in pixel (x,y)
                index = 4 * (y * 256 + x);
                perm2D[index] = AA;
                perm2D[index + 1] = AB;
                perm2D[index + 2] = BA;
                perm2D[index + 3] = BB;
            }
        var perm2DBuffer = new Uint8Array(perm2D);
        var perm2DTex = new THREE.DataTexture(perm2DBuffer, 256, 256,
                                                THREE.RGBAFormat,
                                                THREE.UnsignedByteType,
                                                THREE.UVMapping,
                                                THREE.RepeatWrapping, THREE.RepeatWrapping,
                                                THREE.NearestFilter, THREE.NearestFilter, 0);
        perm2DTex.generateMipmaps = false;
        perm2DTex.flipY = false;
        perm2DTex.needsUpdate = true;

        var gradients3D = [
            1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
            1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
            0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
            1, 1, 0, 0, -1, 1, -1, 1, 0, 0, -1, -1
        ];
        var permGrad = new Array(1024);
        for (x = 0; x < 256; ++x) {
            var i = permutation[x] % 16;
            // Convert the gradient to signed-normalized int.
            permGrad[x * 4] = gradients3D[i * 3] * 127 + 128;
            permGrad[x * 4 + 1] = gradients3D[i * 3 + 1] * 127 + 128;
            permGrad[x * 4 + 2] = gradients3D[i * 3 + 2] * 127 + 128;
            permGrad[x * 4 + 3] = 0;
        }
        var permGradBuffer = new Uint8Array(permGrad);
        var permGradTex = new THREE.DataTexture(permGradBuffer, 256, 1,
                                                THREE.RGBAFormat,
                                                THREE.UnsignedByteType,
                                                THREE.UVMapping,
                                                THREE.RepeatWrapping, THREE.RepeatWrapping,
                                                THREE.NearestFilter, THREE.NearestFilter, 0);
        permGradTex.generateMipmaps = false;
        permGradTex.flipY = false;
        permGradTex.needsUpdate = true;

        PrismWoodTexture = {
            permutation: permutationTex,
            gradient: gradientTex,
            perm2D: perm2DTex,
            permGrad: permGradTex
        };
    }

    function parseWoodMap(tm, props, name) {
        tm[name + "_enable"] = parseMaterialGeneric(props, "booleans", name + "_enable", 0);
        var prof = parseWoodProfile(props, "scalars", name + "_prof");
        tm[name + "_bands"] = prof.bands;
        tm[name + "_weights"] = prof.weights;
        tm[name + "_frequencies"] = prof.frequencies;
    }



    function convertMaterial(matObj, isPrism) {

        var innerMats = matObj["materials"];
        var innerMat = innerMats[matObj["userassets"][0]];
        var props = innerMat["properties"];

        var tm = isPrism ? createPrismMaterial() : new THREE.MeshPhongMaterial();
        var map, texProps;
        tm.proteinMat = matObj;
        tm.packedNormals = true;

        if (innerMat && isPrism) {
            tm.tag = innerMat["tag"];
            tm.prismType = innerMat["definition"];
            if (tm.prismType === undefined)
                tm.prismType = "";

            var mapList = tm.mapList;

            tm.transparent = false;
            tm.envExponentMin = 1.0;
            tm.envExponentMax = 512.0;
            tm.envExponentCount = 10.0;

            // among other things, set up mapList and note what map, if any, is attached to each property such as "surface_albedo".
            tm.surface_albedo = SRGBToLinear(parseMaterialColor(props, "surface_albedo", new THREE.Color(1, 0, 0)));
            mapList.surface_albedo_map = parseMaterialGenericConnection(props, "colors", "surface_albedo", null);

            tm.surface_anisotropy = parseMaterialGeneric(props, "scalars", "surface_anisotropy", 0);
            mapList.surface_anisotropy_map = parseMaterialGenericConnection(props, "scalars", "surface_anisotropy", null);

            tm.surface_rotation = parseMaterialGeneric(props, "scalars", "surface_rotation", 0);
            mapList.surface_rotation_map = parseMaterialGenericConnection(props, "scalars", "surface_rotation", null);

            tm.surface_roughness = parseMaterialGeneric(props, "scalars", "surface_roughness", 0);
            mapList.surface_roughness_map = parseMaterialGenericConnection(props, "scalars", "surface_roughness", null);

            mapList.surface_cutout_map = parseMaterialGenericConnection(props, "textures", "surface_cutout", null);
            mapList.surface_normal_map = parseMaterialGenericConnection(props, "textures", "surface_normal", null);

            switch (tm.prismType) {
                case 'PrismOpaque':
                    tm.opaque_albedo = SRGBToLinear(parseMaterialColor(props, "opaque_albedo", new THREE.Color(1, 0, 0)));
                    mapList.opaque_albedo_map = parseMaterialGenericConnection(props, "colors", "opaque_albedo", null);

                    tm.opaque_luminance_modifier = SRGBToLinear(parseMaterialColor(props, "opaque_luminance_modifier", new THREE.Color(0, 0, 0)));
                    mapList.opaque_luminance_modifier_map = parseMaterialGenericConnection(props, "colors", "opaque_luminance_modifier", null);

                    tm.opaque_f0 = parseMaterialGeneric(props, "scalars", "opaque_f0", 0);
                    mapList.opaque_f0_map = parseMaterialGenericConnection(props, "scalars", "opaque_f0", null);

                    tm.opaque_luminance = parseMaterialGeneric(props, "scalars", "opaque_luminance", 0);

                    break;
                case 'PrismMetal':
                    tm.metal_f0 = SRGBToLinear(parseMaterialColor(props, "metal_f0", new THREE.Color(1, 0, 0)));
                    mapList.metal_f0_map = parseMaterialGenericConnection(props, "colors", "metal_f0", null);

                    break;
                case 'PrismLayered':
                    tm.layered_bottom_f0 = SRGBToLinear(parseMaterialColor(props, "layered_bottom_f0", new THREE.Color(1, 1, 1)));
                    mapList.layered_bottom_f0_map = parseMaterialGenericConnection(props, "colors", "layered_bottom_f0", null);

                    tm.layered_diffuse = SRGBToLinear(parseMaterialColor(props, "layered_diffuse", new THREE.Color(1, 0, 0)));
                    mapList.layered_diffuse_map = parseMaterialGenericConnection(props, "colors", "layered_diffuse", null);

                    tm.layered_anisotropy = parseMaterialGeneric(props, "scalars", "layered_anisotropy", 0);
                    mapList.layered_anisotropy_map = parseMaterialGenericConnection(props, "scalars", "layered_anisotropy", null);

                    tm.layered_f0 = parseMaterialGeneric(props, "scalars", "layered_f0", 0);
                    mapList.layered_f0_map = parseMaterialGenericConnection(props, "scalars", "layered_f0", null);

                    tm.layered_fraction = parseMaterialGeneric(props, "scalars", "layered_fraction", 0);
                    mapList.layered_fraction_map = parseMaterialGenericConnection(props, "scalars", "layered_fraction", null);

                    tm.layered_rotation = parseMaterialGeneric(props, "scalars", "layered_rotation", 0);
                    mapList.layered_rotation_map = parseMaterialGenericConnection(props, "scalars", "layered_rotation", null);

                    tm.layered_roughness = parseMaterialGeneric(props, "scalars", "layered_roughness", 0);
                    mapList.layered_roughness_map = parseMaterialGenericConnection(props, "scalars", "layered_roughness", null);

                    mapList.layered_normal_map = parseMaterialGenericConnection(props, "textures", "layered_normal", null);

                    break;
                case 'PrismTransparent':
                    tm.transparent_color = SRGBToLinear(parseMaterialColor(props, "transparent_color", new THREE.Color(1, 0, 0)));

                    tm.transparent_distance = parseMaterialGeneric(props, "scalars", "transparent_distance", 0);

                    tm.transparent_ior = parseMaterialGeneric(props, "scalars", "transparent_ior", 0);

                    tm.transparent = true;

                    break;

                case 'PrismWood':
                    parseWoodMap(tm, props, "wood_fiber_cosine");

                    parseWoodMap(tm, props, "wood_fiber_perlin");
                    tm.wood_fiber_perlin_scale_z = parseMaterialGeneric(props, "scalars", "wood_fiber_perlin_scale_z", 0);

                    parseWoodMap(tm, props, "wood_growth_perlin");

                    tm.wood_latewood_ratio = parseMaterialGeneric(props, "scalars", "wood_latewood_ratio", 0);
                    tm.wood_earlywood_sharpness = parseMaterialGeneric(props, "scalars", "wood_earlywood_sharpness", 0);
                    tm.wood_latewood_sharpness = parseMaterialGeneric(props, "scalars", "wood_latewood_sharpness", 0);
                    tm.wood_ring_thickness = parseMaterialGeneric(props, "scalars", "wood_ring_thickness", 0);

                    parseWoodMap(tm, props, "wood_earlycolor_perlin");
                    tm.wood_early_color = SRGBToLinear(parseMaterialColor(props, "wood_early_color", new THREE.Color(1, 0, 0)));

                    tm.wood_use_manual_late_color = parseMaterialGeneric(props, "booleans", "wood_use_manual_late_color", 0);
                    tm.wood_manual_late_color = SRGBToLinear(parseMaterialColor(props, "wood_manual_late_color", new THREE.Color(1, 0, 0)));

                    parseWoodMap(tm, props, "wood_latecolor_perlin");
                    tm.wood_late_color_power = parseMaterialGeneric(props, "scalars", "wood_late_color_power", 0);

                    parseWoodMap(tm, props, "wood_diffuse_perlin");
                    tm.wood_diffuse_perlin_scale_z = parseMaterialGeneric(props, "scalars", "wood_diffuse_perlin_scale_z", 0);

                    tm.wood_use_pores = parseMaterialGeneric(props, "booleans", "wood_use_pores", 0);
                    tm.wood_pore_type = parseMaterialGeneric(props, "choicelists", "wood_pore_type", 0);
                    tm.wood_pore_radius = parseMaterialGeneric(props, "scalars", "wood_pore_radius", 0);
                    tm.wood_pore_cell_dim = parseMaterialGeneric(props, "scalars", "wood_pore_cell_dim", 0);
                    tm.wood_pore_color_power = parseMaterialGeneric(props, "scalars", "wood_pore_color_power", 0);
                    tm.wood_pore_depth = parseMaterialGeneric(props, "scalars", "wood_pore_depth", 0);

                    tm.wood_use_rays = parseMaterialGeneric(props, "booleans", "wood_use_rays", 0);
                    tm.wood_ray_color_power = parseMaterialGeneric(props, "scalars", "wood_ray_color_power", 0);
                    tm.wood_ray_seg_length_z = parseMaterialGeneric(props, "scalars", "wood_ray_seg_length_z", 0);
                    tm.wood_ray_num_slices = parseMaterialGeneric(props, "integers", "wood_ray_num_slices", 0);
                    tm.wood_ray_ellipse_z2x = parseMaterialGeneric(props, "scalars", "wood_ray_ellipse_z2x", 0);
                    tm.wood_ray_ellipse_radius_x = parseMaterialGeneric(props, "scalars", "wood_ray_ellipse_radius_x", 0);

                    tm.wood_use_latewood_bump = parseMaterialGeneric(props, "booleans", "wood_use_latewood_bump", 0);
                    tm.wood_latewood_bump_depth = parseMaterialGeneric(props, "scalars", "wood_latewood_bump_depth", 0);

                    tm.wood_use_groove_roughness = parseMaterialGeneric(props, "booleans", "wood_use_groove_roughness", 0);
                    tm.wood_groove_roughness = parseMaterialGeneric(props, "scalars", "wood_groove_roughness", 0);
                    tm.wood_diffuse_lobe_weight = parseMaterialGeneric(props, "scalars", "wood_diffuse_lobe_weight", 0);

                    tm.transparent = false;

                    //Create the wood noise textures. They are used for all wood materials.
                    if (!PrismWoodTexture)
                        InitPrism3DWoodTextures();

                    tm.uniforms.permutationMap.value = PrismWoodTexture['permutation'];
                    tm.uniforms.gradientMap.value = PrismWoodTexture['gradient'];
                    tm.uniforms.perm2DMap.value = PrismWoodTexture['perm2D'];
                    tm.uniforms.permGradMap.value = PrismWoodTexture['permGrad'];

                    break;

                default:
                    Logger.warn('Unknown prism type: ' + tm.prismType);
            }

            // now that the mapList is set up, populate it
            tm.defines = {};
            tm.textureMaps = {};
            for (var p in mapList) {
                // does the map exist? If not, continue on.
                if (!mapList[p])
                    continue;

                // the map exists for this property, so set the various values.
                var textureObj = innerMats[mapList[p]];
                texProps = textureObj["properties"];

                var uriType = textureObj["definition"] == "BumpMap" ?
                              "bumpmap_Bitmap" :
                              "unifiedbitmap_Bitmap";

                var uri = texProps["uris"][uriType]["values"][0];
                if (!uri)
                    continue;

                map = {
                    mapName: p,
                    uri: uri,
                    textureObj: textureObj,
                    isPrism: true
                };
                tm.textureMaps[map.mapName] = map;

                // This array gives the various #defines that are associated with this instance of
                // the PRISM material.
                tm.defines["USE_" + p.toUpperCase()] = "";
            }

            tm.defines[tm.prismType.toUpperCase()] = "";


            return tm;
        }
        else if (innerMat && !isPrism && innerMat["definition"] == "SimplePhong") {

            tm.tag = innerMat["tag"];
            tm.proteinType = innerMat["proteinType"];
            if (tm.proteinType === undefined)
                tm.proteinType = null;

            var a = tm.ambient = parseMaterialColor(props, "generic_ambient");
            var d = tm.color = parseMaterialColor(props, "generic_diffuse");
            var s = tm.specular = parseMaterialColor(props, "generic_specular");
            var e = tm.emissive = parseMaterialColor(props, "generic_emissive");

            //If the material is completely black, use a default material.
            if (d.r === 0 && d.g === 0 && d.b === 0 &&
                s.r === 0 && s.g === 0 && s.b === 0 &&
                a.r === 0 && a.g === 0 && a.b === 0 &&
                e.r === 0 && e.g === 0 && e.b === 0)
                d.r = d.g = d.b = 0.4;

            tm.shininess = parseMaterialScalar(props, "generic_glossiness", 30);
            tm.opacity = 1.0 - parseMaterialScalar(props, "generic_transparency", 0);
            tm.reflectivity = parseMaterialScalar(props, "generic_reflectivity_at_0deg", 0);

            var isNormal = parseMaterialBoolean(props, "generic_bump_is_normal");
            var scale = parseMaterialScalar(props, "generic_bump_amount", 0);

            // If cannot read the scale, set the scale to 1 which is the default value for prism and protein.
            if (scale == null)
                scale = 1;

            if (isNormal) {
                if (scale > 1)
                    scale = 1;
                tm.normalScale = new THREE.Vector2(scale, scale);
            }
            else {
                if (scale >= 1.0)
                    scale = 0.03;
                tm.bumpScale = scale;
            }

            var isMetal = parseMaterialBoolean(props, "generic_is_metal");
            if (isMetal !== undefined)
                tm.metal = isMetal;

            var backfaceCulling = parseMaterialBoolean(props, "generic_backface_cull");
            if (backfaceCulling !== undefined && !backfaceCulling)
                tm.side = THREE.DoubleSide;

            tm.transparent = innerMat["transparent"];

            tm.textureMaps = {};
            var textures = innerMat["textures"];
            for (var texType in textures) {

                map = {};

                map.textureObj = innerMats[textures[texType]["connections"][0]];
                texProps = map.textureObj["properties"];

                // Grab URI
                map.uri = texProps["uris"]["unifiedbitmap_Bitmap"]["values"][0];
                if (!map.uri)
                    continue;

                // Figure out map name

                if (texType == "generic_diffuse") {
                    map.mapName = "map";

                    if (!tm.color || (tm.color.r === 0 && tm.color.g === 0 && tm.color.b === 0))
                        tm.color.setRGB(1, 1, 1);
                }
                else if (texType == "generic_bump") {
                    if (isNormal)
                        map.mapName = "normalMap";
                    else
                        map.mapName = "bumpMap";
                }
                else if (texType == "generic_specular") {
                    map.mapName = "specularMap";
                }
                else if (texType == "generic_alpha") {
                    map.mapName = "alphaMap";
                    tm.transparent = true;
                }
                    // Environment maps from SVF turned off since we have better defaults
                    // else if (texType == "generic_reflection") {
                    //     mapName = "envMap";
                    // }
                else {
                    // no map name recognized, skip
                    continue;
                }

                tm.textureMaps[map.mapName] = map;
            }

        }
        else {
            // unknown material, use default colors
            tm.ambient = 0x030303;
            tm.color = 0x777777;
            tm.specular = 0x333333;
            tm.shininess = 30;
            tm.shading = THREE.SmoothShading;
        }

        return tm;
    }



    function convertPrismTexture(textureObj, texture, sceneUnit) {

        var texProps = textureObj["properties"];

        // Note that the format of these booleans is different for Protein than for regular materials:
        // Prism: "texture_URepeat": { "values": [ false ] },
        // simple texture: "texture_URepeat":    false,
        texture.clampS = !parseMaterialGeneric(texProps, "booleans", "texture_URepeat", false);
        texture.clampT = !parseMaterialGeneric(texProps, "booleans", "texture_VRepeat", false);
        texture.wrapS = !texture.clampS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        texture.wrapT = !texture.clampT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

        texture.matrix = Get2DMapTransform(texProps, sceneUnit);

        if (textureObj["definition"] == "UnifiedBitmap") {
            texture.invert = parseMaterialGeneric(texProps, "booleans", "unifiedbitmap_Invert", false);
        }

        if (textureObj["definition"] == "BumpMap") {
            texture.bumpmapType = parseMaterialGeneric(texProps, "choicelists", "bumpmap_Type", 0);
            texture.bumpScale = GetBumpScale(texProps, texture.bumpmapType, sceneUnit);
        }

    }

    function convertSimpleTexture(textureObj, texture) {

        if (!textureObj)
            return;

        var texProps = textureObj["properties"];

        // Note that the format of these booleans is different for Protein than for regular materials:
        // Prism: "texture_URepeat": { "values": [ false ] },
        // simple texture: "texture_URepeat":    false,
        texture.invert = parseMaterialBoolean(texProps, "unifiedbitmap_Invert");
        texture.clampS = !parseMaterialBoolean(texProps, "texture_URepeat", true);  // defaults to wrap
        texture.clampT = !parseMaterialBoolean(texProps, "texture_VRepeat", true);
        texture.wrapS = !texture.clampS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        texture.wrapT = !texture.clampT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

        var uscale = parseMaterialScalar(texProps, "texture_UScale", 1);
        var vscale = parseMaterialScalar(texProps, "texture_VScale", 1);
        var uoffset = parseMaterialScalar(texProps, "texture_UOffset", 0);
        var voffset = parseMaterialScalar(texProps, "texture_VOffset", 0);
        var wangle = parseMaterialScalar(texProps, "texture_WAngle", 0);

        texture.matrix = {
            elements: [
                Math.cos(wangle) * uscale, Math.sin(wangle) * vscale, 0,
               -Math.sin(wangle) * uscale, Math.cos(wangle) * vscale, 0,
                uoffset, voffset, 1
            ]
        };
    }

    function convertTexture(textureObj, texture, sceneUnit, isPrism) {
        if (isPrism)
            convertPrismTexture(textureObj, texture, sceneUnit);
        else
            convertSimpleTexture(textureObj, texture);
    }


    function isPrismMaterial(material) {
        var innerMats = material['materials'];
        var innerMat = innerMats[material['userassets'][0]];
        if (innerMat) {
            var definition = innerMat['definition'];
            return definition == 'PrismLayered' ||
                definition == 'PrismMetal' ||
                definition == 'PrismOpaque' ||
                definition == 'PrismTransparent' ||
                definition == 'PrismWood';
        }
        return false;
    }


    function convertMaterialGltf(matObj, svf) {

        var tm = new THREE.MeshPhongMaterial();
        tm.packedNormals = true;
        tm.textureMaps = {};

        var values = matObj.values;

        var diffuse = values.diffuse;
        if (diffuse) {
            if (Array.isArray(diffuse)) {
                tm.color = new THREE.Color(diffuse[0], diffuse[1], diffuse[2]);
            } else if (typeof diffuse === "string") {
                //texture
                tm.color = new THREE.Color(1, 1, 1);
                var map = {};
                map.mapName = "map";

                var texture = svf.gltf.textures[diffuse];

                //Use the ID of the texture, because in MaterialManager.loadTexture, the ID
                //is mapped to the path from the asset list. The logic matches what is done
                //with SVF materials.
                map.uri = texture.source;//svf.manifest.assetMap[texture.source].URI;
                map.flipY = false; //For GLTF, texture flip is OpenGL style by default, unlike Protein/Prism which is DX

                tm.textureMaps[map.mapName] = map;
            }
        }

        var specular = values.specular;
        if (specular) {
            tm.specular = new THREE.Color(specular[0], specular[1], specular[2]);
        }

        if (values.shininess)
            tm.shininess = values.shininess;

        tm.reflectivity = 0;

        return tm;

    }

    return {
        convertMaterial: convertMaterial,
        convertTexture: convertTexture,
        isPrismMaterial: isPrismMaterial,
        convertMaterialGltf: convertMaterialGltf
    };
});