import * as SQLite from 'expo-sqlite';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private inTransaction = false;

  async init(): Promise<void> {
    if (this.db) return;
    
    // expo-sqlite automatically handles the correct directory on each platform
    this.db = await SQLite.openDatabaseAsync('mrae.sqlite');
    
    // expo-sqlite automatically uses WAL mode by default in newer versions, 
    // but we can explicitly enable it if needed, or run other setup.
    await this.db.execAsync('PRAGMA journal_mode=WAL');
    await this.db.execAsync('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
    await this.initImageIndex();
    await this.initImageLabels();
    await this.initUserPreferences();
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

  async initImageIndex(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.execAsync(`
      CREATE TABLE IF NOT EXISTS image_index (
        id TEXT PRIMARY KEY,
        uri TEXT,
        embedding BLOB,
        latitude REAL,
        longitude REAL,
        city TEXT,
        timestamp INTEGER
      )
    `);
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_image_time ON image_index(timestamp)');
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_image_city ON image_index(city)');
  }

  async initImageLabels(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.execAsync(`
      CREATE TABLE IF NOT EXISTS image_labels (
        image_id TEXT,
        label TEXT,
        score REAL,
        PRIMARY KEY(image_id, label)
      )
    `);
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_labels_label ON image_labels(label)');
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_labels_image ON image_labels(image_id)');
  }

  async initUserPreferences(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.execAsync(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id TEXT NOT NULL,
        feedback_tag TEXT NOT NULL,
        embedding_vector BLOB NOT NULL,
        UNIQUE(image_id, feedback_tag)
      )
    `);
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_user_pref_tag ON user_preferences(feedback_tag)');
    await this.db!.execAsync('CREATE INDEX IF NOT EXISTS idx_user_pref_image ON user_preferences(image_id)');
  }

  async getImageIndexIds(): Promise<string[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.getAllAsync('SELECT id FROM image_index');
    return rows.map((r: any) => r.id);
  }

  async beginTransaction(): Promise<void> {
    if (!this.db) await this.init();
    
    // Prevent nested transactions
    if (this.inTransaction) {
      console.warn('⚠️ Transaction already active, skipping BEGIN');
      return;
    }
    
    await this.db!.execAsync('BEGIN TRANSACTION');
    this.inTransaction = true;
  }

  async commitTransaction(): Promise<void> {
    if (!this.db) await this.init();
    
    if (!this.inTransaction) {
      console.warn('⚠️ No active transaction to commit');
      return;
    }
    
    await this.db!.execAsync('COMMIT');
    this.inTransaction = false;
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.db) await this.init();
    
    if (!this.inTransaction) {
      console.warn('⚠️ No active transaction to rollback');
      return;
    }
    
    await this.db!.execAsync('ROLLBACK');
    this.inTransaction = false;
  }

  async insertImageIndex(entry: {
    id: string;
    uri: string;
    embedding: Uint8Array;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    timestamp: number;
  }): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO image_index (id, uri, embedding, latitude, longitude, city, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.uri,
        entry.embedding,
        entry.latitude,
        entry.longitude,
        entry.city,
        entry.timestamp,
      ]
    );
  }

  async insertImageLabel(item: { image_id: string; label: string; score: number }): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO image_labels (image_id, label, score) VALUES (?, ?, ?)`,
      [item.image_id, item.label, item.score]
    );
  }

  async clearLabelsByLabel(label: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.runAsync(`DELETE FROM image_labels WHERE label = ?`, [label]);
  }

  async insertUserPreference(pref: { image_id: string; feedback_tag: string; embedding_vector: Uint8Array }): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.runAsync(
      `INSERT OR REPLACE INTO user_preferences (image_id, feedback_tag, embedding_vector) VALUES (?, ?, ?)`,
      [pref.image_id, pref.feedback_tag, pref.embedding_vector]
    );
  }

  async getPreferenceEmbeddingsByTag(tag: string): Promise<Float32Array[]> {
    if (!this.db) await this.init();
    const rows = await this.getAll('SELECT embedding_vector FROM user_preferences WHERE feedback_tag = ?', [tag]);
    return rows.map((r: any) => {
      const buf = r.embedding_vector;
      if (buf instanceof Uint8Array) return new Float32Array(buf.buffer);
      if (Array.isArray(buf)) return new Float32Array(buf);
      if (buf?.buffer && typeof buf.length === 'number') return new Float32Array(buf.buffer);
      return new Float32Array(0);
    });
  }

  async getPhotoMetadata(photoId: string): Promise<{
    id: string;
    uri: string;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    timestamp: number | null;
  } | null> {
    if (!this.db) await this.init();

    try {
      const rows = await this.getAll(
        'SELECT id, uri, latitude, longitude, city, timestamp FROM image_index WHERE id = ?',
        [photoId]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as any;
      return {
        id: row.id,
        uri: row.uri,
        latitude: row.latitude,
        longitude: row.longitude,
        city: row.city,
        timestamp: row.timestamp,
      };
    } catch (error) {
      console.error(`Error fetching photo metadata for ${photoId}:`, error);
      return null;
    }
  }

  async getPhotosByLabel(label: string, threshold: number = 0.25): Promise<string[]> {
    if (!this.db) await this.init();
    const rows = await this.getAll(
      'SELECT image_id FROM image_labels WHERE label = ? AND score >= ? ORDER BY score DESC',
      [label, threshold]
    );
    return rows.map((r: any) => r.image_id);
  }

  async getAllLabels(): Promise<Array<{ label: string; count: number }>> {
    if (!this.db) await this.init();
    const rows = await this.getAll(
      'SELECT label, COUNT(*) as count FROM image_labels GROUP BY label ORDER BY count DESC'
    );
    return rows.map((r: any) => ({ label: r.label, count: r.count }));
  }
}

export default new DatabaseService();
