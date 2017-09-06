define([
    './DockingPanel',
    './OptionDropDown',
    './OptionCheckbox',
    './OptionSlider',
    '../Core/EventType',
    '../Core/Privite/BackgroundPresets',
    '../Core/DeviceType',
    '../Core/Privite/LightPresets'
], function(DockingPanel, OptionDropDown, OptionCheckbox, OptionSlider, EventType, BackgroundPresets, DeviceType, LightPresets) {
    'use strict';
    /** @constructor */
    var RenderOptionsPanel = function (viewer) {
        var self = this;
        this.viewer = viewer;
        DockingPanel.call(this, viewer.container, 'RenderOptionsPanel', 'Rendering Options');

        this.table = document.createElement("table");
        this.table.className = "adsk-lmv-tftable";

        this.tbody = document.createElement("tbody");
        this.table.appendChild(this.tbody);

        // Create the scroll container.  Adjust the height so the scroll container does not overlap
        // the resize handle.  50px accounts for the titlebar and resize handle.
        //
        this.createScrollContainer({ heightAdjustment: 70, marginTop: 20 });

        this.scrollContainer.appendChild(this.table);

        this.container.style.width = "320px";
        this.container.style.top = "260px";
        this.container.style.left = "220px"; // just needs an initial value dock overrides value
        this.container.style.height = "460px";
        this.container.dockRight = true;

        var color_list = [];
        for (var p in viewer.impl.BackgroundPresets) {
            color_list.push(p);
        }

        this.bgSelect = new OptionDropDown("Background Color", this.tbody, color_list, -1);
        this.updateBgColorIndex();

        this.addEventListener(this.bgSelect, "change", function (e) {

            var chosen = self.bgSelect.value;

            var c = viewer.BackgroundPresets[chosen];

            viewer.prefs.set("backgroundColorPreset", JSON.stringify(c));
            viewer.impl.setClearColors(c[0], c[1], c[2], c[3], c[4], c[5]);
        });

        this.celToggle = new OptionCheckbox("Cel Shaded", this.tbody, false);
        this.addEventListener(this.celToggle, "change", function (e) {
            var enable = self.celToggle.checked;
            viewer.prefs.set("celShaded", enable);
            viewer.impl.toggleCelShading(enable);
        });

        this.saoToggle = new OptionCheckbox("AO Enabled", this.tbody, true);
        this.addEventListener(this.saoToggle, "change", function (e) {
            var enable = self.saoToggle.checked;
            viewer.prefs.set("ambientShadows", enable);
            viewer.setQualityLevel(enable, viewer.impl.renderer().settings.antialias);
        });

        this.saoRadius = new OptionSlider("AO Radius", 0, 200, this.tbody);
        this.saoRadius.setValue(10);
        this.saoRadius.sliderElement.step = this.saoRadius.stepperElement.step = 0.01;
        this.addEventListener(this.saoRadius, "change", function (e) {
            viewer.impl.renderer().setAOOptions(parseFloat(self.saoRadius.value), parseFloat(self.saoIntensity.value));
            viewer.impl.renderer().composeFinalFrame(false);
        });

        this.saoIntensity = new OptionSlider("AO Intensity", 0, 3, this.tbody);
        this.saoIntensity.setValue(0.75);
        this.saoIntensity.sliderElement.step = this.saoIntensity.stepperElement.step = 0.01;
        this.addEventListener(this.saoIntensity, "change", function (e) {
            viewer.impl.renderer().setAOOptions(parseFloat(self.saoRadius.value), parseFloat(self.saoIntensity.value));
            viewer.impl.renderer().composeFinalFrame(false);
        });

        this.groundShadowAlpha = new OptionSlider("Shadow Alpha", 0, 2, this.tbody);
        this.groundShadowAlpha.setValue(1.0);
        this.groundShadowAlpha.sliderElement.step = this.groundShadowAlpha.stepperElement.step = 0.1;
        this.addEventListener(this.groundShadowAlpha, "change", function (e) {
            viewer.setGroundShadowAlpha(parseFloat(self.groundShadowAlpha.value));
        });

        this.groundShadowColor = new OptionCheckbox("Shadow Color", this.tbody);
        if (!DeviceType.isIE11)
            this.groundShadowColor.checkElement.type = "color"; // hack
        this.addEventListener(this.groundShadowColor, "change", function (e) {
            var colStr = self.groundShadowColor.checkElement.value;
            viewer.setGroundShadowColor(
                new THREE.Color(parseInt(colStr.substr(1, 7), 16))
            );
        });

        this.groundReflectionAlpha = new OptionSlider("Reflection Alpha", 0, 2, this.tbody);
        this.groundReflectionAlpha.setValue(1.0);
        this.groundReflectionAlpha.sliderElement.step = this.groundReflectionAlpha.stepperElement.step = 0.1;
        this.addEventListener(this.groundReflectionAlpha, "change", function (e) {
            viewer.setGroundReflectionAlpha(parseFloat(self.groundReflectionAlpha.value));
        });

        this.groundReflectionColor = new OptionCheckbox("Reflection Color", this.tbody);
        if (!DeviceType.isIE11)
            this.groundReflectionColor.checkElement.type = "color"; // hack
        this.addEventListener(this.groundReflectionColor, "change", function (e) {
            var colStr = self.groundReflectionColor.checkElement.value;
            viewer.setGroundReflectionColor(
                new THREE.Color(parseInt(colStr.substr(1, 7), 16))
            );
        });

        var env_list = [];
        for (var i = 0; i < LightPresets.length; i++) {
            env_list.push(LightPresets[i].name);
        }

        this.envSelect = new OptionDropDown("Environment", this.tbody, env_list, viewer.impl.currentLightPreset());

        this.addEventListener(this.envSelect, "change", function (e) {
            var chosen = self.envSelect.selectedIndex;
            viewer.setLightPreset(chosen);
        });


        var initialTonemapMethod = viewer.impl.renderer().getToneMapMethod();

        this.toneMapMethod = new OptionDropDown("Tonemap Method", this.tbody,
            ["None",
            "Canon-Lum",
            "Canon-RGB"
            ],
            initialTonemapMethod);

        this.addEventListener(this.toneMapMethod, "change", function () {
            // NOTE: Changing between Canon-Lum and Canon-RGB will yield no results
            // TODO: Add mechanism to make a change in those values effective in the material.
            // Best way to test this (for now) is to add an Environment with the desired toneMap value
            var method = self.toneMapMethod.selectedIndex;
            viewer.impl.setTonemapMethod(method);
        });

        this.exposureBias = new OptionSlider("Exposure Bias", -30.0, 30.0, this.tbody);
        this.exposureBias.setValue(viewer.impl.renderer().getExposureBias());
        this.exposureBias.sliderElement.step = this.exposureBias.stepperElement.step = 0.1;
        this.addEventListener(this.exposureBias, "change", function (e) {
            viewer.impl.setTonemapExposureBias(self.exposureBias.value, self.whiteScale.value);
        });
        this.exposureBias.setDisabled(initialTonemapMethod == 0);

        this.whiteScale = new OptionSlider("Light Intensity", -5.0, 20.0, this.tbody);
        var intensity = 0.0;
        if (viewer.impl.dir_light1) {
            if (viewer.impl.dir_light1.intensity != 0)
                intensity = Math.log(viewer.impl.dir_light1.intensity) / Math.log(2.0);
            else
                intensity = -1e-20;
        }
        this.whiteScale.setValue(intensity);
        this.whiteScale.sliderElement.step = this.whiteScale.stepperElement.step = 0.1;
        this.addEventListener(this.whiteScale, "change", function (e) {
            viewer.impl.dir_light1.intensity = Math.pow(2.0, self.whiteScale.value);
            viewer.impl.setTonemapExposureBias(self.exposureBias.value, self.whiteScale.value);
        });

        // 10-200mm lens range:
        this.fovAngle = new OptionSlider("FOV-degrees", 6.88, 100, this.tbody);
        this.fovAngle.setValue(viewer.getFOV());
        this.addEventListener(this.fovAngle, "change", function (e) {
            viewer.setFOV(parseFloat(self.fovAngle.value));
        });

        this.addEventListener(this.viewer, EventType.CAMERA_CHANGE_EVENT, function (evt) {
            var myFov = parseFloat(self.fovAngle.value);
            var camFov = viewer.getFOV();

            if (myFov != camFov)
                self.fovAngle.setValue(camFov);
        });

        this.addEventListener(this.viewer, EventType.RENDER_OPTION_CHANGED_EVENT, function (e) {
            self.syncUI();
        });

        this.addVisibilityListener(function () {
            self.resizeToContent();
        });
    };

    RenderOptionsPanel.prototype = Object.create(DockingPanel.prototype);
    RenderOptionsPanel.prototype.constructor = RenderOptionsPanel;

    /**
     * Returns the width and height to be used when resizing the panel to the content.
     *
     * @returns {{height: number, width: number}}
     */
    RenderOptionsPanel.prototype.getContentSize = function () {
        return { height: this.table.clientHeight + 75, width: this.table.clientWidth };
    };

    RenderOptionsPanel.prototype.updateBgColorIndex = function () {

        var viewer = this.viewer.impl;
        var ctop = viewer.clearColorTop;
        var cbot = viewer.clearColorBottom;
        var current_color = [(ctop.x * 255) | 0, (ctop.y * 255) | 0, (ctop.z * 255) | 0,
                            (cbot.x * 255) | 0, (cbot.y * 255) | 0, (cbot.z * 255) | 0];

        //Check if the current setting of the viewer matches any of the presets.
        var color_name;
        for (var p in BackgroundPresets) {
            var c = BackgroundPresets[p];
            var j;
            for (j = 0; j < 6; j++) {
                if (c[j] != current_color[j])
                    break;
            }
            if (j == 6) {
                color_name = p;
                break;
            }
        }

        //If it does not match, add it as extra entry in the combo box
        if (!color_name) {
            color_name = "Custom";
            var custom_color_arr = BackgroundPresets[color_name];
            for (var i = 0; i < 6; i++) {
                custom_color_arr[i] = current_color[i];
            }
        }

        this.bgSelect.setSelectedValue(color_name);
    };

    RenderOptionsPanel.prototype.syncUI = function () {
        var impl = this.viewer.impl;

        var intensity = 0.0;
        if (impl.dir_light1) {
            if (impl.dir_light1.intensity != 0)
                intensity = Math.log(impl.dir_light1.intensity) / Math.log(2.0);
            else
                intensity = -1e-20;
        }
        this.whiteScale.setValue(intensity);

        this.exposureBias.setValue(impl.renderer().getExposureBias());

        this.updateBgColorIndex();

        var method = impl.renderer().getToneMapMethod();
        this.toneMapMethod.setSelectedIndex(method);
        this.envSelect.setSelectedIndex(impl.currentLightPreset());

        this.exposureBias.setDisabled(method == 0);
        this.saoToggle.setValue(impl.renderer().settings.sao);
        this.saoRadius.setDisabled(!impl.renderer().settings.sao);
        this.saoIntensity.setDisabled(!impl.renderer().settings.sao);

        this.saoRadius.setValue(impl.renderer().getAORadius());
        this.saoIntensity.setValue(impl.renderer().getAOIntensity());

        // NOTE_NOP: no sync value because no get methods, not necessary to implement
        this.groundShadowAlpha.setDisabled(!this.viewer.prefs.get("groundShadow"));
        this.groundShadowColor.setDisabled(!this.viewer.prefs.get("groundShadow"));
        this.groundReflectionAlpha.setDisabled(!this.viewer.prefs.get("groundReflection"));
        this.groundReflectionColor.setDisabled(!this.viewer.prefs.get("groundReflection"));

        this.fovAngle.setValue(this.viewer.getFOV());

        this.celToggle.setValue(impl.renderer().settings.toonShaded);
    };

    RenderOptionsPanel.prototype.uninitialize = function () {
        DockingPanel.prototype.uninitialize.call(this);
        this.table = null;
        this.tbody = null;
        this.bgSelect = null;
        this.saoToggle = null;
        this.saoRadius = null;
        this.saoIntensity = null;
        this.groundShadowAlpha = null;
        this.envSelect = null;
        this.toneMapMethod = null;
        this.exposureBias = null;
        this.whiteScale = null;
        this.fovAngle = null;
        this.viewer = null;
    };

    return RenderOptionsPanel;
});