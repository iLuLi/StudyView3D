define([
    './SectionTool',
    '../Extension',
    '../../Core/Constants/EventType',
    '../../Core/Manager/theHotkeyManager',
    '../../Core/Manager/theExtensionManager',
    '../../UI/Base/ComboButton',
    '../../UI/Base/Button',
    '../../UI/Base/ToolbarSID',
    '../../Core/Constants/DeviceType'
], function (SectionTool, Extension, EventType, theHotkeyManager, theExtensionManager, ComboButton, Button, ToolbarSID, DeviceType) {
    'use strict';
    /**
 * SectionExtension adds UI elements for section analysis
 */
    var SectionExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
        this.viewer = viewer;

    };

    SectionExtension.prototype = Object.create(Extension.prototype);
    SectionExtension.prototype.constructor = SectionExtension;


    /**
     * Registers the SectionTool, hotkeys and event handlers.
     *
     * @returns {boolean}
     */
    SectionExtension.prototype.load = function () {
        var that = this;
        var viewer = this.viewer;

        this.tool = new SectionTool(viewer);
        viewer.toolController.registerTool(this.tool);
        this.sectionStyle = null;
        this.supportedStyles = ["X", "Y", "Z", "BOX"];

        if (viewer.getToolbar) {
            var toolbar = viewer.getToolbar(true);
            if (toolbar) {
                this.onToolbarCreated();
            } else {
                this.onToolbarCreatedBinded = this.onToolbarCreated.bind(this);
                viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
            }
        }

        this.onResetBinded = this.onReset.bind(this);
        viewer.addEventListener(EventType.RESET_EVENT, this.onResetBinded);

        this.HOTKEYS_ID = "Autodesk.Section.Hotkeys";
        var hotkeys = [{
            keycodes: [
                theHotkeyManager.KEYCODES.ESCAPE
            ],
            onRelease: function () {
                return that.enableSectionTool(false);
            }
        }];
        theHotkeyManager.pushHotkeys(this.HOTKEYS_ID, hotkeys);

        return true;
    };

    /**
     * Unregisters the SectionTool, hotkeys and event handlers.
     *
     * @returns {boolean}
     */
    SectionExtension.prototype.unload = function () {
        var viewer = this.viewer;

        // remove hotkey
        theHotkeyManager.popHotkeys(this.HOTKEYS_ID);

        this.destroyUI();

        viewer.removeEventListener(EventType.RESET_EVENT, this.onResetBinded);
        this.onResetBinded = null;

        if (this.onToolbarCreatedBinded) {
            viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
            this.onToolbarCreatedBinded = null;
        }

        viewer.toolController.deregisterTool(this.tool);
        this.tool = null;

        return true;
    };

    /**
     * Whether the section planes are active or not.
     *
     * @returns {boolean}
     */
    SectionExtension.prototype.isActive = function () {
        return this.tool.isActive();
    };

    /**
     * Toggles activeness of section planes.
     *
     * @returns {boolean} Whether the section plane is active or not.
     */
    SectionExtension.prototype.toggle = function () {
        if (this.isActive()) {
            this.enableSectionTool(false);
        } else {
            var style = this.sectionStyle || "X";
            this.setSectionStyle(style, true);
        }
        return this.isActive(); // Need to check for isActive() again.
    };

    /**
     * Returns the current type of plane that will cut-though the geometry.
     *
     * @returns {null|String} Either "X" or "Y" or "Z" or "BOX" or null.
     */
    SectionExtension.prototype.getSectionStyle = function () {
        return this.sectionStyle;
    };

    /**
     * Sets the Section plane style.
     *
     * @param {String} style - Accepted values are 'X', 'Y', 'Z' and 'BOX' (in Caps)
     * @param {Boolean} [preserveSection] - Whether sending the current style value resets the cut planes.
     */
    SectionExtension.prototype.setSectionStyle = function (style, preserveSection) {

        if (this.supportedStyles.indexOf(style) === -1) {
            return false;
        }

        var bActive = this.isActive();
        var bNewStyle = (this.sectionStyle !== style) || !preserveSection;
        this.sectionStyle = style;

        if (bActive && bNewStyle) {
            this.tool.setSection(style);
        }
        else if (!bActive) {
            this.enableSectionTool(true);
            if (bNewStyle) {
                this.tool.setSection(style);
            } else {
                this.tool.attachControl(true);
            }
        }
        return true;
    };


    /**
     *
     * @param enable
     * @returns {boolean}
     * @private
     */
    SectionExtension.prototype.enableSectionTool = function (enable) {
        var toolController = this.viewer.toolController,
            isActive = this.tool.isActive();

        if (enable && !isActive) {
            toolController.activateTool("section");
            if (this.sectionToolButton) {
                this.sectionToolButton.setState(Button.State.ACTIVE);
            }
            return true;

        } else if (!enable && isActive) {
            toolController.deactivateTool("section");
            if (this.sectionToolButton) {
                this.sectionToolButton.setState(Button.State.INACTIVE);
            }
            return true;
        }
        return false;
    };

    /**
     * @private
     */
    SectionExtension.prototype.onToolbarCreated = function () {
        if (this.onToolbarCreatedBinded) {
            this.viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
            this.onToolbarCreatedBinded = null;
        }
        this.createUI();
    };

    /**
     * @private
     */
    SectionExtension.prototype.onReset = function () {
        this.tool.resetSection();
    };

    /***
     * @private
     */
    SectionExtension.prototype.createUI = function () {
        var viewer = this.viewer;

        this.sectionToolButton = new ComboButton("toolbar-sectionTool");
        this.sectionToolButton.setToolTip('Section analysis');
        this.sectionToolButton.setIcon("adsk-icon-section-analysis");
        this.createSubmenu(this.sectionToolButton);

        // make sure inspect tools is visible
        var toolbar = viewer.getToolbar(false);
        var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);

        // place section tool before reset tool
        var resetTool = modelTools.getControl("toolbar-resetTool");
        if (resetTool) {
            modelTools.addControl(this.sectionToolButton, { index: modelTools.indexOf(resetTool.getId()) });
        } else {
            modelTools.addControl(this.sectionToolButton, { index: 0 });
        }
    };

    /**
     *
     * @param parentButton
     * @private
     */
    SectionExtension.prototype.createSubmenu = function (parentButton) {
        var that = this;
        var viewer = this.viewer;

        function createNavToggler(button, name) {
            return function () {
                var state = button.getState();
                var enable = function () {
                    that.enableSectionTool(true);
                    if (button instanceof ComboButton === false) {
                        that.tool.setSection(name);
                    } else {
                        that.tool.attachControl(true);
                    }
                };

                if (state === Button.State.INACTIVE) {
                    button.setState(Button.State.ACTIVE);
                    // Long initialization may cause issues on touch enabled devices, make it async
                    if (DeviceType.isMobileDevice) {
                        setTimeout(enable, 1);
                    } else {
                        enable();
                    }
                } else if (state === Button.State.ACTIVE) {
                    button.setState(Button.State.INACTIVE);
                    that.enableSectionTool(false);
                }
                that.sectionStyle = name;
            };
        }

        function updateSectionButtons() {
            var areVectorsEqual = (function () {
                var v = new THREE.Vector3();
                return function (a, b, sqtol) {
                    v.subVectors(a, b);
                    return v.lengthSq() < sqtol;
                };
            })();

            var unitx = new THREE.Vector3(1, 0, 0);
            var unity = new THREE.Vector3(0, 1, 0);
            var unitz = new THREE.Vector3(0, 0, 1);
            var right = viewer.autocam.getWorldRightVector();
            var up = viewer.autocam.getWorldUpVector();
            var front = viewer.autocam.getWorldFrontVector();

            var tol = 0.0001;
            if (areVectorsEqual(up, unitx, tol)) {
                that.sectionYButton.setIcon("adsk-icon-plane-x");
            } else if (areVectorsEqual(up, unitz, tol)) {
                that.sectionYButton.setIcon("adsk-icon-plane-z");
            } else {
                that.sectionYButton.setIcon("adsk-icon-plane-y");
            }

            if (areVectorsEqual(right, unity, tol)) {
                that.sectionXButton.setIcon("adsk-icon-plane-y");
            } else if (areVectorsEqual(right, unitz, tol)) {
                that.sectionXButton.setIcon("adsk-icon-plane-z");
            } else {
                that.sectionXButton.setIcon("adsk-icon-plane-x");
            }

            if (areVectorsEqual(front, unitx, tol)) {
                that.sectionZButton.setIcon("adsk-icon-plane-x");
            } else if (areVectorsEqual(front, unity, tol)) {
                that.sectionZButton.setIcon("adsk-icon-plane-y");
            } else {
                that.sectionZButton.setIcon("adsk-icon-plane-z");
            }

            viewer.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, updateSectionButtons);
        }

        var sectionXButton = this.sectionXButton = new Button("toolbar-sectionTool-x");
        sectionXButton.setToolTip('Add X plane');
        sectionXButton.setIcon("adsk-icon-plane-x");
        sectionXButton.onClick = createNavToggler(sectionXButton, 'X');
        parentButton.addControl(sectionXButton);

        var sectionYButton = this.sectionYButton = new Button("toolbar-sectionTool-y");
        sectionYButton.setToolTip('Add Y plane');
        sectionYButton.setIcon("adsk-icon-plane-y");
        sectionYButton.onClick = createNavToggler(sectionYButton, 'Y');
        parentButton.addControl(sectionYButton);

        var sectionZButton = this.sectionZButton = new Button("toolbar-sectionTool-z");
        sectionZButton.setToolTip('Add Z plane');
        sectionZButton.setIcon("adsk-icon-plane-z");
        sectionZButton.onClick = createNavToggler(sectionZButton, 'Z');
        parentButton.addControl(sectionZButton);

        var sectionBoxButton = this.sectionBoxButton = new Button("toolbar-sectionTool-box");
        sectionBoxButton.setToolTip('Add box');
        sectionBoxButton.setIcon("adsk-icon-box");
        sectionBoxButton.onClick = createNavToggler(sectionBoxButton, 'BOX');
        parentButton.addControl(sectionBoxButton);

        viewer.addEventListener(EventType.GEOMETRY_LOADED_EVENT, updateSectionButtons);
    };

    /**
     * @private
     */
    SectionExtension.prototype.destroyUI = function () {
        var viewer = this.viewer;

        var toolbar = viewer.getToolbar(false);
        if (toolbar) {
            var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);
            if (modelTools && this.sectionToolButton) {
                var inspectSubmenu = modelTools.getControl("toolbar-inspectSubMenu");
                if (inspectSubmenu) {
                    inspectSubmenu.removeControl(this.sectionToolButton.getId());
                } else {
                    modelTools.removeControl(this.sectionToolButton.getId());
                }
                this.sectionToolButton = null;
            }
        }
    };

    theExtensionManager.registerExtension('Autodesk.Section', SectionExtension);

});