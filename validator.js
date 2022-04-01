// jshint node:true
// jshint shadow:true

module.exports = {
    validate: validate,
    clearCache: clearCache
};

const fs = require('fs');
const xpath = require('xpath');
const dom = require('@xmldom/xmldom').DOMParser;
// crypto is now built-in node
const crypto = require('crypto');

const parseSchematron = require('./parseSchematron');
const testAssertion = require('./testAssertion');
const includeExternalDocument = require('./includeExternalDocument');

// Parsed object cache
let parsedMap = Object.create({});
let contextMap = Object.create({});

function clearCache() {
    parsedMap = Object.create({});
    contextMap = Object.create({});
}

function validate(xml, schematron, options = {}) {
    // If not valid xml, it might be a filepath
    // Adding explicit check to make it clear
    if (xml.trim().indexOf('<') === -1) {
        try {
            xml = fs.readFileSync(xml, 'utf-8').toString();
        }
        catch (err) {
            // If no valid xml found, inform user, and return immediately
            console.log('No valid xml could be found');
            return;
        }
    }

    let schematronMap;
    // Load xml doc
    let xmlDoc = new dom().parseFromString(xml);
    // Allowing users to send a parsed schematron map if testing multiple xml files with the same schematron
    if (options.parsedSchematronMap) {
        schematronMap = options.parsedSchematronMap;
    }
    else {
        // If not valid schematron (xml), it might be a filepath
        // Adding explicit check to make it clear
        if (schematron.trim().indexOf('<') === -1) {
            try {
                schematron = fs.readFileSync(schematron, 'utf-8').toString();
            }
            catch (err) {
                // If no valid schematron found, inform user, and return immediately
                console.log('No valid schematron could be found');
                return;
            }
        }
        let hash = crypto
            .createHash('md5')
            .update(schematron)
            .digest('hex');
        schematronMap = parsedMap[hash];
        // If not in cache
        if (!schematronMap) {
            // Load schematron doc
            let schematronDoc = new dom().parseFromString(schematron);

            // Parse schematron
            schematronMap = parseSchematron(schematronDoc);

            // Cache parsed schematron
            parsedMap[hash] = schematronMap;
        }
    }

    // Extract data from parsed schematron object
    let namespaceMap = schematronMap.namespaceMap;
    let patternRuleMap = schematronMap.patternRuleMap;
    let ruleAssertionMap = schematronMap.ruleAssertionMap;

    // Create selector object, initialized with namespaces
    // Avoid using 'select' as a variable name as it is overused
    const xpathSelect = xpath.useNamespaces(namespaceMap);

    let errors = [];
    let warnings = [];
    let ignored = [];
    for (let pattern in patternRuleMap) {
        if (!patternRuleMap.hasOwnProperty(pattern)) {
            continue;
        }
        let patternId = pattern;
        let rules = patternRuleMap[pattern];
        for (let i = 0; i < rules.length; i++) {
            if (ruleAssertionMap[rules[i]].abstract) {
                continue;
            }
            let ruleId = rules[i];
            let context = ruleAssertionMap[rules[i]].context;
            let assertionsAndExtensions = ruleAssertionMap[rules[i]].assertionsAndExtensions || [];
            let assertionResults = checkRule(xmlDoc, xpathSelect, context, assertionsAndExtensions, options);
            for (let j = 0; j < assertionResults.length; j++) {
                let type = assertionResults[j].type;
                let assertionId = assertionResults[j].assertionId;
                let test = assertionResults[j].test;
                let simplifiedTest = assertionResults[j].simplifiedTest;
                let description = assertionResults[j].description;
                let errorMessage = assertionResults[j].errorMessage;
                let results = assertionResults[j].results;
                if (!results.ignored) {
                    for (let k = 0; k < results.length; k++) {
                        let result = results[k].result;
                        let line = results[k].line;
                        let path = results[k].path;
                        let xmlSnippet = results[k].xml;
                        if (!result) {
                            let obj = {
                                type: type,
                                test: test,
                                simplifiedTest: simplifiedTest,
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
                    let obj = {
                        errorMessage: errorMessage,
                        type: type,
                        test: test,
                        simplifiedTest: simplifiedTest,
                        description: description,
                        patternId: patternId,
                        ruleId: ruleId,
                        assertionId: assertionId,
                        context: context
                    };
                    ignored.push(obj);
                }
            }
        }
    }

    return {
        errorCount: errors.length,
        warningCount: warnings.length,
        ignoredCount: ignored ? ignored.length : 0,
        errors: errors,
        warnings: warnings,
        ignored: ignored
    };
}

// Take the checkRule function out of validate function, and pass on the variable needed as parameters and options
function checkRule(xmlDoc, xpathSelect, originalContext, assertionsAndExtensions, options) {
    // Context cache
    let includeWarnings = options.includeWarnings === undefined ? true : options.includeWarnings;
    let resourceDir = options.resourceDir || './';
    let xmlSnippetMaxLength = options.xmlSnippetMaxLength === undefined ? 200 : options.xmlSnippetMaxLength;
    let results = [];
    let context = options.contextOverride || originalContext;
    // Determine the sections within context, load selected section from cache if possible
    let selected = contextMap[context];
    let contextModified = context;
    if (!selected) {
        if (context) {
            if (context.indexOf('/')) {
                contextModified = '//' + context;
            }
            selected = xpathSelect(contextModified, xmlDoc);
        }
        else {
            selected = [xmlDoc];
        }
        contextMap[context] = selected;
    }

    for (let i = 0; i < assertionsAndExtensions.length; i++) {
        if (assertionsAndExtensions[i].type === 'assertion') {
            let type = assertionsAndExtensions[i].level;
            let test = assertionsAndExtensions[i].test;

            // Extract values from external document and modify test if a document call is made
            let originalTest = test;
            try {
                test = includeExternalDocument(test, resourceDir);
            }
            catch (err) {
                return { ignored: true, errorMessage: err.message };
            }

            let simplifiedTest = null;
            if (originalTest !== test) {
                simplifiedTest = test;
            }
            if (type === 'error' || includeWarnings) {
                results.push({
                    type: type,
                    assertionId: assertionsAndExtensions[i].id,
                    test: originalTest,
                    simplifiedTest: simplifiedTest,
                    description: assertionsAndExtensions[i].description,
                    results: testAssertion(test, selected, xpathSelect, xmlDoc, resourceDir, xmlSnippetMaxLength)
                });
            }
        }
        // removed recursive call to checkRule as it just returns an emptry array
    }
    return results;
}