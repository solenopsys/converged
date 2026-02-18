import type { FileKey, KeyFile } from "back-core";

export type GaleryFileKind = "images" | "thumbs";

export class GaleryFileKey implements KeyFile {
  constructor(
    private readonly kind: GaleryFileKind,
    private readonly year: string,
    private readonly month: string,
    private readonly day: string,
    private readonly name: string,
    private readonly ext: string,
  ) {}

  static fromDate(
    kind: GaleryFileKind,
    date: Date,
    name: string,
    ext: string,
  ): GaleryFileKey {
    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return new GaleryFileKey(kind, y, m, d, name, ext);
  }

  build(): FileKey {
    return `${this.kind}/${this.year}/${this.month}/${this.day}/${this.name}.${this.ext}`;
  }
}
