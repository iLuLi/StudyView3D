define(function() {
    'use strict';
    /**
     * Convenience class encapsulating a single fragment in a given FragmentList.
     * Use sparingly, as it is expensive to have those for every fragment in memory.
     */
    function FragmentPointer(frags, fragId) {
        
        this.frags = frags;    // fragment list
        this.fragId = fragId;   // id of a fragment in frags

        // used by MeshAnimation
        this.scale = null;
        this.quaternion = null;
        this.position = null;
    }

    FragmentPointer.prototype.getWorldMatrix = function (dst) {

        return this.frags.getWorldMatrix(this.fragId, dst);

    };

    FragmentPointer.prototype.getWorldBounds = function (dst) {

        return this.frags.getWorldBounds(this.fragId, dst);

    };

    /**
     * Sets this.scale / this.quaternion / this.position to the anim transform of the the fragment this.fragId.
     * @returns {bool} True if an animation transform is set. Otherwise, it returns false and transform is set to identity.
     */
    FragmentPointer.prototype.getAnimTransform = function () {

        if (!this.scale) {
            this.scale = new THREE.Vector3(1, 1, 1);
            this.quaternion = new THREE.Quaternion(0, 0, 0, 1);
            this.position = new THREE.Vector3(0, 0, 0);
        }

        return this.frags.getAnimTransform(this.fragId, this.scale, this.quaternion, this.position);

    };

    // Applies current scale/quaternion/position to the fragment.
    FragmentPointer.prototype.updateAnimTransform = function () {

        if (!this.scale) {
            this.scale = new THREE.Vector3(1, 1, 1);
            this.quaternion = new THREE.Quaternion(0, 0, 0, 1);
            this.position = new THREE.Vector3(0, 0, 0);
        }

        this.frags.updateAnimTransform(this.fragId, this.scale, this.quaternion, this.position);
    };

    FragmentPointer.prototype.getMaterial = function () {

        return this.frags.getMaterial(this.fragId);

    };

    FragmentPointer.prototype.setMaterial = function (material) {

        return this.frags.setMaterial(this.fragId, material);

    };

    return FragmentPointer;
});