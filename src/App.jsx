import { useState, useEffect, useRef } from "react";

const fmt = (n) => new Intl.NumberFormat("hy-AM").format(Math.abs(Math.round(n)));

function parseLines(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let total = 0; const items = [];
  for (const line of lines) {
    const match = line.match(/(\d[\d,\s]*)/);
    if (match) {
      const amount = parseInt(match[1].replace(/[,\s]/g, ""), 10);
      const label = line.replace(match[0], "").replace(/[-–:]/g, "").trim() || "Expense";
      items.push({ label, amount }); total += amount;
    }
  }
  return { items, total };
}

function getToday() { return new Date().toISOString().split("T")[0]; }
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function getDaysBetween(start, end) {
  const days = []; let cur = start;
  while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
  return days;
}
function computeDayLimits(dayKeys, days, baseDaily) {
  const limits = {}; let carryover = 0;
  for (const key of dayKeys) {
    const limit = baseDaily + carryover;
    const spent = days[key]?.total || 0;
    const diff = limit - spent;
    limits[key] = { limit, spent, diff };
    carryover = diff;
  }
  return limits;
}

const STORAGE_KEY = "amd_budget_v4";
function load() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }
function save(data) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} }

// ── Theme tokens ──
const DARK = {
  bg:          "#0a0a0a",
  bgAlt:       "#111111",
  bgCard:      "#111111",
  bgInput:     "#1c1c1e",
  bgChip:      "rgba(255,255,255,0.06)",
  bgActive:    "rgba(255,255,255,0.09)",
  bgHover:     "rgba(255,255,255,0.05)",
  bgTab:       "rgba(255,255,255,0.06)",
  bgTabActive: "rgba(255,255,255,0.1)",
  border:      "rgba(255,255,255,0.07)",
  borderCard:  "rgba(255,255,255,0.04)",
  borderChip:  "rgba(255,255,255,0.09)",
  borderInput: "rgba(255,255,255,0.08)",
  text:        "#f5f5f7",
  textSub:     "#aeaeb2",
  textMuted:   "#636366",
  textFaint:   "#3a3a3c",
  textGhost:   "#2c2c2e",
  accent:      "#63b3ed",
  green:       "#68d391",
  red:         "#fc8181",
  colorScheme: "dark",
  dayHover:    "rgba(255,255,255,0.05)",
};

const LIGHT = {
  bg:          "#f0f0ea",
  bgAlt:       "#e4e4de",
  bgCard:      "#ffffff",
  bgInput:     "#ffffff",
  bgChip:      "rgba(0,0,0,0.07)",
  bgActive:    "rgba(0,0,0,0.09)",
  bgHover:     "rgba(0,0,0,0.05)",
  bgTab:       "rgba(0,0,0,0.07)",
  bgTabActive: "rgba(0,0,0,0.13)",
  border:      "rgba(0,0,0,0.12)",
  borderCard:  "rgba(0,0,0,0.08)",
  borderChip:  "rgba(0,0,0,0.15)",
  borderInput: "rgba(0,0,0,0.18)",
  text:        "#0a0a0a",
  textSub:     "#222222",
  textMuted:   "#555555",
  textFaint:   "#777777",
  textGhost:   "#999999",
  accent:      "#1a6aa8",
  green:       "#166c38",
  red:         "#c42020",
  colorScheme: "light",
  dayHover:    "rgba(0,0,0,0.05)",
};

const makeGlobalStyle = (t, isDark) => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; overflow: hidden; background: ${t.bg}; }
  ::selection { background: rgba(99,179,237,0.3); }
  input[type=date] { color-scheme: ${t.colorScheme}; cursor: pointer; }
  input[type=date]:focus, input[type=number]:focus, input[type=text]:focus { outline: none; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
  input[type=number] { -moz-appearance: textfield; -webkit-appearance: none; }
  input[type=number], input[type=date] { display: block; width: 100%; box-sizing: border-box; -webkit-appearance: none; appearance: none; }
  .day-row { transition: background 0.12s; cursor: pointer; }
  .day-row:hover { background: ${t.bgHover} !important; }
  .day-row.active { background: ${t.bgActive} !important; }
  .tab-btn { transition: all 0.15s; cursor: pointer; border: none; }
  .icon-btn:hover { color: ${t.text} !important; }
  .confirm-btn:hover { opacity: 0.85 !important; }
  .chip-btn:hover { background: ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.09)"} !important; color: ${t.text} !important; }
  .del-btn:hover { color: ${t.red} !important; }
  .card-hover:hover { background: ${isDark ? "#1a1a1a" : "#f0f0f0"} !important; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
  .fade-up { animation: fadeUp 0.15s ease forwards; }
  @keyframes barGrow { from { width: 0%; } }
  .bar-fill { animation: barGrow 0.4s cubic-bezier(0.4,0,0.2,1) forwards; }
  ::-webkit-scrollbar { width: 0; height: 0; }
  .sidebar { width: 130px; min-width: 130px; }
  @media (min-width: 600px) { .sidebar { width: 148px; min-width: 148px; } }
`;

const GearIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

// ─────────────────────────────────────────
// Setup Screen
// ─────────────────────────────────────────
function SetupScreen({ onConfirm, existing, isDark, onToggleTheme }) {
  const t = isDark ? DARK : LIGHT;
  const today = getToday();
  const [start, setStart] = useState(existing?.range?.start || today);
  const [end,   setEnd]   = useState(existing?.range?.end   || addDays(today, 29));
  const [daily, setDaily] = useState(String(existing?.baseDaily || 20000));
  const [err,   setErr]   = useState("");

  const dayCount   = start && end && end > start ? getDaysBetween(start, end).length : 0;
  const dailyNum   = parseInt(daily.replace(/[,\s]/g, ""), 10);
  const validDaily = !isNaN(dailyNum) && dailyNum > 0;

  const confirm = () => {
    if (!start || !end) return setErr("Please select both dates.");
    if (end <= start)   return setErr("End date must be after start date.");
    if (dayCount > 366) return setErr("Range too long — max 366 days.");
    if (!validDaily)    return setErr("Enter a valid daily amount.");
    setErr(""); onConfirm(start, end, dailyNum);
  };

  const inp = { display:"block", width:"100%", background:t.bgInput, border:`1px solid ${t.borderInput}`, borderRadius:10, padding:"10px 13px", fontFamily:"inherit", fontSize:14, fontWeight:500, color:t.text, letterSpacing:"-0.2px", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none", textAlign:"center" };
  const lbl = { fontSize:10, color:t.textMuted, marginBottom:5, letterSpacing:"0.4px", textTransform:"uppercase", fontWeight:500, display:"block", textAlign:"center" };

  return (
    <div style={{ height:"100vh", background:t.bg, fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,sans-serif", display:"flex", alignItems:"center", justifyContent:"center", color:t.text, overflow:"auto", padding:16 }}>
      <style>{makeGlobalStyle(t, isDark)}</style>
      <div style={{ width:"100%", maxWidth:340 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, letterSpacing:"-0.8px", marginBottom:4 }}>Budget Tracker</div>
            <div style={{ fontSize:13, color:t.textMuted }}>Set your daily limit and tracking period.</div>
          </div>
          <button className="icon-btn" onClick={onToggleTheme} style={{ background:"transparent", border:`1px solid ${t.border}`, borderRadius:8, padding:7, cursor:"pointer", color:t.textMuted, display:"flex", alignItems:"center", transition:"color 0.15s", flexShrink:0 }}>
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:6 }}>
          <div>
            <label style={lbl}>Daily limit</label>
            <input type="number" value={daily} onChange={e=>setDaily(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirm()} placeholder="20000" style={inp} />
          </div>
          <div>
            <label style={lbl}>From</label>
            <input type="date" value={start} onChange={e=>setStart(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>To</label>
            <input type="date" value={end} onChange={e=>setEnd(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ fontSize:11, color:dayCount>0&&validDaily?t.textMuted:t.textGhost, marginBottom:14, height:15 }}>
          {dayCount>0&&validDaily&&`${dayCount} days · ${fmt(dailyNum*dayCount)} AMD total`}
        </div>
        {err && <div style={{ fontSize:11, color:t.red, marginBottom:10 }}>{err}</div>}
        <button className="confirm-btn" onClick={confirm} style={{ width:"100%", background:t.accent, border:"none", borderRadius:11, padding:12, fontFamily:"inherit", fontSize:14, fontWeight:600, color:"#fff", cursor:"pointer", letterSpacing:"-0.2px", transition:"opacity 0.15s" }}>
          Start Tracking
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Period Summary
// ─────────────────────────────────────────
function PeriodSummary({ allKeys, days, limits, baseDaily, onDayClick, t }) {
  const todayKey   = getToday();
  const loggedKeys = allKeys.filter(k => (days[k]?.total||0) > 0 && k <= todayKey);
  if (loggedKeys.length === 0) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:t.textFaint, fontSize:12, lineHeight:1.7 }}>No expenses logged yet.<br/>Start tracking to see your summary.</div>
    </div>
  );

  const totalBudget = baseDaily * allKeys.length;
  const totalSpent  = allKeys.reduce((s,k)=>s+(days[k]?.total||0),0);
  const totalSaved  = totalBudget - totalSpent;
  const daysLogged  = loggedKeys.length;
  const avgSpend    = daysLogged > 0 ? totalSpent / daysLogged : 0;
  const daysOver    = loggedKeys.filter(k=>limits[k]?.diff<0).length;
  const daysUnder   = loggedKeys.filter(k=>limits[k]?.diff>0).length;
  const overPct     = daysLogged > 0 ? Math.round((daysOver/daysLogged)*100) : 0;
  const biggestDay  = loggedKeys.reduce((b,k)=>days[k].total>(days[b]?.total||0)?k:b, loggedKeys[0]);
  const cheapestDay = loggedKeys.reduce((b,k)=>days[k].total<(days[b]?.total||Infinity)?k:b, loggedKeys[0]);
  const maxSpend    = Math.max(...loggedKeys.map(k=>days[k]?.total||0));

  const Card = ({label,value,sub,color}) => (
    <div style={{ background:t.bgCard, borderRadius:9, padding:"10px 11px", border:`1px solid ${t.borderCard}` }}>
      <div style={{ fontSize:9, color:t.textFaint, letterSpacing:"0.4px", textTransform:"uppercase", fontWeight:500, marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:600, letterSpacing:"-0.4px", color:color||t.text, lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:t.textMuted, marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"12px 12px 24px", minWidth:0 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:6 }}>
        <Card label="Spent"   value={fmt(totalSpent)}   sub={`of ${fmt(totalBudget)} AMD`} />
        <Card label={totalSaved>=0?"Saved":"Over"} value={`${totalSaved>=0?"−":"+"}${fmt(Math.abs(totalSaved))}`} color={totalSaved>=0?t.green:t.red} sub={`${Math.round(Math.abs(totalSaved/totalBudget)*100)}% of budget`} />
        <Card label="Avg/day" value={fmt(avgSpend)} sub={`vs ${fmt(baseDaily)}`} color={avgSpend>baseDaily?t.red:t.green} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:12 }}>
        <Card label="Logged" value={daysLogged} sub={`of ${allKeys.length} days`} />
        <Card label="Over"   value={daysOver}   color={daysOver>0?t.red:t.text} sub={`${overPct}% of logged`} />
        <Card label="Under"  value={daysUnder}  color={daysUnder>0?t.green:t.text} sub={`${100-overPct}% of logged`} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:12 }}>
        {[{label:"Biggest",key:biggestDay,color:t.red},{label:"Cheapest",key:cheapestDay,color:t.green}].map(({label,key,color})=>(
          <div key={label} className="card-hover" onClick={()=>onDayClick(key)} style={{ background:t.bgCard, borderRadius:9, padding:"10px 11px", cursor:"pointer", border:`1px solid ${t.borderCard}` }}>
            <div style={{ fontSize:9, color:t.textFaint, letterSpacing:"0.4px", textTransform:"uppercase", fontWeight:500, marginBottom:5 }}>{label}</div>
            <div style={{ fontSize:12, fontWeight:600, color, letterSpacing:"-0.2px" }}>{new Date(key+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
            <div style={{ fontSize:11, color:t.textSub, marginTop:2 }}>{fmt(days[key]?.total||0)} AMD</div>
          </div>
        ))}
      </div>
      <div style={{ background:t.bgCard, borderRadius:9, padding:"11px 11px 9px", border:`1px solid ${t.borderCard}` }}>
        <div style={{ fontSize:9, color:t.textFaint, letterSpacing:"0.4px", textTransform:"uppercase", fontWeight:500, marginBottom:10 }}>Daily spend</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:40 }}>
          {loggedKeys.map(key=>{
            const spent=days[key]?.total||0; const l=limits[key];
            const barPct=maxSpend>0?(spent/maxSpend)*100:0;
            return (
              <div key={key} onClick={()=>onDayClick(key)} style={{ flex:1, display:"flex", alignItems:"flex-end", cursor:"pointer", minWidth:0 }}>
                <div style={{ width:"100%", height:`${Math.max(barPct,4)}%`, borderRadius:2, minHeight:2, opacity:0.85, background:key===getToday()?t.accent:l.diff<0?t.red:l.diff>0?t.green:t.textFaint }} />
              </div>
            );
          })}
        </div>
        <div style={{ borderTop:`1px dashed ${t.borderCard}`, marginTop:7, paddingTop:4, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:9, color:t.textFaint }}>{new Date(loggedKeys[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          <span style={{ fontSize:9, color:t.textFaint }}>{new Date(loggedKeys[loggedKeys.length-1]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Day Log
// ─────────────────────────────────────────
function DayLog({ activeDay, todayKey, activeDayData, activeLimitData, isOver, isUnder, spentPct, baseDaily, onAddLine, onDeleteItem, quickItems, onSaveQuickItems, t }) {
  const [inputVal,     setInputVal]     = useState("");
  const [editingQuick, setEditingQuick] = useState(false);
  const [quickDraft,   setQuickDraft]   = useState("");
  const inputRef = useRef(null);

  useEffect(() => { setInputVal(""); }, [activeDay]);

  const listRef = useRef(null);

  const submitInput = () => {
    const v = inputVal.trim(); if (!v) return;
    onAddLine(v); setInputVal("");
    // Scroll the expense list to the bottom so the new item is visible
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 50);
  };

  const handleChipTap = (chip) => {
    setInputVal(chip + " ");
    setTimeout(() => { const el = inputRef.current; if (!el) return; el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 20);
  };

  const addQuickChip = () => {
    const v = quickDraft.trim(); if (!v) return;
    onSaveQuickItems([...quickItems, v]); setQuickDraft("");
  };

  const statusColor = isOver ? t.red : isUnder ? t.green : t.accent;
  const remaining   = activeLimitData.limit - activeDayData.total;
  const dateLabel   = new Date(activeDay+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>

      {/* Daily summary */}
      <div style={{ padding:"12px 16px 10px", borderBottom:`1px solid ${t.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:600, letterSpacing:"-0.3px", color:t.text }}>{dateLabel}</span>
          {activeDay===todayKey && <span style={{ fontSize:8, fontWeight:700, background:t.accent, color:"#fff", padding:"2px 4px", borderRadius:3 }}>TODAY</span>}
        </div>
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, color:t.textFaint, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.3px" }}>
            {activeDayData.total > 0 ? (isOver ? "over by" : "remaining") : "daily limit"}
          </div>
          <div style={{ fontSize:28, fontWeight:700, letterSpacing:"-1px", lineHeight:1, color:activeDayData.total===0?t.text:statusColor }}>
            {activeDayData.total===0 ? fmt(activeLimitData.limit) : fmt(Math.abs(remaining))}
            <span style={{ fontSize:12, fontWeight:400, color:t.textMuted, marginLeft:5 }}>AMD</span>
          </div>
          {activeDayData.total > 0 && (
            <div style={{ fontSize:11, color:t.textMuted, marginTop:3 }}>{fmt(activeDayData.total)} spent of {fmt(activeLimitData.limit)}</div>
          )}
        </div>
        <div style={{ height:3, background:t.border, borderRadius:99, overflow:"hidden" }}>
          <div className="bar-fill" style={{ height:"100%", width:`${spentPct}%`, borderRadius:99, background:isOver?"linear-gradient(90deg,#fc8181,#f56565)":isUnder?"linear-gradient(90deg,#68d391,#48bb78)":t.accent }} />
        </div>
      </div>

      {/* Expense rows */}
      <div ref={listRef} style={{ flex:1, overflowY:"auto", minHeight:0 }}>
        {activeDayData.items?.length === 0 ? (
          <div style={{ padding:"20px 16px", fontSize:12, color:t.textGhost, lineHeight:1.8 }}>
            No expenses yet. Type below or tap a quick chip.
          </div>
        ) : activeDayData.items.map((item,i) => (
          <div key={i} className="fade-up" style={{ display:"flex", alignItems:"center", padding:"11px 16px", borderBottom:`1px solid ${t.borderCard}`, animationDelay:`${i*0.03}s` }}>
            <span style={{ flex:1, fontSize:14, color:t.textSub, letterSpacing:"-0.1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginRight:12 }}>{item.label}</span>
            <span style={{ fontSize:14, fontWeight:600, color:t.text, letterSpacing:"-0.3px", flexShrink:0 }}>{fmt(item.amount)}</span>
            <button className="del-btn" onClick={()=>onDeleteItem(i)} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", fontSize:16, padding:"0 0 0 12px", lineHeight:1, flexShrink:0, transition:"color 0.12s" }}>×</button>
          </div>
        ))}
      </div>

      {/* Quick-add chips */}
      <div style={{ borderTop:`1px solid ${t.border}`, padding:"7px 12px", flexShrink:0 }}>
        {!editingQuick ? (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            {quickItems.map((chip,i) => (
              <button key={i} className="chip-btn" onClick={()=>handleChipTap(chip)} style={{ background:t.bgChip, border:`1px solid ${t.borderChip}`, borderRadius:20, padding:"4px 11px", fontSize:11, color:t.textSub, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.12s", fontFamily:"inherit" }}>
                {chip}
              </button>
            ))}
            <button onClick={()=>setEditingQuick(true)} style={{ background:"transparent", border:`1px dashed ${t.borderChip}`, borderRadius:20, padding:"4px 10px", fontSize:11, color:t.textFaint, cursor:"pointer", fontFamily:"inherit" }}>
              {quickItems.length===0 ? "+ add" : "+"}
            </button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
              {quickItems.map((chip,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", background:t.bgChip, border:`1px solid ${t.borderChip}`, borderRadius:20, padding:"3px 6px 3px 11px", gap:4 }}>
                  <span style={{ fontSize:11, color:t.textSub }}>{chip}</span>
                  <button onClick={()=>onSaveQuickItems(quickItems.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px", fontFamily:"inherit" }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input autoFocus value={quickDraft} onChange={e=>setQuickDraft(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addQuickChip()} placeholder="New category…"
                style={{ flex:1, background:t.bgInput, border:`1px solid ${t.borderInput}`, borderRadius:8, padding:"6px 10px", fontSize:11, color:t.text, fontFamily:"inherit", outline:"none" }} />
              <button onClick={addQuickChip} style={{ background:t.accent, border:"none", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:600, color:"#fff", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>Add</button>
              <button onClick={()=>{ setQuickDraft(""); setEditingQuick(false); }} style={{ background:t.bgChip, border:"none", borderRadius:8, padding:"6px 10px", fontSize:11, color:t.textMuted, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>Done</button>
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ borderTop:`1px solid ${t.border}`, padding:"8px 12px", flexShrink:0, display:"flex", gap:8 }}>
        <input ref={inputRef} value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitInput()} placeholder="2500"
          style={{ flex:1, background:t.bgInput, border:`1px solid ${t.borderInput}`, borderRadius:9, padding:"9px 13px", fontSize:14, color:t.text, fontFamily:"-apple-system,'SF Pro Text',BlinkMacSystemFont,sans-serif", outline:"none", letterSpacing:"-0.1px", minWidth:0 }} />
        <button onClick={submitInput} style={{ background:t.accent, border:"none", borderRadius:9, padding:"9px 16px", fontSize:13, fontWeight:600, color:"#fff", cursor:"pointer", flexShrink:0, fontFamily:"inherit" }}>Add</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Root
// ─────────────────────────────────────────
export default function App() {
  const [stored,  setStored]  = useState(() => load());
  const [isDark,  setIsDark]  = useState(() => {
    const saved = localStorage.getItem("amd_theme");
    return saved !== null ? saved === "dark" : true;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("amd_theme", next ? "dark" : "light");
  };

  const hasConfig = stored.range?.start && stored.range?.end && stored.baseDaily;

  const handleSetup = (start, end, baseDaily) => {
    const updated = { ...stored, range:{start,end}, baseDaily, days:stored.days||{} };
    save(updated); setStored(updated);
  };
  const resetRange = () => {
    const updated = { ...stored, range:null };
    save(updated); setStored(updated);
  };

  if (!hasConfig) return <SetupScreen onConfirm={handleSetup} existing={stored} isDark={isDark} onToggleTheme={toggleTheme} />;
  return <Tracker stored={stored} setStored={setStored} onReset={resetRange} isDark={isDark} onToggleTheme={toggleTheme} />;
}

// ─────────────────────────────────────────
// Tracker
// ─────────────────────────────────────────
function Tracker({ stored, setStored, onReset, isDark, onToggleTheme }) {
  const t = isDark ? DARK : LIGHT;
  const { range, days:storedDays, baseDaily } = stored;
  const [days,      setDays]      = useState(storedDays || {});
  const [activeDay, setActiveDay] = useState(() => {
    const keys = getDaysBetween(range.start, range.end);
    const today = getToday();
    return keys.includes(today) ? today : range.start;
  });
  const [tab, setTab] = useState("log");

  const allKeys  = getDaysBetween(range.start, range.end);
  const limits   = computeDayLimits(allKeys, days, baseDaily);
  const todayKey = getToday();

  const updateDays = (updated) => {
    const newStored = { ...stored, days:updated };
    setDays(updated); save(newStored); setStored(newStored);
  };

  const handleAddLine = (line) => {
    const trimmed = line.trim(); if (!trimmed) return;
    const existing = days[activeDay]?.raw || "";
    const newRaw   = existing ? existing.trimEnd() + "\n" + trimmed : trimmed;
    const { items, total } = parseLines(newRaw);
    updateDays({ ...days, [activeDay]: { raw:newRaw, items, total } });
  };

  const handleDeleteItem = (idx) => {
    const raw   = days[activeDay]?.raw || "";
    const lines = raw.split("\n").map(l=>l.trim()).filter(Boolean);
    lines.splice(idx, 1);
    const newRaw = lines.join("\n");
    const { items, total } = parseLines(newRaw);
    updateDays({ ...days, [activeDay]: { raw:newRaw, items, total } });
  };

  const handleSaveQuickItems = (qi) => {
    const ns = { ...stored, quickItems:qi }; save(ns); setStored(ns);
  };

  const activeDayData   = days[activeDay] || { raw:"", items:[], total:0 };
  const activeLimitData = limits[activeDay] || { limit:baseDaily, spent:0, diff:baseDaily };
  const isOver   = activeLimitData.diff < 0;
  const isUnder  = activeLimitData.diff > 0 && activeDayData.total > 0;
  const spentPct = Math.min((activeDayData.total / activeLimitData.limit) * 100, 100);

  const rangeTotal      = allKeys.reduce((s,k)=>s+(days[k]?.total||0),0);
  const futureKeys      = allKeys.filter(k=>k>todayKey);
  const remainingDays   = futureKeys.length;
  const todayLimit      = limits[todayKey] || { diff:baseDaily };
  const remainingBudget = remainingDays * baseDaily + todayLimit.diff;
  const rangeLabel      = `${new Date(range.start+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(range.end+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}`;

  return (
    <div style={{ height:"100vh", width:"100vw", background:t.bg, fontFamily:"-apple-system,'SF Pro Display','SF Pro Text',BlinkMacSystemFont,sans-serif", color:t.text, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{makeGlobalStyle(t, isDark)}</style>

      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", padding:"8px 12px", borderBottom:`1px solid ${t.border}`, flexShrink:0, gap:6 }}>
        <span style={{ fontSize:13, fontWeight:600, letterSpacing:"-0.3px", flexShrink:0 }}>Budget Tracker</span>
        <div style={{ flex:1 }} />
        <div style={{ display:"flex", background:t.bgTab, borderRadius:7, padding:3, gap:1, flexShrink:0 }}>
          {[["log","Log"],["summary","Summary"]].map(([id,label])=>(
            <button key={id} className="tab-btn" onClick={()=>setTab(id)} style={{ background:tab===id?t.bgTabActive:"transparent", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:tab===id?600:400, color:tab===id?t.text:t.textMuted }}>{label}</button>
          ))}
        </div>
        <button className="icon-btn" onClick={onToggleTheme} style={{ background:"transparent", border:"none", padding:5, cursor:"pointer", color:t.textMuted, display:"flex", alignItems:"center", borderRadius:6, transition:"color 0.15s", flexShrink:0 }}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
        <button className="icon-btn" onClick={onReset} title={`${rangeLabel} · ${fmt(baseDaily)} AMD/day`}
          style={{ background:"transparent", border:"none", padding:5, cursor:"pointer", color:t.textMuted, display:"flex", alignItems:"center", borderRadius:6, transition:"color 0.15s", flexShrink:0 }}>
          <GearIcon />
        </button>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>

        {/* Sidebar */}
        <div className="sidebar" style={{ borderRight:`1px solid ${t.border}`, display:"flex", flexDirection:"column", flexShrink:0, minHeight:0, overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"6px 10px", borderBottom:`1px solid ${t.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <span style={{ fontSize:9, color:t.textFaint }}>{allKeys.length}d</span>
              <span style={{ fontSize:10, fontWeight:600, color:t.textSub }}>{fmt(rangeTotal)}</span>
            </div>
            {allKeys.map(key => {
              const d=days[key]||{total:0}; const l=limits[key];
              const over=l.diff<0; const under=l.diff>0&&d.total>0;
              const hasData=d.total>0; const isActive=key===activeDay;
              const isToday=key===todayKey; const isFuture=key>todayKey;
              const dateObj=new Date(key+"T12:00:00");
              const diffColor = over ? t.red : under ? t.green : t.textFaint;
              const isActiveLog = isActive && tab==="log";
              return (
                <div key={key} className={`day-row${isActiveLog?" active":""}`}
                  onClick={()=>{ setActiveDay(key); setTab("log"); }}
                  style={{ padding:"6px 10px", borderBottom:`1px solid ${t.borderCard}`, background:isActiveLog?t.bgActive:"transparent", opacity:isFuture&&!hasData?0.3:1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:3, minWidth:0 }}>
                      <span style={{ fontSize:12, fontWeight:isActiveLog?500:400, color:isActiveLog?t.text:t.textSub, letterSpacing:"-0.2px", whiteSpace:"nowrap" }}>
                        {dateObj.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                      </span>
                      <span style={{ fontSize:9, color:isActiveLog?t.textFaint:t.textGhost, whiteSpace:"nowrap" }}>
                        {dateObj.toLocaleDateString("en-US",{weekday:"short"})}
                      </span>
                    </div>
                    {isToday && <span style={{ width:4, height:4, borderRadius:"50%", background:t.accent, display:"block", flexShrink:0 }} />}
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginTop:2 }}>
                    <span style={{ fontSize:9, color:isActiveLog?t.textMuted:t.textGhost, whiteSpace:"nowrap" }}>{fmt(l.limit)}</span>
                    {hasData && (
                      <span style={{ fontSize:9, fontWeight:500, color:diffColor, whiteSpace:"nowrap" }}>
                        {over ? `-${fmt(Math.abs(l.diff))}` : `+${fmt(l.diff)}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Remaining footer */}
          {remainingDays > 0 && (
            <div style={{ borderTop:`1px solid ${t.border}`, padding:"7px 10px", flexShrink:0, background:t.bg }}>
              <div style={{ fontSize:8, color:t.textFaint, textTransform:"uppercase", letterSpacing:"0.5px", fontWeight:500, marginBottom:2 }}>Left</div>
              <div style={{ fontSize:12, fontWeight:600, letterSpacing:"-0.3px", color:remainingBudget<0?t.red:t.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {remainingBudget<0?"-":""}{fmt(remainingBudget)}
              </div>
              <div style={{ fontSize:9, color:t.textFaint, marginTop:1, whiteSpace:"nowrap" }}>
                {remainingDays}d · {fmt(Math.round(remainingBudget/remainingDays))}/d
              </div>
            </div>
          )}
        </div>

        {/* Main panel */}
        {tab === "summary" ? (
          <PeriodSummary allKeys={allKeys} days={days} limits={limits} baseDaily={baseDaily} onDayClick={(key)=>{ setActiveDay(key); setTab("log"); }} t={t} />
        ) : (
          <DayLog
            activeDay={activeDay} todayKey={todayKey}
            activeDayData={activeDayData} activeLimitData={activeLimitData}
            isOver={isOver} isUnder={isUnder} spentPct={spentPct} baseDaily={baseDaily}
            onAddLine={handleAddLine} onDeleteItem={handleDeleteItem}
            quickItems={stored.quickItems || []} onSaveQuickItems={handleSaveQuickItems}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
