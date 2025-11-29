import dbService from '../services/databaseService';

export async function testDatabase(): Promise<boolean> {
  try {
    await dbService.init();
    await dbService.execute('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', ['setup', 'ok']);
    const result = await dbService.execute('SELECT value FROM meta WHERE key = ?', ['setup']);
    const rows = result.rows as any[];
    const ok = !!rows?.[0]?.value;
    return !!ok;
  } catch {
    return false;
  }
}
