var meld = require('meld');

exports.get_methods = function get_methods(target) {
    'use strict';

    return Object.keys(target).filter(function(method) {
        return 'function' === typeof target[method];
    });
};

exports.after_log = function after_log(result) {
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
};
