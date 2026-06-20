export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const MFDS_KEY = process.env.MFDS_API_KEY;
  const params = new URLSearchParams({
    serviceKey: MFDS_KEY, item_name: '자디앙듀오',
    type: 'json', numOfRows: '10', pageNo: '1',
  });
  const r = await fetch(
    'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params
  );
  const d = await r.json();
  const items = d?.body?.items || d?.response?.body?.items?.item || [];
  const arr = Array.isArray(items) ? items : [items];
  res.status(200).json(arr.map(it => ({
    ITEM_NAME: it.ITEM_NAME,
    DRUG_SHAPE: it.DRUG_SHAPE,
    DRUG_SHPE: it.DRUG_SHPE,
    LENG_LONG: it.LENG_LONG,
    LENG_SHORT: it.LENG_SHORT,
    THICK: it.THICK,
  })));
}
