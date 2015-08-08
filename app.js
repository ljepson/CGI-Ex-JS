var connect = require('connect')();
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
var morgan = require('morgan');
var meld = require('meld');
var quip = require('quip');
var url = require('url');

var AppClass = require('./lib/app');
var TemplateClass = require('./lib/template');

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

function get_methods(target) {
    'use strict';

    return Object.keys(target).filter(function(method) {
        return 'function' === typeof target[method];
    });
}

function after_log(result) {
    'use strict';

    var joinpoint = meld.joinpoint();
    var print_result;

    var args = joinpoint.args;

    for (var i = 0; i < args.length; i++) {
        // Response object
        if (args[i] instanceof require('http').ServerResponse) {
            args.splice(i, 1, 'res');

            continue;
        }

        // Request object
        if (args[i] instanceof require('http').IncomingMessage) {
            args.splice(i, 1, 'req');

            continue;
        }
    }

    if (result === this) { // jshint ignore:line
        print_result = 'self-reference';
    }

    if ('function' === typeof result) {
        print_result = 'function() {}';
    }

    if ('history' === joinpoint.method) {
        print_result = 'TRUNCATED HISTORY';
    }

    console.log(joinpoint.method);
    console.log('args:', args);
    console.log('return:', print_result || result);
    console.log('--');
}

if ('debug' === process.env.NODE_ENV) {
    meld.after(App, get_methods, after_log);
    meld.after(App.prototype, get_methods, after_log);
}

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

connect.use(quip);

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

// Error - 404
connect.use(require('./routes/404'));

// Error - 500
connect.use(function(err, req, res, next) { // jshint ignore:line
    'use strict';

    res.end(err.message);
});

exports = module.exports = connect;
