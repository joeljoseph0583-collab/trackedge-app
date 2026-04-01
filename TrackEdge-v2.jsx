import { useState, useEffect, useRef, useCallback } from "react";

// ── STORAGE ────────────────────────────────────────────────────────────────
const KEYS = { trades:"te:trades", notes:"te:notes", goals:"te:goals", settings:"te:settings" };
async function load(k){ try{ const r=await window.storage.get(k); return r?JSON.parse(r.value):null; }catch{ return null; } }
async function persist(k,v){ try{ await window.storage.set(k,JSON.stringify(v)); }catch{} }

// ── SEED DATA ──────────────────────────────────────────────────────────────
const today = new Date();
const d = (offset=0) => { const x=new Date(today); x.setDate(x.getDate()+offset); return x.toISOString().slice(0,10); };
const SEED_TRADES = [
  {id:"t1",symbol:"AAPL",side:"Long",asset:"Stock",entry:185.20,exit:189.40,size:50,date:d(-1),strategy:"Breakout",pnl:210,rr:2.1,notes:"Clean break above resistance with volume."},
  {id:"t2",symbol:"TSLA",side:"Short",asset:"Stock",entry:248.80,exit:241.50,size:30,date:d(-1),strategy:"Reversal",pnl:219,rr:1.8,notes:"Bearish engulfing at HOD."},
  {id:"t3",symbol:"SPY",side:"Long",asset:"ETF",entry:512.40,exit:509.80,size:20,date:d(-2),strategy:"Momentum",pnl:-52,rr:-0.6,notes:"Entered too early without confirmation."},
  {id:"t4",symbol:"NVDA",side:"Long",asset:"Stock",entry:875.00,exit:901.20,size:10,date:d(-3),strategy:"Breakout",pnl:262,rr:2.6,notes:"Post-earnings momentum play."},
  {id:"t5",symbol:"QQQ",side:"Short",asset:"ETF",entry:441.50,exit:445.20,size:40,date:d(-4),strategy:"Scalp",pnl:-148,rr:-1.2,notes:"Premature entry, no setup confirmation."},
  {id:"t6",symbol:"AMZN",side:"Long",asset:"Stock",entry:192.30,exit:197.80,size:25,date:d(-6),strategy:"Breakout",pnl:137.5,rr:1.5,notes:"VWAP reclaim + volume surge."},
  {id:"t7",symbol:"MSFT",side:"Long",asset:"Stock",entry:415.60,exit:422.10,size:15,date:d(-7),strategy:"Momentum",pnl:97.5,rr:1.3,notes:""},
];
const SEED_NOTES = [
  {id:"n1",date:d(-1),title:"Strong breakout day",body:"Followed rules perfectly. Patience is paying off.",mood:"Confident",tags:"Trending,Disciplined"},
  {id:"n2",date:d(-2),title:"Avoided revenge trade",body:"Felt the urge after SPY loss but walked away. Came back refreshed.",mood:"Frustrated",tags:"Emotional,Improvement"},
];
const SEED_GOALS = [
  {id:"g1",title:"Monthly Win Rate",target:65,current:67,unit:"%",direction:"above"},
  {id:"g2",title:"Monthly P&L Target",target:5000,current:4280,unit:"$",direction:"above"},
  {id:"g3",title:"Max Daily Loss",target:500,current:148,unit:"$",direction:"below"},
];

// ── UTILS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,10);
const fmt$ = (v,decimals=2) => (v>=0?"+":"-")+"$"+Math.abs(v).toFixed(decimals);
const fmtDate = d => { try{ return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }catch{ return d; } };
const calcStats = trades => {
  if(!trades.length) return {netPnl:0,winRate:0,wins:0,losses:0,total:0,avgWin:0,avgLoss:0,pf:0};
  const wins=trades.filter(t=>t.pnl>=0), losses=trades.filter(t=>t.pnl<0);
  const netPnl=trades.reduce((s,t)=>s+t.pnl,0);
  const winRate=Math.round((wins.length/trades.length)*100);
  const avgWin=wins.length?wins.reduce((s,t)=>s+t.pnl,0)/wins.length:0;
  const avgLoss=losses.length?losses.reduce((s,t)=>s+t.pnl,0)/losses.length:0;
  const grossW=wins.reduce((s,t)=>s+t.pnl,0), grossL=Math.abs(losses.reduce((s,t)=>s+t.pnl,0));
  const pf=grossL>0?grossW/grossL:grossW>0?999:0;
  return {netPnl,winRate,wins:wins.length,losses:losses.length,total:trades.length,avgWin,avgLoss,pf};
};

const MOOD_EMOJI = {Confident:"😎",Focused:"🧘",Neutral:"😐",Anxious:"😰",Frustrated:"😤",Excited:"🤩"};
const MOODS = Object.keys(MOOD_EMOJI);

// ── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#09090d;--s1:#111116;--s2:#18181f;--s3:#21212b;--s4:#2a2a38;
  --b1:rgba(255,255,255,0.06);--b2:rgba(255,255,255,0.12);--b3:rgba(255,255,255,0.18);
  --acc:#00e5a0;--blu:#4d9fff;--red:#ff5470;--amb:#ffaa40;--pur:#9b7eff;
  --tx:#e4e8f2;--tx2:#7a8899;--tx3:#3d4755;
  --r:10px;--r2:16px;--r3:20px;--ff:'Syne',sans-serif;--fm:'DM Mono',monospace;
  --nav-h:62px;
}
html,body,#root{height:100%;overflow:hidden}
body{font-family:var(--ff);background:var(--bg);color:var(--tx);font-size:14px}
/* ── LAYOUT ── */
.shell{display:flex;height:100vh;height:100dvh;overflow:hidden}
/* Sidebar desktop */
.sidebar{width:216px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden;transition:transform .25s}
.sb-logo{padding:20px 16px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--b1)}
.logo-gem{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--acc),var(--blu));display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#000;flex-shrink:0}
.logo-txt{font-size:15px;font-weight:700;letter-spacing:-.3px}.logo-txt em{color:var(--acc);font-style:normal}
.sb-nav{flex:1;padding:10px 8px;overflow-y:auto}
.sb-sec{font-size:9px;letter-spacing:1.4px;text-transform:uppercase;color:var(--tx3);padding:8px 8px 4px}
.ni{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;color:var(--tx2);font-size:13px;font-weight:500;transition:.12s;margin-bottom:2px;border:none;background:none;width:100%;text-align:left;font-family:var(--ff)}
.ni:hover{background:var(--s2);color:var(--tx)}.ni.act{background:rgba(0,229,160,.1);color:var(--acc)}
.ni svg{width:16px;height:16px;flex-shrink:0}
.ni-badge{margin-left:auto;background:var(--acc);color:#000;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px}
.sb-foot{padding:12px;border-top:1px solid var(--b1)}
.acc-chip{display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--s2);border-radius:var(--r);cursor:pointer}
.ava{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6c5ce7,var(--blu));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0}
.acc-name{font-size:12px;font-weight:600}.acc-plan{font-size:10px;color:var(--tx3)}
/* ── MAIN ── */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.topbar{padding:11px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--b1);flex-shrink:0;background:rgba(9,9,13,.8);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10}
.tb-title{font-size:16px;font-weight:700;flex:1}.tb-sub{font-size:10px;color:var(--tx3);font-family:var(--fm)}
.content{flex:1;overflow-y:auto;padding:16px 18px 80px}
/* ── BOTTOM NAV (mobile) ── */
.bot-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(17,17,22,.97);backdrop-filter:blur(16px);border-top:1px solid var(--b1);padding:8px 4px calc(8px + env(safe-area-inset-bottom));justify-content:space-around}
.bn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 14px;border-radius:10px;cursor:pointer;color:var(--tx3);font-size:10px;font-weight:600;border:none;background:none;font-family:var(--ff);transition:.12s;flex:1;max-width:72px}
.bn svg{width:20px;height:20px}.bn.act{color:var(--acc)}
/* ── SCROLLBAR ── */
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px}
/* ── BUTTONS ── */
.btn{padding:8px 16px;border-radius:9px;font-family:var(--ff);font-size:12px;font-weight:600;cursor:pointer;border:none;transition:.15s;letter-spacing:.2px;display:inline-flex;align-items:center;gap:6px}
.btn-p{background:var(--acc);color:#000}.btn-p:hover{filter:brightness(1.1);transform:translateY(-1px)}
.btn-o{background:transparent;color:var(--tx2);border:1px solid var(--b2)}.btn-o:hover{background:var(--s2);color:var(--tx)}
.btn-d{background:rgba(255,84,112,.1);color:var(--red);border:1px solid rgba(255,84,112,.2)}.btn-d:hover{background:rgba(255,84,112,.2)}
.btn-sm{padding:5px 11px;font-size:11px}.btn-xs{padding:3px 8px;font-size:10px}
.btn-fab{position:fixed;bottom:calc(var(--nav-h) + 16px);right:18px;width:52px;height:52px;border-radius:50%;background:var(--acc);color:#000;font-size:26px;display:none;align-items:center;justify-content:center;cursor:pointer;border:none;box-shadow:0 4px 20px rgba(0,229,160,.3);z-index:50;transition:.15s}
.btn-fab:active{transform:scale(.93)}
/* ── CARDS ── */
.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:16px 18px}
.card-title{font-size:12px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px}
/* ── STAT GRID ── */
.stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px}
.stat-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:14px 16px;position:relative;overflow:hidden}
.stat-card::after{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.sc-g::after{background:var(--acc)}.sc-b::after{background:var(--blu)}.sc-r::after{background:var(--red)}.sc-a::after{background:var(--amb)}.sc-p::after{background:var(--pur)}
.sc-lbl{font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.sc-val{font-size:20px;font-weight:800;letter-spacing:-1px;line-height:1}
.sc-sub{font-size:9px;font-family:var(--fm);margin-top:4px;padding:2px 6px;border-radius:3px;display:inline-flex}
.sc-sub.up{background:rgba(0,229,160,.1);color:var(--acc)}.sc-sub.dn{background:rgba(255,84,112,.1);color:var(--red)}
/* ── TABLE ── */
.tbl-wrap{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;margin-bottom:16px}
.tbl-head{padding:14px 16px 10px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--b1)}
.tbl-title{font-size:13px;font-weight:700;flex:1}
.filters{display:flex;gap:5px;flex-wrap:wrap}
.fchip{padding:4px 10px;border-radius:6px;background:var(--s2);border:1px solid var(--b1);font-size:10px;font-weight:600;color:var(--tx2);cursor:pointer;transition:.12s}
.fchip:hover,.fchip.act{background:rgba(0,229,160,.08);color:var(--acc);border-color:rgba(0,229,160,.25)}
/* Desktop table */
.dt{width:100%;border-collapse:collapse}
.dt thead th{padding:8px 12px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:var(--tx3);font-weight:600;border-bottom:1px solid var(--b1)}
.dt tbody tr{border-bottom:1px solid var(--b1);cursor:pointer;transition:background .1s}
.dt tbody tr:hover{background:var(--s2)}.dt tbody tr:last-child{border-bottom:none}
.dt td{padding:10px 12px;font-size:11px;font-family:var(--fm);color:var(--tx2)}
.dt td.sym{font-family:var(--ff);font-weight:700;color:var(--tx);font-size:12px}
/* Mobile trade card */
.trade-cards{display:none;flex-direction:column;gap:8px;padding:12px}
.tc{background:var(--s2);border-radius:var(--r);padding:12px 14px;border-left:3px solid var(--b1)}
.tc.win{border-left-color:var(--acc)}.tc.loss{border-left-color:var(--red)}
.tc-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.tc-sym{font-size:14px;font-weight:700}.tc-pnl{font-size:14px;font-weight:700}
.tc-bot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tc-meta{font-size:10px;color:var(--tx3);font-family:var(--fm)}
/* ── TAGS ── */
.tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700}
.tg-l{background:rgba(77,159,255,.12);color:var(--blu)}.tg-s{background:rgba(255,84,112,.12);color:var(--red)}
.tg-w{background:rgba(0,229,160,.1);color:var(--acc)}.tg-lo{background:rgba(255,84,112,.1);color:var(--red)}
.pos{color:var(--acc);font-weight:700}.neg{color:var(--red);font-weight:700}
/* ── MODAL ── */
.overlay{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.8);backdrop-filter:blur(5px);display:flex;align-items:flex-end;justify-content:center;padding:0}
@media(min-width:640px){.overlay{align-items:center;padding:20px}}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r3) var(--r3) 0 0;width:100%;max-width:540px;max-height:92dvh;overflow-y:auto;animation:slideUp .22s ease}
@media(min-width:640px){.modal{border-radius:var(--r3);animation:popIn .18s ease}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(8px)}to{opacity:1;transform:none}}
.modal-drag{width:40px;height:4px;background:var(--b2);border-radius:2px;margin:10px auto 0;display:block}
@media(min-width:640px){.modal-drag{display:none}}
.modal-h{padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--b1)}
.modal-t{font-size:15px;font-weight:700}
.mcl{width:28px;height:28px;border-radius:7px;background:var(--s2);border:none;cursor:pointer;color:var(--tx2);display:flex;align-items:center;justify-content:center;font-size:15px;transition:.12s}
.mcl:hover{background:var(--s3);color:var(--tx)}
.modal-b{padding:18px 20px}
.modal-f{padding:12px 20px;border-top:1px solid var(--b1);display:flex;justify-content:flex-end;gap:8px;position:sticky;bottom:0;background:var(--s1)}
/* ── FORM ── */
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.fgrp{display:flex;flex-direction:column;gap:5px}
.fgrp.full{grid-column:1/-1}
.flbl{font-size:10px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px}
.finp{background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:10px 13px;color:var(--tx);font-family:var(--fm);font-size:13px;outline:none;transition:border .12s;width:100%;-webkit-appearance:none}
.finp:focus{border-color:var(--acc)}
textarea.finp{resize:vertical;min-height:72px;font-family:var(--ff);font-size:12px;line-height:1.5}
select.finp{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a8899' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
/* ── CALENDAR ── */
.cal-wrap{margin-bottom:16px}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.cal-nav-title{font-size:15px;font-weight:700}
.cal-nav-btn{background:var(--s2);border:1px solid var(--b1);color:var(--tx2);width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.12s}
.cal-nav-btn:hover{background:var(--s3);color:var(--tx)}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.cal-dow{text-align:center;font-size:9px;font-weight:600;color:var(--tx3);text-transform:uppercase;padding:4px 0;letter-spacing:.5px}
.cal-day{aspect-ratio:1;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:.12s;position:relative;min-height:36px;border:1px solid transparent}
.cal-day:hover{background:var(--s3)}
.cal-day.empty{cursor:default}
.cal-day.today{border-color:var(--acc)!important}
.cal-day.selected{background:var(--s3)!important;border-color:var(--b2)!important}
.cal-day.has-win{background:rgba(0,229,160,.12)}.cal-day.has-loss{background:rgba(255,84,112,.1)}.cal-day.has-both{background:rgba(255,170,64,.08)}
.cal-dn{font-size:11px;font-weight:600;color:var(--tx2);line-height:1}
.cal-day.today .cal-dn{color:var(--acc);font-weight:800}
.cal-pnl{font-size:8px;font-family:var(--fm);line-height:1;margin-top:2px;font-weight:600}
.cal-dot{width:4px;height:4px;border-radius:50%;margin-top:2px}
/* Day detail panel */
.day-detail{background:var(--s2);border-radius:var(--r2);padding:14px;margin-top:10px;animation:fadeIn .15s ease;border:1px solid var(--b1)}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.dd-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.dd-date{font-size:12px;font-weight:700}.dd-pnl{font-size:16px;font-weight:800}
/* ── NOTEBOOK ── */
.nb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-bottom:16px}
.nb-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:16px;cursor:pointer;transition:.15s}
.nb-card:hover{border-color:var(--b2);transform:translateY(-1px)}
.nb-date{font-size:9px;color:var(--tx3);font-family:var(--fm);margin-bottom:5px}
.nb-title{font-size:13px;font-weight:700;margin-bottom:4px}
.nb-preview{font-size:11px;color:var(--tx2);line-height:1.55}
.nb-tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.nb-tag{padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;background:rgba(77,159,255,.1);color:var(--blu)}
/* ── GOALS ── */
.goals-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:16px}
.goal-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:16px}
.gc-title{font-size:13px;font-weight:700;margin-bottom:10px}
.gc-bar-bg{height:6px;background:var(--s3);border-radius:3px;overflow:hidden;margin-bottom:6px}
.gc-bar-fill{height:100%;border-radius:3px;transition:width .4s ease}
.gc-vals{display:flex;justify-content:space-between;font-size:10px;font-family:var(--fm);color:var(--tx3)}
.gc-badge{font-size:10px;font-weight:700;font-family:var(--fm);padding:3px 8px;border-radius:5px;margin-top:8px;display:inline-block}
.gc-on{background:rgba(0,229,160,.1);color:var(--acc)}.gc-off{background:rgba(255,84,112,.1);color:var(--red)}
/* ── EQUITY CANVAS ── */
.eq-wrap{height:130px;position:relative;margin-top:6px}
/* ── PROGRESS RING ── */
.ring-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--b1)}
.ring-row:last-child{border-bottom:none;padding-bottom:0}
.ring-svg-wrap{position:relative;width:52px;height:52px;flex-shrink:0}
.ring-svg-wrap svg{transform:rotate(-90deg)}
.ring-lbl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;font-family:var(--fm)}
.ring-info .ri-t{font-size:12px;font-weight:600}
.ring-info .ri-s{font-size:10px;color:var(--tx3);margin-top:2px;font-family:var(--fm)}
/* ── EMPTY STATE ── */
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;color:var(--tx3);gap:8px;text-align:center}
.empty-icon{font-size:36px;opacity:.5}
.empty-txt{font-size:12px}
/* ── TOAST ── */
.toast{position:fixed;bottom:calc(var(--nav-h) + 12px);left:50%;transform:translateX(-50%);z-index:999;background:var(--s1);border:1px solid var(--acc);color:var(--acc);padding:9px 18px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;animation:toastIn .2s ease}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%)}}
/* ── SETTINGS ── */
.set-section{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);padding:18px;margin-bottom:14px}
.set-title{font-size:12px;font-weight:700;color:var(--tx2);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px}
.set-row{margin-bottom:12px}
.set-lbl{font-size:10px;font-weight:600;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.set-inp{background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:10px 13px;color:var(--tx);font-family:var(--ff);font-size:13px;outline:none;transition:border .12s;width:100%}
.set-inp:focus{border-color:var(--acc)}
/* ── BANNER ── */
.banner{padding:7px 18px;background:rgba(0,229,160,.04);border-bottom:1px solid rgba(0,229,160,.07);font-size:11px;color:var(--tx2);display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.pulse-dot{width:5px;height:5px;border-radius:50%;background:var(--acc);animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
/* ── PAGE ANIM ── */
.pg{animation:pgIn .15s ease}
@keyframes pgIn{from{opacity:0;transform:translateX(4px)}to{opacity:1;transform:none}}
/* ── CONFIRM DELETE ── */
.del-row{display:inline-flex;gap:5px;align-items:center}
/* ── RESPONSIVE ── */
@media(max-width:768px){
  .sidebar{display:none}
  .bot-nav{display:flex}
  .btn-fab{display:flex}
  .content{padding:14px 14px 80px}
  .stat-grid{grid-template-columns:repeat(2,1fr);gap:8px}
  .dt{display:none}
  .trade-cards{display:flex}
  .nb-grid{grid-template-columns:1fr}
  .goals-grid{grid-template-columns:1fr}
  .topbar{padding:10px 14px}
  .tb-title{font-size:15px}
  .banner{font-size:10px;padding:6px 14px}
  .cal-day{min-height:40px}
}
@media(min-width:769px){
  .btn-fab{display:none}
}
`;

// ── ICONS ──────────────────────────────────────────────────────────────────
const I = {
  grid:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  trades:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  cal:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  bar:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
  book:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  target:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  settings:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  x:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  edit:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  chev_l:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>,
  chev_r:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>,
  plus:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// ── EQUITY CANVAS ──────────────────────────────────────────────────────────
function EquityCanvas({ trades }) {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = c.offsetWidth || 400; const H = 130;
    c.width = W * dpr; c.height = H * dpr; ctx.scale(dpr, dpr);
    const sorted = [...trades].sort((a,b)=>a.date.localeCompare(b.date));
    let cum = 0; const pts = [0, ...sorted.map(t=>(cum+=t.pnl, cum))];
    if (pts.length < 2) { ctx.fillStyle="#3d4755"; ctx.font="11px Syne,sans-serif"; ctx.textAlign="center"; ctx.fillText("Log trades to see curve", W/2, H/2); return; }
    const mn=Math.min(...pts), mx=Math.max(...pts), rng=mx-mn||1;
    const xs=pts.map((_,i)=>(i/(pts.length-1))*W);
    const ys=pts.map(v=>H-20-((v-mn)/rng)*(H-36));
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"rgba(0,229,160,.2)"); g.addColorStop(1,"rgba(0,229,160,0)");
    ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
    for(let i=1;i<pts.length;i++){const cx=(xs[i-1]+xs[i])/2; ctx.bezierCurveTo(cx,ys[i-1],cx,ys[i],xs[i],ys[i]);}
    ctx.lineTo(xs[xs.length-1],H); ctx.lineTo(xs[0],H); ctx.closePath();
    ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(xs[0],ys[0]);
    for(let i=1;i<pts.length;i++){const cx=(xs[i-1]+xs[i])/2; ctx.bezierCurveTo(cx,ys[i-1],cx,ys[i],xs[i],ys[i]);}
    ctx.strokeStyle="#00e5a0"; ctx.lineWidth=1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(xs[xs.length-1],ys[ys.length-1],4,0,Math.PI*2);
    ctx.fillStyle="#00e5a0"; ctx.fill(); ctx.strokeStyle="#09090d"; ctx.lineWidth=2; ctx.stroke();
  }, [trades]);
  return <div className="eq-wrap"><canvas ref={ref} style={{width:"100%",height:"130px",display:"block"}} /></div>;
}

// ── RING ───────────────────────────────────────────────────────────────────
function Ring({pct,color}){
  const r=20; const circ=2*Math.PI*r; const offset=circ-(Math.min(pct,100)/100)*circ;
  return <div className="ring-svg-wrap">
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} stroke="#21212b" strokeWidth="4.5" fill="none"/>
      <circle cx="26" cy="26" r={r} stroke={color} strokeWidth="4.5" fill="none"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{transition:"stroke-dashoffset .4s ease"}}/>
    </svg>
    <div className="ring-lbl" style={{color}}>{Math.round(pct)}%</div>
  </div>;
}

// ── TRADE MODAL ────────────────────────────────────────────────────────────
function TradeModal({trade, onSave, onClose}){
  const init = trade||{symbol:"",side:"Long",asset:"Stock",entry:"",exit:"",size:"",date:new Date().toISOString().slice(0,10),strategy:"Breakout",notes:""};
  const [f,setF]=useState(init);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const submit=()=>{
    if(!f.symbol||!f.entry||!f.exit||!f.size) return alert("Symbol, Entry, Exit and Size are required.");
    const en=parseFloat(f.entry),ex=parseFloat(f.exit),sz=parseInt(f.size);
    if(isNaN(en)||isNaN(ex)||isNaN(sz)) return alert("Entry, Exit and Size must be numbers.");
    const pnl=Math.round(((f.side==="Long"?ex-en:en-ex)*sz)*100)/100;
    const rr=parseFloat((pnl/(en*sz*0.01)).toFixed(2));
    onSave({...f,id:f.id||uid(),symbol:f.symbol.toUpperCase(),entry:en,exit:ex,size:sz,pnl,rr});
  };
  return <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal">
      <div className="modal-drag"/>
      <div className="modal-h"><div className="modal-t">{trade?.id?"Edit Trade":"Log New Trade"}</div><button className="mcl" onClick={onClose}>{I.x}</button></div>
      <div className="modal-b">
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Symbol *</label><input className="finp" value={f.symbol} onChange={set("symbol")} placeholder="AAPL"/></div>
          <div className="fgrp"><label className="flbl">Asset</label><select className="finp" value={f.asset} onChange={set("asset")}><option>Stock</option><option>ETF</option><option>Options</option><option>Forex</option><option>Crypto</option><option>Futures</option></select></div>
        </div>
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Direction</label><select className="finp" value={f.side} onChange={set("side")}><option>Long</option><option>Short</option></select></div>
          <div className="fgrp"><label className="flbl">Strategy</label><select className="finp" value={f.strategy} onChange={set("strategy")}><option>Breakout</option><option>Reversal</option><option>Momentum</option><option>Scalp</option><option>VWAP</option><option>Gap & Go</option><option>Support/Resistance</option><option>Other</option></select></div>
        </div>
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Entry Price *</label><input className="finp" type="number" step="0.01" value={f.entry} onChange={set("entry")} placeholder="0.00"/></div>
          <div className="fgrp"><label className="flbl">Exit Price *</label><input className="finp" type="number" step="0.01" value={f.exit} onChange={set("exit")} placeholder="0.00"/></div>
        </div>
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Size/Shares *</label><input className="finp" type="number" value={f.size} onChange={set("size")} placeholder="100"/></div>
          <div className="fgrp"><label className="flbl">Date</label><input className="finp" type="date" value={f.date} onChange={set("date")}/></div>
        </div>
        <div className="fgrid" style={{gridTemplateColumns:"1fr"}}>
          <div className="fgrp"><label className="flbl">Notes</label><textarea className="finp" value={f.notes} onChange={set("notes")} placeholder="Setup, emotions, what worked/didn't…"/></div>
        </div>
      </div>
      <div className="modal-f"><button className="btn btn-o" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={submit}>Save Trade</button></div>
    </div>
  </div>;
}

// ── NOTE MODAL ─────────────────────────────────────────────────────────────
function NoteModal({note,onSave,onClose}){
  const init=note||{title:"",body:"",mood:"Focused",tags:"",date:new Date().toISOString().slice(0,10)};
  const [f,setF]=useState(init);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const submit=()=>{if(!f.title) return alert("Please add a title.");onSave({...f,id:f.id||uid()});};
  return <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal">
      <div className="modal-drag"/>
      <div className="modal-h"><div className="modal-t">{note?.id?"Edit Entry":"New Journal Entry"}</div><button className="mcl" onClick={onClose}>{I.x}</button></div>
      <div className="modal-b">
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Date</label><input className="finp" type="date" value={f.date} onChange={set("date")}/></div>
          <div className="fgrp"><label className="flbl">Mood</label><select className="finp" value={f.mood} onChange={set("mood")}>{MOODS.map(m=><option key={m}>{m}</option>)}</select></div>
        </div>
        <div className="fgrid" style={{gridTemplateColumns:"1fr"}}>
          <div className="fgrp"><label className="flbl">Title *</label><input className="finp" value={f.title} onChange={set("title")} placeholder="Today's session recap…"/></div>
        </div>
        <div className="fgrid" style={{gridTemplateColumns:"1fr"}}>
          <div className="fgrp"><label className="flbl">Journal Entry</label><textarea className="finp" style={{minHeight:"100px"}} value={f.body} onChange={set("body")} placeholder="Write your thoughts, lessons, emotions, mistakes…"/></div>
        </div>
        <div className="fgrid" style={{gridTemplateColumns:"1fr"}}>
          <div className="fgrp"><label className="flbl">Tags (comma-separated)</label><input className="finp" value={f.tags} onChange={set("tags")} placeholder="Disciplined, Mistake, Breakout…"/></div>
        </div>
      </div>
      <div className="modal-f"><button className="btn btn-o" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={submit}>Save Entry</button></div>
    </div>
  </div>;
}

// ── GOAL MODAL ─────────────────────────────────────────────────────────────
function GoalModal({goal,onSave,onClose}){
  const init=goal||{title:"",target:"",current:"",unit:"%",direction:"above"};
  const [f,setF]=useState(init);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const submit=()=>{if(!f.title||!f.target) return alert("Title and target are required.");onSave({...f,id:f.id||uid(),target:parseFloat(f.target),current:parseFloat(f.current)||0});};
  return <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal">
      <div className="modal-drag"/>
      <div className="modal-h"><div className="modal-t">{goal?.id?"Edit Goal":"New Goal"}</div><button className="mcl" onClick={onClose}>{I.x}</button></div>
      <div className="modal-b">
        <div className="fgrid" style={{gridTemplateColumns:"1fr"}}><div className="fgrp"><label className="flbl">Goal Name *</label><input className="finp" value={f.title} onChange={set("title")} placeholder="Monthly Win Rate"/></div></div>
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Target Value *</label><input className="finp" type="number" value={f.target} onChange={set("target")} placeholder="65"/></div>
          <div className="fgrp"><label className="flbl">Current Value</label><input className="finp" type="number" value={f.current} onChange={set("current")} placeholder="Auto"/></div>
        </div>
        <div className="fgrid">
          <div className="fgrp"><label className="flbl">Unit</label><input className="finp" value={f.unit} onChange={set("unit")} placeholder="%, $, trades…"/></div>
          <div className="fgrp"><label className="flbl">Direction</label><select className="finp" value={f.direction} onChange={set("direction")}><option value="above">Stay Above</option><option value="below">Stay Below</option></select></div>
        </div>
      </div>
      <div className="modal-f"><button className="btn btn-o" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={submit}>Save Goal</button></div>
    </div>
  </div>;
}

// ── CALENDAR PAGE ──────────────────────────────────────────────────────────
function CalendarPage({trades, onAddTrade}){
  const now = new Date();
  const [yr,setYr]=useState(now.getFullYear());
  const [mo,setMo]=useState(now.getMonth());
  const [selected,setSelected]=useState(null);
  const todayStr=now.toISOString().slice(0,10);

  const monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const firstDow=new Date(yr,mo,1).getDay();

  const byDay={};
  trades.forEach(t=>{
    const dd=new Date(t.date+"T12:00:00");
    if(dd.getFullYear()===yr&&dd.getMonth()===mo){
      const k=t.date;
      if(!byDay[k]) byDay[k]={pnl:0,wins:0,losses:0,trades:[]};
      byDay[k].pnl+=t.pnl; byDay[k].trades.push(t);
      t.pnl>=0?byDay[k].wins++:byDay[k].losses++;
    }
  });

  const prev=()=>{ if(mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1); setSelected(null); };
  const next=()=>{ if(mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1); setSelected(null); };

  const monthTrades=trades.filter(t=>{ const d=new Date(t.date+"T12:00:00"); return d.getFullYear()===yr&&d.getMonth()===mo; });
  const monthStats=calcStats(monthTrades);

  const selKey=selected?`${yr}-${String(mo+1).padStart(2,"0")}-${String(selected).padStart(2,"0")}`:null;
  const selData=selKey&&byDay[selKey];

  return <div className="pg">
    <div className="stat-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:14}}>
      <div className="stat-card sc-g"><div className="sc-lbl">Month P&L</div><div className="sc-val" style={{color:monthStats.netPnl>=0?"var(--acc)":"var(--red)",fontSize:"16px"}}>{fmt$(monthStats.netPnl)}</div></div>
      <div className="stat-card sc-b"><div className="sc-lbl">Win Rate</div><div className="sc-val" style={{color:"var(--blu)"}}>{monthStats.winRate}%</div></div>
      <div className="stat-card sc-a"><div className="sc-lbl">Trades</div><div className="sc-val" style={{color:"var(--amb)"}}>{monthStats.total}</div></div>
    </div>

    <div className="card cal-wrap">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={prev}>{I.chev_l}</button>
        <div className="cal-nav-title">{monthNames[mo]} {yr}</div>
        <button className="cal-nav-btn" onClick={next}>{I.chev_r}</button>
      </div>
      <div className="cal-grid">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} className="cal-dow">{d}</div>)}
        {Array(firstDow).fill(null).map((_,i)=><div key={"e"+i} className="cal-day empty"/>)}
        {Array(daysInMonth).fill(null).map((_,i)=>{
          const day=i+1;
          const key=`${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const data=byDay[key];
          const isToday=key===todayStr;
          const isSel=selected===day;
          let cls="cal-day";
          if(data){ if(data.wins>0&&data.losses>0) cls+=" has-both"; else if(data.wins>0) cls+=" has-win"; else cls+=" has-loss"; }
          if(isToday) cls+=" today";
          if(isSel) cls+=" selected";
          return <div key={day} className={cls} onClick={()=>setSelected(isSel?null:day)}>
            <span className="cal-dn">{day}</span>
            {data&&<span className="cal-pnl" style={{color:data.pnl>=0?"var(--acc)":"var(--red)"}}>{data.pnl>=0?"+":""}${Math.abs(data.pnl).toFixed(0)}</span>}
            {!data&&isToday&&<span className="cal-dot" style={{background:"var(--acc)"}}/>}
          </div>;
        })}
      </div>

      {selData&&<div className="day-detail">
        <div className="dd-header">
          <div className="dd-date">{fmtDate(selKey)}</div>
          <div className="dd-pnl" style={{color:selData.pnl>=0?"var(--acc)":"var(--red)"}}>{fmt$(selData.pnl)}</div>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:10,flexWrap:"wrap"}}>
          <span style={{fontSize:"11px",color:"var(--tx2)"}}>{selData.wins} wins</span>
          <span style={{fontSize:"11px",color:"var(--tx2)"}}>{selData.losses} losses</span>
          <span style={{fontSize:"11px",color:"var(--tx2)"}}>{selData.trades.length} trades</span>
        </div>
        {selData.trades.map(t=><div key={t.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderTop:"1px solid var(--b1)",alignItems:"center"}}>
          <div>
            <span style={{fontWeight:700,fontSize:"12px"}}>{t.symbol}</span>
            <span style={{fontSize:"10px",color:"var(--tx3)",fontFamily:"var(--fm)",marginLeft:8}}>{t.side} · {t.strategy}</span>
          </div>
          <span style={{fontFamily:"var(--fm)",fontSize:"12px",fontWeight:700,color:t.pnl>=0?"var(--acc)":"var(--red)"}}>{fmt$(t.pnl)}</span>
        </div>)}
      </div>}

      {selected&&!selData&&<div className="day-detail" style={{textAlign:"center"}}>
        <div style={{color:"var(--tx3)",fontSize:"12px",marginBottom:10}}>{fmtDate(selKey)} — No trades logged</div>
        <button className="btn btn-p btn-sm" onClick={()=>onAddTrade(selKey)}>+ Log Trade for This Day</button>
      </div>}
    </div>

    <div style={{display:"flex",gap:12,fontSize:"11px",color:"var(--tx3)",padding:"4px 0 12px",flexWrap:"wrap"}}>
      <span style={{display:"flex",gap:5,alignItems:"center"}}><span style={{width:10,height:10,borderRadius:3,background:"rgba(0,229,160,.3)",display:"inline-block"}}/>Profit day</span>
      <span style={{display:"flex",gap:5,alignItems:"center"}}><span style={{width:10,height:10,borderRadius:3,background:"rgba(255,84,112,.25)",display:"inline-block"}}/>Loss day</span>
      <span style={{display:"flex",gap:5,alignItems:"center"}}><span style={{width:10,height:10,borderRadius:3,background:"rgba(255,170,64,.2)",display:"inline-block"}}/>Mixed</span>
    </div>
  </div>;
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({trades, goals, onAddTrade}){
  const stats=calcStats(trades);
  const colors=["var(--acc)","var(--blu)","var(--red)"];
  return <div className="pg">
    <div className="stat-grid">
      <div className="stat-card sc-g"><div className="sc-lbl">Net P&L</div><div className="sc-val" style={{color:stats.netPnl>=0?"var(--acc)":"var(--red)",fontSize:Math.abs(stats.netPnl)>9999?"16px":"20px"}}>{fmt$(stats.netPnl)}</div><div className={`sc-sub ${stats.netPnl>=0?"up":"dn"}`}>{stats.total} trades</div></div>
      <div className="stat-card sc-b"><div className="sc-lbl">Win Rate</div><div className="sc-val" style={{color:"var(--blu)"}}>{stats.winRate}%</div><div className="sc-sub up">{stats.wins}W {stats.losses}L</div></div>
      <div className="stat-card sc-a"><div className="sc-lbl">Profit Factor</div><div className="sc-val" style={{color:"var(--amb)"}}>{stats.pf.toFixed(2)}</div></div>
      <div className="stat-card sc-p"><div className="sc-lbl">Avg Win</div><div className="sc-val" style={{color:"var(--pur)",fontSize:"16px"}}>{stats.avgWin?fmt$(stats.avgWin,0):"—"}</div></div>
    </div>

    <div className="card" style={{marginBottom:14}}>
      <div className="card-title">Equity Curve</div>
      <EquityCanvas trades={trades}/>
    </div>

    {goals.length>0&&<div className="card" style={{marginBottom:14}}>
      <div className="card-title">Goals Progress</div>
      {goals.slice(0,3).map((g,i)=>{
        const pct=g.direction==="above"?Math.min((g.current/g.target)*100,100):Math.max(100-((g.current/g.target)*100),0);
        const met=g.direction==="above"?g.current>=g.target:g.current<=g.target;
        return <div className="ring-row" key={g.id}>
          <Ring pct={pct} color={colors[i%colors.length]}/>
          <div className="ring-info"><div className="ri-t">{g.title}</div><div className="ri-s">{g.current}{g.unit} / {g.target}{g.unit} · {met?"✓ Met":"In progress"}</div></div>
        </div>;
      })}
    </div>}

    <div className="tbl-wrap">
      <div className="tbl-head"><div className="tbl-title">Recent Trades</div><button className="btn btn-p btn-sm" onClick={()=>onAddTrade()}>+ Add</button></div>
      {trades.length===0?<div className="empty"><div className="empty-icon">📊</div><div className="empty-txt">No trades yet. Tap + Add to log your first trade.</div></div>:(
        <>
          <table className="dt"><thead><tr><th>Symbol</th><th>Side</th><th>P&L</th><th>Strategy</th><th>Date</th></tr></thead>
          <tbody>{[...trades].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>(
            <tr key={t.id}><td className="sym">{t.symbol}</td>
            <td><span className={`tag tg-${t.side==="Long"?"l":"s"}`}>{t.side}</span></td>
            <td className={t.pnl>=0?"pos":"neg"}>{fmt$(t.pnl)}</td>
            <td>{t.strategy}</td><td>{fmtDate(t.date)}</td></tr>
          ))}</tbody></table>
          <div className="trade-cards">
            {[...trades].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(t=>(
              <div key={t.id} className={`tc ${t.pnl>=0?"win":"loss"}`}>
                <div className="tc-top"><span className="tc-sym">{t.symbol}</span><span className={`tc-pnl ${t.pnl>=0?"pos":"neg"}`}>{fmt$(t.pnl)}</span></div>
                <div className="tc-bot"><span className={`tag tg-${t.side==="Long"?"l":"s"}`}>{t.side}</span><span className="tc-meta">{t.strategy}</span><span className="tc-meta">{fmtDate(t.date)}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </div>;
}

// ── TRADES PAGE ────────────────────────────────────────────────────────────
function TradesPage({trades, onAdd, onEdit, onDelete}){
  const [filter,setFilter]=useState("All");
  const [delId,setDelId]=useState(null);
  const shown=[...trades].filter(t=>filter==="All"||filter==="Wins"&&t.pnl>=0||filter==="Losses"&&t.pnl<0||filter==="Long"&&t.side==="Long"||filter==="Short"&&t.side==="Short").sort((a,b)=>b.date.localeCompare(a.date));
  return <div className="pg">
    <div className="tbl-wrap">
      <div className="tbl-head">
        <div className="tbl-title">Trade Log ({shown.length})</div>
        <div className="filters">{["All","Wins","Losses","Long","Short"].map(f=><div key={f} className={`fchip${filter===f?" act":""}`} onClick={()=>setFilter(f)}>{f}</div>)}</div>
      </div>
      {shown.length===0?<div className="empty"><div className="empty-icon">📋</div><div className="empty-txt">No trades match this filter.</div></div>:(
        <>
          <table className="dt"><thead><tr><th>Symbol</th><th>Side</th><th>Date</th><th>Entry</th><th>Exit</th><th>P&L</th><th>R:R</th><th>Strategy</th><th>Actions</th></tr></thead>
          <tbody>{shown.map(t=><tr key={t.id}>
            <td className="sym">{t.symbol}</td>
            <td><span className={`tag tg-${t.side==="Long"?"l":"s"}`}>{t.side}</span></td>
            <td>{fmtDate(t.date)}</td><td>${t.entry.toFixed(2)}</td><td>${t.exit.toFixed(2)}</td>
            <td className={t.pnl>=0?"pos":"neg"}>{fmt$(t.pnl)}</td>
            <td style={{color:t.rr>=0?"var(--acc)":"var(--red)"}}>{t.rr>=0?"+":""}{t.rr}R</td>
            <td>{t.strategy}</td>
            <td>{delId===t.id?<span className="del-row"><button className="btn btn-d btn-xs" onClick={()=>{onDelete(t.id);setDelId(null)}}>Delete</button><button className="btn btn-o btn-xs" onClick={()=>setDelId(null)}>✕</button></span>:<span style={{display:"flex",gap:5}}><button className="btn btn-o btn-xs" style={{padding:"3px 7px"}} onClick={()=>onEdit(t)}>{I.edit}</button><button className="btn btn-o btn-xs" style={{padding:"3px 7px",color:"var(--red)"}} onClick={()=>setDelId(t.id)}>{I.trash}</button></span>}</td>
          </tr>)}</tbody></table>
          <div className="trade-cards">
            {shown.map(t=><div key={t.id} className={`tc ${t.pnl>=0?"win":"loss"}`}>
              <div className="tc-top"><span className="tc-sym">{t.symbol}</span><span className={`tc-pnl ${t.pnl>=0?"pos":"neg"}`}>{fmt$(t.pnl)}</span></div>
              <div className="tc-bot"><span className={`tag tg-${t.side==="Long"?"l":"s"}`}>{t.side}</span><span className="tc-meta">{t.strategy}</span><span className="tc-meta">{fmtDate(t.date)}</span></div>
              <div style={{display:"flex",gap:5,marginTop:8}}>
                {delId===t.id?<><button className="btn btn-d btn-xs" onClick={()=>{onDelete(t.id);setDelId(null)}}>Delete</button><button className="btn btn-o btn-xs" onClick={()=>setDelId(null)}>✕</button></>:<><button className="btn btn-o btn-xs" onClick={()=>onEdit(t)}>Edit</button><button className="btn btn-o btn-xs" style={{color:"var(--red)"}} onClick={()=>setDelId(t.id)}>Delete</button></>}
              </div>
            </div>)}
          </div>
        </>
      )}
    </div>
  </div>;
}

// ── REPORTS PAGE ───────────────────────────────────────────────────────────
function ReportsPage({trades}){
  const stats=calcStats(trades);
  const byDay=["Mon","Tue","Wed","Thu","Fri"].map((d,i)=>{
    const ts=trades.filter(t=>new Date(t.date+"T12:00:00").getDay()===i+1);
    return {label:d,pnl:ts.reduce((s,t)=>s+t.pnl,0),count:ts.length};
  });
  const maxD=Math.max(...byDay.map(d=>Math.abs(d.pnl)),1);
  const byStr=[...new Set(trades.map(t=>t.strategy))].map(s=>{
    const ts=trades.filter(t=>t.strategy===s);
    const pnl=ts.reduce((a,t)=>a+t.pnl,0);
    const wr=Math.round((ts.filter(t=>t.pnl>=0).length/ts.length)*100);
    return {strategy:s,pnl,wr,count:ts.length};
  }).sort((a,b)=>b.pnl-a.pnl);
  return <div className="pg">
    <div className="stat-grid">
      <div className="stat-card sc-g"><div className="sc-lbl">Total P&L</div><div className="sc-val" style={{color:stats.netPnl>=0?"var(--acc)":"var(--red)",fontSize:"16px"}}>{fmt$(stats.netPnl)}</div></div>
      <div className="stat-card sc-b"><div className="sc-lbl">Win Rate</div><div className="sc-val" style={{color:"var(--blu)"}}>{stats.winRate}%</div></div>
      <div className="stat-card sc-a"><div className="sc-lbl">Profit Factor</div><div className="sc-val" style={{color:"var(--amb)"}}>{stats.pf.toFixed(2)}</div></div>
      <div className="stat-card sc-p"><div className="sc-lbl">Expectancy</div><div className="sc-val" style={{color:"var(--pur)",fontSize:"16px"}}>{stats.total?fmt$((stats.netPnl/stats.total),0):"—"}</div></div>
    </div>
    <div className="card" style={{marginBottom:14}}>
      <div className="card-title">P&L by Day of Week</div>
      {byDay.map(d=><div key={d.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:"10px",color:"var(--tx2)",width:28,fontFamily:"var(--fm)"}}>{d.label}</span>
        <div style={{flex:1,background:"var(--s3)",borderRadius:3,height:7,overflow:"hidden"}}><div style={{width:`${(Math.abs(d.pnl)/maxD)*100}%`,height:"100%",borderRadius:3,background:d.pnl>=0?"var(--acc)":"var(--red)"}}/></div>
        <span style={{fontSize:"10px",fontFamily:"var(--fm)",color:d.pnl>=0?"var(--acc)":"var(--red)",width:50,textAlign:"right"}}>{d.pnl>=0?"+":""}${Math.abs(d.pnl).toFixed(0)}</span>
      </div>)}
      {trades.length===0&&<div style={{color:"var(--tx3)",fontSize:"11px",textAlign:"center",padding:"12px"}}>Add trades to see stats</div>}
    </div>
    <div className="card" style={{marginBottom:14}}>
      <div className="card-title">Strategy Performance</div>
      {byStr.length===0?<div style={{color:"var(--tx3)",fontSize:"11px",textAlign:"center",padding:"12px"}}>No data yet</div>:byStr.map(s=><div key={s.strategy} style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",marginBottom:4}}><span>{s.strategy}</span><span style={{fontFamily:"var(--fm)",color:s.pnl>=0?"var(--acc)":"var(--red)"}}>{fmt$(s.pnl,0)} · {s.wr}% WR</span></div>
        <div style={{background:"var(--s3)",borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:`${s.wr}%`,height:"100%",borderRadius:3,background:s.wr>=55?"var(--acc)":"var(--red)"}}/></div>
      </div>)}
    </div>
    <div className="card" style={{marginBottom:14}}>
      <div className="card-title">Equity Curve</div>
      <EquityCanvas trades={trades}/>
    </div>
  </div>;
}

// ── NOTEBOOK PAGE ──────────────────────────────────────────────────────────
function NotebookPage({notes, onAdd, onEdit, onDelete}){
  const [delId,setDelId]=useState(null);
  return <div className="pg">
    {notes.length===0?<div className="empty" style={{marginTop:40}}><div className="empty-icon">📔</div><div className="empty-txt">No entries yet. Start journaling your trading mindset and lessons.</div><button className="btn btn-p" onClick={onAdd} style={{marginTop:12}}>Write First Entry</button></div>:(
      <div className="nb-grid">
        {[...notes].sort((a,b)=>b.date.localeCompare(a.date)).map(n=>{
          const tags=n.tags?n.tags.split(",").map(t=>t.trim()).filter(Boolean):[];
          return <div className="nb-card" key={n.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div className="nb-date">{fmtDate(n.date)} · {MOOD_EMOJI[n.mood]||"📝"} {n.mood}</div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button className="btn btn-o btn-xs" style={{padding:"3px 6px"}} onClick={()=>onEdit(n)}>{I.edit}</button>
                {delId===n.id?<><button className="btn btn-d btn-xs" onClick={()=>{onDelete(n.id);setDelId(null)}}>Del</button><button className="btn btn-o btn-xs" onClick={()=>setDelId(null)}>✕</button></>:<button className="btn btn-o btn-xs" style={{padding:"3px 6px",color:"var(--red)"}} onClick={()=>setDelId(n.id)}>{I.trash}</button>}
              </div>
            </div>
            <div className="nb-title">{n.title}</div>
            <div className="nb-preview">{n.body.slice(0,120)}{n.body.length>120?"…":""}</div>
            {tags.length>0&&<div className="nb-tags">{tags.map((t,i)=><span key={i} className="nb-tag">{t}</span>)}</div>}
          </div>;
        })}
      </div>
    )}
  </div>;
}

// ── GOALS PAGE ─────────────────────────────────────────────────────────────
function GoalsPage({goals, onAdd, onEdit, onDelete}){
  const colors=["var(--acc)","var(--blu)","var(--red)","var(--amb)","var(--pur)"];
  const [delId,setDelId]=useState(null);
  return <div className="pg">
    {goals.length===0?<div className="empty" style={{marginTop:40}}><div className="empty-icon">🎯</div><div className="empty-txt">No goals set. Define targets to keep yourself accountable.</div><button className="btn btn-p" onClick={onAdd} style={{marginTop:12}}>Set First Goal</button></div>:(
      <div className="goals-grid">
        {goals.map((g,i)=>{
          const pct=g.direction==="above"?Math.min((g.current/g.target)*100,100):Math.max(100-((g.current/g.target)*100),0);
          const met=g.direction==="above"?g.current>=g.target:g.current<=g.target;
          return <div className="goal-card" key={g.id}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div className="gc-title" style={{marginBottom:0}}>{g.title}</div>
              <div style={{display:"flex",gap:4}}>
                <button className="btn btn-o btn-xs" style={{padding:"3px 6px"}} onClick={()=>onEdit(g)}>{I.edit}</button>
                {delId===g.id?<><button className="btn btn-d btn-xs" onClick={()=>{onDelete(g.id);setDelId(null)}}>Del</button><button className="btn btn-o btn-xs" onClick={()=>setDelId(null)}>✕</button></>:<button className="btn btn-o btn-xs" style={{padding:"3px 6px",color:"var(--red)"}} onClick={()=>setDelId(g.id)}>{I.trash}</button>}
              </div>
            </div>
            <div className="gc-bar-bg"><div className="gc-bar-fill" style={{width:`${pct}%`,background:colors[i%colors.length]}}/></div>
            <div className="gc-vals"><span>{g.current}{g.unit}</span><span>Target: {g.target}{g.unit}</span></div>
            <span className={`gc-badge ${met?"gc-on":"gc-off"}`}>{met?"✓ On Track":"⚠ Behind Target"}</span>
          </div>;
        })}
      </div>
    )}
    <button className="btn btn-p" onClick={onAdd}>+ Add Goal</button>
  </div>;
}

// ── SETTINGS PAGE ──────────────────────────────────────────────────────────
function SettingsPage({settings, onSave, trades, notes, goals}){
  const [f,setF]=useState(settings||{name:"Trader",account:"Main Account",currency:"USD",startBalance:"10000"});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const exportData=()=>{
    const blob=new Blob([JSON.stringify({trades,notes,goals,settings:f},null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="trackedge-backup.json"; a.click();
  };
  return <div className="pg">
    <div className="set-section">
      <div className="set-title">Profile</div>
      <div className="set-row"><div className="set-lbl">Your Name</div><input className="set-inp finp" value={f.name} onChange={set("name")}/></div>
      <div className="set-row"><div className="set-lbl">Account Name</div><input className="set-inp finp" value={f.account} onChange={set("account")}/></div>
      <div className="set-row"><div className="set-lbl">Currency</div><select className="set-inp finp" value={f.currency} onChange={set("currency")}><option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option><option>INR</option><option>AUD</option></select></div>
      <div className="set-row"><div className="set-lbl">Starting Balance</div><input className="set-inp finp" type="number" value={f.startBalance} onChange={set("startBalance")}/></div>
      <button className="btn btn-p" onClick={()=>onSave(f)}>Save Settings</button>
    </div>
    <div className="set-section">
      <div className="set-title">Data & Backup</div>
      <div style={{fontSize:"12px",color:"var(--tx2)",marginBottom:14,lineHeight:1.6}}>Your data is saved automatically in persistent storage. You can export a JSON backup at any time.</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button className="btn btn-o" onClick={exportData}>⬇ Export JSON Backup</button>
      </div>
    </div>
    <div className="set-section">
      <div className="set-title">Stats</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["Trades logged",trades.length],["Journal entries",notes.length],["Goals set",goals.length]].map(([l,v])=><div key={l} style={{background:"var(--s2)",borderRadius:8,padding:"12px 14px"}}><div style={{fontSize:"10px",color:"var(--tx3)",marginBottom:4}}>{l}</div><div style={{fontSize:"18px",fontWeight:800}}>{v}</div></div>)}
      </div>
    </div>
  </div>;
}

// ── APP ROOT ───────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("dashboard");
  const [trades,setTrades]=useState([]);
  const [notes,setNotes]=useState([]);
  const [goals,setGoals]=useState([]);
  const [settings,setSettings]=useState({name:"Trader",account:"Main Account",currency:"USD",startBalance:"10000"});
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null);
  const [tradeModal,setTradeModal]=useState(null);
  const [noteModal,setNoteModal]=useState(null);
  const [goalModal,setGoalModal]=useState(null);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),2200);};

  useEffect(()=>{
    (async()=>{
      const [t,n,g,s]=await Promise.all([load(KEYS.trades),load(KEYS.notes),load(KEYS.goals),load(KEYS.settings)]);
      const td=t||SEED_TRADES; const nd=n||SEED_NOTES; const gd=g||SEED_GOALS;
      setTrades(td); setNotes(nd); setGoals(gd);
      if(s) setSettings(s);
      if(!t) await persist(KEYS.trades,SEED_TRADES);
      if(!n) await persist(KEYS.notes,SEED_NOTES);
      if(!g) await persist(KEYS.goals,SEED_GOALS);
      setLoading(false);
    })();
  },[]);

  const saveTrades=async t=>{setTrades(t);await persist(KEYS.trades,t);};
  const saveNotes=async n=>{setNotes(n);await persist(KEYS.notes,n);};
  const saveGoals=async g=>{setGoals(g);await persist(KEYS.goals,g);};

  const handleSaveTrade=async t=>{const u=trades.find(x=>x.id===t.id)?trades.map(x=>x.id===t.id?t:x):[t,...trades];await saveTrades(u);setTradeModal(null);showToast("Trade saved ✓");};
  const handleDeleteTrade=async id=>{await saveTrades(trades.filter(t=>t.id!==id));showToast("Trade deleted");};
  const handleSaveNote=async n=>{const u=notes.find(x=>x.id===n.id)?notes.map(x=>x.id===n.id?n:x):[n,...notes];await saveNotes(u);setNoteModal(null);showToast("Entry saved ✓");};
  const handleDeleteNote=async id=>{await saveNotes(notes.filter(n=>n.id!==id));showToast("Entry deleted");};
  const handleSaveGoal=async g=>{const u=goals.find(x=>x.id===g.id)?goals.map(x=>x.id===g.id?g:x):[...goals,g];await saveGoals(u);setGoalModal(null);showToast("Goal saved ✓");};
  const handleDeleteGoal=async id=>{await saveGoals(goals.filter(g=>g.id!==id));showToast("Goal deleted");};
  const handleSaveSettings=async s=>{setSettings(s);await persist(KEYS.settings,s);showToast("Settings saved ✓");};

  const openAddTrade=(dateStr)=>setTradeModal(dateStr?{date:dateStr}:null);

  const stats=calcStats(trades);
  const todayStr=new Date().toISOString().slice(0,10);
  const todayTrades=trades.filter(t=>t.date===todayStr);
  const todayPnl=todayTrades.reduce((s,t)=>s+t.pnl,0);

  const navItems=[
    {id:"dashboard",label:"Home",icon:I.grid},
    {id:"trades",label:"Trades",icon:I.trades,badge:trades.length},
    {id:"calendar",label:"Calendar",icon:I.cal},
    {id:"reports",label:"Reports",icon:I.bar},
    {id:"notebook",label:"Journal",icon:I.book},
    {id:"goals",label:"Goals",icon:I.target},
    {id:"settings",label:"Settings",icon:I.settings},
  ];

  const fabActions={dashboard:()=>setTradeModal("new"),trades:()=>setTradeModal("new"),calendar:()=>setTradeModal("new"),reports:null,notebook:()=>setNoteModal("new"),goals:()=>setGoalModal("new"),settings:null};
  const fabAction=fabActions[page];

  const pageLabels={dashboard:"Dashboard",trades:"All Trades",calendar:"P&L Calendar",reports:"Analytics",notebook:"Notebook",goals:"Goals",settings:"Settings"};

  if(loading) return <>
    <style>{CSS}</style>
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:14,color:"var(--tx3)",fontFamily:"var(--ff)"}}>
      <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,var(--acc),var(--blu))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#000"}}>TE</div>
      <div style={{fontSize:13}}>Loading your journal…</div>
    </div>
  </>;

  return <>
    <style>{CSS}</style>
    <div className="shell">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sb-logo"><div className="logo-gem">TE</div><span className="logo-txt">Track<em>Edge</em></span></div>
        <nav className="sb-nav">
          {navItems.map(item=><button key={item.id} className={`ni${page===item.id?" act":""}`} onClick={()=>setPage(item.id)}>
            {item.icon}{item.label}{item.badge?<span className="ni-badge">{item.badge}</span>:null}
          </button>)}
        </nav>
        <div className="sb-foot">
          <div className="acc-chip">
            <div className="ava">{settings.name.slice(0,2).toUpperCase()}</div>
            <div><div className="acc-name">{settings.name}</div><div className="acc-plan">{settings.account}</div></div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <div className="banner">
          <div className="pulse-dot"/>
          {todayTrades.length>0?<>Today: {todayTrades.length} trades · <strong style={{color:todayPnl>=0?"var(--acc)":"var(--red)",marginLeft:2}}>{fmt$(todayPnl)}</strong></>:<>No trades today yet</>}
          <span style={{marginLeft:"auto",display:"flex",gap:12}}>
            <span>WR: <strong style={{color:"var(--blu)"}}>{stats.winRate}%</strong></span>
            <span>Total: <strong style={{color:stats.netPnl>=0?"var(--acc)":"var(--red)"}}>{fmt$(stats.netPnl,0)}</strong></span>
          </span>
        </div>

        <div className="topbar">
          <div><div className="tb-title">{pageLabels[page]}</div></div>
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            {page==="dashboard"&&<button className="btn btn-p btn-sm" onClick={()=>setTradeModal("new")}>+ Trade</button>}
            {page==="trades"&&<button className="btn btn-p btn-sm" onClick={()=>setTradeModal("new")}>+ Trade</button>}
            {page==="notebook"&&<button className="btn btn-p btn-sm" onClick={()=>setNoteModal("new")}>+ Entry</button>}
            {page==="goals"&&<button className="btn btn-p btn-sm" onClick={()=>setGoalModal("new")}>+ Goal</button>}
          </div>
        </div>

        <div className="content">
          {page==="dashboard"&&<Dashboard trades={trades} goals={goals} onAddTrade={openAddTrade}/>}
          {page==="trades"&&<TradesPage trades={trades} onAdd={()=>setTradeModal("new")} onEdit={t=>setTradeModal(t)} onDelete={handleDeleteTrade}/>}
          {page==="calendar"&&<CalendarPage trades={trades} onAddTrade={openAddTrade}/>}
          {page==="reports"&&<ReportsPage trades={trades}/>}
          {page==="notebook"&&<NotebookPage notes={notes} onAdd={()=>setNoteModal("new")} onEdit={n=>setNoteModal(n)} onDelete={handleDeleteNote}/>}
          {page==="goals"&&<GoalsPage goals={goals} onAdd={()=>setGoalModal("new")} onEdit={g=>setGoalModal(g)} onDelete={handleDeleteGoal}/>}
          {page==="settings"&&<SettingsPage settings={settings} onSave={handleSaveSettings} trades={trades} notes={notes} goals={goals}/>}
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bot-nav">
        {navItems.slice(0,5).map(item=><button key={item.id} className={`bn${page===item.id?" act":""}`} onClick={()=>setPage(item.id)}>
          {item.icon}<span>{item.label}</span>
        </button>)}
      </nav>

      {/* Mobile FAB */}
      {fabAction&&<button className="btn-fab" onClick={fabAction}>+</button>}
    </div>

    {tradeModal!==null&&<TradeModal trade={tradeModal==="new"||typeof tradeModal==="string"?{date:typeof tradeModal==="string"&&tradeModal!=="new"?tradeModal:new Date().toISOString().slice(0,10)}:tradeModal} onSave={handleSaveTrade} onClose={()=>setTradeModal(null)}/>}
    {noteModal!==null&&<NoteModal note={noteModal==="new"?null:noteModal} onSave={handleSaveNote} onClose={()=>setNoteModal(null)}/>}
    {goalModal!==null&&<GoalModal goal={goalModal==="new"?null:goalModal} onSave={handleSaveGoal} onClose={()=>setGoalModal(null)}/>}
    {toast&&<div className="toast">{toast}</div>}
  </>;
}
