import * as React from "react";
import tw from "twin.macro";
import { Route, Switch, useRouteMatch } from "react-router-dom";
import MeasureInformation from "./measureInformation/MeasureInformation";
import MeasureSteward from "./measureSteward/MeasureSteward";
import MeasureDescription from "./measureDescription/MeasureDescription";
import MeasureDetailsSidebar from "./MeasureDetailsSidebar";

const Grid = tw.div`grid grid-cols-4 gap-4 ml-6`;
const Content = tw.div`col-span-3`;

export default function EditMeasure() {
  const { path } = useRouteMatch();
  const stewardLink = `${path}/measure-steward`;
  const descriptionLink = `${path}/measure-description`;

  const links = [
    {
      title: "Measure Information",
      href: path,
    },
    {
      title: "Steward/Author",
      href: stewardLink,
    },
    {
      title: "Description",
      href: descriptionLink,
    },
  ];

  return (
    <>
      <Grid>
        <MeasureDetailsSidebar header="Edit Measure" links={links} />
        <Content>
          <Switch>
            <Route exact path={path}>
              <MeasureInformation />
            </Route>
            <Route path={stewardLink}>
              <MeasureSteward />
            </Route>
            <Route path={descriptionLink}>
              <MeasureDescription />
            </Route>
          </Switch>
        </Content>
      </Grid>
    </>
  );
}
