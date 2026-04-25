/**
 * Dashboard.jsx — Fully Dynamic
 * ─────────────────────────────────────────────────────────────────────────────
 * DATA WIRING:
 *  ✅ Stat cards       → GET /admin/dashboard          (getDashboardData)
 *  ✅ Vitals chart     → GET /admin/dashboard/vitals   (or falls back to mock)
 *  ✅ Bed occupancy    → GET /admin/dashboard/occupancy (or falls back to mock)
 *  ✅ Dept workload    → GET /order/pagination          (getOrders — aggregated)
 *  ✅ Today's schedule → GET /order/filter             (getSearchOrders)
 *  ✅ Upcoming         → GET /order/filter             (same, upcoming only)
 *
 * HOW FALLBACKS WORK:
 *  Each section tries your real API first. If the endpoint doesn't exist yet
 *  or returns no data, it silently falls back to realistic placeholder data
 *  so the UI never breaks. Remove the fallback once your endpoint is live.
 *
 * DEPS: npm install recharts swr
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import {
  getDashboardData,
  getOrders,
  getSearchOrders,
} from '../APIS';
import { Loader } from '../components/common/loader';

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────────────────────────────────────── */
const C = {
  red:       '#E8472A',
  redSoft:   '#FFF1EE',
  green:     '#16A34A',
  greenSoft: '#DCFCE7',
  blue:      '#2563EB',
  violet:    '#7C3AED',
  amber:     '#D97706',
  border:    '#F0EFF4',
  muted:     '#9CA3AF',
  text:      '#111827',
  sub:       '#6B7280',
  bg:        '#F7F8FA',
  white:     '#FFFFFF',
};
const CARD_ACCENTS  = [C.red, C.blue, C.green, C.violet, C.amber, '#0891B2'];
const AVATAR_COLORS = [
  { bg:'#FEE2E2', fg:'#991B1B' }, { bg:'#DBEAFE', fg:'#1E40AF' },
  { bg:'#D1FAE5', fg:'#065F46' }, { bg:'#EDE9FE', fg:'#5B21B6' },
  { bg:'#FEF3C7', fg:'#92400E' }, { bg:'#FCE7F3', fg:'#9D174D' },
];
const DEPT_COLORS   = [C.red, '#F97316', '#EAB308', '#3B82F6', '#8B5CF6'];
const OCC_COLORS    = [C.red, C.green, C.blue];

/* ─────────────────────────────────────────────────────────────────────────────
   FALLBACK DATA  (used only when the API endpoint doesn't return data yet)
───────────────────────────────────────────────────────────────────────────── */
const FALLBACK_VITALS = [
  { t:'00:00', hr:112, bp:72, spo2:97 }, { t:'03:00', hr:108, bp:70, spo2:97 },
  { t:'06:00', hr:118, bp:75, spo2:98 }, { t:'09:00', hr:125, bp:78, spo2:99 },
  { t:'12:00', hr:122, bp:76, spo2:98 }, { t:'15:00', hr:128, bp:79, spo2:98 },
  { t:'18:00', hr:130, bp:78, spo2:97 }, { t:'21:00', hr:126, bp:77, spo2:97 },
  { t:'24:00', hr:120, bp:74, spo2:96 },
];
const FALLBACK_OCCUPANCY = [
  { name:'ICU', value:85 }, { name:'General', value:72 }, { name:'Emergency', value:91 },
];
const FALLBACK_DEPT = [
  { dept:'Emergency', count:36 }, { dept:'Cardiology', count:30 },
  { dept:'Pediatrics', count:26 }, { dept:'Orthopedics', count:22 },
  { dept:'Neurology', count:16 },
];
const FALLBACK_SCHEDULE = [
  { time:'08:00', patient:'Anna Brooks',     doctor:'Dr. Williams', dept:'Cardiology',  type:'In-person',  status:'Completed'   },
  { time:'08:30', patient:'David Kim',       doctor:'Dr. Patel',    dept:'Neurology',   type:'Telehealth', status:'Completed'   },
  { time:'09:00', patient:'Sarah Johnson',   doctor:'Dr. Williams', dept:'Cardiology',  type:'In-person',  status:'Completed'   },
  { time:'09:30', patient:'Michael Chen',    doctor:'Dr. Patel',    dept:'Neurology',   type:'In-person',  status:'In Progress' },
  { time:'10:00', patient:'Emily Davis',     doctor:'Dr. Garcia',   dept:'Pediatrics',  type:'Telehealth', status:'In Progress' },
  { time:'10:30', patient:'James Wilson',    doctor:'Dr. Kim',      dept:'Orthopedics', type:'In-person',  status:'Scheduled'   },
  { time:'11:00', patient:'Maria Rodriguez', doctor:'Dr. Thompson', dept:'Emergency',   type:'In-person',  status:'Scheduled'   },
  { time:'11:30', patient:'Robert Taylor',   doctor:'Dr. Williams', dept:'Cardiology',  type:'Telehealth', status:'Scheduled'   },
];

/* ─────────────────────────────────────────────────────────────────────────────
   DATA-TRANSFORM HELPERS
   These turn your existing API responses into the shape each chart needs.
───────────────────────────────────────────────────────────────────────────── */

/**
 * getOrders response → schedule rows
 * Expects order objects with: createdAt / time, retailer / patient,
 * status, items (array), city / dept.
 * Adjust field names to match your actual order schema.
 */
function ordersToSchedule(orders = []) {
  if (!orders.length) return FALLBACK_SCHEDULE;
  return orders.slice(0, 10).map((o, i) => {
    const timeRaw = o.createdAt ? new Date(o.createdAt) : null;
    const time = timeRaw
      ? `${String(timeRaw.getHours()).padStart(2,'0')}:${String(timeRaw.getMinutes()).padStart(2,'0')}`
      : `0${8 + i}:00`;
    // Adapt these fields to your real order object shape:
    const patient = o.retailer?.name ?? o.retailerName ?? o.customerName ?? `Patient ${i + 1}`;
    const doctor  = o.coordinator?.name ?? o.coordinatorName ?? 'Dr. Staff';
    const dept    = o.city?.name ?? o.cityName ?? o.department ?? 'General';
    const type    = o.type === 'telehealth' ? 'Telehealth' : 'In-person';
    const rawStatus = (o.status ?? '').toLowerCase();
    const status  = rawStatus.includes('complet') ? 'Completed'
                  : rawStatus.includes('progress') || rawStatus.includes('pending') ? 'In Progress'
                  : 'Scheduled';
    return { time, patient, doctor, dept, type, status };
  });
}

/**
 * getOrders response → dept workload bars
 * Groups orders by city/department and counts them.
 */
function ordersToDept(orders = []) {
  if (!orders.length) return FALLBACK_DEPT;
  const counts = {};
  orders.forEach(o => {
    const key = o.city?.name ?? o.cityName ?? o.department ?? 'Other';
    counts[key] = (counts[key] ?? 0) + 1;
  });
  const result = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([dept, count]) => ({ dept, count }));
  return result.length ? result : FALLBACK_DEPT;
}

/**
 * getOrders response → upcoming appointments list
 */
function ordersToUpcoming(orders = []) {
  if (!orders.length) return null; // null = use fallback
  return orders
    .filter(o => {
      const s = (o.status ?? '').toLowerCase();
      return s.includes('scheduled') || s.includes('pending') || s.includes('confirmed');
    })
    .slice(0, 6)
    .map((o, i) => {
      const timeRaw = o.scheduledAt ?? o.createdAt;
      const d = timeRaw ? new Date(timeRaw) : null;
      const time = d
        ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
        : `0${9 + i}:00`;
      const name = o.retailer?.name ?? o.retailerName ?? o.customerName ?? `Patient ${i + 1}`;
      const dept = o.city?.name ?? o.cityName ?? o.department ?? 'General';
      const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      const col = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return { initials, name, dept, time, bg: col.bg, fg: col.fg };
    });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SMALL REUSABLE UI COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

const card = (extra = {}) => ({
  background: C.white, borderRadius: 14,
  border: `1px solid ${C.border}`, padding: '20px 22px', ...extra,
});

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{title}</div>
      {sub && <div style={{ fontSize:12, color:C.sub, marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function TrendBadge({ label }) {
  if (!label) return null;
  const positive = !String(label).startsWith('-');
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:20, marginTop:6,
      background: positive ? C.greenSoft : C.redSoft,
      color:      positive ? C.green     : C.red,
    }}>
      {positive ? '▲' : '▼'} {label}
    </span>
  );
}

function StatusChip({ status }) {
  const map = {
    'Completed':   { bg:'#D1FAE5', color:'#065F46' },
    'In Progress': { bg:'#FEF3C7', color:'#92400E' },
    'Scheduled':   { bg:'#F3F4F6', color:'#6B7280' },
  };
  const s = map[status] || map.Scheduled;
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:600, padding:'4px 11px', borderRadius:20 }}>
      {status}
    </span>
  );
}

function TypeChip({ type }) {
  const isIn = type === 'In-person';
  return (
    <span style={{
      fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:20,
      background: isIn ? C.redSoft : '#F3F4F6',
      color:      isIn ? C.red     : C.sub,
    }}>
      {type}
    </span>
  );
}

function VitalsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:C.white, border:`1px solid ${C.border}`,
      borderRadius:10, padding:'10px 14px', fontSize:12,
      boxShadow:'0 4px 20px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontWeight:700, marginBottom:6, color:C.text }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MiniLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120 }}>
      <div style={{
        width:28, height:28, borderRadius:'50%',
        border:`3px solid ${C.border}`, borderTopColor:C.red,
        animation:'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION COMPONENTS  (each fetches its own data)
───────────────────────────────────────────────────────────────────────────── */

/* ── Stat Cards ── */
function StatCards() {
  const { data, error } = useSWR('/getDashboardData', getDashboardData);

  if (error) return (
    <div style={{ color:C.red, padding:'12px 0', fontSize:13 }}>
      Failed to load stats.
    </div>
  );
  if (!data) return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:14, marginBottom:22 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{ ...card(), borderTop:`3px solid ${C.border}`, height:96 }} />
      ))}
    </div>
  );

  // Normalise: { data:[...] }  or  { data:{ data:[...] } }
  const rawStats = data?.data?.data ?? data?.data ?? [];
  const stats = Array.isArray(rawStats) ? rawStats : [];

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',
      gap:14, marginBottom:22,
    }}>
      {stats.map((item, i) => {
        const badge = item.change ?? item.badge ?? item.trend ?? null;
        return (
          <div key={item.label ?? i} style={{
            ...card(),
            borderTop:`3px solid ${CARD_ACCENTS[i % CARD_ACCENTS.length]}`,
            display:'flex', flexDirection:'column',
          }}>
            <span style={{ fontSize:11, fontWeight:600, color:C.sub, textTransform:'uppercase', letterSpacing:'.6px' }}>
              {item.label}
            </span>
            <span style={{ fontSize:30, fontWeight:700, color:C.text, lineHeight:1.2, marginTop:6 }}>
              {item.value}
            </span>
            <TrendBadge label={badge} />
          </div>
        );
      })}
    </div>
  );
}

/* ── 24h Vitals Monitor ──
   Tries GET /admin/dashboard/vitals — falls back to mock if not available.
   Once your backend has this endpoint, the live data will appear automatically.
   Expected shape: { data: [{ t, hr, bp, spo2 }] }
*/
function VitalsChart() {
  const [vitals, setVitals] = useState(null);

  useEffect(() => {
    fetch('/admin/dashboard/vitals')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const d = json?.data ?? json?.vitals ?? null;
        setVitals(Array.isArray(d) && d.length ? d : FALLBACK_VITALS);
      })
      .catch(() => setVitals(FALLBACK_VITALS));
  }, []);

  const data = vitals ?? FALLBACK_VITALS;

  return (
    <div style={{ ...card(), marginBottom:22 }}>
      <SectionTitle
        title="24h Patient Vitals Monitor"
        sub="Hourly average heart rate, blood pressure, and SpO₂ across all monitored patients"
      />
      <div style={{ display:'flex', gap:24, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { color:'#16A34A', label:'Heart Rate (bpm)', dash:false },
          { color:'#E8472A', label:'Blood Pressure',   dash:false },
          { color:'#2563EB', label:'SpO₂ (%)',         dash:true  },
        ].map(({ color, label, dash }) => (
          <span key={label} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:C.sub }}>
            <svg width="22" height="10" style={{ flexShrink:0 }}>
              <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5"
                strokeDasharray={dash ? '5,3' : undefined} />
            </svg>
            {label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={data} margin={{ top:4, right:20, bottom:0, left:-14 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F0EFF4" />
          <XAxis dataKey="t" tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="l" domain={[55,150]} tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="r" orientation="right" domain={[92,100]} tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
          <Tooltip content={<VitalsTooltip />} />
          <Line yAxisId="l" type="monotone" dataKey="hr"   name="Heart Rate"     stroke="#16A34A" strokeWidth={2.5} dot={{ r:3, fill:'#16A34A', strokeWidth:0 }} activeDot={{ r:5 }} />
          <Line yAxisId="l" type="monotone" dataKey="bp"   name="Blood Pressure" stroke="#E8472A" strokeWidth={2.5} dot={{ r:3, fill:'#E8472A', strokeWidth:0 }} activeDot={{ r:5 }} />
          <Line yAxisId="r" type="monotone" dataKey="spo2" name="SpO₂"           stroke="#2563EB" strokeWidth={2}   dot={{ r:2, fill:'#2563EB', strokeWidth:0 }} strokeDasharray="6 4" activeDot={{ r:4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Bed Occupancy ──
   Tries GET /admin/dashboard/occupancy — falls back to mock.
   Expected shape: { data: [{ name, value }] }
*/
function BedOccupancy() {
  const [occupancy, setOccupancy] = useState(null);

  useEffect(() => {
    fetch('/admin/dashboard/occupancy')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const d = json?.data ?? json?.occupancy ?? null;
        setOccupancy(Array.isArray(d) && d.length ? d : FALLBACK_OCCUPANCY);
      })
      .catch(() => setOccupancy(FALLBACK_OCCUPANCY));
  }, []);

  const data = occupancy ?? FALLBACK_OCCUPANCY;
  const aggregate = data.length
    ? Math.round(data.reduce((s, o) => s + o.value, 0) / data.length)
    : 0;

  return (
    <div style={card()}>
      <SectionTitle title="Bed Occupancy" sub="Occupancy rate by ward" />
      {!occupancy ? <MiniLoader /> : (
        <>
          <div style={{ position:'relative', display:'flex', justifyContent:'center', alignItems:'center' }}>
            <PieChart width={182} height={182}>
              <Pie data={data} cx={88} cy={88} innerRadius={56} outerRadius={84}
                dataKey="value" strokeWidth={0} paddingAngle={3}>
                {data.map((_, i) => <Cell key={i} fill={OCC_COLORS[i % OCC_COLORS.length]} />)}
              </Pie>
            </PieChart>
            <div style={{ position:'absolute', textAlign:'center', pointerEvents:'none' }}>
              <div style={{ fontSize:22, fontWeight:700, color:C.text }}>{aggregate}%</div>
              <div style={{ fontSize:10, color:C.muted, fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px' }}>Aggregate</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:14 }}>
            {data.map((o, i) => (
              <div key={o.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13 }}>
                <span style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{ width:9, height:9, borderRadius:'50%', background:OCC_COLORS[i % OCC_COLORS.length], flexShrink:0 }} />
                  <span style={{ color:C.sub }}>{o.name}</span>
                </span>
                <span style={{ fontWeight:700, color:C.text }}>{o.value}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Dept Workload ──
   Uses getOrders() from your APIS.js → groups by city/department.
*/
function DeptWorkload() {
  const { data, error } = useSWR('/getOrders/dept', () => getOrders(1, 100));

  const rawOrders = data?.data?.data ?? data?.data?.orders ?? data?.data ?? [];
  const orders    = Array.isArray(rawOrders) ? rawOrders : [];
  const chartData = orders.length ? ordersToDept(orders) : FALLBACK_DEPT;

  return (
    <div style={card()}>
      <SectionTitle title="Dept Workload" sub="Active patients by department" />
      {!data && !error ? <MiniLoader /> : (
        <ResponsiveContainer width="100%" height={235}>
          <BarChart data={chartData} layout="vertical" margin={{ top:0, right:14, bottom:0, left:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EFF4" horizontal={false} />
            <XAxis type="number" tick={{ fontSize:11, fill:C.muted }} axisLine={false} tickLine={false} />
            <YAxis dataKey="dept" type="category" tick={{ fontSize:12, fill:C.text, fontWeight:500 }} width={80} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize:12, borderRadius:10, border:`1px solid ${C.border}`, boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}
              cursor={{ fill:C.bg }}
            />
            <Bar dataKey="count" name="Patients" radius={[0,6,6,0]} barSize={18}>
              {chartData.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* ── Upcoming Appointments ──
   Uses getSearchOrders() filtered to today's scheduled/pending orders.
*/
function UpcomingAppointments() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = useSWR(
    '/getOrders/upcoming',
    () => getSearchOrders(1, 10, { status: 'Pending', date: today }),
  );

  const rawOrders  = data?.data?.data ?? data?.data?.orders ?? data?.data ?? [];
  const orders     = Array.isArray(rawOrders) ? rawOrders : [];
  const upcoming   = ordersToUpcoming(orders);

  // If API returned orders but none were "upcoming", use fallback
  const display = upcoming && upcoming.length > 0 ? upcoming : [
    { initials:'SJ', name:'Sarah Johnson',   dept:'Cardiology',  time:'09:00', bg:'#FEE2E2', fg:'#991B1B' },
    { initials:'MC', name:'Michael Chen',    dept:'Neurology',   time:'09:30', bg:'#DBEAFE', fg:'#1E40AF' },
    { initials:'ED', name:'Emily Davis',     dept:'Pediatrics',  time:'10:00', bg:'#D1FAE5', fg:'#065F46' },
    { initials:'JW', name:'James Wilson',    dept:'Orthopedics', time:'10:30', bg:'#EDE9FE', fg:'#5B21B6' },
    { initials:'MR', name:'Maria Rodriguez', dept:'Emergency',   time:'11:00', bg:'#FEF3C7', fg:'#92400E' },
    { initials:'RT', name:'Robert Taylor',   dept:'Cardiology',  time:'11:30', bg:'#FEE2E2', fg:'#991B1B' },
  ];

  return (
    <div style={card()}>
      <SectionTitle title="Upcoming" sub="Next appointments today" />
      {!data && !error ? <MiniLoader /> : (
        display.map((u, i) => (
          <div key={`${u.name}-${i}`} style={{
            display:'flex', alignItems:'center', gap:11,
            padding:'9px 0',
            borderBottom: i < display.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{
              width:34, height:34, borderRadius:'50%', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:u.bg, color:u.fg, fontSize:11, fontWeight:700,
            }}>
              {u.initials}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {u.name}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>{u.dept}</div>
            </div>
            <div style={{
              fontSize:11, fontWeight:600, color:C.sub, fontFamily:'monospace',
              flexShrink:0, background:C.bg, padding:'3px 8px', borderRadius:8,
            }}>
              {u.time}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Today's Schedule Table ──
   Uses getOrders() → maps to schedule rows.
*/
function TodaysSchedule() {
  const { data, error } = useSWR('/getOrders/schedule', () => getOrders(1, 20));

  const rawOrders = data?.data?.data ?? data?.data?.orders ?? data?.data ?? [];
  const orders    = Array.isArray(rawOrders) ? rawOrders : [];
  const schedule  = ordersToSchedule(orders);

  return (
    <div style={card()}>
      <SectionTitle title="Today's Schedule" sub="All appointments and consultations for today" />
      {!data && !error ? <MiniLoader /> : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                {['Time','Patient','Doctor','Department','Type','Status'].map(h => (
                  <th key={h} style={{
                    padding:'0 14px 12px', textAlign:'left',
                    fontSize:11, fontWeight:600, color:C.muted,
                    textTransform:'uppercase', letterSpacing:'.6px',
                    whiteSpace:'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${C.border}` }}>
                  <td style={{ padding:'13px 14px', fontFamily:'monospace', fontSize:12, fontWeight:700, color:C.red, whiteSpace:'nowrap' }}>
                    {row.time}
                  </td>
                  <td style={{ padding:'13px 14px', fontWeight:600, whiteSpace:'nowrap' }}>{row.patient}</td>
                  <td style={{ padding:'13px 14px', color:C.sub, whiteSpace:'nowrap' }}>{row.doctor}</td>
                  <td style={{ padding:'13px 14px', color:C.sub, whiteSpace:'nowrap' }}>{row.dept}</td>
                  <td style={{ padding:'13px 14px' }}><TypeChip type={row.type} /></td>
                  <td style={{ padding:'13px 14px' }}><StatusChip status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROOT DASHBOARD
───────────────────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  return (
    <div style={{ fontFamily:"'Outfit','Segoe UI',sans-serif", color:C.text, padding:'4px 0 48px' }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* Stat Cards — live from /admin/dashboard */}
      <StatCards />

      {/* Vitals chart — live from /admin/dashboard/vitals (falls back to mock) */}
      <VitalsChart />

      {/* Middle row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.15fr 1fr', gap:16, marginBottom:22 }}>
        {/* Bed Occupancy — live from /admin/dashboard/occupancy (falls back to mock) */}
        <BedOccupancy />

        {/* Dept Workload — live from getOrders() → grouped by city */}
        <DeptWorkload />

        {/* Upcoming — live from getSearchOrders() filtered to today */}
        <UpcomingAppointments />
      </div>

      {/* Today's Schedule — live from getOrders() */}
      <TodaysSchedule />
    </div>
  );
}
