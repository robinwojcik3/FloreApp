export async function triggerRun(lat, lon) {
  try {
    const response = await fetch(`/run?lat=${lat}&lon=${lon}`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Selenium API error', err);
    return { error: err.message };
  }
}
