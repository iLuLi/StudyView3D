define([
    './Base/ModelStructurePanel',
    '../Core/Constants/EventType',
    '../Core/i18n',
    '../Core/Mixin/ViewerPanelMixin'
], function(ModelStructurePanel, EventType, i18n, ViewerPanelMixin) {
    'use strict';
    var kDefaultDocStructureConfig = {
        "click": {
            "onObject": ["isolate"]
        },
        "clickCtrl": {
            "onObject": ["toggleVisibility"]
        }
    };


    var ViewerModelStructurePanel = function (viewer, title, options) {
        this.viewer = viewer;

        options = options || {};

        //TODO: base this on whether search is visible or not
        options.heightAdjustment = 75; //bigger than default because of search bar

        ModelStructurePanel.call(this, viewer.container, viewer.container.id + 'ViewerModelStructurePanel', title, options);

        this.clickConfig = (options && options.docStructureConfig) ? options.docStructureConfig : kDefaultDocStructureConfig;
        this.isMac = (navigator.userAgent.search("Mac OS") !== -1);

        this.initSearchBox();

        this.prevSearchResults = [];
        this.prevSearchString = "";
    };

    ViewerModelStructurePanel.prototype = Object.create(ModelStructurePanel.prototype);
    ViewerModelStructurePanel.prototype.constructor = ViewerModelStructurePanel;
    ViewerPanelMixin.call(ViewerModelStructurePanel.prototype);

    ViewerModelStructurePanel.prototype.initialize = function () {
        ModelStructurePanel.prototype.initialize.call(this);

        var that = this;

        that.addEventListener(that.viewer, EventType.SELECTION_CHANGED_EVENT, function (event) {
            that.setSelection(event.nodeArray.slice());
        });
        that.addEventListener(that.viewer, EventType.ISOLATE_EVENT, function (event) {
            that.setIsolation(event.nodeIdArray.slice());
        });
        that.addEventListener(that.viewer, EventType.HIDE_EVENT, function (event) {
            that.setHidden(event.nodeIdArray.slice(), true);
        });
        that.addEventListener(that.viewer, EventType.SHOW_EVENT, function (event) {
            that.setHidden(event.nodeIdArray.slice(), false);
        });
    };

    ViewerModelStructurePanel.prototype.uninitialize = function () {
        this.viewer = null;
        ModelStructurePanel.prototype.uninitialize.call(this);
    };

    ViewerModelStructurePanel.prototype.handleAction = function (actionArray, dbId) {
        for (var action in actionArray) {
            switch (actionArray[action]) {
                case "selectOnly":
                    this.viewer.select(dbId);
                    break;
                case "deselectAll":
                    this.viewer.select([]);
                    break;
                case "selectToggle":
                    this.viewer.toggleSelect(dbId);
                    break;
                case "isolate":
                    this.viewer.isolate(dbId);
                    break;
                case "showAll":
                    this.viewer.isolate(null);
                    break;
                case "focus":
                    this.viewer.fitToView();
                    break;
                case "hide":
                    this.viewer.hide(dbId);
                    break;
                case "show":
                    this.viewer.show(dbId);
                    break;
                case "toggleVisibility":
                    this.viewer.toggleVisibility(dbId);
                    break;
            }
        }
    };

    ViewerModelStructurePanel.prototype.ctrlDown = function (event) {
        return (this.isMac && event.metaKey) || (!this.isMac && event.ctrlKey);
    };

    ViewerModelStructurePanel.prototype.onClick = function (node, event) {
        if (this.isMac && event.ctrlKey) {
            return;
        }

        var that = this;

        var key = "click";
        if (that.ctrlDown(event)) {
            key += "Ctrl";
        }
        if (event.shiftKey) {
            key += "Shift";
        }
        if (event.altKey) {
            key += "Alt";
        }

        if (this.clickConfig && this.clickConfig[key]) {
            that.handleAction(this.clickConfig[key]["onObject"], node);
        }
        else {
            this.viewer.select(node);
        }
    };

    ViewerModelStructurePanel.prototype.onDoubleClick = function (node, event) {
        this.handleAction(["focus"], node);
    };

    ViewerModelStructurePanel.prototype.onHover = function (node, event) {
        this.viewer.impl.rolloverObjectNode(node);
    };

    ViewerModelStructurePanel.prototype.onRightClick = function (node, event) {
        // Sometimes CTRL + LMB maps to a right click on a mac. Redirect it.
        if (this.isMac && event.ctrlKey && event.button === 0) {
            if (this.clickConfig && this.clickConfig["clickCtrl"]) {
                this.handleAction(this.clickConfig["clickCtrl"]["onObject"], node);
            }
            else {
                this.viewer.select(node);
            }

            return null;
        }

        var dbIds = [];

        // If the shift/control/command key is held down when right-clicking, then add this node
        // to the selection, instead of selecting only this node. This control/command key logic is
        // like the ViewController, which is slightly different than ctrlDown() here.
        // TODO: is this difference intentional?

        // Also: on the Mac, a control + left mouse button click is treated like a right mouse
        // button click, so ignore the control key in that case.
        //
        var shouldSelectNode = true;
        if (event.shiftKey || ((this.isMac && event.metaKey) || (event.ctrlKey && (this.isMac || event.button === 2)))) {
            var selectedNodes = this.viewer.impl.selector.getSelection();
            for (var i = 0; i < selectedNodes.length; ++i) {
                if (selectedNodes[i] !== node) {
                    dbIds.push(selectedNodes[i]);
                } else {
                    shouldSelectNode = false;
                }
            }
        }

        if (shouldSelectNode) {
            dbIds.push(node);
        }

        this.viewer.select(dbIds);

        return this.viewer.contextMenu.show(event);
    };

    ViewerModelStructurePanel.prototype.setHidden = function (nodes, hidden) {

        //TODO: //BOGUS Should not have to do this -- figure out why the CAM
        //extension is calling this before the model tree is actually visible
        if (!this.uiCreated)
            this.createUI();

        for (var i = 0; i < nodes.length; ++i) {
            this.tree.iterate(nodes[i], function (node, elem) {
                elem.classList.toggle('dim', hidden);
                elem.classList.toggle('visible', !hidden);
            });
        }
    };

    ViewerModelStructurePanel.prototype.setIsolation = function (nodes) {
        if (!this.rootId) {
            return;
        }
        this.tree && this.tree.iterate(this.rootId, function (node, elem) {
            elem.classList.remove('dim');
            elem.classList.remove('visible');
        });

        if (nodes.length > 0) {
            // If the root is isolated, we don't want to dim anything.
            //
            if (nodes.length === 1 && nodes[0] === this.rootId) {
                return;
            }

            this.setHidden([this.rootId], true);

            this.setHidden(nodes, false);
        }

        if (this.searchbox && !this.inSearchIsolate)
            this.searchbox.value = "";

    };

    ViewerModelStructurePanel.prototype.initSearchBox = function () {
        var searchbox = document.createElement("input");
        searchbox.className = "toolbar-search-box";
        searchbox.type = "search";
        searchbox.results = 5;
        //searchbox.placeholder = av.i18n.translate("Search");
        searchbox.placeholder = i18n.translate("Filter by name");
        searchbox.incremental = "incremental";
        searchbox.autosave = this.container.id + "search_autosave";
        //searchbox.setAttribute("data-i18n", "[placeholder]Search");
        searchbox.setAttribute("data-i18n", "[placeholder]Filter by name");
        this.scrollContainer.parentNode.insertBefore(searchbox, this.scrollContainer);
        this.searchbox = searchbox;

        var viewer = this.viewer;
        var self = this;

        function doSearch() {
            //TODO: the search hit style class gets overridden by the islolation dim/visible classes
            //Also it needs to apply to exact nodes and not cascade down the tree.
            if (self.isSearching) {
                return; //don't send another search to the worker if one is in progress
            }

            for (var i = 0; i < self.prevSearchResults.length; i++) {
                //self.tree.removeClass(self.prevSearchResults[i], "searchHit");
                self.tree.setCollapsed(self.prevSearchResults[i], true, true);
            }

            if (searchbox.value.length === 0) {
                self.isSearching = false;
                self.prevSearchString = "";
                viewer.isolate();
            } else {
                if (self.prevSearchString == searchbox.value)
                    return;

                self.isSearching = true;

                viewer.search(searchbox.value, function (resultIds) {
                    self.inSearchIsolate = true;
                    viewer.isolate(resultIds);
                    self.inSearchIsolate = false;

                    if (resultIds.length) {
                        for (var i = 0; i < resultIds.length; i++) {
                            //self.tree.addClass(resultIds[i], "searchHit");
                            self.tree.setCollapsed(resultIds[i], false, true);
                        }
                        self.resizeToContent();
                        self.tree.scrollTo(resultIds[0]);
                    }

                    self.prevSearchResults = resultIds;
                    self.isSearching = false;
                }, null, ["name"]);
            }
        }

        var TIMEOUT = 500;
        var timeout;
        searchbox.addEventListener("input", function (e) {   // delayed: as typing
            clearTimeout(timeout);
            timeout = setTimeout(doSearch, TIMEOUT);
        });

        searchbox.addEventListener("change", function (e) {  // immediate: press enter, lose focus
            clearTimeout(timeout);
            doSearch();
        });
    };

    return ViewerModelStructurePanel;
});