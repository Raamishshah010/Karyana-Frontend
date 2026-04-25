import { useEffect, useState, useMemo } from 'react';
import Ledger from './Ledger';
import { Link } from 'react-router-dom';
import ReceiptModal from './ReceiptModal';
import ReportPdf from './ReportPdf'
import { PiToggleLeftFill } from "react-icons/pi";
import { PiToggleRightFill } from "react-icons/pi";
import { AiOutlineDownload } from 'react-icons/ai';
import { getAllCities, getDatas, getAllPurchases, addPurchase, updatePurchase, updatePurchaseStatus, searchPurchases, deletePurchase, getLedgerById, addLedger, getAllBanks, getAllRetailers, addDirectPayment, getTransactionsByCompanyId, getLedgersByDateRange, deleteLedger, updateLedger, addPurchaseLedger, getProducts, getRetailerLedgerById, getInvoicesByPurchaseId, generatePurchaseInvoicePDF } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik, FieldArray, Field } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Spinner } from '../common/spinner';
import { Textarea } from '../common/textArea';
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import { FaPlus } from 'react-icons/fa';
import GroupedSelect from '../common/GroupedSelect';
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdRefresh, MdArrowBack, MdTableChart,
  MdOutlineInventory2, MdReceipt, MdPayment, MdBusiness,
  MdPhone, MdLocationOn, MdEmail, MdAccountBalance,
  MdFileDownload, MdAddCircleOutline, MdCreditCard,
} from "react-icons/md";

const LIMIT = 10;
const TRANSACTIONS_PER_PAGE = 11;
const INVOICES_PER_PAGE = 10;

/* ── Shared Tab Button ── */
const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-t-xl transition-all duration-150 border-b-2
      ${active
        ? 'border-[#FF5934] text-[#FF5934] bg-white'
        : 'border-transparent text-[#9CA3AF] hover:text-[#374151] hover:bg-gray-50'
      }`}
  >
    {children}
  </button>
);

/* ── Toolbar action button ── */
const ToolbarBtn = ({ onClick, children, icon: Icon, href, download }) => {
  const cls = "flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer";
  if (href) return <a href={href} download={download} className={cls}>{Icon && <Icon size={15} />}{children}</a>;
  return <button onClick={onClick} className={cls}>{Icon && <Icon size={15} />}{children}</button>;
};

/* ── Field group label ── */
const FieldGroup = ({ label, children, span2 }) => (
  <div className={span2 ? 'col-span-2' : ''}>
    <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
    {children}
  </div>
);

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

const Purchase = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showDirectPayment, setShowDirectPayment] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [transactionData, setTransactionData] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showEditLedger, setShowEditLedger] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [formTab, setFormTab] = useState('address');
  const [invoices, setInvoices] = useState([]);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [products, setProducts] = useState([]);
  const [limit] = useState(100);

  // Pagination states
  const [ledgerPage, setLedgerPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);

  const [state, setState] = useState({
    id: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: ""
  });
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentData, setPaymentData] = useState({ bank: '', payment: '', details: '', date: '' });
  const [selectedLocation, setSelectedLocation] = useState(null);

  const token = useSelector((state) => state.admin.token);

  // Pagination derived values
  const reversedTransactions = [...transactionData].reverse();
  const ledgerTotalPages = Math.ceil(reversedTransactions.length / TRANSACTIONS_PER_PAGE) || 1;
  const ledgerStart = (ledgerPage - 1) * TRANSACTIONS_PER_PAGE;
  const ledgerVisibleRows = reversedTransactions.slice(ledgerStart, ledgerStart + TRANSACTIONS_PER_PAGE);

  const invoiceTotalPages = Math.ceil(invoices.length / INVOICES_PER_PAGE) || 1;
  const invoiceStart = (invoicePage - 1) * INVOICES_PER_PAGE;
  const invoiceVisibleRows = invoices.slice(invoiceStart, invoiceStart + INVOICES_PER_PAGE);

  // Reset pages on user/tab change
  useEffect(() => {
    setLedgerPage(1);
    setInvoicePage(1);
  }, [selectedUser?._id, activeTab]);

  const groupedProducts = useMemo(() => {
    if (!products) return [];
    const filteredProducts = products.filter(product =>
      !selectedLocation || product.location === selectedLocation || product.location === undefined
    );
    return Object.entries(
      filteredProducts.reduce((acc, product) => {
        const category = product.category || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push({
          value: product._id,
          label: product.englishTitle || product.urduTitle || 'Unnamed Product',
          data: product
        });
        return acc;
      }, {})
    ).map(([category, options]) => ({
      label: category,
      options: options.sort((a, b) => a.label.localeCompare(b.label))
    }));
  }, [products, selectedLocation]);

  useEffect(() => {
    if (selectedUser?._id) {
      const fetchInvoices = async () => {
        try {
          setLoading(true);
          const response = await getInvoicesByPurchaseId(selectedUser._id);
          if (response.success && response.invoices) {
            setInvoices(response.invoices.map((invoice, index) => ({
              sr: index + 1,
              id: invoice.invoiceId,
              _id: invoice._id.toString(),
              date: new Date(invoice.date).toLocaleDateString(),
              biltyNumber: invoice.biltyNumber,
              vehicleNumber: invoice.vehicleNumber,
              items: invoice.items.length,
              freightAmount: invoice.freightAmount || 0,
              details: invoice.details,
              total: invoice.totalAmount || 0,
              fullInvoice: invoice
            })));
          } else {
            setInvoices([]);
            toast.info('No invoices found for this company');
          }
        } catch (error) {
          toast.error(error.response?.data?.msg || 'Failed to fetch invoices');
          setInvoices([]);
        } finally { setLoading(false); }
      };
      fetchInvoices();
    } else { setInvoices([]); }
  }, [selectedUser?._id]);

  const purchaseValidations = yup.object().shape({
    companyName: yup.string().required("Company Name is required"),
    phone: yup.string().matches(/^(\+92|92|0)?[345]\d{9}$/, "Phone number is not valid e.g +923333333333").required("Phone number is required"),
    address: yup.string().required("Address is required"),
    email: yup.string().email("Invalid email address").nullable(),
    accountNo: yup.string().nullable(),
    title: yup.string().nullable(),
    firstName: yup.string().nullable(),
    lastName: yup.string().nullable(),
    mobile: yup.string().matches(/^(\+92|92|0)?[345]\d{9}$/, "Mobile number is not valid e.g +923333333333").nullable(),
    secondaryPhone: yup.string().matches(/^(\+92|92|0)?[345]\d{9}$/, "Secondary phone is not valid").nullable(),
    website: yup.string().url("Invalid URL").nullable(),
    billingAddress: yup.string().nullable(),
    city: yup.string().nullable(),
    province: yup.string().nullable(),
    postalCode: yup.string().nullable(),
    country: yup.string().nullable(),
    ntn: yup.string().nullable(),
    stn: yup.string().nullable(),
    cnic: yup.string().required("CNIC is required").matches(/^\d{5}-\d{7}-\d{1}$/, "CNIC must be in format xxxxx-xxxxxxx-x"),
    bankName: yup.string().nullable(),
    accountName: yup.string().nullable(),
    accountNumber: yup.string().nullable(),
    iban: yup.string().nullable(),
    swiftCode: yup.string().nullable(),
    bankAddress: yup.string().nullable(),
  });

  const paymentValidationSchema = yup.object().shape({
    bank: yup.string().required('Bank is required'),
    amount: yup.string().matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number').required('Amount is required'),
    date: yup.string().required('Date is required'),
    details: yup.string().required('Details are required'),
  });

  const directPaymentValidationSchema = yup.object().shape({
    retailer: yup.string().required('Retailer is required'),
    amount: yup.string().matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number').required('Amount is required'),
    date: yup.string().required('Date is required'),
    details: yup.string().required('Details are required'),
  });

  const purchaseValidationSchema = yup.object().shape({
    biltyNumber: yup.string().required('Bilty Number is required'),
    vehicleNumber: yup.string().required('Vehicle Number is required'),
    date: yup.string().required('Date is required'),
    freightAmount: yup.number().min(0, 'Freight amount cannot be negative'),
    items: yup.array().of(yup.object().shape({
      product: yup.string().required('Product is required'),
      purchaseRate: yup.number().required('Purchase Rate is required'),
      quantity: yup.number().required('Quantity is required'),
    })),
  });

  const handleFilter = async () => {
    if (!selectedUser?._id) { toast.error('Please select a company first'); return; }
    if (!startDate || !endDate) { toast.error('Please select both start and end dates'); return; }
    try {
      setLoading(true);
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
      const response = await getLedgersByDateRange(selectedUser._id, formattedStartDate, formattedEndDate);
      if (response?.data) {
        setTransactionData(response.data.map((ledger) => ({
          id: ledger.id,
          details: ledger.details || 'Transaction',
          dr: ledger.type === 'PAYMENT' ? Number(ledger.amount).toLocaleString() : '0',
          cr: ledger.type !== 'PAYMENT' ? Number(ledger.amount).toLocaleString() : '0',
          date: ledger.date,
          balance: `PKR ${Number(ledger.balance).toLocaleString()}`,
        })));
      } else { setTransactionData([]); }
    } catch (error) {
      toast.error(error?.response?.data?.msg || 'Failed to fetch filtered data');
    } finally { setLoading(false); }
  };

  const handleStartDateChange = (e) => setStartDate(e.target.value);
  const handleEndDateChange = (e) => setEndDate(e.target.value);

  useEffect(() => { setStartDate(''); setEndDate(''); }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await getProducts(currentPage, limit);
        if (!response || !response.data) { toast.error('Failed to load products: Invalid response'); return; }
        const productsData = response.data.data || [];
        if (Array.isArray(productsData)) setProducts(productsData);
        else toast.error('Invalid products data format');
      } catch (error) {
        toast.error('Failed to load products: ' + (error.response?.data?.message || error.message));
      } finally { setLoadingProducts(false); }
    };
    if (showPurchase) fetchProducts();
  }, [showPurchase, currentPage, limit]);

  useEffect(() => {
    setLoading(true);
    const link = `/warehouse-manager/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => { setData(res.data.data); setLoading(false); setTotalPages(res.data.totalPages); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  }, [currentPage, selectedMaritalStatus, selectedCityId]);

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => setCities({ isLoaded: true, data: res.data.data }))
        .catch(err => console.log("Loading cities: ", err.message));
    }
  }, [cities.isLoaded]);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const response = await getAllPurchases();
        const purchasesData = response.data.data;
        if (Array.isArray(purchasesData) && purchasesData.length > 0) setPurchases(purchasesData);
        else setPurchases([]);
        setLoading(false);
      } catch (error) { setLoading(false); setPurchases([]); }
    };
    fetchPurchases();
  }, []);

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
    const fetchRetailers = async () => {
      try {
        const response = await getAllRetailers();
        if (response?.data?.data) setRetailers(response.data.data);
      } catch (error) { toast.error("Failed to load retailers"); }
      finally { setLoading(false); }
    };
    fetchRetailers();
  }, []);

  useEffect(() => {
    const fetchLedgerData = async () => {
      if (!selectedUser?._id) return;
      try {
        setLoading(true);
        const ledgerResponse = await getLedgerById(selectedUser._id);
        if (ledgerResponse && ledgerResponse.ledgers && Array.isArray(ledgerResponse.ledgers)) {
          if (ledgerResponse.ledgers.length === 0) { toast.info("No ledger entries found."); setTransactionData([]); }
          else {
            setTransactionData(ledgerResponse.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: ledger.description || ledger.details || 'Transaction',
              dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              balance: Number(ledger.balance || 0).toLocaleString()
            })));
          }
        } else { toast.info("No ledger entries found."); setTransactionData([]); }
      } catch (error) { toast.error("Failed to fetch transaction history"); setTransactionData([]); }
      finally { setLoading(false); }
    };
    fetchLedgerData();
  }, [selectedUser?._id]);

  useEffect(() => { if (show) setFormTab("address"); }, [show]);

  const clearForm = () => setState({ id: "", name: "", email: "", password: "", phone: "", address: "", image: "", cnic: "", city: "" });

  const deleteHandler = async (id) => {
    if (!window.confirm("Are you sure you want to delete this company?")) return;
    try {
      setLoading(true);
      await deletePurchase(id);
      toast.success("Company deleted successfully!");
      const response = await getAllPurchases();
      setPurchases(response.data.data);
    } catch (error) { toast.error(error.response?.data?.message || error.message || "Failed to delete!"); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (values, { resetForm, setSubmitting, validateForm }) => {
    try {
      const errors = await validateForm(values);
      if (!values.cnic || (errors && errors.cnic)) {
        setFormTab("taxInfo");
        toast.error("CNIC is required. Please check the Tax Info tab.");
        setSubmitting(false); setLoading(false); return;
      }
      setLoading(true); setSubmitting(true);
      const purchaseData = { companyName: values.companyName, phone: values.phone, address: values.address, email: values.email, accountNo: values.accountNo, title: values.title, firstName: values.firstName, lastName: values.lastName, mobile: values.mobile, secondaryPhone: values.secondaryPhone, website: values.website, billingAddress: values.billingAddress, city: values.city, province: values.province, postalCode: values.postalCode, country: values.country, ntn: values.ntn, stn: values.stn, cnic: values.cnic, bankName: values.bankName, accountName: values.accountName, accountNumber: values.accountNumber, iban: values.iban, swiftCode: values.swiftCode, bankAddress: values.bankAddress };
      let response;
      if (state?.id) { response = await updatePurchase(state.id, purchaseData); toast.success("Purchase updated successfully!"); }
      else { response = await addPurchase(purchaseData); toast.success("Company added successfully!"); }
      const updatedPurchasesResponse = await getAllPurchases();
      setPurchases(updatedPurchasesResponse.data.data);
      setShow(false); resetForm(); clearForm();
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.msg || error.response?.data?.errors?.[0]?.msg || error.message || "Failed to save the purchase!");
    } finally { setLoading(false); setSubmitting(false); }
  };

  const editHandler = (item) => { setShow(true); setState({ id: item._id, companyName: item.companyName, phone: item.phone, address: item.address }); };
  const addHandler = async () => { clearForm(); setShow(true); };

  const statusToggleHandler = async (purchase) => {
    try {
      setLoading(true);
      await updatePurchaseStatus(purchase._id, !purchase.isActive);
      setPurchases((prev) => prev.map((p) => p._id === purchase._id ? { ...p, isActive: !p.isActive } : p));
      toast.success(`Purchase ${!purchase.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to update status'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let filtered = purchases;
    if (filterStatus === 'active') filtered = purchases.filter(p => p.isActive);
    else if (filterStatus === 'inactive') filtered = purchases.filter(p => !p.isActive);
    setFilteredPurchases(filtered);
  }, [filterStatus, purchases]);

  const handleFilterChange = (e) => setFilterStatus(e.target.value);

  const handleSearch = async () => {
    try {
      setLoading(true);
      if (!searchTerm.trim()) { setFilteredPurchases(purchases); setLoading(false); return; }
      const response = await searchPurchases(searchTerm.trim());
      if (response && response.data) setFilteredPurchases(response.data);
      else setFilteredPurchases([]);
    } catch (error) { toast.error("Failed to search purchases"); }
    finally { setLoading(false); }
  };

  const handleSearchKeyPress = (e) => { if (e.key === 'Enter') handleSearch(); };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (!value.trim()) { setFilteredPurchases(purchases); return; }
    const lc = value.toLowerCase().trim();
    setFilteredPurchases(purchases.filter(p => p.companyName.toLowerCase().includes(lc) || p.phone.toLowerCase().includes(lc) || p.address.toLowerCase().includes(lc)));
  };

  const refreshPurchaseData = async () => {
    try {
      setIsRefreshing(true);
      const response = await getAllPurchases();
      if (response?.data?.data) { setPurchases(response.data.data); setFilteredPurchases(response.data.data); }
    } catch (error) { toast.error("Failed to refresh purchase data"); }
    finally { setIsRefreshing(false); }
  };

  const handleBackToList = async () => { setSelectedUser(null); await refreshPurchaseData(); };

  const handleAddPaymentSubmit = async (values, { resetForm, setSubmitting }) => {
    if (!selectedUser?._id) { toast.error("No user selected"); return; }
    try {
      setLoading(true);
      const response = await addLedger(selectedUser._id, { bankId: values.bank, amount: parseFloat(values.amount), date: values.date, details: values.details || "Payment Transaction" });
      if (response) {
        toast.success('Payment added successfully');
        resetForm(); setShowAddPayment(false);
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            setTransactionData(updatedLedger.ledgers.map(ledger => ({ id: ledger.transactionId || ledger._id, details: ledger.description || ledger.details || 'Transaction', dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-', balance: ledger.balance?.toLocaleString() || '0' })));
            setSelectedUser(prev => ({ ...prev, balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0' }));
          }
        } catch (refreshError) { console.error("Error refreshing ledger:", refreshError); }
      }
    } catch (error) { toast.error(error.response?.data?.message || error.message || 'Failed to add payment'); }
    finally { setLoading(false); setSubmitting(false); }
  };

  const handleAddDirectPaymentSubmit = async (values, { resetForm, setSubmitting }) => {
    if (!selectedUser?._id) { toast.error("No user selected"); return; }
    try {
      setLoading(true);
      const response = await addDirectPayment(selectedUser._id, { retailerId: values.retailer, amount: parseFloat(values.amount), date: values.date, details: values.details || 'Transaction' });
      if (response) {
        toast.success('Direct payment added successfully');
        resetForm(); setShowDirectPayment(false);
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            setTransactionData(updatedLedger.ledgers.map(ledger => ({ id: ledger.transactionId || ledger._id, details: ledger.details || 'Transaction', dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-', balance: ledger.balance?.toLocaleString() || '0' })));
            setSelectedUser(prev => ({ ...prev, balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0' }));
          }
        } catch (refreshError) { console.error("Error refreshing ledger:", refreshError); }
      }
    } catch (error) { toast.error(error.response?.data?.message || error.message || 'Failed to add direct payment'); }
    finally { setLoading(false); setSubmitting(false); }
  };

  const handleDeleteLedger = async (ledgerId) => {
    if (!window.confirm("Are you sure you want to delete this Ledger?")) return;
    try {
      setLoading(true);
      const actualLedgerId = ledgerId.replace('#', '');
      const response = await deleteLedger(actualLedgerId);
      if (response.success) {
        toast.success('Ledger deleted successfully');
        if (response.isLastLedger) { setTransactionData([]); setSelectedUser(prev => ({ ...prev, balance: '0', lastPayment: '0' })); return; }
        if (selectedUser?._id) {
          try {
            const updatedLedger = await getLedgerById(selectedUser._id);
            if (updatedLedger?.ledgers) {
              setTransactionData(updatedLedger.ledgers.map(ledger => ({ id: ledger.transactionId || ledger._id, details: ledger.description || ledger.details || 'Transaction', dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-', balance: ledger.balance?.toLocaleString() || '0' })));
            }
          } catch (refreshError) { console.error("Error refreshing ledger:", refreshError); }
        }
      } else throw new Error(response.msg || 'Failed to delete ledger');
    } catch (error) { toast.error(error.response?.data?.message || error.message || 'Failed to delete ledger'); }
    finally { setLoading(false); }
  };

  const handleEditLedger = async (values, { setSubmitting }) => {
    if (!selectedUser?._id || !selectedLedger?.id) { toast.error('Missing required information'); return; }
    try {
      setLoading(true);
      const ledgerId = selectedLedger.id.replace('#', '');
      await updateLedger(ledgerId, selectedUser._id, parseFloat(values.amount), values.date);
      toast.success('Ledger updated successfully');
      setShowEditLedger(false);
      const updatedLedger = await getLedgerById(selectedUser._id);
      if (updatedLedger?.ledgers) {
        setTransactionData(updatedLedger.ledgers.map(ledger => ({ id: ledger.transactionId || ledger._id, details: ledger.description || ledger.details || 'Transaction', dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-', balance: ledger.balance?.toLocaleString() || '0' })));
      }
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to update ledger'); }
    finally { setLoading(false); setSubmitting(false); }
  };

  const handlePurchaseSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      setLoading(true);
      if (values.items.some(item => !item.product)) { toast.error('Please select a product for all items'); setLoading(false); setSubmitting(false); return; }
      const purchaseData = { biltyNumber: values.biltyNumber, vehicleNumber: values.vehicleNumber, date: values.date, details: values.details || 'Transaction', freightAmount: Number(values.freightAmount || 0), items: values.items.map(item => ({ product: item.product, quantity: Number(item.quantity) || 0, purchaseRate: Number(item.purchaseRate) || 0, purchaseDiscount: Number(item.purchaseDiscount) || 0, salesRate: Number(item.salesRate) || 0, salesDiscount: Number(item.salesDiscount) || 0, amount: Number(item.amount) || 0 })) };
      if (!selectedUser?._id) { toast.error('No company selected'); setLoading(false); setSubmitting(false); return; }
      const response = await addPurchaseLedger(selectedUser._id, purchaseData);
      if (response?.success) {
        toast.success('Purchase added successfully');
        resetForm(); setShowPurchase(false);
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            setTransactionData(updatedLedger.ledgers.map(ledger => ({ id: ledger.transactionId || ledger._id, details: ledger.details || 'Transaction', dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0', cr: ledger.type === 'PURCHASE' ? ledger.amount?.toLocaleString() || '0' : '0', date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-', balance: ledger.balance?.toLocaleString() || '0' })));
            setSelectedUser(prev => ({ ...prev, balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0' }));
          }
        } catch (refreshError) { toast.error('Failed to refresh ledger data'); }
      }
    } catch (error) { toast.error(error.response?.data?.msg || error.message || 'Failed to add purchase'); }
    finally { setLoading(false); setSubmitting(false); }
  };

  const onDownloadInvoice = async (invoice) => {
    try {
      const response = await generatePurchaseInvoicePDF({ invoiceId: invoice._id });
      if (response.success) window.open(response.url, '_blank');
      else toast.error('Failed to generate invoice PDF');
    } catch (error) { toast.error(error.response?.data?.msg || 'Error downloading invoice'); }
  };

  const onDownload = (transaction) => { setSelectedTransaction(transaction); setShowReceiptModal(true); };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!cities.isLoaded) { const cityResponse = await getAllCities(); setCities({ isLoaded: true, data: cityResponse.data.data }); }
        const productResponse = await getProducts(1, 1000);
        setProducts(productResponse.data.data || []);
      } catch (error) { console.error('Error fetching data:', error); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [cities.isLoaded]);

  const getGroupedProducts = (allProducts, selectedLocation) => {
    if (!selectedLocation) return [];
    const filteredProducts = allProducts.filter(product => product.cityID?._id === selectedLocation || product.cityID === selectedLocation);
    const grouped = filteredProducts.reduce((acc, product) => {
      const categoryName = product.categoryID?.englishName || 'Other';
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push({ value: product._id, label: product.englishTitle || product.urduTitle || 'Unnamed Product', data: product });
      return acc;
    }, {});
    return Object.keys(grouped).map(category => ({ label: category, options: grouped[category] }));
  };

  if (loading) return <Loader />;

  const closePaymentModal = () => { setIsPaymentModalVisible(false); setPaymentData({ bank: '', payment: '', details: '', date: '' }); };

  /* ── Reusable pagination UI ── */
  const PaginationBar = ({ page, totalPages, onPrev, onNext }) => (
    <div className="flex items-center gap-1.5 mt-4">
      <button disabled={page === 1} onClick={onPrev}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
        <GrFormPrevious size={16} />
      </button>
      <div className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
        <span className="font-semibold text-[#FF5934]">{page}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span>{totalPages || 1}</span>
      </div>
      <button disabled={page >= totalPages} onClick={onNext}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
        <GrFormNext size={16} />
      </button>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        .pu-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .pu-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .pu-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .filter-select-pu {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
        .modal-overlay-pu { animation: overlayIn 0.2s ease; }
        .modal-card-pu    { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .no-scroll-pu::-webkit-scrollbar { display: none; }
        .no-scroll-pu { scrollbar-width: none; }
      `}</style>

      <div className="pu-page relative">
        <Ledger />
        {isRefreshing && <Loader />}

        {!selectedUser ? (
          /* ══════════════════════════════════════════
              COMPANY LIST VIEW
          ══════════════════════════════════════════ */
          <>
            {/* Page Header */}
            <div className="flex items-center justify-between mt-6 mb-5">
              <div>
                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchase</h1>
                <p className="text-sm text-[#9CA3AF] mt-0.5">{filteredPurchases.length} companies found</p>
              </div>
              <button
                onClick={addHandler}
                className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
              >
                <MdPersonAdd size={18} />
                Add Company
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
                  placeholder="Search by name, phone, address…"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                <MdFilterList size={16} className="text-[#9CA3AF]" />
                <select value={filterStatus} onChange={handleFilterChange}
                  className="filter-select-pu bg-transparent outline-none text-sm text-[#374151] min-w-[110px]">
                  <option value="">All Status</option>
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
                    {["Company", "ID", "Phone", "Balance", "Last Payment", "Last Activity", "Active", "Actions"].map(h => (
                      <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                            <MdBusiness size={24} className="text-gray-300" />
                          </div>
                          <p className="text-[#9CA3AF] text-sm font-medium">No companies found</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPurchases.map((item, index) => (
                    <tr key={index} className="table-row cursor-pointer">
                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0 shadow-sm">
                            {item.companyName ? item.companyName.split(' ').filter(w => w !== '&').map(w => w.charAt(0).toUpperCase()).join('').slice(0, 2) : 'NA'}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-[#111827] leading-tight">{item.companyName || "No Company Name"}</p>
                          </div>
                        </div>
                      </td>
                      {/* ID */}
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{item._id.slice(0, 6)}
                        </span>
                      </td>
                      {/* Phone */}
                      <td className="px-4 py-3 text-[13px] text-[#374151]">{item.phone}</td>
                      {/* Balance */}
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {item.balance}</td>
                      {/* Last Payment */}
                      <td className="px-4 py-3 text-[13px] text-[#374151]">PKR {item.lastPayment}</td>
                      {/* Last Activity */}
                      <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{new Date(item.lastActivity).toLocaleDateString()}</td>
                      {/* Active */}
                      <td className="px-4 py-3">
                        <button className="flex items-center transition-opacity hover:opacity-80" onClick={() => statusToggleHandler(item)}>
                          {item.isActive
                            ? <PiToggleRightFill size={26} className="text-emerald-500" />
                            : <PiToggleLeftFill size={26} className="text-gray-300" />}
                        </button>
                      </td>
                      {/* Actions — direct icon buttons, no dropdown */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedUser(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all duration-150"
                            title="View"
                          >
                            <FaRegEye size={14} />
                          </button>
                          <button
                            onClick={() => editHandler(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 transition-all duration-150"
                            title="Edit"
                          >
                            <MdEdit size={15} />
                          </button>
                          <button
                            onClick={() => deleteHandler(item._id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100 transition-all duration-150"
                            title="Delete"
                          >
                            <MdDelete size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* List Pagination */}
            <div className="flex items-center mt-4">
              <div className="flex items-center gap-1.5">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
                  <GrFormPrevious size={16} />
                </button>
                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                  <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                  <span className="text-gray-300">/</span>
                  <span>{totalPages}</span>
                </div>
                <button disabled={totalPages <= currentPage} onClick={() => setCurrentPage(p => p + 1)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150">
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
            <div className="flex items-center gap-3 mt-6 mb-5">
              <button onClick={handleBackToList}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all duration-150 shadow-sm">
                <MdArrowBack size={18} />
              </button>
              <div>
                <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                  {selectedUser.companyName}
                </h2>
                <p className="text-sm text-[#9CA3AF] mt-0.5">
                  Total Balance: <span className="font-bold text-[#FF5934]">PKR {selectedUser.balance}</span>
                </p>
              </div>
            </div>

            {/* Tab Card */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
              <div className="flex border-b border-gray-100 px-4 pt-3 gap-1">
                <TabBtn active={activeTab === 'ledger'} onClick={() => setActiveTab('ledger')}>
                  <MdTableChart size={14} /> Ledger
                </TabBtn>
                <TabBtn active={activeTab === 'invoice'} onClick={() => setActiveTab('invoice')}>
                  <MdOutlineInventory2 size={14} /> Invoice
                </TabBtn>
              </div>

              {/* ── LEDGER TAB ── */}
              {activeTab === 'ledger' && (
                <div className="p-4">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                      <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                        value={startDate} onChange={handleStartDateChange}
                        max={new Date().toISOString().split('T')[0]} />
                      <span className="text-[#9CA3AF] text-xs">to</span>
                      <input type="date" className="bg-transparent outline-none text-sm text-[#374151]"
                        value={endDate} onChange={handleEndDateChange}
                        min={startDate} max={new Date().toISOString().split('T')[0]} />
                      <button onClick={handleFilter} disabled={!startDate || !endDate}
                        className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors">
                        Filter
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link to="/reportpdf" state={{ selectedUser, transactionData, startDate, endDate, type: 'purchase' }}>
                        <ToolbarBtn icon={MdReceipt}>Report</ToolbarBtn>
                      </Link>
                      <ToolbarBtn icon={MdPayment} onClick={() => setShowAddPayment(true)}>Add Payment</ToolbarBtn>
                      <ToolbarBtn icon={MdCreditCard} onClick={() => setShowDirectPayment(true)}>Direct Payment</ToolbarBtn>
                      <ToolbarBtn icon={MdAddCircleOutline} onClick={() => setShowPurchase(true)}>Purchase</ToolbarBtn>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {["ID", "Details", "Dr.", "Cr.", "Date", "Balance", "Action"].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledgerVisibleRows.length === 0 ? (
                          <tr><td colSpan={7} className="py-12 text-center text-[#9CA3AF] text-sm">No transactions found</td></tr>
                        ) : ledgerVisibleRows.map((transaction, index) => (
                          <tr key={index} className="table-row">
                            <td className="px-3 py-3">
                              <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[13px] text-[#374151] max-w-[180px] truncate">{transaction.details}</td>
                            <td className="px-3 py-3">
                              {transaction.dr !== '0'
                                ? <span className="text-[13px] font-semibold text-emerald-600">PKR {transaction.dr}</span>
                                : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className="px-3 py-3">
                              {transaction.cr !== '0'
                                ? <span className="text-[13px] font-semibold text-red-500">PKR {transaction.cr}</span>
                                : <span className="text-[#9CA3AF]">—</span>}
                            </td>
                            <td className="px-3 py-3 text-[12px] text-[#6B7280]">{transaction.date}</td>
                            <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">PKR {transaction.balance}</td>
                            {/* Action — direct icon buttons */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => onDownload(transaction)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all"
                                  title="Download"
                                >
                                  <AiOutlineDownload size={14} />
                                </button>
                                <button
                                  onClick={() => { setSelectedLedger(transaction); setShowEditLedger(true); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 transition-all"
                                  title="Edit"
                                >
                                  <MdEdit size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLedger(transaction.id)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100 transition-all"
                                  title="Delete"
                                >
                                  <MdDelete size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {reversedTransactions.length > 0 && (
                    <PaginationBar page={ledgerPage} totalPages={ledgerTotalPages}
                      onPrev={() => setLedgerPage(p => p - 1)} onNext={() => setLedgerPage(p => p + 1)} />
                  )}
                </div>
              )}

              {/* ── INVOICE TAB ── */}
              {activeTab === 'invoice' && (
                <div className="p-4">
                  <div className="flex justify-end mb-5">
                    <Link to="/reportpdf" state={{ selectedUser, allInvoices: invoices, type: 'purchase' }}>
                      <ToolbarBtn icon={MdReceipt}>Report</ToolbarBtn>
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                      <thead>
                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                          {["Sr.", "Invoice ID", "Date", "Bilty No", "Vehicle No", "Items", "Freight", "Details", "Total", "Action"].map(h => (
                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          <tr><td colSpan={10} className="py-12 text-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5934] mx-auto"></div>
                          </td></tr>
                        ) : invoiceVisibleRows.length === 0 ? (
                          <tr><td colSpan={10} className="py-12 text-center text-[#9CA3AF] text-sm">No invoices found</td></tr>
                        ) : invoiceVisibleRows.map((invoice) => (
                          <tr key={invoice.id} className="table-row">
                            <td className="px-3 py-3 text-[13px] text-[#9CA3AF]">{invoice.sr}</td>
                            <td className="px-3 py-3">
                              <span className="text-[12px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                #{invoice._id.slice(0, 6)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[13px] text-[#374151]">{invoice.date}</td>
                            <td className="px-3 py-3 text-[13px] text-[#374151]">{invoice.biltyNumber || '—'}</td>
                            <td className="px-3 py-3 text-[13px] text-[#374151]">{invoice.vehicleNumber || '—'}</td>
                            <td className="px-3 py-3 text-[13px] text-[#374151]">{invoice.items}</td>
                            <td className="px-3 py-3 text-[13px] text-[#374151]">PKR {invoice.freightAmount.toLocaleString()}</td>
                            <td className="px-3 py-3 text-[13px] text-[#374151] max-w-[120px] truncate">{invoice.details || '—'}</td>
                            <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">PKR {invoice.total.toLocaleString()}</td>
                            <td className="px-3 py-3">
                              <button onClick={() => onDownloadInvoice(invoice)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all" title="Download">
                                <AiOutlineDownload size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {invoices.length > 0 && (
                    <PaginationBar page={invoicePage} totalPages={invoiceTotalPages}
                      onPrev={() => setInvoicePage(p => p - 1)} onNext={() => setInvoicePage(p => p + 1)} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ADD / EDIT COMPANY MODAL
        ══════════════════════════════════════════ */}
        {show && (
          <div className="modal-overlay-pu fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-pu bg-white w-full max-w-[640px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">{state?.id ? 'Editing' : 'New Company'}</p>
                    <h2 className="text-white text-xl font-bold">{state?.id ? 'Edit Company' : 'Add Company'}</h2>
                  </div>
                  <button onClick={() => setShow(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                enableReinitialize
                initialValues={{ companyName: state?.companyName || "", phone: state?.phone || "", address: state?.address || "", email: state?.email || "", accountNo: "", title: "", firstName: "", lastName: "", mobile: "", website: "", billingAddress: "", city: "", province: "", postalCode: "", country: "", ntn: "", stn: "", cnic: "", bankName: "", accountName: "", accountNumber: "", iban: "", swiftCode: "", bankAddress: "" }}
                validationSchema={purchaseValidations}
                onSubmit={handleSubmit}
              >
                {({ values, handleChange, handleSubmit: formikSubmit, setFieldTouched, errors, touched }) => (
                  <Form className="no-scroll-pu overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 py-5 flex flex-col gap-3">
                      {/* Core fields */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Company Name</label>
                          <input name="companyName" placeholder="Company Name" value={values.companyName} onChange={handleChange}
                            className={`${inputCls} ${errors.companyName && touched.companyName ? 'border-red-400' : ''}`} />
                          {errors.companyName && touched.companyName && <p className="text-red-500 text-[11px] mt-1">{errors.companyName}</p>}
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Address</label>
                          <input name="address" placeholder="Address" value={values.address} onChange={handleChange}
                            className={`${inputCls} ${errors.address && touched.address ? 'border-red-400' : ''}`} />
                          {errors.address && touched.address && <p className="text-red-500 text-[11px] mt-1">{errors.address}</p>}
                        </div>
                        {[
                          { name: 'email', label: 'Email', placeholder: 'email@example.com' },
                          { name: 'accountNo', label: 'Account No.', placeholder: 'Account No.' },
                          { name: 'title', label: 'Title', placeholder: 'Title' },
                          { name: 'firstName', label: 'First Name', placeholder: 'First Name' },
                          { name: 'lastName', label: 'Last Name', placeholder: 'Last Name' },
                          { name: 'mobile', label: 'Mobile', placeholder: '+923001234567' },
                          { name: 'phone', label: 'Phone', placeholder: 'Phone' },
                          { name: 'website', label: 'Website', placeholder: 'https://...' },
                        ].map(({ name, label, placeholder }) => (
                          <div key={name}>
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                            <input name={name} placeholder={placeholder} value={values[name]} onChange={handleChange}
                              className={`${inputCls} ${errors[name] && touched[name] ? 'border-red-400' : ''}`} />
                            {errors[name] && touched[name] && <p className="text-red-500 text-[11px] mt-1">{errors[name]}</p>}
                          </div>
                        ))}
                      </div>

                      {/* Tab navigation */}
                      <div className="border-b border-gray-100 flex gap-1 mt-2">
                        {['address', 'taxInfo', 'bank'].map(tab => (
                          <button key={tab} type="button" onClick={() => setFormTab(tab)}
                            className={`px-4 py-2.5 text-[13px] font-semibold rounded-t-lg border-b-2 transition-all
                              ${formTab === tab ? 'border-[#FF5934] text-[#FF5934]' : 'border-transparent text-[#9CA3AF] hover:text-[#374151]'}`}>
                            {tab === 'taxInfo' ? 'Tax Info' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {formTab === 'address' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Billing Address</label>
                            <input name="billingAddress" placeholder="Billing Address" value={values.billingAddress} onChange={handleChange} className={inputCls} />
                          </div>
                          {[{ name: 'city', label: 'City' }, { name: 'province', label: 'Province' }, { name: 'postalCode', label: 'Postal Code' }, { name: 'country', label: 'Country' }].map(({ name, label }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={label} value={values[name]} onChange={handleChange} className={inputCls} />
                            </div>
                          ))}
                        </div>
                      )}

                      {formTab === 'taxInfo' && (
                        <div className="grid grid-cols-2 gap-3">
                          {[{ name: 'ntn', label: 'NTN' }, { name: 'stn', label: 'STN' }].map(({ name, label }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={label} value={values[name]} onChange={handleChange} className={inputCls} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">CNIC *</label>
                            <input name="cnic" placeholder="xxxxx-xxxxxxx-x" value={values.cnic} onChange={handleChange}
                              className={`${inputCls} ${errors.cnic && touched.cnic ? 'border-red-400' : ''}`} />
                            {errors.cnic && touched.cnic && <p className="text-red-500 text-[11px] mt-1">{errors.cnic}</p>}
                          </div>
                        </div>
                      )}

                      {formTab === 'bank' && (
                        <div className="grid grid-cols-2 gap-3">
                          {[{ name: 'bankName', label: 'Bank Name' }, { name: 'accountName', label: 'Account Name' }, { name: 'accountNumber', label: 'Account Number' }, { name: 'iban', label: 'IBAN' }, { name: 'swiftCode', label: 'Swift Code' }, { name: 'bankAddress', label: 'Bank Address' }].map(({ name, label }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={label} value={values[name]} onChange={handleChange} className={inputCls} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                      <button type="button" onClick={() => setShow(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="button" onClick={(e) => {
                        if (!values.cnic) { setFormTab("taxInfo"); setFieldTouched('cnic', true, true); toast.error("CNIC is required. Please check the Tax Info tab."); return; }
                        formikSubmit(e);
                      }}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all">
                        {state?.id ? 'Save Changes' : 'Add Company'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            ADD PAYMENT MODAL
        ══════════════════════════════════════════ */}
        {showAddPayment && (
          <div className="modal-overlay-pu fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-pu bg-white w-full max-w-[380px] max-h-[94vh] overflow-auto rounded-3xl shadow-2xl">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Transaction</p>
                    <h2 className="text-white text-lg font-bold">Add Payment</h2>
                  </div>
                  <button onClick={() => setShowAddPayment(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <Formik initialValues={{ bank: "", amount: "", date: "", details: "" }} validationSchema={paymentValidationSchema} onSubmit={handleAddPaymentSubmit}>
                {({ values, handleChange, errors, touched }) => (
                  <Form className="p-6 flex flex-col gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Select Bank</label>
                      <select name="bank" value={values.bank} onChange={handleChange} className={`${inputCls} ${errors.bank && touched.bank ? 'border-red-400' : ''}`}>
                        <option value="">Choose a bank…</option>
                        {banks.filter(b => b.isActive).map(bank => <option key={bank._id} value={bank._id}>{bank.bankName} — {bank.accountTitle}</option>)}
                      </select>
                      {errors.bank && touched.bank && <p className="text-red-500 text-[11px] mt-1">{errors.bank}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Amount</label>
                      <input name="amount" placeholder="0.00" value={values.amount} onChange={handleChange}
                        className={`${inputCls} ${errors.amount && touched.amount ? 'border-red-400' : ''}`} />
                      {errors.amount && touched.amount && <p className="text-red-500 text-[11px] mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Details</label>
                      <textarea name="details" placeholder="Enter payment details…" value={values.details} onChange={handleChange}
                        className={`${inputCls} resize-none ${errors.details && touched.details ? 'border-red-400' : ''}`} rows={3} />
                      {errors.details && touched.details && <p className="text-red-500 text-[11px] mt-1">{errors.details}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Date</label>
                      <input type="date" name="date" value={values.date} onChange={handleChange}
                        max={new Date().toISOString().split("T")[0]} className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`} />
                      {errors.date && touched.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowAddPayment(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                      <button type="submit" disabled={loading}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                        {loading ? 'Saving…' : 'Save Payment'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            DIRECT PAYMENT MODAL
        ══════════════════════════════════════════ */}
        {showDirectPayment && (
          <div className="modal-overlay-pu fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-pu bg-white w-full max-w-[380px] max-h-[94vh] overflow-auto rounded-3xl shadow-2xl">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Transaction</p>
                    <h2 className="text-white text-lg font-bold">Direct Payment</h2>
                  </div>
                  <button onClick={() => setShowDirectPayment(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <Formik initialValues={{ date: "", retailer: "", modeOfPayment: "", amount: "", details: "" }} validationSchema={directPaymentValidationSchema} onSubmit={handleAddDirectPaymentSubmit}>
                {({ values, handleChange, errors, touched }) => (
                  <Form className="p-6 flex flex-col gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Date</label>
                      <input type="date" name="date" value={values.date} onChange={handleChange}
                        max={new Date().toISOString().split("T")[0]} className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`} />
                      {errors.date && touched.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Retailer</label>
                      <select name="retailer" value={values.retailer} onChange={handleChange}
                        className={`${inputCls} ${errors.retailer && touched.retailer ? 'border-red-400' : ''}`}>
                        <option value="">Select Retailer</option>
                        {retailers.map(r => <option key={r._id} value={r._id}>{r.shopName}</option>)}
                      </select>
                      {errors.retailer && touched.retailer && <p className="text-red-500 text-[11px] mt-1">{errors.retailer}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Payment Mode</label>
                      <select name="modeOfPayment" value={values.modeOfPayment} onChange={handleChange} className={inputCls}>
                        <option value="">Select Payment Mode</option>
                        <option value="Cash">Cash</option>
                        <option value="Check">Check</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Amount</label>
                      <input name="amount" placeholder="0.00" value={values.amount} onChange={handleChange}
                        className={`${inputCls} ${errors.amount && touched.amount ? 'border-red-400' : ''}`} />
                      {errors.amount && touched.amount && <p className="text-red-500 text-[11px] mt-1">{errors.amount}</p>}
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Details</label>
                      <textarea name="details" placeholder="Enter payment details…" value={values.details} onChange={handleChange}
                        className={`${inputCls} resize-none ${errors.details && touched.details ? 'border-red-400' : ''}`} rows={3} />
                      {errors.details && touched.details && <p className="text-red-500 text-[11px] mt-1">{errors.details}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowDirectPayment(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                      <button type="submit" disabled={loading}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                        {loading ? 'Saving…' : 'Save Payment'}
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
          <div className="modal-overlay-pu fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-pu bg-white w-full max-w-[380px] rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">Ledger</p>
                    <h2 className="text-white text-lg font-bold">Edit Entry</h2>
                  </div>
                  <button onClick={() => setShowEditLedger(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <Formik
                initialValues={{ amount: selectedLedger?.dr !== "0" ? selectedLedger?.dr.replace(/[^0-9.]/g, '') : selectedLedger?.cr.replace(/[^0-9.]/g, ''), date: selectedLedger?.date }}
                validationSchema={yup.object().shape({ amount: yup.string().matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number').required('Amount is required'), date: yup.string().required('Date is required') })}
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
                        max={new Date().toISOString().split("T")[0]} className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`} />
                      {errors.date && touched.date && <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowEditLedger(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
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
            ADD PURCHASE MODAL
        ══════════════════════════════════════════ */}
        {showPurchase && (
          <div className="modal-overlay-pu fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
            <div className="modal-card-pu bg-white w-full max-w-[960px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8 relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">New Entry</p>
                    <h2 className="text-white text-lg font-bold">Add Purchase</h2>
                  </div>
                  <button onClick={() => setShowPurchase(false)} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                initialValues={{ biltyNumber: '', vehicleNumber: '', freightAmount: '', date: '', details: '', location: '', items: [{ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 }], totalAmount: 0, discountAmount: 0, payable: 0 }}
                validationSchema={purchaseValidationSchema}
                onSubmit={handlePurchaseSubmit}
              >
                {({ values, handleChange, errors, touched, setFieldValue }) => {
                  const groupedProductsByLocation = getGroupedProducts(products, values.location);
                  return (
                    <Form className="no-scroll-pu overflow-y-auto flex-1 flex flex-col">
                      <div className="px-6 py-5 flex flex-col gap-4">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { name: 'biltyNumber', label: 'Bilty Number', placeholder: 'Enter Bilty Number' },
                            { name: 'vehicleNumber', label: 'Vehicle Number', placeholder: 'Enter Vehicle Number' },
                            { name: 'freightAmount', label: 'Freight Amount', placeholder: '0.00' },
                          ].map(({ name, label, placeholder }) => (
                            <div key={name}>
                              <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">{label}</label>
                              <input name={name} placeholder={placeholder} value={values[name]} onChange={handleChange}
                                className={`${inputCls} ${errors[name] && touched[name] ? 'border-red-400' : ''}`} />
                              {errors[name] && touched[name] && <p className="text-red-500 text-[11px] mt-1">{errors[name]}</p>}
                            </div>
                          ))}
                          <div>
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Date</label>
                            <input type="date" name="date" value={values.date} onChange={handleChange}
                              max={new Date().toISOString().split("T")[0]}
                              className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Location</label>
                            <select name="location" value={values.location}
                              onChange={(e) => { handleChange(e); setFieldValue('items', [{ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 }]); }}
                              className={inputCls}>
                              <option value="">Select Location</option>
                              {cities.isLoaded && cities.data.map(city => <option key={city._id} value={city._id || city.name}>{city.name || city._id}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Details</label>
                            <textarea name="details" placeholder="Enter details…" value={values.details} onChange={handleChange}
                              className={`${inputCls} resize-none`} rows={2} />
                          </div>
                        </div>

                        {/* Products */}
                        <div>
                          <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Products</label>
                          <FieldArray name="items">
                            {({ push, remove }) => (
                              <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-4">
                                <div className="grid grid-cols-5 gap-3 mb-2 px-1">
                                  {['Product', 'Purchase Rate', 'Discount %', 'Quantity', 'Amount'].map(h => (
                                    <div key={h} className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">{h}</div>
                                  ))}
                                </div>
                                {values.items.map((item, index) => (
                                  <div key={index} className="grid grid-cols-5 gap-3 mb-3 pb-3 border-b border-gray-100 last:border-0 last:mb-0 last:pb-0">
                                    <div>
                                      <GroupedSelect
                                        options={groupedProductsByLocation}
                                        value={item.product ? { value: item.product, label: products.find(p => p._id === item.product)?.englishTitle || products.find(p => p._id === item.product)?.urduTitle || 'Unnamed Product', data: products.find(p => p._id === item.product) } : null}
                                        onChange={(selectedOption) => {
                                          if (selectedOption) {
                                            const product = selectedOption.data;
                                            setFieldValue(`items.${index}.product`, product._id);
                                            setFieldValue(`items.${index}.purchaseRate`, product.purchaseRate || '');
                                            setFieldValue(`items.${index}.purchaseDiscount`, product.purchaseDiscount || '');
                                          } else {
                                            setFieldValue(`items.${index}.product`, '');
                                            setFieldValue(`items.${index}.purchaseRate`, '');
                                            setFieldValue(`items.${index}.purchaseDiscount`, '');
                                          }
                                        }}
                                        placeholder="Select product…"
                                        className="w-full"
                                        error={touched.items?.[index]?.product && errors.items?.[index]?.product}
                                      />
                                    </div>
                                    {['purchaseRate', 'purchaseDiscount', 'quantity'].map(field => (
                                      <Field key={field} type="number" name={`items.${index}.${field}`} value={item[field]}
                                        onChange={(e) => {
                                          handleChange(e);
                                          const qty = field === 'quantity' ? Number(e.target.value) || 0 : Number(item.quantity) || 0;
                                          const rate = field === 'purchaseRate' ? Number(e.target.value) || 0 : Number(item.purchaseRate) || 0;
                                          const disc = field === 'purchaseDiscount' ? Number(e.target.value) || 0 : Number(item.purchaseDiscount) || 0;
                                          const base = rate * qty;
                                          const discAmt = (base * disc) / 100;
                                          const amt = base - discAmt;
                                          setFieldValue(`items.${index}.amount`, amt);
                                          setFieldValue(`items.${index}.discountAmount`, discAmt);
                                          const totals = values.items.reduce((acc, it, i) => ({
                                            totalAmount: acc.totalAmount + (i === index ? amt : (it.amount || 0)),
                                            totalDiscount: acc.totalDiscount + (i === index ? discAmt : (it.discountAmount || 0)),
                                          }), { totalAmount: 0, totalDiscount: 0 });
                                          setFieldValue('totalAmount', totals.totalAmount);
                                          setFieldValue('discountAmount', totals.totalDiscount);
                                          setFieldValue('payable', totals.totalAmount);
                                        }}
                                        className={inputCls} placeholder={field === 'purchaseDiscount' ? '%' : '0'} />
                                    ))}
                                    <div className={`${inputCls} flex items-center font-semibold text-[#111827]`}>
                                      {item.amount.toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                                <button type="button"
                                  onClick={() => push({ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 })}
                                  className="mt-3 flex items-center gap-2 text-[#FF5934] hover:text-[#e84d2a] text-[13px] font-semibold transition-colors">
                                  <FaPlus size={12} /> Add Product
                                </button>
                              </div>
                            )}
                          </FieldArray>
                        </div>

                        {/* Totals */}
                        <div className="grid grid-cols-3 gap-3 bg-[#F9FAFB] rounded-2xl p-4 border border-gray-100">
                          {[
                            { label: 'Discount Amount', value: values.discountAmount.toFixed(2) },
                            { label: 'Payable Amount', value: values.payable.toFixed(2) },
                            { label: 'Total Amount', value: values.totalAmount.toFixed(2), highlight: true },
                          ].map(({ label, value, highlight }) => (
                            <div key={label}>
                              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                              <p className={`text-[15px] font-bold ${highlight ? 'text-[#FF5934]' : 'text-[#111827]'}`}>{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                        <button type="button" onClick={() => setShowPurchase(false)}
                          className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading}
                          className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all disabled:opacity-50">
                          {loading ? 'Saving…' : 'Save Purchase'}
                        </button>
                      </div>
                    </Form>
                  );
                }}
              </Formik>
            </div>
          </div>
        )}

        {showReceiptModal && selectedTransaction && (
          <ReceiptModal transaction={selectedTransaction} onClose={() => setShowReceiptModal(false)} type="purchase" />
        )}
      </div>
    </>
  );
};

export default Purchase;