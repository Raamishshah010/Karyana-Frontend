import { useEffect, useState, useMemo } from 'react';
import { getAllPurchaseInvoices, getAllPurchases } from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  MdSearch, MdFilterList, MdClose, MdRefresh,
  MdAddCircleOutline, MdReceipt, MdCalendarToday,
  MdBusiness, MdLocalShipping, MdInventory2,
  MdArrowBack, MdAttachMoney, MdExpandMore, MdExpandLess,
} from "react-icons/md";
import { FaRegEye } from "react-icons/fa6";
import { Link } from 'react-router-dom';

const LIMIT = 10;
const DASH  = '—';

const formatPKR = (value) =>
  `PKR ${Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

const EmptyState = ({ message = 'No purchases found' }) => (
  <div className="py-16 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <MdReceipt size={24} className="text-gray-300" />
      </div>
      <p className="text-[#9CA3AF] text-sm font-medium">{message}</p>
    </div>
  </div>
);

const PaginationBar = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
    <p className="text-[12px] text-[#9CA3AF]">Page {page} of {totalPages || 1}</p>
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={page === 1} onClick={onPrev}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormPrevious size={16} />
      </button>
      <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
        <span className="font-semibold text-[#FF5934]">{page}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[#374151]">{totalPages || 1}</span>
      </div>
      <button type="button" disabled={page >= totalPages} onClick={onNext}
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormNext size={16} />
      </button>
    </div>
  </div>
);

/* ── Detail Slide-over ── */
const DetailPanel = ({ invoice, onClose }) => {
  if (!invoice) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-5 pt-5 pb-8 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Purchase Invoice</p>
              <h2 className="text-white text-lg font-bold">#{invoice.invoiceId || invoice._id?.slice(0, 8)}</h2>
              <p className="text-white/60 text-[12px] mt-1">{invoice.companyName || DASH}</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0">
              <MdClose size={16} />
            </button>
          </div>
        </div>

        {/* Summary cards row */}
        <div className="grid grid-cols-2 gap-3 mx-5 -mt-5 z-10 relative flex-shrink-0">
          {[
            { label: 'Total',   value: formatPKR(invoice.totalAmount), color: 'text-[#FF5934]' },
            { label: 'Items',   value: invoice.itemCount ?? 0,          color: 'text-[#111827]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
              <p className={`text-[14px] font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 flex flex-col gap-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>

          {/* Invoice Info */}
          <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Invoice Info</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-3">
              {[
                { label: 'Bill No',      value: invoice.billNo       || DASH },
                { label: 'Date',         value: invoice.date         || DASH },
                { label: 'Due Date',     value: invoice.dueDate      || DASH },
                { label: 'Bilty No',     value: invoice.biltyNumber  || DASH },
                { label: 'Vehicle No',   value: invoice.vehicleNumber|| DASH },
                { label: 'Freight',      value: invoice.freightAmount ? formatPKR(invoice.freightAmount) : DASH },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-[13px] font-semibold text-[#374151] break-words">{value}</p>
                </div>
              ))}
            </div>
            {invoice.details && (
              <div className="px-4 pb-3 border-t border-gray-100 pt-3">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Details / Notes</p>
                <p className="text-[13px] text-[#374151]">{invoice.details}</p>
              </div>
            )}
          </div>

          {/* Items */}
          {Array.isArray(invoice.rawItems) && invoice.rawItems.length > 0 && (
            <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Items</p>
                <span className="text-[11px] font-bold text-[#FF5934]">{invoice.rawItems.length} items</span>
              </div>
              <div className="px-4 py-3 flex flex-col gap-2">
                {invoice.rawItems.map((item, i) => {
                  const name  = item.product?.englishTitle || item.product?.urduTitle || item.productName || `Item ${i + 1}`;
                  const qty   = item.quantity   || 0;
                  const rate  = item.purchaseRate|| 0;
                  const disc  = item.purchaseDiscount || 0;
                  const total = item.amount || (qty * rate * (1 - disc / 100));
                  return (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[#111827] truncate">{name}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[11px] text-[#9CA3AF]">Qty: <strong className="text-[#374151]">{qty}</strong></span>
                            <span className="text-[11px] text-[#9CA3AF]">Rate: <strong className="text-[#374151]">PKR {Number(rate).toLocaleString('en-PK')}</strong></span>
                            {disc > 0 && <span className="text-[11px] text-[#9CA3AF]">Disc: <strong className="text-amber-500">{disc}%</strong></span>}
                          </div>
                        </div>
                        <span className="text-[13px] font-bold text-[#FF5934] whitespace-nowrap flex-shrink-0">
                          PKR {Number(total).toLocaleString('en-PK')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Items total */}
              <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center bg-white rounded-b-2xl">
                <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total Amount</span>
                <span className="text-[15px] font-bold text-[#FF5934]">{formatPKR(invoice.totalAmount)}</span>
              </div>
            </div>
          )}

          {/* Freight summary */}
          {(invoice.freightAmount > 0) && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MdLocalShipping size={16} className="text-amber-500" />
                <span className="text-[12px] font-semibold text-amber-700">Freight / Carriage</span>
              </div>
              <span className="text-[13px] font-bold text-amber-700">{formatPKR(invoice.freightAmount)}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="w-full h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all shadow-md shadow-orange-100">
            Close
          </button>
        </div>
      </div>
    </>
  );
};

/* ── Mobile card ── */
const PurchaseMobileCard = ({ item, onView }) => (
  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[#111827] truncate">{item.companyName || DASH}</p>
        <p className="text-[11px] text-[#9CA3AF] mt-0.5">Bill #{item.billNo || item.invoiceId || DASH}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[12px] font-bold text-[#FF5934] bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-full whitespace-nowrap">
          {formatPKR(item.totalAmount)}
        </span>
        <button onClick={() => onView(item)}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all">
          <FaRegEye size={13} />
        </button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: 'Date',    value: item.date          || DASH },
        { label: 'Due',     value: item.dueDate       || DASH },
        { label: 'Bilty',   value: item.biltyNumber   || DASH },
        { label: 'Vehicle', value: item.vehicleNumber || DASH },
        { label: 'Items',   value: item.itemCount ?? DASH      },
        { label: 'Freight', value: item.freightAmount ? formatPKR(item.freightAmount) : DASH },
      ].map(({ label, value }) => (
        <div key={label}>
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
          <p className="text-[12px] font-semibold text-[#374151] truncate">{value}</p>
        </div>
      ))}
    </div>
  </div>
);

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const Purchases = () => {
  const [loading, setLoading]               = useState(false);
  const [rows, setRows]                     = useState([]);
  const [searchTerm, setSearchTerm]         = useState('');
  const [currentPage, setCurrentPage]       = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // ── Filters ──
  const [filterCompany, setFilterCompany]   = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');
  const [filterMinAmt, setFilterMinAmt]     = useState('');
  const [filterMaxAmt, setFilterMaxAmt]     = useState('');
  const [showFilters, setShowFilters]       = useState(false);

  // ── Company list for dropdown ──
  const [companies, setCompanies] = useState([]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [invRes, compRes] = await Promise.all([
        getAllPurchaseInvoices(),
        getAllPurchases(),
      ]);

      const invoices = Array.isArray(invRes?.data)     ? invRes.data     :
                       Array.isArray(invRes?.invoices)  ? invRes.invoices  :
                       Array.isArray(invRes)             ? invRes           : [];

      const compList = Array.isArray(compRes?.data?.data) ? compRes.data.data :
                       Array.isArray(compRes?.data)        ? compRes.data      : [];

      setCompanies(compList);

      const normalised = invoices.map(inv => ({
        _id:           inv._id,
        invoiceId:     inv.invoiceId    || inv._id?.slice(-8).toUpperCase(),
        billNo:        inv.billNo       || '—',
        companyName:   inv.companyId?.companyName || inv.company?.companyName || inv.companyName || '—',
        companyId:     inv.companyId?._id || inv.companyId || inv.company?._id || '',
        date:          inv.date         ? new Date(inv.date).toLocaleDateString('en-GB')    : '—',
        rawDate:       inv.date         ? new Date(inv.date) : null,
        dueDate:       inv.dueDate      ? new Date(inv.dueDate).toLocaleDateString('en-GB') : '—',
        biltyNumber:   inv.biltyNumber  || '—',
        vehicleNumber: inv.vehicleNumber|| '—',
        freightAmount: inv.freightAmount|| 0,
        totalAmount:   inv.totalAmount  || inv.total || 0,
        itemCount:     Array.isArray(inv.items) ? inv.items.length : (inv.itemCount ?? 0),
        rawItems:      Array.isArray(inv.items) ? inv.items : [],
        details:       inv.details || '',
      }));

      setRows(normalised);
    } catch (err) {
      toast.error('Failed to load purchases');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line

  // ── Filtered rows ──
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchTerm.trim()) {
      const lc = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.companyName?.toLowerCase().includes(lc)   ||
        p.billNo?.toLowerCase().includes(lc)        ||
        p.biltyNumber?.toLowerCase().includes(lc)   ||
        p.vehicleNumber?.toLowerCase().includes(lc) ||
        p.invoiceId?.toLowerCase().includes(lc)
      );
    }

    if (filterCompany) {
      result = result.filter(p => p.companyId === filterCompany || p.companyName === filterCompany);
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter(p => p.rawDate && p.rawDate >= from);
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(p => p.rawDate && p.rawDate <= to);
    }

    if (filterMinAmt) {
      result = result.filter(p => p.totalAmount >= Number(filterMinAmt));
    }

    if (filterMaxAmt) {
      result = result.filter(p => p.totalAmount <= Number(filterMaxAmt));
    }

    return result;
  }, [rows, searchTerm, filterCompany, filterDateFrom, filterDateTo, filterMinAmt, filterMaxAmt]);

  const totalPages    = Math.ceil(filteredRows.length / LIMIT) || 1;
  const start         = (currentPage - 1) * LIMIT;
  const paginatedRows = filteredRows.slice(start, start + LIMIT);

  const activeFilterCount = [filterCompany, filterDateFrom, filterDateTo, filterMinAmt, filterMaxAmt].filter(Boolean).length;

  const clearFilters = () => {
    setFilterCompany('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMinAmt('');
    setFilterMaxAmt('');
    setCurrentPage(1);
  };

  // Reset page on filter/search change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterCompany, filterDateFrom, filterDateTo, filterMinAmt, filterMaxAmt]);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .pur-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pur-page .trow { transition: background 0.15s, box-shadow 0.15s; cursor: pointer; }
        .pur-page .trow:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pur-sel {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        @keyframes filterIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        .filter-panel { animation: filterIn 0.2s ease; }
        @keyframes slideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .detail-panel { animation: slideIn 0.25s cubic-bezier(0.4,0,0.2,1); }
      `}</style>

      <div className="pur-page px-3 sm:px-0">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchases</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {filteredRows.length} invoice{filteredRows.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 && (
                <span className="ml-1.5 text-[#FF5934] font-semibold">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchAll} disabled={loading}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[#374151] text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl shadow-sm transition-all">
              <MdRefresh size={16} className="text-[#FF5934]" /> Refresh
            </button>
            <Link to="/Add-Purchase"
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-3 sm:px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all">
              <MdAddCircleOutline size={17} /> Add Purchase
            </Link>
            
          </div>
        </div>

        {/* ── Search + Filter Toggle Bar ── */}
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
              <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full min-w-0"
                type="search"
                placeholder="Search by company, bill no, bilty, vehicle, invoice ID..."
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')}
                  className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0">
                  <MdClose size={14} />
                </button>
              )}
            </div>

            {/* Filter toggle button */}
            <button
              type="button"
              onClick={() => setShowFilters(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex-shrink-0
                ${showFilters || activeFilterCount > 0
                  ? 'bg-[#FF5934]/10 border-[#FF5934]/30 text-[#FF5934]'
                  : 'bg-[#F9FAFB] border-gray-200 text-[#374151] hover:border-[#FF5934]/30'}`}
            >
              <MdFilterList size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
              {showFilters ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
            </button>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] hover:underline flex-shrink-0">
                <MdClose size={14} /> Clear all
              </button>
            )}
          </div>

          {/* ── Expandable Filter Panel ── */}
          {showFilters && (
            <div className="filter-panel bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4">
              <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-4 flex items-center gap-2">
                <MdFilterList size={12} className="text-[#FF5934]" /> Advanced Filters
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Company */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1.5"><MdBusiness size={11} className="text-[#FF5934]" /> Company</span>
                  </label>
                  <div className="relative">
                    <select
                      value={filterCompany}
                      onChange={e => setFilterCompany(e.target.value)}
                      className="pur-sel bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all"
                    >
                      <option value="">All Companies</option>
                      {companies.map(c => (
                        <option key={c._id} value={c._id}>{c.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1.5"><MdCalendarToday size={11} className="text-[#FF5934]" /> Date From</span>
                  </label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    max={filterDateTo || undefined}
                    onChange={e => setFilterDateFrom(e.target.value)}
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1.5"><MdCalendarToday size={11} className="text-[#FF5934]" /> Date To</span>
                  </label>
                  <input
                    type="date"
                    value={filterDateTo}
                    min={filterDateFrom || undefined}
                    onChange={e => setFilterDateTo(e.target.value)}
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all"
                  />
                </div>

                {/* Min Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1.5"><MdAttachMoney size={11} className="text-[#FF5934]" /> Min Amount (PKR)</span>
                  </label>
                  <input
                    type="number"
                    value={filterMinAmt}
                    min="0"
                    placeholder="0"
                    onChange={e => setFilterMinAmt(e.target.value)}
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300"
                  />
                </div>

                {/* Max Amount */}
                <div>
                  <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <span className="flex items-center gap-1.5"><MdAttachMoney size={11} className="text-[#FF5934]" /> Max Amount (PKR)</span>
                  </label>
                  <input
                    type="number"
                    value={filterMaxAmt}
                    min="0"
                    placeholder="No limit"
                    onChange={e => setFilterMaxAmt(e.target.value)}
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300"
                  />
                </div>

                {/* Clear button inside panel */}
                <div className="flex items-end">
                  <button type="button" onClick={clearFilters}
                    className="h-[42px] w-full rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                    <MdClose size={14} /> Clear Filters
                  </button>
                </div>
              </div>

              {/* Active filter chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  {filterCompany && (
                    <span className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#FF5934] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      {companies.find(c => c._id === filterCompany)?.companyName || filterCompany}
                      <button onClick={() => setFilterCompany('')}><MdClose size={11} /></button>
                    </span>
                  )}
                  {filterDateFrom && (
                    <span className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#FF5934] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      From: {new Date(filterDateFrom).toLocaleDateString('en-GB')}
                      <button onClick={() => setFilterDateFrom('')}><MdClose size={11} /></button>
                    </span>
                  )}
                  {filterDateTo && (
                    <span className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#FF5934] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      To: {new Date(filterDateTo).toLocaleDateString('en-GB')}
                      <button onClick={() => setFilterDateTo('')}><MdClose size={11} /></button>
                    </span>
                  )}
                  {filterMinAmt && (
                    <span className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#FF5934] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      Min: PKR {Number(filterMinAmt).toLocaleString('en-PK')}
                      <button onClick={() => setFilterMinAmt('')}><MdClose size={11} /></button>
                    </span>
                  )}
                  {filterMaxAmt && (
                    <span className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#FF5934] text-[11px] font-semibold px-2.5 py-1 rounded-full">
                      Max: PKR {Number(filterMaxAmt).toLocaleString('en-PK')}
                      <button onClick={() => setFilterMaxAmt('')}><MdClose size={11} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  {['Invoice ID','Company','Bill No','Date','Due Date',
                    'Bilty No','Vehicle','Items','Freight','Total Amount','Action'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={11}><EmptyState /></td></tr>
                ) : paginatedRows.map((item, i) => (
                  <tr key={item._id || i} className="trow" onClick={() => setSelectedInvoice(item)}>

                    {/* Invoice ID */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                        #{item.invoiceId || item._id?.slice(0, 8)}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                          {(item.companyName || 'NA').split(' ').filter(w => w && w !== '&').map(w => w[0]?.toUpperCase()).join('').slice(0, 2)}
                        </div>
                        <p className="text-[13px] font-semibold text-[#111827] truncate max-w-[130px]">
                          {item.companyName || DASH}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.billNo || DASH}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.date   || DASH}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.dueDate || DASH}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151]">{item.biltyNumber   || DASH}</td>
                    <td className="px-4 py-3 text-[13px] text-[#374151]">{item.vehicleNumber  || DASH}</td>

                    {/* Items count */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-[#FF5934]">
                        {item.itemCount ?? 0}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">
                      {item.freightAmount ? formatPKR(item.freightAmount) : DASH}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-bold text-[#FF5934]">{formatPKR(item.totalAmount)}</span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedInvoice(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all"
                        title="View Details"
                      >
                        <FaRegEye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden space-y-3">
          {paginatedRows.length === 0
            ? <EmptyState />
            : paginatedRows.map((item, i) => (
                <PurchaseMobileCard key={item._id || i} item={item} onView={setSelectedInvoice} />
              ))}
        </div>

        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage(p => Math.max(p - 1, 1))}
          onNext={() => setCurrentPage(p => Math.min(p + 1, totalPages || 1))}
        />
      </div>

      {/* ── Detail Slide-over ── */}
      {selectedInvoice && (
        <DetailPanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
};

export default Purchases;