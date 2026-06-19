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
  const HIRA_KEY = process.env.HIRA_API_KEY || MFDS_KEY;

  if (!MFDS_KEY) return res.status(500).json({ error: 'MFDS_API_KEY 없음' });

  // ─── 식약처 낱알식별 조회 ───────────────────────────────────────────────
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

  // ─── 식약처 의약품 가격정보 조회 (getMdcinPrceInfo) ──────────────────────
  // 공공데이터포털: 1471000/MdcinPrceInfoService/getMdcinPrceInfo01
  async function callMfdsPrice(itemName) {
    try {
      const params = new URLSearchParams({
        serviceKey:  MFDS_KEY,
        item_name:   itemName,
        type:        'json',
        numOfRows:   '20',
        pageNo:      '1',
      });
      const r = await fetch(
        'https://apis.data.go.kr/1471000/MdcinPrceInfoService/getMdcinPrceInfo01?' + params
      );
      const d = await r.json();
      const items =
        d?.body?.items ||
        d?.response?.body?.items?.item ||
        null;
      if (!items) return null;
      const arr = Array.isArray(items) ? items : [items];
      if (!arr.length) return null;
      // 품목명 일치도 기준으로 best 선택
      const keyword = itemName.replace(/\s/g, '').substring(0, 5);
      const best = arr.find(p =>
        (p.ITEM_NAME || p.itemNm || '').replace(/\s/g, '').includes(keyword)
      ) || arr[0];
      const price =
        best.MAX_PRICE  ??   // 상한금액
        best.SGNG_PRICE ??   // 표준가격
        best.PRICE      ??
        null;
      const unit = best.PACK_UNIT || best.UNIT || '정';
      return price !== null ? { price: Number(price), unit } : null;
    } catch (e) {
      console.error('MFDS price error:', e.message);
      return null;
    }
  }

  // ─── HIRA 약가기준정보 조회 ──────────────────────────────────────────────
  async function callHiraPrice(itemName) {
    if (!HIRA_KEY) return null;
    try {
      // 1차 시도: dgamtCrtrInfoService1.2
      const p1 = new URLSearchParams({
        serviceKey: HIRA_KEY,
        pageNo:     '1',
        numOfRows:  '20',
        type:       'json',
        itemNm:     itemName,
      });
      const r1 = await fetch(
        'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + p1
      );
      const text1 = await r1.text();
      let data1;
      try { data1 = JSON.parse(text1); } catch { data1 = null; }

      let priceItems = [];
      if (data1) {
        const hBody = data1?.response?.body ?? data1?.body;
        if (hBody?.items?.item) {
          const raw = hBody.items.item;
          priceItems = Array.isArray(raw) ? raw : [raw];
        }
      }

      // 2차 시도: 급여의약품 기준금액 정보 서비스
      if (!priceItems.length) {
        const p2 = new URLSearchParams({
          serviceKey: HIRA_KEY,
          pageNo:     '1',
          numOfRows:  '20',
          type:       'json',
          drugNm:     itemName,
        });
        const r2 = await fetch(
          'https://apis.data.go.kr/B551182/msInsrDrugPrceInfoService1/getDrugPrceInfo1?' + p2
        );
        const text2 = await r2.text();
        let data2;
        try { data2 = JSON.parse(text2); } catch { data2 = null; }
        if (data2) {
          const b2 = data2?.response?.body ?? data2?.body;
          if (b2?.items?.item) {
            const raw = b2.items.item;
            priceItems = Array.isArray(raw) ? raw : [raw];
          }
        }
      }

      if (!priceItems.length) return null;

      const keyword = itemName.replace(/\s/g, '').substring(0, 4);
      const best = priceItems.find(p =>
        (p.itemNm || p.ITEM_NM || p.drugNm || '').replace(/\s/g, '').includes(keyword)
      ) || priceItems[0];

      const price =
        best.mxRdln     ??
        best.mxRbdAmt   ??
        best.uprc       ??
        best.shtRfndAmt ??
        best.clmPrc     ??
        null;

      const unit =
        best.unit        ||
        best.prdtClsNm   ||
        best.pakUnitCd   ||
        '정';

      const cls =
        best.clsNm       ||
        best.className   ||
        null;

      return price !== null
        ? { price: Number(price), unit, hiraClass: cls }
        : null;
    } catch (e) {
      console.error('HIRA price error:', e.message);
      return null;
    }
  }

  // ─── 약학정보원 HTML 스크래핑 (서버사이드 — 캐시 활용) ──────────────────
  // 약학정보원은 HTML 응답이라 서버에서만 접근 가능
  // URL: https://www.health.kr/searchDrug/result_drug.asp?drug_name=XXX
  async function callHealthKrPrice(itemName) {
    try {
      const encoded = encodeURIComponent(itemName.substring(0, 10));
      const url = `https://www.health.kr/searchDrug/result_drug.asp?drug_name=${encoded}`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.health.kr/',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return null;
      const html = await r.text();

      // 보험급여가 패턴 추출
      // 예: "보험급여가</th><td>123.00원</td>" 또는 "보험급여상한가 : 123원"
      const patterns = [
        /보험급여가?[^<]*<\/th>\s*<td[^>]*>([0-9,\.]+)\s*원/i,
        /보험급여상한가?\s*[:：]\s*([0-9,\.]+)\s*원/i,
        /급여상한금액[^<]*<\/[^>]+>\s*<[^>]+>([0-9,\.]+)\s*원/i,
        /상한금액\s*<\/th>\s*<td[^>]*>([0-9,\.]+)/i,
        /insurancePrice['"]\s*:\s*['"]?([0-9,\.]+)/i,
      ];
      for (const pat of patterns) {
        const m = html.match(pat);
        if (m) {
          const price = parseFloat(m[1].replace(/,/g, ''));
          if (price > 0) {
            // 단위 추출 시도
            const unitMatch = html.match(/보험급여가?[^<]*<\/th>[^<]*<td[^>]*>[^<]*원\s*\/?\s*(정|캡슐|포|병|앰플|개|바이알)/i);
            return { price, unit: unitMatch ? unitMatch[1] : '정' };
          }
        }
      }
      return null;
    } catch (e) {
      // 타임아웃 or 접근 불가 — 조용히 실패
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

    // ── 보험가 병렬 조회 (3가지 소스 동시 시도) ──────────────────────────────
    if (mfdsResult.length > 0) {
      mfdsResult = await Promise.all(mfdsResult.map(async it => {
        try {
          // 3가지 소스를 동시 조회 (race 아님 — 우선순위 순)
          const [hiraResult, mfdsPrice, healthKr] = await Promise.allSettled([
            callHiraPrice(it.ITEM_NAME),
            callMfdsPrice(it.ITEM_NAME),
            callHealthKrPrice(it.ITEM_NAME),
          ]);

          const hira    = hiraResult.status  === 'fulfilled' ? hiraResult.value  : null;
          const mfds    = mfdsPrice.status   === 'fulfilled' ? mfdsPrice.value   : null;
          const healthK = healthKr.status    === 'fulfilled' ? healthKr.value    : null;

          // 우선순위: HIRA > 식약처가격 > 약학정보원
          const winner = hira || mfds || healthK;

          console.log(`[${it.ITEM_NAME}] hira=${hira?.price ?? 'null'} mfds=${mfds?.price ?? 'null'} health=${healthK?.price ?? 'null'}`);

          return {
            ...it,
            PRICE:      winner ? winner.price : null,
            PRICE_UNIT: winner ? (winner.unit || '정') : '정',
            HIRA_CLASS: (hira?.hiraClass) || it.HIRA_CLASS || it.CLASS_NAME,
          };
        } catch(e) {
          console.error('Price fetch error:', it.ITEM_NAME, e.message);
          return it;
        }
      }));
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // ── AI 보완 (식약처 DB 미검색 시) ─────────────────────────────────────
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
