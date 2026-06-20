export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};

  const HKHEADERS = {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://www.health.kr/searchDrug/search_total_result.asp',
  };

  // POST 방식으로 검색 시도
  try {
    const url = 'https://www.health.kr/searchDrug/ajax/ajax_commonSearch.asp';
    const body = new URLSearchParams({ search_word: '자디앙', search_flag: 'all' });
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...HKHEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const text = await r.text();
    result.search_post_status = r.status;
    result.search_post_raw = text.substring(0, 1000);
  } catch(e) {
    result.search_post_error = e.message;
  }

  // 메인 검색 페이지 HTML 자체도 확인 (실제 구조 파악용)
  try {
    const r2 = await fetch('https://www.health.kr/searchDrug/result_drug.asp?drug_name=' + encodeURIComponent('자디앙'), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
    });
    const text2 = await r2.text();
    result.html_page_status = r2.status;
    result.html_page_length = text2.length;
    result.html_page_snippet = text2.substring(0, 1500);
  } catch(e) {
    result.html_page_error = e.message;
  }

  res.status(200).json(result);
}
