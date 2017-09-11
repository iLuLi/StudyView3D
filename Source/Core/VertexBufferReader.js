define(function () {
    ;
    'use strict'
    var TAU = Math.PI * 2;

    //Constants duplicated from src/lmvtk/VertexBufferBuilder.js
    var VBB_GT_TRIANGLE_INDEXED = 0,
        VBB_GT_LINE_SEGMENT = 1,
        VBB_GT_ARC_CIRCULAR = 2,
        VBB_GT_ARC_ELLIPTICAL = 3,
        VBB_GT_TEX_QUAD = 4,
        VBB_GT_ONE_TRIANGLE = 5;

    var VBB_INSTANCED_FLAG = 0, // this is intentionally 0 for the instancing case!
        VBB_SEG_START_RIGHT = 0, // this starts intentionally at 0!
        VBB_SEG_START_LEFT = 1,
        VBB_SEG_END_RIGHT = 2,
        VBB_SEG_END_LEFT = 3;

    var VBB_COLOR_OFFSET = 6,
        VBB_DBID_OFFSET = 7,
        VBB_FLAGS_OFFSET = 8,
        VBB_LAYER_VP_OFFSET = 9;

    /**
     * Initializes a "view" into a compacted interleaved vertex buffer array using our custom 2D vertex layout.
     * See src/lmvtk/VertexBufferBuilder.js for more details.
     */
    var VertexBufferReader = function (geometry) {
        this.vb = geometry.vb.buffer;
        this.vbf = new Float32Array(this.vb);
        this.vbi = new Int32Array(this.vb);

        this.stride = geometry.vbstride;
        this.vcount = this.vbf.length / this.stride;

        this.useInstancing = false; // TODO: derive value from somewhere...
    };

    VertexBufferReader.prototype.getDbIdAt = function (vindex) {
        return this.vbi[vindex * this.stride + VBB_DBID_OFFSET];
    };

    VertexBufferReader.prototype.getVertexFlagsAt = function (vindex) {
        return this.vbi[vindex * this.stride + VBB_FLAGS_OFFSET];
    };

    VertexBufferReader.prototype.getLayerIndexAt = function (vindex) {
        return this.vbi[vindex * this.stride + VBB_LAYER_VP_OFFSET] & 0xffff;
    };

    VertexBufferReader.prototype.getViewportIndexAt = function (vindex) {
        return (this.vbi[vindex * this.stride + VBB_LAYER_VP_OFFSET] >> 16) & 0xffff;
    };

    VertexBufferReader.prototype.decodeLineAt = function (vindex, layer, vpId, callback) {
        if (!callback.onLineSegment) { return; }

        var baseOffset = this.stride * vindex;
        var x0 = this.vbf[baseOffset];
        var y0 = this.vbf[baseOffset + 1];
        var angle = this.vbf[baseOffset + 2];
        var distAlong = this.vbf[baseOffset + 3];

        var x1 = x0 + distAlong * Math.cos(angle);
        var y1 = y0 + distAlong * Math.sin(angle);

        callback.onLineSegment(x0, y0, x1, y1, vpId);
    };

    VertexBufferReader.prototype.decodeCircularArcAt = function (vindex, layer, vpId, callback) {
        if (!callback.onCircularArc) { return; }

        var baseOffset = this.stride * vindex;
        var cx = this.vbf[baseOffset];
        var cy = this.vbf[baseOffset + 1];
        var start = this.vbf[baseOffset + 2];
        var end = this.vbf[baseOffset + 3];
        var radius = this.vbf[baseOffset + 5];

        callback.onCircularArc(cx, cy, start, end, radius, vpId);
    };

    VertexBufferReader.prototype.decodeEllipticalArcAt = function (vindex, layer, vpId, callback) {
        if (!callback.onEllipticalArc) { return; }

        var baseOffset = this.stride * vindex;
        var cx = this.vbf[baseOffset];
        var cy = this.vbf[baseOffset + 1];
        var start = this.vbf[baseOffset + 2];
        var end = this.vbf[baseOffset + 3];
        var major = this.vbf[baseOffset + 5];
        var minor = this.vbf[baseOffset + 10];
        var tilt = this.vbf[baseOffset + 11];

        callback.onEllipticalArc(cx, cy, start, end, major, minor, tilt, vpId);
    };

    VertexBufferReader.prototype.decodeTriangleVertex = function (vindex, layer, vpId, callback) {
        if (!callback.onTriangleVertex) { return; }

        var baseOffset = this.stride * vindex;
        var cx = this.vbf[baseOffset];
        var cy = this.vbf[baseOffset + 1];

        callback.onTriangleVertex(cx, cy, vpId);
    };


    VertexBufferReader.prototype.enumGeomsForObject = function (dbId, callback) {
        var i = 0;
        while (i < this.vcount) {
            var flag = this.getVertexFlagsAt(i);

            //var vertexId    = (flag >>  0) & 0xff;        //  8 bit
            var geomType = (flag >> 8) & 0xff;        //  8 bit
            //var linePattern = (flag >> 16) & 0xff;        //  8 bit
            var layerId = this.getLayerIndexAt(i);    // 16 bit
            var vpId = this.getViewportIndexAt(i); // 16 bit

            if (this.getDbIdAt(i) === dbId) {
                switch (geomType) {
                    case VBB_GT_TRIANGLE_INDEXED: this.decodeTriangleVertex(i, layerId, vpId, callback); break;
                    case VBB_GT_LINE_SEGMENT: this.decodeLineAt(i, layerId, vpId, callback); break;
                    case VBB_GT_ARC_CIRCULAR: this.decodeCircularArcAt(i, layerId, vpId, callback); break;
                    case VBB_GT_ARC_ELLIPTICAL: this.decodeEllipticalArcAt(i, layerId, vpId, callback); break;
                    case VBB_GT_TEX_QUAD: break; // TODO: do we really want to snap to rasters?
                    case VBB_GT_ONE_TRIANGLE: break; // TODO: do we really want to snap to interior edges?
                    default: break;
                }
            }

            //Skip duplicate vertices (when not using instancing and the geometry is not a simple polytriangle,
            //each vertex is listed four times with a different vertexId flag
            i += (this.useInstancing || (geomType == VBB_GT_TRIANGLE_INDEXED)) ? 1 : 4;
        }

    };

    return VertexBufferReader;
});