import React, { useState, useMemo, useEffect, useRef } from 'react';
import { getDatas, getAllCategories, getAllBrands, getAllCities } from '../APIS';
import { GrFormPrevious, GrFormNext } from 'react-icons/gr';
import {
  MdInventory2, MdSearch, MdFilterList, MdDownload, MdRefresh,
  MdLocationOn, MdCategory, MdBrandingWatermark, MdWarehouse,
  MdClose, MdTrendingUp, MdBarChart, MdLocalOffer, MdExpandMore,
  MdExpandLess, MdLogin,
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

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const ProductAndInventory = () => {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'sales'

  /* ── shared filter options ── */
  const [categories, setCategories] = useState([]);
  const [brands,     setBrands]     = useState([]);
  const [cities,     setCities]     = useState([]);

  useEffect(() => {
    getAllCategories().then(r => setCategories(r.data.data || [])).catch(() => {});
    getAllBrands()     .then(r => setBrands(r.data.data     || [])).catch(() => {});
    getAllCities()     .then(r => setCities(r.data.data     || [])).catch(() => {});
  }, []);

  /* ══════════════════════════════════════
     TAB 1 — STOCK (Product Stock by Location/Batch)
     Columns: Code | Product | PKT in CTN | Base Unit | Base Qty | UM Unit | UM Qty | Status
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

  useEffect(() => {
    const t = setTimeout(() => { setStockDebSearch(stockSearch); setStockPage(1); }, 500);
    return () => clearTimeout(t);
  }, [stockSearch]);

  const fetchStock = async () => {
    setStockLoading(true); setStockError(null);
    try {
      const p = new URLSearchParams();
      p.append('page', stockPage); p.append('limit', stockLimit);
      if (stockDebSearch) p.append('searchTerm', stockDebSearch);
      if (stockCity)      p.append('city', stockCity);
      if (stockCategory)  p.append('category', stockCategory);
      if (stockBrand)     p.append('brand', stockBrand);
      const res = await getDatas(`/product/search?${p.toString()}`);
      setStockData(res.data.data || []);
      setStockTotalPgs(res.data.totalPages || 1);
    } catch (e) {
      setStockError(e?.response?.data?.message || e.message || 'Failed to fetch');
      setStockData([]);
    } finally { setStockLoading(false); }
  };
  useEffect(() => { fetchStock(); }, [stockPage, stockLimit, stockDebSearch, stockCity, stockCategory, stockBrand]);

  const resolveName = (field, list, key = 'englishName') => {
    if (!field) return '—';
    if (typeof field === 'object') return field[key] || field.name || '—';
    const f = list.find(i => i._id === field);
    return f ? f[key] || f.name || field : field;
  };

  const enrichedStock = useMemo(() => stockData.map(p => ({
    ...p,
    _category: resolveName(p.category || p.categoryID, categories),
    _brand:    resolveName(p.brand    || p.brandID,    brands),
    _city:     resolveName(p.cityID,                   cities, 'name'),
    _status:   getStockStatus(p.stock),
    _pktInCtn: p.cortanSize ? `1x${p.cortanSize}` : '—',
  })), [stockData, categories, brands, cities]);

  /* group by brand for the Excel-like grouped view */
  const stockGrouped = useMemo(() => {
    let rows = stockStatus ? enrichedStock.filter(p => p._status === stockStatus) : enrichedStock;
    rows = [...rows].sort((a, b) => {
      const av = String(a[stockSort.key] ?? '').toLowerCase();
      const bv = String(b[stockSort.key] ?? '').toLowerCase();
      return stockSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    // group by brand
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
      total:   all.length,
      inStock: all.filter(p => p._status === 'In Stock').length,
      low:     all.filter(p => p._status === 'Low Stock').length,
      out:     all.filter(p => p._status === 'Out of Stock').length,
      neg:     all.filter(p => p._status === 'Negative').length,
      totalQty: all.reduce((s, p) => s + parseFloat(p.stock || 0), 0),
    };
  }, [enrichedStock]);

  const toggleGroup = (g) => setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
  const allExpanded = Object.keys(stockGrouped).every(g => expandedGroups[g] !== false);
  const toggleAll = () => {
    const val = !allExpanded;
    const next = {};
    Object.keys(stockGrouped).forEach(g => { next[g] = val; });
    setExpandedGroups(next);
  };

  /* init all groups expanded */
  useEffect(() => {
    const next = {};
    Object.keys(stockGrouped).forEach(g => {
      if (expandedGroups[g] === undefined) next[g] = true;
    });
    if (Object.keys(next).length) setExpandedGroups(prev => ({ ...prev, ...next }));
  }, [stockGrouped]);

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
    ws['!cols'] = [18,14,45,12,12,12,10,12,14].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock by Location');
    XLSX.writeFile(wb, `product-stock-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  /* ══════════════════════════════════════
     TAB 2 — SALES (Product Sale Summary)
     Columns: Type | Product Code | Product Name | UM Unit | UM Qty | Net Amount
  ══════════════════════════════════════ */
  const [salesData,      setSalesData]      = useState([]);
  const [salesLoading,   setSalesLoading]   = useState(false);
  const [salesError,     setSalesError]     = useState(null);
  const [salesPage,      setSalesPage]      = useState(1);
  const [salesTotalPgs,  setSalesTotalPgs]  = useState(1);
  const [salesLimit,     setSalesLimit]     = useState(15);
  const [salesSearch,    setSalesSearch]    = useState('');
  const [salesDebSearch, setSalesDebSearch] = useState('');
  const [salesCity,      setSalesCity]      = useState('');
  const [salesCategory,  setSalesCategory]  = useState('');
  const [salesBrand,     setSalesBrand]     = useState('');
  const [salesSort,      setSalesSort]      = useState({ key: 'englishTitle', dir: 'asc' });
  const [salesGroups,    setSalesGroups]    = useState({});

  useEffect(() => {
    const t = setTimeout(() => { setSalesDebSearch(salesSearch); setSalesPage(1); }, 500);
    return () => clearTimeout(t);
  }, [salesSearch]);

  const fetchSales = async () => {
    setSalesLoading(true); setSalesError(null);
    try {
      const p = new URLSearchParams();
      p.append('page', salesPage); p.append('limit', salesLimit);
      if (salesDebSearch) p.append('searchTerm', salesDebSearch);
      if (salesCity)      p.append('city', salesCity);
      if (salesCategory)  p.append('category', salesCategory);
      if (salesBrand)     p.append('brand', salesBrand);
      const res = await getDatas(`/product/search?${p.toString()}`);
      setSalesData(res.data.data || []);
      setSalesTotalPgs(res.data.totalPages || 1);
    } catch (e) {
      setSalesError(e?.response?.data?.message || e.message || 'Failed to fetch');
      setSalesData([]);
    } finally { setSalesLoading(false); }
  };
  useEffect(() => { if (activeTab === 'sales') fetchSales(); }, [salesPage, salesLimit, salesDebSearch, salesCity, salesCategory, salesBrand, activeTab]);

  const enrichedSales = useMemo(() => salesData.map(p => ({
    ...p,
    _category: resolveName(p.category || p.categoryID, categories),
    _brand:    resolveName(p.brand    || p.brandID,    brands),
    _city:     resolveName(p.cityID,                   cities, 'name'),
    /* For sales: qty sold = stock (approximation since no separate sales API endpoint), price = price */
    _umQty:    p.stock || 0,
    _netAmt:   (p.stock || 0) * (p.price || 0),
  })), [salesData, categories, brands, cities]);

  const salesGrouped = useMemo(() => {
    let rows = [...enrichedSales].sort((a, b) => {
      const av = String(a[salesSort.key] ?? '').toLowerCase();
      const bv = String(b[salesSort.key] ?? '').toLowerCase();
      return salesSort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    const groups = {};
    rows.forEach(p => {
      const g = p._brand || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    return groups;
  }, [enrichedSales, salesSort]);

  /* init sales groups expanded */
  useEffect(() => {
    const next = {};
    Object.keys(salesGrouped).forEach(g => {
      if (salesGroups[g] === undefined) next[g] = true;
    });
    if (Object.keys(next).length) setSalesGroups(prev => ({ ...prev, ...next }));
  }, [salesGrouped]);

  const toggleSalesGroup = (g) => setSalesGroups(prev => ({ ...prev, [g]: !prev[g] }));

  const salesStats = useMemo(() => {
    const totalQty = enrichedSales.reduce((s, p) => s + parseFloat(p._umQty || 0), 0);
    const totalAmt = enrichedSales.reduce((s, p) => s + parseFloat(p._netAmt || 0), 0);
    return { total: enrichedSales.length, totalQty, totalAmt };
  }, [enrichedSales]);

  const exportSales = () => {
    if (!enrichedSales.length) return;
    const rows = [];
    Object.entries(salesGrouped).forEach(([brand, items]) => {
      rows.push({ 'Brand/Group': brand, Type: '', 'Product Code': '', 'Product Name': '', 'UM Unit': '', 'UM Qty': '', 'Net Amount': '' });
      items.forEach(p => {
        rows.push({
          'Brand/Group': '',
          Type:          'stock',
          'Product Code':p.productId || '—',
          'Product Name':p.englishTitle || '—',
          'UM Unit':     'Ctns',
          'UM Qty':      parseFloat(p._umQty),
          'Net Amount':  parseFloat(p._netAmt),
        });
      });
      const totQty = items.reduce((s, p) => s + parseFloat(p._umQty || 0), 0);
      const totAmt = items.reduce((s, p) => s + parseFloat(p._netAmt || 0), 0);
      rows.push({ 'Brand/Group': `Total — ${brand}`, Type: '', 'Product Code': '', 'Product Name': '', 'UM Unit': '', 'UM Qty': totQty, 'Net Amount': totAmt });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [18,10,16,45,10,14,18].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product Sale Summary');
    XLSX.writeFile(wb, `product-sales-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  /* ══ shared sort icon ══ */
  const SortIcon = ({ sortState, col }) => (
    <span className={`ml-1 text-[10px] ${sortState.key === col ? 'text-[#FF5934]' : 'text-gray-300'}`}>
      {sortState.key === col ? (sortState.dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

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
        .grand-total-row td { background: linear-gradient(135deg, #FF5934/5 0%, #fff 100%); border-top: 2px solid #FFD7CE; }
      `}</style>

      <div className="pi-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Product & Inventory</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {activeTab === 'stock'
                ? `${stockStats.total} products · Total stock: ${fmtNum(stockStats.totalQty)} Ctns`
                : `${salesStats.total} products · Total qty: ${fmtNum(salesStats.totalQty)} Ctns · ${fmtAmt(salesStats.totalAmt)}`}
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
              disabled={activeTab === 'stock' ? !enrichedStock.length : !enrichedSales.length}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] disabled:bg-gray-100 disabled:text-gray-300 text-white text-sm font-bold px-4 h-10 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdDownload size={16} /> Export Excel
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-visible">

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-3 pt-2 gap-1">
            {[
              { key: 'stock', icon: MdWarehouse,   label: 'Product Stock',        sub: 'By Location / Batch' },
              { key: 'sales', icon: MdLocalOffer,   label: 'Product Sale Summary', sub: 'By Product'          },
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
                  { label: 'Total Products', value: stockStats.total,           color: 'text-[#FF5934]',   bg: 'bg-[#FF5934]/10', filter: ''           },
                  { label: 'Total Qty (Ctns)', value: fmtNum(stockStats.totalQty), color: 'text-blue-500', bg: 'bg-blue-50',      filter: ''           },
                  { label: 'In Stock',        value: stockStats.inStock,        color: 'text-emerald-600', bg: 'bg-emerald-50',   filter: 'In Stock'   },
                  { label: 'Low Stock',       value: stockStats.low,            color: 'text-amber-600',   bg: 'bg-amber-50',     filter: 'Low Stock'  },
                  { label: 'Out of Stock',    value: stockStats.out,            color: 'text-gray-400',    bg: 'bg-gray-50',      filter: 'Out of Stock'},
                  { label: 'Negative',        value: stockStats.neg,            color: 'text-red-500',     bg: 'bg-red-50',       filter: 'Negative'   },
                ].map(({ label, value, color, bg, filter }) => (
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
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Products',  value: salesStats.total,               color: 'text-[#FF5934]'   },
                  { label: 'Total UM Qty',    value: `${fmtNum(salesStats.totalQty)} Ctns`, color: 'text-blue-500'  },
                  { label: 'Total Net Amount',value: fmtAmt(salesStats.totalAmt),    color: 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="pi-stat bg-white border border-gray-100 rounded-xl px-4 py-3 cursor-default">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                    <p className={`text-[15px] font-bold ${color}`}>{value}</p>
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
                onChange={e => activeTab === 'stock' ? setStockSearch(e.target.value) : setSalesSearch(e.target.value)}
                placeholder="Search by product name or code…"
                className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              />
              {(activeTab === 'stock' ? stockSearch : salesSearch) && (
                <button onClick={() => activeTab === 'stock' ? setStockSearch('') : setSalesSearch('')}
                  className="text-[#9CA3AF] hover:text-[#FF5934]"><MdClose size={13} /></button>
              )}
            </div>

            {/* City */}
            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
              <MdLocationOn size={14} className="text-[#9CA3AF]" />
              <select
                value={activeTab === 'stock' ? stockCity : salesCity}
                onChange={e => activeTab === 'stock' ? (setStockCity(e.target.value), setStockPage(1)) : (setSalesCity(e.target.value), setSalesPage(1))}
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
                onChange={e => activeTab === 'stock' ? (setStockCategory(e.target.value), setStockPage(1)) : (setSalesCategory(e.target.value), setSalesPage(1))}
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
                onChange={e => activeTab === 'stock' ? (setStockBrand(e.target.value), setStockPage(1)) : (setSalesBrand(e.target.value), setSalesPage(1))}
                className="pi-select outline-none text-sm text-[#374151] min-w-[110px] border-none"
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b._id} value={b._id}>{b.englishName}</option>)}
              </select>
            </div>

            {/* Expand/Collapse all groups */}
            <button
              onClick={activeTab === 'stock' ? toggleAll : () => {
                const allEx = Object.keys(salesGrouped).every(g => salesGroups[g] !== false);
                const next = {};
                Object.keys(salesGrouped).forEach(g => { next[g] = !allEx; });
                setSalesGroups(next);
              }}
              className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all"
            >
              {allExpanded ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
              {allExpanded ? 'Collapse' : 'Expand'} All
            </button>

            {/* Reset */}
            <button
              onClick={() => {
                if (activeTab === 'stock') {
                  setStockSearch(''); setStockCity(''); setStockCategory(''); setStockBrand(''); setStockStatus(''); setStockPage(1);
                } else {
                  setSalesSearch(''); setSalesCity(''); setSalesCategory(''); setSalesBrand(''); setSalesPage(1);
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
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[140px]">
                            <button className="th-btn" onClick={() => setStockSort(s => ({ key: 'productId', dir: s.key === 'productId' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Code <SortIcon sortState={stockSort} col="productId" />
                            </button>
                          </th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">
                            <button className="th-btn" onClick={() => setStockSort(s => ({ key: 'englishTitle', dir: s.key === 'englishTitle' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Product <SortIcon sortState={stockSort} col="englishTitle" />
                            </button>
                          </th>
                          <th className="text-center text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[110px]">PKT in CTN</th>
                          <th className="text-center text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[90px]">Base Unit</th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[110px]">
                            <button className="th-btn ml-auto" onClick={() => setStockSort(s => ({ key: 'stock', dir: s.key === 'stock' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Base Qty <SortIcon sortState={stockSort} col="stock" />
                            </button>
                          </th>
                          <th className="text-center text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[90px]">UM Unit</th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[110px]">UM Qty</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[120px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(stockGrouped).map(([brand, items]) => {
                          const isOpen = expandedGroups[brand] !== false;
                          const groupTotal = items.reduce((s, p) => s + parseFloat(p.stock || 0), 0);
                          return (
                            <React.Fragment key={brand}>
                              {/* Group header row */}
                              <tr className="group-row" onClick={() => toggleGroup(brand)}>
                                <td colSpan={8} className="px-4 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen
                                        ? <MdExpandLess size={16} className="text-[#FF5934]" />
                                        : <MdExpandMore size={16} className="text-[#FF5934]" />
                                      }
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
                                        {/* Code */}
                                        <td className="px-4 py-3 pl-10">
                                          <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                                            {p.productId || '—'}
                                          </span>
                                        </td>
                                        {/* Product */}
                                        <td className="px-4 py-3">
                                          <p className="text-[13px] font-medium text-[#111827] leading-tight max-w-xs">
                                            {p.englishTitle || '—'}
                                          </p>
                                        </td>
                                        {/* PKT in CTN */}
                                        <td className="px-4 py-3 text-center">
                                          <span className="text-[12px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded-lg font-mono">
                                            {p._pktInCtn}
                                          </span>
                                        </td>
                                        {/* Base Unit */}
                                        <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                        {/* Base Qty */}
                                        <td className="px-4 py-3 text-right">
                                          <span className={`text-[14px] font-bold ${neg ? 'pi-negative' : 'pi-positive'}`}>
                                            {neg ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock)}
                                          </span>
                                        </td>
                                        {/* UM Unit */}
                                        <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                        {/* UM Qty */}
                                        <td className="px-4 py-3 text-right">
                                          <span className={`text-[13px] font-semibold ${neg ? 'pi-negative' : 'pi-positive'}`}>
                                            {neg ? `(${fmtNum(Math.abs(p.stock))})` : fmtNum(p.stock)}
                                          </span>
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-3">
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${sc.pill}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                            {p._status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* Group subtotal */}
                                  <tr className="subtotal-row">
                                    <td className="px-4 py-2 pl-10" colSpan={4}>
                                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                        Total — {brand}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-[13px] font-bold ${isNeg(groupTotal) ? 'pi-negative' : 'text-[#FF5934]'}`}>
                                        {fmtNum(groupTotal)}
                                      </span>
                                    </td>
                                    <td />
                                    <td className="px-4 py-2 text-right">
                                      <span className={`text-[13px] font-bold ${isNeg(groupTotal) ? 'pi-negative' : 'text-[#FF5934]'}`}>
                                        {fmtNum(groupTotal)}
                                      </span>
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

                  {/* Grand total footer */}
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
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage === 1} onClick={() => setStockPage(p => p - 1)}>
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{stockPage}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-[#374151]">{stockTotalPgs}</span>
                      </div>
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={stockPage >= stockTotalPgs} onClick={() => setStockPage(p => p + 1)}>
                        <GrFormNext size={16} />
                      </button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Rows</span>
                        <select value={stockLimit} onChange={e => { setStockLimit(Number(e.target.value)); setStockPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none">
                          <option value={10}>10</option><option value={15}>15</option>
                          <option value={30}>30</option><option value={50}>50</option>
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
                  <p className="text-[#9CA3AF] text-sm font-medium">No sales data found</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[90px]">Type</th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[130px]">
                            <button className="th-btn" onClick={() => setSalesSort(s => ({ key: 'productId', dir: s.key === 'productId' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Product Code <SortIcon sortState={salesSort} col="productId" />
                            </button>
                          </th>
                          <th className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">
                            <button className="th-btn" onClick={() => setSalesSort(s => ({ key: 'englishTitle', dir: s.key === 'englishTitle' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Product Name <SortIcon sortState={salesSort} col="englishTitle" />
                            </button>
                          </th>
                          <th className="text-center text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[90px]">UM Unit</th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[110px]">
                            <button className="th-btn ml-auto" onClick={() => setSalesSort(s => ({ key: '_umQty', dir: s.key === '_umQty' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              UM Quantity <SortIcon sortState={salesSort} col="_umQty" />
                            </button>
                          </th>
                          <th className="text-right text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 w-[140px]">
                            <button className="th-btn ml-auto" onClick={() => setSalesSort(s => ({ key: '_netAmt', dir: s.key === '_netAmt' && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                              Net Amount <SortIcon sortState={salesSort} col="_netAmt" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(salesGrouped).map(([brand, items]) => {
                          const isOpen = salesGroups[brand] !== false;
                          const grpQty = items.reduce((s, p) => s + parseFloat(p._umQty || 0), 0);
                          const grpAmt = items.reduce((s, p) => s + parseFloat(p._netAmt || 0), 0);
                          return (
                            <React.Fragment key={brand}>
                              {/* Group header */}
                              <tr className="group-row" onClick={() => toggleSalesGroup(brand)}>
                                <td colSpan={6} className="px-4 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isOpen
                                        ? <MdExpandLess size={16} className="text-[#FF5934]" />
                                        : <MdExpandMore size={16} className="text-[#FF5934]" />
                                      }
                                      <span className="text-[13px] font-bold text-[#111827]">{brand}</span>
                                      <span className="text-[11px] text-[#9CA3AF] bg-white border border-gray-100 px-2 py-0.5 rounded-full">
                                        {items.length} product{items.length !== 1 ? 's' : ''}
                                      </span>
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

                              {isOpen && (
                                <>
                                  {items.map((p, idx) => (
                                    <tr key={p._id || idx} className="table-row">
                                      {/* Type */}
                                      <td className="px-4 py-3 pl-10">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 ring-1 ring-blue-200">
                                          <MdLogin size={10} /> stock
                                        </span>
                                      </td>
                                      {/* Product Code */}
                                      <td className="px-4 py-3">
                                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                                          {p.productId || '—'}
                                        </span>
                                      </td>
                                      {/* Product Name */}
                                      <td className="px-4 py-3">
                                        <p className="text-[13px] font-medium text-[#111827] leading-tight max-w-xs">
                                          {p.englishTitle || '—'}
                                        </p>
                                      </td>
                                      {/* UM Unit */}
                                      <td className="px-4 py-3 text-center text-[13px] text-[#374151]">Ctns</td>
                                      {/* UM Qty */}
                                      <td className="px-4 py-3 text-right">
                                        <span className="text-[14px] font-bold text-[#111827]">{fmtNum(p._umQty)}</span>
                                      </td>
                                      {/* Net Amount */}
                                      <td className="px-4 py-3 text-right">
                                        <span className={`text-[13px] font-bold ${isNeg(p._netAmt) ? 'pi-negative' : 'pi-positive'}`}>
                                          {isNeg(p._netAmt)
                                            ? `(Rs. ${fmtNum(Math.abs(p._netAmt))})`
                                            : fmtAmt(p._netAmt)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}

                                  {/* Group subtotal */}
                                  <tr className="subtotal-row">
                                    <td colSpan={4} className="px-4 py-2 pl-10">
                                      <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                        Total — {brand}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      <span className="text-[13px] font-bold text-[#FF5934]">{fmtNum(grpQty)}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right">
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
                      {enrichedSales.length} product{enrichedSales.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage === 1} onClick={() => setSalesPage(p => p - 1)}>
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
                        <span className="font-semibold text-[#FF5934]">{salesPage}</span>
                        <span className="text-gray-300">/</span>
                        <span className="text-[#374151]">{salesTotalPgs}</span>
                      </div>
                      <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        disabled={salesPage >= salesTotalPgs} onClick={() => setSalesPage(p => p + 1)}>
                        <GrFormNext size={16} />
                      </button>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-[#9CA3AF]">Rows</span>
                        <select value={salesLimit} onChange={e => { setSalesLimit(Number(e.target.value)); setSalesPage(1); }}
                          className="pi-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none">
                          <option value={10}>10</option><option value={15}>15</option>
                          <option value={30}>30</option><option value={50}>50</option>
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