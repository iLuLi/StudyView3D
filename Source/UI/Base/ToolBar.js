define(['./ControlGroup', './Control'], function(ControlGroup, Control) {;
    'use strict'
    /**
     * @class
     * This is the core class that represents a toolbar. It consists of {@link Autodesk.Viewing.UI.ControlGroup|ControlGroups}
     * that group controls by functionality.
     *
     * @alias Autodesk.Viewing.UI.ToolBar
     * @param {String} id - The id for this toolbar.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {Boolean} [options.collapsible=true] - Whether this toolbar is collapsible
     *
     * @constructor
     * @augments Autodesk.Viewing.UI.ControlGroup
     * @memberof Autodesk.Viewing.UI
     */
    function ToolBar(id, options) {
        ControlGroup.call(this, id, options);

        this.removeClass('adsk-control-group');
        this.addClass('adsk-toolbar');
    };

    /**
     * Enum for toolbar event IDs.
     * @readonly
     * @enum {String}
     */
    ToolBar.Event = {
        // Inherited from Control
        VISIBILITY_CHANGED: Control.Event.VISIBILITY_CHANGED,
        COLLAPSED_CHANGED: Control.Event.COLLAPSED_CHANGED,

        // Inherited from ControlGroup
        CONTROL_ADDED: ControlGroup.Event.CONTROL_ADDED,
        CONTROL_REMOVED: ControlGroup.Event.CONTROL_REMOVED,
        SIZE_CHANGED: ControlGroup.Event.SIZE_CHANGED
    };

    ToolBar.prototype = Object.create(ControlGroup.prototype);
    ToolBar.prototype.constructor = ToolBar;

    return ToolBar;
});