var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// jshint node:true
// jshint shadow:true
module.exports = modifyTest;
import { readFile } from "fs";
import { resolve as path_resolve } from "path";
import * as xpath from "xpath";
const loadedExternalDocuments = new Map();
export default function modifyTest(dom, test, resourceDir) {
    return __awaiter(this, void 0, void 0, function* () {
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
                }
                else if (test[i] === "[") {
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
                }
                else if (test[i] === "]") {
                    bracketDepth--;
                }
            }
            const predicate = test.slice(start, end);
            // Load external doc (load from "cache" if already loaded)
            const filepath = path_resolve(resourceDir, matches[1].slice(1, -1));
            let externalDocP = loadedExternalDocuments.get(filepath);
            if (!externalDocP) {
                externalDocP = loadXML(dom, filepath);
                loadedExternalDocuments.set(filepath, externalDocP);
            }
            const externalDoc = yield externalDocP;
            const externalXpath = test.slice(equalInd + matches[0].length, end);
            // Extract namespaces
            const defaultNamespaceKey = (/([^(<>.\/)]+):[^(<>.\/)]+/.exec(externalXpath) || [])[1];
            const namespaceMap = {};
            const docattrs = Array.from(externalDoc.documentElement.attributes);
            for (const attr of docattrs) {
                if (attr.nodeName === "xmlns") {
                    namespaceMap[defaultNamespaceKey] = attr.nodeValue;
                }
                else if (attr.prefix === "xmlns") {
                    namespaceMap[attr.prefix] = attr.nodeValue;
                }
            }
            const externalSelect = xpath.useNamespaces(namespaceMap);
            // Create new predicate from extract values
            const values = [];
            const externalResults = externalSelect(externalXpath, externalDoc);
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
    });
}
function loadXML(dom, path) {
    return __awaiter(this, void 0, void 0, function* () {
        let externalXml = null;
        try {
            externalXml = yield new Promise((s, r) => {
                readFile(path, "utf-8", (err, data) => {
                    if (err) {
                        r(err);
                    }
                    else {
                        s(data);
                    }
                });
            });
        }
        catch (err) {
            const ne = new Error("No such file '" + path + "'");
            ne.innerError = err;
            throw ne;
        }
        return new dom().parseFromString(externalXml, "application/xml");
    });
}
//# sourceMappingURL=includeExternalDocument.js.map