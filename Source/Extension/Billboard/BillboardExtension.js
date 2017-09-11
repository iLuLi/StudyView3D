define([
    '../../Core/Manager/theExtensionManager',
    '../../UI/Base/ToolbarSID',
    '../Extension',
    '../../Core/Constants/EventType',
    './BillboardTool',
    '../../UI/Base/Button'
], function(theExtensionManager, ToolbarSID, Extension, EventType, BillboardTool, Button) {
    'use strict';
    var BillboardExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };

    BillboardExtension.prototype = Object.create(Extension.prototype);
    BillboardExtension.prototype.constructor = BillboardExtension;

    BillboardExtension.prototype.load = function () {
        this.tool = new BillboardTool(this.viewer);
        this.viewer.toolController.registerTool(this.tool);

        if (this.viewer.toolbar) {
            this.createToolbarUI();
        }
        else {
            this.onToolbarCreatedBinded = this.onToolbarCreated.bind(this);
            this.viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
        }

        this.viewer.addEventListener(EventType.CAMERA_CHANGE_EVENT, this.tool.onCameraChange);

        return true;
    };

    BillboardExtension.prototype.unload = function () {
        this.viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, this.tool.onCameraChange);

        this.viewer.toolController.deregisterTool(this.tool);
        this.tool = null;
        return true;
    };

    BillboardExtension.prototype.isActive = function () {
        return this.tool.isActive();
    };

    BillboardExtension.prototype.enterEditMode = function () {
        if (!this.tool.isActive()) {
            this.viewer.toolController.activateTool('billboard');
        }
        return true;
    };

    BillboardExtension.prototype.leaveEditMode = function () {
        if (this.tool.isActive()) {
            this.viewer.toolController.deactivateTool('billboard');
        }
        return true;
    };

    BillboardExtension.prototype.generateData = function () {
        // Return an array with all the user added annotations.
        return true;
    };

    BillboardExtension.prototype.onToolbarCreated = function () {
        this.viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.onToolbarCreatedBinded);
        this.onToolbarCreatedBinded = null;
        this.createToolbarUI();
    };

    BillboardExtension.prototype.createToolbarUI = function () {
        var self = this;
        var viewer = this.viewer;

        var toolbar = viewer.getToolbar(true);
        var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);

        this.billboardToolButton = new Button('toolbar-billboardTool');
        this.billboardToolButton.setToolTip('Billboard');
        this.billboardToolButton.setIcon('adsk-icon-box'); // TODO: change the icon
        this.billboardToolButton.onClick = function (e) {
            var state = self.billboardToolButton.getState();
            if (state === Button.State.INACTIVE) {
                self.enterEditMode();
                self.billboardToolButton.setState(Button.State.ACTIVE);
            }
            else if (state === Button.State.ACTIVE) {
                self.leaveEditMode();
                self.billboardToolButton.setState(Button.State.INACTIVE);
            }
        };

        modelTools.addControl(this.billboardToolButton, { index: 0 });

    };

    BillboardExtension.prototype.destroyToolbarUI = function () {
        if (this.billboardToolButton) {
            var toolbar = this.viewer.getToolbar(false);
            if (toolbar) {
                var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);
                if (modelTools) {
                    modelTools.removeControl(this.billboardToolButton);
                }
            }
            this.billboardToolButton = null;
        }
    };

    theExtensionManager.registerExtension('Autodesk.Billboard', BillboardExtension);

    return BillboardExtension;
});