import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdArrowBack, MdAdd, MdDelete, MdSearch, MdExpandMore,
  MdShoppingBag,
} from 'react-icons/md';
import { Spinner } from '../components/common/spinner';
import { getAllRetailers, getAllSalesPersons, getAllCities, updateProduct, updateOrderStatus } from '../APIS';
import { useSelector } from 'react-redux';
import { SERVER_URL } from '../utils';
import axios from 'axios';

const ACCENT = '#FF5934';

const createOrder = async (data, token) =>
  axios.request({
    method: 'post',
    url: SERVER_URL + '/order/add',
    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};
const fmt = (n) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10';
const selectCls = inputCls + ' pr-8 appearance-none cursor-pointer';
const cellInputCls =
  'w-full bg-transparent text-[13.5px] text-gray-800 outline-none text-right px-1.5 py-3 rounded focus:bg-[#FF5934]/5 focus:ring-1 focus:ring-[#FF5934]/30';

/* ════════════════════════════════════════
   PRODUCT PICKER CELL
════════════════════════════════════════ */
const ProductPickerCell = ({ products, loading, value, onPick }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products
      .filter(
        (p) =>
          p.englishTitle?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.productId?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [search, products]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 30);
        }}
        className="flex items-center gap-2 cursor-pointer px-2.5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]"
      >
        {value ? (
          <>
            {value.productImage ? (
              <img
                src={value.productImage}
                alt=""
                className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-100"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MdShoppingBag size={13} className="text-gray-300" />
              </div>
            )}
            <span className="text-[13.5px] text-gray-800 font-medium truncate">
              {value.productName}
            </span>
          </>
        ) : (
          <span className="text-[13.5px] text-gray-300">Select product…</span>
        )}
        <MdExpandMore size={14} className="text-gray-300 ml-auto flex-shrink-0" />
      </div>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl z-50 overflow-hidden flex flex-col"
          style={{ width: 320, maxHeight: 280, boxShadow: '0 8px 28px rgba(0,0,0,0.14)' }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <MdSearch size={14} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="bg-transparent outline-none text-[13px] w-full placeholder:text-gray-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
                <Spinner /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">No products found</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                    setSearch('');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      className="w-7 h-7 rounded object-cover flex-shrink-0 border border-gray-100"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <MdShoppingBag size={11} className="text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-gray-800 truncate">
                      {p.englishTitle}
                    </p>
                    <p className="text-[10.5px] text-gray-400">
                      Rs. {p.price?.toLocaleString()} · Stock: {p.stock ?? '—'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   LINE ITEM ROW
════════════════════════════════════════ */
const LineRow = ({ row, idx, products, loadingProducts, onPick, onChange, onRemove, canRemove }) => {
  const grossAmount = row.qty * row.rate;
  const discountAmt =
    row.discType === 'percent'
      ? grossAmount * (row.discPercent / 100)
      : row.discAmount;
  const net = Math.max(grossAmount - discountAmt, 0);

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors">
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 220 }}>
        <ProductPickerCell
          products={products}
          loading={loadingProducts}
          value={row.product}
          onPick={(p) => onPick(idx, p)}
        />
      </td>
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 140 }}>
        <input
          value={row.description}
          onChange={(e) => onChange(idx, 'description', e.target.value)}
          placeholder="Optional note…"
          className="w-full bg-transparent text-[13.5px] text-gray-600 outline-none px-1.5 py-3 rounded focus:bg-gray-50"
        />
      </td>
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 80 }}>
        <select
          value={row.unit}
          onChange={(e) => onChange(idx, 'unit', e.target.value)}
          className="w-full bg-transparent text-[13.5px] text-gray-700 outline-none cursor-pointer px-1.5 py-3 rounded focus:bg-gray-50"
        >
          <option value="piece">PCS</option>
          <option value="ctn">CTN</option>
        </select>
      </td>
      <td className="py-1.5 px-1 align-middle" style={{ width: 70 }}>
        <input
          type="number" min="1" value={row.qty}
          onChange={(e) => onChange(idx, 'qty', Number(e.target.value))}
          className={cellInputCls}
        />
      </td>
      <td className="py-1.5 px-1 align-middle" style={{ width: 90 }}>
        <input
          type="number" min="0" step="0.01" value={row.rate}
          onChange={(e) => onChange(idx, 'rate', Number(e.target.value))}
          className={cellInputCls}
        />
      </td>
      <td className="py-1.5 px-2 align-middle text-right text-[13.5px] text-gray-700" style={{ width: 90 }}>
        {fmt(grossAmount)}
      </td>
      <td className="py-1.5 px-1 align-middle" style={{ width: 70 }}>
        <input
          type="number" min="0" max="100" step="0.1" value={row.discPercent}
          onChange={(e) => onChange(idx, 'discPercent', Number(e.target.value))}
          disabled={row.discType !== 'percent'}
          className={cellInputCls + ' disabled:opacity-30'}
        />
      </td>
      <td className="py-1.5 px-2 align-middle text-right text-[13.5px] text-gray-700" style={{ width: 90 }}>
        {fmt(discountAmt)}
      </td>
      <td className="py-1.5 px-2 align-middle text-right text-[14px] font-bold" style={{ width: 100, color: ACCENT }}>
        {fmt(net)}
      </td>
      <td className="py-1.5 px-2 align-middle text-center" style={{ width: 40 }}>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          disabled={!canRemove}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-0 disabled:pointer-events-none"
        >
          <MdDelete size={15} />
        </button>
      </td>
    </tr>
  );
};

const emptyRow = () => ({
  product: null,
  description: '',
  unit: 'piece',
  qty: 1,
  rate: 0,
  discType: 'percent',
  discPercent: 0,
  discAmount: 0,
});

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
const AddCreditNote = () => {
  const navigate = useNavigate();
  const token = useSelector((s) => s.admin.token);

  const [retailers, setRetailers]             = useState([]);
  const [products, setProducts]               = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSP, setLoadingSP]             = useState(false);
  const [salesPersons, setSalesPersons]       = useState([]);
  const [cities, setCities]                   = useState([]);
  const [submitting, setSubmitting]           = useState(false);
  const [errors, setErrors]                   = useState({});

  const [form, setForm] = useState({
    RetailerUser: '',
    SaleUser: '',
    city: '',
    phoneNumber: '',
    shippingAddress: '',
    paymentType: 'cod',
    couponCode: '',
    date: todayISO(),
    termDays: 0,
    dueDate: todayISO(),
  });
  const sf = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const [rows, setRows] = useState([emptyRow()]);

  /* ── load data ── */
  const reloadProducts = () => {
    setLoadingProducts(true);
    return axios
      .get(SERVER_URL + '/product/', { headers: { 'x-auth-token': token } })
      .then((r) => {
        const list = Array.isArray(r.data?.data)
          ? r.data.data
          : Array.isArray(r.data)
          ? r.data
          : [];
        setProducts(list);
        return list;
      })
      .catch((e) => {
        console.error('Products:', e);
        toast.error('Failed to load products');
        return [];
      })
      .finally(() => setLoadingProducts(false));
  };

  useEffect(() => {
    getAllRetailers()
      .then((r) => setRetailers(r.data?.data || r.data || []))
      .catch((e) => console.error('Retailers:', e));

    reloadProducts();

    setLoadingSP(true);
    getAllSalesPersons()
      .then((r) => setSalesPersons(r.data?.data || []))
      .catch((e) => console.error('SP:', e))
      .finally(() => setLoadingSP(false));

    getAllCities()
      .then((r) => {
        const list = r.data?.data || r.data || [];
        setCities(Array.isArray(list) ? list : []);
      })
      .catch((e) => console.error('Cities:', e));
  }, []);

  /* ── auto-fill when retailer chosen ── */
  useEffect(() => {
    if (!form.RetailerUser) return;
    const r = retailers.find((r) => r._id === form.RetailerUser);
    if (!r) return;
    const address = [r.shopAddress1, r.shopAddress2]
      .filter(Boolean)
      .filter((a) => a !== 'N/A')
      .join(', ');
    setForm((p) => ({
      ...p,
      phoneNumber: r.phoneNumber || p.phoneNumber,
      shippingAddress: address || p.shippingAddress,
      city: r.cityID?._id || p.city,
      SaleUser: r.salesPersonID?._id || p.SaleUser,
    }));
  }, [form.RetailerUser, retailers]);

  /* ── due date follows term days ── */
  useEffect(() => {
    sf('dueDate', addDays(form.date, form.termDays));
  }, [form.date, form.termDays]);

  const selectedRetailer = retailers.find((r) => r._id === form.RetailerUser);

  /* ── row helpers ── */
  const pickProduct = (idx, p) => {
    setRows((prev) => {
      const updated = prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              product: {
                productId: p._id,
                productName: p.englishTitle,
                productImage: p.image,
                stock: p.stock,
                cortanSize: p.cortanSize || 1,
              },
              rate: p.price || 0,
            }
          : row
      );
      const isLast = idx === prev.length - 1;
      return isLast ? [...updated, emptyRow()] : updated;
    });
  };

  const changeRow = (idx, key, val) =>
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));

  const removeRow = (idx) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  /* ── totals ── */
  const activeRows = rows.filter((r) => r.product);
  const subTotal = activeRows.reduce((s, r) => s + r.qty * r.rate, 0);
  const totalDiscount = activeRows.reduce((s, r) => {
    const gross = r.qty * r.rate;
    return s + (r.discType === 'percent' ? gross * (r.discPercent / 100) : r.discAmount);
  }, 0);
  const grandTotal = subTotal - totalDiscount;

  /* ── validate ── (no stock check for credit note — we're returning stock) ── */
  const validate = () => {
    const e = {};
    if (!form.RetailerUser)    e.RetailerUser    = 'Customer is required';
    if (!form.SaleUser)        e.SaleUser        = 'Sales person is required';
    if (!form.city)            e.city            = 'City is required';
    if (!form.phoneNumber)     e.phoneNumber     = 'Phone number is required';
    if (!form.shippingAddress) e.shippingAddress = 'Shipping address is required';
    if (!activeRows.length)    e.items           = 'Add at least one product';
    setErrors(e);
    return !Object.keys(e).length;
  };

  /* ── INCREASE stock (credit note = return → stock goes back up) ── */
const increaseStock = async (returnedRows, freshProducts) => {
  const productList = freshProducts?.length ? freshProducts : products;

  await Promise.allSettled(
    returnedRows.map(async (r) => {
      const unitsReturned =
        r.unit === 'ctn' ? r.qty * (r.product.cortanSize || 1) : r.qty;

      const matched = productList.find((p) => p._id === r.product.productId);
      if (!matched) return;

      const newStock = (matched.stock ?? 0) + unitsReturned;

      return updateProduct(
        {
          ...matched,
          id:         matched._id,
          stock:      newStock,
          brandID:    matched.brand?._id    || matched.brand,
          categoryID: matched.category?._id || matched.category,
          cityID:     matched.cityID?._id   || matched.cityID,
        },
        token
      );
    })
  );
};
  /* ── submit ── */
  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);

      // Reload fresh product list for accurate current stock
      const freshProducts = await reloadProducts();

      const payload = {
        RetailerUser: form.RetailerUser,
        SaleUser: form.SaleUser,
        shippingAddress: form.shippingAddress,
        phoneNumber: form.phoneNumber,
        city: form.city,
        paymentType: form.paymentType,
        ...(form.couponCode && { couponCode: form.couponCode }),
        items: activeRows.map((r) => {
          const gross = r.qty * r.rate;
          const discAmt =
            r.discType === 'percent'
              ? gross * (r.discPercent / 100)
              : r.discAmount;
          const net = Math.max(gross - discAmt, 0);
          const effectivePrice = r.qty ? net / r.qty : r.rate;
          return {
            productId: r.product.productId,
            quantity: Number(r.qty),
            price: Number(r.rate),
            type: r.unit,
            ...(discAmt > 0 && {
              discountedPrice: Number(effectivePrice.toFixed(2)),
            }),
          };
        }),
      };

      // 1. Create the order (will be Placed by backend)
      const orderRes = await createOrder(payload, token);
      const orderId = orderRes.data?.data?._id || orderRes.data?._id;

      // 2. Immediately push status to Cancelled
      if (orderId) {
        await updateOrderStatus({ id: orderId, status: 'Cancelled' });
      }

      // 3. INCREASE stock (items are being returned)
      await increaseStock(activeRows, freshProducts);

      toast.success('Credit note created successfully!');
      navigate('/Sales/Invoices');
    } catch (err) {
      console.error('Credit note error:', err);
      const msg =
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error ||
        err.response?.data?.msg ||
        err.message ||
        'Failed to create credit note';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors"
            >
              <MdArrowBack size={17} />
            </button>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Sales / Orders</p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Add Credit Note</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="h-10 px-5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="h-10 px-6 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-60"
              style={{ background: ACCENT, boxShadow: `0 4px 14px ${ACCENT}55` }}
            >
              {submitting ? <><Spinner /> Saving…</> : <><MdAdd size={16} /> Save Credit Note</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 py-6 flex flex-col gap-5">

        {/* ── Customer Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
            <p className="text-[12.5px] font-bold text-gray-700">Customer Details</p>
          </div>
          <div className="p-5 grid grid-cols-12 gap-x-6 gap-y-4">

            {/* Customer */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Customer <span style={{ color: ACCENT }}>*</span>
              </p>
              <div className="relative">
                <select
                  value={form.RetailerUser}
                  onChange={(e) => sf('RetailerUser', e.target.value)}
                  className={selectCls + (errors.RetailerUser ? ' border-red-300' : '')}
                >
                  <option value="">Select…</option>
                  {retailers.map((r) => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.RetailerUser && (
                <p className="text-red-400 text-[11px] mt-1">{errors.RetailerUser}</p>
              )}
            </div>

            {/* Sales person */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Sales Person <span style={{ color: ACCENT }}>*</span>
              </p>
              <div className="relative">
                <select
                  value={form.SaleUser}
                  onChange={(e) => sf('SaleUser', e.target.value)}
                  disabled={loadingSP}
                  className={selectCls + (errors.SaleUser ? ' border-red-300' : '')}
                >
                  <option value="">{loadingSP ? 'Loading…' : 'Select…'}</option>
                  {salesPersons.map((sp) => (
                    <option key={sp._id} value={sp._id}>{sp.name}</option>
                  ))}
                  {selectedRetailer?.salesPersonID &&
                    !salesPersons.some(
                      (sp) => sp._id === selectedRetailer.salesPersonID._id
                    ) && (
                      <option value={selectedRetailer.salesPersonID._id}>
                        {selectedRetailer.salesPersonID.name}
                      </option>
                    )}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.SaleUser && (
                <p className="text-red-400 text-[11px] mt-1">{errors.SaleUser}</p>
              )}
            </div>

            {/* City */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                City / Site <span style={{ color: ACCENT }}>*</span>
              </p>
              <div className="relative">
                <select
                  value={form.city}
                  onChange={(e) => sf('city', e.target.value)}
                  className={selectCls + (errors.city ? ' border-red-300' : '')}
                >
                  <option value="">Select…</option>
                  {cities.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.city && <p className="text-red-400 text-[11px] mt-1">{errors.city}</p>}
            </div>

            {/* Phone */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Phone Number <span style={{ color: ACCENT }}>*</span>
              </p>
              <input
                value={form.phoneNumber}
                onChange={(e) => sf('phoneNumber', e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={inputCls + (errors.phoneNumber ? ' border-red-300' : '')}
              />
              {errors.phoneNumber && (
                <p className="text-red-400 text-[11px] mt-1">{errors.phoneNumber}</p>
              )}
            </div>

            {/* Address */}
            <div className="col-span-12 md:col-span-8 row-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Shipping Address <span style={{ color: ACCENT }}>*</span>
              </p>
              <textarea
                value={form.shippingAddress}
                onChange={(e) => sf('shippingAddress', e.target.value)}
                placeholder="Full delivery address…"
                rows={3}
                className={inputCls + ' resize-none ' + (errors.shippingAddress ? 'border-red-300' : '')}
              />
              {errors.shippingAddress && (
                <p className="text-red-400 text-[11px] mt-1">{errors.shippingAddress}</p>
              )}
            </div>

            {/* Date */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Date <span style={{ color: ACCENT }}>*</span>
              </p>
              <input
                type="date"
                value={form.date}
                onChange={(e) => sf('date', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Term Days */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Term Days</p>
              <input
                type="number" min="0"
                value={form.termDays}
                onChange={(e) => sf('termDays', Number(e.target.value))}
                className={inputCls}
              />
            </div>

            {/* Due Date */}
            <div className="col-span-12 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Due Date <span style={{ color: ACCENT }}>*</span>
              </p>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => sf('dueDate', e.target.value)}
                className={inputCls}
              />
            </div>

            {/* Credit limit */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Credit Limit</p>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-400">
                {fmt(selectedRetailer?.creditLimit || 0)}
              </div>
            </div>

            {/* Balance */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Balance</p>
              <div className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-400">
                {fmt(selectedRetailer?.balance || 0)}
              </div>
            </div>

            {/* Payment type */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Payment Type <span style={{ color: ACCENT }}>*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'cod', l: 'Cash on Delivery' },
                  { v: 'bank_transfer', l: 'Bank Transfer' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => sf('paymentType', opt.v)}
                    className="h-9 rounded-lg border text-[12px] font-semibold transition-all"
                    style={
                      form.paymentType === opt.v
                        ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
                        : { background: '#fff', borderColor: '#e5e7eb', color: '#4b5563' }
                    }
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Products Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <p className="text-[12.5px] font-bold text-gray-700">Products Details</p>
            {loadingProducts && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Spinner /> loading catalogue…
              </span>
            )}
          </div>

          {errors.items && (
            <p className="text-red-400 text-[11px] px-5 pt-3">{errors.items}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 960 }}>
              <thead>
                <tr style={{ background: ACCENT }}>
                  {[
                    'Product', 'Description', 'Unit', 'Qty', 'Rate',
                    'Amount', 'Disc %', 'Discount', 'Net',
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`text-[10.5px] font-bold text-white uppercase tracking-wide px-2 py-3.5 ${
                        i >= 3 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                  <th className="px-2 py-3.5" style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <LineRow
                    key={idx}
                    row={row}
                    idx={idx}
                    products={products}
                    loadingProducts={loadingProducts}
                    onPick={pickProduct}
                    onChange={changeRow}
                    onRemove={removeRow}
                    canRemove={rows.length > 1}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100">
                  <td colSpan={3} className="px-2 py-2.5 text-[12px] font-bold text-gray-500">Total</td>
                  <td className="px-1 py-2.5 text-right text-[12px] font-bold text-gray-700">
                    {activeRows.reduce((s, r) => s + Number(r.qty), 0)}
                  </td>
                  <td></td>
                  <td className="px-2 py-2.5 text-right text-[12px] font-bold text-gray-700">{fmt(subTotal)}</td>
                  <td></td>
                  <td className="px-2 py-2.5 text-right text-[12px] font-bold text-gray-700">{fmt(totalDiscount)}</td>
                  <td className="px-2 py-2.5 text-right text-[13px] font-bold" style={{ color: ACCENT }}>{fmt(grandTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors"
              style={{ color: ACCENT }}
            >
              <MdAdd size={15} /> Add more
            </button>
          </div>
        </div>

        {/* ── Totals ── */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-7">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full">
              <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Coupon Code</p>
              <input
                value={form.couponCode}
                onChange={(e) => sf('couponCode', e.target.value.toUpperCase())}
                placeholder="e.g. SAVE10"
                className={inputCls + ' font-mono tracking-wider max-w-xs'}
              />
            </div>
          </div>

          <div className="col-span-12 md:col-span-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500">Sub Total</span>
                  <span className="font-semibold text-gray-700">Rs. {fmt(subTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500">Discount</span>
                  <span className="font-semibold text-gray-700">- Rs. {fmt(totalDiscount)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-5 py-4" style={{ background: ACCENT }}>
                <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">Total</span>
                <span className="text-xl font-bold text-white">Rs. {fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button
            onClick={() => navigate(-1)}
            className="h-11 px-6 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 px-7 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-60"
            style={{ background: ACCENT, boxShadow: `0 4px 14px ${ACCENT}55` }}
          >
            {submitting ? <><Spinner /> Saving…</> : <><MdAdd size={16} /> Save Credit Note</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddCreditNote;