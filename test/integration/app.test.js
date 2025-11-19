const {expect} = require('chai');
const AppClass = require('../../lib/app');

describe('App Integration', function() {
    let app;
    let mockReq;
    let mockRes;

    beforeEach(function() {
        mockReq = {
            headers: {},
            query: {},
            body: {},
            url: '/'
        };

        mockRes = {
            headers: {},
            statusCode: 200,
            body: '',
            writeHead: function(status, headers) {
                this.statusCode = status;
                if (headers) {
                    Object.assign(this.headers, headers);
                }
            },
            end: function(content) {
                if (content) {
                    this.body += content;
                }
            },
            write: function(content) {
                this.body += content;
            }
        };
    });

    describe('basic instantiation', function() {
        it('should create App instance', function() {
            app = new AppClass(mockReq, mockRes);

            expect(app).to.be.an('object');
            expect(app).to.have.property('navigate');
        });

        it('should have cgix accessor', function() {
            app = new AppClass(mockReq, mockRes);
            const cgix = app.cgix();

            expect(cgix).to.be.an('object');
        });

        it('should have val_obj accessor', function() {
            app = new AppClass(mockReq, mockRes);
            const validator = app.val_obj();

            expect(validator).to.be.an('object');
        });

        it('should have conf_obj accessor', function() {
            app = new AppClass(mockReq, mockRes);
            const conf = app.conf_obj();

            expect(conf).to.be.an('object');
        });
    });

    describe('form and cookie handling', function() {
        it('should extract form data from query', function() {
            mockReq.query = {name: 'John', age: '25'};

            app = new AppClass(mockReq, mockRes);
            const form = app.form();

            expect(form).to.have.property('name', 'John');
            expect(form).to.have.property('age', '25');
        });

        it('should extract form data from body', function() {
            mockReq.body = {username: 'test', password: 'secret'};

            app = new AppClass(mockReq, mockRes);
            const form = app.form();

            expect(form).to.have.property('username', 'test');
            expect(form).to.have.property('password', 'secret');
        });

        it('should merge query and body', function() {
            mockReq.query = {redirect: '/home'};
            mockReq.body = {username: 'test'};

            app = new AppClass(mockReq, mockRes);
            const form = app.form();

            expect(form).to.have.property('redirect', '/home');
            expect(form).to.have.property('username', 'test');
        });

        it('should extract cookies', function() {
            mockReq.headers.cookie = 'session=abc123; user=john';

            app = new AppClass(mockReq, mockRes);
            const cookies = app.cookies();

            expect(cookies).to.have.property('session', 'abc123');
            expect(cookies).to.have.property('user', 'john');
        });
    });

    describe('navigation', function() {
        it('should handle default path', function() {
            app = new AppClass(mockReq, mockRes);
            const path = app.path();

            expect(path).to.be.an('array');
        });

        it('should set path_info', function() {
            app = new AppClass(mockReq, mockRes);
            app.path_info('/test/path');

            expect(app.path_info()).to.equal('/test/path');
        });

        it('should append to path', function() {
            app = new AppClass(mockReq, mockRes);
            app.path(['step1']);
            const result = app.append_path('step2', 'step3');

            expect(result).to.include('step1');
            expect(result).to.include('step2');
            expect(result).to.include('step3');
        });

        it('should replace path', function() {
            app = new AppClass(mockReq, mockRes);
            app.path(['step1', 'step2', 'step3']);
            app._path_i = 1;

            app.replace_path(['new_step']);

            const path = app.path();
            expect(path[1]).to.equal('new_step');
        });

        it('should set entire path', function() {
            app = new AppClass(mockReq, mockRes);
            app.set_path(['step1', 'step2']);

            expect(app.path()).to.deep.equal(['step1', 'step2']);
            expect(app._path_i).to.equal(0);
        });

        it('should get step by index', function() {
            app = new AppClass(mockReq, mockRes);
            app.path(['step1', 'step2', 'step3']);

            expect(app.step_by_path_index(0)).to.equal('step1');
            expect(app.step_by_path_index(1)).to.equal('step2');
            expect(app.step_by_path_index(2)).to.equal('step3');
        });

        it('should handle negative index', function() {
            app = new AppClass(mockReq, mockRes);
            app.path(['step1', 'step2']);

            expect(app.step_by_path_index(-1)).to.equal('');
        });
    });

    describe('validation integration', function() {
        it('should validate form data', function() {
            mockReq.body = {email: 'test@example.com'};

            app = new AppClass(mockReq, mockRes);

            // Mock hash_validation method
            app.__hash_validation = function() {
                return {
                    email: {
                        required: 1,
                        type: 'email'
                    }
                };
            };

            const result = app.validate('test', app.form());

            expect(result).to.equal(1); // Should pass
        });

        it('should fail validation for invalid data', function() {
            mockReq.body = {email: 'invalid'};

            app = new AppClass(mockReq, mockRes);

            app.__hash_validation = function() {
                return {
                    email: {
                        required: 1,
                        type: 'email'
                    }
                };
            };

            const result = app.validate('test', app.form());

            expect(result).to.equal(0); // Should fail
        });

        it('should populate errors on validation failure', function() {
            mockReq.body = {name: '', email: 'invalid'};

            app = new AppClass(mockReq, mockRes);

            app.__hash_validation = function() {
                return {
                    name: {required: 1},
                    email: {type: 'email'}
                };
            };

            app.validate('test', app.form());

            const errors = app.hash_errors();

            expect(errors).to.have.property('name_error');
            expect(errors).to.have.property('email_error');
        });

        it('should track validated fields', function() {
            mockReq.body = {name: 'John', email: 'john@example.com'};

            app = new AppClass(mockReq, mockRes);

            app.__hash_validation = function() {
                return {
                    name: {required: 1},
                    email: {type: 'email'}
                };
            };

            app.validate('test', app.form());

            // Both fields should validate successfully
            expect(app.has_errors()).to.equal(0);
        });
    });

    describe('error handling', function() {
        it('should add errors to hash', function() {
            app = new AppClass(mockReq, mockRes);

            app.add_errors({
                username_error: 'Username is required',
                password_error: 'Password is too short'
            });

            const errors = app.hash_errors();

            expect(errors).to.have.property('username_error');
            expect(errors).to.have.property('password_error');
        });

        it('should detect if errors exist', function() {
            app = new AppClass(mockReq, mockRes);

            expect(app.has_errors()).to.equal(0);

            app.add_errors({field_error: 'Error'});

            expect(app.has_errors()).to.be.greaterThan(0);
        });

        it('should handle die() method', function() {
            app = new AppClass(mockReq, mockRes);

            expect(function() {
                app.die('Test error');
            }).to.throw();
        });

        it('should handle croak() method', function() {
            app = new AppClass(mockReq, mockRes);

            expect(function() {
                app.croak('Test error');
            }).to.throw();
        });
    });

    describe('stash and state', function() {
        it('should maintain stash', function() {
            app = new AppClass(mockReq, mockRes);
            const stash = app.stash();

            stash.user = 'john';
            stash.role = 'admin';

            expect(app.stash().user).to.equal('john');
            expect(app.stash().role).to.equal('admin');
        });

        it('should maintain history', function() {
            app = new AppClass(mockReq, mockRes);

            expect(app.history()).to.be.an('array');
        });
    });

    describe('hook system', function() {
        it('should find hook by name', function() {
            const TestApp = AppClass.extend(function() {
                this.test_hook = function() {
                    return 'hook called';
                };
            });

            app = new TestApp(mockReq, mockRes);
            const hook = app.find_hook('test_hook');

            expect(hook).to.be.an('array');
            expect(hook[0]).to.be.a('function');
        });

        it('should find step-specific hook', function() {
            const TestApp = AppClass.extend(function() {
                this.login_prepare = function() {
                    return 'login prepare';
                };
            });

            app = new TestApp(mockReq, mockRes);
            const hook = app.find_hook('prepare', 'login');

            expect(hook).to.be.an('array');
            expect(hook[1]).to.equal('login_prepare');
        });

        it('should fallback to generic hook', function() {
            const TestApp = AppClass.extend(function() {
                this.prepare = function() {
                    return 'generic prepare';
                };
            });

            app = new TestApp(mockReq, mockRes);
            const hook = app.find_hook('prepare', 'someStep');

            expect(hook).to.be.an('array');
            expect(hook[1]).to.equal('prepare');
        });
    });

    describe('configuration', function() {
        it('should return default values', function() {
            app = new AppClass(mockReq, mockRes);

            expect(app.default_step()).to.equal('main');
            expect(app.error_step()).to.equal('__error');
            expect(app.forbidden_step()).to.equal('__forbidden');
            expect(app.login_step()).to.equal('__login');
            expect(app.js_step()).to.equal('js');
        });

        it('should return configured values', function() {
            const TestApp = AppClass.extend(function() {
                this._default_step = 'home';
            });

            app = new TestApp(mockReq, mockRes);

            expect(app.default_step()).to.equal('home');
        });

        it('should allow runtime configuration', function() {
            app = new AppClass(mockReq, mockRes);

            app._default_step = 'custom';
            expect(app.default_step()).to.equal('custom');
        });
    });

    describe('App.extend', function() {
        it('should create subclass', function() {
            const SubApp = AppClass.extend(function() {
                this.custom_method = function() {
                    return 'custom';
                };
            });

            app = new SubApp(mockReq, mockRes);

            expect(app).to.be.an.instanceof(SubApp);
            expect(app.custom_method()).to.equal('custom');
        });

        it('should inherit parent methods', function() {
            const SubApp = AppClass.extend(function() {});

            app = new SubApp(mockReq, mockRes);

            expect(app).to.respondTo('navigate');
            expect(app).to.respondTo('path');
            expect(app).to.respondTo('validate');
        });

        it('should allow method override', function() {
            const SubApp = AppClass.extend(function() {
                this.default_step = function() {
                    return 'overridden';
                };
            });

            app = new SubApp(mockReq, mockRes);

            expect(app.default_step()).to.equal('overridden');
        });
    });

    describe('morph system', function() {
        it('should track morph lineage', function() {
            const TestApp = AppClass.extend(function() {
                this.test_allow_morph = function() {
                    return true;
                };
                this.test_morph_package = function() {
                    return 'TestPackage';
                };
            });

            app = new TestApp(mockReq, mockRes);
            app.morph('test');

            expect(app._morph_lineage).to.be.an('array');
            expect(app._morph_lineage).to.have.lengthOf(1);
            expect(app._morph_lineage[0]).to.have.property('step', 'test');
        });

        it('should not morph when not allowed', function() {
            const TestApp = AppClass.extend(function() {
                this.test_allow_morph = function() {
                    return false;
                };
            });

            app = new TestApp(mockReq, mockRes);
            app.morph('test');

            expect(app._morph_lineage || []).to.have.lengthOf(0);
        });

        it('should unmorph correctly', function() {
            const TestApp = AppClass.extend(function() {
                this.test_allow_morph = function() {
                    return true;
                };
                this.test_morph_package = function() {
                    return 'TestPackage';
                };
            });

            app = new TestApp(mockReq, mockRes);
            app.morph('test');

            expect(app._morph_lineage).to.have.lengthOf(1);

            app.unmorph('test');

            expect(app._morph_lineage).to.have.lengthOf(0);
        });
    });

    describe('hash methods', function() {
        it('should return hash_base', function() {
            app = new AppClass(mockReq, mockRes);
            app.path_info('/test');

            const base = app.hash_base('step1');

            expect(base).to.have.property('path_info');
            expect(base).to.have.property('step', 'step1');
        });

        it('should return hash_common', function() {
            app = new AppClass(mockReq, mockRes);
            const common = app.hash_common();

            expect(common).to.be.an('object');
        });

        it('should return hash_swap', function() {
            app = new AppClass(mockReq, mockRes);
            const swap = app.hash_swap();

            expect(swap).to.be.an('object');
        });

        it('should return hash_fill', function() {
            app = new AppClass(mockReq, mockRes);
            const fill = app.hash_fill();

            expect(fill).to.be.an('object');
        });

        it('should add to hash methods', function() {
            app = new AppClass(mockReq, mockRes);

            app.add_to_swap({key: 'value'});
            const swap = app.hash_swap();

            expect(swap).to.have.property('key', 'value');
        });
    });
});
