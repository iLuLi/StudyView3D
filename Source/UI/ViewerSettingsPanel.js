define([
    './Base/SettingsPanel',
    '../Core/Utils/touchStartToClick',
    '../Core/Constants/DeviceType',
    '../Core/i18n',
    '../Core/Mixin/ViewerPanelMixin',
    '../Core/Constants/ViewerSettingTab'
], function(SettingsPanel, touchStartToClick, DeviceType, i18n, ViewerPanelMixin, ViewerSettingTab) {
    'use strict';
    /**
     * Viewer3dSettings Tabs.
     *
     * These constants are used to define the tabs in the ViewerSettingsPanel.
     *
     * @enum {number}
     * @readonly
     */
    // var ViewerSettingTab = {
    //     Navigation: "navigationtab",
    //     Performance: "performancetab"
    // };

    /**
     * ViewerSettingsPanel
     * This is a panel for displaying the settings for the viewer.
     * @class
     *
     * @param {Viewer} viewer - the parent viewer
     * @param {string} mode - whether it is 3d or 2d mode (acceptable strings: "2d", "3d")
     * @constructor
     */
    var ViewerSettingsPanel = function (viewer, model) {

        this.viewer = viewer;
        this.is3dMode = !model.is2d();

        SettingsPanel.call(this, viewer.container, 'ViewerSettingsPanel' + viewer.id, 'Settings', { width: 360, heightAdjustment: 155 });

        this.addTab(ViewerSettingTab.Navigation, "Navigation and selection", { className: "navigation" });
        this.addTab(ViewerSettingTab.Performance, "Performance and appearance", { className: "performance" });

        this.restoreDiv = document.createElement('div');
        this.restoreDiv.className = 'viewer-restore-defaults';
        this.restoreDiv.setAttribute("data-i18n", "Restore default settings");
        this.restoreDiv.textContent = i18n.translate("Restore default settings");

        this.addEventListener(this.restoreDiv, 'touchstart', touchStartToClick);
        this.addEventListener(this.restoreDiv, 'click', function () {
            var tag = model.is2d() ? '2d' : '3d';
            viewer.prefs.reset(tag);
        }, false);

        this.container.appendChild(this.restoreDiv);

        this.createNavigationPanel();
        this.createPerformancePanel();
    };

    ViewerSettingsPanel.prototype = Object.create(SettingsPanel.prototype);
    ViewerSettingsPanel.prototype.constructor = ViewerSettingsPanel;
    ViewerPanelMixin.call(ViewerSettingsPanel.prototype);

    /**
     * Clean up when the viewer setting  is about to be removed.
     * @override
     */
    ViewerSettingsPanel.prototype.uninitialize = function () {
        this.viewer = null;
        SettingsPanel.prototype.uninitialize.call(this);
    };

    /**
     * Creates a checkbox element and adds it to the given tab.
     *
     * @param {number} tabId - tab id
     * @param {string} description - the text associated with the checkbox
     * @param {boolean} initialState - initial value for the checkbox (checked or not)
     * @param {function} onchange - callback that is called when the checkbox is changed
     * @param {string} saveKey - name of the preference associated with this checkbox.
     * @returns {HTMLElement} - it returns the checkbox element.
     *
     */
    ViewerSettingsPanel.prototype.addCheckbox = function (tabId, description, initialState, onchange, saveKey) {
        var viewer = this.viewer;

        // Use the stored settings or defaults
        var storedState = viewer.prefs[saveKey];
        initialState = (typeof storedState === 'boolean') ? storedState : initialState;

        function onChangeCB(checked) {
            viewer.prefs.set(saveKey, checked);
            onchange(checked);
        }

        var checkboxId = SettingsPanel.prototype.addCheckbox.call(this, tabId, description, initialState, onChangeCB);
        var checkBoxElem = this.getControl(checkboxId);
        checkBoxElem.saveKey = saveKey;

        viewer.prefs.addListeners(saveKey, function (value) {
            checkBoxElem.setValue(value);
        }, function (value) {
            checkBoxElem.setValue(value);
            onchange(value);
        });

        return checkboxId;
    };

    /**
     * Removes an option from the given tab.
     *
     * @param {HTMLElement} checkBoxElem - checkbox to remove.
     *
     */
    ViewerSettingsPanel.prototype.removeCheckbox = function (checkBoxElem) {
        this.viewer.prefs.removeListeners(checkBoxElem.saveKey);
        this.removeEventListener(checkBoxElem, "change", checkBoxElem.changeListener);

        return SettingsPanel.prototype.removeCheckbox.call(this, checkBoxElem);
    };

    /**
     *  Populates the navigation tab with the appropriate checkboxes.
     */
    ViewerSettingsPanel.prototype.createNavigationPanel = function () {
        var viewer = this.viewer;
        var navTab = ViewerSettingTab.Navigation;

        if (this.is3dMode) {
            this.addCheckbox(navTab, "Show ViewCube", true, function (checked) {
                viewer.displayViewCube(checked);
            }, "viewCube");

            this.addCheckbox(navTab, "ViewCube acts on pivot", false, function (checked) {
                viewer.setUsePivotAlways(checked);
            }, "alwaysUsePivot");

            this.addCheckbox(navTab, "Zoom towards pivot", false, function (checked) {
                viewer.setZoomTowardsPivot(checked);
            }, "zoomTowardsPivot");

            this.addCheckbox(navTab, "Set pivot with left mouse button", false, function (checked) {
                viewer.setClickToSetCOI(checked);
            }, "clickToSetCOI");

            this.addCheckbox(navTab, "Fusion style orbit", false, function (checked) {
                if (checked)
                    viewer.loadExtension('Autodesk.Viewing.FusionOrbit', null);
                else
                    viewer.unloadExtension('Autodesk.Viewing.FusionOrbit', null);
            }, "fusionOrbit");

            this.addCheckbox(navTab, "First person walk", false, function (checked) {
                if (checked) {
                    viewer.unloadExtension('Autodesk.Beeline', null);
                    viewer.loadExtension('Autodesk.FirstPerson', null);
                }
                else {
                    viewer.unloadExtension('Autodesk.FirstPerson', null);
                    viewer.loadExtension('Autodesk.Beeline', null);
                }
            }, "useFirstPersonNavigation");

        }

        this.addCheckbox(navTab, "Reverse mouse zoom direction", false, function (checked) {
            viewer.setReverseZoomDirection(checked);
        }, "reverseMouseZoomDir");

        if (this.is3dMode) {
            this.addCheckbox(navTab, "Orbit past world poles", true, function (checked) {
                viewer.setOrbitPastWorldPoles(checked);
            }, "orbitPastWorldPoles");
        }

        this.addCheckbox(navTab, "Open properties on select", true, function (checked) {
            viewer.setPropertiesOnSelect(checked);
        }, "openPropertiesOnSelect");

        this.addCheckbox(navTab, "Left handed mouse setup", false, function (checked) {
            viewer.setUseLeftHandedInput(checked);
        }, "leftHandedMouseSetup");
    };

    /**
     *  Populates the performance tab with the appropriate checkboxes.
     */
    ViewerSettingsPanel.prototype.createPerformancePanel = function () {
        var viewer = this.viewer;
        var perfTab = ViewerSettingTab.Performance;

        if (this.is3dMode) {
            this.ghosthiddenChkBoxId = this.addCheckbox(perfTab, "Ghost hidden objects", true, function (checked) {
                viewer.setGhosting(checked);
            }, "ghosting");

            this.optimizeNavigationhkBoxId = this.addCheckbox(perfTab, "Smooth navigation", DeviceType.isMobileDevice, function (checked) {
                viewer.setOptimizeNavigation(checked);
            }, "optimizeNavigation");

            this.antialiasingChkBoxId = this.addCheckbox(perfTab, "Anti-aliasing", true, function (checked) {
                viewer.setQualityLevel(viewer.prefs.ambientShadows, checked);
            }, "antialiasing");

            this.ambientshadowsChkBoxId = this.addCheckbox(perfTab, "Ambient shadows", true, function (checked) {
                viewer.setQualityLevel(checked, viewer.prefs.antialiasing);
            }, "ambientShadows");

            this.groundShadowChkBoxId = this.addCheckbox(perfTab, "Ground shadow", true, function (checked) {
                viewer.setGroundShadow(checked);
            }, "groundShadow");

            this.groundReflectionChkBoxId = this.addCheckbox(perfTab, "Ground reflection", true, function (checked) {
                viewer.setGroundReflection(checked);
            }, "groundReflection");

            this.envMapBackgroundChkBoxId = this.addCheckbox(perfTab, "Environment map for background", true, function (checked) {
                viewer.setEnvMapBackground(checked);
            }, "envMapBackground");
        }

        this.progressiveRenderChkBoxId = this.addCheckbox(perfTab, "Progressive model display", true, function (checked) {
            viewer.setProgressiveRendering(checked);
        }, "progressiveRendering");

        if (!this.is3dMode) {
            // 2D only
            this.swapBlackAndWhiteChkBoxId = this.addCheckbox(perfTab, "Swap black and white", true, function (checked) {
                viewer.setSwapBlackAndWhite(checked);
            }, "swapBlackAndWhite");
        }
    };

    /**
     * Updates the values in the checkboxes based on what is in the prefs.
     */
    ViewerSettingsPanel.prototype.syncUI = function () {

        var viewer = this.viewer;

        var antialiasingControl = this.getControl(this.antialiasingChkBoxId);
        if (antialiasingControl) {
            antialiasingControl.setValue(viewer.prefs.antialiasing);
        }

        var ambientshadowsgControl = this.getControl(this.ambientshadowsChkBoxId);
        if (ambientshadowsgControl) {
            ambientshadowsgControl.setValue(viewer.prefs.ambientShadows);
        }

        var groundShadowControl = this.getControl(this.groundShadowChkBoxId);
        if (groundShadowControl) {
            groundShadowControl.setValue(viewer.prefs.groundShadow);
        }

        var groundReflectionControl = this.getControl(this.groundReflectionChkBoxId);
        if (groundReflectionControl) {
            groundReflectionControl.setValue(viewer.prefs.groundReflection);
        }

        var envMapBackgroundControl = this.getControl(this.envMapBackgroundChkBoxId);
        if (envMapBackgroundControl) {
            envMapBackgroundControl.setValue(viewer.impl.isEnvMapBackground());
        }

        var progressiveRenderControl = this.getControl(this.progressiveRenderChkBoxId);
        if (progressiveRenderControl) {
            progressiveRenderControl.setValue(viewer.prefs.progressiveRendering);
        }

        var swapBlackAndWhiteControl = this.getControl(this.swapBlackAndWhiteChkBoxId);
        if (swapBlackAndWhiteControl) {
            swapBlackAndWhiteControl.setValue(viewer.prefs.swapBlackAndWhite);
        }

        var ghosthiddenControl = this.getControl(this.ghosthiddenChkBoxId);
        if (ghosthiddenControl) {
            ghosthiddenControl.setValue(viewer.prefs.ghosting);
        }

    };

    return ViewerSettingsPanel;
});