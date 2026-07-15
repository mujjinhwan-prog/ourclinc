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
  async function queryHira(word) {
    const params = new URLSearchParams({
      serviceKey: HIRA_KEY,
      itmNm: word,
      numOfRows: '10',
      pageNo: '1',
    });
    const url = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params;
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) { console.log('HIRA price fetch failed:', r.status); return []; }

    const xml = await r.text();
    const resultCode = getXmlTag(xml, 'resultCode');
    if (resultCode && resultCode !== '00') {
      console.log('HIRA price API error:', resultCode, getXmlTag(xml, 'resultMsg'));
      return [];
    }
    return parseHiraXmlItems(xml);
  }

  // MFDS 품목명과 HIRA 품목명은 단위 표기(밀리그램/mg)나 공백이 달라서
  // 원본 그대로는 매칭이 안 되는 경우가 있음 → 몇 가지 정규화된 후보로 순차 재시도
  function buildCandidates(name) {
    const base = name.replace(/\(.*?\)/g, '').trim(); // 괄호(성분명 등) 제거
    const mgToKr = base.replace(/(\d)\s*mg\b/gi, '$1밀리그램');
    const krToMg = base.replace(/(\d+(?:\.\d+)?)\s*밀리그램/g, '$1mg');
    const noSpace = base.replace(/\s/g, '');
    // 앞부분(제품명 핵심)만 남긴 후보 — 숫자/단위 앞까지만
    const coreMatch = base.match(/^[가-힣A-Za-z]+/);
    const core = coreMatch ? coreMatch[0] : null;

    return [...new Set([base, mgToKr, krToMg, noSpace, core].filter(v => v && v.length >= 2))];
  }

  async function callHiraPrice(name) {
    const candidates = buildCandidates(name);
    // 순차 재시도(직렬)는 후보가 많은 품목에서 4초×N으로 누적되어 Vercel 함수
    // 실행 제한 시간을 넘겨 타임아웃을 유발했음 → 전부 동시에 병렬 요청으로 전환
    const settled = await Promise.allSettled(candidates.map(word => queryHira(word)));

    let items = [];
    let matchedWord = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled' && r.value.length > 0) {
        items = r.value; matchedWord = candidates[i]; break;
      }
    }
    if (items.length === 0) { console.log('HIRA price no items for:', name); return null; }

    const keyword = matchedWord.replace(/\s/g, '');
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
