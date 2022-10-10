import React, { useEffect, useState } from "react";
import "twin.macro";
import "styled-components/macro";
import useMeasureServiceApi from "../../../../api/useMeasureServiceApi";
import { Button, Toast } from "@madie/madie-design-system/dist/react";
import {
  measureStore,
  routeHandlerStore,
  useOktaTokens,
} from "@madie/madie-util";
import { useFormik } from "formik";
import * as Yup from "yup";
import "../measureMetadata/MeasureMetaData.scss";
import {
  Autocomplete,
  Checkbox,
  FormHelperText,
  TextField,
  Typography,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const icon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

const autoCompleteStyles = {
  borderRadius: "3px",
  height: 40,
  border: "1px solid #DDDDDD",
  "& .MuiOutlinedInput-notchedOutline": {
    borderRadius: "3px",
    "& legend": {
      width: 0,
    },
  },
  "& .MuiAutocomplete-inputFocused": {
    border: "none",
    boxShadow: "none",
    outline: "none",
  },
  "& .MuiAutocomplete-inputRoot": {
    paddingTop: 0,
    paddingBottom: 0,
  },
  width: "50%",
};

const asterisk = { color: "#D92F2F", marginRight: 3 };

// Need to have a "-" as placeholder if nothing is selected, but it doesn't have to be an option
// Need to have 2 diff sizes of buttons
export default function StewardAndDevelopers() {
  const measureServiceApi = useMeasureServiceApi();
  const [organizations, setOrganizations] = useState<string[]>();
  const [measure, setMeasure] = useState<any>(measureStore.state);
  const { updateMeasure } = measureStore;

  // toast utilities
  const [toastOpen, setToastOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [toastType, setToastType] = useState<string>("danger");
  const onToastClose = () => {
    setToastType(null);
    setToastMessage("");
    setToastOpen(false);
  };
  const handleToast = (type, message, open) => {
    setToastType(type);
    setToastMessage(message);
    setToastOpen(open);
  };

  const { getUserName } = useOktaTokens();
  const userName = getUserName();
  const canEdit =
    measure?.createdBy === userName ||
    measure?.acls?.some(
      (acl) => acl.userId === userName && acl.roles.indexOf("SHARED_WITH") >= 0
    );
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      steward: measure?.measureMetaData?.steward || "",
      developers: measure?.measureMetaData?.developers || [],
    },
    validationSchema: Yup.object({
      steward: Yup.string().required("Steward is required"),
      developers: Yup.array().min(1, "At least one developer is required"),
    }),
    onSubmit: (values) => {
      submitForm(values);
    },
  });
  const { resetForm } = formik;

  // Updates the measure in DB, and also the measureStore
  const submitForm = (values) => {
    const submitMeasure = {
      ...measure,
      measureMetaData: {
        ...measure.measureMetaData,
        steward: values.steward,
        developers: values.developers,
      },
    };

    measureServiceApi
      .updateMeasure(submitMeasure)
      .then(() => {
        handleToast(
          "success",
          `Steward and Developers Information Saved Successfully`,
          true
        );
        updateMeasure(submitMeasure);
      })
      .catch(() => {
        const message = `Error updating measure "${measure.measureName}"`;
        handleToast("danger", message, true);
      });
  };

  useEffect(() => {
    const subscription = measureStore.subscribe(setMeasure);
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Route handle store will give warning message
  // if form is dirty and user ties to navigate across SPAs
  const { updateRouteHandlerState } = routeHandlerStore;
  useEffect(() => {
    updateRouteHandlerState({
      canTravel: !formik.dirty,
      pendingRoute: "",
    });
  }, [formik.dirty]);

  // fetch organizations DB using measure service and sorts alphabetically
  useEffect(() => {
    measureServiceApi
      .getAllOrganizations()
      .then((response) => {
        const organizationsList = response
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((element) => element.name);
        setOrganizations(organizationsList);
      })
      .catch(() => {
        const message = `Error fetching organizations`;
        handleToast("danger", message, true);
      });
  }, []);

  return (
    <form
      id="measure-meta-data-form"
      onSubmit={formik.handleSubmit}
      data-testid="measure-steward-developers-form"
    >
      <div className="content">
        <div className="subTitle">
          <h3>Steward & Developers</h3>
          <div className="required">
            <Typography
              style={{ fontSize: 14, fontWeight: 300, fontFamily: "Rubik" }}
            >
              <span style={asterisk}>*</span>
              Indicates required field
            </Typography>
          </div>
        </div>
        {organizations && (
          <>
            <div tw="mb-4">
              <span style={asterisk}>*</span>
              <label htmlFor={`steward`}>Steward</label>
              <Autocomplete
                data-testid="steward"
                options={organizations}
                disabled={!canEdit}
                sx={autoCompleteStyles}
                {...formik.getFieldProps("steward")}
                onChange={(_event: any, selectedVal: string | null) => {
                  formik.setFieldValue("steward", selectedVal || "");
                }}
                renderInput={(params) => <TextField {...params} />}
                renderOption={(props: any, option) => {
                  const uniqueProps = {
                    ...props,
                    key: `${props.key}_${props.id}`,
                  };
                  return <li {...uniqueProps}>{option}</li>;
                }}
              />
              {formik.errors["steward"] && (
                <FormHelperText
                  data-testid={`steward-helper-text`}
                  error={true}
                >
                  {formik.errors["steward"]}
                </FormHelperText>
              )}
            </div>
            <div tw="mb-4">
              <span style={asterisk}>*</span>
              <label htmlFor={`developers`}>Developers</label>
              <Autocomplete
                multiple
                disabled={!canEdit}
                data-testid="developers"
                options={organizations}
                disableCloseOnSelect
                getOptionLabel={(option) => option}
                renderOption={(props: any, option, { selected }) => {
                  const uniqueProps = {
                    ...props,
                    key: `${props.key}_${props.id}`,
                  };
                  return (
                    <li {...uniqueProps}>
                      <Checkbox
                        icon={icon}
                        checkedIcon={checkedIcon}
                        style={{ marginRight: 8 }}
                        checked={selected}
                      />
                      {option}
                    </li>
                  );
                }}
                {...formik.getFieldProps("developers")}
                sx={{
                  ...autoCompleteStyles,
                  height: "auto",
                  "& .MuiAutocomplete-inputRoot": {
                    paddingTop: 1,
                    paddingBottom: 1,
                  },
                }}
                onChange={(_event: any, selectedVal: string | null) => {
                  formik.setFieldValue("developers", selectedVal);
                }}
                renderInput={(params) => <TextField {...params} />}
              />
              {formik.errors["developers"] && (
                <FormHelperText
                  data-testid={`developers-helper-text`}
                  error={true}
                >
                  {formik.errors["developers"]}
                </FormHelperText>
              )}
            </div>
          </>
        )}
      </div>
      <div className="form-actions">
        <Button
          className="cancel-button"
          data-testid="cancel-button"
          disabled={!formik.dirty}
          onClick={() => resetForm()}
        >
          Discard Changes
        </Button>
        <Button
          disabled={!(formik.isValid && formik.dirty)}
          type="submit"
          variant="cyan"
          data-testid={`steward-and-developers-save`}
        >
          Save
        </Button>
      </div>
      <Toast
        toastKey="steward-and-developers-toast"
        toastType={toastType}
        testId={
          toastType === "danger"
            ? `steward-and-developers-error`
            : `steward-and-developers-success`
        }
        open={toastOpen}
        message={toastMessage}
        onClose={onToastClose}
        autoHideDuration={6000}
      />
    </form>
  );
}
