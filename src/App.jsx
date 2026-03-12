import { useState, useMemo, Fragment } from "react";

// ─── BRAND ─────────────────────────────────────────────────────────────────
const C = {
  navy:"#000039", blue1:"#1e5ab0", blue2:"#3399ff",
  teal:"#23a29e", salmon:"#ebaca2", green:"#acd484",
  white:"#fff", bg:"#edf1f7", card:"#fff",
  border:"#cdd7e8", text:"#0a0d2e", muted:"#5a6880",
  pos:"#16a34a", neg:"#dc2626",
};

const Logo = () => (
  <svg height="40" viewBox="0 0 155 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4 C4 4 4 22 4 26 C4 32 9 36 15 36 L24 36 L24 20 C24 12 18 6 10 4 Z" fill={C.blue1}/>
    <path d="M13 10 C13 10 13 30 13 33 C13 36 17 38 21 38 L30 38 C36 38 40 34 40 28 L40 18 C40 12 35 10 28 10 Z" fill={C.blue2} opacity="0.9"/>
    <text x="50" y="17" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.navy} letterSpacing="2.5">LATIN</text>
    <text x="50" y="35" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.navy} letterSpacing="2.5">SECURITIES</text>
  </svg>
);

const TYPES = {
  LECAP:    { label:"Lecap",     color:"#0369a1", ccy:"ARS" },
  CER:      { label:"CER",       color:C.teal,    ccy:"ARS" },
  TAMAR:    { label:"TAMAR",     color:"#7c3aed", ccy:"ARS" },
  BADLAR:   { label:"BADLAR",    color:"#9f1239", ccy:"ARS" },
  FIXED_ARS:{ label:"Tasa Fija", color:C.blue1,   ccy:"ARS" },
  USD:      { label:"USD",       color:"#166534", ccy:"USD" },
};

// ─── ESCENARIOS (exit BCS en lugar de FX mensual) ────────────────────────
// BCS BASE 1,554 | BULL 1,432 | BEAR 1,589  (extraído del TEST PDF)
const S0 = {
  BASE:{ label:"Base", w:55, col:C.blue1, cpiM:2.6, tamarM:2.5, badlarM:2.3, exitBCS:1554 },
  BULL:{ label:"Bull", w:25, col:C.teal,  cpiM:1.8, tamarM:1.9, badlarM:1.7, exitBCS:1432 },
  BEAR:{ label:"Bear", w:20, col:C.neg,   cpiM:3.2, tamarM:3.3, badlarM:3.1, exitBCS:1589 },
};

// currentBCS = 1,447  (verificado contra TEST PDF — constante de mercado hoy)
const DEFAULT_CURRENT_BCS = 1447;

// ─── BONDS ──────────────────────────────────────────────────────────────────
// exitYields: {BASE, BULL, BEAR} — extraídos del TEST PDF (EY SCENARIOS)
// Para Lecap: TEM mensual %
// Para CER:   tasa real anual %
// Para USD:   TIR anual %
// Para TAMAR/BADLAR: no price-based, carry puro

const B0 = [
  // ── LECAP ─────────────────────────────────────────────────────────────────
  { id:"s29y6",  t:"S29Y6",  n:"Lecap May'26",      tp:"LECAP", y:2.48, m:"2026-05-29", active:true,
    exitYields:{BASE:2.45, BULL:1.75, BEAR:3.40} },
  { id:"t30j6",  t:"T30J6",  n:"Lecap Jun'26",      tp:"LECAP", y:2.47, m:"2026-06-30", active:true,
    exitYields:{BASE:2.50, BULL:1.80, BEAR:3.50} },
  { id:"s31l6",  t:"S31L6",  n:"Lecap Jul'26",      tp:"LECAP", y:2.44, m:"2026-07-31", active:true,
    exitYields:{BASE:2.50, BULL:1.80, BEAR:3.30} },
  { id:"s31g6",  t:"S31G6",  n:"Lecap Ago'26",      tp:"LECAP", y:2.45, m:"2026-08-31", active:true,
    exitYields:{BASE:2.50, BULL:1.70, BEAR:3.30} },
  { id:"s30o6",  t:"S30O6",  n:"Lecap Oct'26",      tp:"LECAP", y:2.47, m:"2026-10-30", active:true,
    exitYields:{BASE:2.40, BULL:1.60, BEAR:3.30} },
  { id:"s30n6",  t:"S30N6",  n:"Lecap Nov'26",      tp:"LECAP", y:2.49, m:"2026-11-30", active:true,
    exitYields:{BASE:2.40, BULL:1.60, BEAR:3.40} },
  { id:"to26",   t:"TO26",   n:"Lecap Oct17'26",    tp:"LECAP", y:2.53, m:"2026-10-17", active:true,
    exitYields:{BASE:2.40, BULL:1.60, BEAR:3.40} },
  { id:"t15e7",  t:"T15E7",  n:"Lecap Ene'27",      tp:"LECAP", y:2.46, m:"2027-01-15", active:true,
    exitYields:{BASE:2.30, BULL:1.60, BEAR:3.50} },
  { id:"t30a7",  t:"T30A7",  n:"Lecap Abr'27",      tp:"LECAP", y:2.43, m:"2027-04-30", active:true,
    exitYields:{BASE:2.30, BULL:1.60, BEAR:3.50} },
  { id:"t31y7",  t:"T31Y7",  n:"Lecap May'27",      tp:"LECAP", y:2.42, m:"2027-05-31", active:true,
    exitYields:{BASE:2.20, BULL:1.60, BEAR:3.40} },
  { id:"t30j7",  t:"T30J7",  n:"Lecap Jun'27",      tp:"LECAP", y:2.36, m:"2027-06-30", active:true,
    exitYields:{BASE:2.20, BULL:1.60, BEAR:3.40} },
  { id:"ty30p_30",t:"TY30P", n:"Lecap May'30",      tp:"LECAP", y:2.03, m:"2030-05-30", active:true,
    exitYields:{BASE:1.90, BULL:1.60, BEAR:2.90} },
  { id:"ty30p_27",t:"TY30P2",n:"Lecap May'27 (b)",  tp:"LECAP", y:1.57, m:"2027-05-30", active:false,
    exitYields:{BASE:2.30, BULL:1.60, BEAR:3.50} },
  { id:"m31g6",  t:"M31G6",  n:"M31G6 Ago'26",      tp:"LECAP", y:3.51, m:"2026-08-31", active:true,
    exitYields:{BASE:2.50, BULL:1.70, BEAR:3.30} },
  { id:"tmf27",  t:"TMF27",  n:"TMF27 Feb'27",       tp:"LECAP", y:-5.06/12, m:"2027-02-26", active:true,
    exitYields:{BASE:2.30, BULL:1.60, BEAR:3.50} },

  // ── CER ───────────────────────────────────────────────────────────────────
  { id:"x29y6",  t:"X29Y6",  n:"CER May'26",        tp:"CER",   y:-0.15, dur:0.1, m:"2026-05-29", active:true,
    exitYields:{BASE:1.10, BULL:4.90, BEAR:17.40} },
  { id:"tzx26",  t:"TZX26",  n:"CER Jun'26",        tp:"CER",   y:2.06, dur:0.25,  m:"2026-06-30", active:true,
    exitYields:{BASE:2.20, BULL:6.30, BEAR:15.60} },
  { id:"x31l6",  t:"X31L6",  n:"CER Jul'26",        tp:"CER",   y:2.15, dur:0.35,  m:"2026-07-31", active:true,
    exitYields:{BASE:3.30, BULL:6.30, BEAR:14.80} },
  { id:"tx26",   t:"TX26",   n:"Boncer Nov'26",      tp:"CER",   y:4.11, dur:0.35,  m:"2026-11-09", active:true,
    exitYields:{BASE:3.80, BULL:6.30, BEAR:14.50} },
  { id:"tzxo6",  t:"TZXO6",  n:"CER Oct'26",        tp:"CER",   y:5.48, dur:0.42,  m:"2026-10-30", active:true,
    exitYields:{BASE:4.50, BULL:6.30, BEAR:14.00} },
  { id:"x30n6",  t:"X30N6",  n:"CER Nov'26",        tp:"CER",   y:5.67, dur:0.5,  m:"2026-11-30", active:true,
    exitYields:{BASE:4.80, BULL:6.30, BEAR:14.00} },
  { id:"tzxd6",  t:"TZXD6",  n:"CER Dic'26",        tp:"CER",   y:5.66, dur:0.55,  m:"2026-12-15", active:true,
    exitYields:{BASE:4.80, BULL:6.30, BEAR:13.80} },
  { id:"tzxm7",  t:"TZXM7",  n:"CER Mar'27",        tp:"CER",   y:6.71, dur:0.8,  m:"2027-03-31", active:true,
    exitYields:{BASE:5.40, BULL:6.30, BEAR:13.60} },
  { id:"tzx27",  t:"TZX27",  n:"CER Jun'27",        tp:"CER",   y:6.90, dur:0.95,  m:"2027-06-30", active:true,
    exitYields:{BASE:5.80, BULL:6.30, BEAR:13.70} },
  { id:"tx28",   t:"TX28",   n:"Boncer Nov'28",      tp:"CER",   y:7.24, dur:1.2,  m:"2028-11-09", active:true,
    exitYields:{BASE:5.90, BULL:6.30, BEAR:13.60} },
  { id:"tzxd7",  t:"TZXD7",  n:"CER Dic'27",        tp:"CER",   y:7.82, dur:1.55,  m:"2027-12-15", active:true,
    exitYields:{BASE:6.10, BULL:6.30, BEAR:12.90} },
  { id:"tzx28",  t:"TZX28",  n:"CER Jun'28",        tp:"CER",   y:8.57, dur:2.2,  m:"2028-06-30", active:true,
    exitYields:{BASE:6.50, BULL:6.30, BEAR:12.80} },
  { id:"tx31",   t:"TX31",   n:"Boncer Nov'31",      tp:"CER",   y:8.48, dur:2.8,  m:"2031-11-30", active:true,
    exitYields:{BASE:7.00, BULL:6.30, BEAR:12.90} },
  { id:"dicp",   t:"DICP",   n:"Discount CER '33",   tp:"CER",   y:8.66, dur:3.0,  m:"2033-12-31", active:true,
    exitYields:{BASE:7.00, BULL:6.30, BEAR:12.50} },
  { id:"parp",   t:"PARP",   n:"Par CER '38",        tp:"CER",   y:8.66, dur:5.50, m:"2038-12-31", active:true,
    exitYields:{BASE:8.00, BULL:6.70, BEAR:12.20} },
  { id:"cuap",   t:"CUAP",   n:"Cuasipar CER '45",   tp:"CER",   y:7.75, dur:5.6,  m:"2045-12-31", active:true,
    exitYields:{BASE:8.40, BULL:7.40, BEAR:11.90} },

  // ── TAMAR ─────────────────────────────────────────────────────────────────
  { id:"ttj26",  t:"TTJ26",  n:"TAMAR Jun'26",      tp:"TAMAR", y:1.93, sp:-0.5, m:"2026-06-30", active:true,
    exitYields:{BASE:2.50, BULL:1.80, BEAR:3.50} },
  { id:"tts26",  t:"TTS26",  n:"TAMAR Sep'26",      tp:"TAMAR", y:3.59, sp:0,    m:"2026-09-15", active:true,
    exitYields:{BASE:2.40, BULL:1.80, BEAR:3.30} },
  { id:"ttd26",  t:"TTD26",  n:"TAMAR Dic'26",      tp:"TAMAR", y:4.11, sp:0,    m:"2026-12-15", active:true,
    exitYields:{BASE:2.20, BULL:1.70, BEAR:3.40} },

  // ── USD ───────────────────────────────────────────────────────────────────
  { id:"bpoc7",  t:"BPOC7",  n:"Bopreal C 2027",    tp:"USD", y:5.7,  coupon:5.0, m:"2027-10-31", active:true,
    exitYields:{BASE:5.20, BULL:4.00, BEAR:8.50} },
  { id:"bpod7",  t:"BPOD7",  n:"Bopreal D 2027",    tp:"USD", y:8.2,  coupon:7.0, m:"2027-10-31", active:true,
    exitYields:{BASE:7.00, BULL:5.00, BEAR:10.00} },
  { id:"bpoa8",  t:"BPOA8",  n:"Bopreal A 2028",    tp:"USD", y:9.6,  coupon:8.0, m:"2028-04-30", active:true,
    exitYields:{BASE:8.00, BULL:6.00, BEAR:11.00} },
  { id:"al29",   t:"AL29",   n:"Bonar 2029",         tp:"USD", y:10.1, coupon:1.0, m:"2029-07-09", active:true,
    exitYields:{BASE:8.60, BULL:5.30, BEAR:16.30} },
  { id:"al30",   t:"AL30",   n:"Bonar 2030",         tp:"USD", y:10.2, coupon:0.5, m:"2030-07-09", active:true,
    exitYields:{BASE:8.60, BULL:5.70, BEAR:15.30} },
  { id:"al35",   t:"AL35",   n:"Bonar 2035",         tp:"USD", y:9.9,  coupon:3.6, m:"2035-07-09", active:true,
    exitYields:{BASE:8.80, BULL:7.50, BEAR:12.40} },
  { id:"ae38",   t:"AE38",   n:"Bonar 2038",         tp:"USD", y:10.4, coupon:3.5, m:"2038-01-09", active:true,
    exitYields:{BASE:8.90, BULL:7.20, BEAR:13.00} },
  { id:"al41",   t:"AL41",   n:"Bonar 2041",         tp:"USD", y:10.0, coupon:4.0, m:"2041-07-09", active:true,
    exitYields:{BASE:8.90, BULL:7.70, BEAR:12.20} },
  { id:"an29",   t:"AN29",   n:"Bonar Nov'29",       tp:"USD", y:9.7,  coupon:3.6, m:"2029-11-30", active:true,
    exitYields:{BASE:8.20, BULL:6.50, BEAR:12.50} },
  { id:"gd29",   t:"GD29",   n:"Global 2029",        tp:"USD", y:7.7,  coupon:1.0, m:"2029-07-09", active:true,
    exitYields:{BASE:7.40, BULL:5.20, BEAR:13.00} },
  { id:"gd30",   t:"GD30",   n:"Global 2030",        tp:"USD", y:8.5,  coupon:0.5, m:"2030-07-09", active:true,
    exitYields:{BASE:7.60, BULL:5.60, BEAR:12.70} },
  { id:"gd35",   t:"GD35",   n:"Global 2035",        tp:"USD", y:9.6,  coupon:3.6, m:"2035-07-09", active:true,
    exitYields:{BASE:8.70, BULL:7.40, BEAR:11.90} },
  { id:"gd38",   t:"GD38",   n:"Global Ene'38",      tp:"USD", y:9.6,  coupon:3.5, m:"2038-01-09", active:true,
    exitYields:{BASE:8.50, BULL:7.20, BEAR:12.00} },
  { id:"gd41",   t:"GD41",   n:"Global 2041",        tp:"USD", y:9.7,  coupon:4.0, m:"2041-07-09", active:true,
    exitYields:{BASE:8.80, BULL:7.60, BEAR:11.90} },
  { id:"gd46",   t:"GD46",   n:"Global 2046",        tp:"USD", y:9.6,  coupon:4.1, m:"2046-07-09", active:true,
    exitYields:{BASE:8.90, BULL:7.80, BEAR:12.00} },
];

// ─── ENGINE: BOND PRICING ─────────────────────────────────────────────────
// Lecap: zero-coupon, yield = TEM (% mensual efectivo)
// CER:   zero-coupon real, yield = tasa real anual
// USD:   DCF semi-anual

function priceBond(tp, yld, monthsLeft, couponRate) {
  if (monthsLeft <= 0) return 100;
  if (tp === "LECAP") {
    // P = 100 / (1 + TEM)^meses
    return 100 / Math.pow(1 + yld / 100, monthsLeft);
  }
  if (tp === "CER") {
    // P_real = 100 / (1 + r_anual)^años
    return 100 / Math.pow(1 + yld / 100, monthsLeft / 12);
  }
  if (tp === "USD") {
    // DCF semi-anual
    const n  = Math.max(1, Math.round(monthsLeft / 6));
    const c  = (couponRate ?? yld) / 200; // cupón semestral
    const y  = yld / 200;                 // yield semestral
    let p    = 0;
    for (let i = 1; i <= n; i++) p += (c * 100) / Math.pow(1 + y, i);
    p += 100 / Math.pow(1 + y, n);
    return p;
  }
  return 100; // flotante ≈ par
}

// ─── ENGINE: TOTAL RETURN ─────────────────────────────────────────────────
// Metodología verificada contra TEST PDF (Nahuel Garcia, 12/3/2026)
//
//  ARS bonds: TR_USD = (P1/P0) × [cumCPI para CER] × (currentBCS/exitBCS) − 1
//  USD bonds: TR_USD = DCF return directo; TR_ARS = × (exitBCS/currentBCS) − 1
//
//  Para Lecap/CER: P0 desde yield actual, P1 desde exit yield al horizonte
//  Para TAMAR/BADLAR: carry puro, P ≈ par

const NOW = new Date("2026-03-12");
function mths(ds) { return Math.max(0.001, (new Date(ds) - NOW) / (30.44 * 86400000)); }

function calcReturn(bond, scen, scenKey, horizon, currentBCS) {
  const m0 = mths(bond.m);
  const h  = Math.min(horizon, m0);
  const m1 = Math.max(0, m0 - h);
  const exitYld = bond.exitYields?.[scenKey] ?? bond.y;

  // ── LECAP ──────────────────────────────────────────────────────────────
  if (bond.tp === "LECAP") {
    const p0 = priceBond("LECAP", bond.y, m0);
    const p1 = priceBond("LECAP", exitYld, m1);
    const rARS = p1 / p0 - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  // ── CER ────────────────────────────────────────────────────────────────
  // Methodology: carry + modified duration × ΔYield + CPI
  // Matches PDF results for bonds with coupons (better than zero-coupon pricing)
  if (bond.tp === "CER") {
    const carry    = Math.pow(1 + bond.y / 100, h / 12) - 1;
    const deltaY   = (exitYld - bond.y) / 100;
    const priceChg = -(bond.dur ?? 2) * deltaY;
    const cumCPI   = Math.pow(1 + scen.cpiM / 100, h) - 1;
    const rARS     = (1 + carry) * (1 + priceChg) * (1 + cumCPI) - 1;
    const rUSD     = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  // ── TAMAR ──────────────────────────────────────────────────────────────
  if (bond.tp === "TAMAR") {
    const spM  = (bond.sp ?? 0) / 12 / 100;
    const rARS = Math.pow(1 + scen.tamarM / 100 + spM, h) - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  // ── BADLAR ─────────────────────────────────────────────────────────────
  if (bond.tp === "BADLAR") {
    const spM  = (bond.sp ?? 0) / 12 / 100;
    const rARS = Math.pow(1 + scen.badlarM / 100 + spM, h) - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  // ── FIXED_ARS ──────────────────────────────────────────────────────────
  if (bond.tp === "FIXED_ARS") {
    const p0   = priceBond("CER", bond.y, m0); // misma lógica que CER pero sin CPI
    const p1   = priceBond("CER", exitYld, m1);
    const rARS = p1 / p0 - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  // ── USD ────────────────────────────────────────────────────────────────
  if (bond.tp === "USD") {
    const p0         = priceBond("USD", bond.y, m0, bond.coupon);
    const p1         = priceBond("USD", exitYld, m1, bond.coupon);
    const nSemiPay   = Math.floor(h / 6);
    const couponAccr = ((bond.coupon ?? bond.y) / 200) * nSemiPay; // % sobre 100
    const rUSD = (p1 + couponAccr) / p0 - 1;
    const rARS = (1 + rUSD) * (scen.exitBCS / currentBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }

  return { rARS: 0, rUSD: 0 };
}

function calcWt(bond, scens, h, bcs) {
  let wA = 0, wU = 0, tw = 0;
  Object.entries(scens).forEach(([k, s]) => {
    const r = calcReturn(bond, s, k, h, bcs);
    wA += r.rARS * s.w; wU += r.rUSD * s.w; tw += s.w;
  });
  return { rARS: wA / tw, rUSD: wU / tw };
}

// ─── CASHFLOW GENERATOR ──────────────────────────────────────────────────
function genCashflows(bond, scen, scenKey) {
  const m0 = mths(bond.m);
  const matDate = new Date(bond.m);
  const exitYld = bond.exitYields?.[scenKey] ?? bond.y;
  const rows = [];

  if (bond.tp === "LECAP") {
    const p0 = priceBond("LECAP", bond.y, m0).toFixed(3);
    rows.push({ date: bond.m, label: "Vencimiento / Exit", coupon: 0, principal: 100, total: 100, note: `Precio entrada: ${p0}` });
    return rows;
  }

  let freq = bond.tp === "TAMAR" || bond.tp === "BADLAR" ? 4 : 2;
  const nP = Math.max(1, Math.round(m0 * freq / 12));
  const mpp = 12 / freq;

  for (let i = 1; i <= nP; i++) {
    const d = new Date(matDate);
    d.setMonth(d.getMonth() - Math.round(mpp * (nP - i)));
    const dStr = d.toISOString().slice(0, 10);
    const mfn  = (d - NOW) / (30.44 * 86400000);
    if (mfn < 0) continue;

    let coupon = 0;
    if (bond.tp === "CER") {
      const cumCPI = Math.pow(1 + scen.cpiM / 100, mfn) - 1;
      coupon = (bond.y / 100) * (1 + cumCPI) * 100 / freq;
    } else if (bond.tp === "TAMAR")  coupon = (Math.pow(1 + scen.tamarM / 100, mpp) - 1) * 100;
    else if (bond.tp === "BADLAR")   coupon = (Math.pow(1 + scen.badlarM / 100, mpp) - 1) * 100;
    else                             coupon = ((bond.coupon ?? bond.y) / 100) * 100 / freq;

    const principal = i === nP ? 100 : 0;
    rows.push({ date: dStr, label: `Período ${i}`, coupon: +coupon.toFixed(3), principal, total: +(coupon + principal).toFixed(3) });
  }
  return rows;
}

// ─── FORMATTERS ─────────────────────────────────────────────────────────
const fmtS = (v, d = 1) => { const n = +v; if (isNaN(n)) return "–"; return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`; };
const fmtP = (v, d = 1) => `${(+v).toFixed(d)}%`;
function rc(v)  { if (v > 15) return C.pos;  if (v > 0) return "#16a34a"; if (v < -5) return C.neg; if (v < 0) return "#f87171"; return C.muted; }
function rcu(v) { if (v > 8)  return C.pos;  if (v > 0) return "#16a34a"; if (v < -3) return C.neg; if (v < 0) return "#f87171"; return C.muted; }

const blank = { t:"", n:"", tp:"USD", y:"", coupon:"", sp:"0", m:"", exitYields:{BASE:"",BULL:"",BEAR:""} };

function TH(a="center") { return { padding:"9px 8px", color:"rgba(255,255,255,.75)", fontWeight:600, fontSize:10, letterSpacing:.5, textAlign:a, textTransform:"uppercase", whiteSpace:"nowrap" }; }
function TH2()           { return { padding:"3px 8px", color:"rgba(255,255,255,.4)",  fontWeight:500, fontSize:9,  textAlign:"center" }; }
function TD(a="left")    { return { padding:"9px 8px", whiteSpace:"nowrap", textAlign:a }; }

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [bonds,      setBonds]     = useState(B0);
  const [scens,      setScens]     = useState(S0);
  const [currentBCS, setBCS]       = useState(DEFAULT_CURRENT_BCS);
  const [horizon,    setHorizon]   = useState(3);   // meses
  const [showPanel,  setShowPanel] = useState(false);
  const [showAdd,    setShowAdd]   = useState(false);
  const [newBond,    setNewBond]   = useState(blank);
  const [sortBy,     setSortBy]    = useState("wUSD");
  const [filterTp,   setFilterTp]  = useState("ALL");
  const [cfBond,     setCfBond]    = useState(null);
  const [cfScen,     setCfScen]    = useState("BASE");
  const [editBond,   setEditBond]  = useState(null); // for exit yield editing

  const results = useMemo(() => {
    const activeBonds = bonds.filter(b => b.active);
    return activeBonds
      .filter(b => filterTp === "ALL" || b.tp === filterTp)
      .map(b => {
        const byScen = {};
        Object.entries(scens).forEach(([k, s]) => { byScen[k] = calcReturn(b, s, k, horizon, currentBCS); });
        const wt = calcWt(b, scens, horizon, currentBCS);
        return { ...b, byScen, wt };
      })
      .sort((a, z) => {
        if (sortBy==="wUSD")    return z.wt.rUSD - a.wt.rUSD;
        if (sortBy==="wARS")    return z.wt.rARS - a.wt.rARS;
        if (sortBy==="baseUSD") return z.byScen.BASE.rUSD - a.byScen.BASE.rUSD;
        if (sortBy==="baseARS") return z.byScen.BASE.rARS - a.byScen.BASE.rARS;
        return 0;
      });
  }, [bonds, scens, horizon, currentBCS, sortBy, filterTp]);

  const removeBond = id => setBonds(p => p.filter(b => b.id !== id));
  const togBond    = id => setBonds(p => p.map(b => b.id===id ? {...b,active:!b.active} : b));
  const updScen    = (k,f,v) => setScens(p => ({...p,[k]:{...p[k],[f]:+v||0}}));
  const saveEY     = (id, k, v) => setBonds(p => p.map(b => b.id===id ? {...b,exitYields:{...b.exitYields,[k]:+v}} : b));

  const addBond = () => {
    if (!newBond.t || !newBond.m || !newBond.y) return;
    setBonds(p => [...p, {
      id:`${newBond.t.toLowerCase()}_${Date.now()}`,
      t:newBond.t, n:newBond.n||newBond.t, tp:newBond.tp,
      y:+newBond.y, coupon:newBond.coupon ? +newBond.coupon : undefined,
      sp:+newBond.sp||0, m:newBond.m, active:true,
      exitYields:{
        BASE: +newBond.exitYields.BASE || +newBond.y,
        BULL: +newBond.exitYields.BULL || +newBond.y,
        BEAR: +newBond.exitYields.BEAR || +newBond.y,
      }
    }]);
    setNewBond(blank); setShowAdd(false);
  };

  const cfData = useMemo(() => {
    if (!cfBond) return [];
    return genCashflows(cfBond, scens[cfScen], cfScen);
  }, [cfBond, cfScen, scens]);

  const scenKeys = Object.keys(scens);

  // BCS-implied official FX display
  const officialFX = s => (currentBCS / ((1 + s.exitBCS / currentBCS - 1) * 1)).toFixed(0); // simplified display

  const card = { background:C.card, borderRadius:12, boxShadow:"0 2px 12px rgba(0,0,57,.08)", overflow:"hidden" };
  const pill = (color) => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, color, background:color+"18" });

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <header style={{ background:C.navy, padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:62, boxShadow:"0 2px 16px rgba(0,0,57,.5)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <Logo />
          <div style={{ borderLeft:`1px solid ${C.blue1}`, paddingLeft:14 }}>
            <div style={{ color:C.white, fontWeight:700, fontSize:16 }}>Bond Total Return</div>
            <div style={{ color:C.blue2, fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase" }}>Calculadora · BCS Methodology</div>
          </div>
        </div>

        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {/* Current BCS input */}
          <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(255,255,255,.07)", borderRadius:8, padding:"5px 10px" }}>
            <span style={{ color:"#7090b0", fontSize:11 }}>BCS hoy:</span>
            <input type="number" value={currentBCS} onChange={e=>setBCS(+e.target.value||1)}
              style={{ width:58, background:"transparent", border:"none", color:C.blue2, fontWeight:800, fontSize:14, textAlign:"right", outline:"none" }} />
          </div>

          <span style={{ color:"#7090b0", fontSize:11 }}>Horizonte:</span>
          <select value={horizon} onChange={e=>setHorizon(parseInt(e.target.value,10))} style={{ background:C.blue1, color:C.white, border:"none", borderRadius:7, padding:"5px 9px", fontWeight:700, cursor:"pointer", fontSize:12 }}>
            {[1,2,3,6,9,12,18,24,36].map(m=>(
              <option key={m} value={m}>{m>=12?`${m/12}a${m>12?"s":""}`:m===1?"1m":`${m}m`}</option>
            ))}
          </select>

          <button onClick={()=>setShowPanel(v=>!v)} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${showPanel?C.blue2:"rgba(255,255,255,.2)"}`, cursor:"pointer", fontWeight:700, fontSize:12, background:showPanel?C.blue1:"rgba(255,255,255,.1)", color:C.white }}>
            ⚙ Escenarios
          </button>
          <button onClick={()=>setShowAdd(true)} style={{ background:C.blue2, color:C.white, border:"none", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontWeight:700, fontSize:12 }}>
            + Bono
          </button>
        </div>
      </header>

      {/* ── SCENARIO PANEL ────────────────────────────────────────────────────── */}
      {showPanel && (
        <div style={{ background:"#03003d", borderBottom:`2px solid ${C.blue1}`, padding:"18px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
            {Object.entries(scens).map(([key, s]) => (
              <div key={key} style={{ background:"rgba(255,255,255,.05)", borderRadius:12, padding:14, borderTop:`3px solid ${s.col}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ color:s.col, fontWeight:800, fontSize:14 }}>{s.label}</span>
                  <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                    <input type="number" value={s.w} onChange={e=>updScen(key,"w",e.target.value)}
                      style={{ width:40, background:"rgba(255,255,255,.12)", border:"none", color:C.white, borderRadius:5, padding:"2px 5px", textAlign:"right", fontWeight:700, fontSize:12 }} />
                    <span style={{ color:"#7090b0", fontSize:10 }}>%</span>
                  </div>
                </div>
                {[
                  ["Exit BCS",        "exitBCS",  "BCS al horizonte"],
                  ["CPI Mensual (%)", "cpiM",     "Para bonos CER"],
                  ["TAMAR Mensual (%)","tamarM",  "Para bonos TAMAR"],
                  ["BADLAR Mensual (%)","badlarM","Para bonos BADLAR"],
                ].map(([lbl,field,hint]) => (
                  <div key={field} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <div>
                      <div style={{ color:"#8090a8", fontSize:10 }}>{lbl}</div>
                      <div style={{ color:"#506070", fontSize:9 }}>{hint}</div>
                    </div>
                    <input type="number" step={field==="exitBCS"?1:0.1} value={s[field]}
                      onChange={e=>updScen(key,field,e.target.value)}
                      style={{ width:68, background:"rgba(255,255,255,.12)", border:"none", color:C.white, borderRadius:5, padding:"3px 7px", textAlign:"right", fontSize:12 }} />
                  </div>
                ))}
                <div style={{ marginTop:8, padding:"6px 8px", background:"rgba(255,255,255,.04)", borderRadius:7 }}>
                  <span style={{ color:"#5070a0", fontSize:9 }}>FX vs hoy: </span>
                  <span style={{ color:s.col, fontSize:10, fontWeight:600 }}>
                    {((s.exitBCS/currentBCS - 1)*100).toFixed(1)}% ({horizon}m) · CPI acum: {((Math.pow(1+s.cpiM/100,horizon)-1)*100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, color:"#5070a0", fontSize:10, textAlign:"center" }}>
            Metodología: TR_USD (ARS bonds) = (P₁/P₀) × [1+CPI para CER] × (BCS_hoy/BCS_exit) − 1 · TR_USD (USD bonds) = DCF directo · TR_ARS = × BCS_exit/BCS_hoy
          </div>
        </div>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ padding:"14px 20px" }}>

        {/* Stats */}
        {(() => {
          const bU = results.length ? [...results].sort((a,b)=>b.byScen.BASE.rUSD-a.byScen.BASE.rUSD)[0] : null;
          const bA = results.length ? [...results].sort((a,b)=>b.byScen.BASE.rARS-a.byScen.BASE.rARS)[0] : null;
          const bW = results.length ? [...results][0] : null;
          return (
            <div style={{ display:"flex", gap:10, marginBottom:12 }}>
              {[
                ["BCS Hoy", `${currentBCS.toLocaleString()}`, C.blue2],
                ["Mejor USD Base", bU?`${bU.t}: ${fmtP(bU.byScen.BASE.rUSD)}`:"-", C.teal],
                ["Mejor ARS Base", bA?`${bA.t}: ${fmtP(bA.byScen.BASE.rARS)}`:"-", C.green],
                [`#1 Pond. (${horizon}m)`, bW?`${bW.t}: ${fmtP(bW.wt.rUSD)} USD`:"-", "gold"],
              ].map(([lbl,val,col])=>(
                <div key={lbl} style={{ background:C.card, borderRadius:8, padding:"8px 16px", boxShadow:"0 1px 6px rgba(0,0,57,.07)", borderLeft:`3px solid ${col}` }}>
                  <div style={{ fontSize:10, color:C.muted }}>{lbl}</div>
                  <div style={{ fontSize:17, fontWeight:800, color:col }}>{val}</div>
                </div>
              ))}
              <div style={{flex:1}}/>
              <div style={{ background:C.card, borderRadius:8, padding:"8px 16px", boxShadow:"0 1px 6px rgba(0,0,57,.07)", borderLeft:`3px solid ${C.salmon}`, fontSize:10 }}>
                <div style={{ color:C.muted }}>BCS Escenarios (exit)</div>
                <div style={{ display:"flex", gap:10, marginTop:2 }}>
                  {Object.entries(scens).map(([k,s])=>(
                    <span key={k} style={{ fontWeight:700, color:s.col, fontSize:12 }}>{s.label}: {s.exitBCS.toLocaleString()}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filters + Sort */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {["ALL",...Object.keys(TYPES)].map(tp => {
              const cfg = TYPES[tp]; const active = filterTp===tp;
              return <button key={tp} onClick={()=>setFilterTp(tp)} style={{ padding:"4px 12px", borderRadius:20, border:active?"none":`1px solid ${C.border}`, cursor:"pointer", fontSize:11, fontWeight:600, background:active?(cfg?.color||C.navy):C.card, color:active?C.white:C.muted }}>{tp==="ALL"?"Todos":cfg.label}</button>;
            })}
          </div>
          <div style={{ display:"flex", gap:5, alignItems:"center" }}>
            <span style={{ fontSize:10, color:C.muted }}>Ordenar:</span>
            {[["wUSD","Pond. USD"],["wARS","Pond. ARS"],["baseUSD","Base USD"],["baseARS","Base ARS"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)} style={{ padding:"3px 9px", borderRadius:7, fontSize:11, border:`1px solid ${C.border}`, cursor:"pointer", background:sortBy===k?C.blue1:C.card, color:sortBy===k?C.white:C.muted }}>{l}</button>
            ))}
          </div>
        </div>

        {/* ── TABLE ──────────────────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ overflowX:"auto" }}>
            <table key={horizon} style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:C.navy }}>
                  <th style={TH()}>#</th>
                  <th style={TH("left")}>Bono</th>
                  <th style={TH("left")}>Tipo</th>
                  <th style={TH()}>TIR</th>
                  <th style={TH()}>Vcto</th>
                  {scenKeys.map(k=>(
                    <th key={k} colSpan={2} style={{...TH(),borderLeft:`2px solid ${scens[k].col}`,color:scens[k].col}}>{scens[k].label}</th>
                  ))}
                  <th colSpan={2} style={{...TH(),borderLeft:"2px solid gold",color:"gold"}}>Pond. <span style={{fontSize:9,opacity:.7,fontWeight:400}}>({horizon}m)</span></th>
                  <th style={TH()}>EY</th>
                  <th style={TH()}></th>
                </tr>
                <tr style={{ background:"#05003d" }}>
                  <th style={TH2()}></th><th style={TH2()}></th><th style={TH2()}></th>
                  <th style={TH2()}>%</th><th style={TH2()}>fecha</th>
                  {scenKeys.map(k=>(
                    <Fragment key={k}>
                      <th style={{...TH2(),borderLeft:`2px solid ${scens[k].col}40`}}>ARS</th>
                      <th style={TH2()}>USD</th>
                    </Fragment>
                  ))}
                  <th style={{...TH2(),borderLeft:"2px solid rgba(255,215,0,.4)"}}>ARS</th>
                  <th style={TH2()}>USD</th>
                  <th style={TH2()}>B/Bll/Br</th>
                  <th style={TH2()}></th>
                </tr>
              </thead>
              <tbody>
                {results.map((b, i) => {
                  const tc = TYPES[b.tp];
                  return (
                    <tr key={b.id} onClick={()=>setCfBond(b)}
                      style={{ background:i%2===0?C.card:C.bg, borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#dbeafe"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.card:C.bg}
                    >
                      <td style={TD("center")}>
                        <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:i===0?C.blue2:i===1?"#22c55e":i===2?"#eab308":C.border,fontSize:10,fontWeight:700,color:i<3?C.white:C.muted }}>{i+1}</span>
                      </td>
                      <td style={TD()}>
                        <div style={{ fontWeight:800, color:C.navy, fontSize:13 }}>{b.t}</div>
                        <div style={{ fontSize:10, color:C.muted }}>{b.n}</div>
                      </td>
                      <td style={TD()}><span style={pill(tc?.color||C.muted)}>{tc?.label||b.tp}</span></td>
                      <td style={{...TD("right"),fontWeight:600,color:b.tp==="CER"?C.teal:C.text}}>{b.y.toFixed(2)}%</td>
                      <td style={{...TD("center"),fontSize:10,color:C.muted}}>{b.m.slice(0,7)}</td>

                      {scenKeys.map(k=>{
                        const r=b.byScen[k];
                        return (
                          <Fragment key={k}>
                            <td style={{...TD("right"),borderLeft:`2px solid ${scens[k].col}25`,fontWeight:700,color:rc(r.rARS)}}>{fmtS(r.rARS)}</td>
                            <td style={{...TD("right"),fontWeight:600,color:rcu(r.rUSD),fontSize:11}}>{fmtS(r.rUSD)}</td>
                          </Fragment>
                        );
                      })}
                      <td style={{...TD("right"),borderLeft:"2px solid rgba(255,215,0,.3)",fontWeight:800,fontSize:14,color:rc(b.wt.rARS)}}>{fmtS(b.wt.rARS)}</td>
                      <td style={{...TD("right"),fontWeight:800,fontSize:14,color:rcu(b.wt.rUSD)}}>{fmtS(b.wt.rUSD)}</td>

                      {/* Exit yields compacto */}
                      <td style={{...TD("center"),fontSize:9,color:C.muted}} onClick={e=>{e.stopPropagation();setEditBond(b);}}>
                        <span style={{ cursor:"pointer", textDecoration:"underline dotted", color:C.blue1 }}>
                          {(b.exitYields?.BASE??"-")}/{(b.exitYields?.BULL??"-")}/{(b.exitYields?.BEAR??"-")}
                        </span>
                      </td>
                      <td style={TD("center")}>
                        <button onClick={e=>{e.stopPropagation();removeBond(b.id);}} style={{ background:"none",border:"none",cursor:"pointer",color:C.neg,fontSize:14,lineHeight:1,padding:"2px 4px" }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {results.length===0&&<div style={{padding:36,textAlign:"center",color:C.muted}}>Sin bonos. Cambiá el filtro o agregá uno.</div>}
          </div>
        </div>

        {/* Desactivados */}
        {bonds.filter(b=>!b.active).length>0&&(
          <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:C.muted }}>Ocultos:</span>
            {bonds.filter(b=>!b.active).map(b=>(
              <button key={b.id} onClick={()=>togBond(b.id)} style={{ padding:"2px 9px",borderRadius:20,border:`1px solid ${C.border}`,background:C.card,color:C.muted,cursor:"pointer",fontSize:11 }}>↩ {b.t}</button>
            ))}
          </div>
        )}

        {/* Nota metodológica */}
        <div style={{ marginTop:10, padding:"8px 14px", background:C.card, borderRadius:8, borderLeft:`3px solid ${C.blue2}`, fontSize:10, color:C.muted, lineHeight:1.7 }}>
          <strong style={{color:C.blue1}}>Metodología BCS:</strong>{" "}
          <strong>Lecap:</strong> P=100/(1+TEM)^m, exit yield por escenario via BCS.{" "}
          <strong>CER:</strong> precio real × CPI acumulado, conversión via BCS.{" "}
          <strong>TAMAR/BADLAR:</strong> carry compuesto mensual + spread.{" "}
          <strong>USD:</strong> DCF semi-anual con exit yield; ARS = × BCS_exit/BCS_hoy.{" "}
          Click en "EY" de cada fila para editar los exit yields por escenario. Click en el bono para ver cashflow.
        </div>
      </div>

      {/* ═══ MODAL: EDIT EXIT YIELDS ══════════════════════════════════════════ */}
      {editBond && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&setEditBond(null)}>
          <div style={{ background:C.card,borderRadius:14,padding:24,width:440,boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
              <div>
                <span style={{ fontWeight:800,color:C.navy,fontSize:16 }}>{editBond.t}</span>
                <span style={{ color:C.muted,fontSize:12,marginLeft:8 }}>Exit Yields por Escenario</span>
              </div>
              <button onClick={()=>setEditBond(null)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.muted}}>✕</button>
            </div>

            <div style={{ marginBottom:12, padding:"8px 12px", background:C.bg, borderRadius:8, fontSize:11, color:C.muted }}>
              <strong>Tipo:</strong> {TYPES[editBond.tp]?.label} &nbsp;|&nbsp;
              <strong>TIR actual:</strong> {editBond.y.toFixed(2)}% &nbsp;|&nbsp;
              <strong>Vcto:</strong> {editBond.m}
              <br/>
              {editBond.tp === "LECAP" && "→ Ingresá TEM mensual (%). Ej: 2.50 = 2.50% mensual"}
              {editBond.tp === "CER"   && "→ Ingresá tasa real anual (%). Ej: 6.30 = 6.30% real anual"}
              {editBond.tp === "USD"   && "→ Ingresá TIR anual en USD (%). Ej: 8.50 = 8.50% anual"}
              {(editBond.tp === "TAMAR"||editBond.tp==="BADLAR") && "→ Exit yield referencial (carry usa tasa flotante del escenario)"}
            </div>

            {Object.entries(scens).map(([k, s]) => (
              <div key={k} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,padding:"10px 14px",background:`${s.col}10`,borderRadius:8,borderLeft:`3px solid ${s.col}` }}>
                <div>
                  <div style={{ color:s.col,fontWeight:700,fontSize:13 }}>{s.label}</div>
                  <div style={{ color:C.muted,fontSize:10 }}>Exit BCS: {s.exitBCS.toLocaleString()} · BCS change: {((s.exitBCS/currentBCS-1)*100).toFixed(1)}%</div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                  <input type="number" step="0.1"
                    defaultValue={editBond.exitYields?.[k]??editBond.y}
                    onBlur={e=>saveEY(editBond.id, k, e.target.value)}
                    onChange={e=>saveEY(editBond.id, k, e.target.value)}
                    style={{ width:70,padding:"6px 10px",borderRadius:8,border:`1.5px solid ${s.col}50`,fontSize:14,fontWeight:700,textAlign:"right",color:C.text }} />
                  <span style={{ color:C.muted,fontSize:11 }}>%</span>
                </div>
              </div>
            ))}

            <div style={{ marginTop:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:10, color:C.muted }}>Los cambios se aplican en tiempo real.</div>
              <button onClick={()=>setEditBond(null)} style={{ padding:"8px 20px",borderRadius:8,background:C.blue1,color:C.white,border:"none",fontWeight:700,cursor:"pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CASHFLOW ═════════════════════════════════════════════════ */}
      {cfBond && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&setCfBond(null)}>
          <div style={{ background:C.card,borderRadius:14,width:580,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}` }}>
            <div style={{ background:C.navy,borderRadius:"14px 14px 0 0",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div><span style={{color:C.white,fontWeight:800,fontSize:16}}>{cfBond.t}</span><span style={{color:C.blue2,fontSize:12,marginLeft:10}}>{cfBond.n}</span></div>
              <button onClick={()=>setCfBond(null)} style={{background:"none",border:"none",color:"#7090b0",fontSize:18,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{ padding:"10px 20px",background:"#f7f9fc",borderBottom:`1px solid ${C.border}`,display:"flex",gap:16,flexWrap:"wrap" }}>
              {[["Tipo",TYPES[cfBond.tp]?.label],["TIR actual",`${cfBond.y.toFixed(2)}%`],["Vcto",cfBond.m],["Meses",mths(cfBond.m).toFixed(1)]].map(([k,v])=>(
                <div key={k}><div style={{fontSize:9,color:C.muted}}>{k}</div><div style={{fontWeight:700,color:C.text,fontSize:12}}>{v}</div></div>
              ))}
            </div>
            <div style={{ padding:"8px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:6 }}>
              <span style={{fontSize:11,color:C.muted,alignSelf:"center"}}>Escenario:</span>
              {Object.entries(scens).map(([k,s])=>(
                <button key={k} onClick={()=>setCfScen(k)} style={{padding:"3px 12px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:11,background:cfScen===k?s.col:C.bg,color:cfScen===k?C.white:C.muted}}>{s.label}</button>
              ))}
            </div>
            <div style={{ padding:"8px 20px",background:`${scens[cfScen].col}08`,borderBottom:`1px solid ${C.border}`,display:"flex",gap:16,flexWrap:"wrap" }}>
              {[["TR ARS",calcReturn(cfBond,scens[cfScen],cfScen,horizon,currentBCS).rARS,rc],["TR USD",calcReturn(cfBond,scens[cfScen],cfScen,horizon,currentBCS).rUSD,rcu]].map(([l,v,fn])=>(
                <div key={l}><div style={{fontSize:10,color:C.muted}}>{l} ({horizon}m)</div><div style={{fontWeight:800,fontSize:20,color:fn(v)}}>{fmtS(v)}</div></div>
              ))}
              <div><div style={{fontSize:10,color:C.muted}}>Exit yield</div><div style={{fontWeight:700,fontSize:14,color:scens[cfScen].col}}>{cfBond.exitYields?.[cfScen]??cfBond.y}%</div></div>
              <div><div style={{fontSize:10,color:C.muted}}>BCS hoy → exit</div><div style={{fontWeight:700,fontSize:14,color:C.salmon}}>{currentBCS.toLocaleString()} → {scens[cfScen].exitBCS.toLocaleString()}</div></div>
            </div>
            <div style={{ overflowY:"auto",flex:1 }}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{background:C.navy,position:"sticky",top:0}}>{["Fecha","Período","Cupón","Principal","Total"].map(h=>(<th key={h} style={{padding:"7px 14px",color:"rgba(255,255,255,.7)",fontWeight:600,fontSize:10,textAlign:h==="Fecha"||h==="Período"?"left":"right"}}>{h}</th>))}</tr></thead>
                <tbody>
                  {cfData.map((r,i)=>(
                    <tr key={i} style={{background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"6px 14px",color:C.muted}}>{r.date}</td>
                      <td style={{padding:"6px 14px",color:C.text,fontWeight:600}}>{r.label}</td>
                      <td style={{padding:"6px 14px",textAlign:"right",color:r.coupon>0?C.teal:C.muted}}>{r.coupon>0?`+${r.coupon.toFixed(2)}`:"-"}</td>
                      <td style={{padding:"6px 14px",textAlign:"right",color:r.principal>0?C.blue1:C.muted}}>{r.principal>0?`+${r.principal.toFixed(0)}`:"-"}</td>
                      <td style={{padding:"6px 14px",textAlign:"right",fontWeight:700,color:C.pos}}>+{r.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cfData.length===0&&<div style={{padding:28,textAlign:"center",color:C.muted}}>Sin flujos proyectados.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: ADD BOND ══════════════════════════════════════════════════ */}
      {showAdd && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{background:C.card,borderRadius:14,padding:24,width:500,boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{margin:0,color:C.navy,fontSize:17}}>Agregar Bono</h3>
              <button onClick={()=>setShowAdd(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.muted}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[["Ticker *","t","text","GD35"],["Nombre","n","text","Global 2035"],["TIR actual (%) *","y","number","9.6"],["Cupón anual (%) USD","coupon","number","3.6"],["Spread (%) TAMAR","sp","number","0"]].map(([l,f,tp,ph])=>(
                <div key={f}>
                  <label style={{fontSize:10,color:C.muted,display:"block",marginBottom:3}}>{l}</label>
                  <input type={tp} placeholder={ph} value={newBond[f]||""}
                    onChange={e=>setNewBond(p=>({...p,[f]:e.target.value}))}
                    style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1.5px solid ${C.border}`,fontSize:12,boxSizing:"border-box"}} />
                </div>
              ))}
              <div>
                <label style={{fontSize:10,color:C.muted,display:"block",marginBottom:3}}>Tipo *</label>
                <select value={newBond.tp} onChange={e=>setNewBond(p=>({...p,tp:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1.5px solid ${C.border}`,fontSize:12}}>
                  {Object.entries(TYPES).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{fontSize:10,color:C.muted,display:"block",marginBottom:3}}>Vencimiento *</label>
                <input type="date" value={newBond.m} onChange={e=>setNewBond(p=>({...p,m:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:7,border:`1.5px solid ${C.border}`,fontSize:12,boxSizing:"border-box"}} />
              </div>
            </div>

            <div style={{marginTop:10,padding:"8px 10px",background:C.bg,borderRadius:7,fontSize:10,color:C.muted}}>
              <strong>Exit Yields por Escenario</strong> ({TYPES[newBond.tp]?.label}) — dejá vacío para usar TIR actual
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:6}}>
              {Object.entries(scens).map(([k,s])=>(
                <div key={k}>
                  <label style={{fontSize:10,color:s.col,display:"block",marginBottom:3,fontWeight:700}}>{s.label}</label>
                  <input type="number" step="0.1" placeholder={newBond.y||"EY%"}
                    value={newBond.exitYields[k]}
                    onChange={e=>setNewBond(p=>({...p,exitYields:{...p.exitYields,[k]:e.target.value}}))}
                    style={{width:"100%",padding:"7px 9px",borderRadius:7,border:`1.5px solid ${s.col}50`,fontSize:12,boxSizing:"border-box"}} />
                </div>
              ))}
            </div>

            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={addBond} style={{flex:1,padding:"10px 0",borderRadius:8,background:C.blue1,color:C.white,border:"none",fontWeight:800,fontSize:13,cursor:"pointer"}}>✓ Agregar</button>
              <button onClick={()=>setShowAdd(false)} style={{padding:"10px 18px",borderRadius:8,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer"}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
