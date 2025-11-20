/* jshint strict: false */
/* exported Validate */
(function(root, factory) {
    'use strict';

    if ('function' === typeof define && define.amd) {
        define(['underscore'], factory);
    }
    else if ('object' === typeof module && module.exports) {
        module.exports = factory(require('underscore'));
    }
    else {
        root.Validate = factory(root._);
    }
}(this, function(_) {
    'use strict';

    /**
     * CGI::Ex::Validate - JavaScript port
     * Form validation engine
     */
    var Validate = function() {};

    /**
     * Validation error object
     */
    var ValidationError = function(errors) {
        this.errors = errors || {};
        this.has_errors = Object.keys(this.errors).length > 0;
    };

    ValidationError.prototype.as_hash = function(options) {
        options = options || {};
        var join_str = options.as_hash_join || '<br>';
        var suffix = options.as_hash_suffix || '_error';
        var result = {};

        for (var field in this.errors) {
            if (this.errors.hasOwnProperty(field)) {
                var errors = this.errors[field];
                var error_text = _.isArray(errors) ? errors.join(join_str) : errors;
                result[field + suffix] = error_text;
            }
        }

        return result;
    };

    ValidationError.prototype.as_array = function() {
        var result = [];

        for (var field in this.errors) {
            if (this.errors.hasOwnProperty(field)) {
                var errors = this.errors[field];
                if (_.isArray(errors)) {
                    result = result.concat(errors);
                } else {
                    result.push(errors);
                }
            }
        }

        return result;
    };

    ValidationError.prototype.as_string = function(join_str) {
        join_str = join_str || '\n';
        return this.as_array().join(join_str);
    };

    /**
     * Main validation method
     * @param {Object} form - Form data to validate
     * @param {Object} validation - Validation rules
     * @param {Array} validated_fields - Output array of validated field names
     * @returns {ValidationError|null} Error object if validation fails, null if success
     */
    Validate.prototype.validate = function(form, validation, validated_fields) {
        var errors = {};

        if (!validation || !_.isObject(validation)) {
            return null;
        }

        // Iterate through validation rules
        for (var field in validation) {
            if (!validation.hasOwnProperty(field) || field === 'group') {
                continue;
            }

            var rules = validation[field];

            // Skip if not an object/array of rules
            if (!_.isObject(rules)) {
                continue;
            }

            var field_errors = this.validate_field(field, form[field], rules, form);

            if (field_errors && field_errors.length > 0) {
                errors[field] = field_errors;
            } else if (validated_fields) {
                validated_fields.push(field);
            }
        }

        // Handle validation groups
        if (validation.group && _.isObject(validation.group)) {
            for (var group_name in validation.group) {
                if (validation.group.hasOwnProperty(group_name)) {
                    var group = validation.group[group_name];
                    var group_valid = this.check_group(group, form, errors);

                    if (!group_valid && group.required) {
                        errors[group_name] = ['Group validation failed'];
                    }
                }
            }
        }

        return Object.keys(errors).length > 0 ? new ValidationError(errors) : null;
    };

    /**
     * Validate a single field
     */
    Validate.prototype.validate_field = function(field_name, value, rules, form) {
        var errors = [];

        // Handle required
        if (rules.required && !this.check_required(value)) {
            errors.push(rules.required_error || field_name + ' is required');
            return errors; // Stop further validation if required fails
        }

        // If field is not required and empty, skip other validations
        if (!rules.required && !this.has_value(value)) {
            return errors;
        }

        // Check min_len
        if (rules.min_len && !this.check_min_len(value, rules.min_len)) {
            errors.push(rules.min_len_error ||
                field_name + ' must be at least ' + rules.min_len + ' characters');
        }

        // Check max_len
        if (rules.max_len && !this.check_max_len(value, rules.max_len)) {
            errors.push(rules.max_len_error ||
                field_name + ' must be at most ' + rules.max_len + ' characters');
        }

        // Check match (regex)
        if (rules.match && !this.check_match(value, rules.match)) {
            errors.push(rules.match_error || field_name + ' has invalid format');
        }

        // Check equals (compare with another field)
        if (rules.equals && !this.check_equals(value, form[rules.equals])) {
            errors.push(rules.equals_error ||
                field_name + ' must match ' + rules.equals);
        }

        // Check min_values (for arrays/multi-select)
        if (rules.min_values && !this.check_min_values(value, rules.min_values)) {
            errors.push(rules.min_values_error ||
                field_name + ' must have at least ' + rules.min_values + ' values');
        }

        // Check max_values
        if (rules.max_values && !this.check_max_values(value, rules.max_values)) {
            errors.push(rules.max_values_error ||
                field_name + ' must have at most ' + rules.max_values + ' values');
        }

        // Check enum (value must be in list)
        if (rules.enum && !this.check_enum(value, rules.enum)) {
            errors.push(rules.enum_error || field_name + ' has invalid value');
        }

        // Check custom validator function
        if (rules.validator && _.isFunction(rules.validator)) {
            var custom_result = rules.validator(value, field_name, form);
            if (custom_result !== true && custom_result) {
                errors.push(_.isString(custom_result) ? custom_result :
                    (rules.validator_error || field_name + ' is invalid'));
            }
        }

        // Check type validations
        if (rules.type) {
            if (!this.check_type(value, rules.type)) {
                errors.push(rules.type_error ||
                    field_name + ' must be of type ' + rules.type);
            }
        }

        return errors;
    };

    /**
     * Check if value exists
     */
    Validate.prototype.has_value = function(value) {
        if (value === null || value === undefined) {
            return false;
        }
        if (_.isString(value) && value.trim() === '') {
            return false;
        }
        if (_.isArray(value) && value.length === 0) {
            return false;
        }
        return true;
    };

    /**
     * Check required validation
     */
    Validate.prototype.check_required = function(value) {
        return this.has_value(value);
    };

    /**
     * Check minimum length
     */
    Validate.prototype.check_min_len = function(value, min_len) {
        if (!value) {
            return false;
        }
        var len = _.isString(value) ? value.length : String(value).length;
        return len >= min_len;
    };

    /**
     * Check maximum length
     */
    Validate.prototype.check_max_len = function(value, max_len) {
        if (!value) {
            return true;
        }
        var len = _.isString(value) ? value.length : String(value).length;
        return len <= max_len;
    };

    /**
     * Check regex match
     */
    Validate.prototype.check_match = function(value, pattern) {
        if (!value) {
            return false;
        }

        var regex = pattern;
        if (_.isString(pattern)) {
            regex = new RegExp(pattern);
        }

        return regex.test(String(value));
    };

    /**
     * Check if two values are equal
     */
    Validate.prototype.check_equals = function(value1, value2) {
        return value1 === value2;
    };

    /**
     * Check minimum number of values (for arrays)
     */
    Validate.prototype.check_min_values = function(value, min) {
        if (!_.isArray(value)) {
            return false;
        }
        return value.length >= min;
    };

    /**
     * Check maximum number of values (for arrays)
     */
    Validate.prototype.check_max_values = function(value, max) {
        if (!_.isArray(value)) {
            return false;
        }
        return value.length <= max;
    };

    /**
     * Check if value is in enum list
     */
    Validate.prototype.check_enum = function(value, enum_list) {
        if (!_.isArray(enum_list)) {
            return false;
        }
        return enum_list.indexOf(value) !== -1;
    };

    /**
     * Check value type
     */
    Validate.prototype.check_type = function(value, type) {
        switch(type) {
            case 'email':
                // More robust email regex based on HTML5 spec
                return this.check_match(value, /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/);
            case 'url':
                return this.check_match(value, /^https?:\/\/.+/);
            case 'number':
            case 'int':
                return !isNaN(parseInt(value, 10));
            case 'float':
                return !isNaN(parseFloat(value));
            case 'alpha':
                return this.check_match(value, /^[a-zA-Z]+$/);
            case 'alphanumeric':
                return this.check_match(value, /^[a-zA-Z0-9]+$/);
            default:
                return true;
        }
    };

    /**
     * Check validation group
     * Groups allow conditional validation of related fields
     */
    Validate.prototype.check_group = function(group, form, errors) {
        if (!group || !_.isArray(group.fields)) {
            return true; // No group or fields to validate
        }

        var valid = true;

        // Check that all fields in the group are present and non-empty
        _.each(group.fields, function(field) {
            if (!form[field] || (_.isString(form[field]) && form[field].trim() === '')) {
                valid = false;

                if (errors) {
                    errors[field] = errors[field] || [];
                    errors[field].push('Field is required in group validation');
                }
            }
        });

        return valid;
    };

    /**
     * Get validation rules from file
     * @param {string} file - Path to validation file
     * @returns {Object} Validation rules
     */
    Validate.prototype.get_validation = function(file) {
        // In a real implementation, this would read from filesystem
        // For now, return empty object - to be implemented when needed
        var fs;

        try {
            fs = require('fs');
        } catch(e) {
            return {};
        }

        if (!fs) {
            return {};
        }

        try {
            if (fs.existsSync(file)) {
                var content = fs.readFileSync(file, 'utf8');
                return JSON.parse(content);
            }
        } catch(e) {
            // File doesn't exist or invalid JSON
        }

        return {};
    };

    return Validate;

}));
