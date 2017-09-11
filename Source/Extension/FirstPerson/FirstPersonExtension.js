define([
    '../Extension',
    './FirstPersonTool',
    '../../Core/Constants/EventType',
    '../../UI/Base/ToolbarSID',
    '../../UI/Base/Button',
    '../../Core/Manager/theExtensionManager',
    '../../Core/Constants/KeyCode'
], function(Extension, FirstPersonTool, EventType, ToolbarSID, Button, theExtensionManager, KeyCode) {
    'use strict';
    /**
     * @class
     * Activates a First Person navigation tool, similar to those found in videogames.<br>
     * It will also replace the default walk tool button when GuiViewer3D is present.
     *
     * @extends {Extension}
     * @param {Autodesk.Viewing.Viewer3D} viewer
     * @param {Object} [options] - not used
     * @constructor
     */
    var FirstPersonExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };

    FirstPersonExtension.prototype = Object.create(Extension.prototype);
    FirstPersonExtension.prototype.constructor = FirstPersonExtension;

    FirstPersonExtension.prototype.load = function () {
        var self = this;
        var viewer = this.viewer;

        // Register tool
        this.tool = new FirstPersonTool(viewer);
        viewer.toolController.registerTool(this.tool);

        // Add the ui to the viewer.
        this.createUI();

        // Register listeners
        this.onToolChanged = function (e) {
            if (e.toolName.indexOf('firstperson') === -1) {
                return;
            }
            if (self.firstPersonToolButton) {
                var state = e.active ? Button.State.ACTIVE : Button.State.INACTIVE;
                self.firstPersonToolButton.setState(state);
            }
        };

        viewer.addEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);

        return true;
    };

    FirstPersonExtension.prototype.createUI = function () {
        var viewer = this.viewer;
        if (!viewer.getToolbar) return; // Adds support for Viewer3D instance

        var self = this;
        var toolbar = viewer.getToolbar(true);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        // Create a button for the tool.
        this.firstPersonToolButton = new Button('toolbar-firstPersonTool');
        this.firstPersonToolButton.setToolTip('First person');
        this.firstPersonToolButton.onClick = function (e) {
            var state = self.firstPersonToolButton.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool("firstperson");
            } else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
            }
        };
        this.firstPersonToolButton.setIcon("adsk-icon-first-person");

        var cameraSubmenuTool = navTools.getControl('toolbar-cameraSubmenuTool');
        if (cameraSubmenuTool) {
            navTools.addControl(this.firstPersonToolButton, { index: navTools.indexOf(cameraSubmenuTool.getId()) });
        } else {
            navTools.addControl(this.firstPersonToolButton);
        }
    };

    FirstPersonExtension.prototype.unload = function () {
        var viewer = this.viewer;

        // Remove listeners
        viewer.removeEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);
        this.onToolChanged = undefined;

        // Remove hotkey
        theHotkeyManager.popHotkeys(this.HOTKEYS_ID);

        // Remove the UI
        if (this.firstPersonToolButton) {
            var toolbar = viewer.getToolbar(false);
            if (toolbar) {
                toolbar.getControl(ToolbarSID.NAVTOOLSID).removeControl(this.firstPersonToolButton.getId());
            }
            this.firstPersonToolButton = null;
        }

        //Uh, why does the viewer need to keep track of this in addition to the tool stack?
        if (viewer.getActiveNavigationTool() == this.tool.getName())
            viewer.setActiveNavigationTool();

        // Deregister tool
        viewer.toolController.deregisterTool(this.tool);
        this.tool = null;

        return true;
    };

    theExtensionManager.registerExtension('Autodesk.FirstPerson', FirstPersonExtension);

});