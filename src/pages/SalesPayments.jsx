import React, { useState, useEffect, useRef } from 'react';
import {
  getAllRetailers,
  getRetailerLedgerById,
  approveLedger,
  rejectLedger,
  searchRetailerUsers,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from '../components/common/loader';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import { FaRegEye } from 'react-icons/fa6';
import { AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import {
  MdSearch, MdClose, MdArrowBack, MdPerson,
  MdFilterList, MdOutlineReceipt, MdRefresh,
} from 'react-icons/md';
import { HiDotsVertical } from 'react-icons/hi';
import ClickOutside from '../Hooks/ClickOutside';

const TRANSACTIONS_PER_PAGE = 11;

/* ─── helpers ─────────────────────────────────────── */
const formatLedgerDetails = (ledger) => {
  const base = ledger?.description ?? ledger?.details ?? 'Transaction';
  const isOrderType = String(ledger?.type || '').toUpperCase() === 'ORDER';
  const looksLikeOrderText = /^Order\s+.*\s+placed$/i.test(String(base));
  return (isOrderType || looksLikeOrderText) ? 'Order punched from app' : base;
};

const formatRetailerData = (list = []) =>
  list.map((r) => ({
    _id: r._id || 'N/A',
    name: r.name || 'N/A',
    phone: r.phone || r.phoneNumber || 'N/A',
    shopName: r.shopName || 'N/A',
    image: r.image || 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
    isActive: r.isActive || false,
    balance: Number(r.balance || 0).toLocaleString(),
  }));

const mapLedger = (ledger) => ({
  id: ledger.transactionId || ledger._id,
  details: formatLedgerDetails(ledger),
  refNo: ledger.refNo ?? null,
  voucherNo: ledger.voucherNo ?? null,
  quantity: ledger.quantity ?? null,
  type: ledger.type,
  dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
  cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
  date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
  sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
  isApproved: ledger.isApproved === false ? false : true,
  isRejected: ledger.isRejected === true,
  isImported: ledger.isImportedFromExcel === true,
  image: ledger.image || null,
  balance: Number(ledger.balance || 0).toLocaleString(),
});

/* ─── component ───────────────────────────────────── */
const SalesPayments = () => {
  /* list state */
  const [allRetailers, setAllRetailers] = useState([]);
  const [filteredRetailers, setFilteredRetailers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  /* selected user + ledger state */
  const [selectedUser, setSelectedUser] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [actionStatuses, setActionStatuses] = useState({});
  const [showDropdown, setShowDropdown] = useState(null);

  /* image drawer */
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerImageSrc, setDrawerImageSrc] = useState(null);

  /* date filter */
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  /* pagination */
  const [recoveryPage, setRecoveryPage] = useState(1);

  /* ── recovery rows derived ── */
  const recoveryRows = transactionData.filter((t) => {
    const drNum = parseFloat(String(t.dr || '0').replace(/[^0-9.-]/g, ''));
    const crNum = parseFloat(String(t.cr || '0').replace(/[^0-9.-]/g, ''));
    return !t.isImported && t.isApproved === false && drNum > 0 && (isNaN(crNum) || crNum === 0);
  });

  const recoveryTotalPages = Math.ceil(recoveryRows.length / TRANSACTIONS_PER_PAGE) || 1;
  const recoveryStart = (recoveryPage - 1) * TRANSACTIONS_PER_PAGE;
  const recoveryVisible = recoveryRows.slice(recoveryStart, recoveryStart + TRANSACTIONS_PER_PAGE);

  /* ── fetch all retailers on mount ── */
  useEffect(() => {
    (async () => {
      try {
        setListLoading(true);
        const res = await getAllRetailers();
        const formatted = formatRetailerData(res?.data?.data || []);
        setAllRetailers(formatted);
      } catch {
        toast.error('Failed to load retailers');
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  /* ── fetch ledger when user selected ── */
  useEffect(() => {
    if (!selectedUser?._id) return;
    setRecoveryPage(1);
    (async () => {
      try {
        setLedgerLoading(true);
        const res = await getRetailerLedgerById(selectedUser._id);
        if (res?.success && Array.isArray(res.ledgers)) {
          setTransactionData(
            res.ledgers.map(mapLedger).sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
          );
        } else {
          setTransactionData([]);
        }
      } catch {
        toast.error('Failed to fetch ledger');
        setTransactionData([]);
      } finally {
        setLedgerLoading(false);
      }
    })();
  }, [selectedUser?._id]);

  /* ── search handler ── */
  const handleSearch = async () => {
    setSearched(true);
    if (!searchTerm.trim()) {
      setFilteredRetailers(allRetailers);
      return;
    }
    try {
      setListLoading(true);
      const res = await searchRetailerUsers({ searchTerm: searchTerm.trim(), page: 1, limit: 50 });
      setFilteredRetailers(formatRetailerData(res?.data?.data || []));
    } catch {
      /* fallback to client-side filter */
      setFilteredRetailers(
        allRetailers.filter((r) =>
          r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.shopName.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } finally {
      setListLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSearch(); };

  /* ── date filter ── */
  const handleDateFilter = async () => {
    if (!selectedUser?._id) return toast.error('Select a user first');
    if (!startDate || !endDate) return toast.error('Select both dates');
    try {
      setLedgerLoading(true);
      const res = await getRetailerLedgerById(selectedUser._id);
      if (res?.success && Array.isArray(res.ledgers)) {
        const filtered = res.ledgers.filter((l) => {
          const d = new Date(l.date).toISOString().split('T')[0];
          return d >= startDate && d <= endDate;
        });
        setTransactionData(
          filtered.map(mapLedger).sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
        );
        if (!filtered.length) toast.info('No transactions in that range');
      }
    } catch {
      toast.error('Failed to filter');
    } finally {
      setLedgerLoading(false);
    }
  };

  /* ── approve ── */
  const handleApprove = async (transaction) => {
    if (!transaction?.id) return toast.error('Missing ledger ID');
    try {
      setActionStatuses((p) => ({ ...p, [transaction.id]: 'approved' }));
      const res = await approveLedger(String(transaction.id), { isApproved: true });
      toast.success(res?.msg || 'Approved');
      await refreshLedger();
    } catch (err) {
      setActionStatuses((p) => ({ ...p, [transaction.id]: undefined }));
      toast.error(err?.response?.data?.msg || 'Failed to approve');
    }
  };

  /* ── reject ── */
  const handleReject = async (transaction) => {
    if (!transaction?.id) return toast.error('Missing ledger ID');
    try {
      setActionStatuses((p) => ({ ...p, [transaction.id]: 'rejected' }));
      const res = await rejectLedger(String(transaction.id), { isRejected: true });
      toast.success(res?.msg || 'Rejected');
      await refreshLedger();
    } catch (err) {
      setActionStatuses((p) => ({ ...p, [transaction.id]: undefined }));
      toast.error(err?.response?.data?.msg || 'Failed to reject');
    }
  };

  const refreshLedger = async () => {
    if (!selectedUser?._id) return;
    try {
      const res = await getRetailerLedgerById(selectedUser._id);
      if (res?.success && Array.isArray(res.ledgers)) {
        setTransactionData(
          res.ledgers.map(mapLedger).sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
        );
      }
    } catch { /* silent */ }
  };

  /* ── view image drawer ── */
  const handleViewImage = (transaction) => {
    setDrawerImageSrc(transaction?.image || null);
    setIsDrawerOpen(true);
  };

  /* ── reset search ── */
  const resetSearch = () => {
    setSearchTerm('');
    setFilteredRetailers([]);
    setSearched(false);
  };

  const displayList = searched ? filteredRetailers : [];

  /* ── shared classes ── */
  const inputCls = 'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        .sp-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .sp-row { transition: background 0.15s, box-shadow 0.15s; }
        .sp-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        @keyframes spIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .sp-animate { animation: spIn 0.22s ease both; }
        @keyframes drawerIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        .sp-drawer { animation: drawerIn 0.25s cubic-bezier(0.4,0,0.2,1); }
        .sp-no-scroll::-webkit-scrollbar { display:none; }
        .sp-no-scroll { scrollbar-width:none; }
      `}</style>

      <div className="sp-page">

        {/* ══════════════════════════════════════
            DETAIL VIEW
        ══════════════════════════════════════ */}
        {selectedUser ? (
          <div className="sp-animate">
            {/* Header */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedUser(null); setTransactionData([]); setStartDate(''); setEndDate(''); setActionStatuses({}); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all shadow-sm"
                >
                  <MdArrowBack size={18} />
                </button>
                <div>
                  <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">{selectedUser.name}</h2>
                  <p className="text-sm text-[#9CA3AF] mt-0.5">
                    {selectedUser.shopName} &nbsp;·&nbsp; Balance:&nbsp;
                    <span className="font-bold text-[#FF5934]">PKR {selectedUser.balance}</span>
                    &nbsp;·&nbsp;
                    <span className={`font-semibold ${selectedUser.isActive ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Date filter */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                <input type="date" value={startDate} max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent outline-none text-sm text-[#374151]" />
                <span className="text-[#9CA3AF] text-xs">to</span>
                <input type="date" value={endDate} min={startDate} max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent outline-none text-sm text-[#374151]" />
                <button onClick={handleDateFilter} disabled={!startDate || !endDate}
                  className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors">
                  Filter
                </button>
                {(startDate || endDate) && (
                  <button onClick={() => { setStartDate(''); setEndDate(''); refreshLedger(); }}
                    className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                    <MdClose size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Total Entries', value: transactionData.length },
                { label: 'Pending Recovery', value: recoveryRows.length },
                { label: 'Balance', value: `PKR ${selectedUser.balance}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                  <p className="text-[13px] font-bold text-[#FF5934]">{value}</p>
                  <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Recovery Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#FAFAFA]">
                <div className="flex items-center gap-2">
                  <MdOutlineReceipt size={16} className="text-[#FF5934]" />
                  <span className="text-[13px] font-bold text-[#374151]">Recovery Entries</span>
                  <span className="bg-[#FF5934]/10 text-[#FF5934] text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {recoveryRows.length}
                  </span>
                </div>
                <button onClick={refreshLedger}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-[#9CA3AF] hover:text-[#FF5934] hover:border-[#FF5934] transition-all">
                  <MdRefresh size={15} />
                </button>
              </div>

              {ledgerLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {['ID', 'Details', 'Ref No.', 'V. No.', 'Qty', 'Dr.', 'Date', 'Balance', 'Action'].map((h) => (
                          <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recoveryVisible.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <MdOutlineReceipt size={24} className="text-gray-300" />
                              </div>
                              <p className="text-[#9CA3AF] text-sm font-medium">No recovery entries found</p>
                            </div>
                          </td>
                        </tr>
                      ) : recoveryVisible.map((t, idx) => (
                        <tr key={t.id || idx} className="sp-row">
                          {/* ID */}
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                              #{t.id ? String(t.id).slice(0, 6).toUpperCase() : 'N/A'}
                            </span>
                          </td>
                          {/* Details */}
                          <td className="px-4 py-3 text-[13px] text-[#374151] max-w-[160px] truncate">{t.details}</td>
                          {/* Ref No */}
                          <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{t.refNo ?? '—'}</td>
                          {/* V. No */}
                          <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{t.voucherNo ?? '—'}</td>
                          {/* Qty */}
                          <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{t.quantity ?? '—'}</td>
                          {/* Dr */}
                          <td className="px-4 py-3">
                            {t.dr !== '0'
                              ? <span className="text-[13px] font-semibold text-emerald-600">PKR {t.dr}</span>
                              : <span className="text-[#9CA3AF]">—</span>}
                          </td>
                          {/* Date */}
                          <td className="px-4 py-3 text-[12px] text-[#6B7280]">{t.date}</td>
                          {/* Balance */}
                          <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {t.balance}</td>
                          {/* Action */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {t.isRejected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-600 ring-1 ring-red-200">Rejected</span>
                              ) : actionStatuses[t.id] === 'approved' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">Approved</span>
                              ) : actionStatuses[t.id] === 'rejected' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-600 ring-1 ring-red-200">Rejected</span>
                              ) : (
                                <>
                                  <button onClick={() => handleApprove(t)} title="Approve"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 transition-all">
                                    <AiOutlineCheck size={14} />
                                  </button>
                                  <button onClick={() => handleReject(t)} title="Reject"
                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all">
                                    <AiOutlineClose size={14} />
                                  </button>
                                </>
                              )}
                              {/* View image */}
                              <button onClick={() => handleViewImage(t)} title="View Image"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all">
                                <FaRegEye size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {recoveryRows.length > TRANSACTIONS_PER_PAGE && (
                <div className="flex items-center gap-1.5 px-4 py-3 border-t border-gray-100">
                  <button disabled={recoveryPage === 1} onClick={() => setRecoveryPage((p) => p - 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <GrFormPrevious size={16} />
                  </button>
                  <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                    <span className="font-semibold text-[#FF5934]">{recoveryPage}</span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span>{recoveryTotalPages}</span>
                  </div>
                  <button disabled={recoveryPage >= recoveryTotalPages} onClick={() => setRecoveryPage((p) => p + 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                    <GrFormNext size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ══════════════════════════════════════
              SEARCH / LIST VIEW
          ══════════════════════════════════════ */
          <div className="sp-animate">
            {/* Page header */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Sales Payments</h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">Search a customer to view recovery entries</p>
              </div>
            </div>

            {/* Search bar */}
            <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1">
                <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                  type="search"
                  placeholder="Search by name or shop name…"
                />
                {searchTerm && (
                  <button onClick={resetSearch} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                    <MdClose size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleSearch}
                disabled={listLoading}
                className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
              >
                {listLoading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <MdSearch size={16} />}
                Search
              </button>
            </div>

            {/* Results */}
            {!searched ? (
              /* Prompt state */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl bg-[#FFF4F2] border border-[#FFD7CE] flex items-center justify-center mb-4 shadow-sm">
                  <MdSearch size={32} className="text-[#FF5934]" />
                </div>
                <h3 className="text-[16px] font-bold text-[#374151] mb-1">Search a Customer</h3>
                <p className="text-sm text-[#9CA3AF] max-w-xs">
                  Type a customer or shop name above and press Search or Enter to find their recovery records.
                </p>
              </div>
            ) : displayList.length === 0 ? (
              /* No results */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-4">
                  <MdPerson size={32} className="text-gray-300" />
                </div>
                <h3 className="text-[16px] font-bold text-[#374151] mb-1">No customers found</h3>
                <p className="text-sm text-[#9CA3AF]">Try a different name or clear the search.</p>
                <button onClick={resetSearch}
                  className="mt-4 text-[#FF5934] text-sm font-semibold hover:underline">
                  Clear Search
                </button>
              </div>
            ) : (
              /* Results table */
              <div className="sp-animate bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#FAFAFA]">
                  <span className="text-[13px] font-bold text-[#374151]">
                    {displayList.length} result{displayList.length !== 1 ? 's' : ''} found
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {['Customer', 'ID', 'Phone', 'Shop', 'Balance', 'Status', 'Action'].map((h) => (
                        <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayList.map((retailer) => (
                      <tr key={retailer._id} className="sp-row cursor-pointer" onClick={() => setSelectedUser(retailer)}>
                        {/* Customer */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <img
                                src={retailer.image}
                                alt={retailer.name}
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                                onError={(e) => { e.target.src = 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png'; }}
                              />
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${retailer.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            </div>
                            <span className="text-[13px] font-semibold text-[#111827]">{retailer.name}</span>
                          </div>
                        </td>
                        {/* ID */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                            #{retailer._id.slice(0, 6)}
                          </span>
                        </td>
                        {/* Phone */}
                        <td className="px-4 py-3 text-[13px] text-[#374151]">{retailer.phone}</td>
                        {/* Shop */}
                        <td className="px-4 py-3 text-[13px] text-[#374151]">{retailer.shopName}</td>
                        {/* Balance */}
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {retailer.balance}</td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1
                            ${retailer.isActive
                              ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                              : 'bg-gray-100 text-gray-400 ring-gray-200'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${retailer.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            {retailer.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedUser(retailer); }}
                            className="flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-all"
                          >
                            <FaRegEye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            IMAGE DRAWER
        ══════════════════════════════════════ */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40 backdrop-blur-[2px]" onClick={() => setIsDrawerOpen(false)} />
            <div className="sp-drawer w-[380px] max-w-[90vw] bg-white h-full shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-[15px] font-bold text-[#111827]">Recovery Image</h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-[#9CA3AF] transition-colors"
                >
                  <AiOutlineClose size={16} />
                </button>
              </div>
              <div className="p-5 flex-1 overflow-auto sp-no-scroll">
                {drawerImageSrc ? (
                  <img
                    src={drawerImageSrc}
                    alt="Recovery"
                    className="w-full h-auto rounded-2xl shadow-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-[#9CA3AF] gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                      <MdOutlineReceipt size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-medium">No image available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SalesPayments;