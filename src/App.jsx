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

// MATERIAL_NAME 파싱: 영문 성분명만 추출
function parseIngredient(materialName) {
  if (!materialName) return "";
  // 파이프(|)로 구분된 각 성분에서 영문명 추출
  // 예: "텔미사르탄|Telmisartan|암로디핀베실산염|Amlodipine besylate"
  const parts = materialName.split("|").map(p => p.trim());
  const engParts = parts.filter(p => /^[A-Za-z]/.test(p) && p.length > 1);
  return engParts.join(" / ");
}

async function fetchDrug(query) {
  const r = await fetch("/api/search", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  if (!r.ok) throw new Error("서버 오류: " + r.status);
  const raw = await r.json();
  if (raw.error) throw new Error(raw.error);
  return raw.filter(it => it.LNGS_STDR && it.SHRT_STDR).map((it,i) => {
    // 주성분: MATERIAL_NAME에서 직접 파싱 (가장 정확)
    // INGR_NAME_EN은 fallback
    const ingredient = parseIngredient(it.MATERIAL_NAME)
      || it.INGR_NAME_EN
      || "";
    // 효능군: CLASS_NAME (HIRA_CLASS와 별도)
    const hiraClass = it.HIRA_CLASS || it.CLASS_NAME || "";
    return {
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
      ingredient,
      hiraClass,
    };
  });
}

function PillShape({ pill, pxPerMm, accentColor }) {
  const wPx = pill.width * pxPerMm;
  const hPx = pill.height * pxPerMm;
  let borderRadius = "50%", clipPath = "";
  if (pill.shape==="oblong") borderRadius = Math.min(wPx,hPx)*0.5+"px";
  if (pill.shape==="diamond") { borderRadius="4px"; clipPath="polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; }
  if (pill.shape==="pentagon"||pill.shape==="hexagon") borderRadius="20%";
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
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
        <div style={{position:"absolute",right:-26,top:0,height:hPx,display:"flex",alignItems:"center",gap:2}}>
          <div style={{width:2,height:"100%",background:accentColor+"bb",borderRadius:1,position:"relative"}}>
            <div style={{position:"absolute",left:-3,top:0,width:8,height:2,background:accentColor+"bb",borderRadius:1}}/>
            <div style={{position:"absolute",left:-3,bottom:0,width:8,height:2,background:accentColor+"bb",borderRadius:1}}/>
          </div>
          <span style={{fontFamily:"monospace",fontSize:9,color:accentColor,fontWeight:700,
            writingMode:"vertical-rl",transform:"rotate(180deg)",lineHeight:1,whiteSpace:"nowrap"}}>
            {pill.height}mm
          </span>
        </div>
      </div>
      <div style={{width:wPx,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <div style={{width:"100%",height:2,background:accentColor+"bb",borderRadius:1,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:-3,width:2,height:8,background:accentColor+"bb",borderRadius:1}}/>
          <div style={{position:"absolute",right:0,top:-3,width:2,height:8,background:accentColor+"bb",borderRadius:1}}/>
        </div>
        <span style={{fontFamily:"monospace",fontSize:10,color:accentColor,fontWeight:700}}>{pill.width}mm</span>
      </div>
    </div>
  );
}

const TH = ({children}) => (
  <th style={{background:"#f8fafc",padding:"8px 6px",fontSize:11,fontWeight:700,
    color:"#64748b",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",
    textAlign:"left",whiteSpace:"nowrap",verticalAlign:"middle",minWidth:72}}>
    {children}
  </th>
);

function CompareTable({ items, globalIdx, pxPerMm, onRemove }) {
  const oneCm = pxPerMm * 10;
  return (
    <div style={{background:"white",borderRadius:16,overflow:"hidden",
      boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",marginBottom:12}}>
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"auto"}}>
          <thead>
            <tr>
              <th style={{background:"#f8fafc",minWidth:72,padding:"8px 6px",fontSize:11,
                fontWeight:700,color:"#64748b",borderBottom:"1px solid #f1f5f9",
                borderRight:"1px solid #f1f5f9",textAlign:"left"}}></th>
              {items.map((p,i) => {
                const gi = globalIdx[i];
                const nameParts = p.name
                  .replace(/([가-힣a-zA-Z])(d)/g,"$1\n$2")
                  .replace(/([^\s])\(/g,"$1\n(")
                  .split("\n");
                return (
                  <th key={p.id} style={{textAlign:"center",background:"#f8fafc",
                    borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                    padding:"8px 4px",minWidth:120,maxWidth:160}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:ACCENT[gi],display:"inline-block"}}/>
                      <span style={{fontSize:10,fontWeight:700,color:ACCENT[gi],lineHeight:1.35,
                        wordBreak:"keep-all",whiteSpace:"pre-wrap",textAlign:"center",display:"block",width:"100%"}}>
                        {nameParts.join("\n")}
                      </span>
                      <button onClick={()=>onRemove(p.id)}
                        style={{background:"none",border:"1px solid #fecaca",borderRadius:4,
                          cursor:"pointer",color:"#dc2626",fontSize:9,padding:"1px 5px",marginTop:1}}>
                        제거
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* 실제 크기 */}
            <tr>
              <TH>실제 크기<br/><span style={{fontSize:9,fontWeight:400,color:"#94a3b8"}}>실물 비례</span></TH>
              {items.map((p,i) => {
                const gi = globalIdx[i];
                return (
                  <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                    padding:"6px 4px",textAlign:"center",verticalAlign:"middle"}}>
                    <div style={{display:"flex",justifyContent:"center",padding:"12px 26px 4px 4px",overflowX:"auto"}}>
                      <PillShape pill={p} pxPerMm={pxPerMm} accentColor={ACCENT[gi]}/>
                    </div>
                    <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:3,
                      fontSize:9,color:"#94a3b8",marginBottom:3}}>
                      <div style={{width:oneCm,height:1.5,background:"#cbd5e1",position:"relative"}}>
                        <div style={{position:"absolute",left:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                        <div style={{position:"absolute",right:0,top:-2,width:1.5,height:6,background:"#cbd5e1"}}/>
                      </div>
                      <span>1cm</span>
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* 구분 */}
            <tr>
              <TH>구분</TH>
              {items.map((p,i) => (
                <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                  padding:"8px 6px",textAlign:"center",verticalAlign:"middle"}}>
                  {p.etcOtc ? (
                    <span style={{background:p.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",
                      color:p.etcOtc.includes("전문")?"#dc2626":"#16a34a",
                      padding:"2px 6px",borderRadius:50,fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>
                      {p.etcOtc.includes("전문")?"전문":"일반"}
                    </span>
                  ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>}
                </td>
              ))}
            </tr>
            {/* 제형 */}
            <tr>
              <TH>제형</TH>
              {items.map((p,i) => (
                <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                  padding:"8px 6px",textAlign:"center",verticalAlign:"middle"}}>
                  {p.formName ? (
                    <span style={{background:"#eff6ff",color:"#3b5bdb",
                      padding:"2px 6px",borderRadius:50,fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>
                      {p.formName}
                    </span>
                  ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>}
                </td>
              ))}
            </tr>
            {/* 색상·모양 */}
            <tr>
              <TH>색상·모양</TH>
              {items.map((p,i) => (
                <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                  padding:"8px 6px",textAlign:"center",verticalAlign:"middle",fontSize:10,color:"#1a1f36"}}>
                  {p.colorName||"-"}{p.shapeKr?" / "+p.shapeKr:""}
                </td>
              ))}
            </tr>
            {/* 크기 */}
            <tr>
              <TH>크기</TH>
              {items.map((p,i) => {
                const gi = globalIdx[i];
                return (
                  <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                    padding:"8px 6px",textAlign:"center",verticalAlign:"middle"}}>
                    <span style={{fontFamily:"monospace",fontSize:11,fontWeight:700,color:ACCENT[gi],whiteSpace:"nowrap"}}>
                      {p.width}×{p.height}{p.thickness?"×"+p.thickness:""}mm
                    </span>
                  </td>
                );
              })}
            </tr>
            {/* 주성분 — MATERIAL_NAME에서 파싱한 영문 성분명 */}
            <tr>
              <TH>주성분</TH>
              {items.map((p,i) => (
                <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",
                  padding:"8px 6px",textAlign:"center",verticalAlign:"middle"}}>
                  {p.ingredient ? (
                    <span style={{fontSize:10,color:"#374151",lineHeight:1.5,display:"block",wordBreak:"break-word"}}>
                      {p.ingredient}
                    </span>
                  ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>}
                </td>
              ))}
            </tr>
            {/* 효능군 — CLASS_NAME */}
            <tr>
              <TH>효능군</TH>
              {items.map((p,i) => (
                <td key={p.id} style={{borderLeft:"1px solid #f1f5f9",
                  padding:"8px 6px",textAlign:"center",verticalAlign:"middle"}}>
                  {p.hiraClass ? (
                    <span style={{fontSize:10,color:"#64748b",background:"#f8fafc",
                      padding:"2px 8px",borderRadius:50,display:"inline-block"}}>
                      {p.hiraClass}
                    </span>
                  ) : <span style={{color:"#94a3b8",fontSize:10}}>-</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showDrop,setShowDrop]=useState(false);
  const [selected,setSelected]=useState([]);
  const [breaks,setBreaks]=useState(new Set());
  const [pxPerMm,setPxPerMm]=useState(3.7795);
  const [dpiInfo,setDpiInfo]=useState("DPI 측정 중...");
  const [ppiInput,setPpiInput]=useState("");
  const debRef=useRef(null);
  const inRef=useRef(null);
  const dropRef=useRef(null);
  const MAX = 8;
  const AUTO_BREAK = 4;

  useEffect(()=>{
    const el=document.createElement("div");
    el.style.cssText="position:fixed;width:1in;visibility:hidden;left:-9999px";
    document.body.appendChild(el);
    const dpi=el.offsetWidth; document.body.removeChild(el);
    const ppm=dpi/25.4; setPxPerMm(ppm);
    setDpiInfo(Math.round(dpi)+" DPI · "+ppm.toFixed(2)+"px/mm");
  },[]);

  useEffect(()=>{
    const h=e=>{
      if(!dropRef.current?.contains(e.target)&&!inRef.current?.contains(e.target))
        setShowDrop(false);
    };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const doSearch=useCallback(async q=>{
    if(!q||q.length<2)return;
    setLoading(true);setError("");setShowDrop(true);setResults([]);
    try{
      const r=await fetchDrug(q);
      setResults(r);
      if(!r.length)setError("결과 없음. 다른 약품명으로 검색해보세요.");
    }catch(e){setError("조회 실패: "+e.message);}
    finally{setLoading(false);}
  },[]);

  const handleInput=e=>{
    const v=e.target.value; setQuery(v);
    clearTimeout(debRef.current);
    if(v.length>=2) debRef.current=setTimeout(()=>doSearch(v),750);
    else setShowDrop(false);
  };
  const handleKey=e=>{
    if(e.key==="Enter"){clearTimeout(debRef.current);doSearch(query);}
    if(e.key==="Escape")setShowDrop(false);
  };
  const pick=item=>{
    if(selected.length>=MAX||selected.find(s=>s.id===item.id))return;
    setSelected(p=>[...p,item]);
    setQuery("");setShowDrop(false);setResults([]);
  };
  const remove=id=>{
    setSelected(p=>{
      const idx=p.findIndex(x=>x.id===id);
      const next=p.filter(x=>x.id!==id);
      setBreaks(prev=>{
        const nb=new Set();
        prev.forEach(b=>{ if(b!==idx) nb.add(b>idx?b-1:b); });
        return nb;
      });
      return next;
    });
  };
  const resetAll=()=>{setSelected([]);setBreaks(new Set());setQuery("");setResults([]);setShowDrop(false);};
  const applyPPI=()=>{
    const v=parseInt(ppiInput); if(!v||v<72||v>600)return;
    const ppm=v/25.4; setPxPerMm(ppm);
    setDpiInfo(v+" PPI (수동) · "+ppm.toFixed(2)+"px/mm");
  };
  const toggleBreak=(afterIdx)=>{
    setBreaks(prev=>{
      const nb=new Set(prev);
      if(nb.has(afterIdx)) nb.delete(afterIdx);
      else nb.add(afterIdx);
      return nb;
    });
  };

  function getGroups() {
    const groups=[];
    let cur=[];
    selected.forEach((item,i)=>{
      cur.push(i);
      const isManualBreak=breaks.has(i+1);
      const isAutoBreak=cur.length>=AUTO_BREAK;
      if((isManualBreak||isAutoBreak)&&i<selected.length-1){
        groups.push([...cur]); cur=[];
      }
    });
    if(cur.length>0) groups.push(cur);
    return groups;
  }
  const groups=getGroups();

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif",background:"#f0f4f8",minHeight:"100vh",color:"#1a1f36"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        @media(max-width:640px){
          .search-bar-wrap{flex-wrap:wrap !important;gap:6px !important;}
          .search-input-wrap{min-width:100% !important;order:1}
          .btn-search{order:2;flex:1}
          .btn-reset{order:3;flex:1}
        }
      `}</style>

      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 16px",
        position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:1400,margin:"0 auto",height:58,display:"flex",alignItems:"center",gap:12}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="logo"
            style={{height:44,width:"auto",objectFit:"contain",flexShrink:0,filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))"}}/>
          <div style={{width:1,height:26,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:10,color:"#64748b"}}>식약처 공식 낱알식별 데이터</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",
            borderRadius:8,padding:"3px 8px",fontSize:10,fontFamily:"monospace",color:"#0ca678",whiteSpace:"nowrap"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:1400,margin:"0 auto",padding:"14px 12px 60px"}}>
        <div style={{background:"white",borderRadius:16,padding:14,marginBottom:14,
          boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>

          <div className="search-bar-wrap" style={{display:"flex",gap:8,marginBottom:10,position:"relative",zIndex:200}}>
            <div className="search-input-wrap" style={{flex:1,position:"relative",minWidth:0}} ref={inRef}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
                fontSize:14,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 트라젠타, 트윈스타...)"
                style={{width:"100%",padding:"11px 14px 11px 36px",border:"1.5px solid #e2e8f0",
                  borderRadius:10,fontSize:14,fontFamily:"inherit",color:"#1a1f36",
                  background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                  background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:9999,
                  overflow:"hidden",animation:"dropIn 0.15s ease",
                  boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"60vh",overflowY:"auto"}}>
                  {loading&&<div style={{padding:14,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:13}}>
                    <div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",
                      borderRadius:"50%",animation:"spin 0.6s linear infinite",flexShrink:0}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:12,color:"#64748b",fontSize:13,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map((r,i)=>{
                    const added=selected.find(s=>s.id===r.id);
                    const disabled=!!added||selected.length>=MAX;
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    return(
                      <div key={r.id} onClick={()=>!disabled&&pick(r)}
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
                            {r.name}{added?" ✓":""}
                          </div>
                          <div style={{fontSize:10,color:"#94a3b8",marginTop:1,display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                            {r.etcOtc&&<span style={{
                              background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",
                              color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",
                              padding:"1px 4px",borderRadius:3,fontWeight:700,fontSize:10}}>
                              {r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 4px",borderRadius:3,fontSize:10}}>{r.formName}</span>}
                            {r.colorName&&<span>{r.colorName}</span>}
                          </div>
                        </div>
                        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:5,
                          padding:"2px 6px",fontSize:10,fontFamily:"monospace",color:"#3b5bdb",
                          whiteSpace:"nowrap",flexShrink:0}}>{r.width}x{r.height}mm</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button className="btn-search" onClick={()=>doSearch(query)} disabled={selected.length>=MAX}
              style={{padding:"11px 16px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",
                border:"none",borderRadius:10,color:"white",fontSize:14,fontWeight:700,
                fontFamily:"inherit",cursor:selected.length>=MAX?"not-allowed":"pointer",
                opacity:selected.length>=MAX?0.4:1,whiteSpace:"nowrap",
                boxShadow:"0 2px 10px rgba(59,91,219,0.28)"}}>검색</button>
            <button className="btn-reset" onClick={resetAll}
              style={{padding:"11px 14px",background:selected.length>0?"#fee2e2":"#f1f5f9",
                border:"1.5px solid "+(selected.length>0?"#fecaca":"#e2e8f0"),
                borderRadius:10,color:selected.length>0?"#dc2626":"#94a3b8",
                fontSize:14,fontWeight:700,fontFamily:"inherit",cursor:"pointer",
                whiteSpace:"nowrap",transition:"all 0.2s"}}>🔄 초기화</button>
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"center",minHeight:32,marginBottom:10}}>
            {selected.length===0 ? (
              <span style={{fontSize:12,color:"#94a3b8",fontFamily:"monospace"}}>약품을 검색하여 추가하세요 (최대 {MAX}개, 4개씩 자동 줄바꿈)</span>
            ) : (
              <>
                {selected.map((p,i)=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,
                      background:"#eff6ff",border:"1.5px solid "+ACCENT[i]+"55",borderRadius:50,
                      padding:"3px 9px 3px 7px",fontSize:11,fontWeight:600,color:ACCENT[i]}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:ACCENT[i],flexShrink:0,display:"inline-block"}}/>
                      {p.name}
                      <button onClick={()=>remove(p.id)}
                        style={{background:"none",border:"none",cursor:"pointer",color:ACCENT[i]+"99",fontSize:14,lineHeight:1,padding:0,marginLeft:1}}
                        onMouseEnter={e=>e.target.style.color="#e03131"}
                        onMouseLeave={e=>e.target.style.color=ACCENT[i]+"99"}>×</button>
                    </div>
                    {i < selected.length-1 && (
                      <button onClick={()=>toggleBreak(i+1)}
                        title={breaks.has(i+1)?"줄바꿈 제거":"여기서 줄바꿈"}
                        style={{padding:"2px 7px",fontSize:10,borderRadius:6,cursor:"pointer",
                          fontFamily:"inherit",fontWeight:600,transition:"all 0.15s",
                          border:"1.5px solid "+(breaks.has(i+1)?"#3b5bdb":"#e2e8f0"),
                          background:breaks.has(i+1)?"#eff6ff":"#f8fafc",
                          color:breaks.has(i+1)?"#3b5bdb":"#94a3b8"}}>
                        {breaks.has(i+1)?"↩ 줄":"↵"}
                      </button>
                    )}
                  </div>
                ))}
                <span style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace"}}>{selected.length}/{MAX}개</span>
              </>
            )}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",
            background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,
            padding:"6px 12px",fontSize:12,color:"#3730a3"}}>
            📐
            <span style={{color:"#64748b"}}>PPI:</span>
            <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)}
              placeholder="460" min="72" max="600"
              style={{width:60,padding:"2px 6px",border:"1px solid #bfdbfe",borderRadius:5,
                fontSize:12,color:"#1a1f36",background:"white",outline:"none"}}/>
            <button onClick={applyPPI}
              style={{padding:"2px 8px",background:"#3b5bdb",border:"none",borderRadius:5,
                color:"white",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
            <span style={{fontSize:10,color:"#6366f1"}}>아이폰15:460 / 갤S24:416 / 아이패드Air:264</span>
          </div>
        </div>

        {selected.length > 0 && groups.map((groupIdx, gi) => (
          <div key={gi}>
            {groups.length > 1 && (
              <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginBottom:6,paddingLeft:4}}>
                {gi+1}번째 줄 ({groupIdx.length}개)
              </div>
            )}
            <CompareTable
              items={groupIdx.map(i=>selected[i])}
              globalIdx={groupIdx}
              pxPerMm={pxPerMm}
              onRemove={remove}
            />
          </div>
        ))}

        {selected.length === 0 && (
          <div style={{background:"white",borderRadius:16,padding:"50px 20px",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",
            display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"#94a3b8"}}>
            <div style={{fontSize:44,opacity:0.25}}>🔬</div>
            <div style={{fontSize:15,fontWeight:500,color:"#64748b"}}>약품을 검색해서 추가하세요</div>
            <div style={{fontSize:12,fontFamily:"monospace"}}>1~{MAX}개 · 4개씩 자동 줄바꿈 · ↵ 버튼으로 수동 줄바꿈</div>
          </div>
        )}
      </div>
    </div>
  );
}
