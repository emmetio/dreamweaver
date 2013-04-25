emmet.define('file', function(require, _) {
	var reProto = /^([a-z]+)\:\/\//i;

	function startsWith(str, chars) {
		return str.indexOf(chars) === 0;
	}

	return {
		_parseParams: function(args) {
			var params = {
				path: args[0],
				size: -1
			};

			args = _.rest(args);
			params.callback = _.last(args);
			args = _.initial(args);
			if (args.length) {
				params.size = args[0];
			}

			// make sure path is absolute
			params.path = this.resolvePath(this.dirname(document.URL), params.path);

			return params;
		},

		/**
		 * @param {String} dirname
		 * @param {String} file
		 */
		resolvePath: function(dirname, file) {
			if (this.isAbsolutePath(file)) {
				return this.sanitizeAbsolutePath(file);
			}
			
			if (dirname.charAt(dirname.length - 1) != '/')
				dirname += '/';
				
			var path = dirname + file;
			var protocol = '';
			// temporary remove protocol, if exists
			path = path.replace(/^[a-z]+\:\/\//i, function(str) {
				protocol = str.substring(0, str.length - 1);
				return '/';
			});
			
			// took from Python
			var initial_slashes = startsWith(path, '/');
//			POSIX allows one or two initial slashes, but treats three or more
//			as single slash.
			if (initial_slashes && startsWith(path, '//') && !startsWith(path, '///'))
				initial_slashes = 2;
				
			var comps = path.split('/');
			var new_comps = [];
				
			for (var i = 0, il = comps.length; i < il; i++) {
				var comp = comps[i];
				if (comp == '') {
					if (i == il - 1) {
						new_comps.push('');
					}
					continue;
				}

				if (comp == '.')
					continue;
					
				if (comp != '..' || (!initial_slashes && !new_comps.length) || 
					(new_comps.length && new_comps[new_comps.length - 1] == '..'))
					new_comps.push(comp);
				else if (new_comps.length)
					new_comps.pop();
					
			}
			
			comps = new_comps;
			path = comps.join('/');
			if (initial_slashes) {
				var prefix = '';
				do {
					prefix += '/';
				} while (--initial_slashes);
				
				path = prefix + path;
			}
			
			return this.sanitizeAbsolutePath(protocol + path) || '.';
		},

		/**
		 * Test if given path is absolute
		 * @param {String} path
		 * @returns {Boolean}
		 */
		isAbsolutePath: function(path) {
			return path.charAt(0) == '/' || reProto.test(path);
		},

		/**
		 * @param {String} path
		 * @returns {String}
		 */
		sanitizeAbsolutePath: function(path) {
			if (this.isAbsolutePath(path) && !/[a-z]{2,}:/.test(path)) {
				var proto = 'file://';
				if (path.charAt(0) != '/') {
					proto += '/';
				}

				path = proto + path;
			}
			
			return path;
		},

		/**
		 * @param {String} path
		 * @return {String}
		 */
		dirname: function(path) {
			return path.substring(0, path.length - this.filename(path).length);
		},

		/**
		 * @param {String} path
		 * @return {String}
		 */
		filename: function(path) {
			var m = path.match(/([\w\.\-]+)$/i);
			return m ? m[1] : '';
		},

		/**
		 * Read file content and return it
		 * @param {String} path File's relative or absolute path
		 * @param {Number} size Number of bytes to read, optional. If not specified, 
		 * reads full file
		 * @param {Function} callback Callback function invoked when reading is
		 * completed
		 * @return {String}
		 */
		read: function(path, size, callback) {
			var params = this._parseParams(arguments);
			try {
				// TODO implement HTTP file reading
				var content = DWfile.read(params.path);
				if (content === null) {
					params.callback('Unable to read "' + params.path + '" file');
				} else {
					params.callback(null, content);
				}
			} catch(e) {
				params.callback(e);
			}
		},

		readText: function() {
			this.read.apply(this, arguments);
		},
		
		/**
		 * Locate <code>file_name</code> file that relates to <code>editor_file</code>.
		 * File name may be absolute or relative path
		 * 
		 * <b>Dealing with absolute path.</b>
		 * Many modern editors have a "project" support as information unit, but you
		 * should not rely on project path to find file with absolute path. First,
		 * it requires user to create a project before using this method (and this 
		 * is not very convenient). Second, project path doesn't always points to
		 * to website's document root folder: it may point, for example, to an 
		 * upper folder which contains server-side scripts.
		 * 
		 * For better result, you should use the following algorithm in locating
		 * absolute resources:
		 * 1) Get parent folder for <code>editorFile</code> as a start point
		 * 2) Append required <code>fileName</code> to start point and test if
		 * file exists
		 * 3) If it doesn't exists, move start point one level up (to parent folder)
		 * and repeat step 2.
		 * 
		 * @param {String} editorFile
		 * @param {String} fileName
		 * @return {String} Returns null if <code>fileName</code> cannot be located
		 */
		locateFile: function(editorFile, fileName) {
			var dirname = editorFile, f;
			fileName = fileName.replace(/^\/+/, '');
			while (dirname && dirname !== this.dirname(dirname)) {
				dirname = this.dirname(dirname);
				f = this.resolvePath(dirname, fileName);
				if (DWfile.exists(f)) {
					return f;
				}
			}

			return '';
		},
		
		/**
	 * Creates absolute path by concatenating <code>parent</code> and <code>fileName</code>.
	 * If <code>parent</code> points to file, its parent directory is used
	 * @param {String} parent
	 * @param {String} fileName
	 * @return {String}
	 */
	createPath: function(parent, fileName, callback) {
		var stat = DWfile.getAttributes(parent);
		if (stat && !~stat.indexOf('D')) {
			parent = this.dirname(parent);
		}
		
		return callback(this.resolvePath(parent, fileName));
	},
		
		/**
		 * Saves <code>content</code> as <code>file</code>
		 * @param {String} file File's absolute path
		 * @param {String} content File content
		 */
		save: function(file, content) {
			file = this.resolvePath(this.dirname(document.URL), file);
			DWfile.write(file, content);
		},
		
		/**
		 * Returns file extension in lower case
		 * @param {String} file
		 * @return {String}
		 */
		getExt: function(file) {
			var m = (file || '').match(/\.([\w\-]+)$/);
			return m ? m[1].toLowerCase() : '';
		}
	}
})