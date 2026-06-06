import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getRetailerLedgerById, getAllRetailers, getAllSalesPersons, getAllCities, approveLedger, rejectLedger } from '../APIS';
import { toast } from 'react-toastify';
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdCalendarToday,
  MdFilterList, MdBarChart, MdCheckCircle, MdDownload,
  MdStorefront, MdAttachMoney, MdGroup, MdExpandMore, MdDateRange,
  MdTrendingUp, MdFileDownload,
} from 'react-icons/md';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import { FaRegEye } from 'react-icons/fa6';
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

const isDebitEntry = (ledger) => {
  if (!ledger.type) return parseFloat(ledger.amount || 0) > 0;
  const t = ledger.type.toUpperCase().trim();
  if (t === 'PAYMENT' || t === 'CREDIT' || t === 'CR' || t === 'RETURN') return false;
  return true;
};

/* ── Recovery row: unapproved, non-imported, debit entries ── */
const isRecoveryEntry = (ledger) => {
  if (!isDebitEntry(ledger)) return false;
  const drNum = parseFloat(String(ledger.amount || '0').replace(/[^0-9.-]/g, ''));
  return (
    ledger.isApproved === false &&
    ledger.isImportedFromExcel !== true &&
    !isNaN(drNum) &&
    drNum > 0
  );
};

const ROWS_PER_PAGE = 15;

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsDebit = () => {
  /* data */
  const [reportData, setReportData]       = useState([]);
  const [recoveryData, setRecoveryData]   = useState([]);
  const [loading, setLoading]             = useState(false);
  const [generated, setGenerated]         = useState(false);

  /* active tab: 'debit' | 'recovery' */
  const [activeTab, setActiveTab] = useState('debit');

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
  const [typeFilter, setTypeFilter]             = useState('');
  const [datePreset, setDatePreset]             = useState('all');

  /* dropdown open state */
  const [retDropOpen, setRetDropOpen]   = useState(false);
  const [retSearch, setRetSearch]       = useState('');
  const [spDropOpen, setSpDropOpen]     = useState(false);
  const [spSearch, setSpSearch]         = useState('');
  const [dateDropOpen, setDateDropOpen] = useState(false);

  /* pagination */
  const [currentPage, setCurrentPage]       = useState(1);
  const [recoveryPage, setRecoveryPage]     = useState(1);

  /* recovery action statuses — keyed by ledger _id */
  const [actionStatuses, setActionStatuses] = useState({});

  /* recovery image drawer */
  const [isDrawerOpen, setIsDrawerOpen]     = useState(false);
  const [drawerImageSrc, setDrawerImageSrc] = useState(null);

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
     CORE FETCH — builds both debit rows AND recovery rows
  ──────────────────────────────────────────────────────────── */
  const fetchReport = useCallback(async ({
    sd = '', ed = '', ret = '', sp = '', city = '',
  } = {}) => {
    setLoading(true);
    setGenerated(false);
    setReportData([]);
    setRecoveryData([]);

    try {
      let targetRetailers = retailers;

      if (ret) {
        targetRetailers = retailers.filter(r => r._id === ret);
      } else if (city) {
        targetRetailers = retailers.filter(r => {
          const cid = typeof r.city === 'object' ? r.city?._id : r.city;
          return cid === city;
        });
      } else if (sp) {
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

      const debitRows    = [];
      const recoveryRows = [];

      const results = await Promise.allSettled(
        targetRetailers.slice(0, 30).map(retailer =>
          getRetailerLedgerById(retailer._id).then(res => {
            let ledgers = [];
            if (Array.isArray(res))               ledgers = res;
            else if (Array.isArray(res?.ledgers)) ledgers = res.ledgers;
            else if (Array.isArray(res?.data))    ledgers = res.data;
            else {
              for (const k of Object.keys(res || {})) {
                if (Array.isArray(res[k])) { ledgers = res[k]; break; }
              }
            }
            return { retailer, ledgers };
          })
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
        const accountNo = retailer.userId || retailer.accountNo || '—';

        ledgers.forEach(ledger => {
          const dateKey = toDateKey(ledger.date || ledger.createdAt);

          /* ── RECOVERY rows: unapproved debit entries ── */
          if (isRecoveryEntry(ledger)) {
            recoveryRows.push({
              _id:         ledger._id || ledger.transactionId,
              id:          ledger._id || ledger.transactionId,
              accountNo,
              retailerName,
              city:        retailerCity,
              salesPerson: spName,
              amount:      parseFloat(ledger.amount || 0),
              date:        dateKey,
              displayDate: displayDate(ledger.date || ledger.createdAt),
              details:     ledger.description || ledger.details || '—',
              refNo:       ledger.refNo || '—',
              voucherNo:   ledger.voucherNo || '—',
              quantity:    ledger.quantity ?? null,
              balance:     parseFloat(ledger.balance || 0),
              isApproved:  ledger.isApproved === false ? false : true,
              isRejected:  ledger.isRejected === true,
              isImported:  ledger.isImportedFromExcel === true,
              image:       ledger.image || null,
              type:        (ledger.type || 'DEBIT').toUpperCase(),
            });
            return; // don't also put it in debit rows
          }

          /* ── DEBIT rows (approved / non-recovery) ── */
          if (!isDebitEntry(ledger)) return;

          /* date range filter */
          if (sd && dateKey && dateKey < sd) return;
          if (ed && dateKey && dateKey > ed) return;

          const status = ledger.isRejected
            ? 'Rejected'
            : ledger.isApproved === false
              ? 'Pending'
              : 'Approved';

          const entryType = (ledger.type || 'PURCHASE').toUpperCase();

          debitRows.push({
            _id:         ledger._id || ledger.transactionId,
            accountNo,
            retailerName,
            city:        retailerCity,
            salesPerson: spName,
            amount:      parseFloat(ledger.amount || 0),
            date:        dateKey,
            displayDate: displayDate(ledger.date || ledger.createdAt),
            status,
            type:        entryType,
            details:     ledger.description || ledger.details || '—',
            refNo:       ledger.refNo || '—',
            balance:     parseFloat(ledger.balance || 0),
          });
        });
      });

      debitRows.sort((a, b) => (b.date > a.date ? 1 : -1));
      recoveryRows.sort((a, b) => (b.date > a.date ? 1 : -1));

      setReportData(debitRows);
      setRecoveryData(recoveryRows);
      setGenerated(true);
      setCurrentPage(1);
      setRecoveryPage(1);

      if (!debitRows.length && !recoveryRows.length) {
        toast.info('No entries found for the selected filters');
      }
    } catch (err) {
      console.error('ReportsDebit fetch error:', err);
      toast.error('Failed to fetch data');
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

  useEffect(() => {
    if (retailers.length) fetchReport({});
  }, [retailers.length]);

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
    setSearchTerm(''); setStatusFilter(''); setTypeFilter('');
    setRetSearch(''); setSpSearch('');
    setDatePreset('all'); setCurrentPage(1); setRecoveryPage(1);
    fetchReport({});
  };

  /* ── Client-side filter for Debit tab ── */
  const filtered = useMemo(() => {
    let data = reportData;
    if (statusFilter) data = data.filter(r => r.status === statusFilter);
    if (typeFilter)   data = data.filter(r => r.type   === typeFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter(r =>
        r.retailerName.toLowerCase().includes(q) ||
        r.salesPerson.toLowerCase().includes(q)  ||
        String(r.accountNo).toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)          ||
        r.refNo.toLowerCase().includes(q)
      );
    }
    return data;
  }, [reportData, searchTerm, statusFilter, typeFilter]);

  /* ── Client-side filter for Recovery tab ── */
  const filteredRecovery = useMemo(() => {
    if (!searchTerm.trim()) return recoveryData;
    const q = searchTerm.toLowerCase();
    return recoveryData.filter(r =>
      r.retailerName.toLowerCase().includes(q) ||
      r.salesPerson.toLowerCase().includes(q)  ||
      String(r.accountNo).toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q)
    );
  }, [recoveryData, searchTerm]);

  /* ── Summary stats ── */
  const stats = useMemo(() => ({
    totalAmount: filtered.reduce((s, r) => s + r.amount, 0),
    approved:    filtered.filter(r => r.status === 'Approved').length,
    pending:     filtered.filter(r => r.status === 'Pending').length,
    rejected:    filtered.filter(r => r.status === 'Rejected').length,
    count:       filtered.length,
    types:       [...new Set(reportData.map(r => r.type))].sort(),
    recoveryTotal: recoveryData.reduce((s, r) => s + r.amount, 0),
    recoveryCount: recoveryData.length,
  }), [filtered, reportData, recoveryData]);

  /* ── Pagination ── */
  const totalPages    = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated     = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const recoveryTotalPages = Math.max(1, Math.ceil(filteredRecovery.length / ROWS_PER_PAGE));
  const recoveryPaginated  = filteredRecovery.slice((recoveryPage - 1) * ROWS_PER_PAGE, recoveryPage * ROWS_PER_PAGE);

  /* ── Export debit ── */
  const handleExport = () => {
    if (!filtered.length) { toast.info('No data to export'); return; }
    const rows = filtered.map(r => ({
      'A/C No.':     r.accountNo,
      'Retailer':    r.retailerName,
      'Salesperson': r.salesPerson,
      'City':        r.city,
      'Type':        r.type,
      'Amount (Rs)': r.amount,
      'Date':        r.displayDate,
      'Status':      r.status,
      'Ref No.':     r.refNo,
      'Details':     r.details,
    }));
    rows.push({
      'A/C No.': 'TOTAL', 'Retailer': '', 'Salesperson': '', 'City': '', 'Type': '',
      'Amount (Rs)': stats.totalAmount, 'Date': '', 'Status': '', 'Ref No.': '', 'Details': '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch:12 },{ wch:28 },{ wch:20 },{ wch:15 },{ wch:12 },{ wch:15 },{ wch:14 },{ wch:12 },{ wch:14 },{ wch:22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Recovery Report');
    const suffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all-time';
    XLSX.writeFile(wb, `Debit_Report_${suffix}.xlsx`);
    toast.success('Report exported');
  };

  /* ── Recovery: approve ── */
  const handleApproveAction = async (row) => {
    try {
      if (!row?.id) { toast.error('Missing ledger ID'); return; }
      setActionStatuses(prev => ({ ...prev, [row.id]: 'loading' }));
      const res = await approveLedger(String(row.id), { isApproved: true });
      if (res?.success) toast.success(res?.msg || 'Approved and moved to Ledger');
      else toast.info(res?.msg || 'Approval processed');
      setActionStatuses(prev => ({ ...prev, [row.id]: 'approved' }));
      /* optimistically remove from recoveryData */
      setRecoveryData(prev => prev.filter(r => r.id !== row.id));
    } catch (err) {
      setActionStatuses(prev => ({ ...prev, [row.id]: undefined }));
      toast.error(err?.response?.data?.msg || 'Failed to approve entry');
    }
  };

  /* ── Recovery: reject ── */
  const handleRejectAction = async (row) => {
    try {
      if (!row?.id) { toast.error('Missing ledger ID'); return; }
      setActionStatuses(prev => ({ ...prev, [row.id]: 'loading' }));
      const res = await rejectLedger(String(row.id), { isRejected: true });
      if (res?.success) toast.success(res?.msg || 'Entry rejected');
      else toast.info(res?.msg || 'Rejection processed');
      setActionStatuses(prev => ({ ...prev, [row.id]: 'rejected' }));
      /* keep in list but mark rejected — matches LedgerSales behaviour */
      setRecoveryData(prev => prev.map(r => r.id === row.id ? { ...r, isRejected: true } : r));
    } catch (err) {
      setActionStatuses(prev => ({ ...prev, [row.id]: undefined }));
      toast.error(err?.response?.data?.msg || err.message || 'Failed to reject entry');
    }
  };

  /* ── Recovery: view image ── */
  const handleViewImage = (row) => {
    setDrawerImageSrc(row?.image || null);
    setIsDrawerOpen(true);
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

  /* ── Badges ── */
  const statusBadge = (s) => {
    if (s === 'Approved') return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200';
    if (s === 'Rejected') return 'bg-red-50 text-red-600 ring-1 ring-red-200';
    return 'bg-amber-50 text-amber-600 ring-1 ring-amber-200';
  };

  const typeBadge = (t) => {
    if (t === 'PURCHASE') return 'bg-[#FF5934]/10 text-[#FF5934]';
    if (t === 'INVOICE')  return 'bg-blue-50 text-blue-600';
    if (t === 'SALE')     return 'bg-purple-50 text-purple-600';
    if (t === 'ORDER')    return 'bg-sky-50 text-sky-600';
    return 'bg-gray-100 text-gray-500';
  };

  /* ── Tab button ── */
  const TabBtn = ({ id, children }) => (
    <button
      onClick={() => { setActiveTab(id); setSearchTerm(''); }}
      className={`px-4 py-2.5 text-[13px] font-semibold rounded-t-xl transition-all duration-150 border-b-2
        ${activeTab === id
          ? 'border-[#FF5934] text-[#FF5934] bg-white'
          : 'border-transparent text-[#9CA3AF] hover:text-[#374151] hover:bg-gray-50'
        }`}
    >
      {children}
    </button>
  );

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
          transition:border-color 0.15s, box-shadow 0.15s;
        }
        .rr-input:focus { border-color:#FF5934; box-shadow:0 0 0 3px rgba(255,89,52,0.1); }
        .rr-no-scroll::-webkit-scrollbar { display:none; }
        .rr-no-scroll { scrollbar-width:none; }
        .rr-dropdown { position:relative; }
        @keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .rr-drawer { animation: drawerIn 0.25s cubic-bezier(0.34,1.1,0.64,1); }
      `}</style>

      <div className="rr-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Customer Recovery Report</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {generated
                ? `${stats.count} debit entries · ${stats.recoveryCount} recovery entries · ${presetLabel()}${selectedRetObj ? ` · ${selectedRetObj.shopName || selectedRetObj.name}` : ''}`
                : 'Select filters and generate report'}
            </p>
          </div>
          {generated && activeTab === 'debit' && filtered.length > 0 && (
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

            {/* Date preset */}
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

            {/* Custom date inputs */}
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

            {/* Retailer picker */}
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

            {/* Salesperson picker */}
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

            {/* Status filter (debit tab only) */}
            {activeTab === 'debit' && (
              <div className="flex-1 min-w-[140px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdCheckCircle size={12} className="text-[#FF5934]" /> Status
                </label>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="rr-input"
                  style={{ appearance:'none', paddingRight:28,
                    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}>
                  <option value="">All Statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            )}

            {/* Type filter */}
            {activeTab === 'debit' && stats.types.length > 1 && (
              <div className="flex-1 min-w-[140px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdTrendingUp size={12} className="text-[#FF5934]" /> Entry Type
                </label>
                <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                  className="rr-input"
                  style={{ appearance:'none', paddingRight:28,
                    backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center' }}>
                  <option value="">All Types</option>
                  {stats.types.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {/* Buttons */}
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

          {/* Active filter chips */}
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

        {/* Loading */}
        {loading && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-20 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[#9CA3AF]">Fetching ledger entries…</p>
          </div>
        )}

        {/* Results */}
        {!loading && generated && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label:'Total Debit',      value:`Rs. ${fmt(stats.totalAmount)}`, color:'text-[#FF5934]',   bg:'bg-[#FF5934]/10', Icon:MdTrendingUp  },
                { label:'Approved',         value:stats.approved,                  color:'text-emerald-600', bg:'bg-emerald-50',   Icon:MdCheckCircle },
                { label:'Pending Recovery', value:stats.recoveryCount,             color:'text-amber-600',   bg:'bg-amber-50',     Icon:MdBarChart    },
                { label:'Total Records',    value:stats.count,                     color:'text-blue-600',    bg:'bg-blue-50',      Icon:MdAttachMoney },
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

            {/* Tab bar + Search row */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 pt-3">
                <div className="flex gap-1">
                  <TabBtn id="debit">
                    <span className="flex items-center gap-1.5">
                      <MdTrendingUp size={14} /> Debit
                      <span className="ml-1 bg-[#FF5934]/10 text-[#FF5934] text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats.count}</span>
                    </span>
                  </TabBtn>
                  <TabBtn id="recovery">
                    <span className="flex items-center gap-1.5">
                      <MdBarChart size={14} /> Recovery
                      {stats.recoveryCount > 0 && (
                        <span className="ml-1 bg-amber-100 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{stats.recoveryCount}</span>
                      )}
                    </span>
                  </TabBtn>
                </div>
                {/* Search */}
                <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5 mb-2 w-64">
                  <MdSearch size={15} className="text-[#9CA3AF] flex-shrink-0" />
                  <input type="search" value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); setRecoveryPage(1); }}
                    placeholder="Search retailer, salesperson…"
                    className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
                  {searchTerm && (
                    <button onClick={() => { setSearchTerm(''); setCurrentPage(1); setRecoveryPage(1); }} className="text-[#9CA3AF] hover:text-[#FF5934]">
                      <MdClose size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* ═══════ DEBIT TAB ═══════ */}
              {activeTab === 'debit' && (
                <>
                  {filtered.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdTrendingUp size={22} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">
                        {searchTerm ? 'No records match your search' : 'No debit entries found'}
                      </p>
                      {(searchTerm || statusFilter || typeFilter) && (
                        <button onClick={() => { setSearchTerm(''); setStatusFilter(''); setTypeFilter(''); }}
                          className="text-[#FF5934] text-xs hover:underline">Clear filters</button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#FAFAFA] border-b border-gray-100">
                              {['#','A/C No.','Retailer / Site','Salesperson','Amount (Rs.)','Date','Status'].map(h => (
                                <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {paginated.map((row, i) => {
                              const n = (currentPage - 1) * ROWS_PER_PAGE + i + 1;
                              return (
                                <tr key={row._id || i} className="table-row">
                                  <td className="px-4 py-3"><span className="text-[12px] font-bold text-[#C4C9D4]">{n}</span></td>
                                  <td className="px-4 py-3">
                                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">{row.accountNo}</span>
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
                                  {/* <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${typeBadge(row.type)}`}>{row.type}</span>
                                  </td> */}
                                  <td className="px-4 py-3 text-center -translate-x-12">
                                    <span className="text-[13px] font-bold text-[#FF5934]">Rs. {fmt(row.amount)}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[12px] text-[#6B7280] font-medium">{row.displayDate}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadge(row.status)}`}>{row.status}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Debit footer */}
                      <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Debit (filtered)</p>
                          <p className="text-[16px] font-bold text-[#FF5934]">Rs. {fmt(stats.totalAmount)}</p>
                        </div>
                        {totalPages > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                              <GrFormPrevious size={16} />
                            </button>
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                              <span className="text-gray-300">/</span>
                              <span className="text-[#374151]">{totalPages}</span>
                            </div>
                            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                              <GrFormNext size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ═══════ RECOVERY TAB ═══════ */}
              {activeTab === 'recovery' && (
                <>
                  {filteredRecovery.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdBarChart size={22} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">
                        {searchTerm ? 'No recovery entries match your search' : 'No pending recovery entries'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#FAFAFA] border-b border-gray-100">
                              {['#','A/C No.','Retailer / City','Salesperson','Ref No.','Amount (Rs.)','Date','Balance','Action'].map(h => (
                                <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {recoveryPaginated.map((row, i) => {
                              const n       = (recoveryPage - 1) * ROWS_PER_PAGE + i + 1;
                              const status  = actionStatuses[row.id];
                              const isRej   = row.isRejected === true || status === 'rejected';
                              const isApp   = status === 'approved';
                              const isLoad  = status === 'loading';

                              return (
                                <tr key={row._id || i} className="table-row">
                                  <td className="px-4 py-3"><span className="text-[12px] font-bold text-[#C4C9D4]">{n}</span></td>
                                  <td className="px-4 py-3">
                                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">{row.accountNo}</span>
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
                                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{row.refNo}</td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="text-[13px] font-bold text-emerald-600">Rs. {fmt(row.amount)}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[12px] text-[#6B7280] font-medium">{row.displayDate}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[13px] font-semibold text-[#111827]">Rs. {fmt(row.balance)}</span>
                                  </td>
                                  {/* Action — mirrors LedgerSales recovery tab exactly */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                      {isRej ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-600 ring-1 ring-red-200">Rejected</span>
                                      ) : isApp ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">Approved</span>
                                      ) : isLoad ? (
                                        <div className="w-5 h-5 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <>
                                          <button onClick={() => handleApproveAction(row)} title="Approve"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 transition-all">
                                            <AiOutlineCheck size={14} />
                                          </button>
                                          <button onClick={() => handleRejectAction(row)} title="Reject"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all">
                                            <AiOutlineClose size={14} />
                                          </button>
                                        </>
                                      )}
                                      <button onClick={() => handleViewImage(row)} title="View Image"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all">
                                        <FaRegEye size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Recovery footer */}
                      <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Recovery Amount</p>
                          <p className="text-[16px] font-bold text-amber-500">Rs. {fmt(stats.recoveryTotal)}</p>
                        </div>
                        {recoveryTotalPages > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button disabled={recoveryPage === 1} onClick={() => setRecoveryPage(p => p - 1)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                              <GrFormPrevious size={16} />
                            </button>
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                              <span className="font-semibold text-[#FF5934]">{recoveryPage}</span>
                              <span className="text-gray-300">/</span>
                              <span className="text-[#374151]">{recoveryTotalPages}</span>
                            </div>
                            <button disabled={recoveryPage >= recoveryTotalPages} onClick={() => setRecoveryPage(p => p + 1)}
                              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                              <GrFormNext size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════
          RECOVERY IMAGE DRAWER
      ════════════════════════════════════════ */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
          <div className="rr-drawer w-[380px] max-w-[90vw] bg-white h-full shadow-2xl overflow-auto flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-[#111827]">Recovery Image</h3>
              <button onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-[#9CA3AF] transition-colors">
                <AiOutlineClose size={16} />
              </button>
            </div>
            <div className="p-5 flex-1">
              {drawerImageSrc ? (
                <img src={drawerImageSrc} alt="Recovery" className="w-full h-auto rounded-2xl shadow-sm"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-[#9CA3AF] gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                    <MdFileDownload size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm">No image available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportsDebit;