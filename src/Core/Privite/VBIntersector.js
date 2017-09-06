define(function() {
    'use strict';

    var inverseMatrix;
    var ray;

    var vA;
    var vB;
    var vC;

    function init_three() {

        if (!inverseMatrix) {
            inverseMatrix = new THREE.Matrix4();
            ray = new THREE.Ray();

            vA = new THREE.Vector3();
            vB = new THREE.Vector3();
            vC = new THREE.Vector3();
        }
    }

    function meshRayCast(mesh, raycaster, intersects) {

        init_three();

        var geometry = mesh.geometry;

        if (!geometry)
            return;

        var material = mesh.material;

        var side = material ? material.side : THREE.FrontSide;

        var attributes = geometry.attributes;

        inverseMatrix.getInverse(mesh.matrixWorld);
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

        var a, b, c, i, j, il;
        var precision = raycaster.precision;
        var positions, stride, intersectionPoint, distance;

        if (attributes.index !== undefined) {

            var indices = attributes.index.array || geometry.ib;
            positions = geometry.vb ? geometry.vb : attributes.position.array;
            stride = geometry.vb ? geometry.vbstride : 3;
            var offsets = geometry.offsets;

            if (!offsets || offsets.length === 0) {

                offsets = [{ start: 0, count: indices.length, index: 0 }];

            }

            for (var oi = 0, ol = offsets.length; oi < ol; ++oi) {

                var start = offsets[oi].start;
                var count = offsets[oi].count;
                var index = offsets[oi].index;

                for (i = start, il = start + count; i < il; i += 3) {

                    a = index + indices[i];
                    b = index + indices[i + 1];
                    c = index + indices[i + 2];

                    vA.fromArray(positions, a * stride);
                    vB.fromArray(positions, b * stride);
                    vC.fromArray(positions, c * stride);

                    if (side === THREE.BackSide) {

                        intersectionPoint = ray.intersectTriangle(vC, vB, vA, true);

                    } else {

                        intersectionPoint = ray.intersectTriangle(vA, vB, vC, side !== THREE.DoubleSide);

                    }

                    if (intersectionPoint === null) continue;

                    intersectionPoint.applyMatrix4(mesh.matrixWorld);

                    distance = raycaster.ray.origin.distanceTo(intersectionPoint);

                    if (distance < precision || distance < raycaster.near || distance > raycaster.far) continue;

                    intersects.push({

                        distance: distance,
                        point: intersectionPoint,
                        face: new THREE.Face3(a, b, c, THREE.Triangle.normal(vA, vB, vC)),
                        faceIndex: null,
                        fragId: mesh.fragId,
                        dbId: mesh.dbId

                    });

                }

            }

        } else {

            positions = geometry.vb ? geometry.vb : attributes.position.array;
            stride = geometry.vb ? geometry.vbstride : 3;

            for (i = 0, j = 0, il = positions.length; i < il; i += 3, j += 9) {

                a = i;
                b = i + 1;
                c = i + 2;

                vA.fromArray(positions, a * stride);
                vB.fromArray(positions, b * stride);
                vC.fromArray(positions, c * stride);

                if (material.side === THREE.BackSide) {

                    intersectionPoint = ray.intersectTriangle(vC, vB, vA, true);

                } else {

                    intersectionPoint = ray.intersectTriangle(vA, vB, vC, material.side !== THREE.DoubleSide);

                }

                if (intersectionPoint === null) continue;

                intersectionPoint.applyMatrix4(mesh.matrixWorld);

                distance = raycaster.ray.origin.distanceTo(intersectionPoint);

                if (distance < precision || distance < raycaster.near || distance > raycaster.far) continue;

                intersects.push({

                    distance: distance,
                    point: intersectionPoint,
                    face: new THREE.Face3(a, b, c, THREE.Triangle.normal(vA, vB, vC)),
                    faceIndex: null,
                    fragId: mesh.fragId,
                    dbId: mesh.dbId

                });

            }

        }

    }


    function lineRayCast(mesh, raycaster, intersects) {

        init_three();

        var precision = raycaster.linePrecision;
        var precisionSq = precision * precision;

        var geometry = mesh.geometry;

        if (!geometry)
            return;

        inverseMatrix.getInverse(mesh.matrixWorld);
        ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

        var vStart = new THREE.Vector3();
        var vEnd = new THREE.Vector3();
        var interSegment = new THREE.Vector3();
        var interRay = new THREE.Vector3();
        var step = mesh.mode === THREE.LineStrip ? 1 : 2;
        var positions, stride, distance, distSq;
        var i;

        if (geometry instanceof THREE.BufferGeometry) {

            var attributes = geometry.attributes;

            if (attributes.index !== undefined) {

                var indices = geometry.ib ? geometry.ib : attributes.index.array;
                positions = geometry.vb ? geometry.vb : attributes.position.array;
                stride = geometry.vb ? geometry.vbstride : 3;
                var offsets = geometry.offsets;

                if (!offsets || offsets.length === 0) {

                    offsets = [{ start: 0, count: indices.length, index: 0 }];

                }

                for (var oi = 0; oi < offsets.length; oi++) {

                    var start = offsets[oi].start;
                    var count = offsets[oi].count;
                    var index = offsets[oi].index;

                    for (i = start; i < start + count - 1; i += step) {

                        var a = index + indices[i];
                        var b = index + indices[i + 1];

                        vStart.fromArray(positions, a * stride);
                        vEnd.fromArray(positions, b * stride);

                        distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);

                        if (distSq > precisionSq) continue;

                        distance = ray.origin.distanceTo(interRay);

                        if (distance < raycaster.near || distance > raycaster.far) continue;

                        intersects.push({

                            distance: distance,
                            // What do we want? intersection point on the ray or on the segment??
                            // point: raycaster.ray.at( distance ),
                            point: interSegment.clone().applyMatrix4(mesh.matrixWorld),
                            face: null,
                            faceIndex: null,
                            fragId: mesh.fragId,
                            dbId: mesh.dbId

                        });

                    }

                }

            } else {

                positions = geometry.vb ? geometry.vb : attributes.position.array;
                stride = geometry.vb ? geometry.vbstride : 3;

                for (i = 0; i < positions.length / stride - 1; i += step) {

                    vStart.fromArray(positions, stride * i);
                    vEnd.fromArray(positions, stride * i + stride);

                    distSq = ray.distanceSqToSegment(vStart, vEnd, interRay, interSegment);

                    if (distSq > precisionSq) continue;

                    distance = ray.origin.distanceTo(interRay);

                    if (distance < raycaster.near || distance > raycaster.far) continue;

                    intersects.push({

                        distance: distance,
                        // What do we want? intersection point on the ray or on the segment??
                        // point: raycaster.ray.at( distance ),
                        point: interSegment.clone().applyMatrix4(mesh.matrixWorld),
                        face: null,
                        faceIndex: null,
                        fragId: mesh.fragId,
                        dbId: mesh.dbId
                    });

                }

            }

        }
    }


    function rayCast(mesh, raycaster, intersects) {

        if (mesh.isLine)
            lineRayCast(mesh, raycaster, intersects);
        else
            meshRayCast(mesh, raycaster, intersects);

    }


    function intersectObjectRec(object, raycaster, intersects, recursive) {

        if (object instanceof THREE.Mesh)
            rayCast(object, raycaster, intersects); //use our extended impl in case of Mesh.
        else
            object.raycast(raycaster, intersects); //fall back to normal THREE.js impl

        if (recursive === true) {

            var children = object.children;

            for (var i = 0, l = children.length; i < l; i++) {

                intersectObjectRec(children[i], raycaster, intersects, true);

            }

        }

    }

    var descSort = function (a, b) {
        return a.distance - b.distance;
    };

    function intersectObject(object, raycaster, intersects, recursive) {
        intersectObjectRec(object, raycaster, intersects, recursive);
        intersects.sort(descSort);
    }


    return {
        meshRayCast: meshRayCast,
        lineRayCast: lineRayCast,
        rayCast: rayCast,
        intersectObject: intersectObject
    };
        
});