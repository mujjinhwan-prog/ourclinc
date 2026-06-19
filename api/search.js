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

  // ─── 공통 fetch 헤더 (브라우저 위장) ────────────────────────────────────────
  const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.health.kr/',
    'Connection': 'keep-alive',
  };

  // ─── 식약처 낱알식별 조회 ────────────────────────────────────────────────────
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

  // ─── 약학정보원 보험가 스크래핑 ─────────────────────────────────────────────
  // 1단계: 검색 결과 페이지에서 itemId 추출
  // 2단계: 상세 페이지에서 보험급여가 추출
  async function callHealthKrPrice(itemName) {
    try {
      // ── 1단계: 검색 ──────────────────────────────────────────────────────────
      const searchUrl = 'https://www.health.kr/searchDrug/result_drug.asp?drug_name='
        + encodeURIComponent(itemName.replace(/\(.*\)/, '').trim()); // 괄호 부분 제거 후 검색

      const searchRes = await fetch(searchUrl, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10000),
      });

      if (!searchRes.ok) {
        console.log('health.kr search failed:', searchRes.status);
        return null;
      }

      const searchHtml = await searchRes.text();

      // 검색 결과 목록에서 itemId 추출
      // 패턴: result_drug_detail.asp?itemId=12345 또는 fnDetailView('12345')
      const itemIdPatterns = [
        /result_drug_detail\.asp\?itemId=(\d+)/i,
        /fnDetailView\s*\(\s*'(\d+)'\s*\)/i,
        /fnDetailView\s*\(\s*"(\d+)"\s*\)/i,
        /itemId=(\d+)/i,
        /drug_detail\.asp[^"']*[?&]itemId=(\d+)/i,
      ];

      // 검색 결과 목록에서 품목명과 가장 유사한 항목 찾기
      // 먼저 모든 itemId 후보 수집
      const allMatches = [];
      const globalPattern = /result_drug_detail\.asp\?itemId=(\d+)[^>]*>([^<]*)/gi;
      let m;
      while ((m = globalPattern.exec(searchHtml)) !== null) {
        allMatches.push({ itemId: m[1], name: m[2].trim() });
      }

      // 품목명 유사도로 정렬
      let bestItemId = null;
      if (allMatches.length > 0) {
        const keyword = itemName.replace(/\s/g, '').replace(/\(.*\)/, '').substring(0, 5);
        const best = allMatches.find(it =>
          it.name.replace(/\s/g, '').includes(keyword)
        ) || allMatches[0];
        bestItemId = best.itemId;
      }

      // fallback: 단순 패턴 매칭
      if (!bestItemId) {
        for (const pat of itemIdPatterns) {
          const match = searchHtml.match(pat);
          if (match) { bestItemId = match[1]; break; }
        }
      }

      if (!bestItemId) {
        console.log('health.kr: itemId not found for', itemName);
        console.log('html snippet:', searchHtml.substring(0, 500));
        return null;
      }

      console.log('health.kr: found itemId', bestItemId, 'for', itemName);

      // ── 2단계: 상세 페이지에서 보험급여가 추출 ───────────────────────────────
      const detailUrl = `https://www.health.kr/searchDrug/result_drug_detail.asp?itemId=${bestItemId}`;
      const detailRes = await fetch(detailUrl, {
        headers: { ...BROWSER_HEADERS, Referer: searchUrl },
        signal: AbortSignal.timeout(10000),
      });

      if (!detailRes.ok) {
        console.log('health.kr detail failed:', detailRes.status);
        return null;
      }

      const detailHtml = await detailRes.text();

      // 보험급여가 추출 패턴들 (약학정보원 HTML 구조 기반)
      // 실제 HTML 예시:
      //   <th>보험급여가</th><td>408.00원/정</td>
      //   <td class="bg_blue">보험급여가</td><td>408원</td>
      //   보험급여가 : 408.00원
      const pricePatterns = [
        // th/td 테이블 구조 (가장 일반적)
        /보험급여가\s*<\/th>\s*<td[^>]*>\s*([\d,\.]+)\s*원\s*(?:\/(정|캡슐|포|병|앰플|바이알|개))?\s*<\/td>/i,
        // class가 있는 td
        /보험급여가[^<]*<\/td>\s*<td[^>]*>\s*([\d,\.]+)\s*원\s*(?:\/(정|캡슐|포|병|앰플|바이알|개))?/i,
        // span/div 구조
        /보험급여가[^:：]*[:：]\s*([\d,\.]+)\s*원/i,
        // 숫자만 있는 경우
        /보험급여가[^>]*>[^<]*<[^>]+>\s*([\d,\.]+)\s*원/i,
        // 더 넓은 패턴
        /보험급여[가액].*?([\d,]{3,}\.?\d*)\s*원/i,
      ];

      for (const pat of pricePatterns) {
        const match = detailHtml.match(pat);
        if (match) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 0 && price < 1000000) { // 합리적 범위 검증
            const unit = match[2] || '정';
            console.log(`health.kr price: ${price}원/${unit} for ${itemName}`);
            return { price, unit, itemId: bestItemId };
          }
        }
      }

      // 패턴 매칭 실패 시 — 디버그용 스니펫 로깅
      const idx = detailHtml.indexOf('보험급여');
      if (idx !== -1) {
        console.log('health.kr: 보험급여 context:', detailHtml.substring(idx, idx + 200));
      } else {
        console.log('health.kr: 보험급여 field not found in detail page');
      }

      return null;

    } catch (e) {
      if (e.name === 'TimeoutError') {
        console.log('health.kr: timeout for', itemName);
      } else {
        console.error('health.kr error:', e.message);
      }
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

    // ── 약학정보원에서 보험가 조회 ───────────────────────────────────────────
    // 같은 약이 여러 품목 있을 때 첫 번째 품목으로 가격 조회 후 나머지는 공유
    // (같은 검색어 결과 내 동일 약은 가격이 같은 경우가 많음)
    if (mfdsResult.length > 0) {
      // 중복 요청 방지: 이미 조회한 품목명 캐시
      const priceCache = new Map();

      mfdsResult = await Promise.all(mfdsResult.map(async it => {
        try {
          // 괄호 제거한 기본 품목명으로 캐시 키 생성
          const cacheKey = it.ITEM_NAME.replace(/\(.*\)/, '').trim().substring(0, 10);

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
          console.error('Price fetch error:', it.ITEM_NAME, e.message);
          return it;
        }
      }));
    }

    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);

    // ── AI 낱알식별 보완 (식약처 DB 미검색 시 한정) ──────────────────────────
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
