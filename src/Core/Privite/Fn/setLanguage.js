define([
    '../../../i18n'
], function(i18n) {
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

        LOCALIZATION_REL_PATH = "res/locales/" + language + "/";
        i18n.init(options, function (t) {
            i18n.clearDebugLocString(); //Calls localize as well
            if (callback) {
                callback();
            }
        });
    };
});