define([
    '../../Core/Manager/theExtensionManager',
    '../../Core/Constants/EventType',
    '../Extension',
    '../../Core/FovTool',
    '../../Core/WorldUpTool',
    '../../UI/HudMessage',
    '../../UI/Base/ToolbarSID',
    '../../Core/Constants/DeviceType',
    '../../UI/Base/ComboButton',
    '../../UI/Base/Button',
    '../../UI/Base/RadioButtonGroup',
    '../../Core/i18n'
], function(theExtensionManager, EventType, Extension, FovTool, WorldUpTool, HudMessage, ToolbarSID, DeviceType, ComboButton, Button, RadioButtonGroup, i18n) {
    'use strict';
    function createNavToggler(viewer, button, name) {
        return function () {
            var state = button.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool(name);
                button.setState(Button.State.ACTIVE);
            } else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
                button.setState(Button.State.INACTIVE);
            }
        };
    }

    var NavToolsExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };

    NavToolsExtension.prototype = Object.create(Extension.prototype);
    NavToolsExtension.prototype.constructor = NavToolsExtension;

    NavToolsExtension.prototype.load = function () {
        var viewer = this.viewer;

        // Register tools
        var fovtool = new FovTool(viewer);
        var rolltool = new WorldUpTool(viewer.impl, viewer);

        viewer.toolController.registerTool(fovtool);
        viewer.toolController.registerTool(rolltool);

        this.createUI();
        this.initCameraStateMachine();
        this.initFocalLengthOverlay();

        return true;
    };

    NavToolsExtension.prototype.createUI = function () {
        // Adds the UI for the default navigation tools (orbit, pan, dolly, camera controls)
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(true);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);
        var navActionDisplayMode = function (action) {
            return viewer.navigation.isActionEnabled(action) ? 'block' : 'none'
        };

        navTools.returnToDefault = function () { };

        if (this.options.mode === '3d') {
            var orbitToolsButton = new ComboButton('toolbar-orbitTools');
            orbitToolsButton.setToolTip('Orbit');
            orbitToolsButton.setIcon("adsk-icon-orbit-constrained");
            orbitToolsButton.setDisplay(navActionDisplayMode('orbit'));

            this.createOrbitSubmenu(orbitToolsButton);

            navTools.addControl(orbitToolsButton);
            navTools.orbittoolsbutton = orbitToolsButton;
            orbitToolsButton.setState(Button.State.ACTIVE);

            navTools.returnToDefault = function () {
                orbitToolsButton.setState(Button.State.ACTIVE);
            };
        }

        var panButton = new Button('toolbar-panTool');
        panButton.setToolTip('Pan');
        panButton.setIcon("adsk-icon-pan");
        panButton.onClick = createNavToggler(viewer, panButton, 'pan');
        panButton.setDisplay(navActionDisplayMode('pan'));

        navTools.addControl(panButton);
        navTools.panbutton = panButton;

        var dollyButton = new Button('toolbar-zoomTool');
        dollyButton.setToolTip('Zoom');
        dollyButton.setIcon("adsk-icon-zoom");
        dollyButton.onClick = createNavToggler(viewer, dollyButton, 'dolly');
        dollyButton.setDisplay(navActionDisplayMode('zoom'));

        navTools.addControl(dollyButton);
        navTools.dollybutton = dollyButton;

        var cameraButton = new ComboButton('toolbar-cameraSubmenuTool');
        cameraButton.setToolTip('Camera interactions');
        cameraButton.setIcon("adsk-icon-camera");
        cameraButton.saveAsDefault();
        this.createCameraSubmenu(cameraButton);
        navTools.addControl(cameraButton);
        navTools.camerabutton = cameraButton;
    };


    NavToolsExtension.prototype.createOrbitSubmenu = function (parentButton) {
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(true);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        var freeOrbitButton = new Button('toolbar-freeOrbitTool');
        freeOrbitButton.setToolTip('Free orbit');
        freeOrbitButton.setIcon("adsk-icon-orbit-free");
        freeOrbitButton.onClick = createNavToggler(viewer, freeOrbitButton, 'freeorbit');

        parentButton.addControl(freeOrbitButton);
        navTools.freeorbitbutton = freeOrbitButton;

        var orbitButton = new Button('toolbar-orbitTool');
        orbitButton.setToolTip('Orbit');
        orbitButton.setIcon("adsk-icon-orbit-constrained");
        orbitButton.onClick = createNavToggler(viewer, orbitButton, 'orbit');

        parentButton.addControl(orbitButton);
        navTools.orbitbutton = orbitButton;

        parentButton.onClick = orbitButton.onClick; // default

    };

    NavToolsExtension.prototype.createCameraSubmenu = function (parentButton) {
        var self = this;
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(true);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);
        var navActionDisplayMode = function (action) {
            return viewer.navigation.isActionEnabled(action) ? 'block' : 'none'
        };

        if (DeviceType.isTouchDevice) {
            var homeButton = new Button('toolbar-homeTool');
            homeButton.setToolTip('Home');
            homeButton.setIcon("adsk-icon-home");
            homeButton.onClick = function () {
                viewer.navigation.setRequestHomeView(true);
                var defaultNavToolName = viewer.getDefaultNavigationToolName();
                viewer.setActiveNavigationTool(defaultNavToolName);
                parentButton.restoreDefault();
            };
            homeButton.setDisplay(navActionDisplayMode('gotoview'));

            parentButton.addControl(homeButton);
            navTools.homebutton = homeButton;
        }

        //options = { defaultTooltipValue : "Fit to view (F)" };
        var fitToViewButton = new Button('toolbar-fitToViewTool');
        fitToViewButton.setToolTip('Fit to view');
        fitToViewButton.setIcon("adsk-icon-fit-to-view");
        fitToViewButton.onClick = function (e) {
            // Need to map the objects to dbIds
            viewer.fitToView(self.options.mode === "3d" ? viewer.getSelection() : undefined);
            var defaultNavToolName = viewer.getDefaultNavigationToolName();
            viewer.setActiveNavigationTool(defaultNavToolName);
            parentButton.restoreDefault();
        };
        fitToViewButton.setDisplay(navActionDisplayMode('gotoview'));

        parentButton.addControl(fitToViewButton);
        navTools.fovbutton = fitToViewButton;

        if (this.options.mode === "3d") {
            //options.defaultTooltipValue = "Focal length (Ctrl+Shift drag)";
            var fovButton = new Button('toolbar-focalLengthTool');
            fovButton.setToolTip('Focal length');
            fovButton.setIcon("adsk-icon-fov");
            fovButton.onClick = createNavToggler(viewer, fovButton, 'fov');
            fovButton.setDisplay(navActionDisplayMode('fov'));

            parentButton.addControl(fovButton);
            navTools.fovbutton = fovButton;
        }

        //options.defaultTooltipValue = "Roll (Alt+Shift drag)";
        var rollButton = new Button('toolbar-rollTool');
        rollButton.setToolTip('Roll');
        rollButton.setIcon("adsk-icon-roll");
        rollButton.onClick = createNavToggler(viewer, rollButton, 'worldup');
        rollButton.setDisplay(navActionDisplayMode('roll'));

        parentButton.addControl(rollButton);
        navTools.rollbutton = rollButton;
    };

    NavToolsExtension.prototype.initCameraStateMachine = function (mode) {
        var self = this;
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(true);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        this.toolChangedHandler = function (e) {
            if (e.toolName === "fov") {
                self.showFocalLengthOverlay(e.active);
            }
        };
        viewer.addEventListener(EventType.TOOL_CHANGE_EVENT, this.toolChangedHandler);

        this.navChangedHandler = function (e) {
            if (viewer.getDefaultNavigationToolName() === e.id)
                navTools.returnToDefault();
        };
        viewer.addEventListener(EventType.NAVIGATION_MODE_CHANGED_EVENT, this.navChangedHandler);
    };

    NavToolsExtension.prototype.initFocalLengthOverlay = function () {

        var container = this.focallength = document.createElement("div");

        container.className = "focallength";

        var table = document.createElement("table");
        var tbody = document.createElement("tbody");
        table.appendChild(tbody);

        container.appendChild(table);
        this.viewer.container.appendChild(container);

        var row = tbody.insertRow(-1);
        var cell = row.insertCell(0);
        cell.setAttribute("data-i18n", "Focal Length");
        cell.textContent = i18n.translate("Focal Length");
        cell = row.insertCell(1);
        cell.textContent = '';
        cell.style.width = "4em";
        cell.style.textAlign = "right";
        this.fovCell = cell;

        container.style.visibility = "hidden";
    };

    NavToolsExtension.prototype.showFocalLengthOverlay = function (state) {
        var self = this;
        var viewer = this.viewer;
        var myFocalLength = 0;

        function showFovHudMessage(yes) {
            if (yes) {
                // Display a hud messages.
                var messageSpecs = {
                    "msgTitleKey": "Orthographic View Set",
                    "messageKey": "The view is set to Orthographic",
                    "messageDefaultValue": "The view is set to Orthographic. Changing the focal length will switch to Perspective."
                };
                HudMessage.displayMessage(viewer.container, messageSpecs);
            }
            else {
                HudMessage.dismiss();
            }
        }

        function showFov(yes) {
            if (yes) updateFOV();

            if (self.focallength)
                self.focallength.style.visibility = yes ? "visible" : "hidden";
        }

        function updateFOV() {
            var camFocalLength = viewer.getFocalLength();
            if (myFocalLength !== camFocalLength) {
                myFocalLength = camFocalLength;
                self.fovCell.textContent = camFocalLength.toString() + " mm";
            }
        }

        function watchFOV(e) {
            updateFOV();
            // If camera changed to ORTHO and we are still in FOV mode
            // put up the warning message that the system will switch to perspective.
            //
            if (viewer.toolController.getActiveToolName() === "fov") {
                var camera = viewer.navigation.getCamera();
                var isOrtho = camera && !camera.isPerspective;

                showFov(!isOrtho);
                showFovHudMessage(isOrtho);
            }
        }
        var camera = viewer.navigation.getCamera();
        var isOrtho = camera && !camera.isPerspective;

        showFov(state && !isOrtho);
        showFovHudMessage(state && isOrtho);

        if (state) {
            viewer.addEventListener(EventType.CAMERA_CHANGE_EVENT, watchFOV);
        }
        else {
            viewer.removeEventListener(EventType.CAMERA_CHANGE_EVENT, watchFOV);
        }
    };

    NavToolsExtension.prototype.unload = function () {
        this.destroyUI();

        return true;
    };

    NavToolsExtension.prototype.destroyUI = function () {
        // Removes the UI created in createUI
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(false);

        if (!toolbar) {
            return true;
        }

        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        if (!navTools) {
            return true;
        }

        if (this.options.mode === '3d') {
            navTools.orbittoolsbutton.subMenu.removeEventListener(RadioButtonGroup.Event.ACTIVE_BUTTON_CHANGED, navTools.orbittoolsbutton.subMenuActiveButtonChangedHandler(navTools));
            navTools.removeControl(navTools.orbittoolsbutton.getId());
            navTools.orbittoolsbutton = null;
            navTools.orbitbutton.onClick = null;
            navTools.orbitbutton = null;
            navTools.freeorbitbutton.onClick = null;
            navTools.freeorbitbutton = null;
        }

        navTools.removeControl(navTools.panbutton.getId());
        navTools.panbutton.onClick = null;
        navTools.panbutton = null;

        navTools.removeControl(navTools.dollybutton.getId());
        navTools.dollybutton.onClick = null;
        navTools.dollybutton = null;

        navTools.camerabutton.subMenu.removeEventListener(RadioButtonGroup.Event.ACTIVE_BUTTON_CHANGED, navTools.camerabutton.subMenuActiveButtonChangedHandler(navTools));
        navTools.removeControl(navTools.camerabutton.getId());
        navTools.camerabutton.onClick = null;
        navTools.camerabutton = null;

        navTools.rollbutton.onClick = null;
        navTools.rollbutton = null;
        navTools.fovbutton.onClick = null;
        navTools.fovbutton = null;

        this.focallength = null;

        // Remove Listeners
        viewer.removeEventListener(EventType.TOOL_CHANGE_EVENT, this.toolChangedHandler);
        this.toolChangedHandler = null;
        viewer.removeEventListener(EventType.NAVIGATION_MODE_CHANGED_EVENT, this.navChangedHandler);
        this.navChangedHandler = null;

        return true;
    };

    
    theExtensionManager.registerExtension('Autodesk.DefaultTools.NavTools', NavToolsExtension);
    return NavToolsExtension;
});