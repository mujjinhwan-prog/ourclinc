export default async function handler(req, res) {
  const MFDS_KEY = process.env.MFDS_API_KEY;
  const word = req.query.word || '엡클루사';
  const params = new URLSearchParams({
    serviceKey: MFDS_KEY, item_name: word,
    type: 'json', numOfRows: '5', pageNo: '1',
  });
  try {
    const r = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params,
      { signal: AbortSignal.timeout(8000) }
    );
    const d = await r.json();
    const b1 = d?.body?.items;
    const b2 = d?.response?.body?.items?.item;
    const items = b1 ? (Array.isArray(b1)?b1:[b1]) : b2 ? (Array.isArray(b2)?b2:[b2]) : [];
    const result = items.map(it => ({
      ITEM_NAME: it.ITEM_NAME,
      ITEM_SEQ: it.ITEM_SEQ,
    }));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
