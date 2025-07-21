export async function triggerRun(lat, lon) {
  const url = `/run?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  try {
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Selenium API error', err);
    return { status: 'error', message: err.message };
  }
}
