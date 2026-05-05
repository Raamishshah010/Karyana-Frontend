import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getOrders, getAllSalesPersons, getAllCities, getAllRetailers } from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from '../components/common/loader';
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

const fmtQty = (n) => {
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toISOString().slice(0, 10);
};

const ROWS_PER_PAGE = 15;

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ReportsSales = () => {
  /* data */
  const [reportData, setReportData]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [generated, setGenerated]     = useState(false);

  /* filter options */
  const [salesPersons, setSalesPersons] = useState([]);
  const [cities, setCities]             = useState([]);
  const [retailers, setRetailers]       = useState([]);

  /* filter values */
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');
  const [selectedSP, setSelectedSP]     = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [datePreset, setDatePreset]     = useState('all');

  /* dropdowns */
  const [spDropOpen, setSpDropOpen] = useState(false);
  const [spSearch, setSpSearch]     = useState('');
  const [dateDropOpen, setDateDropOpen] = useState(false);

  /* pagination */
  const [currentPage, setCurrentPage] = useState(1);

  /* ── Core fetch using Orders API ── */
  const fetchReport = useCallback(async ({ sd = '', ed = '', sp = '', city = '', status = '' } = {}) => {
    setLoading(true);
    setGenerated(false);
    try {
      console.log('📥 Fetching orders...');
      const res = await getOrders(1, 500);
      console.log('✅ Orders API response:', res?.status, res?.data?.data?.length || 0, 'orders');
      
      let allOrders = res?.data?.data || [];
      
      if (!Array.isArray(allOrders)) {
        console.warn('⚠️ Orders response is not an array:', typeof allOrders);
        allOrders = [];
      }

      console.log(`📊 Got ${allOrders.length} orders from API`);

      // Filter orders based on criteria
      let filtered = allOrders;

      // Filter by date range
      if (sd || ed) {
        filtered = filtered.filter(o => {
          const orderDate = formatDate(o.createdAt || o.date);
          if (sd && orderDate < sd) return false;
          if (ed && orderDate > ed) return false;
          return true;
        });
        console.log(`📅 After date filter: ${filtered.length} orders`);
      }

      // Filter by sales person
      if (sp) {
        filtered = filtered.filter(o => {
          const spId = o.SaleUser?._id || o.salesPersonID?._id || o.SaleUser;
          return spId === sp;
        });
        console.log(`👤 After salesperson filter: ${filtered.length} orders`);
      }

      // Filter by city
      if (city) {
        filtered = filtered.filter(o => {
          const cityId = o.city?._id || o.cityID;
          return cityId === city;
        });
        console.log(`🏙️ After city filter: ${filtered.length} orders`);
      }

      // Filter by status
      if (status) {
        filtered = filtered.filter(o => o.status === status);
        console.log(`📦 After status filter: ${filtered.length} orders`);
      }

      // Transform to report format
      const reportRows = filtered.map(order => {
        const spName = order.SaleUser?.name || order.salesPersonName || 'Unknown';
        const customerName = order.RetailerUser?.shopName || order.customerName || 'Unknown';
        const total = parseFloat(order.total || 0);
        const items = order.items || [];
        const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

        return {
          _id: order._id,
          orderId: order.orderId,
          accountNo: order.RetailerUser?.userId || order.accountNo || '—',
          customerName: customerName,
          salesperson: spName,
          quantity: totalQty,
          total: total,
          date: formatDate(order.createdAt || order.date),
          status: order.status,
        };
      });

      console.log(`✨ Transformed to ${reportRows.length} report rows`);

      setReportData(reportRows);
      setGenerated(true);
      setCurrentPage(1);
      
      if (reportRows.length === 0 && (sd || ed || sp || city || status)) {
        toast.info('No orders found for the selected filters');
      }
    } catch (err) {
      console.error('❌ Error fetching report:', err?.response?.data || err?.message || err);
      toast.error('Failed to fetch report data');
      setReportData([]);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Load dropdowns + initial data on mount ── */
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Load dropdowns
        const [spRes, citRes, retRes] = await Promise.all([
          getAllSalesPersons(),
          getAllCities(),
          getAllRetailers(),
        ]);
        setSalesPersons(spRes?.data?.data || []);
        setCities(citRes?.data?.data || []);
        setRetailers(retRes?.data?.data || []);
        
        // Load initial report
        await fetchReport({});
      } catch (err) {
        console.error('Error initializing:', err);
      }
    };
    
    initializeData();
  }, [fetchReport]);

  /* ── Date preset helper ── */
  const applyDatePreset = (preset) => {
    setDateDropOpen(false);
    if (preset === 'custom') {
      setDatePreset('custom');
      return;
    }
    let today = new Date();
    let end = today.toISOString().slice(0, 10);
    let start = end;

    if (preset === 'today') {
      start = end;
    } else if (preset === 'week') {
      const d = new Date(today);
      d.setDate(today.getDate() - today.getDay());
      start = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    } else if (preset === 'all') {
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
    setDatePreset(preset);
  };

  const getPresetLabel = () => {
    if (datePreset === 'custom' && startDate && endDate) return `${startDate} → ${endDate}`;
    if (datePreset === 'custom' && startDate) return `From ${startDate}`;
    if (datePreset === 'custom' && endDate) return `Up to ${endDate}`;
    return { all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month', custom: 'Custom Dates' }[datePreset] || 'All Time';
  };

  const handleGenerate = () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error('"From" date must be before "To" date');
      return;
    }
    fetchReport({ sd: startDate, ed: endDate, sp: selectedSP, city: selectedCity, status: selectedStatus });
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setSelectedSP('');
    setSelectedCity('');
    setSelectedStatus('');
    setSearchCustomer('');
    setSpSearch('');
    setDatePreset('all');
    setCurrentPage(1);
    fetchReport({});
  };

  /* ── Client-side search ── */
  const filtered = useMemo(() => {
    if (!searchCustomer.trim()) return reportData;
    const q = searchCustomer.toLowerCase();
    return reportData.filter(r =>
      r.customerName.toLowerCase().includes(q) ||
      r.salesperson.toLowerCase().includes(q) ||
      String(r.accountNo).toLowerCase().includes(q)
    );
  }, [reportData, searchCustomer]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const totalQty = filtered.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
    const totalAmt = filtered.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    const uniqueSP = new Set(filtered.map(r => r.salesperson)).size;
    return { totalQty, totalAmt, uniqueSP, count: filtered.length };
  }, [filtered]);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  /* ── Export ── */
  const handleExport = () => {
    if (!filtered.length) {
      toast.info('No data to export');
      return;
    }
    const rows = filtered.map(r => ({
      'A/C No.': r.accountNo,
      'Customer': r.customerName,
      'Salesperson': r.salesperson,
      'Quantity': parseFloat(r.quantity || 0),
      'Total (Rs)': parseFloat(r.total || 0),
      'Date': r.date,
      'Status': r.status,
    }));
    rows.push({
      'A/C No.': 'TOTAL',
      'Customer': '',
      'Salesperson': '',
      'Quantity': stats.totalQty,
      'Total (Rs)': stats.totalAmt,
      'Date': '',
      'Status': '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 45 }, { wch: 25 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sale Summary');
    const fileSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : 'all-time';
    XLSX.writeFile(wb, `Sale_Summary_${fileSuffix}.xlsx`);
    toast.success('Report exported');
  };

  /* ── Helpers ── */
  const selectedSPObj  = salesPersons.find(s => s._id === selectedSP);
  const filteredSPList = salesPersons.filter(s =>
    (s.name || '').toLowerCase().includes(spSearch.toLowerCase())
  );

  /* ── Active filter count for badge ── */
  const activeFilterCount = [selectedSP, selectedCity, selectedStatus, startDate || endDate, datePreset !== 'all'].filter(Boolean).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .rs-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .rs-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .rs-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .rs-page .rs-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .rs-input {
          background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px;
          padding: 10px 14px; font-size: 13px; color: #111827; outline: none;
          font-family: 'DM Sans', sans-serif; width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .rs-input:focus { border-color: #FF5934; box-shadow: 0 0 0 3px rgba(255,89,52,0.1); }
        .rs-input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
        .rs-no-scroll::-webkit-scrollbar { display: none; }
        .rs-no-scroll { scrollbar-width: none; }
        .rs-stat-card { transition: transform 0.15s, box-shadow 0.15s; }
        .rs-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
      `}</style>

      <div className="rs-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Sale Summary — By Customers</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {generated
                ? startDate && endDate
                  ? `${startDate} → ${endDate}${selectedSPObj ? ` · ${selectedSPObj.name}` : ''}`
                  : `All time${selectedSPObj ? ` · ${selectedSPObj.name}` : ''}`
                : 'Loading orders…'}
            </p>
          </div>
          {generated && filtered.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
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

            {/* Date Preset Dropdown */}
            <div className="flex-1 min-w-[220px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdCalendarToday size={12} className="text-[#FF5934]" /> Date Range
              </label>
              <div className="relative">
                <div
                  className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                  onClick={() => setDateDropOpen(p => !p)}
                >
                  <span className="text-[13px] text-[#111827] font-medium flex-1">{getPresetLabel()}</span>
                  <MdExpandMore size={18} className={`text-[#9CA3AF] transition-transform ${dateDropOpen ? 'rotate-180' : ''}`} />
                </div>

                {dateDropOpen && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                    {[['all', 'All Time'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom Dates']].map(([p, l]) => (
                      <button key={p} onClick={() => applyDatePreset(p)}
                        className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-orange-50 transition-colors flex items-center gap-2 border-b border-gray-50 last:border-0 ${datePreset === p ? 'text-[#FF5934] font-semibold bg-orange-50' : 'text-[#111827]'}`}>
                        <MdCheckCircle size={14} className={datePreset === p ? 'text-[#FF5934]' : 'text-transparent'} />
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Date Inputs */}
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
                  <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className="rs-input" />
                </div>
              </>
            )}

            {/* Sales Person Picker */}
            <div className="flex-1 min-w-[200px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdPerson size={12} className="text-[#FF5934]" /> Salesperson
              </label>
              <div className="relative">
                <div
                  className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer hover:border-[#FF5934] transition-all"
                  onClick={() => setSpDropOpen(p => !p)}
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
                    <div className="max-h-52 overflow-y-auto rs-no-scroll">
                      <div
                        onClick={() => { setSelectedSP(''); setSpDropOpen(false); setSpSearch(''); }}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${!selectedSP ? 'bg-orange-50' : ''}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <MdGroup size={14} className="text-gray-400" />
                        </div>
                        <p className="text-[13px] font-medium text-[#374151]">All Salespersons</p>
                        {!selectedSP && <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0 ml-auto" />}
                      </div>
                      {filteredSPList.map(sp => (
                        <div key={sp._id}
                          onClick={() => { setSelectedSP(sp._id); setSpDropOpen(false); setSpSearch(''); }}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-orange-50 transition-colors ${selectedSP === sp._id ? 'bg-orange-50' : ''}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[#FF5934] text-[11px] font-bold">{(sp.name || '?')[0].toUpperCase()}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[#111827] truncate">{sp.name}</p>
                            <p className="text-[11px] text-[#9CA3AF] truncate">{sp.email}</p>
                          </div>
                          {selectedSP === sp._id && <MdCheckCircle size={15} className="text-[#FF5934] flex-shrink-0" />}
                        </div>
                      ))}
                      {filteredSPList.length === 0 && (
                        <div className="py-6 text-center text-[13px] text-[#9CA3AF]">No results</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* City */}
            {cities.length > 0 && (
              <div className="flex-1 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                  <MdLocationOn size={12} className="text-[#FF5934]" /> City
                </label>
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                  className="rs-input rs-select">
                  <option value="">All Cities</option>
                  {cities.map(c => <option key={c._id} value={c._id}>{c.name || c.cityName}</option>)}
                </select>
              </div>
            )}

            {/* Status */}
            <div className="flex-1 min-w-[150px]">
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                <MdBarChart size={12} className="text-[#FF5934]" /> Status
              </label>
              <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
                className="rs-input rs-select">
                <option value="">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Satelment">Satelment</option>
                <option value="Delivered">Delivered</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

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
          {(selectedSPObj || selectedCity || selectedStatus || startDate || endDate || datePreset !== 'all') && (
            <div className="mt-4 flex flex-wrap gap-2">
              {datePreset !== 'all' && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                  <MdCalendarToday size={12} className="text-blue-500" />
                  <span className="text-[12px] font-semibold text-blue-600">{getPresetLabel()}</span>
                  <button onClick={() => { setDatePreset('all'); setStartDate(''); setEndDate(''); }} className="text-blue-400 hover:text-blue-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedSPObj && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#FF5934]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FF5934] text-[9px] font-bold">{(selectedSPObj.name || '?')[0].toUpperCase()}</span>
                  </div>
                  <span className="text-[12px] font-semibold text-[#FF5934]">{selectedSPObj.name}</span>
                  <button onClick={() => setSelectedSP('')} className="text-[#FF5934]/50 hover:text-[#FF5934] ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedCity && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5">
                  <MdLocationOn size={12} className="text-emerald-500" />
                  <span className="text-[12px] font-semibold text-emerald-600">
                    {cities.find(c => c._id === selectedCity)?.name || selectedCity}
                  </span>
                  <button onClick={() => setSelectedCity('')} className="text-emerald-400 hover:text-emerald-600 ml-1"><MdClose size={13} /></button>
                </div>
              )}
              {selectedStatus && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-1.5">
                  <MdBarChart size={12} className="text-purple-500" />
                  <span className="text-[12px] font-semibold text-purple-600">{selectedStatus}</span>
                  <button onClick={() => setSelectedStatus('')} className="text-purple-400 hover:text-purple-600 ml-1"><MdClose size={13} /></button>
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
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { icon: MdStorefront, label: 'Customers',    value: stats.count.toLocaleString(),   color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10' },
                { icon: MdGroup,      label: 'Salespersons', value: stats.uniqueSP.toLocaleString(), color: 'text-blue-500',    bg: 'bg-blue-50' },
                { icon: MdTrendingUp, label: 'Total Qty',    value: fmtQty(stats.totalQty),          color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { icon: MdBarChart,   label: 'Total Amount', value: `Rs. ${fmt(stats.totalAmt)}`,    color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
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

            {/* Search inside results */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm shadow-sm">
                <MdSearch size={16} className="text-[#9CA3AF] flex-shrink-0" />
                <input
                  type="search" value={searchCustomer}
                  onChange={e => { setSearchCustomer(e.target.value); setCurrentPage(1); }}
                  placeholder="Search customer, salesperson, A/C no…"
                  className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                />
                {searchCustomer && (
                  <button onClick={() => { setSearchCustomer(''); setCurrentPage(1); }} className="text-[#9CA3AF] hover:text-[#FF5934]">
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
                    <MdStorefront size={22} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">
                    {searchCustomer ? 'No records match your search' : 'No data found'}
                  </p>
                  {searchCustomer && (
                    <button onClick={() => setSearchCustomer('')} className="text-[#FF5934] text-xs hover:underline">Clear search</button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-20">#</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-28">A/C No.</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Customer</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Salesperson</th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Quantity</th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Total (Rs.)</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {paginated.map((row, i) => {
                          const rowNum   = (currentPage - 1) * ROWS_PER_PAGE + i + 1;
                          const qty      = parseFloat(row.quantity || 0);
                          const total    = parseFloat(row.total || 0);
                          const isNegAmt = total < 0;
                          const isNegQty = qty < 0;

                          return (
                            <tr key={row._id} className="table-row">
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-bold text-[#C4C9D4]">{rowNum}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                  {row.accountNo}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-[13px] font-semibold text-[#111827] leading-tight">{row.customerName}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[#FF5934] text-[9px] font-bold">
                                      {(row.salesperson[0] || '?').toUpperCase()}
                                    </span>
                                  </div>
                                  <span className="text-[13px] text-[#374151] font-medium">{row.salesperson}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[13px] font-semibold ${isNegQty ? 'text-red-500' : 'text-[#111827]'}`}>
                                  {fmtQty(qty)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[13px] font-bold ${isNegAmt ? 'text-red-500' : 'text-[#111827]'}`}>
                                  {isNegAmt ? '(' : ''}Rs.&nbsp;{fmt(Math.abs(total))}{isNegAmt ? ')' : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer: totals + pagination */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Qty</p>
                        <p className="text-[14px] font-bold text-[#111827]">{fmtQty(stats.totalQty)}</p>
                      </div>
                      <div className="w-px h-8 bg-gray-200" />
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Amount</p>
                        <p className="text-[14px] font-bold text-[#FF5934]">Rs. {fmt(stats.totalAmt)}</p>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                        ><GrFormPrevious size={16} /></button>
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                          <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-[#374151]">{totalPages}</span>
                        </div>
                        <button
                          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                        ><GrFormNext size={16} /></button>
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

export default ReportsSales;