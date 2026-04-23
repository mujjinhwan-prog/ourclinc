export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    const params = new URLSearchParams({
      serviceKey: process.env.MFDS_API_KEY,
      item_name: query,
      type: 'json',
      numOfRows: '10',
      pageNo: '1'
    });

    const url = `https://apis.data.go.kr/1471000/MdcinGrnIdntfcInfoService03/getMdcinGrnIdntfcInfoList03?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    let items = [];
    if (data?.body?.items) {
      items = Array.isArray(data.body.items) ? data.body.items : [data.body.items];
    } else
