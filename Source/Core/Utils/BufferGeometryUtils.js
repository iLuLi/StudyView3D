define([
    '../Logger',
    '../Constants/Global'
], function(Logger, Global) {
    'use strict';
    //Finds a precanned BufferAttribute corresponding to the given
    //attribute data, so that we don't have to allocate the same exact
    //one over and over and over.
    var bufattrs = {};
    
    function findBufferAttribute(attributeName, attributeData, numInstances) {

        //Note .array could be undefined in case we are using
        //an interleaved buffer.
        var attr;
        if (attributeData.array) {
            attr = new THREE.BufferAttribute(attributeData.array, attributeData.itemSize);
        }
        else {
            var id = attributeName + "|" +
                attributeData.bytesPerItem + "|" +
                attributeData.normalize + "|" +
                attributeData.isPattern + "|" +
                attributeData.divisor + "|" +
                attributeData.offset;

            attr = bufattrs[id];
            if (attr)
                return attr;

            attr = new THREE.BufferAttribute(undefined, attributeData.itemSize);
            bufattrs[id] = attr;
        }

        attr.bytesPerItem = attributeData.bytesPerItem;
        attr.normalize = attributeData.normalize;
        attr.isPattern = attributeData.isPattern;

        if (numInstances) {
            attr.divisor = attributeData.divisor;
        }

        if (attributeData.array) {
            //Is the data for the attribute specified separately
            //from the interleaved VB?
        }
        else if (attributeData.hasOwnProperty("offset")) {
            //If the attribute is in the interleaved VB, it has
            //an offset into it.
            attr.itemOffset = attributeData.offset;
        }
        else {
            Logger.warn("VB attribute is neither interleaved nor separate. Something is wrong with the buffer specificaiton.");
        }

        return attr;
    }

    var attrKeys = {};

    function findAttributesKeys(geometry) {
        var key = "";

        for (var p in geometry.attributes)
            key += p + "|";

        var res = attrKeys[key];
        if (res)
            return res;

        res = Object.keys(geometry.attributes);
        attrKeys[key] = res;

        return res;
    }


    var indexAttr;
    var LmvBufferGeometry;
    var idcounter = 1;

    function init_three_bufgeom() {

        indexAttr = new THREE.BufferAttribute(undefined, 1);

        LmvBufferGeometry = function () {

            //Avoid calling the superclass constructor for performance reasons.
            //Skips the creation of a uuid and defining an accessor for the .id property.
            //THREE.BufferGeometry.call(this);

            //Null those out since we don't need them.
            this.uuid = null;
            this.name = null;
            this.id = idcounter++;

            this.attributes = {};
            this.attributesKeys = [];

            this.drawcalls = [];
            this.offsets = this.drawcalls; // backwards compatibility

            this.boundingBox = null;
            this.boundingSphere = null;

            this.numInstances = undefined;
            this.streamingDraw = false;
            this.streamingIndex = false;
            this.svfid = undefined;

            this.vb = null;
            this.vbbuffer = undefined;
            this.ib = null;
            this.ibbuffer = undefined;
            this.vaos = undefined;

            this.vbNeedsUpdate = false;
            this.vbstride = 0;
            this.byteSize = 0;

            this.attributesKeys = undefined;
            this.__webglInit = false;
        };

        LmvBufferGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
        LmvBufferGeometry.prototype.constructor = LmvBufferGeometry;

    }

    function createLmvBufferGeometry() {
        if (!LmvBufferGeometry)
            init_three_bufgeom();

        return new LmvBufferGeometry();
    }


    //Converts a mesh description passed back from worker threads into a renderable three.js
    //compatible LmvBufferGeometry.
    //Sets various extra flags we need.
    function meshToGeometry(mdata) {

        var mesh = mdata.mesh;
        var geometry = createLmvBufferGeometry();


        geometry.byteSize = 0;

        geometry.vb = mesh.vb;
        geometry.vbbuffer = undefined;
        geometry.vbNeedsUpdate = true;
        geometry.byteSize += mesh.vb.byteLength;

        geometry.vbstride = mesh.vbstride;
        if (mesh.isLines) /* mesh is SVF lines */
            geometry.isLines = mesh.isLines;
        if (mdata.is2d) /* mesh is from F2D */
            geometry.is2d = true;

        geometry.numInstances = mesh.numInstances;

        for (var attributeName in mesh.vblayout) {
            var attributeData = mesh.vblayout[attributeName];

            //geometry.addAttribute(attributeName, findBufferAttribute(attributeData, geometry.numInstances));
            geometry.attributes[attributeName] = findBufferAttribute(attributeName, attributeData, geometry.numInstances);
        }

        //Index buffer setup
        if (!Global.memoryOptimizedLoading) {
            geometry.addAttribute("index", new THREE.BufferAttribute(mesh.indices, 1));
        } else {

            geometry.attributes.index = indexAttr;
            geometry.ib = mesh.indices;
            geometry.ibbuffer = undefined;
        }

        geometry.attributesKeys = findAttributesKeys(geometry);

        geometry.byteSize += mesh.indices.byteLength;

        //TODO: Not sure chunking into list of smaller offset/counts
        //is required for LMV data since it's already broken up.
        //if (mesh.indices.length > 65535)
        if (mesh.vb.length / mesh.vbstride > 65535)
            Logger.warn("Mesh with >65535 vertices. It will fail to draw.");

        //TODO: This is a transient object that gets freed once the geometry
        //is added to the GeometryList. We can save on the object creation
        //eventually when we do micro optimizations.
        geometry.boundingBox = new THREE.Box3().copy(mesh.boundingBox);
        geometry.boundingSphere = new THREE.Sphere().copy(mesh.boundingSphere);

        //MEM
        geometry.drawcalls = null;
        geometry.offsets = null;

        mdata.geometry = geometry;

        mdata.mesh = null;
    }



    return {
        meshToGeometry: meshToGeometry
    };
});