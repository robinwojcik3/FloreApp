export async function triggerRun(lat, lon) {
  const url = `/run?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
  try {
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Request failed');
    }
    return await response.json();
  } catch (err) {
    console.error('Selenium API error:', err);
    throw err;
  }
}

