export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const system = `You are a Korean pharmaceutical database API. When given a drug name in Korean, return ONLY a JSON array. No explanations, no markdown, no code blocks. Response must start with [ and end with ].`;

  const user = `약품명: "${query}"

위 약품의 식약처 낱알식별 정보를 JSON 배열로 반환하세요. 실제 존재하는 약품 데이터를 제공하세요. 용량별 최대 6개.

반드시 아래 형식의 JSON 배열만 반환:
[{"ITEM_NAME":"트라젠타정5mg","ENTP_NAME":"베링거인겔하임","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","ITEM_IMAGE":null}]

- LNGS_STDR: 장축mm (숫자)
- SHRT_STDR: 단축mm (숫자)
- THICK: 두께mm (숫자 또는 null)
- DRUG_SHPE: 원형/타원형/장방형/마름모형 중 하나
- DRUG_COLO: 하양/노랑/주황/분홍/빨강/갈색/초록/파랑/보라/회색/검정/살구 중 하나
- 없으면 []`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = (data.content || []).map(b => b.text || '').join('');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json([]);

    const result = JSON.parse(match[0]);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
