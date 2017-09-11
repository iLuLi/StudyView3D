define([
    '../../UI/Base/DockingPanel',
    '../../Core/i18n',
    './SimulationDef',
    '../../Core/Constants/EventType'
], function(DockingPanel, i18n, SimulationDef, EventType) {
    'use strict';
    /** @constructor */
var GalleryPanel = function (viewer) {
    this.viewer = viewer;
    this.simDef = null;
    DockingPanel.call(this, viewer.container, 'Simulation-Panel', 'Simulation Results');
};

GalleryPanel.prototype = Object.create(DockingPanel.prototype);
GalleryPanel.prototype.constructor = GalleryPanel;

/**
 * Override so that the panel is updated with the currently selected node's properties,
 * and that default properties are loaded when the model is first loaded.
 */
GalleryPanel.prototype.initialize = function () {
    DockingPanel.prototype.initialize.call(this);
    var self = this;

    this.kPanelExpandedHeight = 420; //px
    this.kPanelCollapsedHeight = 35; //px

    this.container.classList.add('measurePanel');
    this.container.dockRight = true;

    this.container.style.minWidth = "380px";
    this.container.style.width = "380px";
    this.container.style.minHeight = this.kPanelCollapsedHeight + "px";
    this.container.style.height = this.kPanelExpandedHeight + "px";
    this.container.style.maxHeight = this.kPanelExpandedHeight + "px";
    this.container.style.top = "150px";
    this.container.style.left = "220px"; // just needs an initial value dock overrides value
    //this.container.style.resize    = "none";
    this.container.style.position = "absolute";

    this.legend = document.createElement("div");
    this.container.appendChild(this.legend);

    //this.constraints = document.createElement("div");
    //this.constraints.style.width = "40px";
    //this.constraints.style.height = "40px";
    //this.constraints.style.backgroundColor = "grey";
    //this.constraints.style.margin = "5px";
    //this.constraints.style.position = "absolute";
    //this.constraintsShow = false;
    //this.constraints.addEventListener("click",function() {
    //    self.constraintsShow = !self.constraintsShow;
    //    self.constraints.style.backgroundColor = self.constraintsShow ? "green" : "grey";
    //    if (self.constraintsShow)
    //        self.viewer.show(self.simDef.constraintsNode);
    //    else
    //        self.viewer.hide(self.simDef.constraintsNode);

    //});
    //this.loads = document.createElement("div");
    //this.loads.style.width = "40px";
    //this.loads.style.height = "40px";
    //this.loads.style.backgroundColor = "grey";
    //this.loads.style.margin = "5px";
    //this.loads.style.position = "absolute";
    //this.loads.style.left = "50px";
    //this.loadsShow = false;
    //this.loads.addEventListener("click",function() {
    //    self.loadsShow = !self.loadsShow;
    //    self.loads.style.backgroundColor = self.loadsShow ? "green" : "grey";
    //    if (self.loadsShow)
    //        self.viewer.show(self.simDef.loadsNode);
    //    else
    //        self.viewer.hide(self.simDef.loadsNode);

    //});

    //this.legend.appendChild(this.constraints);
    //this.legend.appendChild(this.loads);

    //result groups control
    this.resultsGroup = document.createElement("select");
    this.resultsGroup.classList.add('simulation-resultGroup');
    this.resultsGroup.style.position = "absolute";
    this.resultsGroup.style.top = "42px";
    this.resultsGroup.style.width = "180px";
    this.resultsGroup.style.left = "5px";
    this.resultsGroup.style.color = "black";
    this.resultsGroup.style.height = "22px";
    this.resultsGroup.style.border = "1px";
    this.resultsGroup.addEventListener("change", function (event) {
        self.viewer.hide(self.simDef.resultsNode);
        if (self.simDef.modalAnalysis == false)
            self.fillResultTypes(self.resultsGroup.value);
        else
            self.fillModalResultTypes(self.resultsGroup.value);

        setTimeout(function () {
            self.setSimObjectsVisibility();
        }, 100);
    });
    this.legend.appendChild(this.resultsGroup);

    //result types control
    this.resultTypes = document.createElement("select");
    this.resultTypes.classList.add('simulation-resultTypes');
    this.resultTypes.style.position = "absolute";
    this.resultTypes.style.top = "42px";
    this.resultTypes.style.width = "180px";
    this.resultTypes.style.left = "190px";
    this.resultTypes.style.color = "black";
    this.resultTypes.style.height = "22px";
    this.resultTypes.style.border = "1px";
    this.resultTypes.addEventListener("change", function (event) {
        self.viewer.hide(self.simDef.resultsNode);
        self.setSimObjectsVisibility();
        //self.simDef.modelStructurePanel.onClick(Number(self.resultTypes.value), null);
    });
    this.legend.appendChild(this.resultTypes);

    this.colorScale = document.createElement("div");
    this.colorScale.classList.add('simulation-colorscale');
    this.colorScale.style.width = "210px";
    this.colorScale.style.height = "20px";
    this.colorScale.style.margin = "5px";
    this.colorScale.style.position = "absolute";
    this.colorScale.style.left = "-70px";
    this.colorScale.style.top = "170px";
    this.colorScale.style.backgroundRepeat = "repeat";
    this.legend.appendChild(this.colorScale);

    this.colorScaleTopText = document.createElement("div");
    this.colorScaleTopText.style.position = "absolute";
    this.colorScaleTopText.style.left = "52px";
    this.colorScaleTopText.style.top = "73px";
    this.colorScaleTopText.innerHTML = "- 3333";
    this.legend.appendChild(this.colorScaleTopText);

    this.colorScaleBottomText = document.createElement("div");
    this.colorScaleBottomText.style.position = "absolute";
    this.colorScaleBottomText.style.left = "52px";
    this.colorScaleBottomText.style.top = "281px";
    this.colorScaleBottomText.innerHTML = "- 3333";
    this.legend.appendChild(this.colorScaleBottomText);

    //line
    this.line = document.createElement("hr");
    this.line.style.position = "absolute";
    this.line.style.top = "300px";
    this.line.style.width = "100%";
    this.line.style.borderTop = "1px solid black";
    this.legend.appendChild(this.line);

    //info
    // create elements <table> and a <tbody>
    this.tbl = document.createElement("table");
    this.tblBody = document.createElement("tbody");

    // append the <tbody> inside the <table>
    this.tbl.appendChild(this.tblBody);
    // put <table> in the <body>
    this.legend.appendChild(this.tbl);
    // tbl border attribute to
    //this.tbl.setAttribute("border", "2");
    this.tbl.style.position = "absolute";
    this.tbl.style.top = "310px";

    this.tbl.style.margin = "5px";

};

GalleryPanel.prototype.setSimulationDef = function (simDef) {
    this.simDef = simDef;
    var that = this;
    //name
    var studyNode = Number(this.simDef.studyNode);
    function getPropertyValue(properties, propertyName) {
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            if (property.displayName === propertyName) {
                return property.displayValue;
            }
        }
        return null;
    }

    function onStudyPropertiesRetrieved(studyNode) {
        var name = getPropertyValue(studyNode.properties, "Name");
        that.setTitle(name);
    }

    function onError(status, message, data) {
        // onNodeProcessed();
    }

    this.viewer.getProperties(studyNode, onStudyPropertiesRetrieved, onError);

    var studyName;
    //result groups
    if (this.simDef.modalAnalysis == true)
        studyName = i18n.translate("Modal Frequencies");
    else
        studyName = i18n.translate("Static Stress");

    //info
    //Analysis type
    if (!this.rowType) {
        this.rowType = document.createElement("tr");
        this.cellType1 = document.createElement("td");
        this.cellTextType1 = document.createTextNode(i18n.translate("Analysis Type"));
        this.cellType1.appendChild(this.cellTextType1);
        this.cellType1.style.width = '180px';
        this.cellType2 = document.createElement("td");
        this.cellTextType2 = document.createTextNode(studyName);
        this.cellType2.appendChild(this.cellTextType2);
        this.rowType.appendChild(this.cellType1);
        this.rowType.appendChild(this.cellType2);
        this.tblBody.appendChild(this.rowType);

        //nodes
        this.rowNodes = document.createElement("tr");
        this.cellNodes1 = document.createElement("td");
        this.cellTextNodes1 = document.createTextNode(i18n.translate("Nodes"));
        this.cellNodes1.appendChild(this.cellTextNodes1);
        //this.cellType1.style.width = '150px';
        this.cellNodes2 = document.createElement("td");
        var nodesCount = '1872';
        this.cellTextNodes2 = document.createTextNode(nodesCount);
        this.cellNodes2.appendChild(this.cellTextNodes2);
        this.rowNodes.appendChild(this.cellNodes1);
        this.rowNodes.appendChild(this.cellNodes2);
        this.tblBody.appendChild(this.rowNodes);

        //elements
        this.rowElements = document.createElement("tr");
        this.cellElements1 = document.createElement("td");
        this.cellTextElements1 = document.createTextNode(i18n.translate("Elements"));
        this.cellElements1.appendChild(this.cellTextElements1);
        //this.cellType1.style.width = '150px';
        this.cellElements2 = document.createElement("td");
        var elementsCount = '1084';
        this.cellTextElements2 = document.createTextNode(elementsCount);
        this.cellElements2.appendChild(this.cellTextElements2);
        this.rowElements.appendChild(this.cellElements1);
        this.rowElements.appendChild(this.cellElements2);
        this.tblBody.appendChild(this.rowElements);

        //min
        this.rowMin = document.createElement("tr");
        this.cellMin1 = document.createElement("td");
        this.cellTextMin1 = document.createTextNode(i18n.translate("Min"));
        this.cellMin1.appendChild(this.cellTextMin1);
        //this.cellType1.style.width = '150px';
        this.cellMin2 = document.createElement("td");
        var minCount = '0.000E+02 MPa';
        this.cellTextMin2 = document.createTextNode(minCount);
        this.cellMin2.appendChild(this.cellTextMin2);
        this.rowMin.appendChild(this.cellMin1);
        this.rowMin.appendChild(this.cellMin2);
        this.tblBody.appendChild(this.rowMin);

        //max
        this.rowMax = document.createElement("tr");
        this.cellMax1 = document.createElement("td");
        this.cellTextMax1 = document.createTextNode(i18n.translate("Max"));
        this.cellMax1.appendChild(this.cellTextMax1);
        //this.cellType1.style.width = '150px';
        this.cellMax2 = document.createElement("td");
        var maxCount = '5.117E+02 MPa';
        this.cellTextMax2 = document.createTextNode(maxCount);
        this.cellMax2.appendChild(this.cellTextMax2);
        this.rowMax.appendChild(this.cellMax1);
        this.rowMax.appendChild(this.cellMax2);
        this.tblBody.appendChild(this.rowMax);
    }
    else {
        this.cellTextType2.nodeValue = studyName;
    }

    this.resultsGroup.options.length = 0;
    if (this.simDef.modalAnalysis == false) {
        var groupKeys = Object.keys(simDef.resultGroups);
        if (!groupKeys || groupKeys.length == 0) {
            this.setSimObjectsVisibility();
            return;
        }
        for (var i = 0; i < groupKeys.length; i++) {
            var item = document.createElement("option");
            item.value = groupKeys[i];
            var name = simDef.resultGroups[groupKeys[i]];
            item.setAttribute("data-i18n", name);
            item.textContent = i18n.translate(name);
            this.resultsGroup.add(item);
        }
    }
    else {
        var groupKeys = Object.keys(simDef.modalResults);
        if (!groupKeys || groupKeys.length == 0) {
            this.setSimObjectsVisibility();
            return;
        }

        for (var i = 0; i < groupKeys.length; i++) {
            var item = document.createElement("option");
            item.value = groupKeys[i];
            var name = groupKeys[i];
            item.setAttribute("data-i18n", name);
            item.textContent = i18n.translate(name);
            this.resultsGroup.add(item);
        }
    }
    if (this.resultsGroup.options.length <= 1) {
        this.resultsGroup.disabled = true;
        this.resultsGroup.style.webkitAppearance = "none";
        this.resultsGroup.style.mozappearance = "none";
        this.resultsGroup.style.MozAppearance = "none";
        this.resultsGroup.style.appearance = "none";
        //this.resultsGroup.style.lineHeight = "19px";
    }
    else {
        this.resultsGroup.disabled = false;
        this.resultsGroup.style.webkitAppearance = "";
        this.resultsGroup.style.mozappearance = "";
        this.resultsGroup.style.MozAppearance = "";
        this.resultsGroup.style.appearance = "";
        //this.resultsGroup.style.lineHeight = "";
    }

    var that = this;
    var model = that.viewer.model;
    model.getObjectTree(function (instanceTree) {
        that.instanceTree = instanceTree;
        if (that.simDef.modalAnalysis == false)
            that.fillResultTypes(that.resultsGroup.value);
        else
            that.fillModalResultTypes(that.resultsGroup.value);

        setTimeout(function () {
            simDef.simExt.showResultsDlg(true);
            simDef.simExt.applySettings();
            that.setSimObjectsVisibility();
        }, 500);

    });

    //elements & nodes
    var resultsNode = Number(this.simDef.resultsNode);
    function onResultsPropertiesRetrieved(resultsNode) {
        var elements = getPropertyValue(resultsNode.properties, "Elements");
        var nodes = getPropertyValue(resultsNode.properties, "Nodes");
        that.cellTextElements2.nodeValue = elements;
        that.cellTextNodes2.nodeValue = nodes;
    }

    this.viewer.getProperties(resultsNode, onResultsPropertiesRetrieved, onError);
};

GalleryPanel.prototype.processNodes = function (instanceTree, onProcessed) {
    var that = this;

    // Find all of the nodes to process.
    //
    var nodeIdsToProcess = [];

    var simDef = this.simDef;
    if (!simDef)
        simDef = new SimulationDef();
    else
        simDef.reset();

    instanceTree.enumNodeChildren(instanceTree.getRootId(), function (dbId) {
        nodeIdsToProcess.push(dbId);
    }, true);

    function getPropertyValue(properties, propertyName) {
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            if (property.displayName === propertyName) {
                return property.displayValue;
            }
        }
        return null;
    }

    function processNodeId(node, onNodeProcessed) {
        function onPropertiesRetrieved(result) {

            ////force to hide until all init
            //that.viewer.hide(node);

            var properties = result.properties;
            var name = getPropertyValue(result.properties, 'A1C6011B-E1A6-4ADF-975D-A0003C592F87');
            if (name) {
                var bSimNode = true;
                if (name == "SIM_CONSTRAINTS") {
                    simDef.constraintsNode = node;
                }
                else if (name == "SIM_CONSTRAINT") {
                    simDef.constraintNodes.push(node);
                }
                else if (name == "SIM_LOADS") {
                    simDef.loadsNode = node;
                }
                else if (name == "SIM_LOAD") {
                    simDef.loadNodes.push(node);
                }
                else if (name == "SIM_RESULTS_SCALAR_PLOT") {
                    if (simDef.modalAnalysis == false)
                        simDef.associateResult(getPropertyValue(properties, "Name"), node);
                    else
                        simDef.associateModalResult(getPropertyValue(properties, "Name"), node);
                }
                else if (name == "SIM_RESULTS_GROUP") {
                    if (simDef.modalAnalysis == false)
                        simDef.associateResultGroup(getPropertyValue(properties, "Name"), node);
                }
                else if (name == "SIM_RESULTS") {
                    simDef.resultsNode = node;
                    that.viewer.hide(node);
                }
                else if (name == "SIM_STUDY") {
                    simDef.studyNode = node;
                    var type = getPropertyValue(result.properties, "Study Type");
                    if (type == 'SimCaseModalFrequencies')
                        simDef.modalAnalysis = true;
                }
                else if (name == "SIM_RESULTS_SCALAR_PLOT_BODY") {

                }
                else if (name == "SIM_RESULTS_SAMPLE") {

                }
                //else {
                //    simDef.modelNodes.push(node);
                //    bSimNode = false;
                //}

                if (bSimNode == true) {
                    simDef.simNodes.push(node);
                }
            }
            else {
                simDef.modelNodes.push(node);
            }

            onNodeProcessed();
        }

        function onError(status, message, data) {
            onNodeProcessed();
        }

        if (node && that.viewer)
            that.viewer.getProperties(node, onPropertiesRetrieved, onError);
    }

    // Process the nodes one by one.
    //
    function processNext() {
        if (nodeIdsToProcess.length > 0) {
            processNodeId(nodeIdsToProcess.shift(), processNext);
        } else {
            // No more nodes to process - call the provided callback.
            //

            // TODO
            var $getObjectTree = function () {
                return simDef;
            };
            onProcessed(simDef);
        }
    }
    processNext();
};

GalleryPanel.prototype.initModel = function (instanceTree, simExt) {
    if (!this.viewer)
        return;

    var that = this;
    that.processNodes(instanceTree, function (simDef) {
        simDef.simExt = simExt;
        that.setSimulationDef(simDef);
    });

    that.addEventListener(that.viewer, EventType.ISOLATE_EVENT,
    function (e) {
        //hide highlighted nodes
        if (that.simDef.loadsNode != -1)
            that.hightlightNode(that.simDef.loadsNode, false);
        if (that.simDef.constraintsNode != -1)
            that.hightlightNode(that.simDef.constraintsNode, false);

        if (that.simDef.modelNodes && that.simDef.modelNodes.length > 0) {
            for (var i = 0; i < that.simDef.modelNodes.length; ++i) {
                that.hightlightNode(that.simDef.modelNodes[i], false);
            }
        }

        var nodes = e.nodeIdArray;
        if (nodes) {
            // show all
            if (nodes.length == 0) {
                that.setSimObjectsVisibility();
            }
            else {
                if (nodes.length == 1) //take care about one
                {
                    if (that.isModelNode(nodes[0])) {
                        //that.setModelNodesVisible(true);
                        //hide loads
                        if (that.simDef.loadsNode)
                            that.viewer.hide(that.simDef.loadsNode);
                        //hide constraints
                        if (that.simDef.constraintsNode)
                            that.viewer.hide(that.simDef.constraintsNode);
                        //hide results
                        if (that.simDef.resultsNode)
                            that.viewer.hide(that.simDef.resultsNode);
                    }
                }
            }
        }
    });
};

GalleryPanel.prototype.hightlightNode = function (node, bHighlight) {

    var viewer = this.viewer.impl;
    var that = this;

    //check for root node
    var isRoot = false;
    var instanceTree = this.viewer.model.getData().instanceTree;
    if (instanceTree) {
        var rootId = instanceTree.getRootId();
        isRoot = (typeof node == "number" && node === rootId);
        //isModelNode = !isRoot;
    }
    if (isRoot && bHighlight)
        return;

    that.instanceTree.enumNodeFragments(node, function (fragId) {
        viewer.highlightFragment(that.viewer.model, fragId, bHighlight, true);
    }, true);
};

GalleryPanel.prototype.fillResultTypes = function (resultGroupKey) {
    var that = this;
    that.resultTypes.options.length = 0;
    var node = Number(resultGroupKey);
    function getPropertyValue(properties, propertyName) {
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            if (property.displayName === propertyName) {
                return property.displayValue;
            }
        }
        return null;
    }

    function onGroupPropertiesRetrieved(groupResult) {
        var resultGroup = getPropertyValue(groupResult.properties, "Result group");

        function onResultPropertiesRetrieved(resultType) {
            var resultTypeGroup = getPropertyValue(resultType.properties, "Result group");
            if (resultTypeGroup === resultGroup) {
                var item = document.createElement("option");
                item.value = resultType.dbId;
                var name = that.simDef.resultTypes[resultType.dbId];
                item.setAttribute("data-i18n", name);
                item.textContent = i18n.translate(name);
                that.resultTypes.add(item);

                if (that.resultTypes.options.length <= 1) {
                    that.resultTypes.disabled = true;
                    that.resultTypes.style.webkitAppearance = "none";
                    that.resultTypes.style.mozappearance = "none";
                    that.resultTypes.style.MozAppearance = "none";
                    that.resultTypes.style.appearance = "none";
                    //that.resultTypes.style.lineHeight = "19px";
                }
                else {
                    that.resultTypes.disabled = false;
                    that.resultTypes.style.webkitAppearance = "";
                    that.resultTypes.style.mozappearance = "";
                    that.resultTypes.style.MozAppearance = "";
                    that.resultTypes.style.appearance = "";
                    //that.resultTypes.style.lineHeight = "";
                }
            }

        }
        //result types
        var keys = Object.keys(that.simDef.resultTypes);
        for (var i = 0; i < keys.length; i++) {
            var resultNode = Number(keys[i]);
            that.viewer.getProperties(resultNode, onResultPropertiesRetrieved, onError);
        }
    }

    function onError(status, message, data) {
        // onNodeProcessed();
    }

    that.viewer.getProperties(node, onGroupPropertiesRetrieved, onError);
};

GalleryPanel.prototype.fillModalResultTypes = function (resultGroupKey) {
    var that = this;
    that.resultTypes.options.length = 0;
    function getPropertyValue(properties, propertyName) {
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            if (property.displayName === propertyName) {
                return property.displayValue;
            }
        }
        return null;
    }

    var resultGroup = resultGroupKey;

    function onResultPropertiesRetrieved(resultType) {
        var resultTypeGroup = getPropertyValue(resultType.properties, "Result type");
        if (resultTypeGroup === resultGroup) {
            var item = document.createElement("option");
            item.value = resultType.dbId;

            var resultMode = getPropertyValue(resultType.properties, "Mode");
            var name = resultMode;
            item.setAttribute("data-i18n", name);
            item.textContent = name; //i18n.translate(name); //Mode 1: 200 Hz -> result from translate 200 Hz -> not acceptable
            that.resultTypes.add(item);

            that.simDef.associateResult(name, resultType.dbId);

            if (that.resultTypes.options.length <= 1) {
                that.resultTypes.disabled = true;
                that.resultTypes.style.webkitAppearance = "none";
                that.resultTypes.style.mozappearance = "none";
                that.resultTypes.style.MozAppearance = "none";
                that.resultTypes.style.appearance = "none";
                // that.resultTypes.style.lineHeight = "19px";
            }
            else {
                that.resultTypes.disabled = false;
                that.resultTypes.style.webkitAppearance = "";
                that.resultTypes.style.mozappearance = "";
                that.resultTypes.style.MozAppearance = "";
                that.resultTypes.style.appearance = "";
                // that.resultTypes.style.lineHeight = "";
            }
        }

    }
    //result types
    var keys = that.simDef.modalResults[resultGroup];
    for (var i = 0; i < keys.length; i++) {
        var resultNode = Number(keys[i]);
        that.viewer.getProperties(resultNode, onResultPropertiesRetrieved, onError);
    }
    // }

    function onError(status, message, data) {
        // onNodeProcessed();
    }
};

GalleryPanel.prototype.uninitialize = function () {
    DockingPanel.prototype.uninitialize.call(this);
    this.viewer = null;
};

GalleryPanel.prototype.setTitle = function (title, options) {
    if (!title) {
        title = 'Simulations';
        options = options || {};
        options.localizeTitle = true;
    }
    DockingPanel.prototype.setTitle.call(this, title, options);
};

GalleryPanel.prototype.setModelNodesVisible = function (bVisible) {
    if (this.simDef.modelNodes && this.simDef.modelNodes.length > 0) {
        for (var k = 0; k < this.simDef.modelNodes.length; k++) {
            var modelNode = this.simDef.modelNodes[k];
            //check for root node
            var isRoot = false;
            var instanceTree = this.viewer.model.getData().instanceTree;
            if (instanceTree) {
                var rootId = instanceTree.getRootId();
                isRoot = (typeof modelNode == "number" && modelNode === rootId);
                //isModelNode = !isRoot;
            }
            if (isRoot)
                continue;
            if (bVisible)
                this.viewer.show(modelNode);
            else
                this.viewer.hide(modelNode);
        }
    }
}

GalleryPanel.prototype.isModelNode = function (node) {
    if (!this.simDef.modelNodes || this.simDef.modelNodes.length == 0)
        return false;

    return this.simDef.modelNodes.indexOf(node) !== -1;
};

GalleryPanel.prototype.setNodeVisibility = function (node, visible) {
    if (visible) {
        this.viewer.show(node);
    } else {
        this.viewer.hide(node)
    }
};

GalleryPanel.prototype.isSimLoadNode = function (node) {
    if (!this.simDef.loadNodes) return false;
    return this.simDef.loadNodes.indexOf(node) !== -1;
};

GalleryPanel.prototype.isSimConstraintNode = function (node) {
    if (!this.simDef.constraintNodes) return false;
    return this.simDef.constraintNodes.indexOf(node) !== -1;
};

GalleryPanel.prototype.isSimLoadsNode = function (node) {
    if (this.simDef.loadsNode == -1) return false;
    return this.simDef.loadsNode == node;
};

GalleryPanel.prototype.isSimConstraintsNode = function (node) {
    if (this.simDef.constraintsNode == -1) return false;
    return this.simDef.constraintsNode == node;
};

GalleryPanel.prototype.isSimStudyNode = function (node) {
    if (!this.simDef.studyNode) return false;
    return this.simDef.studyNode == node;
};

GalleryPanel.prototype.isSimResultsNode = function (node) {
    if (!this.simDef.resultsNode) return false;
    return this.simDef.resultsNode == node;
};

GalleryPanel.prototype.setSimObjectsVisibility = function (node) {
    //if no results then show model and hide results panel
    if (!this.resultTypes || this.resultTypes.options.length == 0) {
        this.setModelNodesVisible(true);
        this.simDef.simExt.showResultsDlg(false);
        return;
    }

    var that = this;
    this.viewer.hide(this.simDef.resultsNode);

    var resultNode = Number(this.resultTypes.value);
    if (!node) {//this is called from Results panel
        //hide models
        this.setModelNodesVisible(false);

        //show result
        this.viewer.show(resultNode);

        //show loads
        if (this.simDef.loadsNode != -1)
            this.viewer.show(this.simDef.loadsNode);

        //show constraints
        if (this.simDef.constraintsNode != -1)
            this.viewer.show(this.simDef.constraintsNode);
    }
    else {
        //var isModelNode = this.isModelNode(node);
        //check for root node
        var isRoot = false;
        var instanceTree = this.viewer.model.getData().instanceTree;
        if (instanceTree) {
            var rootId = instanceTree.getRootId();
            isRoot = (typeof node == "number" && node === rootId);
            //isModelNode = !isRoot;
        }

        //if (isModelNode) {
        //    this.setModelNodesVisible(true);
        //    //hide result
        //    this.viewer.hide(resultNode);
        //    this.viewer.hide(this.simDef.resultsNode);
        //}
        //else {
        //hide models
        this.setModelNodesVisible(false);

        var isLoadNode = this.isSimLoadNode(node);
        var isLoadsNode = this.isSimLoadsNode(node);
        var isConstraintNode = this.isSimConstraintNode(node);
        var isConstraintsNode = this.isSimConstraintsNode(node);
        var isSimStudyNode = this.isSimStudyNode(node);
        //if (isConstraintNode || isLoadNode || isSimStudyNode || isConstraintsNode || isLoadsNode)
        //    this.viewer.show(node);

        this.viewer.hide(this.simDef.resultsNode);
        //show result
        this.viewer.show(resultNode);

        //if (isRoot) {
        if (this.simDef.loadsNode)
            this.viewer.show(this.simDef.loadsNode);
        if (this.simDef.constraintsNode)
            this.viewer.show(this.simDef.constraintsNode);
        // }
        if (!isRoot && !isSimStudyNode) {
            instanceTree.enumNodeFragments(node, function (fragId) {
                that.viewer.impl.highlightFragment(that.viewer.model, fragId, true, true);
            }, true);
        }
        //}

    }

    //this.viewer.fitToView();

    var that = this;
    function getPropertyValue(properties, propertyName) {
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            if (property.displayName === propertyName) {
                return property.displayValue;
            }
        }
        return null;
    }

    function onResultPropertiesRetrieved(resultType) {
        var minValue = getPropertyValue(resultType.properties, "Minimal value");
        var maxValue = getPropertyValue(resultType.properties, "Maximal value");
        var reversed = getPropertyValue(resultType.properties, "Scale reversed");
        var unit = getPropertyValue(resultType.properties, "Unit");
        that.cellTextMin2.nodeValue = minValue + " " + unit;
        that.cellTextMax2.nodeValue = maxValue + " " + unit;

        var minRefValue = getPropertyValue(resultType.properties, "Lower referential value");
        var maxRefValue = getPropertyValue(resultType.properties, "Upper referential value");
        if (reversed == "True") {
            //var temp = maxRefValue;
            //maxRefValue = minRefValue;
            //minRefValue = temp;
            that.colorScale.style.transform = "rotate(90deg)";
            that.colorScale.style.moztransform = "rotate(90deg)";
            that.colorScale.style.webkittransform = "rotate(90deg)";
        }
        else {
            that.colorScale.style.transform = "rotate(-90deg)";
            that.colorScale.style.moztransform = "rotate(-90deg)";
            that.colorScale.style.webkittransform = "rotate(-90deg)";
        }
        that.colorScaleTopText.innerHTML = "- " + maxRefValue + " " + unit;;
        that.colorScaleBottomText.innerHTML = "- " + minRefValue + " " + unit;
    }

    that.viewer.getProperties(resultNode, onResultPropertiesRetrieved, onError);

    function onError(status, message, data) {
        // onNodeProcessed();
    }

}
return GalleryPanel;
});