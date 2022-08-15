import React from "react";
import * as _ from "lodash";
import MeasureGroupPopulationSelect from "./MeasureGroupPopulationSelect";
import { ExpressionDefinition } from "./MeasureGroups";
import { GroupScoring, Population, PopulationType } from "@madie/madie-models";
import { FieldInputProps } from "formik/dist/types";
import { findPopulations } from "./PopulationHelper";

export enum InitialPopulationAssociationType {
  DENOMINATOR = "Denominator",
  NUMERATOR = "Numerator",
}

type Props = {
  field: FieldInputProps<string>;
  cqlDefinitions: ExpressionDefinition[];
  populations: Population[];
  population: Population;
  populationIndex: number;
  scoring: string;
  canEdit: boolean;
  insertCallback: any;
  removeCallback: any;
  replaceCallback: any;
};

const GroupPopulation = ({
  field,
  cqlDefinitions,
  populations,
  population,
  populationIndex,
  scoring,
  canEdit,
  insertCallback,
  removeCallback,
  replaceCallback,
}: Props) => {
  // Helper function do determine the properties for a select item
  const populationSelectorProperties = (fieldProps: any, scoring: String) => {
    const hidden = fieldProps.hidden?.includes(scoring);
    const required =
      !fieldProps.optional?.includes("*") &&
      !fieldProps.optional?.includes(scoring);
    return {
      label: _.startCase(field.name),
      hidden,
      required,
      name: field.name,
      options: cqlDefinitions,
      subTitle: fieldProps.subTitle,
    };
  };

  const showAddPopulationLink = (
    scoring: string,
    populations: Population[]
  ) => {
    // For ratio group
    if (scoring === GroupScoring.RATIO) {
      const ips = findPopulations(
        populations,
        PopulationType.INITIAL_POPULATION
      );
      // if IP is one, add second IP link is shown
      return (
        ips &&
        ips.length === 1 &&
        population.name === PopulationType.INITIAL_POPULATION
      );
    }
    return false;
  };

  const isPopulationRemovable = (
    scoring: string,
    populations: Population[]
  ) => {
    // for ratio measure
    if (scoring === GroupScoring.RATIO) {
      const ips = findPopulations(
        populations,
        PopulationType.INITIAL_POPULATION
      );
      // if there are 2 IPs, remove IP link is shown for second IP
      return ips && ips.length === 2 && populationIndex === 1;
    }
    return false;
  };

  // when new copy of this population is added, label needs to be adjusted
  // e.g. Initial Population becomes "Initial Population 1"
  // If more than one IP, second IP becomes "Initial Population 2"
  const correctPopulationLabel = (
    populations: Population[],
    population: Population
  ) => {
    const label = _.startCase(population.name);
    const filteredPopulations = findPopulations(populations, population.name);
    if (filteredPopulations.length > 1) {
      return `${label} ${populationIndex + 1}`;
    }
    return label;
  };

  // add copy of this population
  const addPopulation = () => {
    let secondAssociation = undefined;
    if (scoring === GroupScoring.RATIO) {
      const ip = populations[populationIndex];
      if (
        ip?.associationType === InitialPopulationAssociationType.DENOMINATOR
      ) {
        secondAssociation = InitialPopulationAssociationType.NUMERATOR;
      } else if (
        ip?.associationType === InitialPopulationAssociationType.NUMERATOR
      ) {
        secondAssociation = InitialPopulationAssociationType.DENOMINATOR;
      }
    }
    insertCallback(populationIndex + 1, {
      id: populationIndex + 1,
      name: population.name,
      definition: "",
      associationType: secondAssociation,
    });
  };

  const getAssociationType = (label) => {
    if (scoring === GroupScoring.RATIO) {
      if (
        (label === "Initial Population" || label === "Initial Population 1") &&
        population.associationType === undefined
      ) {
        population.associationType =
          InitialPopulationAssociationType.DENOMINATOR;
      } else if (
        label === "Initial Population 2" &&
        population.associationType === undefined
      ) {
        population.associationType = InitialPopulationAssociationType.NUMERATOR;
      }
    }
    return population.associationType;
  };

  //find the other initial population (if any) and change the association type to the opposite
  const changeAssociation = () => {
    if (scoring === GroupScoring.RATIO) {
      const ips = findPopulations(
        populations,
        PopulationType.INITIAL_POPULATION
      );
      if (ips && ips.length === 2) {
        ips.forEach((ip) => {
          if (ip.id !== population.id) {
            if (
              population.associationType ===
              InitialPopulationAssociationType.DENOMINATOR
            ) {
              ip.associationType = InitialPopulationAssociationType.NUMERATOR;
            } else if (
              population.associationType ===
              InitialPopulationAssociationType.NUMERATOR
            ) {
              ip.associationType = InitialPopulationAssociationType.DENOMINATOR;
            }
            const index = findIndex(ip, populations);
            replaceCallback(index, ip);
          }
        });
      } else {
        replaceCallback(populationIndex, population);
      }
    }
  };
  const findIndex = (population: Population, populations: Population[]) => {
    for (let index = 0; index < populations?.length; index++) {
      const temp = populations[index];
      if (population.id === temp.id) {
        return index;
      }
    }
  };

  const selectorProps = populationSelectorProperties(population, scoring);
  const touched = _.get(populations, selectorProps.name);
  const error = !!touched ? _.get(populations, selectorProps.name) : null;
  const isRemovable = isPopulationRemovable(scoring, populations);
  const canBeAdded = showAddPopulationLink(scoring, populations);
  selectorProps.label = correctPopulationLabel(populations, population);
  population.associationType = getAssociationType(selectorProps.label);

  return (
    <MeasureGroupPopulationSelect
      {...selectorProps}
      {...field}
      helperText={error}
      error={!!error && !!touched}
      canEdit={canEdit}
      removePopulationCallback={() => removeCallback(populationIndex)}
      isRemovable={isRemovable}
      showAddPopulationLink={canBeAdded}
      addPopulationCallback={addPopulation}
      scoring={scoring}
      population={population}
      changeAssociationCallback={() => changeAssociation()}
    />
  );
};

export default GroupPopulation;
