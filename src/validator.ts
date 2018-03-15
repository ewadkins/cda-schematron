
import parseSchematron, { IParsedSchematron, IRuleAssertion } from "./parseSchematron";
import testAssertion, { ITestAssertionError, ITestAssertionResult } from "./testAssertion";

import * as xpath from "xpath";

import sha1 from "./sha1";

let dom: Promise<{ new(): DOMParser }>;

if (typeof DOMParser === "undefined") {
    dom = import("xmldom").then((x) => x.DOMParser);
} else {
    dom = Promise.resolve(DOMParser);
}

// Parsed object cache
const parsedMap = new Map<string, IParsedSchematron>();

export interface IValidateOptions {
    /**
     * This determines whether or not warnings should be tested and returned.
     * Defaults to true.
     */
    includeWarnings: boolean;

    /**
     * The path to a directory containing resource files (eg. voc.xml) which may be necessary for some schematron tests.
     * Defaults to './', the current directory.
     */
    resourceDir: string;
    /**
     * An integer, which is the maximum length of the xml field in validation results.
     * Defaults to 200. Set to 0 for unlimited length.
     */
    xmlSnippetMaxLength: number;
}

export function clearCache() {
    parsedMap.clear();
}

interface IContextState extends IValidateOptions {
    contexts: Map<string, Node[]>;
    document: Document;
    DOM: { new(): DOMParser; };
    select: xpath.XPathSelect;
}

interface IRuleResult {
    assertionId: string;
    description: string;
    results: ITestAssertionResult[] | ITestAssertionError;
    simplifiedTest: null | string;
    test: string;
    type: "warning" | "error";
}

interface IRuleIgnored {
    assertionId: string;
    ignored: true;
    errorMessage: string;
    simplifiedTest: null | string;
    test: string;
    type: "warning" | "error";
}

export interface IValidationResult {
    type: "error" | "warning";
    test: string;
    simplifiedTest: string | null;
    description: string;
    line: number | null;
    path: string;
    patternId: string;
    ruleId: string;
    assertionId: string;
    context: string;
    xml: string | null;
}

function isRuleIgnored(result: IRuleResult | IRuleIgnored): result is IRuleIgnored {
    return (result as IRuleIgnored).ignored || false;
}

function isAssertionIgnored(results: ITestAssertionResult[] | ITestAssertionError): results is ITestAssertionError {
    return (results as ITestAssertionError).ignored || false;
}

export async function validate(xml: string, schematron: string, options?: Partial<IValidateOptions>) {

    const opts = options || {};
    const includeWarnings = opts.includeWarnings === undefined ? true : Boolean(opts.includeWarnings);
    const resourceDir = opts.resourceDir || "./";
    const xmlSnippetMaxLength = opts.xmlSnippetMaxLength === undefined ? 200 : opts.xmlSnippetMaxLength;

    // If not validate xml, it might be a filepath
    if (xml.trim().indexOf("<") !== 0) {
        try {
            const { readFile } = await import("fs");
            xml = await new Promise<string>((o, r) => readFile(xml, "utf-8", (err, data) => {
                if (err) {
                    r(err);
                } else {
                    o(data);
                }
            }));
        } catch (err) {
            const ne = new Error("Detected filepath as xml parameter, but file could not be read: " + err);
            (ne as any).innerError = err;
            throw ne;
        }
    }

    // If not validate xml, it might be a filepath
    let schematronPath = null;
    if (schematron.trim().indexOf("<") !== 0) {
        try {
            const { readFile } = await import("fs");
            const temp = schematron;
            schematron = await new Promise<string>((o, r) => readFile(schematron, "utf-8", (err, data) => {
                if (err) {
                    r(err);
                } else {
                    o(data);
                }
            }));
            schematronPath = temp;
        } catch (err) {
            const ne = new Error("Detected filepath as schematron parameter, but file could not be read: " + err);
            (ne as any).innerError = err;
            throw ne;
        }
    }

    // Load xml doc
    const DOM = await dom;

    const xmlDoc = new DOM().parseFromString(xml, "application/xml");

    const hash = await sha1(schematron);
    const { namespaceMap, patternRuleMap, ruleAssertionMap } = parsedMap.get(hash) || (() => {
        // Load schematron doc
        const d = parseSchematron(new DOM().parseFromString(schematron, "application/xml"));

        // Cache parsed schematron
        parsedMap.set(hash, d);
        return d;
    })();

    // Create selector object, initialized with namespaces
    const nsObj: { [k: string]: string; } = {};
    for (const [nspf, uri] of namespaceMap.entries()) {
        nsObj[nspf] = uri;
    }

    const errors = [];
    const warnings = [];
    const ignored = [];

    const state: IContextState = {
        DOM,
        contexts: new Map<string, any>(),
        document: xmlDoc,
        includeWarnings,
        resourceDir,
        select: xpath.useNamespaces(nsObj),
        xmlSnippetMaxLength,
    };

    for (const [patternId, rules] of patternRuleMap.entries()) {
        for (const ruleId of rules) {
            const ruleAssertion = ruleAssertionMap.get(ruleId) as IRuleAssertion;
            if (!ruleAssertion.abstract) {
                const context = ruleAssertion.context as string;
                const assertionResults = await checkRule(state, ruleId, ruleAssertion);

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
                    } else {
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
                        } else {
                            for (const res of asserRes.results) {
                                const { result, line, path, xml: xmlSnippet } = res;
                                if (!result) {
                                    const obj: IValidationResult = {
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
                                    } else {
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
}

// tslint:disable-next-line:max-line-length
async function checkRule(state: IContextState, ruleId: string, ruleAssertion: IRuleAssertion, contextOverride?: string) {
    const results: Array<IRuleResult | IRuleIgnored> = [];
    const assertionsAndExtensions = ruleAssertion.assertionsAndExtensions;
    const context = contextOverride || ruleAssertion.context as string;

    // Determine the sections within context, load selected section from cache if possible
    let selected = state.contexts.get(context) as Node[];
    let contextModified = context;
    if (!selected) {
        if (context) {
            if (context.indexOf("/") !== 0) {
                contextModified = "//" + context;
            }
            selected = state.select(contextModified, state.document) as Node[];
        } else {
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
                    const includeExternalDocument = await import("./includeExternalDocument").then((x) => x.default);
                    test = await includeExternalDocument(state.DOM, test, state.resourceDir);
                } catch (err) {
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
                const result = testAssertion(test, selected, state.select,
                        state.document, state.resourceDir, state.xmlSnippetMaxLength);
                results.push({
                    assertionId: assorext.id,
                    description: assorext.description,
                    results: result,
                    simplifiedTest,
                    test: originalTest,
                    type: level,
                } as IRuleResult);
            }
        } else {
            results.push(...await checkRule(state, assorext.rule, ruleAssertion, context));
        }
    }
    return results;
}
