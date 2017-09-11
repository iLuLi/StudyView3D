define([
    '../Extension',
    '../../Core/Constants/EventType',
    '../../UI/Base/Button',
    '../../Core/Manager/theExtensionManager',
    './GalleryPanel',
    './SimModelStructurePanel',
    './SimSetupPanel',
    '../../Core/i18n'
], function(Extension, EventType, Button, theExtensionManager, GalleryPanel, SimModelStructurePanel, SimSetupPanel, i18n) {
    'use strict';
    var Simulation = function (viewer, options) {
        Extension.call(this, viewer, options);
        this.viewer = viewer;
        this.simButton = null;
        this.useSetupPanel = true;
        this.useModelPanel = true;
        if (options) {
            if (options.useSetupPanel !== undefined)
                this.useSetupPanel = options.useSetupPanel;
    
            if (options.useModelPanel !== undefined)
                this.useModelPanel = options.useModelPanel;
        }
    };
    
    Simulation.prototype = Object.create(Extension.prototype);
    Simulation.prototype.constructor = Simulation;
    
    Simulation.prototype.load = function () {
        var that = this;
        var viewer = this.viewer;
    
        that.galleryPanel = new GalleryPanel(that.viewer);
        that.viewer.addPanel(that.galleryPanel);
    
        that.simButton = new Button('toolbar-simulation');
        that.simButton.setToolTip('Simulation Results');
        that.simButton.onClick = function (e) {
            var visible = that.galleryPanel.isVisible();
            that.galleryPanel.setVisible(!visible);
            that.simButton.setState(!visible ? Button.State.ACTIVE : Button.State.INACTIVE);
        };
        that.simButton.setIcon('toolbar-simulationIcon');
        viewer.settingsTools.addControl(that.simButton, { index: 1 });
    
        // Change these viewer settings for SIM files.
        //
        //keep defaults
        this.hideLines = viewer.prefs.get("lineRendering");
        this.ghosting = viewer.prefs.get("ghosting");
        this.ambientShadow = viewer.prefs.get("ambientShadows");
        this.antialiazing = viewer.prefs.get("antialiasing");
        this.lightPreset = viewer.prefs.get("lightPreset");
    
        ////////////////////////////////////////////////////
        var handleNewGeometry = function () {
            viewer.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, handleNewGeometry);
            var model = that.viewer.model;
            model.getObjectTree(function (instanceTree) {
                that.galleryPanel.initModel(instanceTree, that);
                if (that.useModelPanel)
                    that.initModelBrowser();
    
                if (that.useSetupPanel)
                    that.initSetupPanel();
            });
        };
    
        //this is being called when you switched in left panel
        //in Jupiter
        this.initIfLoaded = function () {
            //var that = this;
            var model = that.viewer.model;
            if (model && model.isLoadDone) {
                model.getObjectTree(function (instanceTree) {
                    setTimeout(function () {
                        that.galleryPanel.initModel(instanceTree, that);
                        if (that.useModelPanel)
                            that.initModelBrowser();
    
                        if (that.useSetupPanel)
                            that.initSetupPanel();
                    }, 100);
                });
            }
        };
    
        var model = that.viewer.model;
        if (model && model.isLoadDone) {
            viewer.addEventListener(EventType.MODEL_ROOT_LOADED_EVENT, this.initIfLoaded);
            model.getObjectTree(function (instanceTree) {
                setTimeout(function () {
                    that.galleryPanel.initModel(instanceTree, that);
                    if (that.useModelPanel)
                        that.initModelBrowser();
    
                    if (that.useSetupPanel)
                        that.initSetupPanel();
                }, 100);
            });
        }
        else {
            viewer.addEventListener(EventType.GEOMETRY_LOADED_EVENT, handleNewGeometry);
        }
    
        return true;
    };
    
    Simulation.prototype.unload = function () {
        this.viewer.removeEventListener(EventType.MODEL_ROOT_LOADED_EVENT, this.initIfLoaded);
    
        this.showResultsDlg(false);
        this.viewer.settingsTools.removeControl(this.simButton);
    
        this.viewer.removePanel(this.galleryPanel);
        this.galleryPanel.uninitialize();
    
        // restore viewer settings back.
        //
        this.viewer.hideLines(!this.hideLines);
        this.viewer.setGhosting(this.ghosting);
        this.viewer.setQualityLevel(this.ambientShadow, this.antialiazing);
        this.viewer.setLightPreset(this.lightPreset);
        //// Remove the panel from the viewer.
        ////
        if (this.modelStructurePanel)
            this.viewer.setModelStructurePanel(null);
    
        if (this.simSetupPanel) {
            this.simSetupPanel.setVisible(false);  // This ensures the button is in the correct state.
            this.viewer.removePanel(this.simSetupPanel);
            this.simSetupPanel.uninitialize();
        }
    
        return true;
    };
    
    Simulation.prototype.initSetupPanel = function () {
        var that = this;
        setTimeout(function () {
            //setup button
            that.simSetupButton = new Button('toolbar-simulation-setup');
            that.simSetupButton.setToolTip('Simulation Setup');
            that.simSetupButton.onClick = function (e) {
                var visible = that.simSetupPanel.isVisible();
                that.simSetupPanel.setVisible(!visible);
                that.simSetupButton.setState(!visible ? Button.State.ACTIVE : Button.State.INACTIVE);
            };
            that.simSetupButton.setIcon('toolbar-simulationSetupIcon');
            that.viewer.settingsTools.addControl(that.simSetupButton, { index: 0 });
    
            //setup panel
            that.simSetupPanel = new SimSetupPanel(that, i18n.translate('Simulation Setup Loading'), that.options);
            that.simSetupPanel.setGallery(that.galleryPanel);
    
            that.viewer.addPanel(that.simSetupPanel);
    
            // If the model already exists, then set it now.  Otherwise, it will be
            // set later when the model is created in load().
            //
            if (that.viewer.model) {
                that.viewer.model.getObjectTree(function (instanceTree) {
                    that.simSetupPanel.setModel(instanceTree, i18n.translate('Simulation Setup'));
                });
            }
        }, 100);
    };
    
    Simulation.prototype.initModelBrowser = function () {
        var that = this;
        setTimeout(function () {
            that.modelStructurePanel = new SimModelStructurePanel(that, 'Simulation Model Structure Loading', that.options);
            that.viewer.setModelStructurePanel(that.modelStructurePanel);
            that.modelStructurePanel.setGallery(that.galleryPanel);
        }, 100);
    };
    
    Simulation.prototype.showResultsDlg = function (show) {
        this.simButton.setState(show ? Button.State.ACTIVE : Button.State.INACTIVE);
        this.simButton.setVisible(show);
        this.galleryPanel.setVisible(show);
    };
    
    Simulation.prototype.applySettings = function (show) {
        this.viewer.hideLines(false);
        this.viewer.setGhosting(false);
        this.viewer.setQualityLevel(false, true);
        this.viewer.setLightPreset(4);
    };
    
    Simulation.prototype.simData = function () {
        return this.galleryPanel.simDef;
    };
    
    /**
     * Register the extension with the extension manager.
     */
    theExtensionManager.registerExtension('Autodesk.Fusion360.Simulation', Simulation);
    
});