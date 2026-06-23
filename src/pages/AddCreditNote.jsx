import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  MdArrowBack, MdAdd, MdDelete, MdSearch, MdExpandMore,
  MdShoppingBag,
} from 'react-icons/md';
import { Spinner } from '../components/common/spinner';
import { getAllRetailers, getAllSalesPersons, getAllCities, updateProduct, createCreditNote } from '../APIS';
import { useSelector } from 'react-redux';
import { SERVER_URL } from '../utils';
import axios from 'axios';

const ACCENT = '#FF5934';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays  = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
};
const fmt = (n) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10';
const selectCls  = inputCls + ' pr-8 appearance-none cursor-pointer';
const cellInputCls =
  'w-full bg-transparent text-[13.5px] text-gray-800 outline-none text-right px-1.5 py-3 rounded focus:bg-[#FF5934]/5 focus:ring-1 focus:ring-[#FF5934]/30';

/* ════════════════════════════════════════
   PRODUCT PICKER  (portal — never clipped)
════════════════════════════════════════ */
const ProductPickerCell = ({ products, loading, value, onPick }) => {
  const [open, setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 320 });
  const wrapRef           = useRef(null);
  const inputRef          = useRef(null);

  /* close on outside click */
  useEffect(() => {
    const fn = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        !document.getElementById('pp-portal')?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const openDropdown = () => {
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: Math.max(r.width, 320) });
    }
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products.filter(p =>
      p.englishTitle?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.productId?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search, products]);

  const portal = open && createPortal(
    <div
      id="pp-portal"
      style={{
        position:  'absolute',
        top:       pos.top,
        left:      pos.left,
        width:     pos.width,
        maxHeight: 280,
        zIndex:    9999,
        boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
      }}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
    >
      {/* search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <MdSearch size={14} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="bg-transparent outline-none text-[13px] w-full placeholder:text-gray-400"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
        )}
      </div>

      {/* list */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm"><Spinner /> Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No products found</div>
        ) : filtered.map(p => (
          <button
            key={p._id}
            type="button"
            onClick={() => { onPick(p); setOpen(false); setSearch(''); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#FF5934]/5 transition-colors border-b border-gray-50 last:border-0"
          >
            {p.image
              ? <img src={p.image} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0 border border-gray-100" />
              : <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><MdShoppingBag size={11} className="text-gray-300" /></div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-gray-800 truncate">{p.englishTitle}</p>
              <p className="text-[10.5px] text-gray-400">
                Rs.{p.price?.toLocaleString()} · Stock: {p.stock ?? '—'} · CTN: {p.cortanSize || 1}
              </p>
            </div>
          </button>
        ))}
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
            {value.productImage
              ? <img src={value.productImage} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-100" />
              : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0"><MdShoppingBag size={13} className="text-gray-300" /></div>
            }
            <span className="text-[13.5px] text-gray-800 font-medium truncate">{value.productName}</span>
          </>
        ) : (
          <span className="text-[13.5px] text-gray-300">Select product…</span>
        )}
        <MdExpandMore size={14} className="text-gray-300 ml-auto flex-shrink-0" />
      </div>
      {portal}
    </div>
  );
};

/* ════════════════════════════════════════
   DISCOUNT CELL (percent ⇄ flat toggle)
════════════════════════════════════════ */
const DiscountCell = ({ row, idx, onChange, grossAmount }) => {
  const isPercent   = row.discType === 'percent';
  const discountAmt = isPercent ? grossAmount * (row.discPercent / 100) : Number(row.discAmount) || 0;

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
            type="number" min="0" max="100" step="0.1" value={row.discPercent}
            onChange={e => onChange(idx, 'discPercent', Number(e.target.value))}
            className={cellInputCls}
          />
        ) : (
          <input
            type="number" min="0" step="0.01" value={row.discAmount}
            onChange={e => onChange(idx, 'discAmount', Number(e.target.value))}
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
   LINE ITEM ROW  — with CTN/PCS formula
════════════════════════════════════════ */
const LineRow = ({ row, idx, products, loadingProducts, onPick, onChange, onRemove, canRemove }) => {
  const grossAmount = row.qty * row.rate;
  // ── discount can be a % of gross amount, or a flat Rs. amount ──
  const discountAmt = row.discType === 'percent'
    ? grossAmount * (row.discPercent / 100)
    : Number(row.discAmount) || 0;
  const net = Math.max(grossAmount - discountAmt, 0);

  /* ── CTN size helper for display ── */
  const cortanSize  = row.product?.cortanSize || 1;
  const totalPcs    = row.unit === 'ctn' ? row.qty * cortanSize : row.qty;
  const pcsLabel    = row.unit === 'ctn'
    ? `${row.qty} CTN × ${cortanSize} = ${totalPcs} PCS`
    : `${row.qty} PCS`;

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors group">

      {/* Product */}
      <td className="py-1 px-2 align-middle" style={{ minWidth: 230 }}>
        <ProductPickerCell
          products={products}
          loading={loadingProducts}
          value={row.product}
          onPick={p => onPick(idx, p)}
        />
      </td>

      {/* Description */}
      <td className="py-1 px-2 align-middle" style={{ minWidth: 130 }}>
        <input
          value={row.description}
          onChange={e => onChange(idx, 'description', e.target.value)}
          placeholder="Note…"
          className="w-full bg-transparent text-[13px] text-gray-600 outline-none px-1.5 py-3 rounded focus:bg-gray-50"
        />
      </td>

      {/* Unit  — triggers rate recalc */}
      <td className="py-1 px-2 align-middle" style={{ minWidth: 80 }}>
        <select
          value={row.unit}
          onChange={e => onChange(idx, 'unit', e.target.value)}
          className="w-full bg-transparent text-[13px] text-gray-700 outline-none cursor-pointer px-1.5 py-3 rounded focus:bg-gray-50"
        >
          <option value="piece">PCS</option>
          <option value="ctn">CTN</option>
        </select>
      </td>

      {/* Qty */}
      <td className="py-1 px-1 align-middle" style={{ width: 72 }}>
        <input
          type="number" min="1" value={row.qty}
          onChange={e => onChange(idx, 'qty', Number(e.target.value))}
          className={cellInputCls}
        />
      </td>

      {/* Rate */}
      <td className="py-1 px-1 align-middle" style={{ width: 92 }}>
        <input
          type="number" min="0" step="0.01" value={row.rate}
          onChange={e => onChange(idx, 'rate', Number(e.target.value))}
          className={cellInputCls}
        />
        {/* show per-piece rate when CTN selected */}
        {row.unit === 'ctn' && row.product && (
          <p className="text-[9.5px] text-gray-400 text-right pr-1 -mt-1 pb-1">
            Rs.{(row.rate / cortanSize).toFixed(2)}/PCS
          </p>
        )}
      </td>

      {/* Amount */}
      <td className="py-1 px-2 align-middle text-right text-[13.5px] text-gray-700" style={{ width: 90 }}>
        {fmt(grossAmount)}
      </td>

      {/* Discount — % or flat, toggleable */}
      <td className="py-1 px-1 align-middle" style={{ width: 120 }}>
        <DiscountCell row={row} idx={idx} onChange={onChange} grossAmount={grossAmount} />
      </td>

      {/* Net */}
      <td className="py-1 px-2 align-middle" style={{ width: 110 }}>
        <p className="text-right text-[14px] font-bold" style={{ color: ACCENT }}>{fmt(net)}</p>
        {/* PCS breakdown */}
        {row.product && (
          <p className="text-[9.5px] text-gray-400 text-right leading-tight">{pcsLabel}</p>
        )}
      </td>

      {/* Remove */}
      <td className="py-1 px-2 align-middle text-center" style={{ width: 40 }}>
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
  product: null, description: '', unit: 'piece',
  qty: 1, rate: 0, discType: 'percent', discPercent: 0, discAmount: 0,
});

/* ════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════ */
const AddCreditNote = () => {
  const navigate = useNavigate();
  const token    = useSelector(s => s.admin.token);

  const [retailers, setRetailers]             = useState([]);
  const [products, setProducts]               = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSP, setLoadingSP]             = useState(false);
  const [salesPersons, setSalesPersons]       = useState([]);
  const [cities, setCities]                   = useState([]);
  const [submitting, setSubmitting]           = useState(false);
  const [errors, setErrors]                   = useState({});

  const [form, setForm] = useState({
    RetailerUser: '', SaleUser: '', city: '', phoneNumber: '',
    shippingAddress: '', paymentType: 'cod', couponCode: '', deduction: 0,
    date: todayISO(), termDays: 0, dueDate: todayISO(),
  });
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [rows, setRows] = useState([emptyRow()]);

  /* ── load data ── */
  const reloadProducts = () => {
    setLoadingProducts(true);
    return axios
      .get(SERVER_URL + '/product/', { headers: { 'x-auth-token': token } })
      .then(r => {
        const list = Array.isArray(r.data?.data) ? r.data.data : Array.isArray(r.data) ? r.data : [];
        setProducts(list);
        return list;
      })
      .catch(e => { console.error('Products:', e); toast.error('Failed to load products'); return []; })
      .finally(() => setLoadingProducts(false));
  };

  useEffect(() => {
    getAllRetailers().then(r => setRetailers(r.data?.data || r.data || [])).catch(console.error);
    reloadProducts();
    setLoadingSP(true);
    getAllSalesPersons().then(r => setSalesPersons(r.data?.data || [])).catch(console.error).finally(() => setLoadingSP(false));
    getAllCities().then(r => { const l = r.data?.data || r.data || []; setCities(Array.isArray(l) ? l : []); }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!form.RetailerUser) return;
    const r = retailers.find(r => r._id === form.RetailerUser);
    if (!r) return;
    const address = [r.shopAddress1, r.shopAddress2].filter(Boolean).filter(a => a !== 'N/A').join(', ');
    setForm(p => ({
      ...p,
      phoneNumber:     r.phoneNumber      || p.phoneNumber,
      shippingAddress: address            || p.shippingAddress,
      city:            r.cityID?._id      || p.city,
      SaleUser:        r.salesPersonID?._id || p.SaleUser,
    }));
  }, [form.RetailerUser, retailers]);

  useEffect(() => { sf('dueDate', addDays(form.date, form.termDays)); }, [form.date, form.termDays]);

  const selectedRetailer = retailers.find(r => r._id === form.RetailerUser);

  /* ── row helpers — CTN/PCS rate recalculation ── */
  const pickProduct = (idx, p) => {
    setRows(prev => {
      const cortanSize    = p.cortanSize || 1;
      const piecePrice    = p.price || 0;
      const updated = prev.map((row, i) => {
        if (i !== idx) return row;
        /* rate depends on current unit selection */
        const rate = row.unit === 'ctn' ? piecePrice * cortanSize : piecePrice;
        return {
          ...row,
          product: {
            productId:      p._id,
            productName:    p.englishTitle,
            productImage:   p.image,
            stock:          p.stock,
            cortanSize,
            basePiecePrice: piecePrice,
          },
          rate,
        };
      });
      /* auto-add blank row when filling the last row */
      return idx === prev.length - 1 ? [...updated, emptyRow()] : updated;
    });
  };

  const changeRow = (idx, key, val) =>
    setRows(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [key]: val };
      /* when unit changes → recalculate rate from stored basePiecePrice */
      if (key === 'unit' && updated.product) {
        const piecePrice = updated.product.basePiecePrice ?? updated.rate;
        const cortanSize = updated.product.cortanSize || 1;
        updated.rate     = val === 'ctn' ? piecePrice * cortanSize : piecePrice;
      }
      return updated;
    }));

  const removeRow = (idx) =>
    setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  /* ── totals ── */
  const activeRows    = rows.filter(r => r.product);
  const subTotal      = activeRows.reduce((s, r) => s + r.qty * r.rate, 0);
  // ── discount per row can be % of gross, or a flat Rs. amount ──
  const totalDiscount = activeRows.reduce((s, r) => {
    const gross = r.qty * r.rate;
    return s + (r.discType === 'percent' ? gross * (r.discPercent / 100) : Number(r.discAmount) || 0);
  }, 0);
  const deductionAmt = Number(form.deduction) || 0;
  const grandTotal = Math.max(subTotal - totalDiscount - deductionAmt, 0);

  /* summary for footer */
  const totalQty    = activeRows.reduce((s, r) => s + Number(r.qty), 0);
  const totalPcsAll = activeRows.reduce((s, r) => {
    const pcs = r.unit === 'ctn' ? r.qty * (r.product?.cortanSize || 1) : r.qty;
    return s + pcs;
  }, 0);

  /* ── validate ── */
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

  /* ── increase stock (credit note = return) ── */
  const increaseStock = async (returnedRows, freshProducts) => {
    const productList = freshProducts?.length ? freshProducts : products;
    await Promise.allSettled(
      returnedRows.map(async r => {
        const unitsReturned = r.unit === 'ctn' ? r.qty * (r.product.cortanSize || 1) : r.qty;
        const matched       = productList.find(p => p._id === r.product.productId);
        if (!matched) return;
        return updateProduct(
          {
            ...matched, id: matched._id,
            stock:      (matched.stock ?? 0) + unitsReturned,
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
      const freshProducts = await reloadProducts();

      const payload = {
        RetailerUser:    form.RetailerUser,
        SaleUser:        form.SaleUser,
        shippingAddress: form.shippingAddress,
        phoneNumber:     form.phoneNumber,
        city:            form.city,
        paymentType:     form.paymentType,
        date:            form.date,
        termDays:        form.termDays,
        dueDate:         form.dueDate,
        ...(form.couponCode && { coupon: form.couponCode }),
        ...(deductionAmt > 0 && { deduction: deductionAmt }),
        items: activeRows.map(r => {
          const gross          = r.qty * r.rate;
          // ── discount can be % of gross, or a flat Rs. amount ──
          const discAmt        = r.discType === 'percent' ? gross * (r.discPercent / 100) : Number(r.discAmount) || 0;
          const net            = Math.max(gross - discAmt, 0);
          const effectivePrice = r.qty ? net / r.qty : r.rate;
          return {
            productId:       r.product.productId,
            quantity:        Number(r.qty),
            price:           Number(r.rate),
            type:            r.unit,
            description:     r.description,
            discType:        r.discType,
            discPercent:     r.discPercent,
            discAmount:      discAmt,
            grossAmount:     gross,
            netAmount:       net,
            ...(discAmt > 0 && { discountedPrice: Number(effectivePrice.toFixed(2)) }),
          };
        }),
      };

      await createCreditNote(payload, token);
      await increaseStock(activeRows, freshProducts);

      toast.success('Credit note created successfully!');
      navigate('/Sales/Invoices');
    } catch (err) {
      console.error('Credit note error:', err);
      toast.error(
        err.response?.data?.errors?.[0]?.msg ||
        err.response?.data?.error            ||
        err.response?.data?.msg              ||
        err.message                          ||
        'Failed to create credit note'
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ════ RENDER ════ */
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-500 transition-colors">
              <MdArrowBack size={17} />
            </button>
            <div>
              <p className="text-[11px] text-gray-400 font-medium">Sales / Orders</p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Add Credit Note</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* <button onClick={() => navigate(-1)}
              className="h-10 px-5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="h-10 px-6 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-60"
              style={{ background: ACCENT, boxShadow: `0 4px 14px ${ACCENT}55` }}>
              {submitting ? <><Spinner /> Saving…</> : <><MdAdd size={16} /> Save Credit Note</>}
            </button> */}
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
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Customer <span style={{ color: ACCENT }}>*</span></p>
              <div className="relative">
                <select value={form.RetailerUser} onChange={e => sf('RetailerUser', e.target.value)}
                  className={selectCls + (errors.RetailerUser ? ' border-red-300' : '')}>
                  <option value="">Select…</option>
                  {retailers.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.RetailerUser && <p className="text-red-400 text-[11px] mt-1">{errors.RetailerUser}</p>}
            </div>

            {/* Sales Person */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Sales Person <span style={{ color: ACCENT }}>*</span></p>
              <div className="relative">
                <select value={form.SaleUser} onChange={e => sf('SaleUser', e.target.value)} disabled={loadingSP}
                  className={selectCls + (errors.SaleUser ? ' border-red-300' : '')}>
                  <option value="">{loadingSP ? 'Loading…' : 'Select…'}</option>
                  {salesPersons.map(sp => <option key={sp._id} value={sp._id}>{sp.name}</option>)}
                  {selectedRetailer?.salesPersonID &&
                    !salesPersons.some(sp => sp._id === selectedRetailer.salesPersonID._id) && (
                      <option value={selectedRetailer.salesPersonID._id}>{selectedRetailer.salesPersonID.name}</option>
                    )}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.SaleUser && <p className="text-red-400 text-[11px] mt-1">{errors.SaleUser}</p>}
            </div>

            {/* City */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Location / Site <span style={{ color: ACCENT }}>*</span></p>
              <div className="relative">
                <select value={form.city} onChange={e => sf('city', e.target.value)}
                  className={selectCls + (errors.city ? ' border-red-300' : '')}>
                  <option value="">Select…</option>
                  {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <MdExpandMore size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {errors.city && <p className="text-red-400 text-[11px] mt-1">{errors.city}</p>}
            </div>

            {/* Phone */}
            <div className="col-span-12 md:col-span-4">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Phone Number <span style={{ color: ACCENT }}>*</span></p>
              <input value={form.phoneNumber} onChange={e => sf('phoneNumber', e.target.value)}
                placeholder="03XX-XXXXXXX"
                className={inputCls + (errors.phoneNumber ? ' border-red-300' : '')} />
              {errors.phoneNumber && <p className="text-red-400 text-[11px] mt-1">{errors.phoneNumber}</p>}
            </div>

            {/* Address */}
            <div className="col-span-12 md:col-span-8 row-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Shipping Address <span style={{ color: ACCENT }}>*</span></p>
              <textarea value={form.shippingAddress} onChange={e => sf('shippingAddress', e.target.value)}
                placeholder="Full delivery address…" rows={3}
                className={inputCls + ' resize-none ' + (errors.shippingAddress ? 'border-red-300' : '')} />
              {errors.shippingAddress && <p className="text-red-400 text-[11px] mt-1">{errors.shippingAddress}</p>}
            </div>

            {/* Date */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Date <span style={{ color: ACCENT }}>*</span></p>
              <input type="date" value={form.date} onChange={e => sf('date', e.target.value)} className={inputCls} />
            </div>

            {/* Term Days */}
            <div className="col-span-6 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Term Days</p>
              <input type="number" min="0" value={form.termDays} onChange={e => sf('termDays', Number(e.target.value))} className={inputCls} />
            </div>

            {/* Due Date */}
            <div className="col-span-12 md:col-span-2">
              <p className="text-[11px] font-semibold text-gray-500 mb-1">Due Date <span style={{ color: ACCENT }}>*</span></p>
              <input type="date" value={form.dueDate} onChange={e => sf('dueDate', e.target.value)} className={inputCls} />
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
                {[{ v: 'cod', l: 'Cash on Delivery' }, { v: 'bank_transfer', l: 'Bank Transfer' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => sf('paymentType', opt.v)}
                    className="h-9 rounded-lg border text-[12px] font-semibold transition-all"
                    style={form.paymentType === opt.v
                      ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
                      : { background: '#fff', borderColor: '#e5e7eb', color: '#4b5563' }}>
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
            <p className="text-[12.5px] font-bold text-gray-700">Products Details</p>
            {loadingProducts && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5"><Spinner /> loading catalogue…</span>
            )}
          </div>

          {errors.items && <p className="text-red-400 text-[11px] px-5 pt-3">{errors.items}</p>}

          {/* ── overflow-x-auto only; portal handles dropdown clipping ── */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 980 }}>
              <thead>
                <tr style={{ background: ACCENT }}>
                  {[
                    { label: 'Product',     align: 'left'  },
                    { label: 'Description', align: 'left'  },
                    { label: 'Unit',        align: 'left'  },
                    { label: 'Qty',         align: 'right' },
                    { label: 'Rate',        align: 'right' },
                    { label: 'Amount',      align: 'right' },
                    { label: 'Discount',    align: 'right' },
                    { label: 'Net / PCS',   align: 'right' },
                    { label: '',            align: 'center'},
                  ].map(({ label, align }) => (
                    <th key={label}
                      className={`text-[10.5px] font-bold text-white uppercase tracking-wide px-2 py-3.5 text-${align}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, idx) => (
                  <LineRow
                    key={idx}
                    row={row} idx={idx}
                    products={products} loadingProducts={loadingProducts}
                    onPick={pickProduct} onChange={changeRow} onRemove={removeRow}
                    canRemove={rows.length > 1}
                  />
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                  <td colSpan={3} className="px-2 py-3 text-[12px] font-bold text-gray-500">
                    Total — {activeRows.length} line{activeRows.length !== 1 ? 's' : ''}
                  </td>
                  {/* Qty */}
                  <td className="px-1 py-3 text-right text-[12px] font-bold text-gray-700">
                    {totalQty}
                    <p className="text-[9.5px] text-gray-400 font-normal">{totalPcsAll} PCS</p>
                  </td>
                  <td />
                  {/* Sub total */}
                  <td className="px-2 py-3 text-right text-[12px] font-bold text-gray-700">{fmt(subTotal)}</td>
                  {/* Total discount */}
                  <td className="px-2 py-3 text-right text-[12px] font-bold text-gray-700">{fmt(totalDiscount)}</td>
                  {/* Grand total */}
                  <td className="px-2 py-3 text-right text-[13px] font-bold" style={{ color: ACCENT }}>{fmt(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <button type="button" onClick={() => setRows(prev => [...prev, emptyRow()])}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors" style={{ color: ACCENT }}>
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
                <input value={form.couponCode} onChange={e => sf('couponCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE10" className={inputCls + ' font-mono tracking-wider'} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Deduction (Rs.)</p>
                <input type="number" min="0" step="0.01" value={form.deduction}
                  onChange={e => sf('deduction', Number(e.target.value))}
                  placeholder="0.00" className={inputCls} />
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

        {/* ── Bottom actions ── */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <button onClick={() => navigate(-1)}
            className="h-11 px-6 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="h-11 px-7 rounded-xl text-white text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-60"
            style={{ background: ACCENT, boxShadow: `0 4px 14px ${ACCENT}55` }}>
            {submitting ? <><Spinner /> Saving…</> : <><MdAdd size={16} /> Save Credit Note</>}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddCreditNote;