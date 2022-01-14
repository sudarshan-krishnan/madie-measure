import React, { useState } from "react";
import "twin.macro";
import "styled-components/macro";
import { Button } from "@madie/madie-components";
import { useHistory } from "react-router-dom";
import MeasureList from "../measureList/MeasureList";
import Measure from "../../models/Measure";

import { getServiceConfig, ServiceConfig } from "../config/Config";
import axios from "axios";
import { useOktaAuth } from "@okta/okta-react";
import { useOktaTokens } from "../../hooks/useOktaJwt";

export default function NewMeasure() {
  const history = useHistory();
  const [measureList, setMeasureList] = useState<Measure[]>([]);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>();
  const [serviceConfigErr, setServiceConfigErr] = useState<string>();
  const { oktaAuth, authState } = useOktaAuth();
  const { getAccessToken } = useOktaTokens();

  if (!serviceConfig && !serviceConfigErr) {
    (async () => {
      const config: ServiceConfig = await getServiceConfig();
      setServiceConfig(config);
      axios
        .get(config?.measureService?.baseUrl + "/measures", {
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        })
        .then((response) => {
          setMeasureList(response.data as Array<Measure>);
        })
        .catch((err) => {
          setServiceConfigErr(
            "Unable to load page, please contact the site administration"
          );
        });
    })();
  }
  return (
    <>
      <span>Welcome </span>
      <Button
        buttonTitle="New Measure"
        tw="mr-4"
        onClick={() => history.push("/measure/create")}
        data-testid="create-new-measure-button"
      />
      <Button
        buttonTitle="Debug Okta"
        tw="mr-4"
        onClick={() => {
          // console.log("okta: ", okta);
          // eslint-disable-next-line no-console
          console.log("okta auth: ", oktaAuth);
          // eslint-disable-next-line no-console
          console.log("auth state: ", authState);
          // eslint-disable-next-line no-console
          console.log("okta accessToken: ", getAccessToken());
        }}
        data-testid="debug"
      />
      <div tw="mx-5 my-8">
        <MeasureList measureList={measureList} />
      </div>
    </>
  );
}
