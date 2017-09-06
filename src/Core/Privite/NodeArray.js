define(function() {
    'use strict';
    /**
     * BVH definitions:
     *
     * BVH Node: if this was C (the only real programming language), it would go something like this,
     * but with better alignment.
     *
     * This is definition for "fat" nodes (for rasterization),
     * i.e. when inner nodes also contain primitives.
     * struct Node {                                                            byte/short/int offset
     *      float worldBox[6]; //world box of the node node                         0/0/0
     *      int leftChildIndex; //pointer to left child node (right is left+1)     24/12/6
     *      ushort primCount; //how many fragments are at this node                28/14/7
     *      ushort flags; //bitfield of good stuff                                 30/15/7.5
     *
     *      int primStart; //start of node's own primitives (fragments) list       32/16/8
     * };
     * => sizeof(Node) = 36 bytes
    
     * Definition for lean nodes (for ray casting): when a node is either inner node (just children, no primitives)
     * or leaf (just primitives, no children).
     * struct Node {
     *      float worldBox[6]; //world box of the node node
     *      union {
     *          int leftChildIndex; //pointer to left child node (right is left+1)
     *          int primStart; //start of node's own primitives (fragments) list
     *      };
     *      ushort primCount; //how many fragments are at this node
     *      ushort flags; //bitfield of good stuff
     * };
     * => sizeof(Node) = 32 bytes
     *
     * The class below encapsulates an array of such nodes using ArrayBuffer as backing store.
     *
     * @param {ArrayBuffer|number} initialData  Initial content of the NodeArray, or initial allocation of empty nodes
     * @param {boolean} useLeanNode Use minimal node structure size. Currently this parameter must be set to false.
     */
    function NodeArray(initialData, useLeanNode) {
        'use strict';

        if (useLeanNode) {
            this.bytes_per_node = 32;
        } else {
            this.bytes_per_node = 36;
        }

        var initialCount;
        var initialBuffer;

        if (initialData instanceof ArrayBuffer) {
            initialCount = initialData.byteLength / this.bytes_per_node;
            initialBuffer = initialData;
            this.nodeCount = initialCount;
        }
        else {
            initialCount = initialData | 0;
            initialBuffer = new ArrayBuffer(this.bytes_per_node * initialCount);
            this.nodeCount = 0;
        }

        this.nodeCapacity = initialCount;
        this.nodesRaw = initialBuffer;

        this.is_lean_node = useLeanNode;
        this.node_stride = this.bytes_per_node / 4;
        this.node_stride_short = this.bytes_per_node / 2;

        //Allocate memory buffer for all tree nodes
        this.nodesF = new Float32Array(this.nodesRaw);
        this.nodesI = new Int32Array(this.nodesRaw);
        this.nodesS = new Uint16Array(this.nodesRaw);
    }

    NodeArray.prototype.setLeftChild = function (nodeidx, childidx) {
        this.nodesI[nodeidx * this.node_stride + 6] = childidx;
    };
    NodeArray.prototype.getLeftChild = function (nodeidx) {
        return this.nodesI[nodeidx * this.node_stride + 6];
    };

    NodeArray.prototype.setPrimStart = function (nodeidx, start) {
        if (this.is_lean_node)
            this.nodesI[nodeidx * this.node_stride + 6] = start;
        else
            this.nodesI[nodeidx * this.node_stride + 8] = start;
    };
    NodeArray.prototype.getPrimStart = function (nodeidx) {
        if (this.is_lean_node)
            return this.nodesI[nodeidx * this.node_stride + 6];
        else
            return this.nodesI[nodeidx * this.node_stride + 8];
    };

    NodeArray.prototype.setPrimCount = function (nodeidx, count) {
        this.nodesS[nodeidx * this.node_stride_short + 14] = count;
    };
    NodeArray.prototype.getPrimCount = function (nodeidx) {
        return this.nodesS[nodeidx * this.node_stride_short + 14];
    };

    NodeArray.prototype.setFlags = function (nodeidx, axis, isFirst, isTransparent) {
        this.nodesS[nodeidx * this.node_stride_short + 15] = (isTransparent << 3) | (isFirst << 2) | (axis & 0x3);
    };
    NodeArray.prototype.getFlags = function (nodeidx) {
        return this.nodesS[nodeidx * this.node_stride_short + 15];
    };

    NodeArray.prototype.setBox0 = function (nodeidx, src) {
        var off = nodeidx * this.node_stride;
        var dst = this.nodesF;
        dst[off] = src[0];
        dst[off + 1] = src[1];
        dst[off + 2] = src[2];
        dst[off + 3] = src[3];
        dst[off + 4] = src[4];
        dst[off + 5] = src[5];
    };
    NodeArray.prototype.getBoxThree = function (nodeidx, dst) {
        var off = nodeidx * this.node_stride;
        var src = this.nodesF;
        dst.min.x = src[off];
        dst.min.y = src[off + 1];
        dst.min.z = src[off + 2];
        dst.max.x = src[off + 3];
        dst.max.y = src[off + 4];
        dst.max.z = src[off + 5];
    };
    NodeArray.prototype.setBoxThree = function (nodeidx, src) {
        var off = nodeidx * this.node_stride;
        var dst = this.nodesF;
        dst[off] = src.min.x;
        dst[off + 1] = src.min.y;
        dst[off + 2] = src.min.z;
        dst[off + 3] = src.max.x;
        dst[off + 4] = src.max.y;
        dst[off + 5] = src.max.z;
    };




    NodeArray.prototype.makeEmpty = function (nodeidx) {

        var off = nodeidx * this.node_stride;
        var dst = this.nodesI;

        //No point to makeEmpty here, because the box gets set
        //directly when the node is initialized in bvh_subdivide.
        //box_make_empty(this.nodesF, off);

        //_this.setLeftChild(nodeidx,-1);
        dst[off + 6] = -1;

        //both prim count and flags to 0
        dst[off + 7] = 0;

        //_this.setPrimStart(nodeidx, -1);
        if (!this.is_lean_node)
            dst[off + 8] = -1;

    };

    NodeArray.prototype.realloc = function (extraSize) {
        if (this.nodeCount + extraSize > this.nodeCapacity) {
            var nsz = 0 | (this.nodeCapacity * 3 / 2);
            if (nsz < this.nodeCount + extraSize)
                nsz = this.nodeCount + extraSize;

            var nnodes = new ArrayBuffer(nsz * this.bytes_per_node);
            var nnodesI = new Int32Array(nnodes);
            nnodesI.set(this.nodesI);

            this.nodeCapacity = nsz;
            this.nodesRaw = nnodes;
            this.nodesF = new Float32Array(nnodes);
            this.nodesI = nnodesI;
            this.nodesS = new Uint16Array(nnodes);
        }
    };

    NodeArray.prototype.nextNodes = function (howMany) {

        this.realloc(howMany);

        var res = this.nodeCount;
        this.nodeCount += howMany;

        for (var i = 0; i < howMany; i++) {
            this.makeEmpty(res + i);
        }

        return res;
    };

    NodeArray.prototype.getRawData = function () {
        return this.nodesRaw.slice(0, this.nodeCount * this.bytes_per_node);
    };

    return NodeArray;
});