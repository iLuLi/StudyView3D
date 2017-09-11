define(['./Logger'], function (Logger) {
    ;
    'use strict'
    return (function () {


        var TOL = 1e-10;

        function isZero(f) {
            return Math.abs(f) < TOL;
        }

        function isEqual(a, b) {
            return isZero(a - b);
        }


        function makePointId(idFrom, idTo, meshId) {
            var tmp = idFrom < idTo ? (idFrom + ":" + idTo) : (idTo + ":" + idFrom);
            return meshId + ":" + tmp;
        }

        function Edge(pt1, pt2, id1From, id1To, id2From, id2To, meshId) {

            this.pt1 = pt1;
            this.pt2 = pt2;

            this.p1 = -1;
            this.p2 = -1;

            //Use the triangle edges that created the two planar edge points
            //as IDs for those points.
            this.eid1 = makePointId(id1From, id1To, meshId);
            this.eid2 = makePointId(id2From, id2To, meshId);
        }


        function IntervalNode() {

            this.bbox = new THREE.Box2();
            this.left = null;
            this.right = null;
            this.node_edges = [];
        }

        //Acceleration structure for point-in-polygon checking
        function IntervalTree(pts, edges, bbox) {

            this.pts = pts;
            this.edges = edges;
            this.bbox = bbox;
            this.pipResult = false;

        }



        IntervalTree.prototype.splitNode = function (node) {

            if (node.bbox.min.y >= node.bbox.max.y)
                return;

            if (node.node_edges.length < 3)
                return;

            var split = 0.5 * (node.bbox.min.y + node.bbox.max.y);

            //node.bbox.makeEmpty();

            node.left = new IntervalNode();
            node.right = new IntervalNode();

            var pts = this.pts;
            var ne = node.node_edges;
            var remaining_node_edges = [];
            var tmpPt = new THREE.Vector2();

            for (var i = 0; i < ne.length; i++) {

                var e = this.edges[ne[i]];

                var p1y = pts[e.p1].y;
                var p2y = pts[e.p2].y;

                if (p1y > p2y) {
                    var tmp = p1y;
                    p1y = p2y;
                    p2y = tmp;
                }

                var boxPtr = null;

                if (p2y < split) {
                    node.left.node_edges.push(ne[i]);
                    boxPtr = node.left.bbox;
                } else if (p1y > split) {
                    node.right.node_edges.push(ne[i]);
                    boxPtr = node.right.bbox;
                } else {
                    remaining_node_edges.push(ne[i]);
                    //boxPtr = node.bbox;
                }

                if (boxPtr) {
                    tmpPt.set(pts[e.p1].x, pts[e.p1].y);
                    boxPtr.expandByPoint(tmpPt);
                    tmpPt.set(pts[e.p2].x, pts[e.p2].y);
                    boxPtr.expandByPoint(tmpPt);
                }
            }

            node.node_edges = remaining_node_edges;

            if (node.left.node_edges.length)
                this.splitNode(node.left);
            if (node.right.node_edges.length)
                this.splitNode(node.right);
        };


        IntervalTree.prototype.build = function () {

            this.root = new IntervalNode();

            var edge_indices = this.root.node_edges;
            for (var i = 0; i < this.edges.length; i++)
                edge_indices.push(i);

            this.root.bbox.copy(this.bbox);

            //split recursively
            this.splitNode(this.root);
        };




        IntervalTree.prototype.pointInPolygonRec = function (node, x, y) {

            if (node.bbox.min.y <= y && node.bbox.max.y >= y) {

                var pts = this.pts;
                var ne = node.node_edges;

                for (var i = 0, iEnd = ne.length; i < iEnd; i++) {

                    var e = this.edges[ne[i]];

                    // get the last point in the polygon
                    var p1 = pts[e.p1];
                    var vtx0X = p1.x;
                    var vtx0Y = p1.y;

                    // get test bit for above/below X axis
                    var yflag0 = (vtx0Y >= y);

                    var p2 = pts[e.p2];
                    var vtx1X = p2.x;
                    var vtx1Y = p2.y;

                    var yflag1 = (vtx1Y >= y);

                    // Check if endpoints straddle (are on opposite sides) of X axis
                    // (i.e. the Y's differ); if so, +X ray could intersect this edge.
                    // The old test also checked whether the endpoints are both to the
                    // right or to the left of the test point.  However, given the faster
                    // intersection point computation used below, this test was found to
                    // be a break-even proposition for most polygons and a loser for
                    // triangles (where 50% or more of the edges which survive this test
                    // will cross quadrants and so have to have the X intersection computed
                    // anyway).  I credit Joseph Samosky with inspiring me to try dropping
                    // the "both left or both right" part of my code.
                    if (yflag0 != yflag1) {
                        // Check intersection of pgon segment with +X ray.
                        // Note if >= point's X; if so, the ray hits it.
                        // The division operation is avoided for the ">=" test by checking
                        // the sign of the first vertex wrto the test point; idea inspired
                        // by Joseph Samosky's and Mark Haigh-Hutchinson's different
                        // polygon inclusion tests.
                        if (((vtx1Y - y) * (vtx0X - vtx1X) >=
                            (vtx1X - x) * (vtx0Y - vtx1Y)) == yflag1) {
                            this.pipResult = !this.pipResult;
                        }
                    }

                }

            }

            var nl = node.left;
            if (nl && nl.bbox.min.y <= y && nl.bbox.max.y >= y) {
                this.pointInPolygonRec(nl, x, y);
            }

            var nr = node.right;
            if (nr && nr.bbox.min.y <= y && nr.bbox.max.y >= y) {
                this.pointInPolygonRec(nr, x, y);
            }

        };

        IntervalTree.prototype.pointInPolygon = function (x, y) {

            this.pipResult = false;

            this.pointInPolygonRec(this.root, x, y);

            return this.pipResult;

        };




        //Functionality for converting a list of two point segments into a connected
        //set of (hopefully) closed contour lines. The contour set is then used
        //for triangulation
        function ContourSet(edges, bbox) {

            this.edges = edges;
            this.bbox = bbox;

            this.pts = [];
            this.idmap = {};
            this.xymap = {};
            this.contours = [];

            this.scale = (1e6) / this.bbox.size().length();
        }



        ContourSet.prototype.getPointIndex = function (px, py, eid) {
            var findByEdgeId = this.idmap[eid];
            if (findByEdgeId !== undefined) {
                return findByEdgeId;
            }
            /*
                    findByEdgeId = this.idmap[eid] = this.pts.length;
                    pts.push({x: px, y: py, id: eid});
                    return findByEdgeId;
            */

            var x = 0 | (px * this.scale);
            var y = 0 | (py * this.scale);

            var mx = this.xymap[x];
            var my;

            if (mx === undefined) {
                this.xymap[x] = mx = {};
                my = undefined;
            } else {
                my = mx[y];
            }

            if (my === undefined) {
                mx[y] = my = this.pts.length;
                this.idmap[eid] = my;
                this.pts.push({ x: px, y: py /*, id : eid*/ });
            }

            return my;
        };

        ContourSet.prototype.snapEdges = function () {

            for (var i = 0; i < this.edges.length; i++) {

                var e = this.edges[i];

                e.p1 = this.getPointIndex(e.pt1.x, e.pt1.y, e.eid1);
                e.p2 = this.getPointIndex(e.pt2.x, e.pt2.y, e.eid2);
            }
        };

        ContourSet.prototype.sanitizeEdges = function () {
            var edgeSet = {};
            var sanitizedEdges = [];

            for (var i = 0, len = this.edges.length; i < len; i++) {
                var e = this.edges[i];
                if (e.p1 === e.p2) {
                    continue;
                }

                var key = Math.min(e.p1, e.p2) + ':' + Math.max(e.p1, e.p2);
                if (edgeSet[key] !== true) {
                    edgeSet[key] = true;
                    sanitizedEdges.push(e);
                }
            }

            this.edges = sanitizedEdges;
        };

        ContourSet.prototype.stitchContours = function () {

            //Create jump table from edge to edge
            //and back
            var edge_table = {};

            for (var i = 0; i < this.edges.length; i++) {
                var e = this.edges[i];

                if (e.p1 === e.p2)
                    continue;

                if (edge_table[e.p1] !== undefined)
                    edge_table[e.p1].push(e.p2);
                else
                    edge_table[e.p1] = [e.p2];

                if (edge_table[e.p2] !== undefined)
                    edge_table[e.p2].push(e.p1);
                else
                    edge_table[e.p2] = [e.p1];
            }

            var cur_cntr = [];

            for (var p in edge_table) {
                if (edge_table[p].length !== 2) {
                    Logger.warn("Incomplete edge table");
                    break;
                }
            }

            //Start with the first edge, and stitch until we can no longer
            while (true) {

                var sfrom = undefined;

                //Look for doubly connected point first
                for (var p in edge_table) {
                    if (edge_table[p].length > 1) {
                        sfrom = p;
                        break;
                    }
                }

                //If no double-connected point found, we know
                //the it will be an open contour, but stitch as much 
                //as we can anyway.
                if (!sfrom) {
                    for (var p in edge_table) {
                        if (edge_table[p].length > 0) {
                            sfrom = p;
                            break;
                        }
                    }
                }

                if (!sfrom)
                    break;

                var prev = -1;
                var cur = parseInt(sfrom);
                var cur_segs = edge_table[sfrom];

                //start a new contour
                cur_cntr.push(cur);

                while (cur_segs && cur_segs.length) {

                    var toPt = cur_segs.shift();

                    //skip backpointer if we hit it
                    if (toPt === prev)
                        toPt = cur_segs.shift();

                    if (toPt === undefined) {
                        delete edge_table[cur];
                        break;
                    }

                    cur_cntr.push(toPt);

                    if (cur_segs.length == 0)
                        delete edge_table[cur];
                    else if (cur_segs[0] === prev)
                        delete edge_table[cur];

                    prev = cur;
                    cur = toPt;
                    cur_segs = edge_table[toPt];
                }

                if (cur_cntr.length) {
                    this.contours.push(cur_cntr);
                    cur_cntr = [];
                }
            }

            var openCntrs = [];
            for (var i = 0; i < this.contours.length; i++) {
                var cntr = this.contours[i];
                if (cntr[0] !== cntr[cntr.length - 1])
                    openCntrs.push(cntr);
            }


            if (openCntrs.length) {
                //Logger.warn("Incomplete stitch");

                var didSomething = true;
                while (didSomething) {

                    didSomething = false;

                    //Try to combine contours
                    var cntr_edge_table = {};
                    var contours = this.contours;

                    for (var i = 0; i < contours.length; i++) {
                        var cntr = contours[i];
                        var start = cntr[0];
                        var end = cntr[cntr.length - 1];

                        if (start === end)
                            continue;

                        if (!cntr_edge_table[start])
                            cntr_edge_table[start] = [-i - 1];
                        else
                            cntr_edge_table[start].push(-i - 1);


                        if (!cntr_edge_table[end])
                            cntr_edge_table[end] = [i];
                        else
                            cntr_edge_table[end].push(i);
                    }

                    for (var p in cntr_edge_table) {
                        var entry = cntr_edge_table[p];

                        if (entry.length == 2) {
                            var toerase = undefined;

                            if (entry[0] < 0 && entry[1] < 0) {
                                var c1 = -entry[0] - 1; var c2 = -entry[1] - 1;
                                //join start point to startpoint
                                contours[c2].shift();
                                Array.prototype.push.apply(contours[c1].reverse(), contours[c2]);
                                toerase = c2;
                            }

                            if (entry[0] < 0 && entry[1] > 0) {
                                var c1 = -entry[0] - 1; var c2 = entry[1];
                                //join start point to endpoint
                                contours[c2].pop();
                                Array.prototype.push.apply(contours[c2], contours[c1]);
                                toerase = c1;
                            }

                            if (entry[0] > 0 && entry[1] < 0) {
                                var c1 = entry[0]; var c2 = -entry[1] - 1;
                                //join end point to startpoint
                                contours[c1].pop();
                                Array.prototype.push.apply(contours[c1], contours[c2]);
                                toerase = c2;
                            }

                            if (entry[0] > 0 && entry[1] > 0) {
                                var c1 = entry[0]; var c2 = entry[1];
                                //join end point to endpoint
                                contours[c1].pop();
                                Array.prototype.push.apply(contours[c1], contours[c2].reverse());
                                toerase = c2;
                            }

                            if (toerase !== undefined) {
                                contours.splice(toerase, 1);
                                didSomething = true;
                            }
                            break;
                        }
                    }

                }

            }


        };






        function TriangulatedSurface(cset) {

            this.indices = [];

            this.cset = cset;
            var _pts = this.pts = cset.pts;

            this.intervalTree = new IntervalTree(cset.pts, cset.edges, cset.bbox);
            this.intervalTree.build();


            for (var i = 0; i < _pts.length; i++) {
                _pts[i].id = i;
            }

            var sweepCtx = new lmv_poly2tri.SweepContext([]);

            sweepCtx.points_ = _pts.slice();



            if (cset.contours) {

                var contours = this.cset.contours;

                for (var j = 0; j < contours.length; j++) {

                    var cntr = contours[j];

                    //Contour is not closed
                    var isOpen = (cntr[0] !== cntr[cntr.length - 1]);

                    //if (isOpen)
                    //    continue;

                    var edge = [];

                    for (var k = 0; k < cntr.length - 1; k++) {
                        edge.push(_pts[cntr[k]]);
                    }

                    sweepCtx.initEdges(edge, isOpen);
                }

            } else {

                var edges = this.cset.edges;

                for (var i = 0; i < edges.length; i++) {

                    var e = edges[i];

                    if (e.p1 == e.p2)
                        continue;

                    var triedge = [_pts[e.p1], _pts[e.p2]];
                    sweepCtx.initEdges(triedge, true);
                }

            }

            this.triangulate(sweepCtx);
            this.processResult(sweepCtx);
        }


        TriangulatedSurface.prototype.triangulate = function (sweepCtx) {

            try {
                sweepCtx.triangulate();
            } catch (e) {
            }
        };


        TriangulatedSurface.prototype.processResult = function (sweepCtx) {
            for (var i = 0; i < sweepCtx.map_.length; i++) {
                var t = sweepCtx.map_[i];
                var p0 = t.points_[0];
                var p1 = t.points_[1];
                var p2 = t.points_[2];

                if (p0.id !== undefined && p1.id !== undefined && p2.id !== undefined)
                    this.filterFace(p0.id, p1.id, p2.id);

            }
        };



        TriangulatedSurface.prototype.pointInEdgeList = function (x, y) {
            var yflag0, yflag1;
            var vtx0X, vtx0Y, vtx1X, vtx1Y;

            var pts = this.cset.pts;
            var edges = this.cset.edges;

            var inside_flag = false;


            for (var j = 0, jEnd = edges.length; j < jEnd; ++j) {
                var e = edges[j];

                // get the last point in the polygon
                vtx0X = pts[e.p1].x;
                vtx0Y = pts[e.p1].y;

                // get test bit for above/below X axis
                yflag0 = (vtx0Y >= y);


                vtx1X = pts[e.p2].x;
                vtx1Y = pts[e.p2].y;

                yflag1 = (vtx1Y >= y);

                // Check if endpoints straddle (are on opposite sides) of X axis
                // (i.e. the Y's differ); if so, +X ray could intersect this edge.
                // The old test also checked whether the endpoints are both to the
                // right or to the left of the test point.  However, given the faster
                // intersection point computation used below, this test was found to
                // be a break-even proposition for most polygons and a loser for
                // triangles (where 50% or more of the edges which survive this test
                // will cross quadrants and so have to have the X intersection computed
                // anyway).  I credit Joseph Samosky with inspiring me to try dropping
                // the "both left or both right" part of my code.
                if (yflag0 != yflag1) {
                    // Check intersection of pgon segment with +X ray.
                    // Note if >= point's X; if so, the ray hits it.
                    // The division operation is avoided for the ">=" test by checking
                    // the sign of the first vertex wrto the test point; idea inspired
                    // by Joseph Samosky's and Mark Haigh-Hutchinson's different
                    // polygon inclusion tests.
                    if (((vtx1Y - y) * (vtx0X - vtx1X) >=
                        (vtx1X - x) * (vtx0Y - vtx1Y)) == yflag1) {
                        inside_flag = !inside_flag;
                    }
                }
            }

            return inside_flag;
        };



        TriangulatedSurface.prototype.pointInContour = function (x, y, cntr) {
            var yflag0, yflag1;
            var vtx0X, vtx0Y, vtx1X, vtx1Y;

            var inside_flag = false;

            var pts = this.cset.pts;

            // get the last point in the polygon
            vtx0X = pts[cntr[cntr.length - 1]].x;
            vtx0Y = pts[cntr[cntr.length - 1]].y;

            // get test bit for above/below X axis
            yflag0 = (vtx0Y >= y);

            for (var j = 0, jEnd = cntr.length; j < jEnd; ++j) {
                vtx1X = pts[cntr[j]].x;
                vtx1Y = pts[cntr[j]].y;

                yflag1 = (vtx1Y >= y);

                // Check if endpoints straddle (are on opposite sides) of X axis
                // (i.e. the Y's differ); if so, +X ray could intersect this edge.
                // The old test also checked whether the endpoints are both to the
                // right or to the left of the test point.  However, given the faster
                // intersection point computation used below, this test was found to
                // be a break-even proposition for most polygons and a loser for
                // triangles (where 50% or more of the edges which survive this test
                // will cross quadrants and so have to have the X intersection computed
                // anyway).  I credit Joseph Samosky with inspiring me to try dropping
                // the "both left or both right" part of my code.
                if (yflag0 != yflag1) {
                    // Check intersection of pgon segment with +X ray.
                    // Note if >= point's X; if so, the ray hits it.
                    // The division operation is avoided for the ">=" test by checking
                    // the sign of the first vertex wrto the test point; idea inspired
                    // by Joseph Samosky's and Mark Haigh-Hutchinson's different
                    // polygon inclusion tests.
                    if (((vtx1Y - y) * (vtx0X - vtx1X) >=
                        (vtx1X - x) * (vtx0Y - vtx1Y)) == yflag1) {
                        inside_flag = !inside_flag;
                    }
                }

                // move to the next pair of vertices, retaining info as possible
                yflag0 = yflag1;
                vtx0X = vtx1X;
                vtx0Y = vtx1Y;
            }

            return inside_flag;
        };


        TriangulatedSurface.prototype.pointInPolygon = function (x, y) {
            var inside = false;

            for (var i = 0; i < this.cset.contours.length; i++) {

                if (this.pointInContour(x, y, this.cset.contours[i]))
                    inside = !inside;
            }

            return inside;
        };


        TriangulatedSurface.prototype.filterFace = function (i0, i1, i2) {

            var p0 = this.pts[i0];
            var p1 = this.pts[i1];
            var p2 = this.pts[i2];

            var cx = (p0.x + p1.x + p2.x) / 3;
            var cy = (p0.y + p1.y + p2.y) / 3;

            if (this.intervalTree.pointInPolygon(cx, cy)) {
                // if (this.pointInEdgeList(cx, cy)) {
                // if (pointInPolygon(cx, cy)) {

                var e1x = p1.x - p0.x;
                var e1y = p1.y - p0.y;
                var e2x = p2.x - p0.x;
                var e2y = p2.y - p0.y;

                var cross = e1x * e2y - e2x * e1y;

                if (cross > 0) {
                    this.indices.push(i0, i1, i2);
                } else {
                    this.indices.push(i0, i2, i1);
                }

            }
        };




        return {

            TriangulatedSurface: TriangulatedSurface,
            ContourSet: ContourSet,
            Edge: Edge

        };


    })();
});