define([
        "../Core/DeviceType",
        "../Core/Privite/Preferences",
        '../Core/ScreenMode',
        '../Core/EventDispatcher',
        '../Core/ScreenModeMixin',
        '../Core/ExtensionMixin',
        '../Core/Global',
        '../Core/Fn/detectWebGL',
        '../Core/theHotkeyManager',
        '../Core/EventType',
        '../Core/Navigation',
        '../Core/ViewingUtilities',
        '../Core/DefaultHandler',
        '../Core/ToolController',
        '../Core/GestureHandler',
        '../Core/OrbitDollyPanTool',
        '../i18n',
        '../Core/FileLoaderManager',
        './Viewer3DImpl',
        '../Core/Logger',
        '../Core/Privite/ViewerState',
        '../Core/Privite/Autocam',
        '../Core/Privite/Fn/loadDependency',
        '../Core/Privite/LiveReviewClient',
        './ViewCubeUi',
        './ViewerObjectContextMenu'
       ], function(
           DeviceType,
           Preferences,
           ScreenMode,
           EventDispatcher,
           ScreenModeMixin,
           ExtensionMixin,
           Global,
           detectWebGL,
           theHotkeyManager,
           EventType,
           Navigation,
           ViewingUtilities,
           DefaultHandler,
           ToolController,
           GestureHandler,
           OrbitDollyPanTool,
           i18n,
           FileLoaderManager,
           Viewer3DImpl,
           Logger,
           ViewerState,
           Autocam,
           loadDependency,
           LiveReviewClient,
           ViewCubeUi,
           ViewerObjectContextMenu
       ) {
    'use strict'

    var nextViewerId = 0;
    /**
     *  This is the base class for all viewer implementations. It contains everything that is needed
     *  to connect to the Autodesk viewing service and display 3D models. It also includes
     *  basic navgiation support, and context menu and extension APIs.
     *
     *  @constructor
     *  @param {HTMLElement} container - The viewer container.
     *  @param {object} config - The initial settings object.
     *  @param {boolean} [config.startOnInitialize=true] - Set this to false if you want to defer the run to a later time
     *                                                     by calling run() explicitly.
     *
     *  @property {Navigation} navigation - The Navigation api object.
     *  @property {av.ToolController} toolController - The ToolController object.
     *  @property {av.ViewingUtilities} utilities - The ViewingUtilities object.
	 *  @alias Autodesk.Viewing.Viewer3D
     */
    var Viewer3D = function (container, config) {
        if (typeof THREE === 'undefined') {
            Logger.warn('Initializing LMV without the THREE.js dependency is not supported.',
                'Call Autodesk.Viewing.Initializer() first or preload the dependencies manually.');
        }
        if (container) {
            this.clientContainer = container;
            this.container = document.createElement("div");
            this.container.className = "adsk-viewing-viewer";
            this.container.style.height = "100%";
            this.container.style.width = "100%";
            this.container.style.overflow = "hidden";

            this.container.classList.add(DeviceType.isTouchDevice ? "touch" : "notouch");

            this.clientContainer.appendChild(this.container);

            this.config = config;


            this.contextMenu = null;
            this.contextMenuCallbacks = {};
            this.__firefoxLMBfix = false;
            this.started = false;


            // Create the canvas if it doesn't already exist
            if (this.container.nodeName === "CANVAS") {
                throw 'Viewer must be initialized on a div [temporary]';
            }
            else {
                this.canvasWrap = document.createElement("div");
                this.canvasWrap.classList.add("canvas-wrap");

                this.canvas = document.createElement("canvas");
                this.canvas.tabIndex = 0;

                this.canvasWrap.appendChild(this.canvas);
                this.container.appendChild(this.canvasWrap);
            }

            this.canvas.viewer = this; //store a pointer to the viewer in the canvas

            // Preferences. Prefix is a bit odd, but a legacy result after refactoring.
            //
            this.prefs = new Preferences(this, 'Autodesk.Viewing.Private.GuiViewer3D.SavedSettings.');

        }

        this.running = false;
        this._pushedTool = '';
        this._defaultNavigationTool = '';

        this.id = nextViewerId++;

        this.impl = new Viewer3DImpl(this.canvas, this);
    };
    Viewer3D.prototype.constructor = Viewer3D;

    EventDispatcher.prototype.apply(Viewer3D.prototype);
    ScreenModeMixin.prototype.apply(Viewer3D.prototype);
    ExtensionMixin.prototype.apply(Viewer3D.prototype);


    /** @deprecated Use av.ScreenMode instead */
    Viewer3D.ScreenMode = ScreenMode;

    /**
     * Default (and supported) values for how the viewer canvas will respond to click interaction.
     * If also provides a location to disable certain canvas features, such as:
     * "disableSpinner", "disableMouseWheel" and "disableTwoFingerSwipe".
     *
     * Refer to setCanvasClickBehavior() for additional info.
     *
     */
    Viewer3D.kDefaultCanvasConfig = {
        "click": {
            "onObject": ["selectOnly"],
            "offObject": ["deselectAll"]
        },
        "clickAlt": {
            "onObject": ["setCOI"],
            "offObject": ["setCOI"]
        },
        "clickCtrl": {
            "onObject": ["selectToggle"],
            "offObject": ["deselectAll"]
        },
        "clickShift": {
            "onObject": ["selectToggle"],
            "offObject": ["deselectAll"]
        },

        // Features that support disabling
        "disableSpinner": false,
        "disableMouseWheel": false,
        "disableTwoFingerSwipe": false
    };


    /**
     * Initializes the viewer and loads any extensions specified in the constructor's
     * config parameter. If the optional parameters are specified, the start() function will
     * use an optimized initialization sequence that results in faster model load.
     * The parameters are the same as the ones for Viewer3D.loadModel and you do not need to call loadModel
     * subsequently if the model is loaded via the call to start().
     *
     * @param {string} [url] Optional URN or filepath to load on start
     * @param {string} [options] Optional path to shared property database
     * @param {function} [onSuccessCallback] method gets called when initial loading is done and streaming starts
     * @param {function(int, string)} [onErrorCallback] method gets called when initial loading is done and streaming starts
     * @returns {int} - 0 if the viewer has started, an error code (same as that returned by initialize()) otherwise.
     */
    Viewer3D.prototype.start = function (url, options, onSuccessCallback, onErrorCallback) {
        if (this.started) {
            return 0;
        }
        this.started = true;

        var viewer = this;

        function initAfterWorker() {
            // Initialize the renderer and related stuff
            var result = viewer.initialize();
            if (result === 0) {
                //load extensions and set navigation overrides, etc.
                //Delayed so that it runs a frame after the long initialize() call.
                setTimeout(function () { viewer.setUp(viewer.config); }, 1);
            }
        }

        //If a model URL was given, kick off loading first, then initialize, otherwise just continue
        //with initialization immediately.
        if (url)
            this.loadModel(url, options, onSuccessCallback, onErrorCallback, initAfterWorker);
        else
            initAfterWorker();

    };



    Viewer3D.prototype.registerUniversalHotkeys = function () {
        var self = this;

        var onPress;
        var onRelease;
        var previousTool;
        var keys = theHotkeyManager.KEYCODES;

        // Add Fit to view hotkey
        onPress = function () {
            self.navigation.setRequestFitToView(true);
            return true;
        };
        theHotkeyManager.pushHotkeys("Autodesk.FitToView", [
            {
                keycodes: [keys.f],
                onPress: onPress
            }
        ]);

        // Add home hotkey
        onPress = function () {
            self.navigation.setRequestHomeView(true);
            return true;
        };
        theHotkeyManager.pushHotkeys("Autodesk.Home", [
            {
                keycodes: [keys.h],
                onPress: onPress
            },
            {
                keycodes: [keys.HOME],
                onPress: onPress
            }
        ]);

        // Escape
        onRelease = function () {
            // handle internal GUI components before firing the event to the client
            if (self.objectContextMenu && self.objectContextMenu.hide()) {
                return true;
            }

            // TODO: Could this all be unified somehow? If event listeners had priorities,
            //       we could intersperse listeners from the client and the viewer, which
            //       I think will eventually be required.

            self.fireEvent({ type: EventType.ESCAPE_EVENT });
            return true;
        };

        theHotkeyManager.pushHotkeys("Autodesk.Escape", [
            {
                keycodes: [keys.ESCAPE],
                onRelease: onRelease
            }
        ]);

        // Pan
        onPress = function () {
            previousTool = self.getActiveNavigationTool();
            return self.setActiveNavigationTool("pan");
        };
        onRelease = function () {
            return self.setActiveNavigationTool(previousTool);
        };
        var hotkeys = [
            {
                keycodes: [keys.SHIFT],
                onPress: onPress,
                onRelease: onRelease
            },
            {
                keycodes: [keys.SPACE],
                onPress: onPress,
                onRelease: onRelease
            }];
        theHotkeyManager.pushHotkeys("Autodesk.Pan", hotkeys, { tryUntilSuccess: true });
    };

    Viewer3D.prototype.createControls = function () {
        var self = this;
        var impl = self.impl;

        self.navigation = new Navigation(impl.camera);
        self.__initAutoCam(impl);

        self.utilities = new ViewingUtilities(impl, self.autocam, self.navigation);
        self.clickHandler = new DefaultHandler(impl, self.navigation, self.utilities);
        self.toolController = new ToolController(impl, self, self.autocam, self.utilities, self.clickHandler);
        self.toolController.registerTool(new GestureHandler(self));

        self.toolController.registerTool(theHotkeyManager);
        self.toolController.activateTool(theHotkeyManager.getName());

        self.registerUniversalHotkeys();

        self.toolController.registerTool(new OrbitDollyPanTool(impl, self));
        self.toolController.activateTool("gestures");

        return self.toolController;
    };



    /**
     * Create any DOM and canvas elements, and
     * setup WebGL.
     *
     * @return {Number} - 0 if initialization was successful, Global.ErrorCode otherwise.
     */
    Viewer3D.prototype.initialize = function () {

        //Set up the private viewer implementation
        this.setScreenModeDelegate(this.config ? this.config.screenModeDelegate : undefined);

        var dimensions = this.getDimensions();
        this.canvas.width = dimensions.width;
        this.canvas.height = dimensions.height;

        // For Safari and WKWebView and UIWebView on ios device with retina display,
        // needs to manually rescale our canvas to get the right scaling. viewport metatag
        // alone would not work.
        if (DeviceType.isIOSDevice && window.devicePixelRatio) {
            this.canvas.width /= window.devicePixelRatio;
            this.canvas.height /= window.devicePixelRatio;
        }

        //Call this after setting canvas size above...
        this.impl.initialize();

        //Only run the WebGL failure logic if the renderer failed to initialize (otherwise
        //we don't have to spend time creating a GL context here, since we know it worked already
        if (!this.impl.glrenderer()) {
            var webGL = detectWebGL();
            if (webGL <= 0) {  // WebGL error.
                return webGL === -1 ? Global.ErrorCodes.BROWSER_WEBGL_NOT_SUPPORTED : Global.ErrorCodes.BROWSER_WEBGL_DISABLED;
            }
        }

        var self = this;

        // Add a callback for the panels to resize when the viewer resizes.
        //
        // Note, we can't pass viewer.resize() as the callback - it will not evaluate
        // 'this' as the viewer when it's called.  We save the viewer here as a closure
        // variable ensuring resize() is called on the viewer.
        //
        this.onResizeCallback = function (e) {
            self.resize();
        };
        window.addEventListener('resize', this.onResizeCallback, false);


        this.initContextMenu();

        // Localize the viewer.
        this.localize();


        this.impl.controls = this.createControls();
        this.setDefaultNavigationTool("orbit");
        this.model = null;

        if (this.impl.controls)
            this.impl.controls.setAutocam(this.autocam);

        var canvasConfig = (this.config && this.config.canvasConfig) ? this.config.canvasConfig : Viewer3D.kDefaultCanvasConfig;
        this.setCanvasClickBehavior(canvasConfig);

        // Allow clients not load the spinner. This is needed for embedding viewer in a WebView on mobile,
        // where the spinner makes the UI looks less 'native'.
        if (!canvasConfig.disableSpinner) {

            // Create a div containing an image: this will be a
            // spinner (aka activity indicator) that tells the user
            // that the file is loading.
            //
            this.loadSpinner = document.createElement("div");
            this.loadSpinner.className = "spinner";
            this.container.appendChild(this.loadSpinner);

            // Generate circles for spinner
            for (var i = 1; i <= 3; i++) {
                var spinnerContainer = document.createElement("div");
                spinnerContainer.className = "bounce" + i;
                this.loadSpinner.appendChild(spinnerContainer);
            }
        }

        // Setup of AO, Ghosting, Env Lighting etc.
        this.initSettings();

        // Auxiliary class to get / restore the viewer state.
        this.viewerState = new ViewerState(this);

        // The default behavior is to run the main loop immediately, unless startOnInitialize
        // is provided and is false.
        //
        if (!this.config || !this.config.hasOwnProperty("startOnInitialize") || this.config.startOnInitialize) {
            this.run();
        }

        window.NOP_VIEWER = this;

        this.fireEvent(EventType.VIEWER_INITIALIZED);

        return 0;   // No Error initializing.
    };

    Viewer3D.prototype.setUp = function (config) {

        this.config = config;

        // Load the extensions specified in the config.
        //
        if (this.config && this.config.hasOwnProperty('extensions')) {
            var extensions = this.config.extensions;
            for (var i = 0; i < extensions.length; ++i) {
                this.loadExtension(extensions[i], this.config);
            }
        }

        var canvasConfig = (this.config && this.config.canvasConfig) ? this.config.canvasConfig : Viewer3D.kDefaultCanvasConfig;
        this.setCanvasClickBehavior(canvasConfig);
    };

    Viewer3D.prototype.tearDown = function () {
        this.clearSelection();

        if (this.loadedExtensions) {
            for (var extensionId in this.loadedExtensions) {
                try {
                    // Extensions that fail to unload will end up terminating
                    // the viewer tearDown process.  Thus we protect from it
                    // here and log it (if available).
                    this.unloadExtension(extensionId);
                } catch (err) {
                    Logger.error("Failed to unload extension: " + extensionId, err);
                    Logger.track(
                        {
                            category: "error_unload_extension",
                            extensionId: extensionId,
                            error_message: err.message,
                            call_stack: err.stack
                        });
                }
            }
            this.loadedExtensions = null;
        }

        Logger.reportRuntimeStats(true);

        if (this.loadSpinner)
            this.loadSpinner.style.display = "block";
        this.model = null;

        if (this.liveReviewClient) {
            this.liveReviewClient.destroy();
            this.liveReviewClient = null;
        }

        this.impl.unloadCurrentModel();
    };

    Viewer3D.prototype.run = function () {
        if (!this.running) {
            this.resize();
            this.running = true;
            this.impl.run();
        }
    };


    /**
     * Localize the viewer. This method can be overwritten so that the subclasses
     * can localize any additional elements.
     *
     **/
    Viewer3D.prototype.localize = function () {
        i18n.localize();
    };

    Viewer3D.prototype.__initAutoCam = function (impl) {
        var self = this;

        var ourCamera = impl.camera;

        if (!ourCamera.pivot)
            ourCamera.pivot = new THREE.Vector3(0, 0, 0);

        if (!ourCamera.target)
            ourCamera.target = new THREE.Vector3(0, 0, 0);

        if (!ourCamera.worldup)
            ourCamera.worldup = ourCamera.up.clone();

        function autocamChange(upChanged) {
            if (self.autocamCamera.isPerspective !== ourCamera.isPerspective) {
                if (self.autocamCamera.isPerspective)
                    self.navigation.toPerspective();
                else
                    self.navigation.toOrthographic();
            }
            self.navigation.setVerticalFov(self.autocamCamera.fov, false);
            self.navigation.setView(self.autocamCamera.position, self.autocamCamera.target);
            self.navigation.setPivotPoint(self.autocamCamera.pivot);
            self.navigation.setCameraUpVector(self.autocamCamera.up);
            if (upChanged)
                self.navigation.setWorldUpVector(self.autocamCamera.worldup);

            self.impl.syncCamera(upChanged);
        }

        function pivotDisplay(state) {
            if (self.utilities)
                self.utilities.pivotActive(state, false);
            else
                self.impl.controls.pivotActive(state, false);
        }

        self.autocamCamera = ourCamera.clone();
        self.autocamCamera.target = ourCamera.target.clone();
        self.autocamCamera.pivot = ourCamera.pivot.clone();
        self.autocamCamera.worldup = ourCamera.worldup.clone();

        self.autocam = new Autocam(self.autocamCamera, self.navigation);
        self.autocam.cameraChangedCallback = autocamChange;
        self.autocam.pivotDisplayCallback = pivotDisplay;
        self.autocam.canvas = self.canvas;

        self.addEventListener("cameraChanged", function (evt) {
            var ourCamera = evt.camera;
            self.autocam.sync(ourCamera);
        });

        self.autocam.sync(ourCamera);
    };


    /**
     * Removes all created DOM elements
     * and performs any GL un-initialization that is needed.
     */
    Viewer3D.prototype.uninitialize = function (file) {

        window.removeEventListener('resize', this.onResizeCallback, false);
        this.onResizeCallback = null;


        this.canvas.parentNode.removeChild(this.canvas);
        this.canvas.viewer = null;
        this.canvas = null;
        this.canvasWrap = null;

        this.viewerState = null;

        Logger.reportRuntimeStats();
        Logger.track({ category: "viewer_destroy" }, true);

        if (this.toolController) {
            this.toolController.uninitialize();
            this.toolController = null;
            this.clickHandler = null;
            this.utilities = null;
        }

        if (this.navigation) {
            this.navigation.uninitialize();
            this.navigation = null;
        }

        if (this.impl) {
            this.impl.dtor();
            this.impl = null;
        }

        this.loadSpinner = null;
        this.model = null;
        this.prefs = null;

        this.autocam.dtor();
        this.autocam = null;
        this.autocamCamera = null;

        theHotkeyManager.popHotkeys("Autodesk.FitToView");
        theHotkeyManager.popHotkeys("Autodesk.Home");
        theHotkeyManager.popHotkeys("Autodesk.Escape");
        theHotkeyManager.popHotkeys("Autodesk.Pan");
        theHotkeyManager.popHotkeys("Autodesk.Orbit");



        if (this.onDefaultContextMenu) {
            this.container.removeEventListener('contextmenu', this.onDefaultContextMenu, false);
            this.onDefaultContextMenu = null;
        }

        if (this.screenModeDelegate) {
            this.screenModeDelegate.uninitialize();
            this.screenModeDelegate = null;
        }

        this.clientContainer = null;
        this.config = null;
        this.listeners = {};
        this.contextMenu = null;
        this.contextMenuCallbacks = null;

        if (this.viewCubeUi) {
            this.viewCubeUi.uninitialize();
            this.viewCubeUi = null;
        }

        if (this.container && this.container.parentNode)
            this.container.parentNode.removeChild(this.container);
        this.container = null;

        this.fireEvent(Global.VIEWER_UNINITIALIZED);

        //forget all event listeners
        this.listeners = {};

        Logger.log("viewer destroy");
    };


    /**
     * Unloads any loaded extensions and then uninitializes the viewer.
     */
    Viewer3D.prototype.finish = function () {
        this.tearDown();
        this.uninitialize();
    };


    /**
     * @deprecated Use loadModel instead
     * Load the file from the cloud or locally.
     * Asynchronously loads the document given its svfURN.
     *
     * On success: Calls onDocumentLoadedCallback.
     * On error: Displays an error AlertBox.
     * @param {string} svfURN The URN or filepath to load
     * @param {string} [sharedPropertyDbPath] Optional path to shared property database
     * @param {function} [onSuccessCallback] method gets called when initial loading is done and streaming starts
     * @param {function(int, string)} [onErrorCallback] method gets called when initial loading is done and streaming starts
     * @param {Obect} [loadOptions] Optional load options passed to the model loader.
     */
    Viewer3D.prototype.load = function (svfURN, sharedPropertyDbPath, onSuccessCallback, onErrorCallback, acmSessionId, loadOptions) {
        var options = {
            ids: null,
            sharedPropertyDbPath: sharedPropertyDbPath,
            acmSessionId: acmSessionId,
            loadOptions: loadOptions
        };
        return this.loadModel(svfURN, options, onSuccessCallback, onErrorCallback);
    };


    /**
     * Loads a model into the viewer
     * @param {string} url the url to the model.
     * @param {Object} [options] - An optional dictionary of options.
     * @param {av.FileLoader} [options.fileLoader] - The file loader to use for this url.
     * @param {Object} [options.loadOptions] - May contain params that are specific for certain loaders/filetypes. See LeafletLoader.js
     * @param {string} [options.sharedPropertyDbPath] - Optional path to shared property database.
     * @param {string} [options.ids] A list of object id to load.
     * @param {function} [onSuccessCallback] A method that gets called when initial loading is done and streaming starts.
     * @param {function(int, string)} [onErrorCallback] A method that gets called when loading fails.
     */
    Viewer3D.prototype.loadModel = function (url, options, onSuccessCallback, onErrorCallback, onWorkerStart) {
        var self = this;

        options = options || {};

        function registerDimensionSpecificHotkeys() {
            if (!theHotkeyManager)
                return;

            if (self.model.is2d()) {
                // Remove 3D specific hotkeys
                theHotkeyManager.popHotkeys("Autodesk.Orbit");
            } else {
                // Add 3D specific hotkeys
                // Orbit
                var previousTool;
                var onPress = function () {
                    previousTool = self.getActiveNavigationTool();
                    return self.setActiveNavigationTool("orbit");
                };
                var onRelease = function () {
                    return self.setActiveNavigationTool(previousTool);
                };
                var hotkeys = [
                    {
                        keycodes: [theHotkeyManager.KEYCODES.ALT],
                        onPress: onPress,
                        onRelease: onRelease
                    }];
                theHotkeyManager.pushHotkeys("Autodesk.Orbit", hotkeys, { tryUntilSuccess: true });
            }
        }

        function onSuccess(model) {
            self.model = model;
            self.impl.addModel(self.model);

            if (self.loadSpinner)
                self.loadSpinner.style.display = "None";

            if (self.model.is2d())
                self.activateLayerState("Initial");

            registerDimensionSpecificHotkeys();

            if (onSuccessCallback) {
                onSuccessCallback(self.model);
            }
        }

        function onError(errorCode, errorMessage, statusCode, statusText) {
            if (self.loadSpinner)
                self.loadSpinner.style.display = "None";
            if (onErrorCallback)
                onErrorCallback(errorCode, errorMessage, statusCode, statusText);
        }

        // Force a repaint when a file is fully done loading
        function forceRepaint() {
            self.impl.needsRender = true;
            self.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, forceRepaint);
        }
        this.addEventListener(EventType.GEOMETRY_LOADED_EVENT, forceRepaint);

        var match = url.toLowerCase().match(/\.([a-z0-9]+)(\?|$)/),
            fileExtension = match ? match[1] : null;

        var loader;
        if (options && options.fileLoader) {
            loader = options.fileLoader;
        } else {
            loader = FileLoaderManager.getFileLoaderForExtension(fileExtension);
        }

        return new loader(this.impl).loadFile(url, options, onSuccess, onError, onWorkerStart);
    };


    /**
     *
     * @returns {rect} Client Rectangle Bounds
     */
    Viewer3D.prototype.getDimensions = function () {
        if (this.container) {
            // NB: Getting dimensions of the client container instead of the container.
            //     At least in IE11, getting dimensions on the dynamically created
            //     child of the dynamically created parent returns a 0 height.
            var rect = {};
            if (this.getScreenMode() === ScreenMode.kFullScreen) {
                rect.width = screen.width;
                rect.height = screen.height;
            } else {
                rect = this.container.getBoundingClientRect();
            }

            return {
                width: rect.width,
                height: rect.height
            };
        }

        return null;
    };


    /**
     * Resizes the viewer.
     */
    Viewer3D.prototype.resize = function () {
        return this.impl.resize(this.container.clientWidth, this.container.clientHeight);
    };

    /**
     *
     * Gets the camera so it can be modified by the client.
     * @returns {THREE.camera} The active camera.
     */
    Viewer3D.prototype.getCamera = function () {
        return this.impl.camera;
    };

    /**
     * Gets the view state as a plain object.
     *
     * @param {Object} [filter] - Specifies which viewer values to get.
     * @returns {Object} viewers state.
     */
    Viewer3D.prototype.getState = function (filter) {
        return this.viewerState.getState(filter);
    };

    /**
     * Restores the viewer state from a given object.
     * @param {Object} viewerState
     * @param {Object} [filter] - Similar in structure to viewerState used to filter out values
     *                            that should not be restored.
     * @param {boolean} [immediate] - Whether the new view is applied with (true) or without transition (false)
     *
     * @returns {boolean} true if restore operation was successful.
     */
    Viewer3D.prototype.restoreState = function (viewerState, filter, immediate) {
        var success = this.viewerState.restoreState(viewerState, filter, immediate);
        if (success) {
            this.fireEvent({ type: EventType.VIEWER_STATE_RESTORED_EVENT, value: success });
        }
        return success;
    };

    /**
     * Sets the view from an array of parameters
     * @param {Array} params - View parameters:
     *  [position-x, position-y, position-z,
     *    target-x, target-y, target-z,
     *    up-x, up-y, up-z,
     *    aspect, fov (radians), orthoScale,
     *    isPerspective (0=perspective, 1=ortho)]
     */
    Viewer3D.prototype.setViewFromArray = function (params, name) {
        this.setActiveNavigationTool("orbit");

        //TODO: It might be best to get rid of the setViewFromArray API as it's not
        //very descriptive, and move the params->camera conversion to the bubble-reading
        //logic in ViewingApplication.

        //Make sure to apply any internal translation offset to the input camera
        var off = this.model ? this.model.getData().globalOffset : { x: 0, y: 0, z: 0 };
        var camera = {
            position: new THREE.Vector3(params[0] - off.x, params[1] - off.y, params[2] - off.z),
            target: new THREE.Vector3(params[3] - off.x, params[4] - off.y, params[5] - off.z),
            up: new THREE.Vector3(params[6], params[7], params[8]),
            aspect: params[9],
            fov: THREE.Math.radToDeg(params[10]),
            orthoScale: params[11],
            isPerspective: !params[12]
        };

        this.impl.setViewFromCamera(camera);
    };

    /**
     * Sets the view from an array representing a view box
     *
     * Not applicable to 3D.
     *
     * @param {Array} viewbox - View parameters:
     *  [min-x, min-y, max-x, max-y]
     * @param {String} name - Optional named view name to also set the layer visibility state associated with this view
     */
    Viewer3D.prototype.setViewFromViewBox = function (viewbox, name) {
        var model = this.model;

        if (model && !model.is2d()) {
            Logger.warn("Viewer3D.setViewFromViewBox is not applicable to 3D");
            return;
        }

        //set the layer state if any
        //It's annoying to search the views and states as arrays,
        //but this is the only place we do this, so converting them
        //to hashmaps is not necessary (yet).
        if (name && name.length) {
            var metadata = model.getData().metadata;
            var views = metadata.views;

            var i;
            for (i = 0; i < views.length; i++) {
                if (views[i].name == name)
                    break;
            }

            if (i < views.length) {
                var state_name = views[i].layer_state;
                if (state_name)
                    this.activateLayerState(state_name);
            }
        }

        //Finally set the camera
        this.impl.setViewFromViewBox(this.model, viewbox, name, false);
    };

    /**
     * Changes the active layer state.<br>
     * Get a list of all available layerStates and their active status through
     * [getLayerStates()]{@link Autodesk.Viewing.Viewer3D#getLayerStates}.
     *
     * @param {String} stateName - Name of the layer state to activate
     */
    Viewer3D.prototype.activateLayerState = function (stateName) {
        if (stateName && stateName.length) {
            var metadata = this.model.getData().metadata;
            var states = (metadata ? metadata.layer_states : null);
            if (!states) {
                return;
            }

            var j;
            for (j = 0; j < states.length; j++) {
                if (states[j].name == stateName)
                    break;
            }

            if (j < states.length) {
                var layer_state = states[j];
                var visible = layer_state.visible_layers;

                var visMap = {};
                if (visible && 0 < visible.length) {
                    for (var k = 0; k < visible.length; k++)
                        visMap[visible[k]] = 1;
                }

                var onlayers = [];
                var offlayers = [];

                for (var l in metadata.layers) {
                    var lname = metadata.layers[l].name;
                    if (visMap[lname] === 1)
                        onlayers.push(l);
                    else
                        offlayers.push(l);
                }

                this.impl.setLayerVisible(onlayers, true);
                this.impl.setLayerVisible(offlayers, false);
                this.fireEvent({ type: EventType.LAYER_VISIBILITY_CHANGED_EVENT });
            }
        }
    };

    /**
     * Returns information for each layer state: name, description, active.<br>
     * Activate a state through [activateLayerState()]{@link Autodesk.Viewing.Viewer3D#activateLayerState}.
     * @returns {Array}
     */
    Viewer3D.prototype.getLayerStates = function () {
        var model = this.model,
            metadata = model ? model.getData().metadata : null,
            layers = metadata ? metadata.layers : null,
            layer_states = metadata ? metadata.layer_states : null;

        // No layers or no layer states? Nothing to do.
        //
        if (!layers || !layer_states) {
            return null;
        }

        // Which layers are currently visible?
        //
        var layerName,
            layerNames = {},
            currentVisibleLayers = {};

        for (var layer in layers) {
            if (layers.hasOwnProperty(layer)) {
                var index = parseInt(layer),
                    defn = layers[layer];

                layerName = (typeof defn === 'string') ? defn : defn.name;
                layerNames[layerName] = true;

                if (this.impl.isLayerVisible(index)) {
                    currentVisibleLayers[layerName] = true;
                }
            }
        }

        // Shallow equal()
        //
        function equal(a, b) {
            var aProps = Object.getOwnPropertyNames(a),
                bProps = Object.getOwnPropertyNames(b);

            if (aProps.length !== bProps.length) {
                return false;
            }

            for (var i = 0; i < aProps.length; ++i) {
                var propName = aProps[i];
                if (a[propName] !== b[propName]) {
                    return false;
                }
            }

            return true;
        }

        var layerStates = [],
            i, j;

        for (i = 0; i < layer_states.length; ++i) {
            var layer_state = layer_states[i],
                visible_layers = layer_state.visible_layers,
                layerStateVisibleLayers = {};

            if (!layer_state.hidden) { // Ignore hidden layer states
                if (visible_layers && 0 < visible_layers.length) {
                    for (j = 0; j < visible_layers.length; ++j) {
                        layerName = visible_layers[j];
                        if (layerNames.hasOwnProperty(layerName)) { // Ignore layers we don't know about
                            layerStateVisibleLayers[layerName] = true;
                        }
                    }
                }

                layerStates.push({
                    name: layer_state.name,
                    description: layer_state.description,
                    active: equal(currentVisibleLayers, layerStateVisibleLayers)
                });
            }
        }
        return (0 < layerStates.length) ? layerStates : null;
    };

    /**
     * Sets the view using the default view in the source file.
     */
    Viewer3D.prototype.setViewFromFile = function () {
        this.setActiveNavigationTool();
        this.impl.setViewFromFile(this.model);
    };

    /**
     * Gets the properties for an id. Once the properties are returned, the method raises a onPropertiesReady event.
     * @param {number} dbid
     * @param {function} [onSuccessCallback] call this callback once the properties are found.
     * @param {function(int, string)} [onErrorCallback] call this callback if the properties are not found, or another error occurs.
     */
    Viewer3D.prototype.getProperties = function (dbid, onSuccessCallback, onErrorCallback) {
        Logger.track({ name: 'get_props_count', aggregate: 'count' });

        if (this.model) {
            this.model.getProperties(dbid, onSuccessCallback, onErrorCallback);
        }
        else {
            if (onErrorCallback)
                onErrorCallback(Global.ErrorCodes.BAD_DATA, "Properties failed to load since model does not exist");
        }
    };

    /**
     * Gets the viewer model object tree. Once the tree is received it will invoke the specified callback function.
     *
     * You can use the model object tree to get information about items in the model.  The tree is made up
     * of nodes, which correspond to model components such as assemblies or parts.
     *
     * @param {function} [onSuccessCallback] call this callback once the object tree is loaded.
     * @param {function(int, string)} [onErrorCallback] call this callback if the object tree is not found.
     */
    Viewer3D.prototype.getObjectTree = function (onSuccessCallback, onErrorCallback) {
        if (this.model) {
            this.model.getObjectTree(onSuccessCallback, onErrorCallback);
        }
        else {
            if (onErrorCallback)
                onErrorCallback(Global.ErrorCodes.BAD_DATA, "ObjectTree failed to load since model does not exist");
        }
    };

    /**
     * Sets the click behavior on the canvas to follow config.
     * This is used to change the behavior of events such as selection or COI changed.
     *
     *  @example
     *  {
     *       "click": {
     *           "onObject": [ACTIONS],
     *           "offObject": [ACTIONS]
     *       },
     *       "clickCtrl": {
     *           "onObject": [ACTIONS],
     *           "offObject": [ACTIONS]
     *       },
     *       "clickShift": {
     *           ...
     *       },
     *       "clickCtrlShift": {
     *           ...
     *       },
     *       "disableSpinner": BOOLEAN
     *       "disableMouseWheel": BOOLEAN,
     *       "disableTwoFingerSwipe": BOOLEAN
     *  }
     *
     *  Actions can be any of the following:
     *  "selectOnly"
     *  "selectToggle"
     *  "deselectAll"
     *  "isolate"
     *  "showAll"
     *  "setCOI"
     *  "focus"
     *  "hide"
     *
     *  Boolean is either true or false
     *
     * @param {object} config parameter that meets the above layout
     */
    Viewer3D.prototype.setCanvasClickBehavior = function (config) {
        if (this.impl.controls.hasOwnProperty("setClickBehavior"))
            this.impl.controls.setClickBehavior(config);

        if (this.clickHandler)
            this.clickHandler.setClickBehavior(config);

        if (config && config.disableMouseWheel) {
            this.toolController.setMouseWheelInputEnabled(false);
        }

        if (config && config.disableTwoFingerSwipe) {
            var gestureHandler = this.toolController.getTool("gestures");
            if (gestureHandler) {
                gestureHandler.disableTwoFingerSwipe();
            }
        }
    };

    /**
     * Searches the elements for the given text.  When the search is complete,
     * the callback onResultsReturned(idArray) is invoked.
     * @param {string} text - the search term.
     * @param {function(idArray)} onSuccessCallback - the callback to invoke when search is complete.
     * @param {function(errorCode, errorMsg)} onErrorCallback - the callback to invoke when search is complete.
     * @param {string[]} [attributeNames] - restricts search to specific attribute names
     */
    Viewer3D.prototype.search = function (text, onSuccessCallback, onErrorCallback, attributeNames) {
        this.searchText = text;

        if (this.model) {
            this.model.search(text, onSuccessCallback, onErrorCallback, attributeNames);
        }
        else {
            if (onErrorCallback)
                onErrorCallback(Global.ErrorCodes.BAD_DATA, "Search failed since model does not exist");
        }
    };

    /**
     * Returns an Array of the IDs of the currently hidden nodes.
     * When isolation is in place, there are no hidden nodes returned because
     * all nodes that are not isolated are considered hidden.
     *
     * @returns {Array} of nodes that are currently hidden, when no isolation is in place.
     */
    Viewer3D.prototype.getHiddenNodes = function () {
        return this.impl.visibilityManager.getHiddenNodes();
    };

    /**
     * Returns an array of the IDs of the currently isolated nodes.
     *
     * Not yet implemented for 2D.
     *
     * @returns {Array} of nodes that are currently isolated.
     */
    Viewer3D.prototype.getIsolatedNodes = function () {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.getIsolatedNodes is not yet implemented for 2D");
            return [];
        }

        return this.impl.visibilityManager.getIsolatedNodes();
    };

    /**
     * Isolates one of many sub-elements. You can pass in a node or an array of nodes to isolate.
     * Pass in null to reset isolation.
     *
     * Not yet implemented for 2D.
     *
     * @param {int[] | int} node A node ID or array of node IDs from the model tree {@link BaseViewer#getObjectTree}
     */
    Viewer3D.prototype.isolate = function (node) {
        if (!this.model) {
            // Silently abort //
            return;
        }

        var data = this.model.getData();
        if (data && data.is2d && data.loadDone && 'hasObjectProperties' in data) {
            // some 2d datasets have no instance-tree, but just a flat list of object properties.
            // Here, we can call isolate directly without requesting the instanceTree first.
            this.impl.visibilityManager.isolate(node);
        } else {
            // request instance tree first
            var self = this;
            this.model.getObjectTree(function () {
                Logger.track({ name: 'isolate_count', aggregate: 'count' });
                self.impl.visibilityManager.isolate(node);
            });
        }
    };


    /**
     * @deprecated Isolates one of many sub-elements. You can pass in a dbid or an array of dbid to isolate.
     *
     * Not yet implemented for 2D.
     *
     * @param {array| int} dbids either an array or a single integer.
     *
     */
    Viewer3D.prototype.isolateById = function (dbIds) {

        Logger.warn("isolateById() is deprecated. Use isolate() instead.");
        return this.isolate(dbIds);

    };

    /**
     * Sets the background Color
     * @param {Number} red
     * @param {Number} green
     * @param {Number} blue
     * @param {Number} red2
     * @param {Number} green2
     * @param {Number} blue2
     */
    Viewer3D.prototype.setBackgroundColor = function (red, green, blue, red2, green2, blue2) {
        this.impl.setClearColors(red, green, blue, red2, green2, blue2);
    };

    /**
     * Toggles the selection for a given dbid. If it was unselected, it is selected.  If it was selected, it is unselected.
     *
     * Not yet implemented for 2D.
     *
     * @param {( number)} dbid
     */
    Viewer3D.prototype.toggleSelect = function (dbid) {
        if (this.model && this.model.is2d()) {
            // Fails because Model.getNodeById is not supported.
            Logger.warn("Viewer3D.toggleSelect is not yet implemented for 2D");
            return;
        }

        this.impl.selector.toggleSelection(dbid);
    };

    /**
     * Selects the array of ids. You can also just pass in a single id instead of an array.
     * @param {( number[] | number)} dbids
     */
    Viewer3D.prototype.select = function (dbids) {
        if (typeof dbids === "number") {
            dbids = [dbids];
        }

        this.impl.selector.setSelection(dbids);
    };


    /**
     * Clears the selection.
     */
    Viewer3D.prototype.clearSelection = function () {
        this.impl.selector.clearSelection();
        Logger.track({ name: 'clearselection', aggregate: 'count' });
    };

    /**
     * Returns information about the visibility of the current selection.
     * @returns {Object} hasVisible, hasHidden
     */
    Viewer3D.prototype.getSelectionVisibility = function () {
        return this.impl.selector.getSelectionVisibility();
    };

    /**
     * Returns the number of nodes in the current selection.
     * @returns {number}
     */
    Viewer3D.prototype.getSelectionCount = function () {
        return this.impl.selector.getSelectionLength();
    };

    /**
     * Sets selection granularity mode. Supported values are:
     *      Autodesk.Viewing.SelectionMode.LEAF_OBJECT -- always select the leaf objects in the hierarchy
     *      Autodesk.Viewing.SelectionMode.FIRST_OBJECT -- for a given node, selects the first non-composite
     *                                                    (layer, collection, model) on the path from the root to the given node,
     *                                                    and all children
     *      Autodesk.Viewing.SelectionMode.LAST_OBJECT -- for a given node, selects the nearest ancestor composite node and all
     *                                                     children. Selects the input node itself in case there is no composite node
     *                                                     in the path to the root node.
     */
    Viewer3D.prototype.setSelectionMode = function (mode) {
        this.impl.selector.setSelectionMode(mode);
    };


    /**
     * Returns the current selection.
     * @returns {int[]} An array of the IDs of the currently selected nodes.
     */
    Viewer3D.prototype.getSelection = function () {
        return this.impl.selector.getSelection();
    };

    /**
     * Returns the selected items from all loaded models.
     * @param {Function} callback -- optional callback to receive enumerated pairs of model and dbId for each selected object.
     *                               If no callback is given, an array of objects is returned.
     * @returns {Object[]} An array of objects with a model and selectionSet properties
     *                     for each model that has selected items in the scene
     */
    Viewer3D.prototype.getAggregateSelection = function (callback) {
        var res = this.impl.selector.getAggregateSelection();

        if (callback) {
            for (var i = 0; i < res.length; i++) {
                for (var j = 0; j < res[i].selection.length; j++) {
                    callback(res[i].model, res[i].selection[j]);
                }
            }
        }

        return res;
    };

    /**
     * Ensures the passed in dbid / ids are hidden.
     *
     * Not yet implemented for 2D.
     *
     * @param {( number[] | number)} node
     */
    Viewer3D.prototype.hide = function (node) {
        Logger.track({ name: 'hide', aggregate: 'count' });

        this.impl.visibilityManager.hide(node);
    };

    /**
     * @deprecated Use hide() instead.
     *
     * Not yet implemented for 2D.
     *
     * @param nodeId
     */
    Viewer3D.prototype.hideById = function (nodeId) {
        this.hide(nodeId);
    };

    /**
     * Ensures the passed in dbid / ids are shown.
     *
     * Not yet implemented for 2D.
     *
     * @param {( number[] | number)} node
     */
    Viewer3D.prototype.show = function (node) {
        this.impl.visibilityManager.show(node);
    };

    /**
     * Ensures everything is visible. Clears all node isolation (3D) and turns on all layers (2D).
     */
    Viewer3D.prototype.showAll = function () {
        this.impl.visibilityManager.isolate();
        if (this.model.is2d()) {
            this.setLayerVisible(null, true);
        }

        Logger.track({ name: 'showall', aggregate: 'count' });
    };


    /**
     * Toggles the visibility of the given node.
     *
     * Not yet implemented for 2D.
     *
     * @param {( number)} node
     */
    Viewer3D.prototype.toggleVisibility = function (node) {
        this.impl.visibilityManager.toggleVisibility(node);
    };

    /**
     * Returns true if every node is visible.
     * @returns {boolean}
     */
    Viewer3D.prototype.areAllVisible = function () {
        return this.impl.isWholeModelVisible(this.model);
    };

    /**
     * Explodes the model from the center of gravity.
     *
     * Not applicable to 2D.
     *
     * @param {number} scale - a value from 0.0-1.0 to indicate how much to explode.
     */
    Viewer3D.prototype.explode = function (scale) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.explode is not applicable to 2D");
            return;
        }

        Logger.track({ name: 'explode_count', aggregate: 'count' });

        this.impl.explode(scale);
    };

    /**
     * Returns the explode scale
     *
     * Not applicable to 2D.
     *
     * @returns {number} - a value from 0.0-1.0 indicating how exploded the model is.
     */
    Viewer3D.prototype.getExplodeScale = function () {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.getExplodeScale is not applicable to 2D");
            return 0;
        }

        return this.impl.getExplodeScale();
    };


    /**
     * Enables or disables the high quality rendering settings.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} useSAO - true or false to enable screen space ambient occlusion.
     * @param {boolean} useFXAA - true or false to enable fast approximate anti-aliasing.
     */
    Viewer3D.prototype.setQualityLevel = function (useSAO, useFXAA) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setQualityLevel is not applicable to 2D");
            return;
        }

        this.prefs.set('ambientShadows', useSAO);
        this.prefs.set('antialiasing', useFXAA);
        this.impl.togglePostProcess(useSAO, useFXAA);
    };


    /**
     * Toggles ghosting during search and isolate.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether ghosting is on or off
     */
    Viewer3D.prototype.setGhosting = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGhosting is not applicable to 2D");
            return;
        }

        this.prefs.set('ghosting', value);
        this.impl.toggleGhosting(value);
    };

    /**
     * Toggles ground shadow.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether shadow is on or off
     */
    Viewer3D.prototype.setGroundShadow = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundShadow is not applicable to 2D");
            return;
        }

        this.prefs.set('groundShadow', value);
        this.impl.toggleGroundShadow(value);
    };

    /**
     * Toggles ground reflection.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether reflection is on or off
     */
    Viewer3D.prototype.setGroundReflection = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundReflection is not applicable to 2D");
            return;
        }

        this.prefs.set('groundReflection', value);
        this.impl.toggleGroundReflection(value);
    };

    /**
     * Toggles environment map for background.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether environment map for background is on or off
     */
    Viewer3D.prototype.setEnvMapBackground = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setEnvMapBackground is not applicable to 2D");
            return;
        }

        this.prefs.set('envMapBackground', value);
        this.impl.toggleEnvMapBackground(value);
    };

    /**
     * Toggles Prism Material rendering.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether Prism Material rendering is on or off
     */
    Viewer3D.prototype.setRenderPrism = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setRenderPrism is not applicable to 2D");
            return;
        }

        this.prefs.set('renderPrism', value);
        this.impl.toggleRenderPrism(value);
    };

    /**
     * Toggles first person tool popup.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value is indicating whether first person tool popup is showed or not
     */
    Viewer3D.prototype.setFirstPersonToolPopup = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setFirstPersonToolPopup is not applicable to 2D");
            return;
        }

        this.prefs.set('firstPersonToolPopup', value);
    };

    /**
     * Returns the state of first person tool popup
     *
     * Not applicable to 2D.
     *
     * @returns {boolean} - value is indicating whether first person tool popup is showed or not
     */
    Viewer3D.prototype.getFirstPersonToolPopup = function () {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.getFirstPersonToolPopup is not applicable to 2D");
            return;
        }

        return this.prefs.firstPersonToolPopup;
    };

    /**
     * Toggles whether progressive rendering is used. Warning: turning progressive rendering off
     * will have serious performance implications.
     * @param {boolean} value whether it is on or off
     */
    Viewer3D.prototype.setProgressiveRendering = function (value) {
        this.prefs.set('progressiveRendering', value);
        this.impl.toggleProgressive(value);
    };

    /**
     * AutoCAD drawings are commonly displayed with white lines on a black background. Setting reverse swaps (just)
     * these two colors.
     * @param {boolean} value whether it is on or off
     */
    Viewer3D.prototype.setSwapBlackAndWhite = function (value) {
        this.prefs.set('swapBlackAndWhite', value);
        this.impl.toggleSwapBlackAndWhite(value);
    };

    /**
     * Toggles whether the navigation should be optimized for performance. If set
     * to true, anti-aliasing and ambient shadows will be off while navigating.
     *
     * Not applicable to 2D.
     *
     * @param {boolean} value whether it is on or off
     */
    Viewer3D.prototype.setOptimizeNavigation = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setOptimizeNaviation is not applicable to 2D");
            return;
        }

        this.prefs.set('optimizeNavigation', value);
        this.impl.setOptimizeNavigation(value);
    };

    /**
     * Locks or unlocks navigation controls.
     *
     * When navigation is locked, certain operations (for example, orbit, pan, or fit-to-view)
     * are disabled.
     *
     * @param {boolean} value True if the navigation should be locked.
     *
     * @see {@link Autodesk.Viewing.Viewer3D#setNavigationLockSettings}
     */
    Viewer3D.prototype.setNavigationLock = function (value) {
        if (this.navigation.getIsLocked() !== value) {
            this.navigation.setIsLocked(value);
            this.fireEvent({ type: Navigation_MODE_CHANGED_EVENT, id: this.getActiveNavigationTool() });
        }
    };

    /**
     * Gets the current state of the navigation lock.
     * @returns {boolean} True if the navigation controls are currently locked.
     */
    Viewer3D.prototype.getNavigationLock = function () {
        return this.navigation.getIsLocked();
    };

    /**
     * Updates the configuration of the navigation lock,
     * i.e., which actions are available when navigation is locked.
     *
     * The configurable actions are 'orbit', 'pan', 'zoom', 'roll', 'fov', 'walk', or 'gotoview'.
     * By default, none of the actions are enabled when the navigation is locked.
     *
     * @param {object} settings Map of <action>:<boolean> pairs specifying
     * whether the given action is *enabled* even when the navigation is locked.
     *
     * @see {@link Autodesk.Viewing.Viewer3D#setNavigationLock}
     */
    Viewer3D.prototype.setNavigationLockSettings = function (settings) {
        this.navigation.setLockSettings(settings);
        this.fireEvent({ type: Navigation_MODE_CHANGED_EVENT, id: this.getActiveNavigationTool() });
    };

    /**
     * Gets the current configuration of the navigation lock.
     *  @returns {object} Map of <action>:<boolean> pairs specifying
     * whether the given action is *enabled* even when the navigation is locked.
     */
    Viewer3D.prototype.getNavigationLockSettings = function () {
        return this.navigation.getLockSettings();
    };

    /**
     * Swaps the current navigation tool for the tool with the provided name.
     * Will trigger NAVIGATION_MODE_CHANGED event if the mode actually changes.
     *
     * @param {string} [toolName] - The name of the tool to activate. By default it will switch to the default tool.
     *
     * @returns {boolean} - True if the tool was set successfully. False otherwise.
     *
     * @see {@link Viewer3D#getActiveNavigationTool|getActiveNavigationTool()}
     */
    Viewer3D.prototype.setActiveNavigationTool = function (toolName) {
        if (toolName === this._pushedTool || (!toolName && !this._pushedTool))
            return true;

        if (this._pushedTool) {
            if (!this.impl.controls.deactivateTool(this._pushedTool)) {
                return false;
            }

            // Need to reset the activeName of the default tool, since "orbit",
            // "freeorbit", "dolly" and "pan" share the same instance.
            this.impl.controls.setToolActiveName(this.getDefaultNavigationToolName());
            this._pushedTool = null;
        }

        var isDefault = !toolName || toolName === this.getDefaultNavigationToolName();

        if (isDefault && this._pushedTool === null) {
            this.fireEvent({ type: Navigation_MODE_CHANGED_EVENT, id: this.getDefaultNavigationToolName() });
            return true;
        }

        if (this.impl.controls.activateTool(toolName)) {
            this._pushedTool = toolName;
            this.fireEvent({ type: Navigation_MODE_CHANGED_EVENT, id: this._pushedTool });
            return true;
        }

        return false;
    };

    /**
     * Returns the name of the active navigation tool.
     * @returns {string} - The tool's name.
     *
     * @see {@link Viewer3D#setActiveNavigationTool|setActiveNavigationTool()}
     */
    Viewer3D.prototype.getActiveNavigationTool = function () {
        return this._pushedTool ? this._pushedTool : this._defaultNavigationTool;
    };

    /**
     * Sets the default navigation tool. This tool will always sit beneath the navigation tool on the tool stack.
     *
     * @param {string} toolName - The name of the new default navigation tool.
     */
    Viewer3D.prototype.setDefaultNavigationTool = function (toolName) {
        if (this._defaultNavigationTool) {
            this.impl.controls.deactivateTool(this._defaultNavigationTool);
        }

        if (this._pushedTool) {
            this.impl.controls.deactivateTool(this._pushedTool);
        }

        this.impl.controls.activateTool(toolName);
        this._defaultNavigationTool = toolName;

        if (this._pushedTool) {
            this.impl.controls.activateTool(this._pushedTool);
        }
    };

    /**
     * Returns the default navigation tool
     *
     * @returns {Object} - The default navigation tool.
     */
    Viewer3D.prototype.getDefaultNavigationToolName = function () {
        return this._defaultNavigationTool;
    };

    /**
     * Gets the current camera vertical field of view.
     * @returns { number } - the field of view in degrees.
     */
    Viewer3D.prototype.getFOV = function () {
        return this.navigation.getVerticalFov();
    };

    /**
     * Sets the current cameras vertical field of view.
     * @param { number } degrees - Field of view in degrees.
     */
    Viewer3D.prototype.setFOV = function (degrees) {
        this.navigation.setVerticalFov(degrees, true);
    };

    /**
     * Gets the current camera focal length.
     * @returns { number } - the focal length in millimetres.
     */
    Viewer3D.prototype.getFocalLength = function () {
        return this.navigation.getFocalLength();
    };

    /**
     * Sets the current cameras focal length.
     * @param { number } mm - Focal length in millimetres
     */
    Viewer3D.prototype.setFocalLength = function (mm) {
        this.navigation.setFocalLength(mm, true);
    };

    /**
     * Hides all lines in the scene.
     * @param {boolean} hide
     */
    Viewer3D.prototype.hideLines = function (hide) {
        this.prefs.set('lineRendering', !hide);
        var that = this;

        function onGeometryLoaded() {
            that.impl.hideLines(hide);
            that.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
        }

        if (!this.impl.hideLines(hide)) {
            this.addEventListener(EventType.GEOMETRY_LOADED_EVENT, onGeometryLoaded);
        }
    };

    /**
     * @deprecated
     * Applies the camera to the current viewer's camera.
     * @param {THREE.Camera} camera - the camera to apply.
     * @param {boolean} [fit=false] - Do a fit to view after transition.
     */
    Viewer3D.prototype.applyCamera = function (camera, fit) {
        this.impl.setViewFromCamera(camera, true);
        if (fit)
            this.fitToView();
    };

    /**
     * Fits camera to objects by ID - Fits entire model if no id is provided.
     * @param {array| int} [objectIds] array of Ids, or null.
     */
    Viewer3D.prototype.fitToView = function (objectIds) {

        var that = this;
        var instant = true;
        var model = that.model;

        var fit = function () {
            var fitTo = null;
            if (Array.isArray(objectIds) && (objectIds.length > 0)) {
                var bounds = new THREE.Box3();
                var box = new THREE.Box3();

                var instanceTree = model.getData().instanceTree;
                var fragList = model.getFragmentList();

                for (var i = 0; i < objectIds.length; i++) {
                    instanceTree.enumNodeFragments(objectIds[i], function (fragId) {
                        fragList.getWorldBounds(fragId, box);
                        bounds.union(box);
                    }, true);
                }

                if (!bounds.empty())
                    fitTo = bounds;
            }
            if (!fitTo || fitTo.empty())
                fitTo = that.impl.getFitBounds();

            that.navigation.fitBounds(false, fitTo);

            that.removeEventListener(EventType.OBJECT_TREE_CREATED_EVENT, checkGeomAndFit);
            that.removeEventListener(EventType.GEOMETRY_LOADED_EVENT, fit);

            return instant;
        };

        var checkGeomAndFit = function () {
            if (model && model.isLoadDone()) {
                fit();
            } else {
                instant = false;
                that.addEventListener(EventType.GEOMETRY_LOADED_EVENT, fit);
            }
        };

        var propertyDB = model.getData().propertydb,
            propertyDBFileExists = propertyDB && propertyDB.attrs.length > 0;

        Logger.track({ name: 'fittoview', aggregate: 'count' });

        // This doesn't guarantee that an object tree will be created but it will be pretty likely
        if (!model.is2d() && propertyDBFileExists && objectIds !== null && objectIds !== undefined) {

            if (model && model.isObjectTreeCreated()) {
                checkGeomAndFit();
            } else {
                instant = false;
                this.addEventListener(EventType.OBJECT_TREE_CREATED_EVENT, checkGeomAndFit);
            }
        } else {
            // Fallback, fit to the model bounds
            this.navigation.fitBounds(false, this.impl.getFitBounds(true));
        }
    };

    /**
     * Modifies a click action configuration entry.
     * @param {string} what - which click config to modify (one of "click", "clickAlt", "clickCtrl", "clickShift", "clickCtrlShift").
     * @param {string} where - hit location selector (one of "onObject", "offObject").
     * @param {Array|string} newAction - action list (containing any of "setCOI", "selectOnly", "selectToggle", "deselectAll", "deselectAll", "isolate", "showAll", "hide", "focus").
     * @returns {boolean} False if specified entry is not found, otherwise true.
     */
    Viewer3D.prototype.setClickConfig = function (what, where, newAction) {
        var config = this.clickHandler ? this.clickHandler.getClickBehavior()
            : this.impl.controls.getClickBehavior();

        if (what in config) {
            var actions = config[what];
            if (where in actions) {
                actions[where] = newAction;
                return true;
            }
        }
        return false;
    };

    /**
     * Fetch a click action configuration entry.
     * @param {string} what - which click config to fetch (one of "click", "clickAlt", "clickCtrl", "clickShift", "clickCtrlShift").
     * @param {string} where - hit location selector (one of "onObject", "offObject").
     * @returns {Array} action list for the given entry or null if not found.
     */
    Viewer3D.prototype.getClickConfig = function (what, where) {
        var config = this.clickHandler ? this.clickHandler.getClickBehavior()
            : this.impl.controls.getClickBehavior();

        if (what in config) {
            var actions = config[what];
            if (where in actions)
                return actions[where];
        }
        return null;
    };

    /**
     * Modify the default click behaviour for the viewer.
     * @param {boolean} state - If true the default is to set the center of interest. If false the default is single select.
     * @param {boolean} [updatePrefs=true] - If true, the user preferences will be updated.
     */
    Viewer3D.prototype.setClickToSetCOI = function (state, updatePrefs) {
        if (updatePrefs !== false)
            this.prefs.set('clickToSetCOI', state);

        var currentOn = this.getClickConfig("click", "onObject");
        if (state) {
            if (currentOn.indexOf("setCOI") === -1) // Not already set?
            {
                this.setClickConfig("click", "onObject", ["setCOI"]);
            }
        }
        else if (currentOn.indexOf("setCOI") >= 0) // Is currently set?
        {
            this.setClickConfig("click", "onObject", ["selectOnly"]);
        }
    };


    /**
     * Initializes all gui settings to their defaults or to the session stored setting
     * This gives session stored settings priority
     */
    Viewer3D.prototype.initSettings = function () {

        this.prefs.load(Global.DefaultSettings);

        this.prefs.tag('3d');
        this.prefs.tag('2d');
        this.prefs.untag('2d', [ // 3d only
            'viewCube',
            'alwaysUsePivot',
            'zoomTowardsPivot',
            'reverseHorizontalLookDirection',
            'reverseVerticalLookDirection',
            'orbitPastWorldPoles',
            'clickToSetCOI',
            'ghosting',
            'optimizeNavigation',
            'ambientShadows',
            'antialiasing',
            'groundShadow',
            'groundReflection',
            'lineRendering',
            'lightPreset',
            'envMapBackground',
            'renderPrism',
            'firstPersonToolPopup'
        ]);

        // Apply settings
        this.setQualityLevel(this.prefs.ambientShadows, this.prefs.antialiasing);
        this.setGroundShadow(this.prefs.groundShadow);
        this.setGroundReflection(this.prefs.groundReflection);
        this.setGhosting(this.prefs.ghosting);
        this.setProgressiveRendering(this.prefs.progressiveRendering);
        this.setSwapBlackAndWhite(this.prefs.swapBlackAndWhite);
        this.setClickToSetCOI(this.prefs.clickToSetCOI);
        this.setOptimizeNavigation(this.prefs.optimizeNavigation);
        this.hideLines(!this.prefs.lineRendering);
        this.setEnvMapBackground(this.prefs.envMapBackground);
        this.setRenderPrism(this.prefs.renderPrism);
        this.setFirstPersonToolPopup(this.prefs.firstPersonToolPopup);

        this.navigation.setUsePivotAlways(this.prefs.alwaysUsePivot);
        this.navigation.setReverseZoomDirection(this.prefs.reverseMouseZoomDir);
        this.navigation.setReverseHorizontalLookDirection(this.prefs.reverseHorizontalLookDirection);
        this.navigation.setReverseVerticalLookDirection(this.prefs.reverseVerticalLookDirection);
        this.navigation.setZoomTowardsPivot(this.prefs.zoomTowardsPivot);
        this.navigation.setOrbitPastWorldPoles(this.prefs.orbitPastWorldPoles);
        this.navigation.setUseLeftHandedInput(this.prefs.leftHandedMouseSetup);

        var bacStr = this.prefs.backgroundColorPreset;
        if (bacStr) {
            try {
                var bac = JSON.parse(bacStr);
                this.impl.setClearColors(bac[0], bac[1], bac[2], bac[3], bac[4], bac[5]);
            } catch (e) {
                this.prefs.set("backgroundColorPreset", null);
            }
        }

        var lightPreset = /*viewer.model.is2d() ? avp.DefaultLightPreset2d :*/ this.prefs.lightPreset;
        this.impl.setLightPreset(lightPreset);
    };

    /**
     * Sets the Light Presets (Environments) for the Viewer.
     *
     * Not applicable to 2D.
     *
     * Sets the preference in the UI
     * @param {Number} index - where
     * - 0 Simple Grey
     * - 1 Sharp Highlights
     * - 2 Dark Sky
     * - 3 Grey Room
     * - 4 Photo Booth
     * - 5 Tranquility
     * - 6 Infinity Pool
     * - 7 Simple White
     * - 8 Riverbank
     * - 9 Contrast
     * - 10 Rim Highlights
     * - 11 Cool Light
     * - 12 Warm Light
     * - 13 Soft Light
     * - 14 Grid Light
     * - 15 Plaza
     * - 16 Snow Field
     * @note this list is copied from the ones in Environments.js
     */

    Viewer3D.prototype.setLightPreset = function (index) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setLightPreset is not applicable to 2D");
            return;
        }

        this.prefs.set('lightPreset', index);

        this.impl.setLightPreset(index);
    };

    /**
     *  Set or unset a view navigation option which requests that orbit controls always orbit around the currently set pivot point.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true to request use of the pivot point. When false some controls may pivot around the center of the view. (Currently applies only to the view-cube orbit controls.)
     */
    Viewer3D.prototype.setUsePivotAlways = function (value) {
        this.prefs.set('alwaysUsePivot', value);
        this.navigation.setUsePivotAlways(value);
    };

    /**
     * Set or unset a view navigation option to reverse the default direction for camera dolly (zoom) operations.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true for reverse, false for default
     */
    Viewer3D.prototype.setReverseZoomDirection = function (value) {
        this.prefs.set('reverseMouseZoomDir', value);
        this.navigation.setReverseZoomDirection(value);
    };

    /**
     * Set or unset a view navigation option to reverse the default direction for horizontal look operations.
     *
     * Not applicable to 2D.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true for reverse, false for default
     */
    Viewer3D.prototype.setReverseHorizontalLookDirection = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setReverseHorizontalLookDirection is not applicable to 2D");
            return;
        }

        this.prefs.set('reverseHorizontalLookDirection', value);
        this.navigation.setReverseHorizontalLookDirection(value);
    };

    /**
     * Set or unset a view navigation option to reverse the default direction for vertical look operations.
     *
     * Not applicable to 2D.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true for reverse, false for default
     */
    Viewer3D.prototype.setReverseVerticalLookDirection = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setReverseVerticalLookDirection is not applicable to 2D");
            return;
        }

        this.prefs.set('reverseVerticalLookDirection', value);
        this.navigation.setReverseVerticalLookDirection(value);
    };

    /**
     * Get the state of the view navigation option that requests the default direction for camera dolly (zoom) operations to be towards the camera pivot point.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true for towards the pivot, false for default
     */
    Viewer3D.prototype.setZoomTowardsPivot = function (value) {
        this.prefs.set('zoomTowardsPivot', value);
        this.navigation.setZoomTowardsPivot(value);
    };

    /**
     * Set or unset a view navigation option to allow the orbit controls to move the camera beyond the north and south poles (world up/down direction). In other words, when set the orbit control will allow the camera to rotate into an upside down orientation. When unset orbit navigation should stop when the camera view direction reaches the up/down direction.
     *
     * Not applicable to 2D.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true to allow orbiting past the poles.
     */
    Viewer3D.prototype.setOrbitPastWorldPoles = function (value) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setOrbitPastWorldPoles is not applicable to 2D");
            return;
        }

        this.prefs.set('orbitPastWorldPoles', value);
        this.navigation.setOrbitPastWorldPoles(value);
    };

    /**
     * Set or unset a view navigation option which requests that mouse buttons be reversed from their default assignment. i.e. Left mouse operation becomes right mouse and vice versa.
     *
     *  Sets the preference in the UI
     *  @param {boolean} value - value of the option, true to request reversal of mouse button assignments.
     */
    Viewer3D.prototype.setUseLeftHandedInput = function (value) {
        this.prefs.set('leftHandedMouseSetup', value);
        this.navigation.setUseLeftHandedInput(value);
    };

    /**
     * Set visibility for a single layer, or for all layers.
     *
     * Not yet implemented for 3D.
     *
     * @param {?Array} nodes - An array of layer nodes, or a single layer node, or null for all layers
     * @param {boolean} visible - true to show the layer, false to hide it
     * @param {boolean=} [isolate] - true to isolate the layer
     */
    Viewer3D.prototype.setLayerVisible = function (nodes, visible, isolate) {
        if (this.model && !this.model.is2d()) {
            Logger.warn("Viewer3D.setLayerVisible is not yet implemented for 3D");
            return;
        }

        var that = this;

        function getLayerIndexes(node, visible) {
            var layerIndexes = [];

            if (node.isLayer) {
                layerIndexes.push(node.index);
            } else {
                var children = node.children;
                for (var i = 0; i < children.length; ++i) {
                    layerIndexes = layerIndexes.concat(getLayerIndexes(children[i]));
                }
            }

            return layerIndexes;
        }

        var layersRoot = that.model.getLayersRoot();
        if (!layersRoot || 0 === layersRoot.childCount) {
            return;
        }

        if (nodes === null) {
            nodes = [layersRoot];
        }
        if (!Array.isArray(nodes)) {
            nodes = [nodes];
        }

        if (isolate) {
            that.impl.setLayerVisible(getLayerIndexes(layersRoot), false);
            visible = true; // force this because isolate + not visible doesn't make sense
        }

        var layerIndexes = [];
        for (var i = 0; i < nodes.length; ++i) {
            layerIndexes = layerIndexes.concat(getLayerIndexes(nodes[i]));
        }
        that.impl.setLayerVisible(layerIndexes, visible);
        that.fireEvent({ type: EventType.LAYER_VISIBILITY_CHANGED_EVENT });
    };

    /**
     * Returns true if the layer is visible.
     *
     * Not yet implemented for 3D.
     *
     * @param {Object} node - Layer node
     * @returns {boolean} true if the layer is visible
     */
    Viewer3D.prototype.isLayerVisible = function (node) {
        if (this.model && !this.model.is2d()) {
            Logger.warn("Viewer3D.isLayerVisible is not yet implemented for 3D");
            return false;
        }

        return !!(node && node.isLayer && this.impl.isLayerVisible(node.index));
    };

    /**
     * Returns true if any layer is hidden.
     *
     * Not yet implemented for 3D.
     *
     * @returns {boolean} true if any layer is hidden
     */
    Viewer3D.prototype.anyLayerHidden = function () {
        if (this.model && !this.model.is2d()) {
            Logger.warn("Viewer3D.anyLayerHidden is not yet implemented for 3D");
            return false;
        }

        var that = this;

        function anyLayerHidden(node) {
            if (node.isLayer) {
                return !that.impl.isLayerVisible(node.index);
            } else {
                var children = node.children;
                for (var i = 0; i < children.length; ++i) {
                    if (anyLayerHidden(children[i])) {
                        return true;
                    }
                }
            }
            return false;
        }

        var layersRoot = that.model.getLayersRoot();
        return !!(layersRoot && anyLayerHidden(layersRoot));
    };

    /**
     * If enabled, set ground shadow color
     *
     * Not applicable to 2D
     *
     * @param {THREE.Color} color
     */
    Viewer3D.prototype.setGroundShadowColor = function (color) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundShadowColor is not applicable to 2D");
            return;
        }

        this.impl.setGroundShadowColor(color);
    };

    /**
     * If enabled, set ground shadow alpha
     *
     * Not applicable to 2D
     *
     * @param {float} alpha
     */
    Viewer3D.prototype.setGroundShadowAlpha = function (alpha) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundShadowAlpha is not applicable to 2D");
            return;
        }

        this.impl.setGroundShadowAlpha(alpha);
    };

    /**
     * If enabled, set ground reflection color. This is reset to default when reflections toggled off.
     *
     * Not applicable to 2D
     *
     * @param {THREE.Color} color
     */
    Viewer3D.prototype.setGroundReflectionColor = function (color) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundReflectionColor is not applicable to 2D");
            return;
        }

        this.impl.setGroundReflectionColor(color);
    };

    /**
     * If enabled, set ground reflection alpha. This is reset to default when reflections toggled off.
     *
     * Not applicable to 2D
     *
     * @param {float} alpha
     */
    Viewer3D.prototype.setGroundReflectionAlpha = function (alpha) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.setGroundReflectionAlpha is not applicable to 2D");
            return;
        }

        this.impl.setGroundReflectionAlpha(alpha);
    };

    /**
     * Returns a list of active cut planes
     *
     * Not applicable to 2D
     *
     * @return {THREE.Vector4[]} List of Vector4 plane representation {x:a, y:b, z:c, w:d}
     */
    Viewer3D.prototype.getCutPlanes = function () {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.getCutPlanes is not applicable to 2D");
            return [];
        }

        return this.impl.getCutPlanes();
    };

    /**
     * Apply a list of cut planes
     *
     * Not applicable to 2D
     *
     * @param {THREE.Vector4[]} planes - List of Vector4 plane representation: {x:a, y:b, z:c, w:d}
     * Plane general equation: ax + by + cz + d = 0 where a, b, and c are not all zero
     * Passing an empty list or null is equivalent to setting zero cut planes
     */
    Viewer3D.prototype.setCutPlanes = function (planes) {
        if (this.model && this.model.is2d()) {
            Logger.warn("Viewer3D.getCutPlanes is not applicable to 2D");
            return;
        }

        this.impl.setCutPlanes(planes);
    };

    /**
     * Captures the current screen image as Blob URL
     * Blob URL can be used like a regular image url (e.g., window.open, img.src, etc)
     * If no parameters are given, returns an image as Blob URL, with dimensions equal to current canvas dimensions
     * If width and height are given, returns asynchronously and calls the callback with the resized image as Blob URL
     * If no callback is given, displays the image in a new window.<br>
     * See also [getScreenShotBuffer()]{@link Autodesk.Viewing.Viewer3D#getScreenShotBuffer}.
     * @param  {int}      [w]  width of the requested image
     * @param  {int}      [h]  height of the requested image
     * @param  {Function} [cb] callback
     * @return {DOMString}     screenshot image Blob URL, if no parameters are given
     */
    Viewer3D.prototype.getScreenShot = function (w, h, cb) {
        return this.impl.getScreenShot(w, h, cb);
    };

    /**
     * Alternative call to [getScreenShot()]{@link Autodesk.Viewing.Viewer3D#getScreenShot}
     * which internally uses additional steps (more processing) to generate the screenshot.
     * @param  {int}      [w]  width of the requested image
     * @param  {int}      [h]  height of the requested image
     * @param  {Function} [cb] callback
     */
    Viewer3D.prototype.getScreenShotBuffer = function (w, h, cb) {
        return this.impl.getScreenShotBuffer(w, h, cb);
    };

    /**
     * Sets the object context menu.
     * @param {?ObjectContextMenu=} [contextMenu]
     */
    Viewer3D.prototype.setContextMenu = function (contextMenu) {

        if (this.contextMenu) {

            // Hide the current context menu, just in case it's open right now.
            // This does nothing if the context menu is not open.
            //
            this.contextMenu.hide();
        }

        this.contextMenu = contextMenu || null; // to avoid undefined
    };

    /**
     * Activates the default context menu.<br>
     * Contains options Isolate, Hide selected, Show all objects, Focus and Clear selection.
     *
     * @returns {boolean} Whether the default context menu was successfully set (true) or not (false)
     */
    Viewer3D.prototype.setDefaultContextMenu = function () {

        if (ViewerObjectContextMenu) {
            this.setContextMenu(new ViewerObjectContextMenu(this));
            return true;
        }
        return false;
    };

    Viewer3D.prototype.triggerContextMenu = function (event) {
        if (this.config && this.config.onTriggerContextMenuCallback) {
            this.config.onTriggerContextMenuCallback(event);
        }

        if (this.contextMenu) {
            this.contextMenu.show(event);
            return true;
        }
        return false;
    };

    Viewer3D.prototype.triggerSelectionChanged = function (dbId) {
        if (this.config && this.config.onTriggerSelectionChangedCallback) {
            this.config.onTriggerSelectionChangedCallback(dbId);
        }
    };

    Viewer3D.prototype.triggerDoubleTapCallback = function (event) {
        if (this.config && this.config.onTriggerDoubleTapCallback) {
            this.config.onTriggerDoubleTapCallback(event);
        }
    }

    Viewer3D.prototype.triggerSingleTapCallback = function (event) {
        if (this.config && this.config.onTriggerSingleTapCallback) {
            this.config.onTriggerSingleTapCallback(event);
        }
    }

    Viewer3D.prototype.initContextMenu = function () {

        // Disable the browser's default context menu by default, or if explicitly specified.
        //
        var disableBrowserContextMenu = !this.config || (this.config.hasOwnProperty("disableBrowserContextMenu") ? this.config.disableBrowserContextMenu : true);
        if (disableBrowserContextMenu) {
            this.onDefaultContextMenu = function (e) {
                e.preventDefault();
            };
            this.container.addEventListener('contextmenu', this.onDefaultContextMenu, false);
        }

        var self = this;

        function isRightClick(event) {
            var button = event.button;

            // Check for Firefox spoof: Control+LMB converted to RMB.
            // The "buttons" property in Firefox will include 1 for LMB and 2 for RMB.
            if ("buttons" in event) {
                // For button down the 1 bit will be on indicating LMB.
                // For button up it's off so check the flag to see if we
                // switched the down event.
                if (self.__firefoxLMBfix && !(event.buttons & 1)) { // Button up?
                    self.__firefoxLMBfix = false;
                    button = 0;
                    // Logger.log("FIREFOX UP!!!");
                }
                else if ((button === 2) && (event.buttons & 1)) {
                    button = 0;    // Convert back to reality.
                    self.__firefoxLMBfix = true;
                    // Logger.log("FIREFOX SUX!!!");
                }
            }

            var useLeftHandedInput = self.navigation ? self.navigation.getUseLeftHandedInput() : false;
            var rightButton = useLeftHandedInput ? 0 : 2;

            if (button === rightButton)
                return true;

            /* See SPK-930 and SPK-928
             var isMac = (navigator.userAgent.search("Mac OS") !== -1);
             var leftButton = (rightButton === 2) ? 0 : 2;
             return isMac && event.ctrlKey && (event.button === leftButton);
             */
            return false;
        }

        var canvas = this.canvas || this.container;

        canvas.addEventListener('mousedown',
            function (event) {
                if (isRightClick(event)) {
                    self.startX = event.clientX;
                    self.startY = event.clientY;
                }
            });

        canvas.addEventListener('mouseup',
            function (event) {
                if (isRightClick(event) && event.clientX === self.startX && event.clientY === self.startY) {
                    self.triggerContextMenu(event);
                }
                return true;
            }, false);
    };


    /**
     * Registers a new callback that modifies the context menu.
     * This allows extensions and others to add, remove, or change items in the context menu.
     * Extensions that call registerContextMenuCallback() should call unregisterContextMenuCallback() in their unload().
     * @param {string} id - Unique id to identify this callback. Used by unregisterContextMenuCallback().
     * @param {function(Array, Object)} callback - Will be called before the context menu is displayed.
     * @see Viewer.unregisterContextMenuCallback
     * @see ObjectContextMenu.buildMenu
     *
     * @example
     * // Here's an example that appends a new context menu item:
     *
     * viewer.registerContextMenuCallback('MyExtensionName', function (menu, status) {
 *     if (status.hasSelected) {
 *         menu.push({
 *             title: 'My new context menu item with selected objects',
 *             target: function () {
 *                 alert('Do something with selected objects');
 *         });
 *     } else {
 *         menu.push({
 *             title: 'My new context menu item, no selected objects',
 *             target: function () {
 *                 alert('Do something else');
 *         });
 *     }
 * });
 */
    Viewer3D.prototype.registerContextMenuCallback = function (id, callback) {
        this.contextMenuCallbacks[id] = callback;
    };

    /**
     * Unregisters an existing callback that modifies the context menu.
     * Extensions that call registerContextMenuCallback() should call unregisterContextMenuCallback() in their unload().
     * @param {string} id - Unique id to identify this callback.
     * @returns {boolean} true if the callback was unregistered successfully.
     * @see Viewer.registerContextMenuCallback
     */
    Viewer3D.prototype.unregisterContextMenuCallback = function (id) {
        if (id in this.contextMenuCallbacks) {
            delete this.contextMenuCallbacks[id];
            return true;
        }
        return false;
    };

    /**
     * Runs all registered context menu callbacks.
     * @param {Array} menu - Context menu items.
     * @param {Object} status - Information about nodes.
     * @see ObjectContextMenu.buildMenu
     * @private
     */
    Viewer3D.prototype.runContextMenuCallbacks = function (menu, status) {
        for (var id in this.contextMenuCallbacks) {
            if (this.contextMenuCallbacks.hasOwnProperty(id)) {
                this.contextMenuCallbacks[id](menu, status);
            }
        }
    };

    /**
     * Play animation if animation data is available as part of model data.
     * If the model data does not contain any animation, this function call is a no op.
     * @param  {Function} [callback] Callback function that would be invoked at each frame of the animation.
     * The callback function takes a single input value, with value range between 0 and 100, inclusive, with value
     * 100 indicates the animation has finished playing.
     * @example
     * Here is an example of callback function.
     * function(value) {
     *     if (value < 100)
     *         console.log("Animation progress: " + value + "%.");
     *     else
     *         console.log("Animation finished.");
     * }
     */
    Viewer3D.prototype.playAnimation = function (callback) {
        var animator = this.impl.keyFrameAnimator;
        if (animator) {
            animator.play(0, callback);
        }
    };

    /**
     * Join a live review session.
     *
     * @param {string} [sessionId] - The live review session id to join.
     */
    Viewer3D.prototype.joinLiveReview = function (sessionId) {
        if (!this.liveReviewClient) {
            this.liveReviewClient = new LiveReviewClient(this);
        }

        var liveReviewClient = this.liveReviewClient;
        loadDependency("lmv_io", "socket.io-1.3.5.js", function () {
            liveReviewClient.joinLiveReviewSession(sessionId);
        });
    };

    /**
     * Leave a live review session.
     */
    Viewer3D.prototype.leaveLiveReview = function () {
        if (this.liveReviewClient) {
            this.liveReviewClient.leaveLiveReviewSession();
        }
    };

    /**
    * Returns a map which keys are the attributes names and the values is an object containing the dbIds and corresponding values
    * @param onSuccessCallback
    * @param onErrorCallback
    */
    Viewer3D.prototype.getAttributeToIdMap = function (onSuccessCallback, onErrorCallback) {
        if (this.model) {
            this.model.getAttributeToIdMap(onSuccessCallback, onErrorCallback);
        }
        else {
            if (onErrorCallback)
                onErrorCallback(ErrorCodes.UNKNOWN_FAILURE, "Function getAttributeToIdMap failed");
        }

    };

    /**
     * Set model units
     * @param Model units
     */
    Viewer3D.prototype.setModelUnits = function (modelUnits) {
        if (this.model) {
            this.model.getData().overriddenUnits = modelUnits;
        }
    };

    /**
     * Calculates the pixel position in client space coordinates of a point in world space.<br>
     * See also
     * [clientToWorld()]{@link Autodesk.Viewing.Viewer3D#clientToWorld}.
     * @param {THREE.Vector3} point Point in world space coordinates.
     * @returns {THREE.Vector3} Point transformed and projected into client space coordinates. Z value is 0.
     */
    Viewer3D.prototype.worldToClient = function (point) {
        return this.impl.worldToClient(point);
    };

    /**
     * Given coordinates in pixel screen space it returns information of the underlying geometry node.
     * Hidden nodes will not be taken into account. Returns null if there is no geometry in the specified location.
     * For 2d models, it will return null outside the paper.<br>
     * See also
     * [worldToClient()]{@link Autodesk.Viewing.Viewer3D#worldToClient}.
     *
     * @param {Number} clientX - X coordinate where 0 is left
     * @param {Number} clientY - Y coordinate where 0 is top
     * @param {Boolean} [ignoreTransparent] - Ignores transparent materials
     * @returns {Object|null} contains point attribute. 3d models have additional attributes.
     */
    Viewer3D.prototype.clientToWorld = function (clientX, clientY, ignoreTransparent) {

        return this.impl.clientToWorld(clientX, clientY, ignoreTransparent);
    };

    /**
     * Expose if the model has topology information
     * Only applicable to 3D
     * @returns {boolean} value is indicating whether the model has topology information
     */
    Viewer3D.prototype.modelHasTopology = function () {

        if (this.model && this.model.getData().topology) {
            return true;
        }

        return false;
    };

    /**
     * Changes color of the selection overlay.
     * @example
     *      viewer.setSelectionColor(new THREE.Color(0xFF0000)); // red color
     *
     * @param {THREE.Color} color
     */
    Viewer3D.prototype.setSelectionColor = function (color) {
        this.impl.setSelectionColor(color);
    };

    /**
     * Create ViewCube
     */
    Viewer3D.prototype.createViewCube = function () {

        if (!this.viewCubeUi) {
            this.viewCubeUi = new ViewCubeUi(this);
        }
        this.viewCubeUi.create();
    };

    /**
     * Display ViewCube
     * @param {Boolean} display - display or hide the ViewCube
     */
    Viewer3D.prototype.displayViewCube = function (display) {

        if (this.viewCubeUi) {
            this.viewCubeUi.displayViewCube(display, false);
        }
    };

    /**
     * Set the face of ViewCube and apply camera transformation according to it.
     * @param {string} face - the face name of ViewCube, the name can contain multiple face names,
     * the format should be "[front/back], [top/bottom], [left/right]".
     */
    Viewer3D.prototype.setViewCube = function (face) {

        if (this.viewCubeUi && this.viewCubeUi.cube) {
            this.viewCubeUi.cube.cubeRotateTo(face);
        }
    };

    /** Highlight an object with a theming color that is blended with the original object's material.
     *   @param {number}        dbId
     *   @param {THREE.Vector4} themingColor - (r, g, b, intensity), all in [0,1]
     *   @param [RenderModel]   model        - optional - for multi-model support
     */
    Viewer3D.prototype.setThemingColor = function (dbId, color, model) {
        // use default RenderModel by default
        model = model || this.model;

        model.setThemingColor(dbId, color);

        // we changed the scene to apply theming => trigger re-render
        this.impl.invalidate(true);
    }

    /** Restore original colors for all themed shapes.
     *   @param [RenderModel] model - optional for multi-model support.
     */
    Viewer3D.prototype.clearThemingColors = function (model) {
        // use default RenderModel by default
        model = model || this.model;

        model.clearThemingColors();

        // we changed the scene to apply theming => trigger re-render
        this.impl.invalidate(true);
    }

    return Viewer3D;
});