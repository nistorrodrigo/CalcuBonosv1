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
// I. NELSON-SIEGEL   y(t) = β0 + β1·φ1(t) + β2·φ2(t)
// ─────────────────────────────────────────────────────────────────────────────
function nsYield(beta, tau, t) {
  if (t < 0.001) return beta[0] + beta[1];
  const x = t / tau, ex = Math.exp(-x);
  return beta[0] + beta[1]*(1-ex)/x + beta[2]*((1-ex)/x - ex);
}
function solveLS3(AtA, Atb) {
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
function fitNS(pts) {
  if (!pts || pts.length < 3) return null;
  let best = null, bestErr = Infinity;
  for (let tau=0.2; tau<=6; tau+=0.1) {
    const AtA=[[0,0,0],[0,0,0],[0,0,0]], Atb=[0,0,0];
    pts.forEach(({dur:t,y}) => {
      if(!t||t<0.001) return;
      const x=t/tau, ex=Math.exp(-x);
      const row=[1,(1-ex)/x,((1-ex)/x)-ex];
      for(let r=0;r<3;r++){ Atb[r]+=row[r]*y; for(let c=0;c<3;c++) AtA[r][c]+=row[r]*row[c]; }
    });
    const beta=solveLS3(AtA,Atb); if(!beta) continue;
    const vp = pts.filter(p=>p.dur>0.001);
    const err=vp.reduce((s,{dur:t,y})=>s+(nsYield(beta,tau,t)-y)**2,0);
    if(err<bestErr){ bestErr=err; best={beta,tau,rmse:Math.sqrt(err/vp.length)}; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// II. CARRY + ROLLDOWN
// ─────────────────────────────────────────────────────────────────────────────
function carryRoll(bond, ns, horizonM, cpiPath) {
  const h = Math.min(horizonM, bond._mths) / 12;
  const t0 = bond.dur ?? 3;
  const t1 = Math.max(0.001, t0 - h);
  let carry = 0;
  if (bond.tp==="LECAP") carry = (Math.pow(1+bond.y/100,horizonM)-1)*100;
  else if (bond.tp==="CER") {
    const n = Math.min(horizonM, cpiPath.length);
    const avgCpi = cpiPath.slice(0,n).reduce((a,v)=>a+v,0)/n;
    const cumCPI = (Math.pow(1+avgCpi/100,horizonM)-1)*100;
    carry = bond.y/100*h*100 + cumCPI;
  } else if (bond.tp==="USD") carry = (bond.coupon??bond.y)/100*h*100;
  else carry = bond.y/100*h*100;
  let rolldown = 0;
  if (ns && t0 > 0.001) {
    const y0 = nsYield(ns.beta, ns.tau, t0);
    const y1 = nsYield(ns.beta, ns.tau, t1);
    rolldown = -(bond.dur??1)*(y1-y0);
  }
  const cvxBonus = 0.5*(bond.dur??0)**2*0.01*h*100;
  return { carry:+carry.toFixed(2), rolldown:+rolldown.toFixed(2), cvx:+cvxBonus.toFixed(2), total:+(carry+rolldown+cvxBonus).toFixed(2) };
}

// ─────────────────────────────────────────────────────────────────────────────
// III. RETURN ATTRIBUTION — decompose return into carry/roll/convexity/ΔP/CPI/FX
// ─────────────────────────────────────────────────────────────────────────────
function retAttrib(bond, scen, scenKey, horizonM, currentBCS, mthsFn) {
  const m0 = mthsFn(bond.m);
  const h  = Math.min(horizonM, m0);
  const ey = bond.exitYields?.[scenKey] ?? bond.y;
  const yrs = h / 12;
  const dur = bond.dur ?? 1;

  if (bond.tp === "LECAP") {
    const carry    = (Math.pow(1+bond.y/100,h)-1)*100;
    const deltaBCS = (currentBCS/scen.exitBCS - 1)*100;
    const total    = (1+carry/100)*(1+deltaBCS/100) - 1;
    return { carry:+carry.toFixed(2), roll:0, cvx:0, deltaP:0, cpi:0, deltaBCS:+deltaBCS.toFixed(2), total:+(total*100).toFixed(2) };
  }
  if (bond.tp === "CER") {
    const carry    = +(bond.y * yrs).toFixed(2);
    const deltaP   = +(-dur*(ey - bond.y)).toFixed(2);
    const cvx      = +(0.5*dur**2*0.0001*yrs*100).toFixed(2);
    const n = Math.min(h, (scen.cpiPath??[]).length);
    const avgCpi = n>0 ? scen.cpiPath.slice(0,n).reduce((a,v)=>a+v,0)/n : 2.5;
    const cpi      = +((Math.pow(1+avgCpi/100,h)-1)*100).toFixed(2);
    const deltaBCS = +(currentBCS/scen.exitBCS*100 - 100).toFixed(2);
    const rARS     = (1+carry/100)*(1+deltaP/100)*(1+cpi/100) - 1;
    const total    = +(((1+rARS)*(currentBCS/scen.exitBCS) - 1)*100).toFixed(2);
    return { carry, roll:0, cvx, deltaP, cpi, deltaBCS, total };
  }
  if (bond.tp === "USD") {
    const carry    = +((bond.coupon??bond.y)/100*yrs*100).toFixed(2);
    const deltaP   = +(-dur*(ey - bond.y)).toFixed(2);
    const cvx      = +(0.5*dur**2*0.0001*yrs*100).toFixed(2);
    const deltaBCS = +(scen.exitBCS/currentBCS*100 - 100).toFixed(2);
    const total    = +(carry + deltaP + cvx).toFixed(2);
    return { carry, roll:0, cvx, deltaP, cpi:0, deltaBCS, total };
  }
  const carry = +(bond.y * yrs).toFixed(2);
  const deltaBCS = +(currentBCS/scen.exitBCS*100 - 100).toFixed(2);
  return { carry, roll:0, cvx:0, deltaP:0, cpi:0, deltaBCS, total:+(carry+deltaBCS).toFixed(2) };
}

// ─────────────────────────────────────────────────────────────────────────────
// IV. DV01 & RISK EFFICIENCY
// ─────────────────────────────────────────────────────────────────────────────
function dv01(bond) {
  const dur = bond.dur ?? 0.5;
  return +(dur / 100).toFixed(4);  // approx DV01 = D × 1% / 100
}
function scenVol(bond, scens, horizonM, currentBCS, mthsFn) {
  const vals = Object.entries(scens).map(([k,s]) => retAttrib(bond, s, k, horizonM, currentBCS, mthsFn).total);
  const mean = vals.reduce((a,v)=>a+v,0)/vals.length;
  const vol  = Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length);
  return { mean:+mean.toFixed(2), vol:+vol.toFixed(2), vals };
}

// ─────────────────────────────────────────────────────────────────────────────
// V. IMPLIED PD — Duffie-Singleton hazard rate
// ─────────────────────────────────────────────────────────────────────────────
function pd(y, rf, rec, years) {
  const spread = Math.max(0,(y-rf)/100);
  const lam = spread/(1-rec);
  return { lam:+(lam*100).toFixed(2), pd1:+(1-Math.exp(-lam))*100, pdT:+(1-Math.exp(-lam*years))*100 };
}

// ─────────────────────────────────────────────────────────────────────────────
// VI. AL/GD BASIS
// ─────────────────────────────────────────────────────────────────────────────
function alGdBasis(usdBonds) {
  const pairs = [{al:"AL29",gd:"GD29"},{al:"AL30",gd:"GD30"},{al:"AL35",gd:"GD35"}];
  return pairs.map(({al,gd}) => {
    const alB=usdBonds.find(b=>b.t===al), gdB=usdBonds.find(b=>b.t===gd);
    if (!alB||!gdB) return null;
    const basisBps = Math.round((alB.y-gdB.y)*100);
    return { al:alB.t, gd:gdB.t, alY:alB.y, gdY:gdB.y, basisBps, fairBasis:175, cheapBps:basisBps-175 };
  }).filter(Boolean);
}
function dts(bond, rf) { return +((bond.dur??3)*Math.max(0,bond.y-rf)).toFixed(3); }
function zScore(arr, val) {
  if(arr.length<2) return 0;
  const mean=arr.reduce((a,v)=>a+v,0)/arr.length;
  const std=Math.sqrt(arr.reduce((a,v)=>a+(v-mean)**2,0)/arr.length);
  return std<0.001?0:(val-mean)/std;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Bar({ v, max=25, w=72, h=14 }) {
  const cl=Math.max(-max,Math.min(max,v)), mid=w/2, bw=Math.abs(cl/max)*mid;
  return (
    <svg width={w} height={h} style={{verticalAlign:"middle"}}>
      <rect x={0} y={2} width={w} height={h-4} rx={2} fill="#e2e8f0"/>
      <rect x={v>=0?mid:mid-bw} y={2} width={bw} height={h-4} rx={2} fill={v>=0?C.pos:C.neg} opacity={0.8}/>
      <line x1={mid} y1={0} x2={mid} y2={h} stroke="#94a3b8" strokeWidth={1}/>
    </svg>
  );
}

function SignalDot({ v }) {
  const col = v==="cheap"?C.pos:v==="rich"?C.neg:C.muted;
  const lbl = v==="cheap"?"BARATO":v==="rich"?"CARO":"NEUTRO";
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"1px 7px",borderRadius:20,background:col+"18",border:`1px solid ${col}40`}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block"}}/>
      <span style={{fontSize:8.5,fontWeight:700,color:col}}>{lbl}</span>
    </span>
  );
}

function ScoreBar({ score }) {
  const col = score>35?C.pos:score>10?"#22c55e":score<-35?C.neg:score<-10?"#f87171":C.muted;
  const pct = Math.max(0,Math.min(100,(score+100)/2));
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,height:8,background:"#e2e8f0",borderRadius:4,overflow:"hidden",minWidth:60}}>
        <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:4}}/>
      </div>
      <span style={{fontSize:10,fontWeight:800,color:col,minWidth:28,textAlign:"right"}}>{score>0?"+":""}{score}</span>
    </div>
  );
}

function NSChart({ pts, ns, w=520, h=270, yLabel="Yield %", title="" }) {
  if(!ns||!pts||pts.length===0) return <div style={{color:C.muted,fontSize:11,padding:20,textAlign:"center"}}>Insuficientes datos (mín 3 bonos).</div>;
  const mg={t:30,r:18,b:40,l:50};
  const pw=w-mg.l-mg.r, ph=h-mg.t-mg.b;
  const vpts = pts.filter(p=>p.dur>0);
  if(!vpts.length) return null;
  const xMax=Math.ceil(Math.max(...vpts.map(p=>p.dur))+0.5), xMin=0;
  const fitYs=Array.from({length:120},(_,i)=>{const t=(i+1)*xMax/120; return {t,y:nsYield(ns.beta,ns.tau,t)};});
  const allY=[...vpts.map(p=>p.y),...fitYs.map(f=>f.y)];
  const yMin=Math.floor((Math.min(...allY)-0.5)*2)/2;
  const yMax=Math.ceil((Math.max(...allY)+1)*2)/2;
  const px=x=>mg.l+(x-xMin)/(xMax-xMin)*pw;
  const py=y=>mg.t+(1-(y-yMin)/(yMax-yMin))*ph;
  const fitPath=fitYs.map((p,i)=>`${i===0?"M":"L"}${px(p.t).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const upPath=fitYs.map((p,i)=>`${i===0?"M":"L"}${px(p.t).toFixed(1)},${py(p.y+ns.rmse).toFixed(1)}`).join(" ");
  const loPath=[...fitYs].reverse().map((p,i)=>`${i===0?"M":"L"}${px(p.t).toFixed(1)},${py(p.y-ns.rmse).toFixed(1)}`).join(" ");
  const tY=Array.from({length:6},(_,i)=>+(yMin+(yMax-yMin)*i/5).toFixed(1));
  const tX=Array.from({length:xMax+1},(_,i)=>i);
  return (
    <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible"}}>
      {title&&<text x={w/2} y={20} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.navy}>{title}</text>}
      {tX.map(v=><line key={v} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={0.6}/>)}
      {tY.map((v,i)=><line key={i} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={0.6}/>)}
      <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
      <path d={upPath+" "+loPath+" Z"} fill={C.blue1} opacity={0.07}/>
      <path d={fitPath} fill="none" stroke={C.blue1} strokeWidth={2.5} opacity={0.85}/>
      {vpts.map((p,i)=>{
        const cx=px(p.dur), cy=py(p.y), fY=nsYield(ns.beta,ns.tau,p.dur);
        const bps=Math.round((p.y-fY)*100);
        const col=bps>30?C.pos:bps<-30?C.neg:bps>10?"#22c55e":bps<-10?"#f87171":C.teal;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={cx} y2={py(fY)} stroke={col} strokeWidth={1.5} strokeDasharray="2 2" opacity={0.7}/>
            <circle cx={cx} cy={cy} r={6} fill={col} stroke="white" strokeWidth={1.5}/>
            <text x={cx+8} y={cy+4} fontSize={8.5} fontWeight={800} fill={col}>{p.t}</text>
            <text x={cx+8} y={cy+14} fontSize={7.5} fill={col} opacity={0.85}>{bps>=0?"+":""}{bps}bp</text>
          </g>
        );
      })}
      {tX.map(v=><text key={v} x={px(v)} y={mg.t+ph+14} textAnchor="middle" fontSize={8.5} fill={C.muted}>{v}y</text>)}
      {tY.map((v,i)=><text key={i} x={mg.l-5} y={py(v)+3.5} textAnchor="end" fontSize={8.5} fill={C.muted}>{v.toFixed(1)}</text>)}
      <text x={mg.l+pw/2} y={h-4} textAnchor="middle" fontSize={9} fill={C.muted}>Duración (años)</text>
      <text x={11} y={mg.t+ph/2} textAnchor="middle" fontSize={9} fill={C.muted} transform={`rotate(-90,11,${mg.t+ph/2})`}>{yLabel}</text>
      <line x1={mg.l+5} y1={h-18} x2={mg.l+22} y2={h-18} stroke={C.blue1} strokeWidth={2.5}/>
      <text x={mg.l+26} y={h-14} fontSize={8} fill={C.blue1}>NS fit  ±RMSE={ns.rmse.toFixed(2)}%</text>
      <circle cx={mg.l+148} cy={h-18} r={4} fill={C.pos} stroke="white" strokeWidth={1}/>
      <text x={mg.l+156} y={h-14} fontSize={8} fill={C.pos}>barato</text>
      <circle cx={mg.l+195} cy={h-18} r={4} fill={C.neg} stroke="white" strokeWidth={1}/>
      <text x={mg.l+203} y={h-14} fontSize={8} fill={C.neg}>caro</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalysisTab({ bonds, scens, horizon, currentBCS }) {
  const [rf,      setRf]      = useState(4.30);
  const [rec,     setRec]     = useState(40);
  const [pdT,     setPdT]     = useState(3);
  const [section, setSection] = useState("dash");

  const cpiPath = scens.BASE?.cpiPath ?? Array(24).fill(2.5);
  const NOW     = new Date("2026-03-12");
  const mths    = ds => Math.max(0.001,(new Date(ds)-NOW)/(30.44*86400000));

  const cerAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="CER"&&(b.dur??0)>0), [bonds]);
  const gdAct   = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="USD"&&b.t.startsWith("GD")&&(b.dur??0)>0), [bonds]);
  const usdAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="USD"), [bonds]);
  const lecAct  = useMemo(()=>bonds.filter(b=>b.active&&b.tp==="LECAP"), [bonds]);
  const allAct  = useMemo(()=>bonds.filter(b=>b.active&&(b.dur??0)>0), [bonds]);

  const nsCER = useMemo(()=>fitNS(cerAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))), [cerAct]);
  const nsGD  = useMemo(()=>fitNS(gdAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))), [gdAct]);

  const cerRV = useMemo(()=>{
    if(!nsCER) return [];
    return cerAct.map(b=>{
      const fitted=nsYield(nsCER.beta,nsCER.tau,b.dur??1);
      const cheapBps=Math.round((b.y-fitted)*100);
      const cr=carryRoll({...b,_mths:mths(b.m)},nsCER,horizon,cpiPath);
      const sv=scenVol(b,scens,horizon,currentBCS,mths);
      return {...b,fitted:+fitted.toFixed(3),cheapBps,cr,sv,d01:dv01(b)};
    }).map((b,_,arr)=>{
      const zC=zScore(arr.map(x=>x.cheapBps),b.cheapBps);
      const zR=zScore(arr.map(x=>x.cr.total),b.cr.total);
      const sharpe=b.sv.vol>0?+(b.sv.mean/b.sv.vol).toFixed(2):0;
      return {...b,score:Math.round(zC*40+zR*60),sharpe};
    }).sort((a,z)=>z.score-a.score);
  },[cerAct,nsCER,horizon,cpiPath,scens,currentBCS]);

  const usdRV = useMemo(()=>{
    return usdAct.map(b=>{
      const stype=b.t.startsWith("BP")?"BOPREAL":b.t.startsWith("AL")||b.t.startsWith("AE")?"BONAR":"GLOBAL";
      const fitted=nsGD?nsYield(nsGD.beta,nsGD.tau,b.dur??3):b.y;
      const cheapBps=Math.round((b.y-fitted)*100);
      const cr=carryRoll({...b,_mths:mths(b.m)},nsGD,horizon,cpiPath);
      const p=pd(b.y,rf,rec/100,pdT);
      const sv=scenVol(b,scens,horizon,currentBCS,mths);
      const sharpe=sv.vol>0?+(sv.mean/sv.vol).toFixed(2):0;
      return {...b,stype,fitted:+fitted.toFixed(3),cheapBps,cr,pd:p,dts:dts(b,rf),sv,sharpe,d01:dv01(b)};
    }).map((b,_,arr)=>{
      const zC=zScore(arr.map(x=>x.cheapBps),b.cheapBps);
      const zR=zScore(arr.map(x=>x.cr.total),b.cr.total);
      return {...b,score:Math.round(zC*45+zR*55)};
    });
  },[usdAct,nsGD,horizon,cpiPath,rf,rec,pdT,scens,currentBCS]);

  const crAll = useMemo(()=>{
    return allAct.map(b=>{
      const ns=b.tp==="CER"?nsCER:b.tp==="USD"?nsGD:null;
      return {...b,cr:carryRoll({...b,_mths:mths(b.m)},ns,horizon,cpiPath)};
    }).sort((a,z)=>z.cr.total-a.cr.total);
  },[allAct,nsCER,nsGD,horizon,cpiPath]);

  const attrAll = useMemo(()=>{
    return allAct.map(b=>{
      const byScen={};
      Object.entries(scens).forEach(([k,s])=>{ byScen[k]=retAttrib(b,s,k,horizon,currentBCS,mths); });
      const sv=scenVol(b,scens,horizon,currentBCS,mths);
      const sharpe=sv.vol>0?+(sv.mean/sv.vol).toFixed(2):0;
      return {...b,byScen,sv,sharpe,d01:dv01(b)};
    }).sort((a,z)=>z.sharpe-a.sharpe);
  },[allAct,scens,horizon,currentBCS]);

  const dashAll = useMemo(()=>{
    const map={};
    cerRV.forEach(b=>{ map[b.id]={...b,grp:"CER"}; });
    usdRV.forEach(b=>{ map[b.id]={...b,grp:"USD"}; });
    allAct.filter(b=>!map[b.id]).forEach(b=>{
      const sv=scenVol(b,scens,horizon,currentBCS,mths);
      const sharpe=sv.vol>0?+(sv.mean/sv.vol).toFixed(2):0;
      map[b.id]={...b,cheapBps:null,cr:carryRoll({...b,_mths:mths(b.m)},null,horizon,cpiPath),sv,sharpe,score:0};
    });
    return Object.values(map).sort((a,z)=>(z.score??0)-(a.score??0));
  },[cerRV,usdRV,allAct,scens,horizon,currentBCS,cpiPath]);

  const basis = useMemo(()=>alGdBasis(usdAct),[usdAct]);
  const beMatrix = useMemo(()=>{
    const cer=cerAct.slice().sort((a,z)=>(a.dur??0)-(z.dur??0));
    const lec=lecAct.slice().sort((a,z)=>mths(a.m)-mths(z.m));
    const avgCPI=(scens.BASE?.cpiPath??Array(24).fill(2.5)).slice(0,horizon).reduce((a,v)=>a+v,0)/Math.min(horizon,24);
    return {cer,lec,avgCPI,exitBCS:scens.BASE?.exitBCS??1554,bcs:currentBCS??1447};
  },[cerAct,lecAct,horizon,scens,currentBCS]);

  const TH = s=>({padding:"6px 9px",textAlign:s||"center",fontWeight:600,fontSize:9.5,color:C.muted,borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap"});
  const TD = s=>({padding:"6px 9px",textAlign:s||"center",fontSize:10.5});
  const tpCol = tp=>tp==="CER"?C.teal:tp==="LECAP"?"#0369a1":tp==="USD"?"#166534":tp==="TAMAR"?"#7c3aed":C.muted;
  const show = id=>section==="all"||section===id;
  const SBtn = ({id,lbl})=>(
    <button onClick={()=>setSection(p=>p===id?"all":id)}
      style={{padding:"5px 13px",borderRadius:20,border:section===id?`2px solid ${C.blue1}`:`1px solid ${C.border}`,cursor:"pointer",fontSize:11,fontWeight:600,background:section===id?C.blue1:C.card,color:section===id?C.white:C.muted}}>
      {lbl}
    </button>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* HEADER */}
      <div style={{background:C.card,borderRadius:12,padding:"12px 16px",boxShadow:"0 2px 12px rgba(0,0,57,.08)",borderLeft:`4px solid ${C.blue2}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div>
            <div style={{fontWeight:800,color:C.navy,fontSize:14}}>🔬 Análisis de Valor Relativo — Framework Cuantitativo</div>
            <div style={{fontSize:10,color:C.muted,marginTop:3}}>Nelson-Siegel · Carry+Roll · Atribución de Retorno · Eficiencia Sharpe · PD Implícita · AL/GD Basis · BE Matrix</div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:C.muted}}>RF:</span>
            <input type="number" step="0.1" value={rf} onChange={e=>setRf(+e.target.value||4)} style={{width:46,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 5px",fontSize:11,textAlign:"right"}}/>
            <span style={{fontSize:10,color:C.muted}}>%  Rec:</span>
            <input type="number" step="5" value={rec} onChange={e=>setRec(+e.target.value||40)} style={{width:36,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 5px",fontSize:11,textAlign:"right"}}/>
            <span style={{fontSize:10,color:C.muted}}>%  PD en:</span>
            <input type="number" step="1" value={pdT} onChange={e=>setPdT(+e.target.value||3)} style={{width:30,border:`1px solid ${C.border}`,borderRadius:5,padding:"2px 5px",fontSize:11,textAlign:"right"}}/>
            <span style={{fontSize:10,color:C.muted}}>años</span>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {[["dash","🎯 Dashboard"],["ns","I · NS Curves"],["attr","II · Atribución"],["cr","III · Carry-Roll"],["eff","IV · Eficiencia"],["pd","V · PD Implícita"],["basis","VI · AL/GD Basis"],["be","VII · BE Matrix"]].map(([id,lbl])=>(
          <SBtn key={id} id={id} lbl={lbl}/>
        ))}
      </div>

      {/* ─── DASHBOARD ─────────────────────────────────────────────────── */}
      {show("dash")&&(
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>🎯 Dashboard RV — Semáforo Unificado ({horizon}m)</span>
            <span style={{color:C.blue2,fontSize:10}}>Score = z(NS cheapness)×40% + z(Carry+Roll)×60% · Sharpe = ret.medio/std(escenarios)</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#f1f5f9"}}>
                  <th style={TH("left")}>Bono</th>
                  <th style={TH()}>TIR act.</th>
                  <th style={TH()}>NS fit</th>
                  <th style={TH()}>Δbps</th>
                  <th style={TH()}>Rich/Cheap</th>
                  <th style={TH()}>C+Roll</th>
                  <th style={TH()}>Sharpe</th>
                  <th style={TH()}>Score RV</th>
                  <th style={TH()}>Ret BASE</th>
                  <th style={TH()}>Ret BULL</th>
                  <th style={TH()}>Ret BEAR</th>
                </tr>
              </thead>
              <tbody>
                {dashAll.map((b,i)=>{
                  const tc=tpCol(b.tp);
                  const cheapSig=b.cheapBps!=null?(b.cheapBps>30?"cheap":b.cheapBps<-30?"rich":"neutral"):null;
                  const [rB,rBu,rBr]=["BASE","BULL","BEAR"].map(k=>b.sv?.vals?.[Object.keys(scens).indexOf(k)]??0);
                  return (
                    <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${tc}40`}}>
                      <td style={{...TD("left"),padding:"7px 10px"}}>
                        <div style={{fontWeight:800,color:tc,fontSize:12}}>{b.t}</div>
                        <div style={{fontSize:8.5,color:C.muted}}>{b.tp} · {b.m?.slice(0,7)}</div>
                      </td>
                      <td style={{...TD(),fontWeight:700,color:tc}}>{b.y?.toFixed(2)}%</td>
                      <td style={{...TD(),color:C.muted,fontSize:10}}>{b.fitted!=null?`${b.fitted}%`:"–"}</td>
                      <td style={{...TD(),fontWeight:700,color:b.cheapBps!=null?(b.cheapBps>0?C.pos:b.cheapBps<0?C.neg:C.muted):C.muted}}>
                        {b.cheapBps!=null?(b.cheapBps>=0?"+":"")+b.cheapBps+"bp":"–"}
                      </td>
                      <td style={TD()}>{cheapSig?<SignalDot v={cheapSig}/>:"–"}</td>
                      <td style={{...TD(),fontWeight:700,color:(b.cr?.total??0)>=0?C.pos:C.neg}}>
                        {(b.cr?.total??0)>=0?"+":""}{b.cr?.total??0}%
                        <Bar v={b.cr?.total??0} max={50}/>
                      </td>
                      <td style={{...TD(),fontWeight:700,color:(b.sharpe??0)>1.5?C.pos:(b.sharpe??0)>0.5?"#22c55e":(b.sharpe??0)<0?C.neg:C.muted}}>
                        {b.sharpe??0}
                      </td>
                      <td style={{...TD(),minWidth:110}}>
                        <ScoreBar score={b.score??0}/>
                      </td>
                      <td style={{...TD(),fontWeight:700,color:rB>=0?C.pos:C.neg}}>{rB>=0?"+":""}{rB.toFixed(1)}%</td>
                      <td style={{...TD(),fontWeight:600,color:rBu>=0?C.pos:C.neg,fontSize:10}}>{rBu>=0?"+":""}{rBu.toFixed(1)}%</td>
                      <td style={{...TD(),fontWeight:600,color:rBr>=0?C.pos:C.neg,fontSize:10}}>{rBr>=0?"+":""}{rBr.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            <strong>NS Δbps:</strong> residuo vs curva NS. Positivo = cotiza encima de curva → barato en precio.
            <strong> Sharpe:</strong> retorno medio / desvío cross-escenario. Mayor = más robusto ante distintos macros.
            <strong> Score RV:</strong> blend z-scores. Solo indicativo, no recomendación.
          </div>
        </div>
      )}

      {/* ─── I. NELSON-SIEGEL ──────────────────────────────────────────── */}
      {show("ns")&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={card}>
              <div style={{padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12}}>I-A · NS Fit — CER (Tasa Real)</div>
              <div style={{padding:16}}>
                <NSChart pts={cerAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))} ns={nsCER} yLabel="Tasa Real %" w={480} h={260}/>
                {nsCER&&<div style={{fontSize:9,color:C.muted,marginTop:5,textAlign:"center"}}>β₀={nsCER.beta[0].toFixed(2)} β₁={nsCER.beta[1].toFixed(2)} β₂={nsCER.beta[2].toFixed(2)} τ={nsCER.tau.toFixed(2)} RMSE={nsCER.rmse.toFixed(2)}%</div>}
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    {["Bono","Dur","Yield","NS fit","Δbps","Señal","Score"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {cerRV.map((b,i)=>(
                      <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                        <td style={{...TD("left"),fontWeight:800,color:C.teal,paddingLeft:12}}>{b.t}</td>
                        <td style={TD()}>{b.dur}y</td>
                        <td style={{...TD(),fontWeight:700,color:C.teal}}>{b.y.toFixed(2)}%</td>
                        <td style={{...TD(),color:C.muted}}>{b.fitted}%</td>
                        <td style={{...TD(),fontWeight:700,color:b.cheapBps>0?C.pos:b.cheapBps<0?C.neg:C.muted}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</td>
                        <td style={TD()}><SignalDot v={b.cheapBps>30?"cheap":b.cheapBps<-30?"rich":"neutral"}/></td>
                        <td style={{...TD(),minWidth:90}}><ScoreBar score={b.score}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={card}>
              <div style={{padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12}}>I-B · NS Fit — Globales USD (GD)</div>
              <div style={{padding:16}}>
                <NSChart pts={gdAct.map(b=>({dur:b.dur,y:b.y,t:b.t}))} ns={nsGD} yLabel="Yield USD %" w={480} h={260}/>
                {nsGD&&<div style={{fontSize:9,color:C.muted,marginTop:5,textAlign:"center"}}>β₀={nsGD.beta[0].toFixed(2)} β₁={nsGD.beta[1].toFixed(2)} β₂={nsGD.beta[2].toFixed(2)} τ={nsGD.tau.toFixed(2)} RMSE={nsGD.rmse.toFixed(2)}%</div>}
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
                  <thead><tr style={{background:"#f8fafc"}}>
                    {["Bono","Dur","Yield","NS fit","Δbps","Señal","DTS"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {usdRV.filter(b=>b.stype==="GLOBAL").sort((a,z)=>z.cheapBps-a.cheapBps).map((b,i)=>(
                      <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                        <td style={{...TD("left"),fontWeight:800,color:"#166534",paddingLeft:12}}>{b.t}</td>
                        <td style={TD()}>{(b.dur??3).toFixed(1)}y</td>
                        <td style={{...TD(),fontWeight:700,color:"#166534"}}>{b.y.toFixed(2)}%</td>
                        <td style={{...TD(),color:C.muted}}>{b.fitted}%</td>
                        <td style={{...TD(),fontWeight:700,color:b.cheapBps>0?C.pos:b.cheapBps<0?C.neg:C.muted}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</td>
                        <td style={TD()}><SignalDot v={b.cheapBps>30?"cheap":b.cheapBps<-30?"rich":"neutral"}/></td>
                        <td style={{...TD(),fontSize:9.5,color:C.muted}}>{b.dts?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Full USD table */}
          <div style={card}>
            <div style={{padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12}}>I-C · NS Residuals — Todos los USD (usando GD fit)</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f1f5f9"}}>
                  {["Grupo","Bono","Dur","Yield","NS Fit","Δbps","Señal","DTS","Score"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {["GLOBAL","BONAR","BOPREAL"].map(st=>{
                    const cfg={GLOBAL:{color:"#166534"},BONAR:{color:"#7c3aed"},BOPREAL:{color:"#0f766e"}};
                    const grp=usdRV.filter(b=>b.stype===st).sort((a,z)=>(a.dur??3)-(z.dur??3));
                    if(!grp.length) return null;
                    return (
                      <Fragment key={st}>
                        <tr><td colSpan={9} style={{padding:"5px 12px",background:cfg[st].color+"12",borderLeft:`3px solid ${cfg[st].color}`,fontWeight:700,fontSize:10.5,color:cfg[st].color}}>── {st}</td></tr>
                        {grp.map((b,i)=>(
                          <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${cfg[st].color}30`}}>
                            <td style={{...TD(),fontSize:9,color:C.muted}}>{st}</td>
                            <td style={{...TD("left"),fontWeight:800,color:cfg[st].color}}>{b.t}</td>
                            <td style={TD()}>{(b.dur??3).toFixed(1)}y</td>
                            <td style={{...TD(),fontWeight:700}}>{b.y.toFixed(2)}%</td>
                            <td style={{...TD(),color:C.muted}}>{b.fitted}%</td>
                            <td style={{...TD(),fontWeight:700,color:b.cheapBps>0?C.pos:b.cheapBps<0?C.neg:C.muted}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bp</td>
                            <td style={TD()}><SignalDot v={b.cheapBps>30?"cheap":b.cheapBps<-30?"rich":"neutral"}/></td>
                            <td style={{...TD(),fontSize:9.5,color:C.muted}}>{b.dts?.toFixed(2)}</td>
                            <td style={{...TD(),minWidth:90}}><ScoreBar score={b.score}/></td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── II. ATRIBUCIÓN ────────────────────────────────────────────── */}
      {show("attr")&&(
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>II · Atribución de Retorno — Descomposición por Fuente (BASE, {horizon}m)</span>
            <span style={{color:C.blue2,fontSize:10}}>Carry | Δ Precio | Convexidad | CPI | Δ BCS</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{background:"#f1f5f9"}}>
                  <th style={TH("left")}>Bono</th>
                  <th style={TH()}>Tipo</th>
                  <th style={{...TH(),color:"#0369a1"}}>Carry</th>
                  <th style={{...TH(),color:"#f59e0b"}}>Δ Precio<br/><span style={{fontWeight:400,fontSize:8}}>−D×ΔY</span></th>
                  <th style={{...TH(),color:"#7c3aed"}}>Convexidad</th>
                  <th style={{...TH(),color:"#16a34a"}}>CPI acum</th>
                  <th style={{...TH(),color:C.salmon}}>Δ BCS/FX</th>
                  <th style={TH()}>Total BASE</th>
                  <th style={TH()}>Total BULL</th>
                  <th style={TH()}>Total BEAR</th>
                  <th style={TH()}>σ escenarios</th>
                </tr>
              </thead>
              <tbody>
                {attrAll.map((b,i)=>{
                  const att=b.byScen.BASE;
                  const tc=tpCol(b.tp);
                  const [rB,rBu,rBr]=["BASE","BULL","BEAR"].map(k=>b.byScen[k]?.total??0);
                  return (
                    <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${tc}40`}}>
                      <td style={{...TD("left"),fontWeight:800,color:tc,paddingLeft:10}}>
                        <div style={{fontSize:12}}>{b.t}</div>
                        <div style={{fontSize:8.5,color:C.muted}}>{b.m?.slice(0,7)}</div>
                      </td>
                      <td style={TD()}><span style={{background:tc+"18",color:tc,padding:"1px 6px",borderRadius:10,fontWeight:700,fontSize:9}}>{b.tp}</span></td>
                      <td style={{...TD(),fontWeight:600,color:"#0369a1"}}>{att.carry>=0?"+":""}{att.carry}%</td>
                      <td style={{...TD(),fontWeight:600,color:att.deltaP>=0?C.pos:C.neg}}>{att.deltaP===0?"—":(att.deltaP>=0?"+":"")+att.deltaP+"%"}</td>
                      <td style={{...TD(),color:C.muted,fontSize:10}}>{att.cvx===0?"—":`+${att.cvx}%`}</td>
                      <td style={{...TD(),fontWeight:600,color:"#16a34a"}}>{att.cpi===0?"—":`+${att.cpi.toFixed(1)}%`}</td>
                      <td style={{...TD(),fontWeight:600,color:att.deltaBCS>=0?C.pos:C.neg}}>{(att.deltaBCS>=0?"+":"")+att.deltaBCS.toFixed(1)+"%"}</td>
                      <td style={{...TD(),fontWeight:800,fontSize:13,color:rB>=0?C.pos:C.neg}}>{rB>=0?"+":""}{rB.toFixed(1)}%</td>
                      <td style={{...TD(),fontWeight:600,color:rBu>=0?C.pos:C.neg,fontSize:10}}>{rBu>=0?"+":""}{rBu.toFixed(1)}%</td>
                      <td style={{...TD(),fontWeight:600,color:rBr>=0?C.pos:C.neg,fontSize:10}}>{rBr>=0?"+":""}{rBr.toFixed(1)}%</td>
                      <td style={{...TD(),color:C.muted,fontSize:10}}>{b.sv.vol.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            <strong>Carry:</strong> ingresos por accrual de yield, independiente de movimientos de tasa.
            <strong> Δ Precio:</strong> ganancia/pérdida por compresión o expansión del yield al horizonte (≈ −Duration × ΔYield).
            <strong> CPI:</strong> componente inflación (solo CER). Domina el retorno en bonos CER.
            <strong> Δ BCS:</strong> impacto de la depreciación/apreciación del tipo de cambio sobre retorno en USD (ARS) o viceversa.
          </div>
        </div>
      )}

      {/* ─── III. CARRY-ROLL ───────────────────────────────────────────── */}
      {show("cr")&&(
        <div style={card}>
          <div style={{padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12}}>
            III · Carry + Roll-Down — Ranking ({horizon}m) · curvas NS por asset class
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#f1f5f9"}}>
                {["#","Bono","Tipo","Carry","Roll-Down","Convexidad","Total C+R","Barra"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
              </tr></thead>
              <tbody>
                {crAll.map((b,i)=>{
                  const tc=tpCol(b.tp);
                  return (
                    <tr key={b.id} style={{background:i<3?"#f0fdf4":i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${tc}40`}}>
                      <td style={{...TD(),fontSize:11}}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":C.border,fontSize:9,fontWeight:700,color:i<3?C.white:C.muted}}>{i+1}</span>
                      </td>
                      <td style={{...TD("left"),fontWeight:800,color:tc,paddingLeft:10}}>{b.t}</td>
                      <td style={TD()}><span style={{background:tc+"18",color:tc,padding:"1px 6px",borderRadius:10,fontWeight:700,fontSize:9}}>{b.tp}</span></td>
                      <td style={{...TD(),fontWeight:700,color:"#0369a1"}}>{b.cr.carry>=0?"+":""}{b.cr.carry}%</td>
                      <td style={{...TD(),fontWeight:700,color:b.cr.rolldown>=0?C.pos:C.neg}}>{b.cr.rolldown===0?"—":(b.cr.rolldown>=0?"+":"")+b.cr.rolldown+"%"}</td>
                      <td style={{...TD(),color:C.muted,fontSize:10}}>+{b.cr.cvx}%</td>
                      <td style={{...TD(),fontWeight:800,fontSize:13,color:b.cr.total>=0?C.pos:C.neg}}>{b.cr.total>=0?"+":""}{b.cr.total}%</td>
                      <td style={{...TD(),minWidth:90}}><Bar v={b.cr.total} max={60}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            <strong>Carry:</strong> accrual puro (sin cambio de precio). <strong>Roll-Down:</strong> ganancia por aging en curva NS (curva upward-sloping → roll positivo). <strong>Convexidad:</strong> bonus ½·D²·σ²·T.
          </div>
        </div>
      )}

      {/* ─── IV. EFICIENCIA ────────────────────────────────────────────── */}
      {show("eff")&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Scatter frontera eficiente */}
          <div style={card}>
            <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:C.white,fontWeight:800,fontSize:13}}>IV-A · Frontera Eficiente — Retorno Esperado vs Volatilidad Cross-Escenario</span>
              <span style={{color:C.blue2,fontSize:10}}>Arriba-izquierda = más eficiente · Tamaño burbuja = Sharpe ratio</span>
            </div>
            <div style={{padding:16,overflowX:"auto"}}>
              {(()=>{
                const data=attrAll;
                if(!data.length) return null;
                const w=1100,h=380,mg={t:30,r:20,b:50,l:60};
                const pw=w-mg.l-mg.r,ph=h-mg.t-mg.b;
                const vols=data.map(d=>d.sv.vol),rets=data.map(d=>d.sv.mean);
                const xMin=0,xMax=Math.max(5,...vols)+2;
                const yMin=Math.min(-5,...rets)-3,yMax=Math.max(5,...rets)+4;
                const px=x=>mg.l+(x-xMin)/(xMax-xMin)*pw;
                const py=y=>mg.t+(1-(y-yMin)/(yMax-yMin))*ph;
                const tc=tp=>tp==="CER"?C.teal:tp==="LECAP"?"#0369a1":tp==="USD"?"#166534":tp==="TAMAR"?"#7c3aed":C.muted;
                const txs=Array.from({length:7},(_,i)=>+(i*xMax/6).toFixed(1));
                const tys=Array.from({length:7},(_,i)=>+(yMin+(yMax-yMin)*i/6).toFixed(1));
                return (
                  <svg width={w} height={h} style={{fontFamily:"inherit",display:"block"}}>
                    {txs.map(v=><line key={v} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={0.7}/>)}
                    {tys.map((v,i)=><line key={i} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={0.7}/>)}
                    <line x1={mg.l} y1={py(0)} x2={mg.l+pw} y2={py(0)} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"/>
                    <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
                    <text x={mg.l+18} y={mg.t+18} fontSize={9} fill={C.pos} opacity={0.5}>◀ Alta eficiencia</text>
                    <text x={mg.l+pw-90} y={mg.t+18} fontSize={9} fill={C.neg} opacity={0.5}>Ineficiente ▶</text>
                    {data.map((b,i)=>{
                      const cx=px(b.sv.vol),cy=py(b.sv.mean),col=tc(b.tp);
                      const r=Math.max(4,Math.min(12,Math.abs(b.sharpe??0)*3+4));
                      return (
                        <g key={b.id}>
                          <circle cx={cx} cy={cy} r={r} fill={col} stroke="white" strokeWidth={1.5} opacity={0.85}/>
                          <text x={cx+r+3} y={cy+4} fontSize={8.5} fontWeight={700} fill={col}>{b.t}</text>
                          <text x={cx+r+3} y={cy+14} fontSize={7.5} fill={C.muted}>S={b.sharpe}</text>
                        </g>
                      );
                    })}
                    {txs.map(v=><text key={v} x={px(v)} y={mg.t+ph+16} textAnchor="middle" fontSize={9} fill={C.muted}>{v.toFixed(1)}</text>)}
                    {tys.map((v,i)=><text key={i} x={mg.l-7} y={py(v)+3.5} textAnchor="end" fontSize={9} fill={C.muted}>{v.toFixed(1)}%</text>)}
                    <text x={mg.l+pw/2} y={h-8} textAnchor="middle" fontSize={10} fill={C.muted}>Volatilidad cross-escenario (%)</text>
                    <text x={14} y={mg.t+ph/2} textAnchor="middle" fontSize={10} fill={C.muted} transform={`rotate(-90,14,${mg.t+ph/2})`}>Retorno medio (%)</text>
                    {[["CER",C.teal],["LECAP","#0369a1"],["USD","#166534"],["TAMAR","#7c3aed"]].map(([tp,col],i)=>(
                      <g key={tp}>
                        <circle cx={mg.l+i*90+20} cy={mg.t+ph+36} r={5} fill={col} stroke="white" strokeWidth={1}/>
                        <text x={mg.l+i*90+29} y={mg.t+ph+40} fontSize={9} fill={col} fontWeight={600}>{tp}</text>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>
          {/* Risk efficiency table */}
          <div style={card}>
            <div style={{padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12}}>IV-B · Sharpe Ratio y Eficiencia por Riesgo</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f1f5f9"}}>
                  {["Bono","Tipo","Ret BASE","Ret BULL","Ret BEAR","Ret Medio","Vol σ","Sharpe","DV01","Ranking"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {attrAll.map((b,i)=>{
                    const tc=tpCol(b.tp);
                    const [rB,rBu,rBr]=["BASE","BULL","BEAR"].map(k=>b.byScen[k]?.total??0);
                    const sc=b.sharpe>2?C.pos:b.sharpe>1?"#22c55e":b.sharpe>0?"#f59e0b":C.neg;
                    return (
                      <tr key={b.id} style={{background:i<3?"#f0fdf4":i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${tc}40`}}>
                        <td style={{...TD("left"),fontWeight:800,color:tc,paddingLeft:10}}>{b.t}</td>
                        <td style={TD()}><span style={{background:tc+"18",color:tc,padding:"1px 6px",borderRadius:10,fontWeight:700,fontSize:9}}>{b.tp}</span></td>
                        <td style={{...TD(),color:rB>=0?C.pos:C.neg,fontWeight:600}}>{rB>=0?"+":""}{rB.toFixed(1)}%</td>
                        <td style={{...TD(),color:rBu>=0?C.pos:C.neg,fontWeight:600}}>{rBu>=0?"+":""}{rBu.toFixed(1)}%</td>
                        <td style={{...TD(),color:rBr>=0?C.pos:C.neg,fontWeight:600}}>{rBr>=0?"+":""}{rBr.toFixed(1)}%</td>
                        <td style={{...TD(),fontWeight:700}}>{b.sv.mean>=0?"+":""}{b.sv.mean}%</td>
                        <td style={{...TD(),color:C.muted}}>{b.sv.vol.toFixed(2)}%</td>
                        <td style={{...TD(),fontWeight:800,fontSize:13,color:sc}}>{b.sharpe}</td>
                        <td style={{...TD(),fontSize:9.5,color:C.muted}}>{b.d01.toFixed(3)}</td>
                        <td style={{...TD(),minWidth:90}}><ScoreBar score={Math.min(100,Math.max(-100,Math.round((b.sharpe??0)*30)))}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
              <strong>Sharpe (cross-escenario):</strong> retorno medio / desvío entre BASE/BULL/BEAR. Mide robustez macroeconómica, no volatilidad histórica.
              <strong> DV01:</strong> sensibilidad de precio ante 1bp en yield (≈ D/100).
            </div>
          </div>
        </div>
      )}

      {/* ─── V. PD ─────────────────────────────────────────────────────── */}
      {show("pd")&&(
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>V · PD Implícita — Duffie-Singleton Hazard Rate</span>
            <span style={{color:C.blue2,fontSize:10}}>λ = spread/(1−R) · PD_T = 1−e^(−λ·T) · RF={rf}% · Rec={rec}%</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#f1f5f9"}}>
                {["Bono","Grupo","Yield","Z-spread","λ (%/año)","PD 1año","PD "+pdT+"años","DTS","NS Señal"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
              </tr></thead>
              <tbody>
                {["GLOBAL","BONAR","BOPREAL"].map(st=>{
                  const cfg={GLOBAL:{color:"#166534"},BONAR:{color:"#7c3aed"},BOPREAL:{color:"#0f766e"}};
                  const grp=usdRV.filter(b=>b.stype===st).sort((a,z)=>a.pd.pdT-z.pd.pdT);
                  if(!grp.length) return null;
                  return (
                    <Fragment key={st}>
                      <tr><td colSpan={9} style={{padding:"5px 12px",background:cfg[st].color+"12",borderLeft:`3px solid ${cfg[st].color}`,fontWeight:700,fontSize:10.5,color:cfg[st].color}}>── {st}</td></tr>
                      {grp.map((b,i)=>(
                        <tr key={b.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${cfg[st].color}30`}}>
                          <td style={{...TD("left"),fontWeight:800,color:cfg[st].color,paddingLeft:12}}>{b.t}</td>
                          <td style={{...TD(),fontSize:9,color:C.muted}}>{st}</td>
                          <td style={{...TD(),fontWeight:700}}>{b.y.toFixed(2)}%</td>
                          <td style={{...TD(),fontWeight:600,color:C.neg}}>{Math.max(0,b.y-rf).toFixed(2)}%</td>
                          <td style={{...TD(),color:"#f97316",fontWeight:700}}>{b.pd.lam}%</td>
                          <td style={{...TD(),fontWeight:700,color:b.pd.pd1>30?C.neg:b.pd.pd1>15?"#f97316":C.muted}}>{b.pd.pd1.toFixed(1)}%</td>
                          <td style={{...TD(),fontWeight:800,fontSize:13,color:b.pd.pdT>60?C.neg:b.pd.pdT>35?"#f97316":"#22c55e"}}>{b.pd.pdT.toFixed(1)}%</td>
                          <td style={{...TD(),fontSize:9.5}}>{b.dts.toFixed(2)}</td>
                          <td style={TD()}><SignalDot v={b.cheapBps>30?"cheap":b.cheapBps<-30?"rich":"neutral"}/></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            Modelo Duffie-Singleton: hazard rate constante λ=spread/(1−R). PD_T=1−e^(−λT). DTS=dur×z-spread: normaliza exposición crediticia.
          </div>
        </div>
      )}

      {/* ─── VI. BASIS ─────────────────────────────────────────────────── */}
      {show("basis")&&(
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>VI · AL/GD Basis — Mismo Vencimiento, Distinta Jurisdicción</span>
            <span style={{color:C.blue2,fontSize:10}}>Fair basis ≈ 175bps histórico · AL spread {">"} fair → AL barato · {"<"} fair → AL caro</span>
          </div>
          <div style={{padding:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
              {basis.map(b=>{
                const pct=Math.min(100,Math.max(0,(b.basisBps/400)*100));
                const fPct=(b.fairBasis/400)*100;
                const col=b.cheapBps>50?C.pos:b.cheapBps>0?"#22c55e":b.cheapBps>-50?"#f97316":C.neg;
                return (
                  <div key={b.al} style={{background:"#f8fafc",borderRadius:10,padding:14,border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontWeight:800,color:"#7c3aed",fontSize:14}}>{b.al}</span>
                      <span style={{fontSize:10,color:C.muted}}>vs</span>
                      <span style={{fontWeight:800,color:"#166534",fontSize:14}}>{b.gd}</span>
                    </div>
                    <div style={{position:"relative",height:22,background:"#e2e8f0",borderRadius:6,marginBottom:6}}>
                      <div style={{position:"absolute",left:0,top:0,width:`${pct}%`,height:"100%",background:col,borderRadius:6,opacity:0.75}}/>
                      <div style={{position:"absolute",left:`${fPct}%`,top:-2,width:2,height:26,background:"#374151",borderRadius:1}}/>
                      <div style={{position:"absolute",left:`${fPct+1}%`,top:-13,fontSize:7,color:"#374151"}}>fair</div>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:4}}>
                      <span>{b.alY.toFixed(2)}% AL</span>
                      <span style={{fontWeight:800,color:col,fontSize:13}}>{b.basisBps}bps</span>
                      <span>{b.gdY.toFixed(2)}% GD</span>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <SignalDot v={b.cheapBps>50?"cheap":b.cheapBps<-50?"rich":"neutral"}/>
                      <span style={{fontSize:9,color:C.muted,marginLeft:6}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bps vs fair</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:"#f1f5f9"}}>
                  {["Par","Yield AL","Yield GD","Basis","Fair","Δ vs Fair","Señal","Interpretación"].map(h=>(<th key={h} style={TH()}>{h}</th>))}
                </tr></thead>
                <tbody>
                  {basis.map((b,i)=>(
                    <tr key={b.al} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{...TD("left"),fontWeight:800,paddingLeft:12}}><span style={{color:"#7c3aed"}}>{b.al}</span><span style={{color:C.muted}}>/</span><span style={{color:"#166534"}}>{b.gd}</span></td>
                      <td style={{...TD(),color:"#7c3aed",fontWeight:700}}>{b.alY.toFixed(2)}%</td>
                      <td style={{...TD(),color:"#166534",fontWeight:700}}>{b.gdY.toFixed(2)}%</td>
                      <td style={{...TD(),fontWeight:800,fontSize:13}}>{b.basisBps}bps</td>
                      <td style={{...TD(),color:C.muted}}>{b.fairBasis}bps</td>
                      <td style={{...TD(),fontWeight:700,color:b.cheapBps>=0?C.pos:C.neg}}>{b.cheapBps>=0?"+":""}{b.cheapBps}bps</td>
                      <td style={TD()}><SignalDot v={b.cheapBps>50?"cheap":b.cheapBps<-50?"rich":"neutral"}/></td>
                      <td style={{...TD("left"),fontSize:9.5,color:C.muted,maxWidth:200}}>
                        {b.cheapBps>100?"AL muy barato — basis ancho inusual":b.cheapBps>0?"AL ligeramente barato":b.cheapBps>-100?"AL levemente caro vs histórico":"AL muy caro vs GD — considerar switch"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            GD (NY Law) tienen más protección para el acreedor. Deben cotizar tighter que AL (Ley Argentina). Fair basis ~175bps post-reestructura. Basis comprimido → AL caro.
          </div>
        </div>
      )}

      {/* ─── VII. BE MATRIX ────────────────────────────────────────────── */}
      {show("be")&&(
        <div style={card}>
          <div style={{padding:"10px 16px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
            <span style={{color:C.white,fontWeight:800,fontSize:13}}>VII · BE Matrix — CER vs LECAP (CPI mensual mínimo)</span>
            <span style={{color:C.blue2,fontSize:10}}>Verde = CER gana con CPI BASE ({beMatrix.avgCPI.toFixed(2)}%/m) · Rojo = necesita más inflación</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
              <thead>
                <tr style={{background:"#f8fafc"}}>
                  <th style={{...TH("left"),minWidth:130}}>CER ↓ \ LECAP →</th>
                  {beMatrix.lec.map(lb=>(<th key={lb.id} style={TH()}><div style={{fontWeight:800,color:"#0369a1"}}>{lb.t}</div><div style={{fontSize:8,fontWeight:400,color:C.muted}}>{lb.y.toFixed(2)}% TEM</div></th>))}
                  <th style={{...TH(),borderLeft:`2px solid ${C.blue1}30`}}>CPI BASE<br/><span style={{fontSize:8,fontWeight:400}}>{beMatrix.avgCPI.toFixed(2)}%/m</span></th>
                </tr>
              </thead>
              <tbody>
                {beMatrix.cer.map((cb,i)=>{
                  const t0cb=mths(cb.m), avgBaseCPI=beMatrix.avgCPI;
                  return (
                    <tr key={cb.id} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{...TD("left"),fontWeight:800,color:"#0d9488",borderLeft:"4px solid #0d948840"}}>
                        <div>{cb.t}</div>
                        <div style={{fontSize:8.5,color:C.muted,fontWeight:400}}>{cb.y.toFixed(2)}% real · {cb.dur}y</div>
                      </td>
                      {beMatrix.lec.map(lb=>{
                        const t0lb=mths(lb.m), h=Math.min(horizon,t0cb,t0lb);
                        const ey=cb.exitYields?.BASE??cb.y;
                        const carry=Math.pow(1+cb.y/100,h/12)-1;
                        const priceChg=-(cb.dur??1)*(ey-cb.y)/100;
                        const lecP0=100/Math.pow(1+lb.y/100,t0lb);
                        const lecEY=lb.exitYields?.BASE??lb.y;
                        const lecP1=100/Math.pow(1+lecEY/100,Math.max(0,t0lb-h));
                        const lecRet=(lecP1/lecP0)*(beMatrix.exitBCS/beMatrix.bcs)-1;
                        const num=(1+lecRet)*(beMatrix.exitBCS/beMatrix.bcs);
                        const denom=(1+carry)*(1+priceChg);
                        const cumCPI=num/denom-1;
                        const be=cumCPI>-1?+((Math.pow(1+cumCPI,1/Math.max(1,h))-1)*100).toFixed(2):null;
                        const beats=be!==null&&be<=avgBaseCPI;
                        const far=be!==null&&be>avgBaseCPI*1.5;
                        return (
                          <td key={lb.id} style={{...TD(),background:beats?"#dcfce7":far?"#fef2f2":"transparent",borderLeft:`1px solid ${C.border}`}}>
                            {be!==null?<><div style={{fontWeight:800,fontSize:12,color:beats?C.pos:far?C.neg:"#f97316"}}>{be}%</div><div style={{fontSize:7.5,color:C.muted}}>{beats?"✓ gana":"✗ necesita más"}</div></>:<span style={{color:C.muted}}>n/a</span>}
                          </td>
                        );
                      })}
                      <td style={{...TD(),borderLeft:`2px solid ${C.blue1}30`,fontSize:9.5,color:C.blue1,fontWeight:700}}>{avgBaseCPI.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`,lineHeight:1.7}}>
            Cada celda = CPI mensual mínimo para que CER supere al LECAP en ret. USD (BASE). Verde = ya gana. Rojo intenso = necesita &gt;1.5× el CPI esperado.
          </div>
        </div>
      )}

      {/* NOTA METODOLÓGICA */}
      <div style={{background:C.card,borderRadius:10,padding:"12px 16px",borderLeft:`4px solid ${C.blue2}`,fontSize:10.5,color:C.muted,lineHeight:1.85}}>
        <strong style={{color:C.blue1,display:"block",marginBottom:4}}>📐 Nota metodológica</strong>
        <strong>Nelson-Siegel:</strong> y(t)=β₀+β₁·(1−e^(−t/τ))/(t/τ)+β₂·[(1−e^(−t/τ))/(t/τ)−e^(−t/τ)]. Grid search τ∈[0.2,6], OLS. Residual +bps → bono cotiza encima de curva (barato en precio). {" "}
        <strong>Atribución:</strong> Carry (accrual) + Δ Precio (−D·ΔY) + Convexidad (½·D²·σ²) + CPI (solo CER) + ΔBcs. Suma aditiva aproximada primer orden. {" "}
        <strong>Sharpe cross-escenario:</strong> ret.medio(BASE/BULL/BEAR) / std(BASE/BULL/BEAR). Mide robustez macroeconómica, no Sharpe tradicional con serie histórica. {" "}
        <strong>PD Duffie-Singleton:</strong> hazard rate λ=spread/(1−R), PD=1−e^(−λ·T). DTS=dur×z-spread normaliza exposición. {" "}
        <strong>Basis AL/GD:</strong> fair ~175bps post-reestructura 2020. Basis comprimido → AL caro relativo a GD. {" "}
        <strong>Score RV:</strong> z(cheapness)×40% + z(carry+roll)×60%. Cross-seccional por asset class. Indicativo solamente.
      </div>
    </div>
  );
}
