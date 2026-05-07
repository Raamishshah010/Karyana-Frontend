import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { getDatas, getSearchOrders, getAllCategories, getAllBrands, getAllCities } from '../APIS';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import {
  MdSearch, MdDownload, MdRefresh,
  MdLocationOn, MdCategory, MdBrandingWatermark, MdWarehouse,
  MdClose, MdLocalOffer, MdExpandMore, MdExpandLess, MdLogin,
  MdCalendarToday, MdPerson,
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
  if (v < 0) return 'Negative';
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

/*
  FIX 1 — resolveNameFrom now accepts an optional fallback key so callers
  can request 'name' vs 'englishName' without confusion.
*/
const resolveNameFrom = (field, list, key = 'englishName') => {
  if (!field) return '—';
  if (typeof field === 'object') return field[key] || field.englishName || field.name || '—';
  const found = list.find(i => i._id === field);
  return found ? (found[key] || found.englishName || found.name || field) : field;
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ProductAndInventory = () => {
  const [activeTab, setActiveTab] = useState('stock');

  /* ── shared filter options ── */
  const [categories, setCategories] = useState([]);
  const [brands,     setBrands]     = useState([]);
  const [cities,     setCities]     = useState([]);

  /*
    FIX 2 — track when lookup lists are loaded so the sales fetch (which
    needs cities/brands/categories for city resolution) waits until they
    are ready before running.
  */
  const [lookupsReady, setLookupsReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getAllCategories().then(r => setCategories(r.data.data || [])),
      getAllBrands()    .then(r => setBrands(r.data.data     || [])),
      getAllCities()    .then(r => setCities(r.data.data     || [])),
    ])
      .catch(() => {})
      .finally(() => setLookupsReady(true));
  }, []);

  /* ══════════════════════════════════════
     TAB 1 — STOCK
  ══════════════════════════════════════ */
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

  /* debounce stock search */
  useEffect(() => {
    const t = setTimeout(() => { setStockDebSearch(stockSearch); setStockPage(1); }, 500);
    return () => clearTimeout(t);
  }, [stockSearch]);

  const fetchStock = useCallback(async () => {
    setStockLoading(true); setStockError(null);
    try {
      const p = new URLSearchParams();
      p.append('page',  stockPage);
      p.append('limit', stockLimit);
      if (stockDebSearch) p.append('searchTerm', stockDebSearch);
      /*
        FIX 3 (Stock) — send the selected filter IDs to the server.
        Previously the param name for city was 'city' — keep that but also
        make sure we don't append an empty string (which would confuse some APIs).
      */
      if (stockCity)     p.append('city',     stockCity);
      if (stockCategory) p.append('category', stockCategory);
      if (stockBrand)    p.append('brand',    stockBrand);

      const res = await getDatas(`/product/search?${p.toString()}`);
      setStockData(res.data.data || []);
      setStockTotalPgs(res.data.totalPages || 1);
    } catch (e) {
      setStockError(e?.response?.data?.message || e.message || 'Failed to fetch');
      setStockData([]);
    } finally { setStockLoading(false); }
  }, [stockPage, stockLimit, stockDebSearch, stockCity, stockCategory, stockBrand]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const enrichedStock = useMemo(() => stockData.map(p => ({
    ...p,
    _category: resolveNameFrom(p.category || p.categoryID, categories),
    _brand:    resolveNameFrom(p.brand    || p.brandID,    brands),
    _city:     resolveNameFrom(p.cityID,                   cities, 'name'),
    _status:   getStockStatus(p.stock),
    _pktInCtn: p.cortanSize ? `1x${p.cortanSize}` : '—',
  })), [stockData, categories, brands, cities]);

  const stockGrouped = useMemo(() => {
    /* FIX 4 — stockStatus is client-side only; apply it AFTER server fetch */
    let rows = stockStatus
      ? enrichedStock.filter(p => p._status === stockStatus)
      : enrichedStock;

    rows = [...rows].sort((a, b) => {
      const av = String(a[stockSort.key] ?? '').toLowerCase();
      const bv = String(b[stockSort.key] ?? '').toLowerCase();
      return stockSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const groups = {};
    rows.forEach(p => {
      const g = p._brand || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return groups;
  }, [enrichedStock, stockStatus, stockSort]);

  const stockStats = useMemo(() => {
    const all = enrichedStock;
    return {
      total:    all.length,
      inStock:  all.filter(p => p._status === 'In Stock').length,
      low:      all.filter(p => p._status === 'Low Stock').length,
      out:      all.filter(p => p._status === 'Out of Stock').length,
      neg:      all.filter(p => p._status === 'Negative').length,
      totalQty: all.reduce((s, p) => s + parseFloat(p.stock || 0), 0),
    };
  }, [enrichedStock]);

  const toggleGroup = (g) =>
    setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
  const allExpanded = Object.keys(stockGrouped).every(g => expandedGroups[g] !== false);
  const toggleAll   = () => {
    const val  = !allExpanded;
    const next = {};
    Object.keys(stockGrouped).forEach(g => { next[g] = val; });
    setExpandedGroups(next);
  };
  /* auto-expand newly loaded groups */
  useEffect(() => {
    const next = {};
    Object.keys(stockGrouped).forEach(g => {
      if (expandedGroups[g] === undefined) next[g] = true;
    });
    if (Object.keys(next).length) setExpandedGroups(prev => ({ ...prev, ...next }));
  }, [stockGrouped]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportStock = () => {
    if (!enrichedStock.length) return;
    const rows = [];
    Object.entries(stockGrouped).forEach(([brand, items]) => {
      rows.push({ 'Brand/Group': brand, Code: '', Product: '', 'PKT in CTN': '', 'Base Unit': '', 'Base Qty': '', 'UM Unit': '', 'UM Qty': '', Status: '' });
      items.forEach(p => {
        rows.push({
          'Brand/Group': '',
          Code:         p.productId || '—',
          Product:      p.englishTitle || '—',
          'PKT in CTN': p._pktInCtn,
          'Base Unit':  'Ctns',
          'Base Qty':   parseFloat(p.stock || 0),
          'UM Unit':    'Ctns',
          'UM Qty':     parseFloat(p.stock || 0),
          Status:       p._status,
        });
      });
      const tot = items.reduce((s, p) => s + parseFloat(p.stock || 0), 0);
      rows.push({ 'Brand/Group': `Total — ${brand}`, Code: '', Product: '', 'PKT in CTN': '', 'Base Unit': '', 'Base Qty': tot, 'UM Unit': '', 'UM Qty': tot, Status: '' });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [18, 14, 45, 12, 12, 12, 10, 12, 14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock by Location');
    XLSX.writeFile(wb, `product-stock-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ══════════════════════════════════════
     TAB 2 — SALES
  ══════════════════════════════════════ */
  const [salesRows,        setSalesRows]        = useState([]);
  const [salesLoading,     setSalesLoading]     = useState(false);
  const [salesError,       setSalesError]       = useState(null);
  const [salesPage,        setSalesPage]        = useState(1);
  const [salesTotalPgs,    setSalesTotalPgs]    = useState(1);
  const [salesLimit,       setSalesLimit]       = useState(50);

  const [salesSearch,      setSalesSearch]      = useState('');
  const [salesDebSearch,   setSalesDebSearch]   = useState('');
  const [salesCity,        setSalesCity]        = useState('');
  const [salesCategory,    setSalesCategory]    = useState('');
  const [salesBrand,       setSalesBrand]       = useState('');
  const [salesDateFrom,    setSalesDateFrom]    = useState('');
  const [salesDateTo,      setSalesDateTo]      = useState('');

  const [salesGroupBy,  setSalesGroupBy]  = useState('product');
  const [salesSort,     setSalesSort]     = useState({ key: 'productName', dir: 'asc' });
  const [salesGroups,   setSalesGroups]   = useState({});

  /* debounce sales search — client-side only, does NOT reset page */
  useEffect(() => {
    const t = setTimeout(() => setSalesDebSearch(salesSearch), 500);
    return () => clearTimeout(t);
  }, [salesSearch]);

  /*
    FIX 5 — Sales fetch only depends on server-side filter params.
    salesDebSearch is intentionally excluded here; it drives the client-side
    filter below so that typing in the search box does not fire a new API
    call on every keystroke.
  */
  const fetchSales = useCallback(async () => {
    if (activeTab !== 'sales') return;
    if (!lookupsReady) return;          // wait for cities/brands/categories

    setSalesLoading(true); setSalesError(null);
    try {
      const payload = {};
      if (salesCity)     payload.cityId     = salesCity;
      if (salesDateFrom) payload.startDate  = salesDateFrom;
      if (salesDateTo)   payload.endDate    = salesDateTo;
      if (salesBrand)    payload.brandId    = salesBrand;
      if (salesCategory) payload.categoryId = salesCategory;

      const res = await getSearchOrders(salesPage, salesLimit, payload);

      const orders     = res.data.data || res.data.orders || [];
      const totalPages = res.data.totalPages || 1;
      setSalesTotalPgs(totalPages);

      /* ── flatten orders → per-item rows ── */
      const flat = [];
      orders.forEach(order => {
        const spObj       = order.SaleUser || order.salesPerson || order.saleUser || null;
        const salesperson = spObj
          ? (spObj.name || spObj.fullName || spObj.userName || `SP-${spObj._id?.slice(-4)}`)
          : '—';
        const salespersonId = spObj?._id || '';

        const retailerObj = order.retailer || order.retailerId || null;
        const customer    = retailerObj && typeof retailerObj === 'object'
          ? (retailerObj.shopName || retailerObj.name || retailerObj.storeName || `R-${retailerObj._id?.slice(-4)}`)
          : (typeof retailerObj === 'string' ? retailerObj : (order.customerName || '—'));

        /*
          FIX 6 — City resolution. The order.city field may arrive as an
          ID string, an object, or null.  resolveNameFrom handles all three
          cases.  Because lookupsReady is true by the time fetchSales runs,
          cities is always populated here.
        */
        const cityIdValue = order.city || order.cityId || order.cityID || null;
        const cityName    = resolveNameFrom(cityIdValue, cities, 'name');

        const orderDate = order.createdAt || order.date || null;
        const txnType   = order.status || order.type || 'stock';

        (order.items || []).forEach(item => {
          const productRef  = item.productId;
          const isObj       = typeof productRef === 'object' && productRef !== null;

          const productId   = isObj ? productRef._id   : (productRef || '—');
          const productName = isObj
            ? (productRef.englishTitle || productRef.name || productId)
            : (item.productName || item.name || productId || '—');
          const productCode = isObj ? (productRef.productId || '—') : '—';

          const brand    = isObj
            ? resolveNameFrom(productRef.brand || productRef.brandID, brands)
            : '—';
          const category = isObj
            ? resolveNameFrom(productRef.category || productRef.categoryID, categories)
            : '—';

          const umQty  = parseFloat(item.quantity || 0);
          const price  = parseFloat(item.price    || 0);
          const netAmt = umQty * price;

          flat.push({
            orderId:        order._id,
            txnType,
            productId:      productId   || '—',
            productCode:    productCode || '—',
            productName:    productName || '—',
            brand,
            category,
            umUnit:         item.unit || 'Ctns',
            umQty,
            price,
            netAmt,
            salesperson,
            salespersonId,
            customer,
            city:           cityName,
            orderDate,
          });
        });
      });

      setSalesRows(flat);
    } catch (e) {
      setSalesError(e?.response?.data?.message || e.message || 'Failed to fetch orders');
      setSalesRows([]);
    } finally { setSalesLoading(false); }
  }, [
    activeTab, lookupsReady,
    salesPage, salesLimit,
    salesCity, salesCategory, salesBrand,
    salesDateFrom, salesDateTo,
    cities, brands, categories,
  ]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  /*
    FIX 7 — Client-side search filter operates only on salesDebSearch.
    This keeps search snappy without round-tripping to the server.
  */
  const filteredSalesRows = useMemo(() => {
    if (!salesDebSearch) return salesRows;
    const q = salesDebSearch.toLowerCase();
    return salesRows.filter(r =>
      r.productName.toLowerCase().includes(q) ||
      r.productCode.toLowerCase().includes(q) ||
      r.customer.toLowerCase().includes(q)    ||
      r.salesperson.toLowerCase().includes(q)
    );
  }, [salesRows, salesDebSearch]);

  /*
    FIX 8 — salesGroupBy 'product' key now uses brand when it resolves to a
    real value; falls back to the product name (never '—').
  */
  const salesGrouped = useMemo(() => {
    const rows = [...filteredSalesRows].sort((a, b) => {
      const av = String(a[salesSort.key] ?? '').toLowerCase();
      const bv = String(b[salesSort.key] ?? '').toLowerCase();
      return salesSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    const groups = {};
    rows.forEach(row => {
      let key;
      if (salesGroupBy === 'salesperson') {
        key = row.salesperson && row.salesperson !== '—' ? row.salesperson : 'Unknown';
      } else {
        // group by brand; fall back to product name (never '—')
        key = (row.brand && row.brand !== '—') ? row.brand : (row.productName || 'Unknown');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [filteredSalesRows, salesSort, salesGroupBy]);

  /* auto-expand newly loaded sales groups */
  useEffect(() => {
    const next = {};
    Object.keys(salesGrouped).forEach(g => {
      if (salesGroups[g] === undefined) next[g] = true;
    });
    if (Object.keys(next).length) setSalesGroups(prev => ({ ...prev, ...next }));
  }, [salesGrouped]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSalesGroup  = (g) => setSalesGroups(prev => ({ ...prev, [g]: !prev[g] }));
  const allSalesExpanded  = Object.keys(salesGrouped).every(g => salesGroups[g] !== false);
  const toggleAllSales    = () => {
    const val  = !allSalesExpanded;
    const next = {};
    Object.keys(salesGrouped).forEach(g => { next[g] = val; });
    setSalesGroups(next);
  };

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
      rows.push({
        Group: groupKey, 'Txn Type': '', 'Product Code': '', 'Product Name': '',
        Salesperson: '', Customer: '', City: '', 'Order Date': '',
        'UM Unit': '', 'UM Qty': '', 'Unit Price': '', 'Net Amount': '',
      });
      items.forEach(r => {
        rows.push({
          Group:          '',
          'Txn Type':     r.txnType,
          'Product Code': r.productCode,
          'Product Name': r.productName,
          Salesperson:    r.salesperson,
          Customer:       r.customer,
          City:           r.city,
          'Order Date':   fmtDate(r.orderDate),
          'UM Unit':      r.umUnit,
          'UM Qty':       r.umQty,
          'Unit Price':   r.price,
          'Net Amount':   r.netAmt,
        });
      });
      const totQty = items.reduce((s, r) => s + r.umQty,  0);
      const totAmt = items.reduce((s, r) => s + r.netAmt, 0);
      rows.push({
        Group: `Total — ${groupKey}`, 'Txn Type': '', 'Product Code': '',
        'Product Name': '', Salesperson: '', Customer: '', City: '',
        'Order Date': '', 'UM Unit': '', 'UM Qty': totQty,
        'Unit Price': '', 'Net Amount': totAmt,
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [20, 10, 14, 40, 18, 20, 14, 12, 8, 12, 12, 16].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Sale Summary');
    XLSX.writeFile(wb, `product-sales-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ══ shared sort helpers ══ */
  const SortIcon = ({ sortState, col }) => (
    <span className={`ml-1 text-[10px] ${sortState.key === col ? 'text-[#FF5934]' : 'text-gray-300'}`}>
      {sortState.key === col ? (sortState.dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
  const thSort = (setter, key) => setter(s => ({
    key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc',
  }));

  /* ══ shared filter-change helpers that also reset page ══ */
  const handleStockFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setStockPage(1);
  };
  const handleSalesFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setSalesPage(1);
    /*
      FIX 9 — reset salesGroups so auto-expand fires on the next grouped result.
    */
    setSalesGroups({});
  };

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .pi-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .pi-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .pi-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pi-page .group-row { transition: background 0.12s; cursor: pointer; }
        .pi-page .group-row:hover { background: #fff5f3; }
        .pi-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
          background-color: transparent;
        }
        .pi-stat { transition: transform 0.15s, box-shadow 0.15s; }
        .pi-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .th-btn { cursor: pointer; user-select: none; white-space: nowrap; display: flex; align-items: center; }
        .th-btn:hover { color: #FF5934; }
        .pi-tab { transition: all 0.2s; border-bottom: 2.5px solid transparent; }
        .pi-tab.active { border-bottom-color: #FF5934; color: #FF5934; background: #fff8f6; border-radius: 8px 8px 0 0; }
        .pi-tab:not(.active) { color: #6B7280; }
        .pi-tab:not(.active):hover { color: #111827; background: #F9FAFB; border-radius: 8px 8px 0 0; }
        .pi-negative { color: #DC2626; }
        .pi-positive { color: #111827; }
        .group-header td { background: linear-gradient(135deg, #fff5f3 0%, #fff9f8 100%); border-bottom: 1px solid #FFD7CE; }
        .subtotal-row td { background: #F9FAFB; border-top: 1px solid #F3F4F6; }
        .pi-groupby-btn { padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid #E5E7EB; background: white; cursor: pointer; transition: all 0.15s; }
        .pi-groupby-btn.active { background: #FF5934; color: white; border-color: #FF5934; }
        .pi-groupby-btn:not(.active):hover { background: #FFF5F3; border-color: #FF5934; color: #FF5934; }
      `}</style>

      <div className="pi-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Product & Inventory</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {activeTab === 'stock'
                ? `${stockStats.total} products · Total stock: ${fmtNum(stockStats.totalQty)} Ctns`
                : `${salesStats.uniqueProducts} products · ${salesStats.uniqueOrders} orders · ${fmtNum(salesStats.totalQty)} Ctns · ${fmtAmt(salesStats.totalAmt)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={activeTab === 'stock' ? fetchStock : fetchSales}
              disabled={stockLoading || salesLoading}
              className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <MdRefresh size={16} className={(stockLoading || salesLoading) ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={activeTab === 'stock' ? exportStock : exportSales}
              disabled={activeTab === 'stock' ? !enrichedStock.length : !filteredSalesRows.length}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 text-white text-sm font-bold px-4 h-10 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdDownload size={16} /> Export Excel
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-visible">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-3 pt-2 gap-1">
            {[
              { key: 'stock', icon: MdWarehouse,  label: 'Product Stock',        sub: 'By Location / Batch' },
              { key: 'sales', icon: MdLocalOffer,  label: 'Product Sale Summary', sub: 'Completed Orders'    },
            ].map(({ key, icon: Icon, label, sub }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`pi-tab flex items-center gap-2.5 px-5 py-3 text-[13px] font-semibold ${activeTab === key ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
                <span className={`text-[10px] font-normal ml-0.5 ${activeTab === key ? 'text-[#FF5934]/70' : 'text-[#9CA3AF]'}`}>
                  {sub}
                </span>
              </button>
            ))}
          </div>

          {/* ── Stats row ── */}
          <div className="px-5 py-4 border-b border-gray-100 bg-[#FAFAFA]">
            {activeTab === 'stock' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { label: 'Total Products',   value: stockStats.total,            color: 'text-[#FF5934]',   filter: ''            },
                  { label: 'Total Qty (Ctns)', value: fmtNum(stockStats.totalQty), color: 'text-blue-500',    filter: ''            },
                  { label: 'In Stock',         value: stockStats.inStock,          color: 'text-emerald-600', filter: 'In Stock'    },
                  { label: 'Low Stock',        value: stockStats.low,              color: 'text-amber-600',   filter: 'Low Stock'   },
                  { label: 'Out of Stock',     value: stockStats.out,              color: 'text-gray-400',    filter: 'Out of Stock'},
                  { label: 'Negative',         value: stockStats.neg,              color: 'text-red-500',     filter: 'Negative'    },
                ].map(({ label, value, color, filter }) => (
                  <div key={label}
                    onClick={() => setStockStatus(prev => prev === filter && filter ? '' : filter)}
                    className={`pi-stat bg-white border rounded-xl px-3 py-3 cursor-pointer
                      ${stockStatus === filter && filter ? 'border-[#FF5934] ring-2 ring-[#FF5934]/15' : 'border-gray-100'}`}
                  >
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
                  { label: 'Total UM Qty',    value: `${fmtNum(salesStats.totalQty)} Ctns`, color: 'text-sky-600'     },
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

          {/* ── Filter bar ── */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">

            {/* Search */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
              <MdSearch size={17} className="text-[#9CA3AF] flex-shrink-0" />
              <input
                type="search"
                value={activeTab === 'stock' ? stockSearch : salesSearch}
                onChange={e => activeTab === 'stock'
                  ? setStockSearch(e.target.value)
                  : setSalesSearch(e.target.value)}
                placeholder={activeTab === 'stock'
                  ? 'Search by product name or code…'
                  : 'Search product, customer, salesperson…'}
                className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              />
              {(activeTab === 'stock' ? stockSearch : salesSearch) && (
                <button
                  onClick={() => activeTab === 'stock' ? setStockSearch('') : setSalesSearch('')}
                  className="text-[#9CA3AF] hover:text-[#FF5934]"
                >
                  <MdClose size={13} />
                </button>
              )}
            </div>

            {/* City — FIX 10: use dedicated handler so page resets */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdLocationOn size={14} className="text-[#9CA3AF]" />
              <select
                value={activeTab === 'stock' ? stockCity : salesCity}
                onChange={activeTab === 'stock'
                  ? handleStockFilterChange(setStockCity)
                  : handleSalesFilterChange(setSalesCity)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[110px] border-none"
              >
                <option value="">All Locations</option>
                {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            {/* Category */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdCategory size={14} className="text-[#9CA3AF]" />
              <select
                value={activeTab === 'stock' ? stockCategory : salesCategory}
                onChange={activeTab === 'stock'
                  ? handleStockFilterChange(setStockCategory)
                  : handleSalesFilterChange(setSalesCategory)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[120px] border-none"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.englishName}</option>)}
              </select>
            </div>

            {/* Brand */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdBrandingWatermark size={14} className="text-[#9CA3AF]" />
              <select
                value={activeTab === 'stock' ? stockBrand : salesBrand}
                onChange={activeTab === 'stock'
                  ? handleStockFilterChange(setStockBrand)
                  : handleSalesFilterChange(setSalesBrand)}
                className="pi-select outline-none text-sm text-[#374151] min-w-[110px] border-none"
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b._id} value={b._id}>{b.englishName}</option>)}
              </select>
            </div>

            {/* Sales-only filters */}
            {activeTab === 'sales' && (
              <>
                <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                  <MdCalendarToday size={14} className="text-[#9CA3AF]" />
                  <input
                    type="date"
                    value={salesDateFrom}
                    onChange={handleSalesFilterChange(setSalesDateFrom)}
                    className="pi-select outline-none text-sm text-[#374151] border-none bg-transparent min-w-[120px]"
                    title="From date"
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                  <MdCalendarToday size={14} className="text-[#9CA3AF]" />
                  <input
                    type="date"
                    value={salesDateTo}
                    onChange={handleSalesFilterChange(setSalesDateTo)}
                    className="pi-select outline-none text-sm text-[#374151] border-none bg-transparent min-w-[120px]"
                    title="To date"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-1.5">
                  <MdPerson size={14} className="text-[#9CA3AF]" />
                  <span className="text-xs text-[#9CA3AF] mr-1">Group:</span>
                  <button
                    className={`pi-groupby-btn ${salesGroupBy === 'product' ? 'active' : ''}`}
                    onClick={() => { setSalesGroupBy('product'); setSalesGroups({}); }}
                  >Product</button>
                  <button
                    className={`pi-groupby-btn ${salesGroupBy === 'salesperson' ? 'active' : ''}`}
                    onClick={() => { setSalesGroupBy('salesperson'); setSalesGroups({}); }}
                  >Salesperson</button>
                </div>
              </>
            )}

            {/* Expand / Collapse */}
            <button
              onClick={activeTab === 'stock' ? toggleAll : toggleAllSales}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all"
            >
              {(activeTab === 'stock' ? allExpanded : allSalesExpanded)
                ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
              {(activeTab === 'stock' ? allExpanded : allSalesExpanded) ? 'Collapse' : 'Expand'} All
            </button>

            {/* Reset — FIX 11: clear all filter state and reset salesGroups */}
            <button
              onClick={() => {
                if (activeTab === 'stock') {
                  setStockSearch('');
                  setStockDebSearch('');
                  setStockCity('');
                  setStockCategory('');
                  setStockBrand('');
                  setStockStatus('');
                  setStockPage(1);
                } else {
                  setSalesSearch('');
                  setSalesDebSearch('');
                  setSalesCity('');
                  setSalesCategory('');
                  setSalesBrand('');
                  setSalesDateFrom('');
                  setSalesDateTo('');
                  setSalesPage(1);
                  setSalesGroups({});
                }
              }}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all"
            >
              <MdRefresh size={15} /> Reset
            </button>
          </div>

          {/* ═══════════════════════════════
              TAB 1: STOCK TABLE
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
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdWarehouse size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No stock data found</p>
                  <p className="text-[#9CA3AF] text-xs">Try adjusting your filters</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {[
                            { label: 'Code',       key: 'productId',    align: 'left',   w: 'w-[140px]' },
                            { label: 'Product',    key: 'englishTitle', align: 'left',   w: ''          },
                            { label: 'PKT in CTN', key: null,           align: 'center', w: 'w-[110px]' },
                            { label: 'Base Unit',  key: null,           align: 'center', w: 'w-[90px]'  },
                            { label: 'Base Qty',   key: 'stock',        align: 'right',  w: 'w-[110px]' },
                            { label: 'UM Unit',    key: null,           align: 'center', w: 'w-[90px]'  },
                            { label: 'UM Qty',     key: null,           align: 'right',  w: 'w-[110px]' },
                            { label: 'Status',     key: null,           align: 'left',   w: 'w-[120px]' },
                          ].map(({ label, key, align, w }) => (
                            <th key={label}
                              className={`text-${align} text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 ${w}`}
                            >
                              {key ? (
                                <button className={`th-btn ${align === 'right' ? 'ml-auto' : ''}`}
                                  onClick={() => thSort(setStockSort, key)}>
                                  {label} <SortIcon sortState={stockSort} col={key} />
                                </button>
                              ) : label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stockGrouped).map(([brand, items]) => {
                          const isOpen     = expandedGroups[brand] !== false;
                          const groupTotal = items.reduce((s, p) => s + parseFloat(p.stock || 0), 0);
                          return (
                            <React.Fragment key={brand}>
                              <tr className="group-row" onClick={() => toggleGroup(brand)}>
                                <td colSpan={8} className="px-4 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen
                                        ? <MdExpandLess size={16} className="text-[#FF5934]" />
                                        : <MdExpandMore size={16} className="text-[#FF5934]" />}
                                      <span className="text-[13px] font-bold text-[#111827]">{brand}</span>
                                      <span className="text-[11px] text-[#9CA3AF] bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                                        {items.length} product{items.length !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    {!isOpen && (
                                      <span className="text-[12px] font-semibold text-[#FF5934]">
                                        Total: {fmtNum(groupTotal)} Ctns
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOpen && (
                                <>
                                  {items.map((p, idx) => {
                                    const sc  = statusStyle(p._status);
                                    const neg = isNeg(p.stock);
                                    return (
                                      <tr key={p._id || idx} className="table-row divide-y divide-gray-50">
                                        <td className="px-4 py-3 pl-10">
                                          <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                                            {p.productId || '—'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <p className="text-[13px] font-medium text-[#111827] leading-tight max-w-xs">{p.englishTitle || '—'}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="text-[12px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded-lg font-mono">{p._pktInCtn}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                        <td className="px-4 py-3 text-right">
                                          <span className={`text-[14px] font-bold ${neg ? 'pi-negative' : 'pi-positive'}`}>
                                            {neg ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                        <td className="px-4 py-3 text-right">
                                          <span className={`text-[13px] font-semibold ${neg ? 'pi-negative' : 'pi-positive'}`}>
                                            {neg ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock)}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${sc.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                            {p._status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="subtotal-row">
                                    <td className="px-4 py-2 pl-10" colSpan={4}>
                                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total — {brand}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-[13px] font-bold ${isNeg(groupTotal) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(groupTotal)}</span>
                                    </td>
                                    <td />
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-[13px] font-bold ${isNeg(groupTotal) ? 'pi-negative' : 'text-[#FF5934]'}`}>{fmtNum(groupTotal)}</span>
                                    </td>
                                    <td />
                                  </tr>
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand total */}
                  <div className="border-t-2 border-[#FFD7CE] bg-[#FFF5F3] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Base Qty</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(stockStats.totalQty)} Ctns</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">UM Qty</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(stockStats.totalQty)} Ctns</p>
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
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage === 1} onClick={() => setStockPage(p => p - 1)}
                      >
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{stockPage}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-[#374151]">{stockTotalPgs}</span>
                      </div>
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage >= stockTotalPgs} onClick={() => setStockPage(p => p + 1)}
                      >
                        <GrFormNext size={16} />
                      </button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Rows</span>
                        <select
                          value={stockLimit}
                          onChange={e => { setStockLimit(Number(e.target.value)); setStockPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none"
                        >
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════
              TAB 2: SALES TABLE
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
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <MdLocalOffer size={24} className="text-gray-300" />
                  </div>
                  <p className="text-[#9CA3AF] text-sm font-medium">No orders found</p>
                  <p className="text-[#9CA3AF] text-xs">Try adjusting your date range or filters</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {[
                            { label: 'Type',         key: 'txnType',     align: 'center', w: 'w-[80px]'  },
                            { label: 'Product Code', key: 'productCode', align: 'left',   w: 'w-[120px]' },
                            { label: 'Product Name', key: 'productName', align: 'left',   w: ''          },
                            { label: 'Salesperson',  key: 'salesperson', align: 'left',   w: 'w-[130px]' },
                            { label: 'Customer',     key: 'customer',    align: 'left',   w: 'w-[130px]' },
                            { label: 'City',         key: 'city',        align: 'left',   w: 'w-[110px]' },
                            { label: 'Date',         key: 'orderDate',   align: 'left',   w: 'w-[100px]' },
                            { label: 'UM Unit',      key: null,          align: 'center', w: 'w-[80px]'  },
                            { label: 'UM Qty',       key: 'umQty',       align: 'right',  w: 'w-[90px]'  },
                            { label: 'Unit Price',   key: 'price',       align: 'right',  w: 'w-[100px]' },
                            { label: 'Net Amount',   key: 'netAmt',      align: 'right',  w: 'w-[130px]' },
                          ].map(({ label, key, align, w }) => (
                            <th key={label}
                              className={`text-${align} text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3 ${w}`}
                            >
                              {key ? (
                                <button className={`th-btn ${align === 'right' ? 'ml-auto' : ''}`}
                                  onClick={() => thSort(setSalesSort, key)}>
                                  {label} <SortIcon sortState={salesSort} col={key} />
                                </button>
                              ) : label}
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
                                <td colSpan={11} className="px-4 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen
                                        ? <MdExpandLess size={16} className="text-[#FF5934]" />
                                        : <MdExpandMore size={16} className="text-[#FF5934]" />}
                                      <span className="text-[13px] font-bold text-[#111827]">{groupKey}</span>
                                      <span className="text-[11px] text-[#9CA3AF] bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                                        {items.length} line{items.length !== 1 ? 's' : ''}
                                      </span>
                                      {salesGroupBy === 'salesperson' && (
                                        <span className="text-[11px] text-[#9CA3AF] bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full ml-1">
                                          {[...new Set(items.map(r => r.productId))].length} products
                                        </span>
                                      )}
                                    </div>
                                    {!isOpen && (
                                      <div className="flex items-center gap-4">
                                        <span className="text-[12px] text-[#9CA3AF]">
                                          Qty: <span className="font-semibold text-[#111827]">{fmtNum(grpQty)}</span>
                                        </span>
                                        <span className="text-[12px] font-semibold text-[#FF5934]">{fmtAmt(grpAmt)}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isOpen && (
                                <>
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
                                    return (
                                      <tr key={`${r.orderId}-${idx}`} className="table-row">
                                        <td className="px-3 py-2.5 pl-10">
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusBadge}`}>
                                            <MdLogin size={10} /> {r.txnType}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span className="text-[11px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                                            {r.productCode}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <p className="text-[12px] font-medium text-[#111827] leading-tight">{r.productName}</p>
                                          <p className="text-[10px] text-[#9CA3AF] mt-0.5">{r.brand} · {r.category}</p>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-[9px] font-bold text-purple-600 flex-shrink-0">
                                              {r.salesperson.charAt(0).toUpperCase()}
                                            </span>
                                            <span className="text-[12px] text-[#374151]">{r.salesperson}</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span className="text-[12px] text-[#374151]">{r.customer}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-1">
                                            <MdLocationOn size={11} className="text-[#9CA3AF] flex-shrink-0" />
                                            <span className="text-[11px] text-[#374151] font-medium">{r.city}</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span className="text-[11px] text-[#6B7280]">{fmtDate(r.orderDate)}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-[12px] text-[#374151]">{r.umUnit}</td>
                                        <td className="px-3 py-2.5 text-right">
                                          <span className="text-[13px] font-bold text-[#111827]">{fmtNum(r.umQty)}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <span className="text-[12px] text-[#374151]">{fmtAmt(r.price)}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                          <span className={`text-[13px] font-bold ${isNeg(r.netAmt) ? 'pi-negative' : 'pi-positive'}`}>
                                            {isNeg(r.netAmt)
                                              ? `(Rs. ${fmtNum(Math.abs(r.netAmt))})`
                                              : fmtAmt(r.netAmt)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  <tr className="subtotal-row">
                                    <td colSpan={8} className="px-4 py-2 pl-10">
                                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                        Total — {groupKey}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <span className="text-[13px] font-bold text-[#FF5934]">{fmtNum(grpQty)}</span>
                                    </td>
                                    <td />
                                    <td className="px-3 py-2 text-right">
                                      <span className="text-[13px] font-bold text-[#FF5934]">{fmtAmt(grpAmt)}</span>
                                    </td>
                                  </tr>
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand total footer */}
                  <div className="border-t-2 border-[#FFD7CE] bg-[#FFF5F3] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Grand Total</span>
                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Total UM Qty</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtNum(salesStats.totalQty)} Ctns</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest">Total Net Amount</p>
                        <p className="text-[15px] font-bold text-[#FF5934]">{fmtAmt(salesStats.totalAmt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                      {salesStats.totalRows} line{salesStats.totalRows !== 1 ? 's' : ''} ·{' '}
                      {salesStats.uniqueOrders} order{salesStats.uniqueOrders !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)}
                      >
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{salesPage}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-[#374151]">{salesTotalPgs}</span>
                      </div>
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage >= salesTotalPgs} onClick={() => setSalesPage(p => p + 1)}
                      >
                        <GrFormNext size={16} />
                      </button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Orders/page</span>
                        <select
                          value={salesLimit}
                          onChange={e => { setSalesLimit(Number(e.target.value)); setSalesPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
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