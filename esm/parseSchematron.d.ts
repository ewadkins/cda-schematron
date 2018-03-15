export declare type IAssertionOrExtension = IAssertion | IExtension;
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
export interface IRuleAssertion {
    abstract: boolean;
    assertionsAndExtensions: IAssertionOrExtension[];
    context: null | string;
}
export interface IParsedSchematron {
    namespaceMap: Map<string, string>;
    patternRuleMap: Map<string, string[]>;
    ruleAssertionMap: Map<string, IRuleAssertion>;
}
export default function parseSchematron(doc: Document): {
    namespaceMap: Map<string, string>;
    patternRuleMap: Map<string, string[]>;
    ruleAssertionMap: Map<string, IRuleAssertion>;
};
