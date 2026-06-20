// 검색 결과 HTML 전체에서 "보험" 글자 주변과 약품 링크 패턴을 모두 찾기
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};

  try {
    const r = await fetch('https://www.health.kr/searchDrug/result_drug.asp?drug_name=' + encodeURIComponent('자디앙'), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    const html = await r.text();
    result.status = r.status;
    result.length = html.length;

    // "보험" 글자가 나오는 모든 위치 (최대 3개) 주변 텍스트
    const priceContexts = [];
    let searchFrom = 0;
    for (let i = 0; i < 3; i++) {
      const idx = html.indexOf('보험', searchFrom);
      if (idx === -1) break;
      priceContexts.push(html.substring(Math.max(0,idx-50), idx+300));
      searchFrom = idx + 1;
    }
    result.price_contexts = priceContexts;

    // 모든 <a> 태그 중 약품 상세로 가는 링크 패턴 (href 전체)
    const linkMatches = html.match(/<a[^>]*href="[^"]*"[^>]*>/g);
    result.all_links_sample = linkMatches ? linkMatches.slice(0, 15) : [];

    // onclick 패턴 전체
    const onclicks = html.match(/onclick="[^"]*"/g);
    result.onclick_sample = onclicks ? onclicks.slice(0, 10) : [];

    // 약품명 "자디앙" 등장 횟수와 그 주변 태그 구조
    const drugIdx = html.indexOf('자디앙');
    result.drug_card_html = drugIdx !== -1 ? html.substring(Math.max(0,drugIdx-500), drugIdx+1000) : 'NOT_FOUND';

  } catch(e) {
    result.error = e.message;
  }

  res.status(200).json(result);
}
