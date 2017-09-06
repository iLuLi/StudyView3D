define(function() {
    //
    // struct Node {
    //     int dbId;
    //	   int parentDbId;
    //	   int firstChild; //if negative it's a fragment list
    //     int numChildren;
    //     int flags;	
    // };
    // sizeof(Node) == 20
    var SIZEOF_NODE = 5, //integers
        OFFSET_DBID = 0,
        OFFSET_PARENT = 1,
        OFFSET_FIRST_CHILD = 2,
        OFFSET_NUM_CHILD = 3,
        OFFSET_FLAGS = 4;
    'use strict';
    function InstanceTreeAccess(nodeArray, rootId, nodeBoxes) {
        this.nodes = nodeArray.nodes;
        this.children = nodeArray.children;
        this.dbIdToIndex = nodeArray.dbIdToIndex;
        this.names = nodeArray.names;
        this.nameSuffixes = nodeArray.nameSuffixes;
        this.strings = nodeArray.strings;
        this.rootId = rootId;
        this.numNodes = this.nodes.length / SIZEOF_NODE;
        this.visibleIds = null;


        this.nodeBoxes = nodeBoxes || new Float32Array(6 * this.numNodes);
    }

    // note dbId is not used
    InstanceTreeAccess.prototype.getNumNodes = function (dbId) {
        return this.numNodes;
    };

    InstanceTreeAccess.prototype.getIndex = function (dbId) {
        return this.dbIdToIndex[dbId];
    };

    InstanceTreeAccess.prototype.name = function (dbId) {
        var idx = this.dbIdToIndex[dbId];
        var base = this.strings[this.names[idx]];
        var suffix = this.nameSuffixes[idx];
        if (suffix) {
            //NOTE: update this logic if more separators are supported in processName above
            var lastChar = base.charAt(base.length - 1);
            if (lastChar === "[")
                return base + suffix + "]";
            else
                return base + suffix;
        } else {
            return base;
        }
    };

    InstanceTreeAccess.prototype.getParentId = function (dbId) {
        return this.nodes[this.dbIdToIndex[dbId] * SIZEOF_NODE + OFFSET_PARENT];
    };

    InstanceTreeAccess.prototype.getNodeFlags = function (dbId) {
        return this.nodes[this.dbIdToIndex[dbId] * SIZEOF_NODE + OFFSET_FLAGS];
    };

    InstanceTreeAccess.prototype.setNodeFlags = function (dbId, flags) {
        this.nodes[this.dbIdToIndex[dbId] * SIZEOF_NODE + OFFSET_FLAGS] = flags;
    };

    InstanceTreeAccess.prototype.getNumChildren = function (dbId) {
        var numChildren = this.nodes[this.dbIdToIndex[dbId] * SIZEOF_NODE + OFFSET_NUM_CHILD];
        if (numChildren > 0)
            return numChildren;
        return 0;
    };

    InstanceTreeAccess.prototype.getNumFragments = function (dbId) {
        var numChildren = this.nodes[this.dbIdToIndex[dbId] * SIZEOF_NODE + OFFSET_NUM_CHILD];
        if (numChildren < 0)
            return -numChildren;
        return 0;
    };

    InstanceTreeAccess.prototype.getNodeBox = function (dbId, dst) {
        var off = this.getIndex(dbId) * 6;
        for (var i = 0; i < 6; i++)
            dst[i] = this.nodeBoxes[off + i];
    };

    //Returns an array containing the dbIds of all objects
    //that are physically represented in the scene. Not all
    //objects in the property database occur physically in each graphics viewable.
    InstanceTreeAccess.prototype.getVisibleIds = function () {
        if (!this.visibleIds) {
            this.visibleIds = Object.keys(this.dbIdToIndex).map(function (k) { return parseInt(k); });
        }

        return this.visibleIds;
    };


    InstanceTreeAccess.prototype.enumNodeChildren = function (dbId, callback) {
        var idx = this.dbIdToIndex[dbId];
        var firstChild = this.nodes[idx * SIZEOF_NODE + OFFSET_FIRST_CHILD];
        var numChildren = this.nodes[idx * SIZEOF_NODE + OFFSET_NUM_CHILD];

        if (numChildren > 0) {
            for (var i = 0; i < numChildren; i++) {
                var childDbId = this.nodes[this.children[firstChild + i] * SIZEOF_NODE];
                callback(childDbId, dbId, idx);
            }
        }
    };

    InstanceTreeAccess.prototype.enumNodeFragments = function (dbId, callback) {
        var idx = this.dbIdToIndex[dbId];
        var firstChild = this.nodes[idx * SIZEOF_NODE + OFFSET_FIRST_CHILD];
        var numChildren = this.nodes[idx * SIZEOF_NODE + OFFSET_NUM_CHILD];

        //If numChildren is negative, it means leaf node and children are fragments
        if (numChildren < 0) {
            numChildren = -numChildren;
            for (var i = 0; i < numChildren; i++) {
                callback(this.children[firstChild + i], dbId, idx);
            }
        }
    };

    return InstanceTreeAccess;
});