export declare function replaceTestWithExternalDocument(dom: {
    new (): DOMParser;
}, test: string, resourceDir: string): Promise<string>;
export declare function loadXML(dom: {
    new (): DOMParser;
}, relbase: string, reluri: string, loadStack?: string[]): Promise<Document>;
export declare function schematronIncludes(dom: {
    new (): DOMParser;
}, doc: Document, uri: string, loadStack?: string[]): Promise<Document>;
