declare module "@madie/madie-editor" {
  import { FC } from "react";
  import { LifeCycleFn } from "single-spa";

  export type EditorAnnotation = {
    row?: number;
    column?: number;
    text: string;
    type: string;
  };

  export interface Point {
    row: number;
    column: number;
  }
  export interface Range {
    start: Point;
    end: Point;
  }

  export type EditorErrorMarker = {
    range: Range;
    clazz: string;
    type: "text" | null;
  };

  export interface LineInfo {
    line: number;
    position: number;
  }

  export interface CqlError {
    text?: string;
    name?: string;
    start?: LineInfo;
    stop?: LineInfo;
    message: string;
  }

  export interface EditorPropsType {
    value: string;
    onChange?: (value: string) => void;
    onTerminologyChange?: (code: string) => void;
    parseDebounceTime?: number;
    inboundAnnotations?: EditorAnnotation[];
    inboundErrorMarkers?: EditorErrorMarker[];
    height?: string;
    validationsEnabled?: boolean;
    setOutboundAnnotations?: Function;
    readOnly?: boolean;
    measureStoreCql?: string;
    cqlMetaData?: CqlMetaData;
    measureModel?: string;

    // conditional props used to pass up annotations outside of the editor
    setOutboundAnnotations?: Function;
  }

  export type ElmTranslationError = {
    startLine: number;
    startChar: number;
    endChar: number;
    endLine: number;
    errorSeverity: string;
    errorType: string;
    message: string;
    targetIncludeLibraryId: string;
    targetIncludeLibraryVersionId: string;
    type: string;
  };
  export interface ElmTranslationExternalError extends ElmTranslationError {
    libraryId: string;
    libraryVersion: string;
  }
  export interface ValidationResult {
    translation: ElmTranslation;
    errors: ElmTranslationError[];
    externalErrors: ElmTranslationExternalError[];
  }
  export type ElmTranslation = {
    errorExceptions: ElmTranslationError[];
    externalErrors: any[];
    library: ElmTranslationLibrary;
  };
  export type ElmTranslationLibrary = {
    annotation: any[];
    contexts: any;
    identifier: any;
    parameters: any;
    schemaIdentifier: any;
    statements: any;
    usings: any;
    valueSets?: any;
  };

  export const parseContent: (content: string) => CqlError[];
  export const validateContent: (content: string) => Promise<ValidationResult>;
  export const synchingEditorCqlContent: (
    editorVal: string,
    existingCql: string,
    libraryName: string,
    existingCqlLibraryName: string,
    versionString: string,
    usingName: string,
    usingVersion: string,
    triggeredFrom: string
  ) => any;

  export function isUsingEmpty(editorVal: string): boolean;

  export const MadieTerminologyEditor: FC<EditorPropsType>;
  export const MadieEditor: FC<EditorPropsType>;

  export const bootstrap: LifeCycleFn<void>;
  export const mount: LifeCycleFn<void>;
  export const unmount: LifeCycleFn<void>;
}
