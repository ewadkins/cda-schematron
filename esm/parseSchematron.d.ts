export interface IDescriptionName {
    tag: "name";
}
export interface IDescriptionValueOf {
    tag: "value-of";
}
export declare type IDescription = string | IDescriptionName | IDescriptionValueOf;
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
    description: IDescription[];
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
export default function parseSchematron(doc: Document): IParsedSchematron;
