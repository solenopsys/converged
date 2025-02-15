import CacheStore from "./tools/db.ts";

// Пример использования:
async function example() {
   const store = new CacheStore('./cache/meta.json');
   
   // Сохранение хеша директории
 //  await store.setHashDir('dir1', 'hash123');
   
   // Получение данных
   const hashData = await store.getHashDir('dir1');
   console.log('Hash data:', hashData);
}

example();