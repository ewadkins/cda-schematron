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
    const patternLevelMap = new Map();
    const patternRuleMap = new Map();
    const ruleAssertionMap = new Map();
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
        if (patternId) {
            patternRuleMap.set(patternId, []);
        }
        const rules = xpath.select('./*[local-name()="rule"]', pattern);
        for (const rule of rules) {
            const ruleId = rule.getAttribute("id");
            if (ruleId) {
                if (patternId && ruleId) {
                    patternRuleMap.get(patternId).push(ruleId);
                }
                ruleAssertionMap.set(ruleId, {
                    abstract: parseAbstract(rule.getAttribute("abstract")),
                    assertionsAndExtensions: getAssertionsAndExtensions(rule, defaultLevel),
                    context: parseContext(rule.getAttribute("context")),
                });
            }
        }
    }
    return {
        namespaceMap,
        patternRuleMap,
        ruleAssertionMap,
    };
}
function getAssertionsAndExtensions(rule, defaultLevel) {
    const assertionsAndExtensions = [];
    // Find and store assertions
    const assertions = xpath.select('./*[local-name()="assert"]', rule);
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
            }
            else if (rolelc === "warning" || rolelc === "info" || rolelc === "obsolete" || rolelc === "obsolescent") {
                level = "warning";
            }
        }
        assertionsAndExtensions.push({
            description,
            id: assertion.getAttribute("id"),
            level,
            test: assertion.getAttribute("test"),
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
function parseAbstract(str) {
    if (str === "true" || str === "yes") {
        return true;
    }
    return false;
}
function parseContext(str) {
    return str || null;
}
//# sourceMappingURL=parseSchematron.js.map