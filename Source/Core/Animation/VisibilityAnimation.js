define([
    './InterpolationType',
    './Animation'
], function(INTERPOLATION_TYPE, Animation) {
    'use strict';
    var VisibilityAnimation = function (root, data, nodeId, animator) {
        Animation.call(this, root, data, animator);
        this.nodeId = nodeId;
        this.epsilon = 0.1;

        //Need to clone the material as it can be shared between many objects
        //and we need to modify it for this object specifically
        this.root.setMaterial(this.viewer.matman().cloneMaterial(root.getMaterial()));
    };

    VisibilityAnimation.prototype = Object.create(Animation.prototype);
    VisibilityAnimation.prototype.constructor = VisibilityAnimation;
    VisibilityAnimation.prototype.keyTypes = ["vis", "opa"];
    VisibilityAnimation.prototype.defaultKey = { viz: 1, opa: 1 };

    VisibilityAnimation.prototype.update = (function () {
        return function (delta) {
            if (this.isPlaying === false) return;

            this.currentTime += delta * this.timeScale;

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

                    var prevVis = prevKey[type];
                    var nextVis = nextKey[type];

                    // skip if no key or no change in key values
                    if (nextKey.time === prevKey.time || prevVis === undefined || nextVis === undefined) continue;

                    var material = object.getMaterial();

                    if (type === "vis") {
                        var isNextKey = Math.abs(this.currentTime - nextKey.time) < this.epsilon;
                        var key = isNextKey ? nextKey : prevKey;
                        var vis = isNextKey ? nextVis : prevVis;
                        this.viewer.visibilityManager.setNodeOff(this.nodeId, !vis);
                    } else if (type === "opa") {
                        var scale = (this.currentTime - prevKey.time) / (nextKey.time - prevKey.time);
                        if (scale < 0) scale = 0;
                        if (scale > 1) scale = 1;
                        var opacity = prevVis + (nextVis - prevVis) * scale;

                        material.transparent = (opacity !== 1);
                        material.opacity = opacity;
                        if (opacity > 0)
                            this.viewer.visibilityManager.setNodeOff(this.nodeId, false);
                    }
                }
            }
        };
    })();

    return VisibilityAnimation;
});