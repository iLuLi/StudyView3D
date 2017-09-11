define(['../Constants/SelectionMode'], function(SelectionMode) {;
    'use strict'
    function Selector(viewer, model) {
        
        //Selection support
        var _this = this;
        this.selectedObjectIds = {};
        this.selectionCount = 0;
        this.selectionMode = SelectionMode.LEAF_OBJECT;

        var selectedParentMap = {};

        function getInstanceTree() {
            return model.getData().instanceTree;
        }

        function fireSelectionChangedEvent() {
            //Nothing here, events are done by the MultiModelSelector now.
        }


        function unmarkObject(dbId) {

            var it = getInstanceTree();

            if (selectedParentMap[dbId] > 0) {
                selectedParentMap[dbId]--;
                if (selectedParentMap[dbId] == 0) {
                    viewer.highlightObjectNode(model, dbId, false);
                }

            } else if (selectedParentMap[dbId] < 0) {
                throw ("Selection State machine broken. Negatively selected object!");
            }

            if (it) {
                it.enumNodeChildren(dbId, function (childId) {
                    unmarkObject(childId);
                }, false);
            }
        }


        function markObject(dbId, isChild) {

            var it = getInstanceTree();

            if (selectedParentMap[dbId]) {
                selectedParentMap[dbId]++;
            } else {
                viewer.highlightObjectNode(model, dbId, true, isChild);
                selectedParentMap[dbId] = 1;
            }

            if (it) {
                it.enumNodeChildren(dbId, function (childId) {
                    markObject(childId, true);
                }, false);
            }
        }

        function isSelected(dbId) {

            if ((dbId !== undefined) && _this.selectedObjectIds[dbId])
                return true;
        }


        function select(dbId) {

            var it = getInstanceTree();
            if (it) {
                dbId = it.findNodeForSelection(dbId, _this.selectionMode);

                if (!it.isNodeSelectable(dbId))
                    return;
            }

            var found = isSelected(dbId);
            if (!found) {
                _this.selectedObjectIds[dbId] = dbId;
                _this.selectionCount++;
                markObject(dbId);
            }
        }

        function deselect(dbId) {

            var found = isSelected(dbId);
            if (found) {
                unmarkObject(dbId);
                _this.selectedObjectIds[dbId] = 0;
                _this.selectionCount--;
            }
        }

        function selectionIsEqual(dbNodeArray) {
            if (_this.selectionCount !== dbNodeArray.length)
                return false;

            for (var i = 0; i < dbNodeArray.length; i++) {
                if (!isSelected(dbNodeArray[i]))
                    return false;
            }
            return true;
        }


        this.getInstanceTree = getInstanceTree;

        this.getSelectionLength = function () {
            return _this.selectionCount;
        };


        this.getSelection = function () {
            var ret = [];
            var sset = _this.selectedObjectIds;
            for (var p in sset) {
                if (sset[p]) {
                    var dbId = parseInt(p);
                    ret.push(dbId);
                }
            }

            return ret;
        };

        this.clearSelection = function (nofire) {
            if (this.selectionCount > 0) {
                var sset = _this.selectedObjectIds;
                for (var p in sset) {
                    var dbId = parseInt(p);
                    if (dbId !== undefined)
                        unmarkObject(dbId);
                }
                _this.selectedObjectIds = {};
                _this.selectionCount = 0;

                if (!nofire)
                    fireSelectionChangedEvent();
            }
        };

        this.deselectInvisible = function () {
            var changed = false;

            var sset = _this.selectedObjectIds;
            var it = getInstanceTree();
            var visMan = viewer.visibilityManager;
            for (var p in sset) {
                var dbId = parseInt(p);
                if (dbId && !visMan.isNodeVisible(model, dbId)) {
                    deselect(dbId);
                    changed = true;
                }
            }

            if (changed) {
                fireSelectionChangedEvent();
            }

            return changed;
        };


        // TODO: Optimize this so both select and toggleSelection don't have to lookup the node index.
        this.toggleSelection = function (dbId) {

            if (!dbId) {
                avp.logger.error("Attempting to select node 0.");
                return;
            }

            if (!isSelected(dbId)) {
                select(dbId);
            } else {
                deselect(dbId);
            }
            fireSelectionChangedEvent();
        };


        this.setSelectionMode = function (mode) {
            this.clearSelection(true);
            this.selectionMode = mode;
        };

        this.setSelection = function (dbNodeArray) {

            if (selectionIsEqual(dbNodeArray))
                return;

            this.clearSelection(true);

            if (dbNodeArray == null || dbNodeArray.length === 0)
                return;

            for (var i = 0; i < dbNodeArray.length; i++) {
                select(dbNodeArray[i]);
            }

            fireSelectionChangedEvent();
        };


        this.getSelectionBounds = function () {
            var bounds = new THREE.Box3();
            var box = new THREE.Box3();

            var instanceTree = getInstanceTree();
            var fragList = model.getFragmentList();

            var sset = _this.selectedObjectIds;
            for (var p in sset) {
                var dbId = parseInt(p);
                instanceTree.enumNodeFragments(dbId, function (fragId) {
                    fragList.getWorldBounds(fragId, box);
                    bounds.union(box);
                }, true);
            }

            return bounds;
        };

        this.getSelectionVisibility = function () {
            var hasVisible = false,
                hasHidden = false;

            var sset = _this.selectedObjectIds;
            for (var p in sset) {
                var dbId = parseInt(p);
                if (dbId) {
                    var it = getInstanceTree();
                    if (!it || !it.isNodeHidden(dbId)) {
                        hasVisible = true;
                    } else {
                        hasHidden = true;
                    }
                    if (hasVisible && hasHidden) {
                        break;
                    }
                }
            }

            return { hasVisible: hasVisible, hasHidden: hasHidden };
        };

        this.dtor = function () {
            this.selectedObjectIds = null;
        };

    }

    return Selector;
});