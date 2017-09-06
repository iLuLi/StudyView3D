define([
    '../SelectionMode'
], function(SelectionMode) {
    'use strict';
    var NODE_TYPE_ASSEMBLY = 0x0,    // Real world object as assembly of sub-objects
        NODE_TYPE_INSERT = 0x1,    // Insert of multiple-instanced object
        NODE_TYPE_LAYER = 0x2,    // A layer (specific abstraction collection)
        NODE_TYPE_COLLECTION = 0x3,    // An abstract collection of objects (e.g. “Doors”)
        NODE_TYPE_COMPOSITE = 0x4,    // A real world object whose internal structure is not relevant to end user
        NODE_TYPE_MODEL = 0x5,    // Root of tree representing an entire Model. An aggregate model can contain multiple nested models.
        NODE_TYPE_GEOMETRY = 0x6,    // Leaf geometry node
        NODE_TYPE_BITS = 0x7,    //mask for all bits used by node type

        NODE_FLAG_NOSELECT = 0x20000000,
        NODE_FLAG_OFF = 0x40000000,
        NODE_FLAG_HIDE = 0x80000000;



    function InstanceTree(nodeAccess, objectCount, maxDepth) {

        this.nodeAccess = nodeAccess;
        this.maxDepth = maxDepth;
        this.objectCount = objectCount;
        this.numHidden = 0;
        this.numOff = 0;
    }


    InstanceTree.prototype.setFlagNode = function (dbId, flag, value) {

        var old = this.nodeAccess.getNodeFlags(dbId);

        // "!!" converts to bool
        if (!!(old & flag) == value)
            return false;

        if (value)
            this.nodeAccess.setNodeFlags(dbId, old | flag);
        else
            this.nodeAccess.setNodeFlags(dbId, old & ~flag);

        return true;
    };

    InstanceTree.prototype.setFlagGlobal = function (flag, value) {
        var na = this.nodeAccess;

        var i = 0, iEnd = na.numNodes;
        if (value) {
            for (; i < iEnd; i++) {
                na.setNodeFlags(i, na.getNodeFlags(i) | flag);
            }
        } else {
            var notflag = ~flag;
            for (; i < iEnd; i++) {
                na.setNodeFlags(i, na.getNodeFlags(i) & notflag);
            }
        }
    };

    /**
     * When a node is OFF, it is completely skipped for display purposes
     */
    InstanceTree.prototype.setNodeOff = function (dbId, value) {
        var res = this.setFlagNode(dbId, NODE_FLAG_OFF, value);
        if (res) {
            if (value)
                this.numOff++;
            else
                this.numOff--;
        }
        return res;
    };

    InstanceTree.prototype.isNodeOff = function (dbId) {
        return !!(this.nodeAccess.getNodeFlags(dbId) & NODE_FLAG_OFF);
    };


    /**
     * When a node is HIDDEN it will display in ghosted style
     * if display of hidden objects is on
     */
    InstanceTree.prototype.setNodeHidden = function (dbId, value) {
        var res = this.setFlagNode(dbId, NODE_FLAG_HIDE, value);
        if (res) {
            if (value)
                this.numHidden++;
            else
                this.numHidden--;
        }
        return res;
    };

    InstanceTree.prototype.isNodeHidden = function (dbId) {
        return !!(this.nodeAccess.getNodeFlags(dbId) & NODE_FLAG_HIDE);
    };

    InstanceTree.prototype.getNodeType = function (dbId) {
        return this.nodeAccess.getNodeFlags(dbId) & NODE_TYPE_BITS;
    };

    InstanceTree.prototype.isNodeSelectable = function (dbId) {
        return !(this.nodeAccess.getNodeFlags(dbId) & NODE_FLAG_NOSELECT);
    };

    InstanceTree.prototype.getNodeParentId = function (dbId) {
        return this.nodeAccess.getParentId(dbId);
    };

    InstanceTree.prototype.getRootId = function () {
        return this.nodeAccess.rootId;
    };

    InstanceTree.prototype.getNodeName = function (dbId) {
        return this.nodeAccess.name(dbId);
    };

    InstanceTree.prototype.getChildCount = function (dbId) {
        return this.nodeAccess.getNumChildren(dbId);
    };

    InstanceTree.prototype.getNodeBox = function (dbId, dst) {
        this.nodeAccess.getNodeBox(dbId, dst);
    };



    InstanceTree.prototype.enumNodeFragments = function (node, callback, recursive) {

        //TODO: Temporary until we are consistently using dbId
        var dbId;
        if (typeof node == "number")
            dbId = node;
        else if (node)
            dbId = node.dbId;

        var self = this;

        function traverse(dbId) {

            self.nodeAccess.enumNodeFragments(dbId, callback);

            if (recursive) {
                self.enumNodeChildren(dbId, function (child_dbId) {
                    traverse(child_dbId);
                });
            }
        }

        traverse(dbId);

    };


    InstanceTree.prototype.enumNodeChildren = function (node, callback, recursive) {

        //TODO: Temporary until we are consistently using dbId
        var dbId;
        if (typeof node == "number")
            dbId = node;
        else if (node)
            dbId = node.dbId;

        var self = this;

        if (recursive) {
            callback(dbId);
        }

        function traverse(dbId) {

            self.nodeAccess.enumNodeChildren(dbId, function (childId) {
                callback(childId);

                if (recursive)
                    traverse(childId);
            });

        }

        traverse(dbId);
    };


    //Given a leaf node, find the correct parent
    //node to select according to the given selection mode
    InstanceTree.prototype.findNodeForSelection = function (dbId, selectionMode) {

        //Default legacy mode -- select exactly the node we got asked for.
        if (selectionMode === SelectionMode.LEAF_OBJECT)
            return dbId;

        var res = dbId;
        var node, nt;

        if (selectionMode === SelectionMode.FIRST_OBJECT) {
            //1. Find the leaf node of the selection tree containing it and then follow the chain of parents all the way up to the root to get the complete path from root to leaf node.
            //2. Start at the root and walk down the path until the first node that is not a Model, Layer or Collection. Select it.
            var idpath = [];

            node = dbId;
            while (node) {
                idpath.push(node);
                node = this.getNodeParentId(node);
            }

            for (var i = idpath.length - 1; i >= 0; i--) {
                nt = this.getNodeType(idpath[i]);
                if ((nt !== NODE_TYPE_MODEL) &&
                    (nt !== NODE_TYPE_LAYER) &&
                    (nt !== NODE_TYPE_COLLECTION)) {
                    res = idpath[i];
                    break;
                }
            }
        }

        else if (selectionMode === SelectionMode.LAST_OBJECT) {
            // Start at the leaf and walk up the path until the first node that is Composite. Select it. If there’s no Composite node in the path select the leaf.

            node = dbId;
            while (node) {
                nt = this.getNodeType(node);
                if (nt === NODE_TYPE_COMPOSITE) {
                    res = node;
                    break;
                }
                node = this.getNodeParentId(node);
            }

        }

        return res;

    };

    return InstanceTree;
});