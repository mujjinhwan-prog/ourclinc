// 검색 결과 HTML 페이지의 실제 구조 분석 (drug_cd, 가격 패턴 찾기)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};

  try {
    const r = await fetch('https://www.health.kr/searchDrug/result_drug.asp?drug_name=' + encodeURIComponent('자디앙'), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    const html = await r.text();
    result.status = r.status;
    result.length = html.length;

    // "자디앙" 첫 등장 위치 주변 2000자 (약품 카드 구조 전체)
    const idx = html.indexOf('자디앙');
    result.around_drugname = idx !== -1 ? html.substring(Math.max(0, idx - 300), idx + 2000) : 'NOT_FOUND';

    // onclick, href 패턴에서 숫자 ID 찾기
    const onclickMatches = html.match(/onclick="[^"]*\d{4,}[^"]*"/g);
    result.onclick_samples = onclickMatches ? onclickMatches.slice(0, 5) : [];

    const hrefMatches = html.match(/href="[^"]*result_drug[^"]*"/g);
    result.href_samples = hrefMatches ? hrefMatches.slice(0, 5) : [];

  } catch(e) {
    result.error = e.message;
  }

  res.status(200).json(result);
}
