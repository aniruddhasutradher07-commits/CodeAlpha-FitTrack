// FitTrack v4 — Clean, Simple, Visual + Firebase Cloud Sync
import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, onSnapshot
} from "firebase/firestore";

const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
document.head.appendChild(FONT_LINK);

const CHART_SCRIPT = document.createElement("script");
CHART_SCRIPT.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
document.head.appendChild(CHART_SCRIPT);

// ─── Firebase Setup ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCJJsEvk1CmmYChsbhKT9WF7HOtSom5c-8",
  authDomain: "fittrack-app-5c462.firebaseapp.com",
  projectId: "fittrack-app-5c462",
  storageBucket: "fittrack-app-5c462.firebasestorage.app",
  messagingSenderId: "371551186674",
  appId: "1:371551186674:web:c6a91697e3519a4902b4eb"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const USER_ID = "aniruddha"; // fixed user path: users/aniruddha/
const DOC_REF = doc(db, "users", USER_ID);

// ─── Constants ───────────────────────────────────────────────────────────────
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const EXERCISE_TYPES = [
  { value:"Running",       icon:"🏃", color:"#F97316" },
  { value:"Walking",       icon:"🚶", color:"#06B6D4" },
  { value:"Cycling",       icon:"🚴", color:"#3B82F6" },
  { value:"Swimming",      icon:"🏊", color:"#10B981" },
  { value:"Gym / Weights", icon:"🏋️", color:"#8B5CF6" },
  { value:"Yoga",          icon:"🧘", color:"#F59E0B" },
  { value:"HIIT",          icon:"⚡", color:"#EF4444" },
  { value:"Football",      icon:"⚽", color:"#22C55E" },
  { value:"Basketball",    icon:"🏀", color:"#F97316" },
  { value:"Other",         icon:"🎯", color:"#64748B" },
];
const CAL_RATES = {
  "Running":        { low:8,  medium:11, high:15 },
  "Walking":        { low:3,  medium:5,  high:7  },
  "Cycling":        { low:6,  medium:9,  high:13 },
  "Swimming":       { low:7,  medium:10, high:13 },
  "Gym / Weights":  { low:4,  medium:6,  high:9  },
  "Yoga":           { low:2,  medium:3,  high:5  },
  "HIIT":           { low:10, medium:13, high:16 },
  "Football":       { low:7,  medium:9,  high:12 },
  "Basketball":     { low:6,  medium:8,  high:11 },
  "Other":          { low:4,  medium:6,  high:9  },
};
const INTENSITY = [
  { key:"low",    label:"Easy",     emoji:"🟢", desc:"Light effort" },
  { key:"medium", label:"Moderate", emoji:"🟡", desc:"Moderate sweat" },
  { key:"high",   label:"Hard",     emoji:"🔴", desc:"Heavy sweat" },
];
const DEFAULT_GOALS = { steps:10000, calories:500, water:2500, sleep:8, duration:30 };

// ─── Persistence (Firestore) ──────────────────────────────────────────────
const DEFAULT_STATE = { activities:[], dailyStats:{}, goals:DEFAULT_GOALS, streak:0 };

// local cache so app loads instantly while cloud syncs in background
const loadLocalCache = () => {
  try {
    const d = JSON.parse(localStorage.getItem("fittrack_v4_cache") || "null");
    return d || DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
};
const saveLocalCache = (s) => { try { localStorage.setItem("fittrack_v4_cache", JSON.stringify(s)); } catch {} };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0,10);
const pct = (v, g) => Math.min(100, g > 0 ? Math.round((v / g) * 100) : 0);
const fmt = (n) => Number(n).toLocaleString("en-IN");
const getExType = (type) => EXERCISE_TYPES.find(e => e.value === type) || EXERCISE_TYPES[EXERCISE_TYPES.length-1];

function calcStreak(state) {
  let streak = 0;
  const cur = new Date();
  while (streak < 365) {
    const ds = cur.toISOString().slice(0,10);
    const d = state.dailyStats[ds];
    if (d && (d.calories > 0 || d.steps > 0)) { streak++; cur.setDate(cur.getDate()-1); }
    else break;
  }
  return streak;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       "#0A0A0F",
  surface:  "#111118",
  border:   "rgba(255,255,255,0.07)",
  muted:    "rgba(255,255,255,0.35)",
  sub:      "rgba(255,255,255,0.55)",
  text:     "#F1F5F9",
  accent:   "#F97316",
  font:     "'Inter', sans-serif",
  display:  "'Space Grotesk', sans-serif",
};

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Card({ children, style={} }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:16, padding:18, marginBottom:12, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily:T.display, fontSize:13, fontWeight:600, color:T.muted, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>{children}</div>;
}

function ProgressBar({ value, goal, color, height=8 }) {
  const p = pct(value, goal);
  return (
    <div style={{ height, background:"rgba(255,255,255,0.06)", borderRadius:100, overflow:"hidden" }}>
      <div style={{
        height:"100%", width:`${p}%`, borderRadius:100,
        background: p >= 100
          ? `linear-gradient(90deg, ${color}, ${color}cc)`
          : `linear-gradient(90deg, ${color}66, ${color})`,
        transition:"width 0.7s cubic-bezier(0.4,0,0.2,1)"
      }} />
    </div>
  );
}

function CircleRing({ value, goal, color, size=64, stroke=6, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = pct(value, goal);
  const offset = circ - (p / 100) * circ;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        {children}
      </div>
    </div>
  );
}

function SyncBadge({ status }) {
  const cfg = {
    syncing: { icon:"↻", text:"Syncing...", color:"#F59E0B", spin:true },
    synced:  { icon:"☁", text:"Synced",     color:"#10B981", spin:false },
    offline: { icon:"⚠", text:"Offline",    color:"#EF4444", spin:false },
    error:   { icon:"⚠", text:"Sync error", color:"#EF4444", spin:false },
  }[status] || { icon:"☁", text:"...", color:T.muted, spin:false };
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:100,
      background:`${cfg.color}15`, border:`1px solid ${cfg.color}33`
    }}>
      <span style={{ fontSize:11, color:cfg.color, display:"inline-block", animation: cfg.spin ? "fittrack-spin 1s linear infinite" : "none" }}>{cfg.icon}</span>
      <span style={{ fontFamily:T.font, fontSize:10, fontWeight:600, color:cfg.color }}>{cfg.text}</span>
      <style>{`@keyframes fittrack-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

function Toast({ msg }) {
  return msg ? (
    <div style={{
      position:"fixed", bottom:96, left:"50%", transform:"translateX(-50%)",
      background:"rgba(15,15,20,0.96)", border:`1px solid ${T.border}`,
      color:T.text, padding:"10px 20px", borderRadius:100,
      fontSize:13, fontWeight:500, zIndex:9999, whiteSpace:"nowrap",
      fontFamily:T.font, boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
      backdropFilter:"blur(12px)"
    }}>
      {msg}
    </div>
  ) : null;
}

function LineBarChart({ id, labels, datasets, height=150 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(() => {
    const init = () => {
      if (!window.Chart || !canvasRef.current) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new window.Chart(canvasRef.current, {
        type:"bar",
        data: { labels, datasets },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins: {
            legend:{ display:false },
            tooltip:{
              backgroundColor:"rgba(10,10,15,0.95)",
              titleColor:"#fff", bodyColor:"rgba(255,255,255,0.6)",
              padding:10, cornerRadius:10, borderColor:T.border, borderWidth:1,
              titleFont:{ family:"Inter", size:12, weight:"600" },
              bodyFont:{ family:"Inter", size:11 }
            }
          },
          scales:{
            y:{ beginAtZero:true, grid:{ color:"rgba(255,255,255,0.04)" }, ticks:{ color:T.muted, font:{ size:10, family:"Inter" } } },
            x:{ grid:{ display:false }, ticks:{ color:T.sub, font:{ size:11, family:"Inter" } } }
          }
        }
      });
    };
    if (window.Chart) init();
    else { const t = setInterval(() => { if (window.Chart) { init(); clearInterval(t); } }, 100); return () => clearInterval(t); }
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(labels), JSON.stringify(datasets)]);
  return <div style={{ position:"relative", width:"100%", height }}><canvas ref={canvasRef} /></div>;
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ icon, label, value, unit, goal, color }) {
  const p = pct(value, goal);
  const done = p >= 100;
  return (
    <div style={{
      background: done ? `${color}10` : "rgba(255,255,255,0.03)",
      border: `1px solid ${done ? color+"44" : T.border}`,
      borderRadius:14, padding:"14px 16px", marginBottom:10,
      transition:"border-color 0.3s"
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
            {icon}
          </div>
          <div>
            <div style={{ fontFamily:T.font, fontSize:12, color:T.muted, fontWeight:500 }}>{label}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4, marginTop:2 }}>
              <span style={{ fontFamily:T.display, fontSize:22, fontWeight:700, color: done ? color : T.text, lineHeight:1 }}>{fmt(value)}</span>
              <span style={{ fontFamily:T.font, fontSize:11, color:T.muted }}>{unit}</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontFamily:T.display, fontSize:15, fontWeight:700, color: done ? color : T.sub }}>{p}%</div>
          <div style={{ fontFamily:T.font, fontSize:10, color:T.muted, marginTop:1 }}>of {fmt(goal)}</div>
        </div>
      </div>
      <ProgressBar value={value} goal={goal} color={color} height={6} />
      {done && <div style={{ fontFamily:T.font, fontSize:11, color, fontWeight:600, marginTop:8 }}>✓ Goal reached!</div>}
    </div>
  );
}

// ─── Quick Add Widget ─────────────────────────────────────────────────────────
function QuickAddRow({ icon, label, color, amounts, unit, onAdd }) {
  const [custom, setCustom] = useState("");
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
      <div style={{ width:32, height:32, borderRadius:9, background:`${color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{icon}</div>
      <div style={{ fontFamily:T.font, fontSize:12, fontWeight:500, color:T.sub, width:60, flexShrink:0 }}>{label}</div>
      <div style={{ display:"flex", gap:5, flex:1 }}>
        {amounts.map(a => (
          <button key={a} onClick={() => onAdd(a)} style={{
            flex:1, padding:"6px 2px", borderRadius:8, border:`1px solid ${color}30`,
            background:`${color}0d`, color, fontFamily:T.font, fontSize:11, fontWeight:600, cursor:"pointer"
          }}>+{a >= 1000 ? (a/1000)+"k" : a}</button>
        ))}
        <input type="number" value={custom} onChange={e => setCustom(e.target.value)}
          placeholder="+" onKeyDown={e => { if(e.key==="Enter" && +custom>0){ onAdd(+custom); setCustom(""); }}}
          style={{ width:44, background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:8, padding:"6px 6px", color:T.text, fontSize:11, fontFamily:T.font, outline:"none", textAlign:"center" }} />
        <button onClick={() => { if(+custom>0){ onAdd(+custom); setCustom(""); }}} style={{ padding:"6px 8px", borderRadius:8, border:"none", background:color, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer" }}>✓</button>
      </div>
    </div>
  );
}

// ─── Activity Row ─────────────────────────────────────────────────────────────
function ActivityRow({ act, onDelete }) {
  const t = getExType(act.type);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
      <div style={{ width:40, height:40, borderRadius:12, background:`${t.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
        {t.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:T.font, fontSize:14, fontWeight:600, color:T.text }}>{act.type}</div>
        <div style={{ fontFamily:T.font, fontSize:11, color:T.muted, marginTop:2 }}>
          {act.date} · {act.duration}min{act.distance ? ` · ${act.distance}km` : ""}{act.notes ? ` · "${act.notes}"` : ""}
        </div>
        {/* Mini bar */}
        <div style={{ marginTop:6, height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, width:"100%", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${Math.min(100,(act.duration/60)*100)}%`, background:t.color, borderRadius:2 }} />
        </div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <div style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color:t.color }}>{act.calories}</div>
        <div style={{ fontFamily:T.font, fontSize:10, color:T.muted }}>kcal</div>
      </div>
      {onDelete && (
        <button onClick={() => onDelete(act.id)} style={{ background:"rgba(239,68,68,0.1)", border:"none", color:"#EF4444", width:30, height:30, borderRadius:8, cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ state, onQuickAdd }) {
  const [view, setView] = useState("daily");
  const today = todayStr();
  const ds = state.dailyStats[today] || {};
  const g = state.goals;
  const todayActs = state.activities.filter(a => a.date === today);

  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    weekData.push({ label:DAYS_SHORT[d.getDay()], date:key, ...(state.dailyStats[key] || {}) });
  }
  const wLabels  = weekData.map(d => d.label);
  const wCals    = weekData.map(d => d.calories||0);
  const wSteps   = weekData.map(d => d.steps||0);
  const wWater   = weekData.map(d => d.water||0);
  const wDur     = weekData.map(d => d.duration||0);

  const totalCals  = wCals.reduce((a,b)=>a+b,0);
  const totalSteps = wSteps.reduce((a,b)=>a+b,0);
  const totalMins  = wDur.reduce((a,b)=>a+b,0);
  const avgSleep   = (weekData.map(d=>d.sleep||0).reduce((a,b)=>a+b,0)/7).toFixed(1);
  const activeDays = weekData.filter(d=>(d.calories||0)>0||(d.steps||0)>0).length;

  const stats = [
    { key:"steps",    icon:"👟", label:"Steps",       cur:ds.steps||0,    goal:g.steps,    color:"#06B6D4", unit:"steps", qAmts:[500,1000,2000,5000] },
    { key:"calories", icon:"🔥", label:"Calories",    cur:ds.calories||0, goal:g.calories, color:"#F97316", unit:"kcal",  qAmts:[50,100,200,300] },
    { key:"water",    icon:"💧", label:"Water",       cur:ds.water||0,    goal:g.water,    color:"#10B981", unit:"ml",    qAmts:[200,250,500,750] },
    { key:"duration", icon:"⏱",  label:"Active",      cur:ds.duration||0, goal:g.duration, color:"#3B82F6", unit:"min",   qAmts:[10,15,30,45] },
    { key:"sleep",    icon:"😴", label:"Sleep",       cur:ds.sleep||0,    goal:g.sleep,    color:"#8B5CF6", unit:"hrs",   qAmts:[1,2,4,6] },
  ];

  const goalsHit = stats.filter(s => pct(s.cur, s.goal) >= 100).length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:T.font, fontSize:12, color:T.muted, marginBottom:4 }}>
          {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontFamily:T.display, fontSize:24, fontWeight:700, color:T.text }}>
            {view==="daily" ? "Today" : "This Week"}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {state.streak > 0 && (
              <div style={{ background:"rgba(249,115,22,0.15)", border:"1px solid rgba(249,115,22,0.3)", padding:"4px 10px", borderRadius:100, display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:12 }}>🔥</span>
                <span style={{ fontFamily:T.font, fontSize:12, fontWeight:600, color:T.accent }}>{state.streak}d</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:3, marginBottom:20, gap:3 }}>
        {[["daily","Today"],["weekly","Weekly"]].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex:1, padding:"9px", borderRadius:10, border:"none", cursor:"pointer",
            fontFamily:T.font, fontSize:13, fontWeight:600, transition:"all 0.15s",
            background: view===v ? T.accent : "transparent",
            color: view===v ? "#fff" : T.muted
          }}>{l}</button>
        ))}
      </div>

      {/* ── DAILY ── */}
      {view === "daily" && (
        <div>
          {/* Goals summary bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div style={{ fontFamily:T.font, fontSize:13, color:T.sub }}>
              {goalsHit === 0 ? "Start tracking 💪" : goalsHit === 5 ? "All goals reached! 🎉" : `${goalsHit} of 5 goals hit`}
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {stats.map(s => (
                <div key={s.key} style={{ width:8, height:8, borderRadius:"50%", background: pct(s.cur,s.goal)>=100 ? s.color : "rgba(255,255,255,0.12)", transition:"background 0.3s" }} />
              ))}
            </div>
          </div>

          {/* 4 mini rings */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
            {stats.slice(0,4).map(s => (
              <div key={s.key} style={{
                background:"rgba(255,255,255,0.03)", borderRadius:14, padding:"12px 8px",
                display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                border:`1px solid ${pct(s.cur,s.goal)>=100 ? s.color+"40" : T.border}`
              }}>
                <CircleRing value={s.cur} goal={s.goal} color={s.color} size={52} stroke={5}>
                  <span style={{ fontSize:14 }}>{s.icon}</span>
                </CircleRing>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:T.display, fontSize:13, fontWeight:700, color:T.text, lineHeight:1 }}>{s.cur >= 1000 ? (s.cur/1000).toFixed(1)+"k" : s.cur}</div>
                  <div style={{ fontFamily:T.font, fontSize:9, color:T.muted, marginTop:2 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress stats */}
          <Card>
            <SectionTitle>Progress</SectionTitle>
            {stats.map(s => <StatPill key={s.key} icon={s.icon} label={s.label} value={s.cur} goal={s.goal} color={s.color} unit={s.unit} />)}
          </Card>

          {/* Quick Add */}
          <Card>
            <SectionTitle>Quick Add</SectionTitle>
            {stats.map(s => (
              <QuickAddRow key={s.key} icon={s.icon} label={s.label} color={s.color} amounts={s.qAmts} unit={s.unit} onAdd={a => onQuickAdd(s.key, a)} />
            ))}
          </Card>

          {/* Today's workouts */}
          <Card>
            <SectionTitle>Today's Workouts</SectionTitle>
            {todayActs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:T.muted, fontFamily:T.font, fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:6 }}>🏃</div>
                No workouts logged yet
              </div>
            ) : todayActs.map(act => <ActivityRow key={act.id} act={act} />)}
          </Card>
        </div>
      )}

      {/* ── WEEKLY ── */}
      {view === "weekly" && (
        <div>
          {/* KPI grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:16 }}>
            {[
              { label:"Calories Burned", val:fmt(totalCals), sub:`Goal: ${fmt(g.calories*7)} kcal`, color:"#F97316", icon:"🔥", p:pct(totalCals,g.calories*7) },
              { label:"Total Steps",     val:fmt(totalSteps), sub:`Goal: ${fmt(g.steps*7)}`, color:"#06B6D4", icon:"👟", p:pct(totalSteps,g.steps*7) },
              { label:"Active Minutes",  val:totalMins+" min", sub:`${activeDays}/7 active days`, color:"#3B82F6", icon:"⏱", p:pct(totalMins,g.duration*7) },
              { label:"Avg Sleep",       val:avgSleep+" hrs", sub:`Goal: ${g.sleep} hrs/night`, color:"#8B5CF6", icon:"😴", p:pct(+avgSleep,g.sleep) },
            ].map(k => (
              <div key={k.label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:14, padding:14, border:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                  <div>
                    <div style={{ fontFamily:T.font, fontSize:10, color:T.muted, fontWeight:600, letterSpacing:"0.05em", marginBottom:4 }}>{k.icon} {k.label.toUpperCase()}</div>
                    <div style={{ fontFamily:T.display, fontSize:20, fontWeight:700, color:T.text, lineHeight:1 }}>{k.val}</div>
                    <div style={{ fontFamily:T.font, fontSize:10, color:T.muted, marginTop:3 }}>{k.sub}</div>
                  </div>
                  <div style={{ fontFamily:T.display, fontSize:16, fontWeight:700, color: k.p>=100 ? k.color : T.sub }}>{k.p}%</div>
                </div>
                <ProgressBar value={k.p} goal={100} color={k.color} height={5} />
              </div>
            ))}
          </div>

          {/* Charts */}
          {[
            { title:"🔥 Calories — 7 Days", data:wCals, color:"#F97316", goal:g.calories },
            { title:"👟 Steps — 7 Days",    data:wSteps, color:"#06B6D4", goal:g.steps },
            { title:"⏱ Active Minutes",     data:wDur,   color:"#3B82F6", goal:g.duration },
          ].map((ch, idx) => (
            <Card key={idx}>
              <SectionTitle>{ch.title}</SectionTitle>
              <LineBarChart id={`ch${idx}`} labels={wLabels} height={140} datasets={[
                { data:ch.data, backgroundColor:ch.data.map((_,i)=>i===6?ch.color:`${ch.color}33`), borderRadius:6, borderSkipped:false },
                { data:Array(7).fill(ch.goal), type:"line", borderColor:`${ch.color}44`, borderDash:[4,4], pointRadius:0, borderWidth:1.5, fill:false }
              ]} />
              {/* Day labels with tiny progress */}
              <div style={{ display:"flex", gap:4, marginTop:10 }}>
                {wLabels.map((l,i) => {
                  const p = pct(ch.data[i], ch.goal);
                  const isToday = i === 6;
                  return (
                    <div key={l} style={{ flex:1, textAlign:"center" }}>
                      <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden", marginBottom:4 }}>
                        <div style={{ height:"100%", width:`${p}%`, background: p>=100 ? ch.color : `${ch.color}88`, borderRadius:2 }} />
                      </div>
                      <div style={{ fontFamily:T.font, fontSize:9, color: isToday ? ch.color : T.muted, fontWeight: isToday ? 700 : 400 }}>{l}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          {/* Day breakdown */}
          <Card>
            <SectionTitle>📋 Day Breakdown</SectionTitle>
            {weekData.map((d, i) => {
              const isToday = d.date === today;
              const hasData = (d.calories||0) > 0 || (d.steps||0) > 0;
              return (
                <div key={d.date} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 0",
                  borderBottom: i < weekData.length-1 ? `1px solid ${T.border}` : "none",
                  opacity: hasData ? 1 : 0.4
                }}>
                  <div style={{ width:36, fontFamily:T.font, fontSize:12, fontWeight: isToday ? 700 : 500, color: isToday ? T.accent : T.sub, flexShrink:0 }}>
                    {d.label}{isToday ? " ★" : ""}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:4 }}>
                      {[
                        { v:d.steps||0, g:g.steps, c:"#06B6D4" },
                        { v:d.calories||0, g:g.calories, c:"#F97316" },
                        { v:d.duration||0, g:g.duration, c:"#3B82F6" },
                        { v:d.water||0, g:g.water, c:"#10B981" },
                        { v:d.sleep||0, g:g.sleep, c:"#8B5CF6" },
                      ].map((cell, ci) => (
                        <div key={ci} style={{ flex:1, height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${pct(cell.v,cell.g)}%`, background:cell.c, borderRadius:2 }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontFamily:T.font, fontSize:10, color:T.muted }}>
                      {hasData ? `${fmt(d.steps||0)} steps · ${d.calories||0} kcal · ${d.duration||0}min` : "No data"}
                    </div>
                  </div>
                  {hasData && (
                    <div style={{ flexShrink:0 }}>
                      {[g.steps,g.calories,g.duration,g.water,g.sleep].filter((_,i)=>{
                        const vals = [d.steps||0,d.calories||0,d.duration||0,d.water||0,d.sleep||0];
                        return vals[i] >= _ && vals[i] > 0;
                      }).length > 0 && (
                        <div style={{ fontFamily:T.font, fontSize:10, color:"#22C55E", fontWeight:600 }}>
                          {[g.steps,g.calories,g.duration,g.water,g.sleep].filter((_,i)=>{
                            const vals = [d.steps||0,d.calories||0,d.duration||0,d.water||0,d.sleep||0];
                            return vals[i] >= _ && vals[i] > 0;
                          }).length}✓
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Log Activity ─────────────────────────────────────────────────────────────
function LogActivity({ onLog, onLogDaily }) {
  const [tab, setTab] = useState("workout");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type:"Running", intensity:"medium", duration:"", calories:"", steps:"", distance:"", date:todayStr(), notes:"" });
  const [daily, setDaily] = useState({ water:"", sleep:"", steps:"", weight:"", mood:"" });
  const [autoCalc, setAutoCalc] = useState(true);

  const selectedType = getExType(form.type);
  const estimatedCal = form.duration ? Math.round((CAL_RATES[form.type]?.[form.intensity] || 6) * +form.duration) : 0;

  const handleLog = () => {
    const cal = autoCalc ? estimatedCal : +form.calories;
    if (!form.duration) { onLog(null, "Enter workout duration ⚠️"); return; }
    if (!cal) { onLog(null, "Enter calories ⚠️"); return; }
    onLog({ ...form, duration:+form.duration, calories:cal, steps:+form.steps||0, distance:+form.distance||0 });
    setForm(f=>({...f, duration:"", calories:"", steps:"", distance:"", notes:"", intensity:"medium"}));
    setStep(1); setAutoCalc(true);
  };

  const handleDaily = () => {
    if (!daily.water && !daily.sleep && !daily.steps && !daily.weight) {
      onLogDaily(null, "Enter at least one stat ⚠️"); return;
    }
    onLogDaily({ water:+daily.water||0, sleep:+daily.sleep||0, steps:+daily.steps||0, weight:+daily.weight||0, mood:daily.mood });
    setDaily({ water:"", sleep:"", steps:"", weight:"", mood:"" });
  };

  const InputField = ({ id, placeholder, type="number", extra={} }) => (
    <input type={type} placeholder={placeholder} value={form[id]}
      onChange={e => setForm(f=>({...f,[id]:e.target.value}))}
      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"13px 14px", color:T.text, fontSize:15, fontFamily:T.font, outline:"none", boxSizing:"border-box", ...extra }}
      {...extra} />
  );

  const FieldLabel = ({ children }) => (
    <div style={{ fontFamily:T.font, fontSize:11, color:T.muted, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:8 }}>{children}</div>
  );

  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:20 }}>
      {[["Exercise","Select type"],["Duration","Set time"],["Finish","Save"]].map(([label,sub],i) => {
        const s = i+1;
        const active = step===s, done = step>s;
        return (
          <div key={s} style={{ display:"flex", alignItems:"center", flex: s<3 ? 1 : "none" }}>
            <div onClick={() => done && setStep(s)} style={{
              display:"flex", alignItems:"center", gap:6, cursor: done ? "pointer" : "default"
            }}>
              <div style={{
                width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                background: done ? T.accent+"44" : active ? T.accent : "rgba(255,255,255,0.07)",
                fontFamily:T.font, fontSize:11, fontWeight:700,
                color: done || active ? "#fff" : T.muted, flexShrink:0, transition:"all 0.2s"
              }}>{done ? "✓" : s}</div>
              {active && <div>
                <div style={{ fontFamily:T.font, fontSize:12, fontWeight:700, color:T.text }}>{label}</div>
                <div style={{ fontFamily:T.font, fontSize:10, color:T.muted }}>{sub}</div>
              </div>}
            </div>
            {s < 3 && <div style={{ flex:1, height:1, background: done ? `${T.accent}44` : "rgba(255,255,255,0.07)", margin:"0 8px" }} />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily:T.display, fontSize:26, fontWeight:700, color:T.text, marginBottom:18 }}>Log Activity</div>

      {/* Tab */}
      <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:3, marginBottom:20, gap:3 }}>
        {[["workout","🏋️  Workout"],["daily","📊  Daily Stats"]].map(([t,l]) => (
          <button key={t} onClick={() => { setTab(t); setStep(1); }} style={{
            flex:1, padding:"10px", borderRadius:10, border:"none", cursor:"pointer",
            fontFamily:T.font, fontSize:13, fontWeight:600, transition:"all 0.15s",
            background: tab===t ? T.accent : "transparent", color: tab===t ? "#fff" : T.muted
          }}>{l}</button>
        ))}
      </div>

      {tab === "workout" ? (
        <div>
          <StepBar />

          {step === 1 && (
            <div>
              <Card>
                <FieldLabel>Select Exercise Type</FieldLabel>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                  {EXERCISE_TYPES.map(e => (
                    <button key={e.value} onClick={() => setForm(f=>({...f,type:e.value}))} style={{
                      padding:"13px 12px", borderRadius:13, border:`1px solid ${form.type===e.value ? e.color : T.border}`,
                      background: form.type===e.value ? `${e.color}15` : "rgba(255,255,255,0.02)",
                      cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"all 0.15s"
                    }}>
                      <span style={{ fontSize:22 }}>{e.icon}</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontFamily:T.font, fontSize:13, fontWeight:600, color: form.type===e.value ? e.color : T.text }}>{e.value}</div>
                        <div style={{ fontFamily:T.font, fontSize:10, color:T.muted }}>~{CAL_RATES[e.value]?.medium||6} kcal/min</div>
                      </div>
                      {form.type===e.value && <div style={{ marginLeft:"auto", color:e.color, fontSize:14 }}>✓</div>}
                    </button>
                  ))}
                </div>
              </Card>
              <button onClick={() => setStep(2)} style={{ width:"100%", padding:"15px", borderRadius:14, border:"none", background:T.accent, color:"#fff", fontFamily:T.display, fontSize:16, fontWeight:700, cursor:"pointer" }}>
                Next — Set Duration →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <Card>
                {/* Selected type header */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18, paddingBottom:16, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:44, height:44, borderRadius:13, background:`${selectedType.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{selectedType.icon}</div>
                  <div>
                    <div style={{ fontFamily:T.font, fontSize:15, fontWeight:700, color:T.text }}>{form.type}</div>
                    <div style={{ fontFamily:T.font, fontSize:12, color:T.muted }}>Step 2 of 3</div>
                  </div>
                  <button onClick={() => setStep(1)} style={{ marginLeft:"auto", background:"rgba(255,255,255,0.06)", border:`1px solid ${T.border}`, color:T.muted, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:T.font, fontSize:11 }}>← Change</button>
                </div>

                <FieldLabel>Duration</FieldLabel>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:6, marginBottom:10 }}>
                  {[15,20,30,45,60,90].map(d => (
                    <button key={d} onClick={() => setForm(f=>({...f,duration:String(d)}))} style={{
                      padding:"9px 4px", borderRadius:9, border:`1px solid ${+form.duration===d ? T.accent : T.border}`,
                      background: +form.duration===d ? `${T.accent}20` : "rgba(255,255,255,0.03)",
                      color: +form.duration===d ? T.accent : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600
                    }}>{d}m</button>
                  ))}
                </div>
                <input type="number" placeholder="Custom minutes..." value={form.duration}
                  onChange={e => setForm(f=>({...f,duration:e.target.value}))}
                  style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box", marginBottom:18 }} />

                <FieldLabel>Intensity</FieldLabel>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {INTENSITY.map(iv => {
                    const iColor = iv.key==="low" ? "#22C55E" : iv.key==="medium" ? "#F59E0B" : "#EF4444";
                    return (
                      <button key={iv.key} onClick={() => setForm(f=>({...f,intensity:iv.key}))} style={{
                        padding:"12px 14px", borderRadius:12, border:`1px solid ${form.intensity===iv.key ? iColor : T.border}`,
                        background: form.intensity===iv.key ? `${iColor}12` : "rgba(255,255,255,0.02)",
                        cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all 0.15s"
                      }}>
                        <span style={{ fontSize:18 }}>{iv.emoji}</span>
                        <div style={{ textAlign:"left" }}>
                          <div style={{ fontFamily:T.font, fontSize:13, fontWeight:600, color: form.intensity===iv.key ? iColor : T.text }}>{iv.label}</div>
                          <div style={{ fontFamily:T.font, fontSize:11, color:T.muted }}>{iv.desc}</div>
                        </div>
                        {form.intensity===iv.key && <div style={{ marginLeft:"auto", color:iColor }}>✓</div>}
                      </button>
                    );
                  })}
                </div>

                {/* Live calorie estimate */}
                {form.duration && (
                  <div style={{ background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.25)", borderRadius:12, padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:22 }}>🔥</span>
                    <div>
                      <div style={{ fontFamily:T.font, fontSize:11, color:T.muted }}>Estimated calories</div>
                      <div style={{ fontFamily:T.display, fontSize:26, fontWeight:700, color:T.accent, lineHeight:1 }}>{estimatedCal} <span style={{ fontSize:13, fontWeight:400 }}>kcal</span></div>
                    </div>
                  </div>
                )}
              </Card>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setStep(1)} style={{ flex:1, padding:"14px", borderRadius:14, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontFamily:T.font, fontSize:14, fontWeight:600, cursor:"pointer" }}>← Back</button>
                <button onClick={() => { if(!form.duration){ onLog(null,"Enter duration ⚠️"); return; } setStep(3); }} style={{ flex:2, padding:"14px", borderRadius:14, border:"none", background:T.accent, color:"#fff", fontFamily:T.display, fontSize:15, fontWeight:700, cursor:"pointer" }}>
                  Next → Add Details
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <Card>
                {/* Summary */}
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18, paddingBottom:16, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ width:44, height:44, borderRadius:13, background:`${selectedType.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{selectedType.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:T.font, fontSize:14, fontWeight:700, color:T.text }}>{form.type}</div>
                    <div style={{ fontFamily:T.font, fontSize:12, color:T.muted }}>{form.duration} min · {INTENSITY.find(i=>i.key===form.intensity)?.emoji} {form.intensity}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:T.display, fontSize:22, fontWeight:700, color:T.accent }}>{estimatedCal}</div>
                    <div style={{ fontFamily:T.font, fontSize:10, color:T.muted }}>kcal est.</div>
                  </div>
                </div>

                <FieldLabel>Calories Burned</FieldLabel>
                <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                  <button onClick={() => setAutoCalc(true)} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${autoCalc ? T.accent : T.border}`, background: autoCalc ? `${T.accent}18` : "transparent", color: autoCalc ? T.accent : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600 }}>🤖 Auto ({estimatedCal})</button>
                  <button onClick={() => setAutoCalc(false)} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${!autoCalc ? T.accent : T.border}`, background: !autoCalc ? `${T.accent}18` : "transparent", color: !autoCalc ? T.accent : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600 }}>✏️ Manual</button>
                </div>
                {!autoCalc && (
                  <div style={{ marginBottom:14 }}>
                    <input type="number" placeholder="Enter exact calories" value={form.calories} onChange={e=>setForm(f=>({...f,calories:e.target.value}))}
                      style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
                  </div>
                )}

                <FieldLabel>Steps (Optional)</FieldLabel>
                <div style={{ marginBottom:14 }}>
                  <input type="number" placeholder="e.g. 3500" value={form.steps} onChange={e=>setForm(f=>({...f,steps:e.target.value}))}
                    style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
                </div>

                <FieldLabel>Distance (Optional)</FieldLabel>
                <div style={{ marginBottom:14 }}>
                  <input type="number" placeholder="km e.g. 3.5" value={form.distance} step="0.1" onChange={e=>setForm(f=>({...f,distance:e.target.value}))}
                    style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
                </div>

                <FieldLabel>Date</FieldLabel>
                <div style={{ marginBottom:14 }}>
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
                    style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
                </div>

                <FieldLabel>Notes (Optional)</FieldLabel>
                <input type="text" placeholder="How did it go?" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
              </Card>

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => setStep(2)} style={{ flex:1, padding:"14px", borderRadius:14, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontFamily:T.font, fontSize:14, fontWeight:600, cursor:"pointer" }}>← Back</button>
                <button onClick={handleLog} style={{ flex:2, padding:"14px", borderRadius:14, border:"none", background:T.accent, color:"#fff", fontFamily:T.display, fontSize:15, fontWeight:700, cursor:"pointer" }}>
                  💾 Save Workout
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Daily Stats */
        <div>
          <Card>
            <FieldLabel>💧 Water Intake</FieldLabel>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              {[200,250,500,750].map(v => (
                <button key={v} onClick={() => setDaily(f=>({...f,water:String((+f.water||0)+v)}))} style={{
                  flex:1, padding:"8px 4px", borderRadius:9, border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.07)", color:"#10B981", cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600
                }}>+{v}ml</button>
              ))}
            </div>
            <input type="number" placeholder="Total ml e.g. 2000" value={daily.water} onChange={e=>setDaily(f=>({...f,water:e.target.value}))}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
          </Card>

          <Card>
            <FieldLabel>😴 Sleep Hours</FieldLabel>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              {[5,6,7,8,9].map(v => (
                <button key={v} onClick={() => setDaily(f=>({...f,sleep:String(v)}))} style={{
                  flex:1, padding:"8px 4px", borderRadius:9, border:`1px solid ${+daily.sleep===v ? "#8B5CF6" : "rgba(139,92,246,0.2)"}`, background: +daily.sleep===v ? "rgba(139,92,246,0.15)" : "transparent", color: +daily.sleep===v ? "#8B5CF6" : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600
                }}>{v}h</button>
              ))}
            </div>
            <input type="number" placeholder="Hours e.g. 7.5" value={daily.sleep} step="0.5" onChange={e=>setDaily(f=>({...f,sleep:e.target.value}))}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
          </Card>

          <Card>
            <FieldLabel>👟 Step Count</FieldLabel>
            <div style={{ display:"flex", gap:6, marginBottom:10 }}>
              {[2000,5000,8000,10000].map(v => (
                <button key={v} onClick={() => setDaily(f=>({...f,steps:String(v)}))} style={{
                  flex:1, padding:"8px 4px", borderRadius:9, border:`1px solid ${+daily.steps===v ? "#06B6D4" : "rgba(6,182,212,0.2)"}`, background: +daily.steps===v ? "rgba(6,182,212,0.12)" : "transparent", color: +daily.steps===v ? "#06B6D4" : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:11, fontWeight:600
                }}>{v>=1000?(v/1000)+"k":v}</button>
              ))}
            </div>
            <input type="number" placeholder="Steps e.g. 8000" value={daily.steps} onChange={e=>setDaily(f=>({...f,steps:e.target.value}))}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
          </Card>

          <Card>
            <FieldLabel>⚖️ Body Weight (Optional)</FieldLabel>
            <input type="number" placeholder="kg e.g. 70.5" value={daily.weight} step="0.1" onChange={e=>setDaily(f=>({...f,weight:e.target.value}))}
              style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1px solid ${T.border}`, borderRadius:12, padding:"12px 14px", color:T.text, fontSize:14, fontFamily:T.font, outline:"none", boxSizing:"border-box" }} />
          </Card>

          <Card>
            <FieldLabel>😊 Today's Mood</FieldLabel>
            <div style={{ display:"flex", gap:8 }}>
              {[["😫","Bad"],["😕","Low"],["😐","Okay"],["🙂","Good"],["💪","Great"]].map(([em,lbl]) => (
                <button key={lbl} onClick={() => setDaily(f=>({...f,mood:em}))} style={{
                  flex:1, padding:"10px 4px", borderRadius:12, border:`1px solid ${daily.mood===em ? T.accent : T.border}`,
                  background: daily.mood===em ? `${T.accent}15` : "rgba(255,255,255,0.02)", cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4
                }}>
                  <span style={{ fontSize:20 }}>{em}</span>
                  <span style={{ fontFamily:T.font, fontSize:9, color: daily.mood===em ? T.accent : T.muted, fontWeight:600 }}>{lbl}</span>
                </button>
              ))}
            </div>
          </Card>

          <button onClick={handleDaily} style={{ width:"100%", padding:"15px", borderRadius:14, border:"none", background:T.accent, color:"#fff", fontFamily:T.display, fontSize:16, fontWeight:700, cursor:"pointer" }}>
            💾 Save Daily Stats
          </button>
        </div>
      )}
    </div>
  );
}

// ─── History ──────────────────────────────────────────────────────────────────
function History({ state, onDelete }) {
  const [filter, setFilter] = useState("All");
  const types = ["All", ...new Set(state.activities.map(a => a.type))];
  const filtered = filter === "All" ? state.activities : state.activities.filter(a => a.type === filter);

  const totalCal = filtered.reduce((s,a)=>s+a.calories,0);
  const totalMin = filtered.reduce((s,a)=>s+a.duration,0);

  return (
    <div>
      <div style={{ fontFamily:T.display, fontSize:26, fontWeight:700, color:T.text, marginBottom:18 }}>History</div>

      {/* Filter pills */}
      <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:16 }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            flexShrink:0, padding:"6px 14px", borderRadius:100,
            border:`1px solid ${filter===t ? T.accent : T.border}`,
            background: filter===t ? `${T.accent}18` : "transparent",
            color: filter===t ? T.accent : T.muted, cursor:"pointer", fontFamily:T.font, fontSize:12, fontWeight:600
          }}>
            {t === "All" ? "All" : getExType(t).icon + " " + t}
          </button>
        ))}
      </div>

      {/* Stats */}
      {filtered.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
          {[["Workouts", filtered.length, "🏋️", T.accent], ["Total Cal", totalCal, "🔥", "#F97316"], ["Total Min", totalMin, "⏱", "#3B82F6"]].map(([l,v,i,c]) => (
            <div key={l} style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:12, textAlign:"center", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{i}</div>
              <div style={{ fontFamily:T.display, fontSize:20, fontWeight:700, color:c }}>{fmt(v)}</div>
              <div style={{ fontFamily:T.font, fontSize:10, color:T.muted, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <Card style={{ padding:"4px 16px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 0", color:T.muted, fontFamily:T.font, fontSize:14 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
            No activities logged yet
          </div>
        ) : filtered.map(act => <ActivityRow key={act.id} act={act} onDelete={onDelete} />)}
      </Card>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function Goals({ state, onSave }) {
  const [goals, setGoals] = useState({ ...state.goals });
  const today = todayStr();
  const ds = state.dailyStats[today] || {};

  const goalDefs = [
    { key:"steps",    label:"Daily Steps",    icon:"👟", unit:"steps", color:"#06B6D4", min:1000,  max:30000, step:500, cur:ds.steps||0 },
    { key:"calories", label:"Calories Burned",icon:"🔥", unit:"kcal",  color:"#F97316", min:100,   max:3000,  step:50,  cur:ds.calories||0 },
    { key:"water",    label:"Water Intake",   icon:"💧", unit:"ml",    color:"#10B981", min:500,   max:5000,  step:250, cur:ds.water||0 },
    { key:"sleep",    label:"Sleep",          icon:"😴", unit:"hrs",   color:"#8B5CF6", min:4,     max:12,    step:0.5, cur:ds.sleep||0 },
    { key:"duration", label:"Active Time",    icon:"⏱",  unit:"min",   color:"#3B82F6", min:10,    max:180,   step:5,   cur:ds.duration||0 },
  ];

  const weekLabels = [], weekSteps = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    weekLabels.push(DAYS_SHORT[d.getDay()]);
    weekSteps.push((state.dailyStats[key]||{}).steps||0);
  }

  return (
    <div>
      <div style={{ fontFamily:T.display, fontSize:26, fontWeight:700, color:T.text, marginBottom:18 }}>Goals</div>

      {goalDefs.map(g => {
        const p = pct(g.cur, goals[g.key]);
        return (
          <Card key={g.key}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:`${g.color}18`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{g.icon}</div>
                <div>
                  <div style={{ fontFamily:T.font, fontSize:13, fontWeight:600, color:T.text }}>{g.label}</div>
                  <div style={{ fontFamily:T.font, fontSize:11, color:T.muted, marginTop:1 }}>{fmt(g.cur)} / {fmt(goals[g.key])} {g.unit}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontFamily:T.display, fontSize:18, fontWeight:700, color: p>=100 ? g.color : T.sub }}>{p}%</div>
              </div>
            </div>
            <ProgressBar value={g.cur} goal={goals[g.key]} color={g.color} height={6} />
            <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:14 }}>
              <input type="range" min={g.min} max={g.max} step={g.step} value={goals[g.key]}
                onChange={e => setGoals(prev=>({...prev,[g.key]:+e.target.value}))}
                style={{ flex:1, accentColor:g.color, cursor:"pointer", height:4 }} />
              <div style={{ fontFamily:T.display, fontSize:15, fontWeight:700, color:g.color, minWidth:90, textAlign:"right" }}>
                {fmt(goals[g.key])} <span style={{ fontSize:11, fontWeight:400, color:T.muted }}>{g.unit}</span>
              </div>
            </div>
          </Card>
        );
      })}

      <button onClick={() => onSave(goals)} style={{ width:"100%", padding:"15px", borderRadius:14, border:"none", background:T.accent, color:"#fff", fontFamily:T.display, fontSize:16, fontWeight:700, cursor:"pointer", marginBottom:20 }}>
        Save Goals
      </button>

      <Card>
        <SectionTitle>Weekly Steps</SectionTitle>
        <LineBarChart id="goalsteps" labels={weekLabels} height={140} datasets={[
          { data:weekSteps, backgroundColor:weekSteps.map((_,i)=>i===6?"#06B6D4":"rgba(6,182,212,0.25)"), borderRadius:6, borderSkipped:false },
          { data:Array(7).fill(goals.steps), type:"line", borderColor:"rgba(6,182,212,0.3)", borderDash:[4,4], pointRadius:0, borderWidth:1.5, fill:false }
        ]} />
      </Card>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", icon:"📊", label:"Dashboard" },
  { id:"log",       icon:"➕", label:"Log" },
  { id:"history",   icon:"📋", label:"History" },
  { id:"goals",     icon:"🎯", label:"Goals" },
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(loadLocalCache);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState("syncing");
  const isFirstSnapshot = useRef(true);
  const writingRef = useRef(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }, []);

  // Real-time listener: subscribe to Firestore doc, fall back to local cache offline
  useEffect(() => {
    const unsub = onSnapshot(DOC_REF,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const next = {
            activities: data.activities || [],
            dailyStats: data.dailyStats || {},
            goals: data.goals || DEFAULT_GOALS,
            streak: 0,
          };
          next.streak = calcStreak(next);
          setState(next);
          saveLocalCache(next);
        } else if (isFirstSnapshot.current) {
          // No doc yet — seed it with local cache (first run on this Firebase project)
          setDoc(DOC_REF, loadLocalCache()).catch(() => {});
        }
        isFirstSnapshot.current = false;
        setSyncStatus("synced");
      },
      (err) => {
        console.error("Firestore sync error:", err);
        setSyncStatus(navigator.onLine ? "error" : "offline");
      }
    );
    return () => unsub();
  }, []);

  // Push local state to Firestore (debounced via writingRef to avoid loops on snapshot echo)
  const updateState = useCallback((updater) => {
    setState(prev => {
      const next = updater(prev);
      saveLocalCache(next);
      setSyncStatus("syncing");
      setDoc(DOC_REF, next)
        .then(() => setSyncStatus("synced"))
        .catch((err) => { console.error("Firestore write error:", err); setSyncStatus("error"); });
      return next;
    });
  }, []);

  const handleLog = (data, err) => {
    if (!data) { showToast(err); return; }
    updateState(prev => {
      const ds = { ...(prev.dailyStats[data.date] || { steps:0,calories:0,water:0,sleep:0,duration:0 }) };
      ds.calories += data.calories;
      ds.steps += data.steps;
      ds.duration += data.duration;
      const next = { ...prev, activities:[{ id:Date.now(), ...data }, ...prev.activities], dailyStats:{ ...prev.dailyStats, [data.date]:ds } };
      next.streak = calcStreak(next);
      return next;
    });
    showToast("Workout saved! 💪");
    setTab("dashboard");
  };

  const handleLogDaily = (data, err) => {
    if (!data) { showToast(err); return; }
    const today = todayStr();
    updateState(prev => {
      const ds = { ...(prev.dailyStats[today] || { steps:0,calories:0,water:0,sleep:0,duration:0 }) };
      if (data.water) ds.water = data.water;
      if (data.sleep) ds.sleep = data.sleep;
      if (data.steps) ds.steps = Math.max(ds.steps, data.steps);
      const next = { ...prev, dailyStats:{ ...prev.dailyStats, [today]:ds } };
      next.streak = calcStreak(next);
      return next;
    });
    showToast("Daily stats saved! ✅");
  };

  const handleDelete = (id) => {
    updateState(prev => {
      const act = prev.activities.find(a => a.id === id);
      const next = { ...prev, activities: prev.activities.filter(a => a.id !== id) };
      if (act && next.dailyStats[act.date]) {
        const ds = { ...next.dailyStats[act.date] };
        ds.calories = Math.max(0, ds.calories - act.calories);
        ds.steps = Math.max(0, ds.steps - act.steps);
        ds.duration = Math.max(0, ds.duration - act.duration);
        next.dailyStats = { ...next.dailyStats, [act.date]:ds };
      }
      next.streak = calcStreak(next);
      return next;
    });
    showToast("Activity deleted");
  };

  const handleQuickAdd = (key, amt) => {
    const today = todayStr();
    updateState(prev => {
      const ds = { ...(prev.dailyStats[today] || { steps:0,calories:0,water:0,sleep:0,duration:0 }) };
      ds[key] = (ds[key] || 0) + amt;
      const next = { ...prev, dailyStats:{ ...prev.dailyStats, [today]:ds } };
      next.streak = calcStreak(next);
      return next;
    });
    const labels = { steps:"Steps",calories:"Calories",water:"Water",duration:"Active time",sleep:"Sleep" };
    showToast(`+${amt} ${labels[key]} added ✅`);
  };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:T.font, paddingBottom:80 }}>
      <div style={{ maxWidth:480, margin:"0 auto", padding:"20px 16px 0" }}>
        {/* App header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
          <div style={{ fontFamily:T.display, fontSize:22, fontWeight:700, letterSpacing:"0.02em", color:T.accent }}>FitTrack</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <SyncBadge status={syncStatus} />
            <div style={{ width:34, height:34, borderRadius:"50%", background:`${T.accent}20`, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>👤</div>
          </div>
        </div>
        {tab === "dashboard" && <Dashboard state={state} onQuickAdd={handleQuickAdd} />}
        {tab === "log"       && <LogActivity onLog={handleLog} onLogDaily={handleLogDaily} />}
        {tab === "history"   && <History state={state} onDelete={handleDelete} />}
        {tab === "goals"     && <Goals state={state} onSave={handleSaveGoals} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(10,10,15,0.97)", borderTop:`1px solid ${T.border}`, padding:"8px 0 14px", backdropFilter:"blur(16px)" }}>
        <div style={{ maxWidth:480, margin:"0 auto", display:"flex" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"transparent", border:"none", cursor:"pointer", padding:"6px 0" }}>
              <span style={{ fontSize:20, filter: tab===n.id ? "none" : "grayscale(1) opacity(0.35)", transition:"filter 0.15s" }}>{n.icon}</span>
              <span style={{ fontFamily:T.font, fontSize:10, fontWeight: tab===n.id ? 700 : 400, color: tab===n.id ? T.accent : "rgba(255,255,255,0.3)", transition:"color 0.15s" }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
      <Toast msg={toast} />
    </div>
  );

  function handleSaveGoals(goals) {
    updateState(prev => ({ ...prev, goals }));
    showToast("Goals updated! 🎯");
  }
}