define([
    '../../UI/ViewerModelStructurePanel'
], function(ViewerModelStructurePanel) {
    'use strict';
    var SimModelStructurePanel = function (ext, title, options) {
        ViewerModelStructurePanel.call(this, ext.viewer, title, options);
        this.viewer = ext.viewer;
        this.ext = ext;
    };
    
    SimModelStructurePanel.prototype = Object.create(ViewerModelStructurePanel.prototype);
    SimModelStructurePanel.prototype.constructor = SimModelStructurePanel;
    
    SimModelStructurePanel.prototype.setGallery = function (gallery) {
        this.simGalleryPanel = gallery;
    };
    
    SimModelStructurePanel.prototype.initialize = function () {
        ViewerModelStructurePanel.prototype.initialize.call(this);
    };
    
    SimModelStructurePanel.prototype.isSimResultsNode = function (node) {
        if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.resultsNode) return false;
        return this.simGalleryPanel.simDef.resultsNode == node;
    };
    
    SimModelStructurePanel.prototype.isSimStudyNode = function (node) {
        if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.studyNode) return false;
        return this.simGalleryPanel.simDef.studyNode == node;
    };
    
    SimModelStructurePanel.prototype.isModelNode = function (node) {
        if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.modelNodes || this.simGalleryPanel.simDef.modelNodes.length == 0)
            return false;
    
        return this.simGalleryPanel.simDef.modelNodes.indexOf(node) !== -1;
    };
    
    SimModelStructurePanel.prototype.shouldInclude = function (node) {
        // Exclude study node.
        //
        if (this.isSimStudyNode(node))
            return false;
    
        return true;
    }
    
    SimModelStructurePanel.prototype.onClick = function (node, event) {
        ViewerModelStructurePanel.prototype.onClick.call(this, node, event);
        this.simGalleryPanel.setModelNodesVisible(true);
        this.simGalleryPanel.hightlightNode(node, true);
    
        //hide loads
        if (this.simGalleryPanel.simDef.loadsNode)
            this.viewer.hide(this.simGalleryPanel.simDef.loadsNode);
        //hide constraints
        if (this.simGalleryPanel.simDef.constraintsNode)
            this.viewer.hide(this.simGalleryPanel.simDef.constraintsNode);
        //hide results
        if (this.simGalleryPanel.simDef.resultsNode)
            this.viewer.hide(this.simGalleryPanel.simDef.resultsNode);
    };
    
    SimModelStructurePanel.prototype.expandStudyNode = function () {
        if (!this.simGalleryPanel.simDef.studyNode) return;
        this.tree.setCollapsed(this.simGalleryPanel.simDef.studyNode, false);
    }

    return SimModelStructurePanel;
});