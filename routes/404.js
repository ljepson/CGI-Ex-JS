var Template = require('../lib/template');

exports = module.exports = function(err, req, res, next) {
    'use strict';

    var template_obj = new Template();

    var swap = {
        message: err.message,
        stack: err.stack,
        is_dev: template_obj.is_dev
    };

    template_obj.process('./tt/errors/404.html', swap, function(out) {
        // Sent a 404 status code
        res.status(404)
            // Supply the correct Content-Type headers and our output
            .mime('text/html; charset=UTF-8', out);
    });

    next(err);

};
