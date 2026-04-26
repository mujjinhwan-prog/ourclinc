import { useState, useEffect, useRef, useCallback } from "react";

const SHAPE_MAP = {
  "원형":"circle","타원형":"oval","장방형":"oblong","반원형":"oval",
  "사각형":"oblong","마름모형":"diamond","오각형":"pentagon",
  "육각형":"hexagon","팔각형":"hexagon","삼각형":"diamond","기타":"other"
};
function parseShape(s) {
  if (!s) return "circle";
  for (const [k,v] of Object.entries(SHAPE_MAP)) if (s.includes(k)) return v;
  return "circle";
}
const COLOR_MAP = {
  "하양":"#FFFFFF","흰색":"#FFFFFF","백색":"#FFFFFF","흰":"#FFFFFF",
  "노랑":"#F5C842","노란":"#F5C842","황색":"#E8B84B",
  "연노랑":"#FFF0A0","주황":"#F47C2F","오렌지":"#F47C2F",
  "분홍":"#F48FB1","핑크":"#F48FB1","연분홍":"#FBBCD4","살색":"#FFCCAA",
  "빨강":"#E53935","적색":"#E53935","붉은":"#E53935",
  "파랑":"#1E88E5","청색":"#1E88E5","파란":"#1E88E5",
  "연파랑":"#90CAF9","하늘":"#87CEEB","하늘색":"#87CEEB",
  "초록":"#43A047","녹색":"#43A047","그린":"#43A047",
  "연두":"#9CCC65","보라":"#8E24AA","자색":"#8E24AA",
  "연보라":"#CE93D8","갈색":"#8D6E63","회색":"#9E9E9E","회":"#9E9E9E",
  "검정":"#424242","흑색":"#424242","투명":"rgba(220,220,220,0.3)",
};
function parsePillColor(s) {
  if (!s) return null;
  for (const [k,v] of Object.entries(COLOR_MAP)) if (s.includes(k)) return v;
  return null;
}
const ACCENT = ["#3b5bdb","#7048e8","#0ca678","#e67700","#c2255c","#1098ad","#2f9e44","#862e9c"];

async function fetchDrug(query) {
  const r = await fetch("/api/search", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  if (!r.ok) throw new Error("서버 오류: " + r.status);
  const raw = await r.json();
  if (raw.error) throw new Error(raw.error);
  return raw.filter(it => it.LNGS_STDR && it.SHRT_STDR).map((it,i) => ({
    id:(it.ITEM_NAME||"p")+"_"+i,
    name:it.ITEM_NAME||"",
    width:parseFloat(it.LNGS_STDR)||0,
    height:parseFloat(it.SHRT_STDR)||0,
    thickness:it.THICK?parseFloat(it.THICK):null,
    shape:parseShape(it.DRUG_SHPE),
    shapeKr:it.DRUG_SHPE||"",
    colorName:it.DRUG_COLO||"",
    colorCss:parsePillColor(it.DRUG_COLO||""),
    formName:it.FORM_CODE_NAME||"",
    etcOtc:it.ETC_OTC_NAME||"",
    mark:(it.PRINT_FRONT||"")+(it.PRINT_BACK?"/"+it.PRINT_BACK:""),
    hiraClass:it.HIRA_CLASS||it.CLASS_NAME||"",
    price:it.PRICE||null,
    priceUnit:it.PRICE_UNIT||"정",
  }));
}

function PillShapeEl({ pill, pxPerMm, accentColor }) {
  const wPx = pill.width * pxPerMm;
  const hPx = pill.height * pxPerMm;
  let borderRadius = "50%", clipPath = "";
  if (pill.shape==="oblong") borderRadius = Math.min(wPx,hPx)*0.5+"px";
  if (pill.shape==="diamond") { borderRadius="4px"; clipPath="polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; }
  if (pill.shape==="pentagon"||pill.shape==="hexagon") borderRadius="20%";
  const pillColor = pill.colorCss||"#e0e0e0";
  const isWhite = pillColor==="#FFFFFF";
  const isLight = ["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8"].includes(pillColor);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <div style={{position:"relative",display:"flex",alignItems:"flex-start"}}>
        <div style={{width:wPx,height:hPx,borderRadius,clipPath:clipPath||undefined,flexShrink:0,
          background:"linear-gradient(145deg,"+pillColor+"ee,"+pillColor+","+pillColor+"bb)",
          boxShadow:isWhite?"0 3px 12px rgba(0,0,0,0.18)":"0 3px 14px "+pillColor+"99",
          border:isWhite?"1.5px solid #bbb":"1.5px solid "+pillColor+"88",
          outline:"2px solid "+accentColor+"44",outlineOffset:3,
          display:"flex",alignItems:"center",justifyContent:"center",
          overflow:"hidden",position:"relative"}}>
          <div style={{position:"absolute",top:"6%",left:"10%",right:"35%",height:"20%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.65),transparent)",
            borderRadius:99,filter:"blur(2px)",transform:"rotate(-10deg)"}}/>
          {pill.mark&&<span style={{position:"relative",zIndex:1,fontFamily:"monospace",fontWeight:700,
            fontSize:Math.max(6,Math.min(wPx,hPx)*0.15),color:isLight?"#555":"#fff",opacity:0.8,userSelect:"none"}}>
            {pill.mark.split("/")[0].trim()}</span>}
        </div>
        <div style={{position:"absolute",right:-24,top:0,height:hPx,display:"flex",alignItems:"center",gap:2}}>
          <div style={{width:2,height:"100%",background:accentColor+"bb",borderRadius:1,position:"relative"}}>
            <div style={{position:"absolute",left:-3,top:0,width:8,height:2,background:accentColor+"bb"}}/>
            <div style={{position:"absolute",left:-3,bottom:0,width:8,height:2,background:accentColor+"bb"}}/>
          </div>
          <span style={{fontFamily:"monospace",fontSize:8,color:accentColor,fontWeight:700,
            writingMode:"vertical-rl",transform:"rotate(180deg)",lineHeight:1,whiteSpace:"nowrap"}}>
            {pill.height}mm</span>
        </div>
      </div>
      <div style={{width:wPx,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
        <div style={{width:"100%",height:2,background:accentColor+"bb",borderRadius:1,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:-2,width:2,height:6,background:accentColor+"bb"}}/>
          <div style={{position:"absolute",right:0,top:-2,width:2,height:6,background:accentColor+"bb"}}/>
        </div>
        <span style={{fontFamily:"monospace",fontSize:9,color:accentColor,fontWeight:700}}>{pill.width}mm</span>
      </div>
    </div>
  );
}

const MAX=8, ROW=4;

export default function App() {
  const [slots,setSlots]           = useState(Array(MAX).fill(null));
  const [activeSlot,setActiveSlot] = useState(0);
  const [query,setQuery]           = useState("");
  const [results,setResults]       = useState([]);
  const [loading,setLoading]       = useState(false);
  const [error,setError]           = useState("");
  const [showDrop,setShowDrop]     = useState(false);
  const [pxPerMm,setPxPerMm]       = useState(3.7795);
  const [dpiInfo,setDpiInfo]       = useState("DPI 측정 중...");
  const [ppiInput,setPpiInput]     = useState("");
  const debRef=useRef(null), inRef=useRef(null), dropRef=useRef(null);

  useEffect(()=>{
    const el=document.createElement("div");
    el.style.cssText="position:fixed;width:1in;visibility:hidden;left:-9999px";
    document.body.appendChild(el);
    const dpi=el.offsetWidth; document.body.removeChild(el);
    const ppm=dpi/25.4; setPxPerMm(ppm);
    setDpiInfo(Math.round(dpi)+" DPI · "+ppm.toFixed(2)+"px/mm");
  },[]);

  useEffect(()=>{
    const h=e=>{if(!dropRef.current?.contains(e.target)&&!inRef.current?.contains(e.target))setShowDrop(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const doSearch=useCallback(async q=>{
    if(!q||q.length<2)return;
    setLoading(true);setError("");setShowDrop(true);setResults([]);
    try{const r=await fetchDrug(q);setResults(r);if(!r.length)setError("결과 없음.");}
    catch(e){setError("조회 실패: "+e.message);}
    finally{setLoading(false);}
  },[]);

  const handleInput=e=>{const v=e.target.value;setQuery(v);clearTimeout(debRef.current);
    if(v.length>=2)debRef.current=setTimeout(()=>doSearch(v),750);else setShowDrop(false);};
  const handleKey=e=>{
    if(e.key==="Enter"){clearTimeout(debRef.current);doSearch(query);}
    if(e.key==="Escape")setShowDrop(false);};
  const pick=item=>{
    if(slots.find(s=>s&&s.id===item.id))return;
    const ns=[...slots];ns[activeSlot]=item;setSlots(ns);
    let next=-1;
    for(let i=activeSlot+1;i<MAX;i++)if(!ns[i]){next=i;break;}
    if(next===-1)for(let i=0;i<activeSlot;i++)if(!ns[i]){next=i;break;}
    if(next!==-1)setActiveSlot(next);
    setQuery("");setShowDrop(false);setResults([]);};
  const clickSlot=idx=>setActiveSlot(idx);
  const removeSlot=(e,idx)=>{e.stopPropagation();const ns=[...slots];ns[idx]=null;setSlots(ns);setActiveSlot(idx);};
  const resetAll=()=>{setSlots(Array(MAX).fill(null));setActiveSlot(0);setQuery("");setResults([]);setShowDrop(false);};
  const applyPPI=()=>{const v=parseInt(ppiInput);if(!v||v<72||v>600)return;
    const ppm=v/25.4;setPxPerMm(ppm);setDpiInfo(v+" PPI (수동) · "+ppm.toFixed(2)+"px/mm");};

  // ★ 인쇄 — iframe + VS 구분선
  const handlePrint=()=>{
    const ppm=11.811;
    const today=new Date().toLocaleDateString("ko-KR");

    const pillHtml=(pill,idx)=>{
      if(!pill) return '<div style="border:1px dashed #dde;border-radius:8px;min-height:150px;display:flex;align-items:center;justify-content:center;color:#dde;font-size:9pt;">빈 슬롯</div>';
      const color=ACCENT[idx];
      const pc=pill.colorCss||"#e0e0e0";
      const isWhite=pc==="#FFFFFF";
      const isLight=["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8"].includes(pc);
      const wPx=(pill.width*ppm).toFixed(1);
      const hPx=(pill.height*ppm).toFixed(1);
      let br="50%";
      if(pill.shape==="oblong")br=(Math.min(pill.width,pill.height)*ppm*0.5).toFixed(1)+"px";
      if(pill.shape==="pentagon"||pill.shape==="hexagon")br="20%";
      const cp=pill.shape==="diamond"?"clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);":"";
      const mark=pill.mark?pill.mark.split("/")[0].trim():"";
      const markSz=Math.max(6,Math.min(pill.width,pill.height)*ppm*0.15).toFixed(1);
      const rp=(parseFloat(wPx)+6).toFixed(1);
      return `<div style="border:1.5px solid ${color}55;border-radius:10px;padding:8px 8px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;box-shadow:0 2px 8px ${color}22;">
  <div style="font-size:7.5pt;font-weight:700;color:${color};text-align:center;width:100%;border-bottom:1px solid #eee;padding-bottom:3px;margin-bottom:1px;word-break:keep-all;line-height:1.3;">${pill.name}</div>
  <div style="position:relative;display:inline-flex;align-items:flex-start;margin:3px 26px 1px 4px;">
    <div style="width:${wPx}px;height:${hPx}px;border-radius:${br};${cp}
      background:linear-gradient(145deg,${pc}ee,${pc},${pc}bb);
      box-shadow:${isWhite?"0 2px 8px rgba(0,0,0,0.2)":"0 2px 10px "+pc+"88"};
      border:${isWhite?"1.5px solid #bbb":"1.5px solid "+pc+"88"};
      outline:2px solid ${color}44;outline-offset:3px;
      display:flex;align-items:center;justify-content:center;overflow:hidden;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span style="font-family:monospace;font-weight:700;font-size:${markSz}px;color:${isLight?"#555":"#fff"};opacity:0.8;">${mark}</span>
    </div>
    <div style="position:absolute;left:${rp}px;top:0;height:${hPx}px;display:flex;align-items:center;gap:2px;">
      <div style="width:2px;height:100%;background:${color}bb;position:relative;">
        <div style="position:absolute;left:-3px;top:0;width:8px;height:2px;background:${color}bb;"></div>
        <div style="position:absolute;left:-3px;bottom:0;width:8px;height:2px;background:${color}bb;"></div>
      </div>
      <span style="font-family:monospace;font-size:6pt;color:${color};font-weight:700;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;">${pill.height}mm</span>
    </div>
  </div>
  <div style="width:${wPx}px;display:flex;flex-direction:column;align-items:center;gap:1px;">
    <div style="width:100%;height:2px;background:${color}bb;position:relative;">
      <div style="position:absolute;left:0;top:-2px;width:2px;height:6px;background:${color}bb;"></div>
      <div style="position:absolute;right:0;top:-2px;width:2px;height:6px;background:${color}bb;"></div>
    </div>
    <span style="font-family:monospace;font-size:7pt;color:${color};font-weight:700;">${pill.width}mm</span>
  </div>
  <div style="display:flex;align-items:center;gap:3px;font-size:6.5pt;color:#888;margin:1px 0;">
    <div style="width:37.8px;height:1.5px;background:#bbb;position:relative;-webkit-print-color-adjust:exact;">
      <div style="position:absolute;left:0;top:-2px;width:1.5px;height:6px;background:#bbb;"></div>
      <div style="position:absolute;right:0;top:-2px;width:1.5px;height:6px;background:#bbb;"></div>
    </div><span>1cm</span>
  </div>
  <div style="font-size:6.5pt;color:#444;text-align:center;line-height:1.6;width:100%;">
    ${pill.etcOtc?'<span style="-webkit-print-color-adjust:exact;font-weight:700;color:'+(pill.etcOtc.includes("전문")?"#dc2626":"#16a34a")+'">'+(pill.etcOtc.includes("전문")?"전문의약품":"일반의약품")+"</span><br>":""}
    ${pill.formName?'<span style="color:#3b5bdb;">'+pill.formName+"</span><br>":""}
    ${pill.colorName||""}${pill.shapeKr?" / "+pill.shapeKr:""}<br>
    <b style="color:${color};-webkit-print-color-adjust:exact;">${pill.width}×${pill.height}${pill.thickness?"×"+pill.thickness:""}mm</b><br>
    ${pill.hiraClass?'<span style="color:#64748b;">'+pill.hiraClass+"</span><br>":""}
    ${pill.price?'<b style="color:#0ca678;-webkit-print-color-adjust:exact;">'+Number(pill.price).toLocaleString()+"원/"+(pill.priceUnit||"정")+"</b>":""}
  </div>
</div>`;};

    const row1=slots.slice(0,4).map((p,i)=>pillHtml(p,i)).join("");
    const row2=slots.slice(4,8).map((p,i)=>pillHtml(p,i+4)).join("");

    // VS 구분선 SVG — 만화 스타일
    const vsDivider=`
<div style="display:flex;align-items:center;justify-content:center;margin:6px 0;position:relative;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <!-- 왼쪽 번개 라인 -->
  <div style="flex:1;height:3px;background:linear-gradient(90deg,#fff,#3b5bdb,#7048e8);border-radius:99px;margin-right:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>

  <!-- VS 뱃지 -->
  <div style="position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
    <!-- 외부 폭발 효과 -->
    <svg width="120" height="52" viewBox="0 0 120 52" xmlns="http://www.w3.org/2000/svg" style="-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <defs>
        <radialGradient id="bg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#7048e8"/>
          <stop offset="100%" stop-color="#3b5bdb"/>
        </radialGradient>
      </defs>
      <!-- 폭발 방사형 -->
      <polygon points="60,2 65,18 78,8 70,22 86,18 74,28 88,34 72,34 76,50 62,38 60,52 58,38 44,50 48,34 32,34 46,28 34,18 50,22 42,8 55,18" fill="url(#bg1)" opacity="0.15"/>
      <!-- 메인 배경 -->
      <rect x="8" y="10" width="104" height="32" rx="6" fill="url(#bg1)"/>
      <!-- 테두리 번쩍임 -->
      <rect x="8" y="10" width="104" height="32" rx="6" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.6"/>
      <!-- 번개 왼쪽 -->
      <text x="18" y="31" font-family="Arial Black,sans-serif" font-size="16" font-weight="900" fill="#FFD700" opacity="0.9">⚡</text>
      <!-- VS 텍스트 -->
      <text x="60" y="33" font-family="Arial Black,Impact,sans-serif" font-size="18" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2" style="-webkit-print-color-adjust:exact;">VS</text>
      <!-- 번개 오른쪽 -->
      <text x="88" y="31" font-family="Arial Black,sans-serif" font-size="16" font-weight="900" fill="#FFD700" opacity="0.9">⚡</text>
    </svg>
    <!-- 말풍선 텍스트 -->
    <div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);
      background:#FFD700;color:#1a1f36;font-size:6pt;font-weight:900;
      padding:2px 8px;border-radius:99px;white-space:nowrap;
      box-shadow:0 2px 4px rgba(0,0,0,0.2);-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      💊 약제 크기 비교 💊
    </div>
    <div style="position:absolute;bottom:-13px;left:50%;transform:translateX(-50%);
      color:#7048e8;font-size:5.5pt;font-weight:700;white-space:nowrap;
      -webkit-print-color-adjust:exact;print-color-adjust:exact;">
      ─── 실제 크기(mm) 기준 ───
    </div>
  </div>

  <!-- 오른쪽 번개 라인 -->
  <div style="flex:1;height:3px;background:linear-gradient(90deg,#7048e8,#3b5bdb,#fff);border-radius:99px;margin-left:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
</div>`;

    const html=`<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<title>약품 크기 비교표 — Voice of YUHAN</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:white;}
@page{size:A4 landscape;margin:7mm}
@media print{body{margin:0;padding:0}}
.header{display:flex;align-items:center;gap:10px;border-bottom:2.5px solid #3b5bdb;
  padding-bottom:5px;margin-bottom:7px;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.footer{margin-top:6px;font-size:6.5pt;color:#94a3b8;border-top:1px solid #eee;padding-top:4px;text-align:center;}
</style>
</head><body>
<div class="header">
  <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png"
    style="height:36px;width:auto;object-fit:contain;" alt="logo" onerror="this.style.display='none'"/>
  <div>
    <div style="font-size:13pt;font-weight:700;color:#1a1f36;">약품 실제 크기 비교표</div>
    <div style="font-size:7.5pt;color:#64748b;">식약처 공식 낱알식별 데이터 · Voice of YUHAN · made by mujjinhwan</div>
  </div>
  <div style="margin-left:auto;font-size:8pt;color:#94a3b8;text-align:right;">
    인쇄일: ${today}
  </div>
</div>

<!-- 1번 그룹 -->
<div class="grid">${row1}</div>

<!-- VS 구분선 -->
${vsDivider}

<!-- 2번 그룹 -->
<div class="grid" style="margin-top:8px;">${row2}</div>

<div class="footer">
  ※ 표시된 크기는 실제 약품 크기(mm)를 300dpi 기준으로 인쇄한 것입니다. 실제 인쇄 환경에 따라 오차가 있을 수 있습니다.
</div>
</body></html>`;

    const iframe=document.createElement("iframe");
    iframe.style.cssText="position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;";
    document.body.appendChild(iframe);
    const doc=iframe.contentDocument||iframe.contentWindow.document;
    doc.open();doc.write(html);doc.close();
    setTimeout(()=>{
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(()=>document.body.removeChild(iframe),2000);
    },800);
  };

  const oneCm=pxPerMm*10;
  const filledSlots=slots.map((s,i)=>({pill:s,idx:i})).filter(x=>x.pill);
  const hasAny=filledSlots.length>0;
  const rows=[
    slots.slice(0,ROW).map((s,i)=>({pill:s,idx:i})),
    slots.slice(ROW,MAX).map((s,i)=>({pill:s,idx:ROW+i})),
  ];
  const tableRows=[
    {label:"구분",render:(p)=>p.etcOtc?<span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"2px 8px",borderRadius:50,fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>{p.etcOtc.includes("전문")?"전문의약품":"일반의약품"}</span>:<span style={{color:"#94a3b8",fontSize:10}}>-</span>},
    {label:"제형",render:(p)=>p.formName?<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"2px 8px",borderRadius:50,fontSize:10,fontWeight:600}}>{p.formName}</span>:<span style={{color:"#94a3b8",fontSize:10}}>-</span>},
    {label:"색상·모양",render:(p)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>{p.colorCss&&<div style={{width:11,height:11,borderRadius:"50%",background:p.colorCss,border:"1px solid #ddd",flexShrink:0}}/>}<span style={{fontSize:10,color:"#1a1f36"}}>{p.colorName||"-"}{p.shapeKr?" / "+p.shapeKr:""}</span></div>)},
    {label:"크기",render:(p,idx)=>(<span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:ACCENT[idx],whiteSpace:"nowrap"}}>{p.width}×{p.height}{p.thickness?"×"+p.thickness:""}mm</span>)},
    {label:"효능군",render:(p)=>p.hiraClass?<span style={{fontSize:10,color:"#64748b",background:"#f1f5f9",padding:"2px 8px",borderRadius:50,whiteSpace:"nowrap"}}>{p.hiraClass}</span>:<span style={{color:"#94a3b8",fontSize:10}}>-</span>},
    {label:"보험가",render:(p)=>p.price?<span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:"#0ca678",whiteSpace:"nowrap"}}>{Number(p.price).toLocaleString()}원/{p.priceUnit||"정"}</span>:<span style={{color:"#94a3b8",fontSize:10}}>미등재</span>},
  ];

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif",background:"#f0f4f8",minHeight:"100vh",color:"#1a1f36"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        @media(max-width:640px){
          .sbwrap{flex-wrap:wrap !important;gap:6px !important;}
          .sbinput{min-width:100% !important;order:1}
          .btn-s{order:2;flex:1}.btn-r{order:3;flex:1}.btn-p{order:4;flex:1}
          .slot-grid{grid-template-columns:repeat(2,1fr) !important;}
        }
      `}</style>

      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",
        position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",height:56,display:"flex",alignItems:"center",gap:12}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png"
            alt="logo" style={{height:42,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))"}}/>
          <div style={{width:1,height:24,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:10,color:"#64748b"}}>식약처 공식 낱알식별 데이터 made by mujjinhwan</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",
            borderRadius:8,padding:"3px 8px",fontSize:10,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        <div style={{background:"white",borderRadius:16,padding:14,marginBottom:14,
          boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>

          <div className="sbwrap" style={{display:"flex",gap:8,marginBottom:10,position:"relative",zIndex:200}}>
            <div className="sbinput" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 자디앙, 트라젠타, 트윈스타...)"
                style={{width:"100%",padding:"11px 14px 11px 36px",border:"1.5px solid #e2e8f0",
                  borderRadius:10,fontSize:14,fontFamily:"inherit",color:"#1a1f36",
                  background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                  background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,
                  overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"60vh",overflowY:"auto"}}>
                  {loading&&<div style={{padding:14,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:13}}>
                    <div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:12,color:"#64748b",fontSize:13,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map(r=>{
                    const already=slots.find(s=>s&&s.id===r.id);
                    const pillBg=r.colorCss||"#e8e8e8";
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    return(
                      <div key={r.id} onClick={()=>!already&&pick(r)}
                        style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10,
                          borderBottom:"1px solid #f1f5f9",cursor:already?"not-allowed":"pointer",
                          opacity:already?0.45:1,background:"white",transition:"background 0.12s"}}
                        onMouseEnter={e=>{if(!already)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:r.shape==="oblong"?30:18,height:16,borderRadius:shapeR,flexShrink:0,
                          background:pillBg,border:"1px solid #ccc",boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#1a1f36",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {r.name}{already?" ✓":""}</div>
                          <div style={{fontSize:10,color:"#94a3b8",marginTop:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                            {r.etcOtc&&<span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"1px 4px",borderRadius:3,fontWeight:700,fontSize:10}}>{r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 4px",borderRadius:3,fontSize:10}}>{r.formName}</span>}
                            {r.colorName&&<span>{r.colorName}</span>}
                          </div>
                        </div>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,
                          padding:"2px 6px",fontSize:10,fontFamily:"monospace",color:"#3b5bdb",whiteSpace:"nowrap"}}>
                          {r.width}x{r.height}mm</span>
                      </div>);
                  })}
                </div>
              )}
            </div>
            <button className="btn-s" onClick={()=>doSearch(query)}
              style={{padding:"11px 16px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",
                border:"none",borderRadius:10,color:"white",fontSize:14,fontWeight:700,
                fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",
                boxShadow:"0 2px 10px rgba(59,91,219,0.28)"}}>검색</button>
            <button className="btn-r" onClick={resetAll}
              style={{padding:"11px 14px",background:hasAny?"#fee2e2":"#f1f5f9",
                border:"1.5px solid "+(hasAny?"#fecaca":"#e2e8f0"),
                borderRadius:10,color:hasAny?"#dc2626":"#94a3b8",
                fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer",
                whiteSpace:"nowrap",transition:"all 0.2s"}}>🔄 초기화</button>
            <button className="btn-p" onClick={handlePrint} disabled={!hasAny}
              style={{padding:"11px 14px",
                background:hasAny?"linear-gradient(135deg,#0ca678,#2f9e44)":"#f1f5f9",
                border:"1.5px solid "+(hasAny?"#0ca678":"#e2e8f0"),
                borderRadius:10,color:hasAny?"white":"#94a3b8",
                fontSize:14,fontWeight:700,fontFamily:"inherit",
                cursor:hasAny?"pointer":"not-allowed",whiteSpace:"nowrap",
                transition:"all 0.2s",boxShadow:hasAny?"0 2px 10px rgba(12,166,120,0.3)":"none"}}>
              🖨️ 인쇄</button>
          </div>

          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{fontSize:11,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",
              borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:ACCENT[activeSlot],display:"inline-block"}}/>
              <span><b style={{color:ACCENT[activeSlot]}}>슬롯 {activeSlot+1}</b> 활성 · 슬롯 클릭으로 변경</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,background:"#eff6ff",
              border:"1px solid #bfdbfe",borderRadius:10,padding:"5px 12px",fontSize:12,color:"#3730a3"}}>
              📐 PPI:
              <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)}
                placeholder="460" min="72" max="600"
                style={{width:56,padding:"2px 6px",border:"1px solid #bfdbfe",borderRadius:5,
                  fontSize:12,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI}
                style={{padding:"2px 8px",background:"#3b5bdb",border:"none",borderRadius:5,
                  color:"white",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:10,color:"#6366f1"}}>아이폰15:460 / 갤S24:416</span>
            </div>
          </div>
        </div>

        {rows.map((row,ri)=>{
          if(ri===1&&!row.some(x=>x.pill)&&activeSlot<ROW)return null;
          return(
            <div key={ri} className="slot-grid"
              style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              {row.map(({pill,idx})=>{
                const isActive=idx===activeSlot,color=ACCENT[idx],pillBg=pill?.colorCss||null;
                return(
                  <div key={idx} onClick={()=>clickSlot(idx)}
                    style={{background:pill?"white":isActive?"#eff6ff":"#f8fafc",
                      border:isActive?"2px solid "+color:"1.5px solid #e2e8f0",
                      borderRadius:14,padding:14,cursor:"pointer",transition:"all 0.15s",
                      boxShadow:isActive?"0 0 0 3px "+color+"22":"0 2px 8px rgba(0,0,0,0.05)",
                      minHeight:160,display:"flex",flexDirection:"column",
                      alignItems:"center",justifyContent:pill?"flex-start":"center",
                      gap:6,position:"relative"}}
                    onMouseEnter={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f0f4ff";}}
                    onMouseLeave={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f8fafc";}}>
                    {pill?(
                      <>
                        <button onClick={e=>removeSlot(e,idx)}
                          style={{position:"absolute",top:8,right:8,background:"none",
                            border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",
                            color:"#dc2626",fontSize:9,padding:"1px 5px",zIndex:2}}>×</button>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontSize:10,fontWeight:700,color,lineHeight:1.3,wordBreak:"keep-all",textAlign:"center"}}>{pill.name}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"center",padding:"6px 24px 2px 4px"}}>
                          <PillShapeEl pill={pill} pxPerMm={pxPerMm} accentColor={color}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"#94a3b8"}}>
                          <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                            <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                            <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                          </div>
                          <span>1cm</span>
                        </div>
                        {pill.colorName&&<div style={{display:"flex",alignItems:"center",gap:3}}>
                          {pillBg&&<div style={{width:9,height:9,borderRadius:"50%",background:pillBg,border:"1px solid #ccc"}}/>}
                          <span style={{fontSize:9,color:"#94a3b8"}}>{pill.colorName}</span>
                        </div>}
                        {pill.price&&<div style={{fontSize:9,color:"#0ca678",fontWeight:700,fontFamily:"monospace"}}>
                          💊 {Number(pill.price).toLocaleString()}원</div>}
                      </>
                    ):(
                      <>
                        <div style={{fontSize:22,fontWeight:800,color:isActive?color:"#cbd5e1"}}>{idx+1}</div>
                        <div style={{fontSize:10,color:isActive?color:"#94a3b8",textAlign:"center",lineHeight:1.4}}>
                          {isActive?"← 검색 후 선택":"클릭하여 선택"}</div>
                      </>
                    )}
                  </div>);
              })}
            </div>);
        })}

        {hasAny&&(
          <div style={{background:"white",borderRadius:16,overflow:"hidden",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"11px 16px",borderBottom:"1px solid #f1f5f9",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>약품 정보
              </div>
              <div style={{fontSize:11,color:"#64748b"}}>{filledSlots.length}개</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
                <thead>
                  <tr>
                    <th style={{background:"#f8fafc",minWidth:72,padding:"8px",fontSize:11,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
                    {filledSlots.map(({pill,idx})=>(
                      <th key={idx} style={{textAlign:"center",background:"#f8fafc",borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"8px 6px",minWidth:130}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:ACCENT[idx],display:"inline-block"}}/>
                          <span style={{fontSize:10,fontWeight:700,color:ACCENT[idx],lineHeight:1.3,textAlign:"center"}}>{pill.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({label,render})=>(
                    <tr key={label}>
                      <th style={{background:"#f8fafc",padding:"8px",fontSize:11,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle"}}>{label}</th>
                      {filledSlots.map(({pill,idx})=>(
                        <td key={idx} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"8px",textAlign:"center",verticalAlign:"middle"}}>
                          {render(pill,idx)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!hasAny&&(
          <div style={{background:"white",borderRadius:16,padding:"40px 20px",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",
            display:"flex",flexDirection:"column",alignItems:"center",gap:10,color:"#94a3b8"}}>
            <div style={{fontSize:40,opacity:0.2}}>🔬</div>
            <div style={{fontSize:14,fontWeight:500,color:"#64748b"}}>슬롯을 클릭하고 약품을 검색하세요</div>
            <div style={{fontSize:11,fontFamily:"monospace",textAlign:"center",lineHeight:1.8}}>
              1. 슬롯 클릭 → 파란 테두리 활성화<br/>
              2. 검색창에 약품명 입력<br/>
              3. 결과 클릭 → 슬롯 배치
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
