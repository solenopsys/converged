import fs from "fs";
import path from "path";

export class ModuleController {
  private modules = new Map<string, any>();
  
  constructor(private tempDir: string) {
    // Создаем временную директорию если она не существует
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Сохраняет код во временный файл
   */
  saveCodeToTemp(codeHash: string, codeBody: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const fileName = `${codeHash}.js`;
        const absolutePath = path.resolve(this.tempDir, fileName);
        
        fs.writeFile(absolutePath, codeBody, (err) => {
            if (err) reject(err);
            else resolve(absolutePath);
        });
    });
}
  /**
   * Загружает модуль из файла
   */
  private async importModule(codeHash: string, filePath: string): Promise<any> {
    try {
      // Очищаем кеш модуля для возможности перезагрузки
      delete require.cache[require.resolve(filePath)];
      
      const module = await import(filePath);
      this.modules.set(codeHash, module);
      return module;
    } catch (error) {
      throw new Error(`Failed to import module ${codeHash}: ${error}`);
    }
  }

  /**
   * Получает загруженный модуль из кеша
   */
  private getModule(codeHash: string): any {
    const module = this.modules.get(codeHash);
    if (!module) {
      throw new Error(`Module ${codeHash} not found in cache`);
    }
    return module;
  }

  /**
   * Основной метод для загрузки и получения модуля
   */
  async loadAndGetModule(codeHash: string, codeBody: string): Promise<any> {
    // Проверяем, есть ли модуль уже в кеше
    if (this.modules.has(codeHash)) {
      return this.getModule(codeHash);
    }

    // Сохраняем код во временный файл
    const filePath = await this.saveCodeToTemp(codeHash, codeBody);
    
    // Импортируем модуль
    const module = await this.importModule(codeHash, filePath);
    
    return module;
  }



  /**
   * Очищает кеш модуля
   */
  clearModuleCache(codeHash: string): void {
    this.modules.delete(codeHash);
  }

  /**
   * Очищает все модули из кеша
   */
  clearAllModules(): void {
    this.modules.clear();
  }

  /**
   * Удаляет временный файл
   */
  cleanupTempFile(codeHash: string): void {
    const filePath = path.join(this.tempDir, `${codeHash}.js`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}