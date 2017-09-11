define([
    './Base/ObjectContextMenu'
], function(ObjectContextMenu) {
    'use strict';
    /**
     * Constructs a ViewerObjectContextMenu object.
     * @param {Viewer} viewer
     * @constructor
     */
    function ViewerObjectContextMenu(viewer) {
        ObjectContextMenu.call(this, viewer);
    }

    ViewerObjectContextMenu.prototype = Object.create(ObjectContextMenu.prototype);
    ViewerObjectContextMenu.prototype.constructor = ViewerObjectContextMenu;

    /**
     * Builds the context menu to be displayed.
     * @override
     * @param {Event} event - Browser event that requested the context menu
     * @param {Object} status - Information about nodes: numSelected, hasSelected, hasVisible, hasHidden.
     * @returns {?Array} An array of menu items.
     */
    ViewerObjectContextMenu.prototype.buildMenu = function (event, status) {
        var that = this,
            menu = [],
            nav = this.viewer.navigation,
            is2d = this.viewer.model.is2d();


        var viewport = this.viewer.container.getBoundingClientRect();
        var canvasX = event.clientX - viewport.left;
        var canvasY = event.clientY - viewport.top;

        var result = that.viewer.impl.hitTest(canvasX, canvasY, false);

        if (result && result.dbId) {

            var selSet = that.viewer.getSelection();

            if (selSet.indexOf(result.dbId) == -1)
                that.viewer.select(result.dbId);

            status.hasSelected = true;
            status.hasVisible = true;
        }

        // the title strings here are added to the viewer.loc.json for localization
        if (status.hasSelected) {
            menu.push({
                title: "Isolate",
                target: function () {
                    var selected = that.viewer.getSelection();
                    that.viewer.clearSelection();
                    that.viewer.isolate(selected);
                }
            });
            if (status.hasVisible) {
                menu.push({
                    title: "Hide Selected",
                    target: function () {
                        var selected = that.viewer.getSelection();
                        that.viewer.clearSelection();
                        that.viewer.hide(selected);
                    }
                });
            }
            if (status.hasHidden) {
                menu.push({
                    title: "Show Selected",
                    target: function () {
                        var selected = that.viewer.getSelection();
                        that.viewer.clearSelection();
                        that.viewer.show(selected);
                    }
                });
            }
        }

        if (is2d) {
            menu.push({
                title: "Show All Layers",
                target: function () {
                    that.viewer.setLayerVisible(null, true);
                }
            });
        }

        menu.push({
            title: "Show All Objects",
            target: function () {
                that.viewer.showAll();
            }
        });

        if (!is2d && status.hasSelected && nav.isActionEnabled('gotoview')) {
            menu.push({
                title: "Focus",
                target: function () {
                    var selectedIds = that.viewer.getSelection();
                    that.viewer.fitToView(selectedIds);
                }
            });
        }

        if (status.hasSelected) {
            menu.push({
                title: "Clear Selection",
                target: function () {
                    that.viewer.clearSelection();
                }
            });
        }

        return menu;
    };
    
    return ViewerObjectContextMenu;
});