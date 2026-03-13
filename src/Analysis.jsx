// ─── ANALYSIS TAB — Valor Relativo Cuantitativo ───────────────────────────────
import { useMemo, useState, Fragment } from "react";

const C = {
  navy:"#000039", blue1:"#1e5ab0", blue2:"#3399ff",
  teal:"#23a29e", salmon:"#ebaca2", green:"#acd484",
  white:"#fff", bg:"#edf1f7", card:"#fff",
  border:"#cdd7e8", text:"#0a0d2e", muted:"#5a6880",
  pos:"#16a34a", neg:"#dc2626",
};
const card = { background:C.card, borderRadius:12, boxShadow:"0 2px 14px rgba(0,0,57,.09)", overflow:"hidden" };

// ─────────────────────────────────────────────────────────────────────────────
// I. NELSON-SIEGEL FIT
// y(t) = β0 + β1·φ1(t) + β2·φ2(t)
// ─────────────────────────────────────────────────────────────────────────────
function nsYield(beta, tau, t) {
  if (t < 0.001) return beta[0] + beta[1];
  const x = t / tau, ex = Math.exp(-x);
  return beta[0] + beta[1]*(1-ex)/x + beta[2]*((1-ex)/x - ex);
}
function solveLS3(AtA, Atb) {            // Gaussian elimination 3×3
  const m = AtA.map((r,i) => [...r, Atb[i]]);
  for (let c=0;c<3;c++) {
    let mx=c; for(let r=c+1;r<3;r++) if(Math.abs(m[r][c])>Math.abs(m[mx][c]))mx=r;
    [m[c],m[mx]]=[m[mx],m[c]];
    if(Math.abs(m[c][c])<1e-12) return null;
    for(let r=c+1;r<3;r++){ const f=m[r][c]/m[c][c]; for(let j=c;j<=3;j++) m[r][j]-=f*m[c][j]; }
  }
  const x=[0,0,0];
  for(let i=2;i>=0;i--){ x[i]=m[i][3]; for(let j=i+1;j<3;j++) x[i]-=m[i][j]*x[j]; x[i]/=m[i][i]; }
  return x;
}
function fitNS(pts) {          // pts = [{dur, y}], returns {beta[3], tau, rmse}
  if (pts.length < 3) return null;
  let best = null, bestErr = Infinity;
  for (let tau=0.2; tau<=6; tau+=0.1) {
    const AtA=[[0,0,0],[0,0,0],[0,0,0]], Atb=[0,0,0];
    pts.forEach(({dur:t,y}) => {
      const x=t/tau, ex=Math.exp(-x);
      const row=[1,(1-ex)/x,((1-ex)/x)-ex];
      for(let r=0;r<3;r++){ Atb[r]+=row[r]*y; for(let c=0;c<3;c++) AtA[r][c]+=row[r]*row[c]; }
    });
    const beta=solveLS3(AtA,Atb); if(!beta) continue;
    const err=pts.reduce((s,{dur:t,y})=>s+(nsYield(beta,tau,t)-y)**2,0);
    if(err<bestErr){ bestErr=err; best={beta,tau,rmse:Math.sqrt(err/pts.length)}; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// II. CARRY + ROLLDOWN (horizon-aware)
// ─────────────────────────────────────────────────────────────────────────────
function carryRoll(bond, ns, horizonM, cpiPath) {
  const h = Math.min(horizonM, bond._mths) / 12;   // years
  const t0 = bond.dur ?? 3;
  const t1 = Math.max(0.001, t0 - h);

  // Carry: yield accrual
  let carry = 0;
  if (bond.tp==="LECAP") carry = (Math.pow(1+bond.y/100,horizonM)-1)*100;
  else if (bond.tp==="CER") {
    const cumCPI = (Math.pow(1+(cpiPath.slice(0,horizonM).reduce((a,v)=>a+v,0)/Math.min(horizonM,cpiPath.length))/100,horizonM)-1)*100;
    carry = bond.y/100*h*100 + cumCPI;
  } else if (bond.tp==="USD") carry = (bond.coupon??bond.y)/100*h*100;
  else carry = bond.y/100*h*100;

  // Rolldown: move along the fitted curve as bond ages
  let rolldown = 0;
  if (ns && t0 > 0.001) {
    const y0 = nsYield(ns.beta, ns.tau, t0);
    const y1 = nsYield(ns.beta, ns.tau, t1);
    const durEff = bond.dur ?? 1;
    rolldown = -durEff*(y1-y0);   // negative Δy = positive price return
  }

  // Convexity bonus: ½ × D² × σ² × T  (σ ≈ 1% annualised)
  const cvxBonus = 0.5 * (bond.dur??0)**2 * 0.01 * h * 100;

  return {
    carry:   +carry.toFixed(2),
    rolldown:+rolldown.toFixed(2),
    cvx:     +cvxBonus.toFixed(2),
    total:   +(carry+rolldown+cvxBonus).toFixed(2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// III. IMPLIED PD — Duffie-Singleton hazard rate model
// λ = spread / (1−R),  PD_T = 1 − e^{−λ·T}
// Recovery floor: even at 40c, long bonds imply high PD at current yields
// ─────────────────────────────────────────────────────────────────────────────
function pd(y, rf, rec, years) {
  const spread = Math.max(0,(y-rf)/100);
  const lam = spread/(1-rec);
  return { lam:+(lam*100).toFixed(2), pd1:+(1-Math.exp(-lam))*100, pdT:+(1-Math.exp(-lam*years))*100 };
}

// ─────────────────────────────────────────────────────────────────────────────
// IV. AL/GD BASIS  — same maturity, different law
//  GD (NY law) should trade at tighter yield; if AL spread vs GD < 0 → anomaly
// ─────────────────────────────────────────────────────────────────────────────
function alGdBasis(usdBonds) {
  const pairs = [
    {al:"AL29",gd:"GD29"},{al:"AL30",gd:"GD30"},{al:"AL35",gd:"GD35"},
  ];
  return pairs.map(({al,gd}) => {
    const alB = usdBonds.find(b=>b.t===al), gdB = usdBonds.find(b=>b.t===gd);
    if (!alB||!gdB) return null;
    const basisBps = Math.round((alB.y-gdB.y)*100);
    // AL should trade WIDER (higher yield) because NY law has restructuring protections
    // If basis < 150bps → AL is relatively expensive vs historical ~200bps
    const fairBasis = 175;  // rough historical average
    const cheapBps = basisBps - fairBasis; // + = AL cheap vs GD, - = AL expensive
    return { al:alB.t, gd:gdB.t, alY:alB.y, gdY:gdB.y, basisBps, fairBasis, cheapBps };
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// V. DTS — Duration Times Spread  (risk-normalised spread comparison)
// DTS = modified_duration × z_spread
// Higher DTS = more credit risk exposure per unit notional
// ─────────────────────────────────────────────────────────────────────────────
function dts(bond, rf) {
  const spread = Math.max(0, bond.y - rf);
  return +((bond.dur??3) * spread).toFixed(3);
}

// ─────────────────────────────────────────────────────────────────────────────
// VI. COMPOSITE RV SCORE  (per bond, cross-sectional z-score blend)
// ─────────────────────────────────────────────────────────────────────────────
function zScore(arr, val) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a,v)=>a+v,0)/arr.length;
  const std  = Math.sqrt(arr.reduce((a,v)=>a+(v-mean)**2,0)/arr.length);
  return std < 0.001 ? 0 : (val-mean)/std;
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI CHART — SVG bar for inline tables
// ─────────────────────────────────────────────────────────────────────────────
function Bar({ v, max=25, w=72, h=16 }) {
  const clamped = Math.max(-max, Math.min(max, v));
  const mid = w/2, bw = Math.abs(clamped/max)*mid;
  const fill = v>=0 ? C.pos : C.neg;
  return (
    <svg width={w} height={h} style={{verticalAlign:"middle"}}>
      <rect x={0} y={3} width={w} height={h-6} rx={2} fill="#e2e8f0"/>
      <rect x={v>=0?mid:mid-bw} y={3} width={bw} height={h-6} rx={2} fill={fill} opacity={0.8}/>
      <line x1={mid} y1={1} x2={mid} y2={h-1} stroke="#94a3b8" strokeWidth={1}/>
    </svg>
  );
}

// NS curve chart inline
function NSChart({ pts, ns, w=480, h=260, yLabel="Yield %", title="" }) {
  if (!ns || pts.length===0) return <div style={{color:C.muted,fontSize:11,padding:20,textAlign:"center"}}>Insuficientes datos (mín. 3 bonos con duración).</div>;
  const mg={t:30,r:16,b:38,l:48};
  const pw=w-mg.l-mg.r, ph=h-mg.t-mg.b;
  const xs=pts.map(p=>p.dur), ys=pts.map(p=>p.y);
  const xMax=Math.ceil(Math.max(...xs)+0.5), xMin=0;
  const fitYs=Array.from({length:120},(_,i)=>{const t=(i+1)*xMax/120; return {t,y:nsYield(ns.beta,ns.tau,t)};});
  const allY=[...ys,...fitYs.map(f=>f.y)];
  const yMin=Math.floor((Math.min(...allY)-0.5)*2)/2;
  const yMax=Math.ceil((Math.max(...allY)+0.5)*2)/2;
  const px=x=>mg.l+(x-xMin)/(xMax-xMin)*pw;
  const py=y=>mg.t+(1-(y-yMin)/(yMax-yMin))*ph;
  const fitPath=fitYs.map((p,i)=>`${i===0?'M':'L'}${px(p.t).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
  const tY=Array.from({length:6},(_,i)=>+(yMin+(yMax-yMin)*i/5).toFixed(1));
  const tX=Array.from({length:xMax+1},(_,i)=>i);
  return (
    <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible"}}>
      {title&&<text x={w/2} y={20} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.navy}>{title}</text>}
      {tX.map(v=><line key={v} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={0.6}/>)}
      {tY.map((v,i)=><line key={i} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={0.6}/>)}
      <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
      {tX.map(v=><text key={v} x={px(v)} y={mg.t+ph+14} textAnchor="middle" fontSize={8.5} fill={C.muted}>{v}y</text>)}
      {tY.map((v,i)=><text key={i} x={mg.l-5} y={py(v)+3.5} textAnchor="end" fontSize={8.5} fill={C.muted}>{v.toFixed(1)}</text>)}
      <text x={mg.l+pw/2} y={h-4} textAnchor="middle" fontSize={9} fill={C.muted}>Duración (años)</text>
      <text x={11} y={mg.t+ph/2} textAnchor="middle" fontSize={9} fill={C.muted} transform={`rotate(-90,11,${mg.t+ph/2})`}>{yLabel}</text>
      {/* NS curve */}
      <path d={fitPath} fill="none" stroke={C.blue1} strokeWidth={2.5} opacity={0.8}/>
      {/* ±1 RMSE band */}
      {ns.rmse>0&&(()=>{
        const upper=fitYs.map((p,i)=>`${i===0?'M':'L'}${px(p.t).toFixed(1)},${py(p.y+ns.rmse).toFixed(1)}`).join(' ');
        const lower=[...fitYs].reverse().map((p,i)=>`${i===0?'M':'L'}${px(p.t).toFixed(1)},${py(p.y-ns.rmse).toFixed(1)}`).join(' ');
        return <path d={upper+' '+lower+' Z'} fill={C.blue1} opacity={0.07}/>;
      })()}
      {/* Bond dots */}
      {pts.map((p,i)=>{
        const cx=px(p.dur), cy=py(p.y), fY=nsYield(ns.beta,ns.tau,p.dur);
        const cheap=p.y-fY, bps=Math.round(cheap*100);
        const col=bps>20?C.pos:bps<-20?C.neg:bps>5?"#22c55e":bps<-5?"#f87171":C.teal;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={cx} y2={py(fY)} stroke={col} strokeWidth={1.5} strokeDasharray="2 2" opacity={0.7}/>
            <circle cx={cx} cy={cy} r={6} fill={col} stroke="white" strokeWidth={1.5}/>
            <text x={cx+8} y={cy+4} fontSize={8.5} fontWeight={800} fill={col}>{p.t}</text>
            <text x={cx+8} y={cy+14} fontSize={7.5} fill={col} opacity={0.85}>{bps>=0?'+':''}{bps}bp</text>
          </g>
        );
      })}
      {/* Legend */}
      <path d="M10,250 L28,250" stroke={C.blue1} strokeWidth={2.5} style={{}}/>
      <text x={32} y={254} fontSize={8} fill={C.blue1}>NS fit</text>
      <circle cx={72} cy={250} r={4} fill={C.pos} stroke="white" strokeWidth={1}/>
      <text x={79} y={254} fontSize={8} fill={C.pos}>barato</text>
      <circle cx={112} cy={250} r={4} fill={C.neg} stroke="white" strokeWidth={1}/>
      <text x={119} y={254} fontSize={8} fill={C.neg}>caro</text>
    </svg>
  );
}

// Gauge-style meter (−100 to +100)
function Gauge({ score, size=56 }) {
  const col = score>35?C.pos:score>10?"#22c55e":score<-35?C.neg:score<-10?"#f87171":C.teal;
  const angle = (score/100)*120; // ±120°
  const rad = (deg) => deg*Math.PI/180;
  const r=20, cx=size/2, cy=size*0.65;
  const startDeg=-120+90, endDeg=startDeg+240; // arc from -120 to +120 deg (relative to SVG)
  const arcStart = { x:cx+r*Math.cos(rad(-120+90)), y:cy+r*Math.sin(rad(-120+90)) };
  const arcEnd   = { x:cx+r*Math.cos(rad(120+90)),  y:cy+r*Math.sin(rad(120+90))  };
  // Needle
  const needleDeg = angle + 90;
  const nx = cx + (r-2)*Math.cos(rad(needleDeg));
  const ny = cy + (r-2)*Math.sin(rad(needleDeg));
  return (
    <svg width={size} height={size*0.72} style={{display:"block",margin:"0 auto"}}>
      <path d={`M${arcStart.x},${arcStart.y} A${r},${r} 0 1 1 ${arcEnd.x},${arcEnd.y}`}
        fill="none" stroke="#e2e8f0" strokeWidth={4} strokeLinecap="round"/>
      <path d={`M${arcStart.x},${arcStart.y} A${r},${r} 0 1 1 ${nx},${ny}`}
        fill="none" stroke={col} strokeWidth={4} strokeLinecap="round" opacity={0.85}/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={col} strokeWidth={2} strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={3} fill={col}/>
      <text x={cx} y={cy+14} textAnchor="middle" fontSize={9} fontWeight={800} fill={col}>{score>0?'+':''}{score}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AnalysisTab({ bonds, scens, horizon, currentBCS }) {
  const [rf,      setRf]      = useState(4.30);  // US 10Y risk-free
  const [rec,     setRec]     = useState(40);    // recovery rate %
  const [pdT,     setPdT]     = useState(3);     // PD horizon years
  const [section, setSection] = useState("all");

  const cpiPath  = scens.BASE?.cpiPath ?? Array(24).fill(2.5);
  const NOW = new Date("2026-03-12");
  const mths = ds => Math.max(0.001,(new Date(ds)-NOW)/(30.44*86400000));

  // ── bond slices ─────────────────────────────────────────────────────────
  const cerAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="CER"&&(b.dur??0)>0),[bonds]);
  const gdAct   = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="USD"&&b.t.startsWith("GD")&&(b.dur??0)>0),[bonds]);
  const usdAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="USD"),[bonds]);
  const lecAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="LECAP"),[bonds]);
  const allAct  = useMemo(()=>bonds.filter(b=>b.active&&(b.dur??0)>0),[bonds]);

  // ── NS fits ─────────────────────────────────────────────────────────────
  const nsCER = useMemo(()=>fitNS(cerAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))),  [cerAct]);
  const nsGD  = useMemo(()=>fitNS(gdAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))),   [gdAct]);

  // ── CER richness/cheapness ───────────────────────────────────────────────
  const cerRV = useMemo(()=>{
    if (!nsCER) return [];
    return cerAct.map(b=>{
      const fitted = nsYield(nsCER.beta, nsCER.tau, b.dur);
      const cheapBps = Math.round((b.y - fitted)*100);
      const cr = carryRoll({...b, _mths:mths(b.m)}, nsCER, horizon, cpiPath);
      return {...b, fitted:+fitted.toFixed(3), cheapBps, cr};
    }).map((b, _, arr)=>{
      // cross-sectional z-scores for scoring
      const zC = zScore(arr.map(x=>x.cheapBps), b.cheapBps);
      const zR = zScore(arr.map(x=>x.cr.total), b.cr.total);
      const score = Math.round(zC*40 + zR*60);   // carry-roll weighted more
      return {...b, score};
    }).sort((a,z)=>z.score-a.score);
  }, [cerAct, nsCER, horizon, cpiPath]);

  // ── USD richness/cheapness ───────────────────────────────────────────────
  const usdRV = useMemo(()=>{
    return usdAct.map(b=>{
      const stype = b.t.startsWith("BP")?"BOPREAL":b.t.startsWith("AL")||b.t.startsWith("AE")?"BONAR":"GLOBAL";
      const fitted = nsGD ? nsYield(nsGD.beta, nsGD.tau, b.dur??3) : b.y;
      const cheapBps = Math.round((b.y - fitted)*100);
      const cr = carryRoll({...b, _mths:mths(b.m)}, nsGD, horizon, cpiPath);
      const p = pd(b.y, rf, rec/100, pdT);
      const dtsVal = dts(b, rf);
      return {...b, stype, fitted:+fitted.toFixed(3), cheapBps, cr, pd:p, dts:dtsVal};
    }).map((b,_,arr)=>{
      const zC = zScore(arr.map(x=>x.cheapBps), b.cheapBps);
      const zR = zScore(arr.map(x=>x.cr.total), b.cr.total);
      const score = Math.round(zC*45 + zR*55);
      return {...b, score};
    });
  }, [usdAct, nsGD, horizon, cpiPath, rf, rec, pdT]);

  // ── all carry-roll ───────────────────────────────────────────────────────
  const crAll = useMemo(()=>{
    return allAct.map(b=>{
      const ns = b.tp==="CER"?nsCER:b.tp==="USD"?nsGD:null;
      return {...b, cr:carryRoll({...b,_mths:mths(b.m)}, ns, horizon, cpiPath)};
    }).sort((a,z)=>z.cr.total-a.cr.total);
  }, [allAct, nsCER, nsGD, horizon, cpiPath]);

  // ── AL/GD basis ──────────────────────────────────────────────────────────
  const basis = useMemo(()=>alGdBasis(usdAct),[usdAct]);

  // ── CER vs LECAP BE matrix ───────────────────────────────────────────────
  const beMatrix = useMemo(()=>{
    const cer = cerAct.slice().sort((a,z)=>(a.dur??0)-(z.dur??0));
    const lec = lecAct.slice().sort((a,z)=>mths(a.m)-mths(z.m));
    const avgCPI = (scens.BASE?.cpiPath??Array(24).fill(2.5)).slice(0,horizon).reduce((a,v)=>a+v,0)/Math.min(horizon,24);
    const exitBCS = scens.BASE?.exitBCS??1554, bcs=currentBCS??1447;
    return {cer, lec, avgCPI, exitBCS, bcs};
  }, [cerAct, lecAct, horizon, scens, currentBCS]);

  // ─────────── Helpers ─────────────────────────────────────────────────────
  const TH = s => ({padding:"6px 9px",textAlign:s||"center",fontWeight:600,fontSize:9.5,color:C.muted,borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"});
  const TD = s => ({padding:"6px 9px",textAlign:s||"center",fontSize:10.5});
  const scoreCol = v => v>30?C.pos:v>10?"#22c55e":v<-30?C.neg:v<-10?"#f87171":C.muted;
  const bpsCol   = v => v>20?C.pos:v>5?"#22c55e":v<-20?C.neg:v<-5?"#f87171":C.muted;
  const stypeCol = s=>({BOPREAL:"#0f766e",BONAR:"#7c3aed",GLOBAL:"#166534"}[s]??C.muted);
  const SectionBtn = ({id,label}) => (
    <button onClick={()=>setSection(p=>p===id?"all":id)}
      style={{padding:"5px 14px",borderRadius:20,border:section===id?`2px solid ${C.blue1}`:`1px solid ${C.border}`,
        cursor:"pointer",fontWeight:700,fontSize:11,
        background:section===id?C.blue1:C.card, color:section===id?C.white:C.muted}}>
      {label}
    </button>
  );
  const show = id => section==="all"||section===id;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* ─── CONTROLES ──────────────────────────────────────────────────── */}
      <div style={{...card,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontWeight:800,fontSize:15,color:C.navy}}>🔬 Valuación Relativa Cuantitativa</div>
          <div style={{fontSize:10,color:C.muted,marginTop:2}}>Nelson-Siegel · Carry-Rolldown · Implied PD · AL/GD Basis · DTS · Breakeven Matrix</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {[["ns","I. NS Curves"],["cr","II. Carry-Roll"],["pd","III. Implied PD"],["basis","IV. AL/GD Basis"],["be","V. BE Matrix"]].map(([id,lbl])=>(
            <SectionBtn key={id} id={id} label={lbl}/>
          ))}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {[["US 10Y rf",rf,setRf,"blue1","%",0.1],["Recovery",rec,setRec,"teal","%",5],["PD años",pdT,setPdT,"salmon","y",1]].map(([lbl,val,set,col,sfx,step])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:4,background:C.bg,borderRadius:7,padding:"5px 9px"}}>
              <span style={{fontSize:9,color:C.muted}}>{lbl}:</span>
              <input type="number" step={step} value={val} onChange={e=>set(+e.target.value||val)}
                style={{width:36,border:"none",background:"transparent",fontWeight:700,fontSize:12,color:C[col],textAlign:"right"}}/>
              <span style={{fontSize:9,color:C.muted}}>{sfx}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── I. NELSON-SIEGEL ───────────────────────────────────────────── */}
      {show("ns") && <>

        {/* I-A: CER */}
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <div>
              <span style={{color:C.white,fontWeight:800,fontSize:13}}>I-A · Nelson-Siegel CER — Richness / Cheapness</span>
              {nsCER&&<span style={{color:C.blue2,fontSize:10,marginLeft:10}}>β₀={nsCER.beta[0].toFixed(2)}% · β₁={nsCER.beta[1].toFixed(2)}% · β₂={nsCER.beta[2].toFixed(2)}% · τ={nsCER.tau.toFixed(2)}y · RMSE={nsCER.rmse.toFixed(2)}%</span>}
            </div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.45)"}}>Verde = barato vs curva ajustada · Rojo = caro · bps = yield − NS fitted</div>
          </div>
          <div style={{padding:16,display:"flex",gap:20,flexWrap:"wrap"}}>
            <NSChart pts={cerAct.map(b=>({...b}))} ns={nsCER} w={480} h={260} yLabel="Tasa real %" title="Curva CER ajustada (Nelson-Siegel)"/>
            <div style={{flex:1,minWidth:310,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#f1f5f9"}}>
                    {["Bono","Dur","Real","NS fit","Δ bps","C","R","D","C+R","Score"].map(h=>(
                      <th key={h} style={TH()}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cerRV.map((b,i)=>(
                    <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{...TD("left"),fontWeight:800,color:"#0d9488"}}>{b.t}</td>
                      <td style={TD()}>{b.dur}y</td>
                      <td style={{...TD(),fontWeight:700,color:"#0d9488"}}>{b.y.toFixed(2)}%</td>
                      <td style={{...TD(),color:C.blue1}}>{b.fitted.toFixed(2)}%</td>
                      <td style={TD()}>
                        <span style={{fontWeight:800,color:bpsCol(b.cheapBps)}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</span>
                        <Bar v={b.cheapBps} max={200}/>
                      </td>
                      <td style={{...TD(),color:C.muted,fontSize:9.5}}>{b.cr.carry.toFixed(1)}</td>
                      <td style={{...TD(),color:b.cr.rolldown>=0?C.pos:C.neg,fontWeight:600,fontSize:9.5}}>{b.cr.rolldown>=0?"+":""}{b.cr.rolldown.toFixed(1)}</td>
                      <td style={{...TD(),color:C.muted,fontSize:9.5}}>{b.cr.cvx.toFixed(2)}</td>
                      <td style={{...TD(),fontWeight:700,color:b.cr.total>=0?C.pos:C.neg}}>{b.cr.total>=0?"+":""}{b.cr.total.toFixed(1)}%</td>
                      <td style={TD()}>
                        <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                          <Gauge score={Math.max(-99,Math.min(99,b.score))} size={48}/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{padding:"5px 10px",fontSize:8.5,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
                <b>C</b>=Carry% · <b>R</b>=Rolldown% · <b>D</b>=Convexity bonus% · <b>Score</b>=40%·z(Δbps)+60%·z(C+R) · NS: y(t)=β₀+β₁φ₁+β₂φ₂
              </div>
            </div>
          </div>
        </div>

        {/* I-B: Globales */}
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <div>
              <span style={{color:C.white,fontWeight:800,fontSize:13}}>I-B · Nelson-Siegel Globales — Bonares & Bopreales vs curva NY Law</span>
              {nsGD&&<span style={{color:C.blue2,fontSize:10,marginLeft:10}}>β₀={nsGD.beta[0].toFixed(2)}% · β₁={nsGD.beta[1].toFixed(2)}% · β₂={nsGD.beta[2].toFixed(2)}% · τ={nsGD.tau.toFixed(2)}y · RMSE={nsGD.rmse.toFixed(2)}%</span>}
            </div>
            <div style={{fontSize:9,color:"rgba(255,255,255,.45)"}}>NS calibrada sólo en Globales · Bonares y Bopreales se plotean vs esa curva</div>
          </div>
          <div style={{padding:16,display:"flex",gap:20,flexWrap:"wrap"}}>
            <NSChart pts={gdAct} ns={nsGD} w={480} h={260} yLabel="Yield USD %" title="Globales — Nelson-Siegel"/>
            <div style={{flex:1,minWidth:320,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#f1f5f9"}}>
                    {["Bono","Serie","Dur","Yield","NS fit","Δ bps","DTS","C+R","PD1y","PDT","Score"].map(h=>(
                      <th key={h} style={TH()}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["BOPREAL","BONAR","GLOBAL"]).flatMap(st=>{
                    const grp=usdRV.filter(b=>b.stype===st);
                    if(!grp.length) return [];
                    return [
                      <tr key={"h"+st} style={{background:stypeCol(st)+"12"}}>
                        <td colSpan={11} style={{padding:"5px 12px",fontWeight:800,fontSize:10.5,color:stypeCol(st),borderLeft:`4px solid ${stypeCol(st)}`}}>
                          ── {st==="BOPREAL"?"Bopreales":st==="BONAR"?"Bonares":"Globales"}
                        </td>
                      </tr>,
                      ...grp.sort((a,z)=>(a.dur??0)-(z.dur??0)).map((b,i)=>(
                        <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${stypeCol(b.stype)}30`}}>
                          <td style={{...TD("left"),fontWeight:800,color:stypeCol(b.stype)}}>{b.t}</td>
                          <td style={TD()}><span style={{display:"inline-block",padding:"1px 6px",borderRadius:10,fontSize:8.5,fontWeight:700,color:stypeCol(b.stype),background:stypeCol(b.stype)+"18"}}>{b.stype}</span></td>
                          <td style={{...TD(),color:C.muted}}>{(b.dur??3).toFixed(1)}y</td>
                          <td style={{...TD(),fontWeight:700}}>{b.y.toFixed(2)}%</td>
                          <td style={{...TD(),color:C.blue1}}>{b.fitted.toFixed(2)}%</td>
                          <td style={TD()}>
                            <span style={{fontWeight:800,color:bpsCol(b.cheapBps)}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</span>
                          </td>
                          <td style={{...TD(),color:C.muted,fontSize:9.5}}>{b.dts.toFixed(2)}</td>
                          <td style={{...TD(),fontWeight:700,color:b.cr.total>=0?C.pos:C.neg}}>{b.cr.total>=0?"+":""}{b.cr.total.toFixed(1)}%</td>
                          <td style={{...TD(),color:b.pd.pd1>30?C.neg:b.pd.pd1>18?"#f97316":C.muted,fontSize:9.5}}>{b.pd.pd1.toFixed(0)}%</td>
                          <td style={{...TD(),fontWeight:700,color:b.pd.pdT>50?C.neg:b.pd.pdT>30?"#f97316":C.pos,fontSize:11}}>{b.pd.pdT.toFixed(0)}%</td>
                          <td style={TD()}>
                            <Gauge score={Math.max(-99,Math.min(99,b.score))} size={44}/>
                          </td>
                        </tr>
                      ))
                    ];
                  })}
                </tbody>
              </table>
              <div style={{padding:"5px 10px",fontSize:8.5,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
                <b>DTS</b>=Duration×Spread · <b>PD1y</b>=Prob.Default 1 año · <b>PDT</b>=PD acum en {pdT}y · λ=spread/(1−R) · R={rec}%
              </div>
            </div>
          </div>
        </div>
      </>}

      {/* ─── II. CARRY-ROLLDOWN RANKING ─────────────────────────────────── */}
      {show("cr") && (
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>II · Ranking Carry + Rolldown ({horizon}m) — Todos los bonos</span>
            <span style={{color:C.blue2,fontSize:10,marginLeft:10}}>Carry = accrual a horizonte · Rolldown = bond envejece en curva NS · Convexity = ½D²σ²T</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#f1f5f9"}}>
                  {["#","Bono","Tipo","Dur","Carry","Rolldown","Conv.","C+R+D","Barra"].map(h=>(
                    <th key={h} style={TH()}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crAll.map((b,i)=>{
                  const tCol={LECAP:"#0369a1",CER:"#0d9488",TAMAR:"#7c3aed",BADLAR:"#9f1239",USD:"#166534"}[b.tp]??C.muted;
                  return (
                    <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={TD()}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",
                          background:i<3?[C.blue2,"#22c55e","#eab308"][i]:C.border,fontSize:9,fontWeight:700,color:i<3?C.white:C.muted}}>{i+1}</span>
                      </td>
                      <td style={{...TD("left"),fontWeight:800,color:tCol}}>{b.t}</td>
                      <td style={TD()}><span style={{padding:"1px 7px",borderRadius:12,fontSize:9,fontWeight:700,color:tCol,background:tCol+"18"}}>{b.tp}</span></td>
                      <td style={{...TD(),color:C.muted,fontSize:9.5}}>{(b.dur??0).toFixed(2)}y</td>
                      <td style={{...TD(),color:C.muted}}>{b.cr.carry.toFixed(1)}%</td>
                      <td style={{...TD(),fontWeight:600,color:b.cr.rolldown>=0?C.pos:C.neg}}>{b.cr.rolldown>=0?"+":""}{b.cr.rolldown.toFixed(1)}%</td>
                      <td style={{...TD(),color:C.muted,fontSize:9.5}}>+{b.cr.cvx.toFixed(2)}%</td>
                      <td style={{...TD(),fontWeight:800,fontSize:13,color:b.cr.total>=15?C.pos:b.cr.total>=0?C.teal:C.neg}}>
                        {b.cr.total>=0?"+":""}{b.cr.total.toFixed(1)}%
                      </td>
                      <td style={TD()}><Bar v={b.cr.total} max={45}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── III. IMPLIED PD ────────────────────────────────────────────── */}
      {show("pd") && (
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>III · Implied Probability of Default — USD Bonds</span>
            <span style={{color:C.blue2,fontSize:10}}>Duffie-Singleton: λ=spread/(1−R) · PD_T=1−e^(−λ·T) · rf={rf}% · R={rec}% · T={pdT}y</span>
          </div>
          {/* Waterfall visual */}
          {(()=>{
            const data = usdRV.sort((a,z)=>a.pd.pdT-z.pd.pdT);
            const w=1080, h=240, mg={t:30,r:20,b:60,l:55};
            const pw=w-mg.l-mg.r, ph=h-mg.t-mg.b;
            const bw=Math.min(38, pw/data.length-6);
            const maxPD=Math.min(100, Math.ceil(Math.max(...data.map(d=>d.pd.pdT))/10+1)*10);
            const py=v=>mg.t+(1-v/maxPD)*ph;
            return (
              <div style={{padding:"12px 16px"}}>
                <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible",display:"block"}}>
                  {[0,25,50,75,100].filter(v=>v<=maxPD).map(v=>(
                    <g key={v}>
                      <line x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={v===0?1.5:0.7}/>
                      <text x={mg.l-5} y={py(v)+4} textAnchor="end" fontSize={9} fill={C.muted}>{v}%</text>
                    </g>
                  ))}
                  <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
                  <text x={mg.l+pw/2} y={h-10} textAnchor="middle" fontSize={9.5} fill={C.muted}>Bonos ordenados por PD acumulada</text>
                  <text x={11} y={mg.t+ph/2} textAnchor="middle" fontSize={9.5} fill={C.muted} transform={`rotate(-90,11,${mg.t+ph/2})`}>PD acum {pdT}y (%)</text>
                  {data.map((b,i)=>{
                    const cx=mg.l+(i+0.5)*pw/data.length;
                    const col=b.pd.pdT>60?C.neg:b.pd.pdT>40?"#f97316":b.pd.pdT>25?"#eab308":C.pos;
                    const y1=py(b.pd.pd1), yT=py(b.pd.pdT);
                    return (
                      <g key={b.id}>
                        {/* PD T bar */}
                        <rect x={cx-bw/2} y={yT} width={bw} height={py(0)-yT} rx={3} fill={col} opacity={0.75}/>
                        {/* PD 1y marker */}
                        <rect x={cx-bw/2} y={y1-1.5} width={bw} height={3} fill="white" opacity={0.9}/>
                        {/* Labels */}
                        <text x={cx} y={yT-4} textAnchor="middle" fontSize={8} fontWeight={700} fill={col}>{b.pd.pdT.toFixed(0)}%</text>
                        <text x={cx} y={py(0)+13} textAnchor="middle" fontSize={8.5} fontWeight={800} fill={stypeCol(b.stype)}>{b.t}</text>
                        <text x={cx} y={py(0)+23} textAnchor="middle" fontSize={7.5} fill={C.muted}>{b.y.toFixed(1)}%</text>
                        <text x={cx} y={py(0)+33} textAnchor="middle" fontSize={7} fill={C.muted}>λ={b.pd.lam}%</text>
                      </g>
                    );
                  })}
                  {/* Legend */}
                  <rect x={mg.l+pw-200} y={mg.t+4} width={12} height={12} fill={C.pos} rx={2}/>
                  <text x={mg.l+pw-184} y={mg.t+13} fontSize={8.5} fill={C.muted}>PD acum {pdT}y (barra)</text>
                  <rect x={mg.l+pw-200} y={mg.t+20} width={12} height={3} fill="white" style={{outline:`1px solid ${C.border}`}}/>
                  <text x={mg.l+pw-184} y={mg.t+24} fontSize={8.5} fill={C.muted}>PD 1 año</text>
                </svg>
                <div style={{fontSize:9,color:C.muted,marginTop:6}}>
                  Faja blanca dentro de la barra = PD 1 año. Barra completa = PD acumulada a {pdT} años. Rojo {'>'} 60%, naranja {'>'} 40%, amarillo {'>'} 25%, verde {'<'} 25%.
                  Modelo simplifica al asumir hazard rate constante y recovery flat. Usar como señal ordinal, no como estimador absoluto.
                </div>
              </div>
            );
          })()}
          {/* DTS table */}
          <div style={{overflowX:"auto",borderTop:`1px solid ${C.border}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  {["Bono","Serie","Dur","Yield","Spread rf","λ hazard","PD 1y","PD acum","DTS","Cheapness vs NS"].map(h=>(
                    <th key={h} style={TH()}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usdRV.sort((a,z)=>a.pd.pdT-z.pd.pdT).map((b,i)=>(
                  <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${stypeCol(b.stype)}30`}}>
                    <td style={{...TD("left"),fontWeight:800,color:stypeCol(b.stype)}}>{b.t}</td>
                    <td style={TD()}><span style={{padding:"1px 6px",borderRadius:10,fontSize:8.5,fontWeight:700,color:stypeCol(b.stype),background:stypeCol(b.stype)+"18"}}>{b.stype}</span></td>
                    <td style={{...TD(),color:C.muted}}>{(b.dur??3).toFixed(1)}y</td>
                    <td style={{...TD(),fontWeight:700}}>{b.y.toFixed(2)}%</td>
                    <td style={{...TD(),color:C.muted}}>{(b.y-rf).toFixed(2)}%</td>
                    <td style={{...TD(),color:C.salmon,fontWeight:600}}>{b.pd.lam.toFixed(2)}%</td>
                    <td style={{...TD(),color:b.pd.pd1>30?C.neg:b.pd.pd1>18?"#f97316":C.teal,fontWeight:700}}>{b.pd.pd1.toFixed(1)}%</td>
                    <td style={{...TD(),fontWeight:800,fontSize:13,color:b.pd.pdT>60?C.neg:b.pd.pdT>40?"#f97316":b.pd.pdT>25?"#eab308":C.pos}}>{b.pd.pdT.toFixed(0)}%</td>
                    <td style={{...TD(),color:C.muted,fontWeight:600}}>{b.dts.toFixed(2)}</td>
                    <td style={TD()}><span style={{fontWeight:800,color:bpsCol(b.cheapBps)}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── IV. AL/GD BASIS ────────────────────────────────────────────── */}
      {show("basis") && (
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>IV · Basis AL vs GD — Ley Argentina vs NY Law</span>
            <span style={{color:C.blue2,fontSize:10,marginLeft:10}}>Basis = yield(AL) − yield(GD) · AL debería cotizar MÁS ANCHO por menor protección legal · Fair basis ≈ 150–200bps histórico</span>
          </div>
          <div style={{padding:16,display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start"}}>
            {/* Visual */}
            {(()=>{
              const w=400,h=200,mg={t:24,r:16,b:36,l:55};
              const pw=w-mg.l-mg.r, ph=h-mg.t-mg.b;
              if(basis.length===0) return <div style={{color:C.muted,fontSize:11,padding:20}}>Activar pares AL/GD.</div>;
              const allY=[...basis.map(b=>b.alY),...basis.map(b=>b.gdY)];
              const yMin=Math.floor(Math.min(...allY)-0.5), yMax=Math.ceil(Math.max(...allY)+0.5);
              const x0=30, gap=pw/(basis.length);
              const py=v=>mg.t+(1-(v-yMin)/(yMax-yMin))*ph;
              return (
                <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible"}}>
                  <text x={w/2} y={16} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.navy}>Yields AL vs GD por vencimiento</text>
                  {[yMin,yMin+1,yMin+2,yMin+3,yMax].filter((v,i,a)=>a.indexOf(v)===i&&v<=yMax).map(v=>(
                    <g key={v}><line x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={0.7}/>
                    <text x={mg.l-5} y={py(v)+3.5} textAnchor="end" fontSize={8.5} fill={C.muted}>{v}%</text></g>
                  ))}
                  <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
                  {basis.map((b,i)=>{
                    const cx=mg.l+(i+0.5)*gap;
                    const alY=py(b.alY), gdY=py(b.gdY);
                    const col=b.cheapBps>0?C.pos:C.neg;
                    return (
                      <g key={i}>
                        <line x1={cx} y1={Math.min(alY,gdY)} x2={cx} y2={Math.max(alY,gdY)} stroke={col} strokeWidth={2.5} strokeDasharray="4 2"/>
                        <circle cx={cx-8} cy={alY} r={7} fill="#7c3aed" stroke="white" strokeWidth={1.5}/>
                        <circle cx={cx+8} cy={gdY} r={7} fill="#166534" stroke="white" strokeWidth={1.5}/>
                        <text x={cx-8} y={alY+4} textAnchor="middle" fontSize={6.5} fill="white" fontWeight={700}>{b.al.slice(2)}</text>
                        <text x={cx+8} y={gdY+4} textAnchor="middle" fontSize={6.5} fill="white" fontWeight={700}>{b.gd.slice(2)}</text>
                        <text x={cx} y={Math.min(alY,gdY)-6} textAnchor="middle" fontSize={8} fontWeight={800} fill={col}>{b.basisBps}bp</text>
                      </g>
                    );
                  })}
                  <circle cx={mg.l+4} cy={h-12} r={5} fill="#7c3aed" stroke="white" strokeWidth={1}/>
                  <text x={mg.l+12} y={h-8} fontSize={8} fill="#7c3aed">Bonar (AL)</text>
                  <circle cx={mg.l+68} cy={h-12} r={5} fill="#166534" stroke="white" strokeWidth={1}/>
                  <text x={mg.l+76} y={h-8} fontSize={8} fill="#166534">Global (GD)</text>
                </svg>
              );
            })()}
            {/* Table */}
            <div style={{flex:1,minWidth:300}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead>
                  <tr style={{background:"#f1f5f9"}}>
                    {["Par","Yield AL","Yield GD","Basis actual","Fair basis","Δ vs fair","Lectura"].map(h=>(
                      <th key={h} style={TH()}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {basis.length>0 ? basis.map((b,i)=>(
                    <tr key={i} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{...TD("left"),fontWeight:800}}><span style={{color:"#7c3aed"}}>{b.al}</span> / <span style={{color:"#166534"}}>{b.gd}</span></td>
                      <td style={{...TD(),color:"#7c3aed",fontWeight:700}}>{b.alY.toFixed(2)}%</td>
                      <td style={{...TD(),color:"#166534",fontWeight:700}}>{b.gdY.toFixed(2)}%</td>
                      <td style={{...TD(),fontWeight:800,fontSize:13,color:b.basisBps>200?C.pos:b.basisBps<100?C.neg:"#eab308"}}>{b.basisBps}bps</td>
                      <td style={{...TD(),color:C.muted}}>{b.fairBasis}bps</td>
                      <td style={{...TD(),fontWeight:800,color:b.cheapBps>0?C.pos:C.neg}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bps</td>
                      <td style={{...TD("left"),fontSize:9.5,color:b.cheapBps>30?C.pos:b.cheapBps<-30?C.neg:C.muted}}>
                        {b.cheapBps>50?"AL barato vs GD":b.cheapBps>0?"AL levemente barato":b.cheapBps>-50?"AL levemente caro":"AL caro vs GD — anomalía"}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>Activar pares AL29/GD29, AL30/GD30, AL35/GD35</td></tr>
                  )}
                </tbody>
              </table>
              <div style={{padding:"6px 10px",fontSize:8.5,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
                AL (ley argentina) debería cotizar con spread POSITIVO vs GD (NY law) porque los GD tienen más protecciones legales al acreedor.
                Basis {'<'} 100bps → AL relativamente caro. Basis {'>'} 200bps → AL relativamente barato. Fair basis estimado en ~175bps (promedio histórico post-reestructura).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── V. CER vs LECAP BREAKEVEN MATRIX ──────────────────────────── */}
      {show("be") && (
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>V · Matriz Breakeven — CER vs LECAP (CPI mensual mínimo)</span>
            <span style={{color:C.blue2,fontSize:10}}>
              Verde = CER ya gana con el CPI BASE ({beMatrix.avgCPI.toFixed(2)}%/m) · Rojo = necesita más inflación ·
              Celdas = CPI mínimo para que CER supere al LECAP en ret. USD (escenario BASE)
            </span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  <th style={{...TH("left"),minWidth:120}}>CER ↓ \ LECAP →</th>
                  {beMatrix.lec.map(lb=>(
                    <th key={lb.id} style={TH()}>
                      <div style={{fontWeight:800,color:"#0369a1"}}>{lb.t}</div>
                      <div style={{fontSize:8,fontWeight:400,color:C.muted}}>{lb.y.toFixed(2)}% TEM</div>
                    </th>
                  ))}
                  <th style={{...TH(),borderLeft:`2px solid ${C.blue1}30`}}>Base CPI<br/><span style={{fontSize:8,fontWeight:400}}>{beMatrix.avgCPI.toFixed(2)}%/m</span></th>
                </tr>
              </thead>
              <tbody>
                {beMatrix.cer.map((cb,i)=>{
                  const t0cb = mths(cb.m);
                  const avgBaseCPI = beMatrix.avgCPI;
                  return (
                    <tr key={cb.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{...TD("left"),fontWeight:800,color:"#0d9488",borderLeft:`4px solid #0d948840`}}>
                        <div>{cb.t}</div>
                        <div style={{fontSize:8.5,color:C.muted,fontWeight:400}}>{cb.y.toFixed(2)}% real · {cb.dur}y dur</div>
                      </td>
                      {beMatrix.lec.map(lb=>{
                        const t0lb = mths(lb.m);
                        const h = Math.min(horizon, t0cb, t0lb);
                        const ey = cb.exitYields?.BASE ?? cb.y;
                        const carry = Math.pow(1+cb.y/100,h/12)-1;
                        const priceChg = -(cb.dur??1)*(ey-cb.y)/100;
                        const lecP0 = 100/Math.pow(1+lb.y/100,t0lb);
                        const lecEY = lb.exitYields?.BASE??lb.y;
                        const lecP1 = 100/Math.pow(1+lecEY/100,Math.max(0,t0lb-h));
                        const lecRet = (lecP1/lecP0)*(beMatrix.exitBCS/beMatrix.bcs)-1;
                        const num = (1+lecRet)*(beMatrix.exitBCS/beMatrix.bcs);
                        const denom = (1+carry)*(1+priceChg);
                        const cumCPI = num/denom-1;
                        const be = cumCPI>-1 ? +((Math.pow(1+cumCPI,1/Math.max(1,h))-1)*100).toFixed(2) : null;
                        const beats = be!==null && be<=avgBaseCPI;
                        const far = be!==null && be>avgBaseCPI*1.5;
                        return (
                          <td key={lb.id} style={{...TD(),
                            background:beats?"#dcfce7":far?"#fef2f2":"transparent",
                            borderLeft:`1px solid ${C.border}`}}>
                            {be!==null
                              ? <div style={{fontWeight:800,fontSize:12,color:beats?C.pos:far?C.neg:"#f97316"}}>{be}%</div>
                              : <span style={{color:C.muted}}>n/a</span>}
                            {be!==null&&<div style={{fontSize:7.5,color:C.muted}}>{beats?"✓ gana":"✗ necesita más"}</div>}
                          </td>
                        );
                      })}
                      <td style={{...TD(),borderLeft:`2px solid ${C.blue1}30`,fontSize:9.5,color:C.blue1,fontWeight:700}}>
                        {avgBaseCPI.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            Cada celda = CPI mensual mínimo (flat) para que el retorno USD del CER supere al LECAP en escenario BASE.
            Verde = ya gana con CPI base ({beMatrix.avgCPI.toFixed(2)}%/m). Rojo intenso = necesita {'>'} 1.5× el CPI esperado. Usa exit BCS y exit yields del escenario BASE.
          </div>
        </div>
      )}

      {/* ─── NOTA METODOLÓGICA ──────────────────────────────────────────── */}
      <div style={{background:C.card,borderRadius:10,padding:"12px 16px",borderLeft:`4px solid ${C.blue2}`,fontSize:10.5,color:C.muted,lineHeight:1.85}}>
        <strong style={{color:C.blue1,display:"block",marginBottom:4}}>📐 Nota metodológica</strong>
        <strong>Nelson-Siegel:</strong> y(t)=β₀+β₁·(1−e^(−t/τ))/(t/τ)+β₂·[(1−e^(−t/τ))/(t/τ)−e^(−t/τ)]. Grid search sobre τ∈[0.2, 6], OLS sobre parámetros. RMSE indica calidad del ajuste. Δbps=yield observada−NS fitted; +bps=barato, −bps=caro.{" "}
        <strong>Carry-Rolldown:</strong> Carry=accrual de yield a horizonte; Rolldown=−dur×(y(t−h)−y(t)) usando la curva NS; Convexity=½·D²·σ²·T con σ=1%/año.{" "}
        <strong>Implied PD:</strong> Modelo hazard rate estacionario: λ=spread/(1−R), PD_T=1−e^(−λ·T). No captura structure temporal del crédito; útil para ranking relativo.{" "}
        <strong>AL/GD Basis:</strong> Spread entre ley argentina y NY law. Fair value ~150–200bps histórico post-reestructura. Basis comprimido sugiere AL caro.{" "}
        <strong>Score RV:</strong> Z-score cross-seccional: 40–45%·z(cheapness) + 55–60%·z(C+R). No es recomendación de inversión.
      </div>

    </div>
  );
}
