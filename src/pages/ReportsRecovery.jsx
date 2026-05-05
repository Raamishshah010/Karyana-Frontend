import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getRetailerLedgerById, getAllRetailers, getAllSalesPersons, getAllCities } from '../APIS';
import { toast } from 'react-toastify';
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdCalendarToday,
  MdFilterList, MdBarChart, MdCheckCircle, MdDownload,
  MdStorefront, MdAttachMoney, MdGroup, MdExpandMore, MdDateRange,
} from 'react-icons/md';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import * as XLSX from 'xlsx';

/* ─── helpers ─── */
const fmt = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toDateKey = (dateVal) => {
  if (!dateVal) return '';
  try { return new Date(dateVal).toISOString().slice(0, 10); }
  catch { return ''; }
};

const displayDate = (dateVal) => {
  if (!dateVal) return '—';
  try { return new Date(dateVal).toLocaleDateString('en-GB'); }
  catch { return '—'; }
};

const ROWS_PER_PAGE = 15;

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsRecovery = () => {
  /* data */
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [generated, setGenerated]   = useState(false);

  /* filter options */
  const [retailers, setRetailers]       = useState([]);
  const [salesPersons, setSalesPersons] = useState([]);
  const [cities, setCities]             = useState([]);

  /* filter values */
  const [startDate, setStartDate]               = useState('');
  const [endDate, setEndDate]                   = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState('');
  const [selectedSP, setSelectedSP]             = useState('');
  const [selectedCity, setSelectedCity]         = useState('');
  const [searchTerm, setSearchTerm]             = useState('');
  const [statusFilter, setStatusFilter]         = useState('');
  const [datePreset, setDatePreset]             = useState('all');

  /* dropdown open state */
  const [retDropOpen, setRetDropOpen]   = useState(false);
  const [retSearch, setRetSearch]       = useState('');
  const [spDropOpen, setSpDropOpen]     = useState(false);
  const [spSearch, setSpSearch]         = useState('');
  const [dateDropOpen, setDateDropOpen] = useState(false);

  /* pagination */
  const [currentPage, setCurrentPage] = useState(1);

  /* ── close dropdowns when clicking outside ── */
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.rr-dropdown')) {
        setRetDropOpen(false);
        setSpDropOpen(false);
        setDateDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ────────────────────────────────────────────────────────────
     CORE FETCH
     API: getRetailerLedgerById(id)
     Returns: { success: true, ledgers: [...] }
     Each ledger: { _id, type, amount, date, createdAt,
                    isApproved, isRejected, isImportedFromExcel,
                    description, details, refNo, balance }
  ──────────────────────────────────────────────────────────── */
  const fetchReport = useCallback(async ({
    sd = '', ed = '', ret = '', sp = '', city = '',
  } = {}) => {
    setLoading(true);
    setGenerated(false);
    setReportData([]);

    try {
      /* determine which retailers to query */
      let targetRetailers = retailers;

      /* if a specific retailer is selected only fetch that one */
      if (ret) {
        targetRetailers = retailers.filter(r => r._id === ret);
      } else if (city) {
        /* filter by city */
        targetRetailers = retailers.filter(r => {
          const cid = typeof r.city === 'object' ? r.city?._id : r.city;
          return cid === city;
        });
      } else if (sp) {
        /* filter by salesperson */
        targetRetailers = retailers.filter(r => {
          const spid = typeof r.salesPersonID === 'object'
            ? r.salesPersonID?._id
            : r.salesPersonID;
          return spid === sp;
        });
      }

      if (!targetRetailers.length) {
        toast.info('No retailers match the selected filters');
        setGenerated(true);
        setLoading(false);
        return;
      }

      const rows = [];

      /* fetch ledger for each retailer in parallel (cap at 30) */
      const results = await Promise.allSettled(
        targetRetailers.slice(0, 30).map(retailer =>
          getRetailerLedgerById(retailer._id).then(res => ({
            retailer,
            ledgers: Array.isArray(res?.ledgers) ? res.ledgers : [],
          }))
        )
      );

      results.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { retailer, ledgers } = r.value;

        const retailerName = retailer.shopName || retailer.name || 'Unknown';
        const retailerCity = typeof retailer.city === 'object'
          ? retailer.city?.name || ''
          : retailer.city || '';
        const spName = typeof retailer.salesPersonID === 'object'
          ? retailer.salesPersonID?.name || 'N/A'
          : salesPersons.find(s => s._id === retailer.salesPersonID)?.name || 'N/A';
        const accountNo = retailer.userId || '—';

        ledgers.forEach(ledger => {
          /* only include PAYMENT type entries (these are recovery entries) */
          if (ledger.type && ledger.type !== 'PAYMENT') return;

          /* skip imported-from-excel rows if you want (optional) */
          // if (ledger.isImportedFromExcel) return;

          const dateKey = toDateKey(ledger.date || ledger.createdAt);

          /* date range filter */
          if (sd && dateKey && dateKey < sd) return;
          if (ed && dateKey && dateKey > ed) return;

          /* approval status */
          const status = ledger.isRejected
            ? 'Rejected'
            : ledger.isApproved === false
              ? 'Pending'
              : 'Approved';

          rows.push({
            _id:          ledger._id || ledger.transactionId,
            accountNo,
            retailerName,
            city:         retailerCity,
            salesPerson:  spName,
            amount:       parseFloat(ledger.amount || 0),
            date:         dateKey,
            displayDate:  displayDate(ledger.date || ledger.createdAt),
            status,
            details:      ledger.description || ledger.details || '—',
            refNo:        ledger.refNo || '—',
            balance:      parseFloat(ledger.balance || 0),
          });
        });
      });

      /* sort newest first */
      rows.sort((a, b) => (b.date > a.date ? 1 : -1));

      setReportData(rows);
      setGenerated(true);
      setCurrentPage(1);

      if (!rows.length) {
        toast.info('No recovery payments found for the selected filters');
      }
    } catch (err) {
      console.error('ReportsRecovery fetch error:', err);
      toast.error('Failed to fetch recovery data');
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, [retailers, salesPersons]);

  /* ── Load dropdowns on mount ── */
  useEffect(() => {
    const init = async () => {
      try {
        const [retRes, spRes, citRes] = await Promise.all([
          getAllRetailers(),
          getAllSalesPersons(),
          getAllCities(),
        ]);
        setRetailers(retRes?.data?.data || []);
        setSalesPersons(spRes?.data?.data || []);
        setCities(citRes?.data?.data || []);
      } catch (err) {
        console.error('Init error:', err);
        toast.error('Failed to load filter options');
      }
    };
    init();
  }, []);

  /* ── auto-fetch once retailers are loaded ── */
  useEffect(() => {
    if (retailers.length) {
      fetchReport({});
    }
  }, [retailers.length]); // only when retailers first load

  /* ── Date preset ── */
  const applyDatePreset = (preset) => {
    setDateDropOpen(false);
    setDatePreset(preset);
    if (preset === 'custom') return;
    const today = new Date();
    const end   = today.toISOString().slice(0, 10);
    let start   = '';
    if (preset === 'today') {
      start = end;
    } else if (preset === 'week') {
      const d = new Date(today);
      d.setDate(today.getDate() - today.getDay());
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else {
      setStartDate(''); setEndDate(''); return;
    }
    setStartDate(start);
    setEndDate(end);
  };

  const presetLabel = () => {
    const m = { all:'All Time', today:'Today', week:'This Week', month:'This Month', custom:'Custom Dates' };
    if (datePreset === 'custom' && startDate && endDate) return `${startDate} → ${endDate}`;
    if (datePreset === 'custom' && startDate) return `From ${startDate}`;
    if (datePreset === 'custom' && endDate) return `Up to ${endDate}`;
    return m[datePreset] || 'All Time';
  };

  const handleGenerate = () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error('"From" date must be before "To" date'); return;
    }
    fetchReport({ sd: startDate, ed: endDate, ret: selectedRetailer, sp: selectedSP, city: selectedCity });
  };

  const handleReset = () => {
    setStartDate(''); setEndDate('');
    setSelectedRetailer(''); setSelectedSP(''); setSelectedCity('');
    setSearchTerm(''); setStatusFilter('');
    setRetSearch(''); setSpSearch('');
    setDatePreset('all'); setCurrentPage(1);
    fetchReport({});
  };

  /* ── Client-side search + status filter ── */
  const filtered = useMemo(() => {
    let data = reportData;
    if (statusFilter) data = data.filter(r => r.status === statusFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(r =>
        r.retailerName.toLowerCase().includes(q) ||
        r.salesPerson.toLowerCase().includes(q) ||
        String(r.accountNo).toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    }
    return data;
  }, [reportData, searchTerm, statusFilter]);

  /* ── Summary stats ── */
  const stats = useMemo(() => ({
    totalAmount: filtered.reduce((s, r) => s + r.amount, 0),
    approved:    filtered.filter(r => r.status === 'Approved').length,
    pending:     filtered.filter(r => r.status === 'Pending').length,
    rejected:    filtered.filter(r => r.status === 'Rejected').length,
    count:       filtered.length,
  }), [filtered]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  /* ── Export ── */
  const handleExport = () => {
    if (!filtered.length) { toast.info('No data to export'); return; }
    const rows = filtered.map(r => ({
      'A/C No.':      r.accountNo,
      'Retailer':     r.retailerName,
      'Salesperson':  r.salesPerson,
      'City':         r.city,
      'Amount (Rs)':  r.amount,
      'Date':         r.displayDate,
      'Status':       r.status,
      'Ref No.':      r.refNo,
      'Details':      r.details,
    }));
    rows.push({ 'A/C No.': 'TOTAL', 'Retailer': '', 'Salesperson': '', 'City': '',
      'Amount (Rs)': stats.totalAmount, 'Date': '', 'Status': '', 'Ref No.': '', 'Details': '' });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:28 },{ wch:20 },{ wch:15 },{ wch:15 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recovery Report');
    const suffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all-time';
    XLSX.writeFile(wb, `Recovery_Report_${suffix}.xlsx`);
    toast.success('Report exported');
  };

  /* ── Dropdown filter lists ── */
  const filteredRetList = retailers.filter(r =>
    (r.shopName || r.name || '').toLowerCase().includes(retSearch.toLowerCase())
  );
  const filteredSPList = salesPersons.filter(s =>
    (s.name || '').toLowerCase().includes(spSearch.toLowerCase())
  );
  const selectedRetObj = retailers.find(r => r._id === selectedRetailer);
  const selectedSPObj  = salesPersons.find(s => s._id === selectedSP);
  const activeFilterCount = [selectedRetailer, selectedSP, selectedCity, startDate || endDate, datePreset !== 'all'].filter(Boolean).length;

  /* ── status badge style ── */
  const statusBadge = (s) => {
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200';
    if (s === 'Rejected') return 'bg-red-50 text-red-600 ring-1 ring-red-200';
    return 'bg-amber-50 text-amber-600 ring-1 ring-amber-200';
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .rr-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .rr-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .rr-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .rr-input {
          background:#F9FAFB; border:1px solid #E5E7EB; border-radius:12px;
          padding:10px 14px; font-size:13px; color:#111827; outline:none;
          font-family:'DM Sans',sans-serif; width:100%;
          transition:border-color 0.15s,box-shadow 0.15s;
        }
        .rr-input:focus { border-color:#FF5934; box-shadow:0 0 0 3px rgba(255,89,52,0.1); }
        .rr-no-scroll::-webkit-scrollbar { display:none; }
        .rr-no-scroll { scrollbar-width:none; }
        .rr-dropdown { position:relative; }
      `}</style>

      <div className="rr-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Recovery Report</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {generated
                ? `${stats.count} payment entries · ${presetLabel()}${selectedRetObj ? ` · ${selectedRetObj.shopName || selectedRetObj.name}` : ''}`
                : 'Select filters and generate report'}
            </p>
          </div>
          {generated && filtered.length > 0 && (
            <button onClick={handleExport}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all">
              <MdDownload size={16} /> Export Excel
            </button>
          )}
        </div>

        {/* ── Filter Card ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-5 mb-5">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
            <MdFilterList size={13} className="text-[#FF5934]" /> Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {activeFilterCount}
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-4 items-end">

            {/* ── Date preset ── */}
            <div className="flex-1 min-w-[200px] rr-dropdown">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCalendarToday size={12} className="text-[#FF5934]" /> Date Range
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => setDateDropOpen(p => !p)}
              >
                <span className="text-[13px] text-[#111827] font-medium flex-1">{presetLabel()}</span>
                <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform ${dateDropOpen ? 'rotate-180' : ''}`} />
              </div>
              {dateDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  {[['all','All Time'],['today','Today'],['week','This Week'],['month','This Month'],['custom','Custom Dates']].map(([p, l]) => (
                    <button key={p} onClick={() => applyDatePreset(p)}
                      className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-orange-50 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0 ${datePreset === p ? 'text-[#FF5934] font-semibold bg-orange-50' : 'text-[#374151]'}`}>
                      <MdCheckCircle size={14} className={datePreset === p ? 'text-[#FF5934]' : 'text-transparent'} />
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Custom date inputs ── */}
            {datePreset === 'custom' && (
              <>
                <div className="flex-1 min-w-[140px]">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> From
                  </label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rr-input" />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> To
                  </label>
                  <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className="rr-input" />
                </div>
              </>
            )}

            {/* ── Retailer picker ── */}
            <div className="flex-1 min-w-[200px] rr-dropdown">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdStorefront size={12} className="text-[#FF5934]" /> Retailer
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setRetDropOpen(p => !p); setSpDropOpen(false); }}
              >
                {selectedRetObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#FF5934] text-[10px] font-bold">{(selectedRetObj.shopName || selectedRetObj.name || '?')[0].toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] text-[#111827] font-medium truncate">{selectedRetObj.shopName || selectedRetObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#9CA3AF] flex-1">All retailers</span>
                )}
                <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
              </div>
              {retDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                      <MdSearch size={14} className="text-[#9CA3AF]" />
                      <input autoFocus value={retSearch} onChange={e => setRetSearch(e.target.value)}
                        placeholder="Search retailer…"
                        className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                      {retSearch && <button onClick={() => setRetSearch('')} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rr-no-scroll">
                    <div onClick={() => { setSelectedRetailer(''); setRetDropOpen(false); setRetSearch(''); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${!selectedRetailer ? 'bg-orange-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MdStorefront size={14} className="text-gray-400" />
                      </div>
                      <p className="text-[13px] font-medium text-[#374151] flex-1">All Retailers</p>
                      {!selectedRetailer && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {filteredRetList.map(ret => (
                      <div key={ret._id} onClick={() => { setSelectedRetailer(ret._id); setRetDropOpen(false); setRetSearch(''); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedRetailer === ret._id ? 'bg-orange-50' : ''}`}>
                        <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF5934] text-[11px] font-bold">{(ret.shopName || ret.name || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#111827] truncate">{ret.shopName || ret.name}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{ret.userId || '—'}</p>
                        </div>
                        {selectedRetailer === ret._id && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                      </div>
                    ))}
                    {filteredRetList.length === 0 && (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Salesperson picker ── */}
            <div className="flex-1 min-w-[200px] rr-dropdown">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdPerson size={12} className="text-[#FF5934]" /> Salesperson
              </label>
              <div
                className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                onClick={() => { setSpDropOpen(p => !p); setRetDropOpen(false); }}
              >
                {selectedSPObj ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#FF5934] text-[10px] font-bold">{(selectedSPObj.name || '?')[0].toUpperCase()}</span>
                    </div>
                    <span className="text-[13px] text-[#111827] font-medium truncate">{selectedSPObj.name}</span>
                  </div>
                ) : (
                  <span className="text-[13px] text-[#9CA3AF] flex-1">All salespersons</span>
                )}
                <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
              </div>
              {spDropOpen && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden" style={{ top:'100%' }}>
                  <div className="p-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                      <MdSearch size={14} className="text-[#9CA3AF]" />
                      <input autoFocus value={spSearch} onChange={e => setSpSearch(e.target.value)}
                        placeholder="Search salesperson…"
                        className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                      {spSearch && <button onClick={() => setSpSearch('')} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>}
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rr-no-scroll">
                    <div onClick={() => { setSelectedSP(''); setSpDropOpen(false); setSpSearch(''); }}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${!selectedSP ? 'bg-orange-50' : ''}`}>
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MdGroup size={14} className="text-gray-400" />
                      </div>
                      <p className="text-[13px] font-medium text-[#374151] flex-1">All Salespersons</p>
                      {!selectedSP && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                    </div>
                    {filteredSPList.map(sp => (
                      <div key={sp._id} onClick={() => { setSelectedSP(sp._id); setSpDropOpen(false); setSpSearch(''); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSP === sp._id ? 'bg-orange-50' : ''}`}>
                        <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#FF5934] text-[11px] font-bold">{(sp.name || '?')[0].toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                        </div>
                        {selectedSP === sp._id && <MdCheckCircle size={15} className="text-[#FF5934]" />}
                      </div>
                    ))}
                    {filteredSPList.length === 0 && (
                      <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Status filter ── */}
            <div className="flex-1 min-w-[140px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCheckCircle size={12} className="text-[#FF5934]" /> Status
              </label>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="rr-input" style={{ appearance:'none', paddingRight:28,
                  backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}>
                <option value="">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* ── Buttons ── */}
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={handleReset}
                className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                <MdRefresh size={15} /> Reset
              </button>
              <button onClick={handleGenerate} disabled={loading || !retailers.length}
                className="h-10 px-5 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-md shadow-orange-100 transition-all flex items-center gap-2">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Loading…</>
                  : <><MdBarChart size={16} /> Generate</>}
              </button>
            </div>
          </div>

          {/* Active chips */}
          {(selectedRetObj || selectedSPObj || datePreset !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {datePreset !== 'all' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                  <MdDateRange size={12} className="text-blue-500" />
                  <span className="text-[12px] font-semibold text-blue-600">{presetLabel()}</span>
                  <button onClick={() => { setDatePreset('all'); setStartDate(''); setEndDate(''); }} className="text-blue-400 hover:text-blue-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedRetObj && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                  <MdStorefront size={12} className="text-[#FF5934]" />
                  <span className="text-[12px] font-semibold text-[#FF5934]">{selectedRetObj.shopName || selectedRetObj.name}</span>
                  <button onClick={() => setSelectedRetailer('')} className="text-[#FF5934]/50 hover:text-[#FF5934] ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedSPObj && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                  <MdPerson size={12} className="text-emerald-500" />
                  <span className="text-[12px] font-semibold text-emerald-600">{selectedSPObj.name}</span>
                  <button onClick={() => setSelectedSP('')} className="text-emerald-400 hover:text-emerald-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#9CA3AF]">Fetching recovery entries from ledgers…</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && generated && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label:'Total Recovered', value:`Rs. ${fmt(stats.totalAmount)}`, color:'text-emerald-600', bg:'bg-emerald-50', Icon:MdAttachMoney },
                { label:'Approved',        value:stats.approved,                  color:'text-green-600',   bg:'bg-green-50',   Icon:MdCheckCircle },
                { label:'Pending',         value:stats.pending,                   color:'text-amber-600',   bg:'bg-amber-50',   Icon:MdBarChart },
                { label:'Total Records',   value:stats.count,                     color:'text-[#FF5934]',   bg:'bg-[#FF5934]/10', Icon:MdStorefront },
              ].map(({ label, value, color, bg, Icon }) => (
                <div key={label} className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex items-center gap-4">
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

            {/* Search bar */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm shadow-sm">
                <MdSearch size={16} className="text-[#9CA3AF] flex-shrink-0" />
                <input type="search" value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Search retailer, salesperson, A/C no…"
                  className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                {searchTerm && (
                  <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="text-[#9CA3AF] hover:text-[#FF5934]">
                    <MdClose size={13} />
                  </button>
                )}
              </div>
              <p className="text-[12px] text-[#9CA3AF] flex-shrink-0">
                {filtered.length !== reportData.length
                  ? `${filtered.length} of ${reportData.length} records`
                  : `${reportData.length} record${reportData.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {filtered.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdAttachMoney size={22} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">
                    {searchTerm ? 'No records match your search' : 'No recovery payments found'}
                  </p>
                  {(searchTerm || statusFilter) && (
                    <button onClick={() => { setSearchTerm(''); setStatusFilter(''); }} className="text-[#FF5934] text-xs hover:underline">Clear filters</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {['#','A/C No.','Retailer / City','Salesperson','Amount (Rs.)','Date','Status'].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map((row, i) => {
                          const n = (currentPage - 1) * ROWS_PER_PAGE + i + 1;
                          return (
                            <tr key={row._id || i} className="table-row">
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-bold text-[#C4C9D4]">{n}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                  {row.accountNo}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[13px] font-semibold text-[#111827] leading-tight">{row.retailerName}</p>
                                <p className="text-[11px] text-[#9CA3AF]">{row.city || '—'}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[#FF5934] text-[9px] font-bold">{(row.salesPerson[0] || '?').toUpperCase()}</span>
                                  </div>
                                  <span className="text-[13px] text-[#374151] font-medium">{row.salesPerson}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-[13px] font-bold text-emerald-600">Rs. {fmt(row.amount)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[12px] text-[#6B7280] font-medium">{row.displayDate}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadge(row.status)}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Recovered (filtered)</p>
                      <p className="text-[16px] font-bold text-emerald-600">Rs. {fmt(stats.totalAmount)}</p>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          <GrFormPrevious size={16} />
                        </button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                          <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-[#374151]">{totalPages}</span>
                        </div>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                          <GrFormNext size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ReportsRecovery;