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

  function parseHiraXmlItems(xml) {
    const items = [];
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const blockFull of itemBlocks) {
      const inner = blockFull.replace(/^<item>/, '').replace(/<\/item>$/, '');
      const obj = {};
      const fieldMatches = inner.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);
      for (const m of fieldMatches) obj[m[1]] = m[2].trim();
      if (Object.keys(obj).length > 0) items.push(obj);
    }
    return items;
  }

  function getXmlTag(xml, tag) {
    const m = xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
    return m ? m[1].trim() : null;
  }

  // 모든 괄호·접미사·공백·단위변환 제거 후 순수 약품명+용량만 추출
  // 대소문자 무시, 한글/영문 단위 모두 정규화
  function normName(s) {
    return (s || '')
      .replace(/\(.*?\)/g, '')      // 모든 괄호 제거
      .replace(/_.*$/, '')          // _ 이후 제거 (_(1정) 등)
      .replace(/밀리그램/g, 'mg')
      .replace(/마이크로그램/g, 'mcg')
      .replace(/밀리리터/g, 'ml')
      .replace(/리터/g, 'L')
      .replace(/그램/g, 'g')
      .replace(/단위/g, 'IU')
      .replace(/\s+/g, '')
      .toLowerCase()
      .trim();
  }

  // 숫자+단위 추출 (용량 비교용)
  // 예: "직듀오서방정10/500mg" → "10/500mg"
  function extractDose(s) {
    const m = normName(s).match(/[\d./]+[a-z]+.*/);
    return m ? m[0] : '';
  }

  async function callHiraPrice(itemName) {
    if (!HIRA_KEY) return null;
    try {
      const mfdsNorm = normName(itemName);
      const mfdsDose = extractDose(itemName);

      // base: 한글+영문 앞부분만 (숫자 전까지)
      const baseMatch = mfdsNorm.match(/^([가-힣a-z]+)/);
      const base = baseMatch ? baseMatch[1] : mfdsNorm.substring(0, 6);

      const params = new URLSearchParams({
        serviceKey: HIRA_KEY,
        itmNm: base,
        numOfRows: '30',
        pageNo: '1',
      });
      const r = await fetch(
        'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!r.ok) return null;
      const xml = await r.text();
      const rc = getXmlTag(xml, 'resultCode');
      if (rc && rc !== '00') return null;
      const items = parseHiraXmlItems(xml);
      if (!items.length) return null;

      // 가격이 있는 항목만 추려서 작업
      const priced = items.filter(it => {
        const p = parseFloat(String(it.mxCprc || '').replace(/,/g, ''));
        return !isNaN(p) && p > 0;
      });
      if (!priced.length) return null;

      // 1순위: 정규화 이름 완전일치
      let best = priced.find(it => normName(it.itmNm) === mfdsNorm);

      // 2순위: 용량만 비교 (용량이 있는 경우)
      if (!best && mfdsDose) {
        best = priced.find(it => normName(it.itmNm).includes(mfdsDose));
      }

      // 3순위: priced 중 첫 번째 (단일 품목인 경우)
      if (!best) best = priced[0];

      const price = parseFloat(String(best.mxCprc || '').replace(/,/g, ''));
      if (isNaN(price) || price <= 0) return null;
      return { price, unit: best.unit || '정' };
    } catch (e) {
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
      ENTP_NAME:      it.ENTP_NAME       || '',
      DRUG_SHPE:      it.DRUG_SHAPE      || it.DRUG_SHPE || '',
      DRUG_COLO:      it.COLOR_CLASS1    || it.DRUG_COLO || it.DRUG_COLO_FRONT || '',
      DRUG_COLO_BACK: it.COLOR_CLASS2    || it.DRUG_COLO_BACK || '',
      PRINT_FRONT:    it.MARK_CODE_FRONT || it.PRINT_FRONT || '',
      PRINT_BACK:     it.MARK_CODE_BACK  || it.PRINT_BACK  || '',
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

    if (mfdsResult.length > 0 && HIRA_KEY) {
      const priceCache = new Map();
      for (const it of mfdsResult) {
        const key = it.ITEM_NAME;
        if (!priceCache.has(key)) {
          priceCache.set(key, await callHiraPrice(key));
        }
      }
      mfdsResult = mfdsResult.map(it => {
        const result = priceCache.get(it.ITEM_NAME);
        return {
          ...it,
          PRICE:      result ? result.price : null,
          PRICE_UNIT: result ? (result.unit || '정') : '정',
        };
      });
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

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
          content: q + ' 약품 낱알식별 JSON 배열.\n[{"ITEM_NAME":"품목명","DRUG_SHPE":"원형","DRUG_COLO":"분홍","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"CLASS_NAME":"당뇨병용제","PRICE":null,"PRICE_UNIT":"정"}]\n없으면[].'
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
