export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    // 1단계: 식약처 공식 API
    const params = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query, type: 'json', numOfRows: '10', pageNo: '1'
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

    // 2단계: 식약처에 없으면 Claude + 웹검색으로 보완
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: '당신은 한국 의약품 정보 전문가입니다. 반드시 웹 검색을 사용해서 약품 정보를 찾으세요. 최종 답변은 JSON 배열만, 마크다운 없이, [ 로 시작 ] 로 끝내세요.',
        messages: [{
          role: 'user',
          content: '"' + query + '" 약품을 nedrug.mfds.go.kr 또는 health.kr 에서 웹 검색으로 찾아서 낱알식별 정보를 JSON 배열로 반환하세요.
형식: [{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":장축mm숫자,"SHRT_STDR":단축mm숫자,"THICK":두께또는null,"DRUG_SHPE":"원형|타원형|장방형|마름모형","DRUG_COLO":"색상한글","PRINT_FRONT":"앞각인","PRINT_BACK":"뒷각인","INGR_NAME_EN":"영문성분명","CLASS_NAME":"분류명","ITEM_IMAGE":null}]
크기(mm) 반드시 포함. 없으면[].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const match = text.match(/[[sS]*]/);
    if (!match) return res.status(200).json([]);

    try {
      const parsed = JSON.parse(match[0]);
      return res.status(200).json(parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR));
    } catch {
      return res.status(200).json([]);
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
