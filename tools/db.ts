import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

class CacheStore {
    db: any;
    constructor(filePath) {
        // Определяем начальную структуру данных
        const defaultData = { 
            importconfMapping: { // key hash src dir  = value hash compiler lib
            },
            compileMapping: { // key hash src dir  = value hash compiler lib
            },
            packMapping: { // key pack name = value hash lib
            }
        };

        // Инициализируем базу данных
        this.db = new Low(new JSONFile(filePath), defaultData);
        
    }

    // Инициализация и чтение базы данных
    async init() {
        await this.db.read();
    }

    // Получить хеш директории
    async getHashDir(hashKey) {
        await this.init();
        return this.db.data.compileMapping[hashKey];
    }
     

    // Сохранить хеш директории
    async setHashDir(packName,importConfHash, hashKey, hashValue) {
        await this.init();
        this.db.data.compileMapping[hashKey] = hashValue;
        this.db.data.packMapping[packName] = hashValue;
        this.db.data.importconfMapping[hashValue] = importConfHash;
        await this.db.write();
    }

   

    // Удалить хеш директории
    async deleteHashDir(hashKey) {
        await this.init();
        delete this.db.data.compileMapping[hashKey];
        await this.db.write();
    }

    // Получить все данные
    async getAllData() {
        await this.init();
        return this.db.data;
    }

    // Очистить все данные
    async clearAll() {
        await this.init();
        this.db.data = {
            hm: {
                hashDir: {}
            }
        };
        await this.db.write();
    }
}




export default CacheStore;