import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { getAllPurchases, addPurchase, updatePurchase, updatePurchaseStatus, deletePurchase } from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import * as yup from "yup";
import { Form, Formik } from "formik";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdBusiness,
} from "react-icons/md";

const LIMIT = 10;

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

const Supplier = () => {
  const [currentPage, setCurrentPage]             = useState(1);
  const [loading, setLoading]                     = useState(false);
  const [show, setShow]                           = useState(false);
  const [totalPages, setTotalPages]               = useState(0);
  const [searchTerm, setSearchTerm]               = useState('');
  const [purchases, setPurchases]                 = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [filterStatus, setFilterStatus]           = useState('');
  const [state, setState] = useState({
    id: '', companyName: '', phone: '', address: '', email: '',
    ntn: '', stn: '', cnic: '', bankName: '', accountName: '',
    accountNumber: '', iban: '',
  });

  const validationSchema = yup.object().shape({
    companyName: yup.string().required("Company Name is required"),
    phone: yup.string()
      .matches(/^(\+92|92|0)?[345]\d{9}$/, "Invalid phone e.g +923001234567")
      .required("Phone is required"),
    address: yup.string().required("Address is required"),
    email: yup.string().email("Invalid email").nullable(),
    cnic: yup.string()
      .required("CNIC is required")
      .matches(/^\d{5}-\d{7}-\d{1}$/, "CNIC format: xxxxx-xxxxxxx-x"),
  });

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await getAllPurchases();
      const data = response?.data?.data || [];
      setPurchases(data);
      setFilteredPurchases(data);
      setTotalPages(Math.ceil(data.length / LIMIT) || 1);
    } catch { setPurchases([]); setFilteredPurchases([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPurchases(); }, []);

  useEffect(() => {
    let filtered = purchases;
    if (filterStatus === 'active')   filtered = purchases.filter(p => p.isActive);
    if (filterStatus === 'inactive') filtered = purchases.filter(p => !p.isActive);
    setFilteredPurchases(filtered);
    setTotalPages(Math.ceil(filtered.length / LIMIT) || 1);
    setCurrentPage(1);
  }, [filterStatus, purchases]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (!value.trim()) { setFilteredPurchases(purchases); return; }
    const lc = value.toLowerCase().trim();
    const result = purchases.filter(p =>
      p.companyName?.toLowerCase().includes(lc) ||
      p.phone?.toLowerCase().includes(lc) ||
      p.address?.toLowerCase().includes(lc)
    );
    setFilteredPurchases(result);
    setTotalPages(Math.ceil(result.length / LIMIT) || 1);
    setCurrentPage(1);
  };

  const clearForm = () => setState({
    id: '', companyName: '', phone: '', address: '', email: '',
    ntn: '', stn: '', cnic: '', bankName: '', accountName: '',
    accountNumber: '', iban: '',
  });

  const addHandler  = () => { clearForm(); setShow(true); };
  const editHandler = (item) => {
    setState({
      id: item._id, companyName: item.companyName || '', phone: item.phone || '',
      address: item.address || '', email: item.email || '', ntn: item.ntn || '',
      stn: item.stn || '', cnic: item.cnic || '', bankName: item.bankName || '',
      accountName: item.accountName || '', accountNumber: item.accountNumber || '',
      iban: item.iban || '',
    });
    setShow(true);
  };

  const deleteHandler = async (id) => {
    if (!window.confirm("Delete this supplier?")) return;
    try {
      setLoading(true);
      await deletePurchase(id);
      toast.success("Supplier deleted!");
      await fetchPurchases();
    } catch (error) { toast.error(error.response?.data?.message || "Failed to delete!"); }
    finally { setLoading(false); }
  };

  const statusToggleHandler = async (purchase) => {
    try {
      setLoading(true);
      await updatePurchaseStatus(purchase._id, !purchase.isActive);
      setPurchases(prev => prev.map(p =>
        p._id === purchase._id ? { ...p, isActive: !p.isActive } : p
      ));
      toast.success(`Supplier ${!purchase.isActive ? 'activated' : 'deactivated'}`);
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to update status'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      setLoading(true); setSubmitting(true);
      if (state.id) { await updatePurchase(state.id, values); toast.success("Supplier updated!"); }
      else          { await addPurchase(values);              toast.success("Supplier added!");   }
      await fetchPurchases();
      setShow(false); resetForm(); clearForm();
    } catch (error) { toast.error(error.response?.data?.message || "Failed to save!"); }
    finally { setLoading(false); setSubmitting(false); }
  };

  // Client-side pagination slice
  const start           = (currentPage - 1) * LIMIT;
  const paginatedRows   = filteredPurchases.slice(start, start + LIMIT);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .sup-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .sup-page .trow { transition: background 0.15s, box-shadow 0.15s; }
        .sup-page .trow:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .sup-sel { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px; }
        @keyframes supModalIn  { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:none; } }
        @keyframes supOverlay  { from { opacity:0; } to { opacity:1; } }
        .sup-overlay { animation: supOverlay 0.2s ease; }
        .sup-modal   { animation: supModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .sup-scroll::-webkit-scrollbar { display:none; }
        .sup-scroll  { scrollbar-width:none; }
      `}</style>

      <div className="sup-page">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Suppliers</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{filteredPurchases.length} suppliers found</p>
          </div>
          <button
            onClick={addHandler}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
          >
            <MdPersonAdd size={18} /> Add Supplier
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by name, phone, address…"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setFilteredPurchases(purchases); }}
                className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="sup-sel bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {["Company", "ID", "Phone", "Address", "Balance", "Last Activity", "Active", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdBusiness size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No suppliers found</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.map((item, index) => (
                <tr key={item._id || index} className="trow">

                  {/* Company */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0 shadow-sm">
                        {item.companyName
                          ? item.companyName.split(' ').filter(w => w !== '&').map(w => w[0].toUpperCase()).join('').slice(0, 2)
                          : 'NA'}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827] leading-tight">{item.companyName || '—'}</p>
                        {item.email && <p className="text-[11px] text-[#9CA3AF]">{item.email}</p>}
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                      #{item._id.slice(0, 6)}
                    </span>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 text-[13px] text-[#374151]">{item.phone || '—'}</td>

                  {/* Address */}
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="text-[13px] text-[#374151] truncate">{item.address || '—'}</p>
                  </td>

                  {/* Balance */}
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold text-[#111827]">PKR {item.balance ?? '0'}</span>
                  </td>

                  {/* Last Activity */}
                  <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">
                    {item.lastActivity ? new Date(item.lastActivity).toLocaleDateString() : '—'}
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button onClick={() => statusToggleHandler(item)} className="flex items-center hover:opacity-80 transition-opacity">
                      {item.isActive
                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                        : <PiToggleLeftFill  size={26} className="text-gray-300"    />}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => editHandler(item)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 transition-all"
                        title="Edit"
                      >
                        <MdEdit size={15} />
                      </button>
                      <button
                        onClick={() => deleteHandler(item._id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100 transition-all"
                        title="Delete"
                      >
                        <MdDelete size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-[12px] text-[#9CA3AF]">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <GrFormPrevious size={16} />
            </button>
            <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300 mx-1">/</span>
              <span className="text-[#374151]">{totalPages}</span>
            </div>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <GrFormNext size={16} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════
            ADD / EDIT SUPPLIER MODAL
        ══════════════════════════════════════════ */}
        {show && (
          <div className="sup-overlay fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="sup-modal bg-white w-full max-w-[600px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Modal Header */}
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                      {state.id ? 'Editing' : 'New Supplier'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {state.id ? 'Edit Supplier' : 'Add Supplier'}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setShow(false); clearForm(); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                enableReinitialize
                initialValues={{
                  companyName:   state.companyName,
                  phone:         state.phone,
                  address:       state.address,
                  email:         state.email,
                  ntn:           state.ntn,
                  stn:           state.stn,
                  cnic:          state.cnic,
                  bankName:      state.bankName,
                  accountName:   state.accountName,
                  accountNumber: state.accountNumber,
                  iban:          state.iban,
                }}
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
              >
                {({ values, handleChange, handleSubmit: formikSubmit, setFieldTouched, errors, touched }) => (
                  <Form className="sup-scroll overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 py-5 grid grid-cols-2 gap-4">

                      {/* Company Name — full width */}
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                          Company Name <span className="text-[#FF5934]">*</span>
                        </label>
                        <input name="companyName" placeholder="Company Name" value={values.companyName} onChange={handleChange}
                          className={`${inputCls} ${errors.companyName && touched.companyName ? 'border-red-400' : ''}`} />
                        {errors.companyName && touched.companyName && <p className="text-red-500 text-[11px] mt-1">{errors.companyName}</p>}
                      </div>

                      {/* Address — full width */}
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                          Address <span className="text-[#FF5934]">*</span>
                        </label>
                        <input name="address" placeholder="Address" value={values.address} onChange={handleChange}
                          className={`${inputCls} ${errors.address && touched.address ? 'border-red-400' : ''}`} />
                        {errors.address && touched.address && <p className="text-red-500 text-[11px] mt-1">{errors.address}</p>}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                          Phone <span className="text-[#FF5934]">*</span>
                        </label>
                        <input name="phone" placeholder="+923001234567" value={values.phone} onChange={handleChange}
                          className={`${inputCls} ${errors.phone && touched.phone ? 'border-red-400' : ''}`} />
                        {errors.phone && touched.phone && <p className="text-red-500 text-[11px] mt-1">{errors.phone}</p>}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Email</label>
                        <input name="email" placeholder="email@example.com" value={values.email} onChange={handleChange}
                          className={`${inputCls} ${errors.email && touched.email ? 'border-red-400' : ''}`} />
                        {errors.email && touched.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
                      </div>

                      {/* NTN */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">NTN</label>
                        <input name="ntn" placeholder="NTN" value={values.ntn} onChange={handleChange} className={inputCls} />
                      </div>

                      {/* STN */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">STN</label>
                        <input name="stn" placeholder="STN" value={values.stn} onChange={handleChange} className={inputCls} />
                      </div>

                      {/* CNIC — full width */}
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                          CNIC <span className="text-[#FF5934]">*</span>
                        </label>
                        <input name="cnic" placeholder="xxxxx-xxxxxxx-x" value={values.cnic} onChange={handleChange}
                          className={`${inputCls} ${errors.cnic && touched.cnic ? 'border-red-400' : ''}`} />
                        {errors.cnic && touched.cnic && <p className="text-red-500 text-[11px] mt-1">{errors.cnic}</p>}
                      </div>

                      {/* Bank Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Bank Name</label>
                        <input name="bankName" placeholder="Bank Name" value={values.bankName} onChange={handleChange} className={inputCls} />
                      </div>

                      {/* Account Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Account Name</label>
                        <input name="accountName" placeholder="Account Name" value={values.accountName} onChange={handleChange} className={inputCls} />
                      </div>

                      {/* Account Number */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Account Number</label>
                        <input name="accountNumber" placeholder="Account Number" value={values.accountNumber} onChange={handleChange} className={inputCls} />
                      </div>

                      {/* IBAN */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">IBAN</label>
                        <input name="iban" placeholder="IBAN" value={values.iban} onChange={handleChange} className={inputCls} />
                      </div>

                    </div>

                    {/* Footer */}
                    <div className="px-6 pb-6 pt-3 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                      <button
                        type="button"
                        onClick={() => { setShow(false); clearForm(); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          if (!values.cnic) {
                            setFieldTouched('cnic', true, true);
                            toast.error("CNIC is required.");
                            return;
                          }
                          formikSubmit(e);
                        }}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all"
                      >
                        {state.id ? 'Save Changes' : 'Add Supplier'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Supplier;