define([
    '../i18n',
    '../Constants/Global'
], function(i18n, Global) {
    'use strict';
    return function (language, callback) {
        
        var options = {
            lng: language,
            resGetPath: 'res/locales/__lng__/__ns__.json',
            ns: {
                namespaces: ['allstrings'],
                defaultNs: 'allstrings'
            },
            fallbackLng: "en",
            debug: false
        };

        Global.LOCALIZATION_REL_PATH = "res/locales/" + language + "/";
        i18n.init(options, function (t) {
            i18n.clearDebugLocString(); //Calls localize as well
            if (callback) {
                callback();
            }
        });
    };
});