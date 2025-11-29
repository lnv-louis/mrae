import dbService from '../services/databaseService';

export async function testDatabase(): Promise<boolean> {
  try {
    dbService.init();
    await dbService.executeAsync('INSERT OR REPLACE INTO meta(key, value) VALUES(?, ?)', ['setup', 'ok']);
    const result = await dbService.executeAsync('SELECT value FROM meta WHERE key = ?', ['setup']);
    const ok = !!result.rows?._array?.[0]?.value || !!result.rows?.item?.(0)?.value;
    return !!ok;
  } catch {
    return false;
  }
}

