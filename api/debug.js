export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const result = {};
  const HIRA_KEY = process.env.HIRA_API_KEY;

  function getXmlTag(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : null;
  }
  function parseHiraXmlItems(xml) {
    const items = [];
    const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const blockFull of itemBlocks) {
      const inner = blockFull.replace(/^<item>/, '').replace(/<\/item>$/, '');
      const obj = {};
      const fieldMatches = inner.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g);
      for (const m of fieldMatches) obj[m[1]] = m[2].trim();
      if (Object.keys(obj).length > 0) items.push(obj);
    }
    return items;
  }

  const testNames = ['테네리아', '테네리아정20밀리그램(테네리글립틴브롬화수소산염수화물)'];

  for (const name of testNames) {
    try {
      const word = name.replace(/\(.*?\)/g, '').trim();
      const params = new URLSearchParams({
        serviceKey: HIRA_KEY, itmNm: word, numOfRows: '10', pageNo: '1',
      });
      const url = 'https://apis.data.go.kr/B551182/dgamtCrtrInfoService1.2/getDgamtList?' + params;
      const r = await fetch(url);
      const xml = await r.text();
      const resultCode = getXmlTag(xml, 'resultCode');
      const items = parseHiraXmlItems(xml);
      result[name] = {
        word_searched: word,
        status: r.status,
        resultCode,
        resultMsg: getXmlTag(xml, 'resultMsg'),
        items_count: items.length,
        items: items.map(it => ({ itmNm: it.itmNm, mxCprc: it.mxCprc })),
      };
    } catch(e) {
      result[name] = { error: e.message };
    }
  }

  res.status(200).json(result);
}
