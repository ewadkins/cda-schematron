export default function modifyTest(dom: {
    new (): DOMParser;
}, test: string, resourceDir: string): Promise<string>;
