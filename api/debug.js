// HIRA 약가기준정보조회서비스 실제 응답 확인
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};
  const HIRA_KEY = process.env.HIRA_API_KEY;

  result.hira_key_exists = !!HIRA_KEY;
  result.hira_key_length = HIRA_KEY ? HIRA_KEY.length : 0;

  try {
    const params = new URLSearchParams({
      serviceKey: HIRA_KEY,
      itmNm: '자디앙',
      numOfRows: '10',
      pageNo: '1',
      type: 'json',
    });
    const url = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params;
    result.request_url = url.replace(HIRA_KEY, 'HIDDEN_KEY');

    const r = await fetch(url);
    result.status = r.status;
    result.content_type = r.headers.get('content-type');

    const text = await r.text();
    result.raw_text = text.substring(0, 2000);

    try {
      const data = JSON.parse(text);
      result.parsed = data;
    } catch(e) {
      result.parse_error = e.message;
    }
  } catch(e) {
    result.fetch_error = e.message;
  }

  res.status(200).json(result);
}
