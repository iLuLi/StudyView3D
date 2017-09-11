define([
    './Utils',
    './EditActionGroup'
], function(Utils, EditActionGroup) {
    'use strict';
    /**
     *
     * @param historySize
     * @constructor
     */
    function EditActionManager(historySize) {
        
                this.historySize = historySize;
        
                this.undoStack = new Array(historySize);
                this.redoStack = new Array(historySize);
        
                Utils.addTraitEventDispatcher(this);
            }
        
            /*
             * Event types
             */
            var EVENT_HISTORY_CHANGED = "EVENT_HISTORY_CHANGED";
        
            var proto = EditActionManager.prototype;
        
            /**
             *
             * @param action
             */
            proto.execute = function (action) {
        
                var redoStack = this.redoStack;
                var undoStack = this.undoStack;
        
                redoStack.splice(0, redoStack.length);
        
                action.redo();
        
                var group = this.getEditActionGroup();
                if (group.isOpen()) {
                    group.addAction(action);
                } else {
                    group.open();
                    group.addAction(action);
                    group.close();
                }
        
                if (undoStack.length > this.historySize) {
                    undoStack.splice(0, 1);
                }
        
                var targetId = action.selectOnExecution ? action.targetId : -1;
                this.fireEvent(
                    { type: EVENT_HISTORY_CHANGED, data: { action: 'execute', targetId: targetId } });
            };
        
            proto.beginActionGroup = function () {
        
                var undoStack = this.undoStack;
                var undoStackCount = undoStack.length;
                var group = null;
        
                if (undoStackCount === 0 || undoStack[undoStackCount - 1].isClosed()) {
        
                    group = this.getEditActionGroup();
                    group.open();
                } else {
                    console.warn('Markups - Undo/Redo - Action edit group already open.');
                }
            };
        
            proto.closeActionGroup = function () {
        
                var undoStack = this.undoStack;
                var undoStackCount = undoStack.length;
        
                if (undoStackCount === 0) {
        
                    console.warn('Markups - Undo/Redo - There is no action edit group to close.');
                    return;
                }
        
                var group = undoStack[undoStackCount - 1];
                if (!group.close()) {
                    console.warn('Markups - Undo/Redo - Action edit group already closed.');
                }
        
                if (group.isEmpty()) {
                    undoStack.pop();
                }
            };
        
            proto.cancelActionGroup = function () {
        
                var undoStack = this.undoStack;
                var undoStackCount = undoStack.length;
        
                if (undoStackCount === 0) {
        
                    console.warn('Markups - Undo/Redo - There is no action edit group to close.');
                    return;
                }
        
                var group = undoStack[undoStackCount - 1];
                if (!group.close()) {
                    console.warn('Markups - Undo/Redo - Action edit group already closed.');
                    return;
                }
        
                group.undo();
                undoStack.pop();
        
                this.fireEvent(
                    { type: EVENT_HISTORY_CHANGED, data: { action: 'cancel', targetId: -1 } });
            };
        
            proto.undo = function () {
        
                var undoStack = this.undoStack;
                var redoStack = this.redoStack;
        
                if (undoStack.length === 0) {
                    return;
                }
        
                var group = undoStack.pop();
                var targetId = group.undo();
        
                redoStack.push(group);
        
                this.fireEvent(
                    { type: EVENT_HISTORY_CHANGED, data: { action: 'undo', targetId: targetId } });
            };
        
            proto.redo = function () {
        
                var undoStack = this.undoStack;
                var redoStack = this.redoStack;
        
                if (redoStack.length === 0) {
                    return;
                }
        
                var group = redoStack.pop();
                var targetId = group.redo();
        
                undoStack.push(group);
        
                this.fireEvent(
                    { type: EVENT_HISTORY_CHANGED, data: { action: 'redo', targetId: targetId } });
            };
        
            proto.clear = function () {
        
                this.undoStack.splice(0, this.undoStack.length);
                this.redoStack.splice(0, this.redoStack.length);
        
                this.fireEvent(
                    { type: EVENT_HISTORY_CHANGED, data: { action: 'clear', targetId: -1 } });
            };
        
            proto.isUndoStackEmpty = function () {
        
                return this.undoStack.length === 0;
            };
        
            proto.isRedoStackEmpty = function () {
        
                return this.redoStack.length === 0;
            };
        
            /**
             *
             * @return action
             * @private
             */
            proto.getEditActionGroup = function () {
        
                var undoStack = this.undoStack;
                var undoStackCount = this.undoStack.length;
        
                var group = null;
        
                if (undoStackCount === 0 || undoStack[undoStackCount - 1].isClosed()) {
                    group = new EditActionGroup();
                    undoStack.push(group);
                } else {
                    group = undoStack[undoStackCount - 1];
                }
        
                return group;
            };
        
            return EditActionManager;
});