import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAllPurchases, addPurchaseLedger, getAllCities, getDatas, updateProduct,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { FaPlus, FaTrash } from 'react-icons/fa';
import { Form, Formik, FieldArray, Field } from "formik";
import * as yup from "yup";
import GroupedSelect from '../components/common/GroupedSelect';
import {
  MdLocalShipping, MdWarehouse, MdArrowBack,
} from "react-icons/md";

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";
const labelCls = "block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5";

const INITIAL_PURCHASE_FORM = {
  supplier: '',
  address: '',
  billNo: '',
  date: '',
  termDays: '',
  dueDate: '',
  vehicleNumber: '',
  biltyNumber: '',
  transportDetails: '',
  freightAmount: '',
  location: '',
  details: '',
  items: [{ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 }],
  totalAmount: 0,
  discountAmount: 0,
  payable: 0,
};

const emptyLineItem = () => ({
  product: '',
  purchaseRate: '',
  purchaseDiscount: '',
  quantity: '',
  amount: 0,
  discountAmount: 0,
});

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data))       return res.data;
  if (Array.isArray(res?.ledgers))    return res.ledgers;
  if (Array.isArray(res?.invoices))   return res.invoices;
  if (Array.isArray(res))             return res;
  return [];
};

const calculateLineTotals = (item) => {
  const rate     = Number(item.purchaseRate)     || 0;
  const quantity = Number(item.quantity)         || 0;
  const discount = Number(item.purchaseDiscount) || 0;
  const base     = rate * quantity;
  const discAmt  = (base * discount) / 100;
  return { amount: Math.max(base - discAmt, 0), discountAmount: discAmt };
};

const calculateTotals = (items) =>
  items.reduce((acc, item) => {
    const line = calculateLineTotals(item);
    return {
      totalAmount:   acc.totalAmount   + line.amount,
      totalDiscount: acc.totalDiscount + line.discountAmount,
    };
  }, { totalAmount: 0, totalDiscount: 0 });

const syncLineAndTotals = (items, index, patch, setFieldValue) => {
  const updated    = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
  const lineTotals = calculateLineTotals(updated[index]);
  const totals     = calculateTotals(updated);
  setFieldValue(`items.${index}.amount`,        lineTotals.amount);
  setFieldValue(`items.${index}.discountAmount`, lineTotals.discountAmount);
  setFieldValue('totalAmount',   totals.totalAmount);
  setFieldValue('discountAmount', totals.totalDiscount);
  setFieldValue('payable',        totals.totalAmount);
};

/* ── Fetch ALL products (no city filter) ── */
const safeFetchAllProducts = async () => {
  try {
    const params = new URLSearchParams({ page: 1, limit: 500 });
    return extractList(await getDatas(`/product/search?${params.toString()}`));
  } catch (err) {
    console.warn('Products fetch failed:', err?.message);
    return [];
  }
};

const safeFetchCities = async () => {
  try { return extractList(await getAllCities()); }
  catch (err) { console.warn('Cities fetch failed:', err?.message); return []; }
};

/* ── Update stock for all purchased items ── */
const updateStocksAfterPurchase = async (items, products) => {
  const session = JSON.parse(sessionStorage.getItem('karyana-admin') || '{}');
  const token   = session.token;

  if (!token) {
    toast.warn('Purchase saved, but stock could not be updated — session token missing.');
    return;
  }

  await Promise.allSettled(
    items.map((item) => {
      const product = products.find((p) => p._id === item.product);
      if (!product) return Promise.resolve();

      const newStock = (product.stock ?? 0) + (Number(item.quantity) || 0);

      return updateProduct(
        {
          ...product,
          id:         product._id,
          stock:      newStock,
          brandID:    product.brand?._id    || product.brand,
          categoryID: product.category?._id || product.category,
          cityID:     product.cityID?._id   || product.cityID,
        },
        token,
      );
    })
  );
};

const AddPurchase = () => {
  const navigate = useNavigate();

  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [suppliers, setSuppliers]     = useState([]);
  const [products, setProducts]       = useState([]);
  const [cities, setCities]           = useState([]);

  /* ── Load suppliers + cities + ALL products on mount ── */
  useEffect(() => {
    const init = async () => {
      try {
        setPageLoading(true);
        const [suppRes, cityList, productList] = await Promise.all([
          getAllPurchases(),
          safeFetchCities(),
          safeFetchAllProducts(),
        ]);
        setSuppliers(extractList(suppRes));
        setCities(cityList);
        setProducts(productList);
        if (!cityList.length) toast.warn('No warehouses/cities found');
        if (!productList.length) toast.warn('No products found');
      } catch (err) {
        console.error('AddPurchase init error:', err);
        toast.error('Failed to load form data');
      } finally {
        setPageLoading(false);
      }
    };
    init();
  }, []);

  /* ── Warehouse change — only resets items, does NOT reload products ── */
  const handleWarehouseChange = (cityId, setFieldValue) => {
    setFieldValue('location',      cityId);
    setFieldValue('items',         [emptyLineItem()]);
    setFieldValue('totalAmount',    0);
    setFieldValue('discountAmount', 0);
    setFieldValue('payable',        0);
  };

  /* ── Grouped products for select ── */
  const groupedProducts = useMemo(() => {
    if (!products.length) return [];
    const grouped = products.reduce((acc, p) => {
      const cat =
        p.categoryID?.englishName ||
        p.category?.englishName   ||
        p.category?.name          ||
        p.categoryName            ||
        'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        value: p._id,
        label: p.englishTitle || p.urduTitle || p.name || 'Unnamed',
        data:  p,
      });
      return acc;
    }, {});
    return Object.keys(grouped).map(cat => ({ label: cat, options: grouped[cat] }));
  }, [products]);

  /* ── Due date calc ── */
  const calcDueDate = (date, termDays) => {
    if (!date || !termDays) return '';
    const d = new Date(date);
    d.setDate(d.getDate() + Number(termDays));
    return d.toISOString().split('T')[0];
  };

  /* ── Validation ── */
  const schema = useMemo(() => yup.object().shape({
    supplier: yup.string().required('Supplier is required'),
    billNo:   yup.string().required('Bill No is required'),
    date:     yup.string().required('Date is required'),
    location: yup.string().required('Warehouse is required'),
    items: yup.array().of(yup.object().shape({
      product:      yup.string().required('Product is required'),
      purchaseRate: yup.number().required('Rate is required').min(0),
      quantity:     yup.number().required('Quantity is required').min(1),
    })).min(1),
  }), []);

  /* ── Submit ── */
  const handleSubmit = async (values, { resetForm }) => {
    try {
      setSubmitting(true);
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
        items: values.items.map(item => {
          const line = calculateLineTotals(item);
          return {
            product:          item.product,
            quantity:         Number(item.quantity)         || 0,
            purchaseRate:     Number(item.purchaseRate)     || 0,
            purchaseDiscount: Number(item.purchaseDiscount) || 0,
            salesRate:        Number(item.purchaseRate)     || 0,
            salesDiscount:    Number(item.purchaseDiscount) || 0,
            amount:           line.amount,
          };
        }),
      };

      const res = await addPurchaseLedger(values.supplier, payload);

      if (res?.success) {
        await updateStocksAfterPurchase(values.items, products);
        toast.success('Purchase added successfully');
        resetForm();
        navigate('/Ledgers/Purchases');
      } else {
        toast.error(res?.msg || 'Failed to add purchase');
      }
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message || 'Failed to add purchase');
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .ap-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .ap-sel {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .sec-label {
          font-size: 10px; font-weight: 700; color: #FF5934;
          text-transform: uppercase; letter-spacing: .1em;
          display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
        }
        .sec-label::after { content:''; flex:1; height:1px; background:#FFE0D8; }
      `}</style>

      <div className="ap-page px-3 sm:px-0 pb-10">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-3 mt-6 mb-6">
          <button
            type="button"
            onClick={() => navigate('/Ledgers/Purchases')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all shadow-sm flex-shrink-0"
            aria-label="Go back"
          >
            <MdArrowBack size={18} />
          </button>
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Add Purchase</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">Fill in the details to record a new purchase</p>
          </div>
        </div>

        <Formik
          initialValues={INITIAL_PURCHASE_FORM}
          validationSchema={schema}
          onSubmit={handleSubmit}
        >
          {({ values, handleChange, errors, touched, setFieldValue }) => (
            <Form className="flex flex-col gap-5">

              {/* ── Purchase Info Card ── */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6">
                <p className="sec-label">Purchase Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* Supplier */}
                  <div>
                    <label className={labelCls}>
                      Supplier <span className="text-[#FF5934]">*</span>
                    </label>
                    <select
                      name="supplier"
                      value={values.supplier}
                      onChange={e => {
                        handleChange(e);
                        const sup = suppliers.find(s => s._id === e.target.value);
                        setFieldValue('address', sup?.address || '');
                      }}
                      className={`${inputCls} ap-sel ${errors.supplier && touched.supplier ? 'border-red-400' : ''}`}
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

                  {/* Address */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Address</label>
                    <input
                      name="address" placeholder="Address"
                      value={values.address} onChange={handleChange}
                      className={inputCls}
                    />
                  </div>

                  {/* Bill No */}
                  <div>
                    <label className={labelCls}>
                      Bill No <span className="text-[#FF5934]">*</span>
                    </label>
                    <input
                      name="billNo" placeholder="Bill No"
                      value={values.billNo} onChange={handleChange}
                      className={`${inputCls} ${errors.billNo && touched.billNo ? 'border-red-400' : ''}`}
                    />
                    {errors.billNo && touched.billNo && (
                      <p className="text-red-500 text-[11px] mt-1">{errors.billNo}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div>
                    <label className={labelCls}>
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
                    <label className={labelCls}>Term Days</label>
                    <input
                      type="number" name="termDays" placeholder="e.g. 30"
                      value={values.termDays} min="0"
                      onChange={e => {
                        handleChange(e);
                        if (values.date) setFieldValue('dueDate', calcDueDate(values.date, e.target.value));
                      }}
                      className={inputCls}
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className={labelCls}>
                      Due Date
                      <span className="ml-1 text-[9px] font-normal normal-case tracking-normal text-[#9CA3AF]">
                        auto from term days
                      </span>
                    </label>
                    <input
                      type="date" name="dueDate"
                      value={values.dueDate} onChange={handleChange}
                      className={inputCls}
                    />
                  </div>

                  {/* Vehicle Number */}
                  <div>
                    <label className={labelCls}>Vehicle Number</label>
                    <input
                      name="vehicleNumber" placeholder="Vehicle Number"
                      value={values.vehicleNumber} onChange={handleChange}
                      className={inputCls}
                    />
                  </div>

                  {/* Bilty Number */}
                  <div>
                    <label className={labelCls}>Bilty Number</label>
                    <input
                      name="biltyNumber" placeholder="Bilty Number"
                      value={values.biltyNumber} onChange={handleChange}
                      className={inputCls}
                    />
                  </div>

                  {/* Freight Amount */}
                  <div>
                    <label className={labelCls}>Freight Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF] font-semibold pointer-events-none">PKR</span>
                      <input
                        name="freightAmount" placeholder="0.00"
                        value={values.freightAmount} onChange={handleChange}
                        className={`${inputCls} pl-12`}
                      />
                    </div>
                  </div>

                  {/* Transport Details */}
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Transport Details</label>
                    <input
                      name="transportDetails" placeholder="Transport Details"
                      value={values.transportDetails} onChange={handleChange}
                      className={inputCls}
                    />
                  </div>

                  {/* Warehouse */}
                  <div>
                    <label className={labelCls}>
                      <span className="flex items-center gap-1.5">
                        <MdWarehouse size={12} className="text-[#FF5934]" />
                        Location / Warehouse <span className="text-[#FF5934]">*</span>
                      </span>
                    </label>
                    <select
                      name="location"
                      value={values.location}
                      onChange={e => handleWarehouseChange(e.target.value, setFieldValue)}
                      className={`${inputCls} ap-sel ${errors.location && touched.location ? 'border-red-400' : ''}`}
                    >
                      <option value="">
                        {cities.length === 0 ? 'No warehouses available' : 'Select Warehouse…'}
                      </option>
                      {cities.map(c => (
                        <option key={c._id} value={c._id}>
                          {c.name}{c.address ? ` — ${c.address}` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.location && touched.location && (
                      <p className="text-red-500 text-[11px] mt-1">{errors.location}</p>
                    )}
                    {cities.length === 0 && (
                      <p className="text-[10px] text-red-400 mt-1">No warehouses loaded. Check your Cities API.</p>
                    )}
                    {values.location && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <MdWarehouse size={10} />
                        {cities.find(c => c._id === values.location)?.name} selected
                      </p>
                    )}
                  </div>

                  {/* Details */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelCls}>Details / Notes</label>
                    <textarea
                      name="details" placeholder="Enter details…"
                      value={values.details} onChange={handleChange}
                      className={`${inputCls} resize-none`} rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* ── Products Card ── */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6">
                <p className="sec-label">Products</p>

                {/* Products count banner */}
                {products.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {products.length} product{products.length !== 1 ? 's' : ''} available
                  </div>
                )}

                {products.length === 0 && (
                  <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-4">
                    <MdWarehouse size={16} className="text-orange-400 flex-shrink-0" />
                    <p className="text-[12px] text-orange-700 font-medium">No products found.</p>
                  </div>
                )}

                <FieldArray name="items">
                  {({ push, remove }) => (
                    <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-3 sm:p-4">

                      {/* Column headers — desktop only */}
                      <div className="hidden lg:grid grid-cols-[minmax(220px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_40px] gap-3 mb-2 px-1">
                        {['Product', 'Purchase Rate', 'Discount %', 'Quantity', 'Amount', ''].map(h => (
                          <div key={h || 'del'} className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{h}</div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {values.items.map((item, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_40px] gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0 items-start"
                          >
                            {/* Product */}
                            <div className="sm:col-span-2 lg:col-span-1 min-w-0">
                              <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Product</label>
                              <GroupedSelect
                                options={groupedProducts}
                                value={item.product ? {
                                  value: item.product,
                                  label: products.find(p => p._id === item.product)?.englishTitle || 'Product',
                                  data:  products.find(p => p._id === item.product),
                                } : null}
                                onChange={opt => {
                                  const sel   = opt?.data;
                                  const patch = sel
                                    ? { product: sel._id, purchaseRate: sel.purchaseRate || '', purchaseDiscount: sel.purchaseDiscount || '' }
                                    : { product: '', purchaseRate: '', purchaseDiscount: '' };
                                  setFieldValue(`items.${index}.product`,          patch.product);
                                  setFieldValue(`items.${index}.purchaseRate`,     patch.purchaseRate);
                                  setFieldValue(`items.${index}.purchaseDiscount`, patch.purchaseDiscount);
                                  syncLineAndTotals(values.items, index, patch, setFieldValue);
                                }}
                                placeholder="Select product…"
                                isDisabled={products.length === 0}
                              />
                              {touched.items?.[index]?.product && errors.items?.[index]?.product && (
                                <p className="text-red-500 text-[10px] mt-1">{errors.items[index].product}</p>
                              )}
                            </div>

                            {/* Purchase Rate */}
                            <div>
                              <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Purchase Rate</label>
                              <Field
                                type="number" name={`items.${index}.purchaseRate`} value={item.purchaseRate}
                                onChange={e => { handleChange(e); syncLineAndTotals(values.items, index, { purchaseRate: e.target.value }, setFieldValue); }}
                                placeholder="0.00" className={inputCls}
                              />
                            </div>

                            {/* Discount % */}
                            <div>
                              <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Discount %</label>
                              <Field
                                type="number" name={`items.${index}.purchaseDiscount`} value={item.purchaseDiscount}
                                onChange={e => { handleChange(e); syncLineAndTotals(values.items, index, { purchaseDiscount: e.target.value }, setFieldValue); }}
                                placeholder="%" className={inputCls}
                              />
                            </div>

                            {/* Quantity */}
                            <div>
                              <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Quantity</label>
                              <Field
                                type="number" name={`items.${index}.quantity`} value={item.quantity}
                                onChange={e => { handleChange(e); syncLineAndTotals(values.items, index, { quantity: e.target.value }, setFieldValue); }}
                                placeholder="0" className={inputCls}
                              />
                            </div>

                            {/* Amount (readonly) */}
                            <div>
                              <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Amount</label>
                              <div className={`${inputCls} flex items-center font-semibold text-[#111827] bg-white min-h-[42px]`}>
                                {Number(item.amount || 0).toFixed(2)}
                              </div>
                            </div>

                            {/* Remove */}
                            <div className="flex sm:block items-end justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const next   = values.items.filter((_, i) => i !== index);
                                  const totals = calculateTotals(next);
                                  remove(index);
                                  setFieldValue('totalAmount',    totals.totalAmount);
                                  setFieldValue('discountAmount', totals.totalDiscount);
                                  setFieldValue('payable',        totals.totalAmount);
                                }}
                                disabled={values.items.length === 1}
                                className="w-10 h-10 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 border border-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed lg:mt-1"
                                aria-label="Remove product"
                              >
                                <FaTrash size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => push(emptyLineItem())}
                        className="mt-4 flex items-center gap-2 text-[#FF5934] hover:text-[#e84d2a] text-[13px] font-semibold transition-colors"
                      >
                        <FaPlus size={12} /> Add Product
                      </button>
                    </div>
                  )}
                </FieldArray>
              </div>

              {/* ── Totals Card ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-6">
                {[
                  { label: 'Discount Amount', value: Number(values.discountAmount).toFixed(2) },
                  { label: 'Payable Amount',  value: Number(values.payable).toFixed(2) },
                  { label: 'Total Amount',    value: Number(values.totalAmount).toFixed(2), highlight: true },
                ].map(({ label, value, highlight }) => (
                  <div key={label}>
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-[18px] font-bold ${highlight ? 'text-[#FF5934]' : 'text-[#111827]'}`}>
                      PKR {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Action Buttons ── */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/Purchase/Purchases')}
                  className="flex-1 h-12 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                    : <><MdLocalShipping size={16} /> Save Purchase</>}
                </button>
              </div>

            </Form>
          )}
        </Formik>
      </div>
    </>
  );
};

export default AddPurchase;