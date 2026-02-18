import * as fs from "fs/promises";
import * as path from "path";
import { HashString, PaginatedResult, PaginationParams } from '../../../../../../../types/store';

export class StoreFileService {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    async init(): Promise<void> {
        await fs.mkdir(this.basePath, { recursive: true });
    }

    private getFilePath(hash: HashString): string {
        // Используем первые 3 символа хеша как имя директории
        const prefix = hash.slice(0, 3);
        return path.join(this.basePath, prefix, hash);
    }

    private getDirPath(hash: HashString): string {
        const prefix = hash.slice(0, 3);
        return path.join(this.basePath, prefix);
    }

    async save(data: Uint8Array): Promise<HashString> {
        // Генерируем хеш из данных
        const hashNum = Bun.hash(data);
        const hash = hashNum.toString(16).padStart(16, '0');

        const dirPath = this.getDirPath(hash);
        const filePath = this.getFilePath(hash);

        // Создаем директорию если не существует
        await fs.mkdir(dirPath, { recursive: true });

        // Записываем данные в файл
        await fs.writeFile(filePath, data);

        return hash;
    }

    async saveWithHash(hash: HashString, data: Uint8Array): Promise<HashString> {
        const dirPath = this.getDirPath(hash);
        const filePath = this.getFilePath(hash);

        // Создаем директорию если не существует
        await fs.mkdir(dirPath, { recursive: true });

        // Записываем данные в файл
        await fs.writeFile(filePath, data);

        return hash;
    }

    async delete(hash: HashString): Promise<void> {
        const filePath = this.getFilePath(hash);
        try {
            await fs.unlink(filePath);
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
    }

    async get(hash: HashString): Promise<Uint8Array> {
        const filePath = this.getFilePath(hash);
        const data = await fs.readFile(filePath);
        return new Uint8Array(data);
    }

    async exists(hash: HashString): Promise<boolean> {
        const filePath = this.getFilePath(hash);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async list(params: PaginationParams): Promise<PaginatedResult<HashString>> {
        const items: HashString[] = [];
        let totalCount = 0;

        try {
            // Читаем все директории (префиксы)
            const prefixDirs = await fs.readdir(this.basePath);

            for (const prefix of prefixDirs) {
                const prefixPath = path.join(this.basePath, prefix);
                const stat = await fs.stat(prefixPath);

                if (stat.isDirectory()) {
                    const files = await fs.readdir(prefixPath);
                    totalCount += files.length;

                    // Добавляем файлы с учетом пагинации
                    for (const file of files) {
                        if (items.length >= params.offset && items.length < params.offset + params.limit) {
                            items.push(file);
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        return {
            items: items.slice(0, params.limit),
            totalCount
        };
    }

    async storeStatistic(): Promise<any> {
        let totalFiles = 0;
        let totalSize = 0;
        const prefixStats: Record<string, { count: number; size: number }> = {};

        try {
            const prefixDirs = await fs.readdir(this.basePath);

            for (const prefix of prefixDirs) {
                const prefixPath = path.join(this.basePath, prefix);
                const stat = await fs.stat(prefixPath);

                if (stat.isDirectory()) {
                    const files = await fs.readdir(prefixPath);
                    let prefixSize = 0;

                    for (const file of files) {
                        const filePath = path.join(prefixPath, file);
                        const fileStat = await fs.stat(filePath);
                        prefixSize += fileStat.size;
                        totalSize += fileStat.size;
                    }

                    totalFiles += files.length;
                    prefixStats[prefix] = { count: files.length, size: prefixSize };
                }
            }
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        return {
            totalFiles,
            totalSize,
            prefixStats,
            basePath: this.basePath
        };
    }
}
