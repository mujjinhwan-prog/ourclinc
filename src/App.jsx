import { useState, useEffect, useRef, useCallback, Fragment } from "react";

const SHAPE_MAP = {
  "원형":"circle","타원형":"oval","장방형":"oblong","반원형":"halfcircle",
  "사각형":"rectangle","마름모형":"diamond","오각형":"pentagon",
  "육각형":"hexagon","팔각형":"octagon","삼각형":"triangle","기타":"other",
};
function parseShape(s) {
  if (!s) return "circle";
  for (const [k,v] of Object.entries(SHAPE_MAP)) if (s.includes(k)) return v;
  return "circle";
}
function parseFormType(formName) {
  if (!formName) return "tablet";
  const f = formName.replace(/\s/g, "");
  if (f.includes("캡슐") || f.includes("연질캡슐") || f.includes("경질캡슐")) return "capsule";
  return "tablet";
}
const COLOR_MAP = [
  ["흰색","#FFFFFF"],["하양","#FFFFFF"],["백색","#FFFFFF"],["흰색(백색)","#FFFFFF"],
  ["연노랑","#FFF0A0"],["연노란","#FFF0A0"],["옅은노랑","#FFF8C0"],
  ["노랑","#F5C842"],["노란색","#F5C842"],["황색","#E8B84B"],["노란","#F5C842"],
  ["주황색","#F47C2F"],["주황","#F47C2F"],["오렌지","#F47C2F"],
  ["연분홍","#FBBCD4"],["연한분홍","#FBBCD4"],["살색","#FFCCAA"],["살구색","#FFCCAA"],
  ["분홍색","#F48FB1"],["분홍","#F48FB1"],["핑크","#F48FB1"],
  ["빨간색","#E53935"],["빨강","#E53935"],["적색","#E53935"],["붉은","#E53935"],
  ["연파랑","#90CAF9"],["연한파랑","#90CAF9"],["하늘색","#87CEEB"],["하늘","#87CEEB"],
  ["파란색","#1E88E5"],["파랑","#1E88E5"],["청색","#1E88E5"],["파란","#1E88E5"],["남색","#1565C0"],
  ["연두색","#9CCC65"],["연두","#9CCC65"],
  ["초록색","#43A047"],["초록","#43A047"],["녹색","#43A047"],["그린","#43A047"],
  ["연보라","#CE93D8"],["옅은보라","#CE93D8"],
  ["보라색","#8E24AA"],["보라","#8E24AA"],["자색","#8E24AA"],["자주","#8E24AA"],
  ["갈색","#8D6E63"],["밤색","#8D6E63"],
  ["회색","#9E9E9E"],["은색","#C0C0C0"],["은","#C0C0C0"],
  ["검정색","#2C2C2C"],["검정","#2C2C2C"],["흑색","#2C2C2C"],["검은색","#2C2C2C"],
  ["투명","rgba(200,200,200,0.25)"],
];
const SINGLE_CHAR_COLOR = {
  "노":"#F5C842","흰":"#FFFFFF","백":"#FFFFFF","분":"#F48FB1","핑":"#F48FB1",
  "빨":"#E53935","적":"#E53935","파":"#1E88E5","청":"#1E88E5","초":"#43A047",
  "녹":"#43A047","주":"#F47C2F","보":"#8E24AA","자":"#8E24AA","갈":"#8D6E63",
  "회":"#9E9E9E","검":"#2C2C2C","흑":"#2C2C2C","투":"rgba(200,200,200,0.25)",
};
function parsePillColor(s) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  for (const [k,v] of COLOR_MAP) if (t === k) return v;
  for (const [k,v] of COLOR_MAP) if (t.includes(k)) return v;
  if (SINGLE_CHAR_COLOR[t[0]]) return SINGLE_CHAR_COLOR[t[0]];
  return null;
}
function lighten(hex, amt=40) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255,(n>>16)+amt), g = Math.min(255,((n>>8)&0xff)+amt), b = Math.min(255,(n&0xff)+amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function darken(hex, amt=30) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0,(n>>16)-amt), g = Math.max(0,((n>>8)&0xff)-amt), b = Math.max(0,(n&0xff)-amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
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
    entpName:it.ENTP_NAME||"",
    width:parseFloat(it.LNGS_STDR)||0,
    height:parseFloat(it.SHRT_STDR)||0,
    thickness:it.THICK?parseFloat(it.THICK):null,
    shape:parseShape(it.DRUG_SHPE),
    colorName:it.DRUG_COLO||"",
    colorCss:parsePillColor(it.DRUG_COLO||""),
    colorBack:parsePillColor(it.DRUG_COLO_BACK||""),
    formName:it.FORM_CODE_NAME||"",
    formType:parseFormType(it.FORM_CODE_NAME||""),
    etcOtc:it.ETC_OTC_NAME||"",
    markFront:it.PRINT_FRONT||"",
    markBack:it.PRINT_BACK||"",
    hiraClass:it.HIRA_CLASS||it.CLASS_NAME||"",
    price:it.PRICE||null,
    priceUnit:it.PRICE_UNIT||"정",
  }));
}

function PillShapeEl({ pill, pxPerMm, accentColor }) {
  const wPx = Math.round(pill.width * pxPerMm);
  const hPx = Math.round(pill.height * pxPerMm);
  const pc = pill.colorCss || "#d0d0d0";
  const pcB = pill.colorBack || pc;
  const pcL = lighten(pc,50), pcD = darken(pc,30);
  const isWhite = pc === "#FFFFFF";
  const isLight = ["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8"].includes(pc);
  const textColor = isLight ? "#555" : "#fff";
  const markFontSz = Math.max(6, Math.min(wPx,hPx)*0.17);
  const strokeColor = isWhite ? "#bbb" : darken(pc,20);
  const uid = `pill_${Math.random().toString(36).slice(2)}`;
  const wLabel = (Number.isInteger(pill.width)?pill.width:Math.round(pill.width*10)/10)+"mm";
  const hLabel = (Number.isInteger(pill.height)?pill.height:Math.round(pill.height*10)/10)+"mm";
  const wTextPx = wLabel.length*13*0.62+8;
  const drawW = Math.max(wPx,wTextPx);
  const PAD=6, X0=(drawW-wPx)/2+PAD, Y0=PAD;
  const RW=16+hLabel.length*9+PAD, RH=36+PAD;
  const svgW=drawW+RW+PAD, svgH=hPx+RH+PAD;
  const RY=Y0+hPx+8;
  const rulerW=(
    <g>
      <line x1={X0} y1={RY} x2={X0+wPx} y2={RY} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={X0} y1={RY-4} x2={X0} y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={X0+wPx} y1={RY-4} x2={X0+wPx} y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <text x={X0+wPx/2} y={RY+18} textAnchor="middle" fontSize="13" fill={accentColor} fontFamily="monospace" fontWeight="700">{wLabel}</text>
    </g>
  );
  const RX=X0+wPx+10, midY=Y0+hPx/2;
  const rulerH=(
    <g>
      <line x1={RX} y1={Y0} x2={RX} y2={Y0+hPx} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={Y0} x2={RX+4} y2={Y0} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={Y0+hPx} x2={RX+4} y2={Y0+hPx} stroke={accentColor} strokeWidth="1.5"/>
      <text x={RX+8} y={midY} textAnchor="start" dominantBaseline="middle" fontSize="13" fill={accentColor} fontFamily="monospace" fontWeight="700">{hLabel}</text>
    </g>
  );

  if (pill.formType==="capsule") {
    const rx=Math.min(wPx,hPx)/2, midX=X0+wPx/2;
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto"}}>
        <defs>
          <linearGradient id={`${uid}_cL`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pcL}/><stop offset="50%" stopColor={pc}/><stop offset="100%" stopColor={pcD}/></linearGradient>
          <linearGradient id={`${uid}_cR`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={lighten(pcB,50)}/><stop offset="50%" stopColor={pcB}/><stop offset="100%" stopColor={darken(pcB,30)}/></linearGradient>
          <clipPath id={`${uid}_cLL`}><rect x={X0} y={Y0} width={wPx/2} height={hPx}/></clipPath>
          <clipPath id={`${uid}_cRL`}><rect x={midX} y={Y0} width={wPx/2} height={hPx}/></clipPath>
          <filter id={`${uid}_sh`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={pc} floodOpacity="0.4"/></filter>
        </defs>
        <rect x={X0} y={Y0} width={wPx} height={hPx} rx={rx} ry={rx} fill={`url(#${uid}_cL)`} clipPath={`url(#${uid}_cLL)`} stroke={strokeColor} strokeWidth="1.2" filter={`url(#${uid}_sh)`}/>
        <rect x={X0} y={Y0} width={wPx} height={hPx} rx={rx} ry={rx} fill={`url(#${uid}_cR)`} clipPath={`url(#${uid}_cRL)`} stroke={strokeColor} strokeWidth="1.2"/>
        <line x1={midX} y1={Y0+2} x2={midX} y2={Y0+hPx-2} stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
        {pill.markFront&&<text x={X0+wPx*0.25} y={Y0+hPx/2+markFontSz*0.35} textAnchor="middle" fontSize={markFontSz} fill={textColor} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markFront}</text>}
        {pill.markBack&&<text x={X0+wPx*0.75} y={Y0+hPx/2+markFontSz*0.35} textAnchor="middle" fontSize={markFontSz} fill={isLight?"#555":"#fff"} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markBack}</text>}
        {rulerW}{rulerH}
      </svg>
    );
  }

  let shapePath="", rx=0, ry=0;
  const cx=X0+wPx/2, cy=Y0+hPx/2;

  if (pill.shape==="circle") {
    rx=wPx/2; ry=hPx/2;
  } else if (pill.shape==="oval"||pill.shape==="oblong") {
    const asp=wPx/hPx, cr=asp>=1.6?0.27:0.4;
    ry=hPx*cr; rx=Math.min(wPx*cr,ry*1.3);
  } else if (pill.shape==="rectangle") {
    rx=4; ry=4;
  } else if (pill.shape==="halfcircle") {
    shapePath=`M${X0},${Y0+hPx} Q${X0},${Y0} ${cx},${Y0} Q${X0+wPx},${Y0} ${X0+wPx},${Y0+hPx} Z`;
  } else if (pill.shape==="diamond") {
    // 모서리 둥글게 처리
    const dr=Math.min(wPx,hPx)*0.12;
    shapePath=`M${cx},${Y0+dr} L${X0+wPx-dr},${cy-dr} Q${X0+wPx},${cy} ${X0+wPx-dr},${cy+dr} L${cx},${Y0+hPx-dr} Q${cx},${Y0+hPx} ${cx-dr},${Y0+hPx-dr} L${X0+dr},${cy+dr} Q${X0},${cy} ${X0+dr},${cy-dr} L${cx-dr},${Y0+dr} Q${cx},${Y0} ${cx},${Y0+dr} Z`;
  } else if (pill.shape==="pentagon") {
    const rr=Math.min(wPx,hPx)/2;
    shapePath=Array.from({length:5},(_,i)=>{const a=(i*72-90)*Math.PI/180;return(i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);}).join(" ")+"Z";
  } else if (pill.shape==="hexagon") {
    const rr=Math.min(wPx,hPx)/2;
    shapePath=Array.from({length:6},(_,i)=>{const a=(i*60-30)*Math.PI/180;return(i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);}).join(" ")+"Z";
  } else if (pill.shape==="triangle") {
    // 모서리 둥글게 처리
    const tr=Math.min(wPx,hPx)*0.10;
    shapePath=`M${cx},${Y0+tr} Q${cx},${Y0} ${cx+tr*1.5},${Y0+tr*2} L${X0+wPx-tr},${Y0+hPx-tr} Q${X0+wPx},${Y0+hPx} ${X0+wPx-tr*2},${Y0+hPx} L${X0+tr*2},${Y0+hPx} Q${X0},${Y0+hPx} ${X0+tr},${Y0+hPx-tr} L${cx-tr*1.5},${Y0+tr*2} Q${cx},${Y0} ${cx},${Y0+tr} Z`;
  } else {
    rx=Math.min(wPx,hPx)*0.15; ry=rx;
  }

  const useRect=!shapePath;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" style={{maxWidth:"100%",maxHeight:"100%",width:"auto",height:"auto"}}>
      <defs>
        <radialGradient id={`${uid}_rg`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor={pcL}/><stop offset="55%" stopColor={pc}/><stop offset="100%" stopColor={pcD}/>
        </radialGradient>
        <linearGradient id={`${uid}_shine`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.65)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id={`${uid}_sd`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation={isWhite?"3":"4"} floodColor={isWhite?"#aaa":pc} floodOpacity={isWhite?"0.22":"0.42"}/>
        </filter>
        <clipPath id={`${uid}_cl`}>
          {shapePath?<path d={shapePath}/>:<rect x={X0} y={Y0} width={wPx} height={hPx} rx={rx} ry={ry}/>}
        </clipPath>
      </defs>

      {/* 약 몸체 */}
      {useRect
        ?<rect x={X0} y={Y0} width={wPx} height={hPx} rx={rx} ry={ry} fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"} filter={`url(#${uid}_sd)`}/>
        :<path d={shapePath} fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"} filter={`url(#${uid}_sd)`}/>
      }

      {/* 강조 링 - rect 기반 */}
      {useRect&&<rect x={X0-2} y={Y0-2} width={wPx+4} height={hPx+4} rx={rx+2} ry={ry+2} fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.25"/>}

      {/* 강조 링 - path 기반 (diamond, triangle 등) */}
      {!useRect&&shapePath&&(
        <path d={shapePath} fill="none" stroke={accentColor} strokeWidth="3" opacity="0.2"
          transform={`translate(${cx},${cy}) scale(1.06) translate(${-cx},${-cy})`}/>
      )}

      {/* 광택 */}
      <rect x={X0+wPx*0.08} y={Y0+hPx*0.07} width={wPx*0.5} height={hPx*0.28}
        rx={Math.min(wPx,hPx)*0.08} fill={`url(#${uid}_shine)`}
        clipPath={`url(#${uid}_cl)`} opacity="0.7"/>

      {/* 중앙 분할선 */}
      {(pill.shape==="oblong"||pill.shape==="oval"||pill.shape==="circle")&&(
        <line x1={X0+wPx*0.5} y1={Y0+hPx*0.15} x2={X0+wPx*0.5} y2={Y0+hPx*0.85}
          stroke="rgba(0,0,0,0.10)" strokeWidth="1.2"
          strokeDasharray={pill.shape==="circle"?"":"3,2"}
          clipPath={`url(#${uid}_cl)`}/>
      )}

      {/* 식별문자 */}
      {pill.markFront&&(
        <text x={cx} y={cy+markFontSz*0.38} textAnchor="middle"
          fontSize={markFontSz} fill={textColor} fontWeight="900" fontFamily="monospace" opacity="0.82"
          clipPath={`url(#${uid}_cl)`}>{pill.markFront}</text>
      )}

      {rulerW}{rulerH}
    </svg>
  );
}

const MAX=8, ROW=4;

export default function App() {
  const [slots,setSlots]         = useState(Array(MAX).fill(null));
  const [activeSlot,setActiveSlot] = useState(0);
  const [query,setQuery]         = useState("");
  const [results,setResults]     = useState([]);
  const [loading,setLoading]     = useState(false);
  const [error,setError]         = useState("");
  const [showDrop,setShowDrop]   = useState(false);
  const [pxPerMm,setPxPerMm]     = useState(3.7795);
  const [dpiInfo,setDpiInfo]     = useState("DPI 측정 중...");
  const [ppiInput,setPpiInput]   = useState("");
  const [hidePrice,setHidePrice] = useState(false);
  const debRef=useRef(null), inRef=useRef(null), dropRef=useRef(null);
  const FS = { xs:10.5, sm:12, base:15, md:16.5, lg:18, xl:21, "2xl":24 };

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
  const handlePrint=()=>window.print();

  const oneCm=pxPerMm*10;
  const filledSlots=slots.map((s,i)=>({pill:s,idx:i})).filter(x=>x.pill);
  const hasAny=filledSlots.length>0;
  const rows=[
    slots.slice(0,ROW).map((s,i)=>({pill:s,idx:i})),
    slots.slice(ROW,MAX).map((s,i)=>({pill:s,idx:ROW+i})),
  ];
  const tableRows=[
    {label:"구분",render:(p)=>p.etcOtc?<span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"3px 10px",borderRadius:50,fontWeight:700,fontSize:FS.base,whiteSpace:"nowrap"}}>{p.etcOtc.includes("전문")?"전문":"일반"}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"제형",render:(p)=>p.formName?<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"3px 10px",borderRadius:50,fontSize:FS.base,fontWeight:600}}>{p.formName}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"제조사",render:(p)=>(<span style={{fontSize:FS.base,color:"#1a1f36"}}>{p.entpName||"-"}</span>)},
    {label:"크기",render:(p,idx)=>(<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:ACCENT[idx],whiteSpace:"nowrap"}}>{p.width}x{p.height}{p.thickness?"x"+p.thickness:""}mm</span>)},
    {label:"효능군",render:(p)=>p.hiraClass?<span style={{fontSize:FS.base,color:"#64748b",background:"#f1f5f9",padding:"3px 8px",borderRadius:50,whiteSpace:"nowrap"}}>{p.hiraClass}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"보험가",render:(p)=>p.price?<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:"#0ca678",whiteSpace:"nowrap"}}>{Number(p.price).toLocaleString()}원/{p.priceUnit||"정"}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>미등재</span>},
  ];

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif",background:"#f0f4f8",minHeight:"100vh",color:"#1a1f36"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}

        /* ── 모바일 세로형 (≤ 639px) ── */
        @media (max-width:639px){
          .app-header-inner{height:48px !important;}
          .app-logo{height:30px !important;}
          .app-title{font-size:15px !important;}
          .app-sub{display:none !important;}
          .dpi-badge{display:none !important;}
          .main-pad{padding:8px 8px 40px !important;}
          .search-panel{padding:8px !important;margin-bottom:6px !important;}
          .sbwrap{max-width:100% !important;flex-wrap:wrap;gap:6px !important;margin-bottom:6px !important;}
          .sbinput{min-width:100% !important;}
          .btn-search{width:100% !important;}
          .ctrl-bar{flex-wrap:wrap;gap:6px !important;}
          .ppi-panel{display:none !important;}
          .slot-grid{grid-template-columns:repeat(2,1fr) !important;gap:6px !important;margin-bottom:6px !important;}
          .slot-card{min-height:0 !important;height:auto !important;padding:8px 6px !important;gap:4px !important;}
          .pill-shape-box{height:70px !important;}
          .pill-name{font-size:11px !important;line-height:1.2 !important;}
          .pill-size-text{font-size:9px !important;}
          .pill-entp{font-size:9px !important;}
          .pill-price{font-size:16px !important;}
          .slot-num{font-size:28px !important;}
          .slot-hint{font-size:12px !important;}
        }

        /* ── 태블릿 세로형 (640px~1023px portrait) ── */
        @media (min-width:640px) and (max-width:1023px) and (orientation:portrait){
          .app-header-inner{height:50px !important;}
          .main-pad{padding:10px 10px 40px !important;}
          .search-panel{padding:10px !important;margin-bottom:8px !important;}
          .sbwrap{max-width:70% !important;}
          .slot-grid{grid-template-columns:repeat(4,1fr) !important;gap:7px !important;}
          .slot-card{min-height:200px !important;height:auto !important;padding:10px !important;}
          .pill-shape-box{height:75px !important;}
        }

        /* ── 태블릿 가로형: 8슬롯 한 화면에 (landscape, 높이≤900px) ── */
        @media (min-width:640px) and (orientation:landscape) and (max-height:900px){
          .app-header-inner{height:40px !important;}
          .app-logo{height:24px !important;}
          .app-title{font-size:13px !important;}
          .app-sub{font-size:9px !important;}
          .dpi-badge{font-size:9px !important;padding:2px 6px !important;}
          .main-pad{padding:5px 8px 8px !important;}
          .search-panel{padding:5px 10px !important;margin-bottom:4px !important;}
          .sbwrap{margin-bottom:4px !important;max-width:55% !important;}
          .sbinput input{padding:5px 12px 5px 34px !important;font-size:13px !important;}
          .btn-search{padding:5px 14px !important;font-size:13px !important;}
          .ctrl-bar{gap:5px !important;}
          .ctrl-bar>*{padding:4px 8px !important;font-size:11px !important;}
          .ppi-panel{font-size:11px !important;}
          .ppi-input{width:48px !important;font-size:11px !important;}
          .slot-grid{gap:4px !important;margin-bottom:4px !important;}
          .slot-card{
            height:calc((100dvh - 145px) / 2 - 4px) !important;
            min-height:0 !important;
            padding:6px !important;
            gap:2px !important;
            overflow:hidden !important;
          }
          .pill-shape-box{height:calc((100dvh - 145px) / 2 * 0.32) !important;min-height:45px !important;}
          .pill-name{font-size:10px !important;line-height:1.2 !important;}
          .pill-size-text{font-size:8.5px !important;}
          .pill-entp{font-size:8px !important;}
          .pill-price{font-size:14px !important;}
          .pill-1cm{display:none !important;}
          .slot-num{font-size:22px !important;}
          .slot-hint{font-size:11px !important;}
          .print-vs{margin:3px 0 !important;}
        }

        /* ── 데스크탑 (1024px+) ── */
        @media (min-width:1024px){
          .slot-card{min-height:260px;height:auto;}
        }

        /* ── 인쇄 ── */
        .print-vs{display:none;}
        .print-only-header{display:none;}
        @media print{
          @page{size:A4 landscape;margin:8mm}
          body *{visibility:hidden;}
          #printArea,#printArea *{visibility:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}
          #printArea{position:relative;left:0;top:0;width:100%;margin-top:0;}
          .no-print{display:none !important;}
          .slot-card{border:1.5px solid #e2e8f0 !important;box-shadow:none !important;background:white !important;overflow:visible !important;height:auto !important;min-height:220px !important;}
          .pill-name{word-break:break-word !important;overflow-wrap:anywhere !important;}
          .print-only-header{display:flex !important;align-items:center;gap:10px;border-bottom:2.5px solid #3b5bdb;padding-bottom:6px;margin-bottom:8px;}
          .print-logo{height:36px;width:auto;max-width:80px;object-fit:contain;flex-shrink:0;}
          .print-title{font-size:15pt;font-weight:700;color:#1a1f36;}
          .print-sub{font-size:9pt;color:#64748b;}
          .print-vs{display:flex !important;align-items:center;justify-content:center;margin:8px 0;gap:10px;}
          .print-vs .line{flex:1;height:3px;background:linear-gradient(90deg,#fff,#3b5bdb,#7048e8);border-radius:99px;}
          .print-vs .line2{flex:1;height:3px;background:linear-gradient(90deg,#7048e8,#3b5bdb,#fff);border-radius:99px;}
          .print-vs .badge{background:linear-gradient(135deg,#3b5bdb,#7048e8);color:white;font-weight:900;font-size:14pt;padding:6px 22px;border-radius:8px;letter-spacing:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          .slot-grid{break-inside:avoid;grid-template-columns:repeat(4,1fr) !important;}
          .print-hide{display:none !important;}
          .pill-1cm{display:flex !important;}
        }
      `}</style>

      {/* 헤더 */}
      <div className="no-print" style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div className="app-header-inner" style={{maxWidth:1400,margin:"0 auto",height:60,display:"flex",alignItems:"center",gap:12}}>
          <img className="app-logo" src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo" style={{height:44,width:"auto",objectFit:"contain",flexShrink:0}}/>
          <div style={{width:1,height:28,background:"#e2e8f0",flexShrink:0}}/>
          <div style={{minWidth:0}}>
            <div className="app-title" style={{fontSize:FS.xl,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div className="app-sub" style={{fontSize:FS.sm,color:"#64748b"}}>건강보험심사평가원·식품의약품안전처 자료 기반 의약품 순응도 개선 비교 데이터</div>
          </div>
          <div className="dpi-badge" style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 10px",fontSize:FS.sm,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div className="main-pad" style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        {/* 검색 패널 */}
        <div className="no-print search-panel" style={{background:"white",borderRadius:16,padding:14,marginBottom:12,boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
          <div className="sbwrap" style={{display:"flex",gap:8,marginBottom:8,position:"relative",zIndex:200,maxWidth:"50%"}}>
            <div className="sbinput" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:18,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 자디앙, 트라젠타...)"
                style={{width:"100%",padding:"11px 14px 11px 40px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:FS.xl,fontFamily:"inherit",color:"#1a1f36",background:"#f8fafc",outline:"none"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"55vh",overflowY:"auto"}}>
                  {loading&&<div style={{padding:14,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:FS.lg}}><div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>조회 중...</div>}
                  {!loading&&error&&<div style={{padding:12,color:"#64748b",fontSize:FS.base,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map(r=>{
                    const already=slots.find(s=>s&&s.id===r.id);
                    const pillBg=r.colorCss||"#e8e8e8";
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    return(
                      <div key={r.id} onClick={()=>!already&&pick(r)}
                        style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #f1f5f9",cursor:already?"not-allowed":"pointer",opacity:already?0.45:1,background:"white"}}
                        onMouseEnter={e=>{if(!already)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:r.shape==="oblong"?30:18,height:16,borderRadius:shapeR,flexShrink:0,background:pillBg,border:"1px solid #ccc"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:FS.lg,fontWeight:600,color:"#1a1f36",wordBreak:"break-word",overflowWrap:"anywhere",lineHeight:1.3}}>{r.name}{already?" ✓":""}</div>
                          <div style={{fontSize:FS.sm,color:"#94a3b8",marginTop:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                            {r.etcOtc&&<span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"1px 5px",borderRadius:3,fontWeight:700,fontSize:FS.sm}}>{r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 5px",borderRadius:3,fontSize:FS.sm}}>{r.formName}</span>}
                          </div>
                        </div>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"2px 7px",fontSize:FS.sm,fontFamily:"monospace",color:"#3b5bdb",whiteSpace:"nowrap"}}>{r.width}x{r.height}mm</span>
                      </div>);
                  })}
                </div>
              )}
            </div>
            <button className="btn-search" onClick={()=>doSearch(query)} style={{padding:"11px 18px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",border:"none",borderRadius:10,color:"white",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>검색</button>
          </div>
          <div className="ctrl-bar" style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{fontSize:FS.base,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:9,height:9,borderRadius:"50%",background:ACCENT[activeSlot],display:"inline-block"}}/>
              <span><b style={{color:ACCENT[activeSlot]}}>슬롯 {activeSlot+1}</b> 활성 · 슬롯 클릭으로 변경</span>
            </div>
            <div className="ppi-panel" style={{display:"flex",alignItems:"center",gap:6,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"5px 12px",fontSize:FS.base,color:"#3730a3"}}>
              📐 PPI:
              <input className="ppi-input" type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)} placeholder="460" min="72" max="600" style={{width:56,padding:"2px 6px",border:"1px solid #bfdbfe",borderRadius:5,fontSize:FS.base,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI} style={{padding:"2px 8px",background:"#3b5bdb",border:"none",borderRadius:5,color:"white",fontSize:FS.sm,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:FS.sm,color:"#6366f1"}}>아이폰15:460/갤S24:416</span>
            </div>
            <button onClick={resetAll} style={{padding:"8px 14px",background:hasAny?"#fee2e2":"#f1f5f9",border:"1.5px solid "+(hasAny?"#fecaca":"#e2e8f0"),borderRadius:10,color:hasAny?"#dc2626":"#94a3b8",fontSize:FS.lg,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>🔄 초기화</button>
            <button onClick={handlePrint} disabled={!hasAny} style={{padding:"8px 14px",background:hasAny?"linear-gradient(135deg,#0ca678,#2f9e44)":"#f1f5f9",border:"1.5px solid "+(hasAny?"#0ca678":"#e2e8f0"),borderRadius:10,color:hasAny?"white":"#94a3b8",fontSize:FS.lg,fontWeight:700,fontFamily:"inherit",cursor:hasAny?"pointer":"not-allowed",whiteSpace:"nowrap"}}>🖨️ 인쇄</button>
            <label style={{display:"flex",alignItems:"center",gap:5,fontSize:FS.base,color:"#64748b",cursor:"pointer",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"7px 10px"}}>
              <input type="checkbox" checked={hidePrice} onChange={e=>setHidePrice(e.target.checked)} style={{width:15,height:15,cursor:"pointer",accentColor:"#3b5bdb"}}/>
              약가제외
            </label>
          </div>
        </div>

        {/* 슬롯 그리드 */}
        <div id="printArea">
          <div className="print-only-header">
            <img className="print-logo" src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo" onError={e=>{e.target.style.display="none";}}/>
            <div>
              <div className="print-title">약품 실제 크기 비교표</div>
              <div className="print-sub">건강보험심사평가원·식품의약품안전처 자료 기반 의약품 순응도 개선 비교 데이터</div>
            </div>
          </div>
          {rows.map((row,ri)=>{
            const rowHasAny = row.some(({pill}) => pill !== null);
            return (
            <Fragment key={ri}>
              {ri===1&&(
                <div className={"print-vs"+(rowHasAny?"":" print-hide")}>
                  <div className="line"/><div className="badge">VS</div><div className="line2"/>
                </div>
              )}
              <div className={"slot-grid"+(rowHasAny?"":" print-hide")} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
                {row.map(({pill,idx})=>{
                  const isActive=idx===activeSlot, color=ACCENT[idx];
                  return(
                    <div key={idx} className="slot-card" onClick={()=>clickSlot(idx)}
                      style={{background:pill?"white":isActive?"#eff6ff":"#f8fafc",border:isActive?"2px solid "+color:"1.5px solid #e2e8f0",borderRadius:14,padding:12,cursor:"pointer",transition:"all 0.15s",boxShadow:isActive?"0 0 0 3px "+color+"22":"0 2px 8px rgba(0,0,0,0.05)",minHeight:260,height:"auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:pill?"flex-start":"center",gap:4,position:"relative",overflow:"hidden"}}
                      onMouseEnter={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f0f4ff";}}
                      onMouseLeave={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f8fafc";}}>
                      {pill?(
                        <>
                          <button className="no-print" onClick={e=>removeSlot(e,idx)} style={{position:"absolute",top:6,right:6,background:"none",border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",color:"#dc2626",fontSize:FS.sm,padding:"1px 6px",zIndex:2}}>×</button>
                          <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2,width:"100%",justifyContent:"center"}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                            <span className="pill-name" style={{fontSize:FS.base,fontWeight:700,color,lineHeight:1.25,wordBreak:"break-word",overflowWrap:"anywhere",textAlign:"center"}}>{pill.name}</span>
                          </div>
                          <div className="pill-shape-box" style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:85,overflow:"hidden"}}>
                            <PillShapeEl pill={pill} pxPerMm={pxPerMm} accentColor={color}/>
                          </div>
                          <div className="pill-1cm" style={{display:"flex",alignItems:"center",gap:3,fontSize:FS.xs,color:"#94a3b8"}}>
                            <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                              <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                              <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                            </div>
                            <span>1cm</span>
                          </div>
                          <div className="pill-size-text" style={{fontSize:FS.xs,color,fontWeight:700,fontFamily:"monospace",textAlign:"center"}}>{pill.width}x{pill.height}{pill.thickness?"x"+pill.thickness:""}mm</div>
                          {pill.entpName&&<div className="pill-entp" style={{fontSize:FS.xs,color:"#94a3b8",textAlign:"center",wordBreak:"break-word"}}>{pill.entpName}</div>}
                          <div style={{flex:1}}/>
                          {!hidePrice&&(pill.price
                            ?<div className="pill-price" style={{fontSize:FS.xs*2,color:"#0ca678",fontWeight:700,fontFamily:"monospace",background:"#ecfdf5",borderRadius:6,padding:"3px 8px",flexShrink:0,textAlign:"center"}}>
                              {"💊 "+Number(pill.price).toLocaleString()+"원/"+(pill.priceUnit||"정")}
                            </div>
                            :<div className="pill-price" style={{fontSize:FS.xs*2,color:"#94a3b8",flexShrink:0}}>보험가 미등재</div>
                          )}
                        </>
                      ):(
                        <>
                          <div className="slot-num no-print" style={{fontSize:FS["2xl"]+8,fontWeight:800,color:isActive?color:"#cbd5e1"}}>{idx+1}</div>
                          <div className="slot-hint no-print" style={{fontSize:FS.base,color:isActive?color:"#94a3b8",textAlign:"center",lineHeight:1.5}}>{isActive?"← 검색 후 선택":"클릭하여 선택"}</div>
                        </>
                      )}
                    </div>);
                })}
              </div>
            </Fragment>
            );
          })}
        </div>

        {/* 정보 테이블 */}
        {hasAny&&(
          <div style={{background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"11px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:FS.base,fontFamily:"monospace",color:"#3b5bdb",display:"flex",alignItems:"center",gap:6}}><span style={{width:7,height:7,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>약품 정보</div>
              <div style={{fontSize:FS.base,color:"#64748b"}}>{filledSlots.length}개</div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
                <thead><tr>
                  <th style={{background:"#f8fafc",minWidth:72,padding:"8px 10px",fontSize:FS.sm,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
                  {filledSlots.map(({pill,idx})=>(
                    <th key={idx} style={{textAlign:"center",background:"#f8fafc",borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"8px 6px",minWidth:130}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:ACCENT[idx],display:"inline-block"}}/>
                        <span style={{fontSize:FS.sm,fontWeight:700,color:ACCENT[idx],lineHeight:1.3,textAlign:"center",wordBreak:"break-word"}}>{pill.name}</span>
                      </div>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {tableRows.filter(r=>!(hidePrice&&r.label==="보험가")).map(({label,render})=>(
                    <tr key={label}>
                      <th style={{background:"#f8fafc",padding:"8px 10px",fontSize:FS.sm,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle"}}>{label}</th>
                      {filledSlots.map(({pill,idx})=>(
                        <td key={idx} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"8px",textAlign:"center",verticalAlign:"middle"}}>{render(pill,idx)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!hasAny&&(
          <div style={{background:"white",borderRadius:16,padding:"40px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",display:"flex",flexDirection:"column",alignItems:"center",gap:10,color:"#94a3b8"}}>
            <div style={{fontSize:44,opacity:0.2}}>🔬</div>
            <div style={{fontSize:FS.xl,fontWeight:500,color:"#64748b"}}>슬롯을 클릭하고 약품을 검색하세요</div>
            <div style={{fontSize:FS.base,fontFamily:"monospace",textAlign:"center",lineHeight:2}}>
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
