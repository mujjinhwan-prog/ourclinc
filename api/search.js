export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    // 1단계: 식약처 낱알식별 API
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
      it.FORM_CODE_NAME = it.FORM_CODE_NAME || '';
      it.ETC_OTC_NAME = it.ETC_OTC_NAME || '';
      if (!it.ITEM_IMAGE && it.ITEM_SEQ) {
        it.ITEM_IMAGE = 'https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/' + it.ITEM_SEQ;
      }
      it.PRICE = null; // 약가는 별도 조회
      return it;
    });

    // 2단계: 약가 웹서칭 (Claude 웹검색)
    if (mfdsResult.length > 0) {
      try {
        var itemNames = mfdsResult.map(function(it) { return it.ITEM_NAME; }).join(', ');
        var priceRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            system: '약가 정보를 웹에서 검색하여 JSON 객체만 반환하세요. 설명 없이 순수 JSON만.',
            messages: [{
              role: 'user',
              content: '다음 약품들의 급여 약가(원/정 또는 원/캡슐)를 드럭인포(druginfo.co.kr) 또는 약학정보원(health.kr)에서 검색해서 JSON 객체로 반환하세요.
약품목록: ' + itemNames + '
형식: {"약품명":숫자(원단위), "약품명2":숫자} 
약가를 찾을 수 없으면 null. 순수 JSON만 반환.'
            }]
          })
        });

        var priceData = await priceRes.json();
        var priceText = (priceData.content || []).map(function(b) { return b.text || ''; }).join('');
        var priceStart = priceText.indexOf('{');
        var priceEnd = priceText.lastIndexOf('}');
        if (priceStart !== -1 && priceEnd !== -1) {
          var priceJson = JSON.parse(priceText.substring(priceStart, priceEnd + 1));
          mfdsResult = mfdsResult.map(function(it) {
            // 약품명으로 약가 매칭
            var itemName = it.ITEM_NAME || '';
            for (var key in priceJson) {
              if (itemName.includes(key) || key.includes(itemName.substring(0, 4))) {
                it.PRICE = priceJson[key];
                break;
              }
            }
            return it;
          });
        }
      } catch(priceErr) {
        // 약가 조회 실패해도 나머지 데이터는 반환
        console.error('Price search error:', priceErr.message);
      }

      return res.status(200).json(mfdsResult);
    }

    // 3단계: 식약처에 없으면 Claude AI 보완
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
        messages: [{ role: 'user', content: query + ' 약품 낱알식별 정보 JSON 배열로 반환. [{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","PRICE":null,"ITEM_IMAGE":null}] 없으면[].' }]
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
