define([
    '../Constants/Global'
], function(Global) {
    'use strict';

    //Encapsulates frustum-box intersection logic
    function FrustumIntersector() {
        this.frustum = new THREE.Frustum();
        this.viewProj = new THREE.Matrix4();
        this.viewDir = [0, 0, 1];
        this.ar = 1.0;
        this.viewport = new THREE.Vector3(1, 1, 1);
        this.areaConv = 1;
        this.areaCullThreshold = 1; // The pixel size of the object projected on screen, will be culled if less than this value.
    }

    FrustumIntersector.prototype.reset = function (camera) {
        this.viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromMatrix(this.viewProj);
        var vm = camera.matrixWorldInverse.elements;
        this.ar = camera.aspect;
        this.viewDir[0] = -vm[2];
        this.viewDir[1] = -vm[6];
        this.viewDir[2] = -vm[10];
        this.areaConv = (camera.clientWidth * camera.clientHeight) / 4;
    };

    FrustumIntersector.prototype.projectedArea = (function () {

        var points;
        var tmpBox;

        function init_three() {
            if (!points) {
                points = [
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3(),
                    new THREE.Vector3()
                ];
                tmpBox = new THREE.Box2();
            }
        }

        function applyProjection(p, m) {

            var x = p.x, y = p.y, z = p.z;
            var e = m.elements;

            var w = (e[3] * x + e[7] * y + e[11] * z + e[15]);

            //This is the difference between this function and
            //the normal THREE.Vector3.applyProjection. We avoid
            //inverting the positions of point behind the camera,
            //otherwise our screen area computation can result in
            //boxes getting clipped out when they are in fact partially visible.
            if (w < 0)
                w = -w;

            var d = 1.0 / w;

            p.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * d;
            p.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * d;

            //We also don't need the Z
            //p.z = ( e[ 2 ] * x + e[ 6 ] * y + e[ 10 ] * z + e[ 14 ] ) * d;
        }

        return function (box) {

            init_three();

            if (box.empty())
                return 0;

            var matrix = this.viewProj;

            // NOTE: I am using a binary pattern to specify all 2^3 combinations below
            points[0].set(box.min.x, box.min.y, box.min.z); // 000
            points[1].set(box.min.x, box.min.y, box.max.z); // 001
            points[2].set(box.min.x, box.max.y, box.min.z); // 010
            points[3].set(box.min.x, box.max.y, box.max.z); // 011
            points[4].set(box.max.x, box.min.y, box.min.z); // 100
            points[5].set(box.max.x, box.min.y, box.max.z); // 101
            points[6].set(box.max.x, box.max.y, box.min.z); // 110
            points[7].set(box.max.x, box.max.y, box.max.z); // 111

            for (var i = 0; i < 8; i++)
                applyProjection(points[i], matrix);

            tmpBox.makeEmpty();
            tmpBox.setFromPoints(points);

            // Clamp both min and max value between [-1.0, 1.0]
            if (tmpBox.min.x < -1.0)
                tmpBox.min.x = -1.0;
            if (tmpBox.min.x > 1.0)
                tmpBox.min.x = 1.0;
            if (tmpBox.min.y < -1.0)
                tmpBox.min.y = -1.0;
            if (tmpBox.min.y > 1.0)
                tmpBox.min.y = 1.0;

            if (tmpBox.max.x > 1.0)
                tmpBox.max.x = 1.0;
            if (tmpBox.max.x < -1.0)
                tmpBox.max.x = -1.0;
            if (tmpBox.max.y > 1.0)
                tmpBox.max.y = 1.0;
            if (tmpBox.max.y < -1.0)
                tmpBox.max.y = -1.0;

            return (tmpBox.max.x - tmpBox.min.x) * (tmpBox.max.y - tmpBox.min.y);
        };

    })();

    FrustumIntersector.prototype.estimateDepth = function (bbox) {

        var e = this.viewProj.elements;

        // Take center of box and find its distance from the eye.
        var x = (bbox.min.x + bbox.max.x) / 2.0;
        var y = (bbox.min.y + bbox.max.y) / 2.0;
        var z = (bbox.min.z + bbox.max.z) / 2.0;

        var w = e[3] * x + e[7] * y + e[11] * z + e[15];

        var d = 1.0 / (e[3] * x + e[7] * y + e[11] * z + e[15]);

        return (e[2] * x + e[6] * y + e[10] * z + e[14]) * d;

    };


    FrustumIntersector.prototype.intersectsBox = (function () {

        //Copied from three.js and modified to return separate
        //value for full containment versus intersection.
        //Return values: 0 -> outside, 1 -> intersects, 2 -> contains
        var p1, p2;

        function init_three() {
            if (!p1) {
                p1 = new THREE.Vector3();
                p2 = new THREE.Vector3();
            }
        }

        return function (box) {

            init_three();

            var planes = this.frustum.planes;
            var contained = 0;

            for (var i = 0; i < 6; i++) {

                var plane = planes[i];

                p1.x = plane.normal.x > 0 ? box.min.x : box.max.x;
                p2.x = plane.normal.x > 0 ? box.max.x : box.min.x;
                p1.y = plane.normal.y > 0 ? box.min.y : box.max.y;
                p2.y = plane.normal.y > 0 ? box.max.y : box.min.y;
                p1.z = plane.normal.z > 0 ? box.min.z : box.max.z;
                p2.z = plane.normal.z > 0 ? box.max.z : box.min.z;

                var d1 = plane.distanceToPoint(p1);
                var d2 = plane.distanceToPoint(p2);

                // if both outside plane, no intersection

                if (d1 < 0 && d2 < 0) {

                    return Global.OUTSIDE;

                }

                if (d1 > 0 && d2 > 0) {

                    contained++;

                }
            }

            return (contained == 6) ? Global.CONTAINS : Global.INTERSECTS;
        };


    })();


    return FrustumIntersector;
});