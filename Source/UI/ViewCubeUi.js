define([
    '../Core/Controller/Autocam',
    '../Core/i18n',
    '../Core/Constants/Global'
], function(
    Autocam,
    i18n,
    Global
) {;
    'use strict'
    var ViewCubeUi = function (viewer) {
        this.viewer = viewer;
    
        this.cube = null; // Autocam.ViewCube
        this.viewcube = null;
        this.infoButton = null;
        this.homeViewContainer = null;
    };
    
    
    ViewCubeUi.prototype = {
        constructor: ViewCubeUi,
    
        create: function () {
            var config = this.viewer.config,
                wantInfoButton = config && config.wantInfoButton !== undefined ? config.wantInfoButton : false;  // Hide info button as default
    
            if (wantInfoButton) {
                this.initInfoButton();
            }
            this.initHomeButton();
        },
    
        initInfoButton: function () {
            if (0 < document.getElementsByClassName('infoButton').length) {
                return;
            }
    
            this.infoButton = document.createElement('div');
            this.infoButton.className = "infoButton";
            this.infoButton.style.cursor = "pointer";
    
            this.viewer.container.appendChild(this.infoButton);
    
            var self = this;
            this.infoButton.addEventListener("click", function (e) {
                var propertyPanel = self.viewer.getPropertyPanel(true);
                var visible = !propertyPanel.areDefaultPropertiesShown() || !propertyPanel.isVisible();
    
                if (visible) {
                    propertyPanel.showDefaultProperties();
                }
    
                if (visible !== propertyPanel.isVisible()) {
                    propertyPanel.setVisible(visible);
                }
            });
        },
    
        initHomeButton: function () {
            if (0 < document.getElementsByClassName('homeViewWrapper').length) {
                return;
            }
    
            var homeViewContainer = document.createElement('div');
            homeViewContainer.className = "homeViewWrapper";
            homeViewContainer.style.cursor = "pointer";
    
            this.viewer.container.appendChild(homeViewContainer);
    
            this.homeViewContainer = homeViewContainer;
    
            var self = this;
            homeViewContainer.addEventListener("click", function (e) {
                self.viewer.navigation.setRequestHomeView(true);
            });
    
            this._initHomeMenu(homeViewContainer);
        },
    
        _initHomeMenu: function (parent) {
            var viewer = this.viewer;
            var autocam = viewer.autocam;
            var self = this;
    
            this.hideHomeViewMenu = function (e) {
                homeViewMenu.style.display = "none";
                document.removeEventListener("click", self.hideHomeViewMenu);
            };
    
            // Add the handle for the menu.
            var handle = document.createElement("div");
            handle.className = "homeViewMenuHandle";
            var image = document.createElement('img');
            var iconNormal = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsSAAALEgHS3X78AAAAIGNIUk0AAH7FAACLdgAA9UcAAIsOAABxUAAA6BUAADlYAAAfBMec4XAAAAEBSURBVHja7JcxCsIwFIb/V3oFx04v4iB4A3ev4Ak9iOABOhQcageHDh7iuVSwpW1eYmIFEwiFQvN9SZP/ERIRLNkyLNySQBLIhy+I6AhgE5F5FZHTpACAbV3X61h0Zs5nVwBAJiL0rd+eNuHvnQIArTEmplhrE7gAWEUUePSO/Vg1jJgFvQyYWoFoWTDMgLlNWDFzIyIUqjNzA6DSCpwBlMaYW4iZd+OU3bh2ARG5h5J4h3fj6nIghIQNbg2iTyQ0cFUS+kho4eoodpFwgTvVAo2EK9y5GM1J+MC9quGYhC98shaoPiQqAOwB7Hzhrxn1umMrABy6pxeT0t3w7wWeAwD5qe4YizvzugAAAABJRU5ErkJggg==";
            image.src = iconNormal;
            image.width = image.height = 18;
            handle.appendChild(image);
            handle.addEventListener("mouseover", function (e) {
                image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsSAAALEgHS3X78AAAAIGNIUk0AAH7FAACLdgAA9UcAAIsOAABxUAAA6BUAADlYAAAfBMec4XAAAAEVSURBVHja7JcxDoJAEEX/rvY2HMEb6AEsaTDxBngKIzfgDBR6AxJtiI0egN7Ght6GWBIYGzVKQHaQDYU7yYSwxb5HMvs3CCJCnyXRcxkBIzAsLwyWpx0ARyNzn29m81oBAE60mmqj237smBkwAl9PAfIssv3Y1kbMs+j9VZQvIyHEGMBI40enRHSpFdCcBR8ZUJcD2rKgnAH1Q5gmnu3HXcOBNPGUBIrQDbqUeMKL0A2UBIjo2pXEO5yIrso50IVEE7wxiH6RUIErJWEbCVW4chRzJDhw1l2gIsGFPzdmNQBLLrZr6R7pcL69WrpHkovtGoDF2o8rUCXRFt5aoCzRFl4pwCwLwOTxBGOeXi3Mv+HfC9wHAAIQ03ZDDGqmAAAAAElFTkSuQmCC";
            });
            handle.addEventListener("mouseleave", function (e) {
                image.src = iconNormal;
            });
    
            parent.appendChild(handle);
    
            // Add the RMB menu.
            var homeViewMenu = document.createElement('div');
            homeViewMenu.className = "homeViewMenu";
            this.viewer.container.appendChild(homeViewMenu);
    
            var setHome = document.createElement('div');
            setHome.className = "homeViewMenuItem";
            setHome.textContent = i18n.translate("Set current view as Home");
            homeViewMenu.appendChild(setHome);
    
            setHome.addEventListener("click", function (e) {
                autocam.setCurrentViewAsHome(false);
                self.hideHomeViewMenu(e);
            });
    
            var focusAndSetHome = document.createElement('div');
            focusAndSetHome.className = "homeViewMenuItem";
            focusAndSetHome.textContent = i18n.translate("Focus and set as Home");
            homeViewMenu.appendChild(focusAndSetHome);
    
            focusAndSetHome.addEventListener("click", function (e) {
                autocam.setCurrentViewAsHome(true);
                self.hideHomeViewMenu(e);
            });
    
            var resetHome = document.createElement('div');
            resetHome.className = "homeViewMenuItem";
            resetHome.textContent = i18n.translate("Reset Home");
            homeViewMenu.appendChild(resetHome);
    
            resetHome.addEventListener("click", function (e) {
                autocam.resetHome();
                self.hideHomeViewMenu(e);
            });
    
            parent.addEventListener("mouseover", function (e) {
                if ((viewer.model && viewer.model.is2d()) || (viewer.prefs && !viewer.prefs.viewCube)) {
                    handle.style.display = "block";
                }
            });
    
            parent.addEventListener("mouseleave", function (e) {
                handle.style.display = "none";
            });
    
            handle.addEventListener("click", function (e) {
                if ((viewer.model && viewer.model.is2d()) || (viewer.prefs && !viewer.prefs.viewCube)) {
                    homeViewMenu.style.display = "block";
                    document.addEventListener("click", self.hideHomeViewMenu);
                }
                e.stopPropagation();
            });
    
            parent.addEventListener("contextmenu", function (e) {
                if ((viewer.model && viewer.model.is2d()) || (viewer.prefs && !viewer.prefs.viewCube)) {
                    homeViewMenu.style.display = "block";
                    document.addEventListener("click", self.hideHomeViewMenu);
                }
            });
        },
    
        displayViewCube: function (display, updatePrefs) {
            if (updatePrefs !== false)
                this.viewer.prefs.set('viewCube', display);
    
            if (display && !this.cube) {
                this.viewcube = document.createElement("div");
                this.viewcube.className = "viewcube";
                this.viewer.container.appendChild(this.viewcube);
                this.cube = new Autocam.ViewCube("cube", this.viewer.autocam, this.viewcube, Global.LOCALIZATION_REL_PATH);
            }
            else if (!this.cube) {
                this._positionHomeButton();
                return; //view cube is not existent and we want it off? Just do nothing.
            }
    
            //this.viewcube.style.display = (display ? "block" : "none");
            this.viewcube.style.display = "none";
    
            this._positionHomeButton();
    
            if (display) {
                this.viewer.autocam.refresh();
            }
        },
    
        _positionHomeButton: function () {
            if (this.homeViewContainer) {
                var viewCubeVisible = this.cube && this.viewcube && (this.viewcube.style.display === 'block'),
                    containerBounds = this.viewer.container.getBoundingClientRect(),
                    homeButtonBounds = this.homeViewContainer.getBoundingClientRect(),
                    right;
    
                if (viewCubeVisible) {
                    var viewCubeBounds = this.viewcube.getBoundingClientRect();
                    right = containerBounds.left + containerBounds.width - viewCubeBounds.left - homeButtonBounds.width;
    
                } else if (this.infoButton) {
                    var infoButtonBounds = this.infoButton.getBoundingClientRect();
                    right = containerBounds.left + containerBounds.width - infoButtonBounds.left + infoButtonBounds.width - homeButtonBounds.width;
                } else {
                    right = 10;
                }
                this.homeViewContainer.style.right = right + 'px';
            }
        },
    
        uninitialize: function () {
            if (this.viewcube) {
                this.viewer.container.removeChild(this.viewcube);
                this.viewcube = null;
            }
    
            this.infoButton = null;
    
            if (this.cube) {
                this.cube.dtor();
                this.cube = null;
            }
    
            this.homeViewContainer = null;
            this.hideHomeViewMenu = null;
            this.viewer = null;
        }
    };

    return ViewCubeUi;
});