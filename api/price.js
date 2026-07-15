export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { itemName } = req.body;
  if (!itemName) return res.status(400).json({ error: 'itemName is required' });

  const HIRA_KEY = process.env.HIRA_API_KEY;
  if (!HIRA_KEY) return res.status(200).json({ price: null, unit: '정' });

  // 간단한 XML → 객체 배열 파서 (<item>...</item> 반복 구조 전용)
  // HIRA API가 type=json을 줘도 XML로만 응답하므로 직접 파싱
  function parseHiraXmlItems(xml) {
    const items = [];
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const blockFull of itemBlocks) {
      // <item> 바깥 태그 자체를 제거하고 내부 필드 태그만 남겨서 파싱
      // (제거 안 하면 정규식이 <item>...</item> 전체를 하나의 필드로 잘못 매칭함)
      const inner = blockFull.replace(/^<item>/, '').replace(/<\/item>$/, '');
      const obj = {};
      const fieldMatches = inner.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);
      for (const m of fieldMatches) obj[m[1]] = m[2].trim();
      if (Object.keys(obj).length > 0) items.push(obj);
    }
    return items;
  }
  function getXmlTag(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : null;
  }

  // ── HIRA 약가기준정보조회서비스: 품목명으로 상한금액(mxCprc) 조회 ───────────
  // https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList (응답 XML 고정)
  async function callHiraPrice(name) {
    const word = name.replace(/\(.*?\)/g, '').trim();
    const params = new URLSearchParams({
      serviceKey: HIRA_KEY,
      itmNm: word,
      numOfRows: '10',
      pageNo: '1',
    });
    const url = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) { console.log('HIRA price fetch failed:', r.status); return null; }

    const xml = await r.text();
    const resultCode = getXmlTag(xml, 'resultCode');
    if (resultCode && resultCode !== '00') {
      console.log('HIRA price API error:', resultCode, getXmlTag(xml, 'resultMsg'));
      return null;
    }

    const items = parseHiraXmlItems(xml);
    if (items.length === 0) { console.log('HIRA price no items for:', word); return null; }

    const keyword = word.replace(/\s/g, '');
    const best = items.find(it => (it.itmNm || '').replace(/\s/g, '').includes(keyword)) || items[0];

    const priceRaw = best.mxCprc;
    if (priceRaw === undefined || priceRaw === null || priceRaw === '') return null;
    const price = parseFloat(String(priceRaw).replace(/,/g, ''));
    if (isNaN(price) || price <= 0) return null;

    console.log(`HIRA price "${name}" -> ${best.itmNm}: ${price} ${best.unit || '정'}`);
    return { price, unit: best.unit || '정' };
  }

  try {
    const result = await callHiraPrice(itemName);
    if (!result) return res.status(200).json({ price: null, unit: '정' });
    return res.status(200).json(result);
  } catch (e) {
    console.error('price handler error:', e.message);
    return res.status(200).json({ price: null, unit: '정' });
  }
}
