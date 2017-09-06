define(['./Chunks/IdOutputShaderChunk'], function(IdOutputShaderChunk) {;
    'use strict'
    var COMMON_DEFINES = [
        "#define TAU     6.28318530718",
        "#define PI      3.14159265358979",
        "#define HALF_PI 1.57079632679",

        "#define PI_0_5  HALF_PI",       // 0.5 * PI
        "#define PI_1_5  4.71238898038", // 1.5 * PI

        // discard fragments if they belong to ghosted layers
        "#define ENABLE_ID_DISCARD"
    ].join('\n');

    var GEOMETRY_TYPES_DEFINES = [
        "#define VBB_GT_TRIANGLE_INDEXED  0.0",
        "#define VBB_GT_LINE_SEGMENT      1.0",
        "#define VBB_GT_ARC_CIRCULAR      2.0",
        "#define VBB_GT_ARC_ELLIPTICAL    3.0",
        "#define VBB_GT_TEX_QUAD          4.0",
        "#define VBB_GT_ONE_TRIANGLE      5.0"
    ].join('\n');

    var VERTEX_ID_DEFINES = [
        "#define VBB_INSTANCED_FLAG   0.0",
        "#define VBB_SEG_START_RIGHT  0.0",
        "#define VBB_SEG_START_LEFT   1.0",
        "#define VBB_SEG_END_RIGHT    2.0",
        "#define VBB_SEG_END_LEFT     3.0"
    ].join('\n');

    // pass these attributes from the VS to the FS
    var VARYINGS = [
        "varying vec4 fsColor;",
        "varying vec4 dbId;", // this name is required by avs.IdOutputShaderChunk

        "varying vec2 fsOffsetDirection;",
        "varying vec4 fsMultipurpose;",

        //"varying float fsGeomType;",
        "varying float fsHalfWidth;",

        "varying vec2 fsVpTC;",
        "varying vec2 fsLayerTC;",
    ].join('\n');

    var LineShader = {

        uniforms: {

            "pixelsPerUnit": { type: "f", value: 1.0 },
            "aaRange": { type: "f", value: 0.5 }, //aaRange = 0.5/pixelsPerUnit
            "tLayerMask": { type: "t", value: null },
            "tLineStyle": { type: "t", value: null },
            "vLineStyleTexSize": { type: "v2", value: new THREE.Vector2(13, 70) },
            "tRaster": { type: "t", value: null },
            "tSelectionTexture": { type: "t", value: null },
            "vSelTexSize": { type: "v2", value: new THREE.Vector2(4096, 1) },
            "displayPixelRatio": { type: "f", value: 1.0 },
            "opacity": { type: "f", value: 1.0 },
            "selectionColor": { type: "v4", value: new THREE.Vector4(0, 0, 1, 1) },
            "modelId": { type: "v3", value: new THREE.Vector3(0, 0, 0) },
            "viewportId": { type: "f", value: 0.0 },    // the viewport id of the first selection in measure
            "swap": { type: "f", value: 0.0 },    // whether to swap black and white colors
            // objects in this layer are ghosted and non-selectable. This value must be consistent with the
            // GhostingLayer constant in FragmentList.js
            "ghostingLayer": { type: "v2", value: new THREE.Vector2(1, 1) }

            //This is handled as special case by the renderer, like all other camera matrices
            //since it's shared between material instances
            //"mvpMatrix" : {type: "m4", value: new THREE.Matrix4() }
        },

        attributes: {
            "fields1": 0,
            "fields2": 0,
            "color4b": 0,
            "dbId4b": 0,
            "flags4b": 0,
            "layerVp4b": 0,
            "extraParams": 0,
            "instFlags4b": 0
        },

        defines: {
            //"MRT_ID_BUFFER":      1,
            //"ID_COLOR":           1,
            //"SELECTION_RENDERER": 1,
            //"HAS_RASTER_QUADS":   1,
            //"HAS_ELLIPTICALS":    1,
            //"HAS_CIRCLES":        1,
            //"HAS_TRIANGLE_GEOMS": 1,
            //"USE_INSTANCING":     1
        },

        vertexShader: [
/*
Precision and extensions headers added by FrieflyWebGLProgram
Might be good to convert this to RawShader at some point.
 */

            COMMON_DEFINES,
            GEOMETRY_TYPES_DEFINES,
            VERTEX_ID_DEFINES,

            VARYINGS,

            "attribute vec3 fields1;",
            "attribute vec3 fields2;",
            "attribute vec4 color4b;",
            "attribute vec4 dbId4b;",
            "attribute vec4 flags4b;",
            "attribute vec4 layerVp4b;",

        "#ifdef HAS_ELLIPTICALS",
            "attribute vec3 extraParams;",
        "#endif",

        "#ifdef USE_INSTANCING",
            "attribute vec4 instFlags4b;",
        "#endif",

            "uniform mat4 mvpMatrix;",

            "uniform float pixelsPerUnit;",
            "uniform float aaRange;",
            "uniform float viewportId;",
            "uniform float swap;",
            "uniform vec2  ghostingLayer;",

            //The layer and object selection mask textures
            //can be sampled in the vertex shader since they only vary per geometry.
            //So far we have not encountered a device that fails
            //on this, but if we do, we may have to move those to the fragment shader.
        "#ifdef HAS_LAYERS",
            "uniform sampler2D tLayerMask;",
        "#endif",

        "#ifdef SELECTION_RENDERER",
            "uniform sampler2D tSelectionTexture;",
            "uniform vec2 vSelTexSize;",
        "#endif",

        "#ifdef SELECTION_RENDERER",
            "uniform vec4 selectionColor;",
        "#endif",

            // used internally by the VS
            "vec2 centralVertex;",
            "vec2 offsetPosition;",

            "vec2 cos_sin(const float angle) { return vec2(cos(angle), sin(angle)); }",

            "void min_max(inout vec2 minPt, inout vec2 maxPt, const vec2 p) {",
                "minPt = min(minPt, p);",
                "maxPt = max(maxPt, p);",
            "}",

        "#if defined(USE_INSTANCING)",
            "float getVertexId() { return instFlags4b.x; }",
        "#else", // defined(USE_INSTANCING)",
            "float getVertexId() { return flags4b.x; }",
        "#endif", // defined(USE_INSTANCING)",

            "bool isStartVertex() { return (getVertexId() < VBB_SEG_END_RIGHT); }",
            "bool isLeftVertex()  { float id = getVertexId(); return ((id == VBB_SEG_END_LEFT || id == VBB_SEG_START_LEFT)); }",

            "struct SegmentData { float angle, distAlong, distTotal, lineWidthHalf, lineType; };",
            "void decodeSegmentData(out SegmentData seg) {",
                "seg.angle         = fields1.z;",
                "seg.distAlong     = fields2.x;",
                "seg.distTotal     = fields2.z;",
                "seg.lineWidthHalf = fields2.y;",
                "seg.lineType      = flags4b.z;",
            "}",

            "void strokeLineSegment() {",
                "SegmentData seg; decodeSegmentData(seg);",

                "float isStartCapVertex = isStartVertex() ? -1.0 :  1.0;",
                "float isLeftSide       = isLeftVertex( ) ?  1.0 : -1.0;",

                //Apply transverse line width offset
                "float angleTransverse = seg.angle + isLeftSide * HALF_PI;",
                "float lwAdjustment = fsHalfWidth + aaRange;",
                "vec2 transverseOffset = cos_sin(angleTransverse) * lwAdjustment;",
                "offsetPosition.xy += transverseOffset;",

                //Compute end point based on start point plus segment length and direction
                //This is because the line segment's 4 vertices are all equal to the start
                //point to begin with. Note for the start point, we just move by 0, to avoid doing an if().
                "float distanceFromStart = max(isStartCapVertex, 0.0) * seg.distAlong;",
                "vec2 along = distanceFromStart * cos_sin(seg.angle);",
                "offsetPosition.xy += along;",
                "centralVertex.xy  += along;",

                //Apply start/end-cap extension offsets if needed
                "vec2 moveOffset = isStartCapVertex * isLeftSide * vec2(-transverseOffset.y, transverseOffset.x);",
                "offsetPosition.xy -= moveOffset;",
                "centralVertex.xy  -= moveOffset;",

                //Distance we care about beyond the actual line segment vertex.
                //For start vertex, this is negative and equal to half a line weight
                //For end vertex this is the segment length plus the half line weight adjustment.
                "fsMultipurpose.x = (isStartCapVertex * lwAdjustment) + distanceFromStart;", //distance after end point that we want to fill with cap/join
                "fsMultipurpose.y = seg.distAlong;",
                "fsMultipurpose.z = seg.distTotal;",
                "fsMultipurpose.w = seg.lineType;",

                "if (seg.lineWidthHalf < 0.0)",
                    "fsHalfWidth = -fsHalfWidth;",
            "}",


        "#ifdef HAS_TRIANGLE_GEOMS",
            "struct TriangleData { vec2 p0, p1, p2; };",
            "void decodeTriangleData(out TriangleData tri) {",
                "// tri.p0 = fields1.xy; // not used in shader...",
                "tri.p1 = vec2(fields1.z, fields2.x);",
                "tri.p2 = fields2.yz;",
            "}",

            "void strokeOneTriangle() {",
                "TriangleData tri; decodeTriangleData(tri);",

                // Note, that a degenerated triangle is created for the
                // second triangle of the instancing quad. But that is
                // exactly what we want, since we have just a single
                // triangle!

                //this is already done at the beginning of main()
                //so we skip it here
                //"offsetPosition.xy = tri.p0;",

                "float vertexId = getVertexId();",
                "if      (vertexId == VBB_SEG_END_RIGHT) offsetPosition.xy = tri.p1;",
                "else if (vertexId == VBB_SEG_END_LEFT)  offsetPosition.xy = tri.p2;",
            "}",
        "#endif",


            //The vertex format used for quads is specifying the center of the quad,
            //a rotation angle and the overall size of the quad (width, height).
        "#ifdef HAS_RASTER_QUADS",
            "struct TexQuadData { float angle; vec2 size; };",
            "void decodeTexQuadData(out TexQuadData quad) {",
                "quad.angle     = fields1.z;",
                "quad.size   = fields2.xy;",
            "}",

            "void strokeTexQuad() {",
                "TexQuadData quad; decodeTexQuadData(quad);",

                "vec2 corner = vec2(isLeftVertex() ? -1.0 : 1.0, isStartVertex() ? -1.0 : 1.0);",

                "vec2 p      = 0.5 * corner * quad.size;",
                "vec2 rot    = cos_sin(quad.angle);",
                "vec2 offset = vec2(p.x * rot.x - p.y * rot.y, p.x * rot.y + p.y * rot.x);",

                "offsetPosition.xy += offset;",

                "fsMultipurpose.xy = max(vec2(0.0), corner);",  // tex coords xy

                //Mark as polytriangle for the fragment shader
                "fsMultipurpose.z = 1.0;",
                "fsHalfWidth = 0.0;",
            "}",
        "#endif", //HAS_RASTER_QUADS

        "#if defined(HAS_CIRCLES) || defined(HAS_ELLIPTICALS)",
            "struct ArcData { vec2 c; float start, end, major, minor, tilt; };",
            "void decodeArcData(out ArcData arc) {",
                "arc.c     = fields1.xy;",
                "arc.start = fields1.z;",
                "arc.end   = fields2.x;",
                "arc.major = fields2.z;",
            "#if defined(HAS_ELLIPTICALS)",
                "arc.minor = extraParams.x;",
                "arc.tilt  = extraParams.y;",
            "#endif // defined(HAS_ELLIPTICALS)",
            "}",

            "void strokeArc(const ArcData arc) {",
                //TODO: rotation/tilt

                "float isStart = isStartVertex() ? -1.0 : 1.0;",
                "float isLeft  = isLeftVertex()  ? -1.0 : 1.0;",

                //Compute a tighter bounding quad for arcs if possible,
                //to avoid massive overdraw in case of very small angular range

                "vec2 minPt;",
                "vec2 maxPt;",

                "vec2 angles = vec2(arc.start, arc.end);",
                "vec2 endsX = vec2(arc.c.x) + arc.major * cos(angles);",
                "vec2 endsY = vec2(arc.c.y) + arc.minor * sin(angles);",
                "minPt = maxPt = vec2(endsX.x, endsY.x);",
                "min_max(minPt, maxPt, vec2(endsX.y, endsY.y));",

                "if (arc.end > arc.start) {",
                    "if (arc.start < PI_0_5 && arc.end > PI_0_5) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x, arc.c.y + arc.minor));",
                    "}",
                    "if (arc.start < PI && arc.end > PI) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x - arc.major, arc.c.y));",
                    "}",
                    "if (arc.start < PI_1_5 && arc.end > PI_1_5) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x, arc.c.y - arc.minor));",
                    "}",
                "} else {",
                    //In this case, CW arcs, we know it passes through angle 0:
                    "min_max(minPt, maxPt, vec2(arc.c.x + arc.major, arc.c.y));",

                    //All other checks are also reversed
                    //TODO: verify this logic -- it might be overestimating
                    "if (arc.start < PI_0_5 || arc.end > PI_0_5) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x, arc.c.y + arc.minor));",
                    "}",
                    "if (arc.start < PI || arc.end > PI) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x - arc.major, arc.c.y));",
                    "}",
                    "if (arc.start < PI_1_5 || arc.end > PI_1_5) {",
                        "min_max(minPt, maxPt, vec2(arc.c.x, arc.c.y - arc.minor));",
                    "}",
                "}",

                "minPt -= fsHalfWidth + aaRange;",
                "maxPt += fsHalfWidth + aaRange;",

                "offsetPosition.x = (isStart < 0.0) ? minPt.x : maxPt.x;",
                "offsetPosition.y = (isLeft < 0.0)  ? minPt.y : maxPt.y;",

                //Whole box code path (slow, used for debugging)
                //"vec2 offset = vec2((major + fsHalfWidth + aaRange) * isStart, (minor + fsHalfWidth + aaRange) * isLeft);",
                //"offsetPosition.xy += offset;",

                "fsMultipurpose.x = arc.start;",
                "fsMultipurpose.y = -arc.major;",
                "fsMultipurpose.z = arc.end;",
                "fsMultipurpose.w = arc.minor;",
            "}",
        "#endif // defined(HAS_CIRCLES) || defined(HAS_ELLIPTICALS)",

        "#if defined(HAS_CIRCLES)",

            "void strokeCircularArc() {",
                "ArcData arc; decodeArcData(arc);",

                "float r = arc.major;",
                "if (r * pixelsPerUnit < 0.125)",
                    "r = 0.25 * aaRange;",
                "arc.major = arc.minor = r;",

                "strokeArc(arc);",
            "}",

        "#endif", // defined(HAS_CIRCLES)

        "#if defined(HAS_ELLIPTICALS)",
            "void strokeEllipticalArc() {",
                "ArcData arc; decodeArcData(arc);",
                "strokeArc(arc);",
            "}",
        "#endif", // defined(HAS_ELLIPTICALS)

        "struct CommonAttribs { vec2 pos; vec4 color; vec2 layerTC, vpTC; float lineWidthHalf, geomType; };",
        "void decodeCommonAttribs(out CommonAttribs attribs) {",
            "attribs.pos           = fields1.xy;",
            "attribs.color         = color4b;",
            "attribs.geomType      = flags4b.y;",
            "attribs.layerTC       = layerVp4b.xy / 255.0;",
            "attribs.vpTC          = layerVp4b.zw / 255.0;",
            "attribs.lineWidthHalf = fields2.y;",
        "}",

        "void strokeIndexedTriangle() {",
            // nothing to go, since "centralVertex = attribs.pos" already happened in main()...
            "fsHalfWidth = 0.0;",
            "fsMultipurpose.z = 0.0;",
        "}",

        "#ifdef SELECTION_RENDERER",
            "bool isSelected(const CommonAttribs attribs) {",
                //This math assumes that vSelTexSize.x = 4096 (byte and a half) for easy computation.

                "vec3 oid = dbId4b.rgb;",

                //A byte and a half for the horizontal coord
                "float id01 = oid.r + oid.g * 256.0;",
                "float t = (id01 + 0.5) * (1.0 / 4096.0);",
                "float flrt = floor(t);",
                "float texU = t - flrt;",

                //A byte and a half for the vertical coord
                "float id23 = oid.b * (65536.0 / 4096.0) + flrt;",
                "t = (id23 + 0.5) / vSelTexSize.y;",
                "float texV = fract(t);",

                "vec4 selBit = texture2D(tSelectionTexture, vec2(texU, texV));",
                "return selBit.r == 1.0;",
            "}",
        "#endif", //SELECTION_RENDERER

            "bool isLayerOff(const CommonAttribs attribs) {",
        "#ifdef HAS_LAYERS",
                "vec4 layerBit = texture2D(tLayerMask, attribs.layerTC);",
                "return (layerBit.r == 0.0 && attribs.layerTC!=ghostingLayer);",
        "#else",
                "return false;",
        "#endif",
            "}",

            "vec4 getColor(const CommonAttribs attribs) {",
                //Check layer visibility
                "if (isLayerOff(attribs)) { return vec4(0.0); }",

        "#ifdef SELECTION_RENDERER",
                "if (isSelected(attribs)) { return selectionColor; }", //Item is selected -- draw it with selection highlight color
                "return vec4(0.0);", //Item is not selected -- hide it
        "#else", // SELECTION_RENDERER
                "return attribs.color;",
        "#endif", // SELECTION_RENDERER
            "}",

            "void main() {",
                "CommonAttribs attribs; decodeCommonAttribs(attribs);",

                "fsColor = getColor(attribs);",
                // LMV-1133: Add AutoCAD-like display functionality, swapping black and white line and fill elements.
                "if (swap != 0.0 ) {",
                    // if black, go to white
                    "if ( fsColor.r == 0.0 && fsColor.g == 0.0 && fsColor.b == 0.0 )",
                        "fsColor.rgb = vec3(1.0,1.0,1.0);",
                    // if white, go to black
                    "else if ( fsColor.r == 1.0 && fsColor.g == 1.0 && fsColor.b == 1.0 )",
                        "fsColor.rgb = vec3(0.0,0.0,0.0);",
                "}",

                //[TS] Collpasing of vertices into degenerate quads commented out
                //because it does not work on iPhone 6 and 6+ (and only those). 
                //Somehow sampling the layer texture in isLayerOff confuses the logic here.
                /*
                "if(fsColor.a == 0.0) {",
                    // If the feature is fully transparent collapse all
                    // the vertices of it into a single degenerated one.
                    // This avoids rasterization of the whole feature.
                    "gl_Position = vec4(0.0);",
                    "return;",
                "}",
                */

                "centralVertex = offsetPosition = attribs.pos;",

                "float lineWeight = attribs.lineWidthHalf;",
                "if (lineWeight > 0.0) {",
                    //Do not go below a line width of one pixel
                    //Since we store, half-widths, the comparison is to 0.5 instead of 1.0
                    "if(lineWeight < 0.5 / pixelsPerUnit) {",
                        "lineWeight = 0.5 / pixelsPerUnit;",
                    "}",
                "}",
                "else {",
                    //Negative line weight means device space (pixel) width.
                    //Currently used for antialiasing of polygon outlines.
                    "lineWeight = abs(lineWeight) / pixelsPerUnit;",
                "}",

                "fsHalfWidth = lineWeight;",

                "dbId = dbId4b / 255.0;", // normalize for using it as a color

                "fsVpTC    = attribs.vpTC;",
                "fsLayerTC = attribs.layerTC;",

                "if      (attribs.geomType == VBB_GT_LINE_SEGMENT)     strokeLineSegment();",
            "#ifdef HAS_CIRCLES",
                "else if (attribs.geomType == VBB_GT_ARC_CIRCULAR)     strokeCircularArc();",
            "#endif",
            "#ifdef HAS_ELLIPTICALS",
                "else if (attribs.geomType == VBB_GT_ARC_ELLIPTICAL)   strokeEllipticalArc();",
            "#endif",
            "#ifdef HAS_RASTER_QUADS",
                "else if (attribs.geomType == VBB_GT_TEX_QUAD)         strokeTexQuad();",
            "#endif",
            "#ifdef HAS_TRIANGLE_GEOMS",
                "else if (attribs.geomType == VBB_GT_ONE_TRIANGLE)     strokeOneTriangle();",
            "#endif",
                "else if (attribs.geomType == VBB_GT_TRIANGLE_INDEXED) strokeIndexedTriangle();",

                //"fsGeomType = attribs.geomType;",

                "fsOffsetDirection = offsetPosition - centralVertex;",

                //Now apply MVP matrix
                "gl_Position = mvpMatrix * modelMatrix * vec4( offsetPosition.xy, 0.0, 1.0 );",
            "}"

        ].join("\n"),

        fragmentShader: [

/*
Precision and extensions headers added by FrieflyWebGLProgram
Might be good to convert this to RawShader at some point.
 */

            COMMON_DEFINES,
            GEOMETRY_TYPES_DEFINES,
            VERTEX_ID_DEFINES,

            VARYINGS,

            "uniform highp float pixelsPerUnit;",
            "uniform highp float aaRange;",
            //"float aaRange = 0.5 * unitsPerPixel;",
            "uniform float opacity;",
            "uniform highp float viewportId;",
            "uniform highp float swap;",

        "#ifdef HAS_RASTER_QUADS",
            "uniform sampler2D tRaster;",
        "#endif",

        "#ifdef HAS_LINESTYLES",
            "uniform sampler2D tLineStyle;",
            "uniform vec2 vLineStyleTexSize;",
        "#endif",

        "#if defined(MRT_ID_BUFFER) || defined(MODEL_COLOR)",
            "uniform vec3 modelId;",
        "#endif",

            "uniform highp vec2 ghostingLayer;",

            //Gaussian falloff function
            "float curveGaussian(float r, float invWidth) {",
                "float amt = clamp(r * invWidth, 0.0, 1.0);",

                "float exponent = amt * 2.0;",

                "return exp(-exponent*exponent);",

            //Below is the full original from AutoCAD:
            /*
                "float amt = clamp(abs(r / (width * 1.0)), 0.0, 1.0);",
                "amt = max(amt - 0.0, 0.0);",

                "float exponent = amt * 3.5;",

                "return clamp(exp(-exponent*exponent), 0.0, 1.0);",
                */
            "}",

        "#ifdef HAS_LINESTYLES",
            "float getLinePatternPixel(int i, int j) {",
                //texel fetch would be nice here
                "return texture2D(tLineStyle, (vec2(i, j) + 0.5) / vLineStyleTexSize).x * 255.0;",
            "}",

            "float getPatternLength(int whichPattern) {",
                "float p1 = getLinePatternPixel(0, whichPattern);",
                "float p2 = getLinePatternPixel(1, whichPattern);",
                "return (p2 * 256.0 + p1);",
            "}",
        "#endif",


            "void fillLineSegment() {",

                "float radius = abs(fsHalfWidth);",
                "float parametricDistance = fsMultipurpose.x;",
                "float segmentLength      = fsMultipurpose.y;",
                "float totalDistance      = fsMultipurpose.z;",

            //Apply any dot/dash linetype
            "#ifdef HAS_LINESTYLES",
                "int whichPattern         = int(fsMultipurpose.w);",

                "if (whichPattern > 0) {",
                    "const float TEX_TO_UNIT = 1.0 / 96.0;",

                    //Line patterns are assumed to be defined for LTSCALE = 1
                    //AutCAD will scale patterns based on the LTSCALE setting, and
                    //currently this is ignored here.
                    "float LTSCALE = 1.0;",
                    "float patternScale;",

                    //If line width is negative it means device space line style (zoom invariant)
                    //line width, which also implies the same about the line pattern -- check for this here.
                    "if (fsHalfWidth < 0.0) {",
                        "patternScale = LTSCALE;",
                    "} else {",
                        "patternScale = LTSCALE * TEX_TO_UNIT * pixelsPerUnit;",
                    "}",

                    "float patLen = patternScale * getPatternLength(whichPattern);",
                    "float phase = mod((totalDistance + parametricDistance) * pixelsPerUnit, patLen);",

                    "bool onPixel = true;",
                    "float radiusPixels = radius * pixelsPerUnit;",

                    "for (int i=2; i<MAX_LINESTYLE_LENGTH; i+=2) {",

                        "float on = getLinePatternPixel(i, whichPattern);",
                        "if (on == 1.0) on = 0.0;", //special handling for dots, map length 1 to 0
                        "on *= patternScale;",

                        "onPixel = true;",
                        "phase -= on;",
                        "if (phase < 0.0) {",
                            "break;",
                        "}",
                        "else if (phase <= radiusPixels) {",
                            "onPixel = false;",
                            "break;",
                        "}",

                        "float off = getLinePatternPixel(i+1, whichPattern);",
                        "if (off <= 1.0) off = 0.0;", //special handling for dots, map length 1 to 0
                        "off *= patternScale;",

                        "onPixel = false;",
                        "phase -= off;",
                        "if (phase < -radiusPixels)",
                            "discard;",
                        "if (phase <= 0.0)",
                            "break;",
                    "}",

                    //Modify the parametricDistance value used for round cap
                    //rendering to reflect the current position along the dash,
                    //so that dashes get caps also.
                    "if (!onPixel && (abs(phase) <= radiusPixels)) {",
                        "segmentLength = 0.0;",
                        "parametricDistance = phase / pixelsPerUnit;",
                    "}",
                "}",
            "#endif", // HAS_LINESTYLES

                //Check for end cap or join region -- here we reduce
                ///allowed distance from centerline in a circular way
                //to get a round cap/join
                "float dist;",
                "float offsetLength2 = dot(fsOffsetDirection, fsOffsetDirection);",

                /*
                "if (parametricDistance < 0.0) {",
                    "float d = parametricDistance;",
                    "dist = sqrt(d * d + offsetLength2);",
                "} else if (parametricDistance >= segmentLength) {",
                    "float d = parametricDistance - segmentLength;",
                    "dist = sqrt(d * d + offsetLength2);",
                "} else {",
                    "dist = sqrt(offsetLength2);",
                "}",
                */

                //Branchless version of the above ifs (because who doesn't like to do boolean logic with float ops?):
                "float ltz = max(0.0, sign(-parametricDistance));",
                "float gtsl = max(0.0, sign(parametricDistance - segmentLength));",
                "float d = (ltz + gtsl) * (parametricDistance - gtsl * segmentLength);",
                "dist = sqrt(max(0.0, offsetLength2 + d*d));",


                //pixel is too far out of the line center
                //so discard it
                "float range =  dist - radius;",

                "if (range > aaRange) {",
                    "discard;",
                "}",
                //Non-branching discard (by setting alpha to zero if pixel is outside the line)
                //But can only be used if we don't care about z-writes.
                //"float makeTransparent = 1.0 - max(0.0, sign(range - aaRange));",
                //gl_FragColor.a *= makeTransparent;

                //The geometry covers this pixel -- do AA.
                "gl_FragColor = fsColor;",
                "gl_FragColor.a *= curveGaussian(range+aaRange, pixelsPerUnit);",
            "}",

        "#ifdef HAS_CIRCLES",
            "void fillCircularArc() {",

                "float dist   = length(fsOffsetDirection);",
                "vec2 angles  = fsMultipurpose.xz;", // (start, end) angles
                "float radius = abs(fsMultipurpose.y);",
                "float range  =  abs(dist - radius);",
                "range -= fsHalfWidth;",

                //pixel is too far out of the line center
                //so discard it
                "if (range > aaRange) {",
                    "discard;",
                "}",

                "vec2 direction = fsOffsetDirection;",
                "float angle = atan(direction.y, direction.x);",

                //Handle clockwise arcs, which happen when the arc
                //crosses the X axis -- convert to CCW arc starting
                //at negative angle instead.
                "if (angles.x > angles.y) {",
                    // Handle the case that 0 < angleStart < PI.
                    "if (angle > angles.x && angle < PI) {",
                        "angle -= TAU;",
                    "}",
                    "angles.x -= TAU;",
                "}",
                "else if (angle < 0.0)",
                    "angle += TAU;",

                //Are we in the exact range of the arc?
                "if (angle > angles.x && angle < angles.y) {",
                    "gl_FragColor = fsColor;",
                    "gl_FragColor.a *= curveGaussian(range+aaRange, pixelsPerUnit);",
                "}",

                "else {",
                    "discard;",
                "}",

            "}",
        "#endif",


/*
            "float DistancePointEllipseApprox(vec2 e, vec2 pos) { ",

                //Get position derivatives
                "vec2 dx = dFdx(pos);",
                "vec2 dy = dFdy(pos);",

                //Preparatory calculations for the ellipse equation
                "vec2 esqr = e * e;",
                "vec2 possqr = pos * pos;",
                "vec2 posDivEsqr = pos / esqr;",
                "vec2 pos2DivE2 = pos * posDivEsqr;",

                //Ellipse function derivative with chain rule
                "vec2 dPos = 2.0 * posDivEsqr;",
                "vec2 dPosx = dPos * dx;",
                "vec2 dPosy = dPos * dy;",
                "vec2 dfdxy = vec2(dPosx.x + dPosx.y, dPosy.x + dPosy.y);",

                // Approximate signed distance from curve with f(u,v) / |gradient(f(u,v))|
                "float sd = (pos2DivE2.x + pos2DivE2.y - 1.0) / length(dfdxy);",

                "return abs(sd) * aaRange * 2.0 * 0.745;",
            "}",
*/


//============================================================================
// Iterative distance to ellipse from Geometric Tools by Eberly
// See Page 11 of the document:
// http://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf

        "#ifdef HAS_ELLIPTICALS",
            //----------------------------------------------------------------------------
            // The ellipse is (x0/e0)^2 + (x1/e1)^2 = 1 with e0 >= e1. The query point is
            // (y0,y1) with y0 >= 0 and y1 >= 0. The function returns the distance from
            // the query point to the ellipse. It also computes the ellipse point (x0,x1)
            // in the first quadrant that is closest to (y0,y1).
            //----------------------------------------------------------------------------
            "float EllipticalApprox(",
                "const int iters,",
                "inout float t0, inout float t1,",
                "const vec2 y,   out   vec2 x,",
                "const vec2 e,   const vec2 ey, const vec2 esqr",
            ") {",
                "vec2 r;",
                "for (int i = 0; i < 10; ++i) {", // maximum 10 iterations
                    "if(i >= iters) break;", // early out if we don't want the max number of iterations

                    "float t = mix(t0, t1, 0.5);", // 0.5*(t0 + t1);
                    "r = ey / (vec2(t) + esqr);",

                    "vec2 rsq = r * r;",
                    "float f = rsq.x + rsq.y - 1.0;",

                    "if(f > 0.0) { t0 = t; } else { t1 = t; }",
                "}",

                "x = e * r;",
                "return distance(x, y);",
            "}",

            "float DistancePointEllipseSpecial (vec2 e, vec2 y, out vec2 x, float width, float aaRange) {",
                "float dist;",

                // Bisect to compute the root of F(t) for t >= -e1*e1.
                "vec2 esqr = e * e;",
                "vec2 ey   = e * y;",
                "float t0 = -esqr[1] + ey[1];",
                "float t1 = -esqr[1] + length(ey);",

                //Do a few initial iterations without loop break checks
                //to get approximately close to the result
                "dist = EllipticalApprox(6, t0, t1, y, x, e, ey, esqr);",

                //Early out -- point is going to be too far to matter for the ellipse outline
                "if (dist > max(2.0 * (width + aaRange), e[0] * 0.05))",
                    "return dist;",

                //Do a few more iterations to get really close to the result...
                "dist = EllipticalApprox(6, t0, t1, y, x, e, ey, esqr);",

                //Early out -- point is too far to matter for the ellipse outline
                //The bigger the eccentricity, the worse the estimate, so increse
                //the tolerance based on that.
                "float ecc = 1.0 +  0.1 * e[0] / e[1];",

                "if (dist > max(ecc * (width + aaRange), e[0] * 0.001))",
                    "return dist;",
                "if (dist < (width - aaRange) / ecc)",
                    "return dist;",


                //Finally get an almost exact answer since
                //we are near the line width boundary
                "dist = EllipticalApprox(10, t0, t1, y, x, e, ey, esqr);",
                "return dist;",
            "}",

            //----------------------------------------------------------------------------
            // The ellipse is (x0/e0)^2 + (x1/e1)^2 = 1. The query point is (y0,y1).
            // The function returns the distance from the query point to the ellipse.
            // It also computes the ellipse point (x0,x1) that is closest to (y0,y1).
            //----------------------------------------------------------------------------
            "float DistancePointEllipse(vec2 e, vec2 y, out vec2 locX, float width, float aaRange) {",
                "vec2 locE, locY;",
/*
                "locE = e; locY = y;",
                "if (e[0] < e[1]) {",
                    // Determine the axis order for decreasing extents
                    "locE.xy = locE.yx;",
                    "locY.xy = locY.yx;",
                "}",
*/

                //This will not works if e[0] == e[1], but that would be a circle
                //and should not be going thru this code path.
                "float diff = sign(e[0] - e[1]);",
                "vec2 swizzle = vec2(max(diff, 0.0), -min(diff, 0.0));",
                "locE.x = dot(e, swizzle.xy);",
                "locE.y = dot(e, swizzle.yx);",
                "locY.x = dot(y, swizzle.xy);",
                "locY.y = dot(y, swizzle.yx);",

                // Determine reflections for y to the first quadrant.
                "vec2 refl = sign(locY);",
                "locY *= refl;",

                "vec2 x;",
                "float distance = DistancePointEllipseSpecial(locE, locY, x, width, aaRange);",

                "x *= refl;",
/*
                "if (e[0] < e[1]) {",
                    "x.xy = x.yx;",
                "}",
                 "locX = x;",
*/
                "locX.x = dot(x, swizzle.xy);",
                "locX.y = dot(x, swizzle.yx);",

                "return distance;",
            "}",

//============================================================================




            "void fillEllipticalArc() {",
                "vec2 angles = fsMultipurpose.xz;", // (start, end) angles
                "vec2 radii  = abs(fsMultipurpose.yw);", // (major, minor)
                "vec2 dir    = fsOffsetDirection;",

                //TODO: Handle arc rotation
/*
                //Quick cull of the inside circle
                "float lenDirSq = dot(dir, dir);",
                "float minRad = min(radii.x, radii.y) - (fsHalfWidth + aaRange);",
                "if (lenDirSq < minRad * minRad)",
                    "discard;",
*/
                //"float range = DistancePointEllipseApprox(radii, dir);",
                "vec2 pos;",
                "float range = DistancePointEllipse(radii, dir, pos, fsHalfWidth, aaRange);",
                "range -= fsHalfWidth;",

                "if (range > aaRange)",
                    "discard;",

                "float ar = radii[0] / radii[1];", //TODO: can be done in the vertex shader or otherwise precomputed

                //Get the parametric angle at the ellipse intersection point
                // -- note that for ellipses this is not just atan of the direction,
                //and needs to be scaled by aspect ratio.
                "float angle = atan(ar * pos.y, pos.x);",

                //Handle clockwise arcs, which happen when the arc
                //crosses the X axis -- convert to CCW arc starting
                //at negative angle instead.
                "if (angles.x > angles.y) {",
                    // Handle the case that 0 < angleStart < PI.
                    "if (angle > angles.x && angle < PI) {",
                        "angle -= TAU;",
                    "}",
                    "angles.x -= TAU;",
                "}",
                "else if (angle < 0.0)",
                    "angle += TAU;",

                //Are we in the exact range of the arc?
                "if (angle > angles.x && angle < angles.y) {",
                    "gl_FragColor = fsColor;",
                    "gl_FragColor.a *= curveGaussian(range+aaRange, pixelsPerUnit);",
                "}",
                "else {",
                    "discard;",
                "}",
            "}",
        "#endif", //HAS_ELLIPTICALS

        "#ifdef HAS_RASTER_QUADS",
            "void fillTexQuad() { gl_FragColor = texture2D(tRaster, fsMultipurpose.xy); }",
        "#endif",

            "void fillTriangle() { gl_FragColor = fsColor; }",

            "void main() {",

                //Is visibility off?
                "if (fsColor.a == 0.0) {",
                    "discard;",
                "}",

                //Filled triangle, not a line, no need for extra math
                "if (fsHalfWidth == 0.0) {",
            "#ifdef HAS_RASTER_QUADS",
                    "if (fsMultipurpose.z != 0.0)",
                        "fillTexQuad();",
                    "else",
            "#endif",
                        "fillTriangle();",
                "}",
                "else if (fsMultipurpose.y < 0.0) {",
                    "#ifdef HAS_CIRCLES",
                    "#ifdef HAS_ELLIPTICALS",
                        "if (abs(fsMultipurpose.y) == fsMultipurpose.w)",
                    "#endif",
                            "fillCircularArc();",
                    "#endif",
                    "#ifdef HAS_ELLIPTICALS",
                     "#ifdef HAS_CIRCLES",
                        "else",
                     "#endif",
                            "fillEllipticalArc();",
                    "#endif",
                "}",
                "else",
                    "fillLineSegment();",


            /*
                "if      (abs(fsGeomType - VBB_GT_LINE_SEGMENT) < 0.5)     fillLineSegment();",
            "#ifdef HAS_CIRCLES",
                "else if (abs(fsGeomType - VBB_GT_ARC_CIRCULAR) < 0.5)     fillCircularArc();",
            "#endif",
            "#ifdef HAS_ELLIPTICALS",
                "else if (abs(fsGeomType - VBB_GT_ARC_ELLIPTICAL) < 0.5)   fillEllipticalArc();",
            "#endif",
            "#ifdef HAS_RASTER_QUADS",
                "else if (abs(fsGeomType - VBB_GT_TEX_QUAD) < 0.5)         fillTexQuad();",
            "#endif",
            "#ifdef HAS_TRIANGLE_GEOMS",
                "else if (abs(fsGeomType - VBB_GT_ONE_TRIANGLE) < 0.5)     fillTriangle();",
            "#endif",
                "else fillTriangle();",
*/
            "#ifdef MRT_NORMALS",
                //We cannot avoid blending in the depth target when blending
                //to the color target is on, so
                //we pack the normal and depth in the first three elements
                //and use 0 or 1 as the alpha.
                //NOTE: Dropping the Z coordinate of the normal entirely means
                //that we lose information about its sign (we use sqrt to restore it later).
                //This is OK in this case because in view space surfaces that we see will have
                //positive Z component in all cases. If that changes we have to also
                //encode the sign bit in the x or y.
                //In the case of 2D: we just write with alpha=0 so that it does not affect the normals buffer.
                "gl_FragData[1] = vec4(0.0);",
            "#endif",

                "float writeId = 1.0;",

                // Apply ghosting, i.e., make an object transparent and exclude it from ID buffer if...
                //  a) It is in the ghosting layer (see FragmentList.js)
                //  b) We are in 2D measure mode and it belongs to a different viewport than the first selected one
                "if (fsLayerTC==ghostingLayer || ",
                    "((viewportId != 0.0) && (abs(fsVpTC.x * 255.0 + fsVpTC.y) >= 0.5 && abs(fsVpTC.x * 255.0 + fsVpTC.y - viewportId) >= 0.5))) {",
                    // apply ghosting
                    "writeId = 0.0;",

                    // When swapping black and white, must kick up faded inks a bit to give them more contrast
                    // with the (likely to be black) background. By visual test, 0.21 looks good.
                    "gl_FragColor.a *= opacity * ((swap == 1.0) ? 0.21 : 0.1);",
                "} else {",
                    // default: no ghosting
                    "gl_FragColor.a *= opacity;",
                "}",

                IdOutputShaderChunk,
            "}"

        ].join("\n")

    };

    return LineShader;
});