define([
    '../../Core/Manager/theExtensionManager',
    '../Extension',
    '../../UI/Base/ToolbarSID',
    './FusionOrbitTool',
    '../../UI/Base/Button',
    '../../Core/Constants/EventType'
], function(theExtensionManager, Extension, ToolbarSID, FusionOrbitTool, Button, EventType) {
    'use strict';
    var FusionOrbitExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
    };

    FusionOrbitExtension.prototype = Object.create(Extension.prototype);
    FusionOrbitExtension.prototype.constructor = FusionOrbitExtension;

    FusionOrbitExtension.prototype.load = function () {
        var self = this;
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar ? viewer.getToolbar(true) : undefined;

        this.tool = new FusionOrbitTool();
        this.tool.setViewer(viewer);
        viewer.toolController.registerTool(this.tool);

        function onToolbarCreated() {
            viewer.removeEventListener(EventType.TOOLBAR_CREATED_EVENT, onToolbarCreated);
            self.createUI();
        }

        if (toolbar) {
            var modelTools = toolbar.getControl(ToolbarSID.MODELTOOLSID);
            if (modelTools && modelTools.getNumberOfControls() > 0) {
                onToolbarCreated();
            } else {
                viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, onToolbarCreated);
            }
        } else {
            viewer.addEventListener(EventType.TOOLBAR_CREATED_EVENT, onToolbarCreated);
        }

        return true;
    };

    FusionOrbitExtension.prototype.createUI = function () {
        var self = this;
        var viewer = this.viewer;

        var toolbar = viewer.getToolbar(false);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        // save button behaviors, before modifying them
        this.classicBehavior = {};
        this.classicBehavior.orbitOnClick = navTools.orbitbutton.onClick;
        this.classicBehavior.freeorbitOnClick = navTools.freeorbitbutton.onClick;
        this.classicBehavior.returnToDefault = navTools.returnToDefault;

        navTools.freeorbitbutton.onClick = function (e) {
            var state = navTools.freeorbitbutton.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool("fusion orbit");
                navTools.freeorbitbutton.setState(Button.State.ACTIVE);
            }
            else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
                navTools.freeorbitbutton.setState(Button.State.INACTIVE);
            }
        };

        navTools.orbitbutton.onClick = function (e) {
            var state = navTools.orbitbutton.getState();
            if (state === Button.State.INACTIVE) {
                viewer.setActiveNavigationTool("fusion orbit constrained");
                navTools.orbitbutton.setState(Button.State.ACTIVE);
            }
            else if (state === Button.State.ACTIVE) {
                viewer.setActiveNavigationTool();
                navTools.orbitbutton.setState(Button.State.INACTIVE);
            }
        };

        navTools.returnToDefault = function () {
            // clear active button
            navTools.orbittoolsbutton.setState(Button.State.ACTIVE);
            navTools.orbittoolsbutton.setState(Button.State.INACTIVE);
        };

        // set combo button
        navTools.orbittoolsbutton.setState(Button.State.INACTIVE);
        if (viewer.prefs.fusionOrbitConstrained) {
            navTools.orbittoolsbutton.onClick = navTools.orbitbutton.onClick;
            navTools.orbittoolsbutton.setIcon(navTools.orbitbutton.iconClass);
            viewer.setDefaultNavigationTool("orbit");
        }
        else {
            navTools.orbittoolsbutton.onClick = navTools.freeorbitbutton.onClick;
            navTools.orbittoolsbutton.setIcon(navTools.freeorbitbutton.iconClass);
            viewer.setDefaultNavigationTool("freeorbit");
        }

        // reset
        viewer.setActiveNavigationTool();
        navTools.returnToDefault();
    };

    FusionOrbitExtension.prototype.unload = function () {
        var viewer = this.viewer;
        var toolbar = viewer.getToolbar(false);
        var navTools = toolbar.getControl(ToolbarSID.NAVTOOLSID);

        // restore LMV Classic button behaviors
        if (navTools) {
            if (navTools.orbitbutton)
                navTools.orbitbutton.onClick = this.classicBehavior.orbitOnClick;

            if (navTools.freeorbitbutton)
                navTools.freeorbitbutton.onClick = this.classicBehavior.freeorbitOnClick;

            navTools.returnToDefault = this.classicBehavior.returnToDefault;

            if (navTools.orbittoolsbutton) {    // can be null when switching sheets
                navTools.orbittoolsbutton.onClick = navTools.orbitbutton.onClick;
                navTools.orbittoolsbutton.setIcon("adsk-icon-orbit-constrained");
                navTools.orbittoolsbutton.setState(Button.State.ACTIVE);
            }
        }
        viewer.setActiveNavigationTool("orbit");
        viewer.setDefaultNavigationTool("orbit");

        // Deregister tool
        viewer.toolController.deregisterTool(this.tool);
        this.tool.setViewer(null);
        this.tool = null;

        return true;
    };


    
    theExtensionManager.registerExtension('Autodesk.Viewing.FusionOrbit', FusionOrbitExtension);
    return FusionOrbitExtension;
});