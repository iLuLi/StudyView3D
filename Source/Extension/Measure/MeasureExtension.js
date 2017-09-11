define([
    '../../Core/Manager/theExtensionManager',
    '../../Core/Manager/theHotkeyManager',
    '../Extension',
    '../../Core/Constants/EventType',
    '../../UI/Base/ToolbarSID',
    '../../UI/Base/Button',
    './MeasureTool'
], function(
        theExtensionManager, 
        theHotkeyManager,
        Extension,
        EventType,
        ToolbarSID,
        Button,
        MeasureTool
    ) {
    'use strict';
    /**
     * @class
     * Extension used to support distance and angle measure for 2d and 3d models.
     *
     * @tutorial feature_measure
     * @param {Autodesk.Viewing.Viewer3D} viewer - the viewer to be extended.
     * @param {Object} options - An optional dictionary of options for this extension.
     * @alias Extensions.Measure.MeasureExtension
     * @constructor
    */
    var MeasureExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };

    MeasureExtension.prototype = Object.create(Extension.prototype);
    MeasureExtension.prototype.constructor = MeasureExtension;


    MeasureExtension.prototype.onToolbarCreated = function () {
        this.viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.bindedOnToolbarCreated);
        this.bindedOnToolbarCreated = null;
        this.createUI();
    };

    /**
     * Load measure extension.
     * @returns {boolean} true if measure extension is loaded successfully.
    */
    MeasureExtension.prototype.load = function () {

        var self = this;
        var viewer = this.viewer;

        this.escapeHotkeyId = 'Autodesk.Measure.Hotkeys.Escape';

        // Register the Measure tool
        if (!viewer.toolController) {
            return false;
        }
        this.tool = new MeasureTool(viewer, {
            onCloseCallback: function (e) {
                self.enableMeasureTool(false);
            }
        });
        viewer.toolController.registerTool(this.tool);

        if (this.viewer.toolbar) {
            this.createUI();
        } else {
            this.bindedOnToolbarCreated = this.onToolbarCreated.bind(this);
            this.viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, this.bindedOnToolbarCreated);
        }

        return true;
    };

    /**
     * Unload measure extension.
     * @returns {boolean} true if measure extension is unloaded successfully.
    */
    MeasureExtension.prototype.unload = function () {
        var viewer = this.viewer;

        // Remove the ui from the viewer.
        this.destroyUI();
        if (this.bindedOnToolbarCreated) {
            this.viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, this.bindedOnToolbarCreated);
            this.bindedOnToolbarCreated = null;
        }

        // Deregister tool
        viewer.toolController.deregisterTool(this.tool);
        this.tool = null;

        return true;
    };

    /**
     * Whether the measure tool is currently active.
     * @return {Boolean}
     */
    MeasureExtension.prototype.isActive = function () {
        return this.tool.isActive();
    };

    /**
     * Enable/disable the measure tool.
     * @param {boolean} active - true to activate, false to deactivate.
     * @returns {boolean} true if a change in activeness occurred.
     */
    MeasureExtension.prototype.setActive = function (active) {
        return this.enableMeasureTool(active);
    };

    /**
     * Toggles activeness of the measure tool.
     *
     * @return {Boolean} Whether the tool is active
     */
    MeasureExtension.prototype.toggle = function () {
        if (this.isActive()) {
            this.enableMeasureTool(false);
        } else {
            this.enableMeasureTool(true);
        }
        return this.isActive();
    };

    /**
     * Get the current measurement in the measure tool.
     * @param {String} [unitType] - Optional measure unit, [ 'decimal-ft', 'ft', 'ft-and-decimal-in',
     *                            'decimal-in', 'fractional-in', 'm', 'cm', 'mm', 'm-and-cm' ]
     * @param {Number} [precision] - Optional measure precision index,  [ 0 - 0, 1 - 0.1, 2 - 0.01, 3 - 0.001, 4 - 0.0001, 5 - 0.00001 ]
     *                             when units type is 'ft', 'in' or 'fractional-in' [ 0 - 1, 1 - 1/2, 2 - 1/4, 3 - 1/8, 4 - 1/16, 5 - 1/32, 6 - 1/64 ]
     * @return {Object|null} Containing properties of the current measurement, or null.
     */
    MeasureExtension.prototype.getMeasurement = function (unitType, precision) {
        var measurement = null;
        if (this.isActive()) {
            measurement = this.tool.getMeasurement(unitType, precision);
        }
        return measurement;
    };

    /**
     * Get all available units in measure tool.
     *
     * @return {Array} Containing all available units.
    */
    MeasureExtension.prototype.getUnitOptions = function () {
        var units = [
            { name: 'Unknown', type: '' },
            { name: 'Decimal feet', type: 'decimal-ft' },
            { name: 'Feet and fractional inches', type: 'ft' },
            { name: 'Feet and decimal inches', type: 'ft-and-decimal-in' },
            { name: 'Decimal inches', type: 'decimal-in' },
            { name: 'Fractional inches', type: 'fractional-in' },
            { name: 'Meters', type: 'm' },
            { name: 'Centimeters', type: 'cm' },
            { name: 'Millimeters', type: 'mm' },
            { name: 'Meters and centimeters', type: 'm-and-cm' }
        ];

        return units;
    };

    /**
     * Get all available precisions in measure tool.
     * @param {Boolean} isFractional - set true to get fractional precisions
     * @return {Array} Containing all available precisions.
    */
    MeasureExtension.prototype.getPrecisionOptions = function (isFractional) {

        if (isFractional)
            var precisions = ['1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64'];
        else
            var precisions = ['0', '0.1', '0.01', '0.001', '0.0001', '0.00001'];

        return precisions;
    };

    /**
     * Get the default measure unit in measure tool.
     *
     * @return {String} The default measure unit.
    */
    MeasureExtension.prototype.getDefaultUnit = function () {
        var unit = this.viewer.model.getDisplayUnit();

        return unit;
    };

    /**
     * Enable/disable the measure tool.
     * @param {boolean} enable - true to enable, false to disable.
     * @returns {boolean} true if the tool state was changed.
     * @private
     */
    MeasureExtension.prototype.enableMeasureTool = function (enable) {
        var toolController = this.viewer.toolController,
            isActive = this.tool.isActive();

        this.viewer.impl.disableRollover(enable);

        if (enable && !isActive) {
            toolController.activateTool("measure");
            if (this.measureToolButton) {
                this.measureToolButton.setState(Button.State.ACTIVE);
            }
            return true;

        } else if (!enable && isActive) {
            toolController.deactivateTool("measure");
            if (this.measureToolButton) {
                this.measureToolButton.setState(Button.State.INACTIVE);
            }
            return true;
        }
        return false;
    };



    /**
 * Create measure button in toolbar.
 * @private
*/
    MeasureExtension.prototype.createUI = function () {
        var self = this;
        var viewer = this.viewer;

        this.measureToolButton = null;

        var toolbar = viewer.getToolbar(true);
        var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);

        // Create a button for the measure tool.
        this.measureToolButton = new Button("toolbar-measureTool");
        this.measureToolButton.setToolTip("Measure");
        this.measureToolButton.setIcon("adsk-icon-measure");
        this.measureToolButton.onClick = function (e) {
            self.enableMeasureTool(!self.tool.isActive());
        };
        this.onMeasureButtonStateChange = function (e) {
            if (e.state === Button.State.ACTIVE) {
                self.enableMeasureTool(true);
            } else if (e.state === Button.State.INACTIVE) {
                self.enableMeasureTool(false);
            }
        };
        this.measureToolButton.addEventListener(Button.Event.STATE_CHANGED, this.onMeasureButtonStateChange);

        modelTools.addControl(this.measureToolButton, { index: 0 });

        // Escape hotkey to exit tool.
        //
        var hotkeys = [{
            keycodes: [
                theHotkeyManager.KEYCODES.ESCAPE
            ],
            onRelease: function () {
                return self.enableMeasureTool(false);
            }
        }];
        theHotkeyManager.pushHotkeys(this.escapeHotkeyId, hotkeys);
    };

    /**
     * Destroy measure button in toolbar.
     * @private
    */
    MeasureExtension.prototype.destroyUI = function () {
        var viewer = this.viewer;

        if (this.measureToolButton) {
            this.measureToolButton.removeEventListener(Button.Event.STATE_CHANGED, this.onMeasureButtonStateChange);
        }

        var toolbar = viewer.getToolbar(false);
        if (toolbar) {
            var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);
            if (modelTools) {
                if (this.measureToolButton) {
                    var submenu = modelTools.getControl("toolbar-inspectSubMenu");
                    if (submenu) {
                        submenu.removeControl(this.measureToolButton.getId());
                    } else {
                        modelTools.removeControl(this.measureToolButton.getId());
                    }
                }

                this.measureToolButton = null;
            }
        }

        theHotkeyManager.popHotkeys(this.escapeHotkeyId);
    };

    theExtensionManager.registerExtension('Autodesk.Measure', MeasureExtension);
    return MeasureExtension;
});