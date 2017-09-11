define([
    '../Core/Polyfills',
    '../Core/Controller/Viewer3D',
    '../Core/Controller/HotGestureTool',
    '../Core/Constants/EventType',
    './ProgressBar',
    '../Core/Manager/theHotkeyManager',
    '../Core/Constants/Global',
    '../Core/Logger',
    '../Core/Constants/DeviceType',
    './Base/ToolBar',
    '../Core/Utils/touchStartToClick',
    '../Core/i18n',
    './Base/ModelStructurePanel',
    './Base/Button',
    './Base/LayersPanel',
    './Base/PropertyPanel',
    './Base/SettingsPanel',
    './ViewerSettingsPanel',
    './ViewerModelStructurePanel',
    './ViewerLayersPanel',
    './Base/RenderOptionsPanel',
    '../Core/Constants/LightPresets',
    './Base/ControlGroup',
    './Base/RadioButtonGroup',
    '../Core/Constants/ScreenMode',
    '../Core/Utils/setLanguage',
    '../Core/Controller/ErrorHandler',
    './Base/AlertBox',
    './HudMessage',
    '../Core/Utils/stringToDOM',
    './Base/ToolbarSID',
    './ViewerPropertyPanel',
    '../Core/Constants/ViewerSettingTab'
], function(
    Polyfills,
    Viewer3D,
    HotGestureTool,
    EventType,
    ProgressBar,
    theHotkeyManager,
    Global,
    Logger,
    DeviceType,
    ToolBar,
    touchStartToClick,
    i18n,
    ModelStructurePanel,
    Button,
    LayersPanel,
    PropertyPanel,
    SettingsPanel,
    ViewerSettingsPanel,
    ViewerModelStructurePanel,
    ViewerLayersPanel,
    RenderOptionsPanel,
    LightPresets,
    ControlGroup,
    RadioButtonGroup,
    ScreenMode,
    setLanguage,
    ErrorHandler,
    AlertBox,
    HudMessage,
    stringToDOM,
    ToolbarSID,
    ViewerPropertyPanel,
    ViewerSettingTab
) {
    'use strict'

    var GuiViewer3D = function(container, config) {
        if(!config) config = {};

        //TODO 该属性含义
        config.startOnInitialize = false;

        Viewer3D.call(this, container, config);
        this.toolbar = null;
        
        // Container for the UI docking panels
        this.dockingPanels = [];

        this.modelstructure = null;
        this.layersPanel = null;
    }

    GuiViewer3D.prototype = Object.create(Viewer3D.prototype);
    GuiViewer3D.prototype.constructor = GuiViewer3D;

    GuiViewer3D.prototype.initialize = function () {
        var viewerErrorCode = Viewer3D.prototype.initialize.call(this);

        if (viewerErrorCode > 0)    // ErrorCode was returned.
        {
            return viewerErrorCode;
        }

        var viewer = this;

        if (this.toolController) {
            var hottouch = new HotGestureTool(this);

            this.toolController.registerTool(hottouch);

            this.toolController.activateTool(hottouch.getName());
        }

        // Create toolbar that is attached to the bottom of the panel.
        this.getToolbar(true);

        this.addEventListener(EventType.FULLSCREEN_MODE_EVENT, function (e) {
            viewer.resizePanels({ viewer: viewer });
            viewer.updateFullscreenButton(e.mode);
        });

        // Context menu
        if (!this.contextMenu) {
            this.setDefaultContextMenu();
        }

        // Create a progress bar. Shows streaming.
        //
        this.progressbar = new ProgressBar(this.container);
        this.addEventListener(EventType.PROGRESS_UPDATE_EVENT, function (e) {
            if (e.percent !== undefined) {
                viewer.progressbar.setPercent(e.percent);
            }
        }, false);

        // There is no way on the API to get the current selection (yet?)
        //
        // We need to know if there is anything selected in order to process the
        // Escape key workflow, so track it manually.
        this.selectionActive = false;
        this.addEventListener(EventType.SELECTION_CHANGED_EVENT, function (event) {
            viewer.selectionActive = (event.dbIdArray.length > 0);

            if (viewer.prefs.openPropertiesOnSelect) {
                var propertyPanel = viewer.getPropertyPanel(true);
                propertyPanel.setVisible(viewer.selectionActive);
            }
        });

        this.addEventListener(EventType.ISOLATE_EVENT, function (event) {
            if (viewer.prefs.openPropertiesOnSelect || event.nodeIdArray[0] === viewer.model.getRootId()) {
                if (viewer.propertygrid) {
                    viewer.propertygrid.setVisible(event.nodeIdArray.length > 0 || viewer.selectionActive);
                }
            }
        });

        this.addEventListener(EventType.VIEWER_STATE_RESTORED_EVENT, function (event) {
            if (viewer.renderoptions) {
                viewer.renderoptions.syncUI();
            }

            var settingsPanel = viewer.getSettingsPanel(true);
            if (settingsPanel)
                settingsPanel.syncUI();

            // We don't really need to update these 2 values, because the panel is usually closed.
            // Leaving code here just in case it becomes necessary.
            //this.envSelect.setSelectedIndex(viewer.impl.currentLightPreset());
            //this.viewerOptionButton.displayLines.setValue(viewer.prefs.lineRendering);
        });

        this.addEventListener(EventType.VIEWER_RESIZE_EVENT, function (event) {

            viewer.resizePanels();

            if (viewer.viewCubeUi && viewer.viewCubeUi.cube)
                viewer.viewCubeUi.cube.refreshCube();

            viewer.updateToolbarButtons(event.width, event.height);

            if (viewer.centerToolBar) {
                viewer.centerToolBar();
            }
        });

        this.addEventListener(EventType.NAVIGATION_MODE_CHANGED_EVENT, function (event) {
            viewer.updateToolbarButtons(viewer.container.clientWidth, viewer.container.clientHeight);
            viewer.centerToolBar();
        });

        this.initEscapeHandlers();

        // Now that all the ui is created, localize it.
        this.localize();

        // Now that all of our initialization is done, start the main loop.
        //
        this.run();

        return 0;   // No errors initializing.
    };

    GuiViewer3D.prototype.uninitialize = function () {

        if (this.viewerSettingsPanel) {
            this.viewerSettingsPanel.uninitialize();
            this.viewerSettingsPanel = null;
        }

        if (this.modelstructure) {
            this.modelstructure.uninitialize();
            this.modelstructure = null;
        }

        if (this.layersPanel) {
            this.layersPanel.uninitialize();
            this.layersPanel = null;
        }

        if (this.propertygrid) {
            this.propertygrid.uninitialize();
            this.propertygrid = null;
        }

        if (this.renderoptions) {
            this.renderoptions.uninitialize();
            this.renderoptions = null;
        }

        if (this.viewerOptionButton) {

            this.show3dOptionsNavigationTab = null;
            this.show3dOptionsPerformanceTab = null;
            this.viewerOptionButton = null;
        }

        theHotkeyManager.popHotkeys("Autodesk.ROLL");
        theHotkeyManager.popHotkeys("Autodesk.FOV");

        this.removeEventListener(EventType.RENDER_OPTION_CHANGED_EVENT, this.onRenderOptionChanged);
        this.onRenderOptionChanged = null;
        this.removeEventListener(EventType.VIEWER_STATE_RESTORED_EVENT, this.onRestoreState);
        this.onRestoreState = null;

        this.progressbar = null;

        this.modelTools = null;
        this.navTools = null;
        this.settingsTools = null;
        this.debugMenu = null;
        this.modelStats = null;
        this.explodeSlider = null;
        this.explodeSubmenu = null;
        this.centerToolBar = null;

        // Toolbar
        this.toolbar = null;

        Viewer3D.prototype.uninitialize.call(this);
    };

    GuiViewer3D.prototype.setUp = function (config) {
        if (!config) config = {};

        // Explicitly set startOnInitialize = false, as we want to finish some initialization
        // before starting the main loop.
        //
        config.startOnInitialize = false;

        this.getToolbar(true);

        Viewer3D.prototype.setUp.call(this, config);
    };

    GuiViewer3D.prototype.tearDown = function () {

        //TODO: this is unorthodox order of destruction, but we
        //need to call the super first so it unloads the extensions,
        //which need the GUI. We need to resolve this somehow.
        Viewer3D.prototype.tearDown.call(this);


        if (this.toolbar) {
            this.toolbar.container.parentNode.removeChild(this.toolbar.container);
            this.toolbar = null;
        }

        if (this.modelstructure) {
            this.setModelStructurePanel(null);
        }
        if (this.propertygrid) {
            this.setPropertyPanel(null);
        }
        if (this.viewerSettingsPanel) {
            this.setSettingsPanel(null);
        }
        if (this.layersPanel) {
            this.setLayersPanel(null);
        }
        if (this.renderoptions) {
            this.removePanel(this.renderoptions);
            this.renderoptions.uninitialize();
            this.renderoptions = null;
        }

        // Need to remove this event listener, in case that viewcube will show up when
        // changing sheets from 3D to 2D and the 3D model doesn't fully loaded.
        this.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, this.initViewCube);
    };

    GuiViewer3D.prototype.loadModel = function (url, options, onSuccessCallback, onErrorCallback, initAfterWorker) {

        var viewer = this;

        function createUI(model) {
            if (!viewer.running) {
                Logger.error("createUI expects the viewer to be running.");
                //setTimeout(createUI, 1);
                return;
            }

            viewer.createUI(model);
        }

        function onSuccessChained(model) {

            //TODO: The exact timeout needs to be tuned for best
            //CPU utilization and shortest frame length during startup.
            setTimeout(createUI.bind(createUI, model), 1);

            if (onSuccessCallback)
                onSuccessCallback.apply(onSuccessCallback, arguments);

        }

        /*
                function initAfterWorkerChained() {
                    if (initAfterWorker)
                        initAfterWorker();
        
                    setTimeout(createUI, 1);
                }
        */
        var res = Viewer3D.prototype.loadModel.call(this, url, options, onSuccessChained, onErrorCallback, initAfterWorker);

        return res;
    };

    GuiViewer3D.prototype.createUI = function (model) {
        var self = this;
        var viewer = this;

        this.initViewCube = function () {
            //Delay this to the next frame so that the current frame can render fast and display the geometry.
            setTimeout(function () {
                viewer.displayViewCube(viewer.prefs.viewCube);
                viewer.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, viewer.initViewCube);
            }, 1);
        };

        var disabledExtensions = this.config.disabledExtensions;

        this.initHotkeys(model);

        this.loadExtension('Autodesk.DefaultTools.NavTools', { mode: model.is2d() ? "2d" : "3d" });
        this.initModelTools(model);

        //Optional rendering options panel + button
        if (Global.ENABLE_DEBUG) {
            this.initDebugTools();
        }

        // Dispatch a toolbar created event
        this.fireEvent({ type: EventType.TOOLBAR_CREATED_EVENT });

        this.config.wantInfoButton = true;
        this.createViewCube();

        this.centerToolBar = function () {
            self.toolbar.container.style.left = 'calc(50% - ' + self.toolbar.getDimensions().width / 2 + 'px)';
        };
        this.toolbar.addEventListener(ToolBar.Event.SIZE_CHANGED, this.centerToolBar);

        this.initModality();

        this.resize();

        if (model.is2d()) {
            if (viewer.prefs.useFirstPersonNavigation)
                this.unloadExtension('Autodesk.FirstPerson');
            else
                this.unloadExtension('Autodesk.Beeline');

            if (1) {
                //this.unloadExtension('Autodesk.VR');
            }

            // Make pan a default navigation tool.
            this.setDefaultNavigationTool("pan");

            // Make sure view cube and click to set COI are disabled (but don't update the preferences)
            this.setClickToSetCOI(false, false);
            this.displayViewCube(false, false);

            //Load relevant extensions (on the next frame, since creating the UI is already too slow)
            setTimeout(function () {
                if (!disabledExtensions || (disabledExtensions && !disabledExtensions.measure)) {
                    viewer.loadExtension('Autodesk.Measure', null);
                }

                if (!disabledExtensions || (disabledExtensions && !disabledExtensions.hyperlink)) {
                    viewer.loadExtension('Autodesk.Hyperlink', null);
                }
            }, 1);

        } else {
            // Make orbit a default navigation tool.
            if (this.getDefaultNavigationToolName().indexOf("orbit") === -1)
                this.setDefaultNavigationTool("orbit");

            //Load relevant extensions (on the next frame, since creating the UI is already too slow)
            setTimeout(function () {
                if (viewer.prefs.useFirstPersonNavigation)
                    viewer.loadExtension('Autodesk.FirstPerson', null);
                else
                    viewer.loadExtension('Autodesk.Beeline', null);

                if (1) {
                    //this.loadExtension('Autodesk.VR', null);
                }

                viewer.loadExtension('Autodesk.Viewing.Oculus', null);
                if (viewer.prefs.fusionOrbit)
                    viewer.loadExtension('Autodesk.Viewing.FusionOrbit', null);

                if (!disabledExtensions || (disabledExtensions && !disabledExtensions.measure)) {
                    viewer.loadExtension('Autodesk.Measure', null);
                }

                if (!disabledExtensions || (disabledExtensions && !disabledExtensions.section)) {
                    viewer.loadExtension('Autodesk.Section', null);
                }

                if (!disabledExtensions || (disabledExtensions && !disabledExtensions.hyperlink)) {
                    viewer.loadExtension('Autodesk.Hyperlink', null);
                }

            }, 1);

            this.addEventListener(EventType.GEOMETRY_LOADED_EVENT, this.initViewCube);
        }

        //Used to initialize the modelstructure if it's already created
        //before the property db finishes loading
        var modelTreeInit = function () {
            if (viewer.modelstructure) {
                var onSuccess = function (instanceTree) {
                    var modelTitle = viewer.config.defaultModelStructureTitle ? viewer.config.defaultModelStructureTitle : '';
                    viewer.modelstructure.setModel(instanceTree, modelTitle);
                };
                var onFailure = function (insta) {
                    // Anything here?
                };
                viewer.model.getObjectTree(onSuccess, onFailure);
            }

            viewer.removeEventListener(EventType.OBJECT_TREE_CREATED_EVENT, modelTreeInit);
        };

        this.addEventListener(EventType.OBJECT_TREE_CREATED_EVENT, modelTreeInit);

        //this.toolbar.addControl(this.searchMenu);
    };

    // "tooltip" string is localized by this method.
    GuiViewer3D.prototype.addOptionToggle = function (parent, tooltip, initialState, onchange, saveKey) {

        // Use the stored settings or defaults
        var storedState = saveKey ? this.prefs[saveKey] : null;
        initialState = (typeof storedState === 'boolean') ? storedState : initialState;

        var li = document.createElement("li");
        li.className = "toolbar-submenu-listitem";

        var cb = document.createElement("input");
        cb.className = "toolbar-submenu-checkbox";
        cb.type = "checkbox";
        cb.id = tooltip;
        li.appendChild(cb);

        var lbl = document.createElement("label");
        lbl.setAttribute('for', tooltip);
        lbl.setAttribute("data-i18n", tooltip);
        lbl.textContent = i18n.translate(tooltip);
        li.appendChild(lbl);

        parent.appendChild(li);

        cb.checked = initialState;

        cb.addEventListener("touchstart", touchStartToClick);
        lbl.addEventListener("touchstart", touchStartToClick);
        li.addEventListener("touchstart", touchStartToClick);

        cb.addEventListener("click", function (e) {
            onchange(cb.checked);
            e.stopPropagation();
        });

        lbl.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        li.addEventListener("click", function (e) {
            onchange(!cb.checked);
            e.stopPropagation();
        });

        if (saveKey) {
            this.prefs.addListeners(saveKey, function (value) {
                cb.checked = value;
            }, function (value) {
                cb.checked = value;
                onchange(value);
            });
        }
        return cb;
    };

    // "label" string will be converted to localized string by this method
    GuiViewer3D.prototype.addOptionList = function (parent, label, optionList, initialIndex, onchange, saveKey) {

        // Use the stored settings or defaults
        var storedState = this.prefs[saveKey];
        initialIndex = (typeof storedState === 'number') ? storedState : initialIndex;

        // Wrap the onchange with the update to that setting
        var handler = function (e) {
            var selectedIndex = e.target.selectedIndex;
            onchange(selectedIndex);
            e.stopPropagation();
        };

        var selectElem = document.createElement("select");
        selectElem.className = 'optionDropDown';
        selectElem.id = "selectMenu_" + label;
        for (var i = 0; i < optionList.length; i++) {
            var item = document.createElement("option");
            item.value = i;
            item.setAttribute("data-i18n", optionList[i]);
            item.textContent = i18n.translate(optionList[i]);
            selectElem.add(item);
        }

        var li = document.createElement("li");
        li.className = "toolbar-submenu-select";

        var lbl = document.createElement("div");
        lbl.className = "toolbar-submenu-selectlabel";
        lbl.setAttribute('for', label);
        lbl.setAttribute("data-i18n", label);
        lbl.textContent = i18n.translate(label);
        li.appendChild(lbl);
        li.appendChild(selectElem);

        parent.appendChild(li);

        selectElem.selectedIndex = initialIndex;
        selectElem.onchange = handler;
        selectElem.addEventListener("touchstart", function (e) {
            e.stopPropagation();
        });
        selectElem.addEventListener("click", function (e) {
            e.stopPropagation();
        });

        if (saveKey) {
            this.prefs.addListeners(saveKey, function (value) {
                selectElem.selectedIndex = value;
            }, function (value) {
                selectElem.selectedIndex = value;
                onchange(value);
            });
        }

        return selectElem;
    };

    GuiViewer3D.prototype.showViewer3dOptions = function (show) {
        var settingsPanel = this.getSettingsPanel(true);
        if (show && settingsPanel.isVisible()) {
            settingsPanel.setVisible(false);
        }
        settingsPanel.setVisible(show);
    };

    GuiViewer3D.prototype.showRenderingOptions = function (show) {
        this.renderoptions.setVisible(show);
    };

    GuiViewer3D.prototype.showLayerManager = function (show) {
        this.layersPanel.setVisible(show);
    };

    GuiViewer3D.prototype.initHotkeys = function (model) {
        var viewer = this;
        var keys = theHotkeyManager.KEYCODES;
        var onPress;
        var onRelease;

        if (!model.is2d()) {
            // Add FOV hotkey
            var previousToolForFOV;
            onPress = function () {
                if (viewer.toolController.getIsLocked() || !viewer.navigation.isActionEnabled('fov')) {
                    return false;
                }

                previousToolForFOV = viewer.getActiveNavigationTool();
                viewer.setActiveNavigationTool("fov");
                return true;
            };
            onRelease = function () {
                if (viewer.toolController.getIsLocked() || !viewer.navigation.isActionEnabled('fov')) {
                    return false;
                }

                viewer.setActiveNavigationTool(previousToolForFOV);
                return true;
            };
            theHotkeyManager.pushHotkeys("Autodesk.FOV", [
                {
                    keycodes: [keys.CONTROL, keys.SHIFT],
                    onPress: onPress,
                    onRelease: onRelease
                }
            ], { tryUntilSuccess: true });
        }

        // Add Roll hotkey
        var previousToolForRoll;
        onPress = function () {
            if (viewer.toolController.getIsLocked() || !viewer.navigation.isActionEnabled('roll')) {
                return false;
            }

            previousToolForRoll = viewer.getActiveNavigationTool();
            viewer.setActiveNavigationTool("worldup");
            return true;
        };
        onRelease = function () {
            if (viewer.toolController.getIsLocked() || !viewer.navigation.isActionEnabled('roll')) {
                return false;
            }

            viewer.setActiveNavigationTool(previousToolForRoll);
            return true;
        };
        theHotkeyManager.pushHotkeys("Autodesk.ROLL", [{
            keycodes: [keys.ALT, keys.SHIFT],
            onPress: onPress,
            onRelease: onRelease
        }], { tryUntilSuccess: true });
    };



    /**
     * Sets the model structure panel for displaying the loaded model.
     * @param {ModelStructurePanel} modelStructurePanel - the model structure panel to use, or null.
     *
     * @returns {boolean} true if the panel, or null, was set successfully; false otherwise.
     */
    GuiViewer3D.prototype.setModelStructurePanel = function (modelStructurePanel) {
        var self = this;
        if (modelStructurePanel instanceof ModelStructurePanel || modelStructurePanel === null) {
            if (this.modelstructure) {
                this.modelstructure.setVisible(false);  // This ensures the button is in the correct state.
                this.removePanel(this.modelstructure);
                this.modelstructure.uninitialize();
            }
            this.modelstructure = modelStructurePanel;

            if (modelStructurePanel) {
                this.addPanel(this.modelstructure);

                modelStructurePanel.addVisibilityListener(function (visible) {
                    if (visible) {
                        self.onPanelVisible(modelStructurePanel, self);
                    }
                    self.settingsTools.structurebutton.setState(visible ? Button.State.ACTIVE : Button.State.INACTIVE);
                });

                // If the model already exists, then set it now.  Otherwise, it will be
                // set later when the model is created in load().
                //
                if (self.model) {
                    self.model.getObjectTree(function (instanceTree) {
                        self.modelstructure.setModel(instanceTree);
                    });
                }
            }
            return true;
        }
        return false;
    };

    /**
     * Sets the layers panel for display 2d layers.
     * @param {!LayersPanel} layersPanel - the layers panel to use, or null
     *
     * Not yet implemented for 3D.
     *
     * @returns {boolean} true if the panel or null was set successfully, and false otherwise
     */
    GuiViewer3D.prototype.setLayersPanel = function (layersPanel) {
        var self = this;
        if (this.model && !this.model.is2d()) {
            Logger.warn("Viewer3D.setLayersPanel is not yet implemented for 3D");
            return false;
        }

        if (layersPanel instanceof LayersPanel || !layersPanel) {
            if (this.layersPanel) {
                this.layersPanel.setVisible(false);
                this.removePanel(this.layersPanel);
                this.layersPanel.uninitialize();
            }

            this.layersPanel = layersPanel;
            if (layersPanel) {
                this.addPanel(layersPanel);

                layersPanel.addVisibilityListener(function (visible) {
                    if (visible) {
                        self.onPanelVisible(layersPanel, self);
                    }
                    self.settingsTools.layerButton.setState(visible ? Button.State.ACTIVE : Button.State.INACTIVE);
                });
            }
            return true;
        }
        return false;
    };

    /**
     * Sets the property panel.
     * @param {!PropertyPanel} propertyPanel - the property panel to use, or null
     * @returns {boolean} true if the panel or null was set successfully, and false otherwise
     */
    GuiViewer3D.prototype.setPropertyPanel = function (propertyPanel) {
        var self = this;
        if (propertyPanel instanceof PropertyPanel || !propertyPanel) {
            if (this.propertygrid) {
                this.propertygrid.setVisible(false);
                this.removePanel(this.propertygrid);
                this.propertygrid.uninitialize();
            }

            this.propertygrid = propertyPanel;
            if (propertyPanel) {
                this.addPanel(propertyPanel);

                propertyPanel.addVisibilityListener(function (visible) {
                    if (visible) {
                        self.onPanelVisible(propertyPanel, self);
                    }
                    self.settingsTools.propertiesbutton.setState(visible ? Button.State.ACTIVE : Button.State.INACTIVE);
                });

            }
            return true;
        }
        return false;
    };

    GuiViewer3D.prototype.getPropertyPanel = function (createDefault) {
        if (!this.propertygrid && createDefault) {
            this.setPropertyPanel(new ViewerPropertyPanel(this));
        }
        return this.propertygrid;
    };


    /**
     * Sets the viewer's settings panel.
     * @param {!SettingsPanel} settingsPanel - the settings panel to use, or null
     * @returns {boolean} true if the panel or null was set successfully, and false otherwise
     */
    GuiViewer3D.prototype.setSettingsPanel = function (settingsPanel) {
        if (settingsPanel instanceof SettingsPanel || !settingsPanel) {
            if (this.viewerSettingsPanel) {
                this.viewerSettingsPanel.setVisible(false);
                this.removePanel(this.viewerSettingsPanel);
                this.viewerSettingsPanel.uninitialize();
            }

            this.viewerSettingsPanel = settingsPanel;
            if (settingsPanel) {
                this.addPanel(settingsPanel);
            }
            return true;
        }
        return false;
    };

    GuiViewer3D.prototype.getSettingsPanel = function (createDefault) {
        if (!this.viewerSettingsPanel && createDefault) {
            this.setSettingsPanel(new ViewerSettingsPanel(this, this.model));
        }
        return this.viewerSettingsPanel;
    };




    GuiViewer3D.prototype.initModelTools = function (model) {
        var viewer = this;

        //var resetTooltip = null;
        if (!model.is2d()) {
            if (!viewer.modelstructure) {
                var options = {
                    docStructureConfig: viewer.config.docStructureConfig
                    //TODO: visibility of search bar in browser panel
                };
                viewer.setModelStructurePanel(new ViewerModelStructurePanel(viewer, 'Browser', options));
            }

            var structureButton = new Button('toolbar-modelStructureTool');
            structureButton.setToolTip('Model browser');
            structureButton.setIcon("adsk-icon-structure");
            structureButton.onClick = function (e) {
                viewer.showModelStructurePanel(!viewer.modelstructure.isVisible());
            };

            this.settingsTools.addControl(structureButton);
            this.settingsTools.structurebutton = structureButton;

            this.initExplodeSlider();
            // this.initInspectTools();  // NOTE_NOP: don't need this

            //TODO: show only after complete load?
            //viewer.showModelStructurePanel(true);

            //resetTooltip = "Reset model";
        }
        else {
            var layersPanel = new ViewerLayersPanel(this);
            this.setLayersPanel(layersPanel);

            var layerButton = new Button('toolbar-layersTool');
            layerButton.setToolTip('Layer Manager');
            layerButton.setIcon("adsk-icon-layers");
            layerButton.onClick = function (e) {
                if (!viewer.layersPanel) {
                    viewer.setLayersPanel(new ViewerLayersPanel(viewer));
                }

                viewer.showLayerManager(!viewer.layersPanel.isVisible());
            };
            this.settingsTools.addControl(layerButton);
            this.settingsTools.layerButton = layerButton;

            //resetTooltip = "Reset drawing";
        }

        // NOTE_NOP: turn off reset button
        // var resetModelButton = new Button('toolbar-resetTool');
        // resetModelButton.setToolTip(resetTooltip);
        // resetModelButton.setIcon("adsk-icon-reset");
        // resetModelButton.onClick = function (e) {
        //     viewer.fireEvent({type: av.RESET_EVENT});
        // };
        // this.modelTools.addControl(resetModelButton);
        // this.modelTools.resetModelButton = resetModelButton;

        viewer.addEventListener(EventType.RESET_EVENT, function () {
            if (viewer.model && !viewer.model.is2d()) {
                viewer.explode(0);
                viewer.explodeSlider.value = 0;
            }
            viewer.showAll();
        });

        var propertiesButton = new Button('toolbar-propertiesTool');
        propertiesButton.setToolTip('Properties');
        propertiesButton.setIcon("adsk-icon-properties");
        propertiesButton.onClick = function (e) {
            var propertyPanel = viewer.getPropertyPanel(true);
            propertyPanel.setVisible(!propertyPanel.isVisible());
        };
        propertiesButton.setVisible(!viewer.prefs.openPropertiesOnSelect);
        this.settingsTools.addControl(propertiesButton);
        this.settingsTools.propertiesbutton = propertiesButton;

        // New viewer options' panel
        var settingsPanel = new ViewerSettingsPanel(this, model);
        this.setSettingsPanel(settingsPanel);

        var viewerOptionButton = new Button('toolbar-settingsTool');
        this.viewerOptionButton = viewerOptionButton;
        viewerOptionButton.setIcon("adsk-icon-settings");
        viewerOptionButton.setToolTip("Settings");
        this.settingsTools.addControl(viewerOptionButton);
        this.createViewerOptionsMenu(model);

        if (Global.ENABLE_DEBUG && !model.is2d()) {
            this.renderoptions = new RenderOptionsPanel(this);
            this.addPanel(this.renderoptions);

            var renderOptionsButton = new Button('toolbar-renderOptionsTool');
            renderOptionsButton.setToolTip('Rendering options');
            renderOptionsButton.setIcon("adsk-icon-settings-render");
            renderOptionsButton.onClick = function (e) {
                viewer.showRenderingOptions(!viewer.renderoptions.isVisible());
            };
            this.settingsTools.addControl(renderOptionsButton);
        }

        if (this.canChangeScreenMode()) {
            var fullscreenButton = new Button('toolbar-fullscreenTool', { collapsible: false });
            fullscreenButton.setToolTip('Full screen');
            fullscreenButton.setIcon("adsk-icon-fullscreen");
            fullscreenButton.onClick = function (e) {
                viewer.nextScreenMode();
            };
            this.settingsTools.addControl(fullscreenButton);
            this.settingsTools.fullscreenbutton = fullscreenButton;

            this.updateFullscreenButton(this.getScreenMode());
        }
    };

    GuiViewer3D.prototype.setPropertiesOnSelect = function (onSelect) {
        this.prefs.set('openPropertiesOnSelect', onSelect);
        this.settingsTools.propertiesbutton.setVisible(!onSelect);
    };

    GuiViewer3D.prototype.addDivider = function (parent) {
        var item = document.createElement("li");
        item.className = "toolbar-submenu-horizontal-divider";
        parent.appendChild(item);
        return item;
    };

    GuiViewer3D.prototype.createViewerOptionsMenu = function (model) {
        // TODO: Refactor this into a control
        var viewer = this;

        var subMenu = document.createElement('div');
        subMenu.id = 'toolbar-settingsToolSubmenu';
        subMenu.classList.add('toolbar-submenu');
        subMenu.classList.add('toolbar-settings-sub-menu');
        subMenu.classList.add('adsk-hidden');
        subMenu.mode = model.is2d() ? "2d" : "3d";

        // Temporarily attach it to the main container so that it can be
        // properly sized. Once it has a correct width (important for localization)
        // we will remove it from the container and attach it to the button.
        //
        this.container.appendChild(subMenu);

        if (!model.is2d()) {
            // Environment map preset list
            var env_list = [];
            for (var i = 0; i < LightPresets.length; i++) {
                env_list.push(LightPresets[i].name);
            }

            this.viewerOptionButton.envList = this.addOptionList(subMenu, "Background and lighting", env_list, 4, function (selectedIndex) {
                if (viewer.blockEvent)
                    return;

                viewer.setLightPreset(selectedIndex);

            }, "lightPreset");

            this.onRenderOptionChanged = function (e) {
                viewer.blockEvent = true;
                if (viewer.viewerOptionButton.envList)
                    viewer.viewerOptionButton.envList.selectedIndex = viewer.impl.currentLightPreset();
                viewer.blockEvent = false;
                var panel = viewer.getSettingsPanel(false);
                panel && panel.syncUI();
            };
            viewer.addEventListener(EventType.RENDER_OPTION_CHANGED_EVENT, this.onRenderOptionChanged);

            this.onRestoreState = function () {
                if (viewer.explodeSlider) {
                    viewer.explodeSlider.value = viewer.getExplodeScale();
                }
            };
            viewer.addEventListener(EventType.VIEWER_STATE_RESTORED_EVENT, this.onRestoreState);

            this.viewerOptionButton.displayLines = this.addOptionToggle(subMenu, "Display Lines", true, function (checked) {
                viewer.hideLines(!checked);
            }, "lineRendering");

            this.addDivider(subMenu);
        }

        var performanceOption = document.createElement("li");
        performanceOption.className = "toolbar-submenu-listitem";
        var perfLabel = document.createElement("label");
        perfLabel.setAttribute("data-i18n", "Performance and appearance settings");
        perfLabel.textContent = i18n.translate("Performance and appearance settings");
        performanceOption.appendChild(perfLabel);

        function show3dOptions(tab) {

            // Show only one type of UI. Either sidebar or legacy panel.
            var sideBarUiExt = viewer.getExtension('Autodesk.SideBarUi');
            if (sideBarUiExt) {
                var Content = Autodesk.SideBarUi.Content;
                viewer.fireEvent({ type: EventType.SIDE_BAR_OPEN_EVENT, content: Content.Settings });
                return;
            }

            var panel = viewer.getSettingsPanel(true);
            if (!panel.isVisible() || !panel.isTabSelected(tab)) {
                viewer.showViewer3dOptions(true);
                panel.selectTab(tab);
            } else {
                viewer.showViewer3dOptions(false);
            }
        }

        this.show3dOptionsPerformanceTab = function () {
            show3dOptions(ViewerSettingTab.Performance);
        };
        this.viewerOptionButton.performanceOption = performanceOption;
        this.viewerOptionButton.performanceOption.addEventListener("touchstart", touchStartToClick);
        this.viewerOptionButton.performanceOption.addEventListener("click", this.show3dOptionsPerformanceTab);
        subMenu.appendChild(this.viewerOptionButton.performanceOption);

        this.addDivider(subMenu);

        var navigationOption = document.createElement("li");
        navigationOption.className = "toolbar-submenu-listitem";
        var navigLabel = document.createElement("label");
        navigLabel.setAttribute("data-i18n", "Navigation and selection settings");
        navigLabel.textContent = i18n.translate("Navigation and selection settings");
        navigationOption.appendChild(navigLabel);

        this.show3dOptionsNavigationTab = function () {
            show3dOptions(ViewerSettingTab.Navigation);
        };

        this.viewerOptionButton.navigationOption = navigationOption;
        this.viewerOptionButton.navigationOption.addEventListener("touchstart", touchStartToClick);
        this.viewerOptionButton.navigationOption.addEventListener("click", this.show3dOptionsNavigationTab);
        subMenu.appendChild(navigationOption);

        // Calculate width, disconnect from the main container and attach
        // as a submenu to the parent button.
        subMenu.style.width = subMenu.getBoundingClientRect().width + "px";
        this.container.removeChild(subMenu);

        /* Comment the below code to make fusion-like */

        //this.viewerOptionButton.onMouseOver = function(e) {
        //    subMenu.classList.remove('adsk-hidden');
        //};
        //
        //this.viewerOptionButton.onMouseOut = function(e) {
        //    subMenu.classList.add('adsk-hidden');
        //};

        //if (av.isTouchDevice()) {
        this.viewerOptionButton.onClick = function (e) {
            subMenu.classList.toggle('adsk-hidden');
            this.setState(this.getState() === Button.State.ACTIVE ?
                Button.State.INACTIVE : Button.State.ACTIVE);
        };
        //}

        this.viewerOptionButton.container.appendChild(subMenu);
        this.viewerOptionButton.subMenu = subMenu;
    };

    GuiViewer3D.prototype.removeViewerOptionsMenu = function (mode) {
        var ob = this.viewerOptionButton;

        ob.container.removeChild(ob.subMenu);
        if (mode === "3d") {
            this.removeEventListener(EventType.RENDER_OPTION_CHANGED_EVENT, this.onRenderOptionChanged);
            ob.envList = null;
        }

        ob.navigationOption.removeEventListener("touchstart", touchStartToClick);
        ob.navigationOption.removeEventListener("click", this.show3dOptionsNavigationTab);
        ob.navigationOption = null;
        ob.performanceOption.removeEventListener("touchstart", touchStartToClick);
        ob.performanceOption.removeEventListener("click", this.show3dOptionsPerformanceTab);
        ob.performanceOption = null;
    };

    GuiViewer3D.prototype.initDebugTools = function () {
        var debugGroup = new ControlGroup('debugTools');
        this.debugMenu = debugGroup;

        // Create the debug submenu button and attach submenu to it.
        var debugButton = new Button('toolbar-debugTool');
        debugButton.setIcon("adsk-icon-bug");
        debugGroup.addControl(debugButton);
        this.debugMenu.debugSubMenuButton = debugButton;

        this.createDebugSubmenu(this.debugMenu.debugSubMenuButton);

        this.toolbar.addControl(debugGroup);
    };

    GuiViewer3D.prototype.createDebugSubmenu = function (button) {
        // TODO: Refactor into a control
        var viewer = this;

        var subMenu = document.createElement('div');
        subMenu.id = 'toolbar-debugToolSubmenu';
        subMenu.classList.add('toolbar-submenu');
        subMenu.classList.add('toolbar-settings-sub-menu');
        subMenu.classList.add('adsk-hidden');

        this.debugMenu.subMenu = subMenu;
        this.debugMenu.subMenu.style.minWidth = "180px";

        // Temp connect to the main container to calculate the correct width
        this.container.appendChild(subMenu);

        this.initModelStats();
        this.addDivider(subMenu);

        // Add the language setting
        this.addDivider(subMenu);
        var langNames = ["English", "Chinese Simplified", "Chinese Traditional", "Japanese", "Czech", "Korean", "Polish", "Russian", "French", "German", "Italian", "Spanish", "Portuguese Brazil", "Turkish"];
        var langSymbols = ["en", "zh-Hans", "zh-Hant", "ja", "cs", "ko", "pl", "ru", "fr", "de", "it", "es", "pt-br", "tr"];

        function setLanguage() {
            viewer.localize();
        }

        var initialSelection = viewer.selectedLanguage ? viewer.selectedLanguage : 0;
        var langList = this.addOptionList(subMenu, "Language", langNames, initialSelection, function (selectedIndex) {
            var langSymb = langSymbols[selectedIndex];
            viewer.selectedLanguage = selectedIndex;
            setLanguage(langSymb, setLanguage);
        }, null);
        langList.parentNode.style.paddingBottom = "15px";

        // Add display of errors
        this.addDivider(this.debugMenu.subMenu);
        var errorNames = ["UNKNOWN FAILURE", "BAD DATA", "NETWORK ERROR", "NETWORK ACCESS DENIED",
            "NETWORK FILE NOT FOUND", "NETWORK SERVER ERROR", "NETWORK UNHANDLED RESPONSE CODE",
            "BROWSER WEBGL NOT SUPPORTED", "BAD DATA NO VIEWABLE CONTENT"];

        var errorList = this.addOptionList(subMenu, "Error", errorNames, 0, function (errorIndex) {
            var errorCode = errorIndex + 1;
            ErrorHandler.reportError(viewer.container, errorCode, "");
        }, null);
        errorList.parentNode.style.paddingBottom = "15px";

        var subMenuBounds = subMenu.getBoundingClientRect();
        this.debugMenu.subMenu.style.width = subMenuBounds.width + "px";
        this.container.removeChild(subMenu);
        button.container.appendChild(subMenu);

        // Check if the menu fits on the right site and if not, adjust the right edge.
        var right = subMenuBounds.left + subMenuBounds.width;
        var rightBoundary = this.container.getBoundingClientRect().right;
        if (right > rightBoundary) {
            var leftAdjustment = -(right - rightBoundary + 10) + "px";
            this.debugMenu.subMenu.style.left = leftAdjustment;
        }

        button.onMouseOver = function (e) {
            subMenu.classList.remove('adsk-hidden');
        };

        button.onMouseOut = function (e) {
            subMenu.classList.add('adsk-hidden');
        };

        if (DeviceType.isTouchDevice) {
            button.onClick = function (e) {
                subMenu.classList.toggle('adsk-hidden')
            };
        }
    };

    GuiViewer3D.prototype.initModelStats = function () {

        var self = this;

        function updateModelStatContent(message) {
            var viewer = self.impl;
            var text = "";
            var model = self.model;
            if (model) {
                text += "Geom&nbsp;polys:&nbsp;" + viewer.modelQueue().getGeometryList().geomPolyCount + "<br>";
                text += "Instance&nbsp;polys:&nbsp;" + viewer.modelQueue().getGeometryList().instancePolyCount + "<br>";
                text += "Fragments:&nbsp;" + viewer.modelQueue().getFragmentList().getCount() + "<br>";
                text += "Geoms:&nbsp;" + viewer.modelQueue().getGeometryList().geoms.length + "<br>";
                text += "Loading&nbsp;time:&nbsp;" + (viewer.model.loader.loadTime / 1000).toFixed(2) + " s" + "<br>";
            }
            text += "# " + (message || "");

            self.modelStats.innerHTML = text;
        }

        // On progress update debug text.
        //
        function createModelStats() {
            self.modelStats = document.createElement("div");
            self.modelStats.className = "statspanel";
            self.container.appendChild(self.modelStats);

            self.addEventListener(EventType.PROGRESS_UPDATE_EVENT, function (e) {
                if (e.message) {
                    updateModelStatContent(e.message);
                }
            });


            self.fpsDisplay = document.createElement("div");
            self.fpsDisplay.className = "fps";
            self.container.appendChild(self.fpsDisplay);
        }

        this.addOptionToggle(this.debugMenu.subMenu, "Model statistics", false, function (checked) {

            if (checked && !self.modelStats) {
                createModelStats();
                updateModelStatContent("");
            }

            self.modelStats.style.visibility = (checked ? "visible" : "hidden");
            self.fpsDisplay.style.visibility = (checked ? "visible" : "hidden");

            if (checked) {
                self.impl.fpsCallback = function (fps) {
                    self.fpsDisplay.textContent = "" + (0 | fps);
                }
            } else {
                self.impl.fpsCallback = null;
            }
        });

    };

    GuiViewer3D.prototype.initEscapeHandlers = function () {
        var viewer = this;

        this.addEventListener(EventType.ESCAPE_EVENT, function (event) {
            if (viewer.contextMenu && viewer.contextMenu.hide()) {
                return;
            }

            // Render options isn't enabled in release, so don't try to manipulate it
            if (viewer.renderoptions) {
                // Close render settings panel
                if (viewer.renderoptions.isVisible()) {
                    viewer.renderoptions.setVisible(false);
                    return;
                }
            }

            // TODO: stop any active animation

            // Reset default navigation mode:
            if (viewer.getActiveNavigationTool() !== viewer.getDefaultNavigationToolName()) {
                // Force unlock active tool:
                if (viewer.toolController)
                    viewer.toolController.setIsLocked(false);

                viewer.setActiveNavigationTool();
                HudMessage.dismiss();
                return;
            }

            // Deselect
            if (viewer.selectionActive) {
                viewer.clearSelection();
                return;
            }

            // Show all if anything is hidden
            if (!viewer.areAllVisible()) {
                viewer.showAll();
                return;
            }

            // Close open alert windows
            if (AlertBox.dismiss()) {
                return;
            }

            // Close open windows
            for (var i = 0; i < viewer.dockingPanels.length; ++i) {
                var panel = viewer.dockingPanels[i];
                if (panel.container.style.display !== "none" && panel.container.style.display !== "") {
                    // NB: Since the document structure panel state is reflected
                    //     in the toolbar, we need to update that as well.
                    if (panel.container === viewer.modelstructure) {
                        viewer.showModelStructurePanel(false);
                    } else {
                        panel.setVisible(false);
                    }
                    return;
                }
            }

            if (viewer.escapeScreenMode()) {
                return;
            }
        });
    };

    GuiViewer3D.prototype.displayViewCube = function (display, updatePrefs) {
        this.viewCubeUi.displayViewCube(display, updatePrefs);
    };


    /**
     * Returns a toolbar.
     *
     * @param {bool} create - if true and the toolbar does not exist, it will be created
     * @returns {av.UI.ToolBar?} - Returns the toolbar.
     */
    GuiViewer3D.prototype.getToolbar = function (create) {
        if (!this.toolbar) {
            if (create) {
                // var AVU = av.UI;
                this.toolbar = new ToolBar('guiviewer3d-toolbar');

                this.navTools = new RadioButtonGroup(ToolbarSID.NAVTOOLSID);
                this.modelTools = new ControlGroup(ToolbarSID.MODELTOOLSID);
                this.settingsTools = new ControlGroup(ToolbarSID.SETTINGSTOOLSID);

                this.toolbar.addControl(this.navTools);
                this.toolbar.addControl(this.modelTools);
                this.toolbar.addControl(this.settingsTools);

                this.container.appendChild(this.toolbar.container);
            }
        }
        return this.toolbar;
    };


    GuiViewer3D.prototype.showModelStructurePanel = function (show) {
        this.modelstructure.setVisible(show);
        if (show) {
            this.modelstructure.setSelection(this.getSelection());
        }
    };

    GuiViewer3D.prototype.onPanelVisible = function (panel) {

        // Shift this window to the top of the list, so that it will be closed first
        //
        this.dockingPanels.splice(this.dockingPanels.indexOf(panel), 1);
        this.dockingPanels.splice(0, 0, panel);
    };

    GuiViewer3D.prototype.updateFullscreenButton = function (mode) {
        var cls = "adsk-icon-fullscreen";

        switch (mode) {
            case ScreenMode.kNormal:
                if (!this.isScreenModeSupported(ScreenMode.kFullBrowser)) {
                    cls = 'adsk-icon-fullscreen';
                }
                break;
            case ScreenMode.kFullBrowser:
                if (this.isScreenModeSupported(ScreenMode.kFullScreen)) {
                    cls = 'adsk-icon-fullscreen';
                } else {
                    cls = 'adsk-icon-fullscreen-exit';
                }
                break;
            case ScreenMode.kFullScreen:
                cls = 'adsk-icon-fullscreen-exit';
                break;
        }

        this.settingsTools.fullscreenbutton.setIcon(cls);
    };

    GuiViewer3D.prototype.localize = function () {

        i18n.localize();

        if (this.viewerOptionButton && this.viewerOptionButton.subMenu) {
            var mode = this.viewerOptionButton.subMenu.mode;
            this.removeViewerOptionsMenu(mode);
            this.createViewerOptionsMenu(mode);
        }

        if (this.debugMenu && this.debugMenu.debugSubMenuButton) {
            this.debugMenu.debugSubMenuButton.container.removeChild(this.debugMenu.subMenu);
            this.createDebugSubmenu(this.debugMenu.debugSubMenuButton);
        }

        ErrorHandler.localize();
    };


    /**
     * Adds a panel to the viewer.  The panel will be moved and resized if the viewer
     * is resized and the panel falls outside of the bounds of the viewer.
     *
     * @param {PropertyPanel} panel - the panel to add.
     * @returns {boolean} true if panel was successfully added.
     *
     */
    GuiViewer3D.prototype.addPanel = function (panel) {
        var index = this.dockingPanels.indexOf(panel);
        if (index === -1) {
            this.dockingPanels.push(panel);
            return true;
        }
        return false;
    };

    /**
     * Removes a panel from the viewer.  The panel will no longer be moved and
     * resized if the viewer is resized.
     *
     * @param {PropertyPanel} panel - the panel to remove.
     * @returns {boolean} true if panel was successfully removed.
     *
     */
    GuiViewer3D.prototype.removePanel = function (panel) {
        var index = this.dockingPanels.indexOf(panel);
        if (index > -1) {
            this.dockingPanels.splice(index, 1);
            return true;
        }
        return false;
    };

    /**
     * Resizes the panels currently held by the viewer.
     *
     * @param {object} [options] - An optional dictionary of options.
     * @param {array} [options.dockingPanels=all] - a list of panels to resize.
     * @param {object} [options.viewer] - the viewer to use, specify if this method is being used as a callback.
     * @param {object} [options.dimensions] - the area for the panels to occupy.
     * @param {number} options.dimensions.width - the width
     * @param {number} options.dimensions.height - the height
     */
    GuiViewer3D.prototype.resizePanels = function (options) {

        options = options || {};

        var toolbarHeight = this.toolbar.getDimensions().height;
        var dimensions = this.getDimensions();
        var maxHeight = dimensions.height;

        if (options.dimensions && options.dimensions.height) {
            maxHeight = options.dimensions.height;
        }
        else {
            options.dimensions = {
                height: dimensions.height,
                width: dimensions.width
            };
        }

        options.dimensions.height = maxHeight - toolbarHeight;

        var viewer = options ? options.viewer : null;
        if (!viewer) {
            viewer = this;
        }

        var dockingPanels = options ? options.dockingPanels : null;
        if (!dockingPanels) {
            dockingPanels = viewer.dockingPanels;
        }

        var viewerRect = viewer.container.getBoundingClientRect(),
            vt = viewerRect.top,
            vb = viewerRect.bottom,
            vl = viewerRect.left,
            vr = viewerRect.right,
            vw, vh;

        if (options && options.dimensions) {
            vw = options.dimensions.width;
            vh = options.dimensions.height;
            vb = options.dimensions.height;
        } else {
            vw = viewerRect.width;
            vh = viewerRect.height;
        }

        for (var i = 0; i < dockingPanels.length; ++i) {
            var panel = dockingPanels[i].container,
                panelRect = panel.getBoundingClientRect(),
                pt = panelRect.top,
                pb = panelRect.bottom,
                pl = panelRect.left,
                pr = panelRect.right,
                pw = panelRect.width,
                ph = panelRect.height;

            if (pw && ph) {

                // Panel width should not be greater than viewer width.
                //
                if (vw < pw) {
                    pw = Math.round(vw);
                    panel.style.width = pw + "px";
                }

                // Panel height should not be greater than viewer height.
                //
                if (vh < ph) {
                    ph = Math.round(vh);
                    panel.style.height = ph + "px";
                }

                // Adjust horizontally if panel extends beyond right edge of viewer or panel is docked.
                //
                if ((vr < pr) || panel.dockRight) {
                    pl = Math.round(vr - pw - vl);
                    panel.style.left = pl + "px";
                }

                // Adjust vertically if panel extends beyond bottom edge of viewer or panel is docked.
                //
                if ((vb < pb) || panel.dockBottom) {
                    pt = Math.round(vb - ph - vt);
                    if (pt < 0) {
                        pt = 0;
                    }
                    panel.style.top = pt + "px";
                }

                // Set panel max width/height based upon viewer width/height.
                //
                panel.style.maxWidth = Math.round(vw) + "px";
                panel.style.maxHeight = Math.round(vh) + "px";
            }
        }

    };

    GuiViewer3D.prototype.initExplodeSlider = function () {
        var viewer = this;

        var button = new Button('toolbar-explodeTool');
        button.setIcon("adsk-icon-explode");
        button.setToolTip("Explode model");
        viewer.modelTools.addControl(button, { index: 0 });

        var htmlString = '<div class="explode-submenu" style="display:none"><input class="explode-slider" type="range" min="0" max="1" step="0.01" value="0"/></div>';
        this.explodeSubmenu = stringToDOM(htmlString);

        // hack fix for iOS bug
        // range input not draggable when nested under button
        var parentDom;
        if (true || isIOSDevice()) {
            parentDom = document.querySelector("#toolbar-explodeTool").parentNode;
            this.explodeSubmenu.classList.add("ios");
        }
        else {
            parentDom = button.container;
        }
        parentDom.appendChild(this.explodeSubmenu);

        var slider = this.explodeSubmenu.querySelector(".explode-slider");
        viewer.explodeSlider = slider;
        slider.oninput = function (e) {
            viewer.explode(slider.value);
        };
        //oninput does not seem to work on IE11...
        slider.onchange = function (e) {
            viewer.explode(slider.value);
        };
        this.explodeSubmenu.onclick = function (e) {
            e.stopPropagation();
        };

        // hack to disable tooltip, actually also problem with ViewerSettingsPanel
        var tooltip = button.container.querySelector(".adsk-control-tooltip");

        button.onClick = function (e) {
            var state = button.getState();
            if (state === Button.State.INACTIVE) {
                button.setState(Button.State.ACTIVE);
                tooltip.style.display = "none";
                viewer.explodeSubmenu.style.display = "";

                // Explode is not handled via ToolController; log it separately for now
                Logger.track({ category: 'tool_changed', name: 'explode' });
            }
            else if (state === Button.State.ACTIVE) {
                button.setState(Button.State.INACTIVE);
                tooltip.style.display = "";
                slider.parentNode.style.display = "none";
                viewer.explode(0);
                viewer.explodeSlider.value = 0;
            }
        };
    };

    GuiViewer3D.prototype.initInspectTools = function () {
        var viewer = this;

        var inspectToolsButton = new Button("toolbar-inspectTools");
        inspectToolsButton.setToolTip("Inspect");
        inspectToolsButton.setIcon("measure");
        inspectToolsButton.setVisible(false);
        this.modelTools.addControl(inspectToolsButton);

        var inspectSubmenu = new RadioButtonGroup('toolbar-inspectSubMenu');
        inspectSubmenu.addClass('toolbar-vertical-group');
        inspectSubmenu.setVisible(false);
        this.modelTools.addControl(inspectSubmenu);

        // Insert at the beginning so the CSS selector works.
        inspectToolsButton.container.insertBefore(inspectSubmenu.container, inspectToolsButton.container.firstChild);

        inspectToolsButton.onMouseOver = function () {
            inspectSubmenu.setVisible(true);
        };

        inspectToolsButton.onMouseOut = function () {
            inspectSubmenu.setVisible(false);
        };

        if (DeviceType.isTouchDevice) {
            inspectToolsButton.onClick = function (e) {
                inspectSubmenu.setVisible(!inspectSubmenu.isVisible());
            };
        }
    };

    GuiViewer3D.prototype.initModality = function () {

        function findToolbarParent(elem) {
            var MAX_DEPTH = 2;  // arbitrary
            var depth = 0;
            while (depth < MAX_DEPTH && elem.parentElement) {
                var eid = elem.id;
                if (eid.indexOf("toolbar-") === 0) {
                    // ignore arrow
                    if (eid.indexOf("arrow") === eid.length - 5)
                        return undefined;
                    // check if submenu, if so, return root button
                    var rootButton = findToolbarParent(elem.parentElement);
                    return rootButton || elem;
                }
                elem = elem.parentElement;
                depth++;
            }
        }

        function getButtonName(elem) {
            return elem.id.substring(8, elem.id.length);
        }

        function getButtonActive(elem) {
            return elem.classList.contains("active");
        }

        function simulateClick(elem) {
            var event = document.createEvent('Event');
            event.initEvent('click', true, true); //can bubble, and is cancellable
            elem.dispatchEvent(event);
        }

        // tool names registered for modality management
        // this mapping determines what tools are allowed together
        // when a tool is activated, all other tools but the ones allowed here will be disabled
        var modalityMap = {
            orbitTools: { explodeTool: 1 },
            panTool: { explodeTool: 1 },
            zoomTool: { explodeTool: 1 },
            beelineTool: {},
            sectionTool: {},
            measureTool: {},
            explodeTool: {},
            billboardTool: {}
        };

        var activeButtons = {};
        function registerButton(name, button, register) {
            activeButtons[name] = register ? button : undefined;
            // Logger.log("modal "+ (register ? "+" : "-") +" " + name);
        }

        function handleModality(e) {
            if (e.target.classList.contains("clickoff"))
                return;

            var button = findToolbarParent(e.target);
            if (!button) return;

            var toolName = getButtonName(button);

            // not handled
            if (!modalityMap[toolName])
                return;

            // special case section button, do not handle if initial blank state
            // HACK: use icon class to detect this case
            if (toolName === "sectionTool" && (
                e.target.classList.contains("adsk-icon-section-analysis") ||
                e.target.querySelector(".adsk-icon-section-analysis")))
                return;

            // if already registered as active
            if (activeButtons[toolName]) {
                registerButton(toolName, button, false);

                // if out of sync, the button is actually inactive, we need to continue as usual
                if (getButtonActive(button))
                    return;
            }

            // loop active buttons, deactivate (i.e., click again) if not allowed in map
            for (var k in activeButtons) {
                var b = activeButtons[k];
                if (!b)
                    continue;
                var bname = getButtonName(b);
                if (!getButtonActive(b))    // button already inactive, we're is out of sync, so we just unregister
                    registerButton(bname, b, false);
                else if (!modalityMap[toolName][bname]) // if not allowed by map
                    simulateClick(b);   // HACKY!
            }

            // finally, register active button
            registerButton(toolName, button, true);
        }

        this.toolbar.container.addEventListener("click", handleModality, true);
    };

    /**
     * Changes visibility of buttons in toolbar to accommodate as many as possible
     * given the available space.  Think of it as a media query applied to the viewer
     * canvas only (as opposed to the whole website)
     */
    GuiViewer3D.prototype.updateToolbarButtons = function (width, height) {

        var toolbar = this.getToolbar(false);
        if (!toolbar) return;

        //Logger.log("resized " + width);
        var ctrl, display;

        // 310px threshold
        display = width > 310 ? "block" : "none";
        ctrl = this.modelTools.getControl('toolbar-explodeTool');
        if (ctrl) ctrl.setDisplay(display);

        // 380px threshold
        display = width > 380 ? "block" : "none";
        ctrl = this.modelTools.getControl('toolbar-collaborateTool');
        if (ctrl) ctrl.setDisplay(display);

        // 515px threshold
        display = width > 515 ? "block" : "none";
        var camMenu = this.navTools.getControl('toolbar-cameraSubmenuTool');
        if (camMenu) {
            camMenu.setDisplay(display);
            ctrl = camMenu.subMenu.getControl('toolbar-homeTool');
            if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('gotoview') ? 'block' : 'none');
            ctrl = camMenu.subMenu.getControl('toolbar-fitToViewTool');
            if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('gotoview') ? 'block' : 'none');
            ctrl = camMenu.subMenu.getControl('toolbar-focalLengthTool');
            if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('fov') ? 'block' : 'none');
            ctrl = camMenu.subMenu.getControl('toolbar-rollTool');
            if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('roll') ? 'block' : 'none');
        }

        // 700px threshold
        display = width > 700 ? "block" : "none";
        ctrl = this.modelTools.getControl('toolbar-measureTool');
        if (ctrl) ctrl.setDisplay(display);
        ctrl = this.modelTools.getControl('toolbar-sectionTool');
        if (ctrl) ctrl.setDisplay(display);

        // 740px threshold
        display = width > 740 ? "block" : "none";
        ctrl = this.navTools.getControl('toolbar-beelineTool');
        if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('walk') ? display : 'none');
        ctrl = this.navTools.getControl('toolbar-firstPersonTool');
        if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('walk') ? display : 'none');
        ctrl = this.navTools.getControl('toolbar-zoomTool');
        if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('zoom') ? display : 'none');
        ctrl = this.navTools.getControl('toolbar-panTool');
        if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('pan') ? display : 'none');
        ctrl = this.navTools.getControl('toolbar-orbitTools');
        if (ctrl) ctrl.setDisplay(this.navigation.isActionEnabled('orbit') ? display : 'none');
    };

    return GuiViewer3D;
});