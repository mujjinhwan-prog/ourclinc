export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    var params = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query,
      type: 'json',
      numOfRows: '10',
      pageNo: '1'
    });
    var mfdsRes = await fetch('https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + params);
    var mfdsData = await mfdsRes.json();
    var items = [];
    if (mfdsData && mfdsData.body && mfdsData.body.items) {
      items = Array.isArray(mfdsData.body.items) ? mfdsData.body.items : [mfdsData.body.items];
    } else if (mfdsData && mfdsData.response && mfdsData.response.body && mfdsData.response.body.items && mfdsData.response.body.items.item) {
      var raw = mfdsData.response.body.items.item;
      items = Array.isArray(raw) ? raw : [raw];
    }
    var mfdsResult = items.filter(function(it) { return it.LNGS_STDR && it.SHRT_STDR; }).map(function(it) {
      var ingredientEn = '';
      if (it.MATERIAL_NAME) {
        var parts = it.MATERIAL_NAME.split('|');
        var eng = parts.map(function(p) { return p.trim(); }).filter(function(p) { return /[a-zA-Z]/.test(p) && p.length > 1; });
        ingredientEn = eng.join(' / ');
      }
      it.INGR_NAME_EN = ingredientEn || it.CLASS_NAME || '';
      it.MAX_PRICE = it.MAX_PRICE || it.UNIT_PRICE || null;
      it.FORM_CODE_NAME = it.FORM_CODE_NAME || '';
      it.ETC_OTC_NAME = it.ETC_OTC_NAME || '';
      it.CHART = it.CHART || '';
      if (!it.ITEM_IMAGE && it.ITEM_SEQ) {
        it.ITEM_IMAGE = 'https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/' + it.ITEM_SEQ;
      }
      return it;
    });
    if (mfdsResult.length > 0) return res.status(200).json(mfdsResult);
    var aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: 'Korean pharmaceutical database API. Return ONLY JSON array. No markdown.',
        messages: [{ role: 'user', content: query + ' 약품 낱알식별 정보 JSON 배열로 반환. [{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","MAX_PRICE":150,"ITEM_IMAGE":null}] 없으면[].' }]
      })
    });
    var aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);
    var text = (aiData.content || []).map(function(b) { return b.text || ''; }).join('');
    var startIdx = text.indexOf('[');
    var endIdx = text.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return res.status(200).json([]);
    var jsonStr = text.substring(startIdx, endIdx + 1);
    var parsed = JSON.parse(jsonStr);
    return res.status(200).json(parsed.filter(function(it) { return it.LNGS_STDR && it.SHRT_STDR; }));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
