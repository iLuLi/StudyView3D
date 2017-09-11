define([
    '../Extension',
    './BeelineTool',
    '../../UI/Base/Button',
    '../../Core/Constants/EventType',
    '../../Core/Manager/theHotkeyManager',
    '../../UI/Base/ToolbarSID',
    '../../Core/Manager/theExtensionManager'
], function(Extension, BeelineTool, Button, EventType, theHotkeyManager, ToolbarSID, theExtensionManager) {
    'use strict';
    var BeelineExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };
    
    BeelineExtension.prototype = Object.create(Extension.prototype);
    BeelineExtension.prototype.constructor = BeelineExtension;
    
    BeelineExtension.prototype.load = function () {
        var self = this;
        var viewer = this.viewer;
    
        // Register tool
        this.tool = new BeelineTool(viewer.impl, viewer);
        viewer.toolController.registerTool(this.tool);
    
        // Add UI
        // Add beeline button
        this.createUI();
    
        // Add hotkey
        var previousTool;
        function onPress() {
            previousTool = viewer.getActiveNavigationTool();
            viewer.setActiveNavigationTool(self.tool.getName());
            return true;
        }
        function onRelease() {
            viewer.setActiveNavigationTool(previousTool ? previousTool : viewer.defaultNavigationToolName);
            return true;
        }
        this.HOTKEYS_ID = "Autodesk.Beeline.Hotkeys";
        var hotkeys = [
            {
                keycodes: [
                    theHotkeyManager.KEYCODES.CONTROL,
                    theHotkeyManager.KEYCODES.ALT
                ],
                onPress: onPress,
                onRelease: onRelease
            }
        ];
        theHotkeyManager.pushHotkeys(this.HOTKEYS_ID, hotkeys);
    
        // Register listeners
        this.onToolChanged = function (e) {
            if (e.toolName.indexOf('beeline') === -1) {
                return;
            }
    
            if (self.beelineButton) {
                var state = e.active ? Button.State.ACTIVE : Button.State.INACTIVE;
                self.beelineButton.setState(state);
            }
        };
    
        viewer.addEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);
    
        return true;
    };
    
    BeelineExtension.prototype.createUI = function () {
        var viewer = this.viewer;
        if (!viewer.getToolbar || !viewer.getSettingsPanel) return; // Add support for Viewer3D instance
    
        var toolbar = viewer.getToolbar(true);
    
        var navTools = toolbar.getControl(EventType.TOOLBAR.NAVTOOLSID);
    
        var beelineButtonId = "toolbar-beelineTool";
    
        /*var options = {
            defaultTooltipValue: "Walk to (double-click to Walk through)"
        };*/
        var beelineButton = new Button(beelineButtonId);
        beelineButton.setToolTip('Walk to');
        beelineButton.setIcon("adsk-icon-walk");
        beelineButton.onClick = function (e) {
            var state = beelineButton.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool("beeline");
            } else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
            }
        };
        this.beelineButton = beelineButton;
    
        var cameraSubmenuTool = navTools.getControl('toolbar-cameraSubmenuTool');
        if (cameraSubmenuTool) {
            navTools.addControl(this.beelineButton, { index: navTools.indexOf(cameraSubmenuTool.getId()) });
        } else {
            navTools.addControl(this.beelineButton);
        }
    
        // Add beeline settings to the viewer's setting panel.
        var that = this;
        var addViewerUIOptions = function () {
            viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, addViewerUIOptions);
    
            var navTab = Extensions.ViewerSettingTab.Navigation;
            var viewerOptions = viewer.getSettingsPanel(true);
            that.viewerOption_LookHorId = viewerOptions.addCheckbox(navTab, "Reverse horizontal look direction", false, function (checked) {
                viewer.setReverseHorizontalLookDirection(checked);
            }, "reverseHorizontalLookDirection");
    
            that.viewerOption_LookVertId = viewerOptions.addCheckbox(navTab, "Reverse vertical look direction", false, function (checked) {
                viewer.setReverseVerticalLookDirection(checked);
            }, "reverseVerticalLookDirection");
    
        };
    
        if (this.viewer.getSettingsPanel(false)) {
            addViewerUIOptions();
        } else {
            this.viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, addViewerUIOptions);
        }
    };
    
    BeelineExtension.prototype.unload = function () {
        var viewer = this.viewer;
    
        // Remove listeners
        viewer.removeEventListener(EventType.TOOL_CHANGE_EVENT, this.onToolChanged);
        this.onToolChanged = undefined;
    
        // Remove hotkey
        theHotkeyManager.popHotkeys(this.HOTKEYS_ID);
    
        // Remove the UI
        if (this.beelineButton) {
            // Button is created only if toolbar API is available
            var toolbar = viewer.getToolbar(false);
            if (toolbar) {
                toolbar.getControl(ToolbarSID.NAVTOOLSID).removeControl(this.beelineButton.getId());
            }
            this.beelineButton = null;
        }
    
        // Remove the options from the Viewer SettingsPanel.
        if (viewer.getSettingsPanel) {
            viewer.getSettingsPanel(false).removeCheckbox(this.viewerOption_LookHorId);
            viewer.getSettingsPanel(false).removeCheckbox(this.viewerOption_LookVertId);
        }
    
        //Uh, why does the viewer need to keep track of this in addition to the tool stack?
        if (viewer.getActiveNavigationTool() == this.tool.getName())
            viewer.setActiveNavigationTool();
    
        // Deregister tool
        viewer.toolController.deregisterTool(this.tool);
        this.tool = null;
    
        return true;
    };
    
    theExtensionManager.registerExtension('Autodesk.Beeline', BeelineExtension);
    
});