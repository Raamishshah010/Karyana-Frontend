import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  generateLoadForm, getAllSalesPersons,
  getCoordinatorOrders, getOrders, getSearchOrders,
  getWarhouseManagerOrders, updateOrderStatus, getOrdersBySalesPersonAndDate
} from "../APIS";
import { Loader } from '../components/common/loader';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye, FaTrash, FaFilePdf } from "react-icons/fa6";
import DateRangePicker from "../components/DateRangePicker";
import { toast } from 'react-toastify';
import { ROLES } from '../utils';
import EscapeClose from '../components/EscapeClose';
import { useSelector } from 'react-redux';
import InvoiceTemplate from '../components/Report/InvoiceTemplate';
import {
  MdReceipt, MdLocalShipping,
  MdPerson, MdStore, MdCalendarToday, MdLocationOn,
  MdPhone, MdShoppingBag, MdCheckCircle,
  MdOutlineInventory2, MdFilterList, MdClose, MdSearch, MdRefresh,
} from "react-icons/md";

const ORDER_STATUSES = ['Placed', 'Processed', 'Cancelled', 'Satelment'];
const LIMIT = 10;

function toMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[0].length === 4) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    else if (parseInt(parts[0], 10) > 12) return `${parts[1]}/${parts[0]}/${parts[2]}`;
    else return dateStr;
  }
  return dateStr;
}

const statusColor = (status) => {
  const map = {
    'Placed':    'bg-amber-50 text-amber-600 ring-amber-200',
    'Processed': 'bg-blue-50 text-blue-600 ring-blue-200',
    'Cancelled': 'bg-red-50 text-red-500 ring-red-200',
    'Satelment': 'bg-orange-50 text-orange-500 ring-orange-200',
  };
  return map[status] || 'bg-gray-50 text-gray-500 ring-gray-200';
};

const statusDot = (status) => {
  const map = {
    'Placed':    'bg-amber-400',
    'Processed': 'bg-blue-400',
    'Cancelled': 'bg-red-400',
    'Satelment': 'bg-orange-400',
  };
  return map[status] || 'bg-gray-400';
};

const generateOrderPDF = (item) => {
  const hasDiscount = (oi) => Number(oi.discountedPrice) > 0 && Number(oi.discountedPrice) < Number(oi.price);
  const unitLabel   = (type) => type === 'ctn' ? 'CTN' : type === 'piece' ? 'PCS' : type || '';

  const rows = (item.items || []).map(oi => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151">${oi.productId?.englishTitle || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:center">${oi.quantity} ${unitLabel(oi.type)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151;text-align:right">
        ${hasDiscount(oi)
          ? `<span style="text-decoration:line-through;color:#9ca3af;margin-right:4px">Rs.${Number(oi.price).toFixed(2)}</span><span style="color:#059669">Rs.${Number(oi.discountedPrice).toFixed(2)}</span>`
          : `Rs.${Number(oi.price).toFixed(2)}`}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12px;font-weight:600;color:#111827;text-align:right">
        Rs.${(oi.quantity * (hasDiscount(oi) ? Number(oi.discountedPrice) : Number(oi.price))).toFixed(2)}
      </td>
    </tr>`).join('');

  const statusRows = (item.statuses || []).map(s => `
    <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
      <div style="width:10px;height:10px;border-radius:50%;background:#FF5934;margin-top:3px;flex-shrink:0"></div>
      <div>
        <div style="font-size:12px;font-weight:600;color:#111827">${s.status}</div>
        <div style="font-size:11px;color:#9ca3af">${new Date(s.date).toLocaleString()}</div>
      </div>
    </div>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Order Receipt - ${item._id.slice(-10).toUpperCase()}</title>
    <style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111827; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }</style></head><body>
    <div style="max-width:640px;margin:0 auto;padding:32px 24px">
      <div style="background:linear-gradient(135deg,#FF5934,#ff8c6b);border-radius:16px;padding:24px;margin-bottom:24px;color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;opacity:0.7;text-transform:uppercase;margin-bottom:4px">Order Receipt</div>
            <div style="font-size:22px;font-weight:800">#${item._id.slice(-10).toUpperCase()}</div>
          </div>
          <span style="background:rgba(255,255,255,0.2);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700">${item.status}</span>
        </div>
        <div style="margin-top:16px;font-size:12px;opacity:0.8">${new Date(item.createdAt).toLocaleString()}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
        <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Customer</div>
          <div style="font-size:13px;font-weight:600;color:#111827">${item.RetailerUser?.name || '—'}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">${item.phoneNumber || ''}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Sales Person</div>
          <div style="font-size:13px;font-weight:600;color:#111827">${item.SaleUser?.name || '—'}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:14px;grid-column:1/-1">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Delivery Address</div>
          <div style="font-size:13px;color:#374151">${item.shippingAddress || '—'}</div>
        </div>
      </div>
      <div style="border:1px solid #f3f4f6;border-radius:12px;overflow:hidden;margin-bottom:24px">
        <div style="background:#fafafa;padding:12px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">Order Items</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#fafafa">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase">Product</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase">Rate</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="padding:12px;background:#fff;border-top:2px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">Total Amount</span>
          <span style="font-size:17px;font-weight:800;color:#111827">Rs. ${item.total}</span>
        </div>
      </div>
      <div style="border:1px solid #f3f4f6;border-radius:12px;overflow:hidden">
        <div style="background:#fafafa;padding:12px;border-bottom:1px solid #f3f4f6">
          <span style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase">Order Timeline</span>
        </div>
        <div style="padding:14px">${statusRows}</div>
      </div>
      <div style="text-align:center;margin-top:24px;font-size:11px;color:#9ca3af">Generated on ${new Date().toLocaleString()}</div>
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  else toast.error('Please allow pop-ups to download PDF');
};

const Order = () => {
  const [currentPage, setCurrentPage]   = useState(1);
  const [show, setShow]                 = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const sidebarRef                      = useRef(null);
  const [data, setData]                 = useState([]);
  const [totalPages, setTotalPages]     = useState(0);
  const [loading, setLoading]           = useState(false);

  const [searchTerm, setSearchTerm]                   = useState('');
  const [startDate, setStartDate]                     = useState('');
  const [endDate, setEndDate]                         = useState('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [selectedStatus, setSelectedStatus]           = useState('');

  const [loadFormData, setLoadFormData]               = useState({ salePerson: '', date: '' });
  const [salesPersons, setSalesPersons]               = useState([]);
  const [isSatelmentPopupVisible, setIsSatelmentPopupVisible] = useState(false);
  const [adjustedItems, setAdjustedItems]             = useState([]);
  const [isLoadFormVisible, setIsLoadFormVisible]     = useState(false);
  const [isInvoiceVisible, setIsInvoiceVisible]       = useState(false);
  const [showInvoiceTemplate, setShowInvoiceTemplate] = useState(false);
  const [invoiceTemplateData, setInvoiceTemplateData] = useState(null);
  const [invoiceData, setInvoiceData]                 = useState({ salePerson: '', date: '' });

  const { role, user, token } = useSelector((state) => state.admin);

  const filterCount = useMemo(() =>
    [selectedSalesPerson, selectedStatus, startDate, searchTerm].filter(Boolean).length,
    [selectedSalesPerson, selectedStatus, startDate, searchTerm]
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

  /* ─── CORE FETCH ────────────────────────────────────────────────────
     Always called with the current snapshot of all filter values.
     Uses getSearchOrders whenever ANY filter/search is active,
     otherwise falls back to plain getOrders.
  ─────────────────────────────────────────────────────────────────── */
  const doFetch = useCallback(async ({
    page          = 1,
    term          = '',
    sd            = '',
    ed            = '',
    salesperson   = '',
    status        = '',
  } = {}) => {
    const hasAnyFilter = term || sd || ed || salesperson || status;
    try {
      setLoading(true);
      if (hasAnyFilter) {
        const params = {
          ...(sd          && { startDate: sd }),
          ...(ed          && { endDate: ed }),
          ...(term        && { id: term }),
          ...(salesperson && { salesPersonId: salesperson }),
          ...(status      && { status }),
        };
        const res = await getSearchOrders(page, LIMIT, params);
        setData(res.data.data ?? []);
        setTotalPages(res.data.totalPages ?? 0);
      } else {
        const res = await getOrders(page, LIMIT);
        setData(res.data.data ?? []);
        setTotalPages(res.data.totalPages ?? 0);
      }
    } catch (error) {
      toast.error(error?.response?.data?.errors?.[0]?.msg || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── INITIAL LOAD for warehouse / coordinator roles ── */
  useEffect(() => {
    if (role.includes(ROLES[2])) {
      setLoading(true);
      getWarhouseManagerOrders(1, LIMIT)
        .then(res => { setData(res.data.data ?? []); setTotalPages(res.data.totalPages ?? 0); })
        .catch(err => toast.error(err.message))
        .finally(() => setLoading(false));
      return;
    }
    if (role.includes(ROLES[1])) {
      setLoading(true);
      getCoordinatorOrders(1, LIMIT, user.city)
        .then(res => { setData(res.data.data ?? []); setTotalPages(res.data.totalPages ?? 0); })
        .catch(err => toast.error(err.message))
        .finally(() => setLoading(false));
    }
  }, [role, user]);

  /* ─── RE-FETCH whenever any filter / page changes ─────────────────
     Skipped for warehouse / coordinator roles (they have their own
     fetch above and don't use the search endpoint).
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (role.includes(ROLES[2]) || role.includes(ROLES[1])) return;
    doFetch({
      page:        currentPage,
      term:        searchTerm,
      sd:          startDate,
      ed:          endDate,
      salesperson: selectedSalesPerson,
      status:      selectedStatus,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, startDate, endDate, selectedSalesPerson, selectedStatus]);

  /* ─── close sidebar on outside click ── */
  useEffect(() => {
    const h = (e) => { if (sidebarRef.current && !sidebarRef.current.contains(e.target)) setShow(false); };
    if (show) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [show]);

  /* ─── filter handlers — update state, reset to page 1 ── */
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

  /* ─── status update ── */
  const statusHandler = async (e) => {
    const newStatus = e.target.value;
    if (!newStatus) return;
    if (newStatus === 'Satelment') {
      setAdjustedItems(selectedItem.items.map(i => ({ ...i, adjustedQuantity: i.quantity })));
      setIsSatelmentPopupVisible(true);
      return;
    }
    try {
      setLoading(true);
      await updateOrderStatus({ status: newStatus, id: selectedItem._id });
      setSelectedItem(prev => ({
        ...prev, status: newStatus,
        statuses: [...prev.statuses, { status: newStatus, date: new Date() }],
      }));
      setLoading(false);
      setShow(false);
      toast.success('Status Updated');
      /* refresh current view */
      doFetch({ page: currentPage, term: searchTerm, sd: startDate, ed: endDate, salesperson: selectedSalesPerson, status: selectedStatus });
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const decreaseQuantity   = (id) => setAdjustedItems(prev => prev.map(i => i.productId?._id === id && i.adjustedQuantity > 1 ? { ...i, adjustedQuantity: i.adjustedQuantity - 1 } : i));
  const increaseQuantity   = (id) => setAdjustedItems(prev => prev.map(i => i.productId?._id === id ? { ...i, adjustedQuantity: i.adjustedQuantity + 1 } : i));
  const deleteAdjustedItem = (id) => setAdjustedItems(prev => prev.map(i => i.productId?._id === id ? { ...i, adjustedQuantity: 0 } : i));

  const confirmSatelment = async () => {
    try {
      setLoading(true);
      const valid = adjustedItems.filter(i => i.adjustedQuantity > 0);
      if (!valid.length) { toast.error('Cannot create settlement with zero items'); setLoading(false); return; }
      const updatedItems = valid.map(i => {
        const pid  = typeof i.productId === 'object' ? i.productId._id : i.productId;
        const orig = selectedItem.items.find(x => (typeof x.productId === 'object' ? x.productId._id : x.productId) === pid);
        return { productId: pid, quantity: i.adjustedQuantity, price: i.price, type: orig?.type || 'piece' };
      });
      const total = updatedItems.reduce((s, i) => s + i.quantity * i.price, 0);
      await updateOrderStatus({ status: 'Satelment', items: updatedItems, total, id: selectedItem._id });
      setSelectedItem(prev => ({
        ...prev, status: 'Satelment', total,
        statuses: [...prev.statuses, { status: 'Satelment', date: new Date() }],
        items: updatedItems.map(i => {
          const orig = prev.items.find(x => (typeof x.productId === 'object' ? x.productId._id : x.productId) === i.productId);
          return { ...orig, productId: i.productId, quantity: i.quantity, price: i.price, type: i.type };
        }),
      }));
      setIsSatelmentPopupVisible(false);
      toast.success('Satelment Updated');
      setLoading(false);
      doFetch({ page: currentPage, term: searchTerm, sd: startDate, ed: endDate, salesperson: selectedSalesPerson, status: selectedStatus });
    } catch (error) { setLoading(false); toast.error(error.message); }
  };

  const invoiceHandler = async () => {
    try {
      if (!salesPersons.length) { const r = await getAllSalesPersons(); setSalesPersons(r.data.data); }
      setIsInvoiceVisible(true);
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.msg); }
  };

  const generateInvoiceHandler = async () => {
    if (!invoiceData.date || !invoiceData.salePerson) return toast.error('User and date is required');
    try {
      setLoading(true);
      const res = await getOrdersBySalesPersonAndDate({ ...invoiceData, date: toMMDDYYYY(invoiceData.date) }, token);
      const orders = res.data.data;
      if (!orders?.length) { toast.error('No orders found'); setLoading(false); return; }
      const sp = salesPersons.find(s => s._id === invoiceData.salePerson);
      setInvoiceTemplateData({ salePerson: sp, date: invoiceData.date, orders });
      setShowInvoiceTemplate(true);
      setLoading(false);
      setIsInvoiceVisible(false);
    } catch (e) { setLoading(false); toast.error(e.response?.data?.errors?.[0]?.msg || e.message); }
  };

  const openLoadFormModal = async () => {
    setLoading(true);
    try {
      if (!salesPersons.length) { const r = await getAllSalesPersons(); setSalesPersons(r.data.data); }
      setIsLoadFormVisible(true);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const loadFormHandler = async () => {
    if (!loadFormData.date || !loadFormData.salePerson) return toast.error('User and date are required');
    try {
      setLoading(true);
      const formattedDate = new Date(loadFormData.date).toISOString().split('T')[0];
      const res = await generateLoadForm({ ...loadFormData, date: formattedDate }, token);
      const { pdfUrl } = res.data.data;
      if (!pdfUrl) throw new Error('Failed to generate PDF');
      window.open(pdfUrl, '_blank');
      setIsLoadFormVisible(false);
      setLoadFormData({ salePerson: '', date: '' });
      toast.success('Load form generated successfully');
    } catch (e) { toast.error(e.response?.data?.errors?.[0]?.msg || e.message); }
    finally { setLoading(false); }
  };

  const orderStatuses = useMemo(() =>
    ORDER_STATUSES.filter(s => s === 'Satelment' || !selectedItem?.statuses.some(it => it.status === s)),
    [selectedItem]
  );

  const statusChangeable = useMemo(() =>
    selectedItem?.statuses.some(it => it.status === 'Cancelled' || it.status === 'Satelment'),
    [selectedItem]
  );

  const calculatedTotal = useMemo(() =>
    adjustedItems.reduce((s, i) => s + i.adjustedQuantity * i.price, 0),
    [adjustedItems]
  );

  const mInputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all";

  if (loading) return <Loader />;

  if (showInvoiceTemplate && invoiceTemplateData) {
    localStorage.setItem('invoiceTemplateData', JSON.stringify(invoiceTemplateData));
    return (
      <div className="relative">
        <button
          onClick={() => { setShowInvoiceTemplate(false); localStorage.removeItem('invoiceTemplateData'); }}
          className="absolute top-4 left-4 flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold px-3 py-2 rounded-xl shadow-sm transition-all"
        >
          <GrFormPrevious size={18} /> Back to Orders
        </button>
        <InvoiceTemplate />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .ord-page { font-family:'DM Sans','Segoe UI',sans-serif; }
        .ord-page .table-row { transition:background 0.15s,box-shadow 0.15s; }
        .ord-page .table-row:hover { background:#FFFAF9; box-shadow:0 0 0 1px #FFD7CE inset; }
        .ord-page .action-btn { transition:background 0.15s,color 0.15s,transform 0.1s; }
        .ord-page .action-btn:hover { transform:scale(1.1); }
        .ord-page .filter-select {
          appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat:no-repeat;
          background-position:right 10px center;
          padding-right:28px;
        }
        @keyframes ordModalIn  { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes ordOverlayIn { from { opacity:0; } to { opacity:1; } }
        .ord-modal-overlay { animation:ordOverlayIn 0.2s ease; }
        .ord-modal-card    { animation:ordModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .ord-sidebar       { transition:transform 0.3s cubic-bezier(0.4,0,0.2,1); }
        .ord-no-scroll::-webkit-scrollbar { display:none; }
        .ord-no-scroll { scrollbar-width:none; }
      `}</style>

      <div className="ord-page">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Orders</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} orders on this page</p>
          </div>
          {!role.includes(ROLES[2]) && (
            <div className="flex flex-wrap gap-2 items-center">
              <button onClick={invoiceHandler} className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-orange-50 hover:border-[#FF5934] text-[#374151] hover:text-[#FF5934] text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
                <MdReceipt size={16} /> Generate Invoice
              </button>
              <button onClick={openLoadFormModal} className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-orange-50 hover:border-[#FF5934] text-[#374151] hover:text-[#FF5934] text-sm font-semibold px-4 py-2.5 rounded-xl transition-all">
                <MdLocalShipping size={16} /> Generate Load Form
              </button>
            </div>
          )}
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by order ID…"
            />
            {searchTerm && (
              <button onClick={() => handleSearchChange('')} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors flex-shrink-0">
                <MdClose size={14} />
              </button>
            )}
          </div>

          {/* Date Range */}
          <DateRangePicker submitHandler={dateRangeHandler} sd={startDate} ed={endDate} />

          {/* Sales Person */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdPerson size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <select
              value={selectedSalesPerson}
              onChange={e => handleSalesPersonFilter(e.target.value)}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[140px]"
            >
              <option value="">All Sales Persons</option>
              {salesPersons.map(sp => (
                <option value={sp._id} key={sp._id}>{sp.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={15} className="text-[#9CA3AF] flex-shrink-0" />
            <select
              value={selectedStatus}
              onChange={e => handleStatusFilter(e.target.value)}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[120px]"
            >
              <option value="">All Statuses</option>
              {ORDER_STATUSES.map(s => (
                <option value={s} key={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {filterCount > 0 && (
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all"
            >
              <MdClose size={14} />
              Clear Filters
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none ml-0.5">
                {filterCount}
              </span>
            </button>
          )}

          {/* Reset */}
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all"
          >
            <MdRefresh size={16} /> Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {['Order ID', 'Retailer', 'Sales Person', 'Date & Time', 'Amount', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map(item => (
                <tr key={item._id} className="table-row cursor-pointer" onClick={() => { setSelectedItem(item); setShow(true); }}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] font-bold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                      #{item._id.slice(-10)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <MdStore size={13} className="text-[#FF5934]" />
                      </div>
                      <span className="text-[13px] text-[#374151] font-medium">{item.RetailerUser?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MdPerson size={13} className="text-blue-400" />
                      </div>
                      <span className="text-[13px] text-[#374151]">{item.SaleUser?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#374151]">{new Date(item.createdAt).toLocaleDateString('en-GB')}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold text-[#111827]">Rs. {item.total}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${statusColor(item.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(item.status)}`} />
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); generateOrderPDF(item); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 border border-red-100"
                        title="Download PDF"
                      >
                        <FaFilePdf size={13} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedItem(item); setShow(true); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="View Order"
                      >
                        <FaRegEye size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdShoppingBag size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No orders found</p>
                      {filterCount > 0 && (
                        <button onClick={refreshData} className="text-[#FF5934] text-xs hover:underline font-medium">
                          Clear {filterCount} active filter{filterCount > 1 ? 's' : ''}
                        </button>
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
          <p className="text-[12px] text-[#9CA3AF]">Page {currentPage} of {totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            ><GrFormPrevious size={16} /></button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              disabled={totalPages <= currentPage}
              onClick={() => setCurrentPage(p => p + 1)}
            ><GrFormNext size={16} /></button>
          </div>
        </div>

        {/* ═══════════ LOAD FORM MODAL ═══════════ */}
        {isLoadFormVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div><p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Generate</p><h2 className="text-white text-xl font-bold">Load Form</h2></div>
                  <button onClick={() => setIsLoadFormVisible(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><MdClose size={16} /></button>
                </div>
              </div>
              <div className="px-6 pt-7 pb-6 flex flex-col gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5"><MdPerson size={12} className="text-[#FF5934]" /> Sales Person</label>
                  <select onChange={e => setLoadFormData(p => ({ ...p, salePerson: e.target.value }))} className={mInputCls}>
                    <option value="">Select sales person</option>
                    {salesPersons.map(it => <option value={it._id} key={it._id}>{it.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5"><MdCalendarToday size={12} className="text-[#FF5934]" /> Date</label>
                  <input type="date" onChange={e => setLoadFormData(p => ({ ...p, date: e.target.value }))} className={mInputCls} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button onClick={() => setIsLoadFormVisible(false)} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={loadFormHandler} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100">Generate</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ INVOICE MODAL ═══════════ */}
        {isInvoiceVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div><p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Generate</p><h2 className="text-white text-xl font-bold">Invoice</h2></div>
                  <button onClick={() => setIsInvoiceVisible(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><MdClose size={16} /></button>
                </div>
              </div>
              <div className="px-6 pt-7 pb-6 flex flex-col gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5"><MdPerson size={12} className="text-[#FF5934]" /> Sales Person</label>
                  <select onChange={e => setInvoiceData(p => ({ ...p, salePerson: e.target.value }))} className={mInputCls}>
                    <option value="">Select sales person</option>
                    {salesPersons.map(it => <option value={it._id} key={it._id}>{it.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5"><MdCalendarToday size={12} className="text-[#FF5934]" /> Date</label>
                  <input type="date" value={invoiceData.date} onChange={e => setInvoiceData(p => ({ ...p, date: e.target.value }))} className={mInputCls} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button onClick={() => setIsInvoiceVisible(false)} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={generateInvoiceHandler} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100">Generate</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ SATELMENT MODAL ═══════════ */}
        {isSatelmentPopupVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[480px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div><p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Adjust</p><h2 className="text-white text-xl font-bold">Settlement Quantities</h2></div>
                  <button onClick={() => { setIsSatelmentPopupVisible(false); setAdjustedItems([]); }} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"><MdClose size={16} /></button>
                </div>
              </div>
              <div className="ord-no-scroll overflow-y-auto flex-1 px-6 pt-5 pb-2 flex flex-col gap-3 max-h-[50vh]">
                {adjustedItems.map(item => (
                  <div key={item.productId?._id} className="flex items-center gap-3 bg-[#F9FAFB] border border-gray-100 rounded-2xl p-3">
                    <img src={item.productId?.image} alt={item.productId?.englishTitle} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] truncate">{item.productId?.englishTitle}</p>
                      <p className="text-[11px] text-[#FF5934] font-medium">Rs. {item.price}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => decreaseQuantity(item.productId?._id)} disabled={item.adjustedQuantity <= 1} className="w-7 h-7 rounded-lg bg-[#FF5934] text-white flex items-center justify-center disabled:opacity-40 font-bold text-lg leading-none">−</button>
                      <span className="text-[13px] font-semibold text-[#111827] w-6 text-center">{item.adjustedQuantity}</span>
                      <button onClick={() => increaseQuantity(item.productId?._id)} className="w-7 h-7 rounded-lg bg-[#FF5934] text-white flex items-center justify-center font-bold text-lg leading-none">+</button>
                      <button onClick={() => deleteAdjustedItem(item.productId?._id)} className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center border border-red-100"><FaTrash size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-[#FAFAFA]">
                <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total</span>
                <span className="text-[15px] font-bold text-[#111827]">Rs. {calculatedTotal}</span>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button onClick={() => { setIsSatelmentPopupVisible(false); setAdjustedItems([]); }} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50">Cancel</button>
                <button onClick={confirmSatelment} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100">Confirm</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ORDER DETAIL SIDEBAR ═══════════ */}
        {show && <EscapeClose onClose={handleEscape} />}
        <div
          ref={sidebarRef}
          className={`ord-sidebar fixed top-0 right-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-40 flex flex-col ${show ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {show && selectedItem && (
            <>
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-6 flex-shrink-0">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Order Details</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => generateOrderPDF(selectedItem)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                      <FaFilePdf size={12} /> PDF
                    </button>
                    <button onClick={() => setShow(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white">
                      <MdClose size={15} />
                    </button>
                  </div>
                </div>
                <p className="font-mono text-white/50 text-[11px]">#{selectedItem._id.slice(-10).toUpperCase()}</p>
                <h3 className="text-white font-bold text-[17px] leading-tight">{selectedItem.RetailerUser?.name || 'Order'}</h3>
                <div className="flex gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${statusColor(selectedItem.status)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selectedItem.status)}`} />
                    {selectedItem.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mx-5 -mt-4 z-10 relative">
                {[
                  { label: 'Items', value: selectedItem.items.length },
                  { label: 'Total', value: `Rs. ${selectedItem.total}` },
                  { label: 'Steps', value: selectedItem.statuses.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-2 py-3 text-center">
                    <p className="text-[12px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="ord-no-scroll flex-1 overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-4">
                {/* Tracking */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Order Tracking</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-0">
                    {selectedItem.statuses.map((s, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center">
                            <MdCheckCircle size={14} className="text-[#FF5934]" />
                          </div>
                          {i < selectedItem.statuses.length - 1 && <div className="w-0.5 h-5 bg-[#FF5934]/20 my-1" />}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-[13px] font-semibold text-[#111827]">{s.status}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{new Date(s.date).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Order Info</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3">
                    {[
                      { icon: MdPerson,        label: 'Sales Person',      value: selectedItem.SaleUser?.name },
                      { icon: MdPhone,         label: 'Phone',             value: selectedItem.phoneNumber },
                      { icon: MdLocationOn,    label: 'Delivery Address',  value: selectedItem.shippingAddress },
                      { icon: MdCalendarToday, label: 'Expected Delivery', value: new Date(selectedItem.expectedDelivery).toLocaleDateString() },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={13} className="text-[#FF5934]" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className="text-[13px] text-[#374151] font-medium">{value || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Items */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Items</p>
                    <span className="text-[11px] text-[#FF5934] font-bold">{selectedItem.items.length} items</span>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-2">
                    {selectedItem.items.map(item => {
                      const disc = Number(item.discountedPrice) > 0 && Number(item.discountedPrice) < Number(item.price);
                      const unit = item.type === 'ctn' ? 'CTN' : item.type === 'piece' ? 'PCS' : '';
                      return (
                        <div key={item._id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2.5">
                          {item.productId?.image
                            ? <img src={item.productId.image} alt={item.productId.englishTitle} className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                            : <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-100"><MdShoppingBag size={16} className="text-gray-300" /></div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#111827] truncate">{item.productId?.englishTitle}</p>
                            {disc
                              ? <p className="text-[11px]"><span className="text-gray-400 line-through">{Number(item.price).toFixed(2)} Rs</span><span className="text-emerald-600 font-semibold ml-1">{Number(item.discountedPrice).toFixed(2)} Rs</span></p>
                              : <p className="text-[11px] text-[#FF5934] font-medium">{Number(item.price).toFixed(2)} Rs</p>
                            }
                          </div>
                          <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-[11px] font-bold text-[#374151] flex-shrink-0">
                            {item.quantity} {unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center bg-white">
                    <span className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total</span>
                    <span className="text-[15px] font-bold text-[#111827]">Rs. {selectedItem.total}</span>
                  </div>
                </div>

                {/* Status update */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdOutlineInventory2 size={12} className="text-[#FF5934]" /> Update Status
                  </label>
                  <select
                    disabled={statusChangeable}
                    onChange={statusHandler}
                    defaultValue=""
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled>Change status…</option>
                    {orderStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
                <button onClick={() => setShow(false)} className="w-full h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all shadow-md shadow-orange-100">
                  Close
                </button>
              </div>
            </>
          )}
        </div>

        {show && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]" onClick={() => setShow(false)} />}
      </div>
    </>
  );
};

export default Order;