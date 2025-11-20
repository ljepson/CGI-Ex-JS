const {expect} = require('chai');
const Validate = require('../../lib/validate');

describe('Validate', function() {
    let validator;

    beforeEach(function() {
        validator = new Validate();
    });

    describe('required validation', function() {
        it('should fail when required field is missing', function() {
            const result = validator.validate(
                {},
                {name: {required: 1}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('name');
        });

        it('should fail when required field is empty string', function() {
            const result = validator.validate(
                {name: ''},
                {name: {required: 1}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('name');
        });

        it('should pass when required field has value', function() {
            const result = validator.validate(
                {name: 'John'},
                {name: {required: 1}}
            );

            expect(result).to.be.null;
        });

        it('should use custom error message', function() {
            const result = validator.validate(
                {},
                {name: {required: 1, required_error: 'Name is mandatory'}}
            );

            expect(result.errors.name[0]).to.equal('Name is mandatory');
        });
    });

    describe('email validation', function() {
        it('should reject invalid email', function() {
            const result = validator.validate(
                {email: 'notanemail'},
                {email: {type: 'email'}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('email');
        });

        it('should reject email with double @', function() {
            const result = validator.validate(
                {email: 'test@@example.com'},
                {email: {type: 'email'}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('email');
        });

        it('should reject email with spaces', function() {
            const result = validator.validate(
                {email: 'test @example.com'},
                {email: {type: 'email'}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('email');
        });

        it('should accept valid email', function() {
            const result = validator.validate(
                {email: 'test@example.com'},
                {email: {type: 'email'}}
            );

            expect(result).to.be.null;
        });

        it('should accept complex valid email', function() {
            const result = validator.validate(
                {email: 'user+tag@sub.example.co.uk'},
                {email: {type: 'email'}}
            );

            expect(result).to.be.null;
        });
    });

    describe('length validation', function() {
        it('should reject string shorter than min_len', function() {
            const result = validator.validate(
                {username: 'ab'},
                {username: {min_len: 3}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('username');
        });

        it('should accept string meeting min_len', function() {
            const result = validator.validate(
                {username: 'abc'},
                {username: {min_len: 3}}
            );

            expect(result).to.be.null;
        });

        it('should reject string longer than max_len', function() {
            const result = validator.validate(
                {username: 'abcdefghij'},
                {username: {max_len: 5}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('username');
        });

        it('should accept string within length bounds', function() {
            const result = validator.validate(
                {username: 'john'},
                {username: {min_len: 2, max_len: 10}}
            );

            expect(result).to.be.null;
        });
    });

    describe('pattern matching', function() {
        it('should reject non-matching pattern', function() {
            const result = validator.validate(
                {code: 'abc'},
                {code: {match: /^\d+$/}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('code');
        });

        it('should accept matching pattern', function() {
            const result = validator.validate(
                {code: '12345'},
                {code: {match: /^\d+$/}}
            );

            expect(result).to.be.null;
        });

        it('should work with string pattern', function() {
            const result = validator.validate(
                {code: '12345'},
                {code: {match: '^\\d+$'}}
            );

            expect(result).to.be.null;
        });
    });

    describe('field comparison', function() {
        it('should reject when fields do not match', function() {
            const result = validator.validate(
                {password: 'secret', confirm: 'different'},
                {confirm: {equals: 'password'}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('confirm');
        });

        it('should accept when fields match', function() {
            const result = validator.validate(
                {password: 'secret', confirm: 'secret'},
                {confirm: {equals: 'password'}}
            );

            expect(result).to.be.null;
        });
    });

    describe('enum validation', function() {
        it('should reject value not in enum', function() {
            const result = validator.validate(
                {color: 'purple'},
                {color: {enum: ['red', 'green', 'blue']}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('color');
        });

        it('should accept value in enum', function() {
            const result = validator.validate(
                {color: 'red'},
                {color: {enum: ['red', 'green', 'blue']}}
            );

            expect(result).to.be.null;
        });
    });

    describe('type validation', function() {
        it('should validate URL type', function() {
            expect(validator.validate(
                {url: 'http://example.com'},
                {url: {type: 'url'}}
            )).to.be.null;

            expect(validator.validate(
                {url: 'not a url'},
                {url: {type: 'url'}}
            )).to.not.be.null;
        });

        it('should validate number type', function() {
            expect(validator.validate(
                {age: '25'},
                {age: {type: 'int'}}
            )).to.be.null;

            expect(validator.validate(
                {age: 'twenty'},
                {age: {type: 'int'}}
            )).to.not.be.null;
        });

        it('should validate alpha type', function() {
            expect(validator.validate(
                {name: 'John'},
                {name: {type: 'alpha'}}
            )).to.be.null;

            expect(validator.validate(
                {name: 'John123'},
                {name: {type: 'alpha'}}
            )).to.not.be.null;
        });

        it('should validate alphanumeric type', function() {
            expect(validator.validate(
                {username: 'User123'},
                {username: {type: 'alphanumeric'}}
            )).to.be.null;

            expect(validator.validate(
                {username: 'User_123'},
                {username: {type: 'alphanumeric'}}
            )).to.not.be.null;
        });
    });

    describe('custom validator', function() {
        it('should use custom validator function', function() {
            const result = validator.validate(
                {age: 15},
                {
                    age: {
                        validator: function(val) {
                            return val >= 18 || 'Must be 18 or older';
                        }
                    }
                }
            );

            expect(result).to.not.be.null;
            expect(result.errors.age[0]).to.equal('Must be 18 or older');
        });

        it('should accept when custom validator returns true', function() {
            const result = validator.validate(
                {age: 21},
                {
                    age: {
                        validator: function(val) {
                            return val >= 18 || 'Must be 18 or older';
                        }
                    }
                }
            );

            expect(result).to.be.null;
        });
    });

    describe('array validation', function() {
        it('should validate min_values', function() {
            const result = validator.validate(
                {tags: ['one']},
                {tags: {min_values: 2}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('tags');
        });

        it('should validate max_values', function() {
            const result = validator.validate(
                {tags: ['one', 'two', 'three']},
                {tags: {max_values: 2}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('tags');
        });
    });

    describe('optional fields', function() {
        it('should skip validation for empty optional fields', function() {
            const result = validator.validate(
                {email: ''},
                {email: {type: 'email'}}
            );

            expect(result).to.be.null;
        });

        it('should validate non-empty optional fields', function() {
            const result = validator.validate(
                {email: 'invalid'},
                {email: {type: 'email'}}
            );

            expect(result).to.not.be.null;
            expect(result.errors).to.have.property('email');
        });
    });

    describe('validated_fields tracking', function() {
        it('should track validated fields', function() {
            const validated = [];
            validator.validate(
                {name: 'John', email: 'john@example.com'},
                {name: {required: 1}, email: {type: 'email'}},
                validated
            );

            expect(validated).to.include('name');
            expect(validated).to.include('email');
        });

        it('should not track failed fields', function() {
            const validated = [];
            validator.validate(
                {name: '', email: 'invalid'},
                {name: {required: 1}, email: {type: 'email'}},
                validated
            );

            expect(validated).to.be.empty;
        });
    });

    describe('error formatting', function() {
        it('should format errors as hash', function() {
            const result = validator.validate(
                {name: '', email: 'invalid'},
                {name: {required: 1}, email: {type: 'email'}}
            );

            const hash = result.as_hash({as_hash_suffix: '_error'});

            expect(hash).to.have.property('name_error');
            expect(hash).to.have.property('email_error');
        });

        it('should format errors as array', function() {
            const result = validator.validate(
                {name: '', email: 'invalid'},
                {name: {required: 1}, email: {type: 'email'}}
            );

            const arr = result.as_array();

            expect(arr).to.be.an('array');
            expect(arr.length).to.be.greaterThan(0);
        });

        it('should format errors as string', function() {
            const result = validator.validate(
                {name: ''},
                {name: {required: 1}}
            );

            const str = result.as_string();

            expect(str).to.be.a('string');
            expect(str.length).to.be.greaterThan(0);
        });
    });
});
