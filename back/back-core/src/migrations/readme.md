import type { Migration } from '../types';

const migration: Migration = {
  id: '001_create_users',

  async up() {
    // ваш код
  },

  async down() {
    // откат
  }
};

export default migration;


const migrator = new Migrator();
await migrator.up();    // запустить все
await migrator.down(2); // откатить 2