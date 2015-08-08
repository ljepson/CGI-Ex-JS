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

        /* Error-handling */
        this.TemplateError = function(message) {
            function TemplateError(message) {
                var error = Error.call(this, message);

                this.name = 'TemplateError';
                this.orig_message = error.orig_message;
                this.message = error.message;
                this.stack = error.stack;
                this.code = error.errno || error.code || error.status;
            }

            TemplateError.prototype = Object.create(Error.prototype);

            try {
                throw new TemplateError(message);
            } catch(err) {
            }

            throw new TemplateError(message);
        };

        this.is_dev = (function() {
            return 'development' === process.env.NODE_ENV;
        })();

        this.get_epoch = function get_epoch() {
            if (!this._date) {
                this._date = new Date();
            }

            return Math.floor(this._date.getTime() / 1000);
        };

        this.error_codes = function error_codes(error) {
            if (!_.isObject(error)) {
                return error;
            }

            var error_code = error.errno || error.code;
            var error_message;

            var is_dev = 'development' === process.env.NODE_ENV;

            // FS - no such file or directory
            if (34 === error_code) {
                error_message = is_dev ? error.message : '404 - File not found';
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
            else if (found_key) {
                console.trace();
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

        this.init = function init() {
            return {};
        };

        var fs = (function() {
            var fs;

            try {
                fs = require('fs');
            } catch(e) {}

            return fs;
        })();

        var file_exists = function(file) {
            if (fs) {
                return !!fs.statSync(file);
            }

            return this.die('Unable to check for file existence');
        };

        var file_open = function(file) {
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

        this.process = function(input, swap, callback) {
            if ('function' !== typeof callback) {
                try {
                    this.die('A function must be specified for the process callback');
                } catch(err) {
                    return callback(err);
                }
            }

            // Got a file path
            if (file_exists.call(this, input)) {
                var content = file_open.call(this, input);
                var output = _.template(content, args)(swap);

                return callback(output);
            }

            var template_error;

            return callback(this.die('No template could be found for:' + input));
            try {
            } catch(err) {
            //    template_error = err;
            }

            return callback(template_error);
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

