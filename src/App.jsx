import { useState, useEffect, useRef, useCallback } from "react";

const SHAPE_MAP = {
  "원형":"circle","타원형":"oval","장방형":"oblong","반원형":"oval",
  "사각형":"oblong","마름모형":"diamond","오각형":"pentagon",
  "육각형":"hexagon","팔각형":"hexagon","삼각형":"diamond","기타":"other"
};
function parseShape(s) {
  if (!s) return "circle";
  for (const [k,v] of Object.entries(SHAPE_MAP)) { if (s.includes(k)) return v; }
  return "circle";
}
const ACCENT = ["#3b5bdb","#7048e8","#0ca678","#e67700","#c2255c","#1098ad","#2f9e44","#862e9c"];

function parseIngredient(materialName) {
  if (!materialName) return "";
  const parts = materialName.split("|").map(p => p.trim());
  return parts.filter(p => /^[A-Za-z]/.test(p) && p.length > 1).join(" / ");
}

async function fetchDrug(query) {
  const r = await fetch("/api/search", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  if (!r.ok) throw new Error("서버 오류: " + r.status);
  const raw = await r.json();
  if (raw.error) throw new Error(raw.error);
  return raw.filter(it => it.LNGS_STDR && it.SHRT_STDR).map((it,i) => ({
    id: (it.ITEM_NAME||"p")+"_"+i,
    name: it.ITEM_NAME||"",
    width: parseFloat(it.LNGS_STDR)||0,
    height: parseFloat(it.SHRT_STDR)||0,
    thickness: it.THICK ? parseFloat(it.THICK) : null,
    shape: parseShape(it.DRUG_SHPE),
    shapeKr: it.DRUG_SHPE||"",
    colorName: it.DRUG_COLO||"",
    formName: it.FORM_CODE_NAME||"",
    etcOtc: it.ETC_OTC_NAME||"",
    ingredient: parseIngredient(it.MATERIAL_NAME) || it.INGR_NAME_EN || "",
    hiraClass: it.HIRA_CLASS || it.CLASS_NAME || "",
  }));
}

function PillShape({ pill, pxPerMm, accentColor }) {
  const wPx = pill.width * pxPerMm;
  const hPx = pill.height * pxPerMm;
  let borderRadius = "50%", clipPath = "";
  if (pill.shape==="oblong") borderRadius = Math.min(wPx,hPx)*0.5+"px";
  if (pill.shape==="diamond") { borderRadius="4px"; clipPath="polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; }
  if (pill.shape==="pentagon"||pill.shape==="hexagon") borderRadius="20%";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <div style={{position:"relative",display:"flex",alignItems:"flex-start"}}>
        <div style={{width:wPx,height:hPx,borderRadius,clipPath:clipPath||undefined,flexShrink:0,
          background:"linear-gradient(145deg,#fff 0%,#f0f0f0 50%,#e0e0e0 100%)",
          boxShadow:"0 3px 12px rgba(0,0,0,0.15),inset 0 1px 3px rgba(255,255,255,0.9)",
          outline:"2px solid "+accentColor+"55",outlineOffset:3,border:"1px solid #d0d0d0",
          display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
          <div style={{position:"absolute",top:"8%",left:"15%",right:"30%",height:"12%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)",
            borderRadius:99,filter:"blur(1px)",transform:"rotate(-8deg)"}}/>
        </div>
        <div style={{position:"absolute",right:-24,top:0,height:hPx,display:"flex",alignItems:"center",gap:2}}>
          <div style={{width:2,height:"100%",background:accentColor+"bb",borderRadius:1,position:"relative"}}>
            <div style={{position:"absolute",left:-3,top:0,width:8,height:2,background:accentColor+"bb",borderRadius:1}}/>
            <div style={{position:"absolute",left:-3,bottom:0,width:8,height:2,background:accentColor+"bb",borderRadius:1}}/>
          </div>
          <span style={{fontFamily:"monospace",fontSize:8,color:accentColor,fontWeight:700,
            writingMode:"vertical-rl",transform:"rotate(180deg)",lineHeight:1,whiteSpace:"nowrap"}}>
            {pill.height}mm
          </span>
        </div>
      </div>
      <div style={{width:wPx,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
        <div style={{width:"100%",height:2,background:accentColor+"bb",borderRadius:1,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:-2,width:2,height:6,background:accentColor+"bb",borderRadius:1}}/>
          <div style={{position:"absolute",right:0,top:-2,width:2,height:6,background:accentColor+"bb",borderRadius:1}}/>
        </div>
        <span style={{fontFamily:"monospace",fontSize:9,color:accentColor,fontWeight:700}}>{pill.width}mm</span>
      </div>
    </div>
  );
}

const MAX = 8;
const ROW = 4;

export default function App() {
  // slots[0..7]: 약품 or null
  const [slots, setSlots] = useState(Array(MAX).fill(null));
  // activeSlot: 다음 검색결과가 들어갈 슬롯 (파란 테두리)
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [pxPerMm, setPxPerMm] = useState(3.7795);
  const [dpiInfo, setDpiInfo] = useState("DPI 측정 중...");
  const [ppiInput, setPpiInput] = useState("");
  const debRef = useRef(null);
  const inRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;width:1in;visibility:hidden;left:-9999px";
    document.body.appendChild(el);
    const dpi = el.offsetWidth; document.body.removeChild(el);
    const ppm = dpi / 25.4; setPxPerMm(ppm);
    setDpiInfo(Math.round(dpi) + " DPI · " + ppm.toFixed(2) + "px/mm");
  }, []);

  useEffect(() => {
    const h = e => {
      if (!dropRef.current?.contains(e.target) && !inRef.current?.contains(e.target))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doSearch = useCallback(async q => {
    if (!q || q.length < 2) return;
    setLoading(true); setError(""); setShowDrop(true); setResults([]);
    try {
      const r = await fetchDrug(q);
      setResults(r);
      if (!r.length) setError("결과 없음.");
    } catch(e) { setError("조회 실패: " + e.message); }
    finally { setLoading(false); }
  }, []);

  const handleInput = e => {
    const v = e.target.value; setQuery(v);
    clearTimeout(debRef.current);
    if (v.length >= 2) debRef.current = setTimeout(() => doSearch(v), 750);
    else setShowDrop(false);
  };
  const handleKey = e => {
    if (e.key === "Enter") { clearTimeout(debRef.current); doSearch(query); }
    if (e.key === "Escape") setShowDrop(false);
  };

  // 검색결과 선택 → activeSlot에 배치, 다음 빈 슬롯으로 activeSlot 이동
  const pick = item => {
    if (slots.find(s => s && s.id === item.id)) return;
    const newSlots = [...slots];
    newSlots[activeSlot] = item;
    setSlots(newSlots);
    // 다음 빈 슬롯 찾기 (activeSlot+1 이후)
    let next = -1;
    for (let i = activeSlot + 1; i < MAX; i++) {
      if (!newSlots[i]) { next = i; break; }
    }
    if (next === -1) {
      for (let i = 0; i < activeSlot; i++) {
        if (!newSlots[i]) { next = i; break; }
      }
    }
    if (next !== -1) setActiveSlot(next);
    setQuery(""); setShowDrop(false); setResults([]);
  };

  // 슬롯 클릭 → 그 슬롯을 activeSlot으로
  const clickSlot = idx => {
    setActiveSlot(idx);
  };

  // 슬롯 약품 제거
  const removeSlot = (e, idx) => {
    e.stopPropagation();
    const newSlots = [...slots];
    newSlots[idx] = null;
    setSlots(newSlots);
    setActiveSlot(idx);
  };

  const resetAll = () => {
    setSlots(Array(MAX).fill(null));
    setActiveSlot(0);
    setQuery(""); setResults([]); setShowDrop(false);
  };

  const applyPPI = () => {
    const v = parseInt(ppiInput); if (!v || v < 72 || v > 600) return;
    const ppm = v / 25.4; setPxPerMm(ppm);
    setDpiInfo(v + " PPI (수동) · " + ppm.toFixed(2) + "px/mm");
  };

  const oneCm = pxPerMm * 10;
  const filledSlots = slots.map((s, i) => ({ pill: s, idx: i })).filter(x => x.pill);
  const hasAny = filledSlots.length > 0;

  // 행별 슬롯 (0~3, 4~7)
  const rows = [
    slots.slice(0, ROW).map((s, i) => ({ pill: s, idx: i })),
    slots.slice(ROW, MAX).map((s, i) => ({ pill: s, idx: ROW + i })),
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
          .btn-s{order:2;flex:1}.btn-r{order:3;flex:1}
        }
      `}</style>

      {/* 헤더 */}
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",
        position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",height:56,display:"flex",alignItems:"center",gap:12}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo"
            style={{height:42,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))"}}/>
          <div style={{width:1,height:24,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:10,color:"#64748b"}}>식약처 공식 낱알식별 데이터</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:8,
            padding:"3px 8px",fontSize:10,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        {/* 검색 패널 */}
        <div style={{background:"white",borderRadius:16,padding:14,marginBottom:14,
          boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>

          {/* 검색바 */}
          <div className="sbwrap" style={{display:"flex",gap:8,marginBottom:10,position:"relative",zIndex:200}}>
            <div className="sbinput" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
                fontSize:14,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 후 슬롯에 배치 (예: 자디앙, 트라젠타...)"
                style={{width:"100%",padding:"11px 14px 11px 36px",border:"1.5px solid #e2e8f0",
                  borderRadius:10,fontSize:14,fontFamily:"inherit",color:"#1a1f36",
                  background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>

              {/* 드롭다운 */}
              {showDrop && (
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                  background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,
                  overflow:"hidden",animation:"dropIn 0.15s ease",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"60vh",overflowY:"auto"}}>
                  {loading && (
                    <div style={{padding:14,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:13}}>
                      <div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",
                        borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>
                      식약처 DB 조회 중...
                    </div>
                  )}
                  {!loading && error && <div style={{padding:12,color:"#64748b",fontSize:13,textAlign:"center"}}>{error}</div>}
                  {!loading && !error && results.map((r, i) => {
                    const already = slots.find(s => s && s.id === r.id);
                    const disabled = !!already;
                    const shapeR = r.shape === "circle" ? "50%" : r.shape === "oblong" ? "30%" : "40%";
                    return (
                      <div key={r.id} onClick={() => !disabled && pick(r)}
                        style={{padding:"9px 14px",display:"flex",alignItems:"center",gap:10,
                          borderBottom:"1px solid #f1f5f9",cursor:disabled?"not-allowed":"pointer",
                          opacity:disabled?0.45:1,background:"white",transition:"background 0.12s"}}
                        onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:r.shape==="oblong"?30:18,height:16,borderRadius:shapeR,flexShrink:0,
                          background:"linear-gradient(145deg,#f5f5f5,#e0e0e0)",border:"1px solid #ccc"}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#1a1f36",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {r.name}{already?" ✓":""}
                          </div>
                          <div style={{fontSize:10,color:"#94a3b8",marginTop:1,display:"flex",gap:4,flexWrap:"wrap"}}>
                            {r.etcOtc && <span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",
                              color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",
                              padding:"1px 4px",borderRadius:3,fontWeight:700,fontSize:10}}>
                              {r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName && <span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 4px",borderRadius:3,fontSize:10}}>{r.formName}</span>}
                            {r.colorName && <span>{r.colorName}</span>}
                          </div>
                        </div>
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,
                          padding:"2px 6px",fontSize:10,fontFamily:"monospace",color:"#3b5bdb",whiteSpace:"nowrap"}}>
                          {r.width}x{r.height}mm
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button className="btn-s" onClick={() => doSearch(query)}
              style={{padding:"11px 16px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",
                border:"none",borderRadius:10,color:"white",fontSize:14,fontWeight:700,
                fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",
                boxShadow:"0 2px 10px rgba(59,91,219,0.28)"}}>검색</button>
            <button className="btn-r" onClick={resetAll}
              style={{padding:"11px 14px",background:hasAny?"#fee2e2":"#f1f5f9",
                border:"1.5px solid "+(hasAny?"#fecaca":"#e2e8f0"),borderRadius:10,
                color:hasAny?"#dc2626":"#94a3b8",fontSize:14,fontWeight:700,
                fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.2s"}}>🔄 초기화</button>
          </div>

          {/* 안내 + PPI */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:11,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",
              borderRadius:8,padding:"5px 10px",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:ACCENT[activeSlot],display:"inline-block"}}/>
              <span><b style={{color:ACCENT[activeSlot]}}>슬롯 {activeSlot+1}</b> 에 배치 예정 — 다른 슬롯 클릭 시 변경</span>
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

        {/* 슬롯 그리드 */}
        {rows.map((row, ri) => {
          const rowHasAny = row.some(x => x.pill);
          const isSecondEmpty = ri === 1 && !rowHasAny;
          if (isSecondEmpty) return null; // 2번째 행은 약품 있을 때만 표시
          return (
            <div key={ri} style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              {row.map(({ pill, idx }) => {
                const isActive = idx === activeSlot;
                const color = ACCENT[idx];
                return (
                  <div key={idx} onClick={() => clickSlot(idx)}
                    style={{
                      background: pill ? "white" : isActive ? "#eff6ff" : "#f8fafc",
                      border: isActive ? `2px solid ${color}` : "1.5px solid #e2e8f0",
                      borderRadius:14,padding:14,cursor:"pointer",
                      transition:"all 0.15s",
                      boxShadow: isActive ? `0 0 0 3px ${color}22` : "0 2px 8px rgba(0,0,0,0.05)",
                      minHeight:160,display:"flex",flexDirection:"column",alignItems:"center",
                      justifyContent: pill ? "flex-start" : "center",gap:8,
                      position:"relative",
                    }}
                    onMouseEnter={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f0f4ff";}}
                    onMouseLeave={e=>{if(!pill&&!isActive)e.currentTarget.style.background="#f8fafc";}}>

                    {pill ? (
                      <>
                        {/* 제거 버튼 */}
                        <button onClick={e=>removeSlot(e,idx)}
                          style={{position:"absolute",top:8,right:8,background:"none",
                            border:"1px solid #fecaca",borderRadius:4,cursor:"pointer",
                            color:"#dc2626",fontSize:9,padding:"1px 5px",zIndex:2}}>×</button>
                        {/* 약품명 */}
                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:color,flexShrink:0,display:"inline-block"}}/>
                          <span style={{fontSize:10,fontWeight:700,color,lineHeight:1.3,
                            wordBreak:"keep-all",textAlign:"center"}}>
                            {pill.name.replace(/([가-힣a-zA-Z])(d)/g,"$1\n$2").split("\n").map((l,i)=>(
                              <span key={i}>{l}<br/></span>
                            ))}
                          </span>
                        </div>
                        {/* 약품 모양 */}
                        <div style={{display:"flex",justifyContent:"center",padding:"8px 24px 4px 4px"}}>
                          <PillShape pill={pill} pxPerMm={pxPerMm} accentColor={color}/>
                        </div>
                        {/* 1cm 기준선 */}
                        <div style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"#94a3b8"}}>
                          <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                            <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                            <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                          </div>
                          <span>1cm</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{fontSize:22,fontWeight:800,color:isActive?color:"#cbd5e1"}}>
                          {idx+1}
                        </div>
                        <div style={{fontSize:10,color:isActive?color:"#94a3b8",textAlign:"center",lineHeight:1.4}}>
                          {isActive?"← 검색 후 선택":"클릭하여 선택"}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* 정보 테이블 */}
        {hasAny && (
          <div style={{background:"white",borderRadius:16,overflow:"hidden",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"11px 16px",borderBottom:"1px solid #f1f5f9",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",letterSpacing:1.5,
                textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>
                약품 정보
              </div>
              <div style={{fontSize:11,color:"#64748b"}}>{filledSlots.length}개 약품</div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
                <thead>
                  <tr>
                    <th style={{background:"#f8fafc",minWidth:72,padding:"8px 8px",fontSize:11,
                      fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",
                      borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
                    {filledSlots.map(({pill, idx}) => (
                      <th key={idx} style={{textAlign:"center",background:"#f8fafc",
                        borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                        padding:"8px 6px",minWidth:130}}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                          <span style={{width:7,height:7,borderRadius:"50%",background:ACCENT[idx],display:"inline-block"}}/>
                          <span style={{fontSize:10,fontWeight:700,color:ACCENT[idx],lineHeight:1.3,
                            wordBreak:"keep-all",whiteSpace:"pre-wrap",textAlign:"center"}}>
                            {pill.name.replace(/([가-힣a-zA-Z])(d)/g,"$1\n$2")}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label:"구분", render: p => p.etcOtc ? (
                        <span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",
                          color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",
                          padding:"2px 8px",borderRadius:50,fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>
                          {p.etcOtc.includes("전문")?"전문의약품":"일반의약품"}
                        </span>
                      ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>
                    },
                    { label:"제형", render: p => p.formName ? (
                        <span style={{background:"#eff6ff",color:"#3b5bdb",
                          padding:"2px 8px",borderRadius:50,fontSize:10,fontWeight:600}}>
                          {p.formName}
                        </span>
                      ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>
                    },
                    { label:"색상·모양", render: p => (
                        <span style={{fontSize:10,color:"#1a1f36"}}>
                          {p.colorName||"-"}{p.shapeKr?" / "+p.shapeKr:""}
                        </span>
                      )
                    },
                    { label:"크기", render: (p, idx) => (
                        <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:ACCENT[idx],whiteSpace:"nowrap"}}>
                          {p.width}×{p.height}{p.thickness?"×"+p.thickness:""}mm
                        </span>
                      )
                    },
                    { label:"주성분", render: p => (
                        <span style={{fontSize:10,color:"#374151",lineHeight:1.5,display:"block",wordBreak:"break-word"}}>
                          {p.ingredient || "-"}
                        </span>
                      )
                    },
                    { label:"효능군", render: p => p.hiraClass ? (
                        <span style={{fontSize:10,color:"#64748b",background:"#f8fafc",
                          padding:"2px 8px",borderRadius:50,display:"inline-block"}}>
                          {p.hiraClass}
                        </span>
                      ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>
                    },
                  ].map(({ label, render }) => (
                    <tr key={label}>
                      <th style={{background:"#f8fafc",padding:"8px 8px",fontSize:11,fontWeight:700,
                        color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
                        textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle"}}>{label}</th>
                      {filledSlots.map(({pill, idx}) => (
                        <td key={idx} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                          padding:"8px 8px",textAlign:"center",verticalAlign:"middle"}}>
                          {render(pill, idx)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!hasAny && (
          <div style={{background:"white",borderRadius:16,padding:"40px 20px",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",
            display:"flex",flexDirection:"column",alignItems:"center",gap:10,color:"#94a3b8"}}>
            <div style={{fontSize:40,opacity:0.2}}>🔬</div>
            <div style={{fontSize:14,fontWeight:500,color:"#64748b"}}>슬롯을 클릭하고 약품을 검색하세요</div>
            <div style={{fontSize:11,fontFamily:"monospace",textAlign:"center",lineHeight:1.8}}>
              1. 원하는 슬롯 번호 클릭 → 파란색 활성화<br/>
              2. 검색창에 약품명 입력<br/>
              3. 결과 클릭 → 슬롯에 배치
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
