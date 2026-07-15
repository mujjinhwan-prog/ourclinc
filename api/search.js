export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, page } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  const pageNo = Math.max(1, parseInt(page) || 1);
  const PAGE_SIZE = 10; // 초기 노출량 — "더보기"로 다음 페이지를 추가 조회

  const MFDS_KEY = process.env.MFDS_API_KEY;
  const AI_KEY   = process.env.ANTHROPIC_API_KEY;
  if (!MFDS_KEY) return res.status(500).json({ error: 'MFDS_API_KEY 없음' });

  // ── 식약처 낱알식별 조회 ─────────────────────────────────────────────────────
  async function callMfds(word, rows = PAGE_SIZE, pn = 1) {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY, item_name: word,
      type: 'json', numOfRows: String(rows), pageNo: String(pn),
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

  function normalize(it) {
    const long  = parseFloat(it.LENG_LONG  || it.LNGS_STDR) || 0;
    const short = parseFloat(it.LENG_SHORT || it.SHRT_STDR) || 0;
    const thick = parseFloat(it.THICK) || 0;
    const hiraClass = it.CLASS_NAME || '';
    return {
      ITEM_SEQ:       it.ITEM_SEQ        || '',
      ITEM_NAME:      it.ITEM_NAME       || '',
      ENTP_NAME:      it.ENTP_NAME       || '',
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
    let rawItems = [];

    if (pageNo === 1) {
      // 1페이지: 검색어가 너무 구체적이라 매칭이 안 될 경우를 대비해
      // 4자→3자→2자로 점점 줄여가며 결과가 나올 때까지 시도
      const candidates = [q, q.substring(0,4), q.substring(0,3), q.substring(0,2)]
        .filter((v,i,a) => v.length >= 2 && a.indexOf(v) === i);
      for (const word of candidates) {
        const items = await callMfds(word, PAGE_SIZE, 1);
        const valid = items.filter(it =>
          (it.LENG_LONG || it.LNGS_STDR) && (it.LENG_SHORT || it.SHRT_STDR)
        );
        if (valid.length > 0) { rawItems = valid; break; }
      }
    } else {
      // 2페이지 이상: 1페이지가 이미 원래 검색어로 성공했다는 뜻이므로
      // 그대로 다음 페이지만 이어서 조회 (글자 수 축소 재시도 불필요)
      const items = await callMfds(q, PAGE_SIZE, pageNo);
      rawItems = items.filter(it =>
        (it.LENG_LONG || it.LNGS_STDR) && (it.LENG_SHORT || it.SHRT_STDR)
      );
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

    // 보험가는 여기서 조회하지 않음 — 사용자가 슬롯에 실제로 선택했을 때만
    // /api/price 로 개별 조회하여 결과가 많은 성분명 검색에서도 드롭다운이 즉시 뜨도록 함
    const mfdsResult = filtered.slice(0, PAGE_SIZE).map(normalize);

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // 2페이지 이상에서 더 이상 결과가 없으면 그냥 빈 배열 반환 (AI 보완은 1페이지에서만)
    if (pageNo > 1) return res.status(200).json([]);

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
