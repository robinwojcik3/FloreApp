const fs = require('fs');
const vm = require('vm');

function createDummyDocument() {
  return {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  };
}

function loadApp(extraCtx = {}) {
  const code = fs.readFileSync('app.js', 'utf-8');
  const defaultFetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  });
  const dummyDocument = createDummyDocument();
  const ctx = {
    console,
    fetch: defaultFetch,
    toggleSpinner: jest.fn(),
    showNotification: jest.fn(),
    window: {},
    document: dummyDocument,
    ...extraCtx
  };
  ctx.window.document = dummyDocument;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

function loadHandler(mockFetch) {
  const code = fs.readFileSync('netlify/functions/inpn-proxy.js', 'utf-8');
  const patched = code.replace(
    /const fetch = \(\.\.\.args\) => import\("node-fetch"\)\.then\(\(\{default: f\}\) => f\(\.\.\.args\)\);/,
    'const fetch = (...args) => global.__fetch(...args);'
  );
  const context = { require, console, exports: {}, __fetch: mockFetch };
  context.global = context;
  vm.createContext(context);
  vm.runInContext(patched, context);
  return context.exports.handler;
}

function mockFetch(html) {
  return jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html)
  });
}

module.exports = { loadApp, loadHandler, mockFetch };
