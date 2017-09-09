define([
'./Core/Init',
'./Core/ApplicationScreenModeDelegate',
'./Core/DefaultHandler',
'./Core/DefaultSettings',
'./Core/DeviceType',
'./Core/EventDispatcher',
'./Core/EventType',
'./Core/ExtensionMixin',
'./Core/FileLoaderManager',
'./Core/Fn/detectWebGL',
'./Core/Fn/exitFullscreen',
'./Core/Fn/fullscreenElement',
'./Core/Fn/getContext',
'./Core/Fn/inFullscreen',
'./Core/Fn/isFullscreenAvailable',
'./Core/Fn/launchFullscreen',
'./Core/Fn/rescueFromPolymer',
'./Core/Fn/touchStartToClick',
'./Core/FovTool',
'./Core/GestureHandler',
'./Core/Global',
'./Core/HotGestureTool',
'./Core/HotkeyManager',
'./Core/KeyCode',
'./Core/Logger',
'./Core/LogLevels',
'./Core/Model',
'./Core/ModelUnits',
'./Core/Navigation',
'./Core/NavigationMode',
'./Core/NullScreenModeDelegate',
'./Core/OrbitDollyPanTool',
'./Core/Polyfill',
'./Core/Privite/Animation/Animation',
'./Core/Privite/Animation/AnimationHandler',
'./Core/Privite/Animation/AnnotationAnimation',
'./Core/Privite/Animation/CameraAnimation',
'./Core/Privite/Animation/InterpolationType',
'./Core/Privite/Animation/KeyFrameAnimator',
'./Core/Privite/Animation/MeshAnimation',
'./Core/Privite/Animation/PolylineAnimation',
'./Core/Privite/Animation/VisibilityAnimation',
'./Core/Privite/Autocam',
'./Core/Privite/BackgroundPresets',
'./Core/Privite/BufferGeometryUtils',
'./Core/Privite/BVHBuilder',
'./Core/Privite/DebugEnvironments',
'./Core/Privite/ErrorHandler',
'./Core/Privite/FireflyWebGLProgram',
'./Core/Privite/FireflyWebGLRenderer',
'./Core/Privite/FireflyWebGLShader',
'./Core/Privite/Fn/convertUnits',
'./Core/Privite/Fn/CreateCubeMapFromColors',
'./Core/Privite/Fn/CreateLinePatternTexture',
'./Core/Privite/Fn/DecodeEnvMap',
'./Core/Privite/Fn/formatValueWithUnits',
'./Core/Privite/Fn/getAuthObject',
'./Core/Privite/Fn/getDemoDocumentURN',
'./Core/Privite/Fn/getParameterByName',
'./Core/Privite/Fn/getParameterByNameFromPath',
'./Core/Privite/Fn/getResourceUrl',
'./Core/Privite/Fn/getScript',
'./Core/Privite/Fn/initializeAuth',
'./Core/Privite/Fn/initializeEnvironmentVariable',
'./Core/Privite/Fn/initializeLocalization',
'./Core/Privite/Fn/initializeLogger',
'./Core/Privite/Fn/initializeProtein',
'./Core/Privite/Fn/Initializer',
'./Core/Privite/Fn/initializeServiceEndPoints',
'./Core/Privite/Fn/initializeUserInfo',
'./Core/Privite/Fn/initLoadContext',
'./Core/Privite/Fn/InteractionInterceptor',
'./Core/Privite/Fn/loadDependency',
'./Core/Privite/Fn/loadTextureWithSecurity',
'./Core/Privite/Fn/pathToURL',
'./Core/Privite/Fn/refreshCookie',
'./Core/Privite/Fn/refreshRequestHeader',
'./Core/Privite/Fn/refreshToken',
'./Core/Privite/Fn/setLanguage',
'./Core/Privite/Fn/setUserName',
'./Core/Privite/Fn/stringToDOM',
'./Core/Privite/Fn/urlIsApiViewingOrDev',
'./Core/Privite/Fn/ViewTransceiver',
'./Core/Privite/FragmentList',
'./Core/Privite/FragmentPointer',
'./Core/Privite/FrustumIntersector',
'./Core/Privite/GeometryList',
'./Core/Privite/Global',
'./Core/Privite/Half',
'./Core/Privite/InstanceTree',
'./Core/Privite/InstanceTreeAccess',
'./Core/Privite/InstanceTreeStorage',
'./Core/Privite/LightPresets',
'./Core/Privite/LineStyleDefs',
'./Core/Privite/LiveReviewClient',
'./Core/Privite/MessageClient',
'./Core/Privite/ModelIteratorBVH',
'./Core/Privite/ModelIteratorLinear',
'./Core/Privite/MultiModelSelector',
'./Core/Privite/MultiModelVisibilityManager',
'./Core/Privite/NodeArray',
'./Core/Privite/P2PClient',
'./Core/Privite/Preferences',
'./Core/Privite/PrismMaps',
'./Core/Privite/PropDbLoader',
'./Core/Privite/RenderBatch',
'./Core/Privite/RenderContext',
'./Core/Privite/RenderModel',
'./Core/Privite/RenderScene',
'./Core/Privite/Selector',
'./Core/Privite/SvfLoader',
'./Core/Privite/UnifiedCamera',
'./Core/Privite/VBIntersector',
'./Core/Privite/ViewerSettingTab',
'./Core/Privite/ViewerState',
'./Core/Privite/ViewingService',
'./Core/Privite/VisibilityManager',
'./Core/ScreenMode',
'./Core/ScreenModeDelegate',
'./Core/ScreenModeMixin',
'./Core/SelectionMode',
'./Core/Shaders/BackgroundShader',
'./Core/Shaders/BlendShader',
'./Core/Shaders/CelShader',
'./Core/Shaders/Chunks/CutPlanesShaderChunk',
'./Core/Shaders/Chunks/EnvSamplingShaderChunk',
'./Core/Shaders/Chunks/FinalOutputShaderChunk',
'./Core/Shaders/Chunks/HatchPatternShaderChunk',
'./Core/Shaders/Chunks/IdOutputShaderChunk',
'./Core/Shaders/Chunks/OrderedDitheringShaderChunk',
'./Core/Shaders/Chunks/PackDepthShaderChunk',
'./Core/Shaders/Chunks/PackNormalsShaderChunk',
'./Core/Shaders/Chunks/ThemingFragmentShaderChunk',
'./Core/Shaders/Chunks/TonemapShaderChunk',
'./Core/Shaders/CopyShader',
'./Core/Shaders/Declarations/IdFragmentDeclaration',
'./Core/Shaders/Declarations/ThemingFragmentDeclaration',
'./Core/Shaders/FireflyBasicShader',
'./Core/Shaders/FireflyPhongShader',
'./Core/Shaders/Fn/clonePrismMaterial',
'./Core/Shaders/Fn/createPrismMaterial',
'./Core/Shaders/FXAAShader',
'./Core/Shaders/GaussianPass',
'./Core/Shaders/GaussianShader',
'./Core/Shaders/GroundDepthShader',
'./Core/Shaders/GroundReflection',
'./Core/Shaders/GroundReflectionCompShader',
'./Core/Shaders/GroundReflectionDrawShader',
'./Core/Shaders/GroundShadow',
'./Core/Shaders/GroundShadowAOShader',
'./Core/Shaders/GroundShadowBlurShader',
'./Core/Shaders/GroundShadowColorShader',
'./Core/Shaders/LineShader',
'./Core/Shaders/LmvShaderPass',
'./Core/Shaders/MaterialConverter',
'./Core/Shaders/MaterialManager',
'./Core/Shaders/NormalsShader',
'./Core/Shaders/PrismShader',
'./Core/Shaders/SAOBlurShader',
'./Core/Shaders/SAOMinifyFirstShader',
'./Core/Shaders/SAOMinifyShader',
'./Core/Shaders/SAOShader',
'./Core/Shaders/Uniforms/CutPlanesUniforms',
'./Core/Shaders/Uniforms/IdUniforms',
'./Core/Shaders/Uniforms/ThemingUniform',
'./Core/theExtensionManager',
'./Core/theHotkeyManager',
'./Core/Three/ddsLoader',
'./Core/Three/pvrLoader',
'./Core/ToolController',
'./Core/ToolInterface',
'./Core/ViewingUtilities',
'./Core/WorldUpTool',
'./Extension/Extension',
'./Extension/ExtensionRegister',
'./Extension/NavToolsExtension',
'./Extension/ViewerPanelMixin',
'./i18n',
'./Widget/AlertBox',
'./Widget/Button',
'./Widget/ComboButton',
'./Widget/ContextMenu',
'./Widget/Control',
'./Widget/ControlGroup',
'./Widget/DockingPanel',
'./Widget/GuiViewer3D',
'./Widget/HudMessage',
'./Widget/LayersPanel',
'./Widget/ModelStructurePanel',
'./Widget/ObjectContextMenu',
'./Widget/OptionCheckbox',
'./Widget/OptionDropDown',
'./Widget/OptionSlider',
'./Widget/ProgressBar',
'./Widget/PropertyPanel',
'./Widget/RadioButtonGroup',
'./Widget/RenderOptionsPanel',
'./Widget/SettingsPanel',
'./Widget/ToolBar',
'./Widget/ToolbarSID',
'./Widget/Tree',
'./Widget/TreeDelegate',
'./Widget/ViewCubeUi',
'./Widget/Viewer3D',
'./Widget/Viewer3DImpl',
'./Widget/ViewerLayersPanel',
'./Widget/ViewerModelStructurePanel',
'./Widget/ViewerObjectContextMenu',
'./Widget/ViewerPropertyPanel',
'./Widget/ViewerSettingsPanel',
'./Worker/createWorker',
'./Worker/createWorkerWithIntercept',
'./Worker/DecodeEnvMapAsync',
'./Worker/doDecodeEnvmap',
'./Worker/initWorkerScript',
'./Worker/WORKER_DATA_URL'], function(
Core_Init,
Core_ApplicationScreenModeDelegate,
Core_DefaultHandler,
Core_DefaultSettings,
Core_DeviceType,
Core_EventDispatcher,
Core_EventType,
Core_ExtensionMixin,
Core_FileLoaderManager,
Core_Fn_detectWebGL,
Core_Fn_exitFullscreen,
Core_Fn_fullscreenElement,
Core_Fn_getContext,
Core_Fn_inFullscreen,
Core_Fn_isFullscreenAvailable,
Core_Fn_launchFullscreen,
Core_Fn_rescueFromPolymer,
Core_Fn_touchStartToClick,
Core_FovTool,
Core_GestureHandler,
Core_Global,
Core_HotGestureTool,
Core_HotkeyManager,
Core_KeyCode,
Core_Logger,
Core_LogLevels,
Core_Model,
Core_ModelUnits,
Core_Navigation,
Core_NavigationMode,
Core_NullScreenModeDelegate,
Core_OrbitDollyPanTool,
Core_Polyfill,
Core_Privite_Animation_Animation,
Core_Privite_Animation_AnimationHandler,
Core_Privite_Animation_AnnotationAnimation,
Core_Privite_Animation_CameraAnimation,
Core_Privite_Animation_InterpolationType,
Core_Privite_Animation_KeyFrameAnimator,
Core_Privite_Animation_MeshAnimation,
Core_Privite_Animation_PolylineAnimation,
Core_Privite_Animation_VisibilityAnimation,
Core_Privite_Autocam,
Core_Privite_BackgroundPresets,
Core_Privite_BufferGeometryUtils,
Core_Privite_BVHBuilder,
Core_Privite_DebugEnvironments,
Core_Privite_ErrorHandler,
Core_Privite_FireflyWebGLProgram,
Core_Privite_FireflyWebGLRenderer,
Core_Privite_FireflyWebGLShader,
Core_Privite_Fn_convertUnits,
Core_Privite_Fn_CreateCubeMapFromColors,
Core_Privite_Fn_CreateLinePatternTexture,
Core_Privite_Fn_DecodeEnvMap,
Core_Privite_Fn_formatValueWithUnits,
Core_Privite_Fn_getAuthObject,
Core_Privite_Fn_getDemoDocumentURN,
Core_Privite_Fn_getParameterByName,
Core_Privite_Fn_getParameterByNameFromPath,
Core_Privite_Fn_getResourceUrl,
Core_Privite_Fn_getScript,
Core_Privite_Fn_initializeAuth,
Core_Privite_Fn_initializeEnvironmentVariable,
Core_Privite_Fn_initializeLocalization,
Core_Privite_Fn_initializeLogger,
Core_Privite_Fn_initializeProtein,
Core_Privite_Fn_Initializer,
Core_Privite_Fn_initializeServiceEndPoints,
Core_Privite_Fn_initializeUserInfo,
Core_Privite_Fn_initLoadContext,
Core_Privite_Fn_InteractionInterceptor,
Core_Privite_Fn_loadDependency,
Core_Privite_Fn_loadTextureWithSecurity,
Core_Privite_Fn_pathToURL,
Core_Privite_Fn_refreshCookie,
Core_Privite_Fn_refreshRequestHeader,
Core_Privite_Fn_refreshToken,
Core_Privite_Fn_setLanguage,
Core_Privite_Fn_setUserName,
Core_Privite_Fn_stringToDOM,
Core_Privite_Fn_urlIsApiViewingOrDev,
Core_Privite_Fn_ViewTransceiver,
Core_Privite_FragmentList,
Core_Privite_FragmentPointer,
Core_Privite_FrustumIntersector,
Core_Privite_GeometryList,
Core_Privite_Global,
Core_Privite_Half,
Core_Privite_InstanceTree,
Core_Privite_InstanceTreeAccess,
Core_Privite_InstanceTreeStorage,
Core_Privite_LightPresets,
Core_Privite_LineStyleDefs,
Core_Privite_LiveReviewClient,
Core_Privite_MessageClient,
Core_Privite_ModelIteratorBVH,
Core_Privite_ModelIteratorLinear,
Core_Privite_MultiModelSelector,
Core_Privite_MultiModelVisibilityManager,
Core_Privite_NodeArray,
Core_Privite_P2PClient,
Core_Privite_Preferences,
Core_Privite_PrismMaps,
Core_Privite_PropDbLoader,
Core_Privite_RenderBatch,
Core_Privite_RenderContext,
Core_Privite_RenderModel,
Core_Privite_RenderScene,
Core_Privite_Selector,
Core_Privite_SvfLoader,
Core_Privite_UnifiedCamera,
Core_Privite_VBIntersector,
Core_Privite_ViewerSettingTab,
Core_Privite_ViewerState,
Core_Privite_ViewingService,
Core_Privite_VisibilityManager,
Core_ScreenMode,
Core_ScreenModeDelegate,
Core_ScreenModeMixin,
Core_SelectionMode,
Core_Shaders_BackgroundShader,
Core_Shaders_BlendShader,
Core_Shaders_CelShader,
Core_Shaders_Chunks_CutPlanesShaderChunk,
Core_Shaders_Chunks_EnvSamplingShaderChunk,
Core_Shaders_Chunks_FinalOutputShaderChunk,
Core_Shaders_Chunks_HatchPatternShaderChunk,
Core_Shaders_Chunks_IdOutputShaderChunk,
Core_Shaders_Chunks_OrderedDitheringShaderChunk,
Core_Shaders_Chunks_PackDepthShaderChunk,
Core_Shaders_Chunks_PackNormalsShaderChunk,
Core_Shaders_Chunks_ThemingFragmentShaderChunk,
Core_Shaders_Chunks_TonemapShaderChunk,
Core_Shaders_CopyShader,
Core_Shaders_Declarations_IdFragmentDeclaration,
Core_Shaders_Declarations_ThemingFragmentDeclaration,
Core_Shaders_FireflyBasicShader,
Core_Shaders_FireflyPhongShader,
Core_Shaders_Fn_clonePrismMaterial,
Core_Shaders_Fn_createPrismMaterial,
Core_Shaders_FXAAShader,
Core_Shaders_GaussianPass,
Core_Shaders_GaussianShader,
Core_Shaders_GroundDepthShader,
Core_Shaders_GroundReflection,
Core_Shaders_GroundReflectionCompShader,
Core_Shaders_GroundReflectionDrawShader,
Core_Shaders_GroundShadow,
Core_Shaders_GroundShadowAOShader,
Core_Shaders_GroundShadowBlurShader,
Core_Shaders_GroundShadowColorShader,
Core_Shaders_LineShader,
Core_Shaders_LmvShaderPass,
Core_Shaders_MaterialConverter,
Core_Shaders_MaterialManager,
Core_Shaders_NormalsShader,
Core_Shaders_PrismShader,
Core_Shaders_SAOBlurShader,
Core_Shaders_SAOMinifyFirstShader,
Core_Shaders_SAOMinifyShader,
Core_Shaders_SAOShader,
Core_Shaders_Uniforms_CutPlanesUniforms,
Core_Shaders_Uniforms_IdUniforms,
Core_Shaders_Uniforms_ThemingUniform,
Core_theExtensionManager,
Core_theHotkeyManager,
Core_Three_ddsLoader,
Core_Three_pvrLoader,
Core_ToolController,
Core_ToolInterface,
Core_ViewingUtilities,
Core_WorldUpTool,
Extension_Extension,
Extension_ExtensionRegister,
Extension_NavToolsExtension,
Extension_ViewerPanelMixin,
i18n,
Widget_AlertBox,
Widget_Button,
Widget_ComboButton,
Widget_ContextMenu,
Widget_Control,
Widget_ControlGroup,
Widget_DockingPanel,
Widget_GuiViewer3D,
Widget_HudMessage,
Widget_LayersPanel,
Widget_ModelStructurePanel,
Widget_ObjectContextMenu,
Widget_OptionCheckbox,
Widget_OptionDropDown,
Widget_OptionSlider,
Widget_ProgressBar,
Widget_PropertyPanel,
Widget_RadioButtonGroup,
Widget_RenderOptionsPanel,
Widget_SettingsPanel,
Widget_ToolBar,
Widget_ToolbarSID,
Widget_Tree,
Widget_TreeDelegate,
Widget_ViewCubeUi,
Widget_Viewer3D,
Widget_Viewer3DImpl,
Widget_ViewerLayersPanel,
Widget_ViewerModelStructurePanel,
Widget_ViewerObjectContextMenu,
Widget_ViewerPropertyPanel,
Widget_ViewerSettingsPanel,
Worker_createWorker,
Worker_createWorkerWithIntercept,
Worker_DecodeEnvMapAsync,
Worker_doDecodeEnvmap,
Worker_initWorkerScript,
Worker_WORKER_DATA_URL) {
var HY = {};
HY['Core'] = {};
HY['Core']['Fn'] = {};
HY['Core']['Privite'] = {};
HY['Core']['Privite']['Animation'] = {};
HY['Core']['Privite']['Fn'] = {};
HY['Core']['Shaders'] = {};
HY['Core']['Shaders']['Chunks'] = {};
HY['Core']['Shaders']['Declarations'] = {};
HY['Core']['Shaders']['Fn'] = {};
HY['Core']['Shaders']['Uniforms'] = {};
HY['Core']['Three'] = {};
HY['Extension'] = {};
HY['Widget'] = {};
HY['Worker'] = {};
HY['Core']['Init'] = Core_Init;
HY['Core']['ApplicationScreenModeDelegate'] = Core_ApplicationScreenModeDelegate;
HY['Core']['DefaultHandler'] = Core_DefaultHandler;
HY['Core']['DefaultSettings'] = Core_DefaultSettings;
HY['Core']['DeviceType'] = Core_DeviceType;
HY['Core']['EventDispatcher'] = Core_EventDispatcher;
HY['Core']['EventType'] = Core_EventType;
HY['Core']['ExtensionMixin'] = Core_ExtensionMixin;
HY['Core']['FileLoaderManager'] = Core_FileLoaderManager;
HY['Core']['Fn']['detectWebGL'] = Core_Fn_detectWebGL;
HY['Core']['Fn']['exitFullscreen'] = Core_Fn_exitFullscreen;
HY['Core']['Fn']['fullscreenElement'] = Core_Fn_fullscreenElement;
HY['Core']['Fn']['getContext'] = Core_Fn_getContext;
HY['Core']['Fn']['inFullscreen'] = Core_Fn_inFullscreen;
HY['Core']['Fn']['isFullscreenAvailable'] = Core_Fn_isFullscreenAvailable;
HY['Core']['Fn']['launchFullscreen'] = Core_Fn_launchFullscreen;
HY['Core']['Fn']['rescueFromPolymer'] = Core_Fn_rescueFromPolymer;
HY['Core']['Fn']['touchStartToClick'] = Core_Fn_touchStartToClick;
HY['Core']['FovTool'] = Core_FovTool;
HY['Core']['GestureHandler'] = Core_GestureHandler;
HY['Core']['Global'] = Core_Global;
HY['Core']['HotGestureTool'] = Core_HotGestureTool;
HY['Core']['HotkeyManager'] = Core_HotkeyManager;
HY['Core']['KeyCode'] = Core_KeyCode;
HY['Core']['Logger'] = Core_Logger;
HY['Core']['LogLevels'] = Core_LogLevels;
HY['Core']['Model'] = Core_Model;
HY['Core']['ModelUnits'] = Core_ModelUnits;
HY['Core']['Navigation'] = Core_Navigation;
HY['Core']['NavigationMode'] = Core_NavigationMode;
HY['Core']['NullScreenModeDelegate'] = Core_NullScreenModeDelegate;
HY['Core']['OrbitDollyPanTool'] = Core_OrbitDollyPanTool;
HY['Core']['Polyfill'] = Core_Polyfill;
HY['Core']['Privite']['Animation']['Animation'] = Core_Privite_Animation_Animation;
HY['Core']['Privite']['Animation']['AnimationHandler'] = Core_Privite_Animation_AnimationHandler;
HY['Core']['Privite']['Animation']['AnnotationAnimation'] = Core_Privite_Animation_AnnotationAnimation;
HY['Core']['Privite']['Animation']['CameraAnimation'] = Core_Privite_Animation_CameraAnimation;
HY['Core']['Privite']['Animation']['InterpolationType'] = Core_Privite_Animation_InterpolationType;
HY['Core']['Privite']['Animation']['KeyFrameAnimator'] = Core_Privite_Animation_KeyFrameAnimator;
HY['Core']['Privite']['Animation']['MeshAnimation'] = Core_Privite_Animation_MeshAnimation;
HY['Core']['Privite']['Animation']['PolylineAnimation'] = Core_Privite_Animation_PolylineAnimation;
HY['Core']['Privite']['Animation']['VisibilityAnimation'] = Core_Privite_Animation_VisibilityAnimation;
HY['Core']['Privite']['Autocam'] = Core_Privite_Autocam;
HY['Core']['Privite']['BackgroundPresets'] = Core_Privite_BackgroundPresets;
HY['Core']['Privite']['BufferGeometryUtils'] = Core_Privite_BufferGeometryUtils;
HY['Core']['Privite']['BVHBuilder'] = Core_Privite_BVHBuilder;
HY['Core']['Privite']['DebugEnvironments'] = Core_Privite_DebugEnvironments;
HY['Core']['Privite']['ErrorHandler'] = Core_Privite_ErrorHandler;
HY['Core']['Privite']['FireflyWebGLProgram'] = Core_Privite_FireflyWebGLProgram;
HY['Core']['Privite']['FireflyWebGLRenderer'] = Core_Privite_FireflyWebGLRenderer;
HY['Core']['Privite']['FireflyWebGLShader'] = Core_Privite_FireflyWebGLShader;
HY['Core']['Privite']['Fn']['convertUnits'] = Core_Privite_Fn_convertUnits;
HY['Core']['Privite']['Fn']['CreateCubeMapFromColors'] = Core_Privite_Fn_CreateCubeMapFromColors;
HY['Core']['Privite']['Fn']['CreateLinePatternTexture'] = Core_Privite_Fn_CreateLinePatternTexture;
HY['Core']['Privite']['Fn']['DecodeEnvMap'] = Core_Privite_Fn_DecodeEnvMap;
HY['Core']['Privite']['Fn']['formatValueWithUnits'] = Core_Privite_Fn_formatValueWithUnits;
HY['Core']['Privite']['Fn']['getAuthObject'] = Core_Privite_Fn_getAuthObject;
HY['Core']['Privite']['Fn']['getDemoDocumentURN'] = Core_Privite_Fn_getDemoDocumentURN;
HY['Core']['Privite']['Fn']['getParameterByName'] = Core_Privite_Fn_getParameterByName;
HY['Core']['Privite']['Fn']['getParameterByNameFromPath'] = Core_Privite_Fn_getParameterByNameFromPath;
HY['Core']['Privite']['Fn']['getResourceUrl'] = Core_Privite_Fn_getResourceUrl;
HY['Core']['Privite']['Fn']['getScript'] = Core_Privite_Fn_getScript;
HY['Core']['Privite']['Fn']['initializeAuth'] = Core_Privite_Fn_initializeAuth;
HY['Core']['Privite']['Fn']['initializeEnvironmentVariable'] = Core_Privite_Fn_initializeEnvironmentVariable;
HY['Core']['Privite']['Fn']['initializeLocalization'] = Core_Privite_Fn_initializeLocalization;
HY['Core']['Privite']['Fn']['initializeLogger'] = Core_Privite_Fn_initializeLogger;
HY['Core']['Privite']['Fn']['initializeProtein'] = Core_Privite_Fn_initializeProtein;
HY['Core']['Privite']['Fn']['Initializer'] = Core_Privite_Fn_Initializer;
HY['Core']['Privite']['Fn']['initializeServiceEndPoints'] = Core_Privite_Fn_initializeServiceEndPoints;
HY['Core']['Privite']['Fn']['initializeUserInfo'] = Core_Privite_Fn_initializeUserInfo;
HY['Core']['Privite']['Fn']['initLoadContext'] = Core_Privite_Fn_initLoadContext;
HY['Core']['Privite']['Fn']['InteractionInterceptor'] = Core_Privite_Fn_InteractionInterceptor;
HY['Core']['Privite']['Fn']['loadDependency'] = Core_Privite_Fn_loadDependency;
HY['Core']['Privite']['Fn']['loadTextureWithSecurity'] = Core_Privite_Fn_loadTextureWithSecurity;
HY['Core']['Privite']['Fn']['pathToURL'] = Core_Privite_Fn_pathToURL;
HY['Core']['Privite']['Fn']['refreshCookie'] = Core_Privite_Fn_refreshCookie;
HY['Core']['Privite']['Fn']['refreshRequestHeader'] = Core_Privite_Fn_refreshRequestHeader;
HY['Core']['Privite']['Fn']['refreshToken'] = Core_Privite_Fn_refreshToken;
HY['Core']['Privite']['Fn']['setLanguage'] = Core_Privite_Fn_setLanguage;
HY['Core']['Privite']['Fn']['setUserName'] = Core_Privite_Fn_setUserName;
HY['Core']['Privite']['Fn']['stringToDOM'] = Core_Privite_Fn_stringToDOM;
HY['Core']['Privite']['Fn']['urlIsApiViewingOrDev'] = Core_Privite_Fn_urlIsApiViewingOrDev;
HY['Core']['Privite']['Fn']['ViewTransceiver'] = Core_Privite_Fn_ViewTransceiver;
HY['Core']['Privite']['FragmentList'] = Core_Privite_FragmentList;
HY['Core']['Privite']['FragmentPointer'] = Core_Privite_FragmentPointer;
HY['Core']['Privite']['FrustumIntersector'] = Core_Privite_FrustumIntersector;
HY['Core']['Privite']['GeometryList'] = Core_Privite_GeometryList;
HY['Core']['Privite']['Global'] = Core_Privite_Global;
HY['Core']['Privite']['Half'] = Core_Privite_Half;
HY['Core']['Privite']['InstanceTree'] = Core_Privite_InstanceTree;
HY['Core']['Privite']['InstanceTreeAccess'] = Core_Privite_InstanceTreeAccess;
HY['Core']['Privite']['InstanceTreeStorage'] = Core_Privite_InstanceTreeStorage;
HY['Core']['Privite']['LightPresets'] = Core_Privite_LightPresets;
HY['Core']['Privite']['LineStyleDefs'] = Core_Privite_LineStyleDefs;
HY['Core']['Privite']['LiveReviewClient'] = Core_Privite_LiveReviewClient;
HY['Core']['Privite']['MessageClient'] = Core_Privite_MessageClient;
HY['Core']['Privite']['ModelIteratorBVH'] = Core_Privite_ModelIteratorBVH;
HY['Core']['Privite']['ModelIteratorLinear'] = Core_Privite_ModelIteratorLinear;
HY['Core']['Privite']['MultiModelSelector'] = Core_Privite_MultiModelSelector;
HY['Core']['Privite']['MultiModelVisibilityManager'] = Core_Privite_MultiModelVisibilityManager;
HY['Core']['Privite']['NodeArray'] = Core_Privite_NodeArray;
HY['Core']['Privite']['P2PClient'] = Core_Privite_P2PClient;
HY['Core']['Privite']['Preferences'] = Core_Privite_Preferences;
HY['Core']['Privite']['PrismMaps'] = Core_Privite_PrismMaps;
HY['Core']['Privite']['PropDbLoader'] = Core_Privite_PropDbLoader;
HY['Core']['Privite']['RenderBatch'] = Core_Privite_RenderBatch;
HY['Core']['Privite']['RenderContext'] = Core_Privite_RenderContext;
HY['Core']['Privite']['RenderModel'] = Core_Privite_RenderModel;
HY['Core']['Privite']['RenderScene'] = Core_Privite_RenderScene;
HY['Core']['Privite']['Selector'] = Core_Privite_Selector;
HY['Core']['Privite']['SvfLoader'] = Core_Privite_SvfLoader;
HY['Core']['Privite']['UnifiedCamera'] = Core_Privite_UnifiedCamera;
HY['Core']['Privite']['VBIntersector'] = Core_Privite_VBIntersector;
HY['Core']['Privite']['ViewerSettingTab'] = Core_Privite_ViewerSettingTab;
HY['Core']['Privite']['ViewerState'] = Core_Privite_ViewerState;
HY['Core']['Privite']['ViewingService'] = Core_Privite_ViewingService;
HY['Core']['Privite']['VisibilityManager'] = Core_Privite_VisibilityManager;
HY['Core']['ScreenMode'] = Core_ScreenMode;
HY['Core']['ScreenModeDelegate'] = Core_ScreenModeDelegate;
HY['Core']['ScreenModeMixin'] = Core_ScreenModeMixin;
HY['Core']['SelectionMode'] = Core_SelectionMode;
HY['Core']['Shaders']['BackgroundShader'] = Core_Shaders_BackgroundShader;
HY['Core']['Shaders']['BlendShader'] = Core_Shaders_BlendShader;
HY['Core']['Shaders']['CelShader'] = Core_Shaders_CelShader;
HY['Core']['Shaders']['Chunks']['CutPlanesShaderChunk'] = Core_Shaders_Chunks_CutPlanesShaderChunk;
HY['Core']['Shaders']['Chunks']['EnvSamplingShaderChunk'] = Core_Shaders_Chunks_EnvSamplingShaderChunk;
HY['Core']['Shaders']['Chunks']['FinalOutputShaderChunk'] = Core_Shaders_Chunks_FinalOutputShaderChunk;
HY['Core']['Shaders']['Chunks']['HatchPatternShaderChunk'] = Core_Shaders_Chunks_HatchPatternShaderChunk;
HY['Core']['Shaders']['Chunks']['IdOutputShaderChunk'] = Core_Shaders_Chunks_IdOutputShaderChunk;
HY['Core']['Shaders']['Chunks']['OrderedDitheringShaderChunk'] = Core_Shaders_Chunks_OrderedDitheringShaderChunk;
HY['Core']['Shaders']['Chunks']['PackDepthShaderChunk'] = Core_Shaders_Chunks_PackDepthShaderChunk;
HY['Core']['Shaders']['Chunks']['PackNormalsShaderChunk'] = Core_Shaders_Chunks_PackNormalsShaderChunk;
HY['Core']['Shaders']['Chunks']['ThemingFragmentShaderChunk'] = Core_Shaders_Chunks_ThemingFragmentShaderChunk;
HY['Core']['Shaders']['Chunks']['TonemapShaderChunk'] = Core_Shaders_Chunks_TonemapShaderChunk;
HY['Core']['Shaders']['CopyShader'] = Core_Shaders_CopyShader;
HY['Core']['Shaders']['Declarations']['IdFragmentDeclaration'] = Core_Shaders_Declarations_IdFragmentDeclaration;
HY['Core']['Shaders']['Declarations']['ThemingFragmentDeclaration'] = Core_Shaders_Declarations_ThemingFragmentDeclaration;
HY['Core']['Shaders']['FireflyBasicShader'] = Core_Shaders_FireflyBasicShader;
HY['Core']['Shaders']['FireflyPhongShader'] = Core_Shaders_FireflyPhongShader;
HY['Core']['Shaders']['Fn']['clonePrismMaterial'] = Core_Shaders_Fn_clonePrismMaterial;
HY['Core']['Shaders']['Fn']['createPrismMaterial'] = Core_Shaders_Fn_createPrismMaterial;
HY['Core']['Shaders']['FXAAShader'] = Core_Shaders_FXAAShader;
HY['Core']['Shaders']['GaussianPass'] = Core_Shaders_GaussianPass;
HY['Core']['Shaders']['GaussianShader'] = Core_Shaders_GaussianShader;
HY['Core']['Shaders']['GroundDepthShader'] = Core_Shaders_GroundDepthShader;
HY['Core']['Shaders']['GroundReflection'] = Core_Shaders_GroundReflection;
HY['Core']['Shaders']['GroundReflectionCompShader'] = Core_Shaders_GroundReflectionCompShader;
HY['Core']['Shaders']['GroundReflectionDrawShader'] = Core_Shaders_GroundReflectionDrawShader;
HY['Core']['Shaders']['GroundShadow'] = Core_Shaders_GroundShadow;
HY['Core']['Shaders']['GroundShadowAOShader'] = Core_Shaders_GroundShadowAOShader;
HY['Core']['Shaders']['GroundShadowBlurShader'] = Core_Shaders_GroundShadowBlurShader;
HY['Core']['Shaders']['GroundShadowColorShader'] = Core_Shaders_GroundShadowColorShader;
HY['Core']['Shaders']['LineShader'] = Core_Shaders_LineShader;
HY['Core']['Shaders']['LmvShaderPass'] = Core_Shaders_LmvShaderPass;
HY['Core']['Shaders']['MaterialConverter'] = Core_Shaders_MaterialConverter;
HY['Core']['Shaders']['MaterialManager'] = Core_Shaders_MaterialManager;
HY['Core']['Shaders']['NormalsShader'] = Core_Shaders_NormalsShader;
HY['Core']['Shaders']['PrismShader'] = Core_Shaders_PrismShader;
HY['Core']['Shaders']['SAOBlurShader'] = Core_Shaders_SAOBlurShader;
HY['Core']['Shaders']['SAOMinifyFirstShader'] = Core_Shaders_SAOMinifyFirstShader;
HY['Core']['Shaders']['SAOMinifyShader'] = Core_Shaders_SAOMinifyShader;
HY['Core']['Shaders']['SAOShader'] = Core_Shaders_SAOShader;
HY['Core']['Shaders']['Uniforms']['CutPlanesUniforms'] = Core_Shaders_Uniforms_CutPlanesUniforms;
HY['Core']['Shaders']['Uniforms']['IdUniforms'] = Core_Shaders_Uniforms_IdUniforms;
HY['Core']['Shaders']['Uniforms']['ThemingUniform'] = Core_Shaders_Uniforms_ThemingUniform;
HY['Core']['theExtensionManager'] = Core_theExtensionManager;
HY['Core']['theHotkeyManager'] = Core_theHotkeyManager;
HY['Core']['Three']['ddsLoader'] = Core_Three_ddsLoader;
HY['Core']['Three']['pvrLoader'] = Core_Three_pvrLoader;
HY['Core']['ToolController'] = Core_ToolController;
HY['Core']['ToolInterface'] = Core_ToolInterface;
HY['Core']['ViewingUtilities'] = Core_ViewingUtilities;
HY['Core']['WorldUpTool'] = Core_WorldUpTool;
HY['Extension']['Extension'] = Extension_Extension;
HY['Extension']['ExtensionRegister'] = Extension_ExtensionRegister;
HY['Extension']['NavToolsExtension'] = Extension_NavToolsExtension;
HY['Extension']['ViewerPanelMixin'] = Extension_ViewerPanelMixin;
HY['i18n'] = i18n;
HY['Widget']['AlertBox'] = Widget_AlertBox;
HY['Widget']['Button'] = Widget_Button;
HY['Widget']['ComboButton'] = Widget_ComboButton;
HY['Widget']['ContextMenu'] = Widget_ContextMenu;
HY['Widget']['Control'] = Widget_Control;
HY['Widget']['ControlGroup'] = Widget_ControlGroup;
HY['Widget']['DockingPanel'] = Widget_DockingPanel;
HY['Widget']['GuiViewer3D'] = Widget_GuiViewer3D;
HY['Widget']['HudMessage'] = Widget_HudMessage;
HY['Widget']['LayersPanel'] = Widget_LayersPanel;
HY['Widget']['ModelStructurePanel'] = Widget_ModelStructurePanel;
HY['Widget']['ObjectContextMenu'] = Widget_ObjectContextMenu;
HY['Widget']['OptionCheckbox'] = Widget_OptionCheckbox;
HY['Widget']['OptionDropDown'] = Widget_OptionDropDown;
HY['Widget']['OptionSlider'] = Widget_OptionSlider;
HY['Widget']['ProgressBar'] = Widget_ProgressBar;
HY['Widget']['PropertyPanel'] = Widget_PropertyPanel;
HY['Widget']['RadioButtonGroup'] = Widget_RadioButtonGroup;
HY['Widget']['RenderOptionsPanel'] = Widget_RenderOptionsPanel;
HY['Widget']['SettingsPanel'] = Widget_SettingsPanel;
HY['Widget']['ToolBar'] = Widget_ToolBar;
HY['Widget']['ToolbarSID'] = Widget_ToolbarSID;
HY['Widget']['Tree'] = Widget_Tree;
HY['Widget']['TreeDelegate'] = Widget_TreeDelegate;
HY['Widget']['ViewCubeUi'] = Widget_ViewCubeUi;
HY['Widget']['Viewer3D'] = Widget_Viewer3D;
HY['Widget']['Viewer3DImpl'] = Widget_Viewer3DImpl;
HY['Widget']['ViewerLayersPanel'] = Widget_ViewerLayersPanel;
HY['Widget']['ViewerModelStructurePanel'] = Widget_ViewerModelStructurePanel;
HY['Widget']['ViewerObjectContextMenu'] = Widget_ViewerObjectContextMenu;
HY['Widget']['ViewerPropertyPanel'] = Widget_ViewerPropertyPanel;
HY['Widget']['ViewerSettingsPanel'] = Widget_ViewerSettingsPanel;
HY['Worker']['createWorker'] = Worker_createWorker;
HY['Worker']['createWorkerWithIntercept'] = Worker_createWorkerWithIntercept;
HY['Worker']['DecodeEnvMapAsync'] = Worker_DecodeEnvMapAsync;
HY['Worker']['doDecodeEnvmap'] = Worker_doDecodeEnvmap;
HY['Worker']['initWorkerScript'] = Worker_initWorkerScript;
HY['Worker']['WORKER_DATA_URL'] = Worker_WORKER_DATA_URL;
return HY;
});