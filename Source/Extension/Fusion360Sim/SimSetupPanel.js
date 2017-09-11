define([
    '../../UI/ViewerModelStructurePanel'
], function(ViewerModelStructurePanel) {
    'use strict';
    var SimSetupPanel = function (ext, title, options) {
        ViewerModelStructurePanel.call(this, ext.viewer, title, options);
        this.viewer = ext.viewer;
        this.ext = ext;
    
        this.container.style.left = "350px";
    };
    
    SimSetupPanel.prototype = Object.create(ViewerModelStructurePanel.prototype);
    SimSetupPanel.prototype.constructor = SimSetupPanel;
    
    SimSetupPanel.prototype.setGallery = function (gallery) {
        this.simGalleryPanel = gallery;
    };
    
    SimSetupPanel.prototype.isSimResultsNode = function (node) {
        if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.resultsNode) return false;
        return this.simGalleryPanel.simDef.resultsNode == node;
    };
    
    SimSetupPanel.prototype.isModelNode = function (node) {
        if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.modelNodes || this.simGalleryPanel.simDef.modelNodes.length == 0)
            return false;
    
        return this.simGalleryPanel.simDef.modelNodes.indexOf(node) == 1;
    };
    
    //SimSetupPanel.prototype.isSimResultGroupNode = function (node) {
    //    if (!this.simGalleryPanel || !this.simGalleryPanel.simDef || !this.simGalleryPanel.simDef.resultGroups || this.simGalleryPanel.simDef.resultGroups.length == 0)
    //        return false;
    
    //    var groupKeys = Object.keys(this.simGalleryPanel.simDef.resultGroups);
    //    for (var i = 0; i < groupKeys.length; i++) {
    //        var id = Number(groupKeys[i]);
    //        if(id == node)
    //            return true;
    //    }
    
    //    return false;
    //};
    
    SimSetupPanel.prototype.shouldInclude = function (node) {
        // Exclude results and model nodes.
        //
        if (this.isSimResultsNode(node) || this.isModelNode(node))
            return false;
    
        return true;
    }
    
    SimSetupPanel.prototype.onClick = function (node, event) {
        ViewerModelStructurePanel.prototype.onClick.call(this, node, event);
        this.simGalleryPanel.setSimObjectsVisibility(node);
    };
    
    SimSetupPanel.prototype.expandStudyNode = function () {
        if (!this.simGalleryPanel.simDef.studyNode) return;
        this.tree.setCollapsed(this.simGalleryPanel.simDef.studyNode, false);
    }

    return SimSetupPanel;
});