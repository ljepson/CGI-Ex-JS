var Template = require('../../lib/template');
var config = require('../../config');

exports = module.exports = function(err, req, res, next) {
    'use strict';

    if (err.code && 404 === err.code) {
        var template_obj = new Template({
            INCLUDE_PATH: config.include_path || ['.']
        });

        var swap = {
            message: err.message,
            stack: err.stack,
            is_dev: template_obj.is_dev
        };

        var base_dir_abs = config.base_dir_abs || 'tt';
        var not_found_file = base_dir_abs + '/' + (config.not_found_file || 'errors/404.html');
        var error_mimetype = config.error_mimetype || 'text/html; charset=UTF-8';

        var output = template_obj.process(not_found_file, swap);

        // Sent a 404 status code
        res.status(404)
            // Supply the correct Content-Type headers and our output
            .mime(error_mimetype, output);
    }
    else {
        next(err);
    }

};
