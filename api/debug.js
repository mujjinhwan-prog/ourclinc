// api/debug.js — 실제 API 응답 확인용 (확인 후 삭제하세요)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const MFDS_KEY = process.env.MFDS_API_KEY;

  const result = {};

  // 1. 식약처 낱알식별 API 실제 응답
  try {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY,
      item_name: '자디앙',
      type: 'json',
      numOfRows: '1',
      pageNo: '1',
    });
    const r = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params
    );
    const d = await r.json();
    const items = d?.body?.items || d?.response?.body?.items?.item;
    const first = Array.isArray(items) ? items[0] : items;
    result.mfds_first_item = first;
    result.mfds_keys = first ? Object.keys(first) : [];
    result.mfds_drug_colo = first?.DRUG_COLO;
    result.mfds_drug_shpe = first?.DRUG_SHPE;
  } catch(e) {
    result.mfds_error = e.message;
  }

  // 2. 약학정보원 검색 API 실제 응답
  try {
    const url = `https://www.health.kr/searchDrug/ajax/ajax_commonSearch.asp?search_word=${encodeURIComponent('자디앙')}&search_flag=all&_=${Date.now()}`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.health.kr/',
      },
    });
    const text = await r.text();
    result.healthkr_search_status = r.status;
    result.healthkr_search_raw = text.substring(0, 500);
    try {
      const parsed = JSON.parse(text);
      result.healthkr_search_first = parsed[0];
      result.healthkr_drug_cd = parsed[0]?.drug_cd;
    } catch(e) {
      result.healthkr_parse_error = e.message;
    }
  } catch(e) {
    result.healthkr_search_error = e.message;
  }

  // 3. 약학정보원 상세 API (drug_cd가 있으면)
  if (result.healthkr_drug_cd) {
    try {
      const url = `https://www.health.kr/searchDrug/ajax/ajax_result_drug2.asp?drug_cd=${result.healthkr_drug_cd}&_=${Date.now()}`;
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0',
          'Referer': `https://www.health.kr/searchDrug/result_drug.asp?drug_cd=${result.healthkr_drug_cd}`,
        },
      });
      const text = await r.text();
      result.healthkr_detail_status = r.status;
      result.healthkr_detail_raw = text.substring(0, 1000);
      try {
        const parsed = JSON.parse(text);
        result.healthkr_detail_first = parsed[0];
        result.healthkr_detail_keys = parsed[0] ? Object.keys(parsed[0]) : [];
      } catch(e) {
        result.healthkr_detail_parse_error = e.message;
      }
    } catch(e) {
      result.healthkr_detail_error = e.message;
    }
  }

  res.status(200).json(result);
}
