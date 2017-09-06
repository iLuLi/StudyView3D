define([
    './VisibilityManager',
    '../Logger'
], function(VisibilityManager, Logger) {
    'use strict';
    function MultiModelVisibilityManager(viewer) {
        
        this.viewer = viewer;
        this.models = [];

    }

    MultiModelVisibilityManager.prototype.addModel = function (model) {
        if (this.models.indexOf(model) == -1) {
            model.visibilityManager = new VisibilityManager(this.viewer, model);
            this.models.push(model);
        }
    };

    MultiModelVisibilityManager.prototype.removeModel = function (model) {
        var idx = this.models.indexOf(model);
        model.visibilityManager = null;
        this.models.splice(idx, 1);
    };

    MultiModelVisibilityManager.prototype.warn = function () {
        if (this.models.length > 1) {
            Logger.warn("This selection call does not yet support multiple models.");
        }
    };


    MultiModelVisibilityManager.prototype.getIsolatedNodes = function (model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        return model.visibilityManager.getIsolatedNodes();
    };

    MultiModelVisibilityManager.prototype.getHiddenNodes = function (model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        return model.visibilityManager.getHiddenNodes();
    };

    MultiModelVisibilityManager.prototype.isNodeVisible = function (model, dbId) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        return model.visibilityManager.isNodeVisible(dbId);
    };

    MultiModelVisibilityManager.prototype.isolate = function (node, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.isolate(node);
    };

    //Makes the children of a given node visible and
    //everything else not visible
    MultiModelVisibilityManager.prototype.hide = function (node, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.hide(node);
    };

    MultiModelVisibilityManager.prototype.show = function (node, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.show(node);
    };

    MultiModelVisibilityManager.prototype.toggleVisibility = function (node, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.toggleVisibility(node);
    };

    MultiModelVisibilityManager.prototype.setVisibilityOnNode = function (node, visible, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.setVisibilityOnNode(node, visible);
    };

    MultiModelVisibilityManager.prototype.setNodeOff = function (node, isOff, model) {
        if (!model) {
            this.warn();
            model = this.models[0];
        }
        model.visibilityManager.setNodeOff(node, isOff);
    };



    return MultiModelVisibilityManager;
});