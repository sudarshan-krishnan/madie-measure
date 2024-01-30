import React from "react";
// we will have two different renders so far
// measureMetaData.measureDefinition = [{term, definition}];
// measureMetaData.measureReferences = [{referenceText, ReferenceType}]
import { MeasureDefinition } from "../../editMeasure/details/MeasureDefinitions/MeasureDefinitions";
import { Button } from "@madie/madie-design-system/dist/react";

interface MeasureMetaDataRowProps {
  name: string;
  description: string;
  id?: string;
  handleEdit?: Function;
}

const MeasureMetaDataRow = (props: MeasureMetaDataRowProps) => {
  const { name, description, id, handleEdit } = props;

  return (
    <tr>
      <td>{name}</td>
      <td>{description}</td>
      {id && (
        <td>
          <Button
            variant="outline-secondary"
            name="Edit"
            onClick={(e) => {
              handleEdit(id);
            }}
            data-testid={`measure-definition-edit-${id}`}
            aria-label={`Measure definition ${id}`}
            role="button"
            tab-index={0}
          >
            Edit
          </Button>
        </td>
      )}
    </tr>
  );
};
export default MeasureMetaDataRow;