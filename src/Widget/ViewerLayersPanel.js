define([
    './LayersPanel',
    '../Extension/ViewerPanelMixin',
    '../Core/EventType'
], function(LayersPanel, ViewerPanelMixin, EventType) {
    'use strict';
    /**
     * ViewerLayersPanel
     * This is a panel for displaying the layers in a file.
     * @class
     * @augments Autodesk.Viewing.UI.LayersPanel
     *
     * @param {Viewer} viewer - The parent viewer.
     * @constructor
     */
    var ViewerLayersPanel = function (viewer) {
        var parentContainer = viewer.container;
        LayersPanel.call(this, viewer, parentContainer, parentContainer.id + "ViewerLayersPanel");

        this.onRestoreStateBinded = this.onRestoreState.bind(this);
        this.viewer.addEventListener(EventType.VIEWER_STATE_RESTORED_EVENT, this.onRestoreStateBinded);
    };

    ViewerLayersPanel.prototype = Object.create(LayersPanel.prototype);
    ViewerLayersPanel.prototype.constructor = ViewerLayersPanel;
    ViewerPanelMixin.call(ViewerLayersPanel.prototype);


    ViewerLayersPanel.prototype.uninitialize = function () {
        if (this.onRestoreStateBinded) {
            this.viewer.removeEventListener(EventType.VIEWER_STATE_RESTORED_EVENT, this.onRestoreStateBinded);
            this.onRestoreStateBinded = null;
        }
        LayersPanel.prototype.uninitialize.call(this);
    };

    ViewerLayersPanel.prototype.onRestoreState = function () {
        this.update();
    };

    /**
     * Override this method to do something when the user clicks on a tree node
     * @override
     * @param {Object} node
     * @param {Event} event
     */
    ViewerLayersPanel.prototype.onClick = function (node, event) {
        if (this.isMac && event.ctrlKey) {
            return;
        }
        var isolate = !(event.shiftKey || event.metaKey || event.ctrlKey);
        this.setLayerVisible(node, isolate);
    };

    /**
     * Override this to do something when the user right-clicks on a tree node
     * @param {Object} node
     * @param {Event} event
     */
    ViewerLayersPanel.prototype.onRightClick = function (node, event) {
        var isolate = !(event.shiftKey || event.metaKey || event.ctrlKey);
        this.setLayerVisible(node, isolate);
    };

    /**
     * Override this to do something when the user clicks on an image
     * @override
     * @param {Object} node
     * @param {Event} event
     */
    ViewerLayersPanel.prototype.onImageClick = function (node, event) {
        if (this.isMac && event.ctrlKey) {
            return;
        }
        this.setLayerVisible(node);
    };

    /**
     * Override this method to be notified when the user clicks on the title.
     * @override
     * @param {Event} event
     */
    ViewerLayersPanel.prototype.onTitleClick = function (event) {
        this.viewer.setLayerVisible(null, true);
    };

    /**
     * Override this method to be notified when the user double-clicks on the title.
     * @override
     * @param {Event} event
     */
    ViewerLayersPanel.prototype.onTitleDoubleClick = function (event) {
        this.viewer.fitToView();
    };

    return ViewerLayersPanel;
});