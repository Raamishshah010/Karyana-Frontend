import { useEffect, useState } from 'react';
import {
  getAllPurchases, getLedgerById, getInvoicesByPurchaseId,
  addPurchaseLedger, getProducts, getAllCities,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaPlus, FaTrash } from 'react-icons/fa';
import { Form, Formik, FieldArray, Field } from "formik";
import * as yup from "yup";
import GroupedSelect from '../components/common/GroupedSelect';
import {
  MdSearch, MdFilterList, MdClose, MdBusiness, MdRefresh,
  MdAddCircleOutline, MdLocalShipping, MdWarehouse,
} from "react-icons/md";

const LIMIT = 10;

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

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
  const [loading, setLoading]                   = useState(false);
  const [fetchingDetails, setFetchingDetails]   = useState(false);
  const [rows, setRows]                         = useState([]);
  const [filteredRows, setFilteredRows]         = useState([]);
  const [searchTerm, setSearchTerm]             = useState('');
  const [filterStatus, setFilterStatus]         = useState('');
  const [currentPage, setCurrentPage]           = useState(1);
  const [totalPages, setTotalPages]             = useState(1);

  /* ── Add Purchase Modal ── */
  const [showModal, setShowModal]               = useState(false);
  const [suppliers, setSuppliers]               = useState([]);
  const [products, setProducts]                 = useState([]);
  const [cities, setCities]                     = useState([]);
  const [modalLoading, setModalLoading]         = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  /* ─── Fetch all companies + enrich ─── */
  const fetchAll = async () => {
    try {
      setLoading(true);
      const res       = await getAllPurchases();
      const companies = res?.data?.data || [];

      if (!companies.length) {
        setRows([]); setFilteredRows([]); setTotalPages(1);
        setLoading(false);
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
      setFilteredRows(seeded);
      setSuppliers(companies);
      setTotalPages(Math.ceil(seeded.length / LIMIT) || 1);
      setLoading(false);

      setFetchingDetails(true);
      const enriched = await Promise.all(
        companies.map(async (company) => {
          let totalDr = 0, totalCr = 0, lastTransaction = '—', invoiceCount = 0;
          try {
            const ledgerRes = await getLedgerById(company._id);
            const ledgers   = ledgerRes?.ledgers || [];
            ledgers.forEach(l => {
              const amt = Number(l.amount || 0);
              if (l.type === 'PAYMENT') totalDr += amt;
              else totalCr += amt;
            });
            if (ledgers.length) {
              const dates = ledgers
                .map(l => l.date ? new Date(l.date) : null)
                .filter(Boolean);
              if (dates.length)
                lastTransaction = new Date(Math.max(...dates)).toLocaleDateString('en-GB');
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
    } catch {
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
        p.phone?.toLowerCase().includes(lc) ||
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

  /* ─── Open Add Purchase Modal ─── */
  const openModal = async () => {
    setShowModal(true);
    setSelectedSupplier(null);
    try {
      setModalLoading(true);
      const [prodRes, cityRes] = await Promise.all([
        getProducts(1, 1000),
        getAllCities(),
      ]);
      setProducts(prodRes?.data?.data || []);

      // robust extraction — handles data.data, data, or bare array
      const cityRaw  = cityRes?.data?.data || cityRes?.data || cityRes || [];
      const cityData = Array.isArray(cityRaw) ? cityRaw : [];
      setCities(cityData);
    } catch {
      toast.error('Failed to load form data');
    } finally {
      setModalLoading(false);
    }
  };

  /* ─── Grouped products by location ─── */
  const getGroupedProducts = (allProducts, locationId) => {
    if (!locationId) return [];
    const filtered = allProducts.filter(
      p => p.cityID?._id === locationId || p.cityID === locationId
    );
    const grouped = filtered.reduce((acc, p) => {
      const cat = p.categoryID?.englishName || p.category?.name || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        value: p._id,
        label: p.englishTitle || p.urduTitle || 'Unnamed',
        data:  p,
      });
      return acc;
    }, {});
    return Object.keys(grouped).map(cat => ({ label: cat, options: grouped[cat] }));
  };

  /* ─── Validation ─── */
  const schema = yup.object().shape({
    supplier:     yup.string().required('Supplier is required'),
    billNo:       yup.string().required('Bill No is required'),
    date:         yup.string().required('Date is required'),
    items: yup.array().of(yup.object().shape({
      product:      yup.string().required('Product is required'),
      purchaseRate: yup.number().required('Rate is required').min(0),
      quantity:     yup.number().required('Quantity is required').min(1),
    })),
  });

  /* ─── Auto-calculate due date ─── */
  const calcDueDate = (date, termDays) => {
    if (!date || !termDays) return '';
    const d = new Date(date);
    d.setDate(d.getDate() + Number(termDays));
    return d.toISOString().split('T')[0];
  };

  /* ─── Submit ─── */
  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      setModalLoading(true);
      if (values.items.some(i => !i.product)) {
        toast.error('Select a product for all rows');
        return;
      }
      const payload = {
        billNo:           values.billNo,
        biltyNumber:      values.biltyNumber,
        vehicleNumber:    values.vehicleNumber,
        transportDetails: values.transportDetails,
        date:             values.date,
        termDays:         values.termDays ? Number(values.termDays) : undefined,
        dueDate:          values.dueDate,
        freightAmount:    Number(values.freightAmount || 0),
        details:          values.details,
        items: values.items.map(i => ({
          product:          i.product,
          quantity:         Number(i.quantity)         || 0,
          purchaseRate:     Number(i.purchaseRate)     || 0,
          purchaseDiscount: Number(i.purchaseDiscount) || 0,
          amount:           Number(i.amount)           || 0,
        })),
      };
      const res = await addPurchaseLedger(values.supplier, payload);
      if (res?.success) {
        toast.success('Purchase added successfully');
        resetForm();
        setShowModal(false);
        setSelectedSupplier(null);
        fetchAll();
      } else {
        toast.error(res?.msg || 'Failed to add purchase');
      }
    } catch (e) {
      toast.error(e.response?.data?.msg || e.message || 'Failed to add purchase');
    } finally {
      setModalLoading(false);
      setSubmitting(false);
    }
  };

  /* ─── Pagination ─── */
  const start         = (currentPage - 1) * LIMIT;
  const paginatedRows = filteredRows.slice(start, start + LIMIT);

  const fmtPKR = (n) => {
    if (n === null || n === undefined)
      return <span className="text-[#D1D5DB] text-[11px]">—</span>;
    return `PKR ${Number(n).toLocaleString('en-PK')}`;
  };
  const fmtNum = (n) => {
    if (n === null || n === undefined)
      return <span className="text-[#D1D5DB] text-[11px]">—</span>;
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
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .pur-shimmer {
          background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
          display: inline-block;
          height: 13px;
          width: 64px;
        }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes purModalIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:none} }
        @keyframes purOverlay { from{opacity:0} to{opacity:1} }
        .pur-overlay { animation: purOverlay 0.2s ease; }
        .pur-modal   { animation: purModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .pur-scroll::-webkit-scrollbar { display: none; }
        .pur-scroll  { scrollbar-width: none; }
        .sec-label {
          font-size: 10px; font-weight: 700; color: #FF5934;
          text-transform: uppercase; letter-spacing: .1em;
          display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
        }
        .sec-label::after { content:''; flex:1; height:1px; background:#FFE0D8; }
      `}</style>

      <div className="pur-page">

        {/* ── Header ── */}
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
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              disabled={loading || fetchingDetails}
              className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[#374151] text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <MdRefresh size={16} className="text-[#FF5934]" /> Refresh
            </button>
            <button
              onClick={openModal}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdAddCircleOutline size={17} /> Add Purchase
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by name, phone, address…"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="pur-sel bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
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
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{item._id?.slice(0, 6)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.phone || '—'}</td>
                      <td className="px-4 py-3 max-w-[140px]">
                        <p className="text-[13px] text-[#374151] truncate">{item.address || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#111827]">PKR {item.balance ?? '0'}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">
                        PKR {item.lastPayment ?? '0'}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[13px] font-semibold text-emerald-600">{fmtPKR(item._totalDr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[13px] font-semibold text-red-500">{fmtPKR(item._totalCr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="text-[12px] text-[#6B7280]">{item._lastTransaction || '—'}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading
                          ? <span className="pur-shimmer" />
                          : <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-[#FF5934]">
                              {fmtNum(item._invoiceCount)}
                            </span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1
                          ${item.isActive
                            ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
                            : 'bg-gray-50 text-gray-400 ring-gray-200'}`}>
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

        {/* ══════════════════════════════════════════
            ADD PURCHASE MODAL
        ══════════════════════════════════════════ */}
        {showModal && (
          <div className="pur-overlay fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="pur-modal bg-white w-full max-w-[1000px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">New Entry</p>
                    <h2 className="text-white text-xl font-bold">Add Purchase</h2>
                  </div>
                  <button
                    onClick={() => { setShowModal(false); setSelectedSupplier(null); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              {modalLoading && !products.length ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <Formik
                  initialValues={{
                    supplier:         '',
                    address:          '',
                    billNo:           '',
                    date:             '',
                    termDays:         '',
                    dueDate:          '',
                    vehicleNumber:    '',
                    biltyNumber:      '',
                    transportDetails: '',
                    freightAmount:    '',
                    location:         '',
                    details:          '',
                    items: [{ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 }],
                    totalAmount: 0, discountAmount: 0, payable: 0,
                  }}
                  validationSchema={schema}
                  onSubmit={handleSubmit}
                >
                  {({ values, handleChange, errors, touched, setFieldValue }) => {
                    const groupedProducts = getGroupedProducts(products, values.location);
                    return (
                      <Form className="pur-scroll overflow-y-auto flex-1 flex flex-col">
                        <div className="px-6 py-5 flex flex-col gap-5">

                          {/* ── SECTION: Purchase Info ── */}
                          <p className="sec-label">Purchase Info</p>
                          <div className="grid grid-cols-3 gap-3">

                            {/* Supplier */}
                            <div className="col-span-3 md:col-span-1">
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                Supplier <span className="text-[#FF5934]">*</span>
                              </label>
                              <select
                                name="supplier"
                                value={values.supplier}
                                onChange={e => {
                                  handleChange(e);
                                  const sup = suppliers.find(s => s._id === e.target.value);
                                  setFieldValue('address', sup?.address || '');
                                  setSelectedSupplier(sup || null);
                                }}
                                className={`${inputCls} pur-sel ${errors.supplier && touched.supplier ? 'border-red-400' : ''}`}
                              >
                                <option value="">Select Supplier…</option>
                                {suppliers.map(s => (
                                  <option key={s._id} value={s._id}>{s.companyName}</option>
                                ))}
                              </select>
                              {errors.supplier && touched.supplier && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.supplier}</p>
                              )}
                            </div>

                            {/* Address — auto-filled */}
                            <div className="col-span-3 md:col-span-2">
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Address</label>
                              <input name="address" placeholder="Address" value={values.address} onChange={handleChange} className={inputCls} />
                            </div>

                            {/* Bill No */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                Bill No <span className="text-[#FF5934]">*</span>
                              </label>
                              <input name="billNo" placeholder="Bill No" value={values.billNo} onChange={handleChange}
                                className={`${inputCls} ${errors.billNo && touched.billNo ? 'border-red-400' : ''}`} />
                              {errors.billNo && touched.billNo && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.billNo}</p>
                              )}
                            </div>

                            {/* Date */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                Date <span className="text-[#FF5934]">*</span>
                              </label>
                              <input
                                type="date" name="date" value={values.date}
                                onChange={e => {
                                  handleChange(e);
                                  if (values.termDays) setFieldValue('dueDate', calcDueDate(e.target.value, values.termDays));
                                }}
                                max={new Date().toISOString().split('T')[0]}
                                className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`}
                              />
                              {errors.date && touched.date && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>
                              )}
                            </div>

                            {/* Term Days */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Term Days</label>
                              <input
                                type="number" name="termDays" placeholder="e.g. 30" value={values.termDays}
                                onChange={e => {
                                  handleChange(e);
                                  if (values.date) setFieldValue('dueDate', calcDueDate(values.date, e.target.value));
                                }}
                                className={inputCls} min="0"
                              />
                            </div>

                            {/* Due Date */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                Due Date
                                <span className="ml-1 text-[9px] font-normal normal-case tracking-normal text-[#9CA3AF]">
                                  auto from term days
                                </span>
                              </label>
                              <input type="date" name="dueDate" value={values.dueDate} onChange={handleChange} className={inputCls} />
                            </div>

                            {/* Vehicle Number */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Vehicle Number</label>
                              <input name="vehicleNumber" placeholder="Vehicle Number" value={values.vehicleNumber} onChange={handleChange} className={inputCls} />
                            </div>

                            {/* Bilty Number */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Bilty Number</label>
                              <input name="biltyNumber" placeholder="Bilty Number" value={values.biltyNumber} onChange={handleChange} className={inputCls} />
                            </div>

                            {/* Freight Amount */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Freight Amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF] font-semibold pointer-events-none">PKR</span>
                                <input name="freightAmount" placeholder="0.00" value={values.freightAmount} onChange={handleChange} className={`${inputCls} pl-12`} />
                              </div>
                            </div>

                            {/* Transport Details */}
                            <div className="col-span-3 md:col-span-2">
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Transport Details</label>
                              <input name="transportDetails" placeholder="Transport Details" value={values.transportDetails} onChange={handleChange} className={inputCls} />
                            </div>

                            {/* ── Location / Warehouse ── UPDATED ── */}
                            <div>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                                <span className="flex items-center gap-1.5">
                                  <MdWarehouse size={12} className="text-[#FF5934]" />
                                  Location / Warehouse
                                </span>
                              </label>
                              <select
                                name="location"
                                value={values.location}
                                onChange={e => {
                                  handleChange(e);
                                  setFieldValue('items', [{
                                    product: '', purchaseRate: '', purchaseDiscount: '',
                                    quantity: '', amount: 0, discountAmount: 0,
                                  }]);
                                }}
                                className={`${inputCls} pur-sel`}
                              >
                                <option value="">Select Warehouse…</option>
                                {cities.length === 0 && (
                                  <option disabled value="">No warehouses available</option>
                                )}
                                {cities.map(c => (
                                  <option key={c._id} value={c._id}>
                                    {c.name}{c.address ? ` — ${c.address}` : ''}
                                  </option>
                                ))}
                              </select>
                              {/* Helper text */}
                              {cities.length > 0 && !values.location && (
                                <p className="text-[10px] text-[#9CA3AF] mt-1">
                                  Select a warehouse to load its products
                                </p>
                              )}
                              {values.location && (
                                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                  <MdWarehouse size={10} />
                                  {cities.find(c => c._id === values.location)?.name} selected
                                </p>
                              )}
                            </div>

                            {/* Details */}
                            <div className="col-span-3">
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Details / Notes</label>
                              <textarea
                                name="details" placeholder="Enter details…"
                                value={values.details} onChange={handleChange}
                                className={`${inputCls} resize-none`} rows={2}
                              />
                            </div>
                          </div>

                          {/* ── SECTION: Products ── */}
                          <p className="sec-label">Products</p>

                          {/* Warehouse reminder if not selected */}
                          {!values.location && (
                            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                              <MdWarehouse size={16} className="text-amber-500 flex-shrink-0" />
                              <p className="text-[12px] text-amber-700 font-medium">
                                Please select a <strong>warehouse</strong> above to load available products.
                              </p>
                            </div>
                          )}

                          <FieldArray name="items">
                            {({ push, remove }) => (
                              <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                                {/* Column Headers */}
                                <div className="grid grid-cols-6 gap-3 mb-2 px-1">
                                  {['Product', 'Purchase Rate', 'Discount %', 'Quantity', 'Amount', ''].map((h, i) => (
                                    <div key={i} className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{h}</div>
                                  ))}
                                </div>

                                {values.items.map((item, index) => (
                                  <div key={index} className="grid grid-cols-6 gap-3 mb-3 pb-3 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0 items-start">

                                    {/* Product */}
                                    <div>
                                      <GroupedSelect
                                        options={groupedProducts}
                                        value={item.product ? {
                                          value: item.product,
                                          label: products.find(p => p._id === item.product)?.englishTitle || 'Product',
                                          data:  products.find(p => p._id === item.product),
                                        } : null}
                                        onChange={opt => {
                                          if (opt) {
                                            setFieldValue(`items.${index}.product`,          opt.data._id);
                                            setFieldValue(`items.${index}.purchaseRate`,     opt.data.purchaseRate     || '');
                                            setFieldValue(`items.${index}.purchaseDiscount`, opt.data.purchaseDiscount || '');
                                          } else {
                                            setFieldValue(`items.${index}.product`,          '');
                                            setFieldValue(`items.${index}.purchaseRate`,     '');
                                            setFieldValue(`items.${index}.purchaseDiscount`, '');
                                          }
                                        }}
                                        placeholder={values.location ? 'Select product…' : 'Select warehouse first…'}
                                        isDisabled={!values.location}
                                        className="w-full"
                                      />
                                      {touched.items?.[index]?.product && errors.items?.[index]?.product && (
                                        <p className="text-red-500 text-[10px] mt-0.5">{errors.items[index].product}</p>
                                      )}
                                    </div>

                                    {/* Purchase Rate */}
                                    <Field
                                      type="number"
                                      name={`items.${index}.purchaseRate`}
                                      value={item.purchaseRate}
                                      onChange={e => {
                                        handleChange(e);
                                        const rate    = Number(e.target.value)       || 0;
                                        const qty     = Number(item.quantity)        || 0;
                                        const disc    = Number(item.purchaseDiscount)|| 0;
                                        const base    = rate * qty;
                                        const discAmt = (base * disc) / 100;
                                        const amt     = base - discAmt;
                                        setFieldValue(`items.${index}.amount`,        amt);
                                        setFieldValue(`items.${index}.discountAmount`, discAmt);
                                        recalcTotals(values.items, index, amt, discAmt, setFieldValue);
                                      }}
                                      placeholder="0.00"
                                      className={inputCls}
                                    />

                                    {/* Discount % */}
                                    <Field
                                      type="number"
                                      name={`items.${index}.purchaseDiscount`}
                                      value={item.purchaseDiscount}
                                      onChange={e => {
                                        handleChange(e);
                                        const disc    = Number(e.target.value)    || 0;
                                        const rate    = Number(item.purchaseRate) || 0;
                                        const qty     = Number(item.quantity)     || 0;
                                        const base    = rate * qty;
                                        const discAmt = (base * disc) / 100;
                                        const amt     = base - discAmt;
                                        setFieldValue(`items.${index}.amount`,        amt);
                                        setFieldValue(`items.${index}.discountAmount`, discAmt);
                                        recalcTotals(values.items, index, amt, discAmt, setFieldValue);
                                      }}
                                      placeholder="%"
                                      className={inputCls}
                                    />

                                    {/* Quantity */}
                                    <Field
                                      type="number"
                                      name={`items.${index}.quantity`}
                                      value={item.quantity}
                                      onChange={e => {
                                        handleChange(e);
                                        const qty     = Number(e.target.value)        || 0;
                                        const rate    = Number(item.purchaseRate)     || 0;
                                        const disc    = Number(item.purchaseDiscount) || 0;
                                        const base    = rate * qty;
                                        const discAmt = (base * disc) / 100;
                                        const amt     = base - discAmt;
                                        setFieldValue(`items.${index}.amount`,        amt);
                                        setFieldValue(`items.${index}.discountAmount`, discAmt);
                                        recalcTotals(values.items, index, amt, discAmt, setFieldValue);
                                      }}
                                      placeholder="0"
                                      className={inputCls}
                                    />

                                    {/* Amount (readonly) */}
                                    <div className={`${inputCls} flex items-center font-semibold text-[#111827] bg-white`}>
                                      {Number(item.amount || 0).toFixed(2)}
                                    </div>

                                    {/* Remove row */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        remove(index);
                                        const newItems = values.items.filter((_, i) => i !== index);
                                        const totals   = newItems.reduce((acc, it) => ({
                                          totalAmount:   acc.totalAmount   + (it.amount        || 0),
                                          totalDiscount: acc.totalDiscount + (it.discountAmount || 0),
                                        }), { totalAmount: 0, totalDiscount: 0 });
                                        setFieldValue('totalAmount',    totals.totalAmount);
                                        setFieldValue('discountAmount', totals.totalDiscount);
                                        setFieldValue('payable',        totals.totalAmount);
                                      }}
                                      disabled={values.items.length === 1}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 border border-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-1"
                                    >
                                      <FaTrash size={11} />
                                    </button>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => push({ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 })}
                                  className="mt-3 flex items-center gap-2 text-[#FF5934] hover:text-[#e84d2a] text-[13px] font-semibold transition-colors"
                                >
                                  <FaPlus size={12} /> Add Product
                                </button>
                              </div>
                            )}
                          </FieldArray>

                          {/* ── Totals ── */}
                          <div className="grid grid-cols-3 gap-3 bg-[#F9FAFB] rounded-2xl p-4 border border-gray-100">
                            {[
                              { label: 'Discount Amount', value: Number(values.discountAmount).toFixed(2) },
                              { label: 'Payable Amount',  value: Number(values.payable).toFixed(2)        },
                              { label: 'Total Amount',    value: Number(values.totalAmount).toFixed(2), highlight: true },
                            ].map(({ label, value, highlight }) => (
                              <div key={label}>
                                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                                <p className={`text-[15px] font-bold ${highlight ? 'text-[#FF5934]' : 'text-[#111827]'}`}>
                                  PKR {value}
                                </p>
                              </div>
                            ))}
                          </div>

                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-6 pt-3 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                          <button
                            type="button"
                            onClick={() => { setShowModal(false); setSelectedSupplier(null); }}
                            className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={modalLoading}
                            className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                          >
                            {modalLoading
                              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                              : <><MdLocalShipping size={16} /> Save Purchase</>}
                          </button>
                        </div>
                      </Form>
                    );
                  }}
                </Formik>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
};

/* ── Helper: recalculate totals after item change ── */
function recalcTotals(items, changedIndex, newAmt, newDiscAmt, setFieldValue) {
  const totals = items.reduce((acc, it, i) => ({
    totalAmount:   acc.totalAmount   + (i === changedIndex ? newAmt     : (it.amount        || 0)),
    totalDiscount: acc.totalDiscount + (i === changedIndex ? newDiscAmt : (it.discountAmount || 0)),
  }), { totalAmount: 0, totalDiscount: 0 });
  setFieldValue('totalAmount',    totals.totalAmount);
  setFieldValue('discountAmount', totals.totalDiscount);
  setFieldValue('payable',        totals.totalAmount);
}

export default Purchases;