// search.js의 kpicSearch/kpicDetail을 그대로 가져와서 단계별로 테스트
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};

  const word = '자디앙';

  // 1단계: kpicSearch 그대로 재현
  try {
    const now = Date.now();
    const url = `https://www.health.kr/searchDrug/ajax/ajax_commonSearch.asp?search_word=${encodeURIComponent(word)}&search_flag=all&_=${now}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'ko,en-US;q=0.9,en;q=0.8',
        'x-requested-with': 'XMLHttpRequest',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'Referer': 'https://www.health.kr/searchDrug/search_total_result.asp',
      },
    });
    result.search_url = url;
    result.search_status = r.status;
    result.search_headers = Object.fromEntries(r.headers.entries());
    const text = await r.text();
    result.search_raw_text = text.substring(0, 1500);
    try {
      const data = JSON.parse(text);
      result.search_parsed_type = Array.isArray(data) ? 'array' : typeof data;
      result.search_parsed_length = Array.isArray(data) ? data.length : null;
      result.search_first_item = Array.isArray(data) && data.length > 0 ? data[0] : null;
    } catch(e) {
      result.search_parse_error = e.message;
    }
  } catch(e) {
    result.search_fetch_error = e.message;
  }

  res.status(200).json(result);
}
