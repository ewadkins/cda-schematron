import * as hiddenXpath from "xpath";
export declare type XPathType = XPathExports.XString | XPathExports.XNumber | XPathExports.XNodeSet | XPathExports.XBoolean;
export interface XPathFunction {
    <R extends XPathType>(c: XPathExports.IXPathContext): R;
    <P0 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0): R;
    <P0 extends XPathType, P1 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P1): R;
    <P0 extends XPathType, P1 extends XPathType, P2 extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P2, p2: P2): R;
    <P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, ...r: P[]): R;
    <P0 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, ...r: P[]): R;
    <P0 extends XPathType, P1 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P1, ...r: P[]): R;
    <P0 extends XPathType, P1 extends XPathType, P2 extends XPathType, P extends XPathType, R extends XPathType>(c: XPathExports.IXPathContext, p0: P0, p1: P2, p2: P2, ...r: P[]): R;
}
export declare namespace XPathExports {
    interface INamespaceLookup {
        lookupNamespaceURI(prefix: string): string | null;
    }
    class NamespaceResolver {
        getNamespace(prefix: string, n: Node): string | null;
    }
    class FunctionResolver {
        addFunction(ns: string, ln: string, f: XPathFunction): void;
        addStandardFunctions(): void;
        getFunction(localName: string, namespace: string): XPathFunction | undefined;
    }
    interface IXPathContext {
        contextNode?: Node;
        contextSize?: number;
        contextPosition?: number;
        caseInsensitive?: boolean;
        allowAnyNamespaceForNoPrefix?: boolean;
    }
    interface IExpression {
        init(): void;
        toString(): string;
        evaluate(c?: IXPathContext): IExpression;
    }
    abstract class ITypeExpression implements IExpression {
        init(): void;
        toString(): string;
        evaluate(c?: IXPathContext): this;
        string(): XString;
        number(): XNumber;
        bool(): XBoolean;
        nodeset(): XNodeSet;
        stringValue(): string;
        numberValue(): number;
        booleanValue(): boolean;
        equals(r: ITypeExpression): XBoolean;
        notequal(r: ITypeExpression): XBoolean;
        lessthan(r: ITypeExpression): XBoolean;
        greaterthan(r: ITypeExpression): XBoolean;
        lessthanorequal(r: ITypeExpression): XBoolean;
        greaterthanorequal(r: ITypeExpression): XBoolean;
    }
    class XString extends ITypeExpression {
    }
    class XBoolean extends ITypeExpression {
    }
    class XNumber extends ITypeExpression {
    }
    class XNodeSet extends ITypeExpression {
    }
    function createExpression(e: string, r?: INamespaceLookup): XPathExpression;
}
declare const xpath: typeof XPathExports & typeof hiddenXpath;
export default xpath;
