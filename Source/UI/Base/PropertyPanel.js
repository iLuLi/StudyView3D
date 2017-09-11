define([
    './DockingPanel',
    './TreeDelegate',
    './Tree',
    '../../Core/Utils/formatValueWithUnits'
], function(DockingPanel, TreeDelegate, Tree, formatValueWithUnits) {
    'use strict';
    /**
     * PropertyPanel
     * A panel for displaying a set of properties that are optionally categorized.
     * @class
     * @augments Autodesk.Viewing.UI.DockingPanel
     *
     * @param {HTMLElement} parentContainer - The container for this panel.
     * @param {string} id - The id for this panel.
     * @param {string} title - The initial title for this panel.
     * @param {Object} [options] - An optional dictionary of options.  Currently unused.
     * @constructor
     */
    var PropertyPanel = function (parentContainer, id, title, options) {
        DockingPanel.call(this, parentContainer, id, title, options);

        this.container.classList.add('propertyPanel');
        this.container.dockRight = true;

        this.createScrollContainer({ left: false, heightAdjustment: 45, marginTop: 0 });

        this.highlightableElements = {};

        var that = this;

        function createDelegate() {
            var delegate = new TreeDelegate();

            function isCategory(object) {
                return object.type === 'category';
            }

            delegate.getTreeNodeId = function (node) {
                return node.name + (node.hasOwnProperty('value') ? node.value : '') + (node.hasOwnProperty('category') ? node.category : '');
            };

            delegate.getTreeNodeClass = function (node) {
                return isCategory(node) ? that.getCategoryClass(node) : that.getPropertyClass(node);
            };

            delegate.isTreeNodeGroup = function (node) {
                return isCategory(node);
            };

            delegate.onTreeNodeClick = function (tree, node, event) {
                if (isCategory(node)) {
                    that.onCategoryClick(node, event);
                } else {
                    that.onPropertyClick(node, event);
                }
            };

            delegate.onTreeNodeRightClick = function (tree, node, event) {
                if (isCategory(node)) {
                    that.onCategoryRightClick(node, event);
                } else {
                    that.onPropertyRightClick(node, event);
                }
            };

            delegate.onTreeNodeDoubleClick = function (tree, node, event) {
                if (isCategory(node)) {
                    that.onCategoryDoubleClick(node, event);
                } else {
                    that.onPropertyDoubleClick(node, event);
                }
            };

            delegate.onTreeNodeIconClick = function (tree, node, event) {
                if (isCategory(node)) {
                    that.onCategoryIconClick(node, event);
                } else {
                    that.onPropertyIconClick(node, event);
                }
            };

            delegate.createTreeNode = function (node, parent, options) {
                var highlightableElements = null;
                if (isCategory(node)) {
                    highlightableElements = that.displayCategory(node, parent, options);
                } else {
                    highlightableElements = that.displayProperty(node, parent, options);
                }

                if (highlightableElements) {
                    that.highlightableElements[this.getTreeNodeId(node)] = highlightableElements;
                }
            };

            return delegate;
        }

        var delegate = createDelegate();
        this.tree = new Tree(delegate, null, this.scrollContainer, {});

    };

    PropertyPanel.prototype = Object.create(DockingPanel.prototype);
    PropertyPanel.prototype.constructor = PropertyPanel;

    /**
     * Adds the given properties to the display panel.
     * @param {Array} properties - An array of properties, each property represented as {displayName: name, displayValue: value}.
     * @param {Object=} [options] - An optional dictionary of options.  Currently unused.
     */
    PropertyPanel.prototype.setProperties = function (properties, options) {
        this.removeAllProperties();

        // Check if any categories need to be displayed.
        //
        var withCategories = [];
        var withoutCategories = [];

        for (var i = 0; i < properties.length; i++) {
            var property = properties[i];
            if (!property.hidden) {
                var category = properties[i].displayCategory;
                if (category && typeof category === 'string' && category !== '') {
                    withCategories.push(property);
                } else {
                    withoutCategories.push(property);
                }
            }
        }

        if ((withCategories.length + withoutCategories.length) === 0) {
            this.showNoProperties();
            return;
        }

        for (var i = 0; i < withCategories.length; i++) {
            var property = withCategories[i];
            var value = formatValueWithUnits(property.displayValue, property.units, property.type);
            this.addProperty(property.displayName, value, property.displayCategory);
        }

        var hasCategories = (withCategories.length > 0);
        for (var i = 0; i < withoutCategories.length; i++) {
            var property = withoutCategories[i];
            var value = formatValueWithUnits(property.displayValue, property.units, property.type);
            this.addProperty(property.displayName, value, hasCategories ? 'Other' : '', hasCategories ? { localizeCategory: true } : {});
        }
    };

    /**
     * Displays only the "No properties" item.
     */
    PropertyPanel.prototype.showNoProperties = function () {
        this.removeAllProperties();
        var rootContainer = this.tree.myRootContainer;

        var message = document.createElement('div');
        message.className = 'noProperties';

        var text = 'No properties to display';  // string localized below
        message.setAttribute('data-i18n', text);
        message.textContent = Autodesk.Viewing.i18n.translate(text);

        rootContainer.appendChild(message);
    };

    /**
     * Override this to display the default properties.  The current default is to display no properties.
     */
    PropertyPanel.prototype.showDefaultProperties = function () {
        this.showNoProperties();

        this.resizeToContent();
    };

    /**
     * Override this to return true if the default properties are being displayed.
     */
    PropertyPanel.prototype.areDefaultPropertiesShown = function () {
        return !this.hasProperties();
    };

    /**
     * Adds a property to this panel.  The property is defined by its name, value, and category.  The
     * add will fail if a property with the same name, value, and category already exists.
     *
     * @param {string} name - The name of the property to add.
     * @param {string} value - The value of the property to add.
     * @param {string} category - The category of the property to add.
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {boolean} [options.localizeCategory=false] - When true, localization is attempted for the given category
     * @param {boolean} [options.localizeProperty=false] - When true, localization is attempted for the given property
     * @returns {boolean} - true if the property was added, false otherwise.
     */
    PropertyPanel.prototype.addProperty = function (name, value, category, options) {
        var element = this.tree.getElementForNode({ name: name, value: value, category: category });
        if (element) {
            return false;
        }

        var parent = null;
        var property = { name: name, value: value, type: 'property' };

        if (category) {
            parent = this.tree.getElementForNode({ name: category });
            if (!parent) {
                parent = this.tree.createElement_({ name: category, type: 'category' }, this.tree.myRootContainer, options && options.localizeCategory ? { localize: true } : null);
            }
            property.category = category;
        } else {
            parent = this.tree.myRootContainer;
        }

        this.tree.createElement_(property, parent, options && options.localizeProperty ? { localize: true } : null);

        return true;
    };

    /**
     * Returns whether this property panel currently has properties.
     *
     * @returns {boolean} - true if there are properties to display, false otherwise.
     */
    PropertyPanel.prototype.hasProperties = function () {
        for (var property in this.highlightableElements) {
            return true;
        }
        return false;
    };

    /**
     * Removes a property from this panel.  The property is defined by its name, value, and category.
     *
     * @param {string} name - The name of the property to remove.
     * @param {string} value - The value of the property to remove.
     * @param {string} category - The category of the property to remove.
     * @param {Object=} [options] - An optional dictionary of options.  Currently unused.
     * @returns {boolean} - true if the property was removed, false otherwise.
     */
    PropertyPanel.prototype.removeProperty = function (name, value, category, options) {
        var property = { name: name, value: value, category: category };
        var element = this.tree.getElementForNode(property);
        if (element) {
            delete this.highlightableElements[this.tree.delegate().getTreeNodeId(property)];
            element.parentNode.removeChild(element);
            return true;
        }
        return false;
    };

    /**
     * Removes all properties from the panel.
     */
    PropertyPanel.prototype.removeAllProperties = function () {
        this.highlightableElements = {};
        this.tree.clear();
    };

    /**
     * Sets the collapse state of the given category.
     *
     * @param {Object} category - A category object.
     * @param {boolean} collapsed - The new collapse state.
     */
    PropertyPanel.prototype.setCategoryCollapsed = function (category, collapsed) {
        var id = this.tree.delegate().getTreeNodeId(category);
        this.tree.setCollapsed(id, collapsed);
    };

    /**
     * Returns whether the given category is currently collapsed.
     *
     * @param {Object} category - A category object.
     * @returns {boolean} - true if the category is collapsed, false otherwise.
     */
    PropertyPanel.prototype.isCategoryCollapsed = function (category) {
        var id = this.tree.delegate().getTreeNodeId(category);
        return this.tree.isCollapsed(id);
    };

    /**
     * Returns the width and height to be used when resizing the panel to the content.
     *
     * @returns {{height: number, width: number}}
     */
    PropertyPanel.prototype.getContentSize = function () {
        // For the PropertyPanel, it's the size of the tree + some padding value for the height.
        //
        var treeContainer = this.tree.myRootContainer;
        return { height: treeContainer.clientHeight + 55, width: treeContainer.clientWidth };
    };

    /**
     * Highlights the given text if found in the property name or value.
     *
     * @param {string} text - The text to highlight.
     * @param {Object=} [options] - An optional dictionary of options.  Currently unused.
     */
    PropertyPanel.prototype.highlight = function (text, options) {
        function highlightElement(element) {
            var current = element.innerHTML;
            var unhighlighted = current.replace(/(<highlight>|<\/highlight>)/igm, "");
            if (current !== unhighlighted) {
                element.innerHTML = unhighlighted;
            }

            if (text && text !== "") {
                var query = new RegExp("(\\b" + text + "\\b)", "gim");
                var highlighted = unhighlighted.replace(query, "<highlight>$1</highlight>");
                element.innerHTML = highlighted;
            }
        }

        for (var property in this.highlightableElements) {
            var elements = this.highlightableElements[property];
            for (var i = 0; i < elements.length; ++i) {
                highlightElement(elements[i]);
            }
        }
    };

    /**
     * Creates and adds the HTML elements to display the given category.
     *
     * @param {Object} category - A category object.
     * @param {HTMLElement} parent - The parent to attach the new HTML elements.
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {boolean} [options.localize=false] - When true, localization is attempted for the given category name.
     *
     * @returns {Array} elementList - the list of HTML elements to include when highlighting.
     *                                Warning:  ensure no event listeners are attached to these elements
     *                                as they will be lost during highlighting.
     */
    PropertyPanel.prototype.displayCategory = function (category, parent, options) {
        var name = document.createElement('div');

        var text = category.name;
        if (options && options.localize) {
            name.setAttribute('data-i18n', text);
            text = Autodesk.Viewing.i18n.translate(text);
        }

        name.textContent = text;
        name.title = text;
        name.className = 'categoryName';
        parent.appendChild(name);

        // Make the category name highlightable.
        //
        return [name];
    };

    function replaceUrls(s) {
        s = String(s); // Make sure we only get Strings here!
        var t = ' target="blank" class="propertyLink" ';
        var patternMap = [{
            pattern: /\b(?:https?|ftp):\/\/[a-z0-9-+&@#\/%?=~_|!:,.;]*[a-z0-9-+&@#\/%=~_|]/gim,
            value: '<a' + t + 'href="$&">$&</a>'
        }, {
            pattern: /(^|[^\/])(www\.[\S]+(\b|$))/gim,
            value: '$1<a' + t + 'href="http://$2">$2</a>'
        }];
        return patternMap.reduce(function (a, b) {
            return a.replace(b.pattern, b.value);
        }, s);
    }

    /**
     * Creates and adds the HTML elements to display the given property.
     *
     * @param {Object} property - A property object.
     * @param {HTMLElement} parent - The parent to attach the new HTML elements.
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {boolean} [options.localize=false] - When true, localization is attempted for the given property name.
     *
     * @returns {Array} elementList - the list of HTML elements to include when highlighting.
     *                                Warning:  ensure no event listeners are attached to these elements
     *                                as they will be lost during highlighting.
     */
    PropertyPanel.prototype.displayProperty = function (property, parent, options) {
        var name = document.createElement('div');

        var text = property.name;
        if (options && options.localize) {
            name.setAttribute('data-i18n', text);
            text = Autodesk.Viewing.i18n.translate(text);
        }

        name.textContent = text;
        name.title = text;
        name.className = 'propertyName';

        var separator = document.createElement('div');
        separator.className = 'separator';

        var value = document.createElement('div');
        value.textContent = property.value;

        var s = property.value;
        value.title = s;
        s = replaceUrls(s);
        value.innerHTML = s;

        value.className = 'propertyValue';

        parent.appendChild(name);
        parent.appendChild(separator);
        parent.appendChild(value);

        // Make the property name and value highlightable.
        //
        return [name, value];
    };

    /**
     * Override this to specify the CSS classes of a category. This way, in CSS, the designer
     * can specify custom styling for specific category types.
     *
     * @param {Object} category
     * @returns {string} - CSS classes for the category.
     */
    PropertyPanel.prototype.getCategoryClass = function (category) {
        return 'category';
    };

    /**
     * Override this to specify the CSS classes of a property. This way, in CSS, the designer
     * can specify custom styling for specific property types.
     *
     * @param {Object} property
     * @returns {string} - CSS classes for the property.
     */
    PropertyPanel.prototype.getPropertyClass = function (property) {
        return 'property';
    };

    /**
     * Override this method to do something when the user clicks on a category.  The default
     * implementation is to toggle the collapse state of the category.
     *
     * @param {Object} category
     * @param {Event} event
     */
    PropertyPanel.prototype.onCategoryClick = function (category, event) {
        this.setCategoryCollapsed(category, !this.isCategoryCollapsed(category));
    };

    /**
     * Override this method to do something when the user clicks on a property.
     *
     * @param {Object} property
     * @param {Event} event
     */
    PropertyPanel.prototype.onPropertyClick = function (property, event) {
    };

    /**
     * Override this method to do something when the user clicks on a category's icon.  The default
     * implementation is to toggle the collapse state of the category.
     *
     * @param {Object} category
     * @param {Event} event
     */
    PropertyPanel.prototype.onCategoryIconClick = function (category, event) {
        this.setCategoryCollapsed(category, !this.isCategoryCollapsed(category));
    };

    /**
     * Override this method to do something when the user clicks on a property's icon.
     *
     * @param {Object} property
     * @param {Event} event
     */
    PropertyPanel.prototype.onPropertyIconClick = function (property, event) {
    };

    /**
     * Override this method to do something when the user double clicks on a category.
     *
     * @param {Object} category
     * @param {Event} event
     */
    PropertyPanel.prototype.onCategoryDoubleClick = function (category, event) {
    };

    /**
     * Override this method to do something when the user double clicks on a property.
     *
     * @param {Object} property
     * @param {Event} event
     */
    PropertyPanel.prototype.onPropertyDoubleClick = function (property, event) {
    };

    /**
     * Override this method to do something when the user right clicks on a category.
     *
     * @param {Object} category
     * @param {Event} event
     */
    PropertyPanel.prototype.onCategoryRightClick = function (category, event) {
    };

    /**
     * Override this method to do something when the user right clicks on a property.
     *
     * @param {Object} property
     * @param {Event} event
     */
    PropertyPanel.prototype.onPropertyRightClick = function (property, event) {
    };


    return PropertyPanel;
});