import { createContext } from "react";
import Measure from "../../models/Measure";

export interface MeasureContextHolder {
  measure: Measure;
  setMeasure: (measure: Measure) => void;
}

const MeasureContext = createContext<MeasureContextHolder>(null);

export default MeasureContext;

export const MeasureContextProvider = MeasureContext.Provider;
export const MeasureContextConsumer = MeasureContext.Consumer;