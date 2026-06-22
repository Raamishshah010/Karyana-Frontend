import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import {
  MdAdd, MdRefresh, MdSearch, MdFilterList, MdClose,
  MdReceipt, MdDelete, MdExpandMore, MdEdit,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { Loader } from '../components/common/loader';
import { Spinner } from '../components/common/spinner';
import {
  getAllPayments, searchPayments, getAllBanks,
  getAllPurchases, deletePayment,
} from '../APIS';

const LIMIT = 25;

const DATE_RANGE_OPTIONS = [
  { value: 'all',        label: 'All Dates' },
  { value: 'today',      label: 'Today' },
  { value: 'yesterday',  label: 'Yesterday' },
  { value: 'this_week',  label: 'This Week' },
  { value: 'last_week',  label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'custom',     label: 'Custom Range' },
];

const selectCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl outline-none text-sm text-[#111827] transition-all appearance-none cursor-pointer';

const inputCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300';

const FilterSelect = ({ label, value, onChange, options, placeholder = 'All' }) => (
  <div className="flex flex-col gap-1 min-w-[150px]">
    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</span>
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
    </div>
  </div>
);

const fmtAmount = n =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Payments = () => {
  const navigate = useNavigate();
  const token = useSelector(s => s.admin.token);

  const [data, setData]                 = useState([]);
  const [banks, setBanks]               = useState([]);
  const [suppliers, setSuppliers]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [filterBank, setFilterBank]           = useState('');
  const [filterSupplier, setFilterSupplier]   = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterStart, setFilterStart]         = useState('');
  const [filterEnd, setFilterEnd]             = useState('');

  const [selected, setSelected]   = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const fetchPayments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const hasFilter =
        filterBank || filterSupplier || (filterDateRange && filterDateRange !== 'all');

      let res;
      if (hasFilter) {
        const params = new URLSearchParams({
          ...(filterBank     && { bank: filterBank }),
          ...(filterSupplier && { supplier: filterSupplier }),
          ...(filterDateRange !== 'all' && { dateRange: filterDateRange }),
          ...(filterDateRange === 'custom' && filterStart && { startDate: filterStart }),
          ...(filterDateRange === 'custom' && filterEnd   && { endDate: filterEnd }),
          page,
          limit: LIMIT,
        });
        res = await searchPayments(params.toString());
      } else {
        res = await getAllPayments({ page, limit: LIMIT });
      }

      setData(res.data.data);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
      setTotalEntries(res.data.pagination?.total ?? res.data.data.length);
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message);
    } finally {
      setLoading(false);
    }
  }, [filterBank, filterSupplier, filterDateRange, filterStart, filterEnd]);

  useEffect(() => {
    getAllBanks()
      .then(r => {
        const list = Array.isArray(r.data?.data) ? r.data.data
          : Array.isArray(r.data) ? r.data : [];
        setBanks(list);
      })
      .catch(() => {});

    getAllPurchases()
      .then(r => {
        const list = Array.isArray(r.data?.data) ? r.data.data
          : Array.isArray(r.data) ? r.data : [];
        setSuppliers(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchPayments(currentPage); }, [currentPage, fetchPayments]);

  const applyFilters = () => { setCurrentPage(1); fetchPayments(1); };

  const clearFilters = () => {
    setFilterBank(''); setFilterSupplier('');
    setFilterDateRange('all'); setFilterStart(''); setFilterEnd('');
    setCurrentPage(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this payment? The amount will be restored to the bank.')) return;
    try {
      await deletePayment(id, token);
      toast.success('Payment deleted.');
      fetchPayments(currentPage);
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message);
    }
  };

  const toggleRow = id =>
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const toggleAll = () => {
    if (selectAll) { setSelected([]); setSelectAll(false); }
    else { setSelected(data.map(d => d.id)); setSelectAll(true); }
  };

  if (loading && !data.length) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .pay-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pay-row { transition: background 0.15s, box-shadow 0.15s; }
        .pay-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pay-cb { accent-color: #FF5934; width:15px; height:15px; cursor:pointer; }
      `}</style>

      <div className="pay-page">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Payments</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              Showing {data.length} of {totalEntries} entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayments(currentPage)}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2.5 rounded-xl hover:bg-orange-50 border border-gray-200 transition-all"
            >
              <MdRefresh size={16} />
            </button>
            <button
              onClick={() => navigate('/Add-Payments')}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
            >
              <MdAdd size={18} /> Add Payment
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-end gap-4">

            <FilterSelect
              label="Supplier"
              value={filterSupplier}
              onChange={setFilterSupplier}
              options={suppliers.map(s => ({ value: s._id, label: s.companyName }))}
              placeholder="All Suppliers"
            />

            <FilterSelect
              label="Bank"
              value={filterBank}
              onChange={setFilterBank}
              options={banks.map(b => ({ value: b._id, label: b.bankName }))}
              placeholder="All Banks"
            />

            <FilterSelect
              label="Date Range"
              value={filterDateRange}
              onChange={setFilterDateRange}
              options={DATE_RANGE_OPTIONS}
              placeholder="All Dates"
            />

            {filterDateRange === 'custom' && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">From</span>
                  <input
                    type="date" value={filterStart}
                    onChange={e => setFilterStart(e.target.value)}
                    className={inputCls + ' min-w-[140px]'}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">To</span>
                  <input
                    type="date" value={filterEnd}
                    onChange={e => setFilterEnd(e.target.value)}
                    className={inputCls + ' min-w-[140px]'}
                  />
                </div>
              </>
            )}

            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={applyFilters}
                className="flex items-center gap-1.5 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
              >
                <MdFilterList size={16} /> Filter
              </button>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-4 py-2.5 rounded-xl border border-gray-200 hover:border-[#FF5934]/30 hover:bg-orange-50 transition-all"
              >
                <MdClose size={15} /> Clear
              </button>
            </div>

            <div className="flex items-end gap-2 text-sm text-[#6B7280]">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Show</span>
                <div className="flex items-center gap-1 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 text-[#111827] font-semibold text-sm">
                  {LIMIT}
                </div>
              </div>
              <span className="pb-2.5">entries</span>
            </div>

          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-6 gap-2 text-[#FF5934] text-sm">
              <Spinner /> Loading…
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="pay-cb" checked={selectAll} onChange={toggleAll} />
                  </th>
                  {['V. No.', 'Date', 'Supplier', 'Bank', 'Description', 'Amount', 'Action'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <MdReceipt size={24} className="text-gray-300" />
                        </div>
                        <p className="text-[#9CA3AF] text-sm font-medium">No payments found</p>
                        <button onClick={clearFilters} className="text-[#FF5934] text-xs hover:underline">
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : data.map(payment => (
                  <tr key={payment.id} className="pay-row">

                    {/* Checkbox */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox" className="pay-cb"
                        checked={selected.includes(payment.id)}
                        onChange={() => toggleRow(payment.id)}
                      />
                    </td>

                    {/* Voucher No */}
                    <td className="px-4 py-3">
                      <span className="text-[#FF5934] font-bold text-[13px]">{payment.voucherNo}</span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#374151]">{payment.date}</span>
                    </td>

                    {/* Supplier */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">
                          {payment.supplier?.name || '—'}
                        </p>
                        {payment.supplier?.phone && (
                          <p className="text-[11px] text-[#9CA3AF]">{payment.supplier.phone}</p>
                        )}
                      </div>
                    </td>

                    {/* Bank */}
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">
                          {payment.bank?.name || '—'}
                        </p>
                        {payment.bank?.accountTitle && (
                          <p className="text-[11px] text-[#9CA3AF]">{payment.bank.accountTitle}</p>
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-[13px] text-[#374151] truncate">
                        {payment.description || '—'}
                      </p>
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] font-semibold text-[#111827]">
                        {fmtAmount(payment.amount)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => navigate(`/Add-Payments?edit=${payment.id}`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 text-xs font-medium transition-all"
                          title="Edit"
                        >
                          <MdEdit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-400 border border-gray-100 text-xs font-medium transition-all"
                          title="Delete"
                        >
                          <MdDelete size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#9CA3AF]">
            Showing {data.length ? ((currentPage - 1) * LIMIT) + 1 : 0} to{' '}
            {Math.min(currentPage * LIMIT, totalEntries)} of {totalEntries} entries
          </p>
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <GrFormPrevious size={16} />
            </button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <GrFormNext size={16} />
            </button>
          </div>
        </div>

      </div>
    </>
  );
};

export default Payments;