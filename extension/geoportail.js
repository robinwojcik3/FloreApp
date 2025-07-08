// Automation for Geoportail soil map
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'COORDS') return;
  const { lat, lon } = msg;
  console.log('Geoportail automation started with', lat, lon);
  // Here we would fill the coordinate search fields and adjust zoom
});
