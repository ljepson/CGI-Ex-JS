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
        this.TemplateError = function TemplateError(message) {
            var error = Error.call(this, message);

            this.name = 'TemplateError';
            this.message = error.message;
            this.stack = error.stack;
        };

        this.TemplateError.prototype = Object.create(Error.prototype);
        this.TemplateError.prototype.constructor = this.TemplateError;

        this._args = args || {};

        this.get_epoch = function() {
            return Math.floor(new Date().getTime() / 1000);
        };

        this.die = function(error) {
            throw new this.TemplateError(error);
        };

        this.croak = function(error) {
            this.die(error);
        };

        this.eval = function(func) {
            var args = [].splice.call(arguments, 1);

            try {
                var result = func.apply(this, args);

                return {
                    error: 0,
                    result: result
                };
            } catch(error) {
                return {
                    error: 1,
                    message: error
                };
            }
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
                var args = this._args || {};

                if (!args.encoding) {
                    args.encoding = 'utf8';
                }

                return fs.readFileSync(file, this._args);
            }

            return this.die('Unable to open file');
        };

        this.process = function(input, swap, callback) {
            var content;
            var template;

            if ('function' !== typeof callback) {
                return this.die('A function must be specified for the process callback');
            }

            // Got a file path
            if (file_exists.call(this, input)) {
                content = file_open.call(this, input, args);
                template = _.template(content, args)(swap);

                return callback(template);
            }

            return callback(this.die('No template could be found for:', input));
        };

        this.ENV = 'object' === typeof process ? process.env : {
            REQUEST_METHOD: 'GET'
        };

    };

    Template.extend = function(ChildClass) {
        if ('function' !== typeof ChildClass) {
            ChildClass = function() {};
        }

        ChildClass.prototype = new Template();
        ChildClass.prototype.constructor = ChildClass;

        return ChildClass;
    };

    return Template;

}));

