
// tslint:disable:max-classes-per-file

import * as hiddenXpath from "xpath";
import { SelectedValue, XPathSelect } from "xpath";

export type XPathType = XPathExports.XString | XPathExports.XNumber | XPathExports.XNodeSet | XPathExports.XBoolean;

// tslint:disable-next-line:interface-name
export interface XPathFunction {
    <R extends XPathType>(c: XPathExports.IXPathContext): R;
    <P0 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0): R;
    <P0 extends XPathType, P1 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P1): R;
    // tslint:disable-next-line:max-line-length
    <P0 extends XPathType, P1 extends XPathType, P2 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P2, p2: P2): R;

    <P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, ...r: P[]): R;
    // tslint:disable-next-line:max-line-length
    <P0 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, ...r: P[]): R;
    // tslint:disable-next-line:max-line-length
    <P0 extends XPathType, P1 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P1, ...r: P[]): R;
    // tslint:disable-next-line:max-line-length
    <P0 extends XPathType, P1 extends XPathType, P2 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P2, p2: P2, ...r: P[]): R;
}

// tslint:disable-next-line:no-namespace
export declare namespace XPathExports {
    export interface INamespaceLookup {
        lookupNamespaceURI(prefix: string): string | null;
    }

    export class NamespaceResolver {
        public getNamespace(prefix: string, n: Node): string | null;
    }

    export class FunctionResolver {
        public addFunction(ns: string, ln: string, f: XPathFunction): void;
        public addStandardFunctions(): void;
        public getFunction(localName: string, namespace: string): XPathFunction | undefined;
    }

    export interface IXPathContext {
        contextNode?: Node;
        contextSize?: number;
        contextPosition?: number;
        caseInsensitive?: boolean;
        allowAnyNamespaceForNoPrefix?: boolean;
    }

    export interface IExpression {
        init(): void;
        toString(): string;
        evaluate(c?: IXPathContext): IExpression;
    }

    export abstract class ITypeExpression implements IExpression {
        public init(): void;
        public toString(): string;
        public evaluate(c?: IXPathContext): this;

        public string(): XString;
        public number(): XNumber;
        public bool(): XBoolean;
        public nodeset(): XNodeSet;
        public stringValue(): string;
        public numberValue(): number;
        public booleanValue(): boolean;
        public equals(r: ITypeExpression): XBoolean;
        public notequal(r: ITypeExpression): XBoolean;
        public lessthan(r: ITypeExpression): XBoolean;
        public greaterthan(r: ITypeExpression): XBoolean;
        public lessthanorequal(r: ITypeExpression): XBoolean;
        public greaterthanorequal(r: ITypeExpression): XBoolean;
    }

    export class XString extends ITypeExpression {}
    export class XBoolean extends ITypeExpression {}
    export class XNumber extends ITypeExpression {}
    export class XNodeSet extends ITypeExpression {}

    export function createExpression(e: string, r?: INamespaceLookup): XPathExpression;
}

const xpath = hiddenXpath as (typeof XPathExports) & (typeof hiddenXpath);

const xsString = ((c: XPathExports.IXPathContext, d: XPathType) => d.evaluate(c).string()) as XPathFunction;
const xsNumber = ((c: XPathExports.IXPathContext, d: XPathType) => d.evaluate(c).number()) as XPathFunction;
const xsBoolean = ((c: XPathExports.IXPathContext, d: XPathType) => d.evaluate(c).bool()) as XPathFunction;

const xsFuncs = new Map<string, XPathFunction>([
    ["boolean",      xsBoolean],
    ["decimal",      xsNumber],
    ["double",       xsNumber],
    ["float",        xsNumber],
    ["gDay",         xsNumber],
    ["gMonth",       xsNumber],
    ["gYear",        xsNumber],
    ["gYearMonth",   xsString],
    ["gMonthDay",    xsString],
    ["string",       xsString],
    ["date",         xsString],
    ["dateTime",     xsString],
    ["time",         xsString],
    ["duration",     xsString],
    ["hexBinary",    xsString],
    ["base64Binary", xsString],
    ["anyURI",       xsString],
    ["QName",        xsString],
    ["NOTATION",     xsString],
]);

const stdResolveFunction = xpath.FunctionResolver.prototype.getFunction;
xpath.FunctionResolver.prototype.getFunction =
  function getFunction(this: XPathExports.FunctionResolver, localName: string, namespace: string) {
    const r = stdResolveFunction.call(this, localName, namespace);
    // tslint:disable-next-line:max-line-length
    if (!r && (namespace === "http://www.w3.org/2001/XMLSchema-datatypes" || namespace === "http://www.w3.org/2001/XMLSchema")) {
        return xsFuncs.get(localName) || undefined;
    }
    return r;
};

export default xpath;
