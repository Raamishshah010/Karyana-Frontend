import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdArrowBack, MdAdd, MdDelete, MdSearch, MdExpandMore,
  MdShoppingBag, MdLocationOn,
} from 'react-icons/md';
import { Spinner } from '../components/common/spinner';
import {
  getAllRetailers, getAllSalesPersons, getAllCities,
  updateProduct, updateOrderStatus,
} from '../APIS';
import { useSelector } from 'react-redux';
import { SERVER_URL } from '../utils';
import axios from 'axios';
import { createPortal } from 'react-dom';

const ACCENT = '#FF5934';

/* ─── API helpers ─── */
const createOrder = async (data, token) =>
  axios.request({
    method: 'post',
    url: SERVER_URL + '/order/add',
    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });

/* ─── Utility ─── */
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};
const fmt = (n) =>
  (Number(n) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ─── Shared CSS ─── */
const inputCls =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10';
const selectCls = inputCls + ' pr-8 appearance-none cursor-pointer';
const cellInputCls =
  'w-full bg-transparent text-[13.5px] text-gray-800 outline-none text-right px-1.5 py-3 rounded focus:bg-[#FF5934]/5 focus:ring-1 focus:ring-[#FF5934]/30';

/* ════════════════════════════════════════
   PRODUCT PICKER — portal dropdown
════════════════════════════════════════ */
const ProductPickerCell = ({ products, loading, value, onPick }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        !document.getElementById('product-picker-portal')?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openDropdown = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 320),
      });
    }
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

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

  const dropdown = open && createPortal(
    <div
      id="product-picker-portal"
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: 280,
        zIndex: 9999,
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
      }}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <MdSearch size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-gray-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">✕</button>
        )}
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
              onClick={() => { onPick(p); setOpen(false); setSearch(''); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#FF5934]/5 transition-colors border-b border-gray-50 last:border-0"
            >
              {p.image ? (
                <img src={p.image} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border border-gray-100" />
              ) : (
                <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <MdShoppingBag size={11} className="text-gray-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-gray-800 truncate">{p.englishTitle}</p>
                <p className="text-[10.5px] text-gray-400">
                  Rs. {p.price?.toLocaleString()} · Stock: {p.stock ?? '—'} · CTN: {p.cortanSize || 1}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={openDropdown}
        className="flex items-center gap-2 cursor-pointer px-2.5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px]"
      >
        {value ? (
          <>
            {value.productImage ? (
              <img src={value.productImage} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-100" />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MdShoppingBag size={13} className="text-gray-300" />
              </div>
            )}
            <span className="text-[13.5px] text-gray-800 font-medium truncate">{value.productName}</span>
          </>
        ) : (
          <span className="text-[13.5px] text-gray-300">Select product…</span>
        )}
        <MdExpandMore size={14} className="text-gray-300 ml-auto flex-shrink-0" />
      </div>
      {dropdown}
    </div>
  );
};

/* ════════════════════════════════════════
   LOCATION PICKER CELL — portal dropdown per row
════════════════════════════════════════ */
const LocationPickerCell = ({ cities, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const portalId = useRef(`loc-portal-${Math.random()}`).current;

  useEffect(() => {
    const fn = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        !document.getElementById(portalId)?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openDropdown = () => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 200),
      });
    }
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return cities;
    const q = search.toLowerCase();
    return cities.filter((c) => c.name?.toLowerCase().includes(q));
  }, [search, cities]);

  const selected = cities.find((c) => c._id === value);

  const dropdown = open && createPortal(
    <div
      id={portalId}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        maxHeight: 240,
        zIndex: 9999,
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
      }}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <MdSearch size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search location…"
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-gray-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500">✕</button>
        )}
      </div>
      <div className="overflow-y-auto flex-1">
        {/* Clear option */}
        <button
          type="button"
          onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
          className="w-full text-left px-3 py-2 text-[12px] text-gray-400 hover:bg-gray-50 border-b border-gray-50 italic"
        >
          — Use header location
        </button>
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-gray-400 text-sm">No locations found</div>
        ) : (
          filtered.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => { onChange(c._id); setOpen(false); setSearch(''); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#FF5934]/5 transition-colors border-b border-gray-50 last:border-0 ${
                value === c._id ? 'font-semibold text-[#FF5934]' : 'text-gray-700'
              }`}
            >
              <MdLocationOn size={13} className={value === c._id ? 'text-[#FF5934]' : 'text-gray-300'} />
              {c.name}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={openDropdown}
        className="flex items-center gap-1.5 cursor-pointer px-2 py-2.5 rounded-lg hover:bg-gray-50 transition-colors min-h-[48px] min-w-[120px]"
      >
        <MdLocationOn
          size={14}
          className={selected ? 'text-[#FF5934] flex-shrink-0' : 'text-gray-200 flex-shrink-0'}
        />
        <span className={`text-[12.5px] truncate flex-1 ${selected ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
          {selected ? selected.name : 'Location…'}
        </span>
        <MdExpandMore size={13} className="text-gray-300 flex-shrink-0" />
      </div>
      {dropdown}
    </div>
  );
};

/* ════════════════════════════════════════
   DISCOUNT CELL
════════════════════════════════════════ */
const DiscountCell = ({ row, idx, onChange, grossAmount }) => {
  const isPercent = row.discType === 'percent';
  const discountAmt = isPercent
    ? grossAmount * (row.discPercent / 100)
    : Number(row.discAmount) || 0;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(idx, 'discType', isPercent ? 'flat' : 'percent')}
          title={isPercent ? 'Switch to flat Rs. discount' : 'Switch to % discount'}
          className="flex-shrink-0 w-7 h-7 rounded-md border border-gray-200 text-[10px] font-bold text-gray-500 hover:border-[#FF5934] hover:text-[#FF5934] transition-colors"
        >
          {isPercent ? '%' : 'Rs'}
        </button>
        {isPercent ? (
          <input
            type="number" min="0" max="100" step="0.1"
            value={row.discPercent}
            onChange={(e) => onChange(idx, 'discPercent', Number(e.target.value))}
            className={cellInputCls}
          />
        ) : (
          <input
            type="number" min="0" step="0.01"
            value={row.discAmount}
            onChange={(e) => onChange(idx, 'discAmount', Number(e.target.value))}
            className={cellInputCls}
          />
        )}
      </div>
      {isPercent && (
        <span className="text-[10px] text-gray-400 text-right pr-1.5">= {fmt(discountAmt)}</span>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   LINE ROW — with per-row Location column
════════════════════════════════════════ */
const LineRow = ({
  row, idx, products, loadingProducts, cities,
  onPick, onChange, onRemove, canRemove,
}) => {
  const grossAmount = row.qty * row.rate;
  const discountAmt = row.discType === 'percent'
    ? grossAmount * (row.discPercent / 100)
    : Number(row.discAmount) || 0;
  const net = Math.max(grossAmount - discountAmt, 0);

  const toUnit = Number(row.toUnit) || 0;
  const toCalculated = toUnit > 0 ? Math.floor(row.qty / toUnit) : 0;

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors">

      {/* Product */}
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 220 }}>
        <ProductPickerCell
          products={products}
          loading={loadingProducts}
          value={row.product}
          onPick={(p) => onPick(idx, p)}
        />
      </td>

      {/* Location — per row */}
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 140 }}>
        <LocationPickerCell
          cities={cities}
          value={row.city}
          onChange={(val) => onChange(idx, 'city', val)}
        />
      </td>

      {/* Description */}
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 110 }}>
        <input
          value={row.description}
          onChange={(e) => onChange(idx, 'description', e.target.value)}
          placeholder="Note…"
          className="w-full bg-transparent text-[13px] text-gray-600 outline-none px-1.5 py-3 rounded focus:bg-gray-50"
        />
      </td>

      {/* Unit */}
      <td className="py-1.5 px-2 align-middle" style={{ minWidth: 72 }}>
        <select
          value={row.unit}
          onChange={(e) => onChange(idx, 'unit', e.target.value)}
          className="w-full bg-transparent text-[13px] text-gray-700 outline-none cursor-pointer px-1.5 py-3 rounded focus:bg-gray-50"
        >
          <option value="piece">PCS</option>
          <option value="ctn">CTN</option>
        </select>
      </td>

      {/* Qty */}
      <td className="py-1.5 px-1 align-middle" style={{ width: 64 }}>
        <input
          type="number" min="1"
          value={row.qty}
          onChange={(e) => onChange(idx, 'qty', Number(e.target.value))}
          className={cellInputCls}
        />
      </td>

      {/* Rate */}
      <td className="py-1.5 px-1 align-middle" style={{ width: 84 }}>
        <input
          type="number" min="0" step="0.01"
          value={row.rate}
          onChange={(e) => onChange(idx, 'rate', Number(e.target.value))}
          className={cellInputCls}
        />
      </td>

      {/* Amount */}
      <td className="py-1.5 px-2 align-middle text-right text-[13px] text-gray-700" style={{ width: 88 }}>
        {fmt(grossAmount)}
      </td>

      {/* Discount input */}
      <td className="py-1.5 px-1 align-middle" style={{ width: 116 }}>
        <DiscountCell row={row} idx={idx} onChange={onChange} grossAmount={grossAmount} />
      </td>

      {/* Disc calculated */}
      <td className="py-1.5 px-2 align-middle text-right" style={{ width: 84 }}>
        <span className="text-[13px] font-semibold text-amber-500">{fmt(discountAmt)}</span>
      </td>

      {/* TO/Unit */}
      <td className="py-1.5 px-1 align-middle" style={{ width: 68 }}>
        <div className="flex flex-col">
          <input
            type="number" min="0"
            value={row.toUnit}
            onChange={(e) => onChange(idx, 'toUnit', Number(e.target.value))}
            placeholder="0"
            title="Buy N get 1 free"
            className={cellInputCls}
          />
          {toUnit > 0 && (
            <span className="text-[9.5px] text-gray-400 text-right pr-1 leading-tight">1/{toUnit}</span>
          )}
        </div>
      </td>

      {/* TO Calc */}
      <td className="py-1.5 px-2 align-middle text-right" style={{ width: 68 }}>
        {toCalculated > 0
          ? <span className="text-[13px] font-bold text-emerald-600">+{toCalculated}</span>
          : <span className="text-[12px] text-gray-200">—</span>}
      </td>

      {/* Net */}
      <td className="py-1.5 px-2 align-middle text-right text-[14px] font-bold" style={{ width: 96, color: ACCENT }}>
        {fmt(net)}
      </td>

      {/* Remove */}
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

/* ─── empty row factory ─── */
const emptyRow = () => ({
  product: null,
  city: '',           // ← per-row location
  description: '',
  unit: 'piece',
  qty: 1,
  rate: 0,
  discType: 'percent',
  discPercent: 0,
  discAmount: 0,
  toUnit: 0,
});

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
const AddMultiInvoice = () => {
  const navigate = useNavigate();
  const token = useSelector((s) => s.admin.token);

  const [retailers, setRetailers]       = useState([]);
  const [products, setProducts]         = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSP, setLoadingSP]       = useState(false);
  const [salesPersons, setSalesPersons] = useState([]);
  const [cities, setCities]             = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [errors, setErrors]             = useState({});

  const [form, setForm] = useState({
    RetailerUser: '',
    SaleUser: '',
    city: '',
    phoneNumber: '',
    shippingAddress: '',
    paymentType: 'cod',
    couponCode: '',
    deduction: 0,
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
        const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
        setProducts(list);
        return list;
      })
      .catch((e) => { console.error('Products:', e); toast.error('Failed to load products'); return []; })
      .finally(() => setLoadingProducts(false));
  };

  useEffect(() => {
    getAllRetailers()
      .then((r) => setRetailers(r.data?.data || r.data || []))
      .catch(console.error);
    reloadProducts();
    setLoadingSP(true);
    getAllSalesPersons()
      .then((r) => setSalesPersons(r.data?.data || []))
      .catch(console.error)
      .finally(() => setLoadingSP(false));
    getAllCities()
      .then((r) => {
        const list = r.data?.data || r.data || [];
        setCities(Array.isArray(list) ? list : []);
      })
      .catch(console.error);
  }, [token]);

  /* ── auto-fill retailer fields ── */
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
      SaleUser: r.salesPersonID?._id || p.SaleUser,
    }));
  }, [form.RetailerUser, retailers]);

  useEffect(() => {
    sf('dueDate', addDays(form.date, form.termDays));
  }, [form.date, form.termDays]);

  const selectedRetailer = retailers.find((r) => r._id === form.RetailerUser);

  /* ── row helpers ── */
  const pickProduct = (idx, p) => {
    setRows((prev) => {
      const updated = prev.map((row, i) => {
        if (i !== idx) return row;
        const cortanSize = p.cortanSize || 1;
        const piecePrice = p.price || 0;
        const rate = row.unit === 'ctn' ? piecePrice * cortanSize : piecePrice;
        return {
          ...row,
          product: {
            productId: p._id,
            productName: p.englishTitle,
            productImage: p.image,
            stock: p.stock,
            cortanSize,
            basePiecePrice: piecePrice,
          },
          rate,
        };
      });
      const isLast = idx === prev.length - 1;
      return isLast ? [...updated, emptyRow()] : updated;
    });
  };

  const changeRow = (idx, key, val) =>
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [key]: val };
        if (key === 'unit' && updated.product) {
          const piecePrice = updated.product.basePiecePrice ?? updated.rate;
          const cortanSize = updated.product.cortanSize || 1;
          updated.rate = val === 'ctn' ? piecePrice * cortanSize : piecePrice;
        }
        return updated;
      })
    );

  const removeRow = (idx) =>
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  /* ── totals ── */
  const activeRows = rows.filter((r) => r.product);
  const subTotal = activeRows.reduce((s, r) => s + r.qty * r.rate, 0);
  const totalDiscount = activeRows.reduce((s, r) => {
    const gross = r.qty * r.rate;
    return s + (r.discType === 'percent'
      ? gross * (r.discPercent / 100)
      : Number(r.discAmount) || 0);
  }, 0);
  const deductionAmt = Number(form.deduction) || 0;
  const grandTotal = Math.max(subTotal - totalDiscount - deductionAmt, 0);

  const validate = () => {
    const e = {};
    if (!form.RetailerUser)    e.RetailerUser    = 'Customer is required';
    if (!form.SaleUser)        e.SaleUser        = 'Sales person is required';
    if (!form.city)            e.city            = 'Location is required';
    if (!form.phoneNumber)     e.phoneNumber     = 'Phone number is required';
    if (!form.shippingAddress) e.shippingAddress = 'Shipping address is required';
    if (!activeRows.length)    e.items           = 'Add at least one product';

    activeRows.forEach((r, idx) => {
      const unitsOrdered = r.unit === 'ctn' ? r.qty * (r.product?.cortanSize || 1) : r.qty;
      const liveStock = products.find((p) => p._id === r.product?.productId)?.stock ?? r.product?.stock;
      if (liveStock != null && unitsOrdered > liveStock)
        e[`stock_${idx}`] = `Only ${liveStock} in stock for "${r.product?.productName}"`;
    });

    setErrors(e);
    return !Object.keys(e).length;
  };

  /* ── decrement stock ── */
  const decrementStock = async (orderedRows, freshProducts) => {
    const productList = freshProducts?.length ? freshProducts : products;
    await Promise.allSettled(
      orderedRows.map(async (r) => {
        const unitsToDeduct = r.unit === 'ctn' ? r.qty * (r.product.cortanSize || 1) : r.qty;
        const matched = productList.find((p) => p._id === r.product.productId);
        if (!matched) return;
        const newStock = Math.max((matched.stock ?? 0) - unitsToDeduct, 0);
        return updateProduct(
          {
            ...matched,
            id: matched._id,
            stock: newStock,
            brandID: matched.brand?._id || matched.brand,
            categoryID: matched.category?._id || matched.category,
            cityID: matched.cityID?._id || matched.cityID,
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
      const freshProducts = await reloadProducts();

      const payload = {
        RetailerUser:    form.RetailerUser,
        SaleUser:        form.SaleUser,
        shippingAddress: form.shippingAddress,
        phoneNumber:     form.phoneNumber,
        paymentType:     form.paymentType,
        date:            form.date,
        dueDate:         form.dueDate,
        ...(form.couponCode  && { couponCode: form.couponCode }),
        ...(deductionAmt > 0 && { deduction: deductionAmt }),
        // Each item carries its own city (per-row picker) or falls back to header city
        items: activeRows.map((r) => {
          const gross   = r.qty * r.rate;
          const discAmt = r.discType === 'percent'
            ? gross * (r.discPercent / 100)
            : Number(r.discAmount) || 0;
          const net            = Math.max(gross - discAmt, 0);
          const effectivePrice = r.qty ? net / r.qty : r.rate;
          return {
            productId: r.product.productId,
            quantity:  Number(r.qty),
            price:     Number(r.rate),
            type:      r.unit,
            city:      r.city || form.city,   // per-row city, fallback to header city
            ...(discAmt > 0 && { discountedPrice: Number(effectivePrice.toFixed(2)) }),
          };
        }),
      };

      // Single call to /invoice/multi — backend creates one order+invoice per city
      await axios.post(
        SERVER_URL + '/invoice/multi',
        payload,
        { headers: { 'x-auth-token': token, 'Content-Type': 'application/json' } }
      );

      await decrementStock(activeRows, freshProducts);

      toast.success('Multi-location invoice created — stock updated.');
      navigate('/Sales/Invoices');
    } catch (err) {
      console.error('Multi-invoice error:', err);
      toast.error(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error            ||
        err.response?.data?.msg              ||
        err.message                          ||
        'Failed to create invoice'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30 px-6">
        <div className="mx-auto py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors"
            >
              <MdArrowBack size={17} />
            </button>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Sales / Orders</p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Add Multi-Location Invoice</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto px-6 py-6 flex flex-col gap-5">

        {/* ── Customer Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
            <p className="text-[12.5px] font-bold text-gray-700">Customer Details</p>
          </div>
          <div className="p-5 grid grid-cols-12 gap-x-6 gap-y-4">

            {/* Customer */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Customer <span style={{ color: ACCENT }}>*</span></p>
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
              {errors.RetailerUser && <p className="text-red-400 text-[11px] mt-1">{errors.RetailerUser}</p>}
            </div>

            {/* Sales Person */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Sales Person <span style={{ color: ACCENT }}>*</span></p>
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
                    !salesPersons.some((sp) => sp._id === selectedRetailer.salesPersonID._id) && (
                      <option value={selectedRetailer.salesPersonID._id}>
                        {selectedRetailer.salesPersonID.name}
                      </option>
                    )}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.SaleUser && <p className="text-red-400 text-[11px] mt-1">{errors.SaleUser}</p>}
            </div>

            {/* Default Location (used when a row has no per-row city selected) */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">
                Default Location <span style={{ color: ACCENT }}>*</span>
                <span className="ml-1 font-normal text-gray-400">(per-row overrides this)</span>
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
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Phone Number <span style={{ color: ACCENT }}>*</span></p>
              <input
                value={form.phoneNumber}
                onChange={(e) => sf('phoneNumber', e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={inputCls + (errors.phoneNumber ? ' border-red-300' : '')}
              />
              {errors.phoneNumber && <p className="text-red-400 text-[11px] mt-1">{errors.phoneNumber}</p>}
            </div>

            {/* Shipping address */}
            <div className="col-span-12 md:col-span-8 row-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Shipping Address <span style={{ color: ACCENT }}>*</span></p>
              <textarea
                value={form.shippingAddress}
                onChange={(e) => sf('shippingAddress', e.target.value)}
                placeholder="Full delivery address…"
                rows={3}
                className={inputCls + ' resize-none ' + (errors.shippingAddress ? 'border-red-300' : '')}
              />
              {errors.shippingAddress && <p className="text-red-400 text-[11px] mt-1">{errors.shippingAddress}</p>}
            </div>

            {/* Date */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Date <span style={{ color: ACCENT }}>*</span></p>
              <input type="date" value={form.date} onChange={(e) => sf('date', e.target.value)} className={inputCls} />
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
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Due Date</p>
              <input type="date" value={form.dueDate} onChange={(e) => sf('dueDate', e.target.value)} className={inputCls} />
            </div>

            {/* Credit Limit */}
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

            {/* Payment Type */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Payment Type <span style={{ color: ACCENT }}>*</span></p>
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

        {/* ── Products Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div>
              <p className="text-[12.5px] font-bold text-gray-700">Products Details</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Select a location per product row</p>
            </div>
            {loadingProducts && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Spinner /> loading catalogue…
              </span>
            )}
          </div>

          {/* Inline errors */}
          {errors.items && <p className="text-red-400 text-[11px] px-5 pt-3">{errors.items}</p>}
          {Object.keys(errors)
            .filter((k) => k.startsWith('stock_'))
            .map((k) => (
              <p key={k} className="text-red-400 text-[11px] px-5 pt-1">⚠ {errors[k]}</p>
            ))}

          <div className="overflow-x-auto" style={{ overflowY: 'visible' }}>
            <table className="w-full border-collapse" style={{ minWidth: 1180 }}>
              <thead>
                <tr style={{ background: ACCENT }}>
                  {[
                    { label: 'Product',     align: 'left'  },
                    { label: 'Location',    align: 'left'  },   // ← new column
                    { label: 'Description',align: 'left'  },
                    { label: 'Unit',        align: 'left'  },
                    { label: 'Qty',         align: 'right' },
                    { label: 'Rate',        align: 'right' },
                    { label: 'Amount',      align: 'right' },
                    { label: 'Discount',    align: 'right' },
                    { label: 'Disc. Calc.', align: 'right' },
                    { label: 'TO/Unit',     align: 'right' },
                    { label: 'TO Calc.',    align: 'right' },
                    { label: 'Net',         align: 'right' },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      className={`text-[10.5px] font-bold text-white uppercase tracking-wide px-2 py-3.5 text-${align}`}
                    >
                      {label}
                    </th>
                  ))}
                  <th className="px-2 py-3.5" style={{ width: 40 }} />
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
                    cities={cities}
                    onPick={pickProduct}
                    onChange={changeRow}
                    onRemove={removeRow}
                    canRemove={rows.length > 1}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-100">
                  <td colSpan={4} className="px-2 py-3 text-[12px] font-bold text-gray-500">Total</td>
                  <td className="px-1 py-3 text-right text-[12px] font-bold text-gray-700">
                    {activeRows.reduce((s, r) => s + Number(r.qty), 0)}
                  </td>
                  <td />
                  <td className="px-2 py-3 text-right text-[12px] font-bold text-gray-700">{fmt(subTotal)}</td>
                  <td />
                  <td className="px-2 py-3 text-right text-[12px] font-bold text-amber-500">{fmt(totalDiscount)}</td>
                  <td />
                  <td className="px-2 py-3 text-right text-[12px] font-bold text-emerald-600">
                    +{activeRows.reduce((s, r) => {
                      const tu = Number(r.toUnit) || 0;
                      return s + (tu > 0 ? Math.floor(r.qty / tu) : 0);
                    }, 0)}
                  </td>
                  <td className="px-2 py-3 text-right text-[13px] font-bold" style={{ color: ACCENT }}>
                    {fmt(grandTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="py-3 px-5 border-t border-gray-100">
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Coupon Code</p>
                <input
                  value={form.couponCode}
                  onChange={(e) => sf('couponCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE10"
                  className={inputCls + ' font-mono tracking-wider'}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Deduction (Rs.)</p>
                <input
                  type="number" min="0" step="0.01"
                  value={form.deduction}
                  onChange={(e) => sf('deduction', Number(e.target.value))}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
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
                {deductionAmt > 0 && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-500">Deduction</span>
                    <span className="font-semibold text-gray-700">- Rs. {fmt(deductionAmt)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between px-5 py-4" style={{ background: ACCENT }}>
                <span className="text-[12px] font-bold uppercase tracking-wide text-white/80">Total</span>
                <span className="text-xl font-bold text-white">Rs. {fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
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
            {submitting ? <><Spinner /> Saving…</> : <><MdAdd size={16} /> Save Invoice</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddMultiInvoice;