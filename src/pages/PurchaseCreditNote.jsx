import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdReceipt, MdStore, MdCalendarToday, MdLocationOn,
  MdShoppingBag, MdLocalShipping, MdFilterList,
  MdClose, MdSearch, MdRefresh, MdAdd, MdReceiptLong,
} from 'react-icons/md';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import { FaRegEye } from 'react-icons/fa6';
import { Loader } from '../components/common/loader';
import { getAllCities, getAllPurchaseCreditNotes } from '../APIS';
import { useSelector } from 'react-redux';

const LIMIT = 10;
const FILTER_FETCH_LIMIT = 1000;

/* ── Helpers ── */
const fmt = (n) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColor = (status) => {
  const map = {
    Returned:  'bg-emerald-50 text-emerald-600 ring-emerald-200',
    Cancelled: 'bg-red-50 text-red-500 ring-red-200',
    Placed:    'bg-amber-50 text-amber-600 ring-amber-200',
  };
  return map[status] || 'bg-gray-50 text-gray-500 ring-gray-200';
};

const statusDot = (status) => {
  const map = {
    Returned:  'bg-emerald-400',
    Cancelled: 'bg-red-400',
    Placed:    'bg-amber-400',
  };
  return map[status] || 'bg-gray-400';
};

const getDateKey = (cn) => {
  const src = cn?.date || cn?.createdAt;
  if (!src) return '';
  const d = new Date(src);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
};

const matchesFilters = (cn, { term = '', sd = '', ed = '', city = '', status = '' }) => {
  const q = term.trim().toLowerCase();
  if (q) {
    const hay = [
      cn?._id,
      cn?.purchaseCreditNoteId,
      cn?.billNo,
      cn?.supplier?.companyName,
      cn?.address,
      cn?.vehicleNumber,
      cn?.biltyNumber,
    ].filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  const dk = getDateKey(cn);
  if (sd && (!dk || dk < sd)) return false;
  if (ed && (!dk || dk > ed)) return false;
  if (city && String(cn?.location?._id || '') !== city) return false;
  if (status && cn?.status !== status) return false;
  return true;
};

const paginate = (rows, page) => rows.slice((page - 1) * LIMIT, page * LIMIT);

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const PurchaseCreditNote = () => {
  const navigate   = useNavigate();
  const { token }  = useSelector((s) => s.admin);
  const sidebarRef = useRef(null);

  const [data, setData]               = useState([]);
  const [totalPages, setTotalPages]   = useState(0);
  const [loading, setLoading]         = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [show, setShow]               = useState(false);
  const [selected, setSelected]       = useState(null);

  const [cities, setCities]           = useState([]);
  const [searchTerm, setSearchTerm]   = useState('');
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [selCity, setSelCity]         = useState('');
  const [selStatus, setSelStatus]     = useState('');

  const filterCount = useMemo(() =>
    [selCity, selStatus, startDate || endDate, searchTerm].filter(Boolean).length,
    [selCity, selStatus, startDate, endDate, searchTerm]
  );

  /* ── close sidebar on outside click ── */
  useEffect(() => {
    const h = (e) => { if (sidebarRef.current && !sidebarRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  /* ── close on Escape ── */
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  /* ── load cities (for warehouse filter) ── */
  useEffect(() => {
    getAllCities()
      .then((r) => setCities(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  /* ── fetch ── */
  const doFetch = useCallback(async ({
    page = 1, term = '', sd = '', ed = '', city = '', status = '',
  } = {}) => {
    const hasFilter = term || sd || ed || city || status;
    try {
      setLoading(true);
      if (hasFilter) {
        const res  = await getAllPurchaseCreditNotes(1, FILTER_FETCH_LIMIT);
        const rows = res.data?.data || [];
        const filtered = rows.filter((cn) => matchesFilters(cn, { term, sd, ed, city, status }));
        setData(paginate(filtered, page));
        setTotalPages(Math.ceil(filtered.length / LIMIT) || 0);
      } else {
        const res = await getAllPurchaseCreditNotes(page, LIMIT);
        setData(res.data?.data || []);
        setTotalPages(res.data?.totalPages || 0);
      }
    } catch (err) {
      toast.error(err?.response?.data?.msg || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doFetch({ page: currentPage, term: searchTerm, sd: startDate, ed: endDate, city: selCity, status: selStatus });
  }, [currentPage, searchTerm, startDate, endDate, selCity, selStatus, doFetch]);

  const resetFilters = () => {
    setSearchTerm(''); setStartDate(''); setEndDate('');
    setSelCity(''); setSelStatus(''); setCurrentPage(1);
  };

  const openDetail = (cn) => { setSelected(cn); setShow(true); };

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .pcn-page { font-family:'DM Sans','Segoe UI',sans-serif; }
        .pcn-page .table-row { transition:background .15s,box-shadow .15s; }
        .pcn-page .table-row:hover { background:#FFFAF9; box-shadow:0 0 0 1px #FFD7CE inset; }
        .pcn-page .action-btn { transition:background .15s,color .15s,transform .1s; }
        .pcn-page .action-btn:hover { transform:scale(1.1); }
        .pcn-page .fsel {
          appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
        }
        @keyframes sideIn { from{transform:translateX(100%)} to{transform:translateX(0)} }
        .pcn-sidebar { transition:transform .3s cubic-bezier(.4,0,.2,1); }
      `}</style>

      <div className="pcn-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchase Credit Notes</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} records on this page</p>
          </div>
          <button
            onClick={() => navigate('/Add-Purchase-Note')}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-md shadow-orange-100 transition-all"
          >
            <MdAdd size={16} /> Add Purchase Credit Note
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              placeholder="Search by supplier, bill no, vehicle…"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0">
                <MdClose size={14} />
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdCalendarToday size={14} className="text-[#9CA3AF]" />
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="bg-transparent outline-none text-sm text-[#374151]" />
            <span className="text-[#9CA3AF] text-xs">—</span>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="bg-transparent outline-none text-sm text-[#374151]" />
          </div>

          {/* Warehouse */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdLocationOn size={15} className="text-[#9CA3AF]" />
            <select value={selCity} onChange={(e) => { setSelCity(e.target.value); setCurrentPage(1); }}
              className="fsel bg-transparent outline-none text-sm text-[#374151] min-w-[140px]">
              <option value="">All Warehouses</option>
              {cities.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>

          {filterCount > 0 && (
            <button onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all">
              <MdClose size={14} /> Clear
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center ml-0.5">
                {filterCount}
              </span>
            </button>
          )}

          <button onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
            <MdRefresh size={16} /> Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {['Credit Note ID', 'Supplier', 'Bill No', 'Warehouse', 'Date', 'Payable', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((cn) => (
                <tr key={cn._id} className="table-row cursor-pointer" onClick={() => openDetail(cn)}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] font-bold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                      #{cn._id.slice(-10)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <MdStore size={13} className="text-[#FF5934]" />
                      </div>
                      <span className="text-[13px] text-[#374151] font-medium">{cn.supplier?.companyName || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-[#374151] font-medium">{cn.billNo || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-[#374151]">{cn.location?.name || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#374151]">{cn.date ? new Date(cn.date).toLocaleDateString('en-GB') : '—'}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{cn.createdAt ? new Date(cn.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold text-[#111827]">PKR {fmt(cn.payable)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${statusColor(cn.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(cn.status)}`} />
                      {cn.status || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(cn); }}
                      className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                      title="View"
                    >
                      <FaRegEye size={13} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdReceiptLong size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No purchase credit notes found</p>
                      {filterCount > 0 && (
                        <button onClick={resetFilters} className="text-[#FF5934] text-xs hover:underline font-medium">
                          Clear {filterCount} active filter{filterCount > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-[12px] text-[#9CA3AF]">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            ><GrFormPrevious size={16} /></button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            ><GrFormNext size={16} /></button>
          </div>
        </div>

        {/* ═══════════ DETAIL SIDEBAR ═══════════ */}
        <div
          ref={sidebarRef}
          className={`pcn-sidebar fixed top-0 right-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-40 flex flex-col ${show ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {show && selected && (
            <>
              {/* Sidebar header */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-6 flex-shrink-0">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10 pointer-events-none" />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Purchase Credit Note Details</span>
                  <button
                    onClick={() => setShow(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  ><MdClose size={15} /></button>
                </div>
                <p className="font-mono text-white/50 text-[11px]">#{selected._id.slice(-10).toUpperCase()}</p>
                <h3 className="text-white font-bold text-[17px] leading-tight">{selected.supplier?.companyName || 'Purchase Credit Note'}</h3>
                <div className="flex gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${statusColor(selected.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selected.status)}`} />
                    {selected.status || '—'}
                  </span>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2 mx-5 -mt-4 z-10 relative flex-shrink-0">
                {[
                  { label: 'Items',    value: selected.items?.length || 0 },
                  { label: 'Payable',  value: `PKR ${fmt(selected.payable)}` },
                  { label: 'Discount', value: `PKR ${fmt(selected.discountAmount)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-2 py-3 text-center">
                    <p className="text-[12px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-4"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>

                {/* Info */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Note Info</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3">
                    {[
                      { icon: MdLocationOn,    label: 'Address',          value: selected.address },
                      { icon: MdReceipt,       label: 'Bill No',          value: selected.billNo },
                      { icon: MdLocationOn,    label: 'Warehouse',        value: selected.location?.name },
                      { icon: MdLocalShipping, label: 'Vehicle Number',   value: selected.vehicleNumber },
                      { icon: MdLocalShipping, label: 'Bilty Number',     value: selected.biltyNumber },
                      { icon: MdLocalShipping, label: 'Transport Details', value: selected.transportDetails },
                      { icon: MdCalendarToday, label: 'Date',             value: selected.date ? new Date(selected.date).toLocaleDateString('en-GB') : '—' },
                      { icon: MdCalendarToday, label: 'Due Date',         value: selected.dueDate ? new Date(selected.dueDate).toLocaleDateString('en-GB') : '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={13} className="text-[#FF5934]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className="text-[13px] text-[#374151] font-medium break-words">{value || '—'}</p>
                        </div>
                      </div>
                    ))}
                    {selected.details && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MdReceipt size={13} className="text-[#FF5934]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Details / Notes</p>
                          <p className="text-[13px] text-[#374151] font-medium break-words">{selected.details}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Items</p>
                    <span className="text-[11px] text-[#FF5934] font-bold">{selected.items?.length || 0} items</span>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2">
                    {(selected.items || []).map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2.5">
                        {item.product?.image
                          ? <img src={item.product.image} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                          : <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                              <MdShoppingBag size={16} className="text-gray-300" />
                            </div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-[#111827] break-words leading-snug">
                            {item.product?.englishTitle || '—'}
                          </p>
                          <p className="text-[11px] text-[#FF5934] font-medium mt-0.5">
                            PKR {fmt(item.purchaseRate)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="inline-flex items-center bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-[11px] font-bold text-[#374151] whitespace-nowrap">
                            Qty: {item.quantity}
                          </span>
                          {item.purchaseDiscount > 0 && (
                            <span className="text-[10px] text-emerald-600 font-semibold">{item.purchaseDiscount}% off</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-white rounded-b-2xl flex flex-col gap-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9CA3AF] font-medium">Total Amount</span>
                      <span className="text-[#374151] font-semibold">PKR {fmt(selected.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#9CA3AF] font-medium">Discount</span>
                      <span className="text-emerald-600 font-semibold">- PKR {fmt(selected.discountAmount)}</span>
                    </div>
                    {selected.freightAmount > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-[#9CA3AF] font-medium">Freight Amount</span>
                        <span className="text-[#374151] font-semibold">PKR {fmt(selected.freightAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 mt-0.5">
                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Payable</span>
                      <span className="text-[15px] font-bold text-[#111827]">PKR {fmt(selected.payable)}</span>
                    </div>
                  </div>
                </div>

                <div className="h-2" />
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 bg-white">
                <button
                  onClick={() => setShow(false)}
                  className="w-full h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all shadow-md shadow-orange-100"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>

        {show && (
          <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={() => setShow(false)} />
        )}

      </div>
    </>
  );
};

export default PurchaseCreditNote;