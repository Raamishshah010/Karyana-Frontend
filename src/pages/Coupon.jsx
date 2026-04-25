import React, { useState, useEffect } from 'react';
import { HiDotsVertical } from "react-icons/hi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { useSelector } from "react-redux";
import ClickOutside from '../Hooks/ClickOutside';
import { Loader } from '../components/common/loader';
import {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getProducts,
  getAllRetailers
} from '../APIS/index';
import { SERVER_URL } from '../utils';
import {
  MdSearch, MdClose, MdEdit, MdDelete, MdAdd, MdRefresh,
  MdConfirmationNumber, MdCalendarToday, MdPercent, MdPeople,
  MdShoppingCart, MdLocalOffer,
} from "react-icons/md";

const LIMIT = 10;

const FieldGroup = ({ icon: Icon, label, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
      {Icon && <Icon size={12} className="text-[#FF5934]" />}
      {label}
    </label>
    {children}
  </div>
);

const inputCls =
  "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

const Coupon = () => {
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    code: '',
    expiryDate: '',
    productSelection: 'all',
    selectedProducts: [],
    minOrderLimit: '',
    usageLimit: '',
    retailerSelection: 'all',
    selectedRetailers: [],
    discountType: 'percentage',
    discount: ''
  });

  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showRetailerDropdown, setShowRetailerDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [retailerSearchTerm, setRetailerSearchTerm] = useState('');

  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = useSelector((state) => state.admin.token);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'selectedProducts') {
        setFormData(prev => ({
          ...prev,
          selectedProducts: checked
            ? [...prev.selectedProducts, value]
            : prev.selectedProducts.filter(id => id !== value)
        }));
      } else if (name === 'selectedRetailers') {
        setFormData(prev => ({
          ...prev,
          selectedRetailers: checked
            ? [...prev.selectedRetailers, value]
            : prev.selectedRetailers.filter(id => id !== value)
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const couponsRes = await fetch(SERVER_URL + "/coupons/", {
        method: "get",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "x-auth-token": token })
        },
      }).then(res => res.json());
      if (couponsRes?.success) {
        setCoupons(couponsRes.data?.docs || couponsRes.data || []);
      }
    } catch (error) { console.error('Error fetching coupons:', error); }

    try {
      const res = await fetch(`${SERVER_URL}/product/`);
      const productsRes = await res.json();
      if (productsRes.msg === "success") setProducts(productsRes.data || []);
    } catch { setProducts([]); }

    try {
      const res = await fetch(`${SERVER_URL}/retailer`);
      const retailersRes = await res.json();
      if (retailersRes.msg === "success") setRetailers(retailersRes.data || []);
    } catch { setRetailers([]); }

    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const todayStr = formatDateForInput(new Date());
      if (!formData.expiryDate || formData.expiryDate <= todayStr) {
        alert('Expiry date must be in the future (not today).');
        setLoading(false);
        return;
      }
      if (editingCoupon) {
        const response = await updateCoupon(editingCoupon._id, formData, token);
        if (response.data?.success) {
          setCoupons(prev => prev.map(c => c._id === editingCoupon._id ? response.data.data : c));
          setEditingCoupon(null);
        }
      } else {
        const response = await createCoupon(formData);
        if (response.data?.success) setCoupons(prev => [response.data.data, ...prev]);
      }
      resetForm();
    } catch (error) {
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message;
      if (serverMsg) alert(serverMsg);
    } finally { setLoading(false); }
  };

  const resetForm = () => {
    setFormData({
      code: '', expiryDate: '', productSelection: 'all', selectedProducts: [],
      minOrderLimit: '', usageLimit: '', retailerSelection: 'all',
      selectedRetailers: [], discountType: 'percentage', discount: ''
    });
    setShowForm(false);
    setEditingCoupon(null);
  };

  const handleEdit = (coupon) => {
    const normalizedSelectedProducts = (coupon.selectedProducts || []).map(sp => sp?.productId || sp);
    const normalizedSelectedRetailers = (coupon.selectedRetailers || []).map(r => r?._id || r);
    setFormData({
      code: coupon.code,
      expiryDate: formatDateForInput(coupon.expiryDate),
      productSelection: coupon.productSelection,
      selectedProducts: normalizedSelectedProducts,
      minOrderLimit: coupon.minOrderLimit,
      usageLimit: coupon.usageLimit,
      retailerSelection: coupon.retailerSelection,
      selectedRetailers: normalizedSelectedRetailers,
      discountType: coupon.discountType,
      discount: coupon.discount
    });
    setEditingCoupon(coupon);
    setShowForm(true);
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    setLoading(true);
    try {
      const response = await deleteCoupon(couponId, token);
      if (response.data?.success) setCoupons(prev => prev.filter(c => c._id !== couponId));
    } catch (error) { console.error('Error deleting coupon:', error); }
    finally { setLoading(false); }
  };

  const totalPages = Math.ceil(coupons.length / LIMIT);
  const startIndex = (currentPage - 1) * LIMIT;
  const currentCoupons = coupons.slice(startIndex, startIndex + LIMIT);
  const filteredCoupons = currentCoupons.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .cp-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .cp-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .cp-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .cp-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .cp-page .action-btn:hover { transform: scale(1.1); }
        @keyframes cpModalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes cpOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .cp-modal-overlay { animation: cpOverlayIn 0.2s ease; }
        .cp-modal-card { animation: cpModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .cp-no-scroll::-webkit-scrollbar { display: none; }
        .cp-no-scroll { scrollbar-width: none; }
        .cp-radio { accent-color: #FF5934; }
        .cp-checkbox { accent-color: #FF5934; }
      `}</style>

      <div className="cp-page">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Coupons</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{coupons.length} coupons total</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdAdd size={18} /> Add Coupon
          </button>
        </div>

        {/* ── Search / Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by code…"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => { setSearchTerm(''); fetchAllData(); }}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200"
          >
            <MdRefresh size={16} /> Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {["Code", "Discount", "Expiry Date", "Usage", "Min Order", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCoupons.length ? filteredCoupons.map((coupon) => {
                const isExpired = new Date(coupon.expiryDate) < new Date();
                const usagePct = (coupon.currentUsage / coupon.usageLimit) * 100;
                const isUsedUp = usagePct >= 100;

                return (
                  <tr
                    key={coupon._id}
                    className="table-row cursor-pointer"
                    onClick={() => setSelectedCoupon(coupon)}
                  >
                    {/* Code */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[13px] text-[#111827] bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg">
                        <MdConfirmationNumber size={13} className="text-[#FF5934]" />
                        {coupon.code}
                      </span>
                    </td>

                    {/* Discount */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                        {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `Rs. ${coupon.discount}`}
                      </span>
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3">
                      <p className="text-[12px] text-[#374151]">{new Date(coupon.expiryDate).toLocaleDateString()}</p>
                    </td>

                    {/* Usage */}
                    <td className="px-4 py-3 min-w-[120px]">
                      <p className="text-[12px] text-[#374151] mb-1">{coupon.currentUsage}/{coupon.usageLimit}</p>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-[#FF5934] transition-all"
                          style={{ width: `${Math.min(usagePct, 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* Min Order */}
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[#374151]">Rs. {coupon.minOrderLimit}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold
                        ${isExpired ? 'bg-red-50 text-red-500 ring-1 ring-red-200'
                          : isUsedUp ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                          : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : isUsedUp ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        {isExpired ? 'Expired' : isUsedUp ? 'Used Up' : 'Active'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); handleEdit(coupon); }}
                          className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                          title="Edit"
                        >
                          <MdEdit size={14} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(coupon._id); }}
                          className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100"
                          title="Delete"
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdLocalOffer size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">
                        {searchTerm ? 'No coupons match your search' : 'No coupons found'}
                      </p>
                      {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-[#FF5934] text-xs hover:underline">Clear search</button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div className="flex items-center justify-between mt-4">
          <p className="text-[12px] text-[#9CA3AF]">
            Showing {startIndex + 1}–{Math.min(startIndex + LIMIT, coupons.length)} of {coupons.length}
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
              <span>{totalPages || 1}</span>
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


        {/* ═══════════════════════════════════════
            ADD / EDIT MODAL
        ═══════════════════════════════════════ */}
        {showForm && (
          <div className="cp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="cp-modal-card bg-white w-full max-w-[560px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Gradient header */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {editingCoupon ? 'Editing Coupon' : 'New Coupon'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {editingCoupon ? 'Edit Coupon' : 'Add Coupon'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="cp-no-scroll overflow-y-auto flex-1 flex flex-col">
                <div className="px-6 pt-7 pb-6 flex flex-col gap-5">

                  {/* Identity section */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" />Coupon Details<span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <FieldGroup icon={MdConfirmationNumber} label="Coupon Code">
                          <input
                            type="text"
                            name="code"
                            value={formData.code}
                            onChange={handleInputChange}
                            placeholder="e.g. SUMMER20"
                            className={inputCls}
                            required
                          />
                        </FieldGroup>
                      </div>
                      <div>
                        <FieldGroup icon={MdCalendarToday} label="Expiry Date">
                          <input
                            type="date"
                            name="expiryDate"
                            value={formData.expiryDate}
                            onChange={handleInputChange}
                            min={formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                            className={inputCls}
                            required
                          />
                        </FieldGroup>
                      </div>
                      <div>
                        <FieldGroup icon={MdShoppingCart} label="Min Order (Rs.)">
                          <input
                            type="number"
                            name="minOrderLimit"
                            value={formData.minOrderLimit}
                            onChange={handleInputChange}
                            placeholder="e.g. 1000"
                            className={inputCls}
                            required
                          />
                        </FieldGroup>
                      </div>
                      <div>
                        <FieldGroup icon={MdLocalOffer} label="Discount Type">
                          <select
                            name="discountType"
                            value={formData.discountType}
                            onChange={handleInputChange}
                            className={inputCls}
                            required
                          >
                            <option value="percentage">Percentage (%)</option>
                            <option value="value">Fixed Amount (Rs.)</option>
                          </select>
                        </FieldGroup>
                      </div>
                      <div>
                        <FieldGroup icon={MdPercent} label={`Discount ${formData.discountType === 'percentage' ? '(%)' : '(Rs.)'}`}>
                          <input
                            type="number"
                            name="discount"
                            value={formData.discount}
                            onChange={handleInputChange}
                            placeholder={formData.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
                            className={inputCls}
                            required
                          />
                        </FieldGroup>
                      </div>
                      <div>
                        <FieldGroup icon={MdPeople} label="Usage Limit">
                          <input
                            type="number"
                            name="usageLimit"
                            value={formData.usageLimit}
                            onChange={handleInputChange}
                            placeholder="e.g. 100"
                            className={inputCls}
                            required
                          />
                        </FieldGroup>
                      </div>
                    </div>
                  </div>

                  {/* Product Selection */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" />Product Selection<span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="flex gap-4 mb-3">
                      {['all', 'specific'].map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-[#374151] font-medium">
                          <input
                            type="radio"
                            name="productSelection"
                            value={val}
                            checked={formData.productSelection === val}
                            onChange={handleInputChange}
                            className="cp-radio"
                          />
                          {val === 'all' ? 'All Products' : 'Specific Products'}
                        </label>
                      ))}
                    </div>
                    {formData.productSelection === 'specific' && (
                      <ClickOutside onClick={() => setShowProductDropdown(false)}>
                        <div className="relative">
                          <div
                            className="bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer flex justify-between items-center text-sm text-[#374151]"
                            onClick={() => setShowProductDropdown(!showProductDropdown)}
                          >
                            <span className={formData.selectedProducts.length ? 'text-[#111827]' : 'text-gray-300'}>
                              {formData.selectedProducts.length > 0
                                ? `${formData.selectedProducts.length} product(s) selected`
                                : 'Select products…'}
                            </span>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showProductDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {showProductDropdown && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                              <div className="p-2 border-b border-gray-100 bg-[#FAFAFA]">
                                <input
                                  type="text"
                                  value={productSearchTerm}
                                  onChange={e => setProductSearchTerm(e.target.value)}
                                  placeholder="Search products…"
                                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none"
                                />
                              </div>
                              {products.length > 0 ? products
                                .filter(p => {
                                  const q = productSearchTerm.trim().toLowerCase();
                                  return !q || (p.englishTitle || p.urduTitle || p.name || '').toLowerCase().includes(q);
                                })
                                .map(product => (
                                  <label key={product._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 cursor-pointer text-sm text-[#374151]">
                                    <input
                                      type="checkbox"
                                      name="selectedProducts"
                                      value={product._id}
                                      checked={formData.selectedProducts.includes(product._id)}
                                      onChange={handleInputChange}
                                      className="cp-checkbox"
                                    />
                                    {product.englishTitle || product.urduTitle || 'Unnamed Product'}
                                  </label>
                                )) : (
                                <div className="p-3 text-sm text-[#9CA3AF]">No products available</div>
                              )}
                            </div>
                          )}
                        </div>
                      </ClickOutside>
                    )}
                  </div>

                  {/* Retailer Selection */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" />Customer Selection<span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="flex gap-4 mb-3">
                      {['all', 'specific'].map(val => (
                        <label key={val} className="flex items-center gap-2 cursor-pointer text-sm text-[#374151] font-medium">
                          <input
                            type="radio"
                            name="retailerSelection"
                            value={val}
                            checked={formData.retailerSelection === val}
                            onChange={handleInputChange}
                            className="cp-radio"
                          />
                          {val === 'all' ? 'All Customers' : 'Specific Customers'}
                        </label>
                      ))}
                    </div>
                    {formData.retailerSelection === 'specific' && (
                      <ClickOutside onClick={() => setShowRetailerDropdown(false)}>
                        <div className="relative">
                          <div
                            className="bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer flex justify-between items-center text-sm text-[#374151]"
                            onClick={() => setShowRetailerDropdown(!showRetailerDropdown)}
                          >
                            <span className={formData.selectedRetailers.length ? 'text-[#111827]' : 'text-gray-300'}>
                              {formData.selectedRetailers.length > 0
                                ? `${formData.selectedRetailers.length} customer(s) selected`
                                : 'Select customers…'}
                            </span>
                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showRetailerDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {showRetailerDropdown && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                              <div className="p-2 border-b border-gray-100 bg-[#FAFAFA]">
                                <input
                                  type="text"
                                  value={retailerSearchTerm}
                                  onChange={e => setRetailerSearchTerm(e.target.value)}
                                  placeholder="Search customers…"
                                  className="w-full px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg outline-none"
                                />
                              </div>
                              {retailers.length > 0 ? retailers
                                .filter(r => {
                                  const q = retailerSearchTerm.trim().toLowerCase();
                                  return !q || (r.name || r.businessName || r.ownerName || '').toLowerCase().includes(q);
                                })
                                .map(retailer => (
                                  <label key={retailer._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 cursor-pointer text-sm text-[#374151]">
                                    <input
                                      type="checkbox"
                                      name="selectedRetailers"
                                      value={retailer._id}
                                      checked={formData.selectedRetailers.includes(retailer._id)}
                                      onChange={handleInputChange}
                                      className="cp-checkbox"
                                    />
                                    {retailer.name || retailer.businessName || 'Unnamed Customer'}
                                  </label>
                                )) : (
                                <div className="p-3 text-sm text-[#9CA3AF]">No retailers available</div>
                              )}
                            </div>
                          )}
                        </div>
                      </ClickOutside>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-300 text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                  >
                    {loading
                      ? (editingCoupon ? 'Updating…' : 'Creating…')
                      : editingCoupon
                        ? <><MdEdit size={16} /> Save Changes</>
                        : <><MdAdd size={16} /> Add Coupon</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════
            DETAIL MODAL
        ═══════════════════════════════════════ */}
        {selectedCoupon && (() => {
          const isExpired = new Date(selectedCoupon.expiryDate) < new Date();
          const usagePct = (selectedCoupon.currentUsage / selectedCoupon.usageLimit) * 100;
          const isUsedUp = usagePct >= 100;
          return (
            <div
              className="cp-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
              onClick={() => setSelectedCoupon(null)}
            >
              <div
                className="cp-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Hero */}
                <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                  <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                  <div className="relative flex items-start justify-between mb-4">
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Coupon Details</span>
                    <button
                      onClick={() => setSelectedCoupon(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                    >
                      <MdClose size={15} />
                    </button>
                  </div>
                  <div className="relative">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-4 py-2 mb-3">
                      <MdConfirmationNumber size={18} className="text-[#FF5934]" />
                      <span className="font-mono font-bold text-white text-xl tracking-widest">{selectedCoupon.code}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${isExpired ? 'bg-red-500/20 text-red-300' : isUsedUp ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-red-400' : isUsedUp ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        {isExpired ? 'Expired' : isUsedUp ? 'Used Up' : 'Active'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300">
                        {selectedCoupon.discountType === 'percentage' ? `${selectedCoupon.discount}% off` : `Rs. ${selectedCoupon.discount} off`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats strip */}
                <div className="-mt-6 mx-5 grid grid-cols-3 gap-2 z-10 relative">
                  {[
                    { label: "Usage", value: `${selectedCoupon.currentUsage}/${selectedCoupon.usageLimit}` },
                    { label: "Min Order", value: `Rs. ${selectedCoupon.minOrderLimit}` },
                    { label: "Expires", value: new Date(selectedCoupon.expiryDate).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-2 py-3 text-center">
                      <p className="text-[12px] font-bold text-[#FF5934] truncate">{value}</p>
                      <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Usage bar */}
                <div className="px-5 pt-5">
                  <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 px-4 py-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Usage Progress</p>
                      <p className="text-[12px] font-bold text-[#FF5934]">{Math.round(usagePct)}%</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-[#FF5934] transition-all"
                        style={{ width: `${Math.min(usagePct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="cp-no-scroll overflow-y-auto px-5 pt-4 pb-4 flex flex-col gap-3">
                  {[
                    { icon: MdLocalOffer, label: "Discount Type", value: selectedCoupon.discountType === 'percentage' ? 'Percentage (%)' : 'Fixed Amount (Rs.)' },
                    { icon: MdShoppingCart, label: "Product Selection", value: selectedCoupon.productSelection === 'all' ? 'All Products' : `${(selectedCoupon.selectedProducts || []).length} specific product(s)` },
                    { icon: MdPeople, label: "Customer Selection", value: selectedCoupon.retailerSelection === 'all' ? 'All Customers' : `${(selectedCoupon.selectedRetailers || []).length} specific customer(s)` },
                    { icon: MdCalendarToday, label: "Expiry Date", value: new Date(selectedCoupon.expiryDate).toLocaleDateString() },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                      <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={15} className="text-[#FF5934]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-[13px] text-[#374151] font-medium">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                  <button
                    onClick={() => { handleEdit(selectedCoupon); setSelectedCoupon(null); }}
                    className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                  >
                    <MdEdit size={15} /> Edit Coupon
                  </button>
                  <button
                    onClick={() => setSelectedCoupon(null)}
                    className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => { handleDelete(selectedCoupon._id); setSelectedCoupon(null); }}
                    className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                    title="Delete"
                  >
                    <MdDelete size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
};

export default Coupon;