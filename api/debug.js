export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const MFDS_KEY = process.env.MFDS_API_KEY;
  const result = {};

  try {
    const params = new URLSearchParams({
      serviceKey: MFDS_KEY, item_name: '자디앙',
      type: 'json', numOfRows: '1', pageNo: '1',
    });
    const r = await fetch('https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params);
    const d = await r.json();
    const items = d?.body?.items || d?.response?.body?.items?.item;
    const first = Array.isArray(items) ? items[0] : items;
    result.mfds = first;
  } catch(e) { result.mfds_error = e.message; }

  try {
    const url = `https://www.health.kr/searchDrug/ajax/ajax_commonSearch.asp?search_word=${encodeURIComponent('자디앙')}&search_flag=all`;
    const r = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.health.kr/' }
    });
    const text = await r.text();
    result.healthkr_status = r.status;
    result.healthkr_raw = text.substring(0, 800);
  } catch(e) { result.healthkr_error = e.message; }

  res.status(200).json(result);
}
