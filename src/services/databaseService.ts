import * as SQLite from 'expo-sqlite';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    
    // expo-sqlite automatically handles the correct directory on each platform
    this.db = await SQLite.openDatabaseAsync('mrae.sqlite');
    
    // expo-sqlite automatically uses WAL mode by default in newer versions, 
    // but we can explicitly enable it if needed, or run other setup.
    await this.db.execAsync('PRAGMA journal_mode=WAL');
    await this.db.execAsync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
  }

  // Wrapper to maintain some compatibility with previous interface, 
  // but note that expo-sqlite operations are all async.
  async execute(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (!this.db) await this.init();
    
    // runAsync is for INSERT/UPDATE/DELETE (returns run result like lastInsertRowId)
    // getAllAsync is for SELECT (returns array of rows)
    // To keep it generic like the previous 'execute', we might need to detect the query type
    // or just provide specific methods. 
    // However, 'execute' in many sqlite wrappers returns everything.
    // expo-sqlite split this into `runAsync` and `getAllAsync` / `getFirstAsync`.
    
    // Heuristic: if it starts with SELECT, use getAllAsync
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    
    if (isSelect) {
      const rows = await this.db!.getAllAsync(sql, params);
      return { rows };
    } else {
      const result = await this.db!.runAsync(sql, params);
      // Map runAsync result to something resembling the old structure if needed,
      // or just return empty rows for non-selects to match { rows: any } signature partially.
      // The previous library returned { rows: ... } even for inserts? 
      // Let's just return an empty array for rows on non-selects to be safe.
      return { rows: [] }; 
    }
  }

  // Provide a specific method for run operations if the caller needs metadata (insertId, etc)
  async run(sql: string, params: any[] = []) {
    if (!this.db) await this.init();
    return this.db!.runAsync(sql, params);
  }
  
  // Provide a specific method for select operations
  async getAll(sql: string, params: any[] = []) {
    if (!this.db) await this.init();
    return this.db!.getAllAsync(sql, params);
  }
}

export default new DatabaseService();
