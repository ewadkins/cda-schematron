// jshint node:true
// jshint shadow:true

module.exports = {
    validate: validate,
    clearCache: clearCache,
    parseSchematron: require('./parseSchematron')
};

const fs = require('fs');
const xpath = require('xpath');
const dom = require('@xmldom/xmldom').DOMParser;
// crypto is now built-in node
const crypto = require('crypto');
const _get = require('lodash.get');
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
let namespaceMap, patternRuleMap, ruleAssertionMap, xpathSelect;
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
    namespaceMap = schematronMap.namespaceMap;
    patternRuleMap = schematronMap.patternRuleMap;
    ruleAssertionMap = schematronMap.ruleAssertionMap;

    // Create selector object, initialized with namespaces
    // Avoid using 'select' as a variable name as it is overused
    xpathSelect = xpath.useNamespaces(namespaceMap);

    let errors = [];
    let warnings = [];
    let ignored = [];
    for (let patternId in patternRuleMap) {
        if (!patternRuleMap.hasOwnProperty(patternId)) {
            continue;
        }
        const rules = patternRuleMap[patternId];
        for (let i = 0; i < rules.length; i++) {
            const ruleId = rules[i];
            const ruleObject = ruleAssertionMap[ruleId];
            if (_get(ruleObject, 'abstract')) {
                continue;
            }            
            const context = _get(ruleObject, 'context');
            const assertionsAndExtensions = _get(ruleObject, 'assertionsAndExtensions') || [];
            let failedAssertions = checkRule(xmlDoc, context, assertionsAndExtensions, options);
            for (let j = 0; j < failedAssertions.length; j++) {
                const assertionObject = failedAssertions[j];
                const { type, assertionId, test, simplifiedTest, description, errorMessage, results } = assertionObject;
                if (!results.ignored) {
                    for (let k = 0; k < results.length; k++) {
                        const resultObject = results[k];
                        const { result, line, path, xml } = resultObject;
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
                                xml: xml
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
        ignoredCount: ignored.length,
        errors: errors,
        warnings: warnings,
        ignored: ignored
    };
}

// Take the checkRule function out of validate function, and pass on the variable needed as parameters and options
function checkRule(xmlDoc, originalContext, assertionsAndExtensions, options) {
    // Context cache
    const includeWarnings = options.includeWarnings === undefined ? true : options.includeWarnings;
    const resourceDir = options.resourceDir || './';
    const xmlSnippetMaxLength = options.xmlSnippetMaxLength === undefined ? 200 : options.xmlSnippetMaxLength;
    let results = [];
    const context = options.contextOverride || originalContext;
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
        const assertionAndExtensionObject = assertionsAndExtensions[i];
        if (assertionAndExtensionObject.type === 'assertion') {
            let { level, test, id, description } = assertionAndExtensionObject;

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
            if (level === 'error' || includeWarnings) {
                results.push({
                    type: level,
                    assertionId: id,
                    test: originalTest,
                    simplifiedTest: simplifiedTest,
                    description: description,
                    results: testAssertion(test, selected, xpathSelect, xmlDoc, resourceDir, xmlSnippetMaxLength)
                });
            }
        }
        else {
            const extensionRule = assertionAndExtensionObject.rule;
            if (!extensionRule) {
                continue;
            }
            const subAssertionsAndExtensions = ruleAssertionMap[extensionRule] ? ruleAssertionMap[extensionRule].assertionsAndExtensions : null;
            if (!subAssertionsAndExtensions) {
                continue;
            }
            const newRuleObject = ruleAssertionMap[extensionRule];
            const newContext = newRuleObject.context;
            results = results.concat(checkRule(xmlDoc, newContext, subAssertionsAndExtensions, options));            
        }
    }
    return results;
}
