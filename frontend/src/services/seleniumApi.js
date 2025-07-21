export async function triggerRun(lat, lon) {
  try {
    const response = await fetch(`/run?lat=${lat}&lon=${lon}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Selenium API error', err);
    return { error: err.message };
  }
}
