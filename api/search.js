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
      return { ...it, INGR_NAME_EN: ingredientEn || it.CLASS_NAME || '', ITEM_IMAGE: it.ITEM_IMAGE || null };
    });

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // 2단계: 식약처에 없으면 웹 검색으로 보완
    const webSearchPrompt = query + " 약품 낱알식별 정보 크기 모양 성분 식약처";

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
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: '당신은 한국 의약품 정보 전문가입니다. 웹 검색으로 약품의 크기, 모양, 성분을 찾아 JSON 배열로만 반환하세요. 마크다운 금지. [ 로 시작 ] 로 끝.',
        messages: [{
          role: 'user',
          content: '"' + query + '" 약품을 웹에서 검색해서 낱알식별 정보를 JSON 배열로 반환하세요. 실제 데이터만, 추측 금지.
[{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":숫자,"SHRT_STDR":숫자,"THICK":숫자또는null,"DRUG_SHPE":"원형|타원형|장방형|마름모형","DRUG_COLO":"색상한글","PRINT_FRONT":"각인","PRINT_BACK":"","INGR_NAME_EN":"영문성분명","CLASS_NAME":"분류","ITEM_IMAGE":null}]
없으면[].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const match = text.match(/[[sS]*]/);
    if (!match) return res.status(200).json([]);

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR));

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}export default async function handler(req, res) {
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
      return { ...it, INGR_NAME_EN: ingredientEn || it.CLASS_NAME || '', ITEM_IMAGE: it.ITEM_IMAGE || null };
    });

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // 2단계: 식약처에 없으면 웹 검색으로 보완
    const webSearchPrompt = query + " 약품 낱알식별 정보 크기 모양 성분 식약처";

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
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: '당신은 한국 의약품 정보 전문가입니다. 웹 검색으로 약품의 크기, 모양, 성분을 찾아 JSON 배열로만 반환하세요. 마크다운 금지. [ 로 시작 ] 로 끝.',
        messages: [{
          role: 'user',
          content: '"' + query + '" 약품을 웹에서 검색해서 낱알식별 정보를 JSON 배열로 반환하세요. 실제 데이터만, 추측 금지.
[{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":숫자,"SHRT_STDR":숫자,"THICK":숫자또는null,"DRUG_SHPE":"원형|타원형|장방형|마름모형","DRUG_COLO":"색상한글","PRINT_FRONT":"각인","PRINT_BACK":"","INGR_NAME_EN":"영문성분명","CLASS_NAME":"분류","ITEM_IMAGE":null}]
없으면[].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const match = text.match(/[[sS]*]/);
    if (!match) return res.status(200).json([]);

    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR));

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
