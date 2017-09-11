define(['./Logger', './Document'], function(Logger, Document) {;
    'use strict'
    var BrowserDelegate = function () {
    };


    BrowserDelegate.prototype.constructor = BrowserDelegate;

    BrowserDelegate.prototype.getNodeId = function (node) {
        throw 'getId is not implemented.'
    };

    BrowserDelegate.prototype.getNodeLabel = function (node) {
        return node.name;
    };

    BrowserDelegate.prototype.getNodeClass = function (node) {
        return '';
    };

    BrowserDelegate.prototype.hasThumbnail = function (node) {
        return false;
    };

    BrowserDelegate.prototype.getThumbnailOptions = function (node) {
        return null;
    };

    BrowserDelegate.prototype.getThumbnail = function (node) {
        return null;
    };

    BrowserDelegate.prototype.onNodeClick = function (browser, node, event) {
    };

    BrowserDelegate.prototype.onNodeHover = function (browser, node, event) {
    };

    BrowserDelegate.prototype.selectItem = function (id) {
    };

    BrowserDelegate.prototype.deselectItem = function (id) {
    };

    BrowserDelegate.prototype.hasContent = function (node) {
        return false;
    };

    BrowserDelegate.prototype.addContent = function (node, element) {
    };

    var Browser = function (delegate, items, parentContainerId) {
        this.myDelegate = delegate;
        this.mySelectedIds = [];

        var prefix = 'browserview';
        this.myRootContainerId = parentContainerId + '-' + prefix;

        this.idToElement = {};

        this.myRootContainer = document.createElement("div");
        this.myRootContainer.id = this.myRootContainerId;
        this.myRootContainer.classList.add(prefix);

        var parent = document.getElementById(parentContainerId);
        parent.appendChild(this.myRootContainer);

        this.createElements(items, this.myRootContainer);
    };

    Browser.prototype.constructor = Browser;

    Browser.prototype.show = function (show) {
        if (show) {
            this.myRootContainer.classList.remove("browserHidden");
            this.myRootContainer.classList.add("browserVisible");
            this.myRootContainer.style.display = "block";
        } else {
            this.myRootContainer.classList.remove("browserVisible");
            this.myRootContainer.classList.add("browserHidden");
            this.myRootContainer.style.display = "none";
        }
    };

    Browser.prototype.getRootContainer = function () {
        return this.myRootContainer;
    };

    Browser.prototype.delegate = function () {
        return this.myDelegate;
    };

    Browser.prototype.addToSelection = function (ids) {
        var browser = this;
        function addSingle(id) {
            var index = browser.mySelectedIds.indexOf(id);
            if (index == -1) {
                browser.mySelectedIds.push(id);
                return true;
            }
            return false;
        }

        for (var i = 0, len = ids.length; i < len; ++i) {
            var id = ids[i];
            if (addSingle(id)) {
                var item = browser.idToElement[id];
                if (item === undefined) {
                    // Maybe the delegate knows what to do with it.
                    browser.myDelegate.selectItem(id);
                } else {
                    item.classList.add("selected");
                }
            }
        }
    };

    Browser.prototype.removeFromSelection = function (ids) {
        var browser = this;
        function removeSingle(id) {
            var index = browser.mySelectedIds.indexOf(id);
            if (index != -1) {
                browser.mySelectedIds.splice(index, 1);
                return true;
            }
            return false;
        }

        for (var i = ids.length - 1; i >= 0; --i) {
            var id = ids[i];
            if (removeSingle(id)) {
                var item = this.idToElement[id];
                if (item === undefined) {
                    // Maybe the delegate knows what to do with it.
                    browser.myDelegate.deselectItem(id);
                } else {
                    item.classList.remove("selected");
                }
            }
        }
    };

    Browser.prototype.setSelection = function (ids) {
        this.removeFromSelection(this.mySelectedIds);
        this.addToSelection(ids);
        return this.mySelectedIds;
    };

    Browser.prototype.clearSelection = function () {
        this.removeFromSelection(this.mySelectedIds);
    };

    Browser.prototype.createElements = function (items, container) {
        if (!items)
            return;

        var browser = this;
        for (var nodeIndex = 0; nodeIndex < items.length; nodeIndex++) {
            var node = items[nodeIndex];
            browser.createElement(node, container);
        }
    };

    Browser.prototype.createElement = function (browserNode, container) {
        var browser = this;

        var id = browser.myDelegate.getNodeId(browserNode);

        var item = document.createElement("item");
        container.appendChild(item);
        this.idToElement[id] = item;

        item.onmouseover = function () {
            browser.myDelegate.onNodeHover(browser, browserNode);
        };
        item.onclick = function (e) {
            browser.myRootContainer.querySelector(".flipped").removeClass("flipped");
            browser.myDelegate.onNodeClick(browser, browserNode, e);
        };


        var card = document.createElement("div");
        card.classList.add("card");
        item.appendChild(card);

        var elemWrapper = document.createElement("div");
        elemWrapper.classList.add("browserElement");
        card.appendChild(elemWrapper);

        var label = browser.myDelegate.getNodeLabel(browserNode);
        var labelElem = document.createElement("label");
        labelElem.innerHTML = label;
        elemWrapper.appendChild(labelElem);
        labelElem.onclick = function (e) {
            browser.myDelegate.onNodeClick(browser, browserNode, e);
        };

        var thumbnailUrl = browser.myDelegate.getThumbnail(browserNode);
        if (thumbnailUrl) {
            var thumbElem = document.createElement("img");
            thumbElem.classList.add("thumb");
            if (LMV_THIRD_PARTY_COOKIE === false) {
                // Code path for when cookies are disabled
                var thumbnailData = browser.myDelegate.getThumbnailOptions(browserNode);
                Document.requestThumbnailWithSecurity(thumbnailData, function onThumbnailSuccess(err, response) {
                    if (err) {
                        Logger.error("Failed to load thumbnail: " + thumbnailUrl);
                        return;
                    }
                    thumbElem.src = window.URL.createObjectURL(response);
                    thumbElem.onload = function () {
                        window.URL.revokeObjectURL(thumbElem.src);
                    };
                });
            } else {
                // Code path for when cookies are enabled
                thumbElem.src = thumbnailUrl;
            }
            elemWrapper.appendChild(thumbElem);
            thumbElem.onclick = function (e) {
                browser.myDelegate.onNodeClick(browser, browserNode, e);
            };
        }

        if (browser.myDelegate.hasContent(browserNode)) {
            browser.myDelegate.addContent(browserNode, card);
        }

        item.classList.add(browser.myDelegate.getNodeClass(browserNode));
    };

    return {
        BrowserDelegate: BrowserDelegate,
        Browser: Browser
    }
});