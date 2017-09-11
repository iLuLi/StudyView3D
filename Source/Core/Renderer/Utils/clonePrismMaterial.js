define([
    './createPrismMaterial',
    '../../Logger'
], function(createPrismMaterial, Logger) {
    'use strict';

    var clonePrismMaterial = function (mat) {

        var prismMat = createPrismMaterial();

        // this is a dumb way to do what THREE.Material.prototype.clone.call( this, prismMat );
        // would do to create a clone and copy the basic properties. What's the non-stupid way?
        // And why does this material not have its own prototype.clone method?

        prismMat.name = mat.name;

        prismMat.side = mat.side;

        prismMat.opacity = mat.opacity;
        prismMat.transparent = mat.transparent;

        prismMat.blending = mat.blending;

        prismMat.blendSrc = mat.blendSrc;
        prismMat.blendDst = mat.blendDst;
        prismMat.blendEquation = mat.blendEquation;
        prismMat.blendSrcAlpha = mat.blendSrcAlpha;
        prismMat.blendDstAlpha = mat.blendDstAlpha;
        prismMat.blendEquationAlpha = mat.blendEquationAlpha;

        prismMat.depthTest = mat.depthTest;
        prismMat.depthWrite = mat.depthWrite;

        prismMat.polygonOffset = mat.polygonOffset;
        prismMat.polygonOffsetFactor = mat.polygonOffsetFactor;
        prismMat.polygonOffsetUnits = mat.polygonOffsetUnits;

        prismMat.alphaTest = mat.alphaTest;

        prismMat.overdraw = mat.overdraw;

        prismMat.visible = mat.visible;

        // end of the basics shared by all shaders


        prismMat.mapList = mat.mapList;

        prismMat.prismType = mat.prismType;

        //Prism common properties.
        prismMat.surface_albedo = mat.surface_albedo;
        if (mat.surface_albedo_map !== undefined)
            prismMat.surface_albedo_map = mat.surface_albedo_map;
        prismMat.surface_roughness = mat.surface_roughness;
        if (mat.surface_roughness_map !== undefined)
            prismMat.surface_roughness_map = mat.surface_roughness_map;
        prismMat.surface_anisotropy = mat.surface_anisotropy;
        if (mat.surface_anisotropy_map !== undefined)
            prismMat.surface_anisotropy_map = mat.surface_anisotropy_map;
        prismMat.surface_rotation = mat.surface_rotation;
        if (mat.surface_rotation_map !== undefined)
            prismMat.surface_rotation_map = mat.surface_rotation_map;
        if (mat.surface_cutout_map !== undefined)
            prismMat.surface_cutout_map = mat.surface_cutout_map;
        if (mat.surface_normal_map !== undefined)
            prismMat.surface_normal_map = mat.surface_normal_map;

        //Set Prism properties according to the material type.
        switch (prismMat.prismType) {
            case 'PrismOpaque':
                prismMat.opaque_albedo = new THREE.Color().copy(mat.opaque_albedo);
                prismMat.opaque_luminance_modifier = new THREE.Color().copy(mat.opaque_luminance_modifier);
                prismMat.opaque_f0 = mat.opaque_f0;
                prismMat.opaque_luminance = mat.opaque_luminance;

                if (mat.opaque_albedo_map !== undefined)
                    prismMat.opaque_albedo_map = mat.opaque_albedo_map;
                if (mat.opaque_luminance_modifier_map !== undefined)
                    prismMat.opaque_luminance_modifier_map = mat.opaque_luminance_modifier_map;
                if (mat.opaque_f0_map !== undefined)
                    prismMat.opaque_f0_map = mat.opaque_f0_map;

                break;

            case 'PrismMetal':
                prismMat.metal_f0 = new THREE.Color().copy(mat.metal_f0);
                if (mat.metal_f0_map !== undefined)
                    prismMat.metal_f0_map = mat.metal_f0_map;

                break;

            case 'PrismLayered':
                prismMat.layered_f0 = mat.layered_f0;
                prismMat.layered_diffuse = new THREE.Color().copy(mat.layered_diffuse);
                prismMat.layered_fraction = mat.layered_fraction;
                prismMat.layered_bottom_f0 = new THREE.Color().copy(mat.layered_bottom_f0);
                prismMat.layered_roughness = mat.layered_roughness;
                prismMat.layered_anisotropy = mat.layered_anisotropy;
                prismMat.layered_rotation = mat.layered_rotation;

                if (mat.layered_bottom_f0_map !== undefined)
                    prismMat.layered_bottom_f0_map = mat.layered_bottom_f0_map;
                if (mat.layered_f0_map !== undefined)
                    prismMat.layered_f0_map = mat.layered_f0_map;
                if (mat.layered_diffuse_map !== undefined)
                    prismMat.layered_diffuse_map = mat.layered_diffuse_map;
                if (mat.layered_fraction_map !== undefined)
                    prismMat.layered_fraction_map = mat.layered_fraction_map;
                if (mat.layered_rotationlayered_roughness_map !== undefined)
                    prismMat.layered_rotationlayered_roughness_map = mat.layered_rotationlayered_roughness_map;
                if (mat.layered_anisotropy_map !== undefined)
                    prismMat.layered_anisotropy_map = mat.layered_anisotropy_map;
                if (mat.layered_rotation_map !== undefined)
                    prismMat.layered_rotation_map = mat.layered_rotation_map;
                if (mat.layered_normal_map !== undefined)
                    prismMat.layered_normal_map = mat.layered_normal_map;

                break;

            case 'PrismTransparent':
                prismMat.transparent_color = new THREE.Color().copy(mat.transparent_color);
                prismMat.transparent_distance = mat.transparent_distance;
                prismMat.transparent_ior = mat.transparent_ior;

                break;

            case 'PrismWood':
                prismMat.wood_fiber_cosine_enable = mat.wood_fiber_cosine_enable;
                prismMat.wood_fiber_cosine_bands = mat.wood_fiber_cosine_bands;
                prismMat.wood_fiber_cosine_weights = new THREE.Vector4().copy(mat.wood_fiber_cosine_weights);
                prismMat.wood_fiber_cosine_frequencies = new THREE.Vector4().copy(mat.wood_fiber_cosine_frequencies);

                prismMat.wood_fiber_perlin_enable = mat.wood_fiber_perlin_enable;
                prismMat.wood_fiber_perlin_bands = mat.wood_fiber_perlin_bands;
                prismMat.wood_fiber_perlin_weights = new THREE.Vector4().copy(mat.wood_fiber_perlin_weights);
                prismMat.wood_fiber_perlin_frequencies = new THREE.Vector4().copy(mat.wood_fiber_perlin_frequencies);
                prismMat.wood_fiber_perlin_scale_z = mat.wood_fiber_perlin_scale_z;

                prismMat.wood_growth_perlin_enable = mat.wood_growth_perlin_enable;
                prismMat.wood_growth_perlin_bands = mat.wood_growth_perlin_bands;
                prismMat.wood_growth_perlin_weights = new THREE.Vector4().copy(mat.wood_growth_perlin_weights);
                prismMat.wood_growth_perlin_frequencies = new THREE.Vector4().copy(mat.wood_growth_perlin_frequencies);

                prismMat.wood_latewood_ratio = mat.wood_latewood_ratio;
                prismMat.wood_earlywood_sharpness = mat.wood_earlywood_sharpness;
                prismMat.wood_latewood_sharpness = mat.wood_latewood_sharpness;
                prismMat.wood_ring_thickness = mat.wood_ring_thickness;

                prismMat.wood_earlycolor_perlin_enable = mat.wood_earlycolor_perlin_enable;
                prismMat.wood_earlycolor_perlin_bands = mat.wood_earlycolor_perlin_bands;
                prismMat.wood_earlycolor_perlin_weights = new THREE.Vector4().copy(mat.wood_earlycolor_perlin_weights);
                prismMat.wood_earlycolor_perlin_frequencies = new THREE.Vector4().copy(mat.wood_earlycolor_perlin_frequencies);
                prismMat.wood_early_color = new THREE.Color().copy(mat.wood_early_color);

                prismMat.wood_use_manual_late_color = mat.wood_use_manual_late_color;
                prismMat.wood_manual_late_color = new THREE.Color().copy(mat.wood_manual_late_color);

                prismMat.wood_latecolor_perlin_enable = mat.wood_latecolor_perlin_enable;
                prismMat.wood_latecolor_perlin_bands = mat.wood_latecolor_perlin_bands;
                prismMat.wood_latecolor_perlin_weights = new THREE.Vector4().copy(mat.wood_latecolor_perlin_weights);
                prismMat.wood_latecolor_perlin_frequencies = new THREE.Vector4().copy(mat.wood_latecolor_perlin_frequencies);
                prismMat.wood_late_color_power = mat.wood_late_color_power;

                prismMat.wood_diffuse_perlin_enable = mat.wood_diffuse_perlin_enable;
                prismMat.wood_diffuse_perlin_bands = mat.wood_diffuse_perlin_bands;
                prismMat.wood_diffuse_perlin_weights = new THREE.Vector4().copy(mat.wood_diffuse_perlin_weights);
                prismMat.wood_diffuse_perlin_frequencies = new THREE.Vector4().copy(mat.wood_diffuse_perlin_frequencies);
                prismMat.wood_diffuse_perlin_scale_z = mat.wood_diffuse_perlin_scale_z;

                prismMat.wood_use_pores = mat.wood_use_pores;
                prismMat.wood_pore_type = mat.wood_pore_type;
                prismMat.wood_pore_radius = mat.wood_pore_radius;
                prismMat.wood_pore_cell_dim = mat.wood_pore_cell_dim;
                prismMat.wood_pore_color_power = mat.wood_pore_color_power;
                prismMat.wood_pore_depth = mat.wood_pore_depth;

                prismMat.wood_use_rays = mat.wood_use_rays;
                prismMat.wood_ray_color_power = mat.wood_ray_color_power;
                prismMat.wood_ray_seg_length_z = mat.wood_ray_seg_length_z;
                prismMat.wood_ray_num_slices = mat.wood_ray_num_slices;
                prismMat.wood_ray_ellipse_z2x = mat.wood_ray_ellipse_z2x;
                prismMat.wood_ray_ellipse_radius_x = mat.wood_ray_ellipse_radius_x;

                prismMat.wood_use_latewood_bump = mat.wood_use_latewood_bump;
                prismMat.wood_latewood_bump_depth = mat.wood_latewood_bump_depth;

                prismMat.wood_use_groove_roughness = mat.wood_use_groove_roughness;
                prismMat.wood_groove_roughness = mat.wood_groove_roughness;
                prismMat.wood_diffuse_lobe_weight = mat.wood_diffuse_lobe_weight;

                if (mat.permutationMap !== undefined)
                    prismMat.permutationMap = mat.permutationMap;
                if (mat.gradientMap !== undefined)
                    prismMat.gradientMap = mat.gradientMap;
                if (mat.perm2DMap !== undefined)
                    prismMat.perm2DMap = mat.perm2DMap;
                if (mat.permGradMap !== undefined)
                    prismMat.permGradMap = mat.permGradMap;

                break;

            default:
                Logger.warn('Unknown prism type: ' + mat.prismType);
        }

        prismMat.envExponentMin = mat.envExponentMin;
        prismMat.envExponentMax = mat.envExponentMax;
        prismMat.envExponentCount = mat.envExponentCount;
        prismMat.envMap = mat.envMap;

        prismMat.defines = mat.defines;
        return prismMat;
    };

    return clonePrismMaterial;
});