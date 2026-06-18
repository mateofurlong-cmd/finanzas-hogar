export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image, mediaType } = req.body;
    if (!image || !mediaType) return res.status(400).json({ error: 'Faltan datos' });

    const today = new Date().toISOString().split('T')[0];
    const prompt = `Analizá este ticket/recibo y extraé todos los ítems con su precio. Detectá la moneda (ARS o USD). Respondé SOLO con JSON válido sin backticks ni texto extra:
{"date":"${today}","store":"nombre del comercio o vacío","curr":"ARS o USD","items":[{"desc":"descripción del ítem","amount":número,"cat":"una de: Alimentación|Servicios|Salud|Educación|Transporte|Entretenimiento|Ahorros|Otros"}]}
Si hay un total general sin ítems individuales, poné un solo ítem con el total y el nombre del comercio como descripción.
Si no podés leer el ticket o no es un ticket/recibo: {"error":"no se pudo leer"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: 'Error en la API: ' + (data.error?.message || 'desconocido') });

    const text = data.content.map(c => c.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
}
