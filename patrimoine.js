(function() {
    // Parse CSV text with semicolon delimiter and double quotes handling
    function parseCsv(text) {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = [];
        let field = '';
        let row = [];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') {
                if (inQuotes && text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ';' && !inQuotes) {
                row.push(field);
                field = '';
            } else if ((c === '\n' || c === '\r') && !inQuotes) {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field);
                if (row.length) rows.push(row);
                row = [];
                field = '';
            } else {
                field += c;
            }
        }
        if (field || row.length) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    }

    let bdcDataPromise = null;

    function normalizeRegion(name) {
        return name.toLowerCase().replace(/[\s-]+/g, '_');
    }

    async function loadBDCStatut() {
        if (bdcDataPromise) return bdcDataPromise;
        bdcDataPromise = fetch('BDCstatut.csv')
            .then(r => r.text())
            .then(text => {
                const rows = parseCsv(text);
                const headers = rows.shift().map(h => h.trim());
                return rows.map(row => {
                    const obj = {};
                    row.forEach((val, idx) => {
                        obj[headers[idx]] = val;
                    });
                    return obj;
                });
            });
        return bdcDataPromise;
    }

    async function getPatrimonialSpecies(regionName) {
        const data = await loadBDCStatut();
        const regionKey = normalizeRegion(regionName);
        const protecCol = `protec_${regionKey}`;
        const lrCol = `lr_${regionKey}`;
        const results = new Set();
        data.forEach(row => {
            if (row.statut_fr_cr || row.statut_fr_en || row.statut_fr_vu || row.statut_fr_nt ||
                row[protecCol] || row[lrCol]) {
                results.add(row.nom_sci);
            }
        });
        return Array.from(results);
    }

    window.loadBDCStatut = loadBDCStatut;
    window.getPatrimonialSpecies = getPatrimonialSpecies;
})();
