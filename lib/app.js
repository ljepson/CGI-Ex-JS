/* jshint strict: false, evil: true */
/* exported App */
(function(root, factory) {
    'use strict';

    if ('function' === typeof define && define.amd) {
        define(['underscore', './template'], factory);
    }
    else if ('object' === typeof module && module.exports) {
        module.exports = factory(require('underscore'), require('./template'));
    }
    else {
        root.App = factory(root._, root.Template);
    }
}(this, function(_, Template) {
    'use strict';

    var App = function(req, res) { // jshint ignore:line

        /* Error-handling */
        this.AppError = function(message) {
            function AppError(message) {
                var error = Error.call(this, message);

                this.name = 'AppError';
                this.orig_message = error.orig_message;
                this.message = error.message;
                this.stack = error.stack;
                this.code = error.errno || error.code || error.status;
            }

            AppError.prototype = Object.create(Error.prototype);

            try {
                throw new AppError(message);
            } catch(err) {
            }

            throw new AppError(message);
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

            var error_code = String(error.errno || error.code || error.status);
            var error_message;

            // FS - no such file or directory
            if (String(error_code).match(/^(34|\-2)$/)) {
                error_message = this.is_dev ? error.message : '404 - File not found';
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
                throw new this.AppError(error_obj);
            } catch(err) {
                this._is_dead = err;
            }

            throw this._is_dead;
        };

        this.croak = function croak(error) {
            this.die(error);
        };

        this.init = function init() {
            return {};
        };

        this.init_from_conf = function init_from_conf() {
            return {};
        };

        this.import = function _import() {
        };

        this.eval = function _eval(func) {
            var args = [].splice.call(arguments, 1);
            var has_exceptions = true;
            var result;

            try {
                result = func.apply(this, args);

                has_exceptions = false;
            } catch(err) {
                result = err;
            }

            return {
                error: !!has_exceptions,
                method: func.name,
                arguments: args,
                result: result
            };
        };

        this.navigate = function navigate(req, res) {
            this._time = this.get_epoch();
            this.__req = req;
            this.__res = res;

            var exception = true;

            try {
                if (!this._no_pre_navigate && this.pre_navigate()) {
                    return this;
                }

                this._morph_lineage_start_index = (
                    this._morph_lineage && this._morph_lineage.length
                ) || [];

                this.nav_loop();

                exception = false;
            // Don't think this catch block is being handled correctly...
            } catch(err) {
                exception = err;
            }

            // Calling this.die here will throw, ending the rest of execution
            if (exception) {
                this.die(exception);
            }

            // Need to finish porting the rest of the navigate method...

            if (!this._no_post_navigate) {
                var result = this.eval(this.post_navigate);
                var error = result.error && result.message;

                if (error) {
                    this.handle_error(error);
                }
            }

            this.destroy();

            return this;
        };

        this.can = function can(method) {
            if (this[method]) {
                return this[method];
            }

            return false;
        };

        this.nav_loop = function nav_loop() {
            if ('undefined' === typeof this._recurse) {
                this._recurse = 0;
            }

            var recurse_limit = this.recurse_limit();

            if (this._recurse++ >= recurse_limit) {
                var err = 'recurse_limit ("' + recurse_limit + '") reached';

                return this.croak(
                    1 >= (this.jumps || 0) ? err : err + ' number of jumps (' + this.jumps + ')'
                );
            }

            var path = this.path();

            if (this.pre_loop(path)) {
                return;
            }

            if (path && path.length) {
                if ('undefined' === typeof this._path_i) {
                    this._path_i = 0;
                }

                for (this._path_i; this._path_i <= path.length; this._path_i++) {
                    var step = path[this._path_i];

                    var _step = step && step.match(/^([^\W0-9]\w*)$/);

                    if (!_step) {
                        var stash = this.stash();

                        stash.forbidden_step = step;

                        this.goto_step(this.forbidden_step);
                    }

                    step = _step[0];

                    if (!this.is_authed()) {
                        var req = this.run_hook('require_auth', step, 1);

                        if (req && this.run_hook('get_valid_auth', step)) {
                            return;
                        }
                    }

                    this.run_hook('morph', step);

                    this.parse_path_info('path_info_map', this.run_hook('path_info_map', step));

                    if (this.run_hook('run_step', step)) {
                        this.run_hook('unmorph', step);

                        return;
                    }
                }
            }

            if (this.post_loop(path)) {
                return;
            }

            this.insert_path(this.default_step());

            this.nav_loop();

            return;
        };

        this.path = function path() {
            if (arguments.length) {
                this._path = arguments[0];
            }

            if (!this._path) {
                this._path = [];
            }

            this.parse_path_info('path_info_map_base', this.path_info_map_base());

            var form = this.form();
            var step = form[this.step_key()];

            if (step) {
                step = step.replace(/^\/+/, '');
                step = step.replace(/\//, '__');

                var stash = this.stash();

                // Forbidden step
                if (step.match(/^_/)) {
                    stash.forbidden_step = step;

                    this._path.push(this.forbidden_step);
                }

                // Must be a valid step
                var valid_steps = this.valid_steps();

                if (
                    valid_steps &&
                    !valid_steps[step] &&
                    step !== this.default_step() &&
                    step !== this.js_step()
                ) {
                    stash.forbidden_step = step;

                    this._path.push(this.forbidden_step);
                }
                else {
                    this._path.push(step);
                }
            }

            return this._path;
        };

        this.parse_path_info = function parse_path_info(type, maps, info, form) {
            if (!maps) {
                return;
            }

            if (!info) {
                info = this.path_info() || false;

                // Still don't have path info...
                if (!info) {
                    return;
                }
            }

            if (!_.isArray(maps)) {
                return this.croak('Usage: this.' + type + ' = [];');
            }

            _.find(maps, _.bind(function(map) {
                if (!_.isArray(map)) {
                    return this.croak('Usage: this.' + type +
                        " = [[/path_info/(\\w+)/, 'keyname']]");
                }

                var match = info.match(map[0]);

                if (!match) {
                    return false;
                }

                if (!form || (form && !_.isObject(form))) {
                    form = this.form();
                }

                if (_.isFunction(match[1])) {
                    match[1](form, match);
                }
                else {
                    for (var i = 1; i < map.length; i++) {
                        if (form[map[i]]) {
                            continue;
                        }

                        form[map[i]] = match[i];
                    }
                }

                return true;

            }, this));
        };

        this.run_hook = function run_hook(hook, step) {
            var code;
            var found;

            if (_.isFunction(hook)) {
                code = hook;
                hook = 'coderef';
            }
            else {
                var find_hook = this.find_hook(hook, step);

                code = find_hook[0];
                found = find_hook[1];
            }

            if (!code) {
                return this.croak('Could not find a method named ' +
                    step + '_' + hook + ' or' + hook);
            }

            var args = [].splice.call(arguments, 1);

            var response = code.apply(this, args);

            if (this._no_history) {
                return response;
            }

            var history = this.history();
            var history_item = {
                step: step,
                meth: hook,
                found: found,
                time: this.get_epoch(),
                level: 0,
                elapsed: 0
            };

            history_item.level = 1 + (this.__level || 0);

            history_item.response = response;

            history_item.elapsed = this.get_epoch() - history_item.time;

            history.push(history_item);

            return history_item.response;
        };

        this.find_hook = function find_hook(hook, step) {
            if (!hook) {
                return this.croak('Missing hook name');
            }

            if (step) {
                var code = this.can(step + '_' + hook);

                if (code) {
                    return [code, step + '_' + hook];
                }

                code = this.can(hook);

                if (code) {
                    return [code, hook];
                }
            }

            return;
        };

        this.run_hook_as = function run_hook_as() {
        };

        this.run_step = function run_step(step) {
            if (this.run_hook('pre_step', step)) {
                return 1;
            }

            if (this.run_hook('skip', step)) {
                return 0;
            }

            if (!this.run_hook('prepare', step) ||
                !this.run_hook('info_complete', step) ||
                !this.run_hook('finalize', step)) {

                this.run_hook('prepared_print', step);
                this.run_hook('post_print', step);

                return 1;
            }

            if (this.run_hook('post_step', step)) {
                return 1;
            }

            return 0;
        };

        this.prepared_print = function prepared_print(step) {
            var get_hash = function(hook) {
                var hash = this.run_hook(hook, step);

                return _.isObject(hash) ? hash : {};
            };

            var hash_form = get_hash.call(this, 'hash_form');
            var hash_base = get_hash.call(this, 'hash_base');
            var hash_comm = get_hash.call(this, 'hash_common');
            var hash_swap = get_hash.call(this, 'hash_swap');
            var hash_fill = get_hash.call(this, 'hash_fill');
            var hash_errs = get_hash.call(this, 'hash_errors');

            _.each(_.keys(hash_errs), _.bind(function(key) {
                hash_errs[key] = this.format_error(hash_errs[key]);

                if (!hash_errs.has_errors && hash_errs[key]) {
                    hash_errs.has_errors = 1;
                }
            }, this));

            var swap = _.extend({}, hash_form, hash_base, hash_comm, hash_swap, hash_errs);
            var fill = _.extend({}, hash_form, hash_base, hash_comm, hash_fill);

            this.run_hook('print', step, swap, fill);
        };

        this.print = function print(step, swap, fill) {
            var file = this.run_hook('file_print', step);
            var out = this.run_hook('swap_template', step, file, swap);

            this.run_hook('fill_template', step, out, fill);
            this.run_hook('print_out', step, out);
        };

        // This method is effectively *worthless* right now
        this.handle_error = function handle_error(error) {
            this.die(error);
        };

        this.allow_morph = function allow_morph() {
        };

        this.auth_args = function auth_args() {
        };

        this.auth_obj = function auth_obj() {
        };

        this.charset = function charset() {
            return this._charset || '';
        };

        this.conf_args = function conf_args() {
            return this._conf_args;
        };

        this.conf_die_on_fail = function conf_die_on_fail() {
            if (this._conf_die_on_fail) {
                return this._conf_die_on_fail;
            }

            return !this.hasOwnProperty('_conf_die_on_fail');
        };

        this.conf_path = function conf_path() {
            return this._conf_path || this.base_dir_abs();
        };

        this.conf_validation = function conf_validation() {
            return this._conf_validation;
        };

        this.default_step = function default_step() {
            return this._default_step || 'main';
        };

        this.error_step = function error_step() {
            return this._error_step || '__error';
        };

        this.fill_args = function fill_args() {
            return this._fill_args || null;
        };

        this.forbidden_step = function forbidden_step() {
            return this._forbidden_step || '__forbidden';
        };

        this.form_name = function form_name() {
            return this._form_name || 'theform';
        };

        this.history = function history() {
            this._history = this._history || [];

            return this._history;
        };

        this.js_step = function js_step() {
            return this._js_step || 'js';
        };

        this.login_step = function login_step() {
            return this._login_step || '__login';
        };

        this.mimetype = function mimetype() {
            return this._mimetype || 'text/html';
        };

        this.path_info = function path_info() {
            if (this._path_info) {
                return this._path_info;
            }

            this._path_info = window.location.pathname;

            return this._path_info;
        };

        this.path_info_map_base = function path_info_map_base() {
            return this._path_info_map_base || (this._path_info_map_base = [[/(\w+)/, this.step_key()]]);
        };

        this.recurse_limit = function recurse_limit() {
            return this._recurse_limit || 15;
        };

        this.script_name = function script_name() {
            if (this._script_name) {
                return this._script_name;
            }

            this._script_name = this.path_info();

            return this._script_name;
        };

        this.stash = function stash() {
            this._stash = this._stash || {};

            return this._stash;
        };

        this.step_key = function step_key() {
            this._step_key = this._step_key || 'step';

            return this._step_key;
        };

        this.template_args = function template_args() {
            return this._template_args || null;
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

        this.template_path = function template_path() {
            return this._template_path || this.base_dir_abs();
        };

        this.val_args = function val_args() {
            return this._val_args || null;
        };

        this.val_path = function val_path() {
            return this._val_path || this.template_path();
        };

        // Port CGI::Ex::Conf to JS-land...
        this.conf_obj = function conf_obj() {
        };

        // Port CGI::Ex::Validate to JS-land...
        this.val_obj = function val_obj() {
        };

        this.auth_data = function auth_data(data) {
            if (2 === arguments.length) {
                this._auth_data = data;
            }

            return this._auth_data;
        };

        this.base_dir_abs = function base_dir_abs(dir) {
            if (2 === arguments.length) {
                this._base_dir_abs = dir;
            }

            return this._base_dir_abs || (this._base_dir_abs = ['.']);
        };

        this.base_dir_rel = function base_dir_rel(dir) {
            if (2 === arguments.length) {
                this._base_dir_rel = dir;
            }

            return this._base_dir_rel || (this._base_dir_rel = '');
        };

        // Port CGI::Ex to JS-land...
        this.cgix = function cgix() {
        };

        this.cookies = function cookies(c) {
            if (2 === arguments.length) {
                this._cookies = c;
            }

            if (!this._cookies) {
                this._cookies = this.cgix.get_cookies();
            }

            return this._cookies;
        };

        this.ext_conf = function ext_conf(ext) {
            if (2 === arguments.length) {
                this._ext_conf = ext;
            }

            return this._ext_conf || (this._ext_conf = 'pl');
        };

        this.ext_print = function ext_print(ext) {
            if (2 === arguments.length) {
                this._ext_print = ext;
            }

            return this._ext_print || (this._ext_print = 'html');
        };

        this.ext_val = function ext_val(ext) {
            if (2 === arguments.length) {
                this._ext_val = ext;
            }

            return this._ext_val || (this._ext_val = 'val');
        };

        this.form = function form() {
            this._form = this._form || (this._form = {});

            if (2 === arguments.length) {
                var last_argument = _.last(arguments);

                if (_.isObject(last_argument)) {
                    this._form = _.last(arguments);
                }
            }

            return this._form;
        };

        this.load_conf = function load_conf() {
            if (2 === arguments.length) {
                this._load_conf = _.last(arguments);
            }

            return this._load_conf;
        };

        this.conf = function conf(data) {
            if (1 === arguments.length) {
                this._conf = data;
            }

            if (this._conf) {
                return this._conf;
            }

            // Finish porting the rest of CGI::Ex::Conf...
            var conf_file = this.eval(this.conf_file);
            var conf_obj = this.eval(this.conf_obj);
            var config;

            if (conf_file && !_.isObject(conf_file)) {
                config = conf_obj.read(conf_file, {no_warn_on_fail: 1}) || false;

                if (!config && this.conf_die_on_fail()) {
                    return this.croak();
                }
            }

            var conf_validation = this.conf_validation();

            if (conf_validation && _.keys(conf_validation).length) {
                var error_obj = this.val_obj.validate(config, conf_validation);

                if (error_obj) {
                    return this.croak(error_obj);
                }
            }

            this._conf = config;

            return this._conf;
        };

        this.conf_file = function conf_file(file) {
            if (1 === arguments.length) {
                this._conf_file = file;
            }

            if (this._conf_file) {
                return this._conf_file;
            }

            var module = this.name_module();

            if (!module) {
                return this.croak('Missing name_module during conf_file call');
            }

            this._conf_file = module + '.' + this.ext_conf();

            return this._conf_file;
        };

        this.add_to_base = function add_to_base() {
            return this.add_to_hash(this.hash_base(), arguments);
        };

        this.add_to_common = function add_to_common() {
            return this.add_to_hash(this.hash_common(), arguments);
        };

        this.add_to_errors = function add_to_errors() {
            return this.add_errors(arguments);
        };

        this.add_to_fill = function add_to_fill() {
            return this.add_to_hash(this.hash_fill(), arguments);
        };

        this.add_to_form = function add_to_form() {
            return this.add_to_hash(this.hash_form(), arguments);
        };

        this.add_to_path = function add_to_path() {
            return this.append_path(arguments);
        };

        this.add_to_swap = function add_to_swap() {
            return this.add_to_hash(this.hash_swap(), arguments);
        };

        this.append_path = function append_path() {
            var path = this.path();

            path.push(arguments);

            return path;
        };

        this.cleanup_user = function cleanup_user(user) {
            return user;
        };

        this.current_step = function current_step() {
            return this.step_by_path_index(this._path_i || 0);
        };

        this.destroy = function destroy() {
            return;
        };

        this.first_step = function first_step() {
            return this.step_by_path_index(0);
        };

        this.fixup_after_morph = function fixup_after_morph() {
            return;
        };

        this.fixup_before_unmorph = function fixup_before_unmorph() {
            return;
        };

        this.format_error = function format_error(error) {
            return error;
        };

        this.get_pass_by_user = function get_pass_by_user() {
            return this.croak('get_pass_by_user is a virtual method and needs to be overridden ' +
                'for authentication to work');
        };

        this.has_errors = function has_errors() {
            var hash_errors = this.hash_errors();

            return _.keys(hash_errors).length;
        };

        this.last_step = function last_step() {
            var path = this.path();

            return this.step_by_path_index(path.length - 1);
        };

        this.path_info_map = function path_info_map() {
            return;
        };

        this.post_loop = function post_loop() {
            return 0;
        };

        this.post_navigate = function post_navigate() {
            return;
        };

        this.pre_loop = function pre_loop() {
            return 0;
        };

        this.pre_navigate = function pre_navigate() {
            return 0;
        };

        this.previous_step = function previous_step() {
            return this.step_by_path_index((this._path_i || 0) - 1);
        };

        this.valid_steps = function valid_steps() {
            return;
        };

        this.verify_user = function verify_user() {
            return 1;
        };

        this.add_errors = function add_errors() {
        };

        this.add_to_hash = function add_to_hash(old_obj, new_obj) {
            return $.extend(true, {}, old_obj, new_obj);
        };

        this.clear_app = function clear_app() {
            var keys = [
                'cgix', 'cookies', 'form', 'hash_common', 'hash_errors', 'hash_fill',
                'hash_swap', 'history', '_morph_lineage', '_morph_lineage_start_index',
                'path', 'path_i', 'stash', 'val_obj'
            ];

            _.each(keys, _.bind(function(key) {
                this[key] = null;
            }, this));

            return this;
        };

        this.dump_history = function dump_history() {
        };

        this.exit_nav_loop = function exit_nav_loop() {
        };

        this.insert_path = function insert_path(steps) {
            var steps_array = _.isArray(steps) ? steps : [steps];
            var path = this.path();
            var i = this._path_i || 0;
            var updated_path = [];

            if (i + 1 > path.length) {
                updated_path = _.flatten([path, steps_array]);
            }
            else {
                [].splice.apply(updated_path, _.flatten([i + 1, 0], steps_array));
            }

            this.path(updated_path);
        };

        this.jump = function jump() {
        };

        this.goto_step = function goto_step() {
        };

        this.js_uri_path = function js_uri_path() {
        };

        this.morph = function morph() {
        };

        this.replace_path = function replace_path() {
        };

        this.set_path = function set_path() {
        };

        this.step_by_path_index = function step_by_path_index(index) {
            if (!index) {
                index = 0;
            }

            var path = this.path() || [];

            if (0 > index) {
                return '';
            }

            return path[index];
        };

        this.unmorph = function unmorph() {
        };

        this.file_print = function file_print(step) {
            var base_dir = this.base_dir_rel();
            var module = this.run_hook('name_module', step);
            var _step = this.run_hook('name_step', step);

            if (!_step) {
                return this.croak('Missing name_step');
            }

            _step.replace(/\B__+/g, '/');

            if (!_step.match(/\.\w+$/)) {
                _step += '.' + this.ext_print();
            }

            var result = '';

            _.each([base_dir, module], function(v) {
                if (v.length && !v.match(/\/$/)) {
                    v = (v || '') + '/';
                }

                result += v;
            });

            return result + _step;
        };

        this.file_val = function file_val(step) {
            var abs = this.val_path() || [];

            if (_.isFunction(abs)) {
                abs = abs.call(this);
            }
            else if (!_.isArray(abs)) {
                abs = [abs];
            }

            if (0 === abs.length) {
                return {};
            }

            var base_dir = this.base_dir_rel();
            var module = this.run_hook('name_module', step);
            var _step = this.run_hook('name_step', step);

            if (!_step) {
                return this.croak('Missing name_step');
            }

            _step = _step.replace(/\B__+/g, '/');
            _step = _step.replace(/\.\w+$/, '');
            _step += '.' + this.ext_val();

            var convert_text = function(val) {
                var result = '';

                if (_.isArray(val)) {
                    result += _.each(val, convert_text);
                }
                else {
                    result += val;
                }

                if (val && 'string' === typeof val && !val.match(/\/$/)) {
                    result += '/';
                }

                return result;
            };

            _.each(abs, function(val, i) {
                abs.splice(i, 1, convert_text(val));
            });

            base_dir = convert_text(base_dir);
            module = convert_text(module);

            if (1 < abs.length) {
                _.find(abs, function(val) {
                    var file = val + '/' + base_dir + '/' + module + '/' + _step;
                    var fs;

                    try {
                        fs = require('fs');
                    } catch(e) {}

                    if ('undefined' !== fs) {
                        return !!fs.statSync(file);
                    }

                    return false;
                });
            }

            var file = abs[0] + base_dir + module + _step;

            return file;
        };

        this.fill_template = function fill_template() {
        };

        this.finalize = function finalize() {
            return 0;
        };

        this.hash_base = function hash_base(step) {
            var hash = this._hash_base || (this._hash_base = {
                script_name: this.script_name(),
                path_info: this.path_info()
            });

            hash.js_validation = function() {
                this.run_hook('js_validation', step, arguments[0]);
            };

            hash.generate_form = function() {
                this.run_hook('generate_form', step, arguments[0]);
            };

            hash.form_name = this.run_hook('form_name', step);

            hash[this.step_key()] = step;

            return hash;
        };

        this.hash_common = function hash_common() {
            return this._hash_common || (this._hash_common = {});
        };

        this.hash_errors = function hash_errors() {
            return this._hash_errors || (this._hash_errors = {});
        };

        this.hash_fill = function hash_fill() {
            return this._hash_fill || (this._hash_fill = {});
        };

        this.hash_form = function hash_form() {
            return this.form();
        };

        this.hash_swap = function hash_swap() {
            return this._hash_swap || (this._hash_swap = {});
        };

        this.hash_validation = function hash_validation(step) {
            this._hash_validation = this._hash_validation || (this._hash_validation = {});

            if (this._hash_validation[step]) {
                return this._hash_validation[step];
            }

            var file = this.run_hook('file_val', step);

            if (file) {
                var has_exception = true;

                try {
                    this._hash_validation[step] = this.val_obj.get_validation(file);
                    has_exception = false;
                } catch(err) {}

                if (has_exception) {
                    this._hash_validation[step] = {};
                }

                return this._hash_validation[step];
            }

            return {};
        };

        this.info_complete = function info_complete(step) {
            if (this.run_hook('ready_validate', step)) {
                return 0;
            }

            return this.run_hook('validate', step, this.form()) ? 1 : 0;
        };

        this.js_validation = function js_validation() {
        };

        this.generate_form = function generate_form() {
        };

        this.morph_base = function morph_base() {
        };

        this.morph_package = function morph_package() {
        };

        this.name_module = function name_module(step) {
            if (this._name_module) {
                return this._name_module;
            }

            var script_name = this.script_name();
            var match = script_name.match(/(\w+)(?:\.\w+)?$/);

            if (match && match[1]) {
                this._name_module = match[1];

                return this._name_module;
            }

            this.die('Could not determine module name from "name_module" lookup (' +
                (step || '') + ')\n');
        };

        this.name_step = function name_step(step) {
            return step;
        };

        this.next_step = function next_step() {
            this.step_by_path_index((this._path_i || 0) + 1);
        };

        this.post_print = function post_print() {
            return 0;
        };

        this.post_step = function post_step() {
            return 0;
        };

        this.pre_step = function pre_step() {
            return 0;
        };

        this.prepare = function prepare() {
            return 1;
        };

        this.print_out = function print_out(step, out) {
            $('body').html(out);
        };

        this.ready_validate = function ready_validate(step) {
            if (this.run_hook('validate_when_data', step)) {
                var keys = _.keys(this.run_hook('hash_validation', step) || {});
                var form = this.form();

                return _.find(keys, function(key) {
                    return form.hasOwnProperty(key);
                }) ? 1 : 0;
            }

            return this.ENV.REQUEST_METHOD && 'POST' === this.ENV.REQUEST_METHOD ? 1 : 0;
        };

        this.refine_path = function refine_path() {
        };

        this.set_ready_validate = function set_ready_validate() {
        };

        this.skip = function skip() {
        };

        this.get_template = function get_template(file) {
            if (!this._templates) {
                this._templates = {};
            }

            if (!this._templates[file]) {
                this._templates[file] = $('script[data-file="' + file + '"]').html();
            }

            return this._templates[file];
        };

        this.template_settings = function template_settings() {
            _.templateSettings = {
                evaluate: /<%([\s\S]+?)%>/g,
                interpolate: /<%=([\s\S]+?)%>/g,
                escape: /<%-([\s\S]+?)%>/g
            };
        };

        this.swap_template = function swap_template(step, file, swap) {
            var template = this.get_template(file);
            var out = _.template(template)(swap);

            return out;
        };

        this.__template_obj = function __template_obj(step) {
            var args = this.run_hook('template_args', step) || {};

            if (!args.INCLUDE_PATH) {
                args.INCLUDE_PATH = args.include_path || this.template_path();
            }

            return this.template_obj(args);
        };

        this.validate = function validate(step, form) {
            var hash = this.__hash_validation(step);

            if (!hash || (hash && !_.keys(hash).length)) {
                return 1;
            }

            var validated_fields = [];

            // Error check here to make sure this.val_obj is defined and has a validate method
            var err_obj = this.eval(this.val_obj.validate, form, hash, validated_fields);

            if (err_obj) {
                this.add_errors(
                    err_obj.as_hash({
                        as_hash_join: '<br>\n',
                        as_hash_suffix: '_error'
                    })
                );

                return 0;
            }

            if (err_obj.error) {
                this.die('Step' + step + ': ' + err_obj.message);
            }

            // Finish porting the validate sub here...
            for (var i = 0; i < validated_fields.length; i++) {
                console.trace();
            }

            return 1;
        };

        this.__hash_validation = function __hash_validation() {
            // Need to convert arguments into a real array and add hash_validation to the front
            var args = ['hash_validation']
                .concat([].splice.call(arguments, 0));

            this.run_hook.apply(this, args);
        };

        this.validate_when_data = function validate_when_data() {
            return 1 || this._validate_when_data;
        };

        this.navigate_authenticated = function navigate_authenticated() {
        };

        this.require_auth = function require_auth(auth) {
            if (
                1 === arguments.length &&
                (!_.isUndefined(auth) && (_.isFunction(auth) || require_auth.match(/^[01]$/)))
            ) {
                this._require_auth = auth;
            }

            return this._require_auth || 0;
        };

        this.is_authed = function is_authed() {
            var data = this._auth_data;

            return data && !data.error;
        };

        this.check_valid_auth = function check_valid_auth() {
        };

        this.get_valid_auth = function get_valid_auth() {
        };

        this._do_auth = function _do_auth() {
        };

        this.js_require_auth = function js_require_auth() {
        };

        this.js_run_step = function js_run_step() {
        };

        /* Forbidden Step */
        this.__forbidden_require_auth = 0;

        this.__forbidden_allow_morph = function __forbidden_allow_morph() {
        };

        this.__forbidden_info_complete = 0;

        this.__forbidden_hash_common = function __forbidden_hash_common() {
        };

        this.__forbidden_file_print = function __forbidden_file_print() {
        };

        /* Error Step */
        this.__error_allow_morph = function __error_allow_morph() {
        };

        this.__error_info_complete = 0;

        this.__error_hash_common = function __error_hash_common() {
        };

        this.__error_file_print = function __error_file_print() {
        };

        /* Login Step */
        this.__login_require_auth = 0;

        this.__login_allow_morph = function __login_allow_morph() {
        };

        this.__login_info_complete = 0;

        this.__login_hash_common = function __login_hash_common() {
        };

        this.__login_file_print = function __login_file_print() {
        };

        this.ENV = 'object' === typeof process ? process.env : {
            REQUEST_METHOD: 'GET'
        };

    };

    App.extend = function extend(ChildClass) {
        if ('function' !== typeof ChildClass) {
            ChildClass = function() {};
        }

        ChildClass.prototype = new App();
        ChildClass.prototype.constructor = ChildClass;

        return ChildClass;
    };

    return App;

}));

