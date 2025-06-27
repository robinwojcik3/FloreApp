const fetch = require('node-fetch');
const FormData = require('form-data');

// Fonction pour convertir un Data URL (base64) en Buffer
const dataUrlToBuffer = (dataUrl) => {
    const base64 = dataUrl.split(',')[1];
    if (!base64) throw new Error('Invalid Data URL');
    return Buffer.from(base64, 'base64');
};

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { target, payload } = JSON.parse(event.body);
        let upstreamUrl = '';
        let upstreamOptions = {};

        switch (target) {
            case 'plantnet':
                const plantnetApiKey = process.env.PLANTNET_API_KEY;
                if (!plantnetApiKey) throw new Error('PlantNet API key is not configured.');

                upstreamUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${plantnetApiKey}`;
                const form = new FormData();
                payload.images.forEach(img => {
                    form.append('organs', img.organ);
                    form.append('images', dataUrlToBuffer(img.dataUrl), img.name);
                });

                upstreamOptions = {
                    method: 'POST',
                    body: form,
                    headers: {
                        ...form.getHeaders(),
                        'User-Agent': event.headers['user-agent'] || 'PlantouilleApp/1.0'
                    }
                };
                const forwardedFor = event.headers['x-forwarded-for'] ||
                                   event.headers['client-ip'] ||
                                   event.headers['x-nf-client-connection-ip'];
                if (forwardedFor) {
                    upstreamOptions.headers['X-Forwarded-For'] = forwardedFor;
                }
                break;

            case 'gemini':
                const geminiApiKey = process.env.GEMINI_API_KEY;
                if (!geminiApiKey) throw new Error('Gemini API key is not configured.');

                upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=${geminiApiKey}`;
                upstreamOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };
                break;

            case 'tts':
                const ttsApiKey = process.env.TTS_API_KEY;
                if (!ttsApiKey) throw new Error('TTS API key is not configured.');
                
                upstreamUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsApiKey}`;
                upstreamOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };
                break;

            default:
                return { statusCode: 400, body: 'Invalid target API' };
        }

        const response = await fetch(upstreamUrl, upstreamOptions);
        const responseData = await response.json();

        if (!response.ok) {
            console.error(`Upstream API error for target "${target}":`, responseData);
            const errorMessage = (responseData.error && responseData.error.message) || responseData.message || 'Unknown upstream error';
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorMessage })
            };
        }
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error('Proxy function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
