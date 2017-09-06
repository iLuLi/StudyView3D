define([
    './DockingPanel',
    '../i18n',
    '../Core/EventType',
    './TreeDelegate',
    './Tree'
], function(DockingPanel, i18n, EventType, TreeDelegate, Tree) {
    'use strict';
    /**
     * LayersPanel
     * This is a panel for displaying the layers in a file.
     * @class
     * @augments Autodesk.Viewing.UI.DockingPanel
     * @alias Autodesk.Viewing.UI.LayersPanel
     * @param {Viewer} viewer - The parent viewer.
     * @param {HTMLElement} parentContainer - The container for this panel.
     * @param {string} id - The id for this panel.
     * @constructor
     * @private
     */
    var LayersPanel = function (viewer, parentContainer, id) {
        this.viewer = viewer;
        this.tree = null;
        this.layersRoot = null;
        this.visibilityImages = {};
        this.isMac = (navigator.userAgent.search("Mac OS") !== -1);

        var title = "Layer Manager"; // Gets translated by DockingPanel's constructor
        var viewableName = viewer.config.viewableName;
        var localizeTitle = true;

        if (viewableName && viewableName !== 'W2D') { // See SPK-1304
            title = i18n.translate(title) + ": " + viewableName;
            localizeTitle = false;
        }

        this.filterImageId = id + "-layerFilterImageId";

        DockingPanel.call(this, viewer.container, id, title, { localizeTitle: localizeTitle });
        this.container.classList.add('layersPanel');
        this.filterContainer = document.createElement("div");
        this.filterContainer.className = "filterBox";
        this.filterContainer.id = this.container.id + '-search-container';
        this.container.appendChild(this.filterContainer);

        this.createScrollContainer({ heightAdjustment: 105, marginTop: 5 });

        var that = this;
        if (viewer.model) {
            that.build();
        } else {
            that.addEventListener(viewer, EventType.GEOMETRY_LOADED_EVENT, function () {
                that.build();
            });
        }

        this.addVisibilityListener(function () {
            that.resizeToContent();
        });
    };

    LayersPanel.prototype = Object.create(DockingPanel.prototype);
    LayersPanel.prototype.constructor = LayersPanel;

    /**
     * Clean up when the layers panel is about to be removed.
     * @override
     */
    LayersPanel.prototype.uninitialize = function () {
        DockingPanel.prototype.uninitialize.call(this);

        this.viewer = null;
        this.tree = null;
        this.layersRoot = null;
        this.visibilityImages = null;
        this.scrollContainer = null;
        this.filterContainer = null;
    };

    /**
     * Builds the layers panel.
     */
    LayersPanel.prototype.build = function () {
        var that = this;

        function createDelegate() {
            var delegate = new TreeDelegate();

            delegate.getTreeNodeId = function (node) {
                return node.id;
            };

            delegate.getTreeNodeLabel = function (node) {
                return that.getNodeLabel(node);
            };

            delegate.getTreeNodeClass = function (node) {
                return that.getNodeClass(node);
            };

            delegate.isTreeNodeGroup = function (node) {
                return that.isGroupNode(node);
            };

            delegate.shouldCreateTreeNode = function (node) {
                return that.shouldInclude(node);
            };

            delegate.onTreeNodeClick = function (tree, node, event) {
                that.onClick(node, event);
            };

            delegate.onTreeNodeRightClick = function (tree, node, event) {
                that.onRightClick(node, event);
            };

            delegate.onTreeNodeDoubleClick = function (tree, node, event) {
                that.onDoubleClick(node, event);
            };

            delegate.onTreeNodeIconClick = function (tree, node, event) {
                that.onIconClick(node, event);
            };

            delegate.createTreeNode = function (node, parent) {
                that.createNode(node, parent);
            };

            return delegate;
        }

        // Search field
        var searchDiv = document.createElement("div");
        searchDiv.className = "filterSearch";
        that.filterContainer.appendChild(searchDiv);

        var image = document.createElement('div');
        image.className = "filterImage";
        image.id = that.filterImageId;
        image.title = i18n.translate("Show/hide all layers");
        searchDiv.appendChild(image);
        that.visibilityImages[that.filterImageId] = image;

        that.addEventListener(image, 'click', function (event) {
            that.onImageClick(null, event);
            event.stopPropagation();
        });

        var filterField = this.filterField = document.createElement("input");
        filterField.className = "filterInput";
        filterField.placeholder = i18n.translate("Enter filter term");
        filterField.setAttribute("data-i18n", "[placeholder]Enter filter term");
        filterField.type = 'search';
        filterField.incremental = "incremental";

        searchDiv.appendChild(filterField);

        var searchTimer = null,
            viewer = that.viewer;

        function doIncrementalSearch() {
            if (searchTimer) {
                clearTimeout(searchTimer);
            }
            searchTimer = setTimeout(doSearch, 500);
        }

        function doSearch() {

            function getMatches(node) {
                var matches = [];
                if (node.name.toLowerCase().indexOf(searchText) !== -1) {
                    matches.push(node);
                } else if (!node.isLayer) {
                    var children = node.children;
                    for (var i = 0; i < children.length; ++i) {
                        matches = matches.concat(getMatches(children[i]));
                    }
                }
                return matches;
            }

            if (filterField.value) {
                var searchText = filterField.value.toLowerCase();

                if (layersRoot && 0 < layersRoot.childCount) {
                    viewer.setLayerVisible(getMatches(layersRoot), true, true);
                }

            } else {
                // Make all the layers visible.
                viewer.setLayerVisible(null, true);
            }
            searchTimer = null;
        }

        filterField.addEventListener('keyup', function (e) {
            doIncrementalSearch();
        });

        // This is to detect when the user clicks on the 'x' to clear.
        filterField.addEventListener('click', function (e) {
            if (filterField.value === '') {
                viewer.setLayerVisible(null, true);
                return;
            }

            // When this event is fired after clicking on the clear button
            // the value is not cleared yet. We have to wait for it.
            setTimeout(function () {
                if (filterField.value === '') {
                    viewer.setLayerVisible(null, true);
                    e.preventDefault();
                }
            }, 1);
        });

        var delegate = createDelegate(),
            layersRoot = that.layersRoot = that.viewer.model.getLayersRoot();

        if (layersRoot) {
            that.tree = new Tree(delegate, layersRoot, that.scrollContainer, { excludeRoot: true });
            that.resizeToContent();
            that.update();

            that.addEventListener(that.viewer, EventType.LAYER_VISIBILITY_CHANGED_EVENT, function () {
                that.update();
            });
        }
    };

    /**
     * Updates the visibility states for the layers in the panel.
     */
    LayersPanel.prototype.update = function () {
        var that = this;

        function updateImage(image, state) {
            var cls;
            if (state === 1) {
                cls = 'layerVisible';
            } else if (state === 0) {
                cls = 'layerHidden';
            } else { // -1
                cls = 'layerMixed';
            }

            image.classList.remove('layerVisible');
            image.classList.remove('layerHidden');
            image.classList.remove('layerMixed');
            image.classList.add(cls);
        }

        function updateLook(node, state) {
            if (state === 0) {
                that.tree.addClass(node.id, 'dim');
            } else { // state === 1 || state === -1
                that.tree.removeClass(node.id, "dim");
            }
        }

        function getItemState(items) {
            var state;

            if (0 < items.length) {
                for (var i = 0; i < items.length; ++i) {
                    var item = items[i];

                    if (state === undefined) {
                        state = item;
                    } else if (item === 0 && state === 1) {
                        state = -1;
                    } else if (item === 1 && state === 0) {
                        state = -1;
                    }

                    if (state === -1) {
                        break;
                    }
                }
            } else {
                state = 0;
            }
            return state;
        }

        function traverse(parent) {
            var id = parent.id,
                image = that.visibilityImages[id];

            if (!parent.isLayer) {
                var children = parent.children,
                    visibility = [];

                for (var i = 0; i < children.length; ++i) {
                    visibility = visibility.concat(traverse(children[i]));
                }

                var state = getItemState(visibility);
                updateImage(image, state);
                updateLook(parent, state);
                return visibility;
            }

            var visible = that.viewer.isLayerVisible(parent) ? 1 : 0;
            updateImage(image, visible);
            updateLook(parent, visible);

            return [visible];
        }

        var allVisible = (this.layersRoot && 0 < this.layersRoot.childCount) ? traverse(that.layersRoot) : [];

        // Update the filter image.
        var filterImage = that.visibilityImages[that.filterImageId];
        updateImage(filterImage, getItemState(allVisible));
    };

    /**
     * Toggle or isolate the visibility state for a layer node.
     * @param {?Object} node
     * @param {boolean=} [isolate=false] true to isolate, false to toggle
     */
    LayersPanel.prototype.setLayerVisible = function (node, isolate) {
        var id = node ? node.id : this.filterImageId,
            cls = this.visibilityImages[id].className,
            visible = (cls !== 'layerVisible');

        this.viewer.setLayerVisible(node, visible, isolate);
        this.filterField.value = '';
    };

    /**
     * Override this method to specify the label for a node.
     * @param {Object} node
     * @returns {string} Label of the tree node
     */
    LayersPanel.prototype.getNodeLabel = function (node) {
        return (node.isLayer || 0 === node.childCount) ? node.name : (node.name + " (" + node.childCount + ")");
    };

    /**
     * Override this to specify the CSS classes of a node. This way, in CSS, the designer
     * can specify custom styling per type.
     * By default, an empty string is returned.
     * @param {Object} node
     * @returns {string} CSS classes for the node
     */
    LayersPanel.prototype.getNodeClass = function (node) {
        return '';
    };

    /**
     * Override this method to specify whether or not a node is a group node.
     * @param {Object} node
     * @returns {boolean} true if this node is a group node, false otherwise
     */
    LayersPanel.prototype.isGroupNode = function (node) {
        return !node.isLayer;
    };

    /**
     * Override this method to specify if a tree node should be created for this node.
     * By default, every node will be displayed.
     * @param {Object} node
     * @returns {boolean} true if a node should be created, false otherwise
     */
    LayersPanel.prototype.shouldInclude = function (node) {
        return true;
    };

    /**
     * Override this to do something when the user clicks on a tree node's icon.
     * By default, groups will be expanded/collapsed.
     * @param {Object} node
     * @param {Event} event
     */
    LayersPanel.prototype.onIconClick = function (node, event) {
        this.setGroupCollapsed(node, !this.isGroupCollapsed(node));
    };

    /**
     * Collapse/expand a group node.
     * @param {Object} node - A node to collapse/expand in the tree.
     * @param {boolean} collapse - true to collapse the group, false to expand it.
     */
    LayersPanel.prototype.setGroupCollapsed = function (node, collapse) {
        var delegate = this.tree.delegate();
        if (delegate.isTreeNodeGroup(node)) {
            var id = delegate.getTreeNodeId(node);
            this.tree.setCollapsed(id, collapse);

            this.resizeToContent();
        }
    };

    /**
     * Returns true if the group is collapsed.
     * @param {Object} node - The node in the tree.
     * @returns {boolean} - true if the group is collapsed, false otherwise.
     */
    LayersPanel.prototype.isGroupCollapsed = function (node) {
        var delegate = this.tree.delegate();
        if (delegate.isTreeNodeGroup(node)) {
            var id = delegate.getTreeNodeId(node);
            return this.tree.isCollapsed(id);
        }
        return false;
    };
    /**
     * Override this method to do something when the user clicks on a tree node
     * @param {Object} node
     * @param {Event} event
     */
    LayersPanel.prototype.onClick = function (node, event) {
    };

    /**
     * Override this to do something when the user double-clicks on a tree node
     * @param {Object} node
     * @param {Event} event
     */
    LayersPanel.prototype.onDoubleClick = function (node, event) {
    };

    /**
     * Override this to do something when the user right-clicks on a tree node
     * @param {Object} node
     * @param {Event} event
     */
    LayersPanel.prototype.onRightClick = function (node, event) {
    };

    /**
     * Override this to do something when the user clicks on an image
     * @param {Object} node
     * @param {Event} event
     */
    LayersPanel.prototype.onImageClick = function (node, event) {
    };

    /**
     * Returns the width and height to be used when resizing the panel to the content.
     *
     * @returns {{height: number, width: number}}
     */
    LayersPanel.prototype.getContentSize = function () {
        var filterContainer = this.filterContainer,
            height = filterContainer.clientHeight + 80,
            width = filterContainer.clientWidth;

        var tree = this.tree;
        if (tree) {
            var treeContainer = tree.getRootContainer();
            if (treeContainer) {
                return {
                    height: treeContainer.clientHeight + height,
                    width: Math.max(treeContainer.clientWidth, width)
                };
            }

        }
        return { height: height, width: width };
    };

    /**
     * Override this to create the HTMLContent for this node for appending to the
     * parent.  By default, a label and a visibility image are created.
     * @param {Object} node
     * @param {HTMLElement} parent
     */
    LayersPanel.prototype.createNode = function (node, parent) {
        var image = document.createElement('div');
        if (parent.children && parent.children.length > 0) {
            parent.insertBefore(image, parent.children[0]);
        } else {
            parent.appendChild(image);
        }
        image.title = i18n.translate("Show/hide this layer");
        this.visibilityImages[node.id] = image;

        var label = document.createElement('label');
        label.textContent = this.getNodeLabel(node);
        parent.appendChild(label);

        var that = this;
        this.addEventListener(image, 'click', function (event) {
            that.onImageClick(node, event);
            event.stopPropagation();
        });
    };

    return LayersPanel;
});