define(function() {;
    'use strict'
    return {
        ESCAPE_EVENT: 'escape',
        PROGRESS_UPDATE_EVENT: 'progress',
        FULLSCREEN_MODE_EVENT: 'fullScreenMode',
        NAVIGATION_MODE_CHANGED_EVENT: 'navmode',
        VIEWER_STATE_RESTORED_EVENT: 'viewerStateRestored',
        VIEWER_RESIZE_EVENT: 'viewerResize',
        VIEWER_INITIALIZED: 'viewerInitialized',
        VIEWER_UNINITIALIZED: 'viewerUninitialized',
    
        MODEL_ROOT_LOADED_EVENT: 'svfLoaded',
        GEOMETRY_LOADED_EVENT: 'geometryLoaded',
        OBJECT_TREE_CREATED_EVENT: 'propertyDbLoaded',
        OBJECT_TREE_UNAVAILABLE_EVENT: 'propertyDbUnavailable',
        MODEL_UNLOADED_EVENT: 'modelUnloaded',
        EXTENSION_LOADED_EVENT: 'extensionLoaded',
        EXTENSION_UNLOADED_EVENT: 'extensionUnloaded',
    
        SELECTION_CHANGED_EVENT: 'selection',
        AGGREGATE_SELECTION_CHANGED_EVENT: 'aggregateSelection',
        ISOLATE_EVENT: 'isolate',
        HIDE_EVENT: 'hide',
        SHOW_EVENT: 'show',
    
        CAMERA_CHANGE_EVENT: 'cameraChanged',
        EXPLODE_CHANGE_EVENT: 'explodeChanged',
        CUTPLANES_CHANGE_EVENT: 'cutplanesChanged',
        TOOL_CHANGE_EVENT: 'toolChanged',
        RENDER_OPTION_CHANGED_EVENT: 'renderOptionChanged',
        LAYER_VISIBILITY_CHANGED_EVENT: 'layerVisibility',
        RESET_EVENT: 'reset',
    
        PREF_CHANGED_EVENT: 'PrefChanged',
        PREF_RESET_EVENT: 'PrefReset',
    
        ANIMATION_READY_EVENT: 'animationReady',
    
        HYPERLINK_EVENT: 'hyperlink',

        TOOLBAR_CREATED_EVENT: 'toolbarCreated',
        SIDE_BAR_OPEN_EVENT: 'SIDE_BAR_OPEN_EVENT',

        TOOLBAR_CREATED_EVENT: 'toolbarCreated',
        SIDE_BAR_OPEN_EVENT: 'SIDE_BAR_OPEN_EVENT',

        ANNOTATION_CREATED_EVENT: "annotationCreated"
    }
});