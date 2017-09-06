define([
    './ContextMenu'
], function(ContextMenu) {
    'use strict';
    /**
     * Constructs an ObjectContextMenu object.
     * This is the base class for object context menus.
     * @alias Autodesk.Viewing.UI.ObjectContextMenu
     * @param {Viewer} viewer
     * @constructor
     */
    var ObjectContextMenu = function (viewer) {
        this.viewer = viewer;
        this.contextMenu = new ContextMenu(viewer);
    };

    ObjectContextMenu.prototype.constructor = ObjectContextMenu;

    /**
     * Shows the context menu.
     * @param {Event} event - Browser event that requested the context menu
     */
    ObjectContextMenu.prototype.show = function (event) {
        var numSelected = this.viewer.getSelectionCount(),
            visibility = this.viewer.getSelectionVisibility(),
            status = {
                numSelected: numSelected,
                hasSelected: (0 < numSelected),
                hasVisible: visibility.hasVisible,
                hasHidden: visibility.hasHidden
            },
            menu = this.buildMenu(event, status);

        this.viewer.runContextMenuCallbacks(menu, status);

        if (menu && 0 < menu.length) {
            this.contextMenu.show(event, menu);
        }
    };

    /**
     * Hides the context menu.
     * @returns {boolean} true if the context menu was open, false otherwise.
     */
    ObjectContextMenu.prototype.hide = function () {
        return this.contextMenu.hide();
    };

    /**
     * Builds the context menu to be displayed.
     * Override this method to change the context menu.
     * @param {Event} event - Browser event that requested the context menu
     * @param {Object} status - Information about nodes.
     * @param {Number} status.numSelected - The number of selected objects.
     * @param {Boolean} status.hasSelected - True if there is at least one selected object.
     * @param {Boolean} status.hasVisible - True if at least one selected object is visible.
     * @param {Boolean} status.hasHidden - True if at least one selected object is hidden.
     * @returns {?Array} An array of menu items.
     *
     * Sample menu item:
     * {title: 'This is a menu item', target: function () {alert('Menu item clicked');}}
     * A submenu can be specified by providing an array of submenu items as the target.
     */
    ObjectContextMenu.prototype.buildMenu = function (event, status) {
        return null;
    };

    return ObjectContextMenu;
});