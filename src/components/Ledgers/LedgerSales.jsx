import { useEffect, useState } from 'react';
import Ledger from './Ledger';
import { PiToggleLeftFill } from "react-icons/pi";
import { PiToggleRightFill } from "react-icons/pi";
import { AiOutlineDownload, AiOutlineCheck, AiOutlineClose } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import ReportPdf from './ReportPdf';
import ReceiptModal from './ReceiptModal';
import { createSaleUser, deleteSaleUser, getAllCities, getDatas, getSalesPersons, updateSaleUser, updateSaleUserStatus, uploadFile, getAllRetailers, getAllBanks, addLedger, getLedgerById, addRetailerLedger, getRetailerLedgerById, deleteLedger, updateLedger, getLedgersByDateRange, updateRetailerUserStatus, searchRetailerUsers, searchSaleUsers, getRetailers, getInvoicesByRange, createRetialer, importRetailerLedgerFromExcel, approveLedger, rejectLedger } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Textarea } from '../common/textArea';
import { FaRegEye } from "react-icons/fa6";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { Spinner } from '../common/spinner';
import ClickOutside from '../../Hooks/ClickOutside';
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdRefresh, MdFileUpload, MdFileDownload,
  MdReceipt, MdPayment, MdArrowBack, MdTableChart,
  MdOutlineInventory2, MdOutlineReceipt
} from "react-icons/md";

const LIMIT = 10;
const TRANSACTIONS_PER_PAGE = 11;

/* ── Status Badge ── */
const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide
    ${active ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20' : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

/* ── Tab Button ── */
const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2.5 text-[13px] font-semibold rounded-t-xl transition-all duration-150 border-b-2
      ${active
        ? 'border-[#FF5934] text-[#FF5934] bg-white'
        : 'border-transparent text-[#9CA3AF] hover:text-[#374151] hover:bg-gray-50'
      }`}
  >
    {children}
  </button>
);

const LedgerSales = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState('');
  const [sales, setSales] = useState([]);
  const token = useSelector((state) => state.admin.token);
  const [salesData, setSalesData] = useState([]);
  const [banks, setBanks] = useState([]);
  const [transactionData, setTransactionData] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [showEditLedger, setShowEditLedger] = useState(false);
  const [filteredSalesData, setFilteredSalesData] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [data, setData] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filteredRetailers, setFilteredRetailers] = useState([]);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });

  const [isFormVisible, setFormVisible] = useState(false);
  const [newSalesPerson, setNewSalesPerson] = useState({
    id: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: ""
  });

  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [paymentData, setPaymentData] = useState({ bank: '', payment: '', details: '', date: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [actionStatuses, setActionStatuses] = useState({});
  const [ledgerPage, setLedgerPage] = useState(1);
  const [recoveryPage, setRecoveryPage] = useState(1);

  const ledgerRows = transactionData.filter((t) => {
    if (!t) return false;
    const drNum = parseFloat(String(t.dr ?? '0').replace(/[^0-9.-]/g, ''));
    return !(t.isApproved === false && drNum > 0 && !t.isImported);
  });

  const recoveryRows = transactionData.filter((t) => {
    const drNum = parseFloat(String(t.dr || '0').replace(/[^0-9.-]/g, ''));
    const crNum = parseFloat(String(t.cr || '0').replace(/[^0-9.-]/g, ''));
    return !t.isImported && t.isApproved === false && drNum > 0 && (isNaN(crNum) || crNum === 0);
  });

  const ledgerTotalPages = Math.ceil(ledgerRows.length / TRANSACTIONS_PER_PAGE) || 0;
  const recoveryTotalPages = Math.ceil(recoveryRows.length / TRANSACTIONS_PER_PAGE) || 0;
  const ledgerStart = (ledgerPage - 1) * TRANSACTIONS_PER_PAGE;
  const recoveryStart = (recoveryPage - 1) * TRANSACTIONS_PER_PAGE;
  const ledgerVisibleRows = ledgerRows.slice(ledgerStart, ledgerStart + TRANSACTIONS_PER_PAGE);
  const recoveryVisibleRows = recoveryRows.slice(recoveryStart, recoveryStart + TRANSACTIONS_PER_PAGE);

  const [isRecoveryDrawerOpen, setIsRecoveryDrawerOpen] = useState(false);
  const [recoveryImageSrc, setRecoveryImageSrc] = useState(null);

  const formatLedgerDetails = (ledger) => {
    const base = ledger?.description ?? ledger?.details ?? 'Transaction';
    const isOrderType = String(ledger?.type || '').toUpperCase() === 'ORDER';
    const looksLikeOrderText = /^Order\s+.*\s+placed$/i.test(String(base));
    return (isOrderType || looksLikeOrderText) ? 'Order punched from app' : base;
  };

  useEffect(() => {
    setLedgerPage(1);
    setRecoveryPage(1);
  }, [selectedUser?._id, activeTab, transactionData.length]);

  const handleViewRecoveryImage = (transaction) => {
    try { setRecoveryImageSrc(transaction?.image || null); }
    catch (err) { setRecoveryImageSrc(null); }
    finally { setIsRecoveryDrawerOpen(true); }
  };

  const [isAddRetailerFormVisible, setIsAddRetailerFormVisible] = useState(false);
  const [salesPersons, setSalesPersons] = useState([]);
  const [addRetailerTab, setAddRetailerTab] = useState('basic');

  const handleImportExcel = async (event) => {
    try {
      const file = event?.target?.files?.[0];
      if (!selectedUser?._id) { toast.error('Please select a user first'); return; }
      if (!file) { toast.error('Please choose an Excel file'); return; }
      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await importRetailerLedgerFromExcel(selectedUser._id, formData);
      if (res?.data?.success) { toast.success(res?.data?.msg || 'Ledger imported successfully'); }
      else { toast.success(res?.data?.msg || 'Ledger import completed'); }
      try {
        const updatedLedger = await getRetailerLedgerById(selectedUser._id);
        if (updatedLedger && updatedLedger.ledgers) {
          const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
            id: ledger.transactionId || ledger._id,
            details: formatLedgerDetails(ledger),
            refNo: ledger.refNo ?? null,
            voucherNo: ledger.voucherNo ?? null,
            quantity: ledger.quantity ?? null,
            type: ledger.type,
            dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
            sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
            isApproved: ledger.isApproved === false ? false : true,
            isRejected: ledger.isRejected === true,
            isImported: ledger.isImportedFromExcel === true,
            image: ledger.image || null,
            balance: Number(ledger.balance || 0).toLocaleString()
          }));
          setTransactionData(formattedTransactions.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
        }
      } catch (refreshErr) { console.error('[ImportExcel] Failed refreshing ledger:', refreshErr); }
    } catch (error) {
      toast.error(error?.response?.data?.msg || 'Failed to import ledger');
    } finally {
      setIsImporting(false);
      if (event?.target) event.target.value = '';
    }
  };

  const validations = yup.object().shape({
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    address: yup.string().required("Address is required"),
    cnic: yup.string().matches("^[0-9]{5}-[0-9]{7}-[0-9]$", 'cnic is not valid e.g xxxxx-xxxxxxx-x').required(),
    password: yup.string().min(6).required(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "phone number is not valid e.g +923333333333").required(),
  });

  const retailerValidationSchema = yup.object().shape({
    name: yup.string().required("Name is required"),
    email: yup.string().email("Invalid email").required("Email is required"),
    phoneNumber: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "Phone number is not valid e.g +923333333333").required("Phone number is required"),
    cnic: yup.string().matches("^[0-9]{5}-[0-9]{7}-[0-9]$", 'CNIC is not valid e.g xxxxx-xxxxxxx-x').required("CNIC is required"),
    cityID: yup.string().required("City is required"),
    shopName: yup.string().required("Shop name is required"),
    shopAddress1: yup.string().required("Shop address 1 is required"),
    shopAddress2: yup.string().required("Shop address 2 is required"),
    shopCategory: yup.string().required("Shop category is required"),
    distance: yup.number().typeError("Distance must be a number").required("Distance is required"),
    lng: yup.number().typeError("Longitude must be a number").required("Longitude is required"),
    lat: yup.number().typeError("Latitude must be a number").required("Latitude is required"),
    salesPersonID: yup.string().required("Sales person is required"),
    image: yup.mixed().nullable(),
  });

  const retailerInitialValues = {
    name: "", email: "", phoneNumber: "", cnic: "", cityID: "",
    shopName: "", shopAddress1: "", shopAddress2: "", shopCategory: "",
    distance: "", lng: "", lat: "", salesPersonID: "", image: null,
  };

  const [allInvoices, setAllInvoices] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (selectedUser?._id) {
      const fetchAllInvoices = async () => {
        try {
          setLoading(true);
          const ranges = ['1to7', '8to14', '15to30', '31to50', 'over50'];
          let allInvoiceDetails = [];
          for (const range of ranges) {
            try {
              const invoicesResponse = await getInvoicesByRange(selectedUser._id, range);
              if (invoicesResponse && invoicesResponse.invoices) {
                allInvoiceDetails = allInvoiceDetails.concat(invoicesResponse.invoices);
              }
            } catch (invoiceError) { console.error(`Error fetching ${range} invoices:`, invoiceError); }
          }
          const uniqueInvoices = Array.from(new Set(allInvoiceDetails.map(JSON.stringify)))
            .map(JSON.parse).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setAllInvoices(uniqueInvoices.map((invoice, index) => ({
            sr: index + 1, id: invoice._id,
            date: new Date(invoice.createdAt).toLocaleDateString(),
            shopName: selectedUser.shopName || 'N/A',
            total: invoice.totalAmount || 0,
            balance: invoice.balance || 0,
          })));
        } catch (error) {
          toast.error(error.response?.data?.msg || 'Failed to fetch invoices');
          setAllInvoices([]);
        } finally { setLoading(false); }
      };
      fetchAllInvoices();
    } else { setAllInvoices([]); }
  }, [selectedUser?._id]);

  const formatNumber = (num) => typeof num === 'number' ? num.toLocaleString() : '0';

  const statusToggleHandler = async (retailer) => {
    try {
      setLoading(true);
      await updateRetailerUserStatus(retailer._id, !retailer.isActive);
      setRetailers((prev) => prev.map((r) => r._id === retailer._id ? { ...r, isActive: !r.isActive } : r));
      toast.success(`Retailer ${!retailer.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update retailer status');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let filtered = retailers;
    if (filterStatus === "active") filtered = retailers.filter((r) => r.isActive);
    else if (filterStatus === "inactive") filtered = retailers.filter((r) => !r.isActive);
    setFilteredRetailers(filtered);
  }, [filterStatus, retailers]);

  const handleFilter = async () => {
    if (!selectedUser?._id) { toast.error('Please select a user first'); return; }
    if (!startDate || !endDate) { toast.error('Please select both start and end dates'); return; }
    try {
      setLoading(true);
      const formattedStart = new Date(startDate).toISOString().split('T')[0];
      const formattedEnd = new Date(endDate).toISOString().split('T')[0];
      const response = await getRetailerLedgerById(selectedUser._id);
      if (response.success && response.ledgers) {
        const filtered = response.ledgers.filter(l => {
          const d = new Date(l.date).toISOString().split('T')[0];
          return d >= formattedStart && d <= formattedEnd;
        });
        const formatted = filtered.map(ledger => ({
          id: ledger.transactionId || ledger._id,
          details: formatLedgerDetails(ledger),
          type: ledger.type,
          dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
          cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
          date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
          sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
          isApproved: ledger.isApproved === false ? false : true,
          isRejected: ledger.isRejected === true,
          isImported: ledger.isImportedFromExcel === true,
          balance: Number(ledger.balance || 0).toLocaleString()
        }));
        setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
        if (formatted.length === 0) toast.info('No transactions found for the selected date range');
      } else { setTransactionData([]); toast.info('No transactions found'); }
    } catch (error) {
      toast.error(error?.response?.data?.msg || 'Failed to filter transactions');
      setTransactionData([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { setStartDate(''); setEndDate(''); }, []);

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setSearchTerm(e.target.value);
      const link = `/retailer/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
    }
  };

  useEffect(() => {
    setLoading(true);
    const link = `/sale-user/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => { setSales(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  }, [currentPage, selectedMaritalStatus, selectedCityId]);

  const changeHandler = async (key, value) => {
    setNewSalesPerson((p) => ({ ...p, [key]: value }));
  };

  const fetchRetailers = async (specificRetailerId = null) => {
    try {
      setIsRefreshing(true);
      const response = await getAllRetailers();
      if (response?.data?.data) {
        const formattedData = response.data.data.map(retailer => ({
          _id: retailer._id || 'N/A',
          name: retailer.name || 'N/A',
          phone: retailer.phone || retailer.phoneNumber || 'N/A',
          shopName: retailer.shopName || 'N/A',
          image: retailer.image || 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
          isActive: retailer.isActive || false,
          balance: Number(retailer.balance || 0).toLocaleString() || '0',
          lastPayment: Number(retailer.lastPayment || 0).toLocaleString() || '0',
          createdAt: retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : 'N/A'
        }));
        setSalesData(formattedData);
        setFilteredSalesData(formattedData);
        if (selectedUser && (specificRetailerId === null || specificRetailerId === selectedUser._id)) {
          const updated = formattedData.find(r => r._id === selectedUser._id);
          if (updated) setSelectedUser(updated);
        }
      }
    } catch (error) { toast.error("Failed to refresh retailer data"); }
    finally { setIsRefreshing(false); }
  };

  useEffect(() => { fetchRetailers(); }, []);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await getAllBanks();
        if (response.data?.data) setBanks(response.data.data);
      } catch (error) { toast.error("Failed to load banks"); }
    };
    fetchBanks();
  }, []);

  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const response = await getSalesPersons(token);
        setSalesPersons(response.data.data || []);
      } catch (err) { console.log("Loading sales persons: ", err.message); }
    };
    fetchSalesPersons();
  }, []);

  const validationSchema = yup.object().shape({
    bank: yup.string().required('Bank is required'),
    amount: yup.number().required('Amount is required').positive('Amount must be positive'),
    date: yup.date().required('Date is required'),
    details: yup.string()
  });

  const initialValues = {
    bank: '', amount: '', details: '',
    date: new Date().toISOString().split('T')[0]
  };

  useEffect(() => {
    const fetchLedgerData = async () => {
      if (!selectedUser?._id) return;
      try {
        setLoading(true);
        const response = await getRetailerLedgerById(selectedUser._id);
        if (response.success && response.ledgers && Array.isArray(response.ledgers)) {
          if (response.ledgers.length === 0) { toast.info("No ledger entries found"); setTransactionData([]); }
          else {
            const formatted = response.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: formatLedgerDetails(ledger),
              refNo: ledger.refNo ?? null,
              voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null,
              type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
              cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              image: ledger.image || null,
              balance: Number(ledger.balance || 0).toLocaleString()
            }));
            setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
          }
        } else { toast.info("No ledger entries found"); setTransactionData([]); }
      } catch (error) {
        toast.error(error.response?.data?.msg || "Failed to fetch transaction history");
        setTransactionData([]);
      } finally { setLoading(false); }
    };
    fetchLedgerData();
  }, [selectedUser?._id]);

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    if (!selectedUser?._id) { toast.error("No user selected"); return; }
    try {
      setLoading(true);
      const response = await addRetailerLedger(selectedUser._id, {
        bankId: values.bank, amount: parseFloat(values.amount),
        date: values.date, details: values.details || "Payment Transaction", isApproved: true
      });
      if (response) {
        toast.success('Payment added successfully');
        resetForm();
        onClose();
        try {
          const updatedLedger = await getRetailerLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            const formatted = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: formatLedgerDetails(ledger),
              refNo: ledger.refNo ?? null, voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null, type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              cr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              image: ledger.image || null,
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
          }
          await fetchRetailers(selectedUser._id);
        } catch (refreshError) { console.error("Error refreshing data:", refreshError); }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to add payment');
    } finally { setLoading(false); setSubmitting(false); }
  };

  const handleRowClick = (user) => setSelectedUser(user);

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => setCities({ isLoaded: true, data: res.data.data }))
        .catch(err => console.log("Loading cities: ", err.message));
    }
  }, [cities.isLoaded]);

  const onClose = () => {
    setIsPaymentModalVisible(false);
    setPaymentData({ bank: '', payment: '', details: '', date: '' });
  };

  const handleDeleteLedger = async (ledgerId) => {
    if (!window.confirm("Are you sure you want to delete this Ledger?")) return;
    try {
      setLoading(true);
      const actualLedgerId = ledgerId.replace('#', '');
      const response = await deleteLedger(actualLedgerId);
      if (response.success) {
        toast.success('Ledger deleted successfully');
        if (selectedUser?._id) {
          const updatedLedger = await getRetailerLedgerById(selectedUser._id);
          if (updatedLedger?.ledgers) {
            const formatted = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: formatLedgerDetails(ledger),
              refNo: ledger.refNo ?? null, voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null, type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              cr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
          } else setTransactionData([]);
          await fetchRetailers(selectedUser._id);
        }
      } else throw new Error(response.msg || 'Failed to delete ledger');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete ledger');
    } finally { setLoading(false); setShowDropdown(null); }
  };

  const handleEditLedger = async (values, { setSubmitting }) => {
    if (!selectedUser?._id || !selectedLedger?.id) { toast.error('Missing required information'); return; }
    try {
      setLoading(true);
      const ledgerId = selectedLedger.id.replace('#', '');
      const updateResponse = await updateLedger(ledgerId, selectedUser._id, parseFloat(values.amount), values.date);
      if (updateResponse.success) {
        try {
          const updatedLedger = await getRetailerLedgerById(selectedUser._id);
          if (updatedLedger?.ledgers) {
            const formatted = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: ledger.description || ledger.details || 'Transaction',
              refNo: ledger.refNo ?? null, voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null, type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              image: ledger.image || null,
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
            toast.success('Ledger updated successfully');
          }
        } catch (refreshError) { toast.success('Ledger updated. Please refresh.'); }
      }
      setShowEditLedger(false);
    } catch (error) {
      toast.error(error.response?.data?.msg || error.message || 'Failed to update ledger');
    } finally { setLoading(false); setSubmitting(false); }
  };

  const refreshRetailerData = async () => {
    try {
      setIsRefreshing(true);
      const response = await getAllRetailers();
      if (response?.data?.data) {
        const formattedData = response.data.data.map(retailer => ({
          _id: retailer._id || 'N/A', name: retailer.name || 'N/A',
          phone: retailer.phone || retailer.phoneNumber || 'N/A',
          shopName: retailer.shopName || 'N/A',
          image: retailer.image || 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
          isActive: retailer.isActive || false,
          balance: Number(retailer.balance || 0).toLocaleString() || '0',
          lastPayment: Number(retailer.lastPayment || 0).toLocaleString() || '0',
          createdAt: retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : 'N/A'
        }));
        setSalesData(formattedData);
        setFilteredSalesData(formattedData);
      }
    } catch (error) { toast.error("Failed to refresh retailer data"); }
    finally { setIsRefreshing(false); }
  };

  const handleBackToList = async () => { setSelectedUser(null); await refreshRetailerData(); };

  const handleSearch = async () => {
    try {
      setLoading(true);
      if (!searchTerm.trim()) {
        const response = await getAllRetailers();
        if (response?.data?.data) {
          const formattedData = formatRetailerData(response.data.data);
          setSalesData(formattedData); setFilteredSalesData(formattedData);
        }
        return;
      }
      const response = await searchRetailerUsers({ searchTerm: searchTerm.trim(), page: currentPage, limit: LIMIT });
      if (response?.data?.data) {
        const formattedData = formatRetailerData(response.data.data);
        setSalesData(formattedData); setFilteredSalesData(formattedData);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) { toast.error(error.response?.data?.message || "Failed to search retailers"); }
    finally { setLoading(false); }
  };

  const formatRetailerData = (retailers) => retailers.map(retailer => ({
    _id: retailer._id || 'N/A', name: retailer.name || 'N/A',
    phone: retailer.phone || retailer.phoneNumber || 'N/A',
    shopName: retailer.shopName || 'N/A',
    image: retailer.image || 'https://developers.elementor.com/docs/assets/img/elementor-placeholder-image.png',
    isActive: retailer.isActive || false,
    balance: Number(retailer.balance || 0).toLocaleString() || '0',
    lastPayment: Number(retailer.lastPayment || 0).toLocaleString() || '0',
    createdAt: retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : 'N/A'
  }));

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value === '') setFilteredSalesData(salesData);
    else setFilteredSalesData(salesData.filter(r => r.name.toLowerCase().includes(value.toLowerCase())));
  };

  const handleSearchKeyPress = (e) => { if (e.key === 'Enter') handleSearch(); };

  useEffect(() => {
    let filtered = salesData;
    if (filterStatus === 'active') filtered = salesData.filter(r => r.isActive === true);
    else if (filterStatus === 'inactive') filtered = salesData.filter(r => r.isActive === false);
    setFilteredSalesData(filtered);
  }, [filterStatus, salesData]);

  const handleFilterChange = (e) => setFilterStatus(e.target.value);
  const handleDropdown = (id) => setShowDropdown(prev => prev === id ? null : id);

  const handleEdit = (data) => {
    setFormVisible(true);
    setNewSalesPerson({
      id: data._id, name: data.name, email: data.email || "",
      password: "", phone: data.phone, address: data.address || "",
      image: data.image, cnic: data.cnic || "", city: data.city || ""
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this retailer?")) return;
    try {
      setLoading(true);
      await deleteSaleUser(id);
      toast.success("Retailer deleted successfully!");
      await refreshRetailerData();
    } catch (error) { toast.error(error.response?.data?.message || "Failed to delete retailer"); }
    finally { setLoading(false); }
  };

  const onDownload = (transaction) => { setSelectedTransaction(transaction); setShowReceiptModal(true); };

  const handleAddRetailer = async (values, { setSubmitting, resetForm }) => {
    try {
      setLoading(true);
      const formData = new FormData();
      Object.entries(values).forEach(([key, val]) => { if (key !== 'image') formData.append(key, val || ""); });
      if (values.image) formData.append("file", values.image);
      const response = await createRetialer(formData, token);
      if (response.data && response.data.msg === "success") {
        toast.success("Retailer added successfully!");
        await fetchRetailers();
        setIsAddRetailerFormVisible(false);
        resetForm();
      } else throw new Error(response.data.msg || "Failed to add retailer");
    } catch (error) {
      toast.error(error.response?.data?.msg || error.message || "Failed to add retailer");
    } finally { setLoading(false); setSubmitting(false); }
  };

  const handleRecoveryToggle = async (transaction) => {
    try {
      if (!transaction?.id) { toast.error('Missing ledger ID for approval'); return; }
      setLoading(true);
      const res = await approveLedger(String(transaction.id), { isApproved: true });
      if (res?.success) toast.success(res?.msg || 'Approved and moved to Ledger');
      else toast.info(res?.msg || 'Approval processed');
      if (selectedUser?._id) {
        const updatedLedger = await getRetailerLedgerById(selectedUser._id);
        if (updatedLedger && updatedLedger.ledgers) {
          const formatted = updatedLedger.ledgers.map(ledger => ({
            id: ledger.transactionId || ledger._id,
            details: formatLedgerDetails(ledger),
            refNo: ledger.refNo ?? null, voucherNo: ledger.voucherNo ?? null,
            quantity: ledger.quantity ?? null, type: ledger.type,
            dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
            sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
            isApproved: ledger.isApproved === false ? false : true,
            isRejected: ledger.isRejected === true,
            isImported: ledger.isImportedFromExcel === true,
            image: ledger.image || null,
            balance: Number(ledger.balance || 0).toLocaleString()
          }));
          setTransactionData(formatted.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0)));
        }
      }
    } catch (err) { toast.error(err?.response?.data?.msg || 'Failed to approve entry'); }
    finally { setLoading(false); }
  };

  const handleApproveAction = async (transaction) => {
    try {
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: 'approved' }));
      await handleRecoveryToggle(transaction);
    } catch (err) { setActionStatuses((prev) => ({ ...prev, [transaction.id]: undefined })); }
  };

  const handleRejectAction = async (transaction) => {
    try {
      if (!transaction?.id) { toast.error('Missing ledger ID for rejection'); return; }
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: 'rejected' }));
      const res = await rejectLedger(String(transaction.id), { isRejected: true });
      if (res?.success) toast.success(res?.msg || 'Entry rejected');
      else toast.info(res?.msg || 'Rejection processed');
      if (selectedUser?._id) {
        const updatedLedger = await getRetailerLedgerById(selectedUser._id);
        if (updatedLedger && updatedLedger.ledgers) {
          const formatted = updatedLedger.ledgers.map(ledger => ({
            id: ledger.transactionId || ledger._id,
            details: formatLedgerDetails(ledger),
            refNo: ledger.refNo ?? null, voucherNo: ledger.voucherNo ?? null,
            quantity: ledger.quantity ?? null, type: ledger.type,
            dr: ledger.type !== 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            cr: ledger.type === 'PAYMENT' ? Number(ledger.amount || 0).toLocaleString() : '0',
            date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
            sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
            isApproved: ledger.isApproved === false ? false : true,
            isRejected: ledger.isRejected === true,
            isImported: ledger.isImportedFromExcel === true,
            image: ledger.image || null,
          }));
          setTransactionData(formatted.sort((a, b) => b.sortTime - a.sortTime));
        }
      }
    } catch (err) {
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: undefined }));
      toast.error(err?.response?.data?.msg || err.message || 'Failed to reject entry');
    }
  };

  if (loading) return <Loader />;

  const closePaymentModal = () => {
    setIsPaymentModalVisible(false);
    setPaymentData({ bank: '', payment: '', details: '', date: '' });
  };

  /* ── Shared input style ── */
  const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

  /* ── Shared action button for toolbar ── */
  const ToolbarBtn = ({ onClick, children, icon: Icon, href, download, as: Tag = 'button' }) => {
    const cls = "flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-150";
    if (href) return <a href={href} download={download} className={cls}>{Icon && <Icon size={15} />}{children}</a>;
    return <button onClick={onClick} className={cls}>{Icon && <Icon size={15} />}{children}</button>;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        .ls-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .ls-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .ls-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .filter-select-ls {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-overlay-ls { animation: overlayIn 0.2s ease; }
        .modal-card-ls    { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .no-scroll-ls::-webkit-scrollbar { display: none; }
        .no-scroll-ls { scrollbar-width: none; }
      `}</style>

      <div className="ls-page">
        <Ledger />

        {!selectedUser ? (
          /* ══════════════════════════════════════════
              CUSTOMER LIST VIEW
          ══════════════════════════════════════════ */
          <>
            {/* Page Header */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Customers</h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">{filteredSalesData.length} records found</p>
              </div>
              <button
                onClick={() => setIsAddRetailerFormVisible(true)}
                className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
              >
                <MdPersonAdd size={18} />
                Add Customer
              </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyPress={handleSearchKeyPress}
                  className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                  type="search"
                  placeholder="Search by name…"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                <MdFilterList size={16} className="text-[#9CA3AF]" />
                <select
                  value={filterStatus}
                  onChange={handleFilterChange}
                  className="filter-select-ls bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                    {["Customer", "ID", "Phone", "Balance", "Last Payment", "Active", "Actions"].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSalesData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <MdFilterList size={24} className="text-gray-300" />
                          </div>
                          <p className="text-[#9CA3AF] text-sm font-medium">No customers found</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredSalesData.map((data) => (
                    <tr key={data._id} className="table-row cursor-pointer">
                      {/* Customer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <img
                              src={data.image}
                              alt={data.name}
                              className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                              onError={(e) => { e.target.src = '/default-profile.png'; }}
                            />
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${data.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827] leading-tight">{data.name}</p>
                            {data.shopName && data.shopName !== 'N/A' && (
                              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{data.shopName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{data._id.slice(0, 6)}
                        </span>
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3 text-[13px] text-[#374151]">{data.phone}</td>
                      {/* Balance */}
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {data.balance}</td>
                      {/* Last Payment */}
                      <td className="px-4 py-3 text-[13px] text-[#374151]">PKR {data.lastPayment}</td>
                      {/* Active */}
                      <td className="px-4 py-3">
                        <button
                          className="flex items-center transition-opacity hover:opacity-80"
                          onClick={() => statusToggleHandler(data)}
                        >
                          {data.isActive
                            ? <PiToggleRightFill size={26} className="text-emerald-500" />
                            : <PiToggleLeftFill size={26} className="text-gray-300" />
                          }
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedUser(data)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all duration-150"
                            title="View"
                          >
                            <FaRegEye size={14} />
                          </button>
                          <div className="relative">
                            <button
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-[#9CA3AF] border border-gray-100 transition-all duration-150"
                              onClick={() => handleDropdown(data._id)}
                              title="More options"
                            >
                              <HiDotsVertical size={14} />
                            </button>
                            {showDropdown === data._id && (
                              <div className="absolute right-0 mt-2 w-36 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 overflow-hidden">
                                <button
                                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-[#374151] hover:bg-[#FFF4F2] hover:text-[#FF5934] transition-colors"
                                  onClick={() => { handleEdit(data); setShowDropdown(null); }}
                                >Edit</button>
                                <button
                                  className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                                  onClick={() => { handleDelete(data._id); setShowDropdown(null); }}
                                >Delete</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center mt-4">
              <div className="flex items-center gap-1.5">
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <GrFormPrevious size={16} />
                </button>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                  <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                  <span className="text-gray-300">/</span>
                  <span>{totalPages}</span>
                </div>
                <button
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                  disabled={totalPages <= currentPage}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <GrFormNext size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ══════════════════════════════════════════
              DETAIL VIEW
          ══════════════════════════════════════════ */
          <div className="w-full">
            {/* Detail Header */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all duration-150 shadow-sm"
                >
                  <MdArrowBack size={18} />
                </button>
                <div>
                  <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                    {selectedUser.name}
                  </h2>
                  <p className="text-sm text-[#9CA3AF] mt-0.5">
                    Total Balance: <span className="font-bold text-[#FF5934]">PKR {selectedUser.balance}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
              <div className="flex border-b border-gray-100 px-4 pt-3 gap-1">
                <TabBtn active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>
                  <span className="flex items-center gap-1.5"><MdTableChart size={14} />Ledger</span>
                </TabBtn>
                <TabBtn active={activeTab === 'invoice'} onClick={() => setActiveTab('invoice')}>
                  <span className="flex items-center gap-1.5"><MdOutlineInventory2 size={14} />Invoice</span>
                </TabBtn>
                <TabBtn active={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')}>
                  <span className="flex items-center gap-1.5"><MdOutlineReceipt size={14} />Recovery</span>
                </TabBtn>
              </div>

              {/* ── LEDGER TAB ── */}
              {activeTab === 'ledger' && (
                <div className="p-4">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    {/* Date filter */}
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                      <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                        value={startDate} onChange={e => setStartDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]} />
                      <span className="text-[#9CA3AF] text-xs">to</span>
                      <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                        value={endDate} onChange={e => setEndDate(e.target.value)}
                        min={startDate} max={new Date().toISOString().split('T')[0]} />
                      <button onClick={handleFilter} disabled={!startDate || !endDate}
                        className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors">
                        Filter
                      </button>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Link to="/reportpdf" state={{ selectedUser, transactionData, type: 'sales' }}>
                        <ToolbarBtn icon={MdReceipt}>Report</ToolbarBtn>
                      </Link>
                      <ToolbarBtn icon={MdPayment} onClick={() => setIsPaymentModalVisible(true)}>Add Payment</ToolbarBtn>
                      <label className="flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer">
                        <MdFileUpload size={15} />
                        {isImporting ? 'Importing…' : 'Import Excel'}
                        <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} style={{ display: 'none' }} />
                      </label>
                      <a href="/customer_statement_sample.xlsx" download
                        className="flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-150">
                        <MdFileDownload size={15} /> Sample
                      </a>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {["ID", "Details", "Ref No.", "V. No.", "Qty", "Dr.", "Cr.", "Date", "Balance", ""].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledgerVisibleRows.length === 0 ? (
                          <tr><td colSpan={10} className="py-12 text-center text-[#9CA3AF] text-sm">No transactions found</td></tr>
                        ) : ledgerVisibleRows.map((transaction, index) => (
                          <tr key={index} className="table-row hover:bg-[#FFFAF9]">
                            <td className="px-3 py-3">
                              <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[13px] text-[#374151] max-w-[160px] truncate">{transaction.details}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.refNo ?? '—'}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.voucherNo ?? '—'}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.quantity ?? '—'}</td>
                            <td className="px-3 py-3">
                              {transaction.dr !== "0"
                                ? <span className="text-[13px] font-semibold text-emerald-600">PKR {transaction.dr}</span>
                                : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className="px-3 py-3">
                              {transaction.cr !== "0"
                                ? <span className="text-[13px] font-semibold text-red-500">PKR {transaction.cr}</span>
                                : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className="px-3 py-3 text-[12px] text-[#6B7280]">{transaction.date}</td>
                            <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">PKR {transaction.balance}</td>
                            <td className="px-3 py-3">
                              <div className="relative">
                                <button
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#9CA3AF] transition-colors"
                                  onClick={(e) => { e.stopPropagation(); setShowDropdown(p => p === transaction.id ? null : transaction.id); }}
                                >
                                  <HiDotsVertical size={16} />
                                </button>
                                {showDropdown === transaction.id && (
                                  <ClickOutside onClick={() => setShowDropdown(null)}>
                                    <div className="absolute right-0 mt-1 w-32 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 overflow-hidden">
                                      <button onClick={() => { setSelectedLedger(transaction); setShowEditLedger(true); setShowDropdown(null); }}
                                        className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-[#374151] hover:bg-[#FFF4F2] hover:text-[#FF5934]">Edit</button>
                                      <button onClick={() => handleDeleteLedger(transaction.id)}
                                        className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50">Delete</button>
                                    </div>
                                  </ClickOutside>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Ledger Pagination */}
                  {ledgerRows.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-4">
                      <button disabled={ledgerPage === 1} onClick={() => setLedgerPage(p => p - 1)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                        <span className="font-semibold text-[#FF5934]">{ledgerPage}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span>{ledgerTotalPages || 1}</span>
                      </div>
                      <button disabled={ledgerPage >= ledgerTotalPages} onClick={() => setLedgerPage(p => p + 1)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
                        <GrFormNext size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── INVOICE TAB ── */}
              {activeTab === 'invoice' && (
                <div className="p-4">
                  <div className="flex justify-end mb-5">
                    <Link to="/reportpdf" state={{ selectedUser, allInvoices, type: 'sales' }}>
                      <ToolbarBtn icon={MdReceipt}>Report</ToolbarBtn>
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {["Sr.", "ID", "Date", "Amount", "Action"].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {allInvoices.length === 0 ? (
                          <tr><td colSpan={5} className="py-12 text-center text-[#9CA3AF] text-sm">No invoices found</td></tr>
                        ) : allInvoices.map((invoice) => (
                          <tr key={invoice.id} className="table-row">
                            <td className="px-4 py-3 text-[13px] text-[#9CA3AF]">{invoice.sr}</td>
                            <td className="px-4 py-3">
                              <span className="text-[12px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                #{invoice.id.slice(0, 6)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[13px] text-[#374151]">{invoice.date}</td>
                            <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {formatNumber(invoice.total)}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => onDownload(invoice)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all duration-150"
                                title="Download"
                              >
                                <AiOutlineDownload size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── RECOVERY TAB ── */}
              {activeTab === 'recovery' && (
                <div className="p-4">
                  {/* Date filter */}
                  <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 mb-5 w-fit">
                    <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                      value={startDate} onChange={e => setStartDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]} />
                    <span className="text-[#9CA3AF] text-xs">to</span>
                    <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                      value={endDate} onChange={e => setEndDate(e.target.value)}
                      min={startDate} max={new Date().toISOString().split('T')[0]} />
                    <button onClick={handleFilter} disabled={!startDate || !endDate}
                      className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors">
                      Filter
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {["ID", "Details", "Ref No.", "V. No.", "Qty", "Dr.", "Date", "Balance", "Action"].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recoveryVisibleRows.length === 0 ? (
                          <tr><td colSpan={9} className="py-12 text-center text-[#9CA3AF] text-sm">No recovery entries</td></tr>
                        ) : recoveryVisibleRows.map((transaction, index) => (
                          <tr key={index} className="table-row">
                            <td className="px-3 py-3">
                              <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[13px] text-[#374151] max-w-[140px] truncate">{transaction.details}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.refNo ?? '—'}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.voucherNo ?? '—'}</td>
                            <td className="px-3 py-3 text-[12px] text-[#9CA3AF]">{transaction.quantity ?? '—'}</td>
                            <td className="px-3 py-3">
                              {transaction.dr !== "0"
                                ? <span className="text-[13px] font-semibold text-emerald-600">PKR {transaction.dr}</span>
                                : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className="px-3 py-3 text-[12px] text-[#6B7280]">{transaction.date}</td>
                            <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">PKR {transaction.balance}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                {transaction.isRejected === true ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-600 ring-1 ring-red-200">Rejected</span>
                                ) : actionStatuses[transaction.id] === 'approved' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">Approved</span>
                                ) : actionStatuses[transaction.id] === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-600 ring-1 ring-red-200">Rejected</span>
                                ) : (
                                  <>
                                    <button onClick={() => handleApproveAction(transaction)} title="Approve"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100 transition-all">
                                      <AiOutlineCheck size={14} />
                                    </button>
                                    <button onClick={() => handleRejectAction(transaction)} title="Reject"
                                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100 transition-all">
                                      <AiOutlineClose size={14} />
                                    </button>
                                  </>
                                )}
                                <button onClick={() => handleViewRecoveryImage(transaction)} title="View Image"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all">
                                  <FaRegEye size={13} />
                                </button>
                                <div className="relative">
                                  <button
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-[#9CA3AF] transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setShowDropdown(p => p === transaction.id ? null : transaction.id); }}
                                  >
                                    <HiDotsVertical size={15} />
                                  </button>
                                  {showDropdown === transaction.id && (
                                    <ClickOutside onClick={() => setShowDropdown(null)}>
                                      <div className="absolute right-0 mt-1 w-32 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 overflow-hidden">
                                        <button onClick={() => { setSelectedLedger(transaction); setShowEditLedger(true); setShowDropdown(null); }}
                                          className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-[#374151] hover:bg-[#FFF4F2] hover:text-[#FF5934]">Edit</button>
                                        <button onClick={() => handleDeleteLedger(transaction.id)}
                                          className="w-full text-left px-3 py-2.5 text-[13px] font-medium text-red-500 hover:bg-red-50">Delete</button>
                                      </div>
                                    </ClickOutside>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Recovery Pagination */}
                  {recoveryRows.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-4">
                      <button disabled={recoveryPage === 1} onClick={() => setRecoveryPage(p => p - 1)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
                        <GrFormPrevious size={16} />
                      </button>
                      <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                        <span className="font-semibold text-[#FF5934]">{recoveryPage}</span>
                        <span className="text-gray-300 mx-1">/</span>
                        <span>{recoveryTotalPages || 1}</span>
                      </div>
                      <button disabled={recoveryPage >= recoveryTotalPages} onClick={() => setRecoveryPage(p => p + 1)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
                        <GrFormNext size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            PAYMENT MODAL
        ══════════════════════════════════════════ */}
        {isPaymentModalVisible && (
          <div className="modal-overlay-ls fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <div className="modal-card-ls bg-white w-full max-w-[380px] max-h-[94vh] overflow-auto rounded-3xl shadow-2xl">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Transaction</p>
                    <h2 className="text-white text-lg font-bold">Add Payment</h2>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={initialValues} validationSchema={validationSchema} onSubmit={handleSubmit}>
                {({ values, handleChange, errors, touched }) => (
                  <Form className="p-6 flex flex-col gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Select Bank</label>
                      <select name="bank" value={values.bank} onChange={handleChange} className={inputCls}>
                        <option value="">Choose a bank…</option>
                        {banks.filter(b => b.isActive).map(bank => (
                          <option key={bank._id} value={bank._id}>{bank.bankName} — {bank.accountTitle}</option>
                        ))}
                      </select>
                      {touched.bank && errors.bank && <p className="text-red-500 text-[11px] mt-1">{errors.bank}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Amount</label>
                      <input type="number" name="amount" value={values.amount} onChange={handleChange}
                        className={inputCls} placeholder="0.00" />
                      {touched.amount && errors.amount && <p className="text-red-500 text-[11px] mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Details</label>
                      <textarea name="details" value={values.details} onChange={handleChange}
                        className={`${inputCls} resize-none`} placeholder="Optional note…" rows={3} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Date</label>
                      <input type="date" name="date" value={values.date} onChange={handleChange}
                        max={new Date().toISOString().split("T")[0]} className={inputCls} />
                      {touched.date && errors.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={onClose}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                        {loading ? 'Processing…' : 'Save Payment'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ADD CUSTOMER MODAL
        ══════════════════════════════════════════ */}
        {isAddRetailerFormVisible && (
          <div className="modal-overlay-ls fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-ls bg-white w-full max-w-[620px] max-h-[94vh] overflow-auto rounded-3xl shadow-2xl flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">New Profile</p>
                    <h2 className="text-white text-xl font-bold">Add Customer</h2>
                  </div>
                  <button onClick={() => setIsAddRetailerFormVisible(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={retailerInitialValues} validationSchema={retailerValidationSchema} onSubmit={handleAddRetailer}>
                {({ values, handleChange, errors, touched, setFieldValue }) => (
                  <Form className="no-scroll-ls overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 py-5 flex flex-col gap-4">
                      {/* Core fields */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: 'name', label: 'Full Name', placeholder: 'Customer name', span: 2 },
                          { name: 'email', label: 'Email', placeholder: 'email@example.com' },
                          { name: 'phoneNumber', label: 'Phone Number', placeholder: '+923001234567' },
                          { name: 'cnic', label: 'CNIC', placeholder: 'xxxxx-xxxxxxx-x' },
                          { name: 'shopName', label: 'Shop Name', placeholder: 'Enter shop name' },
                          { name: 'shopAddress1', label: 'Shop Address 1', placeholder: 'Address line 1', span: 2 },
                          { name: 'shopAddress2', label: 'Shop Address 2', placeholder: 'Address line 2', span: 2 },
                          { name: 'shopCategory', label: 'Shop Category', placeholder: 'e.g. Retail' },
                          { name: 'distance', label: 'Distance (km)', placeholder: '0', type: 'number' },
                          { name: 'lng', label: 'Longitude', placeholder: '0.000', type: 'number' },
                          { name: 'lat', label: 'Latitude', placeholder: '0.000', type: 'number' },
                        ].map(({ name, label, placeholder, span, type }) => (
                          <div key={name} className={span === 2 ? 'col-span-2' : ''}>
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                            <input name={name} type={type || 'text'} placeholder={placeholder}
                              value={values[name]} onChange={handleChange}
                              className={`${inputCls} ${errors[name] && touched[name] ? 'border-red-400 ring-1 ring-red-300' : ''}`} />
                            {errors[name] && touched[name] && <p className="text-red-500 text-[11px] mt-1">{errors[name]}</p>}
                          </div>
                        ))}

                        {/* City select */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">City</label>
                          <select name="cityID" value={values.cityID} onChange={handleChange}
                            className={`${inputCls} ${errors.cityID && touched.cityID ? 'border-red-400' : ''}`}>
                            <option value="">Select City</option>
                            {cities.data.map(city => <option value={city._id} key={city._id}>{city.name}</option>)}
                          </select>
                        </div>

                        {/* Sales person select */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Sales Person</label>
                          <select name="salesPersonID" value={values.salesPersonID} onChange={handleChange}
                            className={`${inputCls} ${errors.salesPersonID && touched.salesPersonID ? 'border-red-400' : ''}`}>
                            <option value="">Select Sales Person</option>
                            {salesPersons.map(p => <option value={p._id} key={p._id}>{p.name}</option>)}
                          </select>
                        </div>

                        {/* Image upload */}
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Profile Image</label>
                          <input type="file" name="image" onChange={e => setFieldValue("image", e.currentTarget.files[0])}
                            className={inputCls} />
                        </div>
                      </div>

                      {/* Tab Navigation */}
                      <div className="border-b border-gray-100 flex gap-1 mt-2">
                        {[
                          { key: 'basic', label: 'Basic' },
                          { key: 'address', label: 'Address' },
                          { key: 'taxInfo', label: 'Tax Info' },
                        ].map(({ key, label }) => (
                          <button key={key} type="button" onClick={() => setAddRetailerTab(key)}
                            className={`px-4 py-2.5 text-[13px] font-semibold rounded-t-lg border-b-2 transition-all
                              ${addRetailerTab === key ? 'border-[#FF5934] text-[#FF5934]' : 'border-transparent text-[#9CA3AF] hover:text-[#374151]'}`}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {addRetailerTab === 'address' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Billing Address</label>
                            <input name="billingAddress" placeholder="Billing address" value={values.billingAddress || ''} onChange={handleChange} className={inputCls} />
                          </div>
                          {[
                            { name: 'city', label: 'City' },
                            { name: 'province', label: 'Province' },
                            { name: 'postalCode', label: 'Postal Code' },
                            { name: 'country', label: 'Country' },
                          ].map(({ name, label }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={label} value={values[name] || ''} onChange={handleChange} className={inputCls} />
                            </div>
                          ))}
                        </div>
                      )}

                      {addRetailerTab === 'taxInfo' && (
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { name: 'ntn', label: 'NTN' },
                            { name: 'stn', label: 'STN' },
                          ].map(({ name, label }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={label} value={values[name] || ''} onChange={handleChange} className={inputCls} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                      <button type="button" onClick={() => setIsAddRetailerFormVisible(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                        {loading ? 'Saving…' : 'Add Customer'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            EDIT LEDGER MODAL
        ══════════════════════════════════════════ */}
        {showEditLedger && (
          <div className="modal-overlay-ls fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-ls bg-white w-full max-w-[380px] rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Ledger</p>
                    <h2 className="text-white text-lg font-bold">Edit Entry</h2>
                  </div>
                  <button onClick={() => setShowEditLedger(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <Formik
                initialValues={{
                  amount: selectedLedger?.dr !== "0" ? selectedLedger?.dr.replace(/[^0-9.]/g, '') : selectedLedger?.cr.replace(/[^0-9.]/g, ''),
                  date: selectedLedger?.date
                }}
                validationSchema={yup.object().shape({
                  amount: yup.string().matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number').required('Amount is required'),
                  date: yup.string().required('Date is required')
                })}
                onSubmit={handleEditLedger}
              >
                {({ values, handleChange, errors, touched }) => (
                  <Form className="p-6 flex flex-col gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Amount</label>
                      <input name="amount" placeholder="0.00" value={values.amount} onChange={handleChange}
                        className={`${inputCls} ${errors.amount && touched.amount ? 'border-red-400' : ''}`} />
                      {errors.amount && touched.amount && <p className="text-red-500 text-[11px] mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Date</label>
                      <input type="date" name="date" value={values.date} onChange={handleChange}
                        max={new Date().toISOString().split("T")[0]}
                        className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`} />
                      {errors.date && touched.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowEditLedger(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={loading}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                        {loading ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            RECOVERY IMAGE DRAWER
        ══════════════════════════════════════════ */}
        {isRecoveryDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="flex-1 bg-black/40" onClick={() => setIsRecoveryDrawerOpen(false)} />
            <div className="w-[380px] max-w-[90vw] bg-white h-full shadow-2xl overflow-auto flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-[15px] font-bold text-[#111827]">Recovery Image</h3>
                <button onClick={() => setIsRecoveryDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-[#9CA3AF] transition-colors">
                  <AiOutlineClose size={16} />
                </button>
              </div>
              <div className="p-5 flex-1">
                {recoveryImageSrc ? (
                  <img src={recoveryImageSrc} alt="Recovery" className="w-full h-auto rounded-2xl shadow-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-[#9CA3AF] gap-2">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                      <MdFileDownload size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm">No image available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showReceiptModal && selectedTransaction && (
          <ReceiptModal transaction={selectedTransaction} onClose={() => setShowReceiptModal(false)} type="sales" />
        )}
      </div>
    </>
  );
};

export default LedgerSales;