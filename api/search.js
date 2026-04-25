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

  if (!MFDS_KEY) return res.status(500).json({ error: 'MFDS_API_KEY 없음' });

  // MATERIAL_NAME → 영문 성분명만 추출 (한글명 제외)
  function parseIngredient(materialName) {
    if (!materialName) return '';
    return materialName
      .split('|')
      .map(p => p.trim())
      .filter(p => /^[A-Za-z]/.test(p) && p.length > 1)
      .join(' / ');
  }

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
    // 주성분: MATERIAL_NAME에서 영문만 (CLASS_NAME 절대 사용 안 함)
    const ingredient = parseIngredient(it.MATERIAL_NAME);
    // 효능군: CLASS_NAME만 (주성분과 완전 분리)
    const hiraClass  = it.CLASS_NAME || '';

    return {
      ITEM_SEQ:       it.ITEM_SEQ       || '',
      ITEM_NAME:      it.ITEM_NAME      || '',
      DRUG_SHPE:      it.DRUG_SHAPE     || it.DRUG_SHPE || '',
      DRUG_COLO:      it.COLOR_CLASS1   || it.DRUG_COLO_FRONT || it.DRUG_COLO || '',
      DRUG_COLO_BACK: it.COLOR_CLASS2   || it.DRUG_COLO_BACK  || '',
      PRINT_FRONT:    it.MARK_CODE_FRONT|| it.PRINT_FRONT     || '',
      PRINT_BACK:     it.MARK_CODE_BACK || it.PRINT_BACK      || '',
      FORM_CODE_NAME: it.FORM_CODE_NAME || '',
      ETC_OTC_NAME:   it.ETC_OTC_NAME   || '',
      LNGS_STDR:      long,
      SHRT_STDR:      short,
      THICK:          thick,
      CLASS_NAME:     hiraClass,   // 효능군
      INGR_NAME_EN:   ingredient,  // 주성분(영문)
      MATERIAL_NAME:  it.MATERIAL_NAME || '',
      PRICE: null, PRICE_UNIT: null,
      HIRA_CLASS: hiraClass,
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
        (it.LENG_LONG||it.LNGS_STDR) && (it.LENG_SHORT||it.SHRT_STDR)
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
      return (an.startsWith(k)?0:an.includes(k)?1:2) - (bn.startsWith(k)?0:bn.includes(k)?1:2);
    });

    let mfdsResult = filtered.map(normalize);

    // HIRA 약가
    if (mfdsResult.length > 0 && HIRA_KEY) {
      mfdsResult = await Promise.all(mfdsResult.map(async it => {
        try {
          const hiraUrl = 'https://apis.data.go.kr/B551182/msupRtrvl/getOudrugPrcList'
            + '?serviceKey=' + encodeURIComponent(HIRA_KEY)
            + '&pageNo=1&numOfRows=10&type=json'
            + '&itemNm=' + encodeURIComponent(it.ITEM_NAME||'');
          const hText = await (await fetch(hiraUrl)).text();
          let hData; try { hData=JSON.parse(hText); } catch(e){return it;}
          const hBody = hData?.response?.body ?? hData?.body;
          const raw = hBody?.items?.item;
          if (!raw) return it;
          const items = Array.isArray(raw)?raw:[raw];
          const best = items.find(p=>(p.itemNm||'').includes(it.ITEM_NAME.substring(0,4)))||items[0];
          return {
            ...it,
            PRICE: best.mxRbdAmt ? Number(best.mxRbdAmt) : null,
            PRICE_UNIT: best.injcInjcUnitNm||'정',
            HIRA_CLASS: best.clsNm || it.CLASS_NAME,
          };
        } catch(e){return it;}
      }));
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // AI 보완
    if (!AI_KEY) return res.status(200).json([]);
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':AI_KEY,'anthropic-version':'2023-06-01'},
      body: JSON.stringify({
        model:'claude-haiku-4-5-20251001', max_tokens:2000,
        system:'Korean pharmaceutical database. Return ONLY JSON array. No markdown.',
        messages:[{role:'user',content:q+` 약품 낱알식별 JSON 배열.
[{"ITEM_SEQ":"","ITEM_NAME":"품목명","DRUG_SHPE":"원형","DRUG_COLO":"분홍","DRUG_COLO_BACK":"","PRINT_FRONT":"","PRINT_BACK":"","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","MATERIAL_NAME":"","PRICE":null,"PRICE_UNIT":"정","HIRA_CLASS":"당뇨병용제"}]
없으면[].`}]
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
    return res.status(500).json({error:e.message});
  }
}
