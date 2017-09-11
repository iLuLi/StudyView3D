define(function() {;
    'use strict'
    var SectionMesh = function (geometry, material, plane) {
        THREE.Mesh.call(this, geometry, material, false);

        this.plane = plane;
        this.planeVec = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
        this.connectivity = [];
        this.outlines = [];
    };

    SectionMesh.prototype = Object.create(THREE.Mesh.prototype);
    SectionMesh.prototype.constructor = SectionMesh;

    SectionMesh.prototype.update = function () {
        this.plane.normal.set(0, 0, 1);
        this.plane.normal.applyQuaternion(this.quaternion);

        var normal = this.plane.normal;
        var d = -1 * this.getWorldPosition().dot(normal);
        this.planeVec.set(normal.x, normal.y, normal.z, d);
        this.plane.constant = d;
    };

    return SectionMesh;
});