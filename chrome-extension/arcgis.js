(function() {
  const xpath = "//button[normalize-space()='OK']";
  const res = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  const btn = res.singleNodeValue;
  if (btn) btn.click();
})();
