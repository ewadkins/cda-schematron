"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const parseSchematron_1 = require("./parseSchematron");
const testAssertion_1 = require("./testAssertion");
const includeExternalDocument_1 = require("./includeExternalDocument");
const xpathHelper_1 = require("./xpathHelper");
const sha1_1 = require("./sha1");
let dom;
if (typeof DOMParser === "undefined") {
    dom = Promise.resolve().then(() => require("xmldom")).then((x) => x.DOMParser);
}
else {
    dom = Promise.resolve(DOMParser);
}
// Parsed object cache
const parsedMap = new Map();
function clearCache() {
    parsedMap.clear();
}
exports.clearCache = clearCache;
function isRuleIgnored(result) {
    return result.ignored || false;
}
function isAssertionIgnored(results) {
    return results.ignored || false;
}
function validate(xml, schematron, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const opts = options || {};
        const includeWarnings = opts.includeWarnings === undefined ? true : Boolean(opts.includeWarnings);
        const resourceDir = opts.resourceDir || "./";
        const xmlSnippetMaxLength = opts.xmlSnippetMaxLength === undefined ? 200 : opts.xmlSnippetMaxLength;
        const DOM = yield dom;
        //// read xml
        let xmlDoc;
        if (xml.trim().indexOf("<") !== 0) {
            // If not valid xml, it might be a URI or filepath
            try {
                xmlDoc = yield includeExternalDocument_1.loadXML(DOM, resourceDir, xml);
            }
            catch (err) {
                // tslint:disable-next-line:max-line-length
                const ne = new Error("Detected URL as xml parameter, but file " + JSON.stringify(xml) + " could not be read: " + err);
                ne.innerError = err;
                throw ne;
            }
        }
        else {
            xmlDoc = new DOM().parseFromString(xml, "application/xml");
        }
        //// read schematron
        let parsedSchematron;
        // If not validate xml, it might be a filepath
        if (schematron.trim().indexOf("<") !== 0) {
            try {
                const lookupKey = ">>" + resourceDir + ">>" + schematron;
                const schCch = parsedMap.get(lookupKey);
                if (schCch) {
                    parsedSchematron = schCch;
                }
                else {
                    parsedSchematron = includeExternalDocument_1.loadXML(DOM, resourceDir, schematron, []).then(parseSchematron_1.default);
                    parsedMap.set(lookupKey, parsedSchematron);
                }
            }
            catch (err) {
                // tslint:disable-next-line:max-line-length
                const ne = new Error("Detected URL as schematron parameter, but file " + JSON.stringify(schematron) + " could not be read: " + err);
                ne.innerError = err;
                throw ne;
            }
        }
        else {
            const hash = yield sha1_1.default(schematron);
            parsedSchematron = parsedMap.get(hash) || (() => {
                // Load schematron doc
                // tslint:disable-next-line:max-line-length
                const d = includeExternalDocument_1.schematronIncludes(DOM, new DOM().parseFromString(schematron, "application/xml"), resourceDir).then(parseSchematron_1.default);
                // Cache parsed schematron
                parsedMap.set(hash, d);
                return d;
            })();
        }
        const { namespaceMap, patternRuleMap, ruleMap } = yield parsedSchematron;
        // Create selector object, initialized with namespaces
        const nsObj = {
            xs: "http://www.w3.org/2001/XMLSchema-datatypes",
            xsi: "http://www.w3.org/2001/XMLSchema-datatypes",
        };
        for (const [nspf, uri] of namespaceMap.entries()) {
            nsObj[nspf] = uri;
        }
        const errors = [];
        const warnings = [];
        const ignored = [];
        const state = {
            DOM,
            contexts: new Map(),
            document: xmlDoc,
            includeWarnings,
            resourceDir,
            select: xpathHelper_1.default.useNamespaces(nsObj),
            xmlSnippetMaxLength,
        };
        for (const [patternId, rules] of patternRuleMap.entries()) {
            for (const ruleAssertion of rules) {
                if (!ruleAssertion.abstract) {
                    const context = ruleAssertion.context;
                    const assertionResults = yield checkRule(state, ruleAssertion, ruleMap);
                    for (const asserRes of assertionResults) {
                        if (isRuleIgnored(asserRes)) {
                            const { type, test, simplifiedTest, assertionId } = asserRes;
                            ignored.push({
                                assertionId,
                                context,
                                errorMessage: asserRes.errorMessage,
                                patternId,
                                ruleId: ruleAssertion.id,
                                simplifiedTest,
                                test,
                                type,
                            });
                        }
                        else {
                            const { type, test, simplifiedTest, description, assertionId } = asserRes;
                            if (isAssertionIgnored(asserRes.results)) {
                                ignored.push({
                                    assertionId,
                                    context,
                                    errorMessage: asserRes.results,
                                    patternId,
                                    ruleId: ruleAssertion.id,
                                    simplifiedTest,
                                    test,
                                    type,
                                });
                            }
                            else {
                                for (const res of asserRes.results) {
                                    const { result, line, path, xml: xmlSnippet } = res;
                                    if (!result) {
                                        const obj = {
                                            assertionId,
                                            context,
                                            description,
                                            line,
                                            path,
                                            patternId,
                                            ruleId: ruleAssertion.id,
                                            simplifiedTest,
                                            test,
                                            type,
                                            xml: xmlSnippet,
                                        };
                                        if (type === "error") {
                                            errors.push(obj);
                                        }
                                        else {
                                            warnings.push(obj);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return {
            errorCount: errors.length,
            errors,
            ignored,
            ignoredCount: ignored.length,
            warningCount: warnings.length,
            warnings,
        };
    });
}
exports.validate = validate;
// tslint:disable-next-line:max-line-length
function checkRule(state, rule, ruleMap, contextOverride) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = [];
        const assertionsAndExtensions = rule.assertionsAndExtensions;
        const context = contextOverride || rule.context;
        // Determine the sections within context, load selected section from cache if possible
        let selected = state.contexts.get(context);
        let contextModified = context;
        if (!selected) {
            if (context) {
                if (context.indexOf("/") !== 0) {
                    contextModified = "//" + context;
                }
                selected = state.select(contextModified, state.document);
            }
            else {
                selected = [state.document];
            }
            state.contexts.set(context, selected);
        }
        for (const assorext of assertionsAndExtensions) {
            if (assorext.type === "assertion") {
                const level = assorext.level;
                let test = assorext.test;
                // Extract values from external document and modify test if a document call is made
                const originalTest = test;
                if (/=document\((\'[-_.A-Za-z0-9]+\'|\"[-_.A-Za-z0-9]+\")\)/.test(test)) {
                    try {
                        test = yield includeExternalDocument_1.replaceTestWithExternalDocument(state.DOM, test, state.resourceDir);
                    }
                    catch (err) {
                        // console.warn("SCHEMATRON->checkRule:", err.message);
                        results.push({
                            assertionId: assorext.id,
                            errorMessage: err.message,
                            ignored: true,
                            simplifiedTest: null,
                            test: originalTest,
                            type: level,
                        });
                        continue;
                    }
                }
                let simplifiedTest = null;
                if (originalTest !== test) {
                    simplifiedTest = test;
                }
                if (level === "error" || state.includeWarnings) {
                    const result = testAssertion_1.default(test, selected, state.select, state.document, state.resourceDir, state.xmlSnippetMaxLength);
                    results.push({
                        assertionId: assorext.id,
                        description: getDescription(assorext, result),
                        results: result,
                        simplifiedTest,
                        test: originalTest,
                        type: level,
                    });
                }
            }
            else {
                const extrule = ruleMap.get(assorext.rule);
                if (!extrule) {
                    // tslint:disable-next-line:no-console
                    console.error("SCHEMATRON->checkRule: Missing extension rule: %s", assorext.rule);
                }
                else {
                    results.push(...yield checkRule(state, extrule, ruleMap, context));
                }
            }
        }
        return results;
    });
}
function getDescription(assorext, result) {
    return assorext.description.map((d) => {
        if (typeof d === "string") {
            return d;
        }
        if (d.tag === "name") {
            if (isAssertionIgnored(result)) {
                return "<name />";
            }
            else {
                return result[0].path.replace(/^.*\//, "").replace(/\[.*$/, "");
            }
        }
        return "";
    }).join(" ");
}
//# sourceMappingURL=validator.js.map