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

  // 식약처 API 호출
  async function callMfds(searchWord, rows = 20) {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY,
      item_name:  searchWord,
      type:       'json',
      numOfRows:  String(rows),
      pageNo:     '1',
    });
    const r = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params
    );
    const d = await r.json();
    const b1 = d?.body?.items;
    const b2 = d?.response?.body?.items?.item;
    if (b1) return Array.isArray(b1) ? b1 : [b1];
    if (b2) return Array.isArray(b2) ? b2 : [b2];
    return [];
  }

  // 실제 API 응답 필드명에 맞게 정규화
  // LENG_LONG=장축, LENG_SHORT=단축, DRUG_SHAPE=모양, COLOR_CLASS1=색상
  function normalize(it) {
    let ingredientEn = '';
    if (it.MATERIAL_NAME) {
      ingredientEn = it.MATERIAL_NAME
        .split('|')
        .map(p => p.trim())
        .filter(p => /[a-zA-Z]/.test(p) && p.length > 1)
        .join(' / ');
    }

    const long  = parseFloat(it.LENG_LONG  || it.LNGS_STDR) || 0;
    const short = parseFloat(it.LENG_SHORT || it.SHRT_STDR) || 0;
    const thick = parseFloat(it.THICK) || 0;
    const shape = it.DRUG_SHAPE || it.DRUG_SHPE || '';
    const color = it.COLOR_CLASS1 || it.DRUG_COLO_FRONT || it.DRUG_COLO || '';
    const colorBack = it.COLOR_CLASS2 || it.DRUG_COLO_BACK || '';

    return {
      ITEM_SEQ:       it.ITEM_SEQ       || '',
      ITEM_NAME:      it.ITEM_NAME      || '',
      DRUG_SHPE:      shape,
      DRUG_COLO:      color,
      DRUG_COLO_BACK: colorBack,
      PRINT_FRONT:    it.MARK_CODE_FRONT || it.PRINT_FRONT || '',
      PRINT_BACK:     it.MARK_CODE_BACK  || it.PRINT_BACK  || '',
      FORM_CODE_NAME: it.FORM_CODE_NAME  || '',
      ETC_OTC_NAME:   it.ETC_OTC_NAME    || '',
      LNGS_STDR:      long,
      SHRT_STDR:      short,
      THICK:          thick,
      CLASS_NAME:     it.CLASS_NAME      || '',
      CLASS_NO:       it.CLASS_NO        || '',
      INGR_NAME_EN:   ingredientEn || it.CLASS_NAME || '',
      PRICE:          null,
      PRICE_UNIT:     null,
      HIRA_CLASS:     it.CLASS_NAME      || '',
    };
  }

  try {
    const q = query.trim();

    // 순차 시도: 원본 → 앞 4글자 → 앞 3글자 → 앞 2글자
    const candidates = [q, q.substring(0,4), q.substring(0,3), q.substring(0,2)]
      .filter((v, i, arr) => v.length >= 2 && arr.indexOf(v) === i);

    let rawItems = [];
    for (const word of candidates) {
      console.log('MFDS 호출:', word);
      const items = await callMfds(word, 30);
      // 크기 정보 있는 것 (LENG_LONG 또는 LNGS_STDR)
      const valid = items.filter(it =>
        (it.LENG_LONG || it.LNGS_STDR) && (it.LENG_SHORT || it.SHRT_STDR)
      );
      if (valid.length > 0) {
        rawItems = valid;
        console.log('결과:', valid.length, '건 (검색어:', word + ')');
        break;
      }
    }

    // 검색어 앞 2글자가 품목명에 포함되는 것 필터
    const keyword = q.replace(/\s/g, '').substring(0, 2);
    let filtered = rawItems.filter(it =>
      (it.ITEM_NAME || '').replace(/\s/g, '').includes(keyword)
    );
    if (filtered.length === 0) filtered = rawItems;

    // 검색어와 가까운 것 우선 정렬
    filtered.sort((a, b) => {
      const an = (a.ITEM_NAME || '').replace(/\s/g, '');
      const bn = (b.ITEM_NAME || '').replace(/\s/g, '');
      const kw = q.replace(/\s/g, '').substring(0, 3);
      const as = an.startsWith(kw) ? 0 : an.includes(kw) ? 1 : 2;
      const bs = bn.startsWith(kw) ? 0 : bn.includes(kw) ? 1 : 2;
      return as - bs;
    });

    let mfdsResult = filtered.map(normalize);

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
              return {
                ...it,
                PRICE:      price !== null ? Number(price) : null,
                PRICE_UNIT: best.injcInjcUnitNm || '정',
                HIRA_CLASS: best.clsNm || it.CLASS_NAME,
              };
            }
            return it;
          } catch (e) { return it; }
        })
      );
      mfdsResult = hiraResults;
    }

    if (mfdsResult.length > 0) {
      return res.status(200).json(mfdsResult);
    }

    // 3단계: Claude AI 보완
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
          content: q + ` 약품 낱알식별 정보 JSON 배열로 반환.
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
    return res.status(200).json(parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR));

  } catch (e) {
    console.error('Search handler fatal error:', e);
    return res.status(500).json({ error: e.message });
  }
}
