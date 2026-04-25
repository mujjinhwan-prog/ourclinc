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

  // 식약처 API 호출 헬퍼 - item_name은 앞에서부터 일치하는 것 반환
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

  // 결과 정규화
  function normalize(it) {
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
  }

  try {
    // ── 검색어 준비 ──────────────────────────────────────────────────────
    // 원본 그대로 사용 (식약처 API는 입력값으로 시작하는 품목명을 반환)
    const q = query.trim();

    // 순차 시도: 원본 → 앞 4글자 → 앞 3글자 → 앞 2글자
    const candidates = [
      q,
      q.substring(0, 4),
      q.substring(0, 3),
      q.substring(0, 2),
    ].filter((v, i, arr) => v.length >= 2 && arr.indexOf(v) === i); // 중복·너무짧은것 제거

    let rawItems = [];
    for (const word of candidates) {
      console.log('MFDS 호출:', word);
      const items = await callMfds(word, 30);
      // 크기 정보 있는 것만
      const valid = items.filter(it => it.LNGS_STDR && it.SHRT_STDR);
      if (valid.length > 0) {
        rawItems = valid;
        console.log('MFDS 결과:', valid.length, '건 (검색어:', word + ')');
        break;
      }
    }

    // 원본 검색어로 추가 필터 (검색어가 품목명에 포함되는 것만)
    const keyword = q.replace(/\s/g, '');
    let filtered = rawItems.filter(it => {
      const name = (it.ITEM_NAME || '').replace(/\s/g, '');
      // 검색어 앞 2글자가 품목명에 포함되면 OK
      return name.includes(keyword.substring(0, 2));
    });

    // 필터 후 결과가 너무 적으면 필터 없이 전체 사용
    if (filtered.length === 0) filtered = rawItems;

    // 검색어와 유사한 것 우선 정렬
    filtered.sort((a, b) => {
      const an = (a.ITEM_NAME || '').replace(/\s/g, '');
      const bn = (b.ITEM_NAME || '').replace(/\s/g, '');
      const kw = keyword.substring(0, 3);
      const as = an.startsWith(kw) ? 0 : an.includes(kw) ? 1 : 2;
      const bs = bn.startsWith(kw) ? 0 : bn.includes(kw) ? 1 : 2;
      return as - bs;
    });

    let mfdsResult = filtered.map(normalize);

    // ── 2단계: HIRA 급여 약가 조회 ───────────────────────────────────
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

    // ── 3단계: Claude AI 보완 ─────────────────────────────────────────
    if (!AI_KEY) return res.status(200).json([]);

    console.log('3단계: Claude AI 보완');
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
