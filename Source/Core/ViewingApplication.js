define([
    './Constants/EventType',
    './Logger',
    './Document'
], function(EventType, Logger, Document) {
    'use strict';
    /**
     * Attach ViewingApplication to a div by id
     * and initializes common properties of the viewing application
     *
     * @class
     * @alias Autodesk.Viewing.ViewingApplication
     * @param {string} containerId - The id of the main container
     * @param {Object=} [options] - An optional dictionary of options.
     * @param {bool} [options.disableBrowserContextMenu=true] - Disables the browser's default context menu.
     * @constructor
     */
    var ViewingApplication = function (containerId, options) {
        this.appContainerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = options;
        this.myRegisteredViewers = {};
        this.myDocument = null;
        this.myCurrentViewer = null;
        this.urn = null;
        this.selectedItem = null;
        this.bubble = null; // Utility wrapper of the document data

        var self = this;
        this.onHyperlinkHit = function (event) {
            var link = event.data.href;
            var urlRegEx = new RegExp(/^https?:\/\//);

            if (link.match(urlRegEx)) {
                window.open(link);
            } else {
                var nodes = self.bubble.search({ 'viewableID': link });
                if (nodes && nodes.length > 0) {
                    self.selectItem(nodes[0].data);
                }
            }
        };
    };

    /**
     * Defines the 3D viewer type
     */
    ViewingApplication.prototype.k3D = '3D';


    /**
     * Performs any necessary cleanup to allow the object to be garbage collected
     */
    ViewingApplication.prototype.finish = function () {
        if (this.myCurrentViewer) {
            this.myCurrentViewer.finish();
            this.myCurrentViewer = null;
        }
    };

    /**
     * Register a Viewer to be used with this ViewingApplication
     *
     * @param {} viewableType Currently must be ViewingApplication.k3D
     * @param {} viewerClass
     * @param {} config
     */
    ViewingApplication.prototype.registerViewer = function (viewableType, viewerClass, config) {

        if (viewableType !== this.k3D) {
            Logger.error("The only acceptable viewer type is k3D.");
            return;
        }

        // Pass the disableBrowserContextMenu option down to the viewer config.
        //
        config = config || {};
        if (this.options && this.options.hasOwnProperty("disableBrowserContextMenu")) {
            // Don't override if the option was already explicitly specified.
            //
            if (!config.hasOwnProperty("disableBrowserContextMenu")) {
                config.disableBrowserContextMenu = this.options.disableBrowserContextMenu;
            }
        }

        this.myRegisteredViewers[viewableType] = {};
        this.myRegisteredViewers[viewableType].class = viewerClass;
        this.myRegisteredViewers[viewableType].config = config;
    };

    ViewingApplication.prototype.getViewerClass = function (viewableType) {
        return this.myRegisteredViewers.hasOwnProperty(viewableType) ? this.myRegisteredViewers[viewableType].class : null;
    };

    /**
     * Returns the container that will be used by the viewer
     * By default uses the same container as the appContainer
     * This method can be overridden to specify a different
     * sub container for the viewer
     *
     * @return MemberExpression
     */
    ViewingApplication.prototype.getViewerContainer = function () {
        return document.getElementById(this.appContainerId);
    };


    function mergeConfigs(mergedConfig, config) {

        for (var name in config) {
            if (config.hasOwnProperty(name)) {

                var configValue = config[name],
                    configValueIsArray = Array.isArray(configValue),
                    mergedConfigValue = mergedConfig[name],
                    mergedConfigValueIsArray = Array.isArray(mergedConfigValue);

                // If neither config value is an array, then the config value passed to
                // getViewer() overwrites the config value registered for this viewer.
                //
                if (!configValueIsArray || !mergedConfigValueIsArray) {
                    mergedConfig[name] = configValue;

                } else {

                    // But if one or the other config value is an array, then let's
                    // concatenate them. We need to make them both arrays to do that:
                    // they might be null/undefined, or they might be strings.
                    //
                    if (configValue) {
                        if (!configValueIsArray) {
                            configValue = [configValue];
                        }
                    } else {
                        configValue = [];
                    }
                    if (mergedConfigValue) {
                        if (!mergedConfigValueIsArray) {
                            mergedConfigValue = [mergedConfigValue];
                        }
                    } else {
                        mergedConfigValue = [];
                    }
                    mergedConfig[name] = mergedConfigValue.concat(configValue);

                }
            }
        }

    }

    /**
     * Returns a new instance of a Viewer of requested type
     *
     * @param {Object} config - Viewer configuration override.
     * @return Viewer or null
     */
    ViewingApplication.prototype.getViewer = function (config) {

        var registeredViewer = this.myRegisteredViewers[this.k3D];

        if (!registeredViewer)
            return null;

        // Merge the config object provided here with the config object provided
        // when the viewer type was registered. The former takes precedence.
        //
        var mergedConfig = {};
        var registeredViewerConfig = registeredViewer.config;

        mergeConfigs(mergedConfig, registeredViewerConfig);
        mergeConfigs(mergedConfig, config);

        var viewerClass = registeredViewer.class;

        if (this.myCurrentViewer && this.myCurrentViewer.__proto__.constructor === viewerClass) {
            this.myCurrentViewer.tearDown();
            this.myCurrentViewer.setUp(mergedConfig);
            return this.myCurrentViewer;
        }

        this.setCurrentViewer(null);

        // If previous viewer.initialize() failed, then clean it up now.
        // This might happen if, for instance, we had a 3d viewer but
        // WebGL is not supported.
        // TODO: need a better solution
        //
        var container = this.getViewerContainer();
        while (container.hasChildNodes()) {
            container.removeChild(container.lastChild);
        }

        var viewer = new viewerClass(container, mergedConfig);
        this.setCurrentViewer(viewer);
        return viewer;
    };

    /**
     * Sets this ViewingApplication's viewer to the provided viewer
     *
     *  @param {} viewer
     */
    ViewingApplication.prototype.setCurrentViewer = function (viewer) {
        if (this.myCurrentViewer) {
            this.myCurrentViewer.removeEventListener(EventType.HYPERLINK_EVENT, this.onHyperlinkHit);
            this.myCurrentViewer.finish();
        }
        this.myCurrentViewer = viewer;
        if (this.myCurrentViewer) {
            viewer.addEventListener(EventType.HYPERLINK_EVENT, this.onHyperlinkHit);
        }
    };

    /**
     * Returns the currently set Viewer
     *
     *  @return Viewer
     */
    ViewingApplication.prototype.getCurrentViewer = function () {
        return this.myCurrentViewer;
    };

    /**
     * Asynchronously loads the document given its documentId
     * On success: Calls onDocumentLoadedCallback
     * On error: Calls onDocumentFailedToLaod callback
     *
     * @param {} documentId
     * @param {function} [onDocumentLoad]
     * @param {function} [onLoadFailed]
     * @param {dictionary} accessControlProperties - An optional list of key value pairs as access control properties, which includes a list of
     *  access control header name and values, and an OAuth 2.0 access token.
     */
    ViewingApplication.prototype.loadDocument = function (documentId, onDocumentLoad, onLoadFailed, accessControlProperties) {
        var that = this;

        Logger.track({
            category: "load_document",
            urn: (documentId.indexOf("urn:") == 0) ? documentId.substring(4) : documentId
        });

        Document.load(documentId,
            function (document, errorsandwarnings) { // onLoadCallback
                that.myDocument = document;
                that.bubble = new Autodesk.Viewing.BubbleNode(document.myData);
                that.onDocumentLoaded(document, errorsandwarnings);
                if (onDocumentLoad) {
                    onDocumentLoad(document, errorsandwarnings);
                }
            },
            function (errorCode, errorMsg, statusCode, statusText, errors) { // onErrorCallback
                that.onDocumentFailedToLoad(errorMsg, errorCode, errors);
                if (onLoadFailed)
                    onLoadFailed(errorCode, errorMsg, statusCode, statusText, errors);
            },
            accessControlProperties
        );
    };

    /**
     * Default success callback for loadDocument
     * Logs the document that was loaded on console
     *
     * @param {} document
     */
    ViewingApplication.prototype.onDocumentLoaded = function (document, errorsandwarnings) {
        Logger.log(document, errorsandwarnings);
    };

    /**
     * Default success callback for documentFailedToLoad
     * Logs the document that was loaded on console
     *
     * @param {string} errorCode - globalized error code.
     * @param {string} errorMsg  - error message to display
     * @parma {Array}  errors    - list of errors that come from other clients (translators)
     */
    ViewingApplication.prototype.onDocumentFailedToLoad = function (errorCode, errorMsg, errors) {
        Logger.error(errorCode, errorMsg, errors);
    };

    /**
     * Given a list of geometry items, possibly fetched through Autodesk.Viewing.Document.getSubItemsWithProperties,
     * it will return 1 single item from the list that should be the first one to be loaded.
     * The method will attempt to find the item marked with attribute 'useAsDefault' with true.
     * When none is found, it will return the first element from the list.
     *
     * @param {Array} geometryItems
     * @return {Object} item element contained in geometryItems
     */
    ViewingApplication.prototype.getDefaultGeometry = function (geometryItems) {
        // Attempt to find the item marked with 'useAsDefault'
        for (var i = 0, len = geometryItems.length; i < len; ++i) {
            var isDefault = geometryItems[i]['useAsDefault'];
            if (isDefault === true || isDefault === 'true') {
                return geometryItems[i];
            }
        }
        return geometryItems[0];
    };

    /**
     * Asynchronously loads an individual item from a document into the correct viewer
     *
     * @param {} item
     * @param {} onSuccessCallback - This call back is called when the item is selected
     * @param {} onErrorCallback - This call back is called when the item fails to select.
     * @return Boolean
     */
    ViewingApplication.prototype.selectItem = function (item, onSuccessCallback, onErrorCallback) {

        // used to pass parameters from bubble items to the model loader.
        var loadOptions = {};

        var urnToLoad = this.myDocument.getViewablePath(item, loadOptions);

        if (!urnToLoad)
            return false;

        var viewItem, title, viewGeometryItem, modelUnits, canView = false;
        if (item.type === 'geometry' && item.role === '3d') {
            // This is for the case that initial view is a child of geometry in some DWF files
            // Set this view's camera as initial camera
            //var children = item.children;
            //if (children) {
            //    for (var i in children) {
            //        if (children.hasOwnProperty(i) && children[i].type === 'view') {
            //            viewItem = children[i];
            //            break;
            //        }
            //    }
            //}
            // This is for Revit files that have model units in bubble.json
            var properties = item.properties;
            if (properties) {
                for (var i in properties) {
                    if (properties.hasOwnProperty(i) && properties[i]._UnitLinear) {
                        modelUnits = properties[i]._UnitLinear;
                        break;
                    }
                }
            }
            canView = true;
            title = item.name;
            viewGeometryItem = item;
        } else if (item.type === "view" && item.role === "3d") {
            viewItem = item;
            canView = true;
            viewGeometryItem = this.myDocument.getViewGeometry(item);
            if (viewGeometryItem) {
                title = viewGeometryItem.name;
            }
        } else if (item.type === 'geometry' && item.role === '2d') {
            var f2dItems = Autodesk.Viewing.Document.getSubItemsWithProperties(item, {
                'mime': 'application/autodesk-f2d'
            }, false);
            var leafletItems = Autodesk.Viewing.Document.getSubItemsWithProperties(item, {
                'role': 'leaflet'
            }, false);

            if (f2dItems.length > 0 || leafletItems.length > 0)
                canView = true;

            title = item.name;
            viewGeometryItem = item;
        } else if (item.type === 'view' && item.role === '2d') {
            viewItem = item;
            canView = true;
            viewGeometryItem = this.myDocument.getViewGeometry(item);
            if (viewGeometryItem) {
                title = viewGeometryItem.name;
            }
        }

        if (!canView)
            return false;

        var idx = urnToLoad.indexOf("urn:");
        Logger.track({
            category: "load_viewable",
            role: item.role,
            type: item.type,
            urn: (idx !== -1) ? urnToLoad.substring(idx + 4) : urnToLoad
        });


        // Check if there are any warnign or errors from translators.
        // Exclude the global ones (ones from the root node).
        var messages = this.myDocument.getMessages(item, true);

        var self = this;
        var urnAlreadyLoaded = (this.myCurrentViewer && this.urn === urnToLoad);
        var onLoadCallback = null;

        if (viewItem && viewItem.camera) {
            onLoadCallback = function () {
                self.myCurrentViewer.setViewFromArray(viewItem.camera, viewItem.name);
                if (modelUnits) {
                    self.myCurrentViewer.setModelUnits(modelUnits);
                }
                if (onSuccessCallback) {
                    onSuccessCallback(self.myCurrentViewer, item, messages);
                }
            };
        } else if (viewItem && viewItem.viewbox) {
            onLoadCallback = function () {
                self.myCurrentViewer.setViewFromViewBox(viewItem.viewbox, viewItem.name);
                if (modelUnits) {
                    self.myCurrentViewer.setModelUnits(modelUnits);
                }
                if (onSuccessCallback) {
                    onSuccessCallback(self.myCurrentViewer, item, messages);
                }
            };
        } else if (urnAlreadyLoaded) {
            onLoadCallback = function () {
                self.myCurrentViewer.setViewFromFile();
                if (modelUnits) {
                    self.myCurrentViewer.setModelUnits(modelUnits);
                }
                if (onSuccessCallback) {
                    onSuccessCallback(self.myCurrentViewer, item, messages);
                }
            };
        } else {
            onLoadCallback = function () {
                if (modelUnits) {
                    self.myCurrentViewer.setModelUnits(modelUnits);
                }
                if (onSuccessCallback) {
                    onSuccessCallback(self.myCurrentViewer, item, messages);
                }
            };
        }

        var onFailedToLoadCallback = function (errorCode, errorMsg, statusCode, statusText) {
            if (onErrorCallback)
                onErrorCallback(errorCode, errorMsg, statusCode, statusText, messages);
        };

        var loaded = false;

        if (urnAlreadyLoaded) {
            if (onLoadCallback) {
                onLoadCallback();
            }
            loaded = true;

        } else {
            this.urn = null;
            var config = { defaultModelStructureTitle: title, viewableName: title };

            // Add any extensions to the config.
            //
            if (item.hasOwnProperty('extensions')) {
                config.extensions = Array.isArray(item.extensions) ? item.extensions : [item.extensions];
            }

            var viewer = this.getViewer(config);
            if (viewer) {

                var options = {
                    ids: null,
                    bubbleNode: this.bubble ? this.bubble.findByGuid(item.guid) : null,
                    sharedPropertyDbPath: this.myDocument.getPropertyDbPath(),
                    acmSessionId: this.myDocument.acmSessionId,
                    loadOptions: loadOptions
                };

                //If the viewer is not started, use the optimized start+load sequence by calling start with the model to load
                //while starting. Otherwise do normal load.
                if (viewer.started)
                    viewer.loadModel(this.myDocument.getFullPath(urnToLoad), options, onLoadCallback, onFailedToLoadCallback);
                else
                    viewer.start(this.myDocument.getFullPath(urnToLoad), options, onLoadCallback, onFailedToLoadCallback);

                this.urn = urnToLoad;
                loaded = true;
            }
        }

        if (loaded) {
            this.selectedItem = item;
            this.onItemSelected(item, viewGeometryItem);
            return true;
        }

        return false;
    };

    /**
     * Called when selectItem successfully loads an item
     *
     * @param {Object} item - can be either type 'view' or 'geometry'.
     * @param {Object} viewGeometryItem - can only be type 'geometry'. Will be the same as item if item is type 'geometry'.
     */
    ViewingApplication.prototype.onItemSelected = function (item, viewGeometryItem) {
        Logger.log('Selected URL: http://' + location.host + location.pathname + '?document=urn:' + this.myDocument.getRootItem().guid + '&item=' + encodeURIComponent(item.guid));

        // notify observers a new item was selected.
        if (this.itemSelectedObservers) {
            var currentViewer = this.getCurrentViewer();
            for (var i = 0; i < this.itemSelectedObservers.length; ++i) {
                var observer = this.itemSelectedObservers[i];
                observer.onItemSelected && observer.onItemSelected(currentViewer, item, viewGeometryItem);
            }
        }
    };

    /**
     * Adds objects to be notified when a new item is selected in the browser tree
     *
     * @param {object} observer Should implement function onItemSelected(viewer);
     */
    ViewingApplication.prototype.addItemSelectedObserver = function (observer) {

        if (!this.itemSelectedObservers) {
            this.itemSelectedObservers = [];
        }
        this.itemSelectedObservers.push(observer);
    };

    /**
     * Finds the item within the current document and calls selectItem
     * @param {int} itemId
     * @param {function} [onItemSelectedCallback] - This call back is called when the item is selected
     * @param {function} [onItemFailedToSelectCallback] - This call back is called when the item fails to select
     * @return Boolean
     */
    ViewingApplication.prototype.selectItemById = function (itemId, onItemSelectedCallback, onItemFailedToSelectCallback) {
        var item = this.myDocument.getItemById(itemId);
        if (item) {
            return this.selectItem(item, onItemSelectedCallback, onItemFailedToSelectCallback);
        }
        return false;
    };

    /**
     * Returns the node object containing metadata associated to the model currently loaded in the viewer
     * @returns {null|Object}
     */
    ViewingApplication.prototype.getSelectedItem = function () {
        return this.selectedItem;
    };

    return ViewingApplication;
});