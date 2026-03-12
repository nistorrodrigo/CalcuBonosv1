import { useState, useMemo, Fragment } from "react";

// ─── BRAND ─────────────────────────────────────────────────────────────────
const C = {
  navy:"#000039", blue1:"#1e5ab0", blue2:"#3399ff",
  teal:"#23a29e", salmon:"#ebaca2", green:"#acd484",
  white:"#fff", bg:"#edf1f7", card:"#fff",
  border:"#cdd7e8", text:"#0a0d2e", muted:"#5a6880",
  pos:"#16a34a", neg:"#dc2626",
};

// ─── LOGO SVG ───────────────────────────────────────────────────────────────
const Logo = () => (
  <svg height="40" viewBox="0 0 155 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4 C4 4 4 22 4 26 C4 32 9 36 15 36 L24 36 L24 20 C24 12 18 6 10 4 Z"  fill={C.blue1}/>
    <path d="M13 10 C13 10 13 30 13 33 C13 36 17 38 21 38 L30 38 C36 38 40 34 40 28 L40 18 C40 12 35 10 28 10 Z" fill={C.blue2} opacity="0.9"/>
    <text x="50" y="17" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.navy} letterSpacing="2.5">LATIN</text>
    <text x="50" y="35" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.navy} letterSpacing="2.5">SECURITIES</text>
  </svg>
);

// ─── BOND TYPES ─────────────────────────────────────────────────────────────
const TYPES = {
  LECAP:    { label:"Lecap",       color:"#0369a1", ccy:"ARS" },
  FIXED_ARS:{ label:"Tasa Fija",   color:C.blue1,   ccy:"ARS" },
  CER:      { label:"CER",         color:C.teal,    ccy:"ARS" },
  TAMAR:    { label:"TAMAR",       color:"#7c3aed", ccy:"ARS" },
  BADLAR:   { label:"BADLAR",      color:"#9f1239", ccy:"ARS" },
  USD:      { label:"USD",         color:"#166534", ccy:"USD" },
};

// ─── DEFAULT SCENARIOS ───────────────────────────────────────────────────────
const S0 = {
  BASE:{ label:"Base", w:55, col:C.blue1,    cpiM:2.5, tamarM:2.6, badlarM:2.4, fxM:2.0, sdBps:0   },
  BULL:{ label:"Bull", w:25, col:C.teal,     cpiM:1.8, tamarM:1.9, badlarM:1.7, fxM:1.2, sdBps:-100},
  BEAR:{ label:"Bear", w:20, col:C.neg,      cpiM:3.5, tamarM:3.5, badlarM:3.3, fxM:3.8, sdBps:200 },
};

// ─── DEFAULT BONDS ───────────────────────────────────────────────────────────
const B0 = [
  { id:"s29y6", t:"S29Y6",  n:"Lecap May'26",    tp:"LECAP",     p:97.5,  y:31.4, sp:0,   dur:0.2, m:"2026-05-29", active:true },
  { id:"t30j6", t:"T30J6",  n:"Lecap Jun'26",    tp:"LECAP",     p:96.8,  y:32.0, sp:0,   dur:0.3, m:"2026-06-30", active:true },
  { id:"s31g6", t:"S31G6",  n:"Lecap Ago'26",    tp:"LECAP",     p:95.5,  y:31.8, sp:0,   dur:0.5, m:"2026-08-31", active:true },
  { id:"s30o6", t:"S30O6",  n:"Lecap Oct'26",    tp:"LECAP",     p:93.0,  y:31.6, sp:0,   dur:0.6, m:"2026-10-30", active:true },
  { id:"tx26",  t:"TX26",   n:"Boncer Nov'26",   tp:"CER",       p:100.0, y:5.77, sp:0,   dur:0.6, m:"2026-11-09", active:true },
  { id:"tx28",  t:"TX28",   n:"Boncer Nov'28",   tp:"CER",       p:100.0, y:7.98, sp:0,   dur:2.2, m:"2028-11-09", active:true },
  { id:"tx31",  t:"TX31",   n:"Boncer Nov'31",   tp:"CER",       p:100.0, y:8.62, sp:0,   dur:4.0, m:"2031-11-30", active:true },
  { id:"dicp",  t:"DICP",   n:"Discount CER",    tp:"CER",       p:100.0, y:8.63, sp:0,   dur:4.5, m:"2033-12-31", active:true },
  { id:"parp",  t:"PARP",   n:"Par CER",         tp:"CER",       p:100.0, y:8.29, sp:0,   dur:6.0, m:"2038-12-31", active:true },
  { id:"cuap",  t:"CUAP",   n:"Cuasipar CER",    tp:"CER",       p:100.0, y:7.81, sp:0,   dur:7.0, m:"2045-12-31", active:true },
  { id:"ttj26", t:"TTJ26",  n:"TAMAR Jun'26",    tp:"TAMAR",     p:100.0, y:1.93, sp:-0.5,dur:0.3, m:"2026-06-30", active:true },
  { id:"tts26", t:"TTS26",  n:"TAMAR Sep'26",    tp:"TAMAR",     p:100.0, y:3.59, sp:0,   dur:0.5, m:"2026-09-15", active:true },
  { id:"ttd26", t:"TTD26",  n:"TAMAR Dic'26",    tp:"TAMAR",     p:100.0, y:4.11, sp:0,   dur:0.7, m:"2026-12-15", active:true },
  { id:"gd29",  t:"GD29",   n:"Global 2029",     tp:"USD",       p:68.0,  y:7.7,  sp:0,   dur:2.5, m:"2029-07-09", active:true },
  { id:"gd30",  t:"GD30",   n:"Global 2030",     tp:"USD",       p:73.0,  y:8.5,  sp:0,   dur:3.5, m:"2030-07-09", active:true },
  { id:"gd35",  t:"GD35",   n:"Global 2035",     tp:"USD",       p:75.0,  y:9.6,  sp:0,   dur:6.5, m:"2035-07-09", active:true },
  { id:"gd38",  t:"GD38",   n:"Global Ene'38",   tp:"USD",       p:74.0,  y:9.6,  sp:0,   dur:7.0, m:"2038-01-09", active:true },
  { id:"gd41",  t:"GD41",   n:"Global 2041",     tp:"USD",       p:72.5,  y:9.7,  sp:0,   dur:8.0, m:"2041-07-09", active:true },
  { id:"gd46",  t:"GD46",   n:"Global 2046",     tp:"USD",       p:70.0,  y:9.6,  sp:0,   dur:9.0, m:"2046-07-09", active:true },
  { id:"al29",  t:"AL29",   n:"Bonar 2029",      tp:"USD",       p:65.0,  y:10.1, sp:0,   dur:2.5, m:"2029-07-09", active:true },
  { id:"al30",  t:"AL30",   n:"Bonar 2030",      tp:"USD",       p:68.0,  y:10.2, sp:0,   dur:3.2, m:"2030-07-09", active:true },
  { id:"al35",  t:"AL35",   n:"Bonar 2035",      tp:"USD",       p:70.0,  y:9.9,  sp:0,   dur:6.5, m:"2035-07-09", active:true },
  { id:"bpoc7", t:"BPOC7",  n:"Bopreal C 2027",  tp:"USD",       p:91.0,  y:5.7,  sp:0,   dur:1.5, m:"2027-10-31", active:true },
  { id:"bpod7", t:"BPOD7",  n:"Bopreal D 2027",  tp:"USD",       p:89.0,  y:8.2,  sp:0,   dur:1.3, m:"2027-10-31", active:true },
  { id:"bpoa8", t:"BPOA8",  n:"Bopreal A 2028",  tp:"USD",       p:88.0,  y:9.6,  sp:0,   dur:1.8, m:"2028-04-30", active:true },
];

// ─── CALCULATION ENGINE ──────────────────────────────────────────────────────
const NOW = new Date("2026-03-12");
function mths(ds) { return Math.max(0.1, (new Date(ds) - NOW) / (30.44 * 86400000)); }
function cumR(mRate, h) { return Math.pow(1 + mRate / 100, h) - 1; }

function calcReturn(bond, scen, horizon) {
  const T  = mths(bond.m);
  const h  = Math.min(horizon, T);
  const ci = cumR(scen.cpiM, h);
  const fx = cumR(scen.fxM, h);
  const sd = scen.sdBps;
  let rARS = 0, rUSD = 0;

  switch (bond.tp) {
    case "LECAP": {
      const tem = bond.y / 100 / 12;
      rARS = Math.pow(1 + tem, h) - 1;
      rUSD = (1 + rARS) / (1 + fx) - 1;
      break;
    }
    case "FIXED_ARS": {
      const inc = bond.y / 100 * h / 12;
      const durE = -(bond.dur || 2) * sd / 10000;
      rARS = inc + durE;
      rUSD = (1 + rARS) / (1 + fx) - 1;
      break;
    }
    case "CER": {
      const realInc = bond.y / 100 * h / 12;
      const durE = -(bond.dur || 2) * sd / 10000;
      rARS = (1 + realInc + durE) * (1 + ci) - 1;
      rUSD = (1 + rARS) / (1 + fx) - 1;
      break;
    }
    case "TAMAR": {
      const spM = (bond.sp || 0) / 12 / 100;
      rARS = Math.pow(1 + scen.tamarM / 100 + spM, h) - 1;
      rUSD = (1 + rARS) / (1 + fx) - 1;
      break;
    }
    case "BADLAR": {
      const spM = (bond.sp || 0) / 12 / 100;
      rARS = Math.pow(1 + scen.badlarM / 100 + spM, h) - 1;
      rUSD = (1 + rARS) / (1 + fx) - 1;
      break;
    }
    case "USD": {
      const inc = bond.y / 100 * h / 12;
      const durE = -(bond.dur || 3) * sd / 10000;
      rUSD = inc + durE;
      rARS = (1 + rUSD) * (1 + fx) - 1;
      break;
    }
    default: break;
  }
  return { rARS: rARS * 100, rUSD: rUSD * 100 };
}

function calcWt(bond, scens, h) {
  let wA = 0, wU = 0, tw = 0;
  Object.values(scens).forEach(s => {
    const r = calcReturn(bond, s, h);
    wA += r.rARS * s.w; wU += r.rUSD * s.w; tw += s.w;
  });
  return { rARS: wA / tw, rUSD: wU / tw };
}

// ─── CASHFLOW GENERATOR ───────────────────────────────────────────────────────
function genCashflows(bond, scen) {
  const T = mths(bond.m);
  const matDate = new Date(bond.m);
  const rows = [];
  let freq = 2;
  if (bond.tp === "LECAP") freq = 0;
  else if (bond.tp === "TAMAR" || bond.tp === "BADLAR") freq = 4;
  else if (bond.tp === "FIXED_ARS") freq = 2;

  if (freq === 0) {
    rows.push({ date: bond.m, label: "Vencimiento", coupon: 0, principal: 100, total: 100 });
    return rows;
  }

  const nPeriods = Math.max(1, Math.round(T * freq / 12));
  const monthsPerPeriod = 12 / freq;

  for (let i = 1; i <= nPeriods; i++) {
    const d = new Date(matDate);
    d.setMonth(d.getMonth() - Math.round(monthsPerPeriod * (nPeriods - i)));
    const dStr = d.toISOString().slice(0, 10);
    const mFromNow = (d - NOW) / (30.44 * 86400000);
    if (mFromNow < 0) continue;

    let coupon = 0;
    if (bond.tp === "CER") {
      const cumCPI = cumR(scen.cpiM, mFromNow);
      coupon = (bond.y / 100) * (1 + cumCPI) * 100 / freq;
    } else if (bond.tp === "TAMAR") {
      const cumTAMAR = cumR(scen.tamarM, monthsPerPeriod);
      coupon = cumTAMAR * 100;
    } else if (bond.tp === "BADLAR") {
      const cumBADLAR = cumR(scen.badlarM, monthsPerPeriod);
      coupon = cumBADLAR * 100;
    } else {
      coupon = (bond.y / 100) * 100 / freq;
    }

    const principal = i === nPeriods ? 100 : 0;
    rows.push({ date: dStr, label: `Período ${i}`, coupon: +coupon.toFixed(3), principal, total: +(coupon + principal).toFixed(3) });
  }
  return rows;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmtS = (v, d = 1) => {
  const n = +v;
  if (isNaN(n)) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
};
const fmtP = (v, d = 1) => `${(+v).toFixed(d)}%`;

function retColor(v) {
  if (v > 15) return C.pos;
  if (v > 0)  return "#4ade80";
  if (v < -5) return C.neg;
  if (v < 0)  return "#f87171";
  return C.muted;
}
function retUSDColor(v) {
  if (v > 8)  return C.pos;
  if (v > 0)  return "#4ade80";
  if (v < -3) return C.neg;
  if (v < 0)  return "#f87171";
  return C.muted;
}

// ─── BLANK BOND ──────────────────────────────────────────────────────────────
const blankBond = { t:"", n:"", tp:"USD", p:"", y:"", sp:"0", dur:"3", m:"" };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [bonds, setBonds]         = useState(B0);
  const [scens, setScens]         = useState(S0);
  const [horizon, setHorizon]     = useState(12);
  const [showPanel, setShowPanel] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [newBond, setNewBond]     = useState(blankBond);
  const [sortBy, setSortBy]       = useState("wARS");
  const [filterTp, setFilterTp]   = useState("ALL");
  const [cfBond, setCfBond]       = useState(null);
  const [tab, setTab]             = useState("results"); // "results" | "cashflow"
  const [cfScen, setCfScen]       = useState("BASE");

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const activeBonds = bonds.filter(b => b.active);

  const results = useMemo(() => {
    return activeBonds
      .filter(b => filterTp === "ALL" || b.tp === filterTp)
      .map(b => {
        const byScen = {};
        Object.entries(scens).forEach(([k, s]) => { byScen[k] = calcReturn(b, s, horizon); });
        const wt = calcWt(b, scens, horizon);
        return { ...b, byScen, wt };
      })
      .sort((a, b_) => {
        if (sortBy === "wARS")    return b_.wt.rARS - a.wt.rARS;
        if (sortBy === "wUSD")    return b_.wt.rUSD - a.wt.rUSD;
        if (sortBy === "baseARS") return b_.byScen.BASE.rARS - a.byScen.BASE.rARS;
        if (sortBy === "baseUSD") return b_.byScen.BASE.rUSD - a.byScen.BASE.rUSD;
        return 0;
      });
  }, [activeBonds, scens, horizon, sortBy, filterTp]);

  // ── MUTATIONS ──────────────────────────────────────────────────────────────
  const removeBond  = id => setBonds(p => p.filter(b => b.id !== id));
  const toggleBond  = id => setBonds(p => p.map(b => b.id === id ? { ...b, active: !b.active } : b));
  const updateScen  = (k, f, v) => setScens(p => ({ ...p, [k]: { ...p[k], [f]: +v || 0 } }));

  const addBond = () => {
    if (!newBond.t || !newBond.m || !newBond.p || !newBond.y) return;
    setBonds(p => [...p, {
      id: `${newBond.t.toLowerCase()}_${Date.now()}`,
      t: newBond.t, n: newBond.n || newBond.t, tp: newBond.tp,
      p: +newBond.p, y: +newBond.y, sp: +newBond.sp,
      dur: +newBond.dur, m: newBond.m, active: true,
    }]);
    setNewBond(blankBond);
    setShowAdd(false);
  };

  // ── CASHFLOW DATA ──────────────────────────────────────────────────────────
  const cfData = useMemo(() => {
    if (!cfBond) return [];
    return genCashflows(cfBond, scens[cfScen]);
  }, [cfBond, cfScen, scens]);

  const scenKeys = Object.keys(scens);

  // ── CUMULATIVE DISPLAY ─────────────────────────────────────────────────────
  const cumDisplay = (scen) => {
    const h = horizon;
    const ci  = (cumR(scen.cpiM,   h)*100).toFixed(1);
    const ct  = (cumR(scen.tamarM, h)*100).toFixed(1);
    const fx  = (cumR(scen.fxM,    h)*100).toFixed(1);
    return `CPI ${ci}%  TAMAR ${ct}%  FX +${fx}%`;
  };

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const card = {
    background: C.card, borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,57,.08)",
    overflow: "hidden",
  };
  const pill = (color, bg) => ({
    display: "inline-block", padding: "2px 9px", borderRadius: 20,
    fontSize: 11, fontWeight: 700, color, background: bg || color+"18",
  });
  const btn = (primary) => ({
    padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 700, fontSize: 13,
    background: primary ? C.blue1 : "rgba(255,255,255,.1)",
    color: C.white,
  });

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background: C.bg, minHeight:"100vh", color: C.text }}>

      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        background: C.navy, padding:"0 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:64, boxShadow:"0 2px 12px rgba(0,0,57,.5)",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <Logo />
          <div style={{ borderLeft:`1px solid ${C.blue1}`, paddingLeft:16 }}>
            <div style={{ color:C.white, fontWeight:700, fontSize:17, letterSpacing:0.3 }}>Bond Total Return</div>
            <div style={{ color:C.blue2, fontSize:11, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase" }}>Calculadora</div>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ color:"#7090b0", fontSize:12 }}>Horizonte:</span>
          <select value={horizon} onChange={e=>setHorizon(+e.target.value)} style={{
            background:C.blue1, color:C.white, border:"none",
            borderRadius:7, padding:"5px 10px", fontWeight:700, cursor:"pointer", fontSize:13,
          }}>
            {[3,6,9,12,18,24,36].map(m=>(
              <option key={m} value={m}>{m >= 12 ? `${m/12} año${m>12?"s":""}` : `${m}m`}</option>
            ))}
          </select>

          <button onClick={()=>setShowPanel(v=>!v)} style={{
            ...btn(showPanel), border:`1px solid ${showPanel ? C.blue2 : "rgba(255,255,255,.2)"}`,
          }}>
            ⚙ Escenarios
          </button>
          <button onClick={()=>setShowAdd(true)} style={{
            background:C.blue2, color:C.white, border:"none",
            borderRadius:8, padding:"7px 16px", cursor:"pointer",
            fontWeight:700, fontSize:13,
          }}>
            + Agregar Bono
          </button>
        </div>
      </header>

      {/* ─── SCENARIO PANEL ──────────────────────────────────────────────── */}
      {showPanel && (
        <div style={{
          background: "#03003d", borderBottom:`2px solid ${C.blue1}`,
          padding:"20px 24px",
        }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
            {Object.entries(scens).map(([key, s]) => (
              <div key={key} style={{
                background:"rgba(255,255,255,.05)",
                borderRadius:12, padding:16,
                borderTop:`3px solid ${s.col}`,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <span style={{ color:s.col, fontWeight:800, fontSize:15 }}>{s.label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ color:"#7090b0", fontSize:11 }}>Peso:</span>
                    <input type="number" value={s.w} onChange={e=>updateScen(key,"w",e.target.value)}
                      style={{ width:44, background:"rgba(255,255,255,.12)", border:"none",
                               color:C.white, borderRadius:5, padding:"2px 5px", textAlign:"right", fontWeight:700 }} />
                    <span style={{ color:"#7090b0", fontSize:11 }}>%</span>
                  </div>
                </div>

                {[
                  ["CPI Mensual (%)",   "cpiM"],
                  ["TAMAR Mensual (%)", "tamarM"],
                  ["BADLAR Mensual (%)", "badlarM"],
                  ["FX Mensual (%)",    "fxM"],
                  ["Δ Spread (bps)",    "sdBps"],
                ].map(([lbl, field]) => (
                  <div key={field} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                    <label style={{ color:"#8090a8", fontSize:11 }}>{lbl}</label>
                    <input type="number" step="0.1" value={s[field]}
                      onChange={e=>updateScen(key,field,e.target.value)}
                      style={{
                        width:70, background:"rgba(255,255,255,.12)", border:"none",
                        color:C.white, borderRadius:5, padding:"3px 8px",
                        textAlign:"right", fontSize:13,
                      }} />
                  </div>
                ))}

                <div style={{ marginTop:10, padding:"8px 10px", background:"rgba(255,255,255,.04)", borderRadius:7 }}>
                  <span style={{ color:"#6080a0", fontSize:10 }}>Acum. {horizon}m → </span>
                  <span style={{ color:s.col, fontSize:11, fontWeight:600 }}>{cumDisplay(s)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div style={{ padding:"16px 24px" }}>

        {/* Stats bar */}
        {(() => {
          const bestARS = results.length ? [...results].sort((a,b)=>b.byScen.BASE.rARS-a.byScen.BASE.rARS)[0] : null;
          const bestUSD = results.length ? [...results].sort((a,b)=>b.byScen.BASE.rUSD-a.byScen.BASE.rUSD)[0] : null;
          const stats = [
            ["Bonos activos", activeBonds.length, C.blue2, ""],
            ["Mejor ARS (Base)", bestARS ? `${bestARS.t}: ${fmtP(bestARS.byScen.BASE.rARS)}` : "-", C.teal, ""],
            ["Mejor USD (Base)", bestUSD ? `${bestUSD.t}: ${fmtP(bestUSD.byScen.BASE.rUSD)}` : "-", C.green, ""],
          ];
          return (
        <div style={{ display:"flex", gap:12, marginBottom:14 }}>
          {stats.map(([label, val, col]) => (
            <div key={label} style={{
              background:C.card, borderRadius:9, padding:"10px 18px",
              boxShadow:"0 1px 6px rgba(0,0,57,.07)",
              borderLeft:`3px solid ${col}`,
            }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:col }}>{val}</div>
            </div>
          ))}
          <div style={{ flex:1 }}/>
        </div>
          );
        })()}

        {/* Filters + Sort */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["ALL", ...Object.keys(TYPES)].map(tp => {
              const cfg = TYPES[tp];
              const active = filterTp === tp;
              return (
                <button key={tp} onClick={()=>setFilterTp(tp)} style={{
                  padding:"5px 13px", borderRadius:20,
                  border: active ? "none" : `1px solid ${C.border}`,
                  cursor:"pointer", fontSize:12, fontWeight:600,
                  background: active ? (cfg?.color || C.navy) : C.card,
                  color: active ? C.white : C.muted,
                  boxShadow: active ? "0 2px 8px rgba(0,0,0,.15)" : "none",
                }}>
                  {tp === "ALL" ? "Todos" : cfg.label}
                </button>
              );
            })}
          </div>

          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.muted }}>Ordenar:</span>
            {[["wARS","Pond. ARS"],["wUSD","Pond. USD"],["baseARS","Base ARS"],["baseUSD","Base USD"]].map(([k,lbl])=>(
              <button key={k} onClick={()=>setSortBy(k)} style={{
                padding:"4px 10px", borderRadius:7, fontSize:12,
                border:`1px solid ${C.border}`, cursor:"pointer",
                background: sortBy===k ? C.blue1 : C.card,
                color: sortBy===k ? C.white : C.muted,
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* ─── RESULTS TABLE ─────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:C.navy }}>
                  <th style={TH()}>#</th>
                  <th style={TH("left")}>Bono</th>
                  <th style={TH("left")}>Tipo</th>
                  <th style={TH()}>Precio</th>
                  <th style={TH()}>TIR</th>
                  <th style={TH()}>Dur</th>
                  <th style={TH()}>Vcto</th>
                  {scenKeys.map(k=>(
                    <th key={k} colSpan={2} style={{
                      ...TH(), borderLeft:`2px solid ${scens[k].col}`,
                      color:scens[k].col,
                    }}>{scens[k].label}</th>
                  ))}
                  <th colSpan={2} style={{ ...TH(), borderLeft:"2px solid gold", color:"gold" }}>Pond.</th>
                  <th style={TH()}></th>
                </tr>
                <tr style={{ background:"#05003d" }}>
                  <th style={TH2()}></th>
                  <th style={TH2()}></th>
                  <th style={TH2()}></th>
                  <th style={TH2()}>%VN</th>
                  <th style={TH2()}>%</th>
                  <th style={TH2()}>años</th>
                  <th style={TH2()}>fecha</th>
                  {scenKeys.map(k=>(
                    <Fragment key={k}>
                      <th style={{ ...TH2(), borderLeft:`2px solid ${scens[k].col}40` }}>ARS</th>
                      <th style={TH2()}>USD</th>
                    </Fragment>
                  ))}
                  <th style={{ ...TH2(), borderLeft:"2px solid rgba(255,215,0,.4)" }}>ARS</th>
                  <th style={TH2()}>USD</th>
                  <th style={TH2()}></th>
                </tr>
              </thead>
              <tbody>
                {results.map((b, i) => {
                  const tc = TYPES[b.tp];
                  return (
                    <tr key={b.id}
                      onClick={()=>{ setCfBond(b); }}
                      style={{
                        background: i%2===0 ? C.card : C.bg,
                        borderBottom:`1px solid ${C.border}`,
                        cursor:"pointer",
                        transition:"background .12s",
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="#e0eafc"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background = i%2===0?C.card:C.bg; }}
                    >
                      <td style={TD("center")}>
                        <span style={{
                          display:"inline-flex", alignItems:"center", justifyContent:"center",
                          width:22, height:22, borderRadius:"50%",
                          background: i===0?C.blue2:i===1?"#4ade80":i===2?"#facc15":C.border,
                          fontSize:11, fontWeight:700,
                          color: i<3 ? C.white : C.muted,
                        }}>{i+1}</span>
                      </td>
                      <td style={TD()}>
                        <div style={{ fontWeight:800, color:C.navy, fontSize:14 }}>{b.t}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{b.n}</div>
                      </td>
                      <td style={TD()}>
                        <span style={pill(tc?.color||C.muted)}>{tc?.label||b.tp}</span>
                      </td>
                      <td style={{ ...TD("right"), fontWeight:600 }}>
                        {tc?.ccy==="USD"?"$":""}{(+b.p).toFixed(2)}
                      </td>
                      <td style={{ ...TD("right"), fontWeight:600 }}>
                        {(+b.y).toFixed(2)}%
                      </td>
                      <td style={{ ...TD("right"), color:C.muted }}>
                        {(+b.dur).toFixed(1)}
                      </td>
                      <td style={{ ...TD("center"), fontSize:11, color:C.muted }}>
                        {b.m.slice(0,7)}
                      </td>

                      {scenKeys.map(k=>{
                        const r = b.byScen[k];
                        return (
                          <Fragment key={k}>
                            <td style={{
                              ...TD("right"),
                              borderLeft:`2px solid ${scens[k].col}25`,
                              fontWeight:700,
                              color: retColor(r.rARS),
                            }}>{fmtS(r.rARS)}</td>
                            <td style={{
                              ...TD("right"),
                              color: retUSDColor(r.rUSD),
                              fontWeight:600, fontSize:12,
                            }}>{fmtS(r.rUSD)}</td>
                          </Fragment>
                        );
                      })}

                      <td style={{
                        ...TD("right"),
                        borderLeft:"2px solid rgba(255,215,0,.3)",
                        fontWeight:800, fontSize:15,
                        color: retColor(b.wt.rARS),
                      }}>{fmtS(b.wt.rARS)}</td>
                      <td style={{
                        ...TD("right"),
                        fontWeight:700,
                        color: retUSDColor(b.wt.rUSD),
                      }}>{fmtS(b.wt.rUSD)}</td>

                      <td style={TD("center")}>
                        <button onClick={e=>{e.stopPropagation();removeBond(b.id);}} style={{
                          background:"none", border:"none", cursor:"pointer",
                          color:C.neg, fontSize:15, lineHeight:1, padding:"2px 5px",
                        }} title="Eliminar">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {results.length===0&&(
              <div style={{ padding:40, textAlign:"center", color:C.muted }}>
                No hay bonos. Cambiá el filtro o agregá un bono.
              </div>
            )}
          </div>
        </div>

        {/* Inactive bonds */}
        {bonds.filter(b=>!b.active).length>0&&(
          <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.muted }}>Desactivados:</span>
            {bonds.filter(b=>!b.active).map(b=>(
              <button key={b.id} onClick={()=>toggleBond(b.id)} style={{
                padding:"3px 10px", borderRadius:20,
                border:`1px solid ${C.border}`,
                background:C.card, color:C.muted, cursor:"pointer", fontSize:12,
              }}>↩ {b.t}</button>
            ))}
          </div>
        )}

        {/* Notes */}
        <div style={{
          marginTop:12, padding:"10px 16px",
          background:C.card, borderRadius:8,
          borderLeft:`3px solid ${C.blue2}`,
          fontSize:11, color:C.muted, lineHeight:1.7,
        }}>
          <strong style={{color:C.blue1}}>Metodología:</strong>{" "}
          <strong>Lecap:</strong> compounding al TEM implícito (TNA÷12).{" "}
          <strong>CER:</strong> retorno real × (1 + CPI acumulado) — variación de spread vía duración.{" "}
          <strong>TAMAR/BADLAR:</strong> tasa flotante compuesta mensualmente + spread.{" "}
          <strong>USD:</strong> carry de TIR + efecto duración por cambio de spread; conversión ARS via FX proyectado.{" "}
          Hacé click en cualquier bono para ver el flujo de fondos proyectado.
        </div>
      </div>

      {/* ═══ CASHFLOW MODAL ════════════════════════════════════════════════ */}
      {cfBond && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,35,.75)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
        }} onClick={e=>e.target===e.currentTarget&&setCfBond(null)}>
          <div style={{
            background:C.card, borderRadius:16, width:580,
            maxHeight:"80vh", display:"flex", flexDirection:"column",
            boxShadow:"0 24px 80px rgba(0,0,57,.5)",
            border:`1px solid ${C.border}`,
          }}>
            {/* Modal header */}
            <div style={{
              background:C.navy, borderRadius:"16px 16px 0 0",
              padding:"16px 22px",
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div>
                <span style={{ color:C.white, fontWeight:800, fontSize:17 }}>{cfBond.t}</span>
                <span style={{ color:C.blue2, fontSize:13, marginLeft:10 }}>{cfBond.n}</span>
              </div>
              <button onClick={()=>setCfBond(null)} style={{
                background:"none", border:"none", color:"#7090b0",
                fontSize:20, cursor:"pointer",
              }}>✕</button>
            </div>

            {/* Bond summary */}
            <div style={{
              padding:"12px 22px",
              background:"#f7f9fc",
              borderBottom:`1px solid ${C.border}`,
              display:"flex", gap:20, flexWrap:"wrap",
            }}>
              {[
                ["Tipo",     TYPES[cfBond.tp]?.label || cfBond.tp],
                ["Precio",   `${cfBond.p}%`],
                ["TIR",      `${cfBond.y}%`],
                ["Duración", `${cfBond.dur} años`],
                ["Vencimiento", cfBond.m],
              ].map(([k,v])=>(
                <div key={k}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:2 }}>{k}</div>
                  <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Scenario selector */}
            <div style={{ padding:"10px 22px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <span style={{ fontSize:12, color:C.muted, alignSelf:"center" }}>Escenario flujo:</span>
              {Object.entries(scens).map(([k,s])=>(
                <button key={k} onClick={()=>setCfScen(k)} style={{
                  padding:"4px 14px", borderRadius:20, border:"none", cursor:"pointer",
                  fontWeight:700, fontSize:12,
                  background: cfScen===k ? s.col : C.bg,
                  color: cfScen===k ? C.white : C.muted,
                }}>{s.label}</button>
              ))}
            </div>

            {/* Returns summary */}
            <div style={{
              padding:"10px 22px",
              background:`${scens[cfScen].col}08`,
              borderBottom:`1px solid ${C.border}`,
              display:"flex", gap:20,
            }}>
              {[
                ["Retorno ARS", calcReturn(cfBond, scens[cfScen], horizon).rARS, "%", retColor],
                ["Retorno USD", calcReturn(cfBond, scens[cfScen], horizon).rUSD, "%", retUSDColor],
              ].map(([lbl,val,,colorFn])=>(
                <div key={lbl}>
                  <div style={{ fontSize:11, color:C.muted }}>{lbl} ({horizon}m)</div>
                  <div style={{ fontWeight:800, fontSize:22, color:colorFn(val) }}>{fmtS(val)}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize:11, color:C.muted }}>CPI acum.</div>
                <div style={{ fontWeight:700, fontSize:16, color:C.teal }}>+{(cumR(scens[cfScen].cpiM,horizon)*100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize:11, color:C.muted }}>FX acum.</div>
                <div style={{ fontWeight:700, fontSize:16, color:C.salmon }}>+{(cumR(scens[cfScen].fxM,horizon)*100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Cashflows table */}
            <div style={{ overflowY:"auto", flex:1, padding:"0 0 4px 0" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.navy, position:"sticky", top:0 }}>
                    {["Fecha","Período","Cupón","Principal","Total"].map(h=>(
                      <th key={h} style={{ padding:"8px 14px", color:"rgba(255,255,255,.75)", fontWeight:600, fontSize:11, textAlign:h==="Fecha"||h==="Período"?"left":"right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfData.map((row,i)=>(
                    <tr key={i} style={{
                      background: i%2===0?C.card:C.bg,
                      borderBottom:`1px solid ${C.border}`,
                    }}>
                      <td style={{ padding:"7px 14px", color:C.muted }}>{row.date}</td>
                      <td style={{ padding:"7px 14px", color:C.text, fontWeight:600 }}>{row.label}</td>
                      <td style={{ padding:"7px 14px", textAlign:"right", color: row.coupon>0?C.teal:C.muted }}>
                        {row.coupon>0?`+${row.coupon.toFixed(2)}`:"-"}
                      </td>
                      <td style={{ padding:"7px 14px", textAlign:"right", color: row.principal>0?C.blue1:C.muted }}>
                        {row.principal>0?`+${row.principal.toFixed(0)}`:"-"}
                      </td>
                      <td style={{ padding:"7px 14px", textAlign:"right", fontWeight:700, color:C.pos }}>
                        +{row.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cfData.length===0&&(
                <div style={{ padding:30, textAlign:"center", color:C.muted }}>
                  No hay flujos proyectados disponibles.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADD BOND MODAL ════════════════════════════════════════════════ */}
      {showAdd && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,35,.75)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000,
        }} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{
            background:C.card, borderRadius:16, padding:28, width:500,
            boxShadow:"0 24px 80px rgba(0,0,57,.5)",
            border:`1px solid ${C.border}`,
          }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, color:C.navy, fontSize:18 }}>Agregar Bono</h3>
              <button onClick={()=>setShowAdd(false)} style={{ background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.muted }}>✕</button>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                ["Ticker *", "t", "text", "ej: GD35"],
                ["Nombre", "n", "text", "ej: Global 2035"],
                ["Precio (%VN) *", "p", "number", "ej: 75.0"],
                ["TIR Anual (%) *", "y", "number", "ej: 9.6"],
                ["Spread (%)", "sp", "number", "ej: 0 (TAMAR+X)"],
                ["Duración (años)", "dur", "number", "ej: 6.5"],
              ].map(([lbl,f,tp,ph])=>(
                <div key={f}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>{lbl}</label>
                  <input type={tp} placeholder={ph} value={newBond[f]}
                    onChange={e=>setNewBond(p=>({...p,[f]:e.target.value}))}
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8,
                             border:`1.5px solid ${C.border}`, fontSize:13, boxSizing:"border-box",
                             outline:"none",
                    }} />
                </div>
              ))}

              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Tipo *</label>
                <select value={newBond.tp} onChange={e=>setNewBond(p=>({...p,tp:e.target.value}))} style={{
                  width:"100%", padding:"9px 12px", borderRadius:8,
                  border:`1.5px solid ${C.border}`, fontSize:13,
                }}>
                  {Object.entries(TYPES).map(([k,v])=>(
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:4 }}>Vencimiento *</label>
                <input type="date" value={newBond.m} onChange={e=>setNewBond(p=>({...p,m:e.target.value}))}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8,
                           border:`1.5px solid ${C.border}`, fontSize:13, boxSizing:"border-box" }} />
              </div>
            </div>

            {/* Type helper */}
            <div style={{
              marginTop:14, padding:"10px 14px", background:C.bg,
              borderRadius:8, fontSize:11, color:C.muted, lineHeight:1.6,
            }}>
              <strong style={{color:C.text}}>Tipo seleccionado: {TYPES[newBond.tp]?.label}</strong>{" — "}
              {newBond.tp==="LECAP"     && "TIR = TNA (tasa nominal anual). Sin cupón explícito."}
              {newBond.tp==="CER"       && "TIR = tasa real. El retorno nominal incluye ajuste CPI."}
              {newBond.tp==="TAMAR"     && "Spread sobre TAMAR. TIR es referencial; usar Spread para la diferencia."}
              {newBond.tp==="BADLAR"    && "Spread sobre BADLAR. Similar a TAMAR."}
              {newBond.tp==="USD"       && "TIR en dólares. Conversión a ARS por FX proyectado."}
              {newBond.tp==="FIXED_ARS" && "Tasa fija en pesos. TIR = tasa anual."}
            </div>

            <div style={{ display:"flex", gap:10, marginTop:18 }}>
              <button onClick={addBond} style={{
                flex:1, padding:"11px 0", borderRadius:8,
                background:C.blue1, color:C.white, border:"none",
                fontWeight:800, fontSize:14, cursor:"pointer",
              }}>
                ✓ Agregar Bono
              </button>
              <button onClick={()=>setShowAdd(false)} style={{
                padding:"11px 20px", borderRadius:8,
                background:C.bg, color:C.muted,
                border:`1px solid ${C.border}`, cursor:"pointer",
              }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TABLE STYLE HELPERS ─────────────────────────────────────────────────────
function TH(align = "center") {
  return {
    padding:"10px 10px", color:"rgba(255,255,255,.75)",
    fontWeight:600, fontSize:11, letterSpacing:0.5,
    textAlign:align, textTransform:"uppercase", whiteSpace:"nowrap",
  };
}
function TH2() {
  return { padding:"4px 10px", color:"rgba(255,255,255,.4)", fontWeight:500, fontSize:10, textAlign:"center" };
}
function TD(align = "left") {
  return { padding:"10px 10px", whiteSpace:"nowrap", textAlign:align };
}
