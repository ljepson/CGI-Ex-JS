# CGI-Ex-JS

JavaScript/Node.js port of the Perl CGI::Ex::App module - a web application framework for building form-based applications with built-in validation, multi-step workflows, and template rendering.

## Overview

CGI-Ex-JS provides a structured framework for building web applications that:
- Handle multi-step user workflows
- Validate form input with detailed error messages
- Render templates with data binding
- Manage application state across steps
- Support authentication and authorization

This is particularly useful for applications with complex forms, wizards, or step-by-step processes.

## Installation

```bash
npm install
```

## Quick Start

### Basic Example

```javascript
var AppClass = require('./lib/app');

// Extend the App class
var MyApp = AppClass.extend(function() {
    // Define your application steps and logic here

    this.main_hash_swap = function() {
        return {
            title: 'Welcome',
            message: 'Hello World!'
        };
    };
});

// Use with Connect/Express
app.use(function(req, res) {
    var myApp = new MyApp(req, res);
    myApp.navigate(req, res);
});
```

### Running the Example

```bash
node examples/simple-form.js
```

Then visit `http://localhost:3001/form` to see a working form with validation.

## Core Concepts

### Steps

Your application is organized into "steps" - discrete stages of a workflow. Each step can have:

- `prepare` - Prepare data before rendering
- `info_complete` - Check if step has all required data (validation)
- `finalize` - Process the step after validation passes
- `hash_swap` - Data to pass to the template

### Navigation Methods

- `jump(step)` - Jump to a different step
- `goto_step(step)` - Add a step to the path
- `insert_path(step)` - Insert step(s) into navigation path
- `replace_path(steps)` - Replace current step with new step(s)

### Validation

Define validation rules for each step:

```javascript
this.myStep_hash_validation = function() {
    return {
        email: {
            required: 1,
            type: 'email',
            required_error: 'Email is required',
            type_error: 'Invalid email format'
        },
        age: {
            required: 1,
            type: 'int',
            min_len: 1,
            max_len: 3
        }
    };
};
```

## Modules

### CGI::Ex (lib/cgix.js)

Handles cookies and form data parsing.

### CGI::Ex::Validate (lib/validate.js)

Form validation engine supporting:
- Required fields
- Type validation (email, url, int, float, etc.)
- Length constraints
- Pattern matching (regex)
- Custom validators
- Field comparison

### CGI::Ex::Conf (lib/conf.js)

Configuration file reader supporting JSON, INI, and JavaScript formats.

### Template (lib/template.js)

Template rendering using Underscore.js templates.

## Project Status

This is a complete port of the core CGI::Ex::App functionality from Perl to JavaScript. The implementation includes:

✅ Core application framework
✅ Multi-step navigation
✅ Form validation engine
✅ Configuration management
✅ Template rendering
✅ Cookie/form handling
✅ Error management

## License

MIT
