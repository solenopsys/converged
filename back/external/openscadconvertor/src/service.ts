import type {
  OpenScadConvertInput,
  OpenScadConvertResult,
  OpenScadConvertorService,
} from "g-openscadconvertor";
import { convertStepToGlb } from "./converter";

export class OpenScadConvertorServiceImpl implements OpenScadConvertorService {
  async convert(input: OpenScadConvertInput): Promise<OpenScadConvertResult> {
    return convertStepToGlb(input.sourceName, input.sourceData);
  }
}

export default OpenScadConvertorServiceImpl;
