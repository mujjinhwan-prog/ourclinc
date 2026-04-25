export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const MFDS_KEY = process.env.MFDS_API_KEY;
  const HIRA_KEY = process.env.HIRA_API_KEY;
  const AI_KEY   = process.env.ANTHROPIC_API_KEY;

  if (!MFDS_KEY) {
    return res.status(500).json({ error: 'MFDS_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    // 부분검색: 숫자/단위 제거 후 앞 6글자로 API 호출
    const shortQuery = query
      .replace(/[0-9]+(.[0-9]+)?(mg|mcg|ug|ml|g|정|캡슐|mg\/|\/)*/gi, '')
      .trim()
      .substring(0, 6);

    console.log('원본:', query, '→ 단축:', shortQuery);

    // 1단계: 식약처 낱알식별 API
    const mfdsParams = new URLSearchParams({
      serviceKey: MFDS_KEY,
      item_name:  shortQuery,
      type:       'json',
      numOfRows:  '20',
      pageNo:     '1',
    });

    const mfdsRes  = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + mfdsParams
    );
    const mfdsData = await mfdsRes.json();

    let rawItems = [];
    const b1 = mfdsData?.body?.items;
    const b2 = mfdsData?.response?.body?.items?.item;
    if (b1)      rawItems = Array.isArray(b1) ? b1 : [b1];
    else if (b2) rawItems = Array.isArray(b2) ? b2 : [b2];

    // 원본 검색어 앞 2글자 이상 포함 + 크기 정보 있는 것만 필터
    const keyword = query.replace(/\s/g, '').toLowerCase().substring(0, 2);
    const filtered = rawItems.filter(it => {
      if (!it.LNGS_STDR || !it.SHRT_STDR) return false;
      const name = (it.ITEM_NAME || '').replace(/\s/g, '').toLowerCase();
      return name.includes(keyword);
    });

    // 검색어와 가까운 것 우선 정렬
    filtered.sort((a, b) => {
      const aName = (a.ITEM_NAME || '').toLowerCase();
      const bName = (b.ITEM_NAME || '').toLowerCase();
      const sq = shortQuery.toLowerCase();
      const aMatch = aName.startsWith(sq) ? 0 : 1;
      const bMatch = bName.startsWith(sq) ? 0 : 1;
      return aMatch - bMatch;
    });

    let mfdsResult = filtered.map(it => {
      let ingredientEn = '';
      if (it.MATERIAL_NAME) {
        ingredientEn = it.MATERIAL_NAME
          .split('|')
          .map(p => p.trim())
          .filter(p => /[a-zA-Z]/.test(p) && p.length > 1)
          .join(' / ');
      }
      return {
        ITEM_SEQ:       it.ITEM_SEQ        || '',
        ITEM_NAME:      it.ITEM_NAME       || '',
        DRUG_SHPE:      it.DRUG_SHPE       || '',
        DRUG_COLO:      it.DRUG_COLO_FRONT || it.DRUG_COLO || '',
        DRUG_COLO_BACK: it.DRUG_COLO_BACK  || '',
        PRINT_FRONT:    it.PRINT_FRONT     || '',
        PRINT_BACK:     it.PRINT_BACK      || '',
        FORM_CODE_NAME: it.FORM_CODE_NAME  || '',
        ETC_OTC_NAME:   it.ETC_OTC_NAME    || '',
        LNGS_STDR:      parseFloat(it.LNGS_STDR) || 0,
        SHRT_STDR:      parseFloat(it.SHRT_STDR) || 0,
        THICK:          parseFloat(it.THICK)      || 0,
        CLASS_NAME:     it.CLASS_NAME      || '',
        CLASS_NO:       it.CLASS_NO        || '',
        INGR_NAME_EN:   ingredientEn || it.CLASS_NAME || '',
        PRICE:          null,
        PRICE_UNIT:     null,
        HIRA_CLASS:     it.CLASS_NAME      || '',
      };
    });

    // 2단계: HIRA 급여 약가 조회
    if (mfdsResult.length > 0 && HIRA_KEY) {
      const hiraResults = await Promise.all(
        mfdsResult.map(async it => {
          try {
            const hiraUrl = 'https://apis.data.go.kr/B551182/msupRtrvl/getOudrugPrcList'
              + '?serviceKey=' + encodeURIComponent(HIRA_KEY)
              + '&pageNo=1&numOfRows=10&type=json'
              + '&itemNm=' + encodeURIComponent(it.ITEM_NAME || '');

            const hiraRes  = await fetch(hiraUrl);
            const hiraText = await hiraRes.text();
            let hiraData;
            try { hiraData = JSON.parse(hiraText); } catch(e) { return it; }

            let priceItems = [];
            const hBody = hiraData?.response?.body ?? hiraData?.body;
            if (hBody?.items?.item) {
              const raw = hBody.items.item;
              priceItems = Array.isArray(raw) ? raw : [raw];
            }

            if (priceItems.length > 0) {
              const best = priceItems.find(p =>
                (p.itemNm || '').includes(it.ITEM_NAME.substring(0, 4))
              ) || priceItems[0];
              const price = best.mxRbdAmt ?? best.uprc ?? null;
              const unit  = best.injcInjcUnitNm || '정';
              return {
                ...it,
                PRICE:      price !== null ? Number(price) : null,
                PRICE_UNIT: unit,
                HIRA_CLASS: best.clsNm || it.CLASS_NAME,
              };
            }
            return it;
          } catch (e) {
            return it;
          }
        })
      );
      mfdsResult = hiraResults;
    }

    if (mfdsResult.length > 0) {
      return res.status(200).json(mfdsResult);
    }

    // 3단계: 식약처에 없으면 Claude AI 보완
    if (!AI_KEY) return res.status(200).json([]);

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         AI_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system:     'Korean pharmaceutical database. Return ONLY a JSON array. No markdown.',
        messages: [{
          role:    'user',
          content: query + ` 약품 낱알식별 정보 JSON 배열로 반환.
[{"ITEM_SEQ":"","ITEM_NAME":"품목명","DRUG_SHPE":"원형","DRUG_COLO":"분홍","DRUG_COLO_BACK":"","PRINT_FRONT":"D5","PRINT_BACK":"","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"CLASS_NAME":"당뇨병용제","CLASS_NO":"396","INGR_NAME_EN":"Linagliptin","PRICE":null,"PRICE_UNIT":"정","HIRA_CLASS":"당뇨병용제"}]
없으면 [].`
        }],
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text     = (aiData.content || []).map(b => b.text || '').join('');
    const startIdx = text.indexOf('[');
    const endIdx   = text.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return res.status(200).json([]);

    const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));
    return res.status(200).json(
      parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR)
    );

  } catch (e) {
    console.error('Search handler fatal error:', e);
    return res.status(500).json({ error: e.message });
  }
}
