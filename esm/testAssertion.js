/**
 * Test an asertion for a selection of nodes.
 *
 * @param test test to execute
 * @param selected nodes to execute test upon
 * @param select function used to execute tests
 * @param xmlDoc root document containing nodes
 * @param resourceDir a directory path
 * @param xmlSnippetMaxLength max length of the snippet to be returned
 */
export default function testAssertion(test, selected, select, xmlDoc, resourceDir, xmlSnippetMaxLength) {
    const results = [];
    for (const sel of selected) {
        try {
            const result = select("boolean(" + test + ")", sel, true);
            let line = null;
            let xmlSnippet = null;
            if (sel.lineNumber) {
                line = sel.lineNumber;
                xmlSnippet = sel.toString();
            }
            const maxLength = (xmlSnippetMaxLength || 1e308);
            if (xmlSnippet && xmlSnippet.length > maxLength) {
                xmlSnippet = xmlSnippet.slice(0, maxLength) + "...";
            }
            results.push({ result, line, path: getXPath(sel), xml: xmlSnippet });
        }
        catch (err) {
            return { ignored: true, errorMessage: err.message };
        }
    }
    for (const result of results) {
        if (result.result !== true && result.result !== false) {
            return { ignored: true, errorMessage: "Test returned non-boolean result" };
        }
    }
    return results;
}
/**
 * Generate an absolute XPath to an element.
 * @param node Node to compute XPath to element for
 * @param path path to append to the computed result
 */
function getXPath(node, path) {
    if (!path) {
        path = "";
    }
    if (node.nodeType === 1) {
        let count = 1;
        let sibling = node.previousSibling;
        while (sibling) {
            if (sibling.nodeType === 1 && sibling.nodeName === node.nodeName) {
                count++;
            }
            sibling = sibling.previousSibling;
        }
        path = "/" + node.nodeName + ("[" + (count || 1) + "]") + path;
    }
    else if (node.nodeType === 2) {
        path = "[@" + node.nodeName + "]" + path;
    }
    if (node.parentNode) {
        return getXPath(node.parentNode, path);
    }
    return path;
}
//# sourceMappingURL=testAssertion.js.map