import { useState, useMemo, useCallback, Fragment } from "react";
import AnalysisTab from "./Analysis.jsx";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const C = {
  navy:"#000039", blue1:"#1e5ab0", blue2:"#3399ff",
  teal:"#23a29e", salmon:"#ebaca2", green:"#acd484",
  white:"#fff", bg:"#edf1f7", card:"#fff",
  border:"#cdd7e8", text:"#0a0d2e", muted:"#5a6880",
  pos:"#16a34a", neg:"#dc2626",
};

const Logo = () => (
  <svg height="38" viewBox="0 0 155 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4 C4 4 4 22 4 26 C4 32 9 36 15 36 L24 36 L24 20 C24 12 18 6 10 4 Z" fill={C.blue1}/>
    <path d="M13 10 C13 10 13 30 13 33 C13 36 17 38 21 38 L30 38 C36 38 40 34 40 28 L40 18 C40 12 35 10 28 10 Z" fill={C.blue2} opacity="0.9"/>
    <text x="50" y="17" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.white} letterSpacing="2.5">LATIN</text>
    <text x="50" y="35" fontFamily="'Trebuchet MS',Arial,sans-serif" fontWeight="800" fontSize="16" fill={C.white} letterSpacing="2.5">SECURITIES</text>
  </svg>
);

const TYPES = {
  LECAP:    { label:"Lecap",     color:"#0369a1", ccy:"ARS" },
  CER:      { label:"CER",       color:"#0d9488", ccy:"ARS" },
  TAMAR:    { label:"TAMAR",     color:"#7c3aed", ccy:"ARS" },
  BADLAR:   { label:"BADLAR",    color:"#9f1239", ccy:"ARS" },
  FIXED_ARS:{ label:"Tasa Fija", color:C.blue1,   ccy:"ARS" },
  USD:      { label:"USD",       color:"#166534", ccy:"USD" },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// makePath: genera un path mensual de CPI con forma (declinante / plana / creciente)
function makePath(start, end, n=24) {
  return Array.from({length:n}, (_,i) => +(start + (end-start)*i/(n-1)).toFixed(2));
}

// cumCPI from monthly path
function calcCumCPI(path, months) {
  const full = Math.min(Math.floor(months), path.length);
  let cum = 1;
  for (let i = 0; i < full; i++) cum *= (1 + path[i] / 100);
  const frac = months - full;
  if (frac > 0 && full < path.length) cum *= (1 + path[full] / 100 * frac);
  return cum - 1;
}


// ─── PEER CURVES (NY Law Sovereign Bonds) ───────────────────────────────────
// Control points {d: duration_years, y: yield_%} read from Latin Securities chart
// Source: "Dollar Sovereign Bonds: still with room for tightening" (Mar-2026)
const PEER_CURVES = {
  manual:          { label:"Manual (sin curva)", color:"#94a3b8", rating:"–", points:[] },
  argentina_now:   { label:"Argentina (actual)", color:"#38bdf8", rating:"B-/CCC",  dash:true,
    points:[{d:2,y:8.50},{d:3,y:9.00},{d:4,y:9.20},{d:5,y:9.40},{d:6,y:9.60},{d:6.5,y:9.70}] },
  argentina_target:{ label:"Argentina Target (400bps)", color:"#1d4ed8", rating:"Target",
    points:[{d:2,y:8.50},{d:3,y:7.90},{d:4,y:7.80},{d:5,y:7.75},{d:6,y:7.70},{d:7,y:7.70},{d:8,y:7.75}] },
  ecuador:         { label:"Ecuador (B-)", color:"#ca8a04", rating:"B-",
    points:[{d:2,y:7.50},{d:3,y:8.00},{d:4,y:8.30},{d:5,y:8.60},{d:6,y:8.80},{d:7,y:9.00}] },
  el_salvador:     { label:"El Salvador (B-)", color:"#60a5fa", rating:"B-",
    points:[{d:2,y:6.50},{d:3,y:7.30},{d:4,y:7.70},{d:5,y:7.85},{d:6,y:8.00},{d:7,y:8.10}] },
  nigeria:         { label:"Nigeria (B-/CCC+)", color:"#16a34a", rating:"B-/CCC+",
    points:[{d:2,y:6.00},{d:3,y:7.00},{d:4,y:7.80},{d:5,y:8.20},{d:6,y:8.50},{d:8,y:8.80},{d:10,y:9.50}] },
  egypt:           { label:"Egypt (CCC+/B)", color:"#111827", rating:"CCC+/B",
    points:[{d:2,y:10.50},{d:3,y:10.70},{d:4,y:10.85},{d:5,y:11.00},{d:6,y:11.10},{d:7,y:11.20}] },
  colombia:        { label:"Colombia (BB+)", color:"#dc2626", rating:"BB+",
    points:[{d:2,y:5.20},{d:4,y:5.90},{d:6,y:6.50},{d:8,y:7.00},{d:10,y:7.30},{d:13,y:7.50}] },
  brazil:          { label:"Brazil (BB/BB+)", color:"#f59e0b", rating:"BB/BB+",
    points:[{d:2,y:7.50},{d:4,y:7.55},{d:6,y:7.57},{d:8,y:7.60},{d:10,y:7.63},{d:13,y:7.50}] },
};

// Linear interpolation across control points; extrapolates flat at edges
function interpYield(curveKey, dur) {
  const curve = PEER_CURVES[curveKey];
  if (!curve || !curve.points || curve.points.length === 0) return null;
  const pts = curve.points;
  if (dur <= pts[0].d) return pts[0].y;
  if (dur >= pts[pts.length-1].d) return pts[pts.length-1].y;
  for (let i = 0; i < pts.length-1; i++) {
    if (dur >= pts[i].d && dur <= pts[i+1].d) {
      const t = (dur - pts[i].d) / (pts[i+1].d - pts[i].d);
      return +(pts[i].y + t * (pts[i+1].y - pts[i].y)).toFixed(3);
    }
  }
  return pts[pts.length-1].y;
}

// Default exit yield for USD bond: manual entry if no peer curve selected, else from curve
function resolveUSDExit(bond, scenKey, peerKey) {
  if (!peerKey || peerKey === "manual") return bond.exitYields?.[scenKey] ?? bond.y;
  const fromCurve = interpYield(peerKey, bond.dur ?? 3);
  return fromCurve ?? bond.exitYields?.[scenKey] ?? bond.y;
}


// ─── CER TARGET REAL YIELD CURVES ────────────────────────────────────────────
// Control points {d: duration_years, y: real_yield_%}
// Represent different scenarios for where the CER real yield curve lands at horizon
const CER_TARGET_CURVES = {
  manual:    { label:"Manual (exit yields)", color:"#94a3b8",
    points:[] }, // empty = use exitYields as-is
  sin_cambio:{ label:"Sin cambio (actual)", color:TYPES.CER.color,
    points:[{d:0.1,y:-0.15},{d:0.25,y:2.06},{d:0.5,y:4.11},{d:0.8,y:6.70},{d:1.0,y:6.90},{d:1.5,y:7.82},{d:2.0,y:8.57},{d:3.0,y:8.48},{d:5.5,y:8.66}] },
  compresion_leve:{ label:"Compresión leve (−150bps)", color:"#22c55e",
    points:[{d:0.1,y:1.0},{d:0.5,y:2.5},{d:1.0,y:4.5},{d:2.0,y:6.0},{d:3.0,y:6.5},{d:5.0,y:7.0},{d:6.0,y:7.2}] },
  compresion_fuerte:{ label:"Compresión fuerte (−300bps)", color:"#0ea5e9",
    points:[{d:0.1,y:0.0},{d:0.5,y:1.5},{d:1.0,y:2.5},{d:2.0,y:3.5},{d:3.0,y:4.5},{d:5.0,y:5.5},{d:6.0,y:6.0}] },
  decompresion:{ label:"Decompresión (+200bps)", color:"#f97316",
    points:[{d:0.1,y:3.0},{d:0.5,y:6.0},{d:1.0,y:8.5},{d:2.0,y:10.0},{d:3.0,y:10.5},{d:5.0,y:11.0}] },
  flat_2:{ label:"Flat 2% real", color:"#a78bfa",
    points:[{d:0.1,y:2},{d:6,y:2}] },
  flat_5:{ label:"Flat 5% real", color:"#fb923c",
    points:[{d:0.1,y:5},{d:6,y:5}] },
};

// Interpolate CER target real yield by duration
function interpCERTarget(curveKey, dur) {
  const curve = CER_TARGET_CURVES[curveKey];
  if (!curve || !curve.points || curve.points.length === 0) return null;
  const pts = curve.points;
  if (dur <= pts[0].d) return pts[0].y;
  if (dur >= pts[pts.length-1].d) return pts[pts.length-1].y;
  for (let i = 0; i < pts.length-1; i++) {
    if (dur >= pts[i].d && dur <= pts[i+1].d) {
      const t = (dur - pts[i].d) / (pts[i+1].d - pts[i].d);
      return +(pts[i].y + t * (pts[i+1].y - pts[i].y)).toFixed(3);
    }
  }
  return pts[pts.length-1].y;
}

// Resolve effective exit yield for a CER bond given scenario curve selection
function resolveCERExitYield(bond, scenKey, cerCurveKey) {
  if (!cerCurveKey || cerCurveKey === "manual") return bond.exitYields?.[scenKey] ?? bond.y;
  const dur = bond.dur ?? 1;
  const fromCurve = interpCERTarget(cerCurveKey, dur);
  return fromCurve ?? bond.exitYields?.[scenKey] ?? bond.y;
}

// ─── SCENARIOS ───────────────────────────────────────────────────────────────
const S0 = {
  BASE:{ label:"Base", w:55, col:C.blue1,
    exitBCS:1554, tamarM:2.5, badlarM:2.3,
    cpiPath: makePath(2.6, 2.2) },
  BULL:{ label:"Bull", w:25, col:C.teal,
    exitBCS:1432, tamarM:1.9, badlarM:1.7,
    cpiPath: makePath(1.8, 1.4) },
  BEAR:{ label:"Bear", w:20, col:C.neg,
    exitBCS:1589, tamarM:3.3, badlarM:3.1,
    cpiPath: makePath(3.2, 3.6) },
};

const DEFAULT_CURRENT_BCS = 1447;

// ─── BONDS ───────────────────────────────────────────────────────────────────
const B0 = [
  // LECAP
  { id:"s29y6",  t:"S29Y6",  n:"Lecap May'26",    tp:"LECAP", y:2.48, m:"2026-05-29", active:true, exitYields:{BASE:2.45,BULL:1.75,BEAR:3.40} },
  { id:"t30j6",  t:"T30J6",  n:"Lecap Jun'26",    tp:"LECAP", y:2.47, m:"2026-06-30", active:true, exitYields:{BASE:2.50,BULL:1.80,BEAR:3.50} },
  { id:"s31l6",  t:"S31L6",  n:"Lecap Jul'26",    tp:"LECAP", y:2.44, m:"2026-07-31", active:true, exitYields:{BASE:2.50,BULL:1.80,BEAR:3.30} },
  { id:"s31g6",  t:"S31G6",  n:"Lecap Ago'26",    tp:"LECAP", y:2.45, m:"2026-08-31", active:true, exitYields:{BASE:2.50,BULL:1.70,BEAR:3.30} },
  { id:"s30o6",  t:"S30O6",  n:"Lecap Oct'26",    tp:"LECAP", y:2.47, m:"2026-10-30", active:true, exitYields:{BASE:2.40,BULL:1.60,BEAR:3.30} },
  { id:"s30n6",  t:"S30N6",  n:"Lecap Nov'26",    tp:"LECAP", y:2.49, m:"2026-11-30", active:true, exitYields:{BASE:2.40,BULL:1.60,BEAR:3.40} },
  { id:"to26",   t:"TO26",   n:"Lecap Oct17'26",  tp:"LECAP", y:2.53, m:"2026-10-17", active:true, exitYields:{BASE:2.40,BULL:1.60,BEAR:3.40} },
  { id:"t15e7",  t:"T15E7",  n:"Lecap Ene'27",    tp:"LECAP", y:2.46, m:"2027-01-15", active:true, exitYields:{BASE:2.30,BULL:1.60,BEAR:3.50} },
  { id:"t30a7",  t:"T30A7",  n:"Lecap Abr'27",    tp:"LECAP", y:2.43, m:"2027-04-30", active:true, exitYields:{BASE:2.30,BULL:1.60,BEAR:3.50} },
  { id:"t31y7",  t:"T31Y7",  n:"Lecap May'27",    tp:"LECAP", y:2.42, m:"2027-05-31", active:true, exitYields:{BASE:2.20,BULL:1.60,BEAR:3.40} },
  { id:"t30j7",  t:"T30J7",  n:"Lecap Jun'27",    tp:"LECAP", y:2.36, m:"2027-06-30", active:true, exitYields:{BASE:2.20,BULL:1.60,BEAR:3.40} },
  { id:"ty30p",  t:"TY30P",  n:"Lecap May'30",    tp:"LECAP", y:2.03, m:"2030-05-30", active:true, exitYields:{BASE:1.90,BULL:1.60,BEAR:2.90} },
  { id:"m31g6",  t:"M31G6",  n:"M31G6 Ago'26",    tp:"LECAP", y:3.51, m:"2026-08-31", active:false, exitYields:{BASE:2.50,BULL:1.70,BEAR:3.30} },
  { id:"tmf27",  t:"TMF27",  n:"TMF27 Feb'27",    tp:"LECAP", y:1.57, m:"2027-02-26", active:false, exitYields:{BASE:2.30,BULL:1.60,BEAR:3.50} },
  // CER
  { id:"x29y6",  t:"X29Y6",  n:"CER May'26",      tp:"CER", y:-0.15, dur:0.10, m:"2026-05-29", active:true, exitYields:{BASE:1.10,BULL:4.90,BEAR:17.40} },
  { id:"tzx26",  t:"TZX26",  n:"CER Jun'26",      tp:"CER", y:2.06, dur:0.25,  m:"2026-06-30", active:true, exitYields:{BASE:2.20,BULL:6.30,BEAR:15.60} },
  { id:"x31l6",  t:"X31L6",  n:"CER Jul'26",      tp:"CER", y:2.15, dur:0.35,  m:"2026-07-31", active:true, exitYields:{BASE:3.30,BULL:6.30,BEAR:14.80} },
  { id:"tx26",   t:"TX26",   n:"Boncer Nov'26",   tp:"CER", y:4.11, dur:0.35,  m:"2026-11-09", active:true, exitYields:{BASE:3.80,BULL:6.30,BEAR:14.50} },
  { id:"tzxo6",  t:"TZXO6",  n:"CER Oct'26",      tp:"CER", y:5.48, dur:0.42,  m:"2026-10-30", active:true, exitYields:{BASE:4.50,BULL:6.30,BEAR:14.00} },
  { id:"x30n6",  t:"X30N6",  n:"CER Nov'26",      tp:"CER", y:5.67, dur:0.50,  m:"2026-11-30", active:true, exitYields:{BASE:4.80,BULL:6.30,BEAR:14.00} },
  { id:"tzxd6",  t:"TZXD6",  n:"CER Dic'26",      tp:"CER", y:5.66, dur:0.55,  m:"2026-12-15", active:true, exitYields:{BASE:4.80,BULL:6.30,BEAR:13.80} },
  { id:"tzxm7",  t:"TZXM7",  n:"CER Mar'27",      tp:"CER", y:6.71, dur:0.80,  m:"2027-03-31", active:true, exitYields:{BASE:5.40,BULL:6.30,BEAR:13.60} },
  { id:"tzx27",  t:"TZX27",  n:"CER Jun'27",      tp:"CER", y:6.90, dur:0.95,  m:"2027-06-30", active:true, exitYields:{BASE:5.80,BULL:6.30,BEAR:13.70} },
  { id:"tx28",   t:"TX28",   n:"Boncer Nov'28",   tp:"CER", y:7.24, dur:1.20,  m:"2028-11-09", active:true, exitYields:{BASE:5.90,BULL:6.30,BEAR:13.60} },
  { id:"tzxd7",  t:"TZXD7",  n:"CER Dic'27",      tp:"CER", y:7.82, dur:1.55,  m:"2027-12-15", active:true, exitYields:{BASE:6.10,BULL:6.30,BEAR:12.90} },
  { id:"tzx28",  t:"TZX28",  n:"CER Jun'28",      tp:"CER", y:8.57, dur:2.20,  m:"2028-06-30", active:true, exitYields:{BASE:6.50,BULL:6.30,BEAR:12.80} },
  { id:"tx31",   t:"TX31",   n:"Boncer Nov'31",   tp:"CER", y:8.48, dur:2.80,  m:"2031-11-30", active:true, exitYields:{BASE:7.00,BULL:6.30,BEAR:12.90} },
  { id:"dicp",   t:"DICP",   n:"Discount CER '33",tp:"CER", y:8.66, dur:3.00,  m:"2033-12-31", active:true, exitYields:{BASE:7.00,BULL:6.30,BEAR:12.50} },
  { id:"parp",   t:"PARP",   n:"Par CER '38",     tp:"CER", y:8.66, dur:5.50,  m:"2038-12-31", active:true, exitYields:{BASE:8.00,BULL:6.70,BEAR:12.20} },
  { id:"cuap",   t:"CUAP",   n:"Cuasipar CER '45",tp:"CER", y:7.75, dur:5.60,  m:"2045-12-31", active:true, exitYields:{BASE:8.40,BULL:7.40,BEAR:11.90} },
  // TAMAR
  { id:"ttj26",  t:"TTJ26",  n:"TAMAR Jun'26",    tp:"TAMAR", y:1.93, sp:-0.5, m:"2026-06-30", active:true, exitYields:{BASE:2.50,BULL:1.80,BEAR:3.50} },
  { id:"tts26",  t:"TTS26",  n:"TAMAR Sep'26",    tp:"TAMAR", y:3.59, sp:0,    m:"2026-09-15", active:true, exitYields:{BASE:2.40,BULL:1.80,BEAR:3.30} },
  { id:"ttd26",  t:"TTD26",  n:"TAMAR Dic'26",    tp:"TAMAR", y:4.11, sp:0,    m:"2026-12-15", active:true, exitYields:{BASE:2.20,BULL:1.70,BEAR:3.40} },
  // USD
  { id:"bpoc7",  t:"BPOC7",  n:"Bopreal C 2027",  tp:"USD", y:5.7,  coupon:5.0, dur:1.5, m:"2027-10-31", active:true, exitYields:{BASE:5.20,BULL:4.00,BEAR:8.50} },
  { id:"bpod7",  t:"BPOD7",  n:"Bopreal D 2027",  tp:"USD", y:8.2,  coupon:7.0, dur:1.3, m:"2027-10-31", active:true, exitYields:{BASE:7.00,BULL:5.00,BEAR:10.00} },
  { id:"bpoa8",  t:"BPOA8",  n:"Bopreal A 2028",  tp:"USD", y:9.6,  coupon:8.0, dur:1.8, m:"2028-04-30", active:true, exitYields:{BASE:8.00,BULL:6.00,BEAR:11.00} },
  { id:"al29",   t:"AL29",   n:"Bonar 2029",      tp:"USD", y:10.1, coupon:1.0, dur:2.5, m:"2029-07-09", active:true, exitYields:{BASE:8.60,BULL:5.30,BEAR:16.30} },
  { id:"al30",   t:"AL30",   n:"Bonar 2030",      tp:"USD", y:10.2, coupon:0.5, dur:3.2, m:"2030-07-09", active:true, exitYields:{BASE:8.60,BULL:5.70,BEAR:15.30} },
  { id:"al35",   t:"AL35",   n:"Bonar 2035",      tp:"USD", y:9.9,  coupon:3.6, dur:6.5, m:"2035-07-09", active:true, exitYields:{BASE:8.80,BULL:7.50,BEAR:12.40} },
  { id:"gd29",   t:"GD29",   n:"Global 2029",     tp:"USD", y:7.7,  coupon:1.0, dur:2.5, m:"2029-07-09", active:true, exitYields:{BASE:7.40,BULL:5.20,BEAR:13.00} },
  { id:"gd30",   t:"GD30",   n:"Global 2030",     tp:"USD", y:8.5,  coupon:0.5, dur:3.5, m:"2030-07-09", active:true, exitYields:{BASE:7.60,BULL:5.60,BEAR:12.70} },
  { id:"gd35",   t:"GD35",   n:"Global 2035",     tp:"USD", y:9.6,  coupon:3.6, dur:6.5, m:"2035-07-09", active:true, exitYields:{BASE:8.70,BULL:7.40,BEAR:11.90} },
  { id:"gd38",   t:"GD38",   n:"Global Ene'38",   tp:"USD", y:9.6,  coupon:3.5, dur:7.0, m:"2038-01-09", active:true, exitYields:{BASE:8.50,BULL:7.20,BEAR:12.00} },
  { id:"gd41",   t:"GD41",   n:"Global 2041",     tp:"USD", y:9.7,  coupon:4.0, dur:8.0, m:"2041-07-09", active:true, exitYields:{BASE:8.80,BULL:7.60,BEAR:11.90} },
  { id:"gd46",   t:"GD46",   n:"Global 2046",     tp:"USD", y:9.6,  coupon:4.1, dur:9.0, m:"2046-07-09", active:true, exitYields:{BASE:8.90,BULL:7.80,BEAR:12.00} },
];

// ─── ENGINE ──────────────────────────────────────────────────────────────────
const NOW = new Date("2026-03-12");
function mths(ds) { return Math.max(0.001, (new Date(ds) - NOW) / (30.44 * 86400000)); }

function priceBond(tp, yld, monthsLeft, couponRate) {
  if (monthsLeft <= 0) return 100;
  if (tp === "LECAP") return 100 / Math.pow(1 + yld / 100, monthsLeft);
  if (tp === "CER")   return 100 / Math.pow(1 + yld / 100, monthsLeft / 12);
  if (tp === "USD") {
    const n = Math.max(1, Math.round(monthsLeft / 6));
    const c = (couponRate ?? yld) / 200;
    const y = yld / 200;
    let p = 0;
    for (let i = 1; i <= n; i++) p += c * 100 / Math.pow(1 + y, i);
    return p + 100 / Math.pow(1 + y, n);
  }
  return 100;
}

function calcReturn(bond, scen, scenKey, horizon, currentBCS, peerCurveKey = null, cerCurveKey = null) {
  const m0  = mths(bond.m);
  const h   = Math.min(horizon, m0);
  const m1  = Math.max(0, m0 - h);
  // Resolve exit yield: USD uses peer sovereign curves, CER uses real yield target curves
  const ey  = bond.tp === "USD" ? resolveUSDExit(bond, scenKey, peerCurveKey)
             : bond.tp === "CER" ? resolveCERExitYield(bond, scenKey, cerCurveKey)
             : (bond.exitYields?.[scenKey] ?? bond.y);
  const path = scen.cpiPath ?? Array(24).fill(scen.cpiM ?? 2.5);

  if (bond.tp === "LECAP") {
    const p0   = priceBond("LECAP", bond.y, m0);
    const p1   = priceBond("LECAP", ey, m1);
    const rARS = p1 / p0 - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  if (bond.tp === "CER") {
    const carry    = Math.pow(1 + bond.y / 100, h / 12) - 1;
    const priceChg = -(bond.dur ?? 1) * (ey - bond.y) / 100;
    const cumCPI   = calcCumCPI(path, h);
    const rARS     = (1 + carry) * (1 + priceChg) * (1 + cumCPI) - 1;
    const rUSD     = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  if (bond.tp === "TAMAR") {
    const spM  = (bond.sp ?? 0) / 12 / 100;
    const rARS = Math.pow(1 + scen.tamarM / 100 + spM, h) - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  if (bond.tp === "BADLAR") {
    const spM  = (bond.sp ?? 0) / 12 / 100;
    const rARS = Math.pow(1 + scen.badlarM / 100 + spM, h) - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  if (bond.tp === "USD") {
    const p0       = priceBond("USD", bond.y, m0, bond.coupon);
    const p1       = priceBond("USD", ey, m1, bond.coupon);
    const nCpns    = Math.floor(h / 6);
    const cpnAccr  = ((bond.coupon ?? bond.y) / 200) * nCpns;
    const rUSD     = (p1 + cpnAccr) / p0 - 1;
    const rARS     = (1 + rUSD) * (scen.exitBCS / currentBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  if (bond.tp === "FIXED_ARS") {
    const p0   = priceBond("CER", bond.y, m0);
    const p1   = priceBond("CER", ey, m1);
    const rARS = p1 / p0 - 1;
    const rUSD = (1 + rARS) * (currentBCS / scen.exitBCS) - 1;
    return { rARS: rARS * 100, rUSD: rUSD * 100 };
  }
  return { rARS: 0, rUSD: 0 };
}

function calcWt(bond, scens, h, bcs, peerCurves = {}, cerCurves = {}) {
  let wA = 0, wU = 0, tw = 0;
  Object.entries(scens).forEach(([k, s]) => {
    const r = calcReturn(bond, s, k, h, bcs, peerCurves[k] ?? null, cerCurves[k] ?? null);
    wA += r.rARS * s.w; wU += r.rUSD * s.w; tw += s.w;
  });
  return { rARS: wA / tw, rUSD: wU / tw };
}

// ─── BREAKEVENS ──────────────────────────────────────────────────────────────
// BE CPI: qué CPI mensual (flat) hace que CER = LECAP en retorno USD?
function breakEvenCPI(cerBond, scen, scenKey, h, bcs, targetUSD) {
  // r_CER_USD(cpiM) = targetUSD
  // (1+carry)(1+priceChg)(1+cumCPI) × (bcs/exitBCS) − 1 = targetUSD
  // cumCPI = (1+targetUSD)×(exitBCS/bcs) / [(1+carry)(1+priceChg)] − 1
  const ey       = cerBond.exitYields?.[scenKey] ?? cerBond.y;
  const carry    = Math.pow(1 + cerBond.y / 100, h / 12) - 1;
  const priceChg = -(cerBond.dur ?? 1) * (ey - cerBond.y) / 100;
  const target   = targetUSD / 100;
  const num      = (1 + target) * (scen.exitBCS / bcs);
  const denom    = (1 + carry) * (1 + priceChg);
  const cumCPI   = num / denom - 1;
  if (cumCPI <= -1) return null;
  const monthly  = (Math.pow(1 + cumCPI, 1 / h) - 1) * 100;
  return +monthly.toFixed(2);
}

// BE BCS: qué exit BCS hace que CER = USD en retorno USD?
function breakEvenBCS(cerBond, scen, scenKey, h, bcs, targetUSD) {
  // rARS_CER: fixed (depends on CPI path, not on exitBCS)
  const ey       = cerBond.exitYields?.[scenKey] ?? cerBond.y;
  const carry    = Math.pow(1 + cerBond.y / 100, h / 12) - 1;
  const priceChg = -(cerBond.dur ?? 1) * (ey - cerBond.y) / 100;
  const cumCPI   = calcCumCPI(scen.cpiPath ?? Array(24).fill(2.5), h);
  const rARS     = (1 + carry) * (1 + priceChg) * (1 + cumCPI) - 1;
  // exitBCS = bcs × (1+rARS) / (1+targetUSD)
  const exitBCS  = bcs * (1 + rARS) / (1 + targetUSD / 100);
  return +exitBCS.toFixed(0);
}

// ─── CASHFLOWS ───────────────────────────────────────────────────────────────
function genCashflows(bond, scen, h) {
  const m0 = mths(bond.m), matDate = new Date(bond.m), rows = [];
  const path = scen.cpiPath ?? Array(24).fill(scen.cpiM ?? 2.5);
  if (bond.tp === "LECAP") {
    const p0 = priceBond("LECAP", bond.y, m0).toFixed(3);
    const mLeft = Math.max(0, m0 - h);
    const p1    = priceBond("LECAP", bond.exitYields?.BASE ?? bond.y, mLeft).toFixed(3);
    rows.push({ date: bond.m, label: "Vto / Exit", coupon:0, principal:100, total:100, note:`P₀=${p0} → P₁=${p1}` });
    return rows;
  }
  const freq = bond.tp === "TAMAR" || bond.tp === "BADLAR" ? 4 : 2;
  const nP   = Math.max(1, Math.round(m0 * freq / 12));
  const mpp  = 12 / freq;
  for (let i = 1; i <= nP; i++) {
    const d = new Date(matDate);
    d.setMonth(d.getMonth() - Math.round(mpp * (nP - i)));
    const dStr = d.toISOString().slice(0, 10);
    const mfn  = (d - NOW) / (30.44 * 86400000);
    if (mfn < 0) continue;
    let coupon = 0;
    if (bond.tp === "CER") {
      const cumCPI = calcCumCPI(path, mfn);
      coupon = (bond.y / 100) * (1 + cumCPI) * 100 / freq;
    } else if (bond.tp === "TAMAR")  coupon = (Math.pow(1 + scen.tamarM / 100, mpp) - 1) * 100;
    else if (bond.tp === "BADLAR")   coupon = (Math.pow(1 + scen.badlarM / 100, mpp) - 1) * 100;
    else                             coupon = ((bond.coupon ?? bond.y) / 100) * 100 / freq;
    const principal = i === nP ? 100 : 0;
    rows.push({ date:dStr, label:`Período ${i}`, coupon:+coupon.toFixed(3), principal, total:+(coupon+principal).toFixed(3) });
  }
  return rows;
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
const fmtS = (v,d=1) => { const n=+v; if(isNaN(n))return"–"; return`${n>=0?"+":""}${n.toFixed(d)}%`; };
const fmtP = (v,d=1) => `${(+v).toFixed(d)}%`;
function rc(v)  { if(v>15)return C.pos; if(v>0)return"#16a34a"; if(v<-5)return C.neg; if(v<0)return"#f87171"; return C.muted; }
function rcu(v) { if(v>8) return C.pos; if(v>0)return"#16a34a"; if(v<-3)return C.neg; if(v<0)return"#f87171"; return C.muted; }

const blank = { t:"",n:"",tp:"USD",y:"",coupon:"",sp:"0",m:"",exitYields:{BASE:"",BULL:"",BEAR:""} };
function TH(a="center") { return{ padding:"8px 7px",color:"rgba(255,255,255,.75)",fontWeight:600,fontSize:10,letterSpacing:.5,textAlign:a,textTransform:"uppercase",whiteSpace:"nowrap" }; }
function TH2()          { return{ padding:"3px 7px",color:"rgba(255,255,255,.4)",fontWeight:500,fontSize:9,textAlign:"center" }; }
function TD(a="left")   { return{ padding:"8px 7px",whiteSpace:"nowrap",textAlign:a }; }



// USD sub-types
function usdSubtype(ticker) {
  if (ticker.startsWith("BP")) return "BOPREAL";
  if (ticker.startsWith("AL") || ticker.startsWith("AE")) return "BONAR";
  if (ticker.startsWith("GD")) return "GLOBAL";
  return "USD";
}
const USD_SUBTYPES = {
  BOPREAL:{ label:"Bopreales", color:"#0f766e", lineColor:"#14b8a6" },
  BONAR:  { label:"Bonares",   color:"#7c3aed", lineColor:"#a78bfa" },
  GLOBAL: { label:"Globales",  color:"#166534", lineColor:"#4ade80" },
};

// ─── PEER CURVE CHART ────────────────────────────────────────────────────────
// Multi-line sovereign curve chart + Argentina bonds as dots
function PeerCurveChart({ bonds, usdTargets, scens, horizon, currentBCS }) {
  const w = 1100, h = 400;
  const mg = { t:40, r:200, b:48, l:55 };
  const pw = w - mg.l - mg.r, ph = h - mg.t - mg.b;
  const xMin=0, xMax=14, yMin=4.5, yMax=12;
  const px = x => mg.l + (x-xMin)/(xMax-xMin)*pw;
  const py = y => mg.t + (1-(y-yMin)/(yMax-yMin))*ph;

  // Build smooth polyline points for each curve
  const buildLine = (pts) => {
    const dRange = Array.from({length:141}, (_,i)=>i*0.1);
    return dRange.map(d=>{
      if(d<pts[0].d||d>pts[pts.length-1].d)return null;
      for(let i=0;i<pts.length-1;i++){
        if(d>=pts[i].d&&d<=pts[i+1].d){
          const t=(d-pts[i].d)/(pts[i+1].d-pts[i].d);
          return{x:px(d), y:py(pts[i].y+t*(pts[i+1].y-pts[i].y))};
        }
      }
      return null;
    }).filter(Boolean);
  };

  const toSvgPath = (pts) => pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Argentina bonds (USD) for overlay dots
  const argBonds = bonds.filter(b=>b.active&&b.tp==="USD");

  const ticksX = Array.from({length:8},(_,i)=>i*2);
  const ticksY = Array.from({length:16},(_,i)=>+(4.5+i*0.5).toFixed(1));

  // Highlight selected target curves
  const activeCurves = new Set(Object.values(usdTargets).filter(k=>k!=="manual"));

  return (
    <div style={{overflowX:"auto"}}>
      <svg width={w} height={h} style={{fontFamily:"inherit",display:"block"}}>
        <text x={w/2-mg.r/2} y={22} textAnchor="middle" fontSize={13} fontWeight={800} fill={C.navy}>
          Dollar Sovereign Bonds — NY Law Yield Curve & Target (Yield%)
        </text>

        {/* Grid */}
        {ticksX.map(v=><line key={v} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={v===0?1.5:0.7}/>)}
        {ticksY.map(v=><line key={v} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={v===Math.round(v)?0.7:0.4}/>)}
        <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border} strokeWidth={1}/>

        {/* Tick labels */}
        {ticksX.map(v=><text key={v} x={px(v)} y={mg.t+ph+16} textAnchor="middle" fontSize={10} fill={C.muted}>{v}</text>)}
        {ticksY.filter(v=>v===Math.round(v)||v%0.5===0).map(v=>(
          <text key={v} x={mg.l-7} y={py(v)+3.5} textAnchor="end" fontSize={9.5} fill={C.muted}>{v.toFixed(1)}</text>
        ))}
        <text x={mg.l+pw/2} y={h-8} textAnchor="middle" fontSize={11} fill={C.muted}>Duration (years)</text>
        <text x={14} y={mg.t+ph/2} textAnchor="middle" fontSize={11} fill={C.muted} transform={`rotate(-90,14,${mg.t+ph/2})`}>Yield (%)</text>

        {/* Peer curves */}
        {Object.entries(PEER_CURVES).filter(([k])=>k!=="manual"&&k!=="argentina_now").map(([key,curve])=>{
          if(curve.points.length===0) return null;
          const linePts = buildLine(curve.points);
          const isActive = activeCurves.has(key);
          return (
            <g key={key} opacity={isActive?1:0.55}>
              <path d={toSvgPath(linePts)} fill="none" stroke={curve.color}
                strokeWidth={isActive?3:1.8}
                strokeDasharray={curve.dash?"8 4":"none"}/>
              {/* Label at end of line */}
              {linePts.length>0&&(
                <text x={linePts[linePts.length-1].x+6} y={linePts[linePts.length-1].y+4}
                  fontSize={isActive?11:9.5} fontWeight={isActive?800:500} fill={curve.color}>
                  {curve.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Argentina actual (thin dashed) */}
        {(()=>{
          const c = PEER_CURVES.argentina_now;
          const linePts = buildLine(c.points);
          return <path d={toSvgPath(linePts)} fill="none" stroke={c.color} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7}/>;
        })()}

        {/* Argentina bonds — 3 separate curves: Bopreales, Bonares, Globales */}
        {(()=>{
          const subtypes = ["BOPREAL","BONAR","GLOBAL"];
          const targetCurveColor = PEER_CURVES[usdTargets.BASE]?.color||C.blue2;
          return subtypes.map(stype => {
            const cfg = USD_SUBTYPES[stype];
            const grp = argBonds.filter(b=>usdSubtype(b.t)===stype).sort((a,z)=>(a.dur??3)-(z.dur??3));
            if (grp.length===0) return null;

            // Build polylines for actual yields and target yields
            const actualPts  = grp.map(b=>({x:px(b.dur??3), y:py(b.y), b}));
            const targetPts  = usdTargets.BASE!=="manual"
              ? grp.map(b=>{const ty=interpYield(usdTargets.BASE,b.dur??3); return{x:px(b.dur??3),y:py(ty),ty};})
              : null;

            const actualPath = actualPts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
            const targetPath = targetPts ? targetPts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : null;

            return (
              <g key={stype}>
                {/* Actual yield curve line */}
                {actualPts.length>1&&<path d={actualPath} fill="none" stroke={cfg.lineColor} strokeWidth={2.5} strokeDasharray="6 3" opacity={0.9}/>}
                {/* Target yield curve line */}
                {targetPath&&targetPts.length>1&&<path d={targetPath} fill="none" stroke={targetCurveColor} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.55}/>}
                {/* Dots + labels */}
                {actualPts.map(({x,y,b},i)=>{
                  const dur = b.dur??3;
                  const ty = usdTargets.BASE!=="manual" ? interpYield(usdTargets.BASE,dur) : null;
                  const tcy = ty!=null ? py(ty) : null;
                  return (
                    <g key={b.id}>
                      {/* Vertical arrow actual→target */}
                      {tcy!=null&&Math.abs(tcy-y)>3&&(
                        <line x1={x} y1={y} x2={x} y2={tcy}
                          stroke={targetCurveColor} strokeWidth={1.2} strokeDasharray="2 2" opacity={0.6}
                          markerEnd="url(#arrowBlue)"/>
                      )}
                      {/* Actual dot */}
                      <circle cx={x} cy={y} r={5.5} fill={cfg.color} stroke="white" strokeWidth={1.5}/>
                      {/* Target dot */}
                      {tcy!=null&&<circle cx={x} cy={tcy} r={3.5} fill={targetCurveColor} stroke="white" strokeWidth={1} opacity={0.85}/>}
                      {/* Label */}
                      <text x={x+7} y={y+4} fontSize={8.5} fontWeight={800} fill={cfg.color}>{b.t}</text>
                      {ty!=null&&<text x={x+7} y={tcy+4} fontSize={7.5} fill={targetCurveColor} opacity={0.85}>{ty.toFixed(2)}%</text>}
                    </g>
                  );
                })}
                {/* Subtype label at end of curve */}
                {actualPts.length>0&&(()=>{
                  const last=actualPts[actualPts.length-1];
                  return <text x={last.x+8} y={last.y-8} fontSize={9} fontWeight={800} fill={cfg.color}>{cfg.label}</text>;
                })()}
              </g>
            );
          });
        })()}

        {/* Arrow marker def */}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#64748b"/>
          </marker>
          <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={PEER_CURVES[usdTargets.BASE]?.color||C.blue2}/>
          </marker>
        </defs>

        {/* Legend panel */}
        <rect x={w-mg.r+8} y={mg.t} width={mg.r-12} height={ph} rx={8} fill="#f8fafc" stroke={C.border}/>
        <text x={w-mg.r+14} y={mg.t+16} fontSize={10} fontWeight={700} fill={C.navy}>Curvas comparables</text>
        {Object.entries(PEER_CURVES).filter(([k])=>k!=="manual").map(([key,curve],i)=>{
          const isActive = activeCurves.has(key);
          return (
            <g key={key} opacity={isActive?1:0.5}>
              <line x1={w-mg.r+14} y1={mg.t+28+i*16} x2={w-mg.r+36} y2={mg.t+28+i*16}
                stroke={curve.color} strokeWidth={isActive?3:1.5} strokeDasharray={curve.dash?"6 3":"none"}/>
              <text x={w-mg.r+40} y={mg.t+32+i*16} fontSize={9} fill={C.text} fontWeight={isActive?700:400}>
                {curve.label.replace("Argentina ","ARG ").replace("El Salvador","El Salv.")}
              </text>
            </g>
          );
        })}
        {Object.entries(USD_SUBTYPES).map(([k,v],i)=>(
          <g key={k}>
            <circle cx={w-mg.r+20} cy={mg.t+30+(Object.keys(PEER_CURVES).length+i)*16} r={4.5} fill={v.color} stroke="white" strokeWidth={1}/>
            <line x1={w-mg.r+14} x2={w-mg.r+26} y1={mg.t+30+(Object.keys(PEER_CURVES).length+i)*16} y2={mg.t+30+(Object.keys(PEER_CURVES).length+i)*16} stroke={v.lineColor} strokeWidth={2} strokeDasharray="4 2"/>
            <text x={w-mg.r+30} y={mg.t+34+(Object.keys(PEER_CURVES).length+i)*16} fontSize={9} fill={C.text}>{v.label} (actual)</text>
          </g>
        ))}

        {/* Scenario target labels */}
        <text x={w-mg.r+14} y={mg.t+48+Object.keys(PEER_CURVES).length*16} fontSize={9} fontWeight={700} fill={C.navy}>Targets por escenario:</text>
        {Object.entries(usdTargets).map(([sc,key],i)=>(
          <text key={sc} x={w-mg.r+14} y={mg.t+62+Object.keys(PEER_CURVES).length*16+i*13} fontSize={8.5} fill={scens[sc]?.col||C.muted}>
            {sc}: {PEER_CURVES[key]?.label.split(" (")[0]||"Manual"}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── SCATTER CHART ───────────────────────────────────────────────────────────
function ScatterChart({ data, xKey, yKey, xLabel, yLabel, title, w=520, h=300, colorKey="color", labelKey="t", refLines=[] }) {
  const mg = { t:30, r:20, b:44, l:52 };
  const pw = w - mg.l - mg.r, ph = h - mg.t - mg.b;
  const xs = data.map(d=>d[xKey]), ys = data.map(d=>d[yKey]);
  let xMin=Math.min(...xs,0), xMax=Math.max(...xs), yMin=Math.min(...ys), yMax=Math.max(...ys);
  const xPad=(xMax-xMin)*0.1||1, yPad=(yMax-yMin)*0.12||1;
  xMin-=xPad; xMax+=xPad; yMin-=yPad; yMax+=yPad;
  const px = x => mg.l + (x-xMin)/(xMax-xMin)*pw;
  const py = y => mg.t + (1-(y-yMin)/(yMax-yMin))*ph;
  const nTicksX=5, nTicksY=5;
  const ticksX = Array.from({length:nTicksX},(_,i)=>xMin+i*(xMax-xMin)/(nTicksX-1));
  const ticksY = Array.from({length:nTicksY},(_,i)=>yMin+i*(yMax-yMin)/(nTicksY-1));
  return (
    <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible"}}>
      <text x={w/2} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.navy}>{title}</text>
      {/* Grid */}
      {ticksX.map((v,i)=><line key={i} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={1}/>)}
      {ticksY.map((v,i)=><line key={i} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={1}/>)}
      {/* Zero lines */}
      {yMin<0&&yMax>0&&<line x1={mg.l} y1={py(0)} x2={mg.l+pw} y2={py(0)} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"/>}
      {/* Ref lines */}
      {refLines.map((rl,i)=>(
        <g key={i}>
          {rl.axis==="x"&&<line x1={px(rl.v)} y1={mg.t} x2={px(rl.v)} y2={mg.t+ph} stroke={rl.color||"#94a3b8"} strokeWidth={1.5} strokeDasharray="4 3"/>}
          {rl.axis==="y"&&<line x1={mg.l} y1={py(rl.v)} x2={mg.l+pw} y2={py(rl.v)} stroke={rl.color||"#94a3b8"} strokeWidth={1.5} strokeDasharray="4 3"/>}
        </g>
      ))}
      {/* Axes */}
      <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border} strokeWidth={1}/>
      {ticksX.map((v,i)=>(
        <text key={i} x={px(v)} y={mg.t+ph+14} textAnchor="middle" fontSize={9} fill={C.muted}>{v.toFixed(1)}</text>
      ))}
      {ticksY.map((v,i)=>(
        <text key={i} x={mg.l-6} y={py(v)+3} textAnchor="end" fontSize={9} fill={C.muted}>{v.toFixed(1)}%</text>
      ))}
      <text x={mg.l+pw/2} y={h-4} textAnchor="middle" fontSize={10} fill={C.muted}>{xLabel}</text>
      <text x={10} y={mg.t+ph/2} textAnchor="middle" fontSize={10} fill={C.muted} transform={`rotate(-90,10,${mg.t+ph/2})`}>{yLabel}</text>
      {/* Points */}
      {data.map((d,i)=>{
        const cx=px(d[xKey]), cy=py(d[yKey]);
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill={d[colorKey]||C.blue1} opacity={0.85} stroke="white" strokeWidth={1}/>
            <text x={cx+7} y={cy+4} fontSize={8.5} fill={C.text} fontWeight={600}>{d[labelKey]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [bonds,      setBonds]     = useState(B0);
  const [scens,      setScens]     = useState(S0);
  const [currentBCS, setBCS]       = useState(DEFAULT_CURRENT_BCS);
  const [horizon,    setHorizon]   = useState(3);
  const [tab,        setTab]       = useState("retornos"); // retornos | curvas | breakevens
  const [showPanel,  setShowPanel] = useState(false);
  const [usdTargets, setUsdTargets] = useState({BASE:"argentina_target", BULL:"colombia", BEAR:"egypt"}); // peer curve per scenario
  const [cerTargets, setCerTargets] = useState({BASE:"compresion_leve", BULL:"compresion_fuerte", BEAR:"decompresion"}); // CER real yield target per scenario
  const [expandPath, setExpandPath]= useState({});        // {BASE:true, ...}
  const [showAdd,    setShowAdd]   = useState(false);
  const [newBond,    setNewBond]   = useState(blank);
  const [sortBy,     setSortBy]    = useState("wUSD");
  const [filterTp,   setFilterTp]  = useState("ALL");
  const [cfBond,     setCfBond]    = useState(null);
  const [cfScen,     setCfScen]    = useState("BASE");
  const [editBond,   setEditBond]  = useState(null);

  // ── derived ──────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const active = bonds.filter(b => b.active);
    return active
      .filter(b => filterTp === "ALL" || b.tp === filterTp)
      .map(b => {
        const byScen = {};
        Object.entries(scens).forEach(([k,s]) => { byScen[k] = calcReturn(b, s, k, horizon, currentBCS, b.tp==="USD" ? usdTargets[k] : null, b.tp==="CER" ? cerTargets[k] : null); });
        const wt = calcWt(b, scens, horizon, currentBCS, b.tp==="USD" ? usdTargets : {}, b.tp==="CER" ? cerTargets : {});
        return { ...b, byScen, wt };
      })
      .sort((a,z) => {
        if(sortBy==="wUSD")    return z.wt.rUSD - a.wt.rUSD;
        if(sortBy==="wARS")    return z.wt.rARS - a.wt.rARS;
        if(sortBy==="baseUSD") return z.byScen.BASE.rUSD - a.byScen.BASE.rUSD;
        if(sortBy==="baseARS") return z.byScen.BASE.rARS - a.byScen.BASE.rARS;
        return 0;
      });
  }, [bonds, scens, horizon, currentBCS, sortBy, filterTp, usdTargets, cerTargets]);

  const cfData = useMemo(() => {
    if (!cfBond) return [];
    return genCashflows(cfBond, scens[cfScen], horizon);
  }, [cfBond, cfScen, scens, horizon]);

  // ── handlers ─────────────────────────────────────────────────────────────
  const removeBond  = id => setBonds(p => p.filter(b => b.id !== id));
  const togBond     = id => setBonds(p => p.map(b => b.id===id ? {...b,active:!b.active} : b));
  const updScen     = (k,f,v) => setScens(p => ({...p,[k]:{...p[k],[f]:+v||0}}));
  const updCpiPath  = (k,i,v) => setScens(p => {
    const newPath = [...p[k].cpiPath];
    newPath[i] = +v || 0;
    return {...p,[k]:{...p[k],cpiPath:newPath}};
  });
  const fillPath    = (k,v) => setScens(p => ({...p,[k]:{...p[k],cpiPath:Array(24).fill(+v||0)}}));
  const saveEY      = (id,k,v) => setBonds(p => p.map(b => b.id===id ? {...b,exitYields:{...b.exitYields,[k]:+v}} : b));

  const addBond = () => {
    if (!newBond.t || !newBond.m || !newBond.y) return;
    setBonds(p => [...p, {
      id:`${newBond.t.toLowerCase()}_${Date.now()}`,
      t:newBond.t, n:newBond.n||newBond.t, tp:newBond.tp,
      y:+newBond.y, coupon:newBond.coupon?+newBond.coupon:undefined,
      sp:+newBond.sp||0, m:newBond.m, active:true,
      exitYields:{ BASE:+newBond.exitYields.BASE||+newBond.y, BULL:+newBond.exitYields.BULL||+newBond.y, BEAR:+newBond.exitYields.BEAR||+newBond.y }
    }]);
    setNewBond(blank); setShowAdd(false);
  };

  // ── curve data ────────────────────────────────────────────────────────────
  const cerCurve = useMemo(() => {
    return bonds.filter(b=>b.active && b.tp==="CER").map(b=>{
      const years = mths(b.m)/12;
      return { t:b.t, x:+(years.toFixed(2)), y:+b.y, color:TYPES.CER.color, dur:b.dur||0 };
    }).sort((a,z)=>a.x-z.x);
  }, [bonds]);

  const returnCurve = useMemo(() => {
    const active = bonds.filter(b=>b.active);
    return active.map(b=>{
      const wt  = calcWt(b, scens, horizon, currentBCS, b.tp==="USD" ? usdTargets : {}, b.tp==="CER" ? cerTargets : {});
      const bull = calcReturn(b, scens.BULL, "BULL", horizon, currentBCS, b.tp==="USD" ? usdTargets.BULL : null, b.tp==="CER" ? cerTargets.BULL : null);
      const bear = calcReturn(b, scens.BEAR, "BEAR", horizon, currentBCS, b.tp==="USD" ? usdTargets.BEAR : null, b.tp==="CER" ? cerTargets.BEAR : null);
      return {
        t:b.t, dur:b.dur||0.2,
        wUSD:+wt.rUSD.toFixed(2),
        bullUSD:+bull.rUSD.toFixed(2),
        bearUSD:+bear.rUSD.toFixed(2),
        color: TYPES[b.tp]?.color||C.muted
      };
    });
  }, [bonds, scens, horizon, currentBCS]);

  // ── breakevens ───────────────────────────────────────────────────────────
  const breakevens = useMemo(() => {
    const cerBonds  = bonds.filter(b=>b.active && b.tp==="CER");
    const lecapRef  = bonds.find(b=>b.active && b.tp==="LECAP" && mths(b.m)>=horizon) || bonds.find(b=>b.tp==="LECAP");
    const usdRef    = bonds.find(b=>b.active && b.tp==="USD" && b.t==="GD30") || bonds.find(b=>b.active && b.tp==="USD");
    if (!lecapRef || !usdRef) return [];

    return cerBonds.map(b => {
      const row = { t:b.t, n:b.n };
      // vs LECAP: qué CPI hace que retorno USD del CER = retorno USD del LECAP (en escenario BASE)?
      const lecapR = calcReturn(lecapRef, scens.BASE, "BASE", horizon, currentBCS).rUSD;
      row.beCPIvsLecap  = breakEvenCPI(b, scens.BASE, "BASE", horizon, currentBCS, lecapR);
      // vs LECAP BULL
      const lecapRBull  = calcReturn(lecapRef, scens.BULL, "BULL", horizon, currentBCS).rUSD;
      row.beCPIvsLecapBull = breakEvenCPI(b, scens.BULL, "BULL", horizon, currentBCS, lecapRBull);
      // vs USD: qué BCS hace que retorno USD del CER = retorno USD del bono USD ref?
      const usdR       = calcReturn(usdRef, scens.BASE, "BASE", horizon, currentBCS).rUSD;
      row.beBCSvsUSD   = breakEvenBCS(b, scens.BASE, "BASE", horizon, currentBCS, usdR);
      // scenario BASE values
      const cerR = calcReturn(b, scens.BASE, "BASE", horizon, currentBCS);
      row.cerBaseUSD = +cerR.rUSD.toFixed(1);
      row.cerBaseARS = +cerR.rARS.toFixed(1);
      row.lecapRef   = lecapRef.t;
      row.usdRef     = usdRef.t;
      row.lecapBaseUSD = +lecapR.toFixed(1);
      row.usdBaseUSD   = +usdR.toFixed(1);
      return row;
    });
  }, [bonds, scens, horizon, currentBCS, usdTargets, cerTargets]);

  const scenKeys = Object.keys(scens);
  const card = { background:C.card, borderRadius:12, boxShadow:"0 2px 12px rgba(0,0,57,.08)", overflow:"hidden" };
  const pill = (color) => ({ display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,color,background:color+"18" });

  // ── avg CPI from path ──────────────────────────────────────────────────
  const avgCPI = (path, h) => {
    const n = Math.min(Math.ceil(h), path.length);
    return (path.slice(0,n).reduce((a,v)=>a+v,0)/n).toFixed(2);
  };

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{ background:C.navy, padding:"0 18px", display:"flex", alignItems:"center", justifyContent:"space-between", height:58, boxShadow:"0 2px 16px rgba(0,0,57,.5)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <Logo/>
          <div style={{ borderLeft:`1px solid ${C.blue1}`, paddingLeft:12 }}>
            <div style={{ color:C.white, fontWeight:700, fontSize:14 }}>Bond Total Return</div>
            <div style={{ color:C.blue2, fontSize:9, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase" }}>BCS Methodology · Path CPI</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
          {/* BCS */}
          <div style={{ display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,.07)",borderRadius:7,padding:"4px 9px" }}>
            <span style={{ color:"#7090b0",fontSize:10 }}>BCS hoy:</span>
            <input type="number" value={currentBCS} onChange={e=>setBCS(+e.target.value||1)}
              style={{ width:55,background:"transparent",border:"none",color:C.blue2,fontWeight:800,fontSize:13,textAlign:"right",outline:"none" }}/>
          </div>
          {/* Horizon */}
          <span style={{ color:"#7090b0",fontSize:10 }}>Horizonte:</span>
          <select value={horizon} onChange={e=>setHorizon(parseInt(e.target.value,10))}
            style={{ background:C.blue1,color:C.white,border:"none",borderRadius:7,padding:"5px 8px",fontWeight:700,cursor:"pointer",fontSize:12 }}>
            {[1,2,3,6,9,12,18,24,36].map(m=>(
              <option key={m} value={m}>{m>=12?`${m/12}a${m>12?"s":""}`:m===1?"1m":`${m}m`}</option>
            ))}
          </select>
          <button onClick={()=>setShowPanel(v=>!v)}
            style={{ padding:"5px 12px",borderRadius:7,border:`1px solid ${showPanel?C.blue2:"rgba(255,255,255,.2)"}`,cursor:"pointer",fontWeight:700,fontSize:11,background:showPanel?C.blue1:"rgba(255,255,255,.1)",color:C.white }}>
            ⚙ Escenarios
          </button>
          <button onClick={()=>setShowAdd(true)}
            style={{ background:C.blue2,color:C.white,border:"none",borderRadius:7,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:11 }}>
            + Bono
          </button>
        </div>
      </header>

      {/* ── SCENARIO PANEL ──────────────────────────────────────────────────── */}
      {showPanel && (
        <div style={{ background:"#030040",borderBottom:`2px solid ${C.blue1}`,padding:"16px 18px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
            {Object.entries(scens).map(([key,s]) => {
              const avgCpi = avgCPI(s.cpiPath, horizon);
              const cumBCS = ((s.exitBCS/currentBCS-1)*100).toFixed(1);
              const cumCpi = ((calcCumCPI(s.cpiPath,horizon))*100).toFixed(1);
              const showPath = expandPath[key];
              return (
                <div key={key} style={{ background:"rgba(255,255,255,.05)",borderRadius:10,padding:12,borderTop:`3px solid ${s.col}` }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                    <span style={{ color:s.col,fontWeight:800,fontSize:14 }}>{s.label}</span>
                    <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                      <input type="number" value={s.w} onChange={e=>updScen(key,"w",e.target.value)}
                        style={{ width:36,background:"rgba(255,255,255,.12)",border:"none",color:C.white,borderRadius:4,padding:"2px 4px",textAlign:"right",fontWeight:700,fontSize:12 }}/>
                      <span style={{ color:"#7090b0",fontSize:10 }}>%</span>
                    </div>
                  </div>

                  {/* BCS + rates */}
                  {[["Exit BCS","exitBCS",1,""],["TAMAR Mensual (%)","tamarM",.1,""],["BADLAR Mensual (%)","badlarM",.1,""]].map(([lbl,field,step]) => (
                    <div key={field} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5 }}>
                      <span style={{ color:"#8090a8",fontSize:10 }}>{lbl}</span>
                      <input type="number" step={step} value={s[field]} onChange={e=>updScen(key,field,e.target.value)}
                        style={{ width:64,background:"rgba(255,255,255,.12)",border:"none",color:C.white,borderRadius:4,padding:"3px 6px",textAlign:"right",fontSize:11 }}/>
                    </div>
                  ))}

                  {/* USD Target Curve selector */}
                  <div style={{ marginTop:8,background:"rgba(255,255,255,.06)",borderRadius:7,padding:"6px 8px",borderLeft:`3px solid ${PEER_CURVES[usdTargets[key]]?.color||"#3399ff"}` }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ color:"#8090a8",fontSize:10 }}>Target USD (curva par)</span>
                      <select value={usdTargets[key]||"manual"}
                        onChange={e=>setUsdTargets(p=>({...p,[key]:e.target.value}))}
                        style={{ maxWidth:160,background:"rgba(255,255,255,.12)",border:"none",color:PEER_CURVES[usdTargets[key]]?.color||C.white,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,cursor:"pointer" }}>
                        {Object.entries(PEER_CURVES).map(([k,v])=>(
                          <option key={k} value={k} style={{ color:C.text }}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    {usdTargets[key]&&usdTargets[key]!=="manual"&&(
                      <div style={{ marginTop:4,fontSize:9,color:"#5070a0" }}>
                        {PEER_CURVES[usdTargets[key]]?.rating&&<span style={{ color:PEER_CURVES[usdTargets[key]]?.color,fontWeight:700 }}>{PEER_CURVES[usdTargets[key]]?.rating} · </span>}
                        Exit yields USD se calculan interpolando esta curva por duración de cada bono
                      </div>
                    )}
                  </div>

                  {/* CER Real Yield Target selector */}
                  <div style={{ marginTop:6,background:"rgba(255,255,255,.06)",borderRadius:7,padding:"6px 8px",borderLeft:`3px solid ${CER_TARGET_CURVES[cerTargets[key]]?.color||TYPES.CER.color}` }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <span style={{ color:"#8090a8",fontSize:10 }}>Target CER (tasa real)</span>
                      <select value={cerTargets[key]||"manual"}
                        onChange={e=>setCerTargets(p=>({...p,[key]:e.target.value}))}
                        style={{ maxWidth:180,background:"rgba(255,255,255,.12)",border:"none",color:CER_TARGET_CURVES[cerTargets[key]]?.color||TYPES.CER.color,borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,cursor:"pointer" }}>
                        {Object.entries(CER_TARGET_CURVES).map(([k,v])=>(
                          <option key={k} value={k} style={{ color:C.text }}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                    {cerTargets[key]&&cerTargets[key]!=="manual"&&(
                      <div style={{ marginTop:4,fontSize:9,color:"#5070a0" }}>
                        Exit yields CER = interpolación de curva real por duración de cada bono
                        {cerTargets[key]==="sin_cambio"&&<span style={{ color:TYPES.CER.color }}> (yields actuales, sin compresión)</span>}
                      </div>
                    )}
                  </div>

                  {/* CPI section */}
                  <div style={{ marginTop:8,background:"rgba(255,255,255,.04)",borderRadius:7,padding:"7px 8px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div>
                        <span style={{ color:"#8090a8",fontSize:10 }}>CPI path · prom {horizon}m: </span>
                        <span style={{ color:s.col,fontWeight:700,fontSize:11 }}>{avgCpi}% /m</span>
                      </div>
                      <button onClick={()=>setExpandPath(p=>({...p,[key]:!p[key]}))}
                        style={{ background:"rgba(255,255,255,.1)",border:"none",color:C.white,borderRadius:4,padding:"2px 7px",cursor:"pointer",fontSize:10 }}>
                        {showPath ? "▲ Cerrar" : "▼ Editar meses"}
                      </button>
                    </div>

                    {showPath && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ display:"flex",justifyContent:"flex-end",gap:6,marginBottom:6 }}>
                          <span style={{ color:"#5070a0",fontSize:9,alignSelf:"center" }}>Rellenar con:</span>
                          {[1.5,2.0,2.5,3.0,3.5].map(v=>(
                            <button key={v} onClick={()=>fillPath(key,v)}
                              style={{ padding:"1px 6px",fontSize:9,borderRadius:4,border:`1px solid ${s.col}50`,background:"transparent",color:s.col,cursor:"pointer" }}>{v}%</button>
                          ))}
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3 }}>
                          {s.cpiPath.slice(0,24).map((v,i)=>(
                            <div key={i} style={{ textAlign:"center" }}>
                              <div style={{ color:"#506070",fontSize:8,marginBottom:1 }}>M{i+1}</div>
                              <input type="number" step="0.1" value={v}
                                onChange={e=>updCpiPath(key,i,e.target.value)}
                                style={{ width:"100%",background:i<horizon?"rgba(255,220,100,.15)":"rgba(255,255,255,.07)",border:`1px solid ${i<horizon?s.col+"60":"transparent"}`,color:C.white,borderRadius:3,padding:"2px 2px",textAlign:"center",fontSize:9 }}/>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize:9,color:"#4060a0",marginTop:4,textAlign:"center" }}>Meses en amarillo = dentro del horizonte actual ({horizon}m)</div>
                      </div>
                    )}

                    <div style={{ marginTop:6,fontSize:9,color:"#5070a0" }}>
                      FX vs hoy: <span style={{ color:s.col,fontWeight:600 }}>{cumBCS}%</span>
                      &nbsp;· CPI acum: <span style={{ color:s.col,fontWeight:600 }}>{cumCpi}%</span>
                      &nbsp;· Real: <span style={{ color:s.col,fontWeight:600 }}>{(((1+parseFloat(cumBCS)/100)/(1+parseFloat(cumCpi)/100)-1)*100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:8,color:"#5070a0",fontSize:9,textAlign:"center" }}>
            Metodología: TR_ARS(Lecap) = P₁/P₀ · TR_ARS(CER) = (carry)(1−dur·ΔY)(1+CPI_path_acum) · TR_USD = TR_ARS × BCS_hoy/BCS_exit
          </div>
        </div>
      )}

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <div style={{ background:C.navy,borderBottom:`2px solid rgba(255,255,255,.08)`,padding:"0 18px",display:"flex",gap:2 }}>
        {[["retornos","📊 Retornos"],["curvas","📈 Curvas"],["breakevens","⚖ Breakevens"],["analisis","🔬 Análisis RV"]].map(([key,lbl])=>(
          <button key={key} onClick={()=>setTab(key)}
            style={{ padding:"9px 16px",border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
              background:"transparent",color:tab===key?C.blue2:"rgba(255,255,255,.4)",
              borderBottom:tab===key?`2px solid ${C.blue2}`:"2px solid transparent",
              marginBottom:-2,transition:"color .15s" }}>
            {lbl}
          </button>
        ))}
      </div>

      <div style={{ padding:"12px 18px" }}>

        {/* ════ TAB: RETORNOS ════════════════════════════════════════════════ */}
        {tab === "retornos" && (<>
          {/* stat bar */}
          {(() => {
            const bU = results.length ? [...results].sort((a,b)=>b.byScen.BASE.rUSD-a.byScen.BASE.rUSD)[0]:null;
            const bW = results.length ? results[0]:null;
            return (
              <div style={{ display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" }}>
                {[
                  ["BCS Hoy",`${currentBCS.toLocaleString()}`,C.blue2],
                  ["Mejor USD Base",bU?`${bU.t}: ${fmtP(bU.byScen.BASE.rUSD)}`:"-",C.teal],
                  [`#1 Pond. (${horizon}m)`,bW?`${bW.t}: ${fmtP(bW.wt.rUSD)} USD`:"-","gold"],
                ].map(([l,v,col])=>(
                  <div key={l} style={{ background:C.card,borderRadius:7,padding:"7px 14px",boxShadow:"0 1px 6px rgba(0,0,57,.07)",borderLeft:`3px solid ${col}` }}>
                    <div style={{ fontSize:9,color:C.muted }}>{l}</div>
                    <div style={{ fontSize:15,fontWeight:800,color:col }}>{v}</div>
                  </div>
                ))}
                <div style={{ background:C.card,borderRadius:7,padding:"7px 14px",boxShadow:"0 1px 6px rgba(0,0,57,.07)",borderLeft:`3px solid ${C.salmon}`,fontSize:10 }}>
                  <div style={{ color:C.muted }}>Exit BCS (Base / Bull / Bear)</div>
                  <div style={{ display:"flex",gap:10,marginTop:2 }}>
                    {Object.entries(scens).map(([k,s])=>(
                      <span key={k} style={{ fontWeight:700,color:s.col,fontSize:12 }}>{s.label}: {s.exitBCS.toLocaleString()}</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex:1 }}/>
                <div style={{ background:C.card,borderRadius:7,padding:"7px 14px",boxShadow:"0 1px 6px rgba(0,0,57,.07)",borderLeft:`3px solid ${C.green}`,fontSize:10 }}>
                  <div style={{ color:C.muted }}>CPI path avg ({horizon}m)</div>
                  <div style={{ display:"flex",gap:10,marginTop:2 }}>
                    {Object.entries(scens).map(([k,s])=>(
                      <span key={k} style={{ fontWeight:700,color:s.col,fontSize:12 }}>{s.label}: {avgCPI(s.cpiPath,horizon)}%</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* filters + sort */}
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:6 }}>
            <div style={{ display:"flex",gap:4,flexWrap:"wrap" }}>
              {["ALL",...Object.keys(TYPES)].map(tp=>{
                const cfg=TYPES[tp]; const act=filterTp===tp;
                return <button key={tp} onClick={()=>setFilterTp(tp)}
                  style={{ padding:"3px 10px",borderRadius:20,border:act?"none":`1px solid ${C.border}`,cursor:"pointer",fontSize:11,fontWeight:600,background:act?(cfg?.color||C.navy):C.card,color:act?C.white:C.muted }}>
                  {tp==="ALL"?"Todos":cfg.label}</button>;
              })}
            </div>
            <div style={{ display:"flex",gap:4,alignItems:"center" }}>
              <span style={{ fontSize:10,color:C.muted }}>Ordenar:</span>
              {[["wUSD","Pond. USD"],["wARS","Pond. ARS"],["baseUSD","Base USD"],["baseARS","Base ARS"]].map(([k,l])=>(
                <button key={k} onClick={()=>setSortBy(k)} style={{ padding:"3px 8px",borderRadius:6,fontSize:10,border:`1px solid ${C.border}`,cursor:"pointer",background:sortBy===k?C.blue1:C.card,color:sortBy===k?C.white:C.muted }}>{l}</button>
              ))}
            </div>
          </div>

          {/* table */}
          <div style={card}>
            <div style={{ overflowX:"auto" }}>
              <table key={horizon} style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
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
                    <th colSpan={2} style={{...TH(),borderLeft:"2px solid gold",color:"gold"}}>Pond. ({horizon}m)</th>
                    <th style={TH()}>EY</th>
                    <th style={TH()}></th>
                  </tr>
                  <tr style={{ background:"#05003d" }}>
                    <th style={TH2()}/><th style={TH2()}/><th style={TH2()}/>
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
                    <th style={TH2()}/>
                  </tr>
                </thead>
                <tbody>
                  {results.map((b,i) => {
                    const tc = TYPES[b.tp];
                    return (
                      <tr key={b.id} onClick={()=>setCfBond(b)}
                        style={{ background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#dbeafe"}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.card:C.bg}>
                        <td style={TD("center")}>
                          <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:i===0?C.blue2:i===1?"#22c55e":i===2?"#eab308":C.border,fontSize:9,fontWeight:700,color:i<3?C.white:C.muted }}>{i+1}</span>
                        </td>
                        <td style={TD()}>
                          <div style={{ fontWeight:800,color:C.navy,fontSize:12 }}>{b.t}</div>
                          <div style={{ fontSize:9,color:C.muted }}>{b.n}</div>
                        </td>
                        <td style={TD()}><span style={pill(tc?.color||C.muted)}>{tc?.label||b.tp}</span></td>
                        <td style={{...TD("right"),fontWeight:600,color:b.tp==="CER"?TYPES.CER.color:C.text}}>{b.y.toFixed(2)}%</td>
                        <td style={{...TD("center"),fontSize:9,color:C.muted}}>{b.m.slice(0,7)}</td>
                        {scenKeys.map(k=>{
                          const r=b.byScen[k];
                          return (
                            <Fragment key={k}>
                              <td style={{...TD("right"),borderLeft:`2px solid ${scens[k].col}25`,fontWeight:600,color:rc(r.rARS)}}>{fmtS(r.rARS)}</td>
                              <td style={{...TD("right"),fontWeight:600,color:rcu(r.rUSD),fontSize:10}}>{fmtS(r.rUSD)}</td>
                            </Fragment>
                          );
                        })}
                        <td style={{...TD("right"),borderLeft:"2px solid rgba(255,215,0,.3)",fontWeight:800,fontSize:13,color:rc(b.wt.rARS)}}>{fmtS(b.wt.rARS)}</td>
                        <td style={{...TD("right"),fontWeight:800,fontSize:13,color:rcu(b.wt.rUSD)}}>{fmtS(b.wt.rUSD)}</td>
                        <td style={{...TD("center"),fontSize:9,color:C.muted}} onClick={e=>{e.stopPropagation();setEditBond(b);}}>
                          <span style={{ cursor:"pointer",textDecoration:"underline dotted",color:C.blue1 }}>
                            {b.exitYields?.BASE}/{b.exitYields?.BULL}/{b.exitYields?.BEAR}
                          </span>
                        </td>
                        <td style={TD("center")}>
                          <button onClick={e=>{e.stopPropagation();removeBond(b.id);}} style={{ background:"none",border:"none",cursor:"pointer",color:C.neg,fontSize:13,lineHeight:1,padding:"2px 3px" }}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {results.length===0&&<div style={{ padding:36,textAlign:"center",color:C.muted }}>Sin bonos. Cambiá el filtro o agregá uno.</div>}
            </div>
          </div>

          {bonds.filter(b=>!b.active).length>0&&(
            <div style={{ marginTop:6,display:"flex",gap:5,flexWrap:"wrap",alignItems:"center" }}>
              <span style={{ fontSize:10,color:C.muted }}>Ocultos:</span>
              {bonds.filter(b=>!b.active).map(b=>(
                <button key={b.id} onClick={()=>togBond(b.id)} style={{ padding:"2px 8px",borderRadius:20,border:`1px solid ${C.border}`,background:C.card,color:C.muted,cursor:"pointer",fontSize:10 }}>↩ {b.t}</button>
              ))}
            </div>
          )}
        </>)}

        {/* ════ TAB: CURVAS ══════════════════════════════════════════════════ */}
        {tab === "curvas" && (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>

            {/* ── SOVEREIGN CURVE CHART ──────────────────────────────────────── */}
            <div style={{ ...card,padding:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8 }}>
                <div>
                  <div style={{ fontWeight:800,color:C.navy,fontSize:14 }}>Curvas Soberanas — NY Law (Yield% vs Duration)</div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:2 }}>Puntos verdes = bonos ARG actuales · Puntos azules = target según curva seleccionada · Flecha = tightening implícito</div>
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
                  {Object.entries(scens).map(([k,s])=>(
                    <div key={k} style={{ display:"flex",alignItems:"center",gap:5,background:`${s.col}18`,borderRadius:6,padding:"4px 8px",border:`1px solid ${s.col}40` }}>
                      <span style={{ color:s.col,fontWeight:700,fontSize:10 }}>{s.label}:</span>
                      <span style={{ fontSize:10,color:PEER_CURVES[usdTargets[k]]?.color||C.muted,fontWeight:600 }}>
                        {PEER_CURVES[usdTargets[k]]?.label.split(" (")[0]||"Manual"}
                      </span>
                    </div>
                  ))}
                  <span style={{ fontSize:9,color:C.muted }}>← Cambiar en ⚙ Escenarios</span>
                </div>
              </div>
              <PeerCurveChart bonds={bonds} usdTargets={usdTargets} scens={scens} horizon={horizon} currentBCS={currentBCS}/>
            </div>

            {/* ── USD BOND TARGET PRICE TABLE ─────────────────────────────────── */}
            <div style={{ ...card,overflow:"hidden" }}>
              <div style={{ padding:"10px 14px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span style={{ color:C.white,fontWeight:700,fontSize:12 }}>Bonos USD — Yield actual vs Target por Curva</span>
                <span style={{ color:C.blue2,fontSize:10 }}>Target = interpolación por duración en curva seleccionada</span>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9" }}>
                      {["Bono","Dur.","Yield actual","Target BASE","Δ bps BASE","Ret. USD BASE","Target BULL","Δ bps BULL","Ret. USD BULL","Target BEAR","Δ bps BEAR","Ret. USD BEAR"].map(hh=>(
                        <th key={hh} style={{ padding:"7px 9px",textAlign:"center",fontWeight:600,fontSize:9.5,color:C.muted,borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap" }}>{hh}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(()=>{
                      const usdBonds = bonds.filter(b=>b.active&&b.tp==="USD");
                      const groups = [
                        {key:"BOPREAL", bonds:usdBonds.filter(b=>usdSubtype(b.t)==="BOPREAL")},
                        {key:"BONAR",   bonds:usdBonds.filter(b=>usdSubtype(b.t)==="BONAR")},
                        {key:"GLOBAL",  bonds:usdBonds.filter(b=>usdSubtype(b.t)==="GLOBAL")},
                      ];
                      let rowIdx = 0;
                      return groups.flatMap(({key,bonds:grpBonds})=>{
                        if(grpBonds.length===0) return [];
                        const cfg = USD_SUBTYPES[key];
                        const rows = [
                          // Group header row
                          <tr key={`hdr-${key}`} style={{ background:cfg.color+"18" }}>
                            <td colSpan={12} style={{ padding:"6px 12px", fontWeight:800, fontSize:11,
                              color:cfg.color, borderLeft:`4px solid ${cfg.color}`, borderBottom:`1px solid ${cfg.color}40` }}>
                              ── {cfg.label}
                              <span style={{ marginLeft:10,fontSize:9,fontWeight:400,color:C.muted }}>
                                Target BASE: <span style={{ color:PEER_CURVES[usdTargets.BASE]?.color||C.muted,fontWeight:600 }}>
                                  {PEER_CURVES[usdTargets.BASE]?.label||"Manual"}</span>
                                &nbsp;· BULL: <span style={{ color:PEER_CURVES[usdTargets.BULL]?.color||C.muted,fontWeight:600 }}>
                                  {PEER_CURVES[usdTargets.BULL]?.label||"Manual"}</span>
                                &nbsp;· BEAR: <span style={{ color:PEER_CURVES[usdTargets.BEAR]?.color||C.muted,fontWeight:600 }}>
                                  {PEER_CURVES[usdTargets.BEAR]?.label||"Manual"}</span>
                              </span>
                            </td>
                          </tr>,
                          // Bond rows
                          ...grpBonds.sort((a,z)=>(a.dur??3)-(z.dur??3)).map((b)=>{
                            const ri = rowIdx++;
                            const dur = b.dur??3;
                            const scenRows = Object.entries(scens).map(([k,s])=>{
                              const tgt = usdTargets[k]&&usdTargets[k]!=="manual" ? interpYield(usdTargets[k],dur) : (b.exitYields?.[k]??b.y);
                              const dbps = tgt!=null ? Math.round((tgt-b.y)*100) : null;
                              const ret = calcReturn(b,s,k,horizon,currentBCS,usdTargets[k]||null).rUSD;
                              return {k,s,tgt,dbps,ret};
                            });
                            return (
                              <tr key={b.id} style={{ background:ri%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}`,borderLeft:`4px solid ${cfg.color}40` }}>
                                <td style={{ padding:"7px 9px" }}>
                                  <div style={{ fontWeight:800,color:cfg.color,fontSize:12 }}>{b.t}</div>
                                  <div style={{ fontSize:9,color:C.muted }}>{b.n}</div>
                                </td>
                                <td style={{ padding:"7px 9px",textAlign:"center",color:C.muted,fontSize:10 }}>{dur.toFixed(1)}y</td>
                                <td style={{ padding:"7px 9px",textAlign:"center",fontWeight:700,color:C.text }}>{b.y.toFixed(2)}%</td>
                                {scenRows.map(({k,s,tgt,dbps,ret})=>(
                                  <Fragment key={k}>
                                    <td style={{ padding:"7px 9px",textAlign:"center",fontWeight:700,color:PEER_CURVES[usdTargets[k]]?.color||C.muted,borderLeft:`2px solid ${s.col}25` }}>
                                      {tgt!=null?`${tgt.toFixed(2)}%`:"–"}
                                    </td>
                                    <td style={{ padding:"7px 9px",textAlign:"center",fontWeight:600,fontSize:10,
                                      color:dbps!=null?(dbps<0?C.pos:dbps>0?C.neg:C.muted):C.muted }}>
                                      {dbps!=null?(dbps<=0?`${dbps}bps`:`+${dbps}bps`):"–"}
                                    </td>
                                    <td style={{ padding:"7px 9px",textAlign:"center",fontWeight:700,color:rcu(ret) }}>
                                      {fmtS(ret)}
                                    </td>
                                  </Fragment>
                                ))}
                              </tr>
                            );
                          })
                        ];
                        return rows;
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}` }}>
                Δbps negativo (verde) = Argentina yield actual está SOBRE la curva target → hay tightening implícito → retorno positivo por compresión. Cambiar curva target en ⚙ Escenarios.
              </div>
            </div>

            {/* legend */}
            <div style={{ display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" }}>
              {Object.entries(TYPES).map(([k,v])=>(
                <div key={k} style={{ display:"flex",alignItems:"center",gap:4 }}>
                  <div style={{ width:10,height:10,borderRadius:"50%",background:v.color }}/>
                  <span style={{ fontSize:11,color:C.text }}>{v.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
              {/* Chart 1: CER Real yield curve — enhanced with target */}
              <div style={{ ...card,padding:16 }}>
                {(()=>{
                  const w=480, h=280, mg={t:30,r:20,b:40,l:50};
                  const pw=w-mg.l-mg.r, ph=h-mg.t-mg.b;
                  const cerBonds = bonds.filter(b=>b.active&&b.tp==="CER").sort((a,z)=>mths(a.m)-mths(z.m));
                  const allYears = cerBonds.map(b=>mths(b.m)/12);
                  const allYields = cerBonds.map(b=>b.y);
                  // Target curve points for BASE
                  const baseCurve = CER_TARGET_CURVES[cerTargets.BASE];
                  const targetPts = baseCurve?.points||[];
                  const allTgtY = targetPts.map(p=>p.y);
                  const xMin=0, xMax=Math.max(6.5,...allYears)+0.3;
                  const yMin=Math.min(-1,...allYields,...allTgtY)-0.5;
                  const yMax=Math.max(...allYields,...allTgtY)+1;
                  const px=x=>mg.l+(x-xMin)/(xMax-xMin)*pw;
                  const py=y=>mg.t+(1-(y-yMin)/(yMax-yMin))*ph;
                  const ticksX=Array.from({length:7},(_,i)=>i);
                  const ticksY=Array.from({length:7},(_,i)=>+(yMin+(yMax-yMin)*i/6).toFixed(1));
                  // smooth target path
                  const durRange=Array.from({length:100},(_,i)=>i*(xMax/99));
                  const tgtLinePts=targetPts.length>0
                    ? durRange.map(d=>{
                        const pts=targetPts;
                        if(d<pts[0].d||d>pts[pts.length-1].d)return null;
                        for(let i=0;i<pts.length-1;i++){
                          if(d>=pts[i].d&&d<=pts[i+1].d){
                            const t=(d-pts[i].d)/(pts[i+1].d-pts[i].d);
                            return{x:px(d),y:py(pts[i].y+t*(pts[i+1].y-pts[i].y))};
                          }
                        }
                        return null;
                      }).filter(Boolean)
                    : [];
                  const tgtPath=tgtLinePts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
                  // actual curve path through bonds
                  const actPath=cerBonds.map((b,i)=>{
                    const cx=px(mths(b.m)/12), cy=py(b.y);
                    return `${i===0?'M':'L'}${cx.toFixed(1)},${cy.toFixed(1)}`;
                  }).join(' ');
                  return (
                    <svg width={w} height={h} style={{fontFamily:"inherit",overflow:"visible"}}>
                      <text x={w/2} y={18} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.navy}>Curva CER — Tasa Real</text>
                      {ticksX.map(v=><line key={v} x1={px(v)} y1={mg.t} x2={px(v)} y2={mg.t+ph} stroke={C.border} strokeWidth={0.7}/>)}
                      {ticksY.map((v,i)=><line key={i} x1={mg.l} y1={py(v)} x2={mg.l+pw} y2={py(v)} stroke={C.border} strokeWidth={0.7}/>)}
                      {/* zero line */}
                      {yMin<0&&<line x1={mg.l} y1={py(0)} x2={mg.l+pw} y2={py(0)} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3"/>}
                      {/* horizon line */}
                      <line x1={px(horizon/12)} y1={mg.t} x2={px(horizon/12)} y2={mg.t+ph} stroke={C.blue2} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7}/>
                      <rect x={mg.l} y={mg.t} width={pw} height={ph} fill="none" stroke={C.border}/>
                      {ticksX.map(v=><text key={v} x={px(v)} y={mg.t+ph+14} textAnchor="middle" fontSize={8.5} fill={C.muted}>{v}y</text>)}
                      {ticksY.map((v,i)=><text key={i} x={mg.l-5} y={py(v)+3.5} textAnchor="end" fontSize={8.5} fill={C.muted}>{v.toFixed(1)}%</text>)}
                      <text x={mg.l+pw/2} y={h-4} textAnchor="middle" fontSize={9.5} fill={C.muted}>Duración (años)</text>
                      <text x={10} y={mg.t+ph/2} textAnchor="middle" fontSize={9.5} fill={C.muted} transform={`rotate(-90,10,${mg.t+ph/2})`}>Tasa real %</text>
                      {/* actual curve line */}
                      {cerBonds.length>1&&<path d={actPath} fill="none" stroke={TYPES.CER.color} strokeWidth={2} strokeDasharray="5 3" opacity={0.8}/>}
                      {/* target curve */}
                      {tgtLinePts.length>1&&<path d={tgtPath} fill="none" stroke={baseCurve.color} strokeWidth={2.5} opacity={0.9}/>}
                      {/* arrows bond → target */}
                      {cerBonds.map(b=>{
                        const dur=b.dur??1;
                        const cx=px(mths(b.m)/12), cy=py(b.y);
                        const ty=interpCERTarget(cerTargets.BASE,dur);
                        if(ty===null) return null;
                        const tcy=py(ty);
                        return(
                          <g key={b.id}>
                            {Math.abs(tcy-cy)>4&&<line x1={cx} y1={cy} x2={cx} y2={tcy+Math.sign(tcy-cy)*3}
                              stroke={baseCurve.color} strokeWidth={1.2} strokeDasharray="2 2" opacity={0.6}
                              markerEnd="url(#cerArrow)"/>}
                            <circle cx={cx} cy={cy} r={5} fill={TYPES.CER.color} stroke="white" strokeWidth={1.5}/>
                            {ty!==null&&<circle cx={cx} cy={tcy} r={3.5} fill={baseCurve.color} stroke="white" strokeWidth={1} opacity={0.85}/>}
                            <text x={cx+6} y={cy+4} fontSize={8} fontWeight={800} fill={TYPES.CER.color}>{b.t}</text>
                            {ty!==null&&<text x={cx+6} y={tcy+4} fontSize={7.5} fill={baseCurve.color} opacity={0.9}>{ty.toFixed(2)}%</text>}
                          </g>
                        );
                      })}
                      {/* legend */}
                      <line x1={mg.l+4} y1={mg.t+ph-12} x2={mg.l+20} y2={mg.t+ph-12} stroke={TYPES.CER.color} strokeWidth={2} strokeDasharray="4 2"/>
                      <text x={mg.l+24} y={mg.t+ph-8} fontSize={8} fill={TYPES.CER.color} fontWeight={600}>Actual</text>
                      {tgtLinePts.length>0&&<>
                        <line x1={mg.l+58} y1={mg.t+ph-12} x2={mg.l+76} y2={mg.t+ph-12} stroke={baseCurve?.color||C.teal} strokeWidth={2.5}/>
                        <text x={mg.l+80} y={mg.t+ph-8} fontSize={8} fill={baseCurve?.color||C.teal} fontWeight={600}>Target BASE ({baseCurve?.label?.split(" ")[0]})</text>
                      </>}
                      <defs>
                        <marker id="cerArrow" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
                          <path d="M0,0 L0,5 L5,2.5 z" fill={baseCurve?.color||C.teal} opacity={0.8}/>
                        </marker>
                      </defs>
                    </svg>
                  );
                })()}
                <div style={{ fontSize:9,color:C.muted,marginTop:3,textAlign:"center" }}>
                  Línea teal = target real yield (BASE). Flechas = compresión implícita. Cambiar en ⚙ Escenarios.
                </div>
              </div>

              {/* Chart 2: Retorno ponderado vs duración */}
              <div style={{ ...card,padding:16 }}>
                <ScatterChart
                  data={returnCurve.filter(d=>d.dur>0)}
                  xKey="dur" yKey="wUSD" labelKey="t" colorKey="color"
                  xLabel="Duración (años)" yLabel={`Retorno pond. USD (${horizon}m, %)`}
                  title={`Retorno ponderado USD vs Duración`}
                  w={480} h={280}
                  refLines={[{axis:"y",v:0,color:"#94a3b8"}]}
                />
                <div style={{ fontSize:9,color:C.muted,marginTop:4,textAlign:"center" }}>Arriba-derecha = más retorno por más riesgo duration. Arriba-izquierda = retorno sin asumir riesgo.</div>
              </div>
            </div>

            {/* Chart 3: Bull vs Bear (risk map) */}
            <div style={{ ...card,padding:16 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}>
                <div style={{ fontWeight:700,color:C.navy,fontSize:13 }}>Mapa de Riesgo — Bull vs Bear ({horizon}m)</div>
                <div style={{ fontSize:10,color:C.muted }}>Arriba-derecha: gana en ambos escenarios. Abajo-derecha: gana en Bull, pierde en Bear.</div>
              </div>
              <ScatterChart
                data={returnCurve}
                xKey="bullUSD" yKey="bearUSD" labelKey="t" colorKey="color"
                xLabel={`Retorno BULL USD (%)`} yLabel={`Retorno BEAR USD (%)`}
                title=""
                w={1100} h={320}
                refLines={[{axis:"x",v:0,color:"#94a3b8"},{axis:"y",v:0,color:"#94a3b8"}]}
              />
              <div style={{ fontSize:9,color:C.muted,marginTop:4,textAlign:"center" }}>
                Cuadrante I (arriba-der): gana en Bull Y Bear. Cuadrante II (arriba-izq): pierde en Bull pero gana en Bear. Cuadrante IV (abajo-der): gana en Bull pero pierde en Bear.
              </div>
            </div>

            {/* CER yield table — enhanced with real yield targets */}
            <div style={{ ...card,overflow:"hidden" }}>
              <div style={{ padding:"10px 14px",background:C.navy,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6 }}>
                <span style={{ color:C.white,fontWeight:700,fontSize:12 }}>Bonos CER — Tasa Real Actual vs Target por Escenario</span>
                <div style={{ display:"flex",gap:8 }}>
                  {Object.entries(scens).map(([k,s])=>(
                    <span key={k} style={{ fontSize:10,color:CER_TARGET_CURVES[cerTargets[k]]?.color||s.col,fontWeight:600 }}>
                      {s.label}: {CER_TARGET_CURVES[cerTargets[k]]?.label||"Manual"}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10.5 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9" }}>
                      <th rowSpan={2} style={{ padding:"7px 10px",textAlign:"left",fontWeight:700,fontSize:10,color:C.muted,borderBottom:`2px solid ${C.border}` }}>Bono</th>
                      <th rowSpan={2} style={{ padding:"7px 10px",textAlign:"center",fontWeight:600,fontSize:10,color:C.muted,borderBottom:`2px solid ${C.border}` }}>Dur.</th>
                      <th rowSpan={2} style={{ padding:"7px 10px",textAlign:"center",fontWeight:700,fontSize:10,color:TYPES.CER.color,borderBottom:`2px solid ${C.border}` }}>TIR real act.</th>
                      {["BASE","BULL","BEAR"].map(k=>(
                        <th key={k} colSpan={3} style={{ padding:"6px 10px",textAlign:"center",fontWeight:700,fontSize:10,color:scens[k]?.col,borderBottom:`2px solid ${scens[k]?.col}`,borderLeft:`2px solid ${scens[k]?.col}40` }}>
                          {scens[k]?.label} — {CER_TARGET_CURVES[cerTargets[k]]?.label||"Manual"}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ background:"#f8fafc" }}>
                      {["BASE","BULL","BEAR"].map(k=>(
                        <Fragment key={k}>
                          <th style={{ padding:"4px 8px",textAlign:"center",fontWeight:600,fontSize:9,color:scens[k]?.col,borderLeft:`2px solid ${scens[k]?.col}40` }}>Target %</th>
                          <th style={{ padding:"4px 8px",textAlign:"center",fontWeight:600,fontSize:9,color:C.muted }}>Δ bps</th>
                          <th style={{ padding:"4px 8px",textAlign:"center",fontWeight:600,fontSize:9,color:C.muted }}>Ret. USD</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bonds.filter(b=>b.active&&b.tp==="CER").sort((a,z)=>mths(a.m)-mths(z.m)).map((b,i)=>(
                      <tr key={b.id} style={{ background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:"7px 10px" }}>
                          <div style={{ fontWeight:800,color:TYPES.CER.color,fontSize:12 }}>{b.t}</div>
                          <div style={{ fontSize:9,color:C.muted }}>{b.m.slice(0,7)}</div>
                        </td>
                        <td style={{ padding:"7px 10px",textAlign:"center",color:C.muted,fontSize:10 }}>{(b.dur??1).toFixed(2)}y</td>
                        <td style={{ padding:"7px 10px",textAlign:"center",fontWeight:800,color:TYPES.CER.color,fontSize:13 }}>{b.y.toFixed(2)}%</td>
                        {["BASE","BULL","BEAR"].map(k=>{
                          const tgt = cerTargets[k]&&cerTargets[k]!=="manual"
                            ? interpCERTarget(cerTargets[k], b.dur??1)
                            : (b.exitYields?.[k]??b.y);
                          const dbps = tgt!=null ? Math.round((tgt-b.y)*100) : null;
                          const ret = calcReturn(b, scens[k], k, horizon, currentBCS, null, cerTargets[k]||null).rUSD;
                          const tgtColor = CER_TARGET_CURVES[cerTargets[k]]?.color || scens[k]?.col;
                          return (
                            <Fragment key={k}>
                              <td style={{ padding:"7px 10px",textAlign:"center",fontWeight:700,fontSize:12,color:tgtColor,borderLeft:`2px solid ${scens[k]?.col}25` }}>
                                {tgt!=null?`${tgt.toFixed(2)}%`:"–"}
                              </td>
                              <td style={{ padding:"7px 10px",textAlign:"center",fontWeight:600,fontSize:10,
                                color:dbps!=null?(dbps<0?C.pos:dbps>0?C.neg:C.muted):C.muted }}>
                                {dbps!=null?(dbps<=0?`${dbps}bps`:`+${dbps}bps`):"–"}
                              </td>
                              <td style={{ padding:"7px 10px",textAlign:"center",fontWeight:700,fontSize:12,color:rcu(ret) }}>
                                {fmtS(ret)}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:"6px 14px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}` }}>
                Δbps negativo (verde) = compresión de tasa real → retorno positivo. Cambiar curva target en ⚙ Escenarios → "Target CER (tasa real)".
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB: BREAKEVENS ═══════════════════════════════════════════════ */}
        {tab === "breakevens" && (
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {/* explanation */}
            <div style={{ background:C.card,borderRadius:10,padding:"12px 16px",borderLeft:`4px solid ${C.blue2}`,fontSize:11,color:C.muted,lineHeight:1.8 }}>
              <strong style={{ color:C.blue1 }}>¿Qué es un breakeven?</strong><br/>
              <strong>CER vs LECAP:</strong> CPI mensual mínimo necesario para que el bono CER supere al LECAP de referencia en retorno USD (escenario BASE). Si la inflación real supera ese número, conviene el CER.<br/>
              <strong>CER vs USD (BCS):</strong> BCS de salida necesario para que el CER iguale al bono USD de referencia. Si el BCS real termina por encima de ese nivel, conviene el CER. Si termina abajo, conviene el USD.<br/>
              <strong>Referencia LECAP:</strong> {bonds.find(b=>b.active&&b.tp==="LECAP"&&mths(b.m)>=horizon)?.t || "n/a"}&nbsp;|&nbsp;
              <strong>Referencia USD:</strong> {bonds.find(b=>b.active&&b.tp==="USD"&&b.t==="GD30")?.t || bonds.find(b=>b.active&&b.tp==="USD")?.t || "n/a"}
            </div>

            {/* main BE table */}
            <div style={card}>
              <div style={{ padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                <span>Breakevens CER — horizonte {horizon}m, BCS hoy {currentBCS.toLocaleString()}</span>
                <span style={{ color:C.blue2,fontSize:10 }}>Escenario BASE para CPI breakeven · Escenario BASE para BCS breakeven</span>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:11 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9" }}>
                      {["","Bono CER","Retorno CER BASE USD","Retorno LECAP ref.","▶ BE CPI vs LECAP","Retorno USD ref.","▶ BE BCS exit","BCS escenarios","Interpretación"].map(h=>(
                        <th key={h} style={{ padding:"8px 10px",textAlign:"center",fontWeight:600,fontSize:10,color:C.muted,borderBottom:`2px solid ${C.border}`,whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {breakevens.map((row,i) => {
                      const beBCS = row.beBCSvsUSD;
                      const beCPI = row.beCPIvsLecap;
                      const baseAvgCPI = parseFloat(avgCPI(scens.BASE.cpiPath, horizon));
                      const cpiColor = beCPI !== null ? (beCPI <= baseAvgCPI ? C.pos : C.neg) : C.muted;
                      const bcsColor = beBCS < scens.BASE.exitBCS ? C.pos : C.neg;
                      const cpiMsg   = beCPI !== null
                        ? (beCPI <= baseAvgCPI ? `✓ CPI BASE (${baseAvgCPI}%) ≥ BE → CER GANA` : `✗ CPI BASE (${baseAvgCPI}%) < BE → LECAP gana`)
                        : "n/a";
                      const bcsMsg   = beBCS < scens.BASE.exitBCS
                        ? `✓ BCS BASE (${scens.BASE.exitBCS}) > BE → CER GANA`
                        : `✗ BCS BASE (${scens.BASE.exitBCS}) < BE → USD gana`;

                      return (
                        <tr key={row.t} style={{ background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}` }}>
                          <td style={{ padding:"8px 10px",textAlign:"center" }}>
                            <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:"50%",background:TYPES.CER.color,fontSize:9,fontWeight:700,color:C.white }}>{i+1}</span>
                          </td>
                          <td style={{ padding:"8px 10px" }}>
                            <div style={{ fontWeight:800,color:TYPES.CER.color,fontSize:12 }}>{row.t}</div>
                            <div style={{ fontSize:9,color:C.muted }}>{row.n}</div>
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center",fontWeight:700,color:rcu(row.cerBaseUSD) }}>{fmtS(row.cerBaseUSD)}</td>
                          <td style={{ padding:"8px 10px",textAlign:"center",color:C.muted }}>
                            <div style={{ fontWeight:600,color:C.text }}>{fmtS(row.lecapBaseUSD)}</div>
                            <div style={{ fontSize:9,color:C.muted }}>{row.lecapRef}</div>
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center" }}>
                            {beCPI !== null
                              ? <div style={{ fontSize:16,fontWeight:800,color:cpiColor }}>{beCPI}% <span style={{ fontSize:9,fontWeight:400 }}>/mes</span></div>
                              : <span style={{ color:C.muted }}>n/a</span>}
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center",color:C.muted }}>
                            <div style={{ fontWeight:600,color:C.text }}>{fmtS(row.usdBaseUSD)}</div>
                            <div style={{ fontSize:9,color:C.muted }}>{row.usdRef}</div>
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center" }}>
                            <div style={{ fontSize:16,fontWeight:800,color:bcsColor }}>{beBCS.toLocaleString()}</div>
                            <div style={{ fontSize:9,color:C.muted }}>BCS exit necesario</div>
                          </td>
                          <td style={{ padding:"8px 10px",textAlign:"center",fontSize:10 }}>
                            <div>Base: <strong style={{ color:scens.BASE.col }}>{scens.BASE.exitBCS.toLocaleString()}</strong></div>
                            <div>Bull: <strong style={{ color:scens.BULL.col }}>{scens.BULL.exitBCS.toLocaleString()}</strong></div>
                            <div>Bear: <strong style={{ color:scens.BEAR.col }}>{scens.BEAR.exitBCS.toLocaleString()}</strong></div>
                          </td>
                          <td style={{ padding:"8px 10px",minWidth:160 }}>
                            <div style={{ fontSize:9,fontWeight:600,color:cpiColor,marginBottom:2 }}>{cpiMsg}</div>
                            <div style={{ fontSize:9,fontWeight:600,color:bcsColor }}>{bcsMsg}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {breakevens.length===0&&<div style={{ padding:28,textAlign:"center",color:C.muted }}>Activá al menos un bono CER para ver breakevens.</div>}
              </div>
            </div>

            {/* BE vs ALL LECAP */}
            <div style={{ ...card,overflow:"hidden" }}>
              <div style={{ padding:"10px 14px",background:C.navy,color:C.white,fontWeight:700,fontSize:12 }}>
                BE CPI por bono CER vs cada LECAP disponible (escenario BASE, {horizon}m)
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10 }}>
                  <thead>
                    <tr style={{ background:"#f1f5f9" }}>
                      <th style={{ padding:"7px 10px",textAlign:"left",fontWeight:600,fontSize:10,color:C.muted,borderBottom:`1px solid ${C.border}` }}>CER \ LECAP</th>
                      {bonds.filter(b=>b.active&&b.tp==="LECAP").map(lb=>(
                        <th key={lb.id} style={{ padding:"7px 10px",textAlign:"center",fontWeight:600,fontSize:10,color:"#0369a1",borderBottom:`1px solid ${C.border}` }}>{lb.t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bonds.filter(b=>b.active&&b.tp==="CER").map((cb,i)=>(
                      <tr key={cb.id} style={{ background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:"7px 10px",fontWeight:700,color:TYPES.CER.color }}>{cb.t}</td>
                        {bonds.filter(b=>b.active&&b.tp==="LECAP").map(lb=>{
                          const lr = calcReturn(lb, scens.BASE, "BASE", horizon, currentBCS).rUSD;
                          const be = breakEvenCPI(cb, scens.BASE, "BASE", horizon, currentBCS, lr);
                          const baseAvg = parseFloat(avgCPI(scens.BASE.cpiPath, horizon));
                          const color = be===null ? C.muted : be<=baseAvg ? C.pos : be>baseAvg*1.5 ? C.neg : C.text;
                          return (
                            <td key={lb.id} style={{ padding:"7px 10px",textAlign:"center",fontWeight:700,color }}>
                              {be !== null ? `${be}%` : "–"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding:"6px 14px",fontSize:9,color:C.muted }}>
                Verde = CPI BASE ({avgCPI(scens.BASE.cpiPath,horizon)}%/m) ya supera el breakeven → el CER GANA en ese par. Rojo = necesitaría más inflación.
              </div>
            </div>
          </div>
        )}

        {/* ════ TAB: ANÁLISIS RV ══════════════════════════════════════════════ */}
        {tab === "analisis" && (
          <AnalysisTab bonds={bonds} scens={scens} horizon={horizon} currentBCS={currentBCS}/>
        )}

      </div>

      {/* ═══ MODAL: EDIT EXIT YIELDS ════════════════════════════════════════ */}
      {editBond && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&setEditBond(null)}>
          <div style={{ background:C.card,borderRadius:12,padding:22,width:420,boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div><span style={{ fontWeight:800,color:C.navy,fontSize:15 }}>{editBond.t}</span><span style={{ color:C.muted,fontSize:11,marginLeft:8 }}>Exit Yields</span></div>
              <button onClick={()=>setEditBond(null)} style={{ background:"none",border:"none",fontSize:16,cursor:"pointer",color:C.muted }}>✕</button>
            </div>
            <div style={{ marginBottom:10,padding:"7px 10px",background:C.bg,borderRadius:7,fontSize:10,color:C.muted }}>
              <strong>Tipo:</strong> {TYPES[editBond.tp]?.label} · <strong>TIR actual:</strong> {editBond.y.toFixed(2)}% · <strong>Vcto:</strong> {editBond.m}
              <br/>
              {editBond.tp==="LECAP"&&"→ TEM mensual (%) para el exit"}
              {editBond.tp==="CER"  &&"→ Tasa real anual (%) para el exit"}
              {editBond.tp==="USD"  &&"→ TIR anual USD (%) para el exit"}
            </div>
            {Object.entries(scens).map(([k,s])=>(
              <div key={k} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9,padding:"9px 12px",background:`${s.col}12`,borderRadius:7,borderLeft:`3px solid ${s.col}` }}>
                <div>
                  <div style={{ color:s.col,fontWeight:700,fontSize:12 }}>{s.label}</div>
                  <div style={{ color:C.muted,fontSize:9 }}>Exit BCS: {s.exitBCS.toLocaleString()} · Δ {((s.exitBCS/currentBCS-1)*100).toFixed(1)}%</div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:5 }}>
                  <input type="number" step="0.1"
                    defaultValue={editBond.exitYields?.[k]??editBond.y}
                    onBlur={e=>saveEY(editBond.id,k,e.target.value)}
                    onChange={e=>saveEY(editBond.id,k,e.target.value)}
                    style={{ width:64,padding:"5px 8px",borderRadius:7,border:`1.5px solid ${s.col}50`,fontSize:13,fontWeight:700,textAlign:"right",color:C.text }}/>
                  <span style={{ color:C.muted,fontSize:10 }}>%</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop:12,display:"flex",justifyContent:"flex-end" }}>
              <button onClick={()=>setEditBond(null)} style={{ padding:"7px 18px",borderRadius:7,background:C.blue1,color:C.white,border:"none",fontWeight:700,cursor:"pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CASHFLOW ════════════════════════════════════════════════ */}
      {cfBond && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&setCfBond(null)}>
          <div style={{ background:C.card,borderRadius:12,width:560,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}` }}>
            <div style={{ background:C.navy,borderRadius:"12px 12px 0 0",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div><span style={{ color:C.white,fontWeight:800,fontSize:14 }}>{cfBond.t}</span><span style={{ color:C.blue2,fontSize:11,marginLeft:8 }}>{cfBond.n}</span></div>
              <button onClick={()=>setCfBond(null)} style={{ background:"none",border:"none",color:"#7090b0",fontSize:16,cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:"8px 18px",background:"#f7f9fc",borderBottom:`1px solid ${C.border}`,display:"flex",gap:14,flexWrap:"wrap" }}>
              {[["Tipo",TYPES[cfBond.tp]?.label],["TIR",`${cfBond.y.toFixed(2)}%`],["Vcto",cfBond.m],["Meses",mths(cfBond.m).toFixed(1)]].map(([k,v])=>(
                <div key={k}><div style={{ fontSize:9,color:C.muted }}>{k}</div><div style={{ fontWeight:700,color:C.text,fontSize:11 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ padding:"7px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:5 }}>
              {Object.entries(scens).map(([k,s])=>(
                <button key={k} onClick={()=>setCfScen(k)} style={{ padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:700,fontSize:10,background:cfScen===k?s.col:C.bg,color:cfScen===k?C.white:C.muted }}>{s.label}</button>
              ))}
            </div>
            <div style={{ padding:"7px 18px",background:`${scens[cfScen].col}08`,borderBottom:`1px solid ${C.border}`,display:"flex",gap:14,flexWrap:"wrap" }}>
              {[["TR ARS",calcReturn(cfBond,scens[cfScen],cfScen,horizon,currentBCS).rARS,rc],["TR USD",calcReturn(cfBond,scens[cfScen],cfScen,horizon,currentBCS).rUSD,rcu]].map(([l,v,fn])=>(
                <div key={l}><div style={{ fontSize:9,color:C.muted }}>{l} ({horizon}m)</div><div style={{ fontWeight:800,fontSize:18,color:fn(v) }}>{fmtS(v)}</div></div>
              ))}
              <div><div style={{ fontSize:9,color:C.muted }}>CPI acum BASE ({horizon}m)</div><div style={{ fontWeight:700,fontSize:13,color:scens[cfScen].col }}>{(calcCumCPI(scens[cfScen].cpiPath,horizon)*100).toFixed(1)}%</div></div>
              <div><div style={{ fontSize:9,color:C.muted }}>BCS hoy → exit</div><div style={{ fontWeight:700,fontSize:13,color:C.salmon }}>{currentBCS.toLocaleString()} → {scens[cfScen].exitBCS.toLocaleString()}</div></div>
            </div>
            <div style={{ overflowY:"auto",flex:1 }}>
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:10 }}>
                <thead><tr style={{ background:C.navy,position:"sticky",top:0 }}>
                  {["Fecha","Período","Cupón","Principal","Total"].map(h=>(
                    <th key={h} style={{ padding:"6px 12px",color:"rgba(255,255,255,.7)",fontWeight:600,fontSize:9,textAlign:h==="Fecha"||h==="Período"?"left":"right" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {cfData.map((r,i)=>(
                    <tr key={i} style={{ background:i%2===0?C.card:C.bg,borderBottom:`1px solid ${C.border}` }}>
                      <td style={{ padding:"5px 12px",color:C.muted }}>{r.date}</td>
                      <td style={{ padding:"5px 12px",color:C.text,fontWeight:600 }}>{r.label}</td>
                      <td style={{ padding:"5px 12px",textAlign:"right",color:r.coupon>0?C.teal:C.muted }}>{r.coupon>0?`+${r.coupon.toFixed(2)}`:"-"}</td>
                      <td style={{ padding:"5px 12px",textAlign:"right",color:r.principal>0?C.blue1:C.muted }}>{r.principal>0?`+${r.principal.toFixed(0)}`:"-"}</td>
                      <td style={{ padding:"5px 12px",textAlign:"right",fontWeight:700,color:C.pos }}>+{r.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cfData.length===0&&<div style={{ padding:24,textAlign:"center",color:C.muted }}>Sin flujos proyectados.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: ADD BOND ════════════════════════════════════════════════ */}
      {showAdd && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,35,.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }} onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div style={{ background:C.card,borderRadius:12,padding:22,width:490,boxShadow:"0 20px 60px rgba(0,0,57,.5)",border:`1px solid ${C.border}` }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <h3 style={{ margin:0,color:C.navy,fontSize:15 }}>Agregar Bono</h3>
              <button onClick={()=>setShowAdd(false)} style={{ background:"none",border:"none",fontSize:16,cursor:"pointer",color:C.muted }}>✕</button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9 }}>
              {[["Ticker *","t","text","GD35"],["Nombre","n","text","Global 2035"],["TIR actual (%) *","y","number","9.6"],["Cupón anual (%) USD","coupon","number","3.6"],["Spread (%) TAMAR/BADLAR","sp","number","0"]].map(([l,f,tp,ph])=>(
                <div key={f}>
                  <label style={{ fontSize:9,color:C.muted,display:"block",marginBottom:2 }}>{l}</label>
                  <input type={tp} placeholder={ph} value={newBond[f]||""} onChange={e=>setNewBond(p=>({...p,[f]:e.target.value}))}
                    style={{ width:"100%",padding:"7px 9px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:11,boxSizing:"border-box" }}/>
                </div>
              ))}
              <div>
                <label style={{ fontSize:9,color:C.muted,display:"block",marginBottom:2 }}>Tipo *</label>
                <select value={newBond.tp} onChange={e=>setNewBond(p=>({...p,tp:e.target.value}))} style={{ width:"100%",padding:"7px 9px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:11 }}>
                  {Object.entries(TYPES).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
                </select>
              </div>
              <div>
                <label style={{ fontSize:9,color:C.muted,display:"block",marginBottom:2 }}>Vencimiento *</label>
                <input type="date" value={newBond.m} onChange={e=>setNewBond(p=>({...p,m:e.target.value}))} style={{ width:"100%",padding:"7px 9px",borderRadius:6,border:`1.5px solid ${C.border}`,fontSize:11,boxSizing:"border-box" }}/>
              </div>
            </div>
            <div style={{ marginTop:9,padding:"7px 9px",background:C.bg,borderRadius:6,fontSize:9,color:C.muted }}>Exit Yields por Escenario ({TYPES[newBond.tp]?.label}) — vacío = usa TIR actual</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginTop:6 }}>
              {Object.entries(scens).map(([k,s])=>(
                <div key={k}>
                  <label style={{ fontSize:9,color:s.col,display:"block",marginBottom:2,fontWeight:700 }}>{s.label}</label>
                  <input type="number" step="0.1" placeholder={newBond.y||"EY%"} value={newBond.exitYields[k]}
                    onChange={e=>setNewBond(p=>({...p,exitYields:{...p.exitYields,[k]:e.target.value}}))}
                    style={{ width:"100%",padding:"6px 8px",borderRadius:6,border:`1.5px solid ${s.col}50`,fontSize:11,boxSizing:"border-box" }}/>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:7,marginTop:12 }}>
              <button onClick={addBond} style={{ flex:1,padding:"9px 0",borderRadius:7,background:C.blue1,color:C.white,border:"none",fontWeight:800,fontSize:12,cursor:"pointer" }}>✓ Agregar</button>
              <button onClick={()=>setShowAdd(false)} style={{ padding:"9px 16px",borderRadius:7,background:C.bg,color:C.muted,border:`1px solid ${C.border}`,cursor:"pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
