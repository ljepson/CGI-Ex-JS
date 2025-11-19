/**
 * Simple form example demonstrating CGI-Ex-JS usage
 *
 * This example shows:
 * - Multi-step navigation
 * - Form validation
 * - Template rendering
 */

var connect = require('connect');
var bodyParser = require('body-parser');
var http = require('http');
var AppClass = require('../lib/app');

// Create our application by extending App
var MyApp = AppClass.extend(function() {
    'use strict';

    // Override base_dir_abs to point to our templates
    this.base_dir_abs = function() {
        return this._base_dir_abs || (this._base_dir_abs = [__dirname + '/templates']);
    };

    // Define valid steps
    this.valid_steps = function() {
        return {
            'form': 1,
            'process': 1,
            'success': 1
        };
    };

    // Form step - just display the form
    this.form_prepare = function() {
        // Nothing to prepare, just show the form
        return 0;
    };

    this.form_hash_swap = function() {
        return {
            title: 'Contact Form',
            message: 'Please fill out the form below'
        };
    };

    // Process step - handle form submission
    this.process_hash_validation = function() {
        return {
            name: {
                required: 1,
                required_error: 'Name is required',
                min_len: 2,
                min_len_error: 'Name must be at least 2 characters'
            },
            email: {
                required: 1,
                required_error: 'Email is required',
                type: 'email',
                type_error: 'Please enter a valid email address'
            },
            message: {
                required: 1,
                required_error: 'Message is required',
                min_len: 10,
                min_len_error: 'Message must be at least 10 characters'
            }
        };
    };

    this.process_finalize = function() {
        // If we get here, validation passed
        // In a real app, you'd save to database, send email, etc.

        var form = this.form();
        console.log('Form submitted:', form);

        // Jump to success page
        this.goto_step('success');

        return 0;
    };

    // Success step
    this.success_hash_swap = function() {
        var form = this.form();

        return {
            title: 'Success!',
            name: form.name,
            message: 'Thank you for your submission!'
        };
    };

    this.success_info_complete = function() {
        return 1; // Always complete, no validation
    };
});

// Set up Connect middleware
var app = connect();

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    'use strict';

    var myApp = new MyApp(req, res);

    // Set the path from the URL
    var url = require('url');
    var pathname = url.parse(req.url).pathname;
    myApp.path_info(pathname);

    try {
        myApp.navigate(req, res);
    } catch(err) {
        console.error('Application error:', err);
        res.writeHead(500, {'Content-Type': 'text/html'});
        res.end('<h1>Error</h1><pre>' + err.stack + '</pre>');
    }
});

// Start server
var PORT = process.env.PORT || 3001;
http.createServer(app).listen(PORT, function() {
    console.log('Example app running on http://localhost:' + PORT);
    console.log('Try: http://localhost:' + PORT + '/form');
});
