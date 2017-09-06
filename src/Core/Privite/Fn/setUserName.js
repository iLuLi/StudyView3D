define([
    '../Global'
], function(Privite_Global) {
    'use strict';
    return function (name) {
        Privite_Global.config.userName = name;
    };
});