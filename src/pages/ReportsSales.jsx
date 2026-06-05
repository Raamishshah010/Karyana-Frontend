import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrders, getAllSalesPersons, getAllCities } from '../APIS';
import { toast } from 'react-toastify';
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdCalendarToday,
  MdFilterList, MdBarChart, MdCheckCircle, MdDownload,
  MdStorefront, MdLocationOn, MdTrendingUp, MdGroup, MdExpandMore,
} from 'react-icons/md';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import * as XLSX from 'xlsx';

/* ─── helpers ─── */
const fmt = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtInt = (n) => {
  const num = Math.floor(parseFloat(n) || 0);
  return num.toLocaleString('en-PK');
};
const formatDate = (d) => { if (!d) return ''; try { return new Date(d).toISOString().slice(0,10); } catch { return ''; } };

/*
  Per-item quantity logic:
  - item.type === 'piece' (or 'Piece') → add item.quantity to pcs total
  - item.type === 'ctn'   (or 'Ctn')   → add item.quantity to ctn total
    But if type is 'ctn' and cortanSize is known, the quantity already
    represents cartons, so just add directly.
  - Remaining pcs that fill a full ctn → roll up into ctns
*/
const aggregateItems = (items) => {
  let totalCtn = 0;
  let totalPcs = 0;

  (items || []).forEach(item => {
    const qty        = parseFloat(item.quantity) || 0;
    const type       = (item.type || '').toLowerCase();
    const cortanSize = parseFloat(item.productId?.cortanSize) || 1;

    if (type === 'ctn') {
      totalCtn += qty;
    } else {
      // piece — convert to ctn+pcs using cortanSize
      const ctnsFromPcs = Math.floor(qty / cortanSize);
      const remainPcs   = Math.round(qty % cortanSize);
      totalCtn += ctnsFromPcs;
      totalPcs += remainPcs;
    }
  });

  // Roll over accumulated pcs into ctns if any cortanSize group fills up
  // (simple pass: use cortanSize of first item as reference)
  const refCortanSize = parseFloat((items || [])[0]?.productId?.cortanSize) || 1;
  if (totalPcs >= refCortanSize) {
    totalCtn += Math.floor(totalPcs / refCortanSize);
    totalPcs  = Math.round(totalPcs % refCortanSize);
  }

  return { ctns: totalCtn, pcs: totalPcs };
};

const ROWS_PER_PAGE = 15;

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsSales = () => {
  const [reportData,    setReportData]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [generated,     setGenerated]     = useState(false);
  const [salesPersons,  setSalesPersons]  = useState([]);
  const [cities,        setCities]        = useState([]);

  /* filters */
  const [startDate,     setStartDate]     = useState('');
  const [endDate,       setEndDate]       = useState('');
  const [selectedSPs,   setSelectedSPs]   = useState([]);
  const [selectedCity,  setSelectedCity]  = useState('');
  const [searchCustomer,setSearchCustomer]= useState('');
  const [datePreset,    setDatePreset]    = useState('all');

  /* UI state */
  const [spDropOpen,    setSpDropOpen]    = useState(false);
  const [spSearch,      setSpSearch]      = useState('');
  const [dateDropOpen,  setDateDropOpen]  = useState(false);
  const [currentPage,   setCurrentPage]   = useState(1);

  /* ── Fetch + merge by retailer ── */
  const fetchReport = useCallback(async ({ sd='', ed='', sps=[], city='' } = {}) => {
    setLoading(true); setGenerated(false);
    try {
      const res     = await getOrders(1, 500);
      let allOrders = Array.isArray(res?.data?.data) ? res.data.data : [];

      /* Delivered only */
      let filtered = allOrders.filter(
  o => ['Delivered', 'Completed'].includes(o.status)
);

      /* Date filter */
      if (sd || ed) {
        filtered = filtered.filter(o => {
          const d = formatDate(o.createdAt || o.date);
          if (sd && d < sd) return false;
          if (ed && d > ed) return false;
          return true;
        });
      }

      /* Salesperson filter */
      if (sps.length > 0) {
        filtered = filtered.filter(o => {
          const id = o.SaleUser?._id || o.salesPersonID?._id || o.SaleUser;
          return sps.includes(id);
        });
      }

      /* City filter */
      if (city) {
        filtered = filtered.filter(o => (o.city?._id || o.city || o.cityID) === city);
      }

      /* ── MERGE: one row per retailer, summing CTN & Pcs separately ── */
      const retailerMap = {};

      filtered.forEach(order => {
        const retailerId = order.RetailerUser?._id || order.retailerId || order._id;
        const key        = String(retailerId);

        /* Aggregate this order's items by type */
        const { ctns: orderCtns, pcs: orderPcs } = aggregateItems(order.items || []);

        if (!retailerMap[key]) {
          retailerMap[key] = {
            retailerId,
            accountNo:    order.RetailerUser?.userId || order.RetailerUser?.docId || '—',
            customerName: order.RetailerUser?.shopName || order.RetailerUser?.name || order.customerName || 'Unknown',
            salesperson:  order.SaleUser?.name || '—',
            totalCtns:    0,
            totalPcs:     0,
            totalAmount:  0,
          };
        }

        retailerMap[key].totalCtns   += orderCtns;
        retailerMap[key].totalPcs    += orderPcs;
        retailerMap[key].totalAmount += parseFloat(order.total || 0);
      });

      /* Final pcs → ctn rollup per retailer (in case pcs accumulated across orders) */
      const rows = Object.values(retailerMap).map(r => {
        // We don't have a single cortanSize per retailer easily,
        // so we just surface the raw accumulated ctns + pcs
        return {
          ...r,
          ctns: r.totalCtns,
          pcs:  r.totalPcs,
        };
      });

      setReportData(rows);
      setGenerated(true);
      setCurrentPage(1);
      if (rows.length === 0) toast.info('No delivered orders found');
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch report');
      setReportData([]); setGenerated(true);
    } finally { setLoading(false); }
  }, []);

  /* init */
  useEffect(() => {
    const init = async () => {
      try {
        const [spRes, citRes] = await Promise.all([getAllSalesPersons(), getAllCities()]);
        setSalesPersons(spRes?.data?.data || []);
        setCities(citRes?.data?.data || []);
        await fetchReport({});
      } catch (e) { console.error(e); }
    };
    init();
  }, [fetchReport]);

  /* Date preset */
  const applyDatePreset = (preset) => {
    setDateDropOpen(false);
    if (preset === 'custom') { setDatePreset('custom'); return; }
    const today = new Date();
    let end = today.toISOString().slice(0,10), start = end;
    if      (preset === 'today') { start = end; }
    else if (preset === 'week')  { const d = new Date(today); d.setDate(today.getDate()-today.getDay()); start = d.toISOString().slice(0,10); }
    else if (preset === 'month') { start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10); }
    else                         { start = ''; end = ''; }
    setStartDate(start); setEndDate(end); setDatePreset(preset);
  };
  const getPresetLabel = () => {
    if (datePreset==='custom' && startDate && endDate) return `${startDate} → ${endDate}`;
    if (datePreset==='custom' && startDate) return `From ${startDate}`;
    if (datePreset==='custom' && endDate)   return `Up to ${endDate}`;
    return { all:'All Time', today:'Today', week:'This Week', month:'This Month', custom:'Custom Dates' }[datePreset] || 'All Time';
  };

  /* Multi-select SP */
  const toggleSP = id => setSelectedSPs(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);
  const selectedSPObjs  = salesPersons.filter(s => selectedSPs.includes(s._id));
  const filteredSPList  = salesPersons.filter(s => (s.name||'').toLowerCase().includes(spSearch.toLowerCase()));

  const handleGenerate = () => {
    if (startDate && endDate && startDate > endDate) { toast.error('"From" must be before "To"'); return; }
    fetchReport({ sd:startDate, ed:endDate, sps:selectedSPs, city:selectedCity });
  };
  const handleReset = () => {
    setStartDate(''); setEndDate(''); setSelectedSPs([]); setSelectedCity('');
    setSearchCustomer(''); setSpSearch(''); setDatePreset('all'); setCurrentPage(1);
    fetchReport({});
  };

  /* Client-side search */
  const filtered = useMemo(() => {
    if (!searchCustomer.trim()) return reportData;
    const q = searchCustomer.toLowerCase();
    return reportData.filter(r =>
      r.customerName.toLowerCase().includes(q) ||
      r.salesperson.toLowerCase().includes(q)  ||
      String(r.accountNo).toLowerCase().includes(q)
    );
  }, [reportData, searchCustomer]);

  /* Stats */
  const stats = useMemo(() => ({
    count:     filtered.length,
    totalCtns: filtered.reduce((s,r) => s + (r.ctns||0), 0),
    totalPcs:  filtered.reduce((s,r) => s + (r.pcs||0),  0),
    totalAmt:  filtered.reduce((s,r) => s + (r.totalAmount||0), 0),
    uniqueSP:  new Set(filtered.map(r => r.salesperson)).size,
  }), [filtered]);

  /* Pagination */
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated  = filtered.slice((currentPage-1)*ROWS_PER_PAGE, currentPage*ROWS_PER_PAGE);

  /* Export */
  const handleExport = () => {
    if (!filtered.length) { toast.info('No data to export'); return; }
    const rows = filtered.map(r => ({
      'A/C No.':     r.accountNo,
      'Customer':    r.customerName,
      'Salesperson': r.salesperson,
      'CTN':         r.ctns,
      'Pcs':         r.pcs,
      'Total (Rs)':  parseFloat(r.totalAmount || 0),
    }));
    rows.push({
      'A/C No.': 'GRAND TOTAL', 'Customer': '', 'Salesperson': '',
      'CTN': stats.totalCtns, 'Pcs': stats.totalPcs,
      'Total (Rs)': stats.totalAmt,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [12,45,25,10,10,18].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sale Summary');
    XLSX.writeFile(wb, `Sale_Summary_${startDate&&endDate ? `${startDate}_to_${endDate}` : 'all'}.xlsx`);
    toast.success('Exported successfully');
  };

  const activeFilterCount = [selectedSPs.length>0, selectedCity, startDate||endDate, datePreset!=='all'].filter(Boolean).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .rs-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .rs-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .rs-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .rs-select {
          appearance:none; -webkit-appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
        }
        .rs-input {
          background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px;
          padding:10px 14px; font-size:13px; color:#111827; outline:none;
          font-family:'DM Sans',sans-serif; width:100%;
          transition:border-color 0.15s,box-shadow 0.15s;
        }
        .rs-input:focus { border-color:#FF5934; box-shadow:0 0 0 3px rgba(255,89,52,0.1); }
        .rs-input[type="date"]::-webkit-calendar-picker-indicator { opacity:0.5; cursor:pointer; }
        .rs-no-scroll::-webkit-scrollbar { display:none; }
        .rs-no-scroll { scrollbar-width:none; }
        .rs-stat { transition:transform 0.15s,box-shadow 0.15s; }
        .rs-stat:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08); }
        .rs-sp-cb { accent-color:#FF5934; }
        .total-row td { background:#FFF5F3; border-top:2px solid #FFD7CE; }
        /* Type badges */
        .badge-ctn  { background:#EFF6FF; color:#3B82F6; font-size:9px; font-weight:700; padding:1px 5px; border-radius:5px; }
        .badge-pcs  { background:#F0FDF4; color:#16A34A; font-size:9px; font-weight:700; padding:1px 5px; border-radius:5px; }
      `}</style>

      <div className="rs-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Sale Summary</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {generated
                ? `${stats.count} customer${stats.count!==1?'s':''}${selectedSPObjs.length ? ` · ${selectedSPObjs.map(s=>s.name).join(', ')}` : ''}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Delivered/Completed
            </span>
            {generated && filtered.length > 0 && (
              <button onClick={handleExport}
                className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all">
                <MdDownload size={16} /> Export Excel
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-5 mb-5">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-4 items-end">

            {/* Date Preset */}
            <div className="flex-1 min-w-[200px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCalendarToday size={12} className="text-[#FF5934]" /> Date Range
              </label>
              <div className="relative">
                <div onClick={() => setDateDropOpen(p=>!p)}
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all">
                  <span className="text-[13px] text-[#111827] font-medium flex-1">{getPresetLabel()}</span>
                  <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform ${dateDropOpen?'rotate-180':''}`} />
                </div>
                {dateDropOpen && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                    {[['all','All Time'],['today','Today'],['week','This Week'],['month','This Month'],['custom','Custom Dates']].map(([p,l]) => (
                      <button key={p} onClick={() => applyDatePreset(p)}
                        className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-orange-50 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0
                          ${datePreset===p ? 'text-[#FF5934] font-semibold bg-orange-50' : 'text-[#111827]'}`}>
                        <MdCheckCircle size={14} className={datePreset===p ? 'text-[#FF5934]' : 'text-transparent'} />
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom date inputs */}
            {datePreset === 'custom' && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> From
                  </label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rs-input" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> To
                  </label>
                  <input type="date" value={endDate} min={startDate||undefined} onChange={e => setEndDate(e.target.value)} className="rs-input" />
                </div>
              </>
            )}

            {/* Multi-select Salesperson */}
            <div className="flex-1 min-w-[220px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdPerson size={12} className="text-[#FF5934]" /> Salesperson
                {selectedSPs.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#FF5934] text-white text-[9px] font-bold flex items-center justify-center">{selectedSPs.length}</span>
                )}
              </label>
              <div className="relative">
                <div onClick={() => setSpDropOpen(p=>!p)}
                  className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all min-h-[42px]">
                  {selectedSPs.length === 0 ? (
                    <span className="text-[13px] text-[#9CA3AF] flex-1">All salespersons</span>
                  ) : selectedSPs.length === 1 ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#FF5934] text-[10px] font-bold">{(selectedSPObjs[0]?.name||'?')[0].toUpperCase()}</span>
                      </div>
                      <span className="text-[13px] text-[#111827] font-medium truncate">{selectedSPObjs[0]?.name}</span>
                    </div>
                  ) : (
                    <span className="text-[13px] text-[#111827] font-medium flex-1">{selectedSPs.length} salespersons selected</span>
                  )}
                  <MdExpandMore size={18} className={`text-[#9CA3AF] flex-shrink-0 transition-transform ${spDropOpen?'rotate-180':''}`} />
                </div>

                {spDropOpen && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                        <MdSearch size={14} className="text-[#9CA3AF]" />
                        <input autoFocus value={spSearch} onChange={e => setSpSearch(e.target.value)}
                          placeholder="Search…"
                          className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                        {spSearch && <button onClick={() => setSpSearch('')} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 bg-[#FAFAFA]">
                      <button onClick={() => setSelectedSPs(salesPersons.map(s=>s._id))}
                        className="text-[12px] font-semibold text-[#FF5934] hover:underline">Select All</button>
                      {selectedSPs.length > 0 && (
                        <button onClick={() => setSelectedSPs([])}
                          className="text-[12px] font-semibold text-[#9CA3AF] hover:text-red-500 flex items-center gap-1">
                          <MdClose size={12} /> Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-56 overflow-y-auto rs-no-scroll">
                      {filteredSPList.map(sp => {
                        const checked = selectedSPs.includes(sp._id);
                        return (
                          <label key={sp._id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${checked?'bg-orange-50/50':''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleSP(sp._id)} className="rs-sp-cb w-4 h-4 rounded flex-shrink-0" />
                            <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#FF5934] text-[11px] font-bold">{(sp.name||'?')[0].toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                            </div>
                            {checked && <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0" />}
                          </label>
                        );
                      })}
                    </div>
                    <div className="p-2 border-t border-gray-100">
                      <button onClick={() => setSpDropOpen(false)}
                        className="w-full h-9 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-[13px] font-bold transition-all">
                        Done{selectedSPs.length>0 ? ` (${selectedSPs.length})` : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* City */}
            {cities.length > 0 && (
              <div className="flex-1 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdLocationOn size={12} className="text-[#FF5934]" /> Site
                </label>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} className="rs-input rs-select">
                  <option value="">All Sites</option>
                  {cities.map(c => <option key={c._id} value={c._id}>{c.name||c.cityName}</option>)}
                </select>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleReset}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                <MdRefresh size={15} /> Reset
              </button>
              <button onClick={handleGenerate} disabled={loading}
                className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                  : <><MdBarChart size={16} /> Generate Report</>}
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {(selectedSPObjs.length>0 || selectedCity || startDate || endDate || datePreset!=='all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {datePreset !== 'all' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                  <MdCalendarToday size={12} className="text-blue-500" />
                  <span className="text-[12px] font-semibold text-blue-600">{getPresetLabel()}</span>
                  <button onClick={() => { setDatePreset('all'); setStartDate(''); setEndDate(''); }} className="text-blue-400 hover:text-blue-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedSPObjs.map(sp => (
                <div key={sp._id} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#FF5934]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FF5934] text-[9px] font-bold">{(sp.name||'?')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-[#FF5934]">{sp.name}</span>
                  <button onClick={() => toggleSP(sp._id)} className="text-[#FF5934]/50 hover:text-[#FF5934] ml-1"><MdClose size={13} /></button>
                </div>
              ))}
              {selectedCity && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                  <MdLocationOn size={12} className="text-emerald-500" />
                  <span className="text-[12px] font-semibold text-emerald-600">{cities.find(c=>c._id===selectedCity)?.name||selectedCity}</span>
                  <button onClick={() => setSelectedCity('')} className="text-emerald-400 hover:text-emerald-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading && !generated && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#9CA3AF]">Loading orders…</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && generated && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { icon: MdStorefront, label: 'Customers',    value: stats.count.toLocaleString(),                                        color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10' },
                { icon: MdGroup,      label: 'Salespersons', value: stats.uniqueSP.toLocaleString(),                                     color: 'text-blue-500',    bg: 'bg-blue-50'      },
                { icon: MdTrendingUp, label: 'Total CTN + Pcs',
                  value: `${fmtInt(stats.totalCtns)} Ctn${stats.totalPcs > 0 ? ` ${stats.totalPcs} Pcs` : ''}`,                          color: 'text-emerald-600', bg: 'bg-emerald-50'   },
                { icon: MdBarChart,   label: 'Total Amount', value: `Rs. ${fmt(stats.totalAmt)}`,                                        color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="rs-stat bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={20} className={color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                    <p className={`text-[15px] font-bold truncate ${color}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm shadow-sm">
                <MdSearch size={16} className="text-[#9CA3AF] flex-shrink-0" />
                <input type="search" value={searchCustomer}
                  onChange={e => { setSearchCustomer(e.target.value); setCurrentPage(1); }}
                  placeholder="Search customer, salesperson, A/C no…"
                  className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                {searchCustomer && (
                  <button onClick={() => { setSearchCustomer(''); setCurrentPage(1); }} className="text-[#9CA3AF] hover:text-[#FF5934]">
                    <MdClose size={13} />
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#9CA3AF] flex-shrink-0">
                {filtered.length !== reportData.length
                  ? `${filtered.length} of ${reportData.length}`
                  : `${reportData.length} customer${reportData.length!==1?'s':''}`}
              </p>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdStorefront size={22} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">
                    {searchCustomer ? 'No records match your search' : 'No delivered orders found'}
                  </p>
                  {searchCustomer && <button onClick={() => setSearchCustomer('')} className="text-[#FF5934] text-xs hover:underline">Clear search</button>}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          <th className="text-left   text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-10">#</th>
                          <th className="text-left   text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[110px]">A/C No.</th>
                          <th className="text-left   text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Customer</th>
                          <th className="text-left   text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Salesperson</th>
                          <th className="text-right  text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[90px]">
                            <span className="badge-ctn">CTN</span>
                          </th>
                          <th className="text-right  text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[80px]">
                            <span className="badge-pcs">Pcs</span>
                          </th>
                          <th className="text-right  text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[150px]">Total (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map((row, i) => {
                          const rowNum = (currentPage-1)*ROWS_PER_PAGE + i + 1;
                          const negAmt = row.totalAmount < 0;
                          const negCtn = row.ctns < 0;
                          return (
                            <tr key={row.retailerId || i} className="table-row">
                              {/* # */}
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-bold text-[#C4C9D4]">{rowNum}</span>
                              </td>
                              {/* A/C No */}
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                  {row.accountNo}
                                </span>
                              </td>
                              {/* Customer */}
                              <td className="px-4 py-3">
                                <p className="text-[13px] font-semibold text-[#111827] leading-tight">{row.customerName}</p>
                              </td>
                              {/* Salesperson */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[#FF5934] text-[9px] font-bold">{(row.salesperson[0]||'?').toUpperCase()}</span>
                                  </div>
                                  <span className="text-[13px] text-[#374151] font-medium">{row.salesperson}</span>
                                </div>
                              </td>
                              {/* CTN */}
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[13px] font-bold ${negCtn ? 'text-red-500' : 'text-[#111827]'}`}>
                                  {negCtn ? `(${Math.abs(row.ctns)})` : fmtInt(row.ctns)}
                                </span>
                              </td>
                              {/* Pcs */}
                              <td className="px-4 py-3 text-right">
                                <span className="text-[13px] font-semibold text-emerald-600">
                                  {row.pcs > 0 ? row.pcs : <span className="text-[#D1D5DB]">—</span>}
                                </span>
                              </td>
                              {/* Total */}
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[13px] font-bold ${negAmt ? 'text-red-500' : 'text-[#111827]'}`}>
                                  {negAmt ? '(' : ''}Rs.&nbsp;{fmt(Math.abs(row.totalAmount))}{negAmt ? ')' : ''}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Grand Total row */}
                        <tr className="total-row">
                          <td className="px-4 py-3" colSpan={4}>
                            <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-bold text-[#FF5934]">{fmtInt(stats.totalCtns)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-bold text-[#FF5934]">
                              {stats.totalPcs > 0 ? stats.totalPcs : <span className="text-[#D1D5DB]">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-bold text-[#FF5934]">Rs.&nbsp;{fmt(stats.totalAmt)}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex items-center justify-between">
                      <p className="text-[11px] text-[#9CA3AF] font-bold uppercase tracking-widest">
                        {filtered.length} customer{filtered.length!==1?'s':''}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          disabled={currentPage===1} onClick={() => setCurrentPage(p=>p-1)}>
                          <GrFormPrevious size={16} />
                        </button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                          <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-[#374151]">{totalPages}</span>
                        </div>
                        <button
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          disabled={currentPage===totalPages} onClick={() => setCurrentPage(p=>p+1)}>
                          <GrFormNext size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ReportsSales;