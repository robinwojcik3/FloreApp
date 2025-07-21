export async function triggerRun(lat, lon) {
  try {
    const res = await fetch(`/run?lat=${lat}&lon=${lon}`, {
      method: 'POST'
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.status;
  } catch (err) {
    console.error('Selenium API error', err);
    return 'error';
  }
}
