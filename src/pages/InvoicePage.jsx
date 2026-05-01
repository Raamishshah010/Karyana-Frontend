import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  getAllSalesPersons, getCoordinatorOrders, getOrders, getWarhouseManagerOrders
} from "../APIS";
import { Loader } from '../components/common/loader';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye, FaFileExcel, FaFilePdf } from "react-icons/fa6";
import DateRangePicker from "../components/DateRangePicker";
import { toast } from 'react-toastify';
import { ROLES } from '../utils';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import EscapeClose from '../components/EscapeClose';
import { useSelector } from 'react-redux';
import {
  MdSearch, MdClose, MdRefresh, MdPerson, MdStore,
  MdCalendarToday, MdLocationOn, MdPhone, MdShoppingBag,
  MdCheckCircle, MdOutlineInventory2, MdFilterList,
} from "react-icons/md";

const ALLOWED_STATUSES = ['Completed', 'Satelment'];
const LIMIT = 10;
const FETCH_ALL_LIMIT = 1000;

/* ── Helpers ── */
const getOrderDateKey = (order) => {
  const source = order?.createdAt || order?.date || order?.expectedDelivery;
  if (!source) return '';
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
};

const orderMatchesFilters = (order, { term = '', sd = '', ed = '', salesperson = '', status = '' }) => {
  if (!ALLOWED_STATUSES.includes(order?.status)) return false;
  const q = String(term || '').trim().toLowerCase();
  if (q) {
    const searchable = [order?._id, order?.RetailerUser?.name, order?.SaleUser?.name].filter(Boolean).join(' ').toLowerCase();
    if (!searchable.includes(q)) return false;
  }
  const dateKey = getOrderDateKey(order);
  if (sd && (!dateKey || dateKey < sd)) return false;
  if (ed && (!dateKey || dateKey > ed)) return false;
  if (salesperson) {
    const saleUserId = order?.SaleUser?._id || order?.SaleUser;
    if (String(saleUserId || '') !== String(salesperson)) return false;
  }
  if (status && String(order?.status || '') !== String(status)) return false;
  return true;
};

const paginate = (rows, page, limit) => {
  const start = (page - 1) * limit;
  return rows.slice(start, start + limit);
};

const statusColor = (status) => {
  const map = {
    'Delivered':  'bg-emerald-50 text-emerald-600 ring-emerald-200',
    'Satelment':  'bg-orange-50 text-orange-500 ring-orange-200',
  };
  return map[status] || 'bg-gray-50 text-gray-500 ring-gray-200';
};

const statusDot = (status) => {
  const map = {
    'Delivered':  'bg-emerald-400',
    'Satelment':  'bg-orange-400',
  };
  return map[status] || 'bg-gray-400';
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};

/* ── Direct PDF Download Function ── */
const generateProfessionalPDF = (order) => {
  const hasDiscount = (oi) => Number(oi.discountedPrice) > 0 && Number(oi.discountedPrice) < Number(oi.price);
  const unitLabel = (type) => type === 'ctn' ? 'Ctns' : type === 'piece' ? 'PCS' : type || 'Unit';

  const invoiceRows = (order.items || []).map((oi, idx) => {
    const rate = Number(oi.price || 0);
    const qty = Number(oi.quantity || 0);
    const discPrice = Number(oi.discountedPrice || 0);
    const actualPrice = hasDiscount(oi) ? discPrice : rate;
    const amount = qty * actualPrice;
    const discPercent = hasDiscount(oi) ? Math.round(((rate - discPrice) / rate) * 100) : 0;
    const discAmount = qty * (rate - actualPrice);

    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${oi.productId?.productId || 'N/A'}</td>
        <td>${oi.productId?.englishTitle || '—'}</td>
        <td>1X4</td>
        <td>${qty}</td>
        <td>${unitLabel(oi.type)}</td>
        <td>${rate.toFixed(0)}</td>
        <td>${amount.toFixed(2)}</td>
        <td>${discPercent}%</td>
        <td>${discAmount.toFixed(2)}</td>
        <td>${amount.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const subtotal = (order.items || []).reduce((s, oi) => {
    const rate = Number(oi.price || 0);
    const qty = Number(oi.quantity || 0);
    const discPrice = Number(oi.discountedPrice || 0);
    const actualPrice = hasDiscount(oi) ? discPrice : rate;
    return s + (qty * actualPrice);
  }, 0);

  const totalDiscount = (order.items || []).reduce((s, oi) => {
    const rate = Number(oi.price || 0);
    const qty = Number(oi.quantity || 0);
    const discPrice = Number(oi.discountedPrice || 0);
    return s + qty * (rate - discPrice);
  }, 0);

  const total = order.total || subtotal;
  const freight = 0;
  const ledgerBalance = order.RetailerUser?.balance || 0;
  const cnic = order.RetailerUser?.cnic || '';

  const htmlElement = document.createElement('div');
  htmlElement.innerHTML = `
    <div style="font-family: 'Segoe UI', Arial; color: #111827; padding: 15px; line-height: 1.3; max-width: 900px;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0080FF; padding-bottom: 10px; margin-bottom: 15px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #0080FF;">SM NETWORKING</div>
          <div style="font-size: 9px; color: #9CA3AF;">Website: iandunetworks.com</div>
        </div>
        <div style="text-align: right; font-size: 10px;">
          <div style="font-size: 14px; font-weight: 700; color: #0080FF; margin-bottom: 4px;">INVOICE</div>
          <p><b>Account No:</b> ${order.RetailerUser?.userId || 'N/A'}</p>
          <p>${order.RetailerUser?.shopName || order.RetailerUser?.name}</p>
          <p><b>Inv No:</b> ${order._id.slice(-6).toUpperCase()}</p>
          <p><b>Date:</b> ${formatDate(order.createdAt)}</p>
          <p><b>Doc No:</b> ${order.orderId?.slice(-6).toUpperCase() || 'N/A'}</p>
        </div>
      </div>

      <!-- Account Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 15px;">
        <div style="border: 1px solid #ddd; padding: 8px; background: #fafafa; border-radius: 3px;">
          <div style="font-size: 8px; font-weight: 700; color: #999; margin-bottom: 2px; text-transform: uppercase;">Account No</div>
          <div style="font-size: 10px; font-weight: 600;">${order.RetailerUser?.userId || 'N/A'}</div>
          <div style="font-size: 9px; margin: 2px 0;">${order.RetailerUser?.shopName || order.RetailerUser?.name}</div>
          <div style="font-size: 8px; color: #666;">${order.RetailerUser?.city || '—'}</div>
          <div style="font-size: 8px; font-weight: 700; color: #999; margin-top: 4px;">Mobile</div>
          <div style="font-size: 8px; color: #666;">${order.phoneNumber || order.RetailerUser?.phoneNumber || '—'}</div>
          ${cnic ? `<div style="font-size: 8px; font-weight: 700; color: #999; margin-top: 4px;">CNIC</div><div style="font-size: 8px; color: #666;">${cnic}</div>` : ''}
        </div>
        <div style="border: 1px solid #ddd; padding: 8px; background: #fafafa; border-radius: 3px;">
          <div style="font-size: 8px; font-weight: 700; color: #999; margin-bottom: 2px; text-transform: uppercase;">Salesperson</div>
          <div style="font-size: 10px; font-weight: 600;">${order.SaleUser?.name || '—'}</div>
          <div style="font-size: 8px; color: #666;">Sales ID: ${order.SaleUser?.salesId || '—'}</div>
          ${order.SaleUser?.address ? `<div style="font-size: 8px; font-weight: 700; color: #999; margin-top: 4px;">Address</div><div style="font-size: 8px; color: #666;">${order.SaleUser?.address}</div>` : ''}
        </div>
        <div style="border: 1px solid #ddd; padding: 8px; background: #fafafa; border-radius: 3px;">
          <div style="font-size: 8px; font-weight: 700; color: #999; margin-bottom: 2px; text-transform: uppercase;">Delivery</div>
          <div style="font-size: 9px; color: #333;">${order.shippingAddress || order.RetailerUser?.shopAddress1 || '—'}</div>
          <div style="font-size: 8px; font-weight: 700; color: #999; margin-top: 4px;">Payment</div>
          <div style="font-size: 10px; font-weight: 600;">${order.paymentType?.toUpperCase() || 'COD'}</div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8px;">
        <thead style="background: #0080FF; color: white;">
          <tr>
            <th style="padding: 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.3);">SrNo</th>
            <th style="padding: 6px; text-align: left; border-right: 1px solid rgba(255,255,255,0.3);">Code</th>
            <th style="padding: 6px; text-align: left; border-right: 1px solid rgba(255,255,255,0.3);">Product Name</th>
            <th style="padding: 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.3);">PKT</th>
            <th style="padding: 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.3);">Qty</th>
            <th style="padding: 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.3);">UM</th>
            <th style="padding: 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.3);">Rate</th>
            <th style="padding: 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.3);">Amount</th>
            <th style="padding: 6px; text-align: center; border-right: 1px solid rgba(255,255,255,0.3);">Dis %</th>
            <th style="padding: 6px; text-align: right; border-right: 1px solid rgba(255,255,255,0.3);">Discount</th>
            <th style="padding: 6px; text-align: right;">Net</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceRows}
        </tbody>
      </table>

      <!-- Summary -->
      <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
        <div style="width: 200px; font-size: 9px;">
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #ddd;">
            <span>Sub Total:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #ddd;">
            <span>Discount:</span>
            <span>(${totalDiscount.toFixed(2)})</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #ddd;">
            <span>Freight:</span>
            <span>(${freight.toFixed(2)})</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #0080FF; background: #f0f0f0; font-weight: 700;">
            <span>Total:</span>
            <span>Rs. ${total.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 5px 8px;">
            <span>Ledger Balance:</span>
            <span>${ledgerBalance.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div style="margin-top: 12px; padding: 8px; border: 1px solid #ddd; background: #f9f9f9; border-radius: 3px; font-size: 8px;">
        <div style="font-weight: 700; color: #999; margin-bottom: 3px;">NOTES</div>
        <div style="color: #666; line-height: 1.4;">
          <p>صرف کمپن کے مجاز بین کھاتوں میں ادائی کریں۔</p>
          <p>The company will not be responsible for cash given to any Salesperson (TSM/ASM)</p>
        </div>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 20px; font-size: 8px;">
        <div style="width: 25%; text-align: center;">
          <div style="border-top: 1px solid #111827; margin: 15px 0 2px;"></div>
          <div style="font-weight: 600;">Prepared By</div>
        </div>
        <div style="width: 25%; text-align: center;">
          <div style="border-top: 1px solid #111827; margin: 15px 0 2px;"></div>
          <div style="font-weight: 600;">Approved By</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 15px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7px; color: #999;">
        <p>This is a system generated invoice and does not require any signatures.</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Invoice_${order._id.slice(-6).toUpperCase()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
  };

  html2pdf().set(opt).from(htmlElement).save().catch(err => {
    console.error('PDF Error:', err);
    toast.error('Failed to generate PDF');
  });
};

/* ── Excel Export ── */
const generateExcel = (order) => {
  const excelData = (order.items || []).map((oi, idx) => ({
    'SrNo': idx + 1,
    'Code': oi.productId?.productId || '',
    'Product Name': oi.productId?.englishTitle || '',
    'PKT/CTN': '1X4',
    'Quantity': oi.quantity || '',
    'UM': oi.type === 'ctn' ? 'Ctns' : oi.type === 'piece' ? 'PCS' : oi.type || '',
    'Rate': oi.price?.toFixed(2) || '',
    'Amount': (oi.quantity && oi.price) ? (oi.quantity * oi.price).toFixed(2) : '',
    'Dis %': oi.discountedPrice && Number(oi.discountedPrice) < Number(oi.price) 
      ? Math.round(((Number(oi.price) - Number(oi.discountedPrice)) / Number(oi.price)) * 100)
      : '',
    'Discount': oi.discountedPrice && Number(oi.discountedPrice) < Number(oi.price)
      ? (oi.quantity * (Number(oi.price) - Number(oi.discountedPrice))).toFixed(2)
      : '',
    'Net': oi.discountedPrice && Number(oi.discountedPrice) < Number(oi.price)
      ? (oi.quantity * Number(oi.discountedPrice)).toFixed(2)
      : (oi.quantity && oi.price) ? (oi.quantity * oi.price).toFixed(2) : '',
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  ws['!cols'] = [
    { wch: 5 }, { wch: 10 }, { wch: 25 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
    { wch: 8 }, { wch: 12 }, { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
  XLSX.writeFile(wb, `Invoice_${order._id.slice(-6).toUpperCase()}.xlsx`);
};

const SalesInvoices = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [show, setShow] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const sidebarRef = useRef(null);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [salesPersons, setSalesPersons] = useState([]);

  const { role, user } = useSelector((state) => state.admin);
  const roleValue = Array.isArray(role) ? role.join(',') : String(role || '');
  const isCoordinator = roleValue.includes(ROLES[1]);
  const isWarehouse = roleValue.includes(ROLES[2]);

  const filterCount = useMemo(() =>
    [selectedSalesPerson, selectedStatus, startDate || endDate, searchTerm].filter(Boolean).length,
    [selectedSalesPerson, selectedStatus, startDate, endDate, searchTerm]
  );

  const handleEscape = useCallback(() => setShow(false), []);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && show) handleEscape(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [show, handleEscape]);

  useEffect(() => {
    getAllSalesPersons()
      .then(res => setSalesPersons(res.data.data || []))
      .catch(() => {});
  }, []);

  const doFetch = useCallback(async ({ page = 1, term = '', sd = '', ed = '', salesperson = '', status = '' } = {}) => {
    try {
      setLoading(true);
      let rows = [];
      if (isWarehouse) {
        const res = await getWarhouseManagerOrders(1, FETCH_ALL_LIMIT);
        rows = res.data.data ?? [];
      } else if (isCoordinator) {
        const res = await getCoordinatorOrders(1, FETCH_ALL_LIMIT, user?.city);
        rows = res.data.data ?? [];
      } else {
        const res = await getOrders(1, FETCH_ALL_LIMIT);
        rows = res.data.data ?? [];
      }

      const filterState = { term, sd, ed, salesperson, status };
      const filtered = rows.filter(order => orderMatchesFilters(order, filterState));

      setData(paginate(filtered, page, LIMIT));
      setTotalPages(Math.ceil(filtered.length / LIMIT) || 0);
    } catch (error) {
      toast.error(error?.response?.data?.errors?.[0]?.msg || error.message);
    } finally {
      setLoading(false);
    }
  }, [isCoordinator, isWarehouse, user?.city]);

  useEffect(() => {
    if (isCoordinator && !user?.city) return;
    doFetch({ page: currentPage, term: searchTerm, sd: startDate, ed: endDate, salesperson: selectedSalesPerson, status: selectedStatus });
  }, [currentPage, searchTerm, startDate, endDate, selectedSalesPerson, selectedStatus, doFetch, isCoordinator, user?.city]);

  useEffect(() => {
    const h = (e) => { if (sidebarRef.current && !sidebarRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  const dateRangeHandler = useCallback((sd, ed) => {
    setStartDate(sd || '');
    setEndDate(ed || '');
    setCurrentPage(1);
  }, []);

  const handleSalesPersonFilter = useCallback((value) => {
    setSelectedSalesPerson(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((value) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((val) => {
    setSearchTerm(val);
    setCurrentPage(1);
  }, []);

  const refreshData = useCallback(() => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSelectedSalesPerson('');
    setSelectedStatus('');
    setCurrentPage(1);
  }, []);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .inv-page { font-family:'DM Sans','Segoe UI',sans-serif; }
        .inv-page .table-row { transition:background 0.15s,box-shadow 0.15s; }
        .inv-page .table-row:hover { background:#FFFAF9; box-shadow:0 0 0 1px #FFD7CE inset; }
        .inv-page .action-btn { transition:background 0.15s,color 0.15s,transform 0.1s; }
        .inv-page .action-btn:hover { transform:scale(1.1); }
        .inv-page .filter-select { appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:28px; }
      `}</style>

      <div className="inv-page">
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Sales Invoices</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">Completed orders (Delivered & Satelment) · {data.length} on this page</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input value={searchTerm} onChange={e => handleSearchChange(e.target.value)} className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full" type="search" placeholder="Search order ID, retailer…" />
            {searchTerm && (<button onClick={() => handleSearchChange('')} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors flex-shrink-0"><MdClose size={14} /></button>)}
          </div>
          <DateRangePicker submitHandler={dateRangeHandler} sd={startDate} ed={endDate} />
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdPerson size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <select value={selectedSalesPerson} onChange={e => handleSalesPersonFilter(e.target.value)} className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[140px]">
              <option value="">All Sales Persons</option>
              {salesPersons.map(sp => (<option value={sp._id} key={sp._id}>{sp.name}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <select value={selectedStatus} onChange={e => handleStatusFilter(e.target.value)} className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[120px]">
              <option value="">All</option>
              {ALLOWED_STATUSES.map(s => (<option value={s} key={s}>{s}</option>))}
            </select>
          </div>
          {filterCount > 0 && (<button onClick={refreshData} className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all"><MdClose size={14} /> Clear Filters <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none ml-0.5">{filterCount}</span></button>)}
          <button onClick={refreshData} className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all"><MdRefresh size={16} /> Reset</button>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {['Invoice #', 'Account No', 'Retailer', 'Sales Person', 'Date', 'Amount', 'Status', 'Actions'].map(h => (<th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map(item => (
                <tr key={item._id} className="table-row cursor-pointer" onClick={() => { setSelectedItem(item); setShow(true); }}>
                  <td className="px-4 py-3"><span className="font-mono text-[12px] font-bold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">#{item._id.slice(-6).toUpperCase()}</span></td>
                  <td className="px-4 py-3"><span className="text-[12px] font-semibold text-[#374151]">{item.RetailerUser?.userId || '—'}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0"><MdStore size={13} className="text-[#FF5934]" /></div><span className="text-[13px] text-[#374151] font-medium">{item.RetailerUser?.name || '—'}</span></div></td>
                  <td className="px-4 py-3"><span className="text-[13px] text-[#374151]">{item.SaleUser?.name || '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-[12px] text-[#374151]">{formatDate(item.createdAt)}</span></td>
                  <td className="px-4 py-3"><span className="text-[13px] font-semibold text-[#111827]">Rs. {item.total}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${statusColor(item.status)}`}><span className={`w-1.5 h-1.5 rounded-full ${statusDot(item.status)}`} />{item.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); setDownloadingInvoice(item._id + '_excel'); generateExcel(item); setTimeout(() => setDownloadingInvoice(null), 1000); }} className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-500 border border-emerald-100" title="Download Excel" disabled={downloadingInvoice === item._id + '_excel'}>
                        {downloadingInvoice === item._id + '_excel' ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <FaFileExcel size={13} />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); generateProfessionalPDF(item); }} className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 border border-red-100" title="Download PDF"><FaFilePdf size={13} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setShow(true); }} className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100" title="View Details"><FaRegEye size={13} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center"><MdShoppingBag size={24} className="text-gray-300" /></div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No invoices found</p>
                      {filterCount > 0 && (<button onClick={refreshData} className="text-[#FF5934] text-xs hover:underline font-medium">Clear filters</button>)}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-[12px] text-[#9CA3AF]">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><GrFormPrevious size={16} /></button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]"><span className="font-semibold text-[#FF5934]">{currentPage}</span><span className="text-gray-300">/</span><span>{totalPages}</span></div>
            <button className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all" disabled={totalPages <= currentPage} onClick={() => setCurrentPage(p => p + 1)}><GrFormNext size={16} /></button>
          </div>
        </div>

        {show && <EscapeClose onClose={handleEscape} />}
        <div ref={sidebarRef} className={`fixed top-0 right-0 h-full w-full md:w-[480px] bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ${show ? 'translate-x-0' : 'translate-x-full'}`}>
          {show && selectedItem && (
            <>
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-6 flex-shrink-0">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Invoice Details</span>
                  <div className="flex gap-2">
                    <button onClick={() => generateExcel(selectedItem)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"><FaFileExcel size={12} /> Excel</button>
                    <button onClick={() => generateProfessionalPDF(selectedItem)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"><FaFilePdf size={12} /> PDF</button>
                    <button onClick={() => setShow(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"><MdClose size={15} /></button>
                  </div>
                </div>
                <h3 className="text-white font-bold text-[17px]">Invoice #{selectedItem._id.slice(-6).toUpperCase()}</h3>
                <p className="text-white/70 text-[11px] mt-2">{formatDate(selectedItem.createdAt)}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-2">Account Information</p>
                  <p className="text-[12px] font-semibold text-[#111827]">Account No: {selectedItem.RetailerUser?.userId}</p>
                  <p className="text-[13px] font-bold text-[#374151] mt-2">{selectedItem.RetailerUser?.shopName || selectedItem.RetailerUser?.name}</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">{selectedItem.RetailerUser?.shopAddress1}</p>
                  <p className="text-[11px] text-[#6B7280]">{selectedItem.RetailerUser?.shopAddress2}</p>
                  <p className="text-[11px] text-[#6B7280] mt-2">Category: {selectedItem.RetailerUser?.shopCategory}</p>
                  <p className="text-[11px] text-[#6B7280]">Mobile: {selectedItem.phoneNumber || selectedItem.RetailerUser?.phoneNumber}</p>
                </div>

                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-2">Salesperson</p>
                  <p className="text-[13px] font-bold text-[#374151]">{selectedItem.SaleUser?.name}</p>
                  <p className="text-[11px] text-[#6B7280] mt-1">Sales ID: {selectedItem.SaleUser?.salesId}</p>
                  <p className="text-[11px] text-[#6B7280]">Payment: {selectedItem.paymentType?.toUpperCase() || 'COD'}</p>
                </div>

                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-3">Order Items ({selectedItem.items?.length})</p>
                  <div className="space-y-2.5">
                    {selectedItem.items?.map((item, idx) => (
                      <div key={item._id} className="border-b border-gray-200 pb-2.5">
                        <p className="text-[11px] font-semibold text-[#111827]">{idx + 1}. {item.productId?.englishTitle}</p>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-[#6B7280]">{item.quantity} {item.type === 'ctn' ? 'Ctns' : item.type === 'piece' ? 'PCS' : item.type || 'Unit'} @ Rs. {item.price?.toFixed(2)}</span>
                          <span className="text-[11px] font-semibold text-[#FF5934]">Rs. {(item.quantity * item.price).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">Sub Total</span>
                      <span className="font-semibold text-[#111827]">Rs. {selectedItem.total?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] border-t border-orange-200 pt-1.5">
                      <span className="text-[#111827] font-bold">Total</span>
                      <span className="text-[13px] font-bold text-[#FF5934]">Rs. {selectedItem.total}</span>
                    </div>
                    <div className="flex justify-between text-[11px] pt-1.5 border-t border-orange-200">
                      <span className="text-[#6B7280]">Ledger Balance</span>
                      <span className="font-semibold text-[#111827]">Rs. {selectedItem.RetailerUser?.balance?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {show && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={() => setShow(false)} />}
      </div>
    </>
  );
};

export default SalesInvoices;