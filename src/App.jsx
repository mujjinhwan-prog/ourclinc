import { useState, useEffect, useRef, useCallback } from "react";

// ─── 모양 / 색상 매핑 ─────────────────────────────────────────────────────────
const SHAPE_MAP = {
  "원형":"circle","타원형":"oval","장방형":"oblong","반원형":"halfcircle",
  "사각형":"rectangle","마름모형":"diamond","오각형":"pentagon",
  "육각형":"hexagon","팔각형":"octagon","삼각형":"triangle","기타":"other",
};import { useState, useEffect, useRef, useCallback } from "react";

// ─── 모양 / 색상 매핑 ─────────────────────────────────────────────────────────
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

// 제형 → 3D 렌더 유형
function parseFormType(formName, shape) {
  if (!formName) return "tablet";
  const f = formName.replace(/\s/g, "");
  if (f.includes("캡슐") || f.includes("연질캡슐") || f.includes("경질캡슐")) return "capsule";
  if (f.includes("시럽") || f.includes("액")) return "liquid";
  return "tablet";
}

// COLOR_MAP: 식약처 API 실제 반환값 기준 (긴 키 먼저 → 짧은 키가 잘못 매칭되는 것 방지)
const COLOR_MAP = [
  // 흰색 계열
  ["흰색","#FFFFFF"],["하양","#FFFFFF"],["백색","#FFFFFF"],["흰색(백색)","#FFFFFF"],
  // 노란색 계열
  ["연노랑","#FFF0A0"],["연노란","#FFF0A0"],["옅은노랑","#FFF8C0"],
  ["노랑","#F5C842"],["노란색","#F5C842"],["황색","#E8B84B"],["노란","#F5C842"],
  // 주황
  ["주황색","#F47C2F"],["주황","#F47C2F"],["오렌지","#F47C2F"],
  // 분홍 계열
  ["연분홍","#FBBCD4"],["연한분홍","#FBBCD4"],["살색","#FFCCAA"],["살구색","#FFCCAA"],
  ["분홍색","#F48FB1"],["분홍","#F48FB1"],["핑크","#F48FB1"],
  // 빨강
  ["빨간색","#E53935"],["빨강","#E53935"],["적색","#E53935"],["붉은","#E53935"],
  // 파랑 계열
  ["연파랑","#90CAF9"],["연한파랑","#90CAF9"],["하늘색","#87CEEB"],["하늘","#87CEEB"],
  ["파란색","#1E88E5"],["파랑","#1E88E5"],["청색","#1E88E5"],["파란","#1E88E5"],["남색","#1565C0"],
  // 초록 계열
  ["연두색","#9CCC65"],["연두","#9CCC65"],
  ["초록색","#43A047"],["초록","#43A047"],["녹색","#43A047"],["그린","#43A047"],
  // 보라 계열
  ["연보라","#CE93D8"],["옅은보라","#CE93D8"],
  ["보라색","#8E24AA"],["보라","#8E24AA"],["자색","#8E24AA"],["자주","#8E24AA"],
  // 갈색/회색
  ["갈색","#8D6E63"],["밤색","#8D6E63"],
  ["회색","#9E9E9E"],["은색","#C0C0C0"],["은","#C0C0C0"],
  // 검정 (마지막 — 오매칭 방지)
  ["검정색","#2C2C2C"],["검정","#2C2C2C"],["흑색","#2C2C2C"],["검은색","#2C2C2C"],
  // 투명
  ["투명","rgba(200,200,200,0.25)"],
];
function parsePillColor(s) {
  if (!s) return null;
  const t = s.trim();
  // 완전 일치 먼저
  for (const [k,v] of COLOR_MAP) if (t === k) return v;
  // 포함 매칭 (긴 키 우선 — 배열 순서로 보장)
  for (const [k,v] of COLOR_MAP) if (t.includes(k)) return v;
  return null;
}
function lighten(hex, amt=40) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n>>16)+amt);
  const g = Math.min(255, ((n>>8)&0xff)+amt);
  const b = Math.min(255, (n&0xff)+amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function darken(hex, amt=30) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n>>16)-amt);
  const g = Math.max(0, ((n>>8)&0xff)-amt);
  const b = Math.max(0, (n&0xff)-amt);
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
    width:parseFloat(it.LNGS_STDR)||0,
    height:parseFloat(it.SHRT_STDR)||0,
    thickness:it.THICK?parseFloat(it.THICK):null,
    shape:parseShape(it.DRUG_SHPE),
    shapeKr:it.DRUG_SHPE||"",
    colorName:it.DRUG_COLO||"",
    colorCss:(()=>{
      const c = parsePillColor(it.DRUG_COLO||"");
      if (!c && it.DRUG_COLO) console.warn("[색상미매칭]", it.ITEM_NAME, "DRUG_COLO=", JSON.stringify(it.DRUG_COLO));
      return c;
    })(),
    colorBack:parsePillColor(it.DRUG_COLO_BACK||""),
    formName:it.FORM_CODE_NAME||"",
    formType:parseFormType(it.FORM_CODE_NAME||"", it.DRUG_SHPE||""),
    etcOtc:it.ETC_OTC_NAME||"",
    mark:(it.PRINT_FRONT||"")+(it.PRINT_BACK?"/"+it.PRINT_BACK:""),
    markFront:it.PRINT_FRONT||"",
    markBack:it.PRINT_BACK||"",
    hiraClass:it.HIRA_CLASS||it.CLASS_NAME||"",
    price:it.PRICE||null,
    priceUnit:it.PRICE_UNIT||"정",

  }));
}

// ─── 약제 SVG 렌더러 ──────────────────────────────────────────────────────────
// 레이아웃: 약 몸체 (OX,OY)에 배치, 치수선은 오른쪽·아래쪽에 여유 공간 확보
// overflow 제거 → viewBox 안에 모든 요소가 들어오도록 svgW/svgH 계산
function PillShapeEl({ pill, pxPerMm, accentColor }) {
  const wPx = Math.round(pill.width  * pxPerMm);
  const hPx = Math.round(pill.height * pxPerMm);
  // colorCss null → 연회색 기본 (검정 fallback 방지)
  const pc   = pill.colorCss || "#d0d0d0";
  const pcB  = pill.colorBack || pc;
  const pcL  = lighten(pc, 50);
  const pcD  = darken(pc, 30);
  const isWhite = pc === "#FFFFFF";
  const isLight = ["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8","rgba(220,220,220,0.3)"].includes(pc);
  const textColor = isLight ? "#555" : "#fff";
  const markFontSz = Math.max(7, Math.min(wPx, hPx) * 0.17);
  const strokeColor = isWhite ? "#bbb" : darken(pc, 20);
  const uid = `pill_${pill.id || Math.random().toString(36).slice(2)}`;

  // 약 몸체는 (0,0)에서 시작
  // 치수선 공간: 오른쪽 RW, 아래쪽 RH
  const RW = 36;   // 오른쪽 세로치수선 폭 (선+텍스트)
  const RH = 26;   // 아래쪽 가로치수선 높이 (선+텍스트)

  const svgW = wPx + RW;
  const svgH = hPx + RH;

  // ── 가로 치수선 (약 아래) ──
  const RY = hPx + 8;   // 가로선 y
  const rulerW = (
    <g>
      <line x1={0}   y1={RY} x2={wPx} y2={RY} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={0}   y1={RY-4} x2={0}   y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={wPx} y1={RY-4} x2={wPx} y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <text x={wPx/2} y={RY+13} textAnchor="middle"
        fontSize="9" fill={accentColor} fontFamily="monospace" fontWeight="700">{pill.width}mm</text>
    </g>
  );

  // ── 세로 치수선 (약 오른쪽) ──
  const RX = wPx + 10;   // 세로선 x
  const midY = hPx / 2;
  const rulerH = (
    <g>
      <line x1={RX} y1={0}   x2={RX} y2={hPx} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={0}   x2={RX+4} y2={0}   stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={hPx} x2={RX+4} y2={hPx} stroke={accentColor} strokeWidth="1.5"/>
      <text
        x={RX+18} y={midY}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill={accentColor} fontFamily="monospace" fontWeight="700"
        transform={`rotate(-90,${RX+18},${midY})`}
      >{pill.height}mm</text>
    </g>
  );

  // ── 캡슐 ──
  if (pill.formType === "capsule") {
    const rx = Math.min(wPx, hPx) / 2;
    const midX = wPx / 2;
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`${uid}_capL`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={pcL}/>
            <stop offset="50%"  stopColor={pc}/>
            <stop offset="100%" stopColor={pcD}/>
          </linearGradient>
          <linearGradient id={`${uid}_capR`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lighten(pcB,50)}/>
            <stop offset="50%"  stopColor={pcB}/>
            <stop offset="100%" stopColor={darken(pcB,30)}/>
          </linearGradient>
          <clipPath id={`${uid}_clipL`}><rect x="0" y="0" width={midX} height={hPx}/></clipPath>
          <clipPath id={`${uid}_clipR`}><rect x={midX} y="0" width={midX} height={hPx}/></clipPath>
          <filter id={`${uid}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={pc} floodOpacity="0.4"/>
          </filter>
        </defs>
        <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={rx}
          fill={`url(#${uid}_capL)`} clipPath={`url(#${uid}_clipL)`}
          stroke={strokeColor} strokeWidth="1.2" filter={`url(#${uid}_shadow)`}/>
        <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={rx}
          fill={`url(#${uid}_capR)`} clipPath={`url(#${uid}_clipR)`}
          stroke={strokeColor} strokeWidth="1.2"/>
        <line x1={midX} y1="2" x2={midX} y2={hPx-2} stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
        <ellipse cx={wPx*0.28} cy={hPx*0.28} rx={wPx*0.14} ry={hPx*0.12}
          fill="rgba(255,255,255,0.55)" transform={`rotate(-20,${wPx*0.28},${hPx*0.28})`}/>
        {pill.markFront && (
          <text x={wPx*0.25} y={hPx/2+markFontSz*0.35} textAnchor="middle"
            fontSize={markFontSz} fill={textColor} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markFront}</text>
        )}
        {pill.markBack && (
          <text x={wPx*0.75} y={hPx/2+markFontSz*0.35} textAnchor="middle"
            fontSize={markFontSz} fill={isLight?"#555":"#fff"} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markBack}</text>
        )}
        {rulerW}{rulerH}
      </svg>
    );
  }

  // ── 정제 / 다각형 ──
  let shapePath = "";
  let rx = 0, ry = 0;

  if (pill.shape === "circle") {
    rx = wPx/2; ry = hPx/2;
  } else if (pill.shape === "oval" || pill.shape === "oblong") {
    rx = Math.min(wPx,hPx)*0.45; ry = Math.min(wPx,hPx)*0.45;
  } else if (pill.shape === "rectangle") {
    rx = 4; ry = 4;
  } else if (pill.shape === "halfcircle") {
    shapePath = `M0,${hPx} Q0,0 ${wPx/2},0 Q${wPx},0 ${wPx},${hPx} Z`;
  } else if (pill.shape === "diamond") {
    shapePath = `M${wPx/2},0 L${wPx},${hPx/2} L${wPx/2},${hPx} L0,${hPx/2} Z`;
  } else if (pill.shape === "pentagon") {
    const cx=wPx/2, cy=hPx/2, rr=Math.min(wPx,hPx)/2;
    shapePath = Array.from({length:5},(_,i)=>{
      const a=(i*72-90)*Math.PI/180;
      return (i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);
    }).join(" ")+"Z";
  } else if (pill.shape === "hexagon") {
    const cx=wPx/2, cy=hPx/2, rr=Math.min(wPx,hPx)/2;
    shapePath = Array.from({length:6},(_,i)=>{
      const a=(i*60-30)*Math.PI/180;
      return (i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);
    }).join(" ")+"Z";
  } else if (pill.shape === "triangle") {
    shapePath = `M${wPx/2},0 L${wPx},${hPx} L0,${hPx} Z`;
  } else {
    rx = Math.min(wPx,hPx)*0.15; ry = rx;
  }

  const useRect = !shapePath;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`${uid}_rg`} cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor={pcL}/>
          <stop offset="55%"  stopColor={pc}/>
          <stop offset="100%" stopColor={pcD}/>
        </radialGradient>
        <linearGradient id={`${uid}_shine`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.65)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id={`${uid}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation={isWhite?"3":"4"}
            floodColor={isWhite?"#aaa":pc} floodOpacity={isWhite?"0.22":"0.42"}/>
        </filter>
        <clipPath id={`${uid}_clip`}>
          {shapePath
            ? <path d={shapePath}/>
            : <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={ry}/>
          }
        </clipPath>
      </defs>

      {/* 약 몸체 */}
      {useRect
        ? <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={ry}
            fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"}
            filter={`url(#${uid}_shadow)`}/>
        : <path d={shapePath}
            fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"}
            filter={`url(#${uid}_shadow)`}/>
      }

      {/* 테두리 강조 링 */}
      {useRect && (
        <rect x="-2" y="-2" width={wPx+4} height={hPx+4} rx={rx+2} ry={ry+2}
          fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.25"/>
      )}

      {/* 광택 */}
      <rect x={wPx*0.08} y={hPx*0.07} width={wPx*0.5} height={hPx*0.28}
        rx={Math.min(wPx,hPx)*0.08} fill={`url(#${uid}_shine)`}
        clipPath={`url(#${uid}_clip)`} opacity="0.7"/>

      {/* 중앙 분할선 */}
      {(pill.shape === "oblong" || pill.shape === "oval" || pill.shape === "circle") && (
        <line x1={wPx*0.5} y1={hPx*0.15} x2={wPx*0.5} y2={hPx*0.85}
          stroke="rgba(0,0,0,0.10)" strokeWidth="1.2"
          strokeDasharray={pill.shape==="circle"?"":"3,2"}
          clipPath={`url(#${uid}_clip)`}/>
      )}

      {/* 식별문자 */}
      {pill.markFront && (
        <text x={wPx/2} y={hPx/2+markFontSz*0.38} textAnchor="middle"
          fontSize={markFontSz} fill={textColor} fontWeight="900" fontFamily="monospace" opacity="0.82"
          clipPath={`url(#${uid}_clip)`}>{pill.markFront}</text>
      )}

      {rulerW}{rulerH}
    </svg>
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

  // ── 폰트 스케일: 기존 대비 1.5배 ──
  const FS = {
    xs:  10.5,  // 7  → 10.5
    sm:  12,    // 8  → 12
    base:15,    // 10 → 15
    md:  16.5,  // 11 → 16.5
    lg:  18,    // 12 → 18
    xl:  21,    // 14 → 21
    "2xl":24,   // 16 → 24 (미사용)
  };

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

  // ── 인쇄 ──
  const handlePrint=()=>{
    const SCALE=1.5;
    const ppm=11.811*SCALE;
    const today=new Date().toLocaleDateString("ko-KR");
    const pillHtml=(pill,idx)=>{
      if(!pill) return `<div style="border:1px dashed #dde;border-radius:8px;min-height:150px;display:flex;align-items:center;justify-content:center;color:#dde;font-size:10.5pt;">빈 슬롯</div>`;
      const color=ACCENT[idx];
      const pc=pill.colorCss||"#e0e0e0";
      const isWhite=pc==="#FFFFFF";
      const isLight=["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8"].includes(pc);
      const wPx=(pill.width*ppm).toFixed(1);
      const hPx=(pill.height*ppm).toFixed(1);
      let br="50%";
      if(pill.shape==="oblong"||pill.shape==="oval")br=(Math.min(pill.width,pill.height)*ppm*0.45).toFixed(1)+"px";
      if(pill.shape==="rectangle")br="4px";
      if(pill.shape==="pentagon"||pill.shape==="hexagon")br="20%";
      const cp=pill.shape==="diamond"?"clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);":"";
      const mark=pill.markFront||pill.mark?.split("/")[0].trim()||"";
      const markSz=Math.max(9,Math.min(pill.width,pill.height)*ppm*0.16).toFixed(1);
      const rp=(parseFloat(wPx)+10).toFixed(1);
      const oneCmPx=(37.8*SCALE).toFixed(1);
      const pcL=lighten(pc,50);
      const pcD=darken(pc,30);
      const priceStr = pill.price
        ? `<b style="color:#0ca678;-webkit-print-color-adjust:exact;">${Number(pill.price).toLocaleString()}원/${pill.priceUnit||"정"}</b>`
        : `<span style="color:#94a3b8;font-size:9pt;">보험가 미등재</span>`;
      return `<div style="border:1.5px solid ${color}55;border-radius:10px;padding:10px 10px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<div style="font-size:9pt;font-weight:700;color:${color};text-align:center;width:100%;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:2px;word-break:keep-all;line-height:1.3;">${pill.name}</div>
<div style="position:relative;display:inline-flex;align-items:flex-start;margin:4px 32px 2px 4px;">
<div style="width:${wPx}px;height:${hPx}px;border-radius:${br};${cp}background:radial-gradient(circle at 38% 32%,${pcL},${pc},${pcD});box-shadow:${isWhite?"0 4px 14px rgba(0,0,0,0.2)":"0 4px 16px "+pc+"88"};border:${isWhite?"2px solid #bbb":"1.5px solid "+darken(pc,20)};outline:3px solid ${color}44;outline-offset:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<span style="font-family:monospace;font-weight:900;font-size:${markSz}px;color:${isLight?"#555":"#fff"};opacity:0.85;">${mark}</span></div>
<div style="position:absolute;left:${rp}px;top:0;height:${hPx}px;display:flex;align-items:center;gap:3px;">
<div style="width:2px;height:100%;background:${color}bb;position:relative;"><div style="position:absolute;left:-4px;top:0;width:10px;height:2px;background:${color}bb;"></div><div style="position:absolute;left:-4px;bottom:0;width:10px;height:2px;background:${color}bb;"></div></div>
<span style="font-family:monospace;font-size:8pt;color:${color};font-weight:700;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;">${pill.height}mm</span></div></div>
<div style="width:${wPx}px;display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:100%;height:2px;background:${color}bb;position:relative;"><div style="position:absolute;left:0;top:-3px;width:2px;height:8px;background:${color}bb;"></div><div style="position:absolute;right:0;top:-3px;width:2px;height:8px;background:${color}bb;"></div></div><span style="font-family:monospace;font-size:9pt;color:${color};font-weight:700;">${pill.width}mm</span></div>
<div style="display:flex;align-items:center;gap:4px;font-size:8pt;color:#888;margin:2px 0;"><div style="width:${oneCmPx}px;height:2px;background:#bbb;position:relative;-webkit-print-color-adjust:exact;"><div style="position:absolute;left:0;top:-3px;width:2px;height:8px;background:#bbb;"></div><div style="position:absolute;right:0;top:-3px;width:2px;height:8px;background:#bbb;"></div></div><span>1cm</span></div>
<div style="font-size:8pt;color:#444;text-align:center;line-height:1.8;width:100%;">
${pill.etcOtc?`<span style="-webkit-print-color-adjust:exact;font-weight:700;color:${pill.etcOtc.includes("전문")?"#dc2626":"#16a34a"}">${pill.etcOtc.includes("전문")?"전문의약품":"일반의약품"}</span><br>`:""}
${pill.formName?`<span style="color:#3b5bdb;">${pill.formName}</span><br>`:""}
${pill.colorName||""}${pill.shapeKr?" / "+pill.shapeKr:""}<br>
<b style="color:${color};-webkit-print-color-adjust:exact;">${pill.width}×${pill.height}${pill.thickness?"×"+pill.thickness:""}mm</b><br>
${pill.hiraClass?`<span style="color:#64748b;">${pill.hiraClass}</span><br>`:""}
${priceStr}
</div></div>`;
    };
    const row1=slots.slice(0,4).map((p,i)=>pillHtml(p,i)).join("");
    const row2=slots.slice(4,8).map((p,i)=>pillHtml(p,i+4)).join("");
    const vsDivider=`<div style="display:flex;align-items:center;justify-content:center;margin:8px 0;-webkit-print-color-adjust:exact;"><div style="flex:1;height:3px;background:linear-gradient(90deg,#fff,#3b5bdb,#7048e8);border-radius:99px;margin-right:10px;-webkit-print-color-adjust:exact;"></div><div style="position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="120" height="52" viewBox="0 0 120 52" xmlns="http://www.w3.org/2000/svg" style="-webkit-print-color-adjust:exact;"><defs><radialGradient id="bg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7048e8"/><stop offset="100%" stop-color="#3b5bdb"/></radialGradient></defs><rect x="8" y="10" width="104" height="32" rx="6" fill="url(#bg1)"/><rect x="8" y="10" width="104" height="32" rx="6" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.6"/><text x="18" y="31" font-family="Arial" font-size="16" fill="#FFD700" opacity="0.9">⚡</text><text x="60" y="33" font-family="Arial Black,Impact,sans-serif" font-size="18" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">VS</text><text x="88" y="31" font-family="Arial" font-size="16" fill="#FFD700" opacity="0.9">⚡</text></svg><div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#FFD700;color:#1a1f36;font-size:7pt;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap;-webkit-print-color-adjust:exact;">💊 약제 크기 비교 💊</div></div><div style="flex:1;height:3px;background:linear-gradient(90deg,#7048e8,#3b5bdb,#fff);border-radius:99px;margin-left:10px;-webkit-print-color-adjust:exact;"></div></div>`;
    const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>약품 크기 비교표</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:white;font-size:10.5pt;}@page{size:A4 landscape;margin:7mm}.header{display:flex;align-items:center;gap:10px;border-bottom:2.5px solid #3b5bdb;padding-bottom:5px;margin-bottom:7px;-webkit-print-color-adjust:exact;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}.notice{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:8px;padding:6px 12px;background:#fffbeb;border:1.5px solid #FFD700;border-radius:8px;-webkit-print-color-adjust:exact;}.footer{margin-top:6px;font-size:7.5pt;color:#94a3b8;border-top:1px solid #eee;padding-top:4px;text-align:center;}</style></head><body><div class="header"><img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" style="height:36px;width:auto;" alt="logo" onerror="this.style.display='none'"/><div><div style="font-size:15pt;font-weight:700;color:#1a1f36;">약품 실제 크기 비교표</div><div style="font-size:9pt;color:#64748b;">식약처 공식 낱알식별 데이터 · Voice of YUHAN · made by mujjinhwan</div></div><div style="margin-left:auto;font-size:9pt;color:#94a3b8;">인쇄일: ${today}</div></div><div class="grid">${row1}</div>${vsDivider}<div class="grid" style="margin-top:8px;">${row2}</div><div class="notice"><span style="font-size:18pt;">⚠️</span><div><div style="font-size:10.5pt;font-weight:900;color:#d97706;-webkit-print-color-adjust:exact;">실제 크기의 1.5배로 출력되었습니다</div><div style="font-size:9pt;color:#92400e;">실제 약품 크기 = 인쇄된 크기 ÷ 1.5로 계산하세요.</div></div></div><div class="footer">※ 본 출력물의 약제 형상은 실제 약품 크기(mm) 기준을 1.5배 확대하여 인쇄한 것입니다. 보험가는 HIRA 급여기준 또는 식약처 공시가 기준입니다.</div></body></html>`;
    const iframe=document.createElement("iframe");
    iframe.style.cssText="position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;";
    document.body.appendChild(iframe);
    const doc=iframe.contentDocument||iframe.contentWindow.document;
    doc.open();doc.write(html);doc.close();
    setTimeout(()=>{iframe.contentWindow.focus();iframe.contentWindow.print();setTimeout(()=>document.body.removeChild(iframe),2000);},800);
  };

  const oneCm=pxPerMm*10;
  const filledSlots=slots.map((s,i)=>({pill:s,idx:i})).filter(x=>x.pill);
  const hasAny=filledSlots.length>0;
  const rows=[
    slots.slice(0,ROW).map((s,i)=>({pill:s,idx:i})),
    slots.slice(ROW,MAX).map((s,i)=>({pill:s,idx:ROW+i})),
  ];

  const tableRows=[
    {label:"구분",render:(p)=>p.etcOtc?<span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"3px 12px",borderRadius:50,fontWeight:700,fontSize:FS.base,whiteSpace:"nowrap"}}>{p.etcOtc.includes("전문")?"전문의약품":"일반의약품"}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"제형",render:(p)=>p.formName?<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"3px 12px",borderRadius:50,fontSize:FS.base,fontWeight:600}}>{p.formName}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"색상·모양",render:(p)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{p.colorCss&&<div style={{width:14,height:14,borderRadius:"50%",background:p.colorCss,border:"1px solid #ddd",flexShrink:0}}/>}<span style={{fontSize:FS.base,color:"#1a1f36"}}>{p.colorName||"-"}{p.shapeKr?" / "+p.shapeKr:""}</span></div>)},
    {label:"크기",render:(p,idx)=>(<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:ACCENT[idx],whiteSpace:"nowrap"}}>{p.width}×{p.height}{p.thickness?"×"+p.thickness:""}mm</span>)},
    {label:"효능군",render:(p)=>p.hiraClass?<span style={{fontSize:FS.base,color:"#64748b",background:"#f1f5f9",padding:"3px 10px",borderRadius:50,whiteSpace:"nowrap"}}>{p.hiraClass}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"보험가",render:(p)=>p.price
      ?<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:"#0ca678",whiteSpace:"nowrap"}}>{Number(p.price).toLocaleString()}원/{p.priceUnit||"정"}</span>
      :<span style={{color:"#94a3b8",fontSize:FS.base}}>미등재</span>
    },
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

      {/* ─── 헤더 ─── */}
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",height:60,display:"flex",alignItems:"center",gap:12}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo" style={{height:44,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))"}}/>
          <div style={{width:1,height:28,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:FS.xl,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:FS.sm,color:"#64748b"}}>식약처 공식 낱알식별 데이터 made by mujjinhwan</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 10px",fontSize:FS.sm,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        {/* ─── 검색 패널 ─── */}
        <div style={{background:"white",borderRadius:16,padding:16,marginBottom:14,boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
          <div className="sbwrap" style={{display:"flex",gap:8,marginBottom:12,position:"relative",zIndex:200}}>
            <div className="sbinput" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:FS.lg,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 자디앙, 트라젠타, 트윈스타...)"
                style={{width:"100%",padding:"13px 16px 13px 42px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:FS.xl,fontFamily:"inherit",color:"#1a1f36",background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"60vh",overflowY:"auto"}}>
                  {loading&&<div style={{padding:16,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:FS.lg}}><div style={{width:18,height:18,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:14,color:"#64748b",fontSize:FS.lg,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map(r=>{
                    const already=slots.find(s=>s&&s.id===r.id);
                    const pillBg=r.colorCss||"#e8e8e8";
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    return(
                      <div key={r.id} onClick={()=>!already&&pick(r)}
                        style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #f1f5f9",cursor:already?"not-allowed":"pointer",opacity:already?0.45:1,background:"white",transition:"background 0.12s"}}
                        onMouseEnter={e=>{if(!already)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:r.shape==="oblong"?34:20,height:18,borderRadius:shapeR,flexShrink:0,background:pillBg,border:"1px solid #ccc",boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:FS.lg,fontWeight:600,color:"#1a1f36",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}{already?" ✓":""}</div>
                          <div style={{fontSize:FS.base,color:"#94a3b8",marginTop:2,display:"flex",gap:5,flexWrap:"wrap"}}>
                            {r.etcOtc&&<span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"1px 6px",borderRadius:3,fontWeight:700,fontSize:FS.base}}>{r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 6px",borderRadius:3,fontSize:FS.base}}>{r.formName}</span>}
                            {r.colorName&&<span>{r.colorName}</span>}
                          </div>
                        </div>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"3px 8px",fontSize:FS.base,fontFamily:"monospace",color:"#3b5bdb",whiteSpace:"nowrap"}}>{r.width}x{r.height}mm</span>
                      </div>);
                  })}
                </div>
              )}
            </div>
            <button className="btn-s" onClick={()=>doSearch(query)} style={{padding:"13px 20px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",border:"none",borderRadius:10,color:"white",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 10px rgba(59,91,219,0.28)"}}>검색</button>
            <button className="btn-r" onClick={resetAll} style={{padding:"13px 16px",background:hasAny?"#fee2e2":"#f1f5f9",border:"1.5px solid "+(hasAny?"#fecaca":"#e2e8f0"),borderRadius:10,color:hasAny?"#dc2626":"#94a3b8",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.2s"}}>🔄 초기화</button>
            <button className="btn-p" onClick={handlePrint} disabled={!hasAny} style={{padding:"13px 16px",background:hasAny?"linear-gradient(135deg,#0ca678,#2f9e44)":"#f1f5f9",border:"1.5px solid "+(hasAny?"#0ca678":"#e2e8f0"),borderRadius:10,color:hasAny?"white":"#94a3b8",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:hasAny?"pointer":"not-allowed",whiteSpace:"nowrap",transition:"all 0.2s",boxShadow:hasAny?"0 2px 10px rgba(12,166,120,0.3)":"none"}}>🖨️ 인쇄</button>
          </div>

          {/* PPI 패널 */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{fontSize:FS.base,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:7}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[activeSlot],display:"inline-block"}}/>
              <span><b style={{color:ACCENT[activeSlot]}}>슬롯 {activeSlot+1}</b> 활성 · 슬롯 클릭으로 변경</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"6px 14px",fontSize:FS.base,color:"#3730a3"}}>
              📐 PPI:
              <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)} placeholder="460" min="72" max="600" style={{width:62,padding:"3px 8px",border:"1px solid #bfdbfe",borderRadius:5,fontSize:FS.base,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI} style={{padding:"3px 10px",background:"#3b5bdb",border:"none",borderRadius:5,color:"white",fontSize:FS.sm,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:FS.sm,color:"#6366f1"}}>아이폰15:460 / 갤S24:416</span>
            </div>
          </div>
        </div>

        {/* ─── 슬롯 그리드 ─── */}
        {rows.map((row,ri)=>{
          if(ri===1&&!row.some(x=>x.pill)&&activeSlot<ROW)return null;
          return(
            <div key={ri} className="slot-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              {row.map(({pill,idx})=>{
                const isActive=idx===activeSlot, color=ACCENT[idx];
                const pillBg=pill?.colorCss||null;
                return(
                  <div key={idx} onClick={()=>clickSlot(idx)}
                    style={{background:pill?"white":isActive?"#eff6ff":"#f8fafc",border:isActive?"2px solid "+color:"1.5px solid #e2e8f0",borderRadius:14,padding:14,cursor:"pointer",transition:"all 0.15s",boxShadow:isActive?"0 0 0 3px "+color+"22":"0 2px 8px rgba(0,0,0,0.05)",minHeight:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:pill?"flex-start":"center",gap:6,position:"relative"}}
                    onMouseEnter={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f0f4ff";}}
                    onMouseLeave={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f8fafc";}}>
                    {pill?(
                      <>
                        <button onClick={e=>removeSlot(e,idx)} style={{position:"absolute",top:8,right:8,background:"none",border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",color:"#dc2626",fontSize:FS.sm,padding:"1px 7px",zIndex:2}}>×</button>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontSize:FS.base,fontWeight:700,color,lineHeight:1.3,wordBreak:"keep-all",textAlign:"center"}}>{pill.name}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"center",padding:"6px 32px 2px 4px"}}>
                          <PillShapeEl pill={pill} pxPerMm={pxPerMm} accentColor={color}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:FS.xs,color:"#94a3b8"}}>
                          <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                            <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                            <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                          </div>
                          <span>1cm</span>
                        </div>
                        {pill.colorName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{pillBg&&<div style={{width:11,height:11,borderRadius:"50%",background:pillBg,border:"1px solid #ccc"}}/>}<span style={{fontSize:FS.xs,color:"#94a3b8"}}>{pill.colorName}</span></div>}
                        {/* 보험가 슬롯 표시 */}
                        {pill.price
                          ? <div style={{fontSize:FS.xs,color:"#0ca678",fontWeight:700,fontFamily:"monospace",background:"#ecfdf5",borderRadius:6,padding:"2px 8px"}}>
                              💊 {Number(pill.price).toLocaleString()}원/{pill.priceUnit||"정"}
                            </div>
                          : <div style={{fontSize:FS.xs,color:"#94a3b8"}}>보험가 미등재</div>
                        }
                      </>
                    ):(
                      <>
                        <div style={{fontSize:FS["2xl"]+8,fontWeight:800,color:isActive?color:"#cbd5e1"}}>{idx+1}</div>
                        <div style={{fontSize:FS.base,color:isActive?color:"#94a3b8",textAlign:"center",lineHeight:1.5}}>{isActive?"← 검색 후 선택":"클릭하여 선택"}</div>
                      </>
                    )}
                  </div>);
              })}
            </div>);
        })}

        {/* ─── 정보 테이블 ─── */}
        {hasAny&&(
          <div style={{background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"13px 18px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:FS.base,fontFamily:"monospace",color:"#3b5bdb",display:"flex",alignItems:"center",gap:7}}><span style={{width:7,height:7,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>약품 정보</div>
              <div style={{fontSize:FS.base,color:"#64748b"}}>{filledSlots.length}개</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
                <thead><tr>
                  <th style={{background:"#f8fafc",minWidth:84,padding:"10px",fontSize:FS.base,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
                  {filledSlots.map(({pill,idx})=>(
                    <th key={idx} style={{textAlign:"center",background:"#f8fafc",borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"10px 8px",minWidth:150}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:ACCENT[idx],display:"inline-block"}}/>
                        <span style={{fontSize:FS.base,fontWeight:700,color:ACCENT[idx],lineHeight:1.3,textAlign:"center"}}>{pill.name}</span>
                      </div>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {tableRows.map(({label,render})=>(
                    <tr key={label}>
                      <th style={{background:"#f8fafc",padding:"10px",fontSize:FS.base,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle"}}>{label}</th>
                      {filledSlots.map(({pill,idx})=>(
                        <td key={idx} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"10px",textAlign:"center",verticalAlign:"middle"}}>{render(pill,idx)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── 빈 상태 ─── */}
        {!hasAny&&(
          <div style={{background:"white",borderRadius:16,padding:"48px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"#94a3b8"}}>
            <div style={{fontSize:48,opacity:0.2}}>🔬</div>
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

function parseShape(s) {
  if (!s) return "circle";
  for (const [k,v] of Object.entries(SHAPE_MAP)) if (s.includes(k)) return v;
  return "circle";
}

// 제형 → 3D 렌더 유형
function parseFormType(formName, shape) {
  if (!formName) return "tablet";
  const f = formName.replace(/\s/g, "");
  if (f.includes("캡슐") || f.includes("연질캡슐") || f.includes("경질캡슐")) return "capsule";
  if (f.includes("시럽") || f.includes("액")) return "liquid";
  return "tablet";
}

// COLOR_MAP: 식약처 API 실제 반환값 기준 (긴 키 먼저 → 짧은 키가 잘못 매칭되는 것 방지)
const COLOR_MAP = [
  // 흰색 계열
  ["흰색","#FFFFFF"],["하양","#FFFFFF"],["백색","#FFFFFF"],["흰색(백색)","#FFFFFF"],
  // 노란색 계열
  ["연노랑","#FFF0A0"],["연노란","#FFF0A0"],["옅은노랑","#FFF8C0"],
  ["노랑","#F5C842"],["노란색","#F5C842"],["황색","#E8B84B"],["노란","#F5C842"],
  // 주황
  ["주황색","#F47C2F"],["주황","#F47C2F"],["오렌지","#F47C2F"],
  // 분홍 계열
  ["연분홍","#FBBCD4"],["연한분홍","#FBBCD4"],["살색","#FFCCAA"],["살구색","#FFCCAA"],
  ["분홍색","#F48FB1"],["분홍","#F48FB1"],["핑크","#F48FB1"],
  // 빨강
  ["빨간색","#E53935"],["빨강","#E53935"],["적색","#E53935"],["붉은","#E53935"],
  // 파랑 계열
  ["연파랑","#90CAF9"],["연한파랑","#90CAF9"],["하늘색","#87CEEB"],["하늘","#87CEEB"],
  ["파란색","#1E88E5"],["파랑","#1E88E5"],["청색","#1E88E5"],["파란","#1E88E5"],["남색","#1565C0"],
  // 초록 계열
  ["연두색","#9CCC65"],["연두","#9CCC65"],
  ["초록색","#43A047"],["초록","#43A047"],["녹색","#43A047"],["그린","#43A047"],
  // 보라 계열
  ["연보라","#CE93D8"],["옅은보라","#CE93D8"],
  ["보라색","#8E24AA"],["보라","#8E24AA"],["자색","#8E24AA"],["자주","#8E24AA"],
  // 갈색/회색
  ["갈색","#8D6E63"],["밤색","#8D6E63"],
  ["회색","#9E9E9E"],["은색","#C0C0C0"],["은","#C0C0C0"],
  // 검정 (마지막 — 오매칭 방지)
  ["검정색","#2C2C2C"],["검정","#2C2C2C"],["흑색","#2C2C2C"],["검은색","#2C2C2C"],
  // 투명
  ["투명","rgba(200,200,200,0.25)"],
];
function parsePillColor(s) {
  if (!s) return null;
  const t = s.trim();
  // 완전 일치 먼저
  for (const [k,v] of COLOR_MAP) if (t === k) return v;
  // 포함 매칭 (긴 키 우선 — 배열 순서로 보장)
  for (const [k,v] of COLOR_MAP) if (t.includes(k)) return v;
  return null;
}
function lighten(hex, amt=40) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n>>16)+amt);
  const g = Math.min(255, ((n>>8)&0xff)+amt);
  const b = Math.min(255, (n&0xff)+amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function darken(hex, amt=30) {
  if (!hex || hex.startsWith("rgba")) return hex;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (n>>16)-amt);
  const g = Math.max(0, ((n>>8)&0xff)-amt);
  const b = Math.max(0, (n&0xff)-amt);
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
    width:parseFloat(it.LNGS_STDR)||0,
    height:parseFloat(it.SHRT_STDR)||0,
    thickness:it.THICK?parseFloat(it.THICK):null,
    shape:parseShape(it.DRUG_SHPE),
    shapeKr:it.DRUG_SHPE||"",
    colorName:it.DRUG_COLO||"",
    colorCss:(()=>{
      const c = parsePillColor(it.DRUG_COLO||"");
      if (!c && it.DRUG_COLO) console.warn("[색상미매칭]", it.ITEM_NAME, "DRUG_COLO=", JSON.stringify(it.DRUG_COLO));
      return c;
    })(),
    colorBack:parsePillColor(it.DRUG_COLO_BACK||""),
    formName:it.FORM_CODE_NAME||"",
    formType:parseFormType(it.FORM_CODE_NAME||"", it.DRUG_SHPE||""),
    etcOtc:it.ETC_OTC_NAME||"",
    mark:(it.PRINT_FRONT||"")+(it.PRINT_BACK?"/"+it.PRINT_BACK:""),
    markFront:it.PRINT_FRONT||"",
    markBack:it.PRINT_BACK||"",
    hiraClass:it.HIRA_CLASS||it.CLASS_NAME||"",
    price:it.PRICE||null,
    priceUnit:it.PRICE_UNIT||"정",

  }));
}

// ─── 약제 SVG 렌더러 ──────────────────────────────────────────────────────────
// 레이아웃: 약 몸체 (OX,OY)에 배치, 치수선은 오른쪽·아래쪽에 여유 공간 확보
// overflow 제거 → viewBox 안에 모든 요소가 들어오도록 svgW/svgH 계산
function PillShapeEl({ pill, pxPerMm, accentColor }) {
  const wPx = Math.round(pill.width  * pxPerMm);
  const hPx = Math.round(pill.height * pxPerMm);
  // colorCss null → 연회색 기본 (검정 fallback 방지)
  const pc   = pill.colorCss || "#d0d0d0";
  const pcB  = pill.colorBack || pc;
  const pcL  = lighten(pc, 50);
  const pcD  = darken(pc, 30);
  const isWhite = pc === "#FFFFFF";
  const isLight = ["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8","rgba(220,220,220,0.3)"].includes(pc);
  const textColor = isLight ? "#555" : "#fff";
  const markFontSz = Math.max(7, Math.min(wPx, hPx) * 0.17);
  const strokeColor = isWhite ? "#bbb" : darken(pc, 20);
  const uid = `pill_${pill.id || Math.random().toString(36).slice(2)}`;

  // 약 몸체는 (0,0)에서 시작
  // 치수선 공간: 오른쪽 RW, 아래쪽 RH
  const RW = 36;   // 오른쪽 세로치수선 폭 (선+텍스트)
  const RH = 26;   // 아래쪽 가로치수선 높이 (선+텍스트)

  const svgW = wPx + RW;
  const svgH = hPx + RH;

  // ── 가로 치수선 (약 아래) ──
  const RY = hPx + 8;   // 가로선 y
  const rulerW = (
    <g>
      <line x1={0}   y1={RY} x2={wPx} y2={RY} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={0}   y1={RY-4} x2={0}   y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={wPx} y1={RY-4} x2={wPx} y2={RY+4} stroke={accentColor} strokeWidth="1.5"/>
      <text x={wPx/2} y={RY+13} textAnchor="middle"
        fontSize="9" fill={accentColor} fontFamily="monospace" fontWeight="700">{pill.width}mm</text>
    </g>
  );

  // ── 세로 치수선 (약 오른쪽) ──
  const RX = wPx + 10;   // 세로선 x
  const midY = hPx / 2;
  const rulerH = (
    <g>
      <line x1={RX} y1={0}   x2={RX} y2={hPx} stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={0}   x2={RX+4} y2={0}   stroke={accentColor} strokeWidth="1.5"/>
      <line x1={RX-4} y1={hPx} x2={RX+4} y2={hPx} stroke={accentColor} strokeWidth="1.5"/>
      <text
        x={RX+18} y={midY}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="9" fill={accentColor} fontFamily="monospace" fontWeight="700"
        transform={`rotate(-90,${RX+18},${midY})`}
      >{pill.height}mm</text>
    </g>
  );

  // ── 캡슐 ──
  if (pill.formType === "capsule") {
    const rx = Math.min(wPx, hPx) / 2;
    const midX = wPx / 2;
    return (
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`${uid}_capL`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={pcL}/>
            <stop offset="50%"  stopColor={pc}/>
            <stop offset="100%" stopColor={pcD}/>
          </linearGradient>
          <linearGradient id={`${uid}_capR`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lighten(pcB,50)}/>
            <stop offset="50%"  stopColor={pcB}/>
            <stop offset="100%" stopColor={darken(pcB,30)}/>
          </linearGradient>
          <clipPath id={`${uid}_clipL`}><rect x="0" y="0" width={midX} height={hPx}/></clipPath>
          <clipPath id={`${uid}_clipR`}><rect x={midX} y="0" width={midX} height={hPx}/></clipPath>
          <filter id={`${uid}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={pc} floodOpacity="0.4"/>
          </filter>
        </defs>
        <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={rx}
          fill={`url(#${uid}_capL)`} clipPath={`url(#${uid}_clipL)`}
          stroke={strokeColor} strokeWidth="1.2" filter={`url(#${uid}_shadow)`}/>
        <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={rx}
          fill={`url(#${uid}_capR)`} clipPath={`url(#${uid}_clipR)`}
          stroke={strokeColor} strokeWidth="1.2"/>
        <line x1={midX} y1="2" x2={midX} y2={hPx-2} stroke="rgba(0,0,0,0.12)" strokeWidth="1.5"/>
        <ellipse cx={wPx*0.28} cy={hPx*0.28} rx={wPx*0.14} ry={hPx*0.12}
          fill="rgba(255,255,255,0.55)" transform={`rotate(-20,${wPx*0.28},${hPx*0.28})`}/>
        {pill.markFront && (
          <text x={wPx*0.25} y={hPx/2+markFontSz*0.35} textAnchor="middle"
            fontSize={markFontSz} fill={textColor} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markFront}</text>
        )}
        {pill.markBack && (
          <text x={wPx*0.75} y={hPx/2+markFontSz*0.35} textAnchor="middle"
            fontSize={markFontSz} fill={isLight?"#555":"#fff"} fontWeight="800" fontFamily="monospace" opacity="0.85">{pill.markBack}</text>
        )}
        {rulerW}{rulerH}
      </svg>
    );
  }

  // ── 정제 / 다각형 ──
  let shapePath = "";
  let rx = 0, ry = 0;

  if (pill.shape === "circle") {
    rx = wPx/2; ry = hPx/2;
  } else if (pill.shape === "oval" || pill.shape === "oblong") {
    rx = Math.min(wPx,hPx)*0.45; ry = Math.min(wPx,hPx)*0.45;
  } else if (pill.shape === "rectangle") {
    rx = 4; ry = 4;
  } else if (pill.shape === "halfcircle") {
    shapePath = `M0,${hPx} Q0,0 ${wPx/2},0 Q${wPx},0 ${wPx},${hPx} Z`;
  } else if (pill.shape === "diamond") {
    shapePath = `M${wPx/2},0 L${wPx},${hPx/2} L${wPx/2},${hPx} L0,${hPx/2} Z`;
  } else if (pill.shape === "pentagon") {
    const cx=wPx/2, cy=hPx/2, rr=Math.min(wPx,hPx)/2;
    shapePath = Array.from({length:5},(_,i)=>{
      const a=(i*72-90)*Math.PI/180;
      return (i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);
    }).join(" ")+"Z";
  } else if (pill.shape === "hexagon") {
    const cx=wPx/2, cy=hPx/2, rr=Math.min(wPx,hPx)/2;
    shapePath = Array.from({length:6},(_,i)=>{
      const a=(i*60-30)*Math.PI/180;
      return (i===0?"M":"L")+(cx+rr*Math.cos(a)).toFixed(1)+","+(cy+rr*Math.sin(a)).toFixed(1);
    }).join(" ")+"Z";
  } else if (pill.shape === "triangle") {
    shapePath = `M${wPx/2},0 L${wPx},${hPx} L0,${hPx} Z`;
  } else {
    rx = Math.min(wPx,hPx)*0.15; ry = rx;
  }

  const useRect = !shapePath;

  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`${uid}_rg`} cx="38%" cy="32%" r="65%">
          <stop offset="0%"   stopColor={pcL}/>
          <stop offset="55%"  stopColor={pc}/>
          <stop offset="100%" stopColor={pcD}/>
        </radialGradient>
        <linearGradient id={`${uid}_shine`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%"  stopColor="rgba(255,255,255,0.65)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>
        <filter id={`${uid}_shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation={isWhite?"3":"4"}
            floodColor={isWhite?"#aaa":pc} floodOpacity={isWhite?"0.22":"0.42"}/>
        </filter>
        <clipPath id={`${uid}_clip`}>
          {shapePath
            ? <path d={shapePath}/>
            : <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={ry}/>
          }
        </clipPath>
      </defs>

      {/* 약 몸체 */}
      {useRect
        ? <rect x="0" y="0" width={wPx} height={hPx} rx={rx} ry={ry}
            fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"}
            filter={`url(#${uid}_shadow)`}/>
        : <path d={shapePath}
            fill={`url(#${uid}_rg)`} stroke={strokeColor} strokeWidth={isWhite?"1.5":"1"}
            filter={`url(#${uid}_shadow)`}/>
      }

      {/* 테두리 강조 링 */}
      {useRect && (
        <rect x="-2" y="-2" width={wPx+4} height={hPx+4} rx={rx+2} ry={ry+2}
          fill="none" stroke={accentColor} strokeWidth="1.5" opacity="0.25"/>
      )}

      {/* 광택 */}
      <rect x={wPx*0.08} y={hPx*0.07} width={wPx*0.5} height={hPx*0.28}
        rx={Math.min(wPx,hPx)*0.08} fill={`url(#${uid}_shine)`}
        clipPath={`url(#${uid}_clip)`} opacity="0.7"/>

      {/* 중앙 분할선 */}
      {(pill.shape === "oblong" || pill.shape === "oval" || pill.shape === "circle") && (
        <line x1={wPx*0.5} y1={hPx*0.15} x2={wPx*0.5} y2={hPx*0.85}
          stroke="rgba(0,0,0,0.10)" strokeWidth="1.2"
          strokeDasharray={pill.shape==="circle"?"":"3,2"}
          clipPath={`url(#${uid}_clip)`}/>
      )}

      {/* 식별문자 */}
      {pill.markFront && (
        <text x={wPx/2} y={hPx/2+markFontSz*0.38} textAnchor="middle"
          fontSize={markFontSz} fill={textColor} fontWeight="900" fontFamily="monospace" opacity="0.82"
          clipPath={`url(#${uid}_clip)`}>{pill.markFront}</text>
      )}

      {rulerW}{rulerH}
    </svg>
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

  // ── 폰트 스케일: 기존 대비 1.5배 ──
  const FS = {
    xs:  10.5,  // 7  → 10.5
    sm:  12,    // 8  → 12
    base:15,    // 10 → 15
    md:  16.5,  // 11 → 16.5
    lg:  18,    // 12 → 18
    xl:  21,    // 14 → 21
    "2xl":24,   // 16 → 24 (미사용)
  };

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

  // ── 인쇄 ──
  const handlePrint=()=>{
    const SCALE=1.5;
    const ppm=11.811*SCALE;
    const today=new Date().toLocaleDateString("ko-KR");
    const pillHtml=(pill,idx)=>{
      if(!pill) return `<div style="border:1px dashed #dde;border-radius:8px;min-height:150px;display:flex;align-items:center;justify-content:center;color:#dde;font-size:10.5pt;">빈 슬롯</div>`;
      const color=ACCENT[idx];
      const pc=pill.colorCss||"#e0e0e0";
      const isWhite=pc==="#FFFFFF";
      const isLight=["#FFFFFF","#FFF0A0","#FBBCD4","#FFCCAA","#90CAF9","#9CCC65","#CE93D8"].includes(pc);
      const wPx=(pill.width*ppm).toFixed(1);
      const hPx=(pill.height*ppm).toFixed(1);
      let br="50%";
      if(pill.shape==="oblong"||pill.shape==="oval")br=(Math.min(pill.width,pill.height)*ppm*0.45).toFixed(1)+"px";
      if(pill.shape==="rectangle")br="4px";
      if(pill.shape==="pentagon"||pill.shape==="hexagon")br="20%";
      const cp=pill.shape==="diamond"?"clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);":"";
      const mark=pill.markFront||pill.mark?.split("/")[0].trim()||"";
      const markSz=Math.max(9,Math.min(pill.width,pill.height)*ppm*0.16).toFixed(1);
      const rp=(parseFloat(wPx)+10).toFixed(1);
      const oneCmPx=(37.8*SCALE).toFixed(1);
      const pcL=lighten(pc,50);
      const pcD=darken(pc,30);
      const priceStr = pill.price
        ? `<b style="color:#0ca678;-webkit-print-color-adjust:exact;">${Number(pill.price).toLocaleString()}원/${pill.priceUnit||"정"}</b>`
        : `<span style="color:#94a3b8;font-size:9pt;">보험가 미등재</span>`;
      return `<div style="border:1.5px solid ${color}55;border-radius:10px;padding:10px 10px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<div style="font-size:9pt;font-weight:700;color:${color};text-align:center;width:100%;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:2px;word-break:keep-all;line-height:1.3;">${pill.name}</div>
<div style="position:relative;display:inline-flex;align-items:flex-start;margin:4px 32px 2px 4px;">
<div style="width:${wPx}px;height:${hPx}px;border-radius:${br};${cp}background:radial-gradient(circle at 38% 32%,${pcL},${pc},${pcD});box-shadow:${isWhite?"0 4px 14px rgba(0,0,0,0.2)":"0 4px 16px "+pc+"88"};border:${isWhite?"2px solid #bbb":"1.5px solid "+darken(pc,20)};outline:3px solid ${color}44;outline-offset:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
<span style="font-family:monospace;font-weight:900;font-size:${markSz}px;color:${isLight?"#555":"#fff"};opacity:0.85;">${mark}</span></div>
<div style="position:absolute;left:${rp}px;top:0;height:${hPx}px;display:flex;align-items:center;gap:3px;">
<div style="width:2px;height:100%;background:${color}bb;position:relative;"><div style="position:absolute;left:-4px;top:0;width:10px;height:2px;background:${color}bb;"></div><div style="position:absolute;left:-4px;bottom:0;width:10px;height:2px;background:${color}bb;"></div></div>
<span style="font-family:monospace;font-size:8pt;color:${color};font-weight:700;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;">${pill.height}mm</span></div></div>
<div style="width:${wPx}px;display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="width:100%;height:2px;background:${color}bb;position:relative;"><div style="position:absolute;left:0;top:-3px;width:2px;height:8px;background:${color}bb;"></div><div style="position:absolute;right:0;top:-3px;width:2px;height:8px;background:${color}bb;"></div></div><span style="font-family:monospace;font-size:9pt;color:${color};font-weight:700;">${pill.width}mm</span></div>
<div style="display:flex;align-items:center;gap:4px;font-size:8pt;color:#888;margin:2px 0;"><div style="width:${oneCmPx}px;height:2px;background:#bbb;position:relative;-webkit-print-color-adjust:exact;"><div style="position:absolute;left:0;top:-3px;width:2px;height:8px;background:#bbb;"></div><div style="position:absolute;right:0;top:-3px;width:2px;height:8px;background:#bbb;"></div></div><span>1cm</span></div>
<div style="font-size:8pt;color:#444;text-align:center;line-height:1.8;width:100%;">
${pill.etcOtc?`<span style="-webkit-print-color-adjust:exact;font-weight:700;color:${pill.etcOtc.includes("전문")?"#dc2626":"#16a34a"}">${pill.etcOtc.includes("전문")?"전문의약품":"일반의약품"}</span><br>`:""}
${pill.formName?`<span style="color:#3b5bdb;">${pill.formName}</span><br>`:""}
${pill.colorName||""}${pill.shapeKr?" / "+pill.shapeKr:""}<br>
<b style="color:${color};-webkit-print-color-adjust:exact;">${pill.width}×${pill.height}${pill.thickness?"×"+pill.thickness:""}mm</b><br>
${pill.hiraClass?`<span style="color:#64748b;">${pill.hiraClass}</span><br>`:""}
${priceStr}
</div></div>`;
    };
    const row1=slots.slice(0,4).map((p,i)=>pillHtml(p,i)).join("");
    const row2=slots.slice(4,8).map((p,i)=>pillHtml(p,i+4)).join("");
    const vsDivider=`<div style="display:flex;align-items:center;justify-content:center;margin:8px 0;-webkit-print-color-adjust:exact;"><div style="flex:1;height:3px;background:linear-gradient(90deg,#fff,#3b5bdb,#7048e8);border-radius:99px;margin-right:10px;-webkit-print-color-adjust:exact;"></div><div style="position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="120" height="52" viewBox="0 0 120 52" xmlns="http://www.w3.org/2000/svg" style="-webkit-print-color-adjust:exact;"><defs><radialGradient id="bg1" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7048e8"/><stop offset="100%" stop-color="#3b5bdb"/></radialGradient></defs><rect x="8" y="10" width="104" height="32" rx="6" fill="url(#bg1)"/><rect x="8" y="10" width="104" height="32" rx="6" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.6"/><text x="18" y="31" font-family="Arial" font-size="16" fill="#FFD700" opacity="0.9">⚡</text><text x="60" y="33" font-family="Arial Black,Impact,sans-serif" font-size="18" font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">VS</text><text x="88" y="31" font-family="Arial" font-size="16" fill="#FFD700" opacity="0.9">⚡</text></svg><div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:#FFD700;color:#1a1f36;font-size:7pt;font-weight:900;padding:2px 8px;border-radius:99px;white-space:nowrap;-webkit-print-color-adjust:exact;">💊 약제 크기 비교 💊</div></div><div style="flex:1;height:3px;background:linear-gradient(90deg,#7048e8,#3b5bdb,#fff);border-radius:99px;margin-left:10px;-webkit-print-color-adjust:exact;"></div></div>`;
    const html=`<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>약품 크기 비교표</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;background:white;font-size:10.5pt;}@page{size:A4 landscape;margin:7mm}.header{display:flex;align-items:center;gap:10px;border-bottom:2.5px solid #3b5bdb;padding-bottom:5px;margin-bottom:7px;-webkit-print-color-adjust:exact;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}.notice{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:8px;padding:6px 12px;background:#fffbeb;border:1.5px solid #FFD700;border-radius:8px;-webkit-print-color-adjust:exact;}.footer{margin-top:6px;font-size:7.5pt;color:#94a3b8;border-top:1px solid #eee;padding-top:4px;text-align:center;}</style></head><body><div class="header"><img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" style="height:36px;width:auto;" alt="logo" onerror="this.style.display='none'"/><div><div style="font-size:15pt;font-weight:700;color:#1a1f36;">약품 실제 크기 비교표</div><div style="font-size:9pt;color:#64748b;">식약처 공식 낱알식별 데이터 · Voice of YUHAN · made by mujjinhwan</div></div><div style="margin-left:auto;font-size:9pt;color:#94a3b8;">인쇄일: ${today}</div></div><div class="grid">${row1}</div>${vsDivider}<div class="grid" style="margin-top:8px;">${row2}</div><div class="notice"><span style="font-size:18pt;">⚠️</span><div><div style="font-size:10.5pt;font-weight:900;color:#d97706;-webkit-print-color-adjust:exact;">실제 크기의 1.5배로 출력되었습니다</div><div style="font-size:9pt;color:#92400e;">실제 약품 크기 = 인쇄된 크기 ÷ 1.5로 계산하세요.</div></div></div><div class="footer">※ 본 출력물의 약제 형상은 실제 약품 크기(mm) 기준을 1.5배 확대하여 인쇄한 것입니다. 보험가는 HIRA 급여기준 또는 식약처 공시가 기준입니다.</div></body></html>`;
    const iframe=document.createElement("iframe");
    iframe.style.cssText="position:fixed;top:-9999px;left:-9999px;width:297mm;height:210mm;border:none;";
    document.body.appendChild(iframe);
    const doc=iframe.contentDocument||iframe.contentWindow.document;
    doc.open();doc.write(html);doc.close();
    setTimeout(()=>{iframe.contentWindow.focus();iframe.contentWindow.print();setTimeout(()=>document.body.removeChild(iframe),2000);},800);
  };

  const oneCm=pxPerMm*10;
  const filledSlots=slots.map((s,i)=>({pill:s,idx:i})).filter(x=>x.pill);
  const hasAny=filledSlots.length>0;
  const rows=[
    slots.slice(0,ROW).map((s,i)=>({pill:s,idx:i})),
    slots.slice(ROW,MAX).map((s,i)=>({pill:s,idx:ROW+i})),
  ];

  const tableRows=[
    {label:"구분",render:(p)=>p.etcOtc?<span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"3px 12px",borderRadius:50,fontWeight:700,fontSize:FS.base,whiteSpace:"nowrap"}}>{p.etcOtc.includes("전문")?"전문의약품":"일반의약품"}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"제형",render:(p)=>p.formName?<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"3px 12px",borderRadius:50,fontSize:FS.base,fontWeight:600}}>{p.formName}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"색상·모양",render:(p)=>(<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>{p.colorCss&&<div style={{width:14,height:14,borderRadius:"50%",background:p.colorCss,border:"1px solid #ddd",flexShrink:0}}/>}<span style={{fontSize:FS.base,color:"#1a1f36"}}>{p.colorName||"-"}{p.shapeKr?" / "+p.shapeKr:""}</span></div>)},
    {label:"크기",render:(p,idx)=>(<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:ACCENT[idx],whiteSpace:"nowrap"}}>{p.width}×{p.height}{p.thickness?"×"+p.thickness:""}mm</span>)},
    {label:"효능군",render:(p)=>p.hiraClass?<span style={{fontSize:FS.base,color:"#64748b",background:"#f1f5f9",padding:"3px 10px",borderRadius:50,whiteSpace:"nowrap"}}>{p.hiraClass}</span>:<span style={{color:"#94a3b8",fontSize:FS.base}}>-</span>},
    {label:"보험가",render:(p)=>p.price
      ?<span style={{fontFamily:"monospace",fontSize:FS.md,fontWeight:700,color:"#0ca678",whiteSpace:"nowrap"}}>{Number(p.price).toLocaleString()}원/{p.priceUnit||"정"}</span>
      :<span style={{color:"#94a3b8",fontSize:FS.base}}>미등재</span>
    },
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

      {/* ─── 헤더 ─── */}
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",height:60,display:"flex",alignItems:"center",gap:12}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo" style={{height:44,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))"}}/>
          <div style={{width:1,height:28,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:FS.xl,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:FS.sm,color:"#64748b"}}>식약처 공식 낱알식별 데이터 made by mujjinhwan</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 10px",fontSize:FS.sm,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        {/* ─── 검색 패널 ─── */}
        <div style={{background:"white",borderRadius:16,padding:16,marginBottom:14,boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
          <div className="sbwrap" style={{display:"flex",gap:8,marginBottom:12,position:"relative",zIndex:200}}>
            <div className="sbinput" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:FS.lg,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 자디앙, 트라젠타, 트윈스타...)"
                style={{width:"100%",padding:"13px 16px 13px 42px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:FS.xl,fontFamily:"inherit",color:"#1a1f36",background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"60vh",overflowY:"auto"}}>
                  {loading&&<div style={{padding:16,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:FS.lg}}><div style={{width:18,height:18,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:14,color:"#64748b",fontSize:FS.lg,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map(r=>{
                    const already=slots.find(s=>s&&s.id===r.id);
                    const pillBg=r.colorCss||"#e8e8e8";
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    return(
                      <div key={r.id} onClick={()=>!already&&pick(r)}
                        style={{padding:"10px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid #f1f5f9",cursor:already?"not-allowed":"pointer",opacity:already?0.45:1,background:"white",transition:"background 0.12s"}}
                        onMouseEnter={e=>{if(!already)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:r.shape==="oblong"?34:20,height:18,borderRadius:shapeR,flexShrink:0,background:pillBg,border:"1px solid #ccc",boxShadow:"0 1px 3px rgba(0,0,0,0.12)"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:FS.lg,fontWeight:600,color:"#1a1f36",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}{already?" ✓":""}</div>
                          <div style={{fontSize:FS.base,color:"#94a3b8",marginTop:2,display:"flex",gap:5,flexWrap:"wrap"}}>
                            {r.etcOtc&&<span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",padding:"1px 6px",borderRadius:3,fontWeight:700,fontSize:FS.base}}>{r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 6px",borderRadius:3,fontSize:FS.base}}>{r.formName}</span>}
                            {r.colorName&&<span>{r.colorName}</span>}
                          </div>
                        </div>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,padding:"3px 8px",fontSize:FS.base,fontFamily:"monospace",color:"#3b5bdb",whiteSpace:"nowrap"}}>{r.width}x{r.height}mm</span>
                      </div>);
                  })}
                </div>
              )}
            </div>
            <button className="btn-s" onClick={()=>doSearch(query)} style={{padding:"13px 20px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",border:"none",borderRadius:10,color:"white",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 10px rgba(59,91,219,0.28)"}}>검색</button>
            <button className="btn-r" onClick={resetAll} style={{padding:"13px 16px",background:hasAny?"#fee2e2":"#f1f5f9",border:"1.5px solid "+(hasAny?"#fecaca":"#e2e8f0"),borderRadius:10,color:hasAny?"#dc2626":"#94a3b8",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.2s"}}>🔄 초기화</button>
            <button className="btn-p" onClick={handlePrint} disabled={!hasAny} style={{padding:"13px 16px",background:hasAny?"linear-gradient(135deg,#0ca678,#2f9e44)":"#f1f5f9",border:"1.5px solid "+(hasAny?"#0ca678":"#e2e8f0"),borderRadius:10,color:hasAny?"white":"#94a3b8",fontSize:FS.xl,fontWeight:700,fontFamily:"inherit",cursor:hasAny?"pointer":"not-allowed",whiteSpace:"nowrap",transition:"all 0.2s",boxShadow:hasAny?"0 2px 10px rgba(12,166,120,0.3)":"none"}}>🖨️ 인쇄</button>
          </div>

          {/* PPI 패널 */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{fontSize:FS.base,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"6px 12px",display:"flex",alignItems:"center",gap:7}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[activeSlot],display:"inline-block"}}/>
              <span><b style={{color:ACCENT[activeSlot]}}>슬롯 {activeSlot+1}</b> 활성 · 슬롯 클릭으로 변경</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:7,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"6px 14px",fontSize:FS.base,color:"#3730a3"}}>
              📐 PPI:
              <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)} placeholder="460" min="72" max="600" style={{width:62,padding:"3px 8px",border:"1px solid #bfdbfe",borderRadius:5,fontSize:FS.base,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI} style={{padding:"3px 10px",background:"#3b5bdb",border:"none",borderRadius:5,color:"white",fontSize:FS.sm,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:FS.sm,color:"#6366f1"}}>아이폰15:460 / 갤S24:416</span>
            </div>
          </div>
        </div>

        {/* ─── 슬롯 그리드 ─── */}
        {rows.map((row,ri)=>{
          if(ri===1&&!row.some(x=>x.pill)&&activeSlot<ROW)return null;
          return(
            <div key={ri} className="slot-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              {row.map(({pill,idx})=>{
                const isActive=idx===activeSlot, color=ACCENT[idx];
                const pillBg=pill?.colorCss||null;
                return(
                  <div key={idx} onClick={()=>clickSlot(idx)}
                    style={{background:pill?"white":isActive?"#eff6ff":"#f8fafc",border:isActive?"2px solid "+color:"1.5px solid #e2e8f0",borderRadius:14,padding:14,cursor:"pointer",transition:"all 0.15s",boxShadow:isActive?"0 0 0 3px "+color+"22":"0 2px 8px rgba(0,0,0,0.05)",minHeight:180,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:pill?"flex-start":"center",gap:6,position:"relative"}}
                    onMouseEnter={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f0f4ff";}}
                    onMouseLeave={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f8fafc";}}>
                    {pill?(
                      <>
                        <button onClick={e=>removeSlot(e,idx)} style={{position:"absolute",top:8,right:8,background:"none",border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",color:"#dc2626",fontSize:FS.sm,padding:"1px 7px",zIndex:2}}>×</button>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontSize:FS.base,fontWeight:700,color,lineHeight:1.3,wordBreak:"keep-all",textAlign:"center"}}>{pill.name}</span>
                        </div>
                        <div style={{display:"flex",justifyContent:"center",padding:"6px 32px 2px 4px"}}>
                          <PillShapeEl pill={pill} pxPerMm={pxPerMm} accentColor={color}/>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4,fontSize:FS.xs,color:"#94a3b8"}}>
                          <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                            <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                            <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                          </div>
                          <span>1cm</span>
                        </div>
                        {pill.colorName&&<div style={{display:"flex",alignItems:"center",gap:4}}>{pillBg&&<div style={{width:11,height:11,borderRadius:"50%",background:pillBg,border:"1px solid #ccc"}}/>}<span style={{fontSize:FS.xs,color:"#94a3b8"}}>{pill.colorName}</span></div>}
                        {/* 보험가 슬롯 표시 */}
                        {pill.price
                          ? <div style={{fontSize:FS.xs,color:"#0ca678",fontWeight:700,fontFamily:"monospace",background:"#ecfdf5",borderRadius:6,padding:"2px 8px"}}>
                              💊 {Number(pill.price).toLocaleString()}원/{pill.priceUnit||"정"}
                            </div>
                          : <div style={{fontSize:FS.xs,color:"#94a3b8"}}>보험가 미등재</div>
                        }
                      </>
                    ):(
                      <>
                        <div style={{fontSize:FS["2xl"]+8,fontWeight:800,color:isActive?color:"#cbd5e1"}}>{idx+1}</div>
                        <div style={{fontSize:FS.base,color:isActive?color:"#94a3b8",textAlign:"center",lineHeight:1.5}}>{isActive?"← 검색 후 선택":"클릭하여 선택"}</div>
                      </>
                    )}
                  </div>);
              })}
            </div>);
        })}

        {/* ─── 정보 테이블 ─── */}
        {hasAny&&(
          <div style={{background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"13px 18px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:FS.base,fontFamily:"monospace",color:"#3b5bdb",display:"flex",alignItems:"center",gap:7}}><span style={{width:7,height:7,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>약품 정보</div>
              <div style={{fontSize:FS.base,color:"#64748b"}}>{filledSlots.length}개</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
                <thead><tr>
                  <th style={{background:"#f8fafc",minWidth:84,padding:"10px",fontSize:FS.base,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
                  {filledSlots.map(({pill,idx})=>(
                    <th key={idx} style={{textAlign:"center",background:"#f8fafc",borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"10px 8px",minWidth:150}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:ACCENT[idx],display:"inline-block"}}/>
                        <span style={{fontSize:FS.base,fontWeight:700,color:ACCENT[idx],lineHeight:1.3,textAlign:"center"}}>{pill.name}</span>
                      </div>
                    </th>
                  ))}
                </tr></thead>
                <tbody>
                  {tableRows.map(({label,render})=>(
                    <tr key={label}>
                      <th style={{background:"#f8fafc",padding:"10px",fontSize:FS.base,fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle"}}>{label}</th>
                      {filledSlots.map(({pill,idx})=>(
                        <td key={idx} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"10px",textAlign:"center",verticalAlign:"middle"}}>{render(pill,idx)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── 빈 상태 ─── */}
        {!hasAny&&(
          <div style={{background:"white",borderRadius:16,padding:"48px 20px",boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"#94a3b8"}}>
            <div style={{fontSize:48,opacity:0.2}}>🔬</div>
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
