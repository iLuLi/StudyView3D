define(['../i18n'], function(i18n) {
    'use strict';
     /**
     *  DockingPanel represents a UI panel that is movable and resizeable within
     *  the bounds of its parent container.
     *  @constructor
     *
     *  @alias Autodesk.Viewing.UI.DockingPanel
     *
     *  @param {HTMLElement} parentContainer - The container for this panel.
     *  @param {string} id - The id to assign this panel.
     *  @param {string} title - The title of this panel.
     *  @param {Object=} [options] - An optional dictionary of options.
     *  @param {boolean} [options.localizeTitle=true] - When true, localization is attempted for the given title.
     *
     * @example <caption>From DocumentExample.html</caption>
            // Example of a simple DockingPanel that displays the given content.
            // The titlebar and move behavior are overridden in initialize(), which also
            // creates a custom close button.
            //
            SimplePanel = function(parentContainer, id, title, content, x, y)
            {
                this.content = content;
                Autodesk.Viewing.UI.DockingPanel.call(this, parentContainer, id, '');
    
                // Auto-fit to the content and don't allow resize.  Position at the coordinates given.
                //
                this.container.style.height = "auto";
                this.container.style.width = "auto";
                this.container.style.resize = "none";
                this.container.style.left = x + "px";
                this.container.style.top = y + "px";
            };
    
            SimplePanel.prototype = Object.create(Autodesk.Viewing.UI.DockingPanel.prototype);
            SimplePanel.prototype.constructor = SimplePanel;
    
            SimplePanel.prototype.initialize = function()
            {
                // Override DockingPanel initialize() to:
                // - create a standard title bar
                // - click anywhere on the panel to move
                // - create a close element at the bottom right
                //
                this.title = this.createTitleBar(this.titleLabel || this.container.id);
                this.container.appendChild(this.title);
    
                this.container.appendChild(this.content);
                this.initializeMoveHandlers(this.container);
    
                this.closer = document.createElement("div");
                this.closer.className = "simplePanelClose";
                this.closer.textContent = "Close";
                this.initializeCloseHandler(this.closer);
                this.container.appendChild(this.closer);
            };
     */
    var DockingPanel = function (parentContainer, id, title, options) {
        
        // Constants
        this.kMinWdth = 100;
        this.kMinHeight = 100;

        this.visibilityCallbacks = [];
        this.movedSinceLastClick = false;

        this.parentContainer = parentContainer;

        this.container = document.createElement("div");
        this.container.id = id;
        this.container.lastWidth = "";
        this.container.dockRight = false;
        this.container.dockBottom = false;
        this.titleLabel = title;

        // By default, localize the title.
        //
        options = options || {};
        if (!options.hasOwnProperty('localizeTitle')) {
            options.localizeTitle = true;
        }
        this.options = options;

        this.container.classList.add('dockingPanel');

        parentContainer.appendChild(this.container);
        this.listeners = [];

        this.initialize();

        // The panel is not visible initially.  The child class may still be constructing
        // the elements, so let it decide when to show.
        //
        this.setVisible(false);
    };

    /**
     *  Creates the sub-elements of this DockingPanel.  Override this in derived classes.
     *  The default implementation is to create a title bar with the title or id provided
     *  in the constructor.  The title bar also acts as the move handler for the DockingPanel.
     *  Finally, a close button is added to the top right corner.
     */
    DockingPanel.prototype.initialize = function () {
        this.title = this.createTitleBar(this.titleLabel || this.container.id);
        this.container.appendChild(this.title);
        this.initializeMoveHandlers(this.title);
        this.setTitle(this.titleLabel || this.container.id, this.options);

        this.closer = this.createCloseButton();
        this.container.appendChild(this.closer);
    };

    /**
     *  Performs any clean up necessary.  This can include disconnecting UI elements,
     *  unregistering event callbacks, etc.
     *
     */
    DockingPanel.prototype.uninitialize = function () {
        // Remove all of the listeners we're aware of.
        //
        for (var i = 0; i < this.listeners.length; ++i) {
            var listener = this.listeners[i];
            listener.target.removeEventListener(listener.eventId, listener.callback);
        }
        this.listeners = [];
        this.visibilityCallbacks = [];

        // Disconnect our DOM tree from our parent.
        //
        this.parentContainer.removeChild(this.container);
        this.parentContainer = null;
        this.container = null;
        this.title = null;
        this.closer = null;
    };

    /**
     *  Adds a callback to call when this DockingPanel changes visibility.
     *
     *  @param {function} callback - A function that takes in a single boolean parameter
     *                               indicating the current visibility state.
     */
    DockingPanel.prototype.addVisibilityListener = function (callback) {
        this.visibilityCallbacks.push(callback);
    };

    /**
     *  Sets the new visibility state of this DockingPanel.
     *
     *  @param {boolean} show - The desired visibility state.
     */
    DockingPanel.prototype.setVisible = function (show) {

        if (show) {
            var parentBox = this.getContainerBoundingRect();

            if (this.container.dockRight) {
                var screenw = parentBox.width;
                var wi2 = 300;

                var wi = this.container.lastWidth || this.container.style.width;
                if (!wi)
                    wi = this.container.getBoundingClientRect().width;
                if (wi)
                    wi2 = parseInt(wi);

                this.container.style.left = (screenw - wi2) + "px";
            }
            if (this.container.dockBottom) {
                var screenh = parentBox.height;
                var hi2 = 300;

                var hi = this.container.lastHeight || this.container.style.height;
                if (!hi)
                    hi = this.container.getBoundingClientRect().height;
                if (hi)
                    hi2 = parseInt(hi);

                this.container.style.top = (screenh - hi2) + "px";
            }

            this.container.style.maxHeight = parentBox.height + "px";
            this.container.style.maxWidth = parentBox.width + "px";
            this.container.style.display = "block";

        }
        else {
            this.container.lastWidth = this.container.style.width;
            this.container.lastHeight = this.container.style.height;
            this.container.style.display = "none";
        }

        for (var i = 0; i < this.visibilityCallbacks.length; i++) {
            this.visibilityCallbacks[i](show);
        }
    };

    /**
     *  Gets the new visibility state of this DockingPanel.
     *
     *  return {boolean} - Whether or not the panel is visible
     */
    DockingPanel.prototype.isVisible = function () {
        return (this.container.style.display === "block");
    };

    /**
     *  Notification that visibility has been changed by external sources.
     */
    DockingPanel.prototype.visibilityChanged = function () {
    };

    /**
     *  Initializes the given HTMLDomElement as the move handle for this DockingPanel.
     *  When this element is clicked and dragged, this DockingPanel is moved.
     *
     *  @param {HTMLElement} mover - the DOM element that will act as the move handle.
     */
    DockingPanel.prototype.initializeMoveHandlers = function (mover) {
        var x, y;
        var lastX, lastY;
        var startX, startY;
        var deltaX, deltaY;
        var container = this.container;
        var self = this;

        // This gets scoped under window during the handleMove event handler
        function handleMove(e) {
            var minWidth = container.style.minWidth ? parseInt(container.style.minWidth) : self.kMinWdth,
                minHeight = container.style.minHeight ? parseInt(container.style.minHeight) : self.kMinHeight,
                parentRect = self.getContainerBoundingRect();

            if (container.style.maxWidth && parseInt(container.style.width) > parseInt(container.style.maxWidth)) {
                container.style.width = container.style.maxWidth;
            }
            if (container.style.maxHeight && parseInt(container.style.height) > parseInt(container.style.maxHeight)) {
                container.style.height = container.style.maxHeight;
            }

            if (parseInt(container.style.width) < minWidth) {
                container.style.width = minWidth + "px";
            }
            if (parseInt(container.style.height) < minHeight) {
                container.style.height = minHeight + "px";
            }
            if (e.type === "touchmove") {
                e.screenX = e.touches[0].screenX;
                e.screenY = e.touches[0].screenY;
            }

            deltaX += e.screenX - lastX;
            deltaY += e.screenY - lastY;

            x = startX + deltaX;
            y = startY + deltaY;

            var wi = parseInt(container.style.width);
            var hi = parseInt(container.style.height);

            if (isNaN(wi)) {
                wi = self.container.getBoundingClientRect().width;
            }
            if (isNaN(hi)) {
                hi = self.container.getBoundingClientRect().height;
            }

            // check left, top
            if (x < 5)
                x = 0;

            if (y < 5)
                y = 0;

            container.dockRight = false;
            container.dockBottom = false;

            // check bottom, right
            if (parentRect.width - 5 < x + wi) {
                x = parentRect.width - wi;
                container.dockRight = true;
            }

            if (parentRect.height - 5 < y + hi) {
                y = parentRect.height - hi;
                container.dockBottom = true;
            }
            /*
                    if (self.scrollContainer) {
                        if (x == 0) {
                            self.scrollContainer.classList.remove("right");
                            self.scrollContainer.classList.add("left");
                        }
                        else {
                            self.scrollContainer.classList.remove("left");
                            self.scrollContainer.classList.add("right");
                        }
                    }
            */
            container.style.left = x + "px";
            container.style.top = y + "px";
            container.style.maxWidth = (parentRect.width - x) + "px";
            container.style.maxHeight = (parentRect.height - y) + "px";

            //TODO: check for right side
            //TODO: handle docking and bounds check against the canvas element

            lastX = e.screenX;
            lastY = e.screenY;

            self.onMove(e, x, y);
        }

        function handleUp(e) {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
            self.onEndMove(e, x, y);
        }

        function handleDown(e) {
            if (e.type === "touchstart") {
                e.screenX = e.touches[0].screenX;
                e.screenY = e.touches[0].screenY;
            }
            lastX = e.screenX;
            lastY = e.screenY;

            deltaX = 0;
            deltaY = 0;

            // Save the current panel position relative to its parent container.
            //
            startX = self.container.offsetLeft;
            startY = self.container.offsetTop;

            window.addEventListener('mousemove', handleMove, false);
            window.addEventListener('mouseup', handleUp, false);
            window.addEventListener('touchmove', handleMove, false);
            window.addEventListener('touchend', handleUp, false);

            e.preventDefault();

            self.onStartMove(e, startX, startY);
        }

        // We'll keep track of the mousedown event listener as this one is always active.
        // The mousemove and mouseup listeners above are temporary so we don't need to track them.
        //
        self.addEventListener(mover, 'mousedown', handleDown);
        self.addEventListener(mover, 'touchstart', handleDown);
    };

    /**
     *  Initializes the given HTMLDomElement as the close handle for this DockingPanel.
     *  When this element is clicked, this DockingPanel is hidden.
     *
     *  @param {HTMLElement} closer - the DOM element that will act as the close handle.
     */
    DockingPanel.prototype.initializeCloseHandler = function (closer) {
        var self = this;
        self.addEventListener(closer, 'click', function (e) {
            self.setVisible(false);
        }, false);
    };

    /**
     *  Creates a scroll container element to add to this DockingPanel.  Call this method during
     *  initialize() if a scroll container is needed. The function will create the scroll container
     *  and make it available via the "scrollContainer" property of the DockingPanel.
     *
     *  @param {Object=} [options] - An optional dictionary of options.
     *  @param {boolean} [options.left=false] - When true, the scrollbar appears on the left.
     *  @param {int} [options.heightAdjustment=0] - The scroll container height is 100% of the panel
     *                                              minus the height adjustment.  Provide a value
     *                                              to account for other elements in the panel like a title bar.
     *  @param {int} [options.marginTop=0] - The marginTop setting for the scroll container's CSS style, in pixels.
     */
    DockingPanel.prototype.createScrollContainer = function (options) {
        var scrollContainer = document.createElement("div"),
            classList = scrollContainer.classList;
        classList.add('dockingPanelScroll');
        classList.add((options && options.left) ? 'left' : 'right');

        if (options && options.heightAdjustment) {
            scrollContainer.style.height = "calc(100% - " + options.heightAdjustment + "px)";
        }

        if (options && options.marginTop) {
            scrollContainer.style.marginTop = options.marginTop + "px";
        }

        scrollContainer.id = this.container.id + '-scroll-container';

        this.container.appendChild(scrollContainer);
        this.scrollContainer = scrollContainer;

        return scrollContainer; //for backwards compatibility we still return that, though it's no longer documented that way.
    };



    /**
     *  Creates a title bar element to add to this DockingPanel.  Call this method during
     *  initialize() if a standard title bar is desired, and then add it to an existing container.
     *
     *  @param {string} title - The text to use in the title bar.
     *
     *  @returns {HTMLElement} The created title bar.
     */
    DockingPanel.prototype.createTitleBar = function (title) {
        var titleBar = document.createElement("div");
        titleBar.className = "dockingPanelTitle";
        titleBar.textContent = title;

        var that = this;
        that.addEventListener(titleBar, 'click', function (event) {
            if (!that.movedSinceLastClick) {
                that.onTitleClick(event);
            }
            that.movedSinceLastClick = false;
        });

        that.addEventListener(titleBar, 'dblclick', function (event) {
            that.onTitleDoubleClick(event);
        });

        return titleBar;
    };

    /**
     * Sets the title for this panel.
     *
     * @param {string} text - The title for this panel.
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {boolean} [options.localizeTitle=false] - When true, localization is attempted for the given text.
     */
    DockingPanel.prototype.setTitle = function (text, options) {
        if (options && options.localizeTitle) {
            this.title.setAttribute('data-i18n', text);
            text = i18n.translate(text);
        } else {
            this.title.removeAttribute('data-i18n');
        }
        this.title.textContent = text;
    };

    /**
     *  Creates a close button to add to this DockingPanel.  When clicked, this DockingPanel
     *  is hidden.  Call this method during initialize() if a standard close button is desired,
     *  and then add it to an existing container.
     *
     *  @returns {HTMLElement} The created close button.
     */
    DockingPanel.prototype.createCloseButton = function () {
        var closeButton = document.createElement("div");
        closeButton.className = "dockingPanelClose";
        closeButton.innerHTML = "&times;";
        this.initializeCloseHandler(closeButton);
        return closeButton;
    };

    /**
     * Override this event to be notified when this panel begins a move operation.
     *
     * @param {MouseEvent} event - The mousedown event.
     * @param {int} startX - The starting x position of the panel in pixels.
     * @param {int} startY - The starting y position of the panel in pixels.
     */
    DockingPanel.prototype.onStartMove = function (event, startX, startY) {
    };

    /**
     * Override this event to be notified when this panel ends a move operation.
     *
     * @param {MouseEvent} event - The mouseup event.
     * @param {int} endX - The ending x position of the panel in pixels.
     * @param {int} endY - The ending y position of the panel in pixels.
     */
    DockingPanel.prototype.onEndMove = function (event, endX, endY) {
    };

    /**
     * Override this to be notified when this panel is moved.  Note, do not forget to call
     * this base class method in the overriding method.
     *
     * @param {MouseEvent} event - The mousemove event
     * @param {int} currentX - The current x position of the panel in pixels
     * @param {int} currentY - The current y position of the panel in pixels
     */
    DockingPanel.prototype.onMove = function (event, currentX, currentY) {
        this.movedSinceLastClick = true;
    };

    /**
     * Override this method to be notified when the user clicks on the title.
     * @param {Event} event
     */
    DockingPanel.prototype.onTitleClick = function (event) {
    };

    /**
     * Override this method to be notified when the user double-clicks on the title.
     * @param {Event} event
     */
    DockingPanel.prototype.onTitleDoubleClick = function (event) {
    };

    /**
     * Adds an event listener to a given target that has an addEventListener(event, callback) API.
     * These event listeners are tracked by the DockingPanel and are automatically removed on uninitialize.
     *
     * @param {Object} target - The target that will fire the event.
     * @param {string} eventId - The event to be listened to.
     * @param {function} callback - The callback to execute when the event is fired.
     */
    DockingPanel.prototype.addEventListener = function (target, eventId, callback) {
        target.addEventListener(eventId, callback);
        this.listeners.push({ target: target, eventId: eventId, callback: callback });
    };

    /**
     * Removes an existing event listener added using DockingPanel.addEventListener.
     *
     * @param {Object} target - The target with the event listener.
     * @param {string} eventId - The id of the event being listened to.
     * @param {function} callback - The callback executed when the event is fired.
     *
     * @returns {boolean} - true if the listener was removed successfully; false otherwise.
     */
    DockingPanel.prototype.removeEventListener = function (target, eventId, callback) {
        for (var i = 0; i < this.listeners.length; ++i) {
            var listener = this.listeners[i];
            if (listener.target === target && listener.eventId === eventId && listener.callback === callback) {
                target.removeEventListener(eventId, callback);
                this.listeners.splice(i, 1);
                return true;
            }
        }
        return false;
    };

    /**
     * Override this method to return the width and height to use when resizing the panel to the content.
     *
     * @returns {{height: number, width: number}}
     */
    DockingPanel.prototype.getContentSize = function () {
        return { height: this.container.clientHeight, width: this.container.clientWidth };
    };

    /**
     * Resizes the panel to the current content.  Currently this only works on height.
     *
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {int} [options.maxHeight] - The maximum height to resize this panel.
     */
    DockingPanel.prototype.resizeToContent = function (options) {

        if (!this.isVisible())
            return;

        var dimensions = this.getContentSize(),
            newHeight = dimensions.height,
            panelRect = this.container.getBoundingClientRect(),
            parentRect = this.getContainerBoundingRect();

        var toolbarHeight = 75; //hardcoded clearance for the toolbar at the bottom

        var maxHeight = options && options.maxHeight ? options.maxHeight : parentRect.height;
        maxHeight -= toolbarHeight;

        if (newHeight > maxHeight) {
            newHeight = maxHeight;
        }

        // Attempt to reposition Y coordinate if dialog will overlap
        // the toolbar AND there is room above to use.
        var currTop = panelRect.top;
        if (currTop > 0 && currTop + newHeight + toolbarHeight > parentRect.height) {
            currTop = Math.max(0, parentRect.height - (newHeight + toolbarHeight));
        }

        // TODO: Once toolbar can be positioned anywhere, we will also need to
        // do the same for the width.
        this.container.style.height = newHeight.toString() + 'px';
        this.container.style.top = currTop + 'px';
    };

    /**
     * Returns the parent's container bounding rectangle.
     *
     * @returns {ClientRect} - bounding rectangle of the parent.
     */
    DockingPanel.prototype.getContainerBoundingRect = function () {
        return this.parentContainer.getBoundingClientRect();
    };

    return DockingPanel;
});