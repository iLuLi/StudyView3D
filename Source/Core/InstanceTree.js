define([
    './Constants/SelectionMode'
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
    // note: objectCount and fragmentCount are not used
    function NodeArray(objectCount, fragmentCount) {
    
        this.nodes = [];
        this.nextNode = 0;

        this.children = [];
        this.nextChild = 0;

        this.dbIdToIndex = {};

        this.names = [];
        this.s2i = {}; //duplicate string pool
        this.strings = [];
        this.nameSuffixes = []; //integers

        //Occupy index zero so that we can use index 0 as undefined
        this.getIndex(0);
    }

    NodeArray.prototype.getIndex = function (dbId) {

        var index = this.dbIdToIndex[dbId];

        if (index)
            return index;

        index = this.nextNode++;

        //Allocate space for new node
        this.nodes.push(dbId); //store the dbId as first integer in the Node structure
        //Add four blank integers to be filled by setNode
        for (var i = 1; i < SIZEOF_NODE; i++)
            this.nodes.push(0);

        this.dbIdToIndex[dbId] = index;

        return index;
    };

    NodeArray.prototype.setNode = function (dbId, parentDbId, name, flags, childrenIds, isLeaf) {

        var index = this.getIndex(dbId);

        var baseOffset = index * SIZEOF_NODE;

        this.nodes[baseOffset + OFFSET_PARENT] = parentDbId;
        this.nodes[baseOffset + OFFSET_FIRST_CHILD] = this.nextChild;
        this.nodes[baseOffset + OFFSET_NUM_CHILD] = isLeaf ? -childrenIds.length : childrenIds.length;
        this.nodes[baseOffset + OFFSET_FLAGS] = flags;

        for (var i = 0; i < childrenIds.length; i++)
            this.children[this.nextChild++] = isLeaf ? childrenIds[i] : this.getIndex(childrenIds[i]);

        if (this.nextChild > this.children.length)
            Logger.error("Child index out of bounds -- should not happen");

        this.processName(index, name);
    };

    NodeArray.prototype.processName = function (index, name) {

        //Attempt to decompose the name into a base string + integer,
        //like for example "Base Wall [12345678]" or "Crank Shaft:1"
        //We will try to reduce memory usage by storing "Base Wall" just once.
        var base;
        var suffix;

        //Try Revit style [1234] first
        var iStart = -1;
        var iEnd = -1;

        if (name) { //name should not be empty, but hey, it happens.
            iEnd = name.lastIndexOf("]");
            iStart = name.lastIndexOf("[");

            //Try Inventor style :1234
            if (iStart === -1 || iEnd === -1) {
                iStart = name.lastIndexOf(":");
                iEnd = name.length;
            }
        }

        //TODO: Any other separators? What does AutoCAD use?

        if (iStart >= 0 && iEnd > iStart) {
            base = name.slice(0, iStart + 1);
            var ssuffix = name.slice(iStart + 1, iEnd);
            suffix = parseInt(ssuffix, 10);

            //make sure we get the same thing back when
            //converting back to string, otherwise don't 
            //decompose it.
            if (!suffix || suffix + "" !== ssuffix) {
                base = name;
                suffix = 0;
            }
        } else {
            base = name;
            suffix = 0;
        }


        var idx = this.s2i[base];
        if (idx === undefined) {
            this.strings.push(base);
            idx = this.strings.length - 1;
            this.s2i[base] = idx;
        }

        this.names[index] = idx;
        this.nameSuffixes[index] = suffix;
    };


    function arrayToBuffer(a) {
        var b = new Int32Array(a.length);
        b.set(a);
        return b;
    }

    // note none of these arguments are used
    NodeArray.prototype.flatten = function (dbId, parentDbId, name, flags, childrenIds, isLeaf) {
        this.nodes = arrayToBuffer(this.nodes);
        this.children = arrayToBuffer(this.children);
        this.names = arrayToBuffer(this.names);
        this.nameSuffixes = arrayToBuffer(this.nameSuffixes);
        this.s2i = null; //we don't need this temporary map once we've built the strings list
    };

    return {
        InstanceTree: InstanceTree,
        InstanceTreeStorage: NodeArray,
        InstanceTreeAccess: InstanceTreeAccess
    }
});