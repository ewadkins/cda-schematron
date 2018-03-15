var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import parseSchematron from "./parseSchematron";
import testAssertion from "./testAssertion";
import * as xpath from "xpath";
import sha1 from "./sha1";
let dom;
if (typeof DOMParser === "undefined") {
    dom = import("xmldom").then((x) => x.DOMParser);
}
else {
    dom = Promise.resolve(DOMParser);
}
// Parsed object cache
const parsedMap = new Map();
export function clearCache() {
    parsedMap.clear();
}
function isRuleIgnored(result) {
    return result.ignored || false;
}
function isAssertionIgnored(results) {
    return results.ignored || false;
}
export function validate(xml, schematron, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const opts = options || {};
        const includeWarnings = opts.includeWarnings === undefined ? true : Boolean(opts.includeWarnings);
        const resourceDir = opts.resourceDir || "./";
        const xmlSnippetMaxLength = opts.xmlSnippetMaxLength === undefined ? 200 : opts.xmlSnippetMaxLength;
        // If not validate xml, it might be a filepath
        if (xml.trim().indexOf("<") !== 0) {
            try {
                const { readFile } = yield import("fs");
                xml = yield new Promise((o, r) => readFile(xml, "utf-8", (err, data) => {
                    if (err) {
                        r(err);
                    }
                    else {
                        o(data);
                    }
                }));
            }
            catch (err) {
                const ne = new Error("Detected filepath as xml parameter, but file could not be read: " + err);
                ne.innerError = err;
                throw ne;
            }
        }
        // If not validate xml, it might be a filepath
        let schematronPath = null;
        if (schematron.trim().indexOf("<") !== 0) {
            try {
                const { readFile } = yield import("fs");
                const temp = schematron;
                schematron = yield new Promise((o, r) => readFile(schematron, "utf-8", (err, data) => {
                    if (err) {
                        r(err);
                    }
                    else {
                        o(data);
                    }
                }));
                schematronPath = temp;
            }
            catch (err) {
                const ne = new Error("Detected filepath as schematron parameter, but file could not be read: " + err);
                ne.innerError = err;
                throw ne;
            }
        }
        // Load xml doc
        const DOM = yield dom;
        const xmlDoc = new DOM().parseFromString(xml, "application/xml");
        const hash = yield sha1(schematron);
        const { namespaceMap, patternRuleMap, ruleAssertionMap } = parsedMap.get(hash) || (() => {
            // Load schematron doc
            const d = parseSchematron(new DOM().parseFromString(schematron, "application/xml"));
            // Cache parsed schematron
            parsedMap.set(hash, d);
            return d;
        })();
        // Create selector object, initialized with namespaces
        const nsObj = {};
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
            select: xpath.useNamespaces(nsObj),
            xmlSnippetMaxLength,
        };
        for (const [patternId, rules] of patternRuleMap.entries()) {
            for (const ruleId of rules) {
                const ruleAssertion = ruleAssertionMap.get(ruleId);
                if (!ruleAssertion.abstract) {
                    const context = ruleAssertion.context;
                    const assertionResults = yield checkRule(state, ruleId, ruleAssertion);
                    for (const asserRes of assertionResults) {
                        if (isRuleIgnored(asserRes)) {
                            const { type, test, simplifiedTest, assertionId } = asserRes;
                            ignored.push({
                                assertionId,
                                context,
                                errorMessage: asserRes.errorMessage,
                                patternId,
                                ruleId,
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
                                    ruleId,
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
                                            ruleId,
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
// tslint:disable-next-line:max-line-length
function checkRule(state, ruleId, ruleAssertion, contextOverride) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = [];
        const assertionsAndExtensions = ruleAssertion.assertionsAndExtensions;
        const context = contextOverride || ruleAssertion.context;
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
                        const includeExternalDocument = yield import("./includeExternalDocument").then((x) => x.default);
                        test = yield includeExternalDocument(state.DOM, test, state.resourceDir);
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
                    const result = testAssertion(test, selected, state.select, state.document, state.resourceDir, state.xmlSnippetMaxLength);
                    results.push({
                        assertionId: assorext.id,
                        description: assorext.description,
                        results: result,
                        simplifiedTest,
                        test: originalTest,
                        type: level,
                    });
                }
            }
            else {
                results.push(...yield checkRule(state, assorext.rule, ruleAssertion, context));
            }
        }
        return results;
    });
}
//# sourceMappingURL=validator.js.map