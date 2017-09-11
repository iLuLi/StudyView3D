define([
    '../UI/ViewerModelStructurePanel'
], function(ViewerModelStructurePanel) {
    'use strict';
    function CAMModelStructurePanel(viewer, title, options) {
        ViewerModelStructurePanel.call(this, viewer, title, options);
        this.viewer = viewer;
    }

    CAMModelStructurePanel.prototype = Object.create(ViewerModelStructurePanel.prototype);
    CAMModelStructurePanel.prototype.constructor = CAMModelStructurePanel;

    CAMModelStructurePanel.prototype.sortCamNodes = function (instanceTree, onCamNodesSorted) {
        this.camNodes = [];
        this.camModelNodes = [];
        this.camSetupNodes = [];
        this.camStockNodes = [];
        this.camOperationNodes = [];
        this.camToolNodes = [];
        this.camFolderNodes = [];

        var that = this;

        // Find all of the nodes to process.
        //
        var nodeIdsToProcess = [];

        instanceTree.enumNodeChildren(instanceTree.getRootId(), function (dbId) {
            nodeIdsToProcess.push(dbId);
        }, true);

        nodeIdsToProcess.shift(); //take out the root

        function processNodeId(node, onNodeProcessed) {

            // Gets the p
            function getPropertyValue(properties, propertyName) {
                for (var i = 0; i < properties.length; ++i) {
                    var property = properties[i];
                    if (property.displayName === propertyName) {
                        return property.displayValue;
                    }
                }
                return null;
            }

            function onPropertiesRetrieved(result) {
                // Sort the nodes into the proper containers here.
                //
                var name = getPropertyValue(result.properties, '9429B915-D020-4CEB-971B-6ADD0A5D4BFA');

                if (name) {
                    if (name == 'CAM_Setup') {
                        that.camSetupNodes.push(node);
                    }
                    else if (name == 'CAM_Operation') {
                        that.camOperationNodes.push(node);
                    }
                    else if (name === 'CAM_Tool') { // Check this.
                        that.camToolNodes.push(node);
                    } else if (name === 'CAM_Stock') {  // Check this.
                        that.camStockNodes.push(node);
                    } else if (name == 'CAM_Folder') {
                        that.camFolderNodes.push(node);
                    }

                    that.camNodes.push(node);

                } else {
                    that.camModelNodes.push(node);
                }

                onNodeProcessed();
            }

            function onError(status, message, data) {
                onNodeProcessed();
            }

            that.viewer.getProperties(node, onPropertiesRetrieved, onError);

        }

        // Process the nodes one by one.
        //
        function processNext() {
            if (nodeIdsToProcess.length > 0) {
                processNodeId(nodeIdsToProcess.shift(), processNext);
            } else {
                // No more nodes to process - call the provided callback.
                //
                onCamNodesSorted();
            }
        }
        processNext();
    };

    CAMModelStructurePanel.prototype.setModel = function (instanceTree, modelTitle) {
        // Sort all of the cam nodes.  Once done, call setModel on the base class to build the UI, and
        // set the visibilities properly.
        //
        var that = this;
        that.sortCamNodes(instanceTree, function () {
            ViewerModelStructurePanel.prototype.setModel.call(that, instanceTree, modelTitle);
            that.SetCAMNodeVisible(false);
            that.setVisible(true);

            // expand the setup node, and resize to fit.
            that.ExpandSetupNodes();
            that.resizeToContent();
        });
    };

    CAMModelStructurePanel.prototype.initialize = function () {
        ViewerModelStructurePanel.prototype.initialize.call(this);

        var that = this;

        function onGeometryLoaded(e) {
            that.SetCAMNodeVisible(false);
            that.removeEventListener(that.viewer, Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
        }

        if (!this.viewer.model || !this.viewer.model.isLoadDone()) {
            that.addEventListener(that.viewer, Autodesk.Viewing.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
        }

        that.addEventListener(that.viewer, Autodesk.Viewing.SHOW_EVENT,
            function (e) {
                var nodes = e.nodeIdArray;
                if (nodes) {
                    for (var k = 0; k < nodes.length; k++)
                        that.setCamNodeVisibility(nodes[k]);
                }
            });

        that.addEventListener(that.viewer, Autodesk.Viewing.SELECTION_CHANGED_EVENT,
            function (e) {
                var nodes = e.nodeArray;
                if (nodes) {
                    for (var k = 0; k < nodes.length; k++)
                        that.HideHightlightCAMNode(nodes[k]);
                }
            });

        that.addEventListener(that.viewer, Autodesk.Viewing.ISOLATE_EVENT,
            function (e) {
                var nodes = e.nodeIdArray;
                if (nodes) {
                    // show all
                    if (nodes.length == 0) {
                        that.SetModelVisible();
                        that.SetCAMNodeVisible(true);
                    }
                    else {
                        for (var k = 0; k < nodes.length; k++)
                            that.setCamNodeVisibility(nodes[k]);
                    }
                }
            });
    };

    CAMModelStructurePanel.prototype.IsCAMNode = function (node) {
        return this.camNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.IsCAMSetupNode = function (node) {
        return this.camSetupNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.IsCAMStockNode = function (node) {
        return this.camStockNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.IsCAMToolNode = function (node) {
        return this.camToolNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.IsCAMOperationNode = function (node) {
        return this.camOperationNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.IsCAMFolderNode = function (node) {
        return this.camFolderNodes.indexOf(node) !== -1;
    };

    CAMModelStructurePanel.prototype.shouldInclude = function (node) {
        // Exclude all stock nodes.
        //
        return !this.IsCAMStockNode(node);
    };

    CAMModelStructurePanel.prototype.isGroupNode = function (node) {
        // We consider cam operation nodes leaf nodes.
        //
        return this.IsCAMOperationNode(node) ? false : ViewerModelStructurePanel.prototype.isGroupNode.call(this, node);
    };

    CAMModelStructurePanel.prototype.setNodeVisibility = function (node, visible) {
        if (visible) {
            this.viewer.show(node);
        } else {
            this.viewer.hide(node)
        }
    };

    CAMModelStructurePanel.prototype.SetModelVisible = function () {
        if (!this.camModelNodes) return;

        for (var k = 0; k < this.camModelNodes.length; k++)
            this.setNodeVisibility(this.camModelNodes[k], true);
    };

    CAMModelStructurePanel.prototype.SetCAMNodeVisible = function (visible) {
        if (!this.camNodes) return;

        for (var k = 0; k < this.camNodes.length; k++) {
            this.setNodeVisibility(this.camNodes[k], visible);
        }
        this.SetToolNodeVisible(false);
    };

    CAMModelStructurePanel.prototype.SetToolNodeVisible = function (visible) {
        if (!this.camToolNodes) return;

        for (var k = 0; k < this.camToolNodes.length; k++)
            this.setNodeVisibility(this.camToolNodes[k], visible);
    };

    CAMModelStructurePanel.prototype.HideHightlightNode = function (node) {

        var viewer = this.viewer.impl;
        var that = this;

        that.instanceTree.enumNodeFragments(node, function (fragId) {
            viewer.highlightFragment(that.model, fragId, false, true);
        }, true);
    };

    // this is to hide the specific child node
    CAMModelStructurePanel.prototype.HideHightlightCAMNode = function (node) {

        var isCamSetupNode = this.IsCAMSetupNode(node);
        var isCamOperaNode = this.IsCAMOperationNode(node);
        var isCamFolderNode = this.IsCAMFolderNode(node);

        var that = this;

        that.instanceTree.enumNodeChildren(node, function (dbId) {
            if (isCamSetupNode) {
                if (!that.IsCAMStockNode(dbId))
                    that.HideHightlightNode(dbId);
            }
            else if (isCamOperaNode) {
                if (that.IsCAMToolNode(dbId))
                    that.HideHightlightNode(dbId);
            }
            else if (isCamFolderNode) {
                that.HideHightlightNode(dbId);
            }
        }, false);

    };


    CAMModelStructurePanel.prototype.setCamNodeVisibility = function (nodeId) {
        var isCamSetupNode = this.IsCAMSetupNode(nodeId);
        var isCamOperaNode = this.IsCAMOperationNode(nodeId);
        var isCamFolderNode = this.IsCAMFolderNode(nodeId);
        var that = this;

        if (isCamSetupNode) {
            this.instanceTree.enumNodeChildren(nodeId, function (childNodeId) {
                var bStock = that.IsCAMStockNode(childNodeId);
                that.setNodeVisibility(childNodeId, bStock);
            });
        }
        else if (isCamOperaNode) {
            // hide the tool node
            this.instanceTree.enumNodeChildren(nodeId, function (childNodeId) {
                if (that.IsCAMToolNode(childNodeId)) {
                    that.setNodeVisibility(childNodeId, false);
                }
            });
        }
        else if (isCamFolderNode) {
            this.instanceTree.enumNodeChildren(nodeId, function (childNodeId) {
                that.setNodeVisibility(childNodeId, false);
            });
        }

    };


    CAMModelStructurePanel.prototype.onClick = function (node, event) {
        ViewerModelStructurePanel.prototype.onClick.call(this, node, event);

        this.SetModelVisible();

        this.setCamNodeVisibility(node);

        this.viewer.fitToView();
    };

    CAMModelStructurePanel.prototype.ExpandSetupNodes = function () {

        if (!this.camSetupNodes) return;

        for (var k = 0; k < this.camSetupNodes.length; k++)
            this.tree.setCollapsed(this.camSetupNodes[k], false);
    };


    return CAMModelStructurePanel;
});