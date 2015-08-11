/* jshint strict: false, evil: true */
/* exported Template */
(function(root, factory) {
    'use strict';

    if ('function' === typeof define && define.amd) {
        define(['underscore'], factory);
    }
    else if ('object' === typeof module && module.exports) {
        module.exports = factory(require('underscore'));
    }
    else {
        root.Template = factory(root._);
    }
}(this, function(_) {
    'use strict';

    var Template = function(args) { // jshint ignore:line

        this._args = _.isObject(args) ? args : {};

        /* Error-handling */
        this.TemplateError = function(error_obj) {
            function TemplateError() {
                var error = Error.call(this, error_obj.message);

                _.extend(this, {code: 500}, error_obj, {
                    name: 'TemplateError',
                    message: error.message,
                    stack: error.stack
                });
            }

            TemplateError.prototype = Object.create(Error.prototype);

            throw new TemplateError();
        };

        this.is_dev = (function() {
            return 'development' === process.env.NODE_ENV;
        })();

        this.get_epoch = function get_epoch(date) {
            if (!this._date) {
                this._date = new Date();
            }

            return Math.floor(
                (date && _.isDate(date) ? date.getTime() : this._date.getTime()) / 1000
            );
        };

        this.error_codes = function error_codes(error) {
            if (!_.isObject(error)) {
                return error;
            }

            var error_code = error.errno || error.code;
            var error_message;

            var is_dev = 'development' === process.env.NODE_ENV;

            // FS - no such file or directory
            if (String(error_code).match(/^(-2|34)$/)) {
                error_message = is_dev ? error.message : '404 - File not found';
                error.code = 404;
            }

            // Make a copy of the original message before we overwrite it
            if (error_message) {
                error.orig_message = error.message;
                error.message = error_message;
            }

            return error;
        };

        this.die = function die(error) {
            if (this._is_dead) {
                throw this._is_dead;
            }

            if ('undefined' === typeof error) {
                error = '';
            }

            var default_message = 'There was an error. Please try again.';
            var error_keys = ['errno', 'msg', 'message'];

            // Make sure we are always dealing with an object
            var error_obj = error && _.isObject(error) ? error : {message: error};

            var found_key = _.find(error_keys, function(key) {
                return !!error_obj[key];
            });

            // Error codes, usually from core node modules
            if (found_key && 'errno' === found_key) {
                this.error_codes(error_obj);
            }
            else if (found_key && 'message' !== found_key) {
                console.error('unhandled key found in error obj:', found_key);
            }

            if (!error_obj.message) {
                error_obj.message = default_message;
            }

            try {
                throw new this.TemplateError(error_obj);
            } catch(err) {
                this._is_dead = err;
            }

            throw this._is_dead;
        };

        var fs = (function() {
            var fs;

            try {
                fs = require('fs');
            } catch(e) {}

            return fs;
        })();

        var file_stat = function(file) {
            if (fs) {
                return fs.statSync(file);
            }

            return this.die('Unable to check for file existence');
        };

        var file_exists = function(file) {
            return !!file_stat.call(this, file);
        };

        var file_read = function(file) {
            if (fs) {
                if (!this._args) {
                    this._args = {};
                }

                if (!this._args.encoding) {
                    this._args.encoding = 'utf8';
                }

                return fs.readFileSync(file, this._args);
            }

            return this.die('Unable to open file');
        };

        // Currently only supports file being a string or tree
        this.process = function(file, swap) {
            var doc = _.isObject(file) ? file : this.load_template(file);
            var out;

            if (_.isObject(doc)) {
                out = this.play_tree(doc._tree, swap);
            }

            if (out) {
                return out;
            }

            this.die('An error occurred while reading the template');
        };

        this.load_template = function(file) {
            if (!this._documents) {
                this._documents = this._not_found = {};
            }

            if (!this._GLOBAL_CACHE) {
                this._GLOBAL_CACHE = this._documents;
            }

            var docs = this._GLOBAL_CACHE;
            var doc;

            // File should have been a string -- tree now assumed
            if (_.isObject(file)) {
                return file;
            }

            // File is a string -- check for cache data first
            if (_.isString(file)) {
                var file_is_template = true;

                // See if the file exists
                try {
                    file_exists.call(this, file);

                    file_is_template = false;
                } catch(err) { }

                // File is actually the template content
                if (file_is_template) {
                    doc = {
                        _is_str_ref: 1,
                        _content: file,
                        name: 'input text',
                        modtime: this.get_epoch()
                    };
                }
                // File has already been cached
                else if (docs[file]) {
                    doc = docs[file];

                    // Un-modified or too soon since our last check
                    if (
                        (this.get_epoch() - doc.cache_time) < (
                            this._args.STAT_TTL || this.STAT_TTL
                        )
                    ) {
                        var modtime = this.get_epoch(file_stat(doc._filename).mtime);

                        if (doc.modtime === modtime) {
                            return doc;
                        }
                    }

                    // File has been modified so blow away the cache
                    _.each(['_tree', 'modtime', '_content', '_line_offsets'], function(k) {
                        doc[k] = null;
                    });
                }
                // File already determined to be a 404
                else if (this._not_found[file]) {
                    doc = this._not_found[file];

                    // Make sure it's not too soon since our last check
                    if (
                        (this.get_epoch() - doc.cache_time) < (
                            this._args.NEGATIVE_STAT_TTL || this._args.STAT_TTL || this.STAT_TTL
                        )
                    ) {
                        this.die(doc.exception);
                    }

                    this._not_found[file] = null;
                }
            }

            if (!doc) {
                doc = {};
            }

            // Looking up the file name
            if (doc && !doc._filename && _.isString(file)) {
                doc.name = file;

                var exception;

                try {
                    doc._filename = this.include_filename(file);
                } catch(err) {
                    exception = err;

                    // If failure caching wasn't explicitly turned off -- start it up
                    if (!this.hasOwnProperty('NEGATIVE_STAT_TTL') || this.NEGATIVE_STAT_TTL) {
                        this._not_found[file] = {
                            cache_time: this.get_epoch(),
                            exception: err
                        };
                    }
                }

                if (exception) {
                    this.die(exception);
                }
            }

            doc._tree = this.load_tree(doc);

            // If memory caching wasn't explicitly turned off -- start it up
            if (!this.hasOwnProperty('CACHE_SIZE') || this.CACHE_SIZE) {
                this.cache_time = this.get_epoch();

                if (_.isString(file)) {
                    docs[file] = docs[file] || (docs[file] = doc);
                }
                else if (doc._filename) {
                    docs[doc._filename] = doc;
                }

                if (this._args.CACHE_SIZE) {
                    var get_oldest = function(k) {
                        return docs[k].t;
                    };

                    while (_.keys(docs).length > this._args.CACHE_SIZE) {
                        var oldest_key = _.sortBy(_.keys(docs), get_oldest);

                        delete docs[oldest_key];
                    }
                }
            }

            return doc;
        };

        this.include_filename = function(file) {
            if (file.match(/^\//)) {
                if (this._args.ABSOLUTE) {
                    return this.die('Absolute file paths are not allowed unless ' +
                        'option ABSOLUTE is set');
                }

                if (file_exists.call(this, file)) {
                    return file;
                }
            }
            else if (file.match(/(^|\/)\.\.\//)) {
                if (!this._args.RELATIVE) {
                    return this.die('Relative file paths are not allowed unless ' +
                        'option RELATIVE is set');
                }

                if (file_exists.call(this, file)) {
                    return file;
                }
            }

            var paths = this.include_paths();

            if (this._args.ADD_LOCAL_PATH &&
                this._component &&
                this._component._filename
            ) {
                var match = this._component._filename.match(/^(.+)\/[^/]+$/);

                if (match) {
                    if (0 > this._args.ADD_LOCAL_PATH.length) {
                        paths.push(match[0]);
                    }
                    else {
                        paths.unshift(match[0]);
                    }
                }
            }

            var found_path;

            // Check each path for the requested file -- stop at the first success
            _.find(paths, _.bind(function(path) {
                var file_path = path + '/' + file;

                if (file_exists.call(this, file_path)) {
                    found_path = file_path;
                }

                return !!found_path;
            }, this));

            if (found_path) {
                return found_path;
            }

            this.die(file + ': not found');
        };

        this.include_paths = function() {
            if (this._include_paths) {
                return this._include_paths;
            }

            var paths = this._args.INCLUDE_PATH || ['.'];

            if (_.isFunction(paths)) {
                paths = paths();
            }

            if (_.isArray(paths)) {
                paths = this.split_paths(paths);
            }

            return paths;
        };

        this.split_paths = function(paths) {
            return paths;
        };

        // Support storing cache in the FS?
        this.load_tree = function(doc) {
            if (doc._filename) {
                if (!doc.modtime) {
                    doc.modtime = this.get_epoch(file_stat(doc._filename).mtime);
                }
            }

            if (!doc._content) {
                doc._content = file_read.call(this, doc._filename);
            }

            if (this._args.CONSTANTS) {
                var key = this._args.CONSTANT_NAMESPACE || 'constants';

                if (!this._args.NAMESPACE[key]) {
                    this._args.NAMESPACE[key] = this._args.CONSTANTS;
                }
            }

            this._component = doc;

            // Returns a compiled Underscore.js template
            return this.parse_tree(doc._content);
        };

        this.parse_tree = function(content) {
            return _.template(content);
        };

        this.play_tree = function(tree, swap) {
            return tree(swap);
        };

        this.error = function() {
            return this._error;
        };

    };

    Template.extend = function extend(ChildClass) {
        if ('function' !== typeof ChildClass) {
            ChildClass = function() {};
        }

        ChildClass.prototype = new Template();
        ChildClass.prototype.constructor = ChildClass;

        return ChildClass;
    };

    return Template;

}));

