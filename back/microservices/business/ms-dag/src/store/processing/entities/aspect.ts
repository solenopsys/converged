import { PrefixedRepositoryKV, PrefixKey, KeyKV } from "back-core";

export const ASPECT_PREFIX = "aspect";

export class AspectKey extends PrefixKey implements KeyKV {
  readonly prefix = ASPECT_PREFIX;

  constructor(
    private contextKey: string,
    private aspectId: string,
    private phase: string,
  ) {
    super();
  }

  build(): string[] {
    return [this.contextKey, this.prefix, this.aspectId, this.phase];
  }
}

export type AspectPhase = "start" | "end" | "error";

export type AspectValue = {
  id: string;
  aspect: string;
  phase: AspectPhase;
  ts: string;
  data?: any;
  error?: string;
};

export class AspectRepository extends PrefixedRepositoryKV<AspectKey, AspectValue> {
  getPrefix(): string[] {
    return [ASPECT_PREFIX];
  }
}
