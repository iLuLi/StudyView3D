define(['../../Core/Constants/DeviceType'], function(DeviceType) {
    'use strict';
    /** @constructor */
    var ContextMenu = function (viewer) {
        this.viewer = viewer;
        this.menus = [];
        this.open = false;
    };

    ContextMenu.prototype.constructor = ContextMenu;

    ContextMenu.prototype.show = function (event, menu) {
        var viewport = this.viewer.container.getBoundingClientRect();

        // Normalize Hammer events
        if (Array.isArray(event.changedPointers) && event.changedPointers.length > 0) {
            event.clientX = event.changedPointers[0].clientX;
            event.clientY = event.changedPointers[0].clientY;
        }

        var x = event.clientX - viewport.left;
        var y = event.clientY - viewport.top;

        if (!this.open) {

            var self = this;

            this.showMenu(menu, x, y);
            this.open = true;
            this.hideEventListener = function (event) {
                if (event.target.className !== "menuItem") {
                    self.hide(event);
                }
            };
            this.isTouch = (event.type === "press");
            document.body.addEventListener(this.isTouch ? "touchstart" : "mousedown", this.hideEventListener, true);
        }
    };

    ContextMenu.prototype.showMenu = function (menu, x, y) {
        var container = document.createElement('div'),
            menuItem,
            submenus = [];

        container.className = 'menu';
        this.viewer.container.appendChild(container);
        this.menus.push(container);

        for (var i = 0; i < menu.length; ++i) {
            var defn = menu[i],
                title = defn.title,
                target = defn.target;

            menuItem = this.createMenuItem(container, title);

            if (typeof target === 'function') {
                this.addCallbackToMenuItem(menuItem, target);

            } else if (Array.isArray(target)) {
                submenus.push({ menuItem: menuItem, target: target });

            } else {
                avp.logger.warn("Invalid context menu option:", title, target);
            }
        }

        var rect = container.getBoundingClientRect(),
            containerWidth = rect.width,
            containerHeight = rect.height,
            viewerRect = this.viewer.container.getBoundingClientRect(),
            viewerWidth = viewerRect.width,
            viewerHeight = viewerRect.height,
            shiftLeft = DeviceType.isTouchDevice && !this.viewer.navigation.getUseLeftHandedInput();

        if (shiftLeft) {
            x -= containerWidth;
        }

        if (x < 0) {
            x = 0;
        }
        if (viewerWidth < x + containerWidth) {
            x = viewerWidth - containerWidth;
            if (x < 0) {
                x = 0;
            }
        }

        if (y < 0) {
            y = 0;
        }
        if (viewerHeight < y + containerHeight) {
            y = viewerHeight - containerHeight;
            if (y < 0) {
                y = 0;
            }
        }

        container.style.top = Math.round(y) + "px";
        container.style.left = Math.round(x) + "px";

        for (i = 0; i < submenus.length; ++i) {
            var submenu = submenus[i];

            menuItem = submenu.menuItem;
            rect = menuItem.getBoundingClientRect();
            x = Math.round((shiftLeft ? rect.left : rect.right) - viewerRect.left);
            y = Math.round(rect.top - viewerRect.top);

            this.addSubmenuCallbackToMenuItem(menuItem, submenu.target, x, y);
        }
    };

    ContextMenu.prototype.createMenuItem = function (parentItem, text) {
        var menuItem = document.createElement("div");
        menuItem.className = "menuItem";
        menuItem.setAttribute("data-i18n", text);
        menuItem.textContent = i18n.translate(text);
        parentItem.appendChild(menuItem);
        return menuItem;
    };

    ContextMenu.prototype.addCallbackToMenuItem = function (menuItem, target) {
        var that = this;

        menuItem.addEventListener('click', function (event) {
            that.hide();
            target();
            event.preventDefault();
            return false;
        }, false);
    };

    ContextMenu.prototype.addSubmenuCallbackToMenuItem = function (menuItem, menu, x, y) {
        var that = this;

        menuItem.addEventListener('click', function () {
            that.showMenu(menu, x, y);
        }, false);
    };

    ContextMenu.prototype.hide = function () {
        if (this.open) {
            for (var index = 0; index < this.menus.length; ++index) {
                if (this.menus[index]) {
                    this.menus[index].parentNode.removeChild(this.menus[index]);
                }
            }
            this.menus = [];
            this.open = false;
            document.body.removeEventListener(this.isTouch ? "touchstart" : "mousedown", this.hideEventListener);
            this.isTouch = false;
            return true;
        }
        return false;
    };

    return ContextMenu;
});