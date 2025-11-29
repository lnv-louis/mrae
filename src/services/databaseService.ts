import { Platform } from 'react-native';
import { open, IOS_LIBRARY_PATH, ANDROID_DATABASE_PATH } from '@op-engineering/op-sqlite';

class DatabaseService {
  private db: any | null = null;
  private initialized = false;

  init(): void {
    if (this.initialized && this.db) return;
    this.db = open({
      name: 'mrae.sqlite',
      location: Platform.OS === 'ios' ? IOS_LIBRARY_PATH : ANDROID_DATABASE_PATH,
    });
    this.db.execute('PRAGMA journal_mode=WAL');
    this.db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
    this.initialized = true;
  }

  execute(sql: string, params?: any[]): { rows: any } {
    if (!this.db) this.init();
    return this.db.execute(sql, params);
  }

  executeAsync(sql: string, params?: any[]): Promise<{ rows: any }> {
    if (!this.db) this.init();
    return this.db.executeAsync(sql, params);
  }
}

export default new DatabaseService();

