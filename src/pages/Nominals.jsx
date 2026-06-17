import { useEffect, useState, useCallback } from 'react';
import { Form, Formik } from 'formik';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import {
  MdAdd, MdClose, MdEdit, MdDelete, MdRefresh, MdArticle,
  MdExpandMore, MdFilterList, MdNumbers, MdToggleOn, MdToggleOff,
  MdTrendingUp, MdTrendingDown, MdSwapVert,
} from 'react-icons/md';
import { useSelector } from 'react-redux';
import { checkAuthError } from '../utils';
import { Loader } from '../components/common/loader';
import { Spinner } from '../components/common/spinner';
import EscapeClose from '../components/EscapeClose';

import {
  getAllNominalAccounts,
  createNominalAccount,
  updateNominalAccount,
  deleteNominalAccount,
} from '../APIS';

const LIMIT = 25;

const TYPE_OPTIONS = [
  { value: 'INCOME',  label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
];

const NATURE_OPTIONS = [
  { value: 'DEBIT',  label: 'Debit' },
  { value: 'CREDIT', label: 'Credit' },
];

const STATUS_OPTIONS = [
  { value: 'true',  label: 'Active' },
  { value: 'false', label: 'Inactive' },
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
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
    </div>
  </div>
);

const TypeBadge = ({ type }) => {
  const isIncome = type === 'INCOME';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
      isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-[#FF5934]'
    }`}>
      {isIncome ? <MdTrendingUp size={13} /> : <MdTrendingDown size={13} />}
      {isIncome ? 'Income' : 'Expense'}
    </span>
  );
};

const NatureBadge = ({ nature }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F9FAFB] text-[#6B7280] border border-gray-200">
    <MdSwapVert size={13} className="text-[#9CA3AF]" />
    {nature === 'DEBIT' ? 'Debit' : 'Credit'}
  </span>
);

const Nominals = () => {
  const token = useSelector(s => s.admin.token);

  const [data, setData]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  const [filterType, setFilterType]     = useState('');
  const [filterNature, setFilterNature] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [selected, setSelected]   = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);

  const emptyForm = { code: '', name: '', type: '', nature: '', isActive: true };
  const [formState, setFormState] = useState(emptyForm);

  const createValidations = yup.object().shape({
    code:   yup.string().required('Code is required'),
    name:   yup.string().required('Name is required'),
    type:   yup.string().oneOf(['INCOME', 'EXPENSE']).required('Type is required'),
    nature: yup.string().oneOf(['DEBIT', 'CREDIT']).required('Nature is required'),
  });

  const updateValidations = yup.object().shape({
    code:   yup.string().required('Code is required'),
    name:   yup.string().required('Name is required'),
    type:   yup.string().oneOf(['INCOME', 'EXPENSE']).required('Type is required'),
    nature: yup.string().oneOf(['DEBIT', 'CREDIT']).required('Nature is required'),
  });

  const fetchNominals = useCallback(async (page = 1) => {
    try {
      setLoading(true);

      const params = { page, limit: LIMIT };
      if (filterType)   params.type   = filterType;
      if (filterNature) params.nature = filterNature;
      if (filterStatus !== '') params.isActive = filterStatus === 'true'; // ← string to boolean

      const res = await getAllNominalAccounts(params);
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setData(list);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
      setTotalEntries(res.data?.pagination?.total ?? list.length);
    } catch (err) {
      checkAuthError(err);
      toast.error(err.response?.data?.msg || err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterNature, filterStatus]);
  useEffect(() => { fetchNominals(currentPage); }, [currentPage, fetchNominals]);

  const applyFilters = () => { setCurrentPage(1); fetchNominals(1); };

const clearFilters = () => {
  setFilterType('');
  setFilterNature('');
  setFilterStatus('');
  setCurrentPage(1);
  // fetch directly with no filters
  getAllNominalAccounts({ page: 1, limit: LIMIT })
    .then(res => {
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setData(list);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
      setTotalEntries(res.data?.pagination?.total ?? list.length);
    })
    .catch(err => toast.error(err.response?.data?.msg || err.message));
};

  const openAdd = () => {
    setEditingAccount(null);
    setFormState(emptyForm);
    setShowModal(true);
  };

  const openEdit = (account) => {
    setEditingAccount(account);
    setFormState({
      code:     account.code || '',
      name:     account.name || '',
      type:     account.type || '',
      nature:   account.nature || '',
      isActive: account.isActive ?? true,
    });
    setShowModal(true);
    setShowDetail(null);
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (editingAccount) {
        await updateNominalAccount(editingAccount._id || editingAccount.id, values, token);
        toast.success('Nominal account updated successfully.');
      } else {
        await createNominalAccount(values, token);
        toast.success('Nominal account created successfully.');
      }
      setShowModal(false);
      setFormState(emptyForm);
      fetchNominals(currentPage);
    } catch (err) {
      checkAuthError(err);
      toast.error(err.response?.data?.msg || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this nominal account?')) return;
    try {
      setLoading(true);
      await deleteNominalAccount(id, token);
      toast.success('Nominal account deleted.');
      setShowDetail(null);
      fetchNominals(currentPage);
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
    else { setSelected(data.map(d => d._id || d.id)); setSelectAll(true); }
  };

  if (loading && !data.length) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .nom-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .nom-row { transition: background 0.15s, box-shadow 0.15s; }
        .nom-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .nom-action { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .nom-action:hover { transform: scale(1.1); }
        @keyframes nomIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes nomOv { from { opacity:0; } to { opacity:1; } }
        .nom-overlay { animation: nomOv 0.2s ease; }
        .nom-modal   { animation: nomIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .nom-scroll::-webkit-scrollbar { display:none; } .nom-scroll { scrollbar-width:none; }
        .nom-cb { accent-color: #FF5934; width:15px; height:15px; cursor:pointer; }
        .nom-select-wrap { position:relative; }
        .nom-select-wrap select { -webkit-appearance:none; appearance:none; }
      `}</style>

      <div className="nom-page">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Nominal Accounts</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              Showing {data.length} of {totalEntries} entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNominals(currentPage)}
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
              label="Type"
              value={filterType}
              onChange={setFilterType}
              options={TYPE_OPTIONS}
              placeholder="All Types"
            />

            <FilterSelect
              label="Nature"
              value={filterNature}
              onChange={setFilterNature}
              options={NATURE_OPTIONS}
              placeholder="All Natures"
            />

            <FilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={STATUS_OPTIONS}
              placeholder="All Statuses"
            />

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
                    <input type="checkbox" className="nom-cb" checked={selectAll} onChange={toggleAll} />
                  </th>
                  {['Code', 'Name', 'Type', 'Nature', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                          <MdArticle size={24} className="text-gray-300" />
                        </div>
                        <p className="text-[#9CA3AF] text-sm font-medium">No nominal accounts found</p>
                        <button onClick={clearFilters} className="text-[#FF5934] text-xs hover:underline">
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : data.map((account) => {
                  const id = account._id || account.id;
                  return (
                  <tr
                    key={id}
                    className="nom-row cursor-pointer"
                    onClick={() => setShowDetail(account)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="nom-cb"
                        checked={selected.includes(id)}
                        onChange={() => toggleRow(id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[#FF5934] font-bold text-[13px] font-mono">{account.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-medium text-[#111827]">{account.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={account.type} />
                    </td>
                    <td className="px-4 py-3">
                      <NatureBadge nature={account.nature} />
                    </td>
                    <td className="px-4 py-3">
                      {account.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                          <MdToggleOn size={16} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400">
                          <MdToggleOff size={16} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(account)}
                          className="nom-action flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 text-xs font-medium"
                          title="Edit"
                        >
                          <MdEdit size={13} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(id)}
                          className="nom-action flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-400 border border-gray-100 text-xs font-medium"
                          title="Delete"
                        >
                          <MdDelete size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
          <div className="nom-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="nom-modal bg-white w-full max-w-[480px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {editingAccount ? 'Editing Account' : 'New Account'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {editingAccount ? 'Edit Nominal Account' : 'Add Nominal Account'}
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
                validationSchema={editingAccount ? updateValidations : createValidations}
                onSubmit={handleSubmit}
                enableReinitialize
              >
                {({ errors, touched, setFieldValue, values }) => (
                  <Form className="nom-scroll overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 pt-7 pb-6 flex flex-col gap-4 -mt-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-5 flex flex-col gap-4">

                        {/* Code + Name */}
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdNumbers} label="Code">
                            <input
                              value={values.code}
                              onChange={e => setFieldValue('code', e.target.value)}
                              placeholder="e.g. 4001"
                              className={inputCls + (errors.code && touched.code ? ' border-red-300' : '')}
                            />
                            {errors.code && touched.code && (
                              <p className="text-red-400 text-[11px] mt-1">{errors.code}</p>
                            )}
                          </FieldGroup>
                          <FieldGroup icon={MdArticle} label="Name">
                            <input
                              value={values.name}
                              onChange={e => setFieldValue('name', e.target.value)}
                              placeholder="e.g. Fuel & Travel"
                              className={inputCls + (errors.name && touched.name ? ' border-red-300' : '')}
                            />
                            {errors.name && touched.name && (
                              <p className="text-red-400 text-[11px] mt-1">{errors.name}</p>
                            )}
                          </FieldGroup>
                        </div>

                        {/* Type */}
                        <FieldGroup icon={MdTrendingUp} label="Type">
                          <div className="nom-select-wrap">
                            <select
                              value={values.type}
                              onChange={e => setFieldValue('type', e.target.value)}
                              className={selectCls + (errors.type && touched.type ? ' border-red-300' : '')}
                            >
                              <option value="">Select type…</option>
                              {TYPE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                          </div>
                          {errors.type && touched.type && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.type}</p>
                          )}
                        </FieldGroup>

                        {/* Nature */}
                        <FieldGroup icon={MdSwapVert} label="Nature">
                          <div className="nom-select-wrap">
                            <select
                              value={values.nature}
                              onChange={e => setFieldValue('nature', e.target.value)}
                              className={selectCls + (errors.nature && touched.nature ? ' border-red-300' : '')}
                            >
                              <option value="">Select nature…</option>
                              {NATURE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                          </div>
                          {errors.nature && touched.nature && (
                            <p className="text-red-400 text-[11px] mt-1">{errors.nature}</p>
                          )}
                        </FieldGroup>

                        {/* Status (edit only) */}
                        {editingAccount && (
                          <FieldGroup icon={MdToggleOn} label="Status">
                            <button
                              type="button"
                              onClick={() => setFieldValue('isActive', !values.isActive)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all w-full justify-center ${
                                values.isActive
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                  : 'bg-gray-50 border-gray-200 text-gray-400'
                              }`}
                            >
                              {values.isActive ? <MdToggleOn size={18} /> : <MdToggleOff size={18} />}
                              {values.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </FieldGroup>
                        )}

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
                          : editingAccount
                            ? <><MdEdit size={16} /> Save Changes</>
                            : <><MdAdd size={16} /> Add Account</>
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
            className="nom-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setShowDetail(null)}
          >
            <div
              className="nom-modal bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-14 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between mb-4">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Account Details</span>
                  <button
                    onClick={() => setShowDetail(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative">
                  <p className="text-white/50 text-xs mb-1 font-mono">Code #{showDetail.code}</p>
                  <h3 className="text-white text-xl font-bold leading-tight">{showDetail.name}</h3>
                  <div className="flex items-center gap-2 mt-3">
                    <TypeBadge type={showDetail.type} />
                    <NatureBadge nature={showDetail.nature} />
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="-mt-5 mx-5 grid grid-cols-2 gap-2 z-10 relative">
                {[
                  { label: 'Type',   value: showDetail.type === 'INCOME' ? 'Income' : 'Expense' },
                  { label: 'Status', value: showDetail.isActive ? 'Active' : 'Inactive' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className="text-[13px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="nom-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                {[
                  { icon: MdNumbers, label: 'Code',   value: showDetail.code, mono: true },
                  { icon: MdArticle, label: 'Name',   value: showDetail.name },
                  { icon: MdSwapVert, label: 'Nature', value: showDetail.nature === 'DEBIT' ? 'Debit' : 'Credit' },
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
                  <MdEdit size={15} /> Edit Account
                </button>
                <button
                  onClick={() => setShowDetail(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleDelete(showDetail._id || showDetail.id)}
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

export default Nominals;