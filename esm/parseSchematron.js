import * as xpath from "xpath";
function* getNamedChildren(parent, localName, ns) {
    const children = parent.childNodes;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.localName === localName && (ns === undefined || ns === child.namespaceURI)) {
            yield child;
        }
    }
}
export default function parseSchematron(doc) {
    const namespaceMap = new Map();
    const abstractPatterns = new Set();
    const patternInstances = new Map();
    const patternLevelMap = new Map();
    const patternRuleMap = new Map();
    const ruleMap = new Map();
    //// Namespace mapping
    const namespaces = xpath.select('//*[local-name()="ns"]', doc);
    for (const namespace of namespaces) {
        const pf = namespace.getAttribute("prefix");
        const ns = namespace.getAttribute("uri");
        if (pf && ns) {
            namespaceMap.set(pf, ns);
        }
    }
    //// Pattern to level mapping
    // Find errors phases
    const errorPhase = xpath.select('//*[local-name()="phase" and @id="errors"]', doc);
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
    const warningPhase = xpath.select('//*[local-name()="phase" and @id="warnings"]', doc);
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
    const patterns = xpath.select('//*[local-name()="pattern"]', doc);
    // Map patterns to rules
    for (const pattern of patterns) {
        const patternId = pattern.getAttribute("id");
        const defaultLevel = (patternId && patternLevelMap.get(patternId)) || "warning";
        const parsedRules = [];
        if (patternId) {
            if (parseAbstract(pattern.getAttribute("abstract"))) {
                abstractPatterns.add(patternId);
            }
            const isA = pattern.getAttribute("is-a");
            if (isA) {
                const params = xpath.select('./*[local-name()="param"]', pattern).reduce((m, e) => {
                    const n = e.getAttribute("name");
                    if (n) {
                        m.set(n, e.getAttribute("value") || "");
                    }
                    return m;
                }, new Map());
                patternInstances.set(patternId, { isA, params });
                continue;
            }
            patternRuleMap.set(patternId, parsedRules);
        }
        const rules = xpath.select('./*[local-name()="rule"]', pattern);
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
    for (const [patternId, { isA, params }] of patternInstances.entries()) {
        const base = patternRuleMap.get(isA);
        if (!base) {
            continue;
        }
        patternRuleMap.set(patternId, base.map((rule) => {
            return Object.assign({}, rule, { assertionsAndExtensions: rule.assertionsAndExtensions.map((aoe) => {
                    if (aoe.type === "assertion") {
                        return Object.assign({}, aoe, { test: normalizeBuiltin(replaceParams(params, aoe.test)) });
                    }
                    return aoe;
                }), context: rule.context && replaceParams(params, rule.context) });
        }));
    }
    for (const patternId of abstractPatterns) {
        patternRuleMap.delete(patternId);
    }
    return {
        namespaceMap,
        patternRuleMap,
    };
}
function replaceParams(params, content) {
    const pat = /\$[^,\s\(\)\+\/\*\\]+/;
    return content.replace(pat, (a) => {
        const d = params.get(a.substring(1));
        if (d === undefined) {
            throw new Error("Undefined parameter: " + a);
        }
        return d;
    });
}
function getAssertionsAndExtensions(rule, defaultLevel) {
    const assertionsAndExtensions = [];
    // Find and store assertions
    const assertions = xpath.select('./*[local-name()="assert"]', rule);
    for (const assertion of assertions) {
        const description = getDescription(assertion.childNodes);
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
            }
            else if (rolelc === "warning" || rolelc === "info" || rolelc === "obsolete" || rolelc === "obsolescent") {
                level = "warning";
            }
        }
        assertionsAndExtensions.push({
            description,
            id: assertion.getAttribute("id"),
            level,
            test: normalizeBuiltin(assertion.getAttribute("test")),
            type: "assertion",
        });
    }
    // Find and store extensions
    const extensions = xpath.select('./*[local-name()="extends"]', rule);
    for (const extension of extensions) {
        assertionsAndExtensions.push({
            rule: extension.getAttribute("rule"),
            type: "extension",
        });
    }
    return assertionsAndExtensions;
}
function getDescription(nodeList) {
    const desc = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < nodeList.length; i++) {
        const node = nodeList[i];
        if (node.nodeType === 3) {
            const v = node.nodeValue && node.nodeValue.trim();
            if (v) {
                desc.push(v);
            }
        }
        else if (node.nodeType === 4) {
            const v = node.nodeValue && node.nodeValue.trim();
            if (v) {
                desc.push(v);
            }
        }
        else if (node.nodeType === 1 && node.namespaceURI === null) {
            const e = node;
            const n = e.localName;
            if (n === "name") {
                desc.push({ tag: "name" });
            }
            else if (n === "value-of") {
                desc.push({ tag: "value-of" });
            }
        }
    }
    return desc;
}
function parseAbstract(str) {
    if (str === "true" || str === "yes") {
        return true;
    }
    return false;
}
function parseContext(str) {
    return str || null;
}
function normalizeBuiltin(data) {
    if (!data) {
        return data;
    }
    const parts = data.split("'");
    for (let i = 0; i < parts.length; i += 2) {
        // tslint:disable-next-line:max-line-length
        parts[i] = parts[i].replace(/\bxsi?:(decimal|string|boolean|float|double|date|duration|dateTime|time|gYearMonth|gYear|gMonthDay|gDay|gMonth|hexBinary|base64Binary|anyURI|QName|NOTATION)\(/g, (f, p) => p + "(");
    }
    return parts.join("'");
}
//# sourceMappingURL=parseSchematron.js.map