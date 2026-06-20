// 실제 /api/search 가 자디앙에 대해 무엇을 반환하는지 그대로 확인
import searchHandler from './search.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // search.js 핸들러를 직접 호출하기 위한 가짜 req/res
  const fakeReq = { method: 'POST', body: { query: '자디앙' } };

  let captured = null;
  const fakeRes = {
    setHeader: () => {},
    status: (code) => ({
      json: (data) => { captured = { code, data }; return fakeRes; },
      end: () => fakeRes,
    }),
  };

  try {
    await searchHandler(fakeReq, fakeRes);
    res.status(200).json({
      ok: true,
      status: captured?.code,
      result: captured?.data,
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message, stack: e.stack });
  }
}
