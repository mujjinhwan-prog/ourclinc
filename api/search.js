export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const system = `당신은 한국 식약처 의약품 낱알식별 데이터베이스 API입니다. 사용자가 약품명을 입력하면 반드시 JSON 배열만 반환하세요. 절대로 설명, 마크다운, 코드블록, 주석을 포함하지 마세요. 응답의 첫 글자는 반드시 [ 이고 마지막 글자는 반드시 ] 이어야 합니다.`;

  const user = `"${query}" 약품의 식약처 낱알식별 정보를 JSON 배열로 반환하세요. 용량/제조사별 최대 6개.
형식: [{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.5,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","ITEM_IMAGE":null}]
DRUG_COLO는 단순 한 단어: 하양/노랑/주황/분홍/빨강/갈색/연두/초록/하늘/파랑/남색/보라/회색/검정/살구 중 하나. 없으면 [].`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });
    const data = await response.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json([]);
    return res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
