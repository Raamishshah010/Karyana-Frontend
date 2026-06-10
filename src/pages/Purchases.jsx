import { useEffect, useState } from 'react';
import {
  getAllPurchases, getLedgerById, getInvoicesByPurchaseId,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  MdSearch, MdFilterList, MdClose, MdBusiness, MdRefresh,
} from "react-icons/md";

const LIMIT = 10;

const PaginationBar = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex items-center justify-between mt-4">
    <p className="text-[12px] text-[#9CA3AF]">Page {page} of {totalPages || 1}</p>
    <div className="flex items-center gap-1.5">
      <button disabled={page === 1} onClick={onPrev}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormPrevious size={16} />
      </button>
      <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
        <span className="font-semibold text-[#FF5934]">{page}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[#374151]">{totalPages || 1}</span>
      </div>
      <button disabled={page >= totalPages} onClick={onNext}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        <GrFormNext size={16} />
      </button>
    </div>
  </div>
);

const Purchases = () => {
  const [loading, setLoading]                     = useState(false);
  const [fetchingDetails, setFetchingDetails]     = useState(false);
  const [rows, setRows]                           = useState([]);         // enriched rows
  const [filteredRows, setFilteredRows]           = useState([]);
  const [searchTerm, setSearchTerm]               = useState('');
  const [filterStatus, setFilterStatus]           = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [totalPages, setTotalPages]               = useState(1);

  /* ─── Fetch companies + enrich with ledger & invoice data ─── */
  const fetchAll = async () => {
    try {
      setLoading(true);

      // 1. get all companies
      const res        = await getAllPurchases();
      const companies  = res?.data?.data || [];

      if (!companies.length) {
        setRows([]); setFilteredRows([]); setTotalPages(1);
        setLoading(false);
        return;
      }

      // 2. seed with placeholder so table renders immediately
      const seeded = companies.map(c => ({
        ...c,
        _totalDr:        null,
        _totalCr:        null,
        _lastTransaction: null,
        _invoiceCount:   null,
      }));
      setRows(seeded);
      setFilteredRows(seeded);
      setTotalPages(Math.ceil(seeded.length / LIMIT) || 1);
      setLoading(false);

      // 3. enrich each company in parallel
      setFetchingDetails(true);
      const enriched = await Promise.all(
        companies.map(async (company) => {
          let totalDr        = 0;
          let totalCr        = 0;
          let lastTransaction = '—';
          let invoiceCount   = 0;

          try {
            const ledgerRes = await getLedgerById(company._id);
            const ledgers   = ledgerRes?.ledgers || [];

            ledgers.forEach(l => {
              const amt = Number(l.amount || 0);
              if (l.type === 'PAYMENT') totalDr += amt;
              else                      totalCr += amt;
            });

            if (ledgers.length) {
              // most recent date
              const dates = ledgers
                .map(l => l.date ? new Date(l.date) : null)
                .filter(Boolean);
              if (dates.length) {
                const latest = new Date(Math.max(...dates));
                lastTransaction = latest.toLocaleDateString('en-GB');
              }
            }
          } catch { /* keep defaults */ }

          try {
            const invRes = await getInvoicesByPurchaseId(company._id);
            invoiceCount = invRes?.invoices?.length ?? 0;
          } catch { /* keep defaults */ }

          return {
            ...company,
            _totalDr:        totalDr,
            _totalCr:        totalCr,
            _lastTransaction: lastTransaction,
            _invoiceCount:   invoiceCount,
          };
        })
      );

      setRows(enriched);
      setFilteredRows(applyFilters(enriched, searchTerm, filterStatus));
      setTotalPages(Math.ceil(enriched.length / LIMIT) || 1);
    } catch (err) {
      toast.error('Failed to load purchases');
      setRows([]); setFilteredRows([]);
    } finally {
      setLoading(false);
      setFetchingDetails(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  /* ─── Filters ─── */
  const applyFilters = (data, term, status) => {
    let result = data;
    if (status === 'active')   result = result.filter(p => p.isActive);
    if (status === 'inactive') result = result.filter(p => !p.isActive);
    if (term.trim()) {
      const lc = term.toLowerCase();
      result = result.filter(p =>
        p.companyName?.toLowerCase().includes(lc) ||
        p.phone?.toLowerCase().includes(lc)       ||
        p.address?.toLowerCase().includes(lc)
      );
    }
    return result;
  };

  useEffect(() => {
    const result = applyFilters(rows, searchTerm, filterStatus);
    setFilteredRows(result);
    setTotalPages(Math.ceil(result.length / LIMIT) || 1);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, rows]);

  /* ─── Pagination ─── */
  const start        = (currentPage - 1) * LIMIT;
  const paginatedRows = filteredRows.slice(start, start + LIMIT);

  /* ─── Formatters ─── */
  const fmtPKR = (n) => {
    if (n === null || n === undefined) return <span className="text-[#D1D5DB] text-[11px]">—</span>;
    return `PKR ${Number(n).toLocaleString('en-PK')}`;
  };
  const fmtNum = (n) => {
    if (n === null || n === undefined) return <span className="text-[#D1D5DB] text-[11px]">—</span>;
    return n;
  };

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .pur-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pur-page .trow { transition: background 0.15s, box-shadow 0.15s; }
        .pur-page .trow:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pur-sel {
          appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px;
        }
        .pur-shimmer {
          background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
          display: inline-block;
          height: 13px;
          width: 64px;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      <div className="pur-page">

        {/* Header */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchases</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {filteredRows.length} companies
              {fetchingDetails && (
                <span className="ml-2 text-[#FF5934] text-[11px] font-semibold animate-pulse">
                  · Loading details…
                </span>
              )}
            </p>
          </div>
          <button onClick={fetchAll} disabled={loading || fetchingDetails}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[#374151] text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
            <MdRefresh size={16} className="text-[#FF5934]" /> Refresh
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search" placeholder="Search by name, phone, address…" />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="pur-sel bg-transparent outline-none text-sm text-[#374151] min-w-[110px]">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  {[
                    'Company',
                    'ID',
                    'Phone',
                    'Address',
                    'Balance',
                    'Last Payment',
                    'Total Dr.',
                    'Total Cr.',
                    'Last Transaction',
                    'Invoices',
                    'Status',
                  ].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <MdBusiness size={24} className="text-gray-300" />
                        </div>
                        <p className="text-[#9CA3AF] text-sm font-medium">No companies found</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRows.map((item, i) => {
                  const isLoading = item._totalDr === null;
                  return (
                    <tr key={item._id || i} className="trow">

                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0 shadow-sm">
                            {item.companyName
                              ? item.companyName.split(' ').filter(w => w !== '&').map(w => w[0]?.toUpperCase()).join('').slice(0, 2)
                              : 'NA'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#111827] truncate max-w-[140px]">{item.companyName || '—'}</p>
                            {item.email && <p className="text-[11px] text-[#9CA3AF] truncate max-w-[140px]">{item.email}</p>}
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{item._id?.slice(0, 6)}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.phone || '—'}</td>

                      {/* Address */}
                      <td className="px-4 py-3 max-w-[140px]">
                        <p className="text-[13px] text-[#374151] truncate">{item.address || '—'}</p>
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#111827]">PKR {item.balance ?? '0'}</span>
                      </td>

                      {/* Last Payment */}
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">
                        PKR {item.lastPayment ?? '0'}
                      </td>

                      {/* Total Dr. */}
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[13px] font-semibold text-emerald-600">
                              {fmtPKR(item._totalDr)}
                            </span>
                        }
                      </td>

                      {/* Total Cr. */}
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[13px] font-semibold text-red-500">
                              {fmtPKR(item._totalCr)}
                            </span>
                        }
                      </td>

                      {/* Last Transaction */}
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[12px] text-[#6B7280]">{item._lastTransaction || '—'}</span>
                        }
                      </td>

                      {/* Invoice Count */}
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-[#FF5934]">
                              {fmtNum(item._invoiceCount)}
                            </span>
                        }
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                            : 'bg-gray-50 text-gray-400 ring-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <PaginationBar
          page={currentPage} totalPages={totalPages}
          onPrev={() => setCurrentPage(p => p - 1)}
          onNext={() => setCurrentPage(p => p + 1)}
        />

      </div>
    </>
  );
};

export default Purchases;