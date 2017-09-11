define(function() {;
    'use strict'
    return [
        '<div class="orbit-gizmo noselect">',
            '<div class="outside"></div>',
            '<div class="ring"></div>',
            '<div class="layout-hor">',
                '<div class="edgemark-area"><div class="edgemark"></div></div>',
            '</div>',
            '<div class="layout-mid">',
                '<div class="layout-ver">',
                    '<div class="edgemark-area"><div class="edgemark"></div></div>',
                '</div>',
                '<div class="circle">',
                    '<div class="crosshair-area">',
                        '<div class="crosshair-v"></div>',
                        '<div class="crosshair-h"></div>',
                    '</div>',
                '</div>',
                '<div class="layout-ver">',
                    '<div class="edgemark-area"><div class="edgemark"></div></div>',
                '</div>',
            '</div>',
            '<div class="layout-hor">',
                '<div class="edgemark-area"><div class="edgemark"></div></div>',
            '</div>',
        '</div>',
    ].join("\n");
});