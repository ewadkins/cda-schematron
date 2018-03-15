import { ITestAssertionError } from "./testAssertion";
export interface IValidateOptions {
    /**
     * This determines whether or not warnings should be tested and returned.
     * Defaults to true.
     */
    includeWarnings: boolean;
    /**
     * The path to a directory containing resource files (eg. voc.xml) which may be necessary for some schematron tests.
     * Defaults to './', the current directory.
     */
    resourceDir: string;
    /**
     * An integer, which is the maximum length of the xml field in validation results.
     * Defaults to 200. Set to 0 for unlimited length.
     */
    xmlSnippetMaxLength: number;
}
export declare function clearCache(): void;
export interface IValidationResult {
    type: "error" | "warning";
    test: string;
    simplifiedTest: string | null;
    description: string;
    line: number | null;
    path: string;
    patternId: string;
    ruleId: string;
    assertionId: string;
    context: string;
    xml: string | null;
}
export declare function validate(xml: string, schematron: string, options?: Partial<IValidateOptions>): Promise<{
    errorCount: number;
    errors: IValidationResult[];
    ignored: ({
        assertionId: string;
        context: string;
        errorMessage: string;
        patternId: string;
        ruleId: string;
        simplifiedTest: string | null;
        test: string;
        type: "error" | "warning";
    } | {
        assertionId: string;
        context: string;
        errorMessage: ITestAssertionError;
        patternId: string;
        ruleId: string;
        simplifiedTest: string | null;
        test: string;
        type: "error" | "warning";
    })[];
    ignoredCount: number;
    warningCount: number;
    warnings: IValidationResult[];
}>;
