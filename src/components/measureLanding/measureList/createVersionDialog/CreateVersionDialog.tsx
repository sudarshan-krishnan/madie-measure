import React, { useState, useEffect, useCallback } from "react";
import { Backdrop, FormHelperText } from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  TextField,
  ReadOnlyTextField,
  Select,
  MadieDialog,
  MadieSpinner,
} from "@madie/madie-design-system/dist/react";
import { MenuItem } from "@mui/material";
import "./CreateVersionDialog.scss";
import * as _ from "lodash";

interface VersionInfo {
  type: string;
  confirmedVersion: string;
}

const OPTIONS = ["major", "minor", "patch"];
const VERSION_OPTIONS = OPTIONS.map((ref, i) => (
  <MenuItem key={`${ref}-${i}`} data-testid={`${ref}-option`} value={ref}>
    {_.startCase(ref)}
  </MenuItem>
));

const CreatVersionDialog = ({
  currentVersion,
  open,
  onClose,
  onSubmit,
  versionHelperText,
  loading,
}) => {
  function formikErrorHandler(name: string, isError: boolean) {
    if (formik.touched[name] && formik.errors[name]) {
      return `${formik.errors[name]}`;
    }
  }
  const getNewVersion = (versionType, currentVersion) => {
    if (!currentVersion) {
      return null;
    }
    const VERSION_MAP = {
      major: 0,
      minor: 1,
      patch: 2,
    };
    const splitVersion = currentVersion.split(".");
    const selectedIndex = VERSION_MAP[versionType];
    if (selectedIndex === 2) {
      // patch is a little funny
      const currentPatch = splitVersion[selectedIndex];
      let newPatch = Number(currentPatch + 1);
      let newPatchString = String(newPatch);
      const digits = String(newPatchString).length; //now we know how many digits we have
      for (let i = 0; i < 3 - digits; i++) {
        newPatchString = "0" + newPatchString;
      }
      splitVersion[selectedIndex] = newPatchString;
      return splitVersion.join(".");
    } else {
      const targetValue = splitVersion[selectedIndex];
      splitVersion[selectedIndex] = Number(targetValue + 1);
      return splitVersion.join(".");
    }
  };
  // we need a way to deal with "000"
  //given a version number string, we can divide into three parts and increment and rejoin based on whatever.
  const [newVersionNumber, setNewVersionNumber] = useState<string>("");
  const checkVersionMatch = (currentVersion, confirmedVersion) => {
    return currentVersion === confirmedVersion;
  };

  const formik = useFormik({
    initialValues: {
      type: "",
      confirmedVersion: "",
    } as VersionInfo,
    validationSchema: Yup.object().shape({
      type: Yup.string().required("A version type is required."),
      confirmedVersion: Yup.string()
        .test(
          "confirmedVersion",
          "Confirmed Version number must match new version number.",
          (val) => {
            return val === newVersionNumber;
          }
        )
        .required("Confirmed Version is required"),
      // currentVersion: Yup.string().required().test("currentVersion", async (confirmed) => {
      //   return (checkVersionMatch(currentVersion, confirmed))
      // })
    }),
    enableReinitialize: true,
    onSubmit: ({ type }) => {
      formik.resetForm();
      return onSubmit(type);
    },
  });

  const determineVersionNumber = useCallback(() => {
    setNewVersionNumber(getNewVersion(formik.values.type, currentVersion));
  }, [currentVersion, formik.values.type, setNewVersionNumber]);

  useEffect(() => {
    determineVersionNumber();
  }, [formik.values.type]);

  const error = !!versionHelperText;
  return (
    <MadieDialog
      form
      required
      title="Create Version"
      dialogProps={{
        onClose,
        open,
        onSubmit: formik.handleSubmit,
      }}
      cancelButtonProps={{
        variant: "secondary",
        cancelText: "Cancel",
        "data-testid": "create-version-cancel-button",
      }}
      continueButtonProps={{
        variant: "cyan",
        type: "submit",
        "data-testid": "create-version-continue-button",
        disabled: !(formik.isValid && formik.dirty),
        continueText: "Continue",
      }}
    >
      <div data-testid="create-version-dialog" id="create-version-dialog">
        <div className="column-gap">
          <Select
            id={`version-type`}
            label="Version Type"
            inputProps={{
              "data-testid": `version-type-input`,
            }}
            data-testid={`version-type`}
            required
            SelectDisplayProps={{
              "aria-required": "true",
            }}
            options={VERSION_OPTIONS}
            placeHolder={{
              name: "Select Version",
              value: "",
            }}
            renderValue={(selected) => {
              if (!selected) {
                return "Select Version";
              }
              return _.startCase(selected);
            }}
            {...formik.getFieldProps("type")}
          />
          <ReadOnlyTextField
            readOnly
            label="Current Version #"
            placeholder="Enter"
            id="current-version"
            data-testid="current-version"
            value={currentVersion}
            inputProps={{
              "data-testid": "current-version-input",
            }}
          />
        </div>
        <FormHelperText
          tabIndex={0}
          aria-live="polite"
          id={`version-helper-text`}
          data-testid={`version-helper-text`}
          sx={[
            {
              margin: "4px 0px 0px 0px",
              color: "#515151",
              lineHeight: 1,
            },
            error && {
              color: "#AE1C1C !important",
            },
          ]}
        >
          {versionHelperText}
        </FormHelperText>
        {formik.values.type && (
          <div className="column-gap">
            <ReadOnlyTextField
              readOnly
              label="New Version #"
              placeholder="Enter"
              id="current-version"
              data-testid="current-version"
              value={newVersionNumber}
            />
            <TextField
              inputProps={{
                "data-testid": "confirm-version-input",
              }}
              error={
                formik.touched.confirmedVersion &&
                Boolean(formik.errors.confirmedVersion)
              }
              required
              label="Confirm New Version #"
              placeholder="Confirm New Version Number"
              helperText={formikErrorHandler("confirmedVersion", true)}
              {...formik.getFieldProps("confirmedVersion")}
            />
          </div>
        )}
      </div>
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <MadieSpinner style={{ height: 50, width: 50 }} />
      </Backdrop>
    </MadieDialog>
  );
};

export default CreatVersionDialog;
