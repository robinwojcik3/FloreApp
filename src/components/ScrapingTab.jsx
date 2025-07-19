import { useState } from 'react';

export default function ScrapingTab() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runScrape = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/.netlify/functions/arcgis-scrape', { method: 'POST' });
      const json = await r.json();
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <button
        onClick={runScrape}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Exécution…' : 'Lancer le scraping'}
      </button>

      {result && (
        <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
