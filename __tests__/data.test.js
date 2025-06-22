const { loadApp } = require('../test-utils');
const vm = require('vm');

function loadAppWithExports(extraCtx = {}) {
  const ctx = loadApp(extraCtx);
  vm.runInContext('globalThis.__extract = { taxref, ecology, trigramIndex, criteres, physionomie };', ctx);
  vm.runInContext('globalThis.__cdRef = cdRef; globalThis.__ecolOf = ecolOf;', ctx);
  return ctx;
}

describe('data loading', () => {
  test('loadData builds lookup tables', async () => {
    const fetchMock = jest.fn((url) => {
      if (url === 'taxref.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ 'Abies alba': 1 }) });
      }
      if (url === 'ecology.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ 'abies alba': 'forest' }) });
      }
      if (url === 'assets/flora_gallica_toc.json' || url === 'assets/florealpes_index.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url === 'Criteres_herbier.json') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ species: 'Abies alba', description: 'desc' }]) });
      }
      if (url === 'Physionomie.csv') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('Abies alba;phy\n') });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    const ctx = loadAppWithExports({ fetch: fetchMock });
    await ctx.loadData();
    const code = ctx.__cdRef('Abies alba');
    expect(code).toBe(1);
    const tri = ctx.makeTrigram('Abies alba');
    expect(ctx.__extract.trigramIndex[tri]).toContain('Abies alba');
    expect(ctx.__ecolOf('Abies alba')).toBe('forest');
    const key = ctx.norm('Abies alba');
    expect(ctx.__extract.criteres[key]).toBe('desc');
    expect(ctx.__extract.physionomie[key]).toBe('phy');
  });
});

describe('comparison helpers', () => {
  test('parseComparisonText splits intro and table', () => {
    const ctx = loadApp();
    const text = 'Intro line 1\nIntro line 2\n| A | B |\n| - | - |\n| 1 | 2 |';
    const res = ctx.parseComparisonText(text);
    expect(res.intro).toBe('Intro line 1 Intro line 2');
    expect(res.tableMarkdown.trim()).toBe('| A | B |\n| - | - |\n| 1 | 2 |');
  });

  test('markdownTableToHtml converts table to HTML', () => {
    const ctx = loadApp();
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const html = ctx.markdownTableToHtml(md);
    expect(html.replace(/\s+/g, '')).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
  });
});
