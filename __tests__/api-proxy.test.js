const { loadApiProxyHandler } = require('../test-utils');

class DummyFormData {
  constructor() { this.append = jest.fn(); }
  getHeaders() { return {}; }
}

describe('api-proxy handler', () => {
  test('rejects non-POST requests', async () => {
    const handler = loadApiProxyHandler(jest.fn());
    const res = await handler({ httpMethod: 'GET' });
    expect(res.statusCode).toBe(405);
  });

  test('returns 400 for invalid JSON', async () => {
    const handler = loadApiProxyHandler(jest.fn());
    const res = await handler({ httpMethod: 'POST', body: '{' });
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 for invalid target', async () => {
    const handler = loadApiProxyHandler(jest.fn());
    const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ target: 'foo' }) });
    expect(res.statusCode).toBe(400);
  });

  test('forwards gemini requests', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true })
    });
    const handler = loadApiProxyHandler(fetchMock, { GEMINI_API_KEY: 'abc' });
    const payload = { foo: 'bar' };
    const res = await handler({ httpMethod: 'POST', body: JSON.stringify({ target: 'gemini', payload }) });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.5-flash-lite-preview-06-17:generateContent?key=abc'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(JSON.stringify({ ok: true }));
  });

  test('handles PlantNet images', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true })
    });
    let formInstance;
    class TestForm extends DummyFormData {
      constructor() { super(); formInstance = this; }
    }
    const handler = loadApiProxyHandler(fetchMock, { PLANTNET_API_KEY: 'abc' }, TestForm);
    const img = { name: 'test.jpg', organ: 'leaf', dataUrl: 'data:image/jpeg;base64,aGVsbG8=' };
    await handler({ httpMethod: 'POST', body: JSON.stringify({ target: 'plantnet', payload: { images: [img] } }) });
    expect(formInstance.append).toHaveBeenCalledWith('organs', img.organ);
    const secondCall = formInstance.append.mock.calls[1];
    expect(secondCall[0]).toBe('images');
    expect(secondCall[1]).toBeInstanceOf(Buffer);
    expect(secondCall[2]).toBe(img.name);
  });
});
