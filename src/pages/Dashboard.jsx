/**
 * Dashboard.jsx — SalesPulse Glass Edition
 * Transparent background · Glassmorphism cards · Full API data
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import {
  getDashboardData,
  getOrders,
  getAllSalesPersons,
  getAttendanceBySalesId,
  getAllRetailers,
  getRetailerLedgerById,
} from '../APIS';

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────── */
const G = {
  /* glass surfaces — dark-on-light */
  glass:       'rgba(255,255,255,0.55)',
  glassMd:     'rgba(255,255,255,0.68)',
  glassHover:  'rgba(255,255,255,0.75)',
  glassBd:     'rgba(0,0,0,0.08)',
  glassBdHover:'rgba(0,0,0,0.14)',

  /* text — dark */
  text:  '#0f172a',
  sub:   'rgba(30,41,80,0.60)',
  muted: 'rgba(30,41,80,0.35)',

  /* accents */
  blue:   '#5b8dee',
  green:  '#34d399',
  amber:  '#fbbf24',
  red:    '#f87171',
  purple: '#c084fc',
  teal:   '#2dd4bf',

  /* chart grid */
  gridLine: 'rgba(0,0,0,0.06)',
};

const AVATAR_PALETTE = ['#5b8dee','#c084fc','#f472b6','#fbbf24','#34d399','#f87171'];
const ac = (i) => AVATAR_PALETTE[i % AVATAR_PALETTE.length];

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
const fmt     = (n) => { if (n==null) return '—'; if (n>=1e6) return `${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `${(n/1e3).toFixed(0)}k`; return String(Math.round(n)); };
const fmtRs   = (n) => n==null ? '—' : `Rs ${Number(n).toLocaleString()}`;
const initials= (s='') => s.trim().split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
const todayKey= () => new Date().toLocaleDateString('en-CA');
const todayLabel=() => new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

/* ─────────────────────────────────────────────────────────────
   INLINE ICONS
───────────────────────────────────────────────────────────── */
const Ic = {
  dollar:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  box:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  users:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  clock:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  arrowUp: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={10} height={10}><polyline points="18 15 12 9 6 15"/></svg>,
  arrowDn: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} width={10} height={10}><polyline points="6 9 12 15 18 9"/></svg>,
  bell:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={15} height={15}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  plus:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} width={14} height={14}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  refresh: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={14} height={14}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
};

const LiveDot = () => (
  <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:G.green,marginRight:5,animation:'livepulse 1.6s ease infinite'}} />
);

/* ─────────────────────────────────────────────────────────────
   GLASS CARD wrapper
───────────────────────────────────────────────────────────── */
function Card({ children, style={}, hover=false }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={()=>hover&&setH(true)}
      onMouseLeave={()=>hover&&setH(false)}
      style={{
        background: h ? G.glassMd : G.glass,
        border: `1px solid ${h ? G.glassBdHover : G.glassBd}`,
        borderRadius: 18,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'all 0.22s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────────────────────── */
function Sk({ w='100%', h=20, r=8 }) {
  return <div style={{width:w,height:h,borderRadius:r,background:'rgba(0,0,0,0.07)',animation:'shimmer 1.5s ease infinite'}} />;
}

/* ─────────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, badge, accentColor, sub, loading }) {
  const pos = badge && !String(badge).startsWith('-');
  if (loading) return (
    <Card style={{flex:1,minWidth:0,padding:'20px 22px'}}>
      <Sk h={34} r={10} w={34} /><div style={{height:14}}/>
      <Sk h={32} r={8} w="60%" /><div style={{height:6}}/>
      <Sk h={13} r={6} w="40%" />
    </Card>
  );
  return (
    <Card hover style={{flex:1,minWidth:0,padding:'20px 22px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{
          width:36,height:36,borderRadius:10,
          background:`${accentColor}22`,color:accentColor,
          display:'flex',alignItems:'center',justifyContent:'center',
          flexShrink:0,
        }}>{icon}</div>
        {badge && (
          <span style={{
            display:'flex',alignItems:'center',gap:3,
            fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:20,
            background: pos ? `${G.green}22` : `${G.red}22`,
            color: pos ? G.green : G.red,
          }}>
            {pos ? <Ic.arrowUp /> : <Ic.arrowDn />} {badge}
          </span>
        )}
        {sub && !badge && <span style={{fontSize:11,color:G.sub}}>{sub}</span>}
      </div>
      <div style={{marginTop:14}}>
        <div style={{fontSize:27,fontWeight:700,color:G.text,letterSpacing:'-0.5px',lineHeight:1.1}}>{value}</div>
        <div style={{fontSize:12,color:G.sub,marginTop:5}}>{label}</div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHIP BUTTON
───────────────────────────────────────────────────────────── */
function Chip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize:11,fontWeight:600,padding:'4px 11px',borderRadius:8,cursor:'pointer',
      background: active ? 'rgba(91,141,238,0.25)' : 'transparent',
      color: active ? G.blue : G.sub,
      border: active ? `1px solid rgba(91,141,238,0.4)` : `1px solid ${G.glassBd}`,
      transition:'all 0.18s',
    }}>{label}</button>
  );
}

/* ─────────────────────────────────────────────────────────────
   CUSTOM TOOLTIP
───────────────────────────────────────────────────────────── */
function ChartTip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:'rgba(255,255,255,0.92)',border:`1px solid ${G.glassBd}`,borderRadius:10,padding:'8px 12px',fontSize:12,backdropFilter:'blur(8px)'}}>
      <div style={{color:G.sub,marginBottom:3}}>{label}</div>
      <div style={{color:G.blue,fontWeight:700}}>{formatter ? formatter(payload[0]?.value) : payload[0]?.value}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SALES TREND CHART
───────────────────────────────────────────────────────────── */
function SalesTrend({ orders, loading }) {
  const [range, setRange] = useState('14D');

  const chartData = (() => {
    if (!orders.length) return [];
    const days = range === '14D' ? 14 : 30;
    const now = new Date();
    const map = {};
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate()-i);
      const key = d.toLocaleDateString('en-CA');
      map[key] = { date: d.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit'}), rev: 0 };
    }
    orders.forEach(o => {
      if (!o.createdAt) return;
      const key = new Date(o.createdAt).toLocaleDateString('en-CA');
      if (map[key]) map[key].rev += Number(o.total||0);
    });
    return Object.values(map);
  })();

  if (loading) return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <Sk h={18} w="35%" r={8}/><div style={{height:8}}/><Sk h={12} w="50%" r={6}/>
      <div style={{height:24}}/><Sk h={180} r={10}/>
    </Card>
  );

  return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:G.text}}>Sales Trend</div>
          <div style={{fontSize:12,color:G.sub,marginTop:3}}>Daily revenue · last {range==='14D'?14:30} days</div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {['14D','30D','MTD'].map(r=><Chip key={r} label={r} active={range===r} onClick={()=>setRange(r)}/>)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{top:6,right:6,bottom:0,left:-24}}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={G.blue} stopOpacity={0.25}/>
              <stop offset="95%" stopColor={G.blue} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={G.gridLine} vertical={false}/>
          <XAxis dataKey="date" tick={{fontSize:10,fill:G.muted}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
          <YAxis tick={{fontSize:10,fill:G.muted}} axisLine={false} tickLine={false} tickFormatter={fmt}/>
          <Tooltip content={<ChartTip formatter={fmtRs}/>}/>
          <Area type="monotone" dataKey="rev" stroke={G.blue} strokeWidth={2.2}
            fill="url(#revGrad)" dot={false} activeDot={{r:5,fill:G.blue,strokeWidth:0}}/>
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   ATTENDANCE TODAY
───────────────────────────────────────────────────────────── */
function AttendanceToday({ salesPersons, attendanceMap, loading }) {
  if (loading) return (
    <Card style={{width:340,flexShrink:0,padding:'22px 24px'}}>
      <Sk h={18} w="55%" r={8}/><div style={{height:20}}/>
      {[1,2,3,4,5].map(i=><div key={i} style={{marginBottom:12}}><Sk h={28} r={8}/></div>)}
    </Card>
  );

  const list = salesPersons.slice(0,6);
  const onlineCount = Object.values(attendanceMap).filter(a=>a.isOnline).length;

  return (
    <Card style={{width:340,flexShrink:0,padding:'22px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:G.text}}>Attendance Today</div>
          <div style={{fontSize:12,color:G.sub,marginTop:3}}>{onlineCount} of {salesPersons.length} online</div>
        </div>
        <span style={{display:'flex',alignItems:'center',fontSize:11,fontWeight:600,color:G.green,background:`${G.green}18`,padding:'3px 9px',borderRadius:20}}>
          <LiveDot/>Live
        </span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:11}}>
        {list.map((sp,i)=>{
          const att = attendanceMap[sp._id] || {};
          const isIn = att.isOnline;
          const time = att.checkInTime
            ? new Date(att.checkInTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})
            : null;
          const isLate = time && time > '09:30';
          const dotColor = isIn ? (isLate ? G.amber : G.green) : G.red;
          return (
            <div key={sp._id} style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{
                width:28,height:28,borderRadius:'50%',flexShrink:0,
                background:`${ac(i)}22`,color:ac(i),
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:10,fontWeight:700,
              }}>{initials(sp.name)}</div>
              <span style={{flex:1,fontSize:13,fontWeight:500,color:G.text,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sp.name}</span>
              <div style={{width:80,height:3,background:'rgba(0,0,0,0.08)',borderRadius:4,overflow:'hidden',flexShrink:0}}>
                <div style={{height:'100%',borderRadius:4,width:isIn?'75%':'20%',background:dotColor,transition:'width 0.4s ease'}}/>
              </div>
              {time && <span style={{fontSize:10,color:G.muted,fontFamily:'monospace',width:34,textAlign:'right'}}>{time}</span>}
              <span style={{
                fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:12,flexShrink:0,
                background:`${dotColor}22`,color:dotColor,
              }}>{isIn?(isLate?'Late':'In'):'Out'}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   RECENT ORDERS TABLE
───────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  Pending:    { bg:'rgba(251,191,36,0.15)',  color:'#fbbf24' },
  Processing: { bg:'rgba(91,141,238,0.15)',  color:'#5b8dee' },
  Final:      { bg:'rgba(52,211,153,0.15)',  color:'#34d399' },
  Cancelled:  { bg:'rgba(248,113,113,0.15)', color:'#f87171' },
  Confirmed:  { bg:'rgba(91,141,238,0.15)',  color:'#5b8dee' },
  Dispatched: { bg:'rgba(192,132,252,0.15)', color:'#c084fc' },
  Delivered:  { bg:'rgba(52,211,153,0.15)',  color:'#34d399' },
  Satelment:  { bg:'rgba(251,191,36,0.15)',  color:'#fbbf24' },
};

function RecentOrders({ orders, loading }) {
  const [filter, setFilter] = useState('All');
  const displayed = orders
    .filter(o => filter==='All' || o.status===filter)
    .slice(0,8);

  if (loading) return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <Sk h={18} w="35%" r={8}/><div style={{height:20}}/>
      {[1,2,3,4,5].map(i=><div key={i} style={{marginBottom:14}}><Sk h={24} r={7}/></div>)}
    </Card>
  );

  return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:G.text}}>Recent Orders</div>
          <div style={{fontSize:12,color:G.sub,marginTop:3}}>Latest across all salespersons</div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {['All','Pending','Processing','Confirmed'].map(t=><Chip key={t} label={t} active={filter===t} onClick={()=>setFilter(t)}/>)}
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{borderBottom:'1px solid rgba(0,0,0,0.05)'}}>
              {['ORDER','CUSTOMER','SALESPERSON','AMOUNT','DATE','STATUS'].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',fontSize:10,fontWeight:600,color:G.muted,letterSpacing:'.7px',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.length ? displayed.map((o,i)=>{
              const st = STATUS_STYLES[o.status] || {bg:'rgba(160,175,210,0.12)',color:G.sub};
              return (
                <tr key={o._id||i} style={{borderBottom:'1px solid rgba(0,0,0,0.04)',transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.02)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  <td style={{padding:'11px 10px',fontWeight:600,color:G.muted,fontFamily:'monospace',fontSize:12}}>
                    #{String(o._id||'').slice(-4).toUpperCase()}
                  </td>
                  <td style={{padding:'11px 10px',fontWeight:600,color:G.text}}>{o.RetailerUser?.name||'—'}</td>
                  <td style={{padding:'11px 10px',color:G.sub}}>{o.SaleUser?.name||'—'}</td>
                  <td style={{padding:'11px 10px',fontWeight:700,color:G.text}}>{fmtRs(o.total)}</td>
                  <td style={{padding:'11px 10px',color:G.muted,whiteSpace:'nowrap',fontSize:12}}>
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={{padding:'11px 10px'}}>
                    <span style={{...st,fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:20}}>{o.status}</span>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} style={{padding:'28px 10px',textAlign:'center',color:G.muted,fontSize:13}}>No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   RECOVERY SUMMARY
───────────────────────────────────────────────────────────── */
function RecoverySummary({ ledgerStats, loading }) {
  if (loading) return (
    <Card style={{width:300,flexShrink:0,padding:'22px 24px'}}>
      <Sk h={18} w="55%" r={8}/><div style={{height:20}}/>
      <div style={{display:'flex',justifyContent:'center'}}><Sk h={90} w={90} r={50}/></div>
      <div style={{height:16}}/>{[1,2,3].map(i=><div key={i} style={{marginBottom:10}}><Sk h={16} r={6}/></div>)}
    </Card>
  );

  const { approved=0, pending=0, rejected=0, totalRecovered=0, pendingAmt=0, total=0 } = ledgerStats;
  const pieData = [
    { name:'Approved', value:approved, color:G.green },
    { name:'Pending',  value:pending,  color:G.amber },
    { name:'Rejected', value:rejected, color:G.red },
  ].filter(d=>d.value>0);
  const pct = v => total>0 ? Math.round((v/total)*100) : 0;

  return (
    <Card style={{width:300,flexShrink:0,padding:'22px 24px'}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:15,fontWeight:700,color:G.text}}>Recovery Summary</div>
        <div style={{fontSize:12,color:G.sub,marginTop:3}}>
          {new Date().toLocaleString('en-US',{month:'long',year:'numeric'})}
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:18}}>
        <div style={{position:'relative',flexShrink:0}}>
          <PieChart width={80} height={80}>
            <Pie data={pieData.length?pieData:[{value:1,color:'rgba(0,0,0,0.07)'}]}
              cx={38} cy={38} innerRadius={26} outerRadius={38}
              dataKey="value" strokeWidth={0} paddingAngle={pieData.length>1?3:0}>
              {(pieData.length?pieData:[{color:'rgba(0,0,0,0.07)'}]).map((d,i)=>(
                <Cell key={i} fill={d.color}/>
              ))}
            </Pie>
          </PieChart>
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <span style={{fontSize:14,fontWeight:700,color:G.text}}>{pct(approved)}%</span>
            <span style={{fontSize:9,color:G.muted,letterSpacing:'.5px'}}>coll.</span>
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {[
            {label:'Approved',val:`${pct(approved)}%`,color:G.green},
            {label:'Pending', val:`${pct(pending)}%`, color:G.amber},
            {label:'Rejected',val:`${pct(rejected)}%`,color:G.red},
          ].map(({label,val,color})=>(
            <span key={label} style={{display:'flex',alignItems:'center',gap:7,fontSize:12}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:color,flexShrink:0}}/>
              <span style={{color:G.sub,minWidth:52}}>{label}</span>
              <span style={{color:G.text,fontWeight:600,marginLeft:'auto'}}>{val}</span>
            </span>
          ))}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:9,borderTop:'1px solid rgba(0,0,0,0.07)',paddingTop:14}}>
        {[
          {label:'Total Recovered', val:fmtRs(totalRecovered), color:G.green},
          {label:'Pending Amount',  val:fmtRs(pendingAmt),     color:G.amber},
          {label:'Total Entries',   val:String(total),          color:G.text},
        ].map(({label,val,color})=>(
          <div key={label} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
            <span style={{color:G.sub}}>{label}</span>
            <span style={{fontWeight:600,color}}>{val}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   SALESPERSON PERFORMANCE
───────────────────────────────────────────────────────────── */
function SalespersonPerformance({ salesPersons, orders, loading }) {
  const [range, setRange] = useState('MTD');

  const perf = (() => {
    if (!orders.length) return [];
    const now = new Date();
    const filtered = range === 'Weekly'
      ? orders.filter(o => {
          if (!o.createdAt) return false;
          const d = new Date(o.createdAt);
          const diff = (now - d) / (1000*60*60*24);
          return diff <= 7;
        })
      : orders.filter(o => {
          if (!o.createdAt) return false;
          const d = new Date(o.createdAt);
          return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
        });
    const map = {};
    filtered.forEach(o => {
      const id = o.SaleUser?._id;
      const name = o.SaleUser?.name;
      if (!id||!name) return;
      if (!map[id]) map[id] = { id, name, revenue:0, orderCount:0 };
      map[id].revenue += Number(o.total||0);
      map[id].orderCount++;
    });
    return Object.values(map).sort((a,b)=>b.revenue-a.revenue).slice(0,6);
  })();

  if (loading) return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <Sk h={18} w="45%" r={8}/><div style={{height:20}}/>
      {[1,2,3,4,5].map(i=><div key={i} style={{marginBottom:14}}><Sk h={36} r={10}/></div>)}
    </Card>
  );

  const topRev = perf[0]?.revenue || 1;

  return (
    <Card style={{flex:1,padding:'22px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:G.text}}>Salesperson Performance</div>
          <div style={{fontSize:12,color:G.sub,marginTop:3}}>Ranked by revenue</div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {['MTD','Weekly'].map(r=><Chip key={r} label={r} active={range===r} onClick={()=>setRange(r)}/>)}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {perf.length ? perf.map((sp,i)=>(
          <div key={sp.id} style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:12,fontWeight:600,color:G.muted,width:16,flexShrink:0}}>{i+1}</span>
            <div style={{
              width:30,height:30,borderRadius:'50%',flexShrink:0,
              background:`${ac(i)}22`,color:ac(i),
              display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:10,fontWeight:700,
            }}>{initials(sp.name)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sp.name}</div>
              <div style={{fontSize:11,color:G.muted}}>{sp.orderCount} orders</div>
            </div>
            <div style={{width:100,height:3,background:'rgba(0,0,0,0.07)',borderRadius:4,overflow:'hidden',flexShrink:0}}>
              <div style={{
                height:'100%',borderRadius:4,
                width:`${Math.round((sp.revenue/topRev)*100)}%`,
                background:ac(i),transition:'width 0.5s ease',
              }}/>
            </div>
            <div style={{textAlign:'right',minWidth:90,flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:700,color:G.text}}>{fmtRs(sp.revenue)}</div>
            </div>
          </div>
        )) : (
          <div style={{textAlign:'center',color:G.muted,fontSize:13,padding:'24px 0'}}>No data for this period</div>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   LIVE ACTIVITY
───────────────────────────────────────────────────────────── */
function LiveActivity({ orders, attendanceMap, salesPersons, loading }) {
  if (loading) return (
    <Card style={{width:300,flexShrink:0,padding:'22px 24px'}}>
      <Sk h={18} w="50%" r={8}/><div style={{height:20}}/>
      {[1,2,3,4,5].map(i=><div key={i} style={{marginBottom:14}}><Sk h={40} r={8}/></div>)}
    </Card>
  );

  const spMap = {};
  salesPersons.forEach(sp => { spMap[sp._id] = sp.name; });

  const events = [];
  orders.slice(0,5).forEach(o => {
    events.push({
      type:'order',
      text:`Order #${String(o._id||'').slice(-4).toUpperCase()} placed`,
      sub:`${o.RetailerUser?.name||'Customer'} · ${fmtRs(o.total)}`,
      time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}) : '—',
      color: G.blue,
    });
  });
  Object.entries(attendanceMap).slice(0,4).forEach(([id,att])=>{
    if (att?.checkInTime) events.push({
      type:'checkin',
      text:`${att.name||spMap[id]||'Sales Person'} checked in`,
      sub:`Field · ${att.city||'—'}`,
      time: new Date(att.checkInTime).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}),
      color: G.green,
    });
  });
  events.sort((a,b)=> b.time > a.time ? 1 : -1);

  return (
    <Card style={{width:300,flexShrink:0,padding:'22px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:G.text}}>Live Activity</div>
          <div style={{fontSize:12,color:G.sub,marginTop:3}}>Real-time field updates</div>
        </div>
        <span style={{display:'flex',alignItems:'center',fontSize:11,fontWeight:600,color:G.green,background:`${G.green}18`,padding:'3px 9px',borderRadius:20}}>
          <LiveDot/>Live
        </span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:0}}>
        {events.length ? events.slice(0,6).map((ev,i)=>(
          <div key={i} style={{
            display:'flex',gap:10,paddingBottom:12,
            borderBottom: i<Math.min(events.length,6)-1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
            marginBottom:12,
          }}>
            <div style={{
              width:7,height:7,borderRadius:'50%',background:ev.color,
              flexShrink:0,marginTop:5,
              boxShadow:`0 0 8px ${ev.color}88`,
            }}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text}}>{ev.text}</div>
              <div style={{fontSize:11,color:G.muted,marginTop:2}}>{ev.sub}</div>
            </div>
            <div style={{fontSize:10,color:G.muted,flexShrink:0,fontFamily:'monospace',paddingTop:1}}>{ev.time}</div>
          </div>
        )) : (
          <div style={{textAlign:'center',color:G.muted,fontSize:13,padding:'24px 0'}}>No recent activity</div>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOT DASHBOARD
───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const [loading,    setLoading]    = useState(true);
  const [orders,     setOrders]     = useState([]);
  const [salesPersons,setSalesPersons] = useState([]);
  const [attendanceMap,setAttendanceMap] = useState({});
  const [ledgerStats, setLedgerStats] = useState({ approved:0,pending:0,rejected:0,totalRecovered:0,pendingAmt:0,total:0 });
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const fetchAll = useCallback(async (silent=false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      /* ── 1. Orders ── */
      let allOrders = [];
      try {
        const or = await getOrders(1, 200);
        allOrders = or?.data?.data ?? [];
        setOrders(allOrders);
      } catch(e) { console.warn('Orders fetch failed', e); }

      /* ── 2. Sales persons ── */
      let sps = [];
      try {
        const sp = await getAllSalesPersons();
        sps = sp?.data?.data ?? [];
        setSalesPersons(sps);
      } catch(e) { console.warn('SalesPersons fetch failed', e); }

      /* ── 3. Attendance (parallel per SP) ── */
      if (sps.length) {
        const results = await Promise.allSettled(
          sps.slice(0,15).map(async (sp) => {
            try {
              const res = await getAttendanceBySalesId(sp._id, 1);
              const records = res?.data?.data ?? [];
              const tKey = todayKey();
              const todays = records.filter(r =>
                r.date === tKey ||
                (r.checkInTime && new Date(r.checkInTime).toLocaleDateString('en-CA') === tKey)
              );
              if (!todays.length) return [sp._id, { isOnline:false, name:sp.name }];
              const latest = todays.reduce((a,b)=>
                new Date(a.checkInTime||0) >= new Date(b.checkInTime||0) ? a : b
              );
              return [sp._id, {
                isOnline: Boolean(latest?.checkInTime) && (!latest?.checkOutTime || latest.checkOutTime===''),
                checkInTime: latest?.checkInTime,
                name: sp.name,
                city: sp.city?.name || sp.city || '',
              }];
            } catch { return [sp._id, { isOnline:false, name:sp.name }]; }
          })
        );
        const map = {};
        results.forEach(r => { if (r.status==='fulfilled' && r.value) map[r.value[0]] = r.value[1]; });
        setAttendanceMap(map);
      }

      /* ── 4. Retailer ledgers ── */
      try {
        const ret = await getAllRetailers();
        const retList = ret?.data?.data ?? [];
        const ledgerResults = await Promise.allSettled(
          retList.slice(0,15).map(r => getRetailerLedgerById(r._id))
        );
        let approved=0, pending=0, rejected=0, totalRecovered=0, pendingAmt=0, total=0;
        ledgerResults.forEach(r => {
          if (r.status!=='fulfilled') return;
          const ledgers = r.value?.data?.data ?? r.value?.ledgers ?? [];
          ledgers.forEach(l => {
            total++;
            if (l.isRejected) { rejected++; }
            else if (l.isApproved===false) { pending++; pendingAmt += Number(l.amount||0); }
            else { approved++; totalRecovered += Number(l.amount||0); }
          });
        });
        setLedgerStats({ approved, pending, rejected, totalRecovered, pendingAmt, total });
      } catch(e) { console.warn('Ledger fetch failed', e); }

      setLastRefresh(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Derived stat card values ── */
  const tKey = todayKey();
  const todayOrders = orders.filter(o => o.createdAt && new Date(o.createdAt).toLocaleDateString('en-CA')===tKey);
  const todaySales  = todayOrders.reduce((s,o)=>s+Number(o.total||0),0);
  const onlineCount = Object.values(attendanceMap).filter(a=>a.isOnline).length;
  const totalSPs    = salesPersons.length;
  const attPct      = totalSPs > 0 ? Math.round((onlineCount/totalSPs)*100) : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        button { font-family: inherit; }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes livepulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .sp-dash { animation: fadein 0.3s ease both; }
        .sp-dash ::-webkit-scrollbar { width:3px; height:3px; }
        .sp-dash ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px; }
        .sp-row:hover { background: rgba(0,0,0,0.03) !important; }
      `}</style>

      <div className="sp-dash" style={{
        fontFamily:"'DM Sans','Segoe UI',sans-serif",
        background: 'transparent',
        color: G.text,
        minHeight: '100vh',
        padding: '24px 28px 56px',
      }}>

        {/* ── Top bar ── */}
        <div style={{
          display:'flex',justifyContent:'space-between',alignItems:'center',
          marginBottom:26,
        }}>
          <div>
            <div style={{fontSize:22,fontWeight:700,color:G.text,letterSpacing:'-0.3px'}}>Dashboard</div>
            <div style={{fontSize:12,color:G.sub,marginTop:4,display:'flex',alignItems:'center',gap:6}}>
              <span>{todayLabel()}</span>
              {lastRefresh && (
                <span style={{color:G.muted}}>
                  · Updated {lastRefresh.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})}
                </span>
              )}
            </div>
          </div>
          
        </div>

        {/* ── Stat Cards ── */}
        <div style={{display:'flex',gap:14,marginBottom:20,flexWrap:'wrap'}}>
          <StatCard loading={loading} icon={<Ic.dollar/>}  label="Today's Sales"       value={fmtRs(todaySales)}                  badge="+12%"        accentColor={G.blue}/>
          <StatCard loading={loading} icon={<Ic.box/>}     label="Orders Today"         value={String(todayOrders.length)}          badge="+5%"         accentColor={G.purple}/>
          <StatCard loading={loading} icon={<Ic.users/>}   label="Attendance Today"     value={`${onlineCount} / ${totalSPs}`}      sub={`${attPct}%`}  accentColor={G.green}/>
          <StatCard loading={loading} icon={<Ic.clock/>}   label="Pending Recovery"     value={fmtRs(ledgerStats.pendingAmt)}       badge="+3%"         accentColor={G.amber}/>
        </div>

        {/* ── Sales Trend + Attendance ── */}
        <div style={{display:'flex',gap:16,marginBottom:18,alignItems:'stretch',flexWrap:'wrap'}}>
          <SalesTrend orders={orders} loading={loading}/>
          <AttendanceToday salesPersons={salesPersons} attendanceMap={attendanceMap} loading={loading}/>
        </div>

        {/* ── Recent Orders + Recovery ── */}
        <div style={{display:'flex',gap:16,marginBottom:18,alignItems:'stretch',flexWrap:'wrap'}}>
          <RecentOrders orders={orders} loading={loading}/>
          <RecoverySummary ledgerStats={ledgerStats} loading={loading}/>
        </div>

        {/* ── Performance + Live Activity ── */}
        <div style={{display:'flex',gap:16,alignItems:'stretch',flexWrap:'wrap'}}>
          <SalespersonPerformance salesPersons={salesPersons} orders={orders} loading={loading}/>
          <LiveActivity orders={orders} attendanceMap={attendanceMap} salesPersons={salesPersons} loading={loading}/>
        </div>

      </div>
    </>
  );
}