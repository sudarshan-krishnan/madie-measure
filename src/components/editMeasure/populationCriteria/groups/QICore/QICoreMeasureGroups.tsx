import React, { useEffect, useCallback, useState } from "react";
import { useMatch, useLocation, useNavigate } from "react-router-dom";
import tw, { styled } from "twin.macro";
import * as ucum from "@lhncbc/ucum-lhc";
import "styled-components/macro";
import {
  Measure,
  Group,
  GroupScoring,
  PopulationType,
  MeasureErrorType,
  MeasureGroupTypes,
  MeasureScoring,
} from "@madie/madie-models";
import { MenuItem as MuiMenuItem, Typography, Divider } from "@mui/material";
import { CqlAntlr } from "@madie/cql-antlr-parser/dist/src";
import {
  AutoComplete,
  Button,
  MadieDiscardDialog,
  Select,
  DSLink,
  Toast,
  Tab,
  Tabs,
  TextArea,
} from "@madie/madie-design-system/dist/react";
import { useFormik, FormikProvider, FieldArray, Field, getIn } from "formik";
import useMeasureServiceApi from "../../../../../api/useMeasureServiceApi";
import { v4 as uuidv4 } from "uuid";
import {
  measureGroupSchemaValidator,
  CqlDefineDataTypes,
  CqlFunctionDataTypes,
} from "../../../../../validations/MeasureGroupSchemaValidator";
import {
  measureStore,
  routeHandlerStore,
  useDocumentTitle,
  checkUserCanEdit,
} from "@madie/madie-util";
import MeasureGroupsWarningDialog from "../MeasureGroupWarningDialog";
import {
  allPopulations,
  getPopulationsForScoring,
} from "../../PopulationHelper";
import GroupPopulation from "../groupPopulations/GroupPopulation";
import MeasureGroupObservation from "../observation/MeasureGroupObservation";
import MeasureGroupScoringUnit from "../scoringUnit/MeasureGroupScoringUnit";
import * as _ from "lodash";
import MeasureGroupAlerts from "../MeasureGroupAlerts";
import AddRemovePopulation from "../groupPopulations/AddRemovePopulation";
import GroupsDescription from "../GroupsDescription";
import MultipleSelectDropDown from "../../MultipleSelectDropDown";
// import Add
import camelCaseConverter from "../../../../../utils/camelCaseConverter";

import "../../../../common/madie-link.scss";
import "../MeasureGroups.scss"; //247-249,387,400,430,438,476,903-907,1003-1008
import {
  ButtonSpacer,
  FormFieldInner,
  FieldInput,
  FieldLabel,
  FieldSeparator,
  MenuItemContainer,
} from "../../../../../styles/editMeasure/populationCriteria/groups/index";

interface ColSpanPopulationsType {
  isExclusionPop?: boolean;
  isSecondInitialPopulation?: boolean;
  children?: any;
}

const ColSpanPopulations = (props: ColSpanPopulationsType) => {
  return (
    <div
      className={
        props.isSecondInitialPopulation || props.isExclusionPop
          ? "second"
          : "first"
      }
    >
      {props.children}
    </div>
  );
};

const deleteToken = "FDE8472A-6095-4292-ABF7-E35AD435F05F"; // randomly generated token for deleting

// provides dropdown options for Improvement Notation
const improvementNotationOptions = [
  {
    label: "-",
    value: "",
    subtitle: null,
    code: null,
  },
  {
    label: "Increased score indicates improvement",
    value: "Increased score indicates improvement",
    subtitle:
      "Improvement is indicated as an increase in the score or measurement (e.g. Higher score indicates better quality).",
    code: "increase",
  },
  {
    label: "Decreased score indicates improvement",
    value: "Decreased score indicates improvement",
    subtitle:
      "Improvement is indicated as a decrease in the score or measurement (e.g. Lower score indicates better quality).",
    code: "decrease",
  },
];

// default value for any association is Initial population
// TODO: figure out why it is being called on every rerender
const getEmptyStrat = () => ({
  cqlDefinition: "",
  description: "",
  association: PopulationType.INITIAL_POPULATION,
  id: uuidv4(),
});

export const deleteStrat = {
  cqlDefinition: "delete",
  description: deleteToken,
  association: PopulationType.INITIAL_POPULATION,
  id: "",
};

// provides dropdown options for stratification association
const associationSelect = {
  Proportion: [
    PopulationType.INITIAL_POPULATION,
    PopulationType.DENOMINATOR,
    PopulationType.DENOMINATOR_EXCLUSION,
    PopulationType.NUMERATOR,
    PopulationType.NUMERATOR_EXCLUSION,
    PopulationType.DENOMINATOR_EXCEPTION,
  ],
  "Continuous Variable": [
    PopulationType.INITIAL_POPULATION,
    PopulationType.MEASURE_POPULATION,
    PopulationType.MEASURE_POPULATION_EXCLUSION,
  ],
  Cohort: [PopulationType.INITIAL_POPULATION],
  Ratio: [],
};

export interface ExpressionDefinition {
  expression?: string;
  expressionClass?: string;
  name?: string;
  start?: object;
  stop?: object;
  text?: string;
}

export interface DeleteMeasureGroupDialog {
  open?: boolean;
  measureGroupNumber?: number;
}

export interface MeasureGroupProps {
  measureGroupNumber?: number;
  setMeasureGroupNumber?: (value: number) => void;
  setIsFormDirty?: (value: boolean) => void;
  measureId?: string;
}

const INITIAL_ALERT_MESSAGE = {
  type: undefined,
  message: undefined,
  canClose: false,
};

const MeasureGroups = (props: MeasureGroupProps) => {
  useDocumentTitle("MADiE Edit Measure Population Criteria");
  const defaultPopulationBasis = "boolean";
  const [expressionDefinitions, setExpressionDefinitions] = useState<
    Array<ExpressionDefinition>
  >([]);
  const { updateMeasure } = measureStore;
  const [measure, setMeasure] = useState<Measure>(measureStore.state);
  useEffect(() => {
    const subscription = measureStore.subscribe(setMeasure);
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const [refreshFlag, setRefreshFlag] = useState<boolean>(true);

  const canEdit = checkUserCanEdit(
    measure?.measureSet?.owner,
    measure?.measureSet?.acls,
    measure?.measureMetaData?.draft
  );
  const measureServiceApi = useMeasureServiceApi();
  let location = useLocation();
  const { pathname } = location;

  const [alertMessage, setAlertMessage] = useState({
    ...INITIAL_ALERT_MESSAGE,
  });

  // toast utilities
  // toast is only used for success messages
  // creating and updating PC
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<string>("danger");
  const onToastClose = () => {
    setToastType("danger");
    setToastMessage("");
    setToastOpen(false);
  };
  const handleToast = (type, message, open) => {
    setToastType(type);
    setToastMessage(message);
    setToastOpen(open);
  };

  const groupsBaseUrl = "/measures/" + props.measureId + "/edit/groups";
  let navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("populations");
  const measureGroupNumber =
    props.measureGroupNumber - 1 < 0 ? 0 : props.measureGroupNumber;
  const [group, setGroup] = useState<Group>();
  const [groupWarningDialogProps, setGroupWarningDialogProps] = useState({
    open: false,
    modalType: null,
  });
  const [deleteMeasureGroupDialog, setDeleteMeasureGroupDialog] =
    useState<DeleteMeasureGroupDialog>({
      open: false,
      measureGroupNumber: undefined,
    });

  const [visibleStrats, setVisibleStrats] = useState<number>(2);
  useEffect(() => {
    if (addStratClicked && visibleStrats > 2) {
      document
        .getElementById(`Stratification-select-${visibleStrats}`)
        ?.focus();
      setAddStratClicked(false);
    }
  }, [visibleStrats]);

  // Todo option should be an Array when passing to AutoComplete.
  // warning during test cases
  const [addStratClicked, setAddStratClicked] = useState(false);
  const [populationBasisValues, setPopulationBasisValues] =
    useState<string[]>();
  const [associationChanged, setAssociationChanged] = useState(false);

  const [cqlDefinitionDataTypes, setCqlDefinitionDataTypes] =
    useState<CqlDefineDataTypes>();
  const [cqlFunctionDataTypes, setCqlFunctionDataTypes] =
    useState<CqlFunctionDataTypes>();

  const goBackToNav = (e) => {
    if (e.shiftKey && e.keyCode == 9) {
      e.preventDefault();
      document.getElementById(measureGroupNumber.toString()).focus();
    }
  };

  useEffect(() => {
    setCqlFunctionDataTypes(
      measureServiceApi.getReturnTypesForAllCqlFunctions(measure?.elmJson)
    );
    setCqlDefinitionDataTypes(
      measureServiceApi.getReturnTypesForAllCqlDefinitions(measure?.elmJson)
    );
  }, [measure?.elmJson]);

  useEffect(() => {
    if (measure?.groups && measure?.groups[measureGroupNumber]) {
      // manually sort group populations in existing groups on retrieval
      const group = measure?.groups[measureGroupNumber];
      group.populations.sort((a, b) => {
        return (
          allPopulations.findIndex((all) => all.name === a.name) -
          allPopulations.findIndex((all) => all.name === b.name)
        );
      });
      // here we need to modify the order of measure groups on initial db
      setGroup(measure?.groups[measureGroupNumber]);
      resetForm({
        values: {
          ...measure?.groups[measureGroupNumber],
          groupDescription:
            measure?.groups[measureGroupNumber].groupDescription || "",
          scoringUnit: measure?.groups[measureGroupNumber].scoringUnit || "",
          measureGroupTypes:
            measure?.groups[measureGroupNumber].measureGroupTypes || [],
          populations: measure?.groups[measureGroupNumber].populations || [],
          measureObservations:
            measure?.groups[measureGroupNumber].measureObservations || null,
          improvementNotation:
            measure?.groups[measureGroupNumber].improvementNotation || "",
        },
      });
      setVisibleStrats(
        measure.groups[measureGroupNumber].stratifications
          ? measure.groups[measureGroupNumber].stratifications.length
          : 2
      );
    } else {
      if (measureGroupNumber >= measure?.groups?.length || !measure?.groups) {
        resetForm({
          values: {
            id: null,
            scoring: "",
            populations: [],
            measureObservations: null,
            groupDescription: "",
            stratifications: [getEmptyStrat(), getEmptyStrat()],
            rateAggregation: "",
            improvementNotation: "",
            measureGroupTypes: [],
            populationBasis: defaultPopulationBasis,
            scoringUnit: "",
          },
        });
      }
    }
    setActiveTab("populations");
  }, [measureGroupNumber, measure?.groups]);

  const formik = useFormik({
    initialValues: {
      id: group?.id || null,
      scoring: group?.scoring || "",
      populations: allPopulations,
      measureObservations: null,
      rateAggregation: group?.rateAggregation || "",
      improvementNotation: group?.improvementNotation || "",
      groupDescription: group?.groupDescription,
      stratifications: group?.stratifications || [
        getEmptyStrat(),
        getEmptyStrat(),
      ],
      measureGroupTypes: group?.measureGroupTypes || [],
      populationBasis: group?.populationBasis || defaultPopulationBasis,
      scoringUnit: group?.scoringUnit || null, // autocomplete can't init with string
    } as Group,
    validationSchema: measureGroupSchemaValidator(
      cqlDefinitionDataTypes,
      cqlFunctionDataTypes
    ),
    // enableReinitialize: true,
    onSubmit: (group: Group) => {
      window.scrollTo(0, 0);
      if (
        measure?.groups &&
        !(measureGroupNumber >= measure?.groups?.length) &&
        formik.values?.scoring !== measure?.groups[measureGroupNumber]?.scoring
      ) {
        setGroupWarningDialogProps(() => ({
          open: true,
          modalType: "scoring",
        }));
      } else if (
        measure?.groups &&
        !(measureGroupNumber >= measure?.groups?.length) &&
        formik.values?.populationBasis !==
          measure?.groups[measureGroupNumber]?.populationBasis
      ) {
        setGroupWarningDialogProps(() => ({
          open: true,
          modalType: "popBasis",
        }));
      } else {
        submitForm(group);
      }
    },
  });

  const { resetForm, validateForm } = formik;

  useEffect(() => {
    if (measure?.groups && measure?.groups[measureGroupNumber]) {
      validateForm();
    }
  }, [formik.values.populations, validateForm]);

  useEffect(() => {
    const subscription = measureStore.subscribe((measure: Measure) => {
      setMeasure(measure);

      if (
        measure?.errors?.length > 0 &&
        measure.errors.includes(
          MeasureErrorType.MISMATCH_CQL_POPULATION_RETURN_TYPES
        )
      ) {
        setToastOpen(true);
        setToastMessage(
          "CQL return types do not match population criteria! Test Cases will not execute until this issue is resolved."
        );
      }
      if (
        measure?.errors?.length > 0 &&
        (measure.errors.includes(
          MeasureErrorType.MISMATCH_CQL_SUPPLEMENTAL_DATA
        ) ||
          measure.errors.includes(
            MeasureErrorType.MISMATCH_CQL_RISK_ADJUSTMENT
          ))
      ) {
        setToastOpen(true);
        setToastMessage(
          "Supplemental Data Elements or Risk Adjustment Variables in the Population Criteria section are invalid. Please check and update these values. Test cases will not execute until this issue is resolved."
        );
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // We want to update layout with a cannot travel flag while this is active
  // setIsFormDirty is used for dirty check while navigating between different groups
  const { updateRouteHandlerState } = routeHandlerStore;
  useEffect(() => {
    updateRouteHandlerState({
      canTravel: !formik.dirty,
      pendingRoute: "",
    });
    props.setIsFormDirty(formik.dirty);
  }, [formik.dirty]);

  // Fetches all population basis options from db
  // Should be executed only on initial load of the component
  useEffect(() => {
    measureServiceApi
      .getAllPopulationBasisOptions()
      .then((response) => setPopulationBasisValues(response))
      .catch((err) =>
        setAlertMessage({
          type: "error",
          message: err.message,
          canClose: false,
        })
      );
  }, []);

  // local discard check. Layout can't have access to a bound function
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const discardChanges = () => {
    // check to identify a new group
    if (measureGroupNumber >= measure?.groups?.length || !measure?.groups) {
      resetForm({
        values: {
          id: null,
          groupDescription: "",
          scoring: "",
          measureGroupTypes: [],
          rateAggregation: "",
          improvementNotation: "",
          populationBasis: defaultPopulationBasis,
          scoringUnit: "",
        },
      });
    } else {
      // resetting form with data from DB
      resetForm({
        values: {
          ...measure?.groups[measureGroupNumber],
        },
      });
    }
    setDiscardDialogOpen(false);
  };

  const updateMeasureFromDb = async (measureId) => {
    try {
      const updatedMeasure = await measureServiceApi.fetchMeasure(measureId);
      updateMeasure(updatedMeasure);
      return updatedMeasure;
    } catch (error) {
      throw new Error("Error updating group");
    }
  };

  const submitForm = (group: Group) => {
    if (group.stratifications) {
      group.stratifications = group.stratifications.filter(
        (strat) =>
          (!!strat.description || !!strat.cqlDefinition) &&
          strat.description !== deleteToken
      );
    }

    if (measure?.groups && !(measureGroupNumber >= measure?.groups?.length)) {
      group.id = measure?.groups[measureGroupNumber].id;
      measureServiceApi
        .updateGroup(group, measure.id)
        .then(async (g: Group) => {
          if (g === null || g.id === null) {
            throw new Error("Error updating group");
          }
          await updateMeasureFromDb(measure.id);
        })
        .then(() => {
          setAssociationChanged(false);
          handleDialogClose();
          handleToast(
            "success",
            "Population details for this group updated successfully.",
            true
          );
          formik.resetForm();
          setActiveTab("populations");
        })
        .catch((error) => {
          setAlertMessage({
            type: "error",
            message: error.message,
            canClose: false,
          });
        });
    } else {
      measureServiceApi
        .createGroup(group, measure.id)
        .then(async (g: Group) => {
          if (g === null || g.id === null) {
            throw new Error("Error creating group");
          }
          const updatedMeasure = await updateMeasureFromDb(measure.id);

          return updatedMeasure;
        })
        .then((updatedMeasure) => {
          handleToast(
            "success",
            "Population details for this group saved successfully.",
            true
          );
          navigate(groupsBaseUrl + "/" + updatedMeasure?.groups.length);
        })
        .catch((error) => {
          setAlertMessage({
            type: "error",
            message: error.message,
            canClose: false,
          });
        });
    }
  };

  const handleDialogClose = () => {
    setGroupWarningDialogProps({ open: false, modalType: null });
    setDeleteMeasureGroupDialog({ open: false });
  };

  const deleteMeasureGroup = (e) => {
    e.preventDefault();
    measureServiceApi
      .deleteMeasureGroup(measure?.groups[measureGroupNumber]?.id, measure.id)
      .then((response) => {
        updateMeasure(response);
        navigate(
          groupsBaseUrl +
            "/" +
            (measureGroupNumber === 0 ? 1 : measureGroupNumber)
        );
        handleDialogClose();
      });
  };

  const getDefaultObservationsForScoring = (scoring) => {
    if (scoring === GroupScoring.CONTINUOUS_VARIABLE) {
      return [
        {
          id: uuidv4(),
          criteriaReference: null,
        },
      ];
    } else {
      return null;
    }
  };

  // Provides dropdown options for stratification
  // contains a default value along with all available CQL Definitions
  const stratificationOptions = [
    <MuiMenuItem key="-" value={""}>
      -
    </MuiMenuItem>,
    expressionDefinitions
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((opt, i) => {
        const sanitizedString = opt.name.replace(/"/g, "");
        return (
          <MuiMenuItem key={`${sanitizedString}-${i}`} value={sanitizedString}>
            {sanitizedString}
          </MuiMenuItem>
        );
      }),
  ];

  // sets alert message when CQL has any errors
  useEffect(() => {
    setAlertMessage(() => ({ ...INITIAL_ALERT_MESSAGE }));
    if (measure?.cql) {
      const definitions = new CqlAntlr(measure.cql).parse()
        .expressionDefinitions;
      setExpressionDefinitions(definitions);
    }
    if (measure && (measure.cqlErrors || !measure?.cql)) {
      setAlertMessage(() => ({
        type: "error",
        message: "Please complete the CQL Editor process before continuing",
        canClose: false,
      }));
    } else if (
      measure &&
      !!measure?.errors?.includes(
        MeasureErrorType.MISMATCH_CQL_POPULATION_RETURN_TYPES
      )
    ) {
      setAlertMessage(() => ({
        type: "error",
        message:
          "One or more Population Criteria has a mismatch with CQL return types. Test Cases cannot be executed until this is resolved.",
        canClose: false,
      }));
    }
  }, [measure]);

  /*
  we consume the cs table, build in shape of {
    label: ucumcode + name,
    value: {
      label: code + name,
      guidance:
      code:
      name:
      system:
    }
  }
*/
  const [ucumOptions, setUcumOptions] = useState([]);
  const [ucumUnits, setUcumUnits] = useState([]);

  const buildUcumUnits = useCallback(() => {
    const options = [];

    for (const [key, value] of Object.entries(ucumUnits)) {
      const current = value;
      const { csCode_, guidance_, name_ } = current;
      const option = {
        code: csCode_,
        guidance: guidance_,
        name: name_,
        system: "https://clinicaltables.nlm.nih.gov/",
      };
      options.push(option);
    }
    setUcumOptions(options);
  }, [ucumUnits, setUcumOptions]);

  useEffect(() => {
    if (ucumUnits) {
      buildUcumUnits();
    }
  }, [ucumUnits, buildUcumUnits]);

  useEffect(() => {
    if (!ucumUnits.length) {
      ucum.UcumLhcUtils.getInstance();
      const unitCodes = ucum.UnitTables.getInstance().unitCodes_;
      setUcumUnits(unitCodes);
    }
  }, [ucum, ucumUnits]);

  return (
    <div tw="lg:col-span-5 pl-2 pr-2" data-testid="qi-core-groups">
      <FormikProvider value={formik}>
        <MeasureGroupAlerts {...alertMessage} />
        <Toast
          toastKey="population-criteria-toast"
          toastType={toastType}
          testId={
            toastType === "danger"
              ? `population-criteria-error`
              : `population-criteria-success`
          }
          open={toastOpen}
          message={toastMessage}
          onClose={onToastClose}
          autoHideDuration={6000}
          closeButtonProps={{
            "data-testid": "close-error-button",
          }}
        />
        <form onSubmit={formik.handleSubmit}>
          {/* delete measure group warning dialog */}
          {deleteMeasureGroupDialog.open && (
            <MeasureGroupsWarningDialog
              open={deleteMeasureGroupDialog.open}
              onClose={handleDialogClose}
              onSubmit={deleteMeasureGroup}
              measureGroupNumber={deleteMeasureGroupDialog.measureGroupNumber}
              modalType="deleteMeasureGroup"
            />
          )}

          {/* breaking measure group change warning dialog */}
          {groupWarningDialogProps?.open && (
            <MeasureGroupsWarningDialog
              open={groupWarningDialogProps?.open}
              onClose={handleDialogClose}
              onSubmit={() => submitForm(formik.values)}
              modalType={groupWarningDialogProps?.modalType}
            />
          )}
          {pathname.includes("/groups") && (
            <>
              <div tw="flex pb-2 pt-6">
                <h2 tw="w-1/2 mb-0" data-testid="title" id="title">
                  Population Criteria {measureGroupNumber + 1}
                </h2>
                <div tw="w-1/2 self-end">
                  <Typography
                    style={{
                      fontSize: 14,
                      fontWeight: 300,
                      fontFamily: "Rubik",
                      float: "right",
                    }}
                  >
                    <span style={{ color: "#D92F2F", marginRight: 3 }}>*</span>
                    Indicates required field
                  </Typography>
                </div>
              </div>
              <Divider style={{ marginBottom: 30, borderColor: "#8c8c8c" }} />

              {/* Form control later should be moved to own component and dynamically rendered by switch based on measure. */}

              <div>
                <div>
                  <FormFieldInner>
                    <FieldLabel htmlFor="measure-group-description">
                      Population Criteria {measureGroupNumber + 1} Description
                    </FieldLabel>
                    <FieldSeparator>
                      <TextArea
                        value={formik.values.groupDescription}
                        name="group-description"
                        id="group-description"
                        autoComplete="group-description"
                        disabled={!canEdit}
                        placeholder="Description"
                        data-testid="groupDescriptionInput"
                        onKeyDown={goBackToNav}
                        {...formik.getFieldProps("groupDescription")}
                      />
                      {!canEdit && formik.values.groupDescription}
                    </FieldSeparator>
                  </FormFieldInner>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    flexGrow: 1,
                    marginTop: 44,
                    columnGap: 33,
                  }}
                >
                  <MultipleSelectDropDown
                    formControl={formik.getFieldProps("measureGroupTypes")}
                    id="measure-group-type"
                    label="Measure Type"
                    placeHolder={{ name: "Select Measure Group", value: "" }}
                    defaultValue={formik.values.measureGroupTypes}
                    required={true}
                    disabled={!canEdit}
                    error={
                      formik.touched.measureGroupTypes &&
                      Boolean(formik.errors.measureGroupTypes)
                    }
                    helperText={
                      formik.touched.measureGroupTypes &&
                      Boolean(formik.errors.measureGroupTypes) &&
                      formik.errors.measureGroupTypes
                    }
                    {...formik.getFieldProps("measureGroupTypes")}
                    onChange={(_event: any, selectedVal: string | null) => {
                      formik.setFieldValue("measureGroupTypes", selectedVal);
                    }}
                    onClose={() =>
                      formik.setFieldTouched("measureGroupTypes", true)
                    }
                    options={Object.values(MeasureGroupTypes)}
                    multipleSelect={true}
                    limitTags={1}
                  />
                  <AutoComplete
                    id="populationBasis"
                    dataTestId="populationBasis"
                    label="Population Basis"
                    placeholder="Select Population Basis"
                    required={true}
                    disabled={!canEdit}
                    error={formik.errors.populationBasis}
                    helperText={formik.errors.populationBasis}
                    options={populationBasisValues}
                    {...formik.getFieldProps("populationBasis")}
                    onChange={formik.setFieldValue}
                  />
                  <Select
                    placeHolder={{ name: "Select Scoring", value: "" }}
                    required
                    label="Scoring"
                    id="scoring-select"
                    inputProps={{
                      "data-testid": "scoring-select-input",
                    }}
                    data-testid="scoring-select"
                    {...formik.getFieldProps("scoring")}
                    error={
                      formik.touched.scoring && Boolean(formik.errors.scoring)
                    }
                    disabled={!canEdit}
                    helperText={
                      formik.touched.scoring &&
                      Boolean(formik.errors.scoring) &&
                      formik.errors.scoring
                    }
                    size="small"
                    SelectDisplayProps={{
                      "aria-required": "true",
                    }}
                    onChange={(e) => {
                      const nextScoring = e.target.value;
                      const populations = getPopulationsForScoring(nextScoring);
                      const observations =
                        getDefaultObservationsForScoring(nextScoring);
                      formik.setFieldValue("scoring", nextScoring);
                      formik.setFieldValue(
                        "populations",
                        [...populations].map((p) => ({
                          ...p,
                          id: uuidv4(),
                          description: "",
                        }))
                      );
                      formik.setFieldValue("measureObservations", observations);
                      formik.setFieldValue("stratifications", []);
                      setActiveTab("populations");
                    }}
                    options={Object.keys(GroupScoring).map((scoring) => {
                      return (
                        <MuiMenuItem
                          key={scoring}
                          value={GroupScoring[scoring]}
                          data-testid={`group-scoring-option-${scoring}`}
                        >
                          {GroupScoring[scoring]}
                        </MuiMenuItem>
                      );
                    })}
                  />
                  {/* no longer capable of errors */}
                  <MeasureGroupScoringUnit
                    error={
                      formik.touched.scoringUnit &&
                      Boolean(formik.errors.scoringUnit)
                    }
                    helperText={
                      formik.touched.scoringUnit &&
                      Boolean(formik.errors.scoringUnit) &&
                      formik.errors.scoringUnit
                    }
                    {...formik.getFieldProps("scoringUnit")}
                    onChange={(newValue) => {
                      formik.setFieldValue("scoringUnit", newValue);
                    }}
                    canEdit={canEdit}
                    placeholder="UCUM Code or Name"
                  />
                </div>
                <div>
                  <MenuItemContainer style={{ borderColor: "#8c8c8c" }}>
                    <Tabs value={activeTab} type="B" size="large">
                      <Tab
                        value="populations"
                        type="B"
                        data-testid="populations-tab"
                        label={`Populations 
                ${
                  !!formik.errors.populations && activeTab !== "populations"
                    ? "🚫"
                    : ""
                }`}
                        onClick={() => {
                          setActiveTab("populations");
                        }}
                      />

                      {formik.values.scoring !== "Ratio" && (
                        <Tab
                          tabIndex={0}
                          label="Stratifications"
                          value="stratification"
                          type="B"
                          data-testid="stratifications-tab"
                          onClick={() => {
                            setActiveTab("stratification");
                            if (!!formik.values.stratifications) {
                              while (formik.values.stratifications.length < 2) {
                                formik.values.stratifications.push(
                                  getEmptyStrat()
                                );
                                setVisibleStrats(2);
                              }
                            } else {
                              formik.values.stratifications = [
                                getEmptyStrat(),
                                getEmptyStrat(),
                              ];
                              setVisibleStrats(2);
                            }
                          }}
                        />
                      )}
                      <Tab
                        type="B"
                        label="Reporting"
                        data-testid="reporting-tab"
                        onClick={() => setActiveTab("reporting")}
                        value="reporting"
                      />
                    </Tabs>
                  </MenuItemContainer>
                </div>

                {/* Populations Tab */}
                {activeTab === "populations" && (
                  // to do: Condense poppulations Tab into a single component
                  <FieldArray
                    name="populations"
                    render={(arrayHelpers) => (
                      <div id="populations-content">
                        {formik.values.populations?.map((population, index) => {
                          const fieldProps = {
                            name: `populations[${index}].definition`,
                          };
                          const descriptionName = `populations[${index}].description`;

                          // if the population is exclusion of something then it should be in col 2
                          const isExclusionPop = population.name
                            .toLowerCase()
                            .includes("exclusion");
                          // if the population is 2nd IP then it should be in col 2. Assuming index = 0 is always IP and 2nd IP will be index = 1
                          const isSecondInitialPopulation =
                            index === 1 &&
                            population.name === "initialPopulation";
                          return (
                            <React.Fragment key={`population_${index}`}>
                              <ColSpanPopulations
                                isSecondInitialPopulation={
                                  isSecondInitialPopulation
                                }
                                isExclusionPop={isExclusionPop}
                              >
                                <div className="population-col-gap-24">
                                  {/* Population Definition */}
                                  <Field
                                    {...fieldProps}
                                    descriptionName={descriptionName}
                                    component={GroupPopulation}
                                    cqlDefinitions={expressionDefinitions}
                                    populations={formik.values.populations}
                                    population={population}
                                    populationIndex={index}
                                    scoring={formik.values.scoring}
                                    canEdit={canEdit}
                                    replaceCallback={arrayHelpers.replace}
                                    setAssociationChanged={
                                      setAssociationChanged
                                    }
                                  />
                                  {/* PopulationDescription */}
                                  <GroupsDescription
                                    name={descriptionName}
                                    canEdit={canEdit}
                                    label={
                                      population?.name
                                        ? `${camelCaseConverter(
                                            population.name
                                          )} Description`
                                        : undefined
                                    }
                                    setFieldValue={formik.setFieldValue}
                                    value={
                                      formik.values.populations[index]
                                        .description
                                    }
                                  />
                                </div>
                                {/* Single component for add and remove */}
                                <AddRemovePopulation
                                  field={fieldProps}
                                  scoring={formik.values.scoring}
                                  index={index}
                                  populations={formik.values.populations}
                                  population={population}
                                  canEdit={canEdit}
                                  insertCallback={arrayHelpers.insert}
                                  removeCallback={arrayHelpers.remove}
                                  replaceCallback={arrayHelpers.replace}
                                  setAssociationChanged={setAssociationChanged}
                                />
                                {/* add or remove logic must live here */}
                                <MeasureGroupObservation
                                  canEdit={canEdit}
                                  scoring={formik.values.scoring}
                                  population={population}
                                  elmJson={measure?.elmJson}
                                  linkMeasureObservationDisplay={true}
                                  errors={formik.errors}
                                />
                              </ColSpanPopulations>
                            </React.Fragment>
                          );
                        })}
                        <div>
                          <MeasureGroupObservation
                            canEdit={canEdit}
                            scoring={formik.values.scoring}
                            errors={formik.errors}
                            population={
                              formik.values.populations?.filter(
                                (pop) =>
                                  pop.name === PopulationType.MEASURE_POPULATION
                              )[0]
                            }
                            elmJson={measure?.elmJson}
                            linkMeasureObservationDisplay={null}
                          />
                        </div>
                      </div>
                    )}
                  />
                )}

                {activeTab === "stratification" && (
                  <FieldArray
                    name="stratifications"
                    render={(arrayHelpers) => (
                      <div>
                        {formik.values.stratifications &&
                          formik.values.stratifications.map(
                            (strat, i) =>
                              formik.values.stratifications[i].description !==
                                deleteToken && (
                                <div key={i} tw="mt-6">
                                  <div tw="grid lg:grid-cols-4 gap-4">
                                    <div tw="lg:col-span-1">
                                      <div tw="relative">
                                        {formik.values.stratifications.length >
                                          2 &&
                                          visibleStrats > 2 && (
                                            <DSLink
                                              className="madie-link"
                                              sx={{
                                                position: "absolute",
                                                left: "117px",
                                                zIndex: "1",
                                                textDecoration: "none",
                                              }}
                                              component="button"
                                              underline="always"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                arrayHelpers.remove(i);
                                                setVisibleStrats(
                                                  visibleStrats - 1
                                                );
                                              }}
                                              variant="body2"
                                              data-testid="remove-strat-button"
                                            >
                                              Remove
                                            </DSLink>
                                          )}
                                        <Select
                                          disabled={!canEdit}
                                          placeHolder={{
                                            name: "Select Definition",
                                            value: "",
                                          }}
                                          label={`Stratification ${i + 1}`}
                                          id={`Stratification-select-${i + 1}`}
                                          aria-describedby={`Stratification-select-${
                                            i + 1
                                          }-helper-text`}
                                          error={Boolean(
                                            getIn(
                                              formik.errors,
                                              `stratifications[${i}].cqlDefinition`
                                            )
                                          )}
                                          helperText={getIn(
                                            formik.errors,
                                            `stratifications[${i}].cqlDefinition`
                                          )}
                                          inputProps={{
                                            "data-testid": `stratification-${
                                              i + 1
                                            }-input`,
                                          }}
                                          {...formik.getFieldProps(
                                            `stratifications[${i}].cqlDefinition`
                                          )}
                                          size="small"
                                          options={stratificationOptions}
                                        />
                                      </div>

                                      {/*Association Select*/}
                                      <div tw="pt-4">
                                        <Select
                                          disabled={!canEdit}
                                          placeHolder={{
                                            name: "Select Association",
                                            value: "",
                                          }}
                                          label={`Association ${i + 1}`}
                                          id={`association-select-${i + 1}`}
                                          aria-describedby={`association-select-${
                                            i + 1
                                          }-helper-text`}
                                          inputProps={{
                                            "data-testid": `association-${
                                              i + 1
                                            }-input`,
                                          }}
                                          {...formik.getFieldProps(
                                            `stratifications[${i}].association`
                                          )}
                                          size="small"
                                          renderValue={(value) =>
                                            _.startCase(value)
                                          }
                                          options={
                                            !!formik.values.scoring &&
                                            associationSelect[
                                              formik.values.scoring
                                            ].map((opt, i) => (
                                              <MuiMenuItem
                                                key={`${opt}-${i}`}
                                                value={`${opt}`}
                                              >
                                                {_.startCase(opt)}
                                              </MuiMenuItem>
                                            ))
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div tw="lg:col-span-2">
                                      <FieldLabel
                                        htmlFor={`stratification-${i}-description`}
                                      >
                                        Stratification {i + 1} Description
                                      </FieldLabel>
                                      <FieldSeparator>
                                        <TextArea
                                          tw="disabled:bg-slate h-full w-full"
                                          value={
                                            formik.values.stratifications[i]
                                              .description
                                          }
                                          disabled={!canEdit}
                                          name={`stratifications[${i}].description`}
                                          id={`stratification-${i}-description`}
                                          autoComplete="stratification-description"
                                          placeholder="Enter Description"
                                          data-testid="stratificationDescriptionText"
                                          maxLength={5000}
                                          {...formik.getFieldProps(
                                            `stratifications[${i}].description`
                                          )}
                                        />
                                      </FieldSeparator>
                                    </div>
                                  </div>
                                </div>
                              )
                          )}
                        {canEdit ? (
                          <div tw="pt-4">
                            <DSLink
                              className="madie-link"
                              sx={{
                                color: "#0073C8",
                                padding: "14px 0 14px 0",
                              }}
                              data-testid="add-strat-button"
                              onClick={(e) => {
                                e.preventDefault();
                                setVisibleStrats(visibleStrats + 1);
                                arrayHelpers.push(getEmptyStrat());
                                setAddStratClicked(true);
                              }}
                            >
                              + Add Stratification
                            </DSLink>
                          </div>
                        ) : (
                          <div tw="p-4"></div>
                        )}
                      </div>
                    )}
                  />
                )}

                {activeTab === "reporting" && (
                  <div tw="grid grid-cols-4 mt-6">
                    <div tw="lg:col-span-3">
                      <FieldLabel
                        htmlFor="rate-aggregation"
                        id="rate-aggregation-label"
                      >
                        Rate Aggregation
                      </FieldLabel>
                      <FieldSeparator>
                        <FieldInput
                          style={{ border: "solid 1px #8c8c8c" }}
                          value={formik.values.rateAggregation}
                          aria-labelledby="rate-aggregation-label"
                          type="text"
                          disabled={!canEdit}
                          name="rate-aggregation"
                          id="rate-aggregation"
                          autoComplete="rate-aggregation"
                          placeholder="Rate Aggregation"
                          data-testid="rateAggregationText"
                          {...formik.getFieldProps("rateAggregation")}
                        />
                      </FieldSeparator>
                    </div>
                    <div tw="pt-6 pb-6 col-start-1 col-end-2">
                      <Select
                        placeHolder={{
                          name: "Select Improvement Notation",
                          value: "",
                        }}
                        label="Improvement Notation"
                        id="improvement-notation-select"
                        inputProps={{
                          "data-testid": "improvement-notation-input",
                        }}
                        disabled={!canEdit}
                        data-testid="improvement-notation-select"
                        {...formik.getFieldProps("improvementNotation")}
                        size="small"
                        options={Object.values(improvementNotationOptions).map(
                          (opt) => (
                            <MuiMenuItem key={opt.label} value={opt.value}>
                              {opt.label}
                            </MuiMenuItem>
                          )
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {canEdit && (
                <div tw="grid lg:grid-cols-4 gap-4 items-center py-4">
                  <Button
                    style={{ width: "30%" }}
                    variant="danger"
                    data-testid="group-form-delete-btn"
                    disabled={
                      measureGroupNumber >= measure?.groups?.length ||
                      !measure?.groups
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteMeasureGroupDialog({
                        open: true,
                        measureGroupNumber: measureGroupNumber,
                      });
                    }}
                  >
                    Delete
                  </Button>
                  <ButtonSpacer>
                    <span
                      tw="text-sm"
                      style={{ color: "#717171" }}
                      data-testid="save-measure-group-validation-message"
                      aria-live="polite" //this triggers every time the user is there.. this intended?
                    >
                      {measureGroupSchemaValidator(
                        cqlDefinitionDataTypes,
                        cqlFunctionDataTypes
                      ).isValidSync(formik.values)
                        ? ""
                        : "You must set all required Populations."}
                    </span>
                  </ButtonSpacer>
                  <div tw="lg:col-start-4 flex">
                    <Button
                      tw="mx-2"
                      variant="outline"
                      className="cancel-button"
                      disabled={!formik.dirty}
                      data-testid="group-form-discard-btn"
                      onClick={() => setDiscardDialogOpen(true)}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      tw="mx-2"
                      style={{ marginTop: "0px" }}
                      variant="cyan"
                      type="submit"
                      data-testid="group-form-submit-btn"
                      disabled={
                        !(
                          formik.isValid &&
                          (formik.dirty || associationChanged)
                        )
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </form>

        {/*Utility components*/}
        <MadieDiscardDialog
          open={discardDialogOpen}
          onClose={() => setDiscardDialogOpen(false)}
          onContinue={discardChanges}
        />
      </FormikProvider>
    </div>
  );
};

export default MeasureGroups;
