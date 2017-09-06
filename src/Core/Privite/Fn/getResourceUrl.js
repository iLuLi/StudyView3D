define(function() {;
    'use strict'
    /**
     * Returns the full url of a resource with version.  The version will be determined from the LMV_VIEWER_VERSION variable.
     * @private
     *
     * @param {string} resourceRelativePath - the path of the resource relative to LMV_RESOURCE_ROOT.
     * @returns {string} - the full resource path.
     */
    var getResourceUrl = function (resourceRelativePath) {
        var version = LMV_RESOURCE_VERSION;
        return LMV_RESOURCE_ROOT + resourceRelativePath + (version ? ('?v=' + version) : '');
    };

    return getResourceUrl;
});