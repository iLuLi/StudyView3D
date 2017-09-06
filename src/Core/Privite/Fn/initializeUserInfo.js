define([
    './setUserName',
    '../Global'
], function(setUserName, Privite_Global) {
    'use strict';
    return function (options) {
        if (!options || !options.userInfo) return;
        setUserName(options.userInfo.name);
        if (options.comment2Token) {
            Privite_Global.comment2Token = options.comment2Token;
        }
    };
});