const { loadApp } = require('../test-utils');
const vm = require('vm');

function loadAppWithExports(extraCtx = {}) {
  const ctx = loadApp(extraCtx);
  vm.runInContext('globalThis.__extract = { taxref, ecology, trigramIndex, criteres, physionomie, phenologie };', ctx);
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
      if (url === 'Phenologie.csv') {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('Abies alba;4-5\n') });
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
    expect(ctx.__extract.phenologie[key]).toBe('4-5');
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

  test('parseComparisonText extracts summary section', () => {
    const ctx = loadApp();
    const text = [
      'Intro',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      'Summary 1',
      'Summary 2'
    ].join('\n');
    const res = ctx.parseComparisonText(text);
    expect(res.intro).toBe('Intro');
    expect(res.tableMarkdown.trim()).toBe('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(res.summary).toBe('Summary 1 Summary 2');
  });

  test('markdownTableToHtml converts table to HTML', () => {
    const ctx = loadApp();
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const html = ctx.markdownTableToHtml(md);
    expect(html.replace(/\s+/g, '')).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>');
  });

  test('markdownTableToHtml handles multiple rows', () => {
    const ctx = loadApp();
    const md = '| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |';
    const html = ctx.markdownTableToHtml(md);
    expect(html.replace(/\s+/g, '')).toBe('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody></table>');
  });

  test('parseComparisonText without table returns intro only', () => {
    const ctx = loadApp();
    const res = ctx.parseComparisonText('Just intro');
    expect(res).toEqual({ intro: 'Just intro', tableMarkdown: '', summary: '' });
  });

  test('markdownTableToHtml returns empty string for invalid table', () => {
    const ctx = loadApp();
    expect(ctx.markdownTableToHtml('| A |')).toBe('');
  });
});
