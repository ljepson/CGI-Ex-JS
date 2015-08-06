var connect = require('connect')();
var quip = require('quip');
var url = require('url');

var AppClass = require('lib/app');
var TemplateClass = require('lib/template');

var Template = TemplateClass.extend(function() {
    'use strict';

    this.die = function die(error) {
        console.error(error);
    };
});

var App = AppClass.extend(function() {
    'use strict';

    this.die = function die(error) {
        console.error(error);

        this.__res.end(JSON.stringify(error));

        console.trace();
        throw error;
    };

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

// Favicons support
var favicon = require('serve-favicon');

connect.use(favicon(__dirname + '/favicon.ico'));

connect.use(quip, function(req, res) {
    'use strict';

    var app = new App(req, res);

    var pathname = url.parse(req.url).pathname;

    app.path_info(pathname);

    app.navigate(req, res);
});

exports = module.exports = connect;
