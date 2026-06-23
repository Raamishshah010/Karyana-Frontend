import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getAllRetailers,
  getRetailerLedgerById,
  getAllCreditNotes,
} from "../APIS";
import { toast } from "react-toastify";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  MdClose,
  MdArrowBack,
  MdPerson,
  MdOutlineReceipt,
  MdRefresh,
  MdKeyboardArrowDown,
  MdFilterList,
  MdSearch,
} from "react-icons/md";

const TRANSACTIONS_PER_PAGE = 11;
const CREDIT_NOTE_FETCH_LIMIT = 1000;
const PLACEHOLDER_IMAGE =
  "https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png";

/* ─── helpers ─────────────────────────────────────── */
const toNumber = (val) => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? "0").replace(/[^0-9.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoney = (val) => toNumber(val).toLocaleString();

const isOrderEntry = (entry) => {
  const details = String(entry?.details ?? entry?.description ?? "");
  return (
    /order\s+.*\s+placed/i.test(details) ||
    /^order\b/i.test(details) ||
    /invoice/i.test(details) ||
    /\bsale\b/i.test(details)
  );
};

const isReturnEntry = (entry) => {
  const details = String(
    entry?.details ?? entry?.description ?? ""
  ).toLowerCase();
  const type = String(entry?.type || "").toUpperCase();

  return (
    ["RETURN", "CREDIT_NOTE", "CREDITNOTE"].includes(type) ||
    details.includes("credit note") ||
    details.includes("return") ||
    details.includes("returned")
  );
};

const formatLedgerDetails = (entry) => {
  const base = entry?.description ?? entry?.details ?? "Transaction";

  if (isOrderEntry(entry)) return "Order punched from app";
  if (isReturnEntry(entry)) return base || "Credit note / return";

  return base;
};

const formatRetailerData = (list = []) =>
  list.map((r) => ({
    _id: r._id || "N/A",
    name: r.name || "N/A",
    phone: r.phone || r.phoneNumber || "N/A",
    shopName: r.shopName || "N/A",
    image: r.image || PLACEHOLDER_IMAGE,
    isActive: r.isActive || false,
    balance: fmtMoney(r.balance || 0),
  }));

const pickAmount = (entry) => {
  const candidates = [
    entry?.amount,
    entry?.totalAmount,
    entry?.netAmount,
    entry?.invoiceAmount,
    entry?.grandTotal,
    entry?.total,
    entry?.debit,
    entry?.credit,
  ];

  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== 0) return n;
  }

  return toNumber(entry?.amount || 0);
};

const CREDIT_TYPES = [
  "PAYMENT",
  "RECEIPT",
  "CR",
  "CREDIT",
  "RETURN",
  "CREDIT_NOTE",
  "CREDITNOTE",
];

const isCreditEntry = (entry) => {
  if (isOrderEntry(entry)) return false;
  if (isReturnEntry(entry)) return true;
  return CREDIT_TYPES.includes(String(entry?.type || "").toUpperCase());
};

const effectiveType = (entry) => {
  if (isOrderEntry(entry)) return "ORDER";
  if (isReturnEntry(entry)) return "CREDIT_NOTE";
  return String(entry?.type || "").toUpperCase();
};

const getTypeLabel = (row) => {
  const type = String(row?.type || "").toUpperCase();

  if (type === "CREDIT_NOTE") return "Returned";
  if (type === "ORDER") return "PAYMENT";

  return type || "—";
};

const mapLedger = (ledger) => {
  const amount = pickAmount(ledger);
  const credit = isCreditEntry(ledger);

  return {
    id: ledger.transactionId || ledger._id,
    sourceId: ledger._id,
    source: "ledger",

    details: formatLedgerDetails(ledger),
    refNo: ledger.refNo ?? ledger.referenceNo ?? null,
    voucherNo: ledger.voucherNo ?? ledger.invoiceNo ?? null,
    quantity: ledger.quantity ?? null,

    type: effectiveType(ledger),
    rawType: ledger.type,

    rawAmount: amount,
    rawBalance: Number.isFinite(toNumber(ledger?.balance))
      ? toNumber(ledger?.balance)
      : null,
    isCredit: credit,

    debit: credit ? 0 : amount,
    credit: credit ? amount : 0,

    date: ledger.date ? new Date(ledger.date).toISOString().split("T")[0] : "-",
    sortTime: new Date(ledger.createdAt || ledger.date || 0).getTime(),

    isApproved: ledger.isApproved === false ? false : true,
    isRejected: ledger.isRejected === true,
    isImported: ledger.isImportedFromExcel === true,

    image: ledger.image || null,
  };
};

const mapCreditNoteToLedger = (cn) => {
  const amount = toNumber(cn?.total || 0);
  const quantity = Array.isArray(cn?.items)
    ? cn.items.reduce((sum, item) => sum + toNumber(item?.quantity || 0), 0)
    : null;

  return {
    id: `CN-${cn._id}`,
    sourceId: cn._id,
    source: "credit-note",

    details: `Credit note${quantity ? ` (${quantity} items)` : ""}`,
    refNo: cn?.creditNoteId || null,
    voucherNo: null,
    quantity,

    type: "CREDIT_NOTE",
    rawType: "CREDIT_NOTE",

    rawAmount: amount,
    rawBalance: null,
    isCredit: true,

    debit: 0,
    credit: amount,

    date: cn?.date ? new Date(cn.date).toISOString().split("T")[0] : "-",
    sortTime: new Date(cn?.createdAt || cn?.date || 0).getTime(),

    isApproved: true,
    isRejected: false,
    isImported: false,

    image: null,
  };
};

const isLikelyCreditNoteLedgerRow = (row) => {
  const type = String(row?.type || "").toUpperCase();
  const details = String(row?.details || "").toLowerCase();

  return (
    ["CREDIT_NOTE", "RETURN", "CREDITNOTE"].includes(type) ||
    details.includes("credit note") ||
    details.includes("return") ||
    details.includes("returned")
  );
};

const computeRunningBalances = (rows = [], latestBalanceFallback = null) => {
  if (!rows.length) return [];

  const asc = [...rows].sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));

  let anchorIndex = -1;
  let anchorBalance = null;

  for (let i = asc.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(asc[i].rawBalance) && asc[i].rawBalance !== null) {
      anchorIndex = i;
      anchorBalance = asc[i].rawBalance;
      break;
    }
  }

  if (anchorIndex === -1 && Number.isFinite(latestBalanceFallback)) {
    anchorIndex = asc.length - 1;
    anchorBalance = latestBalanceFallback;
  }

  if (anchorIndex === -1) {
    return [...rows]
      .sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
      .map((row) => ({
        ...row,
        runningBalance: null,
        balanceDisplay: "—",
      }));
  }

  const work = asc.map((row) => ({
    ...row,
    runningBalance: null,
  }));

  work[anchorIndex].runningBalance = anchorBalance;

  for (let i = anchorIndex - 1; i >= 0; i -= 1) {
    const nextRow = work[i + 1];
    const nextDelta = nextRow.isCredit
      ? -toNumber(nextRow.rawAmount)
      : toNumber(nextRow.rawAmount);
    work[i].runningBalance = toNumber(nextRow.runningBalance) - nextDelta;
  }

  for (let i = anchorIndex + 1; i < work.length; i += 1) {
    const prevRow = work[i - 1];
    const currDelta = work[i].isCredit
      ? -toNumber(work[i].rawAmount)
      : toNumber(work[i].rawAmount);
    work[i].runningBalance = toNumber(prevRow.runningBalance) + currDelta;
  }

  return work
    .sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0))
    .map((row) => ({
      ...row,
      balanceDisplay:
        Number.isFinite(row.runningBalance) && row.runningBalance !== null
          ? fmtMoney(row.runningBalance)
          : "—",
    }));
};

/* ─── component ───────────────────────────────────── */
const SalesPayments = () => {
  const [allRetailers, setAllRetailers] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const dropdownRef = useRef(null);

  const [selectedUser, setSelectedUser] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);

  const dropdownList = allRetailers.filter((r) => {
    const q = dropdownSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.shopName.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setDropdownSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setListLoading(true);
        const res = await getAllRetailers();
        setAllRetailers(formatRetailerData(res?.data?.data || []));
      } catch {
        toast.error("Failed to load retailers");
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  const fetchMergedLedger = useCallback(
    async (retailerId) => {
      try {
        setLedgerLoading(true);

        const [ledgerRes, creditNotesRes] = await Promise.all([
          getRetailerLedgerById(retailerId),
          getAllCreditNotes(1, CREDIT_NOTE_FETCH_LIMIT),
        ]);

        const ledgerRows =
          ledgerRes?.success && Array.isArray(ledgerRes.ledgers)
            ? ledgerRes.ledgers.map(mapLedger)
            : [];

        const creditNoteRows = Array.isArray(creditNotesRes?.data?.data)
          ? creditNotesRes.data.data
              .filter(
                (cn) =>
                  String(cn?.RetailerUser?._id || "") === String(retailerId)
              )
              .map(mapCreditNoteToLedger)
          : [];

        const ledgerCreditNoteSignatures = new Set(
          ledgerRows
            .filter(isLikelyCreditNoteLedgerRow)
            .map(
              (row) =>
                `${row.date}|${toNumber(row.rawAmount)}|${toNumber(row.quantity)}`
            )
        );

        const uniqueCreditNoteRows = creditNoteRows.filter((row) => {
          const sig = `${row.date}|${toNumber(row.rawAmount)}|${toNumber(row.quantity)}`;
          return !ledgerCreditNoteSignatures.has(sig);
        });

        const mergedRows = [...ledgerRows, ...uniqueCreditNoteRows];

        const latestBalanceFallback = toNumber(selectedUser?.balance || 0);
        const withRunningBalance = computeRunningBalances(
          mergedRows,
          latestBalanceFallback
        );

        setTransactionData(withRunningBalance);
      } catch {
        toast.error("Failed to fetch ledger");
        setTransactionData([]);
      } finally {
        setLedgerLoading(false);
      }
    },
    [selectedUser?.balance]
  );

  useEffect(() => {
    if (!selectedUser?._id) return;
    setCurrentPage(1);
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    fetchMergedLedger(selectedUser._id);
  }, [selectedUser?._id, fetchMergedLedger]);

  useEffect(() => {
    if (!selectedUser?._id) return;

    const onFocus = () => fetchMergedLedger(selectedUser._id);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchMergedLedger(selectedUser._id);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedUser?._id, fetchMergedLedger]);

  const refreshLedger = async () => {
    if (!selectedUser?._id) return;
    await fetchMergedLedger(selectedUser._id);
  };

  const handleDateFilter = () => {
    if (!selectedUser?._id) return toast.error("Select a user first");
    if (!startDate || !endDate) return toast.error("Select both dates");

    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setCurrentPage(1);
  };

  const handleSelectUser = (retailer) => {
    setSelectedUser(retailer);
    setDropdownOpen(false);
    setDropdownSearch("");
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
    setCurrentPage(1);
  };

  const filteredRows = useMemo(() => {
  return transactionData.filter((row) => {
    const displayType = getTypeLabel(row).toUpperCase();


const matchesType =
  typeFilter === "all" || displayType === typeFilter.toUpperCase();

    const matchesStart = !appliedStartDate || row.date >= appliedStartDate;
    const matchesEnd = !appliedEndDate || row.date <= appliedEndDate;

    return matchesType && matchesStart && matchesEnd;
  });
}, [transactionData, typeFilter, appliedStartDate, appliedEndDate]);

  const totalPages =
    Math.ceil(filteredRows.length / TRANSACTIONS_PER_PAGE) || 1;
  const pageStart = (currentPage - 1) * TRANSACTIONS_PER_PAGE;
  const visibleRows = filteredRows.slice(
    pageStart,
    pageStart + TRANSACTIONS_PER_PAGE
  );

  const debitRows = filteredRows.filter((row) => row.debit > 0);
  const creditRows = filteredRows.filter((row) => row.credit > 0);

  const pendingDebitRows = debitRows.filter(
    (row) =>
      row.source === "ledger" &&
      !row.isImported &&
      row.isApproved === false &&
      !row.isRejected
  );

  const pendingCreditRows = creditRows.filter(
    (row) =>
      row.source === "ledger" &&
      !row.isImported &&
      row.isApproved === false &&
      !row.isRejected
  );

  const totalDebitAmount = filteredRows.reduce(
    (sum, row) => sum + toNumber(row.debit),
    0
  );
  const totalCreditAmount = filteredRows.reduce(
    (sum, row) => sum + toNumber(row.credit),
    0
  );

 const transactionTypes = [
  ...new Set(
    transactionData
      .map((t) => getTypeLabel(t))
      .filter((t) => t && t !== "—")
  ),
];

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, appliedStartDate, appliedEndDate]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        .sp-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .sp-row { transition: background 0.15s, box-shadow 0.15s; }
        .sp-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        @keyframes spIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .sp-animate { animation: spIn 0.22s ease both; }
        @keyframes ddIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .sp-dropdown { animation: ddIn 0.15s ease both; }
        .sp-no-scroll::-webkit-scrollbar { display:none; }
        .sp-no-scroll { scrollbar-width:none; }
      `}</style>

      <div className="sp-page">
        {selectedUser ? (
          <div className="sp-animate">
            {/* Header */}
            <div className="flex items-center justify-between mt-6 mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setTransactionData([]);
                    setStartDate("");
                    setEndDate("");
                    setAppliedStartDate("");
                    setAppliedEndDate("");
                    setTypeFilter("all");
                    setCurrentPage(1);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all shadow-sm"
                >
                  <MdArrowBack size={18} />
                </button>

                <div>
                  <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                    {selectedUser.name}
                  </h2>
                  <p className="text-sm text-[#9CA3AF] mt-0.5">
                    {selectedUser.shopName} &nbsp;·&nbsp; Balance:&nbsp;
                    <span className="font-bold text-[#FF5934]">
                      PKR {selectedUser.balance}
                    </span>
                    &nbsp;·&nbsp;
                    <span
                      className={`font-semibold ${
                        selectedUser.isActive
                          ? "text-emerald-500"
                          : "text-gray-400"
                      }`}
                    >
                      {selectedUser.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {transactionTypes.length > 0 && (
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                    <MdFilterList size={14} className="text-[#9CA3AF]" />
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="bg-transparent outline-none text-sm text-[#374151] pr-1"
                    >
                      <option value="all">All Types</option>
                      {transactionTypes.map((t) => (
  <option key={t} value={t}>
    {t}
  </option>
))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                  <input
                    type="date"
                    value={startDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent outline-none text-sm text-[#374151]"
                  />
                  <span className="text-[#9CA3AF] text-xs">to</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent outline-none text-sm text-[#374151]"
                  />
                  <button
                    onClick={handleDateFilter}
                    disabled={!startDate || !endDate}
                    className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors"
                  >
                    Filter
                  </button>
                  {(startDate ||
                    endDate ||
                    appliedStartDate ||
                    appliedEndDate) && (
                    <button
                      onClick={clearDateFilter}
                      className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors"
                    >
                      <MdClose size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-5 gap-3 mb-5">
              {[
                { label: "Debit Entries", value: debitRows.length },
                { label: "Credit Entries", value: creditRows.length },
                { label: "Pending Debit", value: pendingDebitRows.length },
                { label: "Pending Credit", value: pendingCreditRows.length },
                { label: "Balance", value: `PKR ${selectedUser.balance}` },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm"
                >
                  <p className="text-[13px] font-bold text-[#FF5934]">
                    {value}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                <p className="text-[13px] font-bold text-emerald-600">
                  PKR {fmtMoney(totalDebitAmount)}
                </p>
                <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">
                  Total Debit Amount
                </p>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                <p className="text-[13px] font-bold text-sky-600">
                  PKR {fmtMoney(totalCreditAmount)}
                </p>
                <p className="text-[11px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">
                  Total Credit Amount
                </p>
              </div>
            </div>

            {/* Combined Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-[#FAFAFA]">
                <div className="flex items-center gap-2">
                  <MdOutlineReceipt size={16} className="text-[#FF5934]" />
                  <span className="text-[13px] font-bold text-[#374151]">
                    Ledger Entries
                  </span>
                  <span className="bg-[#FF5934]/10 text-[#FF5934] text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {filteredRows.length}
                  </span>
                  <span className="text-[11px] text-[#9CA3AF] ml-1">
                    ledger + credit notes
                  </span>
                </div>

                <button
                  onClick={refreshLedger}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-[#9CA3AF] hover:text-[#FF5934] hover:border-[#FF5934] transition-all"
                >
                  <MdRefresh size={15} />
                </button>
              </div>

              {ledgerLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-50">
                        {[
                          "ID",
                          "Details",
                          "Type",
                          "Ref No.",
                          "V. No.",
                          "Qty",
                          "Debit",
                          "Credit",
                          "Running Balance",
                          "Date",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-50">
                      {visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-16 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <MdOutlineReceipt
                                  size={24}
                                  className="text-gray-300"
                                />
                              </div>
                              <p className="text-[#9CA3AF] text-sm font-medium">
                                No entries found
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        visibleRows.map((t, idx) => (
                          <tr key={t.id || idx} className="sp-row">
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                #{String(t.id).slice(-8).toUpperCase()}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-[13px] text-[#374151] max-w-[220px] truncate">
                              {t.details}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${
                                  t.isCredit
                                    ? "bg-sky-50 text-sky-600 ring-sky-200"
                                    : "bg-emerald-50 text-emerald-600 ring-emerald-200"
                                }`}
                              >
                                {getTypeLabel(t)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                              {t.refNo ?? "—"}
                            </td>

                            <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                              {t.voucherNo ?? "—"}
                            </td>

                            <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                              {t.quantity ?? "—"}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`text-[13px] font-semibold ${
                                  t.debit > 0
                                    ? "text-emerald-600"
                                    : "text-gray-300"
                                }`}
                              >
                                PKR {t.debit > 0 ? fmtMoney(t.debit) : "0"}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`text-[13px] font-semibold ${
                                  t.credit > 0
                                    ? "text-sky-600"
                                    : "text-gray-300"
                                }`}
                              >
                                PKR {t.credit > 0 ? fmtMoney(t.credit) : "0"}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span className="text-[13px] font-semibold text-[#111827]">
                                {t.balanceDisplay === "—"
                                  ? "—"
                                  : `PKR ${t.balanceDisplay}`}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-[12px] text-[#6B7280]">
                              {t.date}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredRows.length > TRANSACTIONS_PER_PAGE && (
                <div className="flex items-center gap-1.5 px-4 py-3 border-t border-gray-100">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <GrFormPrevious size={16} />
                  </button>

                  <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                    <span className="font-semibold text-[#FF5934]">
                      {currentPage}
                    </span>
                    <span className="text-gray-300 mx-1">/</span>
                    <span>{totalPages}</span>
                  </div>

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <GrFormNext size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="sp-animate">
            <div className="flex items-center justify-between mt-6 mb-5">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">
                  Sales Payments
                </h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  Select a customer to view ledger + sale credit notes
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm mb-5">
              <label className="block text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">
                Select Customer
              </label>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  disabled={listLoading}
                  className="w-full flex items-center justify-between gap-3 bg-[#F9FAFB] border border-gray-200 hover:border-[#FF5934] focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-4 py-3 rounded-xl outline-none text-sm transition-all"
                >
                  {listLoading ? (
                    <div className="flex items-center gap-2 text-[#9CA3AF]">
                      <div className="w-4 h-4 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                      <span>Loading customers…</span>
                    </div>
                  ) : selectedUser ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedUser.image}
                        alt={selectedUser.name}
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0"
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_IMAGE;
                        }}
                      />
                      <div className="text-left">
                        <span className="font-semibold text-[#111827]">
                          {selectedUser.name}
                        </span>
                        <span className="text-[#9CA3AF] ml-2 text-xs">
                          {selectedUser.shopName}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#9CA3AF]">
                      — Choose a customer —
                    </span>
                  )}

                  <MdKeyboardArrowDown
                    size={18}
                    className={`text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {dropdownOpen && (
                  <div className="sp-dropdown absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-[#FAFAFA]">
                      <MdSearch
                        size={15}
                        className="text-[#9CA3AF] flex-shrink-0"
                      />
                      <input
                        autoFocus
                        value={dropdownSearch}
                        onChange={(e) => setDropdownSearch(e.target.value)}
                        placeholder="Type to filter…"
                        className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#C4C8D0] w-full"
                      />
                      {dropdownSearch && (
                        <button
                          onClick={() => setDropdownSearch("")}
                          className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors"
                        >
                          <MdClose size={13} />
                        </button>
                      )}
                    </div>

                    <ul className="max-h-64 overflow-y-auto sp-no-scroll divide-y divide-gray-50">
                      {dropdownList.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                          No customers match
                        </li>
                      ) : (
                        dropdownList.map((retailer) => (
                          <li
                            key={retailer._id}
                            onClick={() => handleSelectUser(retailer)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#FFF4F2] transition-colors group"
                          >
                            <div className="relative flex-shrink-0">
                              <img
                                src={retailer.image}
                                alt={retailer.name}
                                className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                                onError={(e) => {
                                  e.target.src = PLACEHOLDER_IMAGE;
                                }}
                              />
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                  retailer.isActive
                                    ? "bg-emerald-400"
                                    : "bg-gray-300"
                                }`}
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-[#111827] truncate group-hover:text-[#FF5934] transition-colors">
                                {retailer.name}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF] truncate">
                                {retailer.shopName} &nbsp;·&nbsp;{" "}
                                {retailer.phone}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className="text-[12px] font-semibold text-[#111827]">
                                PKR {retailer.balance}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  retailer.isActive
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {retailer.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </li>
                        ))
                      )}
                    </ul>

                    <div className="px-4 py-2 border-t border-gray-100 bg-[#FAFAFA]">
                      <span className="text-[11px] text-[#9CA3AF]">
                        {dropdownList.length} of {allRetailers.length} customers
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-3xl bg-[#FFF4F2] border border-[#FFD7CE] flex items-center justify-center mb-4 shadow-sm">
                <MdPerson size={32} className="text-[#FF5934]" />
              </div>
              <h3 className="text-[16px] font-bold text-[#374151] mb-1">
                No customer selected
              </h3>
              <p className="text-sm text-[#9CA3AF] max-w-xs">
                Use the dropdown above to pick a customer and view merged ledger
                and sale credit note entries.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SalesPayments;
