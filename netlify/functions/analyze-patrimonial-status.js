// /netlify/functions/analyze-patrimonial-status.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// La clé API reste le seul secret côté serveur.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        // Le corps de la requête contient maintenant les règles déjà filtrées.
        const { relevantRules, uniqueSpeciesNames, coords } = JSON.parse(event.body);
        if (!relevantRules || !uniqueSpeciesNames || !coords) return { statusCode: 400, body: 'Données d\'entrée invalides.' };

        const { departement, region } = (await (await fetch(`https://geo.api.gouv.fr/communes?lat=${coords.latitude}&lon=${coords.longitude}&fields=departement,region`)).json())[0];
        
        const patrimonialityRules = relevantRules.length > 0 
            ? relevantRules.map(rule => `- ${rule.species}: ${rule.status}`).join('\n') 
            : "Aucune règle par correspondance directe.";
        
        const prompt = `Tu es un expert botaniste pour la zone administrative française (département ${departement.code}, région ${region.code}). Ta mission est d'analyser une liste d'espèces observées et de déterminer lesquelles sont patrimoniales.

**Règles Impératives d'Analyse :**
1.  **Précision Taxonomique :** Un statut s'applique UNIQUEMENT au taxon exact. Le statut d'une sous-espèce/variété ne s'applique pas à l'espèce parente.
2.  **Définition de Patrimonialité :** Une espèce est patrimoniale si elle est protégée par la loi, ou menacée (NT, VU, EN, CR). Les statuts ZNIEFF, LC, DD, NA, NE ne sont PAS patrimoniaux.
3.  **Gestion des Conflits :** Si pour un taxon, une règle 'LC' et une règle de menace coexistent pour la même liste, 'LC' a priorité.

**1. Analyse par Correspondance Directe :**
Règles pré-filtrées par le client pour les espèces observées :
${patrimonialityRules}

**2. Analyse Complémentaire par Synonymie (si nécessaire) :**
Pour les espèces observées sans correspondance directe ci-dessus, utilise tes connaissances pour vérifier si elles sont des synonymes bien connus d'un taxon avec un statut patrimonial en France.

**Tâche Finale :**
Synthétise les résultats. Retourne UNIQUEMENT un objet JSON valide des espèces **effectivement patrimoniales**.
Format: { "Nom de l'espèce": ["Statut 1", "Statut 2", ...] }.
La valeur est un TABLEAU. Si aucune espèce n'est patrimoniale, retourne {}.

**Liste des espèces observées :**
${uniqueSpeciesNames.join(', ')}`;
        
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        const geminiResp = await fetch(geminiUrl, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            // MODIFICATION : Ajout de "role": "user" pour la conformité avec l'API Gemini.
            body: JSON.stringify({ 
                contents: [{ 
                    role: "user", 
                    parts: [{ text: prompt }] 
                }] 
            })
        });

        if (!geminiResp.ok) { const errBody = await geminiResp.text(); console.error("Erreur de l'API Gemini:", errBody); throw new Error(`L'API d'analyse a retourné une erreur: ${geminiResp.statusText}`); }
        
        const geminiData = await geminiResp.json();
        let patrimonialMap = {};
        if (geminiData.candidates && geminiData.candidates[0].content && geminiData.candidates[0].content.parts[0]) {
            const jsonString = geminiData.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            try { patrimonialMap = JSON.parse(jsonString); } 
            catch (parseError) { console.error("Erreur de parsing de la réponse JSON de Gemini:", parseError, "Réponse brute:", jsonString); throw new Error("L'API d'analyse a retourné une réponse mal formée."); }
        } else { console.warn("Réponse de Gemini inattendue ou vide:", JSON.stringify(geminiData, null, 2)); }

        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patrimonialMap) };
    } catch (error) {
        console.error("Erreur dans la fonction analyze-patrimonial-status:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
