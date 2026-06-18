import { useEffect, useState, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  MdClose, MdAdd, MdPerson, MdStore, MdLocationOn,
  MdPhone, MdShoppingBag, MdSearch, MdDelete,
  MdExpandMore, MdAttachMoney, MdCheckBox,
  MdCheckBoxOutlineBlank, MdInventory2, MdReceipt,
  MdLocalShipping, MdPayment,
} from 'react-icons/md';
import { Spinner } from '../components/common/spinner';
import { getAllRetailers, getAllSalesPersons } from '../APIS';
import { useSelector } from 'react-redux';
import { SERVER_URL } from '../utils';
import axios from 'axios';

const createOrder = async (data, token) =>
  axios.request({
    method: 'post',
    url: SERVER_URL + '/order/add',
    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });

/* ─── shared styles ─── */
const iBase =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none transition-all placeholder:text-gray-300 focus:bg-white focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10';
const sBase =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-9 text-sm text-gray-800 outline-none appearance-none cursor-pointer transition-all focus:bg-white focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10';

const FL = ({ children }) => (
  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{children}</p>
);

const Err = ({ msg }) => msg
  ? <p className="text-red-400 text-[11px] mt-1 flex items-center gap-1">⚠ {msg}</p>
  : null;

const Card = ({ children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
    {children}
  </div>
);

const CardHead = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/80 rounded-t-2xl">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,89,52,0.10)' }}>
      <Icon size={14} style={{ color: '#FF5934' }} />
    </div>
    <div>
      <p className="text-[12px] font-bold text-gray-700 leading-tight">{title}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Sel = ({ value, onChange, disabled, error, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={sBase + (error ? ' border-red-300 bg-red-50/20' : '')}
    >
      {children}
    </select>
    <MdExpandMore size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  </div>
);

/* ════════════════════════════════════════
   PRODUCT SEARCH DROPDOWN
════════════════════════════════════════ */
const ProductDropdown = ({ products, loading, items, onToggle }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
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
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.englishTitle?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.productId?.toLowerCase().includes(q)
    );
  }, [search, products]);

  const isSel = (id) => items.some(i => i.productId === id);
  const count = items.length;

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => { setOpen(p => !p); setTimeout(() => inputRef.current?.focus(), 40); }}
        className="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-2.5 cursor-pointer transition-all"
        style={open ? { background: '#fff', borderColor: '#FF5934', boxShadow: '0 0 0 3px rgba(255,89,52,0.10)' } : { borderColor: '#e5e7eb' }}
      >
        <MdSearch size={15} className="flex-shrink-0 text-gray-400" style={open ? { color: '#FF5934' } : {}} />
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onClick={e => e.stopPropagation()}
          placeholder={
            loading ? 'Loading products…'
            : count ? `${count} selected — search to add more`
            : 'Search by name or SKU…'
          }
          className="bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400 w-full"
          readOnly={loading}
        />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {search && (
            <button
              onClick={e => { e.stopPropagation(); setSearch(''); }}
              className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <MdClose size={9} className="text-gray-600" />
            </button>
          )}
          {count > 0 && !search && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
              style={{ color: '#FF5934', background: 'rgba(255,89,52,0.08)', borderColor: 'rgba(255,89,52,0.2)' }}
            >
              {count}
            </span>
          )}
          <MdExpandMore size={16} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Panel */}
      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl z-50 overflow-hidden flex flex-col"
          style={{ maxHeight: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
        >
          {/* panel header */}
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {loading ? 'Loading…' : `${filtered.length} / ${products.length} products`}
            </span>
            {count > 0 && (
              <span className="text-[10px] font-bold" style={{ color: '#FF5934' }}>{count} selected</span>
            )}
          </div>

          {/* list */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                <Spinner /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center">
                <MdShoppingBag size={22} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No products match "{search}"</p>
              </div>
            ) : filtered.map(p => {
              const sel = isSel(p._id);
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => onToggle(p)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 last:border-0 transition-colors group"
                  style={sel ? { background: 'rgba(255,89,52,0.05)' } : {}}
                  onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { if (!sel) e.currentTarget.style.background = ''; }}
                >
                  <div className="flex-shrink-0">
                    {sel
                      ? <MdCheckBox size={17} style={{ color: '#FF5934' }} />
                      : <MdCheckBoxOutlineBlank size={17} className="text-gray-300" />
                    }
                  </div>
                  {p.image
                    ? <img src={p.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                    : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MdShoppingBag size={12} className="text-gray-300" />
                      </div>
                  }
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold truncate" style={sel ? { color: '#FF5934' } : { color: '#1f2937' }}>
                      {p.englishTitle}
                    </p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">
                      Rs. {p.price?.toLocaleString()}
                      <span className="mx-1 opacity-30">·</span>
                      Stock: {p.stock ?? '—'}
                      {p.cortanSize > 1 && <><span className="mx-1 opacity-30">·</span>CTN: {p.cortanSize}pcs</>}
                    </p>
                  </div>
                  <span
                    className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide"
                    style={sel
                      ? { background: '#fef2f2', color: '#f87171', borderColor: '#fecaca' }
                      : { background: 'rgba(255,89,52,0.08)', color: '#FF5934', borderColor: 'rgba(255,89,52,0.2)' }
                    }
                  >
                    {sel ? 'Remove' : 'Add'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
            <span className="text-[10px] text-gray-400">Click to select or deselect</span>
            <button
              type="button"
              onClick={() => { setOpen(false); setSearch(''); }}
              className="text-[11px] font-bold transition-colors"
              style={{ color: '#FF5934' }}
            >
              Done ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   ITEM ROW
════════════════════════════════════════ */
const ItemRow = ({ item, idx, errors, onRemove, onUpdate }) => {
  const price = item.discountedPrice > 0 ? item.discountedPrice : item.price;
  const mult = item.type === 'ctn' ? item.cortanSize : 1;
  const subtotal = item.quantity * price * mult;

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        {item.productImage
          ? <img src={item.productImage} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
          : <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <MdShoppingBag size={13} className="text-gray-300" />
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-semibold text-gray-800 truncate">{item.productName}</p>
          <p className="text-[10px] text-gray-400">Stock: {item.stock ?? '—'} · CTN: {item.cortanSize}pcs</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.productId)}
          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center border border-red-100 transition-colors flex-shrink-0"
        >
          <MdDelete size={13} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 px-4 py-3">
        <div>
          <FL>Type</FL>
          <div className="relative">
            <select value={item.type} onChange={e => onUpdate(item.productId, 'type', e.target.value)} className={sBase + ' text-xs py-2'}>
              <option value="piece">PCS</option>
              <option value="ctn">CTN</option>
            </select>
            <MdExpandMore size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <FL>Qty</FL>
          <input type="number" min="1" value={item.quantity}
            onChange={e => onUpdate(item.productId, 'quantity', Number(e.target.value))}
            className={iBase + ' text-xs py-2' + (errors[`qty_${idx}`] ? ' border-red-300' : '')} />
        </div>
        <div>
          <FL>Price</FL>
          <input type="number" min="0" step="0.01" value={item.price}
            onChange={e => onUpdate(item.productId, 'price', Number(e.target.value))}
            className={iBase + ' text-xs py-2' + (errors[`price_${idx}`] ? ' border-red-300' : '')} />
        </div>
        <div>
          <FL>Disc. Price</FL>
          <input type="number" min="0" step="0.01" value={item.discountedPrice || ''}
            onChange={e => onUpdate(item.productId, 'discountedPrice', Number(e.target.value))}
            placeholder="0" className={iBase + ' text-xs py-2'} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-3">
        <span className="text-[10px] text-gray-400">
          {item.type === 'ctn' && item.cortanSize > 1 && `${item.quantity} × ${item.cortanSize}pcs × Rs.${price}`}
        </span>
        <span className="text-[13px] font-bold" style={{ color: '#FF5934' }}>Rs. {subtotal.toLocaleString()}</span>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN MODAL
════════════════════════════════════════ */
const AddOrderModal = ({ onClose, onSuccess, cities = [], salesPersons = [] }) => {
  const token = useSelector(s => s.admin.token);

  const [retailers, setRetailers]             = useState([]);
  const [products, setProducts]               = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSP, setLoadingSP]             = useState(false);
  const [allSP, setAllSP]                     = useState(salesPersons);
  const [submitting, setSubmitting]           = useState(false);
  const [errors, setErrors]                   = useState({});
  const [items, setItems]                     = useState([]);

  const [form, setForm] = useState({
    RetailerUser: '', SaleUser: '', shippingAddress: '',
    phoneNumber: '', city: '', paymentType: 'cod', couponCode: '',
  });
  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    getAllRetailers()
      .then(r => setRetailers(r.data?.data || r.data || []))
      .catch(e => console.error('Retailers:', e));

    setLoadingProducts(true);
    axios.get(SERVER_URL + '/product/', { headers: { 'x-auth-token': token } })
      .then(r => { const l = r.data?.data || r.data || []; setProducts(Array.isArray(l) ? l : []); })
      .catch(e => { console.error('Products:', e); toast.error('Failed to load products'); })
      .finally(() => setLoadingProducts(false));

    if (!salesPersons.length) {
      setLoadingSP(true);
      getAllSalesPersons()
        .then(r => setAllSP(r.data?.data || []))
        .catch(e => console.error('SP:', e))
        .finally(() => setLoadingSP(false));
    }
  }, []);

  useEffect(() => {
    if (!form.RetailerUser) return;
    const r = retailers.find(r => r._id === form.RetailerUser);
    if (r?.phone) sf('phoneNumber', r.phone);
  }, [form.RetailerUser, retailers]);

  const toggleProduct = (product) => {
    setItems(prev =>
      prev.some(i => i.productId === product._id)
        ? prev.filter(i => i.productId !== product._id)
        : [...prev, {
            productId: product._id, productName: product.englishTitle,
            productImage: product.image, price: product.price || 0,
            discountedPrice: 0, quantity: 1, type: 'piece',
            stock: product.stock || 0, cortanSize: product.cortanSize || 1,
          }]
    );
  };

  const removeItem = (id) => setItems(p => p.filter(i => i.productId !== id));
  const updateItem = (id, k, v) => setItems(p => p.map(i => i.productId === id ? { ...i, [k]: v } : i));

  const total = useMemo(() =>
    items.reduce((s, i) =>
      s + i.quantity * (i.discountedPrice > 0 ? i.discountedPrice : i.price) * (i.type === 'ctn' ? i.cortanSize : 1), 0),
  [items]);

  const validate = () => {
    const e = {};
    if (!form.RetailerUser)    e.RetailerUser    = 'Customer is required';
    if (!form.SaleUser)        e.SaleUser        = 'Sales person is required';
    if (!form.shippingAddress) e.shippingAddress = 'Shipping address is required';
    if (!form.phoneNumber)     e.phoneNumber     = 'Phone number is required';
    if (!form.city)            e.city            = 'City is required';
    if (!items.length)         e.items           = 'Add at least one product';
    items.forEach((item, idx) => {
      if (!item.quantity || item.quantity < 1) e[`qty_${idx}`]   = true;
      if (item.price < 0)                      e[`price_${idx}`] = true;
    });
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      await createOrder({
        RetailerUser: form.RetailerUser, SaleUser: form.SaleUser,
        shippingAddress: form.shippingAddress, phoneNumber: form.phoneNumber,
        city: form.city, paymentType: form.paymentType,
        ...(form.couponCode && { couponCode: form.couponCode }),
        items: items.map(i => ({
          productId: i.productId, quantity: Number(i.quantity),
          price: Number(i.price), type: i.type,
          ...(i.discountedPrice > 0 && { discountedPrice: Number(i.discountedPrice) }),
        })),
      }, token);
      toast.success('Order created successfully.');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.errors || err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        className="bg-white w-full max-w-[580px] max-h-[92vh] rounded-3xl flex flex-col overflow-hidden"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >

        {/* HEADER */}
        <div
          className="relative flex-shrink-0 px-6 pt-5 pb-9 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #FF5934 0%, #ff7a55 100%)' }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-white" style={{ borderRadius: '60% 60% 0 0', transform: 'scaleX(1.05)' }} />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <MdReceipt size={11} className="text-white/60" />
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">New Order</p>
              </div>
              <h2 className="text-white text-xl font-bold tracking-tight">Add Order Manually</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
            >
              <MdClose size={15} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="overflow-y-auto flex-1 bg-gray-50/60 px-5 pt-5 pb-5 flex flex-col gap-4">

          {/* Customer & Sales */}
          <Card>
            <CardHead icon={MdStore} title="Customer & Sales" sub="Who placed this order" />
            <div className="p-5 flex flex-col gap-4">
              <div>
                <FL>Customer (retailer) *</FL>
                <Sel value={form.RetailerUser} onChange={e => sf('RetailerUser', e.target.value)} error={errors.RetailerUser}>
                  <option value="">Select customer…</option>
                  {retailers.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </Sel>
                <Err msg={errors.RetailerUser} />
              </div>
              <div>
                <FL>Sales person *</FL>
                <Sel value={form.SaleUser} onChange={e => sf('SaleUser', e.target.value)} disabled={loadingSP} error={errors.SaleUser}>
                  <option value="">{loadingSP ? 'Loading…' : 'Select sales person…'}</option>
                  {allSP.map(sp => <option key={sp._id} value={sp._id}>{sp.name}</option>)}
                </Sel>
                <Err msg={errors.SaleUser} />
              </div>
            </div>
          </Card>

          {/* Delivery Info */}
          <Card>
            <CardHead icon={MdLocalShipping} title="Delivery Info" sub="Where to ship this order" />
            <div className="p-5 flex flex-col gap-4">
              <div>
                <FL>Phone number *</FL>
                <div className="relative">
                  <MdPhone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={form.phoneNumber}
                    onChange={e => sf('phoneNumber', e.target.value)}
                    placeholder="03XX-XXXXXXX"
                    className={iBase + ' pl-9 ' + (errors.phoneNumber ? 'border-red-300' : '')}
                  />
                </div>
                <Err msg={errors.phoneNumber} />
              </div>
              <div>
                <FL>City / site *</FL>
                <Sel value={form.city} onChange={e => sf('city', e.target.value)} error={errors.city}>
                  <option value="">Select city…</option>
                  {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Sel>
                <Err msg={errors.city} />
              </div>
              <div>
                <FL>Shipping address *</FL>
                <textarea
                  value={form.shippingAddress}
                  onChange={e => sf('shippingAddress', e.target.value)}
                  placeholder="Full delivery address…"
                  rows={2}
                  className={iBase + ' resize-none ' + (errors.shippingAddress ? 'border-red-300' : '')}
                />
                <Err msg={errors.shippingAddress} />
              </div>
              <div>
                <FL>Payment type *</FL>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'cod',           l: 'Cash on Delivery' },
                    { v: 'bank_transfer', l: 'Bank Transfer'    },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => sf('paymentType', opt.v)}
                      className="h-11 rounded-xl border text-[12.5px] font-semibold flex items-center justify-center gap-2 transition-all"
                      style={form.paymentType === opt.v
                        ? { background: '#FF5934', borderColor: '#FF5934', color: '#fff', boxShadow: '0 4px 12px rgba(255,89,52,0.30)' }
                        : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#4b5563' }
                      }
                    >
                      <MdPayment size={15} />
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHead
              icon={MdInventory2}
              title="Order Items"
              sub={items.length ? `${items.length} product${items.length !== 1 ? 's' : ''} selected` : 'Search and select products'}
            />
            <div className="p-5 flex flex-col gap-4">
              <ProductDropdown products={products} loading={loadingProducts} items={items} onToggle={toggleProduct} />
              <Err msg={errors.items} />

              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-gray-100 rounded-2xl text-center">
                  <div className="w-11 h-11 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <MdShoppingBag size={18} className="text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">No products added yet</p>
                  <p className="text-[11px] text-gray-400">Use the search above to find and add products</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {items.map((item, idx) => (
                    <ItemRow key={item.productId} item={item} idx={idx} errors={errors} onRemove={removeItem} onUpdate={updateItem} />
                  ))}
                  <div className="flex items-center justify-between rounded-2xl px-5 py-4" style={{ background: '#FF5934' }}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.7)' }}>Estimated Total</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-white text-xl font-bold">Rs. {total.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Optional */}
          <Card>
            <CardHead icon={MdAttachMoney} title="Optional" sub="Coupon or promo code" />
            <div className="p-5">
              <div className="relative">
                <MdAttachMoney size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={form.couponCode}
                  onChange={e => sf('couponCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE10"
                  className={iBase + ' pl-9 font-mono tracking-wider'}
                />
              </div>
            </div>
          </Card>

        </div>

        {/* FOOTER */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 rounded-xl text-white text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ flex: 2, background: '#FF5934', boxShadow: '0 4px 16px rgba(255,89,52,0.35)' }}
          >
            {submitting
              ? <><Spinner /><span>Creating…</span></>
              : <><MdAdd size={16} /><span>Create Order</span></>
            }
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddOrderModal;