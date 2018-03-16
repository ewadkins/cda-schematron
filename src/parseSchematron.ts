import * as xpath from "xpath";

function* getNamedChildren(parent: Element, localName: string, ns?: string): IterableIterator<Element> {
    const children = parent.childNodes;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < children.length; i++) {
        const child = children[i] as Element;
        if (child.localName === localName && (ns === undefined || ns === child.namespaceURI)) {
            yield child;
        }
    }
}

export type IAssertionOrExtension = IAssertion | IExtension;

export interface IExtension {
    type: "extension";
    rule: string;
}

export interface IAssertion {
    type: "assertion";
    level: "error" | "warning";
    id: string;
    test: string;
    description: string;
}

export interface IRule {
    abstract: boolean;
    assertionsAndExtensions: IAssertionOrExtension[];
    context: null | string;
    id?: string;
}

export interface IParsedSchematron {
    namespaceMap: Map<string, string>;
    patternRuleMap: Map<string, IRule[]>;
    ruleMap: Map<string, IRule>;
}

export default function parseSchematron(doc: Document) {
    const namespaceMap = new Map<string, string>();
    const abstractPatterns = new Set<string>();
    const patternInstances = new Map<string, { isA: string; params: Map<string, string>; }>();
    const patternLevelMap = new Map<string, "error" | "warning">();
    const patternRuleMap = new Map<string, IRule[]>();
    const ruleMap = new Map<string, IRule>();

    //// Namespace mapping
    const namespaces = xpath.select('//*[local-name()="ns"]', doc) as Element[];
    for (const namespace of namespaces) {
        const pf = namespace.getAttribute("prefix");
        const ns = namespace.getAttribute("uri");
        if (pf && ns) {
            namespaceMap.set(pf, ns);
        }
    }

    //// Pattern to level mapping

    // Find errors phases
    const errorPhase = xpath.select('//*[local-name()="phase" and @id="errors"]', doc) as Element[];

    // Store error patterns
    if (errorPhase.length) {
        for (const child of getNamedChildren(errorPhase[0], "active")) {
            const patt = child.getAttribute("pattern");
            if (patt) {
                patternLevelMap.set(patt, "error");
            }
        }
    }

    // Find errors phases
    const warningPhase = xpath.select('//*[local-name()="phase" and @id="warnings"]', doc) as Element[];

    // Store warning patterns
    if (warningPhase.length) {
        for (const child of getNamedChildren(warningPhase[0], "active")) {
            const patt = child.getAttribute("pattern");
            if (patt) {
                patternLevelMap.set(patt, "warning");
            }
        }
    }

    //// Pattern to rule and rule to assertion mapping

    // Find patterns
    const patterns = xpath.select('//*[local-name()="pattern"]', doc) as Element[];

    // Map patterns to rules
    for (const pattern of patterns) {
        const patternId = pattern.getAttribute("id");
        const defaultLevel = (patternId && patternLevelMap.get(patternId)) || "warning";
        const parsedRules: IRule[] = [];
        if (patternId) {
            if (parseAbstract(pattern.getAttribute("abstract"))) {
                abstractPatterns.add(patternId);
            }
            const isA = pattern.getAttribute("is-a");
            if (isA) {
                const params = (xpath.select('./*[local-name()="param"]', pattern) as Element[]).reduce((m, e) => {
                    const n = e.getAttribute("name");
                    if (n) {
                        m.set(n, e.getAttribute("value") || "");
                    }
                    return m;
                }, new Map<string, string>());
                patternInstances.set(patternId, { isA, params });
                continue;
            }
            patternRuleMap.set(patternId, parsedRules);
        }
        const rules = xpath.select('./*[local-name()="rule"]', pattern) as Element[];
        for (const rule of rules) {
            const ruleId = rule.getAttribute("id") || undefined;
            const obj = {
                abstract: parseAbstract(rule.getAttribute("abstract")),
                assertionsAndExtensions: getAssertionsAndExtensions(rule, defaultLevel),
                context: parseContext(rule.getAttribute("context")),
                id: ruleId,
            };
            if (ruleId) {
                ruleMap.set(ruleId, obj);
            }
            parsedRules.push(obj);
        }
    }

    for (const [ patternId, { isA, params } ] of patternInstances.entries()) {
        const base = patternRuleMap.get(isA);
        if (!base) {
            continue;
        }
        patternRuleMap.set(patternId, base.map((rule) => {
            return {
                ...rule,
                assertionsAndExtensions: rule.assertionsAndExtensions.map((aoe) => {
                    if (aoe.type === "assertion") {
                        return {
                            ...aoe,
                            test: replaceParams(params, aoe.test),
                        };
                    }
                    return aoe;
                }),
                context: rule.context && replaceParams(params, rule.context),
            };
        }));
    }

    for (const patternId of abstractPatterns) {
        patternRuleMap.delete(patternId);
    }

    return {
        namespaceMap,
        patternRuleMap,
    } as IParsedSchematron;
}

function replaceParams(params: Map<string, string>, content: string) {
    const pat = /\$[^,\s\(\)\+\/\*\\]+/;
    return content.replace(pat, (a) => {
        const d = params.get(a.substring(1));
        if (d === undefined) {
            throw new Error("Undefined parameter: " + a);
        }
        return d;
    });
}

function getAssertionsAndExtensions(rule: Element, defaultLevel: "warning" | "error"): IAssertionOrExtension[] {
    const assertionsAndExtensions: IAssertionOrExtension[] = [];

    // Find and store assertions
    const assertions = xpath.select('./*[local-name()="assert"]', rule) as Element[];
    for (const assertion of assertions) {
        const description = assertion.textContent || "";
        let level = defaultLevel;
        if (description.indexOf("SHALL") !== -1
            && (description.indexOf("SHOULD") === -1 || description.indexOf("SHALL") < description.indexOf("SHOULD"))) {
            level = "error";
        }
        const role = rule.getAttribute("role");
        if (role) {
            const rolelc = role.toLowerCase();
            if (rolelc === "fatal" || rolelc === "error") {
                level = "error";
            } else if (rolelc === "warning" || rolelc === "info" || rolelc === "obsolete" || rolelc === "obsolescent") {
                level = "warning";
            }
        }
        assertionsAndExtensions.push({
            description,
            id: assertion.getAttribute("id") as string,
            level,
            test: assertion.getAttribute("test") as string,
            type: "assertion",
        });
    }

    // Find and store extensions
    const extensions = xpath.select('./*[local-name()="extends"]', rule) as Element[];
    for (const extension of extensions) {
        assertionsAndExtensions.push({
            rule: extension.getAttribute("rule") as string,
            type: "extension",
        });
    }

    return assertionsAndExtensions;
}

function parseAbstract(str: string | null) {
    if (str === "true" || str === "yes") {
        return true;
    }
    return false;
}

function parseContext(str: string | null) {
    return str || null;
}
