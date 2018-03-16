var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as xpath from "xpath";
const loadedExternalDocuments = new Map();
export function replaceTestWithExternalDocument(dom, test, resourceDir) {
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
            const filepath = matches[1].slice(1, -1);
            const externalDoc = yield loadXML(dom, resourceDir, filepath, []);
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
export function loadXML(dom, relbase, reluri, loadStack) {
    let uri = reluri;
    // resolve relative
    if (/^[^:\\\/#]+(?:\\|\/|#|$)/.test(uri)) {
        uri = "./" + uri;
    }
    if (/^\.\.?[\\\/]/.test(uri)) {
        let partbase = relbase.replace(/[^\\\/]+$/, "");
        let lastBase;
        let lastUri;
        do {
            do {
                lastUri = uri;
                uri = uri.replace(/^\.[\\\/]/, "");
            } while (lastUri !== uri);
            lastBase = partbase;
            if (/^\.\.[\\\/]/.test(uri)) {
                partbase = partbase.replace(/[^\\\/]+[\\\/]$/, "");
                uri = uri.substring(3);
            }
        } while (lastBase !== partbase || lastUri !== uri);
        uri = partbase + uri;
    }
    // check if circular
    let myLoadStack;
    if (!loadStack) {
        myLoadStack = [uri];
    }
    else {
        if (loadStack.indexOf(uri) !== -1) {
            throw new Error("Circular includes for file path: "
                + loadStack.map((s) => JSON.stringify(s)).join(" -> ") + " -> " + JSON.stringify(uri));
        }
        myLoadStack = [...loadStack, uri];
    }
    // load file content
    const lookupKey = (!loadStack ? "s" : "d") + uri;
    let prom = loadedExternalDocuments.get(lookupKey);
    if (prom) {
        return prom;
    }
    if (/^(?:https?|file):\/\//.test(uri)) {
        prom = loadXmlUrl(dom, uri);
    }
    else {
        prom = loadXmlFile(dom, uri);
    }
    if (loadStack) {
        prom = prom.then((doc) => schematronIncludes(dom, doc, uri, myLoadStack));
    }
    loadedExternalDocuments.set(lookupKey, prom);
    return prom;
}
function loadXmlUrl(dom, url) {
    return __awaiter(this, void 0, void 0, function* () {
        let f;
        if (typeof fetch === "undefined") {
            f = yield import("node-fetch").then((nf) => nf.default);
        }
        else {
            f = fetch;
        }
        return f(url).then((r) => r.text()).then((t) => {
            return new dom().parseFromString(t, "application/xml");
        });
    });
}
function loadXmlFile(dom, path) {
    return __awaiter(this, void 0, void 0, function* () {
        const { readFile } = yield import("fs");
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
export function schematronIncludes(dom, doc, uri, loadStack) {
    return __awaiter(this, void 0, void 0, function* () {
        const lstack = loadStack || [];
        const sel = xpath.useNamespaces({ sch: "http://purl.oclc.org/dsdl/schematron" });
        const includes = sel("//sch:include", doc).map((e) => {
            const href = e.getAttribute("href");
            if (!href) {
                return null;
            }
            return [e, href, loadXML(dom, uri, href, lstack)];
        }).filter((e) => Boolean(e));
        for (const [e, href, subdocP] of includes) {
            const subdoc = yield subdocP;
            const ins = doc.importNode(subdoc.documentElement, true);
            const comment = "sch:include(" + JSON.stringify(href) + ") ";
            const parent = e.parentNode;
            parent.insertBefore(doc.createComment(" BEGIN:" + comment), e);
            parent.insertBefore(ins, e);
            parent.insertBefore(doc.createComment(" END:" + comment), e);
            parent.removeChild(e);
        }
        return doc;
    });
}
//# sourceMappingURL=includeExternalDocument.js.map