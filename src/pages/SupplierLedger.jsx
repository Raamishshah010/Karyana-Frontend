import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import { MdArrowBack, MdRefresh, MdReceipt } from 'react-icons/md';
import { Loader } from '../components/common/loader';
import { getTransactionsByCompanyId, getPaymentsBySupplier } from '../APIS';

const ACCENT = '#FF5934';
const LIMIT = 25;

const fmtPKR = (n) =>
  `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const typeBadge = (type) => {
  const map = {
    PURCHASE:    { bg: 'bg-blue-50',   text: 'text-blue-600',   ring: 'ring-blue-200',   label: 'Purchase'    },
    PAYMENT:     { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200', label: 'Payment'  },
    CREDIT_NOTE: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-200',  label: 'Credit Note' },
    DEBIT:       { bg: 'bg-red-50',    text: 'text-red-600',    ring: 'ring-red-200',     label: 'Debit'       },
  };
  const s = map[type] || { bg: 'bg-gray-50', text: 'text-gray-500', ring: 'ring-gray-200', label: type || '—' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {s.label}
    </span>
  );
};

const SupplierLedger = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // supplier info passed via navigate state, or fallback to just id
  const supplierFromState = location.state?.supplier;
  const [supplier] = useState(supplierFromState || { _id: id, companyName: 'Supplier' });

  const [loading, setLoading]         = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);

  // ── combined + sorted ledger entries ──
  const [ledger, setLedger] = useState([]);

  const buildLedger = useCallback((txns, pmts) => {
    const txnList = Array.isArray(txns) ? txns : [];
    const pmtList = Array.isArray(pmts) ? pmts : [];

    // The /transactions ledger already records payments as rows with
    // type === 'PAYMENT', and links back to the source payment doc via
    // `transactionId`. If we also pull the same payment from
    // /payments, we'd count it twice — once from each endpoint.
    const alreadyInLedger = new Set(
      txnList.map((t) => t.transactionId).filter(Boolean)
    );

    const txnRows = txnList.map((t) => ({
      _id:         t._id,
      date:        t.date || t.createdAt,
      type:        t.type || 'PURCHASE',
      description: t.details || t.description || '—',
      debit:       t.type === 'PAYMENT' ? 0 : Number(t.amount || 0),
      credit:      t.type === 'PAYMENT' ? Number(t.amount || 0) : 0,
      // server already returns a running balance for ledger rows — trust it
      apiBalance:  t.balance ?? null,
      ref:         t.voucherNo || t.billNo || '—',
    }));

    const pmtRows = pmtList
      .filter((p) => !alreadyInLedger.has(p._id)) // skip duplicates of ledger PAYMENT rows
      .map((p) => ({
        _id:         p._id,
        date:        p.date || p.createdAt,
        type:        'PAYMENT',
        description: p.description || `Payment via ${p.bank?.bankName || 'bank'}`,
        debit:       0,
        credit:      Number(p.amount || 0),
        apiBalance:  null, // /payments doesn't carry a running balance
        ref:         p.voucherNo || '—',
      }));

    const combined = [...txnRows, ...pmtRows].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // Running balance: trust the API's own balance whenever a row has one
    // (keeps us in sync with the server), otherwise fall back to adding
    // this row's debit/credit on top of the last known balance.
    let running = 0;
    const withBalance = combined.map((row) => {
      running = row.apiBalance != null ? row.apiBalance : running + row.debit - row.credit;
      return { ...row, runningBalance: running };
    });

    return withBalance;
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [txnRes, pmtRes] = await Promise.allSettled([
        getTransactionsByCompanyId(id),
        getPaymentsBySupplier(id, 1, 1000),
      ]);

      const txnRaw = txnRes.status === 'fulfilled' ? txnRes.value : null;
      const txns =
        Array.isArray(txnRaw)               ? txnRaw               :
        Array.isArray(txnRaw?.transactions) ? txnRaw.transactions  :
        Array.isArray(txnRaw?.ledgers)      ? txnRaw.ledgers       :
        Array.isArray(txnRaw?.data?.data)   ? txnRaw.data.data     :
        Array.isArray(txnRaw?.data)         ? txnRaw.data          :
        [];

      const pmtRaw = pmtRes.status === 'fulfilled' ? pmtRes.value : null;
      const pmts =
        Array.isArray(pmtRaw?.data?.data) ? pmtRaw.data.data :
        Array.isArray(pmtRaw?.data)       ? pmtRaw.data      :
        Array.isArray(pmtRaw)             ? pmtRaw           :
        [];

      const built = buildLedger(txns, pmts);
      setLedger(built);
      setTotalPages(Math.ceil(built.length / LIMIT) || 1);
    } catch (err) {
      toast.error('Failed to load ledger');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, buildLedger]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── totals ──
  const totalDebit  = ledger.reduce((s, r) => s + r.debit, 0);
  const totalCredit = ledger.reduce((s, r) => s + r.credit, 0);
  const balance     = totalDebit - totalCredit;

  // ── paginated rows ──
  const start         = (currentPage - 1) * LIMIT;
  const paginatedRows = ledger.slice(start, start + LIMIT);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .sl-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .sl-row { transition: background 0.15s, box-shadow 0.15s; }
        .sl-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .sl-scroll::-webkit-scrollbar { display:none; }
        .sl-scroll  { scrollbar-width:none; }
      `}</style>

      <div className="sl-page min-h-screen bg-gray-50">

        {/* ── Top Bar ── */}
        <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors"
              >
                <MdArrowBack size={17} />
              </button>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Suppliers / Ledger</p>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  {supplier.companyName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAll}
                className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2.5 rounded-xl hover:bg-orange-50 border border-gray-200 transition-all"
              >
                <MdRefresh size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Purchases (Dr.)', value: fmtPKR(totalDebit),  color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100'     },
              { label: 'Total Payments (Cr.)',  value: fmtPKR(totalCredit), color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { label: 'Balance (Payable)',      value: fmtPKR(Math.abs(balance)),
                color: balance > 0 ? 'text-[#FF5934]' : 'text-emerald-600',
                bg: balance > 0 ? 'bg-orange-50' : 'bg-emerald-50',
                border: balance > 0 ? 'border-orange-100' : 'border-emerald-100',
                extra: balance > 0 ? 'You owe supplier' : balance < 0 ? 'Supplier owes you' : 'Settled',
              },
            ].map(({ label, value, color, bg, border, extra }) => (
              <div key={label} className={`${bg} ${border} border rounded-2xl p-5`}>
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                <p className={`text-[20px] font-bold ${color}`}>{value}</p>
                {extra && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{extra}</p>}
              </div>
            ))}
          </div>

          {/* ── Supplier Info strip ── */}
          {(supplier.phone || supplier.address || supplier.email) && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap gap-4 items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff8c6b)` }}>
                {supplier.companyName?.split(' ').filter(w => w !== '&').map(w => w[0]?.toUpperCase()).join('').slice(0, 2) || 'S'}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 flex-1">
                {supplier.phone   && <span className="text-[12px] text-[#374151]">📞 {supplier.phone}</span>}
                {supplier.email   && <span className="text-[12px] text-[#374151]">✉️ {supplier.email}</span>}
                {supplier.address && <span className="text-[12px] text-[#374151]">📍 {supplier.address}</span>}
              </div>
            </div>
          )}

          {/* ── Ledger Table ── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-[#FAFAFA] flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-gray-700">Transaction History</p>
              <span className="text-[11px] text-[#9CA3AF]">{ledger.length} entries</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                    {['Date', 'Type', 'Description', 'Ref.', 'Debit (Dr.)', 'Credit (Cr.)', 'Balance'].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <MdReceipt size={24} className="text-gray-300" />
                          </div>
                          <p className="text-[#9CA3AF] text-sm font-medium">No transactions yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRows.map((row, idx) => (
                    <tr key={row._id || idx} className="sl-row">
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">
                        {row.date ? new Date(row.date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="px-4 py-3">{typeBadge(row.type)}</td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-[13px] text-[#374151] truncate">{row.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono text-[#9CA3AF]">{row.ref}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.debit > 0
                          ? <span className="text-[13px] font-semibold text-red-500">{fmtPKR(row.debit)}</span>
                          : <span className="text-[12px] text-gray-200">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.credit > 0
                          ? <span className="text-[13px] font-semibold text-emerald-600">{fmtPKR(row.credit)}</span>
                          : <span className="text-[12px] text-gray-200">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[13px] font-bold ${row.runningBalance > 0 ? 'text-[#FF5934]' : 'text-emerald-600'}`}>
                          {fmtPKR(Math.abs(row.runningBalance))}
                          <span className="text-[10px] font-normal ml-1">
                            {row.runningBalance > 0 ? 'Dr' : row.runningBalance < 0 ? 'Cr' : ''}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Totals footer */}
                {ledger.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-[#FAFAFA]">
                      <td colSpan={4} className="px-4 py-3 text-[12px] font-bold text-[#374151]">Total</td>
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-red-500">{fmtPKR(totalDebit)}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-emerald-600">{fmtPKR(totalCredit)}</td>
                      <td className="px-4 py-3 text-right text-[13px] font-bold" style={{ color: ACCENT }}>
                        {fmtPKR(Math.abs(balance))}
                        <span className="text-[10px] font-normal ml-1">{balance > 0 ? 'Dr' : balance < 0 ? 'Cr' : ''}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#9CA3AF]">
                Showing {start + 1}–{Math.min(start + LIMIT, ledger.length)} of {ledger.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <GrFormPrevious size={16} />
                </button>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                  <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                  <span className="text-gray-300">/</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <GrFormNext size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default SupplierLedger;