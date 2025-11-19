/* jshint strict: false */
/* exported Conf */
(function(root, factory) {
    'use strict';

    if ('function' === typeof define && define.amd) {
        define([], factory);
    }
    else if ('object' === typeof module && module.exports) {
        module.exports = factory();
    }
    else {
        root.Conf = factory();
    }
}(this, function() {
    'use strict';

    /**
     * CGI::Ex::Conf - JavaScript port
     * Configuration file reader supporting multiple formats
     */
    var Conf = function(options) {
        this.options = options || {};
    };

    /**
     * Read configuration from file
     * @param {string} file - Path to config file
     * @param {Object} options - Read options
     * @returns {Object|null} Configuration object or null on failure
     */
    Conf.prototype.read = function(file, options) {
        options = options || {};

        var fs;
        var path;

        try {
            fs = require('fs');
            path = require('path');
        } catch(e) {
            if (!options.no_warn_on_fail) {
                console.error('Cannot load fs or path modules');
            }
            return null;
        }

        if (!fs || !path) {
            return null;
        }

        // Check if file exists
        if (!fs.existsSync(file)) {
            if (!options.no_warn_on_fail) {
                console.error('Config file not found: ' + file);
            }
            return null;
        }

        // Determine file type by extension
        var ext = path.extname(file).toLowerCase();
        var content;

        try {
            content = fs.readFileSync(file, 'utf8');
        } catch(e) {
            if (!options.no_warn_on_fail) {
                console.error('Error reading file: ' + file, e);
            }
            return null;
        }

        // Parse based on file type
        try {
            switch(ext) {
                case '.json':
                    return this.parse_json(content);

                case '.js':
                    return this.parse_javascript(content, file);

                case '.yaml':
                case '.yml':
                    return this.parse_yaml(content);

                case '.ini':
                case '.conf':
                    return this.parse_ini(content);

                default:
                    // Try JSON first, then INI
                    try {
                        return this.parse_json(content);
                    } catch(json_err) {
                        return this.parse_ini(content);
                    }
            }
        } catch(e) {
            if (!options.no_warn_on_fail) {
                console.error('Error parsing config file: ' + file, e);
            }
            return null;
        }
    };

    /**
     * Parse JSON content
     */
    Conf.prototype.parse_json = function(content) {
        return JSON.parse(content);
    };

    /**
     * Parse JavaScript module (require it)
     */
    Conf.prototype.parse_javascript = function(content, file) {
        // Use require for .js files
        try {
            delete require.cache[require.resolve(file)];
            return require(file);
        } catch(e) {
            // Fall back to eval (less safe but more flexible)
            var module = {exports: {}};
            var exports = module.exports;
            eval(content); // jshint ignore:line
            return module.exports;
        }
    };

    /**
     * Parse YAML content (basic implementation)
     * For full YAML support, use a library like js-yaml
     */
    Conf.prototype.parse_yaml = function(content) {
        // Try to load yaml parser if available
        try {
            var yaml = require('js-yaml');
            return yaml.load(content);
        } catch(e) {
            // YAML parser not available
            throw new Error('YAML parsing requires js-yaml module. Run: npm install js-yaml');
        }
    };

    /**
     * Parse INI file format
     * Simple implementation for basic INI files
     */
    Conf.prototype.parse_ini = function(content) {
        var config = {};
        var current_section = null;
        var lines = content.split(/\r?\n/);

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();

            // Skip empty lines and comments
            if (!line || line[0] === ';' || line[0] === '#') {
                continue;
            }

            // Section header [section]
            var section_match = line.match(/^\[([^\]]+)\]$/);
            if (section_match) {
                current_section = section_match[1];
                config[current_section] = config[current_section] || {};
                continue;
            }

            // Key-value pair
            var kv_match = line.match(/^([^=]+)=(.*)$/);
            if (kv_match) {
                var key = kv_match[1].trim();
                var value = kv_match[2].trim();

                // Remove quotes if present
                if ((value[0] === '"' && value[value.length - 1] === '"') ||
                    (value[0] === "'" && value[value.length - 1] === "'")) {
                    value = value.slice(1, -1);
                }

                // Try to parse as number or boolean
                value = this.parse_value(value);

                if (current_section) {
                    config[current_section][key] = value;
                } else {
                    config[key] = value;
                }
            }
        }

        return config;
    };

    /**
     * Parse a value to appropriate type
     */
    Conf.prototype.parse_value = function(value) {
        // Boolean
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }

        // Null/undefined
        if (value === 'null' || value === 'nil') {
            return null;
        }
        if (value === 'undefined') {
            return undefined;
        }

        // Number
        if (/^-?\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^-?\d*\.\d+$/.test(value)) {
            return parseFloat(value);
        }

        // String (default)
        return value;
    };

    /**
     * Write configuration to file
     * @param {string} file - Path to config file
     * @param {Object} config - Configuration object
     * @param {Object} options - Write options
     * @returns {boolean} Success status
     */
    Conf.prototype.write = function(file, config, options) {
        options = options || {};

        var fs;
        var path;

        try {
            fs = require('fs');
            path = require('path');
        } catch(e) {
            return false;
        }

        if (!fs || !path) {
            return false;
        }

        var ext = path.extname(file).toLowerCase();
        var content;

        try {
            switch(ext) {
                case '.json':
                    content = JSON.stringify(config, null, 2);
                    break;

                case '.ini':
                case '.conf':
                    content = this.stringify_ini(config);
                    break;

                case '.js':
                    content = 'module.exports = ' + JSON.stringify(config, null, 2) + ';\n';
                    break;

                default:
                    content = JSON.stringify(config, null, 2);
            }

            fs.writeFileSync(file, content, 'utf8');
            return true;

        } catch(e) {
            if (!options.no_warn_on_fail) {
                console.error('Error writing config file: ' + file, e);
            }
            return false;
        }
    };

    /**
     * Convert config object to INI format
     */
    Conf.prototype.stringify_ini = function(config) {
        var lines = [];

        for (var key in config) {
            if (!config.hasOwnProperty(key)) {
                continue;
            }

            var value = config[key];

            // If value is an object, treat as section
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                lines.push('[' + key + ']');

                for (var subkey in value) {
                    if (value.hasOwnProperty(subkey)) {
                        lines.push(subkey + '=' + this.format_ini_value(value[subkey]));
                    }
                }

                lines.push(''); // Empty line after section
            } else {
                // Top-level key-value
                lines.push(key + '=' + this.format_ini_value(value));
            }
        }

        return lines.join('\n');
    };

    /**
     * Format a value for INI output
     */
    Conf.prototype.format_ini_value = function(value) {
        if (value === null || value === undefined) {
            return '';
        }

        if (typeof value === 'string') {
            // Quote strings with special characters
            if (/[\s;#]/.test(value)) {
                return '"' + value + '"';
            }
            return value;
        }

        return String(value);
    };

    return Conf;

}));
