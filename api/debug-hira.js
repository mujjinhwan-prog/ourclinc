// 임시 디버그용 — api/debug-hira.js 로 추가하고 브라우저에서
// https://ourclinic.vercel.app/api/debug-hira?word=직듀오서방정
// 으로 접속하면 HIRA가 실제로 뭘 반환하는지 그대로 볼 수 있어요.
export default async function handler(req, res) {
  const HIRA_KEY = process.env.HIRA_API_KEY;
  const word = req.query.word || '직듀오서방정';

  const params = new URLSearchParams({
    serviceKey: HIRA_KEY,
    itmNm: word,
    numOfRows: '30',
    pageNo: '1',
  });

  try {
    const r = await fetch(
      'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params,
      { signal: AbortSignal.timeout(8000) }
    );
    const xml = await r.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(xml);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
