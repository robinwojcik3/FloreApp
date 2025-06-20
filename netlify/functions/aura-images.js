const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

exports.handler = async function(event) {
    const cd = event.queryStringParameters && event.queryStringParameters.cd;
    if (!cd) {
        return { statusCode: 400, body: 'Missing cd parameter' };
    }
    const url = `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${cd}`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            const txt = await res.text();
            return { statusCode: res.status, body: txt };
        }
        const html = await res.text();
        const regex = /<img[^>]+src="([^"]+\.(?:jpe?g|png))"[^>]*>/ig;
        const images = [];
        let m;
        while ((m = regex.exec(html)) !== null) {
            let src = m[1];
            if (!/^https?:\/\//.test(src)) {
                const prefix = 'https://atlas.biodiversite-auvergne-rhone-alpes.fr';
                src = prefix + (src.startsWith('/') ? '' : '/') + src;
            }
            if (/logo|icone?|icon|favicon/i.test(src)) continue;
            if (!images.includes(src)) images.push(src);
        }
        return { statusCode: 200, headers: {'Content-Type':'application/json'}, body: JSON.stringify({ images }) };
    } catch (err) {
        console.error('Aura images error', err);
        return { statusCode: 500, body: 'Server error' };
    }
};
