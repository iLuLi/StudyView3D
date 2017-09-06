define([
    './setLanguage'
], function(setLanguage) {
    'use strict';
    return function (options) {
        // Initialize language for localization. The corresponding string files
        // will be downloaded.
        var language = (options && options.language) || navigator.language;

        // use iso scheme (ab/ab-XY)
        var tags = language.split('-');
        language = tags.length > 1 ? tags[0].toLowerCase() + '-' + tags[1].toUpperCase() : tags[0].toLowerCase();

        // check supported language tags and subtags
        var supportedTags = ["cs", "de", "en", "es", "fr", "it", "ja", "ko", "pl", "pt-BR", "ru", "tr", "zh-HANS", "zh-HANT"];
        if (supportedTags.indexOf(language) === -1) {
            if (language.indexOf("zh-CN") > -1) language = "zh-HANS";
            else if (language.indexOf("zh-TW") > -1) language = "zh-HANT";
            else if (tags.length > 1 && supportedTags.indexOf(tags[0]) > -1) language = tags[0];
            else language = "en";
        }

        // Uncomment below to default to english
        //language = "en";
        setLanguage(language);
    };
});