// Automation for ArcGIS vegetation map
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'COORDS') return;
  const { lat, lon } = msg;
  // Example steps translated from Selenium
  const wait = (sel) => document.querySelector(sel);
  const click = (sel) => wait(sel).click();

  // Accept splash screen if present
  const splashBtn = document.querySelector("button[normalize-space='OK']");
  if (splashBtn) splashBtn.click();

  // Further DOM manipulations to set visibility and transparency would go here
  console.log('ArcGIS automation started with', lat, lon);
});
