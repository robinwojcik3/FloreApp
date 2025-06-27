const { loadApp } = require('../test-utils');

describe('utility functions', () => {
  test('norm removes accents and spaces', () => {
    const ctx = loadApp();
    expect(ctx.norm('Épée  Chenôve')).toBe('epeechenove');
  });

  test('makeTrigram handles subspecies', () => {
    const ctx = loadApp();
    expect(ctx.makeTrigram('Carex atrata subsp. nigra')).toBe('caratrsubspnig');
  });

  test('makeTimestampedName uses safe prefix', () => {
    const fixed = new Date('2024-01-02T03:04:00Z');
    const ctx = loadApp({ Date: class extends Date { constructor(){return fixed;} } });
    const name = ctx.makeTimestampedName('My:Photo');
    expect(name).toBe('My_Photo 2024-01-02 03h04.jpg');
  });

  test('parseCsv handles quotes and BOM', () => {
    const ctx = loadApp();
    const csv = '\uFEFFname;value\n"complex;field";"multi\nline";"with ""quotes"""';
    const rows = ctx.parseCsv(csv);
    expect(rows).toEqual([
      ['name', 'value'],
      ['complex;field', 'multi\nline', 'with "quotes"']
    ]);
  });

  test('capitalizeGenus preserves hybrid markers', () => {
    const ctx = loadApp();
    expect(ctx.capitalizeGenus('x abies alba')).toBe('x Abies alba');
    expect(ctx.capitalizeGenus('× picea abies')).toBe('× Picea abies');
  });

});

describe('api helpers', () => {
  test('taxrefFuzzyMatch returns matches array', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({matches:[{nom_complet:'Acer campestre'}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const res = await ctx.taxrefFuzzyMatch('Acer');
    expect(res[0].nom_complet).toBe('Acer campestre');
  });

  test('getSynthesisFromGemini extracts text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({candidates:[{content:{parts:[{text:'syn'}]}}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const text = await ctx.getSynthesisFromGemini('Plant');
    expect(text).toBe('syn');
  });

  test('synthesizeSpeech returns audio content', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({audioContent:'abc'})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const data = await ctx.synthesizeSpeech('hello');
    expect(data).toBe('abc');
  });

  test('getComparisonFromGemini retrieves comparison text', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({candidates:[{content:{parts:[{text:'cmp'}]}}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const txt = await ctx.getComparisonFromGemini([{species:'A',physio:'p',eco:'e'}]);
    expect(txt).toBe('cmp');
  });

  test('getSimilarSpeciesFromGemini parses list', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({candidates:[{content:{parts:[{text:'Abies grandis, Abies cephalonica'}]}}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const list = await ctx.getSimilarSpeciesFromGemini('Abies alba');
    expect(list).toEqual(['Abies grandis','Abies cephalonica']);
  });

  test('getSimilarSpeciesFromGemini strips markdown asterisks', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({candidates:[{content:{parts:[{text:'*Abies nordmanniana*, *Abies pinsapo*'}]}}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const list = await ctx.getSimilarSpeciesFromGemini('Abies alba');
    expect(list).toEqual(['Abies nordmanniana','Abies pinsapo']);
  });
});

describe('apiFetch and PlantNet API', () => {
  test('apiFetch notifies on error and returns null', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'boom' })
    });
    const ctx = loadApp({ fetch: fetchMock });
    const res = await ctx.apiFetch('tts', {});
    expect(res).toBeNull();
    expect(ctx.showNotification).toHaveBeenCalledWith('boom', 'error');
  });

  test('callPlantNetAPI retries and succeeds', async () => {
    const results = { results: [{ score: 1, species: { scientificNameWithoutAuthor: 'Abies alba' } }] };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({ error: 'fail' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(results) });
    const ctx = loadApp({ fetch: fetchMock });
    const payload = [{ dataUrl: 'data:image/png;base64,AAA', organ: 'leaf', name: 'photo.jpg' }];
    const res = await ctx.callPlantNetAPI(payload, 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual(results.results);
  });
});
