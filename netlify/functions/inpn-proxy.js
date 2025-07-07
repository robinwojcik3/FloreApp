// Fichier : netlify/functions/inpn-proxy.js

const fetch = require('./utils/fetch');

exports.handler = async function(event, context) {
    console.log('--- Fonction Proxy WMS Déclenchée ---');
    const params = event.queryStringParameters || {};

    // --- Mode 1: Proxy pour les requêtes WMS vers le Géoportail IGN ---
    if (params.service && params.service.toUpperCase() === 'WMS') {
        const TARGET_URL = 'https://wxs.ign.fr/decouverte/geoportail/r/wms';
        const fullUrl = `${TARGET_URL}?${event.rawQuery}`;

        console.log(`[WMS Mode IGN] URL cible construite : ${fullUrl}`);

        try {
            const userAgent = event.headers['user-agent'] || 'Mozilla/5.0 (compatible; PlantouilleApp/1.0)';
            
            const response = await fetch(fullUrl, {
                headers: { 'User-Agent': userAgent }
            });

            console.log(`[WMS Mode IGN] Réponse du Géoportail - Statut : ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[WMS Mode IGN] Erreur du Géoportail : ${errorText}`);
                return { statusCode: response.status, body: errorText };
            }

            const contentType = response.headers.get('content-type');
            const data = await response.buffer();

            return {
                statusCode: 200,
                headers: { 'Content-Type': contentType },
                body: data.toString('base64'),
                isBase64Encoded: true,
            };
        } catch (error) {
            console.error('[WMS Mode IGN] Erreur majeure dans la fonction proxy:', error);
            return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy WMS.' }) };
        }
    }

    // --- Mode 2: Extraction de fragment HTML (INPN - inchangé) ---
    const { cd, type, q } = params;
    if (type) {
        let url;
        if (type === 'carte' || type === 'statut') {
            if (!cd) return { statusCode: 400, body: 'Missing cd parameter' };
            url = `https://inpn.mnhn.fr/espece/cd_nom/${cd}/tab/${type}`;
        } else {
            return { statusCode: 400, body: 'Unsupported type' };
        }

        console.log(`[Fragment Mode] Fetching fragment URL : ${url}`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const txt = await response.text();
                return { statusCode: response.status, body: txt };
            }
            const html = await response.text();
            let fragment = null;
            if (type === 'carte') {
                const m = html.match(/<canvas[^>]*class="[^"]*ol-unselectable[^"]*"[^>]*><\/canvas>/i);
                if (m) fragment = m[0];
            } else if (type === 'statut') {
                const m = html.match(/<div[^>]*class="[^"]*statut[^"]*"[^>]*>[\s\S]*?<\/div>/i);
                if (m) fragment = m[0];
            }

            if (!fragment) return { statusCode: 404, body: 'Fragment not found in source page.' };
            return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: fragment };
        } catch (err) {
            console.error('[Fragment Mode] Erreur lors de la récupération du fragment:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'Erreur interne du proxy de fragment.' }) };
        }
    }

    return { 
        statusCode: 400, 
        body: 'Paramètres de requête invalides. Le paramètre "service=WMS" ou "type" est manquant.' 
    };
};
