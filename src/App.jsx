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
const ACCENT = ["#3b5bdb","#7048e8","#0ca678","#e67700","#c2255c","#1098ad"];

async function fetchDrug(query) {
  const r = await fetch("/api/search", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  if (!r.ok) throw new Error("서버 오류: " + r.status);
  const raw = await r.json();
  if (raw.error) throw new Error(raw.error);
  return raw.filter(it=>it.LNGS_STDR&&it.SHRT_STDR).map((it,i)=>({
    id:(it.ITEM_NAME||"p")+"_"+i,
    name:it.ITEM_NAME||"", company:it.ENTP_NAME||"",
    width:parseFloat(it.LNGS_STDR)||0, height:parseFloat(it.SHRT_STDR)||0,
    thickness:it.THICK?parseFloat(it.THICK):null,
    shape:parseShape(it.DRUG_SHPE),
    colorName:it.DRUG_COLO||"",
    mark:(it.PRINT_FRONT||"")+(it.PRINT_BACK?" / "+it.PRINT_BACK:""),
    ingredient: it.INGR_NAME_EN || it.MATERIAL_NAME || it.CLASS_NAME || "",
    price: it.MAX_PRICE || it.UNIT_PRICE || null,
    formName: it.FORM_CODE_NAME || "",
    etcOtc: it.ETC_OTC_NAME || "",
    chart: it.CHART || "",
    imgUrl: it.ITEM_IMAGE || (it.ITEM_SEQ ? "https://nedrug.mfds.go.kr/pbp/cmn/itemImageDownload/" + it.ITEM_SEQ : null),
  }));
}

// 약 사진 카드 (동일 크기 사진)
function PillPhotoCard({ pill, accentColor, index }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,
      animation:"fadeUp 0.4s cubic-bezier(0.34,1.4,0.64,1) "+(index*0.08)+"s both",
      minWidth:140, maxWidth:160}}>
      {/* 약 사진 */}
      <div style={{width:120,height:80,borderRadius:12,overflow:"hidden",
        border:"2px solid "+accentColor+"44",
        boxShadow:"0 4px 16px rgba(0,0,0,0.12)",
        background:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",
        position:"relative"}}>
        {pill.imgUrl && !imgErr ? (
          <img src={pill.imgUrl} alt={pill.name} onError={()=>setImgErr(true)}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        ) : (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:28}}>💊</span>
            <span style={{fontSize:9,color:"#94a3b8",textAlign:"center"}}>이미지 없음</span>
          </div>
        )}
        {/* 전문/일반 배지 */}
        {pill.etcOtc && (
          <div style={{position:"absolute",top:4,right:4,
            background: pill.etcOtc.includes("전문") ? "#fee2e2" : "#dcfce7",
            color: pill.etcOtc.includes("전문") ? "#dc2626" : "#16a34a",
            fontSize:9,fontWeight:700,padding:"2px 5px",borderRadius:4}}>
            {pill.etcOtc.includes("전문") ? "전문" : "일반"}
          </div>
        )}
      </div>
      {/* 이름 + 정보 */}
      <div style={{textAlign:"center",width:"100%"}}>
        <div style={{fontSize:11,fontWeight:700,color:accentColor,lineHeight:1.3,marginBottom:3}}>{pill.name}</div>
        {pill.formName && <div style={{fontSize:10,color:"#3b5bdb",background:"#eff6ff",
          borderRadius:4,padding:"1px 6px",display:"inline-block",marginBottom:3}}>{pill.formName}</div>}
        <div style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
          {pill.colorName}
        </div>
        {pill.price && <div style={{fontSize:10,color:"#e67700",fontWeight:700,marginTop:2}}>
          💰 {Number(pill.price).toLocaleString()}원
        </div>}
      </div>
    </div>
  );
}

// 실제 크기 형상 카드
function PillSizeCard({ pill, pxPerMm, accentColor, index }) {
  const wPx = pill.width * pxPerMm;
  const hPx = pill.height * pxPerMm;
  let borderRadius = "50%", clipPath = "";
  if (pill.shape==="oblong") borderRadius = Math.min(wPx,hPx)*0.5+"px";
  if (pill.shape==="diamond") { borderRadius="4px"; clipPath="polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; }
  if (pill.shape==="pentagon"||pill.shape==="hexagon") borderRadius="20%";

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,
      animation:"fadeUp 0.4s cubic-bezier(0.34,1.4,0.64,1) "+(index*0.08)+"s both"}}>
      <div style={{position:"relative",display:"flex",alignItems:"flex-start"}}>
        {/* 약 형상 */}
        <div style={{
          width:wPx, height:hPx, borderRadius, clipPath:clipPath||undefined,
          flexShrink:0,
          background:"linear-gradient(145deg,#ffffff 0%,#f0f0f0 50%,#e0e0e0 100%)",
          boxShadow:"0 4px 16px rgba(0,0,0,0.15),inset 0 1px 3px rgba(255,255,255,0.9)",
          outline:"2.5px solid "+accentColor+"66", outlineOffset:4,
          border:"1px solid #d0d0d0",
          display:"flex",alignItems:"center",justifyContent:"center",
          position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"8%",left:"15%",right:"30%",height:"12%",
            background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.9),transparent)",
            borderRadius:99,filter:"blur(1px)",transform:"rotate(-8deg)",pointerEvents:"none"}}/>
          <span style={{position:"relative",zIndex:1,fontFamily:"monospace",fontWeight:700,
            fontSize:Math.max(7,Math.min(wPx,hPx)*0.18),color:"rgba(80,80,80,0.7)",
            userSelect:"none",letterSpacing:-0.5,lineHeight:1}}>
            {(pill.mark||"").split("/")[0].trim()}
          </span>
        </div>
        {/* 세로 눈금 */}
        <div style={{position:"absolute",right:-32,top:0,height:hPx,display:"flex",alignItems:"center",gap:3}}>
          <div style={{width:2,height:"100%",background:accentColor+"cc",borderRadius:1,position:"relative"}}>
            <div style={{position:"absolute",left:-4,top:0,width:10,height:2,background:accentColor+"cc",borderRadius:1}}/>
            <div style={{position:"absolute",left:-4,bottom:0,width:10,height:2,background:accentColor+"cc",borderRadius:1}}/>
          </div>
          <span style={{fontFamily:"monospace",fontSize:10,color:accentColor,fontWeight:700,
            writingMode:"vertical-rl",transform:"rotate(180deg)",lineHeight:1,whiteSpace:"nowrap"}}>
            {pill.height}mm
          </span>
        </div>
      </div>
      {/* 가로 눈금 */}
      <div style={{width:wPx,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <div style={{width:"100%",height:2,background:accentColor+"cc",borderRadius:1,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:-4,width:2,height:10,background:accentColor+"cc",borderRadius:1}}/>
          <div style={{position:"absolute",right:0,top:-4,width:2,height:10,background:accentColor+"cc",borderRadius:1}}/>
        </div>
        <span style={{fontFamily:"monospace",fontSize:11,color:accentColor,fontWeight:700}}>{pill.width}mm</span>
      </div>
      <div style={{textAlign:"center",maxWidth:160}}>
        <div style={{fontSize:11,fontWeight:700,color:accentColor,marginBottom:2}}>{pill.name}</div>
        <div style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>
          {pill.width}x{pill.height}mm{pill.thickness?"x"+pill.thickness:""}
        </div>
        {pill.ingredient&&<div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{pill.ingredient}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [query,setQuery]=useState(""); const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const [showDrop,setShowDrop]=useState(false); const [selected,setSelected]=useState([]);
  const [pxPerMm,setPxPerMm]=useState(3.7795); const [dpiInfo,setDpiInfo]=useState("DPI 측정 중...");
  const [ppiInput,setPpiInput]=useState("");
  const debRef=useRef(null); const inRef=useRef(null); const dropRef=useRef(null);

  useEffect(()=>{
    const el=document.createElement("div");
    el.style.cssText="position:fixed;width:1in;visibility:hidden;left:-9999px";
    document.body.appendChild(el); const dpi=el.offsetWidth; document.body.removeChild(el);
    const ppm=dpi/25.4; setPxPerMm(ppm); setDpiInfo(Math.round(dpi)+" DPI · "+ppm.toFixed(2)+"px/mm");
  },[]);
  useEffect(()=>{
    const h=e=>{if(!dropRef.current?.contains(e.target)&&!inRef.current?.contains(e.target))setShowDrop(false);};
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  const doSearch=useCallback(async q=>{
    if(!q||q.length<2)return;
    setLoading(true);setError("");setShowDrop(true);setResults([]);
    try{const r=await fetchDrug(q);setResults(r);if(!r.length)setError("결과 없음. 정확한 약품명으로 검색하세요.");}
    catch(e){setError("조회 실패: "+e.message);}
    finally{setLoading(false);}
  },[]);

  const handleInput=e=>{const v=e.target.value;setQuery(v);clearTimeout(debRef.current);
    if(v.length>=2)debRef.current=setTimeout(()=>doSearch(v),750); else setShowDrop(false);};
  const handleKey=e=>{if(e.key==="Enter"){clearTimeout(debRef.current);doSearch(query);}
    if(e.key==="Escape")setShowDrop(false);};
  const pick=item=>{if(selected.length>=4||selected.find(s=>s.id===item.id))return;
    setSelected(p=>[...p,item]);setQuery("");setShowDrop(false);setResults([]);};
  const remove=id=>setSelected(p=>p.filter(x=>x.id!==id));
  const resetAll=()=>{setSelected([]);setQuery("");setResults([]);setShowDrop(false);};
  const applyPPI=()=>{const v=parseInt(ppiInput);if(!v||v<72||v>600)return;
    const ppm=v/25.4;setPxPerMm(ppm);setDpiInfo(v+" PPI (수동) · "+ppm.toFixed(2)+"px/mm");};
  const oneCm=pxPerMm*10;

  return (
    <div style={{fontFamily:"'Noto Sans KR',sans-serif",background:"#f0f4f8",minHeight:"100vh",color:"#1a1f36"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px) scale(0.82)}to{opacity:1;transform:none}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
      `}</style>

      {/* 헤더 */}
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"0 20px",
        position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{maxWidth:900,margin:"0 auto",height:66,display:"flex",alignItems:"center",gap:14}}>
          <img src="https://raw.githubusercontent.com/mujjinhwan-prog/ourclinc/main/yh_namu.png" alt="Voice of YUHAN"
            style={{height:54,width:"auto",objectFit:"contain",flexShrink:0,
              filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))",transition:"transform 0.2s"}}
            onMouseEnter={e=>e.target.style.transform="scale(1.05)"}
            onMouseLeave={e=>e.target.style.transform="scale(1)"}/>
          <div style={{width:1,height:34,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:15,fontWeight:700,letterSpacing:-0.3,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:11,color:"#64748b"}}>식약처 공식 낱알식별 데이터</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",
            borderRadius:8,padding:"4px 10px",fontSize:10,fontFamily:"monospace",color:"#0ca678"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"20px 16px 60px"}}>

        {/* 검색 패널 */}
        <div style={{background:"white",borderRadius:16,padding:20,marginBottom:16,
          boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
          <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",letterSpacing:1.5,
            textTransform:"uppercase",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",
              boxShadow:"0 0 6px #3b5bdb",display:"inline-block"}}/>품목 검색
          </div>
          <div style={{display:"flex",gap:8,position:"relative"}}>
            <div style={{flex:1,position:"relative"}} ref={inRef}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",
                fontSize:16,pointerEvents:"none",color:"#94a3b8"}}>🔍</span>
              <input value={query} onChange={handleInput} onKeyDown={handleKey}
                placeholder="약품명 입력 (예: 트라젠타, 리피토, 아스피린...)"
                style={{width:"100%",padding:"12px 16px 12px 44px",border:"1.5px solid #e2e8f0",
                  borderRadius:10,fontSize:15,fontFamily:"inherit",color:"#1a1f36",
                  background:"#f8fafc",outline:"none",transition:"all 0.2s"}}
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>
              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                  background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:300,
                  overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.13)"}}>
                  {loading&&<div style={{padding:16,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:13}}>
                    <div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:14,color:"#64748b",fontSize:13,textAlign:"center"}}>{error}</div>}
                  {!loading&&!error&&results.map((r,i)=>{
                    const added=selected.find(s=>s.id===r.id);
                    const disabled=!!added||selected.length>=4;
                    const shapeR=r.shape==="circle"?"50%":r.shape==="oblong"?"30%":"40%";
                    const pw=r.shape==="oblong"?36:22;
                    return(
                      <div key={r.id} onClick={()=>!disabled&&pick(r)}
                        style={{padding:"11px 16px",display:"flex",alignItems:"center",gap:12,
                          borderBottom:"1px solid #f1f5f9",cursor:disabled?"not-allowed":"pointer",
                          opacity:disabled?0.45:1,background:"white",transition:"background 0.12s"}}
                        onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background="#eff6ff";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="white";}}>
                        <div style={{width:pw,height:22,borderRadius:shapeR,flexShrink:0,
                          background:"linear-gradient(145deg,#f5f5f5,#e0e0e0)",
                          border:"1px solid #ccc",boxShadow:"0 2px 4px rgba(0,0,0,0.1)"}}/>
                        <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#1a1f36",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {r.name}{added?" ✓":""}</div>
                          <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginTop:2,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                            {r.etcOtc&&<span style={{background:r.etcOtc.includes("전문")?"#fee2e2":"#dcfce7",
                              color:r.etcOtc.includes("전문")?"#dc2626":"#16a34a",
                              padding:"1px 5px",borderRadius:3,fontWeight:700,fontSize:10}}>
                              {r.etcOtc.includes("전문")?"전문":"일반"}</span>}
                            {r.formName&&<span style={{background:"#eff6ff",color:"#3b5bdb",padding:"1px 5px",borderRadius:3}}>{r.formName}</span>}
                            {r.colorName&&<span>{r.colorName}</span>}
                            {r.price&&<span style={{color:"#e67700",fontWeight:700}}>💰{Number(r.price).toLocaleString()}원</span>}
                          </div>
                        </div>
                        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,
                          padding:"3px 8px",fontSize:11,fontFamily:"monospace",color:"#3b5bdb",
                          whiteSpace:"nowrap",flexShrink:0}}>{r.width}x{r.height}mm</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={()=>doSearch(query)} disabled={selected.length>=4}
              style={{padding:"12px 20px",background:"linear-gradient(135deg,#3b5bdb,#7048e8)",
                border:"none",borderRadius:10,color:"white",fontSize:14,fontWeight:700,
                fontFamily:"inherit",cursor:selected.length>=4?"not-allowed":"pointer",
                whiteSpace:"nowrap",opacity:selected.length>=4?0.4:1,
                boxShadow:"0 2px 10px rgba(59,91,219,0.28)",transition:"all 0.2s"}}>검색</button>
          </div>

          {/* 선택 태그 + 리셋 */}
          {selected.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12,alignItems:"center"}}>
              {selected.map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,
                  background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:50,
                  padding:"5px 10px 5px 8px",fontSize:12,fontWeight:600,color:"#1e40af"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[i],flexShrink:0,display:"inline-block"}}/>
                  {p.name}
                  <button onClick={()=>remove(p.id)}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#93c5fd",fontSize:16,lineHeight:1,padding:0,marginLeft:2}}
                    onMouseEnter={e=>e.target.style.color="#e03131"}
                    onMouseLeave={e=>e.target.style.color="#93c5fd"}>×</button>
                </div>
              ))}
              <button onClick={resetAll}
                style={{padding:"6px 16px",background:"#fee2e2",border:"1.5px solid #fecaca",
                  borderRadius:50,fontSize:12,fontWeight:700,color:"#dc2626",cursor:"pointer",
                  fontFamily:"inherit",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="#fecaca";}}
                onMouseLeave={e=>{e.currentTarget.style.background="#fee2e2";}}>
                🔄 전체 초기화
              </button>
            </div>
          )}
          <div style={{fontSize:11,color:"#94a3b8",marginTop:10,fontFamily:"monospace"}}>
            {selected.length>=4?"최대 4개 선택됨 · 🔄 초기화 후 다시 검색":(selected.length>0?selected.length+"개 선택됨 · ":"")+"최대 4개까지 동시 비교"}
          </div>

          {/* PPI 보정 */}
          <div style={{marginTop:14,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"11px 15px",fontSize:12,color:"#3730a3",lineHeight:1.7}}>
            📐 <strong>화면 보정:</strong> 기기 PPI 입력 시 더 정확한 실제 크기로 표시됩니다.
            <div style={{marginTop:7,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span>내 기기 PPI:</span>
              <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)}
                placeholder="예: 460" min="72" max="600"
                style={{width:80,padding:"4px 8px",border:"1px solid #bfdbfe",borderRadius:6,fontSize:12,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI}
                style={{padding:"4px 12px",background:"#3b5bdb",border:"none",borderRadius:6,color:"white",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:10,color:"#6366f1"}}>아이폰15: 460 / 갤S24: 416 / 아이패드Air: 264</span>
            </div>
          </div>
        </div>

        {selected.length > 0 && (<>

          {/* ── 섹션1: 약 사진 (동일 크기) ── */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3",marginBottom:16}}>
            <div style={{padding:"13px 20px",borderBottom:"1px solid #f1f5f9",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",letterSpacing:1.5,
                textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>
                약품 사진 · 제형 · 약가
              </div>
              <div style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>동일 크기로 표시</div>
            </div>
            <div style={{padding:"28px 20px 24px",display:"flex",flexWrap:"wrap",
              gap:24,justifyContent:"center",background:"#fafbfc"}}>
              {selected.map((p,i)=>(
                <PillPhotoCard key={p.id} pill={p} accentColor={ACCENT[i]} index={i}/>
              ))}
            </div>
          </div>

          {/* ── 섹션2: 실제 크기 형상 비교 ── */}
          <div style={{background:"white",borderRadius:16,overflow:"hidden",
            boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
            <div style={{padding:"13px 20px",borderBottom:"1px solid #f1f5f9",
              display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",letterSpacing:1.5,
                textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>
                실제 크기 비교
              </div>
              <div style={{fontSize:11,fontFamily:"monospace",color:"#0ca678",display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:7,height:7,background:"#0ca678",borderRadius:"50%",display:"inline-block"}}/>
                실제 크기 · 실제 형상
              </div>
            </div>
            <div style={{minHeight:300,display:"flex",alignItems:"center",justifyContent:"center",
              padding:"44px 40px 60px",position:"relative",
              backgroundImage:"linear-gradient(rgba(148,163,184,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.1) 1px,transparent 1px)",
              backgroundSize:"24px 24px",backgroundColor:"#fafbfc"}}>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"flex-end",justifyContent:"center",gap:60}}>
                {selected.map((p,i)=>(
                  <PillSizeCard key={p.id} pill={p} pxPerMm={pxPerMm} accentColor={ACCENT[i]} index={i}/>
                ))}
              </div>
              {/* 1cm 기준자 */}
              <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
                display:"flex",alignItems:"center",gap:6,fontSize:10,fontFamily:"monospace",color:"#94a3b8",whiteSpace:"nowrap"}}>
                <span>1cm</span>
                <div style={{width:oneCm,height:2,position:"relative",background:"linear-gradient(90deg,transparent,#94a3b8,transparent)"}}>
                  <div style={{position:"absolute",left:-1,top:-3,width:2,height:8,background:"#94a3b8",borderRadius:1}}/>
                  <div style={{position:"absolute",right:-1,top:-3,width:2,height:8,background:"#94a3b8",borderRadius:1}}/>
                </div>
                <span>← 실물 자로 확인</span>
              </div>
            </div>

            {/* 범례 */}
            <div style={{padding:"11px 20px",borderTop:"1px solid #f1f5f9",background:"#f8fafc",
              display:"flex",flexWrap:"wrap",gap:"10px 22px"}}>
              {selected.map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,fontSize:11,fontFamily:"monospace",color:"#64748b"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[i],flexShrink:0,display:"inline-block"}}/>
                  <span style={{color:ACCENT[i],fontWeight:700}}>{p.name}</span>
                  <span>·</span>
                  <span>{p.colorName}</span>
                  <span>·</span>
                  <span>{p.width}x{p.height}mm{p.thickness?"x"+p.thickness+"mm":""}</span>
                  {p.formName&&<><span>·</span><span style={{color:"#3b5bdb"}}>{p.formName}</span></>}
                  {p.ingredient&&<><span>·</span><span style={{color:"#94a3b8"}}>{p.ingredient}</span></>}
                  {p.price&&<><span>·</span><span style={{color:"#e67700",fontWeight:700}}>{Number(p.price).toLocaleString()}원</span></>}
                </div>
              ))}
            </div>
          </div>

        </>)}
      </div>
    </div>
  );
}
