export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  const MFDS_KEY = process.env.MFDS_API_KEY;
  const AI_KEY   = process.env.ANTHROPIC_API_KEY;
  // HIRA도 같은 공공데이터포털 키 사용 (HIRA_API_KEY 없으면 MFDS_KEY 사용)
  const HIRA_KEY = process.env.HIRA_API_KEY || MFDS_KEY;

  if (!MFDS_KEY) return res.status(500).json({ error: 'MFDS_API_KEY 없음' });

  async function callMfds(word, rows = 30) {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY, item_name: word,
      type: 'json', numOfRows: String(rows), pageNo: '1',
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

  function normalize(it) {
    const long  = parseFloat(it.LENG_LONG  || it.LNGS_STDR) || 0;
    const short = parseFloat(it.LENG_SHORT || it.SHRT_STDR) || 0;
    const thick = parseFloat(it.THICK) || 0;
    const hiraClass = it.CLASS_NAME || '';
    return {
      ITEM_SEQ:       it.ITEM_SEQ        || '',
      ITEM_NAME:      it.ITEM_NAME       || '',
      ITEM_ENG_NAME:  it.ITEM_ENG_NAME   || '',
      DRUG_SHPE:      it.DRUG_SHAPE      || it.DRUG_SHPE || '',
      DRUG_COLO:      it.COLOR_CLASS1    || it.DRUG_COLO_FRONT || it.DRUG_COLO || '',
      DRUG_COLO_BACK: it.COLOR_CLASS2    || it.DRUG_COLO_BACK  || '',
      PRINT_FRONT:    it.MARK_CODE_FRONT || it.PRINT_FRONT     || '',
      PRINT_BACK:     it.MARK_CODE_BACK  || it.PRINT_BACK      || '',
      FORM_CODE_NAME: it.FORM_CODE_NAME  || '',
      ETC_OTC_NAME:   it.ETC_OTC_NAME    || '',
      LNGS_STDR:      long,
      SHRT_STDR:      short,
      THICK:          thick,
      CLASS_NAME:     hiraClass,
      INGR_NAME_EN:   '',
      MATERIAL_NAME:  it.MATERIAL_NAME   || '',
      PRICE:          null,
      PRICE_UNIT:     '정',
      HIRA_CLASS:     hiraClass,
    };
  }

  try {
    const q = query.trim();
    const candidates = [q, q.substring(0,4), q.substring(0,3), q.substring(0,2)]
      .filter((v,i,a) => v.length >= 2 && a.indexOf(v) === i);

    let rawItems = [];
    for (const word of candidates) {
      const items = await callMfds(word);
      const valid = items.filter(it =>
        (it.LENG_LONG || it.LNGS_STDR) && (it.LENG_SHORT || it.SHRT_STDR)
      );
      if (valid.length > 0) { rawItems = valid; break; }
    }

    const kw = q.replace(/\s/g,'').substring(0,2);
    let filtered = rawItems.filter(it =>
      (it.ITEM_NAME||'').replace(/\s/g,'').includes(kw)
    );
    if (!filtered.length) filtered = rawItems;

    filtered.sort((a,b) => {
      const an=(a.ITEM_NAME||'').replace(/\s/g,'');
      const bn=(b.ITEM_NAME||'').replace(/\s/g,'');
      const k=q.replace(/\s/g,'').substring(0,3);
      return (an.startsWith(k)?0:an.includes(k)?1:2)-(bn.startsWith(k)?0:bn.includes(k)?1:2);
    });

    let mfdsResult = filtered.map(normalize);

    // ── HIRA 약가기준정보 조회 ──────────────────────────────────────────────
    // 엔드포인트: https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList
    // 파라미터: itemNm(품목명), ediCode(EDI코드)
    if (mfdsResult.length > 0 && HIRA_KEY) {
      mfdsResult = await Promise.all(mfdsResult.map(async it => {
        try {
          const hiraParams = new URLSearchParams({
            serviceKey: HIRA_KEY,
            pageNo:     '1',
            numOfRows:  '10',
            type:       'json',
            itemNm:     it.ITEM_NAME || '',
          });
          const hiraUrl = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + hiraParams;
          console.log('HIRA URL:', hiraUrl.substring(0, 150));

          const hiraRes  = await fetch(hiraUrl);
          const hiraText = await hiraRes.text();
          console.log('HIRA raw:', hiraText.substring(0, 500));

          let hiraData;
          try { hiraData = JSON.parse(hiraText); }
          catch(e) {
            console.error('HIRA JSON parse error:', hiraText.substring(0, 200));
            return it;
          }

          let priceItems = [];
          const hBody = hiraData?.response?.body ?? hiraData?.body;
          if (hBody?.items?.item) {
            const raw = hBody.items.item;
            priceItems = Array.isArray(raw) ? raw : [raw];
          }

          console.log('HIRA priceItems:', priceItems.length, priceItems[0] ? Object.keys(priceItems[0]).join(',') : 'none');

          if (priceItems.length > 0) {
            const best = priceItems.find(p =>
              (p.itemNm || p.ITEM_NM || '').includes(it.ITEM_NAME.substring(0,4))
            ) || priceItems[0];

            console.log('HIRA best:', JSON.stringify(best).substring(0,300));

            // getDgamtList 응답 필드명 (실제 API 명세 기준)
            // mxRdln: 상한금액, uprc: 단가, shtRfndAmt: 단기급여상한
            const price =
              best.mxRdln    ?? // 상한금액
              best.mxRbdAmt  ?? // 구 필드명 fallback
              best.uprc      ?? // 단가
              best.shtRfndAmt?? // 단기급여상한
              null;

            const unit =
              best.unit     ||
              best.prdtClsNm||
              '정';

            const cls =
              best.clsNm    ||
              best.className||
              it.CLASS_NAME;

            return {
              ...it,
              PRICE:      price !== null ? Number(price) : null,
              PRICE_UNIT: unit,
              HIRA_CLASS: cls || it.CLASS_NAME,
            };
          }
          return it;
        } catch(e) {
          console.error('HIRA error:', it.ITEM_NAME, e.message);
          return it;
        }
      }));
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // AI 보완
    if (!AI_KEY) return res.status(200).json([]);
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: 'Korean pharmaceutical database. Return ONLY JSON array. No markdown.',
        messages: [{
          role: 'user',
          content: q + ` 약품 낱알식별 JSON 배열.
[{"ITEM_SEQ":"","ITEM_NAME":"품목명","ITEM_ENG_NAME":"","DRUG_SHPE":"원형","DRUG_COLO":"분홍","DRUG_COLO_BACK":"","PRINT_FRONT":"","PRINT_BACK":"","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"","MATERIAL_NAME":"","PRICE":null,"PRICE_UNIT":"정","HIRA_CLASS":"당뇨병용제"}]
없으면[].`
        }]
      })
    });
    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);
    const text = (aiData.content||[]).map(b=>b.text||'').join('');
    const s=text.indexOf('['), e=text.lastIndexOf(']');
    if (s===-1||e===-1) return res.status(200).json([]);
    const parsed = JSON.parse(text.substring(s,e+1));
    return res.status(200).json(parsed.filter(it=>it.LNGS_STDR&&it.SHRT_STDR));

  } catch(e) {
    console.error('Fatal:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
