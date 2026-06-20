export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};

  // 검색 결과 HTML 페이지 전체 길이 확인 + 약품 목록 부분 추출
  try {
    const r = await fetch('https://www.health.kr/searchDrug/result_drug.asp?drug_name=' + encodeURIComponent('자디앙'), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    const html = await r.text();
    result.status = r.status;
    result.length = html.length;

    // "자디앙"이라는 글자가 나오는 위치 주변 1500자 추출 (실제 약품 카드 구조 확인)
    const idx = html.indexOf('자디앙');
    if (idx !== -1) {
      result.around_drugname = html.substring(Math.max(0, idx - 200), idx + 1500);
    } else {
      result.around_drugname = 'NOT_FOUND';
    }

    // drug_cd 패턴이 있는지 확인
    const drugCdMatches = html.match(/drug_cd['"=:\s]*([0-9A-Za-z]+)/g);
    result.drug_cd_matches = drugCdMatches ? drugCdMatches.slice(0, 5) : [];

    // 보험급여 글자가 있는 위치
    const priceIdx = html.indexOf('보험');
    if (priceIdx !== -1) {
      result.around_price = html.substring(Math.max(0, priceIdx - 100), priceIdx + 500);
    } else {
      result.around_price = 'NOT_FOUND';
    }

  } catch(e) {
    result.error = e.message;
  }

  res.status(200).json(result);
}
