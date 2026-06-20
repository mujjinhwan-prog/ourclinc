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
  if (!MFDS_KEY) return res.status(500).json({ error: 'MFDS_API_KEY 없음' });

  // ── 식약처 낱알식별 조회 ─────────────────────────────────────────────────────
  async function callMfds(word, rows = 30) {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY, item_name: word,
      type: 'json', numOfRows: String(rows), pageNo: '1',
    });
    const r = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params,
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    const b1 = d?.body?.items;
    const b2 = d?.response?.body?.items?.item;
    if (b1) return Array.isArray(b1) ? b1 : [b1];
    if (b2) return Array.isArray(b2) ? b2 : [b2];
    return [];
  }

  // ── 약학정보원(KPIC) 검색: GET + 정확한 Referer/헤더 조합 ───────────────────
  // 검증된 방식 (커뮤니티 MCP 서버 구현 참고)
  async function kpicSearch(drugName) {
    try {
      const word = drugName.replace(/\(.*?\)/g, '').trim().substring(0, 10);
      const now = Date.now();
      const url = `https://www.health.kr/searchDrug/ajax/ajax_commonSearch.asp?search_word=${encodeURIComponent(word)}&search_flag=all&_=${now}`;
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
          'x-requested-with': 'XMLHttpRequest',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'Referer': 'https://www.health.kr/searchDrug/search_total_result.asp',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { console.log('kpicSearch failed:', r.status); return []; }
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { console.log('kpicSearch parse fail:', text.substring(0,200)); return []; }
      if (!Array.isArray(data)) { console.log('kpicSearch non-array:', JSON.stringify(data).substring(0,200)); return []; }
      console.log(`kpicSearch "${word}": ${data.length}건`);
      return data;
    } catch (e) {
      console.error('kpicSearch error:', e.message);
      return [];
    }
  }

  // ── 약학정보원(KPIC) 상세 조회: GET + drug_cd 기반 Referer ──────────────────
  async function kpicDetail(drugCd) {
    try {
      const now = Date.now();
      const url = `https://www.health.kr/searchDrug/ajax/ajax_result_drug2.asp?drug_cd=${encodeURIComponent(drugCd)}&_=${now}`;
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
          'x-requested-with': 'XMLHttpRequest',
          'cache-control': 'no-cache',
          'pragma': 'no-cache',
          'Referer': `https://www.health.kr/searchDrug/result_drug.asp?drug_cd=${encodeURIComponent(drugCd)}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { console.log('kpicDetail failed:', r.status); return null; }
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { console.log('kpicDetail parse fail:', text.substring(0,300)); return null; }
      if (!Array.isArray(data) || data.length === 0) { console.log('kpicDetail empty'); return null; }
      const item = data[0];
      console.log(`kpicDetail ${drugCd} keys:`, Object.keys(item).join(', '));
      return item;
    } catch (e) {
      console.error('kpicDetail error:', e.message);
      return null;
    }
  }

  // ── 약학정보원 보험가 조회 (검색 → best 매칭 → 상세) ───────────────────────
  async function callHealthKrPrice(itemName) {
    try {
      const searchResults = await kpicSearch(itemName);
      if (!searchResults.length) return null;

      const keyword = itemName.replace(/\s|\(.*?\)/g, '').substring(0, 6);
      const best = searchResults.find(d =>
        (d.drug_name || d.item_name || '').replace(/\s/g, '').includes(keyword)
      ) || searchResults[0];

      const drugCd = best.drug_cd || best.drugcd || best.code;
      if (!drugCd) { console.log('no drug_cd in search result:', JSON.stringify(best).substring(0,200)); return null; }

      const detail = await kpicDetail(drugCd);
      if (!detail) return null;

      const priceRaw =
        detail.ins_price           ??
        detail.insurance_price     ??
        detail.insr_price          ??
        detail.reimbursement_price ??
        detail.price               ??
        null;

      const unit = detail.ins_unit || detail.unit || detail.pack_unit || '정';

      if (priceRaw === null || priceRaw === undefined || priceRaw === '') {
        console.log('no price field, detail dump:', JSON.stringify(detail).substring(0,400));
        return null;
      }

      const price = parseFloat(String(priceRaw).replace(/,/g, ''));
      if (isNaN(price) || price <= 0) return null;

      console.log(`KPIC price "${itemName}": ${price}원/${unit} (drug_cd:${drugCd})`);
      return { price, unit };
    } catch (e) {
      console.error('callHealthKrPrice error:', e.message);
      return null;
    }
  }

  function normalize(it) {
    const long  = parseFloat(it.LENG_LONG  || it.LNGS_STDR) || 0;
    const short = parseFloat(it.LENG_SHORT || it.SHRT_STDR) || 0;
    const thick = parseFloat(it.THICK) || 0;
    const hiraClass = it.CLASS_NAME || '';
    return {
      ITEM_SEQ:       it.ITEM_SEQ        || '',
      ITEM_NAME:      it.ITEM_NAME       || '',
      DRUG_SHPE:      it.DRUG_SHAPE      || it.DRUG_SHPE || '',
      DRUG_COLO:      it.COLOR_CLASS1    || it.DRUG_COLO || it.DRUG_COLO_FRONT || '',
      DRUG_COLO_BACK: it.COLOR_CLASS2    || it.DRUG_COLO_BACK || '',
      PRINT_FRONT:    it.MARK_CODE_FRONT || it.PRINT_FRONT     || '',
      PRINT_BACK:     it.MARK_CODE_BACK  || it.PRINT_BACK      || '',
      FORM_CODE_NAME: it.FORM_CODE_NAME  || '',
      ETC_OTC_NAME:   it.ETC_OTC_NAME    || '',
      LNGS_STDR:      long,
      SHRT_STDR:      short,
      THICK:          thick,
      CLASS_NAME:     hiraClass,
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

    // ── 약학정보원 보험가 조회 (중복 캐시) ────────────────────────────────────
    if (mfdsResult.length > 0) {
      const priceCache = new Map();
      mfdsResult = await Promise.all(mfdsResult.map(async it => {
        try {
          const cacheKey = it.ITEM_NAME.replace(/\(.*?\)/g,'').trim().substring(0, 8);
          let result;
          if (priceCache.has(cacheKey)) {
            result = priceCache.get(cacheKey);
          } else {
            result = await callHealthKrPrice(it.ITEM_NAME);
            priceCache.set(cacheKey, result);
          }
          return {
            ...it,
            PRICE:      result ? result.price : null,
            PRICE_UNIT: result ? (result.unit || '정') : '정',
          };
        } catch(e) {
          console.error('Price fetch error:', e.message);
          return it;
        }
      }));
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // ── AI 낱알식별 보완 ───────────────────────────────────────────────────────
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
[{"ITEM_NAME":"품목명","DRUG_SHPE":"원형","DRUG_COLO":"분홍","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"CLASS_NAME":"당뇨병용제","PRICE":null,"PRICE_UNIT":"정"}]
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
