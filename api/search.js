export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const params = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query,
      type: 'json',
      numOfRows: '10',
      pageNo: '1'
    });

    const mfdsRes = await fetch('https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params);
    const mfdsData = await mfdsRes.json();

    let items = [];
    if (mfdsData?.body?.items) {
      items = Array.isArray(mfdsData.body.items) ? mfdsData.body.items : [mfdsData.body.items];
    } else if (mfdsData?.response?.body?.items?.item) {
      const raw = mfdsData.response.body.items.item;
      items = Array.isArray(raw) ? raw : [raw];
    }

    const mfdsResult = items.filter(it => it.LNGS_STDR && it.SHRT_STDR).map(it => {
      let ingredientEn = '';
      if (it.MATERIAL_NAME) {
        const parts = it.MATERIAL_NAME.split(/[|,;\/]/);
        const eng = parts.map(p => p.trim()).filter(p => /[a-zA-Z]/.test(p) && p.length > 1);
        ingredientEn = eng.join(' / ');
      }
      return { ...it, INGR_NAME_EN: ingredientEn || it.CLASS_NAME || '' };
    });

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: 'You are a Korean pharmaceutical database API. Return ONLY a JSON array. No explanations, no markdown. Start with [ end with ].',
        messages: [{
          role: 'user',
          content: '"' + query + '" 약품의 식약처 낱알식별 정보를 JSON 배열로 반환. 용량별 최대 6개.
[{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","ITEM_IMAGE":null}]
없으면[].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.status(200).json([]);

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR));

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
