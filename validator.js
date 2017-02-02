// jshint node:true
// jshint shadow:true

module.exports = { 
    validate: validate,
    clearCache: clearCache
};

var fs = require('fs');
var xpath = require('xpath');
var dom = require('xmldom').DOMParser;
var crypto = require('crypto');

var parseSchematron = require('./parseSchematron');
var testAssertion = require('./testAssertion');

// Parsed object cache
var parsedMap = {};

function clearCache() {
    parsedMap = {};
}

function validate(xml, schematron, options) {
    // Context cache
    var contextMap = {};
    
    var options = options || {};
    var includeWarnings = options.includeWarnings === undefined ? true : options.includeWarnings;
    var resourceDir = options.resourceDir || './';
    var xmlSnippetMaxLength = options.xmlSnippetMaxLength === undefined ? 200 : options.xmlSnippetMaxLength;
    
    // If not validate xml, it might be a filepath
    if (xml.trim().indexOf('<')) {
        try {
            xml = fs.readFileSync(xml, 'utf-8').toString();
        }
        catch (err) {
        }
    }
    
    // If not validate xml, it might be a filepath
    var schematronPath = null;
    if (schematron.trim().indexOf('<')) {
        try {
            var temp = schematron;
            schematron = fs.readFileSync(schematron, 'utf-8').toString();
            schematronPath = temp;
        }
        catch (err) {
        }
    }
    
    // Load xml doc
    var xmlDoc = new dom().parseFromString(xml);
    
    var hash = crypto.createHash('md5').update(schematron).digest('hex');
    var s = parsedMap[hash];
    
    // If not in cache
    if (!s) {
        // Load schematron doc
        var schematronDoc = new dom().parseFromString(schematron);

        // Parse schematron
        var s = parseSchematron(schematronDoc);

        // Cache parsed schematron
        parsedMap[hash] = s;
    }
    
    // Extract data from parsed schematron object
    var namespaceMap = s.namespaceMap;
    var patternRuleMap = s.patternRuleMap;
    var ruleAssertionMap = s.ruleAssertionMap;
        
    // Create selector object, initialized with namespaces
    var select = xpath.useNamespaces(namespaceMap);    
    
    var errors = [];
    var warnings = [];
    var ignored = [];
    for (var pattern in patternRuleMap) {
        if (patternRuleMap.hasOwnProperty(pattern)) {
            var patternId = pattern;
            var rules = patternRuleMap[pattern];
            for (var i = 0; i < rules.length; i++) {
                if (!ruleAssertionMap[rules[i]].abstract) {
                    var ruleId = rules[i];
                    var context = ruleAssertionMap[rules[i]].context;
                    var assertionResults = checkRule(rules[i]);    
                    for (var j = 0; j < assertionResults.length; j++) {
                        var type = assertionResults[j].type;
                        var assertionId = assertionResults[j].assertionId;
                        var test = assertionResults[j].test;
                        var description = assertionResults[j].description;
                        var results = assertionResults[j].results;
                        if (!results.ignored) {
                            for (var k = 0; k < results.length; k++) {
                                var result = results[k].result;
                                var line = results[k].line;
                                var path = results[k].path;
                                var xmlSnippet = results[k].xml;
                                var modifiedTest = results[k].modifiedTest;
                                if (!result) {
                                    var obj = {
                                        type: type,
                                        test: test,
                                        modifiedTest: modifiedTest,
                                        description: description,
                                        line: line,
                                        path: path,
                                        patternId: patternId,
                                        ruleId: ruleId,
                                        assertionId: assertionId,
                                        context: context,
                                        xml: xmlSnippet
                                    };
                                    if (type === 'error') {
                                        errors.push(obj);
                                    }
                                    else {
                                        warnings.push(obj);
                                    }
                                }
                            }
                        }
                        else {
                            var obj2 = {
                                errorMessage: results.errorMessage,
                                type: type,
                                test: test,
                                description: description,
                                patternId: patternId,
                                ruleId: ruleId,
                                assertionId: assertionId,
                                context: context
                            };
                            ignored.push(obj2);
                        }
                    }
                }
            }
        }
    }
    
    return {
        errorCount: errors.length,
        warningCount: warnings.length,
        ignoredCount: ignored.length,
        errors: errors,
        warnings: warnings,
        ignored: ignored
    };
    
    function checkRule(rule, contextOverride) {
        var results = [];
        var assertionsAndExtensions = ruleAssertionMap[rule].assertionsAndExtensions;
        var context = contextOverride || ruleAssertionMap[rule].context;
        
        // Determine the sections within context, load selected section from cache if possible
        var selected = contextMap[context];
        var contextModified = context;
        if (!selected) {
            if (context) {
                if (context.indexOf('/')) {
                    contextModified = '//' + context;
                }
                selected = select(contextModified, xmlDoc);
            }
            else {
                selected = [xmlDoc];
            }
            contextMap[context] = selected;
        }
        
        for (var i = 0; i < assertionsAndExtensions.length; i++) {
            if (assertionsAndExtensions[i].type === 'assertion') {
                var type = assertionsAndExtensions[i].level;
                if (type === 'error' || includeWarnings) {
                    results.push({
                        type: type,
                        assertionId: assertionsAndExtensions[i].id,
                        test: assertionsAndExtensions[i].test,
                        description: assertionsAndExtensions[i].description,
                        results: testAssertion(assertionsAndExtensions[i].test, selected, select, xmlDoc, resourceDir, xmlSnippetMaxLength)
                    });
                }
            }
            else {
                results = results.concat(checkRule(assertionsAndExtensions[i].rule, context));
            }
        }
        return results;
    }
}
