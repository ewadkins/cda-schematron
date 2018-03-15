// jshint node:true
// jshint shadow:true
module.exports = modifyTest;

import { readFile } from "fs";
import { resolve as path_resolve } from "path";

import * as xpath from "xpath";

const loadedExternalDocuments = new Map<string, Promise<Document>>();

export default async function modifyTest(dom: { new(): DOMParser; }, test: string, resourceDir: string) {

    let matches = /=document\((\'[-_.A-Za-z0-9]+\'|\"[-_.A-Za-z0-9]+\")\)/.exec(test);
    while (matches) {

        // String processing to select the non-regular predicate expression
        const equalInd = test.indexOf(matches[0]);
        let start = equalInd;
        let bracketDepth = 0;
        for (let i = equalInd; i >= 0; i--) {
            if (!bracketDepth && (test[i] === "[" || test[i] === " ")) {
                start = i + 1;
                break;
            }
            if (test[i] === "]") {
                bracketDepth++;
            } else if (test[i] === "[") {
                bracketDepth--;
            }
        }

        let end = test.length;
        bracketDepth = 0;
        for (let i = start + matches[0].length; i < test.length; i++) {
            if (!bracketDepth && (test[i] === "]" || test[i] === " ")) {
                end = i;
                break;
            }
            if (test[i] === "[") {
                bracketDepth++;
            } else if (test[i] === "]") {
                bracketDepth--;
            }
        }

        const predicate = test.slice(start, end);

        // Load external doc (load from "cache" if already loaded)
        const filepath = path_resolve(resourceDir, matches[1].slice(1, -1));
        let externalDocP = loadedExternalDocuments.get(filepath) as Promise<Document>;
        if (!externalDocP) {
            externalDocP = loadXML(dom, filepath);
            loadedExternalDocuments.set(filepath, externalDocP);
        }
        const externalDoc = await externalDocP;

        const externalXpath = test.slice(equalInd + matches[0].length, end);

        // Extract namespaces
        const defaultNamespaceKey = (/([^(<>.\/)]+):[^(<>.\/)]+/.exec(externalXpath) || [])[1];
        const namespaceMap: { [k: string]: string; } = {};
        const docattrs = Array.from(externalDoc.documentElement.attributes);
        for (const attr of docattrs) {
            if (attr.nodeName === "xmlns") {
                namespaceMap[defaultNamespaceKey] = attr.nodeValue as string;
            } else if (attr.prefix === "xmlns") {
                namespaceMap[attr.prefix] = attr.nodeValue as string;
            }
        }

        const externalSelect = xpath.useNamespaces(namespaceMap);

        // Create new predicate from extract values
        const values: string[] = [];
        const externalResults = externalSelect(externalXpath, externalDoc) as Attr[];
        for (const extres of externalResults) {
            values.push(extres.value);
        }
        const lhv = predicate.slice(0, predicate.indexOf("=document("));
        const newPredicate = "(" + values.map((val) => lhv + "='" + val + "'").join(" or ") + ")";

        // Replace test
        test = test.slice(0, start) + newPredicate + test.slice(end);

        matches = /@[^\[\]]+=document\((\'[-_.A-Za-z0-9]+\'|\"[-_.A-Za-z0-9]+\")\)/.exec(test);
    }

    return test;
}

async function loadXML(dom: { new(): DOMParser; }, path: string) {
    let externalXml = null;
    try {
        externalXml = await new Promise<string>((s, r) => {
            readFile(path, "utf-8", (err, data) => {
                if (err) {
                    r(err);
                } else {
                    s(data);
                }
            });
        });
    } catch (err) {
        const ne = new Error("No such file '" + path + "'");
        (ne as any).innerError = err;
        throw ne;
    }
    return new dom().parseFromString(externalXml, "application/xml");
}
