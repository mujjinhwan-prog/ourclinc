import { useState, useEffect, useRef, useCallback } from "react";

const SHAPE_MAP = {
  "원형":"circle","타원형":"oval","장방형":"oblong","반원형":"oval",
  "사각형":"oblong","마름모형":"diamond","오각형":"pentagon",
  "육각형":"hexagon","팔각형":"hexagon","삼각형":"diamond","기타":"other"
};

// 정밀 색상 매핑 (실제 약 색상 기준)
const COLOR_LIST = [
  { keys:["하양","흰색","백색","유백"],      hex:"#F2EDE6" },
  { keys:["아이보리","크림"],                hex:"#F5EDD5" },
  { keys:["연노랑","연황"],                  hex:"#F9E87A" },
  { keys:["노랑","황색"],                    hex:"#F0C132" },
  { keys:["진노랑","금색"],                  hex:"#D4A017" },
  { keys:["살구","연주황"],                  hex:"#F4A96A" },
  { keys:["주황","오렌지"],                  hex:"#E8711A" },
  { keys:["연분홍","연핑크"],                hex:"#F9B8C2" },
  { keys:["분홍","핑크","장미"],             hex:"#F07090" },
  { keys:["빨강","적색","붉은"],             hex:"#C8192E" },
  { keys:["연갈","황갈"],                    hex:"#C8956A" },
  { keys:["갈색","갈"],                      hex:"#8B5A2B" },
  { keys:["고동","진갈","적갈"],             hex:"#5C2E1A" },
  { keys:["연두","연녹"],                    hex:"#8DC85A" },
  { keys:["초록","녹색","그린"],             hex:"#2E8B4A" },
  { keys:["하늘","연파랑"],                  hex:"#72C0E8" },
  { keys:["파랑","청색","청"],               hex:"#2060C8" },
  { keys:["남색","군청"],                    hex:"#1A2E7A" },
  { keys:["연보라","라일락"],                hex:"#C8A0E0" },
  { keys:["보라","자색"],                    hex:"#7B3FA0" },
  { keys:["연회색"],                         hex:"#D0CCC8" },
  { keys:["회색","회"],                      hex:"#888480" },
  { keys:["검정","흑색"],                    hex:"#282420" },
  { keys:["투명"],                           hex:"#D8EEF8" },
];

function parseColor(s) {
  if (!s) return "#C8A882";
  const f = s.replace(/\s+/g,"").replace(/색$/,""); // 공백 제거, "색" 접미사 제거
  // 우선순위: 복합 표현(연한X) → 기본 표현
  for (const { keys, hex } of COLOR_LIST) {
    if (keys.some(k => f.includes(k.replace(/\s+/g,"")))) return hex;
  }
  // 영문 fallback
  if (f.includes("red")||f.includes("pink")) return "#F07090";
  if (f.includes("white")||f.includes("ivory")) return "#F2EDE6";
  if (f.includes("yellow")) return "#F0C132";
  if (f.includes("orange")) return "#E8711A";
  if (f.includes("green")) return "#2E8B4A";
  if (f.includes("blue")) return "#2060C8";
  if (f.includes("purple")||f.includes("violet")) return "#7B3FA0";
  if (f.includes("brown")) return "#8B5A2B";
  if (f.includes("gray")||f.includes("grey")) return "#888480";
  return "#C0B8A8";
}
function parseShape(s) {
  if (!s) return "circle";
  for (const [k,v] of Object.entries(SHAPE_MAP)) { if (s.includes(k)) return v; }
  return "circle";
}
function isLight(hex) {
  const h = hex.replace("#","").padEnd(6,"0");
  const [r,g,b] = [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  return (r*299+g*587+b*114)/1000 > 155;
}
function adj(hex, p) {
  const h = hex.replace("#","").padEnd(6,"0");
  const rgb = [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  if (p > 0) return "#"+rgb.map(c=>Math.min(255,Math.round(c+(255-c)*p/100)).toString(16).padStart(2,"0")).join("");
  return "#"+rgb.map(c=>Math.max(0,Math.round(c*(1+p/100))).toString(16).padStart(2,"0")).join("");
}

const ACCENT = ["#3b5bdb","#7048e8","#0ca678","#e67700","#c2255c","#1098ad"];

async function fetchDrug(query) {
  const r = await fetch("/api/search", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
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
    shape:parseShape(it.DRUG_SHPE), color:parseColor(it.DRUG_COLO),
    colorName:it.DRUG_COLO||"",
    mark:(it.PRINT_FRONT||"")+(it.PRINT_BACK?" / "+it.PRINT_BACK:""),
    ingredient:it.CLASS_NAME||"", imgUrl:it.ITEM_IMAGE||null,
  }));
}

function PillVisual({ pill, wPx, hPx, accentColor }) {
  const [imgOk, setImgOk] = useState(!!pill.imgUrl);
  const light = isLight(pill.color);
  const c0 = adj(pill.color, 55);   // 하이라이트
  const c1 = adj(pill.color, 22);   // 밝은면
  const c2 = pill.color;             // 기본
  const c3 = adj(pill.color, -30);  // 어두운면
  const c4 = adj(pill.color, -50);  // 그림자면

  let br = "50%", clip = "";
  if (pill.shape==="oblong")  br = `${Math.min(wPx,hPx)*0.5}px`;
  if (pill.shape==="diamond") { br="4px"; clip="polygon(50% 0%,100% 50%,50% 100%,0% 50%)"; }
  if (pill.shape==="pentagon"||pill.shape==="hexagon") br="20%";

  const base = {
    width:wPx, height:hPx, borderRadius:br,
    clipPath:clip||undefined, flexShrink:0,
    outline:`2.5px solid ${accentColor}55`, outlineOffset:4,
    overflow:"hidden", position:"relative",
    boxShadow:`0 6px 22px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.28)`,
    border: light ? "1px solid rgba(0,0,0,0.14)" : "none",
    display:"flex", alignItems:"center", justifyContent:"center",
    cursor:"default",
  };

  return (
    <div style={base}>
      {/* 실제 이미지 우선 */}
      {imgOk && pill.imgUrl ? (
        <>
          <img src={pill.imgUrl} alt={pill.name} onError={()=>setImgOk(false)}
            style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0,display:"block"}}/>
          {/* 광택 오버레이 */}
          <div style={{position:"absolute",inset:0,pointerEvents:"none",
            background:`radial-gradient(ellipse at 32% 18%, ${c0}66 0%, transparent 48%)`}}/>
        </>
      ) : (
        /* 이미지 없을 때: 다층 그라데이션 입체 렌더 */
        <>
          <div style={{position:"absolute",inset:0,
            background:`linear-gradient(148deg, ${c1} 0%, ${c2} 42%, ${c3} 75%, ${c4} 100%)`}}/>
          {/* 측면 그라데이션 (입체감) */}
          <div style={{position:"absolute",inset:0,
            background:`radial-gradient(ellipse at 28% 28%, ${c0}88 0%, transparent 52%),
                        radial-gradient(ellipse at 72% 72%, ${c4}55 0%, transparent 45%)`}}/>
          {/* 광택선 */}
          <div style={{position:"absolute",top:"10%",left:"15%",right:"40%",height:"7%",
            background:`linear-gradient(90deg,transparent,${c0}dd,transparent)`,
            borderRadius:99,filter:"blur(1.5px)",transform:"rotate(-10deg)",pointerEvents:"none"}}/>
          {/* 각인 */}
          <span style={{
            position:"relative",zIndex:1,fontFamily:"monospace",fontWeight:700,
            fontSize:Math.max(7,Math.min(wPx,hPx)*0.17),lineHeight:1,
            color: light ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.78)",
            textShadow: light
              ? "0 1px 0 rgba(255,255,255,0.7), 0 -1px 0 rgba(0,0,0,0.1)"
              : "0 1px 3px rgba(0,0,0,0.4), 0 -1px 0 rgba(255,255,255,0.08)",
            userSelect:"none",letterSpacing:-0.5,
          }}>
            {(pill.mark||"").split("/")[0].trim()}
          </span>
        </>
      )}
    </div>
  );
}

function PillCard({ pill, pxPerMm, accentColor, index }) {
  const wPx = pill.width * pxPerMm;
  const hPx = pill.height * pxPerMm;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,
      animation:`fadeUp 0.45s cubic-bezier(0.34,1.4,0.64,1) ${index*0.09}s both`}}>
      <div style={{position:"relative",display:"flex",alignItems:"flex-start"}}>
        <PillVisual pill={pill} wPx={wPx} hPx={hPx} accentColor={accentColor}/>
        {/* 세로 눈금 */}
        <div style={{position:"absolute",right:-30,top:0,height:hPx,
          display:"flex",alignItems:"center",gap:3}}>
          <div style={{width:2,height:"100%",background:`${accentColor}99`,borderRadius:1,position:"relative"}}>
            <div style={{position:"absolute",left:-3,top:0,width:8,height:2,background:`${accentColor}99`,borderRadius:1}}/>
            <div style={{position:"absolute",left:-3,bottom:0,width:8,height:2,background:`${accentColor}99`,borderRadius:1}}/>
          </div>
          <span style={{fontFamily:"monospace",fontSize:9,color:accentColor,fontWeight:600,
            writingMode:"vertical-rl",transform:"rotate(180deg)",lineHeight:1,whiteSpace:"nowrap"}}>
            {pill.height}mm
          </span>
        </div>
      </div>
      {/* 가로 눈금 */}
      <div style={{width:wPx,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <div style={{width:"100%",height:2,background:`${accentColor}99`,borderRadius:1,position:"relative"}}>
          <div style={{position:"absolute",left:0,top:-3,width:2,height:8,background:`${accentColor}99`,borderRadius:1}}/>
          <div style={{position:"absolute",right:0,top:-3,width:2,height:8,background:`${accentColor}99`,borderRadius:1}}/>
        </div>
        <span style={{fontFamily:"monospace",fontSize:10,color:accentColor,fontWeight:600}}>{pill.width}mm</span>
      </div>
      {/* 라벨 */}
      <div style={{textAlign:"center",maxWidth:160}}>
        <div style={{fontSize:12,fontWeight:700,color:accentColor,lineHeight:1.35,marginBottom:3}}>{pill.name}</div>
        <div style={{fontSize:10,color:"#64748b",fontFamily:"monospace",lineHeight:1.5,display:"flex",alignItems:"center",justifyContent:"center",gap:4,flexWrap:"wrap"}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:pill.color,
              border:`1px solid ${isLight(pill.color)?"rgba(0,0,0,0.18)":"rgba(255,255,255,0.2)"}`,
              display:"inline-block",boxShadow:"0 1px 3px rgba(0,0,0,0.15)"}}/>
            {pill.colorName}
          </span>
          · {pill.width}×{pill.height}mm{pill.thickness?`×${pill.thickness}`:""}
        </div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{pill.company}</div>
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
    const ppm=dpi/25.4; setPxPerMm(ppm); setDpiInfo(`${Math.round(dpi)} DPI · ${ppm.toFixed(2)}px/mm`);
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
  const applyPPI=()=>{const v=parseInt(ppiInput);if(!v||v<72||v>600)return;
    const ppm=v/25.4;setPxPerMm(ppm);setDpiInfo(`${v} PPI (수동) · ${ppm.toFixed(2)}px/mm`);};
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
        <div style={{maxWidth:860,margin:"0 auto",height:66,display:"flex",alignItems:"center",gap:14}}>
          {/* Voice of YUHAN 로고 */}
          <img
            src="/VOYmain.jpg"
            alt="Voice of YUHAN"
            style={{height:54,width:"auto",objectFit:"contain",flexShrink:0,
              filter:"drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
              transition:"transform 0.2s"}}
            onMouseEnter={e=>e.target.style.transform="scale(1.05)"}
            onMouseLeave={e=>e.target.style.transform="scale(1)"}
          />
          {/* 구분선 */}
          <div style={{width:1,height:34,background:"#e2e8f0",flexShrink:0}}/>
          <div>
            <div style={{fontSize:15,fontWeight:700,letterSpacing:-0.3,color:"#1a1f36"}}>약품 실제 크기 비교</div>
            <div style={{fontSize:11,color:"#64748b"}}>식약처 공식 낱알식별 데이터 · 실제 색상 반영</div>
          </div>
          <div style={{marginLeft:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",
            borderRadius:8,padding:"4px 10px",fontSize:10,fontFamily:"monospace",color:"#0ca678"}}>{dpiInfo}</div>
        </div>
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:"20px 16px 60px"}}>

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
                onFocus={e=>{e.target.style.borderColor="#3b5bdb";
                  e.target.style.boxShadow="0 0 0 3px rgba(59,91,219,0.12)";
                  if(results.length)setShowDrop(true);}}
                onBlur={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.boxShadow="none";}}/>

              {showDrop&&(
                <div ref={dropRef} style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,
                  background:"white",border:"1.5px solid #3b5bdb",borderRadius:12,zIndex:300,
                  overflow:"hidden",animation:"dropIn 0.15s ease",boxShadow:"0 8px 32px rgba(0,0,0,0.13)"}}>
                  {loading&&<div style={{padding:16,display:"flex",alignItems:"center",gap:10,color:"#64748b",fontSize:13}}>
                    <div style={{width:16,height:16,border:"2px solid #e2e8f0",borderTopColor:"#3b5bdb",
                      borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>식약처 DB 조회 중...</div>}
                  {!loading&&error&&<div style={{padding:14,color:"#64748b",fontSize:13,textAlign:"center",lineHeight:1.6}}>{error}</div>}
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
                        {/* 색상 칩 */}
                        <div style={{width:pw,height:22,borderRadius:shapeR,flexShrink:0,
                          overflow:"hidden",position:"relative",
                          boxShadow:"0 2px 6px rgba(0,0,0,0.15)",
                          border:isLight(r.color)?"1px solid rgba(0,0,0,0.1)":"none",
                          background:`linear-gradient(135deg,${adj(r.color,25)},${r.color} 60%,${adj(r.color,-22)})`}}>
                          {r.imgUrl&&<img src={r.imgUrl} alt="" onError={e=>e.target.style.display="none"}
                            style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}/>}
                        </div>
                        <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
                          <div style={{fontSize:14,fontWeight:600,color:"#1a1f36",
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                            {r.name}{added?" ✓":""}</div>
                          <div style={{fontSize:11,color:"#94a3b8",fontFamily:"monospace",marginTop:2,
                            display:"flex",alignItems:"center",gap:4}}>
                            {r.company}
                            {r.colorName&&<>
                              <span>·</span>
                              <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",
                                background:r.color,border:"1px solid rgba(0,0,0,0.12)",
                                boxShadow:"0 1px 2px rgba(0,0,0,0.1)"}}/>
                              {r.colorName}
                            </>}
                          </div>
                        </div>
                        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,
                          padding:"3px 8px",fontSize:11,fontFamily:"monospace",color:"#3b5bdb",
                          whiteSpace:"nowrap",flexShrink:0}}>{r.width}×{r.height}mm</div>
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

          {selected.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
              {selected.map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,
                  background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:50,
                  padding:"5px 10px 5px 8px",fontSize:12,fontWeight:600,color:"#1e40af"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[i],
                    flexShrink:0,display:"inline-block"}}/>
                  {p.name}
                  <button onClick={()=>remove(p.id)}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#93c5fd",
                      fontSize:16,lineHeight:1,padding:0,marginLeft:2}}
                    onMouseEnter={e=>e.target.style.color="#e03131"}
                    onMouseLeave={e=>e.target.style.color="#93c5fd"}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:11,color:"#94a3b8",marginTop:10,fontFamily:"monospace"}}>
            {selected.length>=4?"최대 4개까지 비교 가능합니다":(selected.length>0?selected.length+"개 선택됨 · ":"")+"최대 4개까지 동시 비교"}
          </div>

          {/* PPI 보정 */}
          <div style={{marginTop:14,background:"#eff6ff",border:"1px solid #bfdbfe",
            borderRadius:10,padding:"11px 15px",fontSize:12,color:"#3730a3",lineHeight:1.7}}>
            📐 <strong>화면 보정:</strong> 기기 PPI 입력 시 더 정확한 실제 크기로 표시됩니다.
            <div style={{marginTop:7,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span>내 기기 PPI:</span>
              <input type="number" value={ppiInput} onChange={e=>setPpiInput(e.target.value)}
                placeholder="예: 460" min="72" max="600"
                style={{width:80,padding:"4px 8px",border:"1px solid #bfdbfe",borderRadius:6,
                  fontSize:12,color:"#1a1f36",background:"white",outline:"none"}}/>
              <button onClick={applyPPI}
                style={{padding:"4px 12px",background:"#3b5bdb",border:"none",borderRadius:6,
                  color:"white",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>적용</button>
              <span style={{fontSize:10,color:"#6366f1"}}>아이폰15: 460 / 갤S24: 416 / 아이패드Air: 264</span>
            </div>
          </div>
        </div>

        {/* 비교 캔버스 */}
        <div style={{background:"white",borderRadius:16,overflow:"hidden",
          boxShadow:"0 4px 24px rgba(0,0,0,0.07)",border:"1px solid #e8edf3"}}>
          <div style={{padding:"13px 20px",borderBottom:"1px solid #f1f5f9",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:10,fontFamily:"monospace",color:"#3b5bdb",letterSpacing:1.5,
              textTransform:"uppercase",display:"flex",alignItems:"center",gap:6}}>
              <span style={{width:6,height:6,background:"#3b5bdb",borderRadius:"50%",display:"inline-block"}}/>크기 비교
            </div>
            <div style={{fontSize:11,fontFamily:"monospace",color:"#0ca678",
              display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:7,height:7,background:"#0ca678",borderRadius:"50%",display:"inline-block"}}/>
              실제 크기 · 실제 색상
            </div>
          </div>

          <div style={{minHeight:340,display:"flex",alignItems:"center",justifyContent:"center",
            padding:"44px 36px 60px",position:"relative",
            backgroundImage:"linear-gradient(rgba(148,163,184,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.1) 1px,transparent 1px)",
            backgroundSize:"24px 24px",backgroundColor:"#fafbfc"}}>
            {selected.length===0?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10,color:"#94a3b8"}}>
                <div style={{fontSize:44,opacity:0.28}}>🔬</div>
                <div style={{fontSize:15,fontWeight:500,color:"#64748b"}}>약품을 검색해서 추가하세요</div>
                <div style={{fontSize:12,fontFamily:"monospace"}}>실제 색상과 크기로 비교합니다</div>
              </div>
            ):(
              <>
                <div style={{display:"flex",flexWrap:"wrap",alignItems:"flex-end",
                  justifyContent:"center",gap:56}}>
                  {selected.map((p,i)=>(
                    <PillCard key={p.id} pill={p} pxPerMm={pxPerMm} accentColor={ACCENT[i]} index={i}/>
                  ))}
                </div>
                <div style={{position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",
                  display:"flex",alignItems:"center",gap:6,fontSize:10,fontFamily:"monospace",
                  color:"#94a3b8",whiteSpace:"nowrap"}}>
                  <span>1cm</span>
                  <div style={{width:oneCm,height:2,position:"relative",
                    background:"linear-gradient(90deg,transparent,#94a3b8,transparent)"}}>
                    <div style={{position:"absolute",left:-1,top:-3,width:2,height:8,background:"#94a3b8",borderRadius:1}}/>
                    <div style={{position:"absolute",right:-1,top:-3,width:2,height:8,background:"#94a3b8",borderRadius:1}}/>
                  </div>
                  <span>← 실물 자로 확인</span>
                </div>
              </>
            )}
          </div>

          {selected.length>0&&(
            <div style={{padding:"11px 20px",borderTop:"1px solid #f1f5f9",background:"#f8fafc",
              display:"flex",flexWrap:"wrap",gap:"10px 22px"}}>
              {selected.map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:7,
                  fontSize:11,fontFamily:"monospace",color:"#64748b"}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:ACCENT[i],
                    flexShrink:0,display:"inline-block"}}/>
                  <span style={{color:ACCENT[i],fontWeight:700}}>{p.name}</span>
                  <span>·</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:p.color,
                      border:"1px solid rgba(0,0,0,0.12)",display:"inline-block"}}/>
                    {p.colorName}
                  </span>
                  <span>·</span>
                  <span>{p.width}×{p.height}mm{p.thickness?`×${p.thickness}mm`:""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
 
