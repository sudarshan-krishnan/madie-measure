import * as React from "react";
import { render, cleanup } from "@testing-library/react";
import MeasureDefinitionRow from "./MeasureMetaDataRow";

afterEach(cleanup);

describe("Measure MetaData Row Component", () => {
  it("Measure MetaData rows renders Measure Reference", async () => {
    const { getByText } = render(
      <MeasureDefinitionRow
        name="MeasureReference"
        description="Measure reference description"
      />
    );
    const name = getByText("MeasureReference");
    expect(name).toBeInTheDocument();
    const description = getByText("Measure reference description");
    expect(description).toBeInTheDocument();
  });

  it("Measure MetaData rows renders MeasureDefinition", () => {
    const { getByText, getByTestId } = render(
      <MeasureDefinitionRow
        name="term"
        description="I'm a measure definition"
        id="test measure definition id"
        handleEdit={jest.fn()}
      />
    );
    const term = getByText("term");
    expect(term).toBeInTheDocument();
    const definition = getByText("I'm a measure definition");
    expect(definition).toBeInTheDocument();

    const editButton = getByTestId(
      "measure-definition-edit-test measure definition id"
    );
    expect(editButton).toBeInTheDocument();
  });
});