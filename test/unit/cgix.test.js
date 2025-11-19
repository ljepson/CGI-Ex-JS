const {expect} = require('chai');
const CGIEx = require('../../lib/cgix');

describe('CGIEx', function() {
    describe('cookie parsing', function() {
        it('should parse simple cookies', function() {
            const req = {
                headers: {
                    cookie: 'session=abc123; user=john'
                }
            };

            const cgix = new CGIEx(req);
            const cookies = cgix.get_cookies();

            expect(cookies).to.have.property('session', 'abc123');
            expect(cookies).to.have.property('user', 'john');
        });

        it('should parse cookies with special characters', function() {
            const req = {
                headers: {
                    cookie: 'email=test%40example.com'
                }
            };

            const cgix = new CGIEx(req);
            const cookies = cgix.get_cookies();

            expect(cookies).to.have.property('email', 'test@example.com');
        });

        it('should handle cookies with spaces', function() {
            const req = {
                headers: {
                    cookie: ' session = abc123 ; user = john '
                }
            };

            const cgix = new CGIEx(req);
            const cookies = cgix.get_cookies();

            expect(cookies).to.have.property('session', 'abc123');
            expect(cookies).to.have.property('user', 'john');
        });

        it('should handle empty cookie header', function() {
            const req = {
                headers: {}
            };

            const cgix = new CGIEx(req);
            const cookies = cgix.get_cookies();

            expect(cookies).to.be.an('object');
            expect(Object.keys(cookies)).to.be.empty;
        });

        it('should handle cookies with equals in value', function() {
            const req = {
                headers: {
                    cookie: 'data=key=value'
                }
            };

            const cgix = new CGIEx(req);
            const cookies = cgix.get_cookies();

            expect(cookies).to.have.property('data', 'key=value');
        });

        it('should cache parsed cookies', function() {
            const req = {
                headers: {
                    cookie: 'session=abc123'
                }
            };

            const cgix = new CGIEx(req);
            const cookies1 = cgix.get_cookies();
            const cookies2 = cgix.get_cookies();

            expect(cookies1).to.equal(cookies2);
        });
    });

    describe('form data extraction', function() {
        it('should extract GET query params', function() {
            const req = {
                query: {
                    search: 'test',
                    page: '1'
                }
            };

            const cgix = new CGIEx(req);
            const form = cgix.get_form();

            expect(form).to.have.property('search', 'test');
            expect(form).to.have.property('page', '1');
        });

        it('should extract POST body params', function() {
            const req = {
                body: {
                    username: 'john',
                    password: 'secret'
                }
            };

            const cgix = new CGIEx(req);
            const form = cgix.get_form();

            expect(form).to.have.property('username', 'john');
            expect(form).to.have.property('password', 'secret');
        });

        it('should merge query and body params', function() {
            const req = {
                query: {
                    redirect: '/home'
                },
                body: {
                    username: 'john'
                }
            };

            const cgix = new CGIEx(req);
            const form = cgix.get_form();

            expect(form).to.have.property('redirect', '/home');
            expect(form).to.have.property('username', 'john');
        });

        it('should handle empty request', function() {
            const req = {};

            const cgix = new CGIEx(req);
            const form = cgix.get_form();

            expect(form).to.be.an('object');
            expect(Object.keys(form)).to.be.empty;
        });

        it('should cache form data', function() {
            const req = {
                query: {test: 'value'}
            };

            const cgix = new CGIEx(req);
            const form1 = cgix.get_form();
            const form2 = cgix.get_form();

            expect(form1).to.equal(form2);
        });
    });

    describe('cookie setting', function() {
        it('should generate simple Set-Cookie header', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123');

            expect(header).to.equal('session=abc123');
        });

        it('should encode special characters', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('email', 'test@example.com');

            expect(header).to.include('test%40example.com');
        });

        it('should set cookie path', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                path: '/admin'
            });

            expect(header).to.include('Path=/admin');
        });

        it('should set cookie domain', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                domain: 'example.com'
            });

            expect(header).to.include('Domain=example.com');
        });

        it('should set secure flag', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                secure: true
            });

            expect(header).to.include('Secure');
        });

        it('should set httpOnly flag', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                httpOnly: true
            });

            expect(header).to.include('HttpOnly');
        });

        it('should set SameSite attribute', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                sameSite: 'Strict'
            });

            expect(header).to.include('SameSite=Strict');
        });

        it('should set expiration with number (seconds)', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                expires: 3600
            });

            expect(header).to.include('Expires=');
        });

        it('should set expiration with Date object', function() {
            const cgix = new CGIEx();
            const date = new Date('2025-12-31');
            const header = cgix.set_cookie('session', 'abc123', {
                expires: date
            });

            expect(header).to.include('Expires=');
            expect(header).to.include('2025');
        });

        it('should combine multiple options', function() {
            const cgix = new CGIEx();
            const header = cgix.set_cookie('session', 'abc123', {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: 'Strict'
            });

            expect(header).to.include('Path=/');
            expect(header).to.include('Secure');
            expect(header).to.include('HttpOnly');
            expect(header).to.include('SameSite=Strict');
        });
    });

    describe('print method', function() {
        it('should send response with default content type', function() {
            const cgix = new CGIEx();
            const res = {
                headers: {},
                body: '',
                writeHead: function(status, headers) {
                    this.status = status;
                    this.headers = headers;
                },
                end: function(content) {
                    this.body = content;
                }
            };

            cgix.print(res, '<h1>Hello</h1>');

            expect(res.status).to.equal(200);
            expect(res.headers['Content-Type']).to.include('text/html');
            expect(res.body).to.equal('<h1>Hello</h1>');
        });

        it('should send response with custom content type', function() {
            const cgix = new CGIEx();
            const res = {
                headers: {},
                writeHead: function(status, headers) {
                    this.headers = headers;
                },
                end: function() {}
            };

            cgix.print(res, '{"status":"ok"}', {type: 'application/json'});

            expect(res.headers['Content-Type']).to.include('application/json');
        });

        it('should send response with custom status code', function() {
            const cgix = new CGIEx();
            const res = {
                headers: {},
                writeHead: function(status) {
                    this.status = status;
                },
                end: function() {}
            };

            cgix.print(res, 'Not Found', {status: 404});

            expect(res.status).to.equal(404);
        });

        it('should send response with custom charset', function() {
            const cgix = new CGIEx();
            const res = {
                headers: {},
                writeHead: function(status, headers) {
                    this.headers = headers;
                },
                end: function() {}
            };

            cgix.print(res, 'content', {charset: 'iso-8859-1'});

            expect(res.headers['Content-Type']).to.include('charset=iso-8859-1');
        });

        it('should calculate correct content length', function() {
            const cgix = new CGIEx();
            const res = {
                headers: {},
                writeHead: function(status, headers) {
                    this.headers = headers;
                },
                end: function() {}
            };

            cgix.print(res, 'Hello World');

            expect(res.headers['Content-Length']).to.equal(11);
        });
    });
});
