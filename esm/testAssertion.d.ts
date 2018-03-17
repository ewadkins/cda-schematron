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
export default function testAssertion(test: string, selected: Node[], select: XPathSelect, xmlDoc: Document, resourceDir: string, xmlSnippetMaxLength: number): ITestAssertionError | ITestAssertionResult[];
