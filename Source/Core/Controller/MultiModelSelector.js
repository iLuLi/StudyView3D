define([
    './Selector',
    '../Constants/EventType'
], function(Selector, EventType) {
    'use strict';
    
    function MultiModelSelector(viewer) {

        var _models = [];

        this.addModel = function (model) {
            if (_models.indexOf(model) == -1) {
                model.selector = new Selector(viewer, model);
                _models.push(model);
            }
        };

        this.removeModel = function (model) {
            var idx = _models.indexOf(model);
            model.selector = null;
            _models.splice(idx, 1);
        };

        function warn() {
            if (_models.length > 1) {
                avp.logger.warn("This selection call does not yet support multiple models.");
            }
        }

        function fireAggregateSelectionChangedEvent() {

            var perModel = [];

            for (var i = 0; i < _models.length; i++) {
                var dbIdArray = [];
                var fragIdsArray = [];

                var sset = _models[i].selector.selectedObjectIds;
                var it = _models[i].selector.getInstanceTree();
                for (var p in sset) {
                    if (sset[p]) {
                        var dbId = parseInt(p);
                        if (dbId) {
                            dbIdArray.push(dbId);

                            if (it) {
                                it.enumNodeFragments(dbId, function (fragId) {
                                    fragIdsArray.push(fragId);
                                }, false);
                            }
                        }
                    }
                }

                if (dbIdArray.length) {
                    perModel.push({
                        fragIdsArray: fragIdsArray,
                        dbIdArray: dbIdArray,
                        nodeArray: dbIdArray,
                        model: _models[i]
                    });
                }
            }

            var event;

            //For backwards compatibility, fire the old selection change event
            //when there is just one model in the scene
            if (_models.length === 1) {
                event = {
                    type: EventType.SELECTION_CHANGED_EVENT,
                    fragIdsArray: perModel[0] ? perModel[0].fragIdsArray : [],
                    dbIdArray: perModel[0] ? perModel[0].dbIdArray : [],
                    nodeArray: perModel[0] ? perModel[0].dbIdArray : [],
                    model: _models[0]
                };
                viewer.api.fireEvent(event);
            }

            //Always fire the aggregate selection changed event
            event = {
                type: EventType.AGGREGATE_SELECTION_CHANGED_EVENT,
                selections: perModel
            };
            viewer.api.fireEvent(event);

        }


        function deselectInvisible() {

            var changed = false;

            for (var i = 0; i < _models.length; i++) {
                changed = _models[i].selector.deselectInvisible() || changed;
            }

            if (changed)
                fireAggregateSelectionChangedEvent();
        }


        this.getSelectionLength = function () {
            var total = 0;

            for (var i = 0; i < _models.length; i++) {
                total += _models[i].selector.getSelectionLength();
            }

            return total;
        };

        this.getSelection = function () {
            warn();
            if (_models.length > 1)
                avp.logger.warn("Use getAggregateSelection instead of getSelection when there are multiple models in the scene.");
            return _models[0].selector.getSelection();
        };

        this.getAggregateSelection = function () {
            var res = [];
            for (var i = 0; i < _models.length; i++) {
                var selset = _models[i].selector.getSelection();
                if (selset && selset.length)
                    res.push({ model: _models[i], selection: selset });
            }

            return res;
        };

        this.clearSelection = function (nofire) {
            for (var i = 0; i < _models.length; i++)
                _models[i].selector.clearSelection(nofire);

            if (!nofire)
                fireAggregateSelectionChangedEvent();
        };

        this.toggleSelection = function (dbId, model) {
            if (!model) {
                warn();
                model = _models[0];
            }
            model.selector.toggleSelection(dbId);

            fireAggregateSelectionChangedEvent();
        };

        this.setSelectionMode = function (mode) {
            for (var i = 0; i < _models.length; i++)
                _models[i].selector.setSelectionMode(mode);
        };

        this.setSelection = function (dbNodeArray, model) {
            if (!dbNodeArray || dbNodeArray.length === 0)
                this.clearSelection();
            else {
                if (!model) {
                    warn();
                    model = _models[0];
                } else {
                    for (var i = 0; i < _models.length; i++)
                        if (_models[i] !== model)
                            _models[i].selector.clearSelection();
                }
                model.selector.setSelection(dbNodeArray);
            }

            fireAggregateSelectionChangedEvent();
        };

        this.getSelectionBounds = function () {
            if (_models.length == 1)
                return _models[0].selector.getSelectionBounds();
            else {
                var bbox = new THREE.Box3();
                for (var i = 0; i < _models.length; i++) {
                    var tmp = _models[i].selector.getSelectionBounds();
                    bbox.union(tmp);
                }
                return bbox;
            }
        };

        this.getSelectionVisibility = function () {
            warn();
            return _models[0].selector.getSelectionVisibility();
        };

        this.dtor = function () {
            for (var i = 0; i < _models.length; i++)
                _models[i].selector.dtor();
        };


        viewer.api.addEventListener(EventType.ISOLATE_EVENT, function (event) {
            deselectInvisible();
        });

        viewer.api.addEventListener(EventType.HIDE_EVENT, function (event) {
            deselectInvisible();
        });


    }

    return MultiModelSelector;
});