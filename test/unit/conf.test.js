const {expect} = require('chai');
const Conf = require('../../lib/conf');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Conf', function() {
    let tmpDir;
    let conf;

    beforeEach(function() {
        // Create temporary directory for test files
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-test-'));
        conf = new Conf();
    });

    afterEach(function() {
        // Clean up temporary directory
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, {recursive: true, force: true});
        }
    });

    describe('JSON format', function() {
        it('should read JSON config file', function() {
            const configFile = path.join(tmpDir, 'config.json');
            const data = {
                database: 'mydb',
                port: 5432,
                debug: true
            };

            fs.writeFileSync(configFile, JSON.stringify(data));

            const result = conf.read(configFile);

            expect(result).to.deep.equal(data);
        });

        it('should write JSON config file', function() {
            const configFile = path.join(tmpDir, 'config.json');
            const data = {
                app: 'test',
                version: '1.0'
            };

            const success = conf.write(configFile, data);
            expect(success).to.be.true;

            const content = fs.readFileSync(configFile, 'utf8');
            const parsed = JSON.parse(content);

            expect(parsed).to.deep.equal(data);
        });

        it('should handle invalid JSON gracefully', function() {
            const configFile = path.join(tmpDir, 'bad.json');
            fs.writeFileSync(configFile, '{invalid json}');

            const result = conf.read(configFile, {no_warn_on_fail: true});

            expect(result).to.be.null;
        });
    });

    describe('INI format', function() {
        it('should read INI config file', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
[database]
host=localhost
port=5432

[app]
name=test
debug=true
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            expect(result).to.have.property('database');
            expect(result.database).to.have.property('host', 'localhost');
            expect(result.database).to.have.property('port', 5432);
            expect(result.app).to.have.property('debug', true);
        });

        it('should parse top-level INI keys', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
version=1.0
name=myapp
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            // INI parser auto-converts numeric values
            expect(result).to.have.property('version');
            expect(result).to.have.property('name', 'myapp');
        });

        it('should ignore comments in INI', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
; This is a comment
# Another comment
name=test
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            expect(result).to.have.property('name', 'test');
            expect(Object.keys(result)).to.have.lengthOf(1);
        });

        it('should parse quoted values in INI', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
name="test app"
path='C:\\\\Program Files'
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            expect(result.name).to.equal('test app');
            expect(result.path).to.equal('C:\\\\Program Files');
        });

        it('should parse boolean values in INI', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
enabled=true
disabled=false
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            expect(result.enabled).to.be.true;
            expect(result.disabled).to.be.false;
        });

        it('should parse numeric values in INI', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const iniContent = `
port=8080
ratio=1.5
            `.trim();

            fs.writeFileSync(configFile, iniContent);

            const result = conf.read(configFile);

            expect(result.port).to.equal(8080);
            expect(result.ratio).to.equal(1.5);
        });

        it('should write INI config file', function() {
            const configFile = path.join(tmpDir, 'config.ini');
            const data = {
                app: 'test',
                database: {
                    host: 'localhost',
                    port: 5432
                }
            };

            const success = conf.write(configFile, data);
            expect(success).to.be.true;

            const content = fs.readFileSync(configFile, 'utf8');

            expect(content).to.include('app=test');
            expect(content).to.include('[database]');
            expect(content).to.include('host=localhost');
        });
    });

    describe('JavaScript module format', function() {
        it('should read JavaScript config file', function() {
            const configFile = path.join(tmpDir, 'config.js');
            const jsContent = `
module.exports = {
    database: 'mydb',
    port: 5432,
    nested: {
        value: 'test'
    }
};
            `;

            fs.writeFileSync(configFile, jsContent);

            const result = conf.read(configFile);

            expect(result).to.have.property('database', 'mydb');
            expect(result).to.have.property('port', 5432);
            expect(result.nested).to.have.property('value', 'test');
        });

        it('should write JavaScript config file', function() {
            const configFile = path.join(tmpDir, 'config.js');
            const data = {
                app: 'test',
                version: '1.0'
            };

            const success = conf.write(configFile, data);
            expect(success).to.be.true;

            const content = fs.readFileSync(configFile, 'utf8');

            expect(content).to.include('module.exports');
        });
    });

    describe('error handling', function() {
        it('should return null for non-existent file', function() {
            const result = conf.read('/nonexistent/file.json', {no_warn_on_fail: true});

            expect(result).to.be.null;
        });

        it('should return false on write failure', function() {
            const result = conf.write('/invalid/path/file.json', {}, {no_warn_on_fail: true});

            expect(result).to.be.false;
        });

        it('should handle no_warn_on_fail option', function() {
            // This should not throw or log
            const result = conf.read('/nonexistent.json', {no_warn_on_fail: true});

            expect(result).to.be.null;
        });
    });

    describe('value parsing', function() {
        it('should parse null values', function() {
            const result = conf.parse_value('null');
            expect(result).to.be.null;
        });

        it('should parse boolean values', function() {
            expect(conf.parse_value('true')).to.be.true;
            expect(conf.parse_value('false')).to.be.false;
        });

        it('should parse integer values', function() {
            expect(conf.parse_value('42')).to.equal(42);
            expect(conf.parse_value('-10')).to.equal(-10);
        });

        it('should parse float values', function() {
            expect(conf.parse_value('3.14')).to.equal(3.14);
            expect(conf.parse_value('-0.5')).to.equal(-0.5);
        });

        it('should keep strings as strings', function() {
            expect(conf.parse_value('hello')).to.equal('hello');
            expect(conf.parse_value('test123')).to.equal('test123');
        });
    });

    describe('INI value formatting', function() {
        it('should format simple values', function() {
            expect(conf.format_ini_value('test')).to.equal('test');
            expect(conf.format_ini_value(42)).to.equal('42');
            expect(conf.format_ini_value(true)).to.equal('true');
        });

        it('should quote values with special characters', function() {
            const result = conf.format_ini_value('test value');
            expect(result).to.equal('"test value"');
        });

        it('should handle null/undefined', function() {
            expect(conf.format_ini_value(null)).to.equal('');
            expect(conf.format_ini_value(undefined)).to.equal('');
        });
    });

    describe('file extension detection', function() {
        it('should detect JSON by extension', function() {
            const configFile = path.join(tmpDir, 'test.json');
            fs.writeFileSync(configFile, '{"key":"value"}');

            const result = conf.read(configFile);

            expect(result).to.have.property('key', 'value');
        });

        it('should detect INI by .conf extension', function() {
            const configFile = path.join(tmpDir, 'test.conf');
            fs.writeFileSync(configFile, 'key=value');

            const result = conf.read(configFile);

            expect(result).to.have.property('key', 'value');
        });

        it('should fallback to JSON then INI for unknown extension', function() {
            const configFile = path.join(tmpDir, 'test.cfg');
            fs.writeFileSync(configFile, 'key=value');

            const result = conf.read(configFile);

            // Should parse as INI
            expect(result).to.have.property('key', 'value');
        });
    });
});
