define([
    './InterpolationType',
    './Animation'
], function(INTERPOLATION_TYPE, Animation) {
    'use strict';
    var MeshAnimation = function (root, data, animator) {
        Animation.call(this, root, data, animator);
        //this.originalMatrix = root.matrix.clone();
        this.localMatrix = new THREE.Matrix4();

        this.root.getAnimTransform();
        this.relativeTransform = (data.custom && data.custom.transform && data.custom.transform === "abs") ? false : true;

        /*
        if (this.relativeTransform) {
            //this.root.updateMatrixWorld();
        } else {
            
        }
        */
    };

    MeshAnimation.prototype = Object.create(Animation.prototype);
    MeshAnimation.prototype.constructor = MeshAnimation;
    MeshAnimation.prototype.keyTypes = ["pos", "rot", "scl"];
    MeshAnimation.prototype.defaultKey = { pos: 0, rot: 0, scl: 0 };

    MeshAnimation.prototype.update = (function () {
        var points = [];
        var target;
        var newVector;
        var newQuat;

        function init_three() {
            if (target)
                return;

            target = new THREE.Vector3();
            newVector = new THREE.Vector3();
            newQuat = new THREE.Quaternion();
        }

        return function (delta) {
            if (this.isPlaying === false) return;

            this.currentTime += delta * this.timeScale;

            init_three();

            this.resetIfLooped();

            // bail out if out of range when playing
            if (this.isPlayingOutOfRange()) return;

            for (var h = 0, hl = this.hierarchy.length; h < hl; h++) {
                var object = this.hierarchy[h];
                var animationCache = object.animationCache[this.data.name];

                // loop through keys
                for (var t = 0; t < this.keyTypes.length; t++) {
                    var type = this.keyTypes[t];
                    var prevKey = animationCache.prevKey[type];
                    var nextKey = animationCache.nextKey[type];

                    if (nextKey.time <= this.currentTime || prevKey.time >= this.currentTime) {
                        prevKey = this.data.hierarchy[h].keys[0];
                        nextKey = this.getNextKeyWith(type, h, 1);

                        while (nextKey.time < this.currentTime && nextKey.index > prevKey.index) {
                            prevKey = nextKey;
                            nextKey = this.getNextKeyWith(type, h, nextKey.index + 1);
                        }
                        animationCache.prevKey[type] = prevKey;
                        animationCache.nextKey[type] = nextKey;
                    }

                    var prevXYZ = prevKey[type];
                    var nextXYZ = nextKey[type];

                    // skip if no key or no change in key values
                    if (nextKey.time === prevKey.time || prevXYZ === undefined || nextXYZ === undefined) continue;

                    var scale = (this.currentTime - prevKey.time) / (nextKey.time - prevKey.time);
                    if (scale < 0) scale = 0;
                    if (scale > 1) scale = 1;

                    // interpolate
                    if (type === "pos") {
                        if (this.interpolationType === INTERPOLATION_TYPE.LINEAR) {
                            newVector.x = prevXYZ[0] + (nextXYZ[0] - prevXYZ[0]) * scale;
                            newVector.y = prevXYZ[1] + (nextXYZ[1] - prevXYZ[1]) * scale;
                            newVector.z = prevXYZ[2] + (nextXYZ[2] - prevXYZ[2]) * scale;
                            object.position.copy(newVector);
                        } else /*if (this.interpolationType === INTERPOLATION_TYPE.CATMULLROM ||
                        this.interpolationType === INTERPOLATION_TYPE.CATMULLROM_FORWARD)*/ {
                            points[0] = this.getPrevKeyWith("pos", h, prevKey.index - 1)["pos"];
                            points[1] = prevXYZ;
                            points[2] = nextXYZ;
                            points[3] = this.getNextKeyWith("pos", h, nextKey.index + 1)["pos"];

                            scale = scale * 0.33 + 0.33;

                            var currentPoint = interpolateCatmullRom(points, scale);
                            newVector.x = currentPoint[0];
                            newVector.y = currentPoint[1];
                            newVector.z = currentPoint[2];
                            object.position.copy(newVector);

                            if (this.interpolationType === INTERPOLATION_TYPE.CATMULLROM_FORWARD) {
                                var forwardPoint = interpolateCatmullRom(points, scale * 1.01);

                                target.set(forwardPoint[0], forwardPoint[1], forwardPoint[2]);
                                target.sub(vector);
                                target.y = 0;
                                target.normalize();

                                var angle = Math.atan2(target.x, target.z);
                                object.rotation.set(0, angle, 0);
                            }
                        }
                    } else if (type === "rot") {
                        THREE.Quaternion.slerp(prevXYZ, nextXYZ, newQuat, scale);
                        object.quaternion.copy(newQuat);
                    } else if (type === "scl") {
                        newVector.x = prevXYZ[0] + (nextXYZ[0] - prevXYZ[0]) * scale;
                        newVector.y = prevXYZ[1] + (nextXYZ[1] - prevXYZ[1]) * scale;
                        newVector.z = prevXYZ[2] + (nextXYZ[2] - prevXYZ[2]) * scale;
                        object.scale.copy(newVector);
                    }
                }

                if (this.relativeTransform) {
                    // compose local transform and multiply to original transform
                    object.updateAnimTransform();
                } else {
                    //object.matrixAutoUpdate = true;
                    //object.matrixWorldNeedsUpdate = true;
                }

                // update world matrix so scene bounds can be set correctly
                //object.updateMatrixWorld();
            }
        };
    })();

    // Catmull-Rom spline
    function interpolateCatmullRom(points, scale) {
        function interpolate(p0, p1, p2, p3, t, t2, t3) {
            var v0 = (p2 - p0) * 0.5,
                v1 = (p3 - p1) * 0.5;

            return (2 * (p1 - p2) + v0 + v1) * t3 + (-3 * (p1 - p2) - 2 * v0 - v1) * t2 + v0 * t + p1;
        }

        var c = [], v3 = [],
        point, intPoint, weight, w2, w3,
        pa, pb, pc, pd;

        point = (points.length - 1) * scale;
        intPoint = Math.floor(point);
        weight = point - intPoint;

        c[0] = intPoint === 0 ? intPoint : intPoint - 1;
        c[1] = intPoint;
        c[2] = intPoint > points.length - 2 ? intPoint : intPoint + 1;
        c[3] = intPoint > points.length - 3 ? intPoint : intPoint + 2;

        pa = points[c[0]];
        pb = points[c[1]];
        pc = points[c[2]];
        pd = points[c[3]];

        w2 = weight * weight;
        w3 = weight * w2;

        v3[0] = interpolate(pa[0], pb[0], pc[0], pd[0], weight, w2, w3);
        v3[1] = interpolate(pa[1], pb[1], pc[1], pd[1], weight, w2, w3);
        v3[2] = interpolate(pa[2], pb[2], pc[2], pd[2], weight, w2, w3);

        return v3;
    }

    return MeshAnimation;
});