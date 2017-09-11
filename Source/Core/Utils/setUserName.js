define([
    '../Constants/Global'
], function(Global) {
    'use strict';
    return function (name) {
        Global.config.userName = name;
    };
});