import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import "styled-components/macro";
import {
  EditorAnnotation,
  EditorErrorMarker,
  MadieEditor,
  parseContent,
} from "@madie/madie-editor";
import { Button } from "@madie/madie-components";
import useCurrentMeasure from "../editMeasure/useCurrentMeasure";
import { Measure } from "@madie/madie-models";
import {
  CqlAntlr,
  CqlCode,
  CqlCodeSystem,
} from "@madie/cql-antlr-parser/dist/src";
import useMeasureServiceApi from "../../api/useMeasureServiceApi";
import useTerminologyServiceApi from "../../api/useTerminologyServiceApi";
import tw from "twin.macro";
import * as _ from "lodash";
import useElmTranslationServiceApi, {
  ElmTranslation,
  ElmTranslationError,
  ElmValueSet,
} from "../../api/useElmTranslationServiceApi";
import CqlResult from "@madie/cql-antlr-parser/dist/src/dto/CqlResult";
import { mapCodeSystemErrorsToTranslationErrors } from "./measureEditorUtils";
import { useOktaTokens } from "@madie/madie-util";

const MessageText = tw.p`text-sm font-medium`;
const SuccessText = tw(MessageText)`text-green-800`;
const ErrorText = tw(MessageText)`text-red-800`;
const UpdateAlerts = tw.div`mb-2 h-5`;
const EditorActions = tw.div`mt-2 ml-2 mb-5 space-y-5`;

export const mapErrorsToAceAnnotations = (
  errors: ElmTranslationError[],
  type: string
): EditorAnnotation[] => {
  let annotations: EditorAnnotation[] = [];
  if (errors && _.isArray(errors) && errors.length > 0) {
    annotations = errors.map((error: ElmTranslationError) => ({
      row: error.startLine - 1,
      column: error.startChar,
      type: error.errorSeverity.toLowerCase(),
      text: `${type}: ${error.startChar}:${error.endChar} | ${error.message}`,
    }));
  }
  return annotations;
};

export const mapErrorsToAceMarkers = (
  errors: ElmTranslationError[]
): EditorErrorMarker[] => {
  let markers: EditorErrorMarker[] = [];
  if (errors && _.isArray(errors) && errors.length > 0) {
    markers = errors.map((error) => ({
      range: {
        start: {
          row: error.startLine - 1,
          column: error.startChar,
        },
        end: {
          row: error.endLine - 1,
          column: error.endChar,
        },
      },
      clazz: "editor-error-underline",
      type: "text",
    }));
  }
  return markers;
};

// customCqlCode contains validation result from VSAC
// This object can be cached in future, to avoid calling VSAC everytime.
export interface CustomCqlCodeSystem extends CqlCodeSystem {
  valid?: boolean;
  errorMessage?: string;
}
export interface CustomCqlCode extends Omit<CqlCode, "codeSystem"> {
  codeSystem: CustomCqlCodeSystem;
  valid?: boolean;
  errorMessage?: string;
}

const MeasureEditor = () => {
  const { measure, setMeasure } = useCurrentMeasure();
  // we need a variable to prevent superflous useEffect triggers
  const [firstLoad, setFirstLoad] = useState<boolean>(true);
  const [editorVal, setEditorVal]: [string, Dispatch<SetStateAction<string>>] =
    useState("");
  const measureServiceApi = useMeasureServiceApi();
  const elmTranslationServiceApi = useElmTranslationServiceApi();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [elmTranslationError, setElmTranslationError] = useState(null);
  // annotations control the gutter error icons.
  const [elmAnnotations, setElmAnnotations] = useState<EditorAnnotation[]>([]);
  // error markers control the error underlining in the editor.
  const [errorMarkers, setErrorMarkers] = useState<EditorErrorMarker[]>([]);

  const { getUserName } = useOktaTokens();
  const userName = getUserName();
  const canEdit = userName === measure.createdBy;
  const terminologyServiceApi = useTerminologyServiceApi();
  const [valuesetMsg, setValuesetMsg] = useState(null);

  const getValueSetErrors = async (
    valuesetsArray: ElmValueSet[]
  ): Promise<ElmTranslationError[]> => {
    const valuesetsErrorArray: ElmTranslationError[] = [];
    if (valuesetsArray) {
      await Promise.allSettled(
        valuesetsArray.map(async (valueSet) => {
          const oid = getOid(valueSet);
          await terminologyServiceApi
            .getValueSet(oid, valueSet.locator)
            .then((response) => {
              if (response.errorMsg) {
                const vsErrorForElmTranslationError: ElmTranslationError =
                  processValueSetErrorForElmTranslationError(
                    response.errorMsg.toString(),
                    valueSet.locator
                  );
                valuesetsErrorArray.push(vsErrorForElmTranslationError);
              }
            });
        })
      );
      return valuesetsErrorArray;
    }
  };
  const checkLogin = async (): Promise<Boolean> => {
    let isLoggedIn = false;
    await terminologyServiceApi
      .checkLogin()
      .then(() => {
        isLoggedIn = true;
      })
      .catch((err) => {
        isLoggedIn = false;
      });
    return isLoggedIn;
  };

  const getOid = (valueSet: ElmValueSet): string => {
    return valueSet.id.split("ValueSet/")[1];
  };

  const getStartLine = (locator: string): number => {
    const index = locator.indexOf(":");
    const startLine = locator.substring(0, index);
    return Number(startLine);
  };

  const getStartChar = (locator: string): number => {
    const index = locator.indexOf(":");
    const index2 = locator.indexOf("-");
    const startChar = locator.substring(index + 1, index2);
    return Number(startChar);
  };

  const getEndLine = (locator: string): number => {
    const index = locator.indexOf("-");
    const endLineAndChar = locator.substring(index + 1);
    const index2 = locator.indexOf(":");
    const endLine = endLineAndChar.substring(0, index2);
    return Number(endLine);
  };

  const getEndChar = (locator: string): number => {
    const index = locator.indexOf("-");
    const endLineAndChar = locator.substring(index + 1);
    const index2 = locator.indexOf(":");
    const endLine = endLineAndChar.substring(index2 + 1);
    return Number(endLine);
  };

  const processValueSetErrorForElmTranslationError = (
    vsError: string,
    valuesetLocator: string
  ): ElmTranslationError => {
    const startLine: number = getStartLine(valuesetLocator);
    const startChar: number = getStartChar(valuesetLocator);
    const endLine: number = getEndLine(valuesetLocator);
    const endChar: number = getEndChar(valuesetLocator);
    return {
      startLine: startLine,
      startChar: startChar,
      endChar: endChar,
      endLine: endLine,
      errorSeverity: "Error",
      errorType: "ValueSet",
      message: vsError,
      targetIncludeLibraryId: "",
      targetIncludeLibraryVersionId: "",
      type: "ValueSet",
    };
  };

  const getCustomCqlCodes = (cql: string): CustomCqlCode[] => {
    // using Antlr to get cqlCodes & cqlCodeSystems
    // Constructs a list of CustomCqlCode objects, which are validated in terminology service
    const cqlResult: CqlResult = new CqlAntlr(cql).parse();
    return cqlResult?.codes?.map((code) => {
      return {
        ...code,
        codeSystem: cqlResult.codeSystems?.find(
          (codeSys) => codeSys.name === code.codeSystem
        ),
      };
    });
  };

  const getVsacErrorAnnotationAndMarkers = (
    codeSystemCqlErrors: ElmTranslationError[]
  ) => {
    let vsacErrorsAnnotations: EditorAnnotation[] = [];
    let vsacErrorMarkers: EditorErrorMarker[] = [];
    if (codeSystemCqlErrors && codeSystemCqlErrors.length > 0) {
      vsacErrorsAnnotations = mapErrorsToAceAnnotations(
        codeSystemCqlErrors,
        "VSAC"
      );
      vsacErrorMarkers = mapErrorsToAceMarkers(codeSystemCqlErrors);
    }
    return { vsacErrorsAnnotations, vsacErrorMarkers };
  };

  const updateElmAnnotations = async (cql: string): Promise<ElmTranslation> => {
    setElmTranslationError(null);
    if (cql && cql.trim().length > 0) {
      const customCqlCodes: CustomCqlCode[] = getCustomCqlCodes(cql);
      const isLoggedIn = await Promise.resolve(checkLogin());
      const [validatedCodes, translationResults] = await Promise.all([
        await terminologyServiceApi.validateCodes(
          customCqlCodes,
          isLoggedIn.valueOf()
        ),
        await elmTranslationServiceApi.translateCqlToElm(cql),
      ]);
      const codeSystemCqlErrors =
        mapCodeSystemErrorsToTranslationErrors(validatedCodes);

      const { vsacErrorsAnnotations, vsacErrorMarkers } =
        getVsacErrorAnnotationAndMarkers(codeSystemCqlErrors);

      let allErrorsArray: ElmTranslationError[] =
        translationResults?.errorExceptions
          ? translationResults?.errorExceptions
          : [];

      let valuesetsErrors = null;

      if (translationResults.library?.valueSets?.def !== null && isLoggedIn) {
        valuesetsErrors = await getValueSetErrors(
          translationResults.library?.valueSets?.def
        );
      }

      if (valuesetsErrors && valuesetsErrors.length > 0) {
        valuesetsErrors.map((valueSet) => {
          allErrorsArray.push(valueSet);
        });
      } else {
        if (!isLoggedIn) {
          setValuesetMsg("Please log in to UMLS!");
        } else if (translationResults.library?.valueSets) {
          setValuesetMsg("Value Set is valid!");
        }
      }

      // errorExceptions contains error data for the primary library,
      // aka the CQL loaded into the editor. Errors from included
      // libraries are available in data.annotations.errors, if needed.
      let annotations = mapErrorsToAceAnnotations(allErrorsArray, "ELM");
      annotations = [...annotations, ...vsacErrorsAnnotations];
      let errorMarkers = mapErrorsToAceMarkers(allErrorsArray);
      errorMarkers = [...errorMarkers, ...vsacErrorMarkers];

      setElmAnnotations(annotations);
      setErrorMarkers(errorMarkers);
      return translationResults;
    } else {
      setElmAnnotations([]);
    }
    return null;
  };

  const hasParserErrors = async (val) => {
    return !!(parseContent(val)?.length > 0);
  };

  const updateMeasureCql = async () => {
    try {
      const results = await Promise.allSettled([
        updateElmAnnotations(editorVal),
        hasParserErrors(editorVal),
      ]);

      if (results[0].status === "rejected") {
        console.error(
          "An error occurred while translating CQL to ELM",
          results[0].reason
        );
        setElmTranslationError(
          "Unable to translate CQL to ELM, CQL was not saved!"
        );
        setElmAnnotations([]);
      } else if (results[1].status === "rejected") {
        const rejection: PromiseRejectedResult = results[1];
        console.error(
          "An error occurred while parsing the CQL",
          rejection.reason
        );
      } else {
        const cqlElmResult = results[0].value;
        const parseErrors = results[1].value;

        const cqlElmErrors = !!(cqlElmResult?.errorExceptions?.length > 0);
        if (editorVal !== measure.cql) {
          const cqlErrors = parseErrors || cqlElmErrors;
          const newMeasure: Measure = {
            ...measure,
            cql: editorVal,
            elmJson: JSON.stringify(cqlElmResult),
            cqlErrors,
          };
          measureServiceApi
            .updateMeasure(newMeasure)
            .then(() => {
              setMeasure(newMeasure);
              setSuccess(true);
            })
            .catch((reason) => {
              console.error(reason);
              setError(true);
            });
        }
      }
    } catch (err) {
      console.error(
        "An error occurred while parsing CQL and translating CQL to ELM",
        err
      );
      setElmTranslationError(
        "Unable to parse CQL and translate CQL to ELM, CQL was not saved!"
      );
      setElmAnnotations([]);
    }
  };

  const handleMadieEditorValue = (val: string) => {
    setSuccess(false);
    setError(false);
    setEditorVal(val);
    setValuesetMsg(null);
  };

  const resetCql = (): void => {
    setEditorVal(measure.cql || "");
  };

  useEffect(() => {
    if (!editorVal && firstLoad) {
      setFirstLoad(false);
      updateElmAnnotations(measure.cql).catch((err) => {
        console.error("An error occurred while translating CQL to ELM", err);
        setElmTranslationError("Unable to translate CQL to ELM!");
        setElmAnnotations([]);
      });
      setEditorVal(measure.cql);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorVal, firstLoad]);

  return (
    <>
      <MadieEditor
        onChange={(val: string) => handleMadieEditorValue(val)}
        value={editorVal}
        inboundAnnotations={elmAnnotations}
        inboundErrorMarkers={errorMarkers}
        height={"1000px"}
        readOnly={!canEdit}
      />
      <EditorActions data-testid="measure-editor-actions">
        <UpdateAlerts data-testid="update-cql-alerts">
          {success && (
            <SuccessText data-testid="save-cql-success">
              CQL saved successfully
            </SuccessText>
          )}
          {valuesetMsg && (
            <SuccessText data-testid="valueset-success">
              {valuesetMsg}
            </SuccessText>
          )}
          {error && (
            <ErrorText data-testid="save-cql-error">
              Error updating the CQL
            </ErrorText>
          )}
        </UpdateAlerts>
        <UpdateAlerts data-testid="elm-translation-alerts">
          {elmTranslationError && (
            <ErrorText data-testid="elm-translation-error">
              {elmTranslationError}
            </ErrorText>
          )}
        </UpdateAlerts>
        {canEdit && (
          <>
            <Button
              buttonSize="md"
              buttonTitle="Save"
              variant="primary"
              onClick={() => updateMeasureCql()}
              data-testid="save-cql-btn"
            />
            <Button
              tw="ml-2"
              buttonSize="md"
              buttonTitle="Cancel"
              variant="secondary"
              onClick={() => resetCql()}
              data-testid="reset-cql-btn"
            />
          </>
        )}
      </EditorActions>
    </>
  );
};

export default MeasureEditor;
