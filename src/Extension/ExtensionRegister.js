define([
    '../Core/theExtensionManager',
    './NavToolsExtension'
], function(theExtensionManager, NavToolsExtension) {
    'use strict';
    
    theExtensionManager.registerExtension('Autodesk.DefaultTools.NavTools', NavToolsExtension);
});