export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    // ─── 1단계: 식약처 낱알식별 API ───────────────────────────────────────
    const mfdsParams = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query,
      type: 'json',
      numOfRows: '10',
      pageNo: '1'
    });
    const mfdsRes = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + mfdsParams
    );
    const mfdsData = await mfdsRes.json();

    let items = [];
    if (mfdsData?.body?.items) {
      items = Array.isArray(mfdsData.body.items) ? mfdsData.body.items : [mfdsData.body.items];
    } else if (mfdsData?.response?.body?.items?.item) {
      const raw = mfdsData.response.body.items.item;
      items = Array.isArray(raw) ? raw : [raw];
    }

    let mfdsResult = items
      .filter(it => it.LNGS_STDR && it.SHRT_STDR)
      .map(it => {
        let ingredientEn = '';
        if (it.MATERIAL_NAME) {
          const parts = it.MATERIAL_NAME.split('|');
          const eng = parts
            .map(p => p.trim())
            .filter(p => /[a-zA-Z]/.test(p) && p.length > 1);
          ingredientEn = eng.join(' / ');
        }
        return {
          ...it,
          INGR_NAME_EN: ingredientEn || it.CLASS_NAME || '',
          FORM_CODE_NAME: it.FORM_CODE_NAME || '',
          ETC_OTC_NAME: it.ETC_OTC_NAME || '',
          ITEM_IMAGE: it.ITEM_IMAGE || (it.ITEM_SEQ
            ? 'https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/' + it.ITEM_SEQ
            : null),
          PRICE: null,
          PRICE_UNIT: null,
        };
      });

    // ─── 2단계: HIRA 급여 약가 조회 ───────────────────────────────────────
    if (mfdsResult.length > 0) {
      const hiraResults = await Promise.all(
        mfdsResult.map(async it => {
          try {
            const hiraParams = new URLSearchParams({
              serviceKey: process.env.HIRA_API_KEY,
              pageNo: '1',
              numOfRows: '5',
              ediCode: it.ITEM_SEQ || '',
              itemName: it.ITEM_NAME || '',
              type: 'json'
            });

            const hiraRes = await fetch(
              'https://apis.data.go.kr/B551182/msupRtrvl/getDrugPriceInfoList?' + hiraParams
            );
            const hiraData = await hiraRes.json();

            let priceItems = [];
            const body = hiraData?.response?.body ?? hiraData?.body;
            if (body?.items?.item) {
              const raw = body.items.item;
              priceItems = Array.isArray(raw) ? raw : [raw];
            }

            if (priceItems.length > 0) {
              const best = priceItems[0];
              const unitPrice = best.mxRbdAmt ?? best.cpAmt ?? null;
              const unit = best.unit ?? '정';
              return { ...it, PRICE: unitPrice ? Number(unitPrice) : null, PRICE_UNIT: unit };
            }
            return it;
          } catch (e) {
            console.error('HIRA price error for', it.ITEM_NAME, e.message);
            return it;
          }
        })
      );
      mfdsResult = hiraResults;
      return res.status(200).json(mfdsResult);
    }

    // ─── 3단계: 식약처에 없으면 Claude AI 보완 ────────────────────────────
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{
          role: 'user',
          content: query + ' 약품 낱알식별 정보 JSON 배열로 반환.\n[{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","PRICE":null,"PRICE_UNIT":"정","ITEM_IMAGE":null}]\n없으면 [].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return res.status(200).json([]);

    const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));
    return res.status(200).json(
      parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR)
    );

  } catch (e) {
    console.error('Search handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    // ─── 1단계: 식약처 낱알식별 API ───────────────────────────────────────
    const mfdsParams = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query,
      type: 'json',
      numOfRows: '10',
      pageNo: '1'
    });
    const mfdsRes = await fetch(
      'https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?' + mfdsParams
    );
    const mfdsData = await mfdsRes.json();

    let items = [];
    if (mfdsData?.body?.items) {
      items = Array.isArray(mfdsData.body.items) ? mfdsData.body.items : [mfdsData.body.items];
    } else if (mfdsData?.response?.body?.items?.item) {
      const raw = mfdsData.response.body.items.item;
      items = Array.isArray(raw) ? raw : [raw];
    }

    let mfdsResult = items
      .filter(it => it.LNGS_STDR && it.SHRT_STDR)
      .map(it => {
        let ingredientEn = '';
        if (it.MATERIAL_NAME) {
          const parts = it.MATERIAL_NAME.split('|');
          const eng = parts
            .map(p => p.trim())
            .filter(p => /[a-zA-Z]/.test(p) && p.length > 1);
          ingredientEn = eng.join(' / ');
        }
        return {
          ...it,
          INGR_NAME_EN: ingredientEn || it.CLASS_NAME || '',
          FORM_CODE_NAME: it.FORM_CODE_NAME || '',
          ETC_OTC_NAME: it.ETC_OTC_NAME || '',
          ITEM_IMAGE: it.ITEM_IMAGE || (it.ITEM_SEQ
            ? 'https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/' + it.ITEM_SEQ
            : null),
          PRICE: null,
          PRICE_UNIT: null,
        };
      });

    // ─── 2단계: HIRA 급여 약가 조회 ───────────────────────────────────────
    if (mfdsResult.length > 0) {
      const hiraResults = await Promise.all(
        mfdsResult.map(async it => {
          try {
            const hiraParams = new URLSearchParams({
              serviceKey: process.env.HIRA_API_KEY,
              pageNo: '1',
              numOfRows: '5',
              ediCode: it.ITEM_SEQ || '',
              itemName: it.ITEM_NAME || '',
              type: 'json'
            });

            const hiraRes = await fetch(
              'https://apis.data.go.kr/B551182/msupRtrvl/getDrugPriceInfoList?' + hiraParams
            );
            const hiraData = await hiraRes.json();

            let priceItems = [];
            const body = hiraData?.response?.body ?? hiraData?.body;
            if (body?.items?.item) {
              const raw = body.items.item;
              priceItems = Array.isArray(raw) ? raw : [raw];
            }

            if (priceItems.length > 0) {
              const best = priceItems[0];
              const unitPrice = best.mxRbdAmt ?? best.cpAmt ?? null;
              const unit = best.unit ?? '정';
              return { ...it, PRICE: unitPrice ? Number(unitPrice) : null, PRICE_UNIT: unit };
            }
            return it;
          } catch (e) {
            console.error('HIRA price error for', it.ITEM_NAME, e.message);
            return it;
          }
        })
      );
      mfdsResult = hiraResults;
      return res.status(200).json(mfdsResult);
    }

    // ─── 3단계: 식약처에 없으면 Claude AI 보완 ────────────────────────────
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{
          role: 'user',
          content: query + ' 약품 낱알식별 정보 JSON 배열로 반환.\n[{"ITEM_NAME":"품목명","ENTP_NAME":"업체명","LNGS_STDR":8.2,"SHRT_STDR":8.2,"THICK":4.1,"DRUG_SHPE":"원형","DRUG_COLO":"분홍","PRINT_FRONT":"D5","PRINT_BACK":"","CLASS_NAME":"당뇨병용제","INGR_NAME_EN":"Linagliptin","FORM_CODE_NAME":"필름코팅정","ETC_OTC_NAME":"전문의약품","PRICE":null,"PRICE_UNIT":"정","ITEM_IMAGE":null}]\n없으면 [].'
        }]
      })
    });

    const aiData = await aiRes.json();
    if (aiData.error) return res.status(200).json([]);

    const text = (aiData.content || []).map(b => b.text || '').join('');
    const startIdx = text.indexOf('[');
    const endIdx = text.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return res.status(200).json([]);

    const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));
    return res.status(200).json(
      parsed.filter(it => it.LNGS_STDR && it.SHRT_STDR)
    );

  } catch (e) {
    console.error('Search handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}
