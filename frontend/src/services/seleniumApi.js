export async function triggerRun(lat, lon) {
  const url = `/run?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  try {
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Error triggering Selenium workflow:', err);
    throw err;
  }
}
