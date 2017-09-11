define([
    '../../Core/Logger'
], function (Logger) {
    'use strict';
    function CommentFactory(viewer) {

        this.viewer = viewer;
        this.geometryItem = null;
        this.mappingPromise = null; // Lazy initialization upon first usage.
        this.filter = {
            seedURN: true,
            objectSet: true,
            viewport: true,
            tags: true, // Animation extension uses tags.
            renderOptions: false,
            cutplanes: true
        };
    }

    var proto = CommentFactory.prototype;

    /**
     * Invoked when extension is unloaded
     */
    proto.destroy = function () {
        this.viewer = null;
        this.geometryItem = null;
    };

    /**
     * Creates a comment object that can be posted to the comment end point.
     * @param {Object} [dataBag] - Object bag with optional values
     * @return {Object} a comment object
     */
    proto.createCommentObj = function (dataBag) {
        var commentObj = this.viewer.getState(this.filter);
        this.injectInfo(commentObj, dataBag);
        return commentObj;
    };

    /**
     * Populates comment object with data common
     * @param {Object} commentObj
     * @param {Object} [dataBag] - Object bag with optional values
     */
    proto.injectInfo = function (commentObj, dataBag) {
        commentObj["body"] = dataBag.message || "";
        commentObj["status"] = 'open';
        commentObj["jsonVersion"] = "2.0";
        commentObj["inputSource"] = "Web";
        commentObj["type"] = "geometry";

        // These lines include model's sheet info within the document.
        if (this.geometryItem) {
            commentObj["layoutName"] = this.geometryItem.guid;
            commentObj["layoutIndex"] = this.geometryItem.order;
        }

        if (dataBag.point3d) {
            var val = dataBag.point3d;
            if (val instanceof THREE.Vector3) { // Check if we have a THREE.Vector3 value
                val = val.toArray();
            }
            this.pushTag(commentObj, { name: "nodeOffset", value: val });
        }
    };

    /**
     * Comments support "tags", which can be seen as a non-structured key-value pair collection.
     * @param {Object} dbComment
     * @param {Object} tagObject
     */
    proto.pushTag = function (dbComment, tagObject) {
        if (!Array.isArray(dbComment["tags"])) {
            dbComment["tags"] = [];
        }
        dbComment["tags"].push(tagObject);
    };

    /**
     * Returns an object containing the key/value pair for a specified tag key. Null if key not found.
     *
     * @param {Object} dbComment - dbComment to inspect
     * @param {String} tagKey - tag we are looking for.
     * @returns {Object|null} - Object containing the key/value pair for the specified tag-key; null if not found.
     */
    proto.getTag = function (dbComment, tagKey) {
        var tags = dbComment["tags"];
        if (tags && Array.isArray(tags)) {
            for (var i = 0, len = tags.length; i < len; ++i) {
                if (tags[i]["name"] === tagKey) {
                    return tags[i];
                }
            }
        }
        return null;
    };

    /**
     * Returns a value for a specified tag key. Null if key not found.
     *
     * @param {Object} dbComment - dbComment to inspect
     * @param {String} tagKey - tag we are looking for.
     * @param {String} [valueNotFound] - Returned back when key is not found. Defaults to null.
     * @returns {String|null} - String value associated to the tag, or valueNotFound if not found.
     */
    proto.getTagValue = function (dbComment, tagKey, valueNotFound) {
        var tag = this.getTag(dbComment, tagKey);
        if (tag) {
            return tag.value;
        }
        return valueNotFound || null;
    };

    /**
     * Applies transformations to make the commentObj compatible with other
     * offline Autodesk applications (such as Fusion 360).
     *
     * WARNING: Never call this function more than once per commentObj.
     *
     * @param {Object} commentObj
     * @return {Promise}
     */
    proto.exportCommentObj = function (commentObj) {
        var self = this;
        return new Promise(function (resolve /*,reject*/) { // This method will not reject()
            self.applyGlobalOffset(commentObj);
            self.getMappingPromise().then(function (mapping) {
                self.mapObjectSetLmvToExternal(commentObj, mapping, function onMapObjectSetLmvToExternal(value) {
                    resolve(value);
                });
            });
        });
    };

    /**
     * Applies transformations to make the commentObj compatible with LMV.
     * May be required when comment was generated from/for offline Autodesk
     * applications (Such as Fusion 360)
     *
     * WARNING: Never call this function more than once per commentObj.
     *
     * @param commentObj
     * @return {Promise}
     */
    proto.importCommentObj = function (commentObj) {
        // We need to clone the comment object, but only the values that matter.
        // Values that matter are keys within this.filter

        // First make a shallow copy
        var copy = {};
        for (var key in this.filter) {
            if (this.filter.hasOwnProperty(key) && commentObj.hasOwnProperty(key)) {
                copy[key] = commentObj[key];
            }
        }

        // Now deep copy those elements that are used by the filter
        var deepCopy = JSON.parse(JSON.stringify(copy));

        var self = this;
        return new Promise(function (resolve) {
            self.getMappingPromise().then(function (mapping) {

                // Transform "external" objectSet values into "lmv" ones
                self.mapObjectSetExternalToLmv(deepCopy, mapping);

                // Finally, transform the data before returning it back for restoration.
                self.removeGlobalOffset(deepCopy);
                resolve(deepCopy);
            });
        });
    };

    /////////////////////////////
    //// AUXILIARY FUNCTIONS ////
    /////////////////////////////

    /**
     * To make the Viewer's state associated in the comment compatible with
     * external apps, make sure that LMV's global offset gets removed using
     * this method.
     *
     * WARNING: Call this method only once per created commentObj
     *
     * @param {Object} commentObj - output of createComment() function
     * @returns {boolean} - Transformation applied or not
     */
    proto.applyGlobalOffset = function (commentObj) {
        var globalOffset = this.viewer.model.getData().globalOffset;
        if (globalOffset) { // globalOffset is null for 2d models.

            // viewport
            this.applyOffsetToCamera(commentObj.viewport, globalOffset);

            // nodeOffset
            var keyValuePair = this.getTag(commentObj, "nodeOffset");
            if (keyValuePair) {
                this.applyOffset(keyValuePair["value"], globalOffset);
            }

            // DONE
            return true;
        }
        return false;
    };

    /**
     * When loading an comment object created for/from an external application,
     * this method will apply LMV's globalOffset transformation.
 
     * WARNING: Call this method only once per commentObj
     *
     * @param {Object} commentObj - output of createComment() function
     * @returns {boolean} - Transformation applied or not
     */
    proto.removeGlobalOffset = function (commentObj) {
        var globalOffset = this.viewer.model.getData().globalOffset;
        if (globalOffset) {
            var invGlobalOffset = { x: -globalOffset.x, y: -globalOffset.y, z: -globalOffset.z };

            // viewport
            this.applyOffsetToCamera(commentObj.viewport, invGlobalOffset);

            // nodeOffset
            var keyValuePair = this.getTag(commentObj, "nodeOffset");
            if (keyValuePair) {
                this.applyOffset(keyValuePair["value"], invGlobalOffset);
            }

            return true;
        }
        return false;
    };

    /**
     *
     * @param {Object} viewport - viewport aspect of the ViewerState object
     * @param {Object} offset - {x:Number, y:Number, z:Number}
     * @private
     */
    proto.applyOffsetToCamera = function (viewport, offset) {

        if (!viewport || !offset) {
            return;
        }

        this.applyOffset(viewport['eye'], offset);
        this.applyOffset(viewport['target'], offset);
        this.applyOffset(viewport['pivotPoint'], offset);
    };

    /**
     * Applies an offset to a 3d point represented as an Array.<br>
     * Notice that THREE.Vector3 has method toArray().
     *
     * @param {Array} array - Array with 3 Number elements
     * @param {Object} offset - {x:Number, y:Number, z:Number}
     */
    proto.applyOffset = function (array, offset) {
        if (array) {

            // Make sure we are dealing with Numbers coming out of array[x]
            var value0 = Number(array[0]) + offset.x;
            var value1 = Number(array[1]) + offset.y;
            var value2 = Number(array[2]) + offset.z;

            array[0] = (typeof array[0] === "string") ? value0.toString() : value0;
            array[1] = (typeof array[1] === "string") ? value1.toString() : value1;
            array[2] = (typeof array[2] === "string") ? value2.toString() : value2;
        }
    };

    /**
     * Create
     * @param {Object} commentObj
     * @param {Object} mapping
     * @param {Function} resolve
     */
    proto.mapObjectSetLmvToExternal = function (commentObj, mapping, resolve) {
        if (!mapping) {
            resolve(commentObj);
        }

        // Avoid translating ids for 2d sheets (for now)
        if (this.viewer.model.is2d()) {
            resolve(commentObj);
        }

        var objectSetValues = this.getObjectSetElementWithIdType(commentObj.objectSet, 'lmv');
        var dbIds = [].concat(objectSetValues.id)
            .concat(objectSetValues.hidden)
            .concat(objectSetValues.isolated);
        uniq_fast(dbIds);

        this.viewer.model.getBulkProperties(dbIds, ['externalId'],
            function onSuccess(results) {

                var dbToExternal = {}; // Put results in an associative array:
                results.forEach(function (elem) {
                    dbToExternal[elem.dbId] = elem.externalId;
                });

                // Make a copy of the original object:
                var externalObjectSetValues = JSON.parse(JSON.stringify(objectSetValues));
                externalObjectSetValues['idType'] = 'external'; // Signals that we are using externalIds

                // Map them all!
                var mapIdToExternalId = function (dbId) {
                    return dbToExternal[dbId];
                };
                externalObjectSetValues.id = externalObjectSetValues.id.map(mapIdToExternalId);
                externalObjectSetValues.hidden = externalObjectSetValues.hidden.map(mapIdToExternalId);
                externalObjectSetValues.isolated = externalObjectSetValues.isolated.map(mapIdToExternalId);

                // Push copy to objectSet and resolve
                commentObj.objectSet.push(externalObjectSetValues);
                resolve(commentObj);
            },
            function onFailure() {
                // Something failed, ignore and continue
                resolve(commentObj);
            }
        );
    };

    // From Stack overflow
    // Removes duplicate entries.
    function uniq_fast(a) {
        var seen = {};
        var out = [];
        var len = a.length;
        var j = 0;
        for (var i = 0; i < len; i++) {
            var item = a[i];
            if (seen[item] !== 1) {
                seen[item] = 1;
                out[j++] = item;
            }
        }
        return out;
    }

    proto.mapObjectSetExternalToLmv = function (commentObj, idMapping) {
        if (!idMapping) {
            return;
        }

        var objectSetList = commentObj.objectSet;
        var objectSet = this.getObjectSetElementWithIdType(objectSetList, 'lmv');

        // Nothing to do, we already have lmv data values
        if (objectSet) {
            return;
        }

        // Else, no lmv objectSet element. Probably a comment coming from Fusion (or similar).
        // Create objectSet entry in index 0 with lmv values.
        var externalObjectSet = this.getObjectSetElementWithIdType(objectSetList, 'external');
        if (!externalObjectSet) {
            return;
        }

        var mapExternalToDbId = function (externalId) {
            return idMapping[externalId];
        };
        var lmvObjectSet = JSON.parse(JSON.stringify(externalObjectSet));

        // Map external ids back to lmv dbIds
        lmvObjectSet.id = lmvObjectSet.id.map(mapExternalToDbId);
        lmvObjectSet.isolated = lmvObjectSet.isolated.map(mapExternalToDbId);
        lmvObjectSet.hidden = lmvObjectSet.hidden.map(mapExternalToDbId);
        lmvObjectSet.idType = 'lmv';

        // Make sure we pushed it as the first element
        objectSetList.unshift(lmvObjectSet);
    };

    proto.getObjectSetElementWithIdType = function (objectSet, idType) {
        if (!objectSet || !Array.isArray(objectSet)) {
            return null;
        }
        for (var i = 0, len = objectSet.length; i < len; ++i) {
            if (objectSet[i].idType === idType) {
                return objectSet[i];
            }
        }
        return null;
    };

    /**
     * Lazy initialization of mapping and it's Promise.
     *
     * @returns {Promise}
     */
    proto.getMappingPromise = function () {
        if (!this.mappingPromise) {
            var self = this;
            this.mappingPromise = new Promise(
                function fetchMapping(resolve/*, reject*/) {
                    self.viewer.model.getExternalIdMapping(
                        function onSuccess(result) {
                            Logger.log("[Autodesk.Comment]Successfully fetched external id mapping.");
                            resolve(result);
                        },
                        function onFailure() {
                            Logger.error("[Autodesk.Comment]Failed to fetch the external id mapping.");
                            resolve(null);
                        }
                    );
                }
            );
        }
        return this.mappingPromise;
    };
    return CommentFactory;
});