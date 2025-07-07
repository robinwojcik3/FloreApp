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

  test('makeTrigram handles varieties', () => {
    const ctx = loadApp();
    expect(ctx.makeTrigram('Abies alba var. beta')).toBe('abialbvarbet');
  });

  test('makeTrigram returns empty string with single word', () => {
    const ctx = loadApp();
    expect(ctx.makeTrigram('Abies')).toBe('');
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

  test('parseCsv handles CRLF newlines', () => {
    const ctx = loadApp();
    const csv = 'a;b\r\n1;2\r\n3;4';
    expect(ctx.parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
    ]);
  });

  test('parseCsv handles carriage returns', () => {
    const ctx = loadApp();
    const csv = 'a;b\r1;2\r3;4';
    expect(ctx.parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
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

  test('getComparisonFromGemini handles block reason', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({promptFeedback:{blockReason:'SAFETY'}})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const txt = await ctx.getComparisonFromGemini([{species:'A'}]);
    expect(txt).toBe('Réponse bloquée par le modèle (SAFETY). Vérifiez le contenu du prompt.');
  });

  test('getComparisonFromGemini handles empty response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const txt = await ctx.getComparisonFromGemini([{species:'A'}]);
    expect(txt).toBe("Le modèle n'a pas pu générer de comparaison. La réponse était vide.");
  });

  test('getComparisonFromGemini catches errors', async () => {
    const ctx = loadApp();
    ctx.apiFetch = jest.fn().mockRejectedValue(new Error('oops'));
    const txt = await ctx.getComparisonFromGemini([{species:'A'}]);
    expect(txt).toBe('Erreur technique lors de la génération de la comparaison: oops');
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

  test('taxrefFuzzyMatch handles fetch failure', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false });
    const ctx = loadApp({ fetch: fetchMock });
    const res = await ctx.taxrefFuzzyMatch('Acer');
    expect(res).toEqual([]);
    expect(ctx.showNotification).toHaveBeenCalled();
  });

  test('getSimilarSpeciesFromGemini parses newline list', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({candidates:[{content:{parts:[{text:'Abies grandis\nAbies cephalonica'}]}}]})
    });
    const ctx = loadApp({ fetch: fetchMock });
    const list = await ctx.getSimilarSpeciesFromGemini('Abies alba');
    expect(list).toEqual(['Abies grandis','Abies cephalonica']);
  });
});
