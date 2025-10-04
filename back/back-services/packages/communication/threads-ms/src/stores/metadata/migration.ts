// Пример использования
const migrations: Migration[] = [
    {
      id: '001_create_users',
      up: async () => console.log('Creating users table'),
      down: async () => console.log('Dropping users table')
    }
    
  ];
  
   const migrator = new Migrator(migrations, storage);
  
  // Запуск миграций
  await migrator.up();
  
  // Откат миграций
  //await migrator.down(1);