define([
'./Core/Animation/Animation',
'./Core/Animation/AnimationHandler',
'./Core/Animation/AnnotationAnimation',
'./Core/Animation/CameraAnimation',
'./Core/Animation/InterpolationType',
'./Core/Animation/KeyFrameAnimator',
'./Core/Animation/MeshAnimation',
'./Core/Animation/PolylineAnimation',
'./Core/Animation/VisibilityAnimation',
'./Core/Base/ScreenModeDelegate',
'./Core/Browser',
'./Core/BubbleNode',
'./Core/BVHBuilder',
'./Core/Constants/BackgroundPresets',
'./Core/Constants/DebugEnvironments',
'./Core/Constants/DefaultSettings',
'./Core/Constants/DeviceType',
'./Core/Constants/Environment',
'./Core/Constants/Error',
'./Core/Constants/EventType',
'./Core/Constants/Global',
'./Core/Constants/KeyCode',
'./Core/Constants/LightPresets',
'./Core/Constants/LineStyleDefs',
'./Core/Constants/ModelUnits',
'./Core/Constants/PrismMaps',
'./Core/Constants/ScreenMode',
'./Core/Constants/SelectionMode',
'./Core/Constants/ViewerSettingTab',
'./Core/Controller/ApplicationScreenModeDelegate',
'./Core/Controller/Autocam',
'./Core/Controller/DefaultHandler',
'./Core/Controller/ErrorHandler',
'./Core/Controller/GestureHandler',
'./Core/Controller/HotGestureTool',
'./Core/Controller/InteractionInterceptor',
'./Core/Controller/LiveReviewClient',
'./Core/Controller/MessageClient',
'./Core/Controller/MultiModelSelector',
'./Core/Controller/MultiModelVisibilityManager',
'./Core/Controller/Navigation',
'./Core/Controller/NullScreenModeDelegate',
'./Core/Controller/OrbitDollyPanTool',
'./Core/Controller/P2PClient',
'./Core/Controller/Preferences',
'./Core/Controller/Selector',
'./Core/Controller/ToolController',
'./Core/Controller/Viewer3D',
'./Core/Controller/Viewer3DImpl',
'./Core/Controller/ViewerState',
'./Core/Controller/ViewingUtilities',
'./Core/Controller/ViewTransceiver',
'./Core/Controller/VisibilityManager',
'./Core/Document',
'./Core/DomUtils',
'./Core/EventDispatcher',
'./Core/FovTool',
'./Core/i18n',
'./Core/Inits',
'./Core/InstanceTree',
'./Core/Intersector',
'./Core/LiveReviewSession',
'./Core/Loader/F2DLoader',
'./Core/Loader/FileLoader',
'./Core/Loader/LeafletLoader',
'./Core/Loader/PropDbLoader',
'./Core/Loader/SvfLoader',
'./Core/Logger',
'./Core/Manager/FileLoaderManager',
'./Core/Manager/theExtensionManager',
'./Core/Manager/theHotkeyManager',
'./Core/Math/convertUnits',
'./Core/Math/DecodeEnvMap',
'./Core/Math/FrustumIntersector',
'./Core/Math/Half',
'./Core/Math/LmvMatrix4',
'./Core/Math/VBIntersector',
'./Core/Mixin/ExtensionMixin',
'./Core/Mixin/ScreenModeMixin',
'./Core/Mixin/ViewerPanelMixin',
'./Core/MobileCallbacks',
'./Core/Model',
'./Core/ModelIteratorBVH',
'./Core/ModelIteratorLinear',
'./Core/NodeArray',
'./Core/Polyfills',
'./Core/Renderer/FireflyWebGLProgram',
'./Core/Renderer/FireflyWebGLRenderer',
'./Core/Renderer/FireflyWebGLShader',
'./Core/Renderer/FragmentList',
'./Core/Renderer/FragmentPointer',
'./Core/Renderer/GeometryList',
'./Core/Renderer/GroundShadow',
'./Core/Renderer/MaterialManager',
'./Core/Renderer/Pass/GaussianPass',
'./Core/Renderer/Pass/LmvShaderPass',
'./Core/Renderer/RenderBatch',
'./Core/Renderer/RenderContext',
'./Core/Renderer/RenderModel',
'./Core/Renderer/RenderScene',
'./Core/Renderer/UnifiedCamera',
'./Core/Renderer/Utils/clonePrismMaterial',
'./Core/Renderer/Utils/CreateCubeMapFromColors',
'./Core/Renderer/Utils/CreateLinePatternTexture',
'./Core/Renderer/Utils/createPrismMaterial',
'./Core/Renderer/Utils/GroundReflection',
'./Core/Renderer/Utils/MaterialConverter',
'./Core/Service/loadTextureWithSecurity',
'./Core/Service/ViewingService',
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
'./Core/Shaders/FXAAShader',
'./Core/Shaders/GaussianShader',
'./Core/Shaders/GroundDepthShader',
'./Core/Shaders/GroundReflectionCompShader',
'./Core/Shaders/GroundReflectionDrawShader',
'./Core/Shaders/GroundShadowAOShader',
'./Core/Shaders/GroundShadowBlurShader',
'./Core/Shaders/GroundShadowColorShader',
'./Core/Shaders/LineShader',
'./Core/Shaders/NormalsShader',
'./Core/Shaders/PrismShader',
'./Core/Shaders/SAOBlurShader',
'./Core/Shaders/SAOMinifyFirstShader',
'./Core/Shaders/SAOMinifyShader',
'./Core/Shaders/SAOShader',
'./Core/Shaders/Uniforms/CutPlanesUniforms',
'./Core/Shaders/Uniforms/IdUniforms',
'./Core/Shaders/Uniforms/ThemingUniform',
'./Core/Shaders/WarpShader',
'./Core/SortedList',
'./Core/TexQuad',
'./Core/Tile',
'./Core/ToolInterface',
'./Core/Triangulator',
'./Core/Utils/BufferGeometryUtils',
'./Core/Utils/detectWebGL',
'./Core/Utils/formatValueWithUnits',
'./Core/Utils/FullscreenTool',
'./Core/Utils/getAndroidVersion',
'./Core/Utils/getContext',
'./Core/Utils/getParameterByName',
'./Core/Utils/getParameterByNameFromPath',
'./Core/Utils/getResourceUrl',
'./Core/Utils/getScript',
'./Core/Utils/inFullscreen',
'./Core/Utils/initWorkerScript',
'./Core/Utils/loadDependency',
'./Core/Utils/pathToURL',
'./Core/Utils/rescueFromPolymer',
'./Core/Utils/setLanguage',
'./Core/Utils/setUserName',
'./Core/Utils/stringToDOM',
'./Core/Utils/touchStartToClick',
'./Core/Utils/urlIsApiViewingOrDev',
'./Core/VertexBufferBuilder',
'./Core/VertexBufferReader',
'./Core/ViewingApplication',
'./Core/Worker/createWorker',
'./Core/Worker/createWorkerWithIntercept',
'./Core/WorldUpTool',
'./Extension/AnimationExtension',
'./Extension/Beeline/BeelineExtension',
'./Extension/Beeline/BeelineTool',
'./Extension/Billboard/BillboardExtension',
'./Extension/Billboard/BillboardTool',
'./Extension/CAM360Extension',
'./Extension/CAMModelStructurePanel',
'./Extension/Collaboration/Collaboration',
'./Extension/Collaboration/CollabPromptBox',
'./Extension/Collaboration/DockingCollabPanel',
'./Extension/Collaboration/InteractionInterceptor',
'./Extension/Collaboration/ViewTransceiver',
'./Extension/Comments/CommentFactory',
'./Extension/Comments/CommentService',
'./Extension/Comments/CommentsExtension',
'./Extension/Comments/FakeRequest',
'./Extension/DefaultTools/NavToolsExtension',
'./Extension/Extension',
'./Extension/FirstPerson/FirstPersonExtension',
'./Extension/FirstPerson/FirstPersonTool',
'./Extension/Fusion360Sim/GalleryPanel',
'./Extension/Fusion360Sim/SimModelStructurePanel',
'./Extension/Fusion360Sim/SimSetupPanel',
'./Extension/Fusion360Sim/Simulation',
'./Extension/Fusion360Sim/SimulationDef',
'./Extension/FusionOrbit/FusionOrbitExtension',
'./Extension/FusionOrbit/FusionOrbitTool',
'./Extension/FusionOrbit/html',
'./Extension/GamepadModule',
'./Extension/Hyperlink/Hyperlink',
'./Extension/Hyperlink/HyperlinkTool',
'./Extension/Markups/Clipboard',
'./Extension/Markups/CloneMarkup',
'./Extension/Markups/Constants',
'./Extension/Markups/CreateArrow',
'./Extension/Markups/CreateCircle',
'./Extension/Markups/CreateCloud',
'./Extension/Markups/CreateFreehand',
'./Extension/Markups/CreatePolycloud',
'./Extension/Markups/CreatePolyline',
'./Extension/Markups/CreateRectangle',
'./Extension/Markups/CreateText',
'./Extension/Markups/DeleteArrow',
'./Extension/Markups/DeleteCircle',
'./Extension/Markups/DeleteCloud',
'./Extension/Markups/DeleteFreehand',
'./Extension/Markups/DeletePolycloud',
'./Extension/Markups/DeletePolyline',
'./Extension/Markups/DeleteRectangle',
'./Extension/Markups/DeleteText',
'./Extension/Markups/DomElementStyle',
'./Extension/Markups/EditAction',
'./Extension/Markups/EditActionGroup',
'./Extension/Markups/EditActionManager',
'./Extension/Markups/EditFrame',
'./Extension/Markups/EditMode',
'./Extension/Markups/EditModeArrow',
'./Extension/Markups/EditModeCircle',
'./Extension/Markups/EditModeCloud',
'./Extension/Markups/EditModeFreehand',
'./Extension/Markups/EditModePolycloud',
'./Extension/Markups/EditModePolyline',
'./Extension/Markups/EditModeRectangle',
'./Extension/Markups/EditModeText',
'./Extension/Markups/EditorTextInput',
'./Extension/Markups/InputHandler',
'./Extension/Markups/Markup',
'./Extension/Markups/MarkupArrow',
'./Extension/Markups/MarkupCircle',
'./Extension/Markups/MarkupCloud',
'./Extension/Markups/MarkupFreehand',
'./Extension/Markups/MarkupPolycloud',
'./Extension/Markups/MarkupPolyline',
'./Extension/Markups/MarkupRectangle',
'./Extension/Markups/MarkupsCore',
'./Extension/Markups/MarkupsGui',
'./Extension/Markups/MarkupText',
'./Extension/Markups/MarkupTool',
'./Extension/Markups/SetArrow',
'./Extension/Markups/SetCircle',
'./Extension/Markups/SetCloud',
'./Extension/Markups/SetFreehand',
'./Extension/Markups/SetPolycloud',
'./Extension/Markups/SetPolyline',
'./Extension/Markups/SetPosition',
'./Extension/Markups/SetRectangle',
'./Extension/Markups/SetRotation',
'./Extension/Markups/SetSize',
'./Extension/Markups/SetStyle',
'./Extension/Markups/SetText',
'./Extension/Markups/Utils',
'./Extension/Measure/MeasureExtension',
'./Extension/Measure/MeasurePanel',
'./Extension/Measure/MeasureTool',
'./Extension/Measure/SNAP',
'./Extension/Measure/Snapper',
'./Extension/Oculus',
'./Extension/RaaS/RaaS',
'./Extension/RemoteControl',
'./Extension/Section/SectionExtension',
'./Extension/Section/SectionMesh',
'./Extension/Section/SectionTool',
'./Extension/SideBarUi',
'./Extension/StereoRenderContext',
'./Extension/VR/VRExtension',
'./Extension/VR/VRTool',
'./UI/Base/AlertBox',
'./UI/Base/Button',
'./UI/Base/ComboButton',
'./UI/Base/ContextMenu',
'./UI/Base/Control',
'./UI/Base/ControlGroup',
'./UI/Base/DockingPanel',
'./UI/Base/LayersPanel',
'./UI/Base/ModelStructurePanel',
'./UI/Base/ObjectContextMenu',
'./UI/Base/OptionCheckbox',
'./UI/Base/OptionDropDown',
'./UI/Base/OptionSlider',
'./UI/Base/PropertyPanel',
'./UI/Base/RadioButtonGroup',
'./UI/Base/RenderOptionsPanel',
'./UI/Base/SettingsPanel',
'./UI/Base/ToolBar',
'./UI/Base/ToolbarSID',
'./UI/Base/Tree',
'./UI/Base/TreeDelegate',
'./UI/GuiViewer3D',
'./UI/HudMessage',
'./UI/ProgressBar',
'./UI/ViewCubeUi',
'./UI/ViewerLayersPanel',
'./UI/ViewerModelStructurePanel',
'./UI/ViewerObjectContextMenu',
'./UI/ViewerPropertyPanel',
'./UI/ViewerSettingsPanel'], function(
Core_Animation_Animation,
Core_Animation_AnimationHandler,
Core_Animation_AnnotationAnimation,
Core_Animation_CameraAnimation,
Core_Animation_InterpolationType,
Core_Animation_KeyFrameAnimator,
Core_Animation_MeshAnimation,
Core_Animation_PolylineAnimation,
Core_Animation_VisibilityAnimation,
Core_Base_ScreenModeDelegate,
Core_Browser,
Core_BubbleNode,
Core_BVHBuilder,
Core_Constants_BackgroundPresets,
Core_Constants_DebugEnvironments,
Core_Constants_DefaultSettings,
Core_Constants_DeviceType,
Core_Constants_Environment,
Core_Constants_Error,
Core_Constants_EventType,
Core_Constants_Global,
Core_Constants_KeyCode,
Core_Constants_LightPresets,
Core_Constants_LineStyleDefs,
Core_Constants_ModelUnits,
Core_Constants_PrismMaps,
Core_Constants_ScreenMode,
Core_Constants_SelectionMode,
Core_Constants_ViewerSettingTab,
Core_Controller_ApplicationScreenModeDelegate,
Core_Controller_Autocam,
Core_Controller_DefaultHandler,
Core_Controller_ErrorHandler,
Core_Controller_GestureHandler,
Core_Controller_HotGestureTool,
Core_Controller_InteractionInterceptor,
Core_Controller_LiveReviewClient,
Core_Controller_MessageClient,
Core_Controller_MultiModelSelector,
Core_Controller_MultiModelVisibilityManager,
Core_Controller_Navigation,
Core_Controller_NullScreenModeDelegate,
Core_Controller_OrbitDollyPanTool,
Core_Controller_P2PClient,
Core_Controller_Preferences,
Core_Controller_Selector,
Core_Controller_ToolController,
Core_Controller_Viewer3D,
Core_Controller_Viewer3DImpl,
Core_Controller_ViewerState,
Core_Controller_ViewingUtilities,
Core_Controller_ViewTransceiver,
Core_Controller_VisibilityManager,
Core_Document,
Core_DomUtils,
Core_EventDispatcher,
Core_FovTool,
Core_i18n,
Core_Inits,
Core_InstanceTree,
Core_Intersector,
Core_LiveReviewSession,
Core_Loader_F2DLoader,
Core_Loader_FileLoader,
Core_Loader_LeafletLoader,
Core_Loader_PropDbLoader,
Core_Loader_SvfLoader,
Core_Logger,
Core_Manager_FileLoaderManager,
Core_Manager_theExtensionManager,
Core_Manager_theHotkeyManager,
Core_Math_convertUnits,
Core_Math_DecodeEnvMap,
Core_Math_FrustumIntersector,
Core_Math_Half,
Core_Math_LmvMatrix4,
Core_Math_VBIntersector,
Core_Mixin_ExtensionMixin,
Core_Mixin_ScreenModeMixin,
Core_Mixin_ViewerPanelMixin,
Core_MobileCallbacks,
Core_Model,
Core_ModelIteratorBVH,
Core_ModelIteratorLinear,
Core_NodeArray,
Core_Polyfills,
Core_Renderer_FireflyWebGLProgram,
Core_Renderer_FireflyWebGLRenderer,
Core_Renderer_FireflyWebGLShader,
Core_Renderer_FragmentList,
Core_Renderer_FragmentPointer,
Core_Renderer_GeometryList,
Core_Renderer_GroundShadow,
Core_Renderer_MaterialManager,
Core_Renderer_Pass_GaussianPass,
Core_Renderer_Pass_LmvShaderPass,
Core_Renderer_RenderBatch,
Core_Renderer_RenderContext,
Core_Renderer_RenderModel,
Core_Renderer_RenderScene,
Core_Renderer_UnifiedCamera,
Core_Renderer_Utils_clonePrismMaterial,
Core_Renderer_Utils_CreateCubeMapFromColors,
Core_Renderer_Utils_CreateLinePatternTexture,
Core_Renderer_Utils_createPrismMaterial,
Core_Renderer_Utils_GroundReflection,
Core_Renderer_Utils_MaterialConverter,
Core_Service_loadTextureWithSecurity,
Core_Service_ViewingService,
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
Core_Shaders_FXAAShader,
Core_Shaders_GaussianShader,
Core_Shaders_GroundDepthShader,
Core_Shaders_GroundReflectionCompShader,
Core_Shaders_GroundReflectionDrawShader,
Core_Shaders_GroundShadowAOShader,
Core_Shaders_GroundShadowBlurShader,
Core_Shaders_GroundShadowColorShader,
Core_Shaders_LineShader,
Core_Shaders_NormalsShader,
Core_Shaders_PrismShader,
Core_Shaders_SAOBlurShader,
Core_Shaders_SAOMinifyFirstShader,
Core_Shaders_SAOMinifyShader,
Core_Shaders_SAOShader,
Core_Shaders_Uniforms_CutPlanesUniforms,
Core_Shaders_Uniforms_IdUniforms,
Core_Shaders_Uniforms_ThemingUniform,
Core_Shaders_WarpShader,
Core_SortedList,
Core_TexQuad,
Core_Tile,
Core_ToolInterface,
Core_Triangulator,
Core_Utils_BufferGeometryUtils,
Core_Utils_detectWebGL,
Core_Utils_formatValueWithUnits,
Core_Utils_FullscreenTool,
Core_Utils_getAndroidVersion,
Core_Utils_getContext,
Core_Utils_getParameterByName,
Core_Utils_getParameterByNameFromPath,
Core_Utils_getResourceUrl,
Core_Utils_getScript,
Core_Utils_inFullscreen,
Core_Utils_initWorkerScript,
Core_Utils_loadDependency,
Core_Utils_pathToURL,
Core_Utils_rescueFromPolymer,
Core_Utils_setLanguage,
Core_Utils_setUserName,
Core_Utils_stringToDOM,
Core_Utils_touchStartToClick,
Core_Utils_urlIsApiViewingOrDev,
Core_VertexBufferBuilder,
Core_VertexBufferReader,
Core_ViewingApplication,
Core_Worker_createWorker,
Core_Worker_createWorkerWithIntercept,
Core_WorldUpTool,
Extension_AnimationExtension,
Extension_Beeline_BeelineExtension,
Extension_Beeline_BeelineTool,
Extension_Billboard_BillboardExtension,
Extension_Billboard_BillboardTool,
Extension_CAM36_Extension,
Extension_CAMModelStructurePanel,
Extension_Collaboration_Collaboration,
Extension_Collaboration_CollabPromptBox,
Extension_Collaboration_DockingCollabPanel,
Extension_Collaboration_InteractionInterceptor,
Extension_Collaboration_ViewTransceiver,
Extension_Comments_CommentFactory,
Extension_Comments_CommentService,
Extension_Comments_CommentsExtension,
Extension_Comments_FakeRequest,
Extension_DefaultTools_NavToolsExtension,
Extension_Extension,
Extension_FirstPerson_FirstPersonExtension,
Extension_FirstPerson_FirstPersonTool,
Extension_Fusion36_Sim_GalleryPanel,
Extension_Fusion36_Sim_SimModelStructurePanel,
Extension_Fusion36_Sim_SimSetupPanel,
Extension_Fusion36_Sim_Simulation,
Extension_Fusion36_Sim_SimulationDef,
Extension_FusionOrbit_FusionOrbitExtension,
Extension_FusionOrbit_FusionOrbitTool,
Extension_FusionOrbit_html,
Extension_GamepadModule,
Extension_Hyperlink_Hyperlink,
Extension_Hyperlink_HyperlinkTool,
Extension_Markups_Clipboard,
Extension_Markups_CloneMarkup,
Extension_Markups_Constants,
Extension_Markups_CreateArrow,
Extension_Markups_CreateCircle,
Extension_Markups_CreateCloud,
Extension_Markups_CreateFreehand,
Extension_Markups_CreatePolycloud,
Extension_Markups_CreatePolyline,
Extension_Markups_CreateRectangle,
Extension_Markups_CreateText,
Extension_Markups_DeleteArrow,
Extension_Markups_DeleteCircle,
Extension_Markups_DeleteCloud,
Extension_Markups_DeleteFreehand,
Extension_Markups_DeletePolycloud,
Extension_Markups_DeletePolyline,
Extension_Markups_DeleteRectangle,
Extension_Markups_DeleteText,
Extension_Markups_DomElementStyle,
Extension_Markups_EditAction,
Extension_Markups_EditActionGroup,
Extension_Markups_EditActionManager,
Extension_Markups_EditFrame,
Extension_Markups_EditMode,
Extension_Markups_EditModeArrow,
Extension_Markups_EditModeCircle,
Extension_Markups_EditModeCloud,
Extension_Markups_EditModeFreehand,
Extension_Markups_EditModePolycloud,
Extension_Markups_EditModePolyline,
Extension_Markups_EditModeRectangle,
Extension_Markups_EditModeText,
Extension_Markups_EditorTextInput,
Extension_Markups_InputHandler,
Extension_Markups_Markup,
Extension_Markups_MarkupArrow,
Extension_Markups_MarkupCircle,
Extension_Markups_MarkupCloud,
Extension_Markups_MarkupFreehand,
Extension_Markups_MarkupPolycloud,
Extension_Markups_MarkupPolyline,
Extension_Markups_MarkupRectangle,
Extension_Markups_MarkupsCore,
Extension_Markups_MarkupsGui,
Extension_Markups_MarkupText,
Extension_Markups_MarkupTool,
Extension_Markups_SetArrow,
Extension_Markups_SetCircle,
Extension_Markups_SetCloud,
Extension_Markups_SetFreehand,
Extension_Markups_SetPolycloud,
Extension_Markups_SetPolyline,
Extension_Markups_SetPosition,
Extension_Markups_SetRectangle,
Extension_Markups_SetRotation,
Extension_Markups_SetSize,
Extension_Markups_SetStyle,
Extension_Markups_SetText,
Extension_Markups_Utils,
Extension_Measure_MeasureExtension,
Extension_Measure_MeasurePanel,
Extension_Measure_MeasureTool,
Extension_Measure_SNAP,
Extension_Measure_Snapper,
Extension_Oculus,
Extension_RaaS_RaaS,
Extension_RemoteControl,
Extension_Section_SectionExtension,
Extension_Section_SectionMesh,
Extension_Section_SectionTool,
Extension_SideBarUi,
Extension_StereoRenderContext,
Extension_VR_VRExtension,
Extension_VR_VRTool,
UI_Base_AlertBox,
UI_Base_Button,
UI_Base_ComboButton,
UI_Base_ContextMenu,
UI_Base_Control,
UI_Base_ControlGroup,
UI_Base_DockingPanel,
UI_Base_LayersPanel,
UI_Base_ModelStructurePanel,
UI_Base_ObjectContextMenu,
UI_Base_OptionCheckbox,
UI_Base_OptionDropDown,
UI_Base_OptionSlider,
UI_Base_PropertyPanel,
UI_Base_RadioButtonGroup,
UI_Base_RenderOptionsPanel,
UI_Base_SettingsPanel,
UI_Base_ToolBar,
UI_Base_ToolbarSID,
UI_Base_Tree,
UI_Base_TreeDelegate,
UI_GuiViewer3D,
UI_HudMessage,
UI_ProgressBar,
UI_ViewCubeUi,
UI_ViewerLayersPanel,
UI_ViewerModelStructurePanel,
UI_ViewerObjectContextMenu,
UI_ViewerPropertyPanel,
UI_ViewerSettingsPanel) {
var HY = {};
HY['Core'] = {};
HY['Core']['Animation'] = {};
HY['Core']['Base'] = {};
HY['Core']['Constants'] = {};
HY['Core']['Controller'] = {};
HY['Core']['Loader'] = {};
HY['Core']['Manager'] = {};
HY['Core']['Math'] = {};
HY['Core']['Mixin'] = {};
HY['Core']['Renderer'] = {};
HY['Core']['Renderer']['Pass'] = {};
HY['Core']['Renderer']['Utils'] = {};
HY['Core']['Service'] = {};
HY['Core']['Shaders'] = {};
HY['Core']['Shaders']['Chunks'] = {};
HY['Core']['Shaders']['Declarations'] = {};
HY['Core']['Shaders']['Uniforms'] = {};
HY['Core']['Utils'] = {};
HY['Core']['Worker'] = {};
HY['Extension'] = {};
HY['Extension']['Beeline'] = {};
HY['Extension']['Billboard'] = {};
HY['Extension']['Collaboration'] = {};
HY['Extension']['Comments'] = {};
HY['Extension']['DefaultTools'] = {};
HY['Extension']['FirstPerson'] = {};
HY['Extension']['Fusion360Sim'] = {};
HY['Extension']['FusionOrbit'] = {};
HY['Extension']['Hyperlink'] = {};
HY['Extension']['Markups'] = {};
HY['Extension']['Measure'] = {};
HY['Extension']['RaaS'] = {};
HY['Extension']['Section'] = {};
HY['Extension']['VR'] = {};
HY['UI'] = {};
HY['UI']['Base'] = {};
HY['Core']['Animation']['Animation'] = Core_Animation_Animation;
HY['Core']['Animation']['AnimationHandler'] = Core_Animation_AnimationHandler;
HY['Core']['Animation']['AnnotationAnimation'] = Core_Animation_AnnotationAnimation;
HY['Core']['Animation']['CameraAnimation'] = Core_Animation_CameraAnimation;
HY['Core']['Animation']['InterpolationType'] = Core_Animation_InterpolationType;
HY['Core']['Animation']['KeyFrameAnimator'] = Core_Animation_KeyFrameAnimator;
HY['Core']['Animation']['MeshAnimation'] = Core_Animation_MeshAnimation;
HY['Core']['Animation']['PolylineAnimation'] = Core_Animation_PolylineAnimation;
HY['Core']['Animation']['VisibilityAnimation'] = Core_Animation_VisibilityAnimation;
HY['Core']['Base']['ScreenModeDelegate'] = Core_Base_ScreenModeDelegate;
HY['Core']['Browser'] = Core_Browser;
HY['Core']['BubbleNode'] = Core_BubbleNode;
HY['Core']['BVHBuilder'] = Core_BVHBuilder;
HY['Core']['Constants']['BackgroundPresets'] = Core_Constants_BackgroundPresets;
HY['Core']['Constants']['DebugEnvironments'] = Core_Constants_DebugEnvironments;
HY['Core']['Constants']['DefaultSettings'] = Core_Constants_DefaultSettings;
HY['Core']['Constants']['DeviceType'] = Core_Constants_DeviceType;
HY['Core']['Constants']['Environment'] = Core_Constants_Environment;
HY['Core']['Constants']['Error'] = Core_Constants_Error;
HY['Core']['Constants']['EventType'] = Core_Constants_EventType;
HY['Core']['Constants']['Global'] = Core_Constants_Global;
HY['Core']['Constants']['KeyCode'] = Core_Constants_KeyCode;
HY['Core']['Constants']['LightPresets'] = Core_Constants_LightPresets;
HY['Core']['Constants']['LineStyleDefs'] = Core_Constants_LineStyleDefs;
HY['Core']['Constants']['ModelUnits'] = Core_Constants_ModelUnits;
HY['Core']['Constants']['PrismMaps'] = Core_Constants_PrismMaps;
HY['Core']['Constants']['ScreenMode'] = Core_Constants_ScreenMode;
HY['Core']['Constants']['SelectionMode'] = Core_Constants_SelectionMode;
HY['Core']['Constants']['ViewerSettingTab'] = Core_Constants_ViewerSettingTab;
HY['Core']['Controller']['ApplicationScreenModeDelegate'] = Core_Controller_ApplicationScreenModeDelegate;
HY['Core']['Controller']['Autocam'] = Core_Controller_Autocam;
HY['Core']['Controller']['DefaultHandler'] = Core_Controller_DefaultHandler;
HY['Core']['Controller']['ErrorHandler'] = Core_Controller_ErrorHandler;
HY['Core']['Controller']['GestureHandler'] = Core_Controller_GestureHandler;
HY['Core']['Controller']['HotGestureTool'] = Core_Controller_HotGestureTool;
HY['Core']['Controller']['InteractionInterceptor'] = Core_Controller_InteractionInterceptor;
HY['Core']['Controller']['LiveReviewClient'] = Core_Controller_LiveReviewClient;
HY['Core']['Controller']['MessageClient'] = Core_Controller_MessageClient;
HY['Core']['Controller']['MultiModelSelector'] = Core_Controller_MultiModelSelector;
HY['Core']['Controller']['MultiModelVisibilityManager'] = Core_Controller_MultiModelVisibilityManager;
HY['Core']['Controller']['Navigation'] = Core_Controller_Navigation;
HY['Core']['Controller']['NullScreenModeDelegate'] = Core_Controller_NullScreenModeDelegate;
HY['Core']['Controller']['OrbitDollyPanTool'] = Core_Controller_OrbitDollyPanTool;
HY['Core']['Controller']['P2PClient'] = Core_Controller_P2PClient;
HY['Core']['Controller']['Preferences'] = Core_Controller_Preferences;
HY['Core']['Controller']['Selector'] = Core_Controller_Selector;
HY['Core']['Controller']['ToolController'] = Core_Controller_ToolController;
HY['Core']['Controller']['Viewer3D'] = Core_Controller_Viewer3D;
HY['Core']['Controller']['Viewer3DImpl'] = Core_Controller_Viewer3DImpl;
HY['Core']['Controller']['ViewerState'] = Core_Controller_ViewerState;
HY['Core']['Controller']['ViewingUtilities'] = Core_Controller_ViewingUtilities;
HY['Core']['Controller']['ViewTransceiver'] = Core_Controller_ViewTransceiver;
HY['Core']['Controller']['VisibilityManager'] = Core_Controller_VisibilityManager;
HY['Core']['Document'] = Core_Document;
HY['Core']['DomUtils'] = Core_DomUtils;
HY['Core']['EventDispatcher'] = Core_EventDispatcher;
HY['Core']['FovTool'] = Core_FovTool;
HY['Core']['i18n'] = Core_i18n;
HY['Core']['Inits'] = Core_Inits;
HY['Core']['InstanceTree'] = Core_InstanceTree;
HY['Core']['Intersector'] = Core_Intersector;
HY['Core']['LiveReviewSession'] = Core_LiveReviewSession;
HY['Core']['Loader']['F2DLoader'] = Core_Loader_F2DLoader;
HY['Core']['Loader']['FileLoader'] = Core_Loader_FileLoader;
HY['Core']['Loader']['LeafletLoader'] = Core_Loader_LeafletLoader;
HY['Core']['Loader']['PropDbLoader'] = Core_Loader_PropDbLoader;
HY['Core']['Loader']['SvfLoader'] = Core_Loader_SvfLoader;
HY['Core']['Logger'] = Core_Logger;
HY['Core']['Manager']['FileLoaderManager'] = Core_Manager_FileLoaderManager;
HY['Core']['Manager']['theExtensionManager'] = Core_Manager_theExtensionManager;
HY['Core']['Manager']['theHotkeyManager'] = Core_Manager_theHotkeyManager;
HY['Core']['Math']['convertUnits'] = Core_Math_convertUnits;
HY['Core']['Math']['DecodeEnvMap'] = Core_Math_DecodeEnvMap;
HY['Core']['Math']['FrustumIntersector'] = Core_Math_FrustumIntersector;
HY['Core']['Math']['Half'] = Core_Math_Half;
HY['Core']['Math']['LmvMatrix4'] = Core_Math_LmvMatrix4;
HY['Core']['Math']['VBIntersector'] = Core_Math_VBIntersector;
HY['Core']['Mixin']['ExtensionMixin'] = Core_Mixin_ExtensionMixin;
HY['Core']['Mixin']['ScreenModeMixin'] = Core_Mixin_ScreenModeMixin;
HY['Core']['Mixin']['ViewerPanelMixin'] = Core_Mixin_ViewerPanelMixin;
HY['Core']['MobileCallbacks'] = Core_MobileCallbacks;
HY['Core']['Model'] = Core_Model;
HY['Core']['ModelIteratorBVH'] = Core_ModelIteratorBVH;
HY['Core']['ModelIteratorLinear'] = Core_ModelIteratorLinear;
HY['Core']['NodeArray'] = Core_NodeArray;
HY['Core']['Polyfills'] = Core_Polyfills;
HY['Core']['Renderer']['FireflyWebGLProgram'] = Core_Renderer_FireflyWebGLProgram;
HY['Core']['Renderer']['FireflyWebGLRenderer'] = Core_Renderer_FireflyWebGLRenderer;
HY['Core']['Renderer']['FireflyWebGLShader'] = Core_Renderer_FireflyWebGLShader;
HY['Core']['Renderer']['FragmentList'] = Core_Renderer_FragmentList;
HY['Core']['Renderer']['FragmentPointer'] = Core_Renderer_FragmentPointer;
HY['Core']['Renderer']['GeometryList'] = Core_Renderer_GeometryList;
HY['Core']['Renderer']['GroundShadow'] = Core_Renderer_GroundShadow;
HY['Core']['Renderer']['MaterialManager'] = Core_Renderer_MaterialManager;
HY['Core']['Renderer']['Pass']['GaussianPass'] = Core_Renderer_Pass_GaussianPass;
HY['Core']['Renderer']['Pass']['LmvShaderPass'] = Core_Renderer_Pass_LmvShaderPass;
HY['Core']['Renderer']['RenderBatch'] = Core_Renderer_RenderBatch;
HY['Core']['Renderer']['RenderContext'] = Core_Renderer_RenderContext;
HY['Core']['Renderer']['RenderModel'] = Core_Renderer_RenderModel;
HY['Core']['Renderer']['RenderScene'] = Core_Renderer_RenderScene;
HY['Core']['Renderer']['UnifiedCamera'] = Core_Renderer_UnifiedCamera;
HY['Core']['Renderer']['Utils']['clonePrismMaterial'] = Core_Renderer_Utils_clonePrismMaterial;
HY['Core']['Renderer']['Utils']['CreateCubeMapFromColors'] = Core_Renderer_Utils_CreateCubeMapFromColors;
HY['Core']['Renderer']['Utils']['CreateLinePatternTexture'] = Core_Renderer_Utils_CreateLinePatternTexture;
HY['Core']['Renderer']['Utils']['createPrismMaterial'] = Core_Renderer_Utils_createPrismMaterial;
HY['Core']['Renderer']['Utils']['GroundReflection'] = Core_Renderer_Utils_GroundReflection;
HY['Core']['Renderer']['Utils']['MaterialConverter'] = Core_Renderer_Utils_MaterialConverter;
HY['Core']['Service']['loadTextureWithSecurity'] = Core_Service_loadTextureWithSecurity;
HY['Core']['Service']['ViewingService'] = Core_Service_ViewingService;
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
HY['Core']['Shaders']['FXAAShader'] = Core_Shaders_FXAAShader;
HY['Core']['Shaders']['GaussianShader'] = Core_Shaders_GaussianShader;
HY['Core']['Shaders']['GroundDepthShader'] = Core_Shaders_GroundDepthShader;
HY['Core']['Shaders']['GroundReflectionCompShader'] = Core_Shaders_GroundReflectionCompShader;
HY['Core']['Shaders']['GroundReflectionDrawShader'] = Core_Shaders_GroundReflectionDrawShader;
HY['Core']['Shaders']['GroundShadowAOShader'] = Core_Shaders_GroundShadowAOShader;
HY['Core']['Shaders']['GroundShadowBlurShader'] = Core_Shaders_GroundShadowBlurShader;
HY['Core']['Shaders']['GroundShadowColorShader'] = Core_Shaders_GroundShadowColorShader;
HY['Core']['Shaders']['LineShader'] = Core_Shaders_LineShader;
HY['Core']['Shaders']['NormalsShader'] = Core_Shaders_NormalsShader;
HY['Core']['Shaders']['PrismShader'] = Core_Shaders_PrismShader;
HY['Core']['Shaders']['SAOBlurShader'] = Core_Shaders_SAOBlurShader;
HY['Core']['Shaders']['SAOMinifyFirstShader'] = Core_Shaders_SAOMinifyFirstShader;
HY['Core']['Shaders']['SAOMinifyShader'] = Core_Shaders_SAOMinifyShader;
HY['Core']['Shaders']['SAOShader'] = Core_Shaders_SAOShader;
HY['Core']['Shaders']['Uniforms']['CutPlanesUniforms'] = Core_Shaders_Uniforms_CutPlanesUniforms;
HY['Core']['Shaders']['Uniforms']['IdUniforms'] = Core_Shaders_Uniforms_IdUniforms;
HY['Core']['Shaders']['Uniforms']['ThemingUniform'] = Core_Shaders_Uniforms_ThemingUniform;
HY['Core']['Shaders']['WarpShader'] = Core_Shaders_WarpShader;
HY['Core']['SortedList'] = Core_SortedList;
HY['Core']['TexQuad'] = Core_TexQuad;
HY['Core']['Tile'] = Core_Tile;
HY['Core']['ToolInterface'] = Core_ToolInterface;
HY['Core']['Triangulator'] = Core_Triangulator;
HY['Core']['Utils']['BufferGeometryUtils'] = Core_Utils_BufferGeometryUtils;
HY['Core']['Utils']['detectWebGL'] = Core_Utils_detectWebGL;
HY['Core']['Utils']['formatValueWithUnits'] = Core_Utils_formatValueWithUnits;
HY['Core']['Utils']['FullscreenTool'] = Core_Utils_FullscreenTool;
HY['Core']['Utils']['getAndroidVersion'] = Core_Utils_getAndroidVersion;
HY['Core']['Utils']['getContext'] = Core_Utils_getContext;
HY['Core']['Utils']['getParameterByName'] = Core_Utils_getParameterByName;
HY['Core']['Utils']['getParameterByNameFromPath'] = Core_Utils_getParameterByNameFromPath;
HY['Core']['Utils']['getResourceUrl'] = Core_Utils_getResourceUrl;
HY['Core']['Utils']['getScript'] = Core_Utils_getScript;
HY['Core']['Utils']['inFullscreen'] = Core_Utils_inFullscreen;
HY['Core']['Utils']['initWorkerScript'] = Core_Utils_initWorkerScript;
HY['Core']['Utils']['loadDependency'] = Core_Utils_loadDependency;
HY['Core']['Utils']['pathToURL'] = Core_Utils_pathToURL;
HY['Core']['Utils']['rescueFromPolymer'] = Core_Utils_rescueFromPolymer;
HY['Core']['Utils']['setLanguage'] = Core_Utils_setLanguage;
HY['Core']['Utils']['setUserName'] = Core_Utils_setUserName;
HY['Core']['Utils']['stringToDOM'] = Core_Utils_stringToDOM;
HY['Core']['Utils']['touchStartToClick'] = Core_Utils_touchStartToClick;
HY['Core']['Utils']['urlIsApiViewingOrDev'] = Core_Utils_urlIsApiViewingOrDev;
HY['Core']['VertexBufferBuilder'] = Core_VertexBufferBuilder;
HY['Core']['VertexBufferReader'] = Core_VertexBufferReader;
HY['Core']['ViewingApplication'] = Core_ViewingApplication;
HY['Core']['Worker']['createWorker'] = Core_Worker_createWorker;
HY['Core']['Worker']['createWorkerWithIntercept'] = Core_Worker_createWorkerWithIntercept;
HY['Core']['WorldUpTool'] = Core_WorldUpTool;
HY['Extension']['AnimationExtension'] = Extension_AnimationExtension;
HY['Extension']['Beeline']['BeelineExtension'] = Extension_Beeline_BeelineExtension;
HY['Extension']['Beeline']['BeelineTool'] = Extension_Beeline_BeelineTool;
HY['Extension']['Billboard']['BillboardExtension'] = Extension_Billboard_BillboardExtension;
HY['Extension']['Billboard']['BillboardTool'] = Extension_Billboard_BillboardTool;
HY['Extension']['CAM360Extension'] = Extension_CAM36_Extension;
HY['Extension']['CAMModelStructurePanel'] = Extension_CAMModelStructurePanel;
HY['Extension']['Collaboration']['Collaboration'] = Extension_Collaboration_Collaboration;
HY['Extension']['Collaboration']['CollabPromptBox'] = Extension_Collaboration_CollabPromptBox;
HY['Extension']['Collaboration']['DockingCollabPanel'] = Extension_Collaboration_DockingCollabPanel;
HY['Extension']['Collaboration']['InteractionInterceptor'] = Extension_Collaboration_InteractionInterceptor;
HY['Extension']['Collaboration']['ViewTransceiver'] = Extension_Collaboration_ViewTransceiver;
HY['Extension']['Comments']['CommentFactory'] = Extension_Comments_CommentFactory;
HY['Extension']['Comments']['CommentService'] = Extension_Comments_CommentService;
HY['Extension']['Comments']['CommentsExtension'] = Extension_Comments_CommentsExtension;
HY['Extension']['Comments']['FakeRequest'] = Extension_Comments_FakeRequest;
HY['Extension']['DefaultTools']['NavToolsExtension'] = Extension_DefaultTools_NavToolsExtension;
HY['Extension']['Extension'] = Extension_Extension;
HY['Extension']['FirstPerson']['FirstPersonExtension'] = Extension_FirstPerson_FirstPersonExtension;
HY['Extension']['FirstPerson']['FirstPersonTool'] = Extension_FirstPerson_FirstPersonTool;
HY['Extension']['Fusion360Sim']['GalleryPanel'] = Extension_Fusion36_Sim_GalleryPanel;
HY['Extension']['Fusion360Sim']['SimModelStructurePanel'] = Extension_Fusion36_Sim_SimModelStructurePanel;
HY['Extension']['Fusion360Sim']['SimSetupPanel'] = Extension_Fusion36_Sim_SimSetupPanel;
HY['Extension']['Fusion360Sim']['Simulation'] = Extension_Fusion36_Sim_Simulation;
HY['Extension']['Fusion360Sim']['SimulationDef'] = Extension_Fusion36_Sim_SimulationDef;
HY['Extension']['FusionOrbit']['FusionOrbitExtension'] = Extension_FusionOrbit_FusionOrbitExtension;
HY['Extension']['FusionOrbit']['FusionOrbitTool'] = Extension_FusionOrbit_FusionOrbitTool;
HY['Extension']['FusionOrbit']['html'] = Extension_FusionOrbit_html;
HY['Extension']['GamepadModule'] = Extension_GamepadModule;
HY['Extension']['Hyperlink']['Hyperlink'] = Extension_Hyperlink_Hyperlink;
HY['Extension']['Hyperlink']['HyperlinkTool'] = Extension_Hyperlink_HyperlinkTool;
HY['Extension']['Markups']['Clipboard'] = Extension_Markups_Clipboard;
HY['Extension']['Markups']['CloneMarkup'] = Extension_Markups_CloneMarkup;
HY['Extension']['Markups']['Constants'] = Extension_Markups_Constants;
HY['Extension']['Markups']['CreateArrow'] = Extension_Markups_CreateArrow;
HY['Extension']['Markups']['CreateCircle'] = Extension_Markups_CreateCircle;
HY['Extension']['Markups']['CreateCloud'] = Extension_Markups_CreateCloud;
HY['Extension']['Markups']['CreateFreehand'] = Extension_Markups_CreateFreehand;
HY['Extension']['Markups']['CreatePolycloud'] = Extension_Markups_CreatePolycloud;
HY['Extension']['Markups']['CreatePolyline'] = Extension_Markups_CreatePolyline;
HY['Extension']['Markups']['CreateRectangle'] = Extension_Markups_CreateRectangle;
HY['Extension']['Markups']['CreateText'] = Extension_Markups_CreateText;
HY['Extension']['Markups']['DeleteArrow'] = Extension_Markups_DeleteArrow;
HY['Extension']['Markups']['DeleteCircle'] = Extension_Markups_DeleteCircle;
HY['Extension']['Markups']['DeleteCloud'] = Extension_Markups_DeleteCloud;
HY['Extension']['Markups']['DeleteFreehand'] = Extension_Markups_DeleteFreehand;
HY['Extension']['Markups']['DeletePolycloud'] = Extension_Markups_DeletePolycloud;
HY['Extension']['Markups']['DeletePolyline'] = Extension_Markups_DeletePolyline;
HY['Extension']['Markups']['DeleteRectangle'] = Extension_Markups_DeleteRectangle;
HY['Extension']['Markups']['DeleteText'] = Extension_Markups_DeleteText;
HY['Extension']['Markups']['DomElementStyle'] = Extension_Markups_DomElementStyle;
HY['Extension']['Markups']['EditAction'] = Extension_Markups_EditAction;
HY['Extension']['Markups']['EditActionGroup'] = Extension_Markups_EditActionGroup;
HY['Extension']['Markups']['EditActionManager'] = Extension_Markups_EditActionManager;
HY['Extension']['Markups']['EditFrame'] = Extension_Markups_EditFrame;
HY['Extension']['Markups']['EditMode'] = Extension_Markups_EditMode;
HY['Extension']['Markups']['EditModeArrow'] = Extension_Markups_EditModeArrow;
HY['Extension']['Markups']['EditModeCircle'] = Extension_Markups_EditModeCircle;
HY['Extension']['Markups']['EditModeCloud'] = Extension_Markups_EditModeCloud;
HY['Extension']['Markups']['EditModeFreehand'] = Extension_Markups_EditModeFreehand;
HY['Extension']['Markups']['EditModePolycloud'] = Extension_Markups_EditModePolycloud;
HY['Extension']['Markups']['EditModePolyline'] = Extension_Markups_EditModePolyline;
HY['Extension']['Markups']['EditModeRectangle'] = Extension_Markups_EditModeRectangle;
HY['Extension']['Markups']['EditModeText'] = Extension_Markups_EditModeText;
HY['Extension']['Markups']['EditorTextInput'] = Extension_Markups_EditorTextInput;
HY['Extension']['Markups']['InputHandler'] = Extension_Markups_InputHandler;
HY['Extension']['Markups']['Markup'] = Extension_Markups_Markup;
HY['Extension']['Markups']['MarkupArrow'] = Extension_Markups_MarkupArrow;
HY['Extension']['Markups']['MarkupCircle'] = Extension_Markups_MarkupCircle;
HY['Extension']['Markups']['MarkupCloud'] = Extension_Markups_MarkupCloud;
HY['Extension']['Markups']['MarkupFreehand'] = Extension_Markups_MarkupFreehand;
HY['Extension']['Markups']['MarkupPolycloud'] = Extension_Markups_MarkupPolycloud;
HY['Extension']['Markups']['MarkupPolyline'] = Extension_Markups_MarkupPolyline;
HY['Extension']['Markups']['MarkupRectangle'] = Extension_Markups_MarkupRectangle;
HY['Extension']['Markups']['MarkupsCore'] = Extension_Markups_MarkupsCore;
HY['Extension']['Markups']['MarkupsGui'] = Extension_Markups_MarkupsGui;
HY['Extension']['Markups']['MarkupText'] = Extension_Markups_MarkupText;
HY['Extension']['Markups']['MarkupTool'] = Extension_Markups_MarkupTool;
HY['Extension']['Markups']['SetArrow'] = Extension_Markups_SetArrow;
HY['Extension']['Markups']['SetCircle'] = Extension_Markups_SetCircle;
HY['Extension']['Markups']['SetCloud'] = Extension_Markups_SetCloud;
HY['Extension']['Markups']['SetFreehand'] = Extension_Markups_SetFreehand;
HY['Extension']['Markups']['SetPolycloud'] = Extension_Markups_SetPolycloud;
HY['Extension']['Markups']['SetPolyline'] = Extension_Markups_SetPolyline;
HY['Extension']['Markups']['SetPosition'] = Extension_Markups_SetPosition;
HY['Extension']['Markups']['SetRectangle'] = Extension_Markups_SetRectangle;
HY['Extension']['Markups']['SetRotation'] = Extension_Markups_SetRotation;
HY['Extension']['Markups']['SetSize'] = Extension_Markups_SetSize;
HY['Extension']['Markups']['SetStyle'] = Extension_Markups_SetStyle;
HY['Extension']['Markups']['SetText'] = Extension_Markups_SetText;
HY['Extension']['Markups']['Utils'] = Extension_Markups_Utils;
HY['Extension']['Measure']['MeasureExtension'] = Extension_Measure_MeasureExtension;
HY['Extension']['Measure']['MeasurePanel'] = Extension_Measure_MeasurePanel;
HY['Extension']['Measure']['MeasureTool'] = Extension_Measure_MeasureTool;
HY['Extension']['Measure']['SNAP'] = Extension_Measure_SNAP;
HY['Extension']['Measure']['Snapper'] = Extension_Measure_Snapper;
HY['Extension']['Oculus'] = Extension_Oculus;
HY['Extension']['RaaS']['RaaS'] = Extension_RaaS_RaaS;
HY['Extension']['RemoteControl'] = Extension_RemoteControl;
HY['Extension']['Section']['SectionExtension'] = Extension_Section_SectionExtension;
HY['Extension']['Section']['SectionMesh'] = Extension_Section_SectionMesh;
HY['Extension']['Section']['SectionTool'] = Extension_Section_SectionTool;
HY['Extension']['SideBarUi'] = Extension_SideBarUi;
HY['Extension']['StereoRenderContext'] = Extension_StereoRenderContext;
HY['Extension']['VR']['VRExtension'] = Extension_VR_VRExtension;
HY['Extension']['VR']['VRTool'] = Extension_VR_VRTool;
HY['UI']['Base']['AlertBox'] = UI_Base_AlertBox;
HY['UI']['Base']['Button'] = UI_Base_Button;
HY['UI']['Base']['ComboButton'] = UI_Base_ComboButton;
HY['UI']['Base']['ContextMenu'] = UI_Base_ContextMenu;
HY['UI']['Base']['Control'] = UI_Base_Control;
HY['UI']['Base']['ControlGroup'] = UI_Base_ControlGroup;
HY['UI']['Base']['DockingPanel'] = UI_Base_DockingPanel;
HY['UI']['Base']['LayersPanel'] = UI_Base_LayersPanel;
HY['UI']['Base']['ModelStructurePanel'] = UI_Base_ModelStructurePanel;
HY['UI']['Base']['ObjectContextMenu'] = UI_Base_ObjectContextMenu;
HY['UI']['Base']['OptionCheckbox'] = UI_Base_OptionCheckbox;
HY['UI']['Base']['OptionDropDown'] = UI_Base_OptionDropDown;
HY['UI']['Base']['OptionSlider'] = UI_Base_OptionSlider;
HY['UI']['Base']['PropertyPanel'] = UI_Base_PropertyPanel;
HY['UI']['Base']['RadioButtonGroup'] = UI_Base_RadioButtonGroup;
HY['UI']['Base']['RenderOptionsPanel'] = UI_Base_RenderOptionsPanel;
HY['UI']['Base']['SettingsPanel'] = UI_Base_SettingsPanel;
HY['UI']['Base']['ToolBar'] = UI_Base_ToolBar;
HY['UI']['Base']['ToolbarSID'] = UI_Base_ToolbarSID;
HY['UI']['Base']['Tree'] = UI_Base_Tree;
HY['UI']['Base']['TreeDelegate'] = UI_Base_TreeDelegate;
HY['UI']['GuiViewer3D'] = UI_GuiViewer3D;
HY['UI']['HudMessage'] = UI_HudMessage;
HY['UI']['ProgressBar'] = UI_ProgressBar;
HY['UI']['ViewCubeUi'] = UI_ViewCubeUi;
HY['UI']['ViewerLayersPanel'] = UI_ViewerLayersPanel;
HY['UI']['ViewerModelStructurePanel'] = UI_ViewerModelStructurePanel;
HY['UI']['ViewerObjectContextMenu'] = UI_ViewerObjectContextMenu;
HY['UI']['ViewerPropertyPanel'] = UI_ViewerPropertyPanel;
HY['UI']['ViewerSettingsPanel'] = UI_ViewerSettingsPanel;
return HY;
});