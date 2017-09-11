define(function() {;
    'use strict'
    var nextId = 1;
    
        function checkForPropertyDb(item) {
            if (item.mime == "application/autodesk-db" && item.urn) {
                //Of course, OSS is a storage system that mangles paths because why not,
                //so it needs special handling to extract the property database path
                if (item.urn.indexOf("urn:adsk.objects:os.object") === 0)
                    return item.urn.substr(0, item.urn.lastIndexOf("%2F") + 3);
                else
                    return item.urn.substr(0, item.urn.lastIndexOf("/") + 1);
            }
            return null;
        }
    
    
        //Represents a single bubble node
        function BubbleNode(rawNode, parent) {
    
            this.parent = parent;
    
            //Just an integer ID for use in runtime hashmaps
            this.id = nextId++;
    
            //TODO: do we need to clone the data into outselves, or just keep pointer as is
            //would be a waste of space to copy...
            this.data = rawNode;
    
            //Now do some postprocessing / precomputation of things we will need
            this.isLeaf = (rawNode.type === "geometry" && (rawNode.role === "3d" || rawNode.role === "2d" || rawNode.role === "lod"));
    
            if (Array.isArray(rawNode.children)) {
                this.children = [];
    
                //Recurse
                var len = rawNode.children.length;
    
                for (var i = 0; i < len; i++) {
                    this.children[i] = new BubbleNode(rawNode.children[i], this);
                }
    
                //Some more postprocessing / precomputation of things we will need
                //Some properties are determined by specific children. Look for those.
                for (var i = 0; i < len; i++) {
                    //Find the node's shared property db path -- if there is one, it's one of the children
                    var path = checkForPropertyDb(rawNode.children[i]);
                    if (path)
                        this.sharedPropertyDbPath = path;
    
                    //Check if a child geometry is an LOD model
                    //TODO: expect a change in the extractor to put the lod role in the node itself
                    //so this check will be made on item instead of its children eventually.
                    if (rawNode.children[i].role === "lod")
                        this.lodNode = this.children[i];
                }
            }
        }
    
        /**
         * Returns the topmost BubbleNode
         */
        BubbleNode.prototype.getRootNode = function () {
    
            if (this.parent)
                return this.parent.getRootNode();
    
            return this;
        };
    
    
        BubbleNode.prototype.findPropertyDbPath = function () {
    
            if (this.sharedPropertyDbPath)
                return this.sharedPropertyDbPath;
    
            if (this.parent)
                return this.parent.findPropertyDbPath();
    
            return null;
        };
    
        /**
         * @deprecated Avoid using this from the outside.
         */
        BubbleNode.prototype._raw = function () {
            return this.data;
        };
    
        BubbleNode.prototype.name = function () {
            return this.data.name;
        };
    
        BubbleNode.prototype.guid = function () {
            return this.data.guid;
        };
    
        BubbleNode.prototype.urn = function (searchParent) {
    
            var urn = this.data.urn;
    
            if (!searchParent)
                return urn;
    
            var n = this.parent;
            while (!urn && n) {
                urn = n.data.urn;
                n = n.parent;
            }
    
            return urn;
        };
    
        BubbleNode.prototype.getTag = function (tag) {
            return (this.data.tags ? this.data.tags : this.data)[tag];
        };
    
        BubbleNode.prototype.setTag = function (tag, value) {
            if (this.data.tags)
                this.data.tags[tag] = value;
            else
                this.data[tag] = value;
        };
    
        BubbleNode.prototype.isGeomLeaf = function () {
            return this.isLeaf;
        };
    
        BubbleNode.prototype.isViewable = function () {
            return this.data.role && this.data.role === "viewable";
        };
    
        BubbleNode.prototype.getLodNode = function () {
            return this.lodNode;
        };
    
        BubbleNode.prototype.is2DGeom = function () {
            return this.data.role === "2d";
        };
    
        BubbleNode.prototype.getPlacementTransform = function () {
            return this.data.placement;
        };
    
        BubbleNode.prototype.isMetadata = function () {
            //Certain nodes are not relevant for display purposes,
            //as they contain no graphics and provide extra information for
            //the graphics nodes.
            if (this.data.role) {
                if (this.data.role.indexOf("Autodesk.CloudPlatform.DesignDescription") !== -1)
                    return true;
                if (this.data.role === "Autodesk.CloudPlatform.PropertyDatabase")
                    return true;
            }
    
            return false;
        };
    
        //Returns the first parent in the hierarchy which is a "viewable"
        BubbleNode.prototype.findViewableParent = function () {
    
            var p = this;
            while (p && !p.isViewable())
                p = p.parent;
    
            return p;
        };
    
        BubbleNode.prototype.getViewableRootPath = function () {
    
            if (!this.isGeomLeaf())
                return null;
    
            var mime = this.is2DGeom() ? "application/autodesk-f2d" : "application/autodesk-svf";
    
            var items = this.search({ mime: mime });
    
            if (items && items.length) {
                var path = items[0].data.urn;
                return path;
            }
    
            return null;
        };
    
        //Searches the bubble for a specific item by its guid
        //and returns the first item that matches.
        //Note that some guids in the bubble are not unique, you have
        //to be sure you are looking for a guid that is unique if you want
        //correct result from this function. Otherwise use the generic search.
        BubbleNode.prototype.findByGuid = function (guid) {
            var item = null;
    
            this.traverse(function (node) {
                if (node.data.guid === guid) {
                    item = node;
                    return true;
                }
            });
    
            return item;
        };
    
    
        BubbleNode.prototype.search = function (propsToMatch) {
    
            var result = [];
    
            this.traverse(function (node) {
                var found = true;
                for (var p in propsToMatch) {
                    if (!node.data.hasOwnProperty(p) || node.data[p] !== propsToMatch[p]) {
                        found = false;
                        break;
                    }
                }
                if (found)
                    result.push(node);
            });
    
            return result.length ? result : null;
        };
    
        BubbleNode.prototype.searchByTag = function (tagsToMatch) {
    
            var result = [];
    
            this.traverse(function (node) {
                var found = true;
                for (var p in tagsToMatch) {
                    if (node.getTag(p) !== tagsToMatch[p]) {
                        found = false;
                        break;
                    }
                }
                if (found)
                    result.push(node);
            });
    
            return result.length ? result : null;
        };
    
    
        //Recursive bubble traversal helper
        BubbleNode.prototype.traverse = function (cb) {
    
            //Allow the callback to exit early if it meets
            //some internal condition and returns true.
            if (cb(this)) return true;
    
            if (this.children) {
    
                for (var i = 0; i < this.children.length; i++) {
    
                    if (this.children[i].traverse(cb))
                        return true;
    
                }
    
            }
    
            return false;
        };
    
    
        //Returns the Revit Level/Floor of this bubble node.
        //Only relevant for 2d sheets coming from Revit at the moment.
        //Eventually Revit should tag the bubble nodes with this value,
        //currently it's just a guess done by Fluent.guessObjectLevels().
        BubbleNode.prototype.getLevel = function () {
    
            var level = this.getTag("level");
    
            //TODO: for now, return the first level if a sheet shows multiple levels,
            //since the UI code can't handle it.
            if (Array.isArray(level))
                return level[0];
    
            return level;
        };
    
        //BubbleNode search patterns for often used nodes (yes, they are confusing, hence pre-defined to
        //help you not go insane).
        BubbleNode.MODEL_NODE = { "role": "3d", "type": "geometry" };
        BubbleNode.GEOMETRY_SVF_NODE = { "role": "graphics", "mime": "application/autodesk-svf" };
        BubbleNode.SHEET_NODE = { "role": "2d", "type": "geometry" };
        BubbleNode.GEOMETRY_F2D_NODE = { "role": "graphics", "mime": "application/autodesk-f2d" };
        BubbleNode.VIEWABLE_NODE = { "role": "viewable" };

        return BubbleNode;
});