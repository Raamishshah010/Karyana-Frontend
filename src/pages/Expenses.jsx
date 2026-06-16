import { useEffect, useState, useCallback } from 'react';
import { Form, Formik } from 'formik';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import {
  MdAdd, MdClose, MdEdit, MdDelete, MdRefresh, MdReceipt,
  MdAccountBalance, MdCalendarToday, MdExpandMore, MdSearch,
  MdAttachMoney, MdArticle, MdNumbers, MdFilterList,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { checkAuthError } from '../utils';
import { Loader } from '../components/common/loader';
import { Spinner } from '../components/common/spinner';
import EscapeClose from '../components/EscapeClose';

import {
  getAllBanks,
  createExpense,
  getAllExpenses,
  updateExpense,
  deleteExpense,
  searchExpenses,
  getNominalAccounts,
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

const inputCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300';

const selectCls =
  'bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all appearance-none cursor-pointer';

const FieldGroup = ({ icon: Icon, label, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
      {Icon && <Icon size={12} className="text-[#FF5934]" />}
      {label}
    </label>
    {children}
  </div>
);

const FilterSelect = ({ label, value, onChange, options, placeholder = 'Select' }) => (
  <div className="flex flex-col gap-1 min-w-[160px]">
    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</span>
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={selectCls}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value ?? o._id} value={o.value ?? o._id}>
            {o.label ?? o.bankName ?? o}
          </option>
        ))}
      </select>
      <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
    </div>
  </div>
);

const Expenses = () => {
  const token = useSelector(s => s.admin.token);

  const [data, setData]                 = useState([]);
  const [banks, setBanks]               = useState([]);
  const [nominals, setNominals]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [filterBank, setFilterBank]           = useState('');
  const [filterNominal, setFilterNominal]     = useState('');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [filterStart, setFilterStart]         = useState('');
  const [filterEnd, setFilterEnd]             = useState('');

  const [selected, setSelected]   = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [showModal, setShowModal]           = useState(false);
  const [showDetail, setShowDetail]         = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  const emptyForm = { bankId: '', nominalAccount: '', refNo: '', details: '', amount: '', date: '' };
  const [formState, setFormState] = useState(emptyForm);

  const validations = yup.object().shape({
    bankId:         yup.string().required('Bank is required'),
    nominalAccount: yup.string().required('Nominal account is required'),
    details:        yup.string().required('Details are required'),
    amount:         yup.number().typeError('Must be a number').positive('Must be greater than 0').required('Amount is required'),
    date:           yup.string().required('Date is required'),
    refNo:          yup.string(),
  });

  const fetchExpenses = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const hasFilter = filterBank || filterNominal || (filterDateRange && filterDateRange !== 'all');
      let res;
      if (hasFilter) {
        const params = new URLSearchParams({
          ...(filterBank      && { bankId: filterBank }),
          ...(filterNominal   && { nominalAccount: filterNominal }),
          ...(filterDateRange !== 'all' && { dateRange: filterDateRange }),
          ...(filterDateRange === 'custom' && filterStart && { startDate: filterStart }),
          ...(filterDateRange === 'custom' && filterEnd   && { endDate: filterEnd }),
          page,
          limit: LIMIT,
        });
        res = await searchExpenses(params.toString());
      } else {
        res = await getAllExpenses({ page, limit: LIMIT });
      }
      setData(res.data.data);
      setTotalPages(res.data.pagination?.totalPages ?? 1);
      setTotalEntries(res.data.pagination?.total ?? res.data.data.length);
    } catch (err) {
      checkAuthError(err);
      toast.error(err.response?.data?.msg || err.message);
    } finally {
      setLoading(false);
    }
  }, [filterBank, filterNominal, filterDateRange, filterStart, filterEnd]);

  useEffect(() => {
    getAllBanks()
      .then(r => {
        // handle both { data: { data: [] } } and { data: [] }
        const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
        setBanks(list);
      })
      .catch(() => {});

    getNominalAccounts()
      .then(r => setNominals(r.data.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchExpenses(currentPage); }, [currentPage, fetchExpenses]);

  const applyFilters = () => { setCurrentPage(1); fetchExpenses(1); };

  const clearFilters = () => {
    setFilterBank('');
    setFilterNominal('');
    setFilterDateRange('all');
    setFilterStart('');
    setFilterEnd('');
    setCurrentPage(1);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormState(emptyForm);
    setShowModal(true);
  };

  const openEdit = (expense) => {
    setEditingExpense(expense);
    setFormState({
      bankId:         expense.bank?.id || '',
      nominalAccount: expense.nominalAccount || '',
      refNo:          expense.refNo || '',
      details:        expense.details || '',
      amount:         expense.amount || '',
      date:           expense.date || '',
    });
    setShowModal(true);
    setShowDetail(null);
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (editingExpense) {
        await updateExpense(editingExpense.id, values, token);
        toast.success('Expense updated successfully.');
      } else {
        await createExpense(values, token);
        toast.success('Expense payment done successfully.');
      }
      setShowModal(false);
      setFormState(emptyForm);
      fetchExpenses(currentPage);
    } catch (err) {
      checkAuthError(err);
      toast.error(err.response?.data?.msg || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      setLoading(true);
      await deleteExpense(id, token);
      toast.success('Expense deleted.');
      setShowDetail(null);
      fetchExpenses(currentPage);
    } catch (err) {
      checkAuthError(err);
      toast.error(err.response?.data?.msg || err.message);
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  const toggleAll = () => {
    if (selectAll) { setSelected([]); setSelectAll(false); }
    else { setSelected(data.map(d => d.id)); setSelectAll(true); }
  };

  const fmtAmount = (n) =>
    Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading && !data.length) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .exp-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .exp-row { transition: background 0.15s, box-shadow 0.15s; }
        .exp-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .exp-action { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .exp-action:hover { transform: scale(1.1); }
        @keyframes expIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes expOv { from { opacity:0; } to { opacity:1; } }
        .exp-overlay { animation: expOv 0.2s ease; }
        .exp-modal   { animation: expIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .exp-scroll::-webkit-scrollbar { display:none; } .exp-scroll { scrollbar-width:none; }
        .exp-cb { accent-color: #FF5934; width:15px; height:15px; cursor:pointer; }
        .exp-select-wrap { position:relative; }
        .exp-select-wrap select { -webkit-appearance:none; appearance:none; }
      `}</style>

      <div className="exp-page">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Bank Payments</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              Showing {data.length} of {totalEntries} entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchExpenses(currentPage)}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2.5 rounded-xl hover:bg-orange-50 border border-gray-200 transition-all"
            >
              <MdRefresh size={16} />
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
            >
              <MdAdd size={18} /> Add New
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 shadow-sm mb-5">
          <div className="flex flex-wrap items-end gap-4">

            <FilterSelect
              label="Bank"
              value={filterBank}
              onChange={setFilterBank}
              options={banks.map(b => ({ value: b._id, label: b.bankName }))}
              placeholder="All Banks"
            />

            <FilterSelect
              label="Nominal Account"
              value={filterNominal}
              onChange={setFilterNominal}
              options={nominals.map(n => ({ value: n, label: n }))}
              placeholder="All Nominals"
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
                    type="date"
                    value={filterStart}
                    onChange={e => setFilterStart(e.target.value)}
                    className={inputCls + ' min-w-[140px]'}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">To</span>
                  <input
                    type="date"
                    value={filterEnd}
                    onChange={e => setFilterEnd(e.target.value)}
                    className={inputCls + ' min-w-[140px]'}
                  />
                </div>
              </>
            )}

            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={applyFilters}
                className="flex items-center gap-1.5 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm shadow-orange-100 transition-all"
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
                    <input type="checkbox" className="exp-cb" checked={selectAll} onChange={toggleAll} />
                  </th>
                  {['V. No.', 'Date', 'Bank', 'Nominal Account', 'Ref. No.', 'Details', 'Amount', 'Action'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <MdReceipt size={24} className="text-gray-300" />
                        </div>
                        <p className="text-[#9CA3AF] text-sm font-medium">No expenses found</p>
                        <button onClick={clearFilters} className="text-[#FF5934] text-xs hover:underline">
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : data.map((expense) => (
                  <tr
                    key={expense.id}
                    className="exp-row cursor-pointer"
                    onClick={() => setShowDetail(expense)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="exp-cb"
                        checked={selected.includes(expense.id)}
                        onChange={() => toggleRow(expense.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#FF5934] font-bold text-[13px]">{expense.voucherNo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#374151]">{expense.date}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-medium text-[#111827]">{expense.bank?.name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] text-[#374151]">{expense.nominalAccount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] font-mono text-[#6B7280]">{expense.refNo || '—'}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-[13px] text-[#374151] truncate">{expense.details}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[13px] font-semibold text-[#111827]">{fmtAmount(expense.amount)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(expense)}
                          className="exp-action flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 text-xs font-medium"
                          title="Edit"
                        >
                          <MdEdit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="exp-action flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-400 border border-gray-100 text-xs font-medium"
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


        {/* ══════════════════════════════════════
            ADD / EDIT MODAL
        ══════════════════════════════════════ */}
        {showModal && (
          <div className="exp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="exp-modal bg-white w-full max-w-[480px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {editingExpense ? 'Editing Expense' : 'New Expense'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {editingExpense ? 'Edit Payment' : 'Add New Payment'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                initialValues={formState}
                validationSchema={validations}
                onSubmit={handleSubmit}
                enableReinitialize
              >
                {({ errors, touched, setFieldValue, values }) => (
                  <Form className="exp-scroll overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 pt-7 pb-6 flex flex-col gap-4 -mt-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 flex flex-col gap-4">

                        {/* Bank */}
                        <FieldGroup icon={MdAccountBalance} label="Bank">
                          <div className="exp-select-wrap">
                            <select
                              value={values.bankId}
                              onChange={e => setFieldValue('bankId', e.target.value)}
                              className={selectCls + (errors.bankId && touched.bankId ? ' border-red-300' : '')}
                            >
                              <option value="">Select bank…</option>
                              {banks.map(b => (
                                <option key={b._id} value={b._id}>{b.bankName}</option>
                              ))}
                            </select>
                            <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                          </div>
                          {errors.bankId && touched.bankId && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.bankId}</p>
                          )}
                        </FieldGroup>

                        {/* Nominal Account */}
                        <FieldGroup icon={MdArticle} label="Nominal Account">
                          <div className="exp-select-wrap">
                            <input
                              list="nominals-list"
                              value={values.nominalAccount}
                              onChange={e => setFieldValue('nominalAccount', e.target.value)}
                              placeholder="e.g. Wages & Salaries"
                              className={inputCls + (errors.nominalAccount && touched.nominalAccount ? ' border-red-300' : '')}
                            />
                            <datalist id="nominals-list">
                              {nominals.map(n => <option key={n} value={n} />)}
                            </datalist>
                          </div>
                          {errors.nominalAccount && touched.nominalAccount && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.nominalAccount}</p>
                          )}
                        </FieldGroup>

                        {/* Ref No + Date */}
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdNumbers} label="Ref. No.">
                            <input
                              value={values.refNo}
                              onChange={e => setFieldValue('refNo', e.target.value)}
                              placeholder="Optional"
                              className={inputCls}
                            />
                          </FieldGroup>
                          <FieldGroup icon={MdCalendarToday} label="Date">
                            <input
                              type="date"
                              value={values.date}
                              onChange={e => setFieldValue('date', e.target.value)}
                              className={inputCls + (errors.date && touched.date ? ' border-red-300' : '')}
                            />
                            {errors.date && touched.date && (
                              <p className="text-red-400 text-[11px] mt-1">{errors.date}</p>
                            )}
                          </FieldGroup>
                        </div>

                        {/* Details */}
                        <FieldGroup icon={MdArticle} label="Details">
                          <textarea
                            value={values.details}
                            onChange={e => setFieldValue('details', e.target.value)}
                            placeholder="Payment description…"
                            rows={3}
                            className={inputCls + ' resize-none ' + (errors.details && touched.details ? ' border-red-300' : '')}
                          />
                          {errors.details && touched.details && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.details}</p>
                          )}
                        </FieldGroup>

                        {/* Amount */}
                        <FieldGroup icon={MdAttachMoney} label="Amount (PKR)">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={values.amount}
                            onChange={e => setFieldValue('amount', e.target.value)}
                            placeholder="0.00"
                            className={inputCls + (errors.amount && touched.amount ? ' border-red-300' : '')}
                          />
                          {errors.amount && touched.amount && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.amount}</p>
                          )}
                        </FieldGroup>

                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {submitting
                          ? <><Spinner /> Saving…</>
                          : editingExpense
                            ? <><MdEdit size={16} /> Save Changes</>
                            : <><MdAdd size={16} /> Add Payment</>
                        }
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}


        {/* ══════════════════════════════════════
            DETAIL MODAL
        ══════════════════════════════════════ */}
        {showDetail && (
          <div
            className="exp-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowDetail(null)}
          >
            <div
              className="exp-modal bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-14 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between mb-4">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Payment Details</span>
                  <button
                    onClick={() => setShowDetail(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative">
                  <p className="text-white/50 text-xs mb-1">Voucher #{showDetail.voucherNo}</p>
                  <h3 className="text-white text-xl font-bold leading-tight">{showDetail.nominalAccount}</h3>
                  <p className="text-[#FF5934] text-2xl font-bold mt-2">PKR {fmtAmount(showDetail.amount)}</p>
                </div>
              </div>

              {/* Stats strip */}
              <div className="-mt-5 mx-5 grid grid-cols-2 gap-2 z-10 relative">
                {[
                  { label: 'Bank', value: showDetail.bank?.name || '—' },
                  { label: 'Date', value: showDetail.date },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className="text-[13px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="exp-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                {[
                  { icon: MdNumbers,        label: 'Ref. No.',        value: showDetail.refNo || '—',              mono: true },
                  { icon: MdArticle,        label: 'Nominal Account', value: showDetail.nominalAccount },
                  { icon: MdArticle,        label: 'Details',         value: showDetail.details },
                  { icon: MdAccountBalance, label: 'Bank Account',    value: showDetail.bank?.accountTitle || '—' },
                  { icon: MdAttachMoney,    label: 'Amount',          value: `PKR ${fmtAmount(showDetail.amount)}` },
                ].map(({ icon: Icon, label, value, mono }) => (
                  <div key={label} className="flex items-start gap-3 bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={15} className="text-[#FF5934]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                      <p className={`text-[13px] text-[#374151] font-medium break-words ${mono ? 'font-mono' : ''}`}>
                        {value || <span className="text-gray-300 italic">Not provided</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button
                  onClick={() => openEdit(showDetail)}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <MdEdit size={15} /> Edit Payment
                </button>
                <button
                  onClick={() => setShowDetail(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDelete(showDetail.id)}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                  title="Delete"
                >
                  <MdDelete size={16} />
                </button>
              </div>

              <EscapeClose onClose={() => setShowDetail(null)} />
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Expenses;