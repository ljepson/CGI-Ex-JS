var connect = require('connect')();
var url = require('url');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var morgan = require('morgan');

var AppClass = require('lib/app');
var TemplateClass = require('lib/template');

var Template = TemplateClass.extend(function() {});

var App = AppClass.extend(function() {
    'use strict';

    this.template_obj = function template_obj(args) {
        if (this._template_obj) {
            return this._template_obj;
        }

        if ('undefined' !== typeof Template) {
            this._template_obj = new Template(args);

            return this._template_obj;
        }

        return false;
    };

    this.path_info = function path_info(pathname) {
        if ('undefined' !== typeof pathname) {
            this._path_info = pathname.replace(/^\/$/, '');
        }

        return this._path_info;
    };

    this.script_name = function script_name() {
        if (this._script_name) {
            return this._script_name;
        }

        this._script_name = this.current_step() || __filename;

        return this._script_name;
    };

    this.swap_template = function swap_template(step, file, swap) {
        var template_obj = this.__template_obj(step);
        var content;

        if (template_obj) {
            template_obj.process(file, swap, function(output) {
                if (output) {
                    content = output;
                }

                return false;
            });
        }

        return content;
    };

    this.print_out = function(step, out) {
        var mimetype = this.run_hook('mimetype', step);
        var charset = this.run_hook('charset', step);

        var content_type = mimetype +
            (charset && charset.match(/^[\w\-\.\:\+]+$/) ? '; charset=' + charset : '');

        this.__res.mime(content_type, out);

        this.__res.end();
    };

});

// Logging
connect.use(morgan('combined', {
    skip: function(req, res) {
        'use strict';

        return 400 > res.statusCode;
    }
}));

// Favicons support
connect.use(favicon(__dirname + '/favicon.ico'));

// Parse requests - application/x-www-form-urlencoded
connect.use(bodyParser.urlencoded({extended: false}));

// Parse requests - application/json
connect.use(bodyParser.json());

// Boot up main application
connect.use(function(req, res, next) {
    'use strict';

    var app = new App(req, res);
    var pathname = url.parse(req.url).pathname;

    app.path_info(pathname);

    try {
        app.navigate(req, res);
    } catch(err) {
        next(err);
    }
});

// 404 error
connect.use(function(err, req, res, next) {
    'use strict';

    res.end(err.message);
});

exports = module.exports = connect;
