define(['../Constants/EventType'], function(EventType) {;
    'use strict'
    var VisibilityManager = function (viewerImpl, model) {
        this.viewerImpl = viewerImpl;

        //Currently the visibility manager works on a single model only
        //so we make this explicit here.
        this.model = model;

        // Keep track of isolated nodes
        this.isolatedNodes = [];

        // Keeps track of hidden nodes. Only applies when there's no isolated node being tracked.
        this.hiddenNodes = [];
    };

    VisibilityManager.prototype.getInstanceTree = function () {
        if (this.model)
            return this.model.getData().instanceTree;
        else
            return null;
    };

    VisibilityManager.prototype.getIsolatedNodes = function () {
        return this.isolatedNodes.slice(0);
    };

    VisibilityManager.prototype.getHiddenNodes = function () {
        return this.hiddenNodes.slice(0);
    };

    /** @params {bool} - visible flag applied to all dbIds/fragments. */
    VisibilityManager.prototype.setAllVisibility = function (visible) {

        var root = this.model ? this.model.getRootId() : null;
        if (root) {
            // if we have an instance tree, we call setVisible on the root node
            this.setVisibilityOnNode(root, visible);
        }

        // 2D datasets may need to call setAllVisibility on the model. This can have two possible reasons:
        //  a) they may have no instance tree, so that setting visibility on root (as above) is not possible.
        //  b) even if they have an instance tree, setting visibility on root node will only reach selectable ids.
        //     2D datasets may also contain unselectable objects with id <=0. In this case, the call below
        //     is needed to hide/show these as well when using isolate/show-all.
        var is2d = this.model.getData().is2d;
        if (is2d) {
            this.model.setAllVisibility(visible);
        }
    }

    VisibilityManager.prototype.isNodeVisible = function (dbId) {
        var it = this.getInstanceTree();
        if (it) {
            // get visibility from instance tree
            return !it.isNodeHidden(dbId);
        } else {
            // If there is no instance tree, we have ids, but no hierarchy.
            // Therefore, an id is only hidden if it appears in hiddenNodes or
            // if there are isolated nodes and dbId is not among these.
            return (this.hiddenNodes.indexOf(dbId) == -1 && (this.isolatedNodes.length == 0 || this.isolatedNodes.indexOf(dbId) != -1));
        }
    }

    VisibilityManager.prototype.isolate = function (node) {
        var it = this.getInstanceTree();
        var rootId = (it ? it.getRootId() : null);
        var isRoot = (typeof node == "number" && node === rootId)
            || (typeof node == "object" && node.dbId === rootId);

        if (node && !isRoot) {
            this.isolateMultiple(Array.isArray(node) ? node : [node]);
        } else {
            this.isolateNone();
        }
    };

    VisibilityManager.prototype.isolateNone = function () {

        this.model.setAllVisibility(true);
        this.viewerImpl.sceneUpdated(true);

        this.setAllVisibility(true);

        this.hiddenNodes = [];
        this.isolatedNodes = [];
        this.viewerImpl.invalidate(true);

        var event = { type: EventType.ISOLATE_EVENT, nodeIdArray: [], model: this.model };
        this.viewerImpl.api.fireEvent(event);
    };

    //Makes the children of a given node visible and
    //everything else not visible
    VisibilityManager.prototype.isolateMultiple = function (nodeList) {

        //If given nodelist is null or is an empty array or contains the whole tree
        if (!nodeList || nodeList.length == 0) {
            this.isolateNone();
        }
        else {

            this.setAllVisibility(false);

            // For 3D, visibility is controlled via MESH_VISIBLE flag.
            // For 2D, visibility can only be contolled via a texture in MaterialManager. This already
            // happens in the setVisibilityOnNode(..) call above.
            if (!this.model.getData().is2d) {
                this.model.setAllVisibility(false);
                this.viewerImpl.sceneUpdated(true);
            }

            // Needs to happen after setVisibilityOnNode(root).
            this.isolatedNodes = nodeList.slice(0);
            this.hiddenNodes = [];

            for (var i = 0; i < nodeList.length; i++) {
                this.setVisibilityOnNode(nodeList[i], true);
            }

            var event = { type: EventType.ISOLATE_EVENT, nodeIdArray: nodeList, model: this.model };
            this.viewerImpl.api.fireEvent(event);
        }

        //force a repaint and a clear
        this.viewerImpl.invalidate(true);
    };


    //Makes the children of a given node visible and
    //everything else not visible
    VisibilityManager.prototype.hide = function (node) {

        var event;

        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; ++i) {
                this.setVisibilityOnNode(node[i], false);
            }

            if (node.length > 0) {
                event = { type: EventType.HIDE_EVENT, nodeIdArray: node };
            }
        } else {
            this.setVisibilityOnNode(node, false);
            event = { type: EventType.HIDE_EVENT, nodeIdArray: [node] };
        }

        if (event)
            this.viewerImpl.api.fireEvent(event);
    };

    VisibilityManager.prototype.show = function (node) {

        var event;

        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; ++i) {
                this.setVisibilityOnNode(node[i], true);
            }

            if (node.length > 0) {
                event = { type: EventType.SHOW_EVENT, nodeIdArray: node };
            }
        } else {
            this.setVisibilityOnNode(node, true);
            event = { type: EventType.SHOW_EVENT, nodeIdArray: [node] };
        }

        if (event)
            this.viewerImpl.api.fireEvent(event);
    };

    VisibilityManager.prototype.toggleVisibility = function (node) {
        var hidden = this.getInstanceTree().isNodeHidden(node);
        this.setVisibilityOnNode(node, hidden); //Note -- toggle visibility, so we want !!hidden => hidden

        var event = { type: hidden ? EventType.SHOW_EVENT : EventType.HIDE_EVENT, nodeIdArray: [node] };
        this.viewerImpl.api.fireEvent(event);
    };

    VisibilityManager.prototype.setVisibilityOnNode = function (node, visible) {

        var viewer = this.viewerImpl;
        var model = this.model;
        var instanceTree = this.getInstanceTree();
        var hidden = !visible;
        var is2d = model.getData().is2d;
        var matMan = this.viewerImpl.matman();

        if (instanceTree) {
            //Recursively process the tree under the root (recursion is inclusive of the root)
            instanceTree.enumNodeChildren(node, function (dbId) {

                instanceTree.setNodeHidden(dbId, hidden);

                if (is2d) {
                    model.getFragmentList().setObject2DGhosted(dbId, !visible);
                } else {
                    instanceTree.enumNodeFragments(dbId, function (fragId) {
                        model.setVisibility(fragId, visible);
                    }, false);
                }
            }, true);
        } else {
            //No instance tree, assume fragId = dbId
            if (is2d) {
                model.getFragmentList().setObject2DGhosted(node, !visible);
            } else {
                model.setVisibility(node, visible);
            }
        }

        viewer.sceneUpdated(true);
        this.updateNodeVisibilityTracking(node, visible);
    };

    VisibilityManager.prototype.updateNodeVisibilityTracking = function (node, visible) {

        // Update hidden tracking array.
        var toVisible = visible;
        if (this.isolatedNodes.length > 0) {
            var isoIndex = this.isolatedNodes.indexOf(node);
            if (toVisible && isoIndex === -1) {
                this.isolatedNodes.push(node);
            }
            else if (!toVisible && isoIndex !== -1) {
                this.isolatedNodes.splice(isoIndex, 1);
            }
        } else {
            var hidIndex = this.hiddenNodes.indexOf(node);
            if (!toVisible && hidIndex === -1) {
                this.hiddenNodes.push(node);
            }
            else if (toVisible && hidIndex !== -1) {
                this.hiddenNodes.splice(hidIndex, 1);
            }
        }

        // When operating with the node, we can get simplify stuff.
        var instanceTree = this.getInstanceTree();
        if (instanceTree && instanceTree.root && instanceTree.root.dbId === node) {
            if (visible) {
                this.isolatedNodes = [];
                this.hiddenNodes = [];
            } else {
                this.isolatedNodes = [];
                this.hiddenNodes = [node];
            }
        }
    };

    VisibilityManager.prototype.setNodeOff = function (node, isOff) {
        var viewer = this.viewerImpl;
        var model = this.model;
        var instanceTree = this.getInstanceTree();

        if (instanceTree) {
            //Recursively process the tree under the root (recursion is inclusive of the root)
            instanceTree.enumNodeChildren(node, function (dbId) {

                instanceTree.setNodeOff(dbId, isOff);

                instanceTree.enumNodeFragments(dbId, function (fragId) {
                    model.getFragmentList().setFragOff(fragId, isOff);
                }, false);

            }, true);
        } else {
            model.getFragmentList().setFragOff(node, isOff);
        }

        viewer.sceneUpdated(true);
    };


    return VisibilityManager;
});