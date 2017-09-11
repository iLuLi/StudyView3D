define(function () {
    'use strict';
    var TAU = Math.PI * 2;

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

    var QUAD_TRIANGLE_INDICES = [0, 1, 3, 0, 3, 2];

    function VertexBufferBuilder(useInstancing, allocSize) {
        var MAX_VCOUNT = allocSize || 65536;

        this.useInstancing = useInstancing;

        //TODO: Temporarily expand the stride to the full one, in order to work around new
        //more strict WebGL validation which complains when a shader addresses attributes outside
        //the vertex buffer, even when it does not actually access them. We would need separate shader
        //configurations for each of the two possible vertex strides for the selection shader, which is
        //currently shared between all 2d geometries.
        //this.stride = 10;
        this.stride = 12;

        this.vb = new ArrayBuffer(this.stride * 4 * (this.useInstancing ? MAX_VCOUNT / 4 : MAX_VCOUNT));
        this.vbf = new Float32Array(this.vb);
        this.vbi = new Int32Array(this.vb);
        this.vcount = 0;

        this.ib = this.useInstancing ? null : new Uint16Array(MAX_VCOUNT);
        this.icount = 0;

        this.minx = this.miny = Infinity;
        this.maxx = this.maxy = -Infinity;

        //Keeps track of objectIds referenced by geometry in the VB
        this.dbIds = {};

        this.numEllipticals = 0;
        this.numCirculars = 0;
        this.numTriangleGeoms = 0;
    }

    VertexBufferBuilder.prototype.expandStride = function () {
        // since we already set the stride to the current max value of 12 in the
        // constructor above, we don't need to do anything here right now...
        return;

        /*
            //Currently hardcoded to expand by 4 floats.
            var expandBy = 2;
        
            var stride = this.stride;
        
            if (stride >= 12)
                return;
        
            var nstride = this.stride + expandBy;
        
            var nvb = new ArrayBuffer(nstride * (this.vb.byteLength / stride));
        
            var src = new Uint8Array(this.vb);
            var dst = new Uint8Array(nvb);
        
            for (var i = 0, iEnd = this.vcount; i<iEnd; i++) {
                var os = i * stride * 4;
                var od = i * nstride * 4;
        
                for (var j=0; j<stride * 4; j++)
                    dst[od+j] = src[os+j];
            }
        
            this.vb = nvb;
            this.vbf = new Float32Array(nvb);
            this.vbi = new Int32Array(nvb);
            this.stride = nstride;
        */
    };

    VertexBufferBuilder.prototype.addToBounds = function (x, y) {
        if (x < this.minx) this.minx = x;
        if (x > this.maxx) this.maxx = x;
        if (y < this.miny) this.miny = y;
        if (y > this.maxy) this.maxy = y;
    };

    VertexBufferBuilder.prototype.setCommonVertexAttribs = function (offset, vertexId, geomType, color, dbId, layerId, vpId, linePattern) {
        // align changes here with the "decodeCommonAttribs()" function in LineShader.js and VertexBufferReader.js!!!
        vertexId = (vertexId & 0xff); //  8 bit
        geomType = (geomType & 0xff); //  8 bit
        linePattern = (linePattern & 0xff); //  8 bit
        layerId = (layerId & 0xffff); // 16 bit
        vpId = (vpId & 0xffff); // 16 bit

        this.vbi[offset + VBB_FLAGS_OFFSET] = vertexId | (geomType << 8) | (linePattern << 16); // vertexId: int8; geomType: int8; linePattern: int8; unused: int8
        this.vbi[offset + VBB_COLOR_OFFSET] = color;
        this.vbi[offset + VBB_DBID_OFFSET] = dbId;
        this.vbi[offset + VBB_LAYER_VP_OFFSET] = layerId | (vpId << 16); // layerId: int16; vpId: int16

        this.dbIds[dbId] = 1; // mark this feature as used
    }

    //Creates a non-indexed triangle geometry vertex (triangle vertex coords stored in single vertex structure)
    VertexBufferBuilder.prototype.addVertexTriangleGeom = function (x1, y1, x2, y2, x3, y3, color, dbId, layerId, vpId) {
        var vi = this.vcount;
        var vbf = this.vbf;

        var repeat = this.useInstancing ? 1 : 4;
        for (var i = 0; i < repeat; i++) {
            var offset = (vi + i) * this.stride;

            // align changes here with the "decodeTriangleData()" function in LineShader.js!!!
            vbf[offset] = x1;
            vbf[offset + 1] = y1;
            vbf[offset + 2] = x2;

            vbf[offset + 3] = y2;
            vbf[offset + 4] = x3;
            vbf[offset + 5] = y3;

            this.setCommonVertexAttribs(offset, VBB_SEG_START_RIGHT + i, VBB_GT_ONE_TRIANGLE, color, dbId, layerId, vpId, /*linePattern*/0);
            this.vcount++;
        }

        return vi;
    };


    VertexBufferBuilder.prototype.addVertexLine = function (x, y, angle, distanceAlong, totalDistance, lineWidth, color, dbId, layerId, vpId, lineType) {
        var vi = this.vcount;
        var vbf = this.vbf;

        var repeat = this.useInstancing ? 1 : 4;
        for (var i = 0; i < repeat; i++) {
            var offset = (vi + i) * this.stride;

            // align changes here with the "decodeSegmentData()" function in LineShader.js!!!
            vbf[offset] = x;
            vbf[offset + 1] = y;
            vbf[offset + 2] = angle;

            vbf[offset + 3] = distanceAlong;
            vbf[offset + 4] = lineWidth * 0.5; // we are storing only the half width (i.e., the radius)
            vbf[offset + 5] = totalDistance;

            this.setCommonVertexAttribs(offset, VBB_SEG_START_RIGHT + i, VBB_GT_LINE_SEGMENT, color, dbId, layerId, vpId, lineType);
            this.vcount++;
        }

        return vi;
    };

    VertexBufferBuilder.prototype.addVertexTexQuad = function (centerX, centerY, width, height, rotation, color, dbId, layerId, vpId) {
        var vi = this.vcount;
        var vbf = this.vbf;

        var repeat = this.useInstancing ? 1 : 4;
        for (var i = 0; i < repeat; i++) {
            var offset = (vi + i) * this.stride;

            // align changes here with the "decodeTexQuadData()" function in LineShader.js!!!
            vbf[offset] = centerX;
            vbf[offset + 1] = centerY;
            vbf[offset + 2] = rotation;

            vbf[offset + 3] = width;
            vbf[offset + 4] = height;

            this.setCommonVertexAttribs(offset, VBB_SEG_START_RIGHT + i, VBB_GT_TEX_QUAD, color, dbId, layerId, vpId, /*linePattern*/0);
            this.vcount++;
        }

        return vi;
    };


    VertexBufferBuilder.prototype.addVertexArc = function (x, y, startAngle, endAngle, major, minor, tilt, lineWidth, color, dbId, layerId, vpId) {
        var vi = this.vcount;
        var vbf = this.vbf;

        var geomType = (major == minor) ? VBB_GT_ARC_CIRCULAR : VBB_GT_ARC_ELLIPTICAL;

        var repeat = this.useInstancing ? 1 : 4;
        for (var i = 0; i < repeat; i++) {
            var offset = (vi + i) * this.stride;

            // align changes here with the "decodeArcData()" function in LineShader.js!!!
            vbf[offset] = x;
            vbf[offset + 1] = y;
            vbf[offset + 2] = startAngle;

            vbf[offset + 3] = endAngle;
            vbf[offset + 4] = lineWidth * 0.5; // we are storing only the half width (i.e., the radius)
            vbf[offset + 5] = major; // = radius for circular arcs

            if (geomType === VBB_GT_ARC_ELLIPTICAL) {
                vbf[offset + 10] = minor;
                vbf[offset + 11] = tilt;
            }

            this.setCommonVertexAttribs(offset, VBB_SEG_START_RIGHT + i, geomType, color, dbId, layerId, vpId, /*linePattern*/0);
            this.vcount++;
        }

        return vi;
    };




    //====================================================================================================
    //====================================================================================================
    // Indexed triangle code path can only be used when hardware instancing is not in use.
    // Otherwise, the addTriangleGeom operation should be used to add simple triangles to the buffer.
    //====================================================================================================
    //====================================================================================================

    VertexBufferBuilder.prototype.addVertex = function (x, y, color, dbId, layerId, vpId) {
        if (this.useInstancing)
            return;//not supported if instancing is used.

        var vi = this.vcount;
        var offset = this.stride * vi;
        var vbf = this.vbf;

        // align changes here with the "decodeTriangleData()" function in LineShader.js!!!
        vbf[offset] = x;
        vbf[offset + 1] = y;

        this.setCommonVertexAttribs(offset, /*vertexId*/0, VBB_GT_TRIANGLE_INDEXED, color, dbId, layerId, vpId, /*linePattern*/0);
        this.vcount++;

        return vi;
    };


    VertexBufferBuilder.prototype.addVertexPolytriangle = function (x, y, color, dbId, layerId, vpId) {
        if (this.useInstancing)
            return;//not supported if instancing is used.

        this.addVertex(x, y, color, dbId, layerId, vpId);

        this.addToBounds(x, y);
    };

    VertexBufferBuilder.prototype.addIndices = function (indices, vindex) {

        if (this.useInstancing)
            return; //not supported if instancing is used.

        var ib = this.ib;
        var ii = this.icount;

        if (ii + indices.length >= ib.length) {
            var ibnew = new Uint16Array(ib.length * 2);
            for (var i = 0; i < ii; ++i) {
                ibnew[i] = ib[i];
            }
            this.ib = ib = ibnew;
        }

        for (var i = 0; i < indices.length; ++i) {
            ib[ii + i] = vindex + indices[i];
        }

        this.icount += indices.length;
    };

    //====================================================================================================
    //====================================================================================================
    // End indexed triangle code path.
    //====================================================================================================
    //====================================================================================================


    VertexBufferBuilder.prototype.finalizeQuad = function (vindex) {
        if (!this.useInstancing) {
            this.addIndices(QUAD_TRIANGLE_INDICES, vindex);
        }
    };


    VertexBufferBuilder.prototype.addSegment = function (x1, y1, x2, y2, totalDistance, lineWidth, color, dbId, layerId, vpId, lineType) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var angle = (dx || dy) ? Math.atan2(dy, dx) : 0.0;
        var segLen = (dx || dy) ? Math.sqrt(dx * dx + dy * dy) : 0.0;

        //Add four vertices for the bbox of this line segment
        //This call sets the stuff that's common for all four
        var v = this.addVertexLine(x1, y1, angle, segLen, totalDistance, lineWidth, color, dbId, layerId, vpId, lineType);

        this.finalizeQuad(v);
        this.addToBounds(x1, y1);
        this.addToBounds(x2, y2);
    };


    //Creates a non-indexed triangle geometry (triangle vertex coords stored in single vertex structure)
    VertexBufferBuilder.prototype.addTriangleGeom = function (x1, y1, x2, y2, x3, y3, color, dbId, layerId, vpId) {
        this.numTriangleGeoms++;

        var v = this.addVertexTriangleGeom(x1, y1, x2, y2, x3, y3, color, dbId, layerId, vpId);

        this.finalizeQuad(v);
        this.addToBounds(x1, y1);
        this.addToBounds(x2, y2);
        this.addToBounds(x3, y3);
    };

    VertexBufferBuilder.prototype.addArc = function (cx, cy, start, end, major, minor, tilt, lineWidth, color, dbId, layerId, vpId) {
        if (major == minor) {
            this.numCirculars++;
        } else {
            this.numEllipticals++;
        }

        // This is a workaround, when the circular arc has rotation, the extractor cannot handle it.
        // After the fix is deployed in extractor, this can be removed.
        var result = fixUglyArc(start, end);
        start = result.start;
        end = result.end;

        //If both start and end angles are exactly 0, it's a complete ellipse/circle
        //This is working around a bug in the F2D writer, where an fmod operation will potentially.
        //convert 2pi to 0.
        if (start == 0 && end == 0)
            end = TAU;

        //Add two zero length segments as round caps at the end points
        {
            //If it's a full ellipse, then we don't need caps
            var range = Math.abs(start - end);
            if (range > 0.0001 && Math.abs(range - TAU) > 0.0001) {
                var sx = cx + major * Math.cos(start);
                var sy = cy + minor * Math.sin(start);
                this.addSegment(sx, sy, sx, sy, 0, lineWidth, color, dbId, layerId, vpId);

                var ex = cx + major * Math.cos(end);
                var ey = cy + minor * Math.sin(end);
                this.addSegment(ex, ey, ex, ey, 0, lineWidth, color, dbId, layerId, vpId);

                //TODO: also must add all the vertices at all multiples of PI/2 in the start-end range to get exact bounds
            }
            else {
                this.addToBounds(cx - major, cy - minor);
                this.addToBounds(cx + major, cy + minor);
            }
        }

        var v = this.addVertexArc(cx, cy, start, end, major, minor, tilt, lineWidth, color, dbId, layerId, vpId);

        this.finalizeQuad(v);

        //Testing caps
        if (false) {
            //If it's a full ellipse, then we don't need caps
            var range = Math.abs(start - end);
            if (Math.abs(range - TAU) > 0.0001) {
                var sx = cx + major * Math.cos(start);
                var sy = cy + minor * Math.sin(start);
                this.addSegment(sx, sy, sx, sy, 0, lineWidth, 0xff00ffff, dbId, layerId, vpId);

                var ex = cx + major * Math.cos(end);
                var ey = cy + minor * Math.sin(end);
                this.addSegment(ex, ey, ex, ey, 0, lineWidth, 0xff00ffff, dbId, layerId, vpId);
            }
        }
    }


    VertexBufferBuilder.prototype.addTexturedQuad = function (centerX, centerY, width, height, rotation, color, dbId, layerId, vpId) {
        //Height is specified using the line weight field.
        //This will result in height being clamped to at least one pixel
        //but that's ok (zero height for an image would be rare).
        var v = this.addVertexTexQuad(centerX, centerY, width, height, rotation, color, dbId, layerId, vpId);

        this.finalizeQuad(v);

        var cos = 0.5 * Math.cos(rotation);
        var sin = 0.5 * Math.sin(rotation);
        var w = Math.abs(width * cos) + Math.abs(height * sin);
        var h = Math.abs(width * sin) + Math.abs(height * cos);
        this.addToBounds(centerX - w, centerY - h);
        this.addToBounds(centerX + w, centerY + h);
    };

    VertexBufferBuilder.prototype.isFull = function (addCount) {
        addCount = addCount || 3;
        var mult = this.useInstancing ? 4 : 1;

        return (this.vcount * mult + addCount > 32767);
    };

    VertexBufferBuilder.prototype.toMesh = function () {
        var mesh = {};

        mesh.vb = new Float32Array(this.vb.slice(0, this.vcount * this.stride * 4));
        mesh.vbstride = this.stride;

        var d = this.useInstancing ? 1 : 0;

        mesh.vblayout = {
            "fields1": { offset: 0, itemSize: 3, bytesPerItem: 4, divisor: d, normalize: false },
            "fields2": { offset: 3, itemSize: 3, bytesPerItem: 4, divisor: d, normalize: false },
            "color4b": { offset: VBB_COLOR_OFFSET, itemSize: 4, bytesPerItem: 1, divisor: d, normalize: true },
            "dbId4b": { offset: VBB_DBID_OFFSET, itemSize: 4, bytesPerItem: 1, divisor: d, normalize: false },
            "flags4b": { offset: VBB_FLAGS_OFFSET, itemSize: 4, bytesPerItem: 1, divisor: d, normalize: false },
            "layerVp4b": { offset: VBB_LAYER_VP_OFFSET, itemSize: 4, bytesPerItem: 1, divisor: d, normalize: false }
        };

        //Are we using an expanded vertex layout -- then add the extra attribute to the layout
        if (this.stride > 10) {
            mesh.vblayout["extraParams"] = { offset: 10, itemSize: 2, bytesPerItem: 4, divisor: d, normalize: false };
        }

        if (this.useInstancing) {
            mesh.numInstances = this.vcount;

            //Set up trivial vertexId and index attributes

            var instFlags = new Int32Array([VBB_SEG_START_RIGHT, VBB_SEG_START_LEFT, VBB_SEG_END_RIGHT, VBB_SEG_END_LEFT]);
            mesh.vblayout.instFlags4b = { offset: 0, itemSize: 4, bytesPerItem: 1, divisor: 0, normalize: false };
            mesh.vblayout.instFlags4b.array = instFlags.buffer;

            var idx = mesh.indices = new Uint16Array(QUAD_TRIANGLE_INDICES);
        } else {
            mesh.indices = new Uint16Array(this.ib.buffer.slice(0, 2 * this.icount));
        }

        mesh.dbIds = this.dbIds;

        var w = this.maxx - this.minx;
        var h = this.maxy - this.miny;
        var sz = Math.max(w, h);

        mesh.boundingBox = {
            min: { x: this.minx, y: this.miny, z: -sz * 1e-3 },
            max: { x: this.maxx, y: this.maxy, z: sz * 1e-3 }
        };

        //Also compute a rough bounding sphere
        var bs = mesh.boundingSphere = {
            center: {
                x: 0.5 * (this.minx + this.maxx),
                y: 0.5 * (this.miny + this.maxy),
                z: 0.0
            },
            radius: 0.5 * Math.sqrt(w * w + h * h)
        };

        return mesh;
    };

    // The following logic attempts to "fix" imprecisions in arc definitions introduced
    // by Heidi's fixed point math, in case that the extractor doesn't handle it correctly.

    var fixUglyArc = function (start, end) {
        //Snap critical angles exactly
        function snapCritical() {
            function fuzzyEquals(a, b) { return (Math.abs(a - b) < 1e-3); }

            if (fuzzyEquals(start, 0)) start = 0.0;
            if (fuzzyEquals(end, 0)) end = 0.0;
            if (fuzzyEquals(start, TAU)) start = TAU;
            if (fuzzyEquals(end, TAU)) end = TAU;
        }

        snapCritical();

        //OK, in some cases the angles are both over-rotated...
        if (start > end) {
            while (start > TAU) {
                start -= TAU;
                end -= TAU;
            }
        } else {
            while (end > TAU) {
                start -= TAU;
                end -= TAU;
            }
        }

        //Snap critical angles exactly -- again
        snapCritical();

        //If the arc crosses the x axis, we have to make it clockwise...
        //This is a side effect of bringing over-rotated arcs in range above.
        //For example start = 5.0, end = 7.0 will result in start < 0 and end > 0,
        //so we have to make start > end in order to indicate we are crossing angle = 0.
        if (start < 0 && end > 0) {
            start += TAU;
        }

        return { start: start, end: end };
    };

    return VertexBufferBuilder;
});