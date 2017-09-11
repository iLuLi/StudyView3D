define(function() {;
    'use strict'
    // TODO:  This is here for now, until we find a better place for it.
    //
    /**
     * Returns the first source url found containing the given script name.
     * @private
     *
     * @param {string} scriptName
     * @returns {HTMLScriptElement} The script element whose source location matches the input parameter
     */
    var getScript = function (scriptName) {
        scriptName = scriptName.toLowerCase();
        var scripts = document.getElementsByTagName('SCRIPT');
        if (scripts && scripts.length > 0) {
            for (var i = 0; i < scripts.length; ++i) {
                if (scripts[i].src && scripts[i].src.toLowerCase().indexOf(scriptName) !== -1) {
                    return scripts[i];
                }
            }
        }
        return null;
    };

    return getScript;
});