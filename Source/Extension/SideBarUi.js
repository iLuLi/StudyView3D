define([
    '../Core/Manager/theExtensionManager',
    '../Core/Constants/EventType',
    '../Core/DomUtils',
    './Extension',
    '../Core/i18n'
], function(theExtensionManager, EventType, DomUtils, Extension, i18n) {
    'use strict';

    function SideBarUi(viewer, options) {
        Extension.call(this, viewer, options);
        DomUtils.DomDispatcher.prototype.apply(this);
        this.currentContent = null;
    }

    SideBarUi.prototype = Object.create(Extension.prototype);
    SideBarUi.prototype.constructor = SideBarUi;

    var proto = SideBarUi.prototype;

    proto.load = function () {

        this.openSideMenuBinded = this.openSideMenu.bind(this);
        this.viewer.addEventListener(EventType.SIDE_BAR_OPEN_EVENT, this.openSideMenuBinded);
        return true;
    };
    proto.unload = function () {
        this.viewer.removeEventListener(EventType.SIDE_BAR_OPEN_EVENT, this.openSideMenuBinded);
        this.openSideMenuBinded = null;
        if (this.currentContent) {
            this.currentContent.unload();
            this.currentContent = null;
        }
        if (this.domNav) {
            DomUtils.remove(this.domNav);
            this.domNav = null;
        }
        this.unhookEvents();
        return true;
    };

    proto.createSlidingSideBar = function (parent) {

        var domNav = this.domNav = document.createElement('div');
        domNav.className = 'lmv-sidebar-menu--slide-left';
        var txtClose = 'Close';

        domNav.innerHTML = [
            '<button class="lmv-sidebar-menu__title">',
            '</button>',
            '<button class="lmv-sidebar-menu-button lmv-sidebar-menu-button__cross">&times;</button>',
            '<div class="lmv-sidebar-menu__content">',
            '</div>'
        ].join('');
        parent.appendChild(domNav);

        this.domContent = this.domNav.querySelector('.lmv-sidebar-menu__content');
        this.domCloseBtn = this.domNav.querySelector('button.lmv-sidebar-menu__title');
        this.setCloseButton();

        this.hookEvent(this.domNav, 'click', '.lmv-sidebar-menu__title', function (event) {
            this.toggleCollapsed();
        }.bind(this));
        this.hookEvent(this.domNav, 'click', '.lmv-sidebar-menu-button__cross', function (event) {
            this.closeSideMenu();
        }.bind(this));
    };
    proto.setCloseButton = function (title) {
        var text = title || 'Close';
        this.domCloseBtn.setAttribute('data-i18n', text);
        this.domCloseBtn.textContent = i18n.translate(text);
    };
    proto.openSideMenu = function (event) {

        if (!this.domNav) {
            this.createSlidingSideBar(this.viewer.container);
        }
        if (this.currentContent) {
            this.currentContent.unload();
            this.currentContent = null;
            DomUtils.removeChildren(this.domContent);
        }
        if (event.content) {
            var ContentClass = event.content;
            this.currentContent = new ContentClass(this.viewer, this.domContent);
            this.currentContent.load();
            var title = this.currentContent.getTitle();
            this.setCloseButton(title);
        }

        // Delay a frame
        var domNav = this.domNav;
        requestAnimationFrame(function () {
            domNav.classList.remove('is-collapsed'); // always slide in non collapsed
            domNav.classList.add('is-active'); // slide in!
        });
    };
    proto.toggleCollapsed = function () {
        this.domNav.classList.toggle('is-collapsed');
        this.domNav.scrollTop = 0; // reset scroll, just in case.
    }
    proto.closeSideMenu = function () {
        this.domNav.classList.remove('is-active');
    }

    theExtensionManager.registerExtension('Autodesk.SideBarUi', SideBarUi);
});