import { BaseRepositoryFile, FileStore, FileKey, KeyFile, generateULID } from "back-core";

class VideoThumbKey implements KeyFile {
  constructor(
    private readonly streamId: string,
    private readonly year: string,
    private readonly month: string,
    private readonly day: string,
    private readonly name: string,
    private readonly ext: string,
  ) {}

  static fromDate(streamId: string, date: Date, name: string, ext: string) {
    const y = date.getFullYear().toString();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return new VideoThumbKey(streamId, y, m, d, name, ext);
  }

  build(): FileKey {
    return `thumbs/${this.streamId}/${this.year}/${this.month}/${this.day}/${this.name}.${this.ext}`;
  }
}

class VideoThumbsRepository extends BaseRepositoryFile<VideoThumbKey> {
  constructor(store: FileStore) {
    super(store);
  }
}

export class VideoThumbsStoreService {
  constructor(private repo: VideoThumbsRepository) {}

  async save(streamId: string, data: Uint8Array, ext: string = "jpg"): Promise<string> {
    const now = new Date();
    const name = `${this.formatDate(now)}__${generateULID()}`;
    const key = VideoThumbKey.fromDate(streamId, now, name, ext);
    await this.repo.save(key, data);
    return key.build();
  }

  async get(path: string): Promise<Uint8Array | undefined> {
    return this.repo.get({ build: () => path } as KeyFile);
  }

  async delete(path: string): Promise<boolean> {
    return this.repo.delete({ build: () => path } as KeyFile);
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
}

export function createVideoThumbsService(store: FileStore): VideoThumbsStoreService {
  return new VideoThumbsStoreService(new VideoThumbsRepository(store));
}
