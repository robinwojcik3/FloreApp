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

  test('openObsMulti builds OR query', () => {
    const ctx = loadApp();
    const url = ctx.openObsMulti(['1','2']);
    expect(url).toContain(encodeURIComponent('(lsid:1 OR lsid:2)'));
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
