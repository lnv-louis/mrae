const cache = new Map<string, string | null>();

function keyFor(lat: number, lon: number): string {
  return `${lat.toFixed(6)},${lon.toFixed(6)}`;
}

async function fetchCity(lat: number, lon: number): Promise<string | null> {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const city = json.city || json.locality || json.principalSubdivision || null;
    return typeof city === 'string' && city.length > 0 ? city : null;
  } catch {
    return null;
  }
}

export async function reverseGeocodeToCity(lat: number, lon: number): Promise<string | null> {
  const k = keyFor(lat, lon);
  if (cache.has(k)) return cache.get(k) ?? null;
  const city = await fetchCity(lat, lon);
  cache.set(k, city);
  return city;
}

export default { reverseGeocodeToCity };

