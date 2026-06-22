import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import {
  MdAdd, MdRefresh, MdSearch, MdFilterList, MdClose,
  MdReceipt, MdDelete, MdExpandMore, MdEdit,
  MdArrowBack, MdAccountBalance, MdBusiness,
  MdAttachMoney, MdArticle, MdCalendarToday,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { Loader } from '../components/common/loader';
import { Spinner } from '../components/common/spinner';
import { Form, Formik } from 'formik';
import * as yup from 'yup';
import {
  getAllPayments, searchPayments, getAllBanks,
  getAllPurchases, deletePayment,
  createPayment, updatePayment, getPaymentById,
} from '../APIS';

const LIMIT  = 25;
const ACCENT = '#FF5934';

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
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all appearance-none cursor-pointer';

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

const FieldGroup = ({ icon: Icon, label, error, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
      {Icon && <Icon size={12} style={{ color: ACCENT }} />}
      {label}
    </label>
    {children}
    {error && <p className="text-red-400 text-[11px] mt-1">{error}</p>}
  </div>
);

const validationSchema = yup.object().shape({
  supplier:    yup.string().required('Supplier is required'),
  bank:        yup.string().required('Bank is required'),
  amount:      yup.number().typeError('Must be a number').positive('Must be greater than 0').required('Amount is required'),
  description: yup.string(),
  date:        yup.string().required('Date is required'),
});

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtAmount = n =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ════════════════════════════════════════
   PAYMENT MODAL
════════════════════════════════════════ */
const PaymentModal = ({ open, onClose, editId, banks, suppliers, token, onSuccess }) => {
  const isEdit = !!editId;
  const [submitting, setSubmitting]     = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [initialValues, setInitialValues] = useState({
    supplier: '', bank: '', amount: '', description: '', date: todayISO(),
  });

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setModalLoading(true);
      getPaymentById(editId)
        .then(res => {
          const p = res.data?.data || res.data;
          if (p) setInitialValues({
            supplier:    p.supplier?._id || p.supplier || '',
            bank:        p.bank?._id     || p.bank     || '',
            amount:      p.amount        || '',
            description: p.description   || '',
            date:        p.date ? new Date(p.date).toISOString().slice(0, 10) : todayISO(),
          });
        })
        .catch(() => toast.error('Failed to load payment'))
        .finally(() => setModalLoading(false));
    } else {
      setInitialValues({ supplier: '', bank: '', amount: '', description: '', date: todayISO() });
    }
  }, [open, editId, isEdit]);

  const getSelectedBank = (bankId) => banks.find(b => b._id === bankId);

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (isEdit) {
        await updatePayment(editId, values, token);
        toast.success('Payment updated successfully.');
      } else {
        await createPayment(values, token);
        toast.success('Payment created successfully.');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message || 'Failed to save payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white w-full max-w-[560px] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ animation: 'modalIn .25s cubic-bezier(.34,1.2,.64,1)' }}
      >
        {/* Modal header */}
        <div
          className="relative px-6 pt-5 pb-10 overflow-hidden flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, #ff8c6b)` }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                {isEdit ? 'Editing Payment' : 'New Payment'}
              </p>
              <h2 className="text-white text-xl font-bold">
                {isEdit ? 'Update Payment Details' : 'Add New Payment'}
              </h2>
              <p className="text-white/60 text-xs mt-1">
                Payment will be deducted from the selected bank account
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
            >
              <MdClose size={16} />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
          {modalLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-[#FF5934]">
              <Spinner /> Loading…
            </div>
          ) : (
            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
              enableReinitialize
            >
              {({ values, errors, touched, setFieldValue }) => (
                <Form>
                  <div className="px-6 pt-7 pb-4 flex flex-col gap-4 -mt-5">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 flex flex-col gap-4">

                      {/* Supplier */}
                      <FieldGroup
                        icon={MdBusiness}
                        label="Supplier"
                        error={errors.supplier && touched.supplier ? errors.supplier : null}
                      >
                        <div className="relative">
                          <select
                            value={values.supplier}
                            onChange={e => setFieldValue('supplier', e.target.value)}
                            className={selectCls + (errors.supplier && touched.supplier ? ' border-red-300' : '')}
                          >
                            <option value="">Select supplier…</option>
                            {suppliers.map(s => (
                              <option key={s._id} value={s._id}>{s.companyName}</option>
                            ))}
                          </select>
                          <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        </div>
                      </FieldGroup>

                      {/* Bank */}
                      <FieldGroup
                        icon={MdAccountBalance}
                        label="Bank"
                        error={errors.bank && touched.bank ? errors.bank : null}
                      >
                        <div className="relative">
                          <select
                            value={values.bank}
                            onChange={e => setFieldValue('bank', e.target.value)}
                            className={selectCls + (errors.bank && touched.bank ? ' border-red-300' : '')}
                          >
                            <option value="">Select bank…</option>
                            {banks.map(b => (
                              <option key={b._id} value={b._id}>{b.bankName}</option>
                            ))}
                          </select>
                          <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                        </div>
                        {values.bank && (() => {
                          const bank = getSelectedBank(values.bank);
                          if (!bank) return null;
                          return (
                            <div className="flex items-center justify-between mt-2 px-3 py-2 bg-[#F9FAFB] rounded-xl border border-gray-100">
                              <span className="text-[11px] text-[#9CA3AF] font-semibold">Available Balance</span>
                              <span className={`text-[12px] font-bold ${bank.balance > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                PKR {Number(bank.balance || 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          );
                        })()}
                      </FieldGroup>

                      {/* Amount + Date */}
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup
                          icon={MdAttachMoney}
                          label="Amount (PKR)"
                          error={errors.amount && touched.amount ? errors.amount : null}
                        >
                          <input
                            type="number" min="0" step="0.01"
                            value={values.amount}
                            onChange={e => setFieldValue('amount', e.target.value)}
                            placeholder="0.00"
                            className={inputCls + (errors.amount && touched.amount ? ' border-red-300' : '')}
                          />
                          {values.bank && values.amount && (() => {
                            const bank = getSelectedBank(values.bank);
                            if (bank && Number(values.amount) > bank.balance) {
                              return <p className="text-amber-500 text-[11px] mt-1">⚠ Exceeds bank balance</p>;
                            }
                            return null;
                          })()}
                        </FieldGroup>

                        <FieldGroup
                          icon={MdCalendarToday}
                          label="Date"
                          error={errors.date && touched.date ? errors.date : null}
                        >
                          <input
                            type="date"
                            value={values.date}
                            onChange={e => setFieldValue('date', e.target.value)}
                            className={inputCls + (errors.date && touched.date ? ' border-red-300' : '')}
                          />
                        </FieldGroup>
                      </div>

                      {/* Description */}
                      <FieldGroup icon={MdArticle} label="Description">
                        <textarea
                          value={values.description}
                          onChange={e => setFieldValue('description', e.target.value)}
                          placeholder="Payment description or notes…"
                          rows={3}
                          className={inputCls + ' resize-none'}
                        />
                      </FieldGroup>
                    </div>

                    {/* Summary strip */}
                    {values.bank && values.amount && values.supplier && (() => {
                      const bank     = getSelectedBank(values.bank);
                      const supplier = suppliers.find(s => s._id === values.supplier);
                      const newBal   = (bank?.balance || 0) - Number(values.amount);
                      return (
                        <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Payment Summary</p>
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: 'Supplier',      value: supplier?.companyName || '—' },
                              { label: 'Bank',          value: bank?.bankName || '—' },
                              { label: 'Amount',        value: `PKR ${Number(values.amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}` },
                              { label: 'Balance After', value: `PKR ${newBal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`, color: newBal < 0 ? 'text-red-500' : 'text-emerald-600' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="bg-white rounded-xl px-3 py-2.5 border border-gray-100">
                                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                                <p className={`text-[13px] font-semibold truncate ${color || 'text-[#111827]'}`}>{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] flex-shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 h-11 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-lg shadow-orange-100"
                      style={{ background: ACCENT }}
                    >
                      {submitting
                        ? <><Spinner /> Saving…</>
                        : isEdit
                          ? <><MdEdit size={16} /> Update Payment</>
                          : <><MdAdd size={16} /> Save Payment</>
                      }
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
const Payments = () => {
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

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId]       = useState(null);

  const openAdd  = ()     => { setEditId(null);  setModalOpen(true); };
  const openEdit = (id)   => { setEditId(id);    setModalOpen(true); };
  const closeModal = ()   => { setModalOpen(false); setEditId(null); };

  const fetchPayments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const hasFilter = filterBank || filterSupplier || (filterDateRange && filterDateRange !== 'all');
      let res;
      if (hasFilter) {
        const params = new URLSearchParams({
          ...(filterBank     && { bank: filterBank }),
          ...(filterSupplier && { supplier: filterSupplier }),
          ...(filterDateRange !== 'all' && { dateRange: filterDateRange }),
          ...(filterDateRange === 'custom' && filterStart && { startDate: filterStart }),
          ...(filterDateRange === 'custom' && filterEnd   && { endDate: filterEnd }),
          page, limit: LIMIT,
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
      .then(r => setBanks(Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
    getAllPurchases()
      .then(r => setSuppliers(Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : []))
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

  const toggleRow = id => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
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
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
      `}</style>

      <div className="pay-page">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Payments</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">Showing {data.length} of {totalEntries} entries</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayments(currentPage)}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2.5 rounded-xl hover:bg-orange-50 border border-gray-200 transition-all"
            >
              <MdRefresh size={16} />
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdAdd size={18} /> Add Payment
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-end gap-4">
            <FilterSelect label="Supplier" value={filterSupplier} onChange={setFilterSupplier}
              options={suppliers.map(s => ({ value: s._id, label: s.companyName }))} placeholder="All Suppliers" />
            <FilterSelect label="Bank" value={filterBank} onChange={setFilterBank}
              options={banks.map(b => ({ value: b._id, label: b.bankName }))} placeholder="All Banks" />
            <FilterSelect label="Date Range" value={filterDateRange} onChange={setFilterDateRange}
              options={DATE_RANGE_OPTIONS} placeholder="All Dates" />
            {filterDateRange === 'custom' && (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">From</span>
                  <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className={inputCls + ' min-w-[140px]'} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">To</span>
                  <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className={inputCls + ' min-w-[140px]'} />
                </div>
              </>
            )}
            <div className="flex items-end gap-2 ml-auto">
              <button onClick={applyFilters}
                className="flex items-center gap-1.5 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all">
                <MdFilterList size={16} /> Filter
              </button>
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-4 py-2.5 rounded-xl border border-gray-200 hover:border-[#FF5934]/30 hover:bg-orange-50 transition-all">
                <MdClose size={15} /> Clear
              </button>
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
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">{h}</th>
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
                        <button onClick={clearFilters} className="text-[#FF5934] text-xs hover:underline">Clear filters</button>
                      </div>
                    </td>
                  </tr>
                ) : data.map(payment => (
                  <tr key={payment.id} className="pay-row">
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="pay-cb" checked={selected.includes(payment.id)} onChange={() => toggleRow(payment.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#FF5934] font-bold text-[13px]">{payment.voucherNo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#374151]">{payment.date}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">{payment.supplier?.name || '—'}</p>
                        {payment.supplier?.phone && <p className="text-[11px] text-[#9CA3AF]">{payment.supplier.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-[13px] font-medium text-[#111827]">{payment.bank?.name || '—'}</p>
                        {payment.bank?.accountTitle && <p className="text-[11px] text-[#9CA3AF]">{payment.bank.accountTitle}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-[13px] text-[#374151] truncate">{payment.description || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] font-semibold text-[#111827]">{fmtAmount(payment.amount)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(payment.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 text-xs font-medium transition-all"
                        >
                          <MdEdit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-400 border border-gray-100 text-xs font-medium transition-all"
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
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <GrFormPrevious size={16} />
            </button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <GrFormNext size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment Modal ── */}
      <PaymentModal
        open={modalOpen}
        onClose={closeModal}
        editId={editId}
        banks={banks}
        suppliers={suppliers}
        token={token}
        onSuccess={() => fetchPayments(currentPage)}
      />
    </>
  );
};

export default Payments;