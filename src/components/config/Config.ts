import axios from "axios";

export interface ServiceConfig {
  measureService: {
    baseUrl: string;
  };
}

export async function getServiceConfig(): Promise<ServiceConfig> {
  const serviceConfig: ServiceConfig = (
    await axios.get<ServiceConfig>("/env-config/serviceConfig.json")
  ).data;
  if (
    !(serviceConfig?.measureService && serviceConfig.measureService.baseUrl)
  ) {
    throw new Error("Invalid Service Config");
  }

  return serviceConfig;
}
