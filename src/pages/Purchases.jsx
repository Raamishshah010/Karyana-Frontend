import { useEffect, useState } from 'react';
import {
  getAllPurchases, getLedgerById, getInvoicesByPurchaseId,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  MdSearch, MdFilterList, MdClose, MdBusiness, MdRefresh,
  MdAddCircleOutline,
} from "react-icons/md";
import { Link } from 'react-router-dom';

const LIMIT = 10;
const DASH = '-';

const formatPKR = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;

const formatMoneyValue = (value) => {
  if (value === null || value === undefined)
    return <span className="text-[#D1D5DB] text-[11px]">{DASH}</span>;
  return formatPKR(value);
};

const formatNumberValue = (value) => {
  if (value === null || value === undefined)
    return <span className="text-[#D1D5DB] text-[11px]">{DASH}</span>;
  return value;
};

const getCompanyInitials = (name = '') =>
  name.split(' ').filter(w => w && w !== '&').map(w => w[0]?.toUpperCase()).join('').slice(0, 2) || 'NA';

const filterPurchases = (data, term, status) => {
  let result = data;
  if (status === 'active')   result = result.filter(p => p.isActive);
  if (status === 'inactive') result = result.filter(p => !p.isActive);
  if (term.trim()) {
    const lc = term.toLowerCase();
    result = result.filter(p =>
      p.companyName?.toLowerCase().includes(lc) ||
      p.phone?.toLowerCase().includes(lc) ||
      p.address?.toLowerCase().includes(lc)
    );
  }
  return result;
};

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 whitespace-nowrap
    ${active ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : 'bg-gray-50 text-gray-400 ring-gray-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const PaginationBar = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
    <p className="text-[12px] text-[#9CA3AF]">Page {page} of {totalPages || 1}</p>
    <div className="flex items-center gap-1.5">
      <button type="button" disabled={page === 1} onClick={onPrev} aria-label="Previous page"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormPrevious size={16} />
      </button>
      <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
        <span className="font-semibold text-[#FF5934]">{page}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[#374151]">{totalPages || 1}</span>
      </div>
      <button type="button" disabled={page >= totalPages} onClick={onNext} aria-label="Next page"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormNext size={16} />
      </button>
    </div>
  </div>
);

const Shimmer = () => <span className="pur-shimmer" />;

const EmptyState = () => (
  <div className="py-16 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <MdBusiness size={24} className="text-gray-300" />
      </div>
      <p className="text-[#9CA3AF] text-sm font-medium">No companies found</p>
    </div>
  </div>
);

const CompanyIdentity = ({ item, compact = false }) => (
  <div className="flex items-center gap-3 min-w-0">
    <div className={`${compact ? 'w-10 h-10' : 'w-9 h-9'} rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0 shadow-sm`}>
      {getCompanyInitials(item.companyName)}
    </div>
    <div className="min-w-0">
      <p className={`${compact ? 'text-[14px]' : 'text-[13px]'} font-semibold text-[#111827] truncate`}>
        {item.companyName || DASH}
      </p>
      {item.email && <p className="text-[11px] text-[#9CA3AF] truncate">{item.email}</p>}
    </div>
  </div>
);

const MobileInfo = ({ label, value, tone = 'default' }) => {
  const toneClass =
    tone === 'green'  ? 'text-emerald-600' :
    tone === 'red'    ? 'text-red-500'     :
    tone === 'orange' ? 'text-[#FF5934]'   :
                        'text-[#111827]';
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
      <div className={`text-[13px] font-semibold break-words ${toneClass}`}>{value}</div>
    </div>
  );
};

const PurchaseMobileCard = ({ item }) => {
  const isLoading = item._totalDr === null;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <CompanyIdentity item={item} compact />
        <StatusBadge active={item.isActive} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MobileInfo label="ID"               value={`#${item._id?.slice(0, 6) || DASH}`} />
        <MobileInfo label="Phone"            value={item.phone || DASH} />
        <MobileInfo label="Balance"          value={formatPKR(item.balance)} />
        <MobileInfo label="Last Payment"     value={formatPKR(item.lastPayment)} />
        <MobileInfo label="Total Dr."        value={isLoading ? <Shimmer /> : formatMoneyValue(item._totalDr)} tone="green" />
        <MobileInfo label="Total Cr."        value={isLoading ? <Shimmer /> : formatMoneyValue(item._totalCr)} tone="red" />
        <MobileInfo label="Last Transaction" value={isLoading ? <Shimmer /> : (item._lastTransaction || DASH)} />
        <MobileInfo label="Invoices"         value={isLoading ? <Shimmer /> : formatNumberValue(item._invoiceCount)} tone="orange" />
      </div>
      <div className="mt-3 border-t border-gray-100 pt-3">
        <MobileInfo label="Address" value={item.address || DASH} />
      </div>
    </div>
  );
};

const safeFetchLedger = async (companyId) => {
  try {
    const res     = await getLedgerById(companyId);
    const ledgers = Array.isArray(res?.ledgers) ? res.ledgers : [];
    let totalDr = 0, totalCr = 0;
    ledgers.forEach(l => {
      const amt = Number(l.amount || 0);
      if (l.type === 'PAYMENT') totalDr += amt;
      else totalCr += amt;
    });
    const dates = ledgers
      .map(l => l.date ? new Date(l.date) : null)
      .filter(d => d && !Number.isNaN(d.getTime()));
    return {
      totalDr,
      totalCr,
      lastTransaction: dates.length
        ? new Date(Math.max(...dates)).toLocaleDateString('en-GB')
        : DASH,
    };
  } catch (err) {
    if (err?.response?.status !== 404)
      console.warn(`Ledger fetch warning for ${companyId}:`, err?.message);
    return { totalDr: 0, totalCr: 0, lastTransaction: DASH };
  }
};

const safeFetchInvoices = async (companyId) => {
  try {
    const res = await getInvoicesByPurchaseId(companyId);
    return (res?.invoices || []).length;
  } catch (err) {
    if (err?.response?.status !== 404)
      console.warn(`Invoice fetch warning for ${companyId}:`, err?.message);
    return 0;
  }
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const Purchases = () => {
  const [loading, setLoading]               = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [rows, setRows]                     = useState([]);
  const [filteredRows, setFilteredRows]     = useState([]);
  const [searchTerm, setSearchTerm]         = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [currentPage, setCurrentPage]       = useState(1);
  const [totalPages, setTotalPages]         = useState(1);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const res       = await getAllPurchases();
      const companies = res?.data?.data || [];

      if (!companies.length) {
        setRows([]); setFilteredRows([]); setTotalPages(1);
        return;
      }

      const seeded = companies.map(c => ({
        ...c,
        _totalDr:        null,
        _totalCr:        null,
        _lastTransaction: null,
        _invoiceCount:   null,
      }));

      setRows(seeded);
      setFilteredRows(filterPurchases(seeded, searchTerm, filterStatus));
      setTotalPages(Math.ceil(seeded.length / LIMIT) || 1);
      setLoading(false);

      setFetchingDetails(true);
      const enriched = await Promise.all(
        companies.map(async (company) => {
          const [ledger, invoiceCount] = await Promise.all([
            safeFetchLedger(company._id),
            safeFetchInvoices(company._id),
          ]);
          return {
            ...company,
            _totalDr:        ledger.totalDr,
            _totalCr:        ledger.totalCr,
            _lastTransaction: ledger.lastTransaction,
            _invoiceCount:   invoiceCount,
          };
        })
      );

      const next = filterPurchases(enriched, searchTerm, filterStatus);
      setRows(enriched);
      setFilteredRows(next);
      setTotalPages(Math.ceil(next.length / LIMIT) || 1);
    } catch (err) {
      toast.error('Failed to load purchases');
      console.error('fetchAll error:', err);
      setRows([]); setFilteredRows([]); setTotalPages(1);
    } finally {
      setLoading(false);
      setFetchingDetails(false);
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result = filterPurchases(rows, searchTerm, filterStatus);
    setFilteredRows(result);
    setTotalPages(Math.ceil(result.length / LIMIT) || 1);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, rows]);

  const start         = (currentPage - 1) * LIMIT;
  const paginatedRows = filteredRows.slice(start, start + LIMIT);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .pur-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pur-page .trow { transition: background 0.15s, box-shadow 0.15s; }
        .pur-page .trow:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pur-sel {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .pur-shimmer {
          background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
          background-size: 200% 100%; animation: shimmer 1.4s infinite;
          border-radius: 6px; display: inline-block; height: 13px; width: 64px;
        }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      <div className="pur-page px-3 sm:px-0">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchases</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {filteredRows.length} companies
              {fetchingDetails && (
                <span className="block sm:inline sm:ml-2 text-[#FF5934] text-[11px] font-semibold animate-pulse">
                  Loading details...
                </span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading || fetchingDetails}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[#374151] text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <MdRefresh size={16} className="text-[#FF5934]" /> Refresh
            </button>
            <Link
              to="/Add-Purchase"
              className="flex items-center justify-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-3 sm:px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdAddCircleOutline size={17} /> Add Purchase
            </Link>
            <Link
              to="/Add-Purchase-Note"
              className="flex items-center justify-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-3 sm:px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdAddCircleOutline size={17} /> Add Purchase Note
            </Link>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full min-w-0"
              type="search"
              placeholder="Search by name, phone, address..."
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')}
                className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0" aria-label="Clear search">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 w-full sm:w-auto">
            <MdFilterList size={16} className="text-[#9CA3AF] flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="pur-sel bg-transparent outline-none text-sm text-[#374151] w-full sm:min-w-[120px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  {['Company','ID','Phone','Address','Balance','Last Payment',
                    'Total Dr.','Total Cr.','Last Transaction','Invoices','Status'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={11}><EmptyState /></td></tr>
                ) : paginatedRows.map((item, i) => {
                  const isLoading = item._totalDr === null;
                  return (
                    <tr key={item._id || i} className="trow">
                      <td className="px-4 py-3"><CompanyIdentity item={item} /></td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{item._id?.slice(0, 6) || DASH}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.phone || DASH}</td>
                      <td className="px-4 py-3 max-w-[140px]">
                        <p className="text-[13px] text-[#374151] truncate">{item.address || DASH}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#111827]">{formatPKR(item.balance)}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{formatPKR(item.lastPayment)}</td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[13px] font-semibold text-emerald-600">{formatMoneyValue(item._totalDr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[13px] font-semibold text-red-500">{formatMoneyValue(item._totalCr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[12px] text-[#6B7280]">{item._lastTransaction || DASH}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : (
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-[#FF5934]">
                            {formatNumberValue(item._invoiceCount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusBadge active={item.isActive} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Mobile Cards ── */}
        <div className="md:hidden space-y-3">
          {paginatedRows.length === 0
            ? <EmptyState />
            : paginatedRows.map((item, i) => (
                <PurchaseMobileCard key={item._id || i} item={item} />
              ))}
        </div>

        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage(p => Math.max(p - 1, 1))}
          onNext={() => setCurrentPage(p => Math.min(p + 1, totalPages || 1))}
        />

      </div>
    </>
  );
};

export default Purchases;