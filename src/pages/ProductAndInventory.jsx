import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getDatas, getSearchOrders, getAllCategories, getAllBrands, getAllCities } from '../APIS';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import {
  MdSearch, MdDownload, MdRefresh,
  MdLocationOn, MdCategory, MdBrandingWatermark, MdWarehouse,
  MdClose, MdLocalOffer, MdExpandMore, MdExpandLess, MdLogin,
  MdCalendarToday, MdPerson, MdPictureAsPdf, MdTableChart,
} from 'react-icons/md';
import * as XLSX from 'xlsx';

/* ─── helpers ─── */
const fmtNum = (n) => {
  const v = parseFloat(n);
  if (isNaN(v)) return '—';
  return v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtAmt = (n) => {
  const v = parseFloat(n);
  if (isNaN(v)) return '—';
  return `Rs. ${v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};
const isNeg = (n) => parseFloat(n) < 0;

const getStockStatus = (qty) => {
  const v = parseFloat(qty);
  if (isNaN(v) || v === 0) return 'Out of Stock';
  if (v < 0)  return 'Negative';
  if (v < 10) return 'Low Stock';
  return 'In Stock';
};
const statusStyle = (s) => {
  switch (s) {
    case 'In Stock':     return { pill: 'bg-emerald-50 text-emerald-600 ring-emerald-200', dot: 'bg-emerald-400' };
    case 'Low Stock':    return { pill: 'bg-amber-50 text-amber-600 ring-amber-200',       dot: 'bg-amber-400'   };
    case 'Out of Stock': return { pill: 'bg-gray-100 text-gray-400 ring-gray-200',         dot: 'bg-gray-300'    };
    case 'Negative':     return { pill: 'bg-red-50 text-red-500 ring-red-200',             dot: 'bg-red-400'     };
    default:             return { pill: 'bg-gray-100 text-gray-400 ring-gray-200',         dot: 'bg-gray-300'    };
  }
};

const resolveNameFrom = (field, list, key = 'englishName') => {
  if (!field) return '—';
  if (typeof field === 'object') return field[key] || field.englishName || field.name || '—';
  const found = list.find(i => i._id === field);
  return found ? (found[key] || found.englishName || found.name || field) : field;
};

/* ─────────────────────────────────────────────
   PER-ROW DOWNLOAD HELPERS
───────────────────────────────────────────── */
const downloadStockRowExcel = (p) => {
  const rows = [
    { Field: 'Code',       Value: p.productId    || '—' },
    { Field: 'Product',    Value: p.englishTitle  || '—' },
    { Field: 'Brand',      Value: p._brand        || '—' },
    { Field: 'Category',   Value: p._category     || '—' },
    { Field: 'PKT in CTN', Value: p._pktInCtn },
    { Field: 'Base Unit',  Value: 'Ctns' },
    { Field: 'Base Qty',   Value: parseFloat(p.stock || 0) },
    { Field: 'UM Unit',    Value: 'Ctns' },
    { Field: 'UM Qty',     Value: p._umQty },
    { Field: 'Status',     Value: p._status },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 42 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Stock Row');
  XLSX.writeFile(wb, `stock-${(p.productId || 'row').replace(/\//g, '-')}.xlsx`);
};

const downloadStockRowPDF = (p) => {
  const neg = p._umQty < 0;
  const qty = neg ? `(${fmtNum(Math.abs(p._umQty))})` : fmtNum(p._umQty);
  const baseQty = isNeg(p.stock) ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock);
  const statusColors = { 'In Stock': '#059669', 'Low Stock': '#D97706', 'Out of Stock': '#9CA3AF', 'Negative': '#DC2626' };
  const sc = statusColors[p._status] || '#9CA3AF';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Stock — ${p.productId || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 36px; color: #111827; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #FF5934; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 20px; font-weight: 700; color: #FF5934; }
  .report-type { font-size: 12px; color: #9CA3AF; margin-top: 3px; }
  .export-date { font-size: 11px; color: #9CA3AF; text-align:right; margin-top:4px; }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #F9FAFB; }
  td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #F3F4F6; }
  td:first-child { font-weight: 600; color: #6B7280; width: 36%; }
  .badge { display:inline-block; padding:3px 12px; border-radius:20px; font-size:12px; font-weight:700; color:${sc}; background:${sc}20; border: 1px solid ${sc}40; }
  .qty { font-size:15px; font-weight:700; color:${neg ? '#DC2626' : '#111827'}; }
  .code { font-family:monospace; font-size:13px; background:#F3F4F6; padding:2px 8px; border-radius:5px; }
  .footer { margin-top:28px; font-size:10px; color:#9CA3AF; text-align:right; border-top:1px solid #F3F4F6; padding-top:10px; }
  @media print { body { padding:20px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Karyana</div>
    <div class="report-type">Product Stock Report</div>
  </div>
  <div class="export-date">Exported<br>${new Date().toLocaleString('en-PK')}</div>
</div>
<table>
  <tr><td>Product Code</td><td><span class="code">${p.productId || '—'}</span></td></tr>
  <tr><td>Product Name</td><td style="font-weight:600">${p.englishTitle || '—'}</td></tr>
  <tr><td>Brand</td><td>${p._brand || '—'}</td></tr>
  <tr><td>Category</td><td>${p._category || '—'}</td></tr>
  <tr><td>PKT in CTN</td><td><span class="code">${p._pktInCtn}</span></td></tr>
  <tr><td>Base Unit</td><td>Ctns</td></tr>
  <tr><td>Base Qty</td><td class="qty">${baseQty}</td></tr>
  <tr><td>UM Unit</td><td>Ctns</td></tr>
  <tr><td>UM Qty (${p.stock} × ${p.cortanSize || 1})</td><td class="qty">${qty}</td></tr>
  <tr><td>Status</td><td><span class="badge">${p._status}</span></td></tr>
</table>
<div class="footer">Karyana &nbsp;·&nbsp; Product &amp; Inventory Report &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-PK')}</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
};

const downloadSalesRowExcel = (r) => {
  const rows = [
    { Field: 'Order ID',     Value: r.orderId     || '—' },
    { Field: 'Type',         Value: r.txnType     || '—' },
    { Field: 'Product Code', Value: r.productCode || '—' },
    { Field: 'Product Name', Value: r.productName || '—' },
    { Field: 'Brand',        Value: r.brand       || '—' },
    { Field: 'Category',     Value: r.category    || '—' },
    { Field: 'Salesperson',  Value: r.salesperson || '—' },
    { Field: 'Customer',     Value: r.customer    || '—' },
    { Field: 'Site',     Value: r.city        || '—' },
    { Field: 'Order Date',   Value: fmtDate(r.orderDate) },
    { Field: 'UM Unit',      Value: r.umUnit      || 'Ctns' },
    { Field: 'UM Qty',       Value: r.umQty },
    { Field: 'Unit Price',   Value: r.price },
    { Field: 'Net Amount',   Value: r.netAmt },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 16 }, { wch: 42 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sale Row');
  XLSX.writeFile(wb, `sale-${(r.productCode || r.orderId || 'row').replace(/\//g, '-')}.xlsx`);
};

const downloadSalesRowPDF = (r) => {
  const statusColors = {
    completed: '#059669', processed: '#2563EB', pending: '#D97706',
    cancelled: '#DC2626', canceled: '#DC2626', satelment: '#7C3AED',
  };
  const sc  = statusColors[(r.txnType || '').toLowerCase()] || '#6B7280';
  const neg = r.netAmt < 0;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sale — ${r.productCode || r.orderId || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; padding: 36px; color: #111827; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #FF5934; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 20px; font-weight: 700; color: #FF5934; }
  .report-type { font-size: 12px; color: #9CA3AF; margin-top: 3px; }
  .export-date { font-size: 11px; color: #9CA3AF; text-align:right; margin-top:4px; }
  .type-badge { display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:700; color:${sc}; background:${sc}20; border: 1px solid ${sc}40; }
  table { width: 100%; border-collapse: collapse; }
  tr:nth-child(even) td { background: #F9FAFB; }
  td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #F3F4F6; }
  td:first-child { font-weight: 600; color: #6B7280; width: 34%; }
  .code { font-family:monospace; font-size:13px; background:#F3F4F6; padding:2px 8px; border-radius:5px; }
  .order-id { font-family:monospace; font-size:11px; background:#F3F4F6; padding:2px 6px; border-radius:4px; }
  .net-amount { font-size:16px; font-weight:700; color:${neg ? '#DC2626' : '#111827'}; }
  .footer { margin-top:28px; font-size:10px; color:#9CA3AF; text-align:right; border-top:1px solid #F3F4F6; padding-top:10px; }
  @media print { body { padding:20px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Karyana</div>
    <div class="report-type">Product Sale Summary</div>
  </div>
  <div style="text-align:right">
    <span class="type-badge">${r.txnType || '—'}</span>
    <div class="export-date" style="margin-top:6px">${new Date().toLocaleString('en-PK')}</div>
  </div>
</div>
<table>
  <tr><td>Order ID</td><td><span class="order-id">${r.orderId || '—'}</span></td></tr>
  <tr><td>Product Code</td><td><span class="code">${r.productCode || '—'}</span></td></tr>
  <tr><td>Product Name</td><td style="font-weight:600">${r.productName || '—'}</td></tr>
  <tr><td>Brand</td><td>${r.brand || '—'}</td></tr>
  <tr><td>Category</td><td>${r.category || '—'}</td></tr>
  <tr><td>Salesperson</td><td>${r.salesperson || '—'}</td></tr>
  <tr><td>Customer</td><td>${r.customer || '—'}</td></tr>
  <tr><td>Site</td><td>${r.city || '—'}</td></tr>
  <tr><td>Order Date</td><td>${fmtDate(r.orderDate)}</td></tr>
  <tr><td>UM Unit</td><td>${r.umUnit || 'Ctns'}</td></tr>
  <tr><td>UM Quantity</td><td style="font-weight:700;font-size:15px">${fmtNum(r.umQty)}</td></tr>
  <tr><td>Unit Price</td><td>${fmtAmt(r.price)}</td></tr>
  <tr><td>Net Amount</td><td class="net-amount">${neg ? `(Rs. ${fmtNum(Math.abs(r.netAmt))})` : fmtAmt(r.netAmt)}</td></tr>
</table>
<div class="footer">Karyana &nbsp;·&nbsp; Product &amp; Inventory Report &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-PK')}</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
};

/* ════════════════════════════════════════
   ROW ACTIONS DROPDOWN
════════════════════════════════════════ */
const RowActions = ({ rowId, activeMenu, setMenu, onExcel, onPDF }) => {
  const open = activeMenu === rowId;
  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setMenu(open ? null : rowId)}
        title="Download row"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-[#9CA3AF] hover:text-[#FF5934] hover:bg-orange-50 border border-transparent hover:border-orange-100 transition-all"
      >
        <MdDownload size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-100 rounded-xl shadow-xl py-1 w-[152px]">
          <div className="px-3 py-1.5 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest border-b border-gray-50">Download as</div>
          <button
            onClick={() => { onExcel(); setMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-[#374151] hover:bg-[#FFF5F3] hover:text-[#FF5934] transition-colors"
          >
            <MdTableChart size={15} className="text-emerald-500 flex-shrink-0" /> Excel (.xlsx)
          </button>
          <button
            onClick={() => { onPDF(); setMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-[#374151] hover:bg-[#FFF5F3] hover:text-[#FF5934] transition-colors"
          >
            <MdPictureAsPdf size={15} className="text-red-400 flex-shrink-0" /> PDF (Print)
          </button>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ProductAndInventory = () => {
  const [activeTab, setActiveTab] = useState('stock');

  const [categories,   setCategories]   = useState([]);
  const [brands,       setBrands]       = useState([]);
  const [cities,       setCities]       = useState([]);
  const [lookupsReady, setLookupsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getAllCategories().then(r => setCategories(r.data.data || [])),
      getAllBrands()    .then(r => setBrands(r.data.data     || [])),
      getAllCities()    .then(r => setCities(r.data.data     || [])),
    ]).catch(() => {}).finally(() => setLookupsReady(true));
  }, []);

  /* ══ TAB 1 — STOCK ══ */
  const [stockData,      setStockData]      = useState([]);
  const [stockLoading,   setStockLoading]   = useState(false);
  const [stockError,     setStockError]     = useState(null);
  const [stockPage,      setStockPage]      = useState(1);
  const [stockTotalPgs,  setStockTotalPgs]  = useState(1);
  const [stockLimit,     setStockLimit]     = useState(15);
  const [stockSearch,    setStockSearch]    = useState('');
  const [stockDebSearch, setStockDebSearch] = useState('');
  const [stockCity,      setStockCity]      = useState('');
  const [stockCategory,  setStockCategory]  = useState('');
  const [stockBrand,     setStockBrand]     = useState('');
  const [stockStatus,    setStockStatus]    = useState('');
  const [stockSort,      setStockSort]      = useState({ key: 'englishTitle', dir: 'asc' });
  const [expandedGroups, setExpandedGroups] = useState({});
  const [stockRowMenu,   setStockRowMenu]   = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setStockDebSearch(stockSearch); setStockPage(1); }, 500);
    return () => clearTimeout(t);
  }, [stockSearch]);

  const fetchStock = useCallback(async () => {
    setStockLoading(true); setStockError(null);
    try {
      const p = new URLSearchParams();
      p.append('page',  stockPage); p.append('limit', stockLimit);
      if (stockDebSearch) p.append('searchTerm', stockDebSearch);
      if (stockCity)      p.append('city',       stockCity);
      if (stockCategory)  p.append('category',   stockCategory);
      if (stockBrand)     p.append('brand',       stockBrand);
      const res = await getDatas(`/product/search?${p.toString()}`);
      setStockData(res.data.data || []);
      setStockTotalPgs(res.data.totalPages || 1);
    } catch (e) {
      setStockError(e?.response?.data?.message || e.message || 'Failed to fetch');
      setStockData([]);
    } finally { setStockLoading(false); }
  }, [stockPage, stockLimit, stockDebSearch, stockCity, stockCategory, stockBrand]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const enrichedStock = useMemo(() => stockData.map(p => {
    const baseQty   = parseFloat(p.stock || 0);
    const cortanSz  = parseFloat(p.cortanSize || 1);
    const umQty     = baseQty * cortanSz;
    return {
      ...p,
      _category: resolveNameFrom(p.category || p.categoryID, categories),
      _brand:    resolveNameFrom(p.brand    || p.brandID,    brands),
      _city:     resolveNameFrom(p.cityID,                   cities, 'name'),
      _status:   getStockStatus(p.stock),
      _pktInCtn: p.cortanSize ? `1x${p.cortanSize}` : '—',
      _umQty:    umQty,
    };
  }), [stockData, categories, brands, cities]);

  const stockGrouped = useMemo(() => {
    let rows = stockStatus ? enrichedStock.filter(p => p._status === stockStatus) : enrichedStock;
    rows = [...rows].sort((a, b) => {
      const av = String(a[stockSort.key] ?? '').toLowerCase();
      const bv = String(b[stockSort.key] ?? '').toLowerCase();
      return stockSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    const groups = {};
    rows.forEach(p => { const g = p._brand || 'Other'; if (!groups[g]) groups[g] = []; groups[g].push(p); });
    return groups;
  }, [enrichedStock, stockStatus, stockSort]);

  const stockStats = useMemo(() => {
    const all = enrichedStock;
    return {
      total:       all.length,
      inStock:     all.filter(p => p._status === 'In Stock').length,
      low:         all.filter(p => p._status === 'Low Stock').length,
      out:         all.filter(p => p._status === 'Out of Stock').length,
      neg:         all.filter(p => p._status === 'Negative').length,
      totalQty:    all.reduce((s, p) => s + parseFloat(p.stock || 0), 0),
      totalUmQty:  all.reduce((s, p) => s + p._umQty, 0),
    };
  }, [enrichedStock]);

  const toggleGroup = (g) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
  const allExpanded = Object.keys(stockGrouped).every(g => expandedGroups[g] !== false);
  const toggleAll   = () => { const v = !allExpanded; const n = {}; Object.keys(stockGrouped).forEach(g => { n[g] = v; }); setExpandedGroups(n); };
  useEffect(() => {
    const next = {};
    Object.keys(stockGrouped).forEach(g => { if (expandedGroups[g] === undefined) next[g] = true; });
    if (Object.keys(next).length) setExpandedGroups(prev => ({ ...prev, ...next }));
  }, [stockGrouped]); // eslint-disable-line

  const exportStock = () => {
    if (!enrichedStock.length) return;
    const rows = [];
    Object.entries(stockGrouped).forEach(([brand, items]) => {
      rows.push({ 'Brand/Group': brand, Code: '', Product: '', 'PKT in CTN': '', 'Base Unit': '', 'Base Qty': '', 'UM Unit': '', 'UM Qty': '', Status: '' });
      items.forEach(p => rows.push({
        'Brand/Group': '',
        Code:          p.productId    || '—',
        Product:       p.englishTitle || '—',
        'PKT in CTN':  p._pktInCtn,
        'Base Unit':   'Ctns',
        'Base Qty':    parseFloat(p.stock || 0),
        'UM Unit':     'Pcs',
        'UM Qty':      p._umQty,
        Status:        p._status,
      }));
      const totBase = items.reduce((s, p) => s + parseFloat(p.stock || 0), 0);
      const totUm   = items.reduce((s, p) => s + p._umQty, 0);
      rows.push({ 'Brand/Group': `Total — ${brand}`, Code: '', Product: '', 'PKT in CTN': '', 'Base Unit': '', 'Base Qty': totBase, 'UM Unit': '', 'UM Qty': totUm, Status: '' });
    });
    rows.push({
      'Brand/Group': 'Grand Total',
      Code: '',
      Product: '',
      'PKT in CTN': '',
      'Base Unit': 'Ctns',
      'Base Qty': stockStats.totalQty,
      'UM Unit': 'Pcs',
      'UM Qty': stockStats.totalUmQty,
      Status: '',
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [18, 14, 45, 12, 12, 12, 10, 12, 14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock by Site');
    XLSX.writeFile(wb, `product-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ══ TAB 2 — SALES ══ */
  const [salesRows,         setSalesRows]         = useState([]);
  const [salesLoading,      setSalesLoading]      = useState(false);
  const [salesError,        setSalesError]        = useState(null);
  const [salesPage,         setSalesPage]         = useState(1);
  const [salesTotalPgs,     setSalesTotalPgs]     = useState(1);
  const [salesLimit,        setSalesLimit]        = useState(50);
  const [salesSearch,       setSalesSearch]       = useState('');
  const [salesDebSearch,    setSalesDebSearch]    = useState('');
  const [salesCity,         setSalesCity]         = useState('');
  const [salesCategory,     setSalesCategory]     = useState('');
  const [salesBrand,        setSalesBrand]        = useState('');
  const [salesDateFrom,     setSalesDateFrom]     = useState('');
  const [salesDateTo,       setSalesDateTo]       = useState('');
  const [salesGroupBy,      setSalesGroupBy]      = useState('product');
  const [salesSort,         setSalesSort]         = useState({ key: 'productName', dir: 'asc' });
  const [salesGroups,       setSalesGroups]       = useState({});
  const [salesRowMenu,      setSalesRowMenu]      = useState(null);
  // ── NEW: salesperson filter ──
  const [salesPersonFilter, setSalesPersonFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSalesDebSearch(salesSearch), 500);
    return () => clearTimeout(t);
  }, [salesSearch]);

  const fetchSales = useCallback(async () => {
    if (activeTab !== 'sales' || !lookupsReady) return;
    setSalesLoading(true); setSalesError(null);
    try {
      const payload = {};
      if (salesCity)     payload.cityId     = salesCity;
      if (salesDateFrom) payload.startDate  = salesDateFrom;
      if (salesDateTo)   payload.endDate    = salesDateTo;
      if (salesBrand)    payload.brandId    = salesBrand;
      if (salesCategory) payload.categoryId = salesCategory;

      const res    = await getSearchOrders(salesPage, salesLimit, payload);
      const orders = res.data.data || res.data.orders || [];
      setSalesTotalPgs(res.data.totalPages || 1);

      const flat = [];
      orders.forEach(order => {
        const spObj         = order.SaleUser || order.salesPerson || order.saleUser || null;
        const salesperson   = spObj ? (spObj.name || spObj.fullName || spObj.userName || `SP-${spObj._id?.slice(-4)}`) : '—';
        const salespersonId = spObj?._id || '';
        const retailerObj   = order.retailer || order.retailerId || null;
        const customer      = retailerObj && typeof retailerObj === 'object'
          ? (retailerObj.shopName || retailerObj.name || retailerObj.storeName || `R-${retailerObj._id?.slice(-4)}`)
          : (typeof retailerObj === 'string' ? retailerObj : (order.customerName || '—'));

        const cityIdValue = order.city || order.cityId || order.cityID || null;
        const cityName    = resolveNameFrom(cityIdValue, cities, 'name');

        const orderDate = order.createdAt || order.date || null;
        const txnType   = order.status || order.type || 'stock';

        (order.items || []).forEach(item => {
          const productRef  = item.productId;
          const isObj       = typeof productRef === 'object' && productRef !== null;
          const productId   = isObj ? productRef._id   : (productRef || '—');
          const productName = isObj ? (productRef.englishTitle || productRef.name || productId) : (item.productName || item.name || productId || '—');
          const productCode = isObj ? (productRef.productId || '—') : '—';
          const brand       = isObj ? resolveNameFrom(productRef.brand    || productRef.brandID,    brands)     : '—';
          const category    = isObj ? resolveNameFrom(productRef.category || productRef.categoryID, categories) : '—';
          const umQty  = parseFloat(item.quantity || 0);
          const price  = parseFloat(item.price    || 0);
          flat.push({
            orderId: order._id, txnType,
            productId: productId || '—', productCode: productCode || '—', productName: productName || '—',
            brand, category, umUnit: item.unit || 'Ctns', umQty, price, netAmt: umQty * price,
            salesperson, salespersonId, customer, city: cityName, orderDate,
          });
        });
      });
      setSalesRows(flat);
    } catch (e) {
      setSalesError(e?.response?.data?.message || e.message || 'Failed to fetch orders');
      setSalesRows([]);
    } finally { setSalesLoading(false); }
  }, [activeTab, lookupsReady, salesPage, salesLimit, salesCity, salesCategory, salesBrand, salesDateFrom, salesDateTo, cities, brands, categories]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // ── NEW: unique salesperson list derived from salesRows ──
  const uniqueSalespersons = useMemo(() => {
    const seen = new Set();
    return salesRows
      .filter(r => r.salesperson && r.salesperson !== '—')
      .filter(r => {
        if (seen.has(r.salesperson)) return false;
        seen.add(r.salesperson);
        return true;
      })
      .sort((a, b) => a.salesperson.localeCompare(b.salesperson));
  }, [salesRows]);

  // ── UPDATED: filteredSalesRows now also applies salesPersonFilter ──
  const filteredSalesRows = useMemo(() => {
    let rows = salesRows;

    // text search filter
    if (salesDebSearch) {
      const q = salesDebSearch.toLowerCase();
      rows = rows.filter(r =>
        r.productName.toLowerCase().includes(q) ||
        r.productCode.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q)    ||
        r.salesperson.toLowerCase().includes(q)
      );
    }

    // salesperson dropdown filter
    if (salesPersonFilter) {
      rows = rows.filter(r => r.salesperson === salesPersonFilter);
    }

    return rows;
  }, [salesRows, salesDebSearch, salesPersonFilter]);

  const salesGrouped = useMemo(() => {
    const rows = [...filteredSalesRows].sort((a, b) => {
      const av = String(a[salesSort.key] ?? '').toLowerCase();
      const bv = String(b[salesSort.key] ?? '').toLowerCase();
      return salesSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    const groups = {};
    rows.forEach(row => {
      const key = salesGroupBy === 'salesperson'
        ? (row.salesperson && row.salesperson !== '—' ? row.salesperson : 'Unknown')
        : ((row.brand && row.brand !== '—') ? row.brand : (row.productName || 'Unknown'));
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [filteredSalesRows, salesSort, salesGroupBy]);

  useEffect(() => {
    const next = {};
    Object.keys(salesGrouped).forEach(g => { if (salesGroups[g] === undefined) next[g] = true; });
    if (Object.keys(next).length) setSalesGroups(prev => ({ ...prev, ...next }));
  }, [salesGrouped]); // eslint-disable-line

  const toggleSalesGroup = (g) => setSalesGroups(prev => ({ ...prev, [g]: !prev[g] }));
  const allSalesExpanded = Object.keys(salesGrouped).every(g => salesGroups[g] !== false);
  const toggleAllSales   = () => { const v = !allSalesExpanded; const n = {}; Object.keys(salesGrouped).forEach(g => { n[g] = v; }); setSalesGroups(n); };

  const salesStats = useMemo(() => ({
    totalRows:          filteredSalesRows.length,
    totalQty:           filteredSalesRows.reduce((s, r) => s + r.umQty,  0),
    totalAmt:           filteredSalesRows.reduce((s, r) => s + r.netAmt, 0),
    uniqueProducts:     [...new Set(filteredSalesRows.map(r => r.productId))].length,
    uniqueSalespersons: [...new Set(filteredSalesRows.map(r => r.salesperson))].length,
    uniqueOrders:       [...new Set(filteredSalesRows.map(r => r.orderId))].length,
  }), [filteredSalesRows]);

  const exportSales = () => {
    if (!filteredSalesRows.length) return;
    const rows = [];
    Object.entries(salesGrouped).forEach(([groupKey, items]) => {
      rows.push({ Group: groupKey, 'Txn Type': '', 'Product Code': '', 'Product Name': '', Salesperson: '', Customer: '', Site: '', 'Order Date': '', 'UM Unit': '', 'UM Qty': '', 'Unit Price': '', 'Net Amount': '' });
      items.forEach(r => rows.push({ Group: '', 'Txn Type': r.txnType, 'Product Code': r.productCode, 'Product Name': r.productName, Salesperson: r.salesperson, Customer: r.customer, Site: r.city, 'Order Date': fmtDate(r.orderDate), 'UM Unit': r.umUnit, 'UM Qty': r.umQty, 'Unit Price': r.price, 'Net Amount': r.netAmt }));
      const totQty = items.reduce((s, r) => s + r.umQty,  0);
      const totAmt = items.reduce((s, r) => s + r.netAmt, 0);
      rows.push({ Group: `Total — ${groupKey}`, 'Txn Type': '', 'Product Code': '', 'Product Name': '', Salesperson: '', Customer: '', Site: '', 'Order Date': '', 'UM Unit': '', 'UM Qty': totQty, 'Unit Price': '', 'Net Amount': totAmt });
    });
    rows.push({
      Group: 'Grand Total',
      'Txn Type': '',
      'Product Code': '',
      'Product Name': '',
      Salesperson: '',
      Customer: '',
      Site: '',
      'Order Date': '',
      'UM Unit': 'Pcs',
      'UM Qty': salesStats.totalQty,
      'Unit Price': '',
      'Net Amount': salesStats.totalAmt,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [20, 10, 14, 40, 18, 20, 14, 12, 8, 12, 12, 16].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Sale Summary');
    XLSX.writeFile(wb, `product-sales-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const SortIcon = ({ sortState, col }) => (
    <span className={`ml-1 text-[10px] ${sortState.key === col ? 'text-[#FF5934]' : 'text-gray-300'}`}>
      {sortState.key === col ? (sortState.dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
  const thSort = (setter, key) => setter(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const handleStockFilter = (setter) => (e) => { setter(e.target.value); setStockPage(1); };
  const handleSalesFilter = (setter) => (e) => { setter(e.target.value); setSalesPage(1); setSalesGroups({}); };

  useEffect(() => {
    const close = () => { setStockRowMenu(null); setSalesRowMenu(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .pi-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pi-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .pi-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pi-page .table-row:hover .row-dl-btn { opacity:1; }
        .row-dl-btn { opacity:0; transition:opacity 0.15s; }
        .pi-page .group-row { transition:background 0.12s; cursor:pointer; }
        .pi-page .group-row:hover { background:#fff5f3; }
        .pi-select {
          appearance:none; -webkit-appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat; background-position:right 10px center; padding-right:28px; background-color:transparent;
        }
        .pi-stat { transition:transform 0.15s,box-shadow 0.15s; }
        .pi-stat:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08); }
        .th-btn { cursor:pointer; user-select:none; white-space:nowrap; display:flex; align-items:center; }
        .th-btn:hover { color:#FF5934; }
        .pi-tab { transition:all 0.2s; border-bottom:2.5px solid transparent; }
        .pi-tab.active { border-bottom-color:#FF5934; color:#FF5934; background:#fff8f6; border-radius:8px 8px 0 0; }
        .pi-tab:not(.active) { color:#6B7280; }
        .pi-tab:not(.active):hover { color:#111827; background:#F9FAFB; border-radius:8px 8px 0 0; }
        .pi-negative { color:#DC2626; }
        .pi-positive { color:#111827; }
        .subtotal-row td { background:#F9FAFB; border-top:1px solid #F3F4F6; }
        .pi-groupby-btn { padding:5px 12px; border-radius:8px; font-size:12px; font-weight:600; border:1px solid #E5E7EB; background:white; cursor:pointer; transition:all 0.15s; }
        .pi-groupby-btn.active { background:#FF5934; color:white; border-color:#FF5934; }
        .pi-groupby-btn:not(.active):hover { background:#FFF5F3; border-color:#FF5934; color:#FF5934; }
        .sp-active { border-color:#FF5934 !important; background:#FFF5F3 !important; }
        .sp-active select { color:#FF5934 !important; font-weight:600; }
      `}</style>

      <div className="pi-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Product & Inventory</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {activeTab === 'stock'
                ? `${stockStats.total} products · Base Qty: ${fmtNum(stockStats.totalQty)} Ctns · UM Qty: ${fmtNum(stockStats.totalUmQty)} Units`
                : `${salesStats.uniqueProducts} products · ${salesStats.uniqueOrders} orders · ${fmtNum(salesStats.totalQty)} Ctns · ${fmtAmt(salesStats.totalAmt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={activeTab === 'stock' ? fetchStock : fetchSales} disabled={stockLoading || salesLoading}
              className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
              <MdRefresh size={16} className={(stockLoading || salesLoading) ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={activeTab === 'stock' ? exportStock : exportSales}
              disabled={activeTab === 'stock' ? !enrichedStock.length : !filteredSalesRows.length}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 text-white text-sm font-bold px-4 h-10 rounded-xl shadow-md shadow-orange-100 transition-all">
              <MdDownload size={16} /> Export Excel
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-visible">

          {/* ── Tabs ── */}
          <div className="flex border-b border-gray-100 px-3 pt-2 gap-1">
            {[
              { key: 'stock', icon: MdWarehouse,  label: 'Product Stock',        sub: 'By Site / Batch' },
              { key: 'sales', icon: MdLocalOffer,  label: 'Product Sale Summary', sub: 'Completed Orders'    },
            ].map(({ key, icon: Icon, label, sub }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`pi-tab flex items-center gap-2.5 px-5 py-3 text-[13px] font-semibold ${activeTab === key ? 'active' : ''}`}>
                <Icon size={16} /><span>{label}</span>
                <span className={`text-[10px] font-normal ml-0.5 ${activeTab === key ? 'text-[#FF5934]/70' : 'text-[#9CA3AF]'}`}>{sub}</span>
              </button>
            ))}
          </div>

          {/* ── Stats ── */}
          <div className="px-5 py-4 border-b border-gray-100 bg-[#FAFAFA]">
            {activeTab === 'stock' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total Products',   value: stockStats.total,               color: 'text-[#FF5934]',   filter: ''            },
                  { label: 'Base Qty (Ctns)',  value: fmtNum(stockStats.totalQty),    color: 'text-blue-500',    filter: ''            },
                  { label: 'In Stock',         value: stockStats.inStock,             color: 'text-emerald-600', filter: 'In Stock'    },
                  { label: 'Low Stock',        value: stockStats.low,                 color: 'text-amber-600',   filter: 'Low Stock'   },
                  { label: 'Out of Stock',     value: stockStats.out,                 color: 'text-gray-400',    filter: 'Out of Stock'},
                  { label: 'Negative',         value: stockStats.neg,                 color: 'text-red-500',     filter: 'Negative'    },
                ].map(({ label, value, color, filter }) => (
                  <div key={label} onClick={() => setStockStatus(prev => prev === filter && filter ? '' : filter)}
                    className={`pi-stat bg-white border rounded-xl px-3 py-3 cursor-pointer ${stockStatus === filter && filter ? 'border-[#FF5934] ring-2 ring-[#FF5934]/15' : 'border-gray-100'}`}>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-[15px] font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total Lines',     value: salesStats.totalRows,                   color: 'text-[#FF5934]'   },
                  { label: 'Unique Products', value: salesStats.uniqueProducts,              color: 'text-blue-500'    },
                  { label: 'Unique Orders',   value: salesStats.uniqueOrders,                color: 'text-purple-500'  },
                  { label: 'Salespersons',    value: salesStats.uniqueSalespersons,          color: 'text-amber-600'   },
                  { label: 'Total UM Qty',    value: `${fmtNum(salesStats.totalQty)} Pcs`, color: 'text-sky-600'     },
                  { label: 'Net Amount',      value: fmtAmt(salesStats.totalAmt),           color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="pi-stat bg-white border border-gray-100 rounded-xl px-3 py-3">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-[14px] font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">

            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <MdSearch size={17} className="text-[#9CA3AF] flex-shrink-0" />
              <input type="search"
                value={activeTab === 'stock' ? stockSearch : salesSearch}
                onChange={e => activeTab === 'stock' ? setStockSearch(e.target.value) : setSalesSearch(e.target.value)}
                placeholder={activeTab === 'stock' ? 'Search by product name or code…' : 'Search product, customer, salesperson…'}
                className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" />
              {(activeTab === 'stock' ? stockSearch : salesSearch) && (
                <button onClick={() => activeTab === 'stock' ? setStockSearch('') : setSalesSearch('')} className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdLocationOn size={14} className="text-[#FF5934]" />
              <span className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide select-none">Site</span>
              <select value={activeTab === 'stock' ? stockCity : salesCity}
                onChange={activeTab === 'stock' ? handleStockFilter(setStockCity) : handleSalesFilter(setSalesCity)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[110px] border-none">
                <option value="">All</option>
                {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdCategory size={14} className="text-[#9CA3AF]" />
              <select value={activeTab === 'stock' ? stockCategory : salesCategory}
                onChange={activeTab === 'stock' ? handleStockFilter(setStockCategory) : handleSalesFilter(setSalesCategory)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[120px] border-none">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.englishName}</option>)}
              </select>
            </div>

            {/* Brand */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdBrandingWatermark size={14} className="text-[#9CA3AF]" />
              <select value={activeTab === 'stock' ? stockBrand : salesBrand}
                onChange={activeTab === 'stock' ? handleStockFilter(setStockBrand) : handleSalesFilter(setSalesBrand)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[110px] border-none">
                <option value="">All Brands</option>
                {brands.map(b => <option key={b._id} value={b._id}>{b.englishName}</option>)}
              </select>
            </div>

            {/* ── Sales-only filters ── */}
            {activeTab === 'sales' && (<>

              {/* Date From */}
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                <MdCalendarToday size={14} className="text-[#9CA3AF]" />
                <input type="date" value={salesDateFrom} onChange={handleSalesFilter(setSalesDateFrom)}
                  className="pi-select outline-none text-sm text-[#374151] border-none bg-transparent min-w-[120px]" title="From date" />
              </div>

              {/* Date To */}
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                <MdCalendarToday size={14} className="text-[#9CA3AF]" />
                <input type="date" value={salesDateTo} onChange={handleSalesFilter(setSalesDateTo)}
                  className="pi-select outline-none text-sm text-[#374151] border-none bg-transparent min-w-[120px]" title="To date" />
              </div>

              {/* ── NEW: Salesperson dropdown ── */}
              <div className={`flex items-center gap-2 bg-[#F9FAFB] border rounded-xl px-3 py-2 transition-all ${salesPersonFilter ? 'sp-active border-[#FF5934]' : 'border-gray-200'}`}>
                <MdPerson size={14} className={salesPersonFilter ? 'text-[#FF5934]' : 'text-[#9CA3AF]'} />
                <span className={`text-[11px] font-semibold uppercase tracking-wide select-none ${salesPersonFilter ? 'text-[#FF5934]' : 'text-[#9CA3AF]'}`}>SP</span>
                <select
                  value={salesPersonFilter}
                  onChange={e => {
                    setSalesPersonFilter(e.target.value);
                    setSalesPage(1);
                    setSalesGroups({});
                  }}
                  className={`pi-select outline-none text-sm border-none bg-transparent min-w-[130px] ${salesPersonFilter ? 'text-[#FF5934] font-semibold' : 'text-[#374151]'}`}
                >
                  <option value="">All Salespersons</option>
                  {uniqueSalespersons.map(r => (
                    <option key={r.salespersonId || r.salesperson} value={r.salesperson}>
                      {r.salesperson}
                    </option>
                  ))}
                </select>
                {salesPersonFilter && (
                  <button
                    onClick={() => { setSalesPersonFilter(''); setSalesPage(1); setSalesGroups({}); }}
                    className="text-[#FF5934] hover:text-[#e84d2a] ml-0.5 flex-shrink-0"
                    title="Clear salesperson filter"
                  >
                    <MdClose size={13} />
                  </button>
                )}
              </div>

              {/* Group By */}
              <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                <MdPerson size={14} className="text-[#9CA3AF]" />
                <span className="text-xs text-[#9CA3AF] mr-1">Group:</span>
                <button className={`pi-groupby-btn ${salesGroupBy === 'product' ? 'active' : ''}`} onClick={() => { setSalesGroupBy('product'); setSalesGroups({}); }}>Product</button>
                <button className={`pi-groupby-btn ${salesGroupBy === 'salesperson' ? 'active' : ''}`} onClick={() => { setSalesGroupBy('salesperson'); setSalesGroups({}); }}>Salesperson</button>
              </div>
            </>)}

            {/* Expand / Collapse All */}
            <button onClick={activeTab === 'stock' ? toggleAll : toggleAllSales}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
              {(activeTab === 'stock' ? allExpanded : allSalesExpanded) ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
              {(activeTab === 'stock' ? allExpanded : allSalesExpanded) ? 'Collapse' : 'Expand'} All
            </button>

            {/* Reset */}
            <button onClick={() => {
              if (activeTab === 'stock') {
                setStockSearch(''); setStockDebSearch(''); setStockCity(''); setStockCategory(''); setStockBrand(''); setStockStatus(''); setStockPage(1);
              } else {
                setSalesSearch(''); setSalesDebSearch(''); setSalesCity(''); setSalesCategory(''); setSalesBrand('');
                setSalesDateFrom(''); setSalesDateTo(''); setSalesPage(1); setSalesGroups({});
                // ── NEW: also reset salesperson filter ──
                setSalesPersonFilter('');
              }
            }} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all">
              <MdRefresh size={15} /> Reset
            </button>
          </div>

          {/* ═══════════════════════════════
              STOCK TABLE
          ═══════════════════════════════ */}
          {activeTab === 'stock' && (
            <>
              {stockLoading ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#9CA3AF] text-sm">Loading stock data…</p>
                </div>
              ) : stockError ? (
                <div className="py-10 px-5 flex items-center gap-3 bg-red-50 mx-5 my-4 rounded-2xl border border-red-100">
                  <p className="text-[13px] text-red-600 flex-1">{stockError}</p>
                  <button onClick={() => setStockError(null)} className="text-red-400 hover:text-red-600"><MdClose size={15} /></button>
                </div>
              ) : Object.keys(stockGrouped).length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center"><MdWarehouse size={24} className="text-gray-300" /></div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No stock data found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {[
                            { label: 'Code',       key: 'productId',    align: 'left',   w: 'w-[130px]' },
                            { label: 'Product',    key: 'englishTitle', align: 'left',   w: ''          },
                            { label: 'PKT in CTN', key: null,           align: 'center', w: 'w-[100px]' },
                            { label: 'Base Unit',  key: null,           align: 'center', w: 'w-[85px]'  },
                            { label: 'Base Qty',   key: 'stock',        align: 'right',  w: 'w-[100px]' },
                            { label: 'UM Unit',    key: null,           align: 'center', w: 'w-[80px]'  },
                            { label: 'UM Qty',     key: '_umQty',       align: 'right',  w: 'w-[110px]' },
                            { label: 'Status',     key: null,           align: 'left',   w: 'w-[115px]' },
                            { label: '',           key: null,           align: 'center', w: 'w-[44px]'  },
                          ].map(({ label, key, align, w }) => (
                            <th key={label} className={`text-${align} text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 ${w}`}>
                              {key ? <button className={`th-btn ${align === 'right' ? 'ml-auto' : ''}`} onClick={() => thSort(setStockSort, key)}>{label} <SortIcon sortState={stockSort} col={key} /></button> : label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stockGrouped).map(([brand, items]) => {
                          const isOpen      = expandedGroups[brand] !== false;
                          const groupBase   = items.reduce((s, p) => s + parseFloat(p.stock || 0), 0);
                          const groupUm     = items.reduce((s, p) => s + p._umQty, 0);
                          return (
                            <React.Fragment key={brand}>
                              <tr className="group-row" onClick={() => toggleGroup(brand)}>
                                <td colSpan={9} className="px-4 py-2.5 bg-[#FFF5F3] border-y border-[#FFD7CE]">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen ? <MdExpandLess size={16} className="text-[#FF5934]" /> : <MdExpandMore size={16} className="text-[#FF5934]" />}
                                      <span className="text-[13px] font-bold text-[#111827]">{brand}</span>
                                      <span className="text-[11px] text-[#9CA3AF] bg-white border border-gray-100 px-2 py-0.5 rounded-full">{items.length} product{items.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    {!isOpen && (
                                      <div className="flex items-center gap-4">
                                        <span className="text-[12px] text-[#9CA3AF]">Base: <span className="font-semibold text-[#111827]">{fmtNum(groupBase)} Ctns</span></span>
                                        <span className="text-[12px] font-semibold text-[#FF5934]">UM: {fmtNum(groupUm)}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOpen && (<>
                                {items.map((p, idx) => {
                                  const sc      = statusStyle(p._status);
                                  const negBase = isNeg(p.stock);
                                  const negUm   = isNeg(p._umQty);
                                  const rowId   = p._id || `stock-${idx}`;
                                  return (
                                    <tr key={rowId} className="table-row border-b border-gray-50">
                                      <td className="px-4 py-3 pl-10">
                                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">{p.productId || '—'}</span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <p className="text-[13px] font-medium text-[#111827] leading-tight max-w-xs">{p.englishTitle || '—'}</p>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <span className="text-[12px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded-lg font-mono">{p._pktInCtn}</span>
                                      </td>
                                      <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                      <td className="px-4 py-3 text-right">
                                        <span className={`text-[14px] font-bold ${negBase ? 'pi-negative' : 'pi-positive'}`}>
                                          {negBase ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Pcs</td>
                                      <td className="px-4 py-3 text-right">
                                        <span className={`text-[13px] font-semibold ${negUm ? 'pi-negative' : 'pi-positive'}`}>
                                          {negUm ? `(${fmtNum(Math.abs(p._umQty))})` : fmtNum(p._umQty)}
                                        </span>
                                        {p.cortanSize && (
                                          <span className="block text-[10px] text-[#9CA3AF] mt-0.5">
                                            {fmtNum(p.stock)} × {p.cortanSize}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${sc.pill}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{p._status}
                                        </span>
                                      </td>
                                      <td className="px-2 py-3 text-center">
                                        <div className="row-dl-btn flex justify-center">
                                          <RowActions rowId={rowId} activeMenu={stockRowMenu} setMenu={setStockRowMenu}
                                            onExcel={() => downloadStockRowExcel(p)} onPDF={() => downloadStockRowPDF(p)} />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="subtotal-row">
                                  <td className="px-4 py-2 pl-10" colSpan={4}>
                                    <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total — {brand}</span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <span className={`text-[13px] font-bold ${isNeg(groupBase) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(groupBase)}</span>
                                  </td>
                                  <td />
                                  <td className="px-4 py-2 text-right">
                                    <span className={`text-[13px] font-bold ${isNeg(groupUm) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(groupUm)}</span>
                                  </td>
                                  <td /><td />
                                </tr>
                              </>)}
                            </React.Fragment>
                          );
                        })}
                        <tr className="subtotal-row border-t-2 border-[#FFD7CE]">
                          <td className="px-4 py-2.5 pl-10" colSpan={4}>
                            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-[13px] font-bold ${isNeg(stockStats.totalQty) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(stockStats.totalQty)}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center text-[12px] text-[#6B7280]">Pcs</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-[13px] font-bold ${isNeg(stockStats.totalUmQty) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(stockStats.totalUmQty)}</span>
                          </td>
                          <td /><td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grand Total footer */}
                  <div className="border-t-2 border-[#FFD7CE] bg-[#FFF5F3] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Base Qty (Ctns)</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(stockStats.totalQty)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">UM Qty (Units)</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(stockStats.totalUmQty)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                      {enrichedStock.length} product{enrichedStock.length !== 1 ? 's' : ''}
                      {stockStatus && <> · <span className="text-[#FF5934]">{stockStatus}</span></>}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage === 1} onClick={() => setStockPage(p => p - 1)}><GrFormPrevious size={16} /></button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{stockPage}</span><span className="text-gray-300">/</span><span className="text-[#374151]">{stockTotalPgs}</span>
                      </div>
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage >= stockTotalPgs} onClick={() => setStockPage(p => p + 1)}><GrFormNext size={16} /></button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Rows</span>
                        <select value={stockLimit} onChange={e => { setStockLimit(Number(e.target.value)); setStockPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none">
                          <option value={10}>10</option><option value={15}>15</option><option value={30}>30</option><option value={50}>50</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════
              SALES TABLE
          ═══════════════════════════════ */}
          {activeTab === 'sales' && (
            <>
              {salesLoading ? (
                <div className="py-20 flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[#9CA3AF] text-sm">Loading sales data…</p>
                </div>
              ) : salesError ? (
                <div className="py-10 px-5 flex items-center gap-3 bg-red-50 mx-5 my-4 rounded-2xl border border-red-100">
                  <p className="text-[13px] text-red-600 flex-1">{salesError}</p>
                  <button onClick={() => setSalesError(null)} className="text-red-400 hover:text-red-600"><MdClose size={15} /></button>
                </div>
              ) : Object.keys(salesGrouped).length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center"><MdLocalOffer size={24} className="text-gray-300" /></div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No orders found</p>
                  <p className="text-[#9CA3AF] text-xs">Try adjusting your date range or filters</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px]">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {[
                            { label: 'Type',         key: 'txnType',     align: 'center', w: 'w-[75px]'  },
                            { label: 'Product Code', key: 'productCode', align: 'left',   w: 'w-[110px]' },
                            { label: 'Product Name', key: 'productName', align: 'left',   w: ''          },
                            { label: 'Salesperson',  key: 'salesperson', align: 'left',   w: 'w-[120px]' },
                            { label: 'Customer',     key: 'customer',    align: 'left',   w: 'w-[115px]' },
                            { label: 'Site',     key: 'city',        align: 'left',   w: 'w-[105px]' },
                            { label: 'Date',         key: 'orderDate',   align: 'left',   w: 'w-[95px]'  },
                            { label: 'UM Unit',      key: null,          align: 'center', w: 'w-[72px]'  },
                            { label: 'UM Qty',       key: 'umQty',       align: 'right',  w: 'w-[85px]'  },
                            { label: 'Unit Price',   key: 'price',       align: 'right',  w: 'w-[95px]'  },
                            { label: 'Net Amount',   key: 'netAmt',      align: 'right',  w: 'w-[120px]' },
                            { label: '',             key: null,          align: 'center', w: 'w-[44px]'  },
                          ].map(({ label, key, align, w }) => (
                            <th key={label} className={`text-${align} text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3 ${w}`}>
                              {key ? <button className={`th-btn ${align === 'right' ? 'ml-auto' : ''}`} onClick={() => thSort(setSalesSort, key)}>{label} <SortIcon sortState={salesSort} col={key} /></button> : label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(salesGrouped).map(([groupKey, items]) => {
                          const isOpen = salesGroups[groupKey] !== false;
                          const grpQty = items.reduce((s, r) => s + r.umQty,  0);
                          const grpAmt = items.reduce((s, r) => s + r.netAmt, 0);
                          return (
                            <React.Fragment key={groupKey}>
                              <tr className="group-row" onClick={() => toggleSalesGroup(groupKey)}>
                                <td colSpan={12} className="px-4 py-2.5 bg-[#FFF5F3] border-y border-[#FFD7CE]">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen ? <MdExpandLess size={16} className="text-[#FF5934]" /> : <MdExpandMore size={16} className="text-[#FF5934]" />}
                                      <span className="text-[13px] font-bold text-[#111827]">{groupKey}</span>
                                      <span className="text-[11px] text-[#9CA3AF] bg-white border border-gray-100 px-2 py-0.5 rounded-full">{items.length} line{items.length !== 1 ? 's' : ''}</span>
                                      {salesGroupBy === 'salesperson' && (
                                        <span className="text-[11px] text-[#9CA3AF] bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full ml-1">
                                          {[...new Set(items.map(r => r.productId))].length} products
                                        </span>
                                      )}
                                    </div>
                                    {!isOpen && (
                                      <div className="flex items-center gap-4">
                                        <span className="text-[12px] text-[#9CA3AF]">Qty: <span className="font-semibold text-[#111827]">{fmtNum(grpQty)}</span></span>
                                        <span className="text-[12px] font-semibold text-[#FF5934]">{fmtAmt(grpAmt)}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOpen && (<>
                                {items.map((r, idx) => {
                                  const statusBadge = (() => {
                                    const s = (r.txnType || '').toLowerCase();
                                    if (s === 'completed')                      return 'bg-emerald-50 text-emerald-600 ring-emerald-200';
                                    if (s === 'processed')                      return 'bg-blue-50 text-blue-600 ring-blue-200';
                                    if (s === 'pending')                        return 'bg-amber-50 text-amber-600 ring-amber-200';
                                    if (s === 'cancelled' || s === 'canceled') return 'bg-red-50 text-red-500 ring-red-200';
                                    if (s === 'satelment')                      return 'bg-purple-50 text-purple-600 ring-purple-200';
                                    return 'bg-gray-100 text-gray-500 ring-gray-200';
                                  })();
                                  const rowId = `${r.orderId}-${idx}`;
                                  return (
                                    <tr key={rowId} className="table-row border-b border-gray-50">
                                      <td className="px-3 py-2.5 pl-10">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusBadge}`}>
                                          <MdLogin size={10} /> {r.txnType}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className="text-[11px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">{r.productCode}</span>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <p className="text-[12px] font-medium text-[#111827] leading-tight">{r.productName}</p>
                                        <p className="text-[10px] text-[#9CA3AF] mt-0.5">{r.brand} · {r.category}</p>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[9px] font-bold text-purple-600 flex-shrink-0">
                                            {(r.salesperson || '?').charAt(0).toUpperCase()}
                                          </span>
                                          <span className="text-[12px] text-[#374151]">{r.salesperson}</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5"><span className="text-[12px] text-[#374151]">{r.customer}</span></td>
                                      <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1">
                                          <MdLocationOn size={11} className="text-[#9CA3AF] flex-shrink-0" />
                                          <span className="text-[11px] text-[#374151] font-medium">{r.city}</span>
                                        </div>
                                      </td>
                                      <td className="px-3 py-2.5"><span className="text-[11px] text-[#6B7280]">{fmtDate(r.orderDate)}</span></td>
                                      <td className="px-3 py-2.5 text-center text-[12px] text-[#374151]">{r.umUnit}</td>
                                      <td className="px-3 py-2.5 text-right"><span className="text-[13px] font-bold text-[#111827]">{fmtNum(r.umQty)}</span></td>
                                      <td className="px-3 py-2.5 text-right"><span className="text-[12px] text-[#374151]">{fmtAmt(r.price)}</span></td>
                                      <td className="px-3 py-2.5 text-right">
                                        <span className={`text-[13px] font-bold ${isNeg(r.netAmt) ? 'pi-negative' : 'pi-positive'}`}>
                                          {isNeg(r.netAmt) ? `(Rs. ${fmtNum(Math.abs(r.netAmt))})` : fmtAmt(r.netAmt)}
                                        </span>
                                      </td>
                                      <td className="px-2 py-2.5 text-center">
                                        <div className="row-dl-btn flex justify-center">
                                          <RowActions rowId={rowId} activeMenu={salesRowMenu} setMenu={setSalesRowMenu}
                                            onExcel={() => downloadSalesRowExcel(r)} onPDF={() => downloadSalesRowPDF(r)} />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                                <tr className="subtotal-row">
                                  <td colSpan={8} className="px-4 py-2 pl-10"><span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total — {groupKey}</span></td>
                                  <td className="px-3 py-2 text-right"><span className="text-[13px] font-bold text-[#FF5934]">{fmtNum(grpQty)}</span></td>
                                  <td />
                                  <td className="px-3 py-2 text-right"><span className="text-[13px] font-bold text-[#FF5934]">{fmtAmt(grpAmt)}</span></td>
                                  <td />
                                </tr>
                              </>)}
                            </React.Fragment>
                          );
                        })}
                        <tr className="subtotal-row border-t-2 border-[#FFD7CE]">
                          <td colSpan={8} className="px-4 py-2.5 pl-10">
                            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[13px] font-bold text-[#FF5934]">{fmtNum(salesStats.totalQty)}</span>
                          </td>
                          <td />
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[13px] font-bold text-[#FF5934]">{fmtAmt(salesStats.totalAmt)}</span>
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Grand total */}
                  <div className="border-t-2 border-[#FFD7CE] bg-[#FFF5F3] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                      {/* ── NEW: show active salesperson filter badge ── */}
                      {salesPersonFilter && (
                        <span className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 text-purple-600 text-[11px] font-bold px-2.5 py-1 rounded-full">
                          <MdPerson size={11} /> {salesPersonFilter}
                          <button onClick={() => { setSalesPersonFilter(''); setSalesPage(1); setSalesGroups({}); }} className="hover:text-purple-800 ml-0.5">
                            <MdClose size={10} />
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-8">
                      <div><p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Total UM Qty</p><p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(salesStats.totalQty)} Ctns</p></div>
                      <div><p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Total Net Amount</p><p className="text-[15px] font-bold text-[#FF5934]">{fmtAmt(salesStats.totalAmt)}</p></div>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                      {salesStats.totalRows} line{salesStats.totalRows !== 1 ? 's' : ''} · {salesStats.uniqueOrders} order{salesStats.uniqueOrders !== 1 ? 's' : ''}
                      {salesPersonFilter && <> · <span className="text-purple-500">{salesPersonFilter}</span></>}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)}><GrFormPrevious size={16} /></button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{salesPage}</span><span className="text-gray-300">/</span><span className="text-[#374151]">{salesTotalPgs}</span>
                      </div>
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage >= salesTotalPgs} onClick={() => setSalesPage(p => p + 1)}><GrFormNext size={16} /></button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Orders/page</span>
                        <select value={salesLimit} onChange={e => { setSalesLimit(Number(e.target.value)); setSalesPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none">
                          <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductAndInventory;
