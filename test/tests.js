var fs = require('fs');
var expect = require('chai').expect;

var validator = require('../validator');

// Which xml file to test
var xmlPath = './test/test.xml';
// Which schematron to test against
var schematronPath = './test/test.sch';

var xml = fs.readFileSync(xmlPath, 'utf-8').toString();

describe('Validator should', function() {
    var results;
    it('return results', function(done) {
        results = validator.validate(xml, schematronPath);
        expect(results).to.be.an('object');
        done();
    });
    it('return an errorCount', function(done) {
        expect(results.errorCount).to.be.a('number');
        done();
    });
    it('return a warningCount', function(done) {
        expect(results.warningCount).to.be.a('number');
        done();
    });
    it('return an ignoredCount', function(done) {
        expect(results.ignoredCount).to.be.a('number');
        done();
    });
    it('return errors array', function(done) {
        expect(results.errors).to.be.a('array');
        done();
    });
    it('return warnings array', function(done) {
        expect(results.warnings).to.be.a('array');
        done();
    });
    it('return ignored array', function(done) {
        expect(results.ignored).to.be.a('array');
        done();
    });
    it('return matching errorCount', function(done) {
        expect(results.errorCount).to.be.equal(results.errors.length);
        done();
    });
    it('return matching warningCount', function(done) {
        expect(results.warningCount).to.be.equal(results.warnings.length);
        done();
    });
    it('return matching ignoredCount', function(done) {
        expect(results.ignoredCount).to.be.equal(results.ignored.length);
        done();
    });
    it('return correct number of errors', function(done) {
        expect(results.errorCount).to.be.equal(16);
        done();
    });
    it('return correct number of warnings', function(done) {
        expect(results.warningCount).to.be.equal(15);
        done();
    });
    it('return correct number of ignored', function(done) {
        expect(results.ignoredCount).to.be.equal(1);
        done();
    });
});
