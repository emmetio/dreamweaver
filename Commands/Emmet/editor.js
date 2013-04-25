emmet.define('editorProxy', function(require, _) {
	return {
		dom: function() {
			return dw.getDocumentDOM();
		},

		setupContext: function() {
			var pref = function(name, defValue, type) {
				type = type || 'string';
				if (type == 'int') {
					return dw.getPreferenceInt('Source Format', name, defValue);
				}

				return dw.getPreferenceString('Source Format', name, defValue);
			}

			var nl = pref('Line Break Type', 0x0A, 'int');
			var useTabs = pref('Use Tabs', 1, 'int');
			require('utils').setNewline(nl == 0x0D0A ? '\x0D\x0A' : String.fromCharCode(nl));
		},

		/**
		 * Returns character indexes of selected text: object with <code>start</code>
		 * and <code>end</code> properties. If there's no selection, should return 
		 * object with <code>start</code> and <code>end</code> properties referring
		 * to current caret position
		 * @return {Object}
		 * @example
		 * var selection = editor.getSelectionRange();
		 * alert(selection.start + ', ' + selection.end); 
		 */
		getSelectionRange: function() {
			var selection = this.dom().source.getSelection();
			return {
				start: selection[0],
				end: selection[1]
			};
		},
		
		/**
		 * Creates selection from <code>start</code> to <code>end</code> character
		 * indexes. If <code>end</code> is ommited, this method should place caret 
		 * and <code>start</code> index
		 * @param {Number} start
		 * @param {Number} [end]
		 * @example
		 * editor.createSelection(10, 40);
		 * 
		 * //move caret to 15th character
		 * editor.createSelection(15);
		 */
		createSelection: function(start, end) {
			// alert('current caret pos: ' + this.getCaretPos());
			this.dom().source.setSelection(start, end);
		},
		
		/**
		 * Returns current line's start and end indexes as object with <code>start</code>
		 * and <code>end</code> properties
		 * @return {Object}
		 * @example
		 * var range = editor.getCurrentLineRange();
		 * alert(range.start + ', ' + range.end);
		 */
		getCurrentLineRange: function() {
			var caretPos = this.getCaretPos();
			if (caretPos === null) return null;
			return require('utils').findNewlineBounds(this.getContent(), caretPos);
		},
		
		/**
		 * Returns current caret position
		 * @return {Number}
		 */
		getCaretPos: function() {
			var caretPos = this.getSelectionRange().start;
			return ~caretPos ? caretPos : null;
		},
		
		/**
		 * Set new caret position
		 * @param {Number} pos Caret position
		 */
		setCaretPos: function(pos) {
			this.createSelection(pos, pos);
		},
		
		/**
		 * Returns content of current line
		 * @return {String}
		 */
		getCurrentLine: function() {
			var range = this.getCurrentLineRange();
			return range.start < range.end ? this.dom().source.getText(range.start, range.end) : '';
		},
		
		/**
		 * Replace editor's content or it's part (from <code>start</code> to 
		 * <code>end</code> index). If <code>value</code> contains 
		 * <code>caret_placeholder</code>, the editor will put caret into 
		 * this position. If you skip <code>start</code> and <code>end</code>
		 * arguments, the whole target's content will be replaced with 
		 * <code>value</code>. 
		 * 
		 * If you pass <code>start</code> argument only,
		 * the <code>value</code> will be placed at <code>start</code> string 
		 * index of current content. 
		 * 
		 * If you pass <code>start</code> and <code>end</code> arguments,
		 * the corresponding substring of current target's content will be 
		 * replaced with <code>value</code>. 
		 * @param {String} value Content you want to paste
		 * @param {Number} [start] Start index of editor's content
		 * @param {Number} [end] End index of editor's content
		 * @param {Boolean} [noIndent] Do not auto indent <code>value</code>
		 */
		replaceContent: function(value, start, end, noIndent) {
			var content = this.getContent();
			var utils = require('utils');
			
			if (_.isUndefined(end)) 
				end = _.isUndefined(start) ? content.length : start;
			if (_.isUndefined(start)) start = 0;
			
			// indent new value
			if (!noIndent) {
				value = utils.padString(value, utils.getLinePaddingFromPosition(content, start));
			}
			
			// find new caret position
			var tabstopData = emmet.require('tabStops').extract(value, {
				escape: function(ch) {
					return ch;
				}
			});
			value = tabstopData.text;
			
			var firstTabStop = tabstopData.tabstops[0];
			if (firstTabStop) {
				firstTabStop.start += start;
				firstTabStop.end += start;
			} else {
				firstTabStop = {
					start: value.length + start,
					end: value.length + start
				};
			}
				
			try {
				this.dom().source.replaceRange(start, end, value);
				this.createSelection(firstTabStop.start, firstTabStop.end);
			} catch(e){}
		},
		
		/**
		 * Returns editor's content
		 * @return {String}
		 */
		getContent: function() {
			return this.dom().source.getText() || '';
		},
		
		/**
		 * Returns current editor's syntax mode
		 * @return {String}
		 */
		getSyntax: function() {
			var dom = this.dom();
			var syntax = dom.getParseMode();
			if (~dom.documentType.indexOf('XSLT')) {
				syntax = 'xsl';
			}

			return require('actionUtils').detectSyntax(this, syntax);
		},
		
		/**
		 * Returns current output profile name (see profile module).
		 * In most cases, this method should return <code>null</code> and let 
		 * Emmet guess best profile name for current syntax and user data.
		 * In case you’re using advanced editor with access to syntax scopes 
		 * (like Sublime Text 2), you can return syntax name for current scope. 
		 * For example, you may return `line` profile when editor caret is inside
		 * string of programming language.
		 *  
		 * @return {String}
		 */
		getProfileName: function() {
			return null;
		},
		
		/**
		 * Ask user to enter something
		 * @param {String} title Dialog title
		 * @return {String} Entered data
		 * @since 0.65
		 */
		prompt: function(title) {
			return prompt(title);
		},
		
		/**
		 * Returns current selection
		 * @return {String}
		 * @since 0.65
		 */
		getSelection: function() {
			var dom = this.dom();
			var selection = dom.source.getSelection();
			return dom.source.getText(selection[0], selection[1]);
		},
		
		/**
		 * Returns current editor's file path
		 * @return {String}
		 * @since 0.65 
		 */
		getFilePath: function() {
			return this.dom().URL;
		}
	}
});