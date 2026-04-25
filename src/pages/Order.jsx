import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateInvoice, generateLoadForm, getAllSalesPersons,
  getCoordinatorOrders, getOrders, getSearchOrders,
  getWarhouseManagerOrders, updateOrderStatus, getOrdersBySalesPersonAndDate
} from "../APIS";
import tick from "/tick.svg";
import { Loader } from '../components/common/loader';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye, FaFileExcel, FaTrash } from "react-icons/fa6";
import DateRangePicker from "../components/DateRangePicker";
import { toast } from 'react-toastify';
import { ORDER_STATUSES, ROLES } from '../utils';
import * as XLSX from 'xlsx';
import EscapeClose from '../components/EscapeClose';
import { useSelector } from 'react-redux';
import InvoiceTemplate from '../components/Report/InvoiceTemplate';
import {
  MdSearch, MdClose, MdRefresh, MdReceipt, MdLocalShipping,
  MdPerson, MdStore, MdCalendarToday, MdLocationOn,
  MdPhone, MdShoppingBag, MdAttachMoney, MdCheckCircle,
  MdOutlineInventory2,
} from "react-icons/md";

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

const LIMIT = 10;

const statusColor = (status) => {
  const map = {
    'Pending':     'bg-amber-50 text-amber-600 ring-amber-200',
    'Confirmed':   'bg-blue-50 text-blue-600 ring-blue-200',
    'Dispatched':  'bg-purple-50 text-purple-600 ring-purple-200',
    'Delivered':   'bg-emerald-50 text-emerald-600 ring-emerald-200',
    'Cancelled':   'bg-red-50 text-red-500 ring-red-200',
    'Satelment':   'bg-orange-50 text-orange-500 ring-orange-200',
  };
  return map[status] || 'bg-gray-50 text-gray-500 ring-gray-200';
};

const statusDot = (status) => {
  const map = {
    'Pending':    'bg-amber-400',
    'Confirmed':  'bg-blue-400',
    'Dispatched': 'bg-purple-400',
    'Delivered':  'bg-emerald-400',
    'Cancelled':  'bg-red-400',
    'Satelment':  'bg-orange-400',
  };
  return map[status] || 'bg-gray-400';
};

const Order = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [show, setShow] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const sidebarRef = useRef(null);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);
  const dropdownRef = useRef(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [loadFormData, setLoadFormData] = useState({ salePerson: "", date: "" });
  const [salesPersons, setSalesPersons] = useState([]);

  const formatDateForInput = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const [invoiceData, setInvoiceData] = useState({ salePerson: "", date: formatDateForInput(new Date()) });
  const { role, user, token } = useSelector((state) => state.admin);
  const [isSatelmentPopupVisible, setIsSatelmentPopupVisible] = useState(false);
  const [adjustedItems, setAdjustedItems] = useState([]);
  const [isLoadFormVisible, setIsLoadFormVisible] = useState(false);
  const [isInvoiceVisible, setIsInvoiceVisible] = useState(false);
  const [showInvoiceTemplate, setShowInvoiceTemplate] = useState(false);
  const [invoiceTemplateData, setInvoiceTemplateData] = useState(null);

  const handleEscape = useCallback(() => setShow(false), []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && show) handleEscape(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [show, handleEscape]);

  useEffect(() => {
    setLoading(true);
    const fetch = role.includes(ROLES[2])
      ? getWarhouseManagerOrders(currentPage, LIMIT)
      : role.includes(ROLES[1])
        ? getCoordinatorOrders(currentPage, LIMIT, user.city)
        : getOrders(currentPage, LIMIT);

    fetch
      .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  }, [currentPage, role, user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) setShow(false);
    };
    if (show) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show]);

  const dateRangeHandler = async (st, ed) => {
    try {
      setLoading(true);
      setStartDate(st); setEndDate(ed);
      const res = await getSearchOrders(1, LIMIT, { startDate: st, endDate: ed });
      setData(res.data.data); setTotalPages(res.data.totalPages);
      setLoading(false);
    } catch (error) { toast.error(error.message); }
  };

  const searchHandler = async (e) => {
    if (e.key !== 'Enter') return;
    if (searchTerm.length) {
      try {
        setLoading(true);
        const res = await getSearchOrders(1, LIMIT, { startDate, endDate, id: searchTerm });
        setData(res.data.data); setTotalPages(res.data.totalPages);
        setLoading(false);
      } catch (error) { setLoading(false); toast.error(error?.response?.data?.errors[0]?.msg); }
    } else { refreshData(); }
  };

  const statusHandler = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === "Satelment") {
      setAdjustedItems(selectedItem.items.map(item => ({ ...item, adjustedQuantity: item.quantity })));
      setIsSatelmentPopupVisible(true);
      return;
    }
    try {
      setLoading(true);
      await updateOrderStatus({ status: newStatus, id: selectedItem._id });
      setSelectedItem(prev => ({
        ...prev, status: newStatus,
        statuses: [...prev.statuses, { status: newStatus, date: new Date() }]
      }));
      const res = await getOrders(1, LIMIT);
      setData(res.data.data); setTotalPages(res.data.totalPages);
      setLoading(false); setShow(false);
      toast.success("Status Updated");
    } catch (error) { setLoading(false); toast.error(error.response?.data?.message || error.message); }
  };

  const decreaseQuantity = (id) => setAdjustedItems(prev => prev.map(item =>
    item.productId?._id === id && item.adjustedQuantity > 1 ? { ...item, adjustedQuantity: item.adjustedQuantity - 1 } : item
  ));
  const increaseQuantity = (id) => setAdjustedItems(prev => prev.map(item =>
    item.productId?._id === id ? { ...item, adjustedQuantity: item.adjustedQuantity + 1 } : item
  ));
  const deleteAdjustedItem = (id) => setAdjustedItems(prev => prev.map(item =>
    item.productId?._id === id ? { ...item, adjustedQuantity: 0 } : item
  ));

  const confirmSatelment = async () => {
    try {
      setLoading(true);
      const validAdjustedItems = adjustedItems.filter(item => item.adjustedQuantity > 0);
      if (validAdjustedItems.length === 0) { toast.error("Cannot create settlement with zero items"); setLoading(false); return; }
      const updatedItems = validAdjustedItems.map(item => {
        let productId = typeof item.productId === 'object' && item.productId?._id ? item.productId._id : item.productId;
        const originalItem = selectedItem.items.find(i =>
          (typeof i.productId === 'object' && i.productId?._id === productId) || i.productId === productId
        );
        return { productId, quantity: item.adjustedQuantity, price: item.price, type: originalItem?.type || 'piece' };
      });
      const total = updatedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      await updateOrderStatus({ status: "Satelment", items: updatedItems, total, id: selectedItem._id });
      const res = await getOrders(1, LIMIT);
      setData(res.data.data); setTotalPages(res.data.totalPages);
      setSelectedItem(prev => ({
        ...prev, status: "Satelment", total,
        statuses: [...prev.statuses, { status: "Satelment", date: new Date() }],
        items: updatedItems.map(item => {
          const orig = prev.items.find(i => (typeof i.productId === 'object' && i.productId?._id === item.productId) || i.productId === item.productId);
          return { ...orig, productId: item.productId, quantity: item.quantity, price: item.price, type: item.type };
        })
      }));
      setIsSatelmentPopupVisible(false);
      toast.success("Satelment Updated");
      setLoading(false);
    } catch (error) { setLoading(false); toast.error(error.message); }
  };

  const invoiceHandler = async () => {
    try {
      const res = await getAllSalesPersons();
      setSalesPersons(res.data.data);
      setIsInvoiceVisible(true);
    } catch (error) { toast.error(error.response?.data?.errors[0]?.msg); }
  };

  const generateInvoiceHandler = async () => {
    if (!invoiceData.date.length || !invoiceData.salePerson.length) return toast.error("User and date is required");
    try {
      setLoading(true);
      const formattedDate = toMMDDYYYY(invoiceData.date);
      const res = await getOrdersBySalesPersonAndDate({ ...invoiceData, date: formattedDate }, token);
      const orders = res.data.data;
      if (!orders || orders.length === 0) { toast.error("No orders found for the selected sales person and date"); setLoading(false); return; }
      const selectedSalesPerson = salesPersons.find(sp => sp._id === invoiceData.salePerson);
      setInvoiceTemplateData({ salePerson: selectedSalesPerson, date: invoiceData.date, orders });
      setShowInvoiceTemplate(true);
      setLoading(false);
      setIsInvoiceVisible(false);
    } catch (error) { setLoading(false); toast.error(error.response?.data?.errors[0]?.msg || error.message); }
  };

  const openLoadFormModal = async () => {
    setLoading(true);
    try {
      if (!salesPersons.length) { const res = await getAllSalesPersons(); setSalesPersons(res.data.data); }
      setIsLoadFormVisible(true);
      setLoading(false);
    } catch (err) { setLoading(false); toast.error(err.message); }
  };

  const loadFormHandler = async () => {
    if (!loadFormData.date.length || !loadFormData.salePerson.length) return toast.error("User and date are required");
    try {
      setLoading(true);
      const formattedDate = new Date(loadFormData.date).toISOString().split('T')[0];
      const res = await generateLoadForm({ ...loadFormData, date: formattedDate }, token);
      const { pdfUrl } = res.data.data;
      if (!pdfUrl) throw new Error("Failed to generate PDF");
      window.open(pdfUrl, '_blank');
      setIsLoadFormVisible(false);
      setLoadFormData({ salePerson: "", date: "" });
      toast.success("Load form generated successfully");
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.msg || error.message || "Failed to generate load form");
    } finally { setLoading(false); }
  };

  const refreshData = async () => {
    setCurrentPage(1); setSearchTerm(""); setLoading(true);
    getOrders(1, LIMIT)
      .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const orderStatuses = useMemo(() =>
    ORDER_STATUSES.filter(status => status === "Satelment" || selectedItem?.statuses.findIndex((it) => it.status === status) < 0),
    [selectedItem]
  );
  const statusChangeable = useMemo(() =>
    selectedItem?.statuses.findIndex(it => it.status === ORDER_STATUSES[3] || it.status === ORDER_STATUSES[4]) > 0,
    [selectedItem]
  );
  const calculatedTotal = useMemo(() =>
    adjustedItems.reduce((sum, item) => sum + (item.adjustedQuantity * item.price), 0),
    [adjustedItems]
  );

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

  /* ─── shared modal input class ─── */
  const mInputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .ord-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .ord-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .ord-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .ord-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .ord-page .action-btn:hover { transform: scale(1.1); }
        @keyframes ordModalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes ordOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .ord-modal-overlay { animation: ordOverlayIn 0.2s ease; }
        .ord-modal-card { animation: ordModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .ord-sidebar { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
        .ord-no-scroll::-webkit-scrollbar { display: none; }
        .ord-no-scroll { scrollbar-width: none; }
        .ord-track-line { width: 2px; background: #E5E7EB; flex-shrink: 0; margin: 4px auto; }
        .ord-track-line.done { background: #10B981; }
      `}</style>

      <div className="ord-page">

        {/* ── Page Header ── */}
        <div className="flex flex-wrap items-center justify-between mt-6 mb-5 gap-3">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Orders</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} orders on this page</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {!role.includes(ROLES[2]) && (
              <>
                <button
                  onClick={invoiceHandler}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-orange-50 hover:border-[#FF5934] text-[#374151] hover:text-[#FF5934] text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
                >
                  <MdReceipt size={16} /> Generate Invoice
                </button>
                <button
                  onClick={openLoadFormModal}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-orange-50 hover:border-[#FF5934] text-[#374151] hover:text-[#FF5934] text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200"
                >
                  <MdLocalShipping size={16} /> Generate Load Form
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Filter / Search Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); if (!e.target.value) refreshData(); }}
              onKeyPress={searchHandler}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by order ID…"
            />
            {searchTerm && (
              <button onClick={refreshData} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <DateRangePicker submitHandler={dateRangeHandler} sd={startDate} ed={endDate} />
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200"
          >
            <MdRefresh size={16} /> Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {["Order ID", "Retailer", "Sales Person", "Date & Time", "Amount", "Status", "Invoice", ""].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((item) => (
                <tr
                  key={item._id}
                  className="table-row cursor-pointer"
                  onClick={() => { setSelectedItem(item); setShow(true); }}
                >
                  {/* ID */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] font-bold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                      #{item._id.slice(-10)}
                    </span>
                  </td>

                  {/* Retailer */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <MdStore size={13} className="text-[#FF5934]" />
                      </div>
                      <span className="text-[13px] text-[#374151] font-medium">{item.RetailerUser?.name || '—'}</span>
                    </div>
                  </td>

                  {/* Sales Person */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MdPerson size={13} className="text-blue-400" />
                      </div>
                      <span className="text-[13px] text-[#374151]">{item.SaleUser?.name || '—'}</span>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#374151]">
                      {new Date(item.createdAt).toLocaleDateString('en-GB').replace(/\//g, '/')}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {new Date(item.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3">
                    <span className="text-[13px] font-semibold text-[#111827]">Rs. {item.total}</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${statusColor(item.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(item.status)}`} />
                      {item.status}
                    </span>
                  </td>

                  {/* Invoice */}
                  <td className="px-4 py-3">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          setDownloadingInvoice(item._id);
                          const excelData = (item.items || []).map((orderItem) => ({
                            'Account No.': item.RetailerUser?.userId || '',
                            'Product Code': orderItem.productId?.productId || '',
                            'Invoice Date': formatDate(item.createdAt),
                            'Description': orderItem.productId?.englishTitle || '',
                            'Doc No.': item._id.slice(0, 6),
                            'Unit': orderItem.type === 'ctn' ? 'CTN' : orderItem.type === 'piece' ? 'PCS' : (orderItem.type || ''),
                            'Quantity': orderItem.quantity || '',
                            'Rate': orderItem.price?.toFixed(2) || '',
                            'Amount': (orderItem.quantity && orderItem.price) ? (orderItem.quantity * orderItem.price) : '',
                            'Discount %': '', 'Discount Amount': '', 'RM Amount': '', 'TO Amount': '',
                            'Tax Code': '', 'GST Amount': '', 'ADT Code': '', 'ADT Amount': '',
                            'FED Code': '', 'FED Amount': '', 'Project Code': '', 'Vehicle': '',
                            'Filter1': '', 'Filter2': '', 'Filter3': '', 'Filter4': '',
                            'Smart Doc 1': '', 'Smart Doc 2': '', 'Smart Doc 3': '', 'Smart Doc 4': '',
                            'Location Code': 'L101'
                          }));
                          const ws = XLSX.utils.json_to_sheet(excelData);
                          ws['!cols'] = Array(30).fill({ wch: 15 });
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, 'Invoice');
                          XLSX.writeFile(wb, `Invoice_${item._id}.xlsx`);
                        } catch (error) {
                          toast.error('Failed to generate invoice');
                        } finally { setDownloadingInvoice(null); }
                      }}
                      className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-500 border border-emerald-100"
                      title="Download Invoice"
                      disabled={downloadingInvoice === item._id}
                     
                    >
                      {downloadingInvoice === item._id
                        ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        : <FaFileExcel size={13} />}
                    </button>
                  </td>

                  {/* View */}
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedItem(item); setShow(true); }}
                      className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                      title="View Order"
                    >
                      <FaRegEye size={13} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdShoppingBag size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No orders found</p>
                      <button onClick={refreshData} className="text-[#FF5934] text-xs hover:underline">Clear filters</button>
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
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
            ><GrFormPrevious size={16} /></button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={totalPages <= currentPage}
              onClick={() => setCurrentPage(p => p + 1)}
            ><GrFormNext size={16} /></button>
          </div>
        </div>


        {/* ═══════════════════════════════════════
            LOAD FORM MODAL
        ═══════════════════════════════════════ */}
        {isLoadFormVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Generate</p>
                    <h2 className="text-white text-xl font-bold">Load Form</h2>
                  </div>
                  <button onClick={() => setIsLoadFormVisible(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <div className="px-6 pt-7 pb-6 flex flex-col gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdPerson size={12} className="text-[#FF5934]" /> Sales Person
                  </label>
                  <select onChange={e => setLoadFormData(p => ({ ...p, salePerson: e.target.value }))} className={mInputCls}>
                    <option value="">Select sales person</option>
                    {salesPersons.map(it => <option value={it._id} key={it._id}>{it.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> Date
                  </label>
                  <input type="date" onChange={e => setLoadFormData(p => ({ ...p, date: e.target.value }))} className={mInputCls} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button type="button" onClick={() => setIsLoadFormVisible(false)} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={loadFormHandler} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all">
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            INVOICE MODAL
        ═══════════════════════════════════════ */}
        {isInvoiceVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Generate</p>
                    <h2 className="text-white text-xl font-bold">Invoice</h2>
                  </div>
                  <button onClick={() => setIsInvoiceVisible(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <div className="px-6 pt-7 pb-6 flex flex-col gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdPerson size={12} className="text-[#FF5934]" /> Sales Person
                  </label>
                  <select onChange={e => setInvoiceData(p => ({ ...p, salePerson: e.target.value }))} className={mInputCls}>
                    <option value="">Select sales person</option>
                    {salesPersons.map(it => <option value={it._id} key={it._id}>{it.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
                    <MdCalendarToday size={12} className="text-[#FF5934]" /> Date
                  </label>
                  <input type="date" value={invoiceData.date} onChange={e => setInvoiceData(p => ({ ...p, date: e.target.value }))} className={mInputCls} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button type="button" onClick={() => setIsInvoiceVisible(false)} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={generateInvoiceHandler} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all">
                  Generate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            SATELMENT MODAL
        ═══════════════════════════════════════ */}
        {isSatelmentPopupVisible && (
          <div className="ord-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="ord-modal-card bg-white w-full max-w-[480px] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Adjust</p>
                    <h2 className="text-white text-xl font-bold">Settlement Quantities</h2>
                  </div>
                  <button onClick={() => { setIsSatelmentPopupVisible(false); setAdjustedItems([]); }} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <div className="ord-no-scroll overflow-y-auto flex-1 px-6 pt-5 pb-2 flex flex-col gap-3 max-h-[50vh]">
                {adjustedItems.map((item) => (
                  <div key={item.productId?._id} className="flex items-center gap-3 bg-[#F9FAFB] border border-gray-100 rounded-2xl p-3">
                    <img src={item.productId?.image} alt={item.productId?.englishTitle} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827] truncate">{item.productId?.englishTitle}</p>
                      <p className="text-[11px] text-[#FF5934] font-medium">Rs. {item.price}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => decreaseQuantity(item.productId?._id)} disabled={item.adjustedQuantity <= 1}
                        className="w-7 h-7 rounded-lg bg-[#FF5934] text-white flex items-center justify-center disabled:opacity-40 font-bold text-lg leading-none">−</button>
                      <span className="text-[13px] font-semibold text-[#111827] w-6 text-center">{item.adjustedQuantity}</span>
                      <button onClick={() => increaseQuantity(item.productId?._id)}
                        className="w-7 h-7 rounded-lg bg-[#FF5934] text-white flex items-center justify-center font-bold text-lg leading-none">+</button>
                      <button onClick={() => deleteAdjustedItem(item.productId?._id)}
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center border border-red-100">
                        <FaTrash size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-[#FAFAFA]">
                <span className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-widest">Total</span>
                <span className="text-[15px] font-bold text-[#111827]">Rs. {calculatedTotal}</span>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button onClick={() => { setIsSatelmentPopupVisible(false); setAdjustedItems([]); }} className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={confirmSatelment} className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all">Confirm</button>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════
            ORDER DETAIL SIDEBAR
        ═══════════════════════════════════════ */}
        {show && <EscapeClose onClose={handleEscape} />}
        <div
          ref={sidebarRef}
          className={`ord-sidebar fixed top-0 right-0 h-full w-full md:w-[420px] bg-white shadow-2xl z-40 flex flex-col ${show ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {show && selectedItem && (
            <>
              {/* Sidebar Header */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-6 flex-shrink-0">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="flex items-start justify-between mb-3">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Order Details</span>
                  <button onClick={() => setShow(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-mono text-white/50 text-[11px]">#{selectedItem._id.slice(-10).toUpperCase()}</p>
                    <h3 className="text-white font-bold text-[17px] leading-tight">{selectedItem.RetailerUser?.name || 'Order'}</h3>
                    <div className="flex gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${selectedItem.status === 'Delivered' ? 'bg-emerald-500/20 text-emerald-300'
                          : selectedItem.status === 'Cancelled' ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selectedItem.status)}`} />
                        {selectedItem.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 mx-5 -mt-4 z-10 relative">
                {[
                  { label: "Items", value: selectedItem.items.length },
                  { label: "Total", value: `Rs. ${selectedItem.total}` },
                  { label: "Steps", value: selectedItem.statuses.length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-2 py-3 text-center">
                    <p className="text-[12px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Scrollable content */}
              <div className="ord-no-scroll flex-1 overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-4">

                {/* Order tracking */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Order Tracking</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-0">
                    {selectedItem.statuses.map((orderStatus, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center">
                            <MdCheckCircle size={14} className="text-[#FF5934]" />
                          </div>
                          {index < selectedItem.statuses.length - 1 && (
                            <div className="w-0.5 h-5 bg-[#FF5934]/20 my-1" />
                          )}
                        </div>
                        <div className="pb-2 min-w-0">
                          <p className="text-[13px] font-semibold text-[#111827]">{orderStatus.status}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{new Date(orderStatus.date).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order info */}
                <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">Order Info</p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3">
                    {[
                      { icon: MdPhone, label: "Phone", value: selectedItem.phoneNumber },
                      { icon: MdLocationOn, label: "Delivery Address", value: selectedItem.shippingAddress },
                      { icon: MdCalendarToday, label: "Expected Delivery", value: new Date(selectedItem.expectedDelivery).toLocaleDateString() },
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
                    {selectedItem.items.map((item) => {
                      const hasDiscount = Number(item.discountedPrice) > 0 && Number(item.discountedPrice) < Number(item.price);
                      const unitLabel = item.type === 'ctn' ? 'CTN' : item.type === 'piece' ? 'PCS' : '';
                      return (
                        <div key={item.productId?._id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-2.5">
                          <img src={item.productId?.image} alt={item.productId?.englishTitle} className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[#111827] truncate">{item.productId?.englishTitle}</p>
                            {hasDiscount ? (
                              <p className="text-[11px]">
                                <span className="text-gray-400 line-through">{Number(item.price).toFixed(2)} Rs</span>
                                <span className="text-emerald-600 font-semibold ml-1">{Number(item.discountedPrice).toFixed(2)} Rs</span>
                              </p>
                            ) : (
                              <p className="text-[11px] text-[#FF5934] font-medium">{Number(item.price).toFixed(2)} Rs</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-[11px] font-bold text-[#374151]">
                              {item.quantity} {unitLabel}
                            </span>
                          </div>
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
                    value={selectedItem?.status}
                    className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setShow(false)}
                  className="w-full h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all shadow-md shadow-orange-100"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Order;