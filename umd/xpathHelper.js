"use strict";
// tslint:disable:max-classes-per-file
Object.defineProperty(exports, "__esModule", { value: true });
const hiddenXpath = require("xpath");
const xpath = hiddenXpath;
const xsString = ((d) => d.evaluate().string());
const xsNumber = ((d) => d.evaluate().number());
const xsFuncs = new Map([
    ["boolean", ((d) => d.evaluate().bool())],
    ["decimal", xsNumber],
    ["double", xsNumber],
    ["float", xsNumber],
    ["gDay", xsNumber],
    ["gMonth", xsNumber],
    ["gYear", xsNumber],
    ["gYearMonth", xsString],
    ["gMonthDay", xsString],
    ["string", xsString],
    ["date", xsString],
    ["dateTime", xsString],
    ["time", xsString],
    ["duration", xsString],
    ["hexBinary", xsString],
    ["base64Binary", xsString],
    ["anyURI", xsString],
    ["QName", xsString],
    ["NOTATION", xsString],
]);
const stdResolveFunction = xpath.FunctionResolver.prototype.getFunction;
xpath.FunctionResolver.prototype.getFunction =
    function getFunction(localName, namespace) {
        const r = stdResolveFunction.call(this, localName, namespace);
        // tslint:disable-next-line:max-line-length
        if (!r && (namespace === "http://www.w3.org/2001/XMLSchema-datatypes" || namespace === "http://www.w3.org/2001/XMLSchema")) {
            return xsFuncs.get(localName) || undefined;
        }
        return r;
    };
exports.default = xpath;
//# sourceMappingURL=xpathHelper.js.map