/* jshint strict: false */
/* exported CGIEx */
(function(root, factory) {
    'use strict';

    if ('function' === typeof define && define.amd) {
        define([], factory);
    }
    else if ('object' === typeof module && module.exports) {
        module.exports = factory();
    }
    else {
        root.CGIEx = factory();
    }
}(this, function() {
    'use strict';

    /**
     * CGI::Ex - JavaScript port
     * Provides cookie parsing and form data handling
     */
    var CGIEx = function(req) {
        this._req = req;
    };

    /**
     * Parse and return cookies from request
     * @returns {Object} Cookie key-value pairs
     */
    CGIEx.prototype.get_cookies = function() {
        if (this._cookies) {
            return this._cookies;
        }

        this._cookies = {};

        if (!this._req || !this._req.headers || !this._req.headers.cookie) {
            return this._cookies;
        }

        var cookie_header = this._req.headers.cookie;
        var cookies = cookie_header.split(';');

        for (var i = 0; i < cookies.length; i++) {
            var parts = cookies[i].split('=');
            var key = parts[0].trim();
            var value = parts.length > 1 ? parts.slice(1).join('=').trim() : '';

            try {
                this._cookies[key] = decodeURIComponent(value);
            } catch(e) {
                this._cookies[key] = value;
            }
        }

        return this._cookies;
    };

    /**
     * Get form data from request
     * Works with both GET query params and POST body
     * @returns {Object} Form data key-value pairs
     */
    CGIEx.prototype.get_form = function() {
        if (this._form) {
            return this._form;
        }

        this._form = {};

        if (!this._req) {
            return this._form;
        }

        // Get query parameters (for GET requests)
        if (this._req.query) {
            for (var key in this._req.query) {
                if (this._req.query.hasOwnProperty(key)) {
                    this._form[key] = this._req.query[key];
                }
            }
        }

        // Get body parameters (for POST requests)
        if (this._req.body) {
            for (var bodyKey in this._req.body) {
                if (this._req.body.hasOwnProperty(bodyKey)) {
                    this._form[bodyKey] = this._req.body[bodyKey];
                }
            }
        }

        return this._form;
    };

    /**
     * Set a cookie value
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value
     * @param {Object} options - Cookie options (expires, path, domain, secure, httpOnly)
     * @returns {string} Set-Cookie header value
     */
    CGIEx.prototype.set_cookie = function(name, value, options) {
        options = options || {};

        var cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value);

        if (options.expires) {
            if (typeof options.expires === 'number') {
                var date = new Date();
                date.setTime(date.getTime() + (options.expires * 1000));
                cookie += '; Expires=' + date.toUTCString();
            } else if (options.expires instanceof Date) {
                cookie += '; Expires=' + options.expires.toUTCString();
            }
        }

        if (options.path) {
            cookie += '; Path=' + options.path;
        }

        if (options.domain) {
            cookie += '; Domain=' + options.domain;
        }

        if (options.secure) {
            cookie += '; Secure';
        }

        if (options.httpOnly) {
            cookie += '; HttpOnly';
        }

        if (options.sameSite) {
            cookie += '; SameSite=' + options.sameSite;
        }

        return cookie;
    };

    /**
     * Print/send content with headers
     * @param {Object} res - Response object
     * @param {string} content - Content to send
     * @param {Object} options - Headers and options
     */
    CGIEx.prototype.print = function(res, content, options) {
        options = options || {};

        var contentType = options.type || 'text/html';
        var charset = options.charset || 'utf-8';
        var statusCode = options.status || 200;

        if (charset) {
            contentType += '; charset=' + charset;
        }

        res.writeHead(statusCode, {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(content)
        });

        res.end(content);
    };

    return CGIEx;

}));
