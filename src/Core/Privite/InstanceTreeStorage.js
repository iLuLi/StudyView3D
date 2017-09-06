define([
    '../Logger'
], function(Logger) {
    'use strict';
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

    return NodeArray;
});