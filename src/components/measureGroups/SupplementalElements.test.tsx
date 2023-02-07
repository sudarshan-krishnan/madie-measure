import * as React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import SupplementalElements from "./SupplementalElements";
import { Measure } from "@madie/madie-models";
import { checkUserCanEdit } from "@madie/madie-util";
import useMeasureServiceApi, {
  MeasureServiceApi,
} from "../../api/useMeasureServiceApi";
import { act } from "react-dom/test-utils";
import { MeasureCQL } from "../common/MeasureCQL";
import userEvent from "@testing-library/user-event";

const mockHistoryPush = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

jest.mock("../../api/useMeasureServiceApi");
const useMeasureServiceApiMock =
  useMeasureServiceApi as jest.Mock<MeasureServiceApi>;

const testUser = "testUser";
const mockMeasure = {
  id: "testMeasureId",
  measureName: "The Measure for Testing",
  createdBy: testUser,
  cql: MeasureCQL,
  acls: [{ userId: "othertestuser@example.com", roles: ["SHARED_WITH"] }],
} as Measure;

jest.mock("@madie/madie-util", () => ({
  useKeyPress: jest.fn(() => false),
  measureStore: {
    updateMeasure: jest.fn((measure) => measure),
    state: jest.fn().mockImplementation(() => mockMeasure),
    initialState: jest.fn().mockImplementation(() => null),
    subscribe: (set) => {
      set(mockMeasure);
      return { unsubscribe: () => null };
    },
  },
  routeHandlerStore: {
    subscribe: (set) => {
      set(mockMeasure);
      return { unsubscribe: () => null };
    },
    updateRouteHandlerState: () => null,
    state: { canTravel: true, pendingPath: "" },
    initialState: { canTravel: true, pendingPath: "" },
  },
  checkUserCanEdit: jest.fn(),
}));

let serviceApiMock: MeasureServiceApi;

describe("Supplemental Elements component", () => {
  let measure: Measure;

  beforeEach(() => {
    serviceApiMock = {
      updateMeasure: jest.fn().mockResolvedValueOnce({ status: 200 }),
    } as unknown as MeasureServiceApi;
    useMeasureServiceApiMock.mockImplementation(() => serviceApiMock);
  });
  const setErrorMessage = jest.fn();
  afterEach(() => jest.clearAllMocks());

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should disable dropdowns if the user does not have measure edit permissions", async () => {
    checkUserCanEdit.mockImplementationOnce(() => false);
    await act(async () => {
      render(<SupplementalElements setErrorMessage={setErrorMessage} />);
      const supplementalAutoComplete = await screen.findByTestId(
        "supplementalDataElements"
      );
      const supplementalComboBox = await within(
        supplementalAutoComplete
      ).getByRole("combobox");
      await waitFor(() => expect(supplementalComboBox).toBeDisabled());
    });
  });

  it("should render SupplementalElements form with disabled save and discard buttons", async () => {
    checkUserCanEdit.mockImplementation(() => true);
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);
    expect(await screen.findByTestId("supplemental-data-form"));
    expect(screen.getByRole("heading")).toHaveTextContent("Supplemental Data");

    const comboBoxes = await screen.findAllByRole("combobox");
    expect(comboBoxes).toHaveLength(1);

    const discardButton = screen.getByRole("button", {
      name: "Discard Changes",
    }) as HTMLButtonElement;
    expect(discardButton).toBeDisabled();
    const saveButton = screen.getByRole("button", {
      name: "Save",
    }) as HTMLButtonElement;
    expect(saveButton).toBeDisabled();
  });

  it("should render SupplementalElements dropdown with supplement data element list from measure CQL", async () => {
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    await act(async () => {
      const supplementalDropdown = await screen.findByTestId(
        "supplementalDataElements"
      );
      fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

      const supplementalOptions = await screen.findAllByRole("option");
      expect(supplementalOptions).toHaveLength(10);

      fireEvent.click(supplementalOptions[0]);
      fireEvent.click(supplementalOptions[1]);
      const selectedSupplementalOption1 = within(
        supplementalDropdown
      ).queryByRole("button", { name: "Denominator" });
      expect(selectedSupplementalOption1).not.toBe(null);
      const selectedSupplementalOption2 = within(
        supplementalDropdown
      ).queryByRole("button", {
        name: "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions",
      });
      expect(selectedSupplementalOption2).not.toBe(null);
    });
  });

  it("should enable save and discard button after updating options for SupplementalElements", async () => {
    checkUserCanEdit.mockImplementation(() => true);
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    await act(async () => {
      const supplementalDropdown = await screen.findByTestId(
        "supplementalDataElements"
      );
      fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

      const supplementalOptions = await screen.findAllByRole("option");
      fireEvent.click(supplementalOptions[0]);
      fireEvent.click(supplementalOptions[1]);
      fireEvent.keyDown(supplementalDropdown, {
        key: "Escape",
        code: "Escape",
        charCode: 27,
      });

      const selectedSupplementalOption1 = within(
        supplementalDropdown
      ).queryByRole("button", { name: "Denominator" });
      expect(selectedSupplementalOption1).not.toBe(null);
      const selectedSupplementalOption2 = within(
        supplementalDropdown
      ).queryByRole("button", {
        name: "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions",
      });
      expect(selectedSupplementalOption2).not.toBe(null);

      //2 textarea shows:
      const firstTextarea = screen.getByTestId("Denominator");
      expect(firstTextarea).toBeInTheDocument();
      const secondTextarea = screen.getByTestId(
        "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions"
      );
      expect(secondTextarea).toBeInTheDocument();
      userEvent.type(firstTextarea, "test denom");

      const saveButton = await screen.findByRole("button", { name: "Save" });
      expect(saveButton).toBeEnabled();
      fireEvent.click(saveButton);
    });

    expect(serviceApiMock.updateMeasure).toHaveBeenCalledWith({
      ...mockMeasure,
    });

    expect(
      await screen.findByTestId("supplementalDataElement-success")
    ).toHaveTextContent(
      "Supplement Data Element Information Saved Successfully"
    );
    const toastCloseButton = await screen.findByTestId("close-error-button");
    expect(toastCloseButton).toBeInTheDocument();
    fireEvent.click(toastCloseButton);
    await waitFor(() => {
      expect(toastCloseButton).not.toBeInTheDocument();
    });
  });

  it("should display error message in toast, if update to measure fails", async () => {
    checkUserCanEdit.mockImplementation(() => true);
    serviceApiMock = {
      updateMeasure: jest.fn().mockRejectedValue(undefined),
    } as unknown as MeasureServiceApi;
    useMeasureServiceApiMock.mockImplementation(() => serviceApiMock);

    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    await act(async () => {
      const supplementalDropdown = await screen.findByTestId(
        "supplementalDataElements"
      );
      fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

      const supplementalOptions = await screen.findAllByRole("option");
      fireEvent.click(supplementalOptions[0]);
      fireEvent.click(supplementalOptions[1]);
      fireEvent.keyDown(supplementalDropdown, {
        key: "Escape",
        code: "Escape",
        charCode: 27,
      });

      const selectedSupplementalOption1 = within(
        supplementalDropdown
      ).queryByRole("button", { name: "Denominator" });
      expect(selectedSupplementalOption1).not.toBe(null);
      const selectedSupplementalOption2 = within(
        supplementalDropdown
      ).queryByRole("button", {
        name: "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions",
      });
      expect(selectedSupplementalOption2).not.toBe(null);

      //2 textarea shows:
      const firstTextarea = screen.getByTestId("Denominator");
      expect(firstTextarea).toBeInTheDocument();
      const secondTextarea = screen.getByTestId(
        "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions"
      );
      expect(secondTextarea).toBeInTheDocument();

      const saveButton = await screen.findByRole("button", { name: "Save" });
      expect(saveButton).toBeEnabled();
      fireEvent.click(saveButton);
    });

    expect(setErrorMessage).toHaveBeenCalled();
    await waitFor(() => {
      const toastMessage = screen.findByTestId("supplementalDataElement-error");
    });
  });

  it("should discard changes by clicking discard changes button and continue", async () => {
    checkUserCanEdit.mockImplementation(() => true);
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    await act(async () => {
      const supplementalDropdown = await screen.findByTestId(
        "supplementalDataElements"
      );
      fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

      const supplementalOptions = await screen.findAllByRole("option");
      expect(supplementalOptions).toHaveLength(10);

      fireEvent.click(supplementalOptions[0]);
      fireEvent.click(supplementalOptions[1]);
      const selectedSupplementalOption1 = within(
        supplementalDropdown
      ).queryByRole("button", { name: "Denominator" });
      expect(selectedSupplementalOption1).not.toBe(null);
      const selectedSupplementalOption2 = within(
        supplementalDropdown
      ).queryByRole("button", {
        name: "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions",
      });
      expect(selectedSupplementalOption2).not.toBe(null);

      fireEvent.click(screen.getByTestId("cancel-button"));
      const discardDialog = await screen.getByTestId("discard-dialog");
      expect(discardDialog).toBeInTheDocument();
      const continueButton = await screen.getByTestId(
        "discard-dialog-continue-button"
      );
      expect(continueButton).toBeInTheDocument();

      fireEvent.click(continueButton);
      await waitFor(() => {
        const firstTextarea = screen.queryByTestId("Denominator");
        expect(firstTextarea).not.toBeInTheDocument();
        const secondTextarea = screen.queryByTestId(
          "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions"
        );
        expect(secondTextarea).not.toBeInTheDocument();
      });
    });
  });

  it("should close the discard dialog on close", async () => {
    checkUserCanEdit.mockImplementation(() => true);
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    const supplementalDropdown = await screen.findByTestId(
      "supplementalDataElements"
    );
    fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

    const supplementalOptions = await screen.findAllByRole("option");
    expect(supplementalOptions).toHaveLength(10);

    fireEvent.click(supplementalOptions[0]);
    fireEvent.click(supplementalOptions[1]);
    const selectedSupplementalOption1 = within(
      supplementalDropdown
    ).queryByRole("button", { name: "Denominator" });
    expect(selectedSupplementalOption1).not.toBe(null);
    const selectedSupplementalOption2 = within(
      supplementalDropdown
    ).queryByRole("button", {
      name: "Encounter With Age Range and Without VTE Diagnosis or Obstetrical Conditions",
    });
    expect(selectedSupplementalOption2).not.toBe(null);

    fireEvent.click(screen.getByTestId("cancel-button"));
    const cancelButton = screen.getByTestId("cancel-button");
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton).toBeEnabled();
    fireEvent.click(cancelButton);
    const discardDialog = await screen.getByTestId("discard-dialog");
    expect(discardDialog).toBeInTheDocument();
    expect(screen.queryByText("You have unsaved changes.")).toBeVisible();
    const discardDialogCancelButton = screen.getByTestId(
      "discard-dialog-cancel-button"
    );
    expect(discardDialogCancelButton).toBeInTheDocument();
    fireEvent.click(discardDialogCancelButton);
    await waitFor(() => {
      expect(screen.queryByText("You have unsaved changes.")).not.toBeVisible();
    });
  });

  it("should display toast when there is no measure CQL", async () => {
    mockMeasure.cql = "";
    render(<SupplementalElements setErrorMessage={setErrorMessage} />);

    await act(async () => {
      const supplementalDropdown = await screen.findByTestId(
        "supplementalDataElements"
      );
      fireEvent.keyDown(supplementalDropdown, { key: "ArrowDown" });

      const supplementalOptions = await screen.queryAllByRole("option");
      expect(supplementalOptions).toHaveLength(0);

      const errorToast = screen.getByTestId("supplementalDataElement-error");
      expect(errorToast).toBeInTheDocument();
      expect(errorToast).toHaveTextContent(
        "Please complete the CQL Editor process before continuing"
      );
    });
  });
});
