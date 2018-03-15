import { XPathSelect } from "xpath";

export interface ITestAssertionResult {
    result: boolean;
    line: null | number;
    path: string;
    xml: string | null;
}

export interface ITestAssertionError {
    ignored: true;
    errorMessage: string;
}

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
export default function testAssertion(test: string, selected: Node[], select: XPathSelect,
                                      xmlDoc: Document, resourceDir: string, xmlSnippetMaxLength: number) {
    const results: ITestAssertionResult[] = [];

    for (const sel of selected) {
        try {
            const result = select("boolean(" + test + ")", sel, true) as boolean;
            let line = null;
            let xmlSnippet = null;
            if ((sel as any).lineNumber) {
                line = (sel as any).lineNumber;
                xmlSnippet = sel.toString();
            }
            const maxLength = (xmlSnippetMaxLength || 1e308);
            if (xmlSnippet && xmlSnippet.length > maxLength) {
                xmlSnippet = xmlSnippet.slice(0, maxLength) + "...";
            }
            results.push({ result, line, path: getXPath(sel), xml: xmlSnippet });
        } catch (err) {
            return { ignored: true, errorMessage: err.message } as ITestAssertionError;
        }
    }

    for (const result of results) {
        if (result.result !== true && result.result !== false) {
            return { ignored: true, errorMessage: "Test returned non-boolean result" } as ITestAssertionError;
        }
    }
    return results;
}

/**
 * Generate an absolute XPath to an element.
 * @param node Node to compute XPath to element for
 * @param path path to append to the computed result
 */
function getXPath(node: Node, path?: string): string {
    if (!path) {
        path = "";
    }

    if (node.nodeType === 1) {
        let count = 1;
        let sibling: Node | null = node.previousSibling;
        while (sibling) {
            if (sibling.nodeType === 1 && sibling.nodeName === node.nodeName) {
                count++;
            }
            sibling = sibling.previousSibling;
        }

        path = "/" + node.nodeName + ("[" + (count || 1) + "]") + path;
    } else if (node.nodeType === 2) {
        path = "[@" + node.nodeName + "]" + path;
    }

    if (node.parentNode) {
        return getXPath(node.parentNode, path);
    }
    return path;
}
