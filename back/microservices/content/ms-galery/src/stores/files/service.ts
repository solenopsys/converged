import sharp from "sharp";
import { generateULID } from "back-core";
import { GaleryFilesRepository } from "./repository";
import { GaleryFileKey } from "./keys";

const THUMB_WIDTH = 320;
const THUMB_EXT = "jpg";

export class GaleryFilesStoreService {
  constructor(private repo: GaleryFilesRepository) {}

  async saveImageWithThumbnail(
    data: Uint8Array,
    originalName?: string,
    mimeType?: string,
  ): Promise<{ filePath: string; thumbPath: string }> {
    const now = new Date();
    const baseName = `${this.formatDate(now)}__${generateULID()}`;
    const ext = this.resolveExtension(originalName, mimeType) ?? "bin";

    const imageKey = GaleryFileKey.fromDate("images", now, baseName, ext);
    const thumbKey = GaleryFileKey.fromDate(
      "thumbs",
      now,
      `${baseName}_thumb`,
      THUMB_EXT,
    );

    const filePath = imageKey.build();
    const thumbPath = thumbKey.build();

    await this.repo.save(imageKey, data);

    const thumbBuffer = await sharp(data)
      .resize({ width: THUMB_WIDTH })
      .jpeg({ quality: 80 })
      .toBuffer();

    await this.repo.save(thumbKey, new Uint8Array(thumbBuffer));

    return { filePath, thumbPath };
  }

  async deleteImage(filePath: string, thumbPath: string): Promise<void> {
    await this.repo.delete(new GaleryFileKey(filePath));
    await this.repo.delete(new GaleryFileKey(thumbPath));
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    const hh = date.getHours().toString().padStart(2, "0");
    const mm = date.getMinutes().toString().padStart(2, "0");
    const ss = date.getSeconds().toString().padStart(2, "0");
    return `${y}${m}${d}_${hh}${mm}${ss}`;
  }

  private resolveExtension(
    originalName?: string,
    mimeType?: string,
  ): string | undefined {
    const extFromName = originalName
      ? originalName.split(".").pop()?.toLowerCase()
      : undefined;

    if (extFromName) {
      return extFromName;
    }

    switch (mimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      default:
        return undefined;
    }
  }
}
