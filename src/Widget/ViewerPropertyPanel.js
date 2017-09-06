define([
    './PropertyPanel',
    '../Extension/ViewerPanelMixin',
    '../Core/EventType',
    './DockingPanel'
], function(PropertyPanel, ViewerPanelMixin, EventType, DockingPanel) {
    'use strict';
    /** @constructor */
    var ViewerPropertyPanel = function (viewer) {
        this.viewer = viewer;
        this.currentNodeIds = [];
        this.currentModel = null;
        this.isSelection = false;
        this.isDirty = true;
        this.propertyNodeId = null;
        PropertyPanel.call(this, viewer.container, 'ViewerPropertyPanel', 'Object Properties Loading...');
    };

    ViewerPropertyPanel.prototype = Object.create(PropertyPanel.prototype);
    ViewerPropertyPanel.prototype.constructor = ViewerPropertyPanel;
    ViewerPanelMixin.call(ViewerPropertyPanel.prototype);

    ViewerPropertyPanel.prototype.initialize = function () {
        PropertyPanel.prototype.initialize.call(this);

        var that = this;

        that.addEventListener(that.viewer, EventType.AGGREGATE_SELECTION_CHANGED_EVENT, function (event) {

            if (event.selections && event.selections.length) {
                that.currentNodeIds = event.selections[0].dbIdArray;
                that.currentModel = event.selections[0].model;
                that.isSelection = event.selections[0].dbIdArray.length > 0;
            } else {
                that.isSelection = false;
            }

            that.isDirty = true;
            that.requestProperties();
        });

        that.addEventListener(that.viewer, EventType.ISOLATE_EVENT, function (e) {

            //In case of "isolate none" and an active selection set
            //do not clear the property panel contents;
            if (e.nodeIdArray.length == 0 && that.isSelection)
                return;

            that.currentModel = e.model;
            that.currentNodeIds = e.nodeIdArray;
            that.isDirty = true;
            that.requestProperties();
        });

        that.addEventListener(that.viewer, EventType.HIDE_EVENT, function (e) {
            that.isDirty = true;
            that.requestProperties();
        });

        that.addEventListener(that.viewer, EventType.SHOW_EVENT, function (e) {
            that.isDirty = true;
            that.requestProperties();
        });

        // Populate the ids with the current selection or isolation.
        //
        this.currentModel = that.viewer.model; //TODO: getSelection needs to return something better so we know which model
        this.currentNodeIds = that.viewer.getSelection();
        if (this.currentNodeIds.length === 0) {
            this.currentNodeIds = that.viewer.getIsolatedNodes();
        } else {
            this.isSelection = true; //remember that we are showing the properties of a selection so that we trump isolation.
        }
    };

    ViewerPropertyPanel.prototype.setTitle = function (title, options) {
        if (!title) {
            title = 'Object Properties';  // localized by DockingPanel.prototype.setTitle
            options = options || {};
            options.localizeTitle = true;
        }
        PropertyPanel.prototype.setTitle.call(this, title, options);
    };

    ViewerPropertyPanel.prototype.setVisible = function (show) {
        DockingPanel.prototype.setVisible.call(this, show);
        this.requestProperties();
    };

    ViewerPropertyPanel.prototype.visibilityChanged = function () {
        DockingPanel.prototype.visibilityChanged.call(this);
        if (this.isVisible())
            this.requestProperties();
    };

    ViewerPropertyPanel.prototype.requestProperties = function () {
        if (this.isVisible() && this.isDirty) {
            if (this.currentNodeIds.length > 0) {
                this.setNodeProperties(this.currentNodeIds[this.currentNodeIds.length - 1]);
            } else {
                this.showDefaultProperties();
            }
            this.isDirty = false;
        }
    };

    ViewerPropertyPanel.prototype.setNodeProperties = function (nodeId) {
        var that = this;
        this.propertyNodeId = nodeId;
        that.currentModel.getProperties(nodeId, function (result) {
            that.setTitle(result.name);
            that.setProperties(result.properties);
            that.highlight(that.viewer.searchText);

            that.resizeToContent();

            if (that.isVisible()) {

                // Does the property panel overlap the mouse position? If so, then reposition
                // the property panel. Prefer a horizontal vs. vertical reposition.
                //
                var toolController = that.viewer.toolController,
                    mx = toolController.lastClickX,
                    my = toolController.lastClickY,
                    panelRect = that.container.getBoundingClientRect(),
                    px = panelRect.left,
                    py = panelRect.top,
                    pw = panelRect.width,
                    ph = panelRect.height,
                    canvasRect = that.viewer.canvas.getBoundingClientRect(),
                    cx = canvasRect.left,
                    cy = canvasRect.top,
                    cw = canvasRect.width,
                    ch = canvasRect.height;

                if ((px <= mx && mx < px + pw) && (py <= my && my < py + ph)) {
                    if ((mx < px + (pw / 2)) && (mx + pw) < (cx + cw)) {
                        that.container.style.left = Math.round(mx - cx) + 'px';
                        that.container.dockRight = false;
                    } else if (cx <= (mx - pw)) {
                        that.container.style.left = Math.round(mx - cx - pw) + 'px';
                        that.container.dockRight = false;
                    } else if ((mx + pw) < (cx + cw)) {
                        that.container.style.left = Math.round(mx - cx) + 'px';
                        that.container.dockRight = false;
                    } else if ((my + ph) < (cy + ch)) {
                        that.container.style.top = Math.round(my - cy) + 'px';
                        that.container.dockBottom = false;
                    } else if (cy <= (my - ph)) {
                        that.container.style.top = Math.round(my - cy - ph) + 'px';
                        that.container.dockBottom = false;
                    }
                }
            }
        });
    };

    ViewerPropertyPanel.prototype.showDefaultProperties = function () {
        var rootId = this.viewer.model.getRootId();
        if (rootId) {
            this.setNodeProperties(rootId);
        } else {
            this.propertyNodeId = null;
            this.setTitle('Model Properties', { localizeTitle: true });  // localized by DockingPanel.prototype.setTitle
            PropertyPanel.prototype.showDefaultProperties.call(this);
        }
    };

    ViewerPropertyPanel.prototype.areDefaultPropertiesShown = function () {
        var rootId = this.viewer.model.getRootId();
        return this.propertyNodeId === rootId;
    };

    ViewerPropertyPanel.prototype.uninitialize = function () {
        PropertyPanel.prototype.uninitialize.call(this);
        this.viewer = null;
    };

    ViewerPropertyPanel.prototype.onCategoryClick = function (category, event) {
        PropertyPanel.prototype.onCategoryClick.call(this, category, event);
        this.resizeToContent();
    };

    ViewerPropertyPanel.prototype.onCategoryIconClick = function (category, event) {
        PropertyPanel.prototype.onCategoryIconClick.call(this, category, event);
        this.resizeToContent();
    };


    return ViewerPropertyPanel;
});