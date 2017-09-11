define([
    '../Extension',
    './VRTool',
    '../../Core/Constants/EventType',
    '../../UI/Base/ToolbarSID',
    '../../UI/Base/Button',
    '../../Core/Manager/theExtensionManager',
    '../../Core/Manager/theHotkeyManager'
], function(Extension, VRTool, EventType, ToolbarSID, Button, theExtensionManager, theHotkeyManager) {
    'use strict';
    var VRExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };
    
    VRExtension.prototype = Object.create(Extension.prototype);
    VRExtension.prototype.constructor = VRExtension;
    
    VRExtension.prototype.load = function () {
        var self = this;
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(true);
    
        // Register tool
        this.tool = new VRTool(viewer, this);
        viewer.toolController.registerTool(this.tool);
    
        // Add the ui to the viewer.
        this.createUI(toolbar);
    
        // Register listeners
        this.onToolChanged = function (e) {
            if (e.toolName.indexOf('vr') === -1) {
                return;
            }
    
            var state = e.active ? Button.State.ACTIVE : Button.State.INACTIVE;
    
            self.vrToolButton.setState(state);
        };
    
        viewer.addEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);
    
        return true;
    };
    
    VRExtension.prototype.createUI = function (toolbar) {
        var self = this;
        var viewer = this.viewer;
    
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);
    
        // Create a button for the tool.
        this.vrToolButton = new Button('toolbar-vrTool');
        this.vrToolButton.setToolTip('Virtual Reality Tool');
        this.vrToolButton.setIcon("toolbar-vrToolButton");
        this.vrToolButton.onClick = function (e) {
            var state = self.vrToolButton.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool("vr");
            } else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
            }
        };
    
        var cameraSubmenuTool = navTools.getControl('toolbar-cameraSubmenuTool');
        if (cameraSubmenuTool) {
            navTools.addControl(this.vrToolButton, { index: navTools.indexOf(cameraSubmenuTool.getId()) });
        } else {
            navTools.addControl(this.vrToolButton);
        }
    };
    
    VRExtension.prototype.unload = function () {
        var viewer = this.viewer;
    
        // Remove listeners
        viewer.removeEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);
        this.onToolChanged = undefined;
    
        // Remove hotkey
        theHotkeyManager.popHotkeys(this.HOTKEYS_ID);
    
        // Remove the UI
        var toolbar = viewer.getToolbar(false);
        if (toolbar) {
            toolbar.getControl(ToolbarSID.NAVTOOLSID).removeControl(this.vrToolButton.getId());
        }
        this.vrToolButton = null;
    
        // Deregister tool
        viewer.toolController.deregisterTool(this.tool);
        this.tool = null;
    
        return true;
    };
    
    theExtensionManager.registerExtension('Autodesk.VR', VRExtension);
    
});