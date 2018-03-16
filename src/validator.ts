
import parseSchematron, { IAssertion, IParsedSchematron, IRule } from "./parseSchematron";
import testAssertion, { ITestAssertionError, ITestAssertionResult } from "./testAssertion";

import { loadXML, replaceTestWithExternalDocument, schematronIncludes } from "./includeExternalDocument";

import * as xpath from "xpath";

import sha1 from "./sha1";

let dom: Promise<{ new(): DOMParser }>;

if (typeof DOMParser === "undefined") {
    dom = import("xmldom").then((x) => x.DOMParser);
} else {
    dom = Promise.resolve(DOMParser);
}

// Parsed object cache
const parsedMap = new Map<string, Promise<IParsedSchematron>>();

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
    ruleId?: string;
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

    const DOM = await dom;

    //// read xml
    let xmlDoc: Document;

    if (xml.trim().indexOf("<") !== 0) {
        // If not valid xml, it might be a URI or filepath
        try {
            xmlDoc = await loadXML(DOM, resourceDir, xml);
        } catch (err) {
            // tslint:disable-next-line:max-line-length
            const ne = new Error("Detected URL as xml parameter, but file " + JSON.stringify(xml) + " could not be read: " + err);
            (ne as any).innerError = err;
            throw ne;
        }
    } else {
        xmlDoc = new DOM().parseFromString(xml, "application/xml");
    }

    //// read schematron
    let parsedSchematron: Promise<IParsedSchematron>;

    // If not validate xml, it might be a filepath
    if (schematron.trim().indexOf("<") !== 0) {
        try {
            const lookupKey = ">>" + resourceDir + ">>" + schematron;
            const schCch = parsedMap.get(lookupKey);
            if (schCch) {
                parsedSchematron = schCch;
            } else {
                parsedSchematron = loadXML(DOM, resourceDir, schematron, []).then(parseSchematron);
                parsedMap.set(lookupKey, parsedSchematron);
            }
        } catch (err) {
            // tslint:disable-next-line:max-line-length
            const ne = new Error("Detected URL as schematron parameter, but file " + JSON.stringify(schematron) + " could not be read: " + err);
            (ne as any).innerError = err;
            throw ne;
        }
    } else {
        const hash = await sha1(schematron);
        parsedSchematron = parsedMap.get(hash) || (() => {
            // Load schematron doc
            // tslint:disable-next-line:max-line-length
            const d = schematronIncludes(DOM, new DOM().parseFromString(schematron, "application/xml"), resourceDir).then(parseSchematron);

            // Cache parsed schematron
            parsedMap.set(hash, d);
            return d;
        })();
    }

    const { namespaceMap, patternRuleMap, ruleMap } = await parsedSchematron;

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
        for (const ruleAssertion of rules) {
            if (!ruleAssertion.abstract) {
                const context = ruleAssertion.context as string;
                const assertionResults = await checkRule(state, ruleAssertion, ruleMap);

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
                    } else {
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
                                        ruleId: ruleAssertion.id,
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
async function checkRule(state: IContextState, rule: IRule, ruleMap: Map<string, IRule>, contextOverride?: string) {
    const results: Array<IRuleResult | IRuleIgnored> = [];
    const assertionsAndExtensions = rule.assertionsAndExtensions;
    const context = contextOverride || rule.context as string;

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
                    test = await replaceTestWithExternalDocument(state.DOM, test, state.resourceDir);
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
                    description: getDescription(assorext, result),
                    results: result,
                    simplifiedTest,
                    test: originalTest,
                    type: level,
                } as IRuleResult);
            }
        } else {
            const extrule = ruleMap.get(assorext.rule);
            if (!extrule) {
                // tslint:disable-next-line:no-console
                console.error("SCHEMATRON->checkRule: Missing extension rule: %s", assorext.rule);
            } else {
                results.push(...await checkRule(state, extrule, ruleMap, context));
            }
        }
    }
    return results;
}

function getDescription(assorext: IAssertion, result: ITestAssertionError | ITestAssertionResult[]): string {
    return assorext.description.map((d) => {
        if (typeof d === "string") {
            return d;
        }
        if (d.tag === "name") {
            if (isAssertionIgnored(result)) {
                return "<name />";
            } else {
                return result[0].path.replace(/^.*\//, "").replace(/\[.*$/, "");
            }
        }
        return "";
    }).join(" ");
}
