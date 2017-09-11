define(function () {
    'use strict';
    /** @constructor */
    var SimulationDef = function () {
        this.studyNode;
        this.constraintsNode = -1;
        this.constraintNodes = [];
        this.loadsNode = -1;
        this.loadNodes = [];
        this.resultsNode = -1;
        this.bodyNode = -1;
        this.resultTypes = {};
        this.resultGroups = {};
        // this.modelNodes = [];
        this.simNodes = [];
        this.modelNodes = [];

        this.modalAnalysis = false;
        this.modalResults = {};

        this.modelStructurePanel = null;
        this.simExt = null;
    };

    SimulationDef.prototype.associateResult = function (resultName, resultNode) {
        this.resultTypes[resultNode] = resultName;
    };

    SimulationDef.prototype.associateResultGroup = function (resultGroupName, resultGroupNode) {
        this.resultGroups[resultGroupNode] = resultGroupName;
    };

    SimulationDef.prototype.associateModalResult = function (resultName, resultNode) {

        var subResultNode = [];
        subResultNode = this.modalResults[resultName];
        if (subResultNode == null) {
            var subNode = [];
            subNode.push(resultNode);
            subResultNode = subNode;
        }
        else {
            subResultNode.push(resultNode);
        }
        this.modalResults[resultName] = subResultNode;
    };

    SimulationDef.prototype.reset = function () {
        this.studyNode = -1;
        this.constraintsNode = -1;
        this.constraintNodes = [];
        this.loadsNode = -1;
        this.loadNodes = [];
        this.resultsNode = -1;
        this.bodyNode = -1;
        this.resultTypes = {};
        this.resultGroups = {};

        this.simNodes = [];
        this.modelNodes = [];

        this.modalAnalysis = false;
        this.modalResults = {};

        this.modelStructurePanel = null;
    }
    return SimulationDef;
});