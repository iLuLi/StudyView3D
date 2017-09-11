define([
    './Logger',
    './Triangulator'
], function (Logger, Triangulator) {
    'use strict';
    return (function () {


        var TOL = 1e-10;
        var Edge = Triangulator.Edge;

        function isZero(f) {
            return Math.abs(f) < TOL;
        }

        function isEqual(a, b) {
            return isZero(a - b);
        }


        var v1 = new THREE.Vector3();

        function xPlaneSegment(plane, pt0, pt1, res1, res2) {

            var direction = v1.subVectors(pt1, pt0);

            var denominator = plane.normal.dot(direction);

            if (isZero(denominator)) {

                res1.copy(pt0);
                res2.copy(pt1);

                // line is coplanar
                return 2;
            }

            denominator = 1.0 / denominator;

            var t = -(pt0.dot(plane.normal) * denominator + plane.constant * denominator);

            if (t < -TOL || t > 1 + TOL) {

                return 0;

            }

            var pt = direction.multiplyScalar(t).add(pt0);

            res1.copy(pt);

            return 1;
        }


        var res1 = new THREE.Vector3();
        var res2 = new THREE.Vector3();

        // res is array containing result segments.
        // returns number of intersection point on the plane (0, 1, or 2) with the values of the points stored in the res array
        function xTrianglePlane(plane, pt0, pt1, pt2, i0, i1, i2, res, meshId) {

            var d0 = plane.distanceToPoint(pt0);
            var d1 = plane.distanceToPoint(pt1);
            var d2 = plane.distanceToPoint(pt2);

            // Check if all points are to one side of the plane
            if (d0 < -TOL && d1 < -TOL && d2 < -TOL) {
                return null;
            }
            if (d0 > TOL && d1 > TOL && d2 > TOL) {
                return null;
            }

            var s0 = Math.sign(d0);
            var s1 = Math.sign(d1);
            var s2 = Math.sign(d2);

            // Skip coplanar triangles (leave it to the neighbouring triangles to contribute their edges)
            if (s0 === 0 && s1 === 0 && s2 === 0) {
                return null;
            }

            var tmp1, tmp2;
            var i1From, i1To, i2From, i2To;

            //There is intersection, compute it
            if (s0 !== s1) {
                var numInts = xPlaneSegment(plane, pt0, pt1, res1, res2);
                if (numInts == 2) {
                    res.push(new Edge(pt0.clone(), pt1.clone(), i0, i0, i1, i1, meshId));
                    return;
                } else if (numInts == 1) {
                    i1From = i0;
                    i1To = i1;
                    tmp1 = res1.clone();
                } else {
                    Logger.warn("Unexpected zero intersections where at least one was expected");
                }
            }

            if (s1 !== s2) {
                var numInts = xPlaneSegment(plane, pt1, pt2, res1, res2);
                if (numInts == 2) {
                    res.push(new Edge(pt1.clone(), pt2.clone(), i1, i1, i2, i2, meshId));
                    return;
                } else if (numInts == 1) {
                    if (tmp1) {
                        // Avoid the singular scenario where the signs are 0, -1 and +1
                        if (res1.distanceTo(tmp1) > TOL) {
                            i2From = i1;
                            i2To = i2;
                            tmp2 = res1.clone();
                        }
                    }
                    else {
                        i1From = i1;
                        i1To = i2;
                        tmp1 = res1.clone();
                    }
                } else {
                    Logger.warn("Unexpected zero intersections where at least one was expected");
                }
            }

            if (s2 !== s0) {
                var numInts = xPlaneSegment(plane, pt2, pt0, res1, res2);
                if (numInts == 2) {
                    res.push(new Edge(pt2.clone(), pt0.clone(), i2, i2, i0, i0, meshId));
                    return;
                } else if (numInts == 1) {
                    if (tmp1) {
                        // Avoid the singular scenario where the signs are 0, -1 and +1
                        if (res1.distanceTo(tmp1) > TOL) {
                            i2From = i2;
                            i2To = i0;
                            tmp2 = res1.clone();
                        }
                    } else {
                        Logger.warn("Unexpected single intersection point");
                    }
                } else {
                    Logger.warn("Unexpected zero intersections where at least one was expected");
                }
            }


            if (tmp1 && tmp2) {
                res.push(new Edge(tmp1, tmp2, i1From, i1To, i2From, i2To, meshId));
            } else {
                Logger.warn("Unexpected one intersection where two were expected");
            }

        }

        var point = new THREE.Vector3();

        function xBoxPlane(plane, box) {

            point.set(box.min.x, box.min.y, box.min.z); // 000
            var d = plane.distanceToPoint(point);
            var s = Math.sign(d);

            point.set(box.min.x, box.min.y, box.max.z); // 001
            var d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.min.x, box.max.y, box.min.z); // 010
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.min.x, box.max.y, box.max.z); // 011
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.max.x, box.min.y, box.min.z); // 100
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.max.x, box.min.y, box.max.z); // 101
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.max.x, box.max.y, box.min.z); // 110
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            point.set(box.max.x, box.max.y, box.max.z); // 111        
            d2 = plane.distanceToPoint(point);
            if (Math.sign(d2) !== s)
                return true;

            return false;
        }

        var vA = new THREE.Vector3();
        var vB = new THREE.Vector3();
        var vC = new THREE.Vector3();
        var mi = new THREE.Matrix4();
        var pi = new THREE.Plane();

        function xMeshPlane(plane, mesh, intersects) {

            var geometry = mesh.geometry;
            var baseIndex = intersects.length;

            var attributes = geometry.attributes;

            var matrixWorld = mesh.matrixWorld;
            mi.getInverse(matrixWorld);
            pi.copy(plane).applyMatrix4(mi);

            var a, b, c;

            if (attributes.index !== undefined) {

                var indices = attributes.index.array || geometry.ib;
                var positions = geometry.vb ? geometry.vb : attributes.position.array;
                var stride = geometry.vb ? geometry.vbstride : 3;
                var offsets = geometry.offsets;

                if (!offsets || offsets.length === 0) {

                    offsets = [{ start: 0, count: indices.length, index: 0 }];

                }

                for (var oi = 0, ol = offsets.length; oi < ol; ++oi) {

                    var start = offsets[oi].start;
                    var count = offsets[oi].count;
                    var index = offsets[oi].index;

                    for (var i = start, il = start + count; i < il; i += 3) {

                        a = index + indices[i];
                        b = index + indices[i + 1];
                        c = index + indices[i + 2];

                        vA.x = positions[a * stride]; vA.y = positions[a * stride + 1]; vA.z = positions[a * stride + 2];
                        vB.x = positions[b * stride]; vB.y = positions[b * stride + 1]; vB.z = positions[b * stride + 2];
                        vC.x = positions[c * stride]; vC.y = positions[c * stride + 1]; vC.z = positions[c * stride + 2];

                        /*
                        vA.fromArray(positions, a * stride);
                        vB.fromArray(positions, b * stride);
                        vC.fromArray(positions, c * stride);
                        */

                        xTrianglePlane(pi, vA, vB, vC, a, b, c, intersects, mesh.fragId);
                    }

                }

            } else {

                var positions = geometry.vb ? geometry.vb : attributes.position.array;
                var stride = geometry.vb ? geometry.vbstride : 3;

                for (var i = 0, j = 0, il = positions.length; i < il; i += 3, j += 9) {

                    a = i;
                    b = i + 1;
                    c = i + 2;

                    vA.x = positions[a * stride]; vA.y = positions[a * stride + 1]; vA.z = positions[a * stride + 2];
                    vB.x = positions[b * stride]; vB.y = positions[b * stride + 1]; vB.z = positions[b * stride + 2];
                    vC.x = positions[c * stride]; vC.y = positions[c * stride + 1]; vC.z = positions[c * stride + 2];

                    /*
                    vA.fromArray(positions, a * stride);
                    vB.fromArray(positions, b * stride);
                    vC.fromArray(positions, c * stride);
                    */

                    xTrianglePlane(pi, vA, vB, vC, a, b, c, intersects, mesh.fragId);
                }

            }

            //Put the points into world space. It should actually be possible to do
            //the entire math in object space -- but we have to check if all fragments
            //that belong to the same dbId have the same world transform.
            for (var i = baseIndex; i < intersects.length; i++) {
                intersects[i].pt1.applyMatrix4(matrixWorld);
                intersects[i].pt2.applyMatrix4(matrixWorld);
            }

        }


        function makeRotationAxis(axis, cosa, m) {

            // Based on http://www.gamedev.net/reference/articles/article1199.asp

            var c = cosa;
            var s = Math.sqrt(1.0 - c * c);
            var t = 1 - c;
            var x = axis.x, y = axis.y, z = axis.z;
            var tx = t * x, ty = t * y;

            m.set(

                tx * x + c, tx * y - s * z, tx * z + s * y, 0,
                tx * y + s * z, ty * y + c, ty * z - s * x, 0,
                tx * z - s * y, ty * z + s * x, t * z * z + c, 0,
                0, 0, 0, 1

            );

        }


        function makePlaneBasis(plane) {

            //var origin = plane.coplanarPoint();

            var sceneUp = new THREE.Vector3(0, 0, 1);
            var cross = plane.normal.clone().cross(sceneUp);
            cross = cross.normalize();
            var dot = sceneUp.dot(plane.normal);

            //We are ignoring the translation here, since
            //we will drop the Z coord for the 2D processing steps anyway.
            var planeBasis = new THREE.Matrix4();

            if (!(isZero(cross.x) && isZero(cross.y) && isZero(cross.z))) {
                makeRotationAxis(cross, dot, planeBasis);
                planeBasis.elements[14] = plane.constant;
            } else {
                planeBasis.elements[14] = dot * plane.constant;
            }

            return planeBasis;
        }


        function convertToPlaneCoords(planeBasis, edges3d, bbox) {

            for (var i = 0; i < edges3d.length; i++) {
                var e = edges3d[i];

                e.pt1.applyMatrix4(planeBasis);
                e.pt2.applyMatrix4(planeBasis);

                bbox.expandByPoint(e.pt1);
                bbox.expandByPoint(e.pt2);
            }
        }


        return {

            makePlaneBasis: makePlaneBasis,
            convertToPlaneCoords: convertToPlaneCoords,

            intersectTrianglePlane: xTrianglePlane,
            intersectMeshPlane: xMeshPlane,
            intersectBoxPlane: xBoxPlane

        };

    })();
});