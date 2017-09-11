define([
    './Constants',
    './EditMode',
    './EditorTextInput',
    './DeleteText',
    './CreateText',
    './SetText',
    './SetSize',
    './SetStyle'
], function(Constants, EditMode, EditorTextInput, DeleteText, CreateText, SetText, SetSize, SetStyle) {
    'use strict';

   function EditModeText(editor) {

       var styleAttributes = [
           'font-size',
           'stroke-color',
           'stroke-opacity',
           'fill-color',
           'fill-opacity',
           'font-family',
           'font-style',
           'font-weight'
       ];
       EditMode.call(this, editor, Constants.MARKUP_TYPE_TEXT, styleAttributes);

       var helper = new EditorTextInput(this.viewer.container, this.editor);
       helper.addEventListener(helper.EVENT_TEXT_CHANGE, this.onHelperTextChange.bind(this), false);
       this.textInputHelper = helper;
       this.onHistoryChangeBinded = this.onHistoryChange.bind(this);
       this.minSize = 0; // No need to size it initially
       this.creationMethod = this.CREATION_METHOD_CLICK;
   }

   EditModeText.prototype = Object.create(EditMode.prototype);
   EditModeText.prototype.constructor = EditModeText;

   var proto = EditModeText.prototype;

   proto.deleteMarkup = function (markup, cantUndo) {

       markup = markup || this.selectedMarkup;
       if (markup && markup.type == this.type) {
           var deleteText = new DeleteText(this.editor, markup);
           deleteText.addToHistory = !cantUndo;
           deleteText.execute();
           return true;
       }
       return false;
   };

   /**
    *
    * @param style
    */
   proto.setStyle = function (style) {

       if (this.textInputHelper.isActive()) {

           this.textInputHelper.setStyle(style);
       } else {
           EditMode.prototype.setStyle.call(this, style);
       }
   };

   proto.notifyAllowNavigation = function (allows) {

       if (allows && this.textInputHelper.isActive()) {
           this.textInputHelper.acceptAndExit();
       }
   };

   proto.destroy = function () {

       if (this.textInputHelper) {
           if (this.textInputHelper.isActive()) {
               this.textInputHelper.acceptAndExit();
           }
           this.textInputHelper.destroy();
           this.textInputHelper = null;
       }
       EditMode.prototype.destroy.call(this);
   };

   /**
    * Handler to mouse down events, used to start markups creation.
    */
   proto.onMouseDown = function () {

       if (this.textInputHelper.isActive()) {
           this.textInputHelper.acceptAndExit();
           return;
       }

       if (this.selectedMarkup) {
           return;
       }

       var editor = this.editor;
       var mousePosition = editor.getMousePosition();
       var clientFontSize = editor.sizeFromMarkupsToClient(0, this.style['font-size']).y;
       var initialWidth = clientFontSize * 15; // Find better way to initialize size.
       var initialHeight = clientFontSize * 3;

       // Center position.
       var size = this.size = editor.sizeFromClientToMarkups(initialWidth, initialHeight);
       var position = editor.positionFromClientToMarkups(
           mousePosition.x + (initialWidth * 0.5),
           mousePosition.y + (initialHeight * 0.5));

       this.creationBegin();
       editor.beginActionGroup();

       // Given the initial width and font size, we assume that the text fits in one line.
       var createText = new CreateText(
           editor,
           editor.getId(),
           position,
           size,
           '',
           this.style);

       createText.execute();
       this.creationEnd();

       this.selectedMarkup = editor.getMarkup(createText.targetId);
       this.textInputHelper.setActive(this.selectedMarkup, true);
       this.editor.actionManager.addEventListener(Constants.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
   };

   proto.onMouseUp = function (event) {

   };

   proto.onMouseDoubleClick = function (markup) {

       if (markup === this.selectedMarkup) {
           this.editor.selectMarkup(null);
           this.textInputHelper.setActive(markup, false);
       }
   };

   proto.onHelperTextChange = function (event) {

       var dataBag = event.data;
       var textMarkup = dataBag.markup;
       var textStyle = dataBag.style;

       this.editor.actionManager.removeEventListener(Constants.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);

       // Deal with edge case first: Creating a Label without text
       if (dataBag.newText === '') {

           // If the text field is being created for the first time,
           // we need only to cancel the action group in progress
           if (dataBag.firstEdit) {
               this.editor.cancelActionGroup();
               this.editor.selectMarkup(null);
               return;
           }
               // Else, we must perform a Delete action
           else {
               var deleteText = new DeleteText(this.editor, textMarkup);
               deleteText.execute();
               this.editor.selectMarkup(null);
               return;
           }
       }

       // When the text is created for the first time, an action group
       // is already created and it includes the CreateText action.
       // Thus, no need to begin another action group.
       if (!dataBag.firstEdit) {
           this.editor.beginActionGroup();
       }

       // Size change action //
       var position = this.editor.positionFromClientToMarkups(dataBag.newPos.x, dataBag.newPos.y);
       var size = this.editor.sizeFromClientToMarkups(dataBag.width, dataBag.height);
       var setSize = new SetSize(
           this.editor,
           textMarkup,
           position,
           size.x,
           size.y);
       setSize.execute();

       // Text change action //
       var setText = new SetText(
           this.editor,
           textMarkup,
           textMarkup.position,
           textMarkup.size,
           dataBag.newText);
       setText.execute();

       var setStyle = new SetStyle(
           this.editor,
           textMarkup,
           textStyle
       );
       setStyle.execute();

       // However, we do need to close the action group at this point. For both cases.
       this.editor.closeActionGroup();
       this.editor.selectMarkup(null);
   };

   /**
    * We want to make sure that the Input Helper gets removed from the screen
    * whenever the user attempts to perform an undo or redo action.
    * @param {Event} event
    * @private
    */
   proto.onHistoryChange = function (event) {

       if (this.textInputHelper.isActive()) {
           this.editor.actionManager.removeEventListener(Constants.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
           this.textInputHelper.setInactive();
       }
   };

   /**
    * Notify the markup that the displayed markups are being saved so edit mode can finish current editions.
    */
   proto.onSave = function () {

       EditMode.prototype.onSave.call(this);

       // Close input helper if it's open.
       if (this.textInputHelper.isActive()) {
           var firstEdit = this.textInputHelper.firstEdit;

           this.editor.actionManager.removeEventListener(Constants.EVENT_HISTORY_CHANGED, this.onHistoryChangeBinded);
           this.textInputHelper.setInactive();

           // Close action group if open (first edit).s
           if (firstEdit) {
               this.editor.cancelActionGroup();
           }

           this.editor.selectMarkup(null);
           this.selectedMarkup = null;
       }
   };

   return EditModeText;
});