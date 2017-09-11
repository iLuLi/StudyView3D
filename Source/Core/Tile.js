define(function() {;
    'use strict'
    /** 
     * @classdesc Helper struct to work with tile quadtree structure.
     */
    function TileCoords(level, x, y) {
        this.level = level;
        this.x = x;
        this.y = y;
    }

    TileCoords.prototype = {

        constructor: TileCoords,

        copy: function () {
            return new TileCoords(level, x, y);
        },

        /** returns {bool} */
        isValid: function () {
            return isNumber(this.level) && this.level >= 0 && isNumber(this.x) && isNumber(this.y);
        },

        /* @param   {number}     child - must be in [0,3] 
         * @returns {TileCoords} 
         */
        getChild: function (child) {

            var xOffset = (child & 1) ? 1 : 0;
            var yOffset = (child & 2) ? 1 : 0;
            return new TileCoords(
                this.level + 1,
                this.x * 2 + xOffset,
                this.y * 2 + yOffset
            );
        },

        /**
         *  @returns {TileCoords|null} Parent tile or null if this tile was root or invalid.
         */
        getParent: function () {
            if (this.level == 0) {
                return null;
            }
            return new TileCoords(this.level - 1, Math.floor(this.x / 2), Math.floor(this.y / 2));
        },

        /** @returns {string} E.g., "(1,1,2)" */
        toString: function () {
            return "(" + this.level + ", " + this.x + ", " + this.y + ")";
        },

        /** 
         * Can be called either with a single TileCoords param or with (level, x, y) as integers.
         *   @param {TileCoords|number} levelOrTile
         *   @param {number}            [x] 
         *   @param {number}            [y]
         *   @returns {bool} 
         */
        equals: function (levelOrTile, x, y) {

            if (levelOrTile instanceof TileCoords) {
                return this.equals(levelOrTile.level, levelOrTile.x, levelOrTile.y);
            }

            return this.level === levelOrTile && this.x === x && this.y === y;
        }
    }

    /** Computes the number of tiles at a given level, assuming a complete tree.
     *   @param   {number} level must be >=0
     *   @returns {number} 
     */
    var tilesAtLevel = function (level) {
        return (1 << level);
    }

    /** 
     * Inverse of index2Tile (see below).
     * Note that this is only possible as long as all tiles share a common root tile (0,0,0).
     *  @param   {TileCoords} 
     *  @returns {number}
     */
    var tile2Index = function (tile) {

        // level 0 has 1 tile and the number of tiles grows by factor 4 with each level.
        // Using geometric sum formular, we obtain the summed number of tiles for 
        // levels 0,...,tile.level-1 as:
        var firstTileInLevel = ((1 << (2 * tile.level)) - 1) / 3;

        // compute individual index per row/column pair
        var tilesPerRow = 1 << tile.level;

        return firstTileInLevel + tile.y * tilesPerRow + tile.x;
    }

    /** 
     * Enumerates all tiles of a complete quadtree in breadth-first order. 
     *  @param   {number} int >= 0
     *  @returns {TileCoords}
     */
    var index2Tile = function (index) {

        var tile = new TileCoords(0, 0, 0);

        // find level maximum level for which the index is <= the target index
        while (tile2Index(tile) <= index) {
            tile.level++;
        }
        tile.level--;

        // compute the local index inside this level
        var localIndex = index - tile2Index(tile);

        // Having the level, we can compute index and column
        var tilesPerRow = (1 << tile.level);
        tile.y = Math.floor(localIndex / tilesPerRow);
        tile.x = localIndex % tilesPerRow;

        return tile;
    }

    return {
        TileCoords: TileCoords,
        tile2Index: tile2Index,
        index2Tile: index2Tile
    }
});