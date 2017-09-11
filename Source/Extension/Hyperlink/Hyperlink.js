define([
    '../Extension',
    '../../Core/Manager/theExtensionManager',
    './HyperlinkTool'
], function(Extension, theExtensionManager, HyperlinkTool) {
    'use strict';
    var HyperlinkExtension = function (viewer, options) {
        Extension.call(this, viewer, options);
        this.tool = null;
    };

    HyperlinkExtension.prototype = Object.create(Extension.prototype);
    HyperlinkExtension.prototype.constructor = HyperlinkExtension;

    HyperlinkExtension.prototype.load = function () {
        this.tool = new HyperlinkTool(this.viewer);
        this.viewer.toolController.registerTool(this.tool);
        this.viewer.toolController.activateTool(this.tool.getName()); // TODO: is it ok to activate the tool here?
        return true;
    };

    HyperlinkExtension.prototype.unload = function () {
        this.viewer.toolController.deactivateTool(this.tool.getName()); // TODO: is it ok to deactivate the tool here?
        this.viewer.toolController.deregisterTool(this.tool);
        this.tool = null;
        return true;
    };

    theExtensionManager.registerExtension('Autodesk.Hyperlink', HyperlinkExtension);
    return HyperlinkExtension;
});