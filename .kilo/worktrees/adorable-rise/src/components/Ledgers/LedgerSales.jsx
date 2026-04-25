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

const LIMIT = 10; // retailer list pagination
const TRANSACTIONS_PER_PAGE = 11; // ledger/recovery pagination

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
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });

  const [isFormVisible, setFormVisible] = useState(false);
  const [newSalesPerson, setNewSalesPerson] = useState({
    id: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    image: "",
    cnic: "",
    city: ""
  });

  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [paymentData, setPaymentData] = useState({
    bank: '',
    payment: '',
    details: '',
    date: ''
  });

  const [selectedUser, setSelectedUser] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  // Local action status per ledger row (approved/rejected) for Recovery tab UI
  const [actionStatuses, setActionStatuses] = useState({});

  // Pagination for Ledger and Recovery tabs
  const [ledgerPage, setLedgerPage] = useState(1);
  const [recoveryPage, setRecoveryPage] = useState(1);

  // Derived rows for tabs
  const ledgerRows = transactionData.filter((t) => {
    if (!t) return false;
    const drNum = parseFloat(String(t.dr ?? '0').replace(/[^0-9.-]/g, ''));
    // Exclude only Recovery entries that are not imported (unapproved with Dr amount)
    return !(t.isApproved === false && drNum > 0 && !t.isImported);
  });

  const recoveryRows = transactionData.filter((t) => {
    const drNum = parseFloat(String(t.dr || '0').replace(/[^0-9.-]/g, ''));
    const crNum = parseFloat(String(t.cr || '0').replace(/[^0-9.-]/g, ''));
    // Exclude imported entries from Recovery; keep only manual unapproved Dr entries
    return !t.isImported && t.isApproved === false && drNum > 0 && (isNaN(crNum) || crNum === 0);
  });

  const ledgerTotalPages = Math.ceil(ledgerRows.length / TRANSACTIONS_PER_PAGE) || 0;
  const recoveryTotalPages = Math.ceil(recoveryRows.length / TRANSACTIONS_PER_PAGE) || 0;
  const ledgerStart = (ledgerPage - 1) * TRANSACTIONS_PER_PAGE;
  const recoveryStart = (recoveryPage - 1) * TRANSACTIONS_PER_PAGE;
  const ledgerVisibleRows = ledgerRows.slice(ledgerStart, ledgerStart + TRANSACTIONS_PER_PAGE);
  const recoveryVisibleRows = recoveryRows.slice(recoveryStart, recoveryStart + TRANSACTIONS_PER_PAGE);

  // Recovery image drawer state
  const [isRecoveryDrawerOpen, setIsRecoveryDrawerOpen] = useState(false);
  const [recoveryImageSrc, setRecoveryImageSrc] = useState(null);

  // Helper: normalize ledger details text
  const formatLedgerDetails = (ledger) => {
    const base = ledger?.description ?? ledger?.details ?? 'Transaction';
    const isOrderType = String(ledger?.type || '').toUpperCase() === 'ORDER';
    const looksLikeOrderText = /^Order\s+.*\s+placed$/i.test(String(base));
    return (isOrderType || looksLikeOrderText) ? 'Order punched from app' : base;
  };

  // Reset pages when data or tab changes
  useEffect(() => {
    setLedgerPage(1);
    setRecoveryPage(1);
  }, [selectedUser?._id, activeTab, transactionData.length]);

  // Handler: open recovery image drawer
  const handleViewRecoveryImage = (transaction) => {
    try {
      setRecoveryImageSrc(transaction?.image || null);
    } catch (err) {
      setRecoveryImageSrc(null);
    } finally {
      setIsRecoveryDrawerOpen(true);
    }
  };

  // New state for Add Retailer form
  const [isAddRetailerFormVisible, setIsAddRetailerFormVisible] = useState(false);
  const [salesPersons, setSalesPersons] = useState([]);

  // Import Excel handler (inside component to access state)
  const handleImportExcel = async (event) => {
    console.log('[ImportExcel] Input change fired');
    try {
      const file = event?.target?.files?.[0];
      console.log('[ImportExcel] Selected file:', file ? { name: file.name, size: file.size, type: file.type } : 'no file');
      console.log('[ImportExcel] Selected user:', selectedUser);

      if (!selectedUser?._id) {
        toast.error('Please select a user first');
        return;
      }
      if (!file) {
        toast.error('Please choose an Excel file');
        return;
      }

      setIsImporting(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        for (const [key, value] of formData.entries()) {
          console.log('[ImportExcel] FormData entry:', key, value instanceof Blob ? { name: value.name, size: value.size, type: value.type } : value);
        }
      } catch (e) {
        console.log('[ImportExcel] Failed to iterate FormData entries:', e?.message);
      }

      console.log('[ImportExcel] Calling API importRetailerLedgerFromExcel with retailerId:', selectedUser._id);
      const res = await importRetailerLedgerFromExcel(selectedUser._id, formData);
      console.log('[ImportExcel] API response status:', res?.status);
      console.log('[ImportExcel] API response data:', res?.data);

      if (res?.data?.success) {
        toast.success(res?.data?.msg || 'Ledger imported successfully');
      } else {
        toast.success(res?.data?.msg || 'Ledger import completed');
      }

      try {
        console.log('[ImportExcel] Refreshing ledger for retailer:', selectedUser._id);
        const updatedLedger = await getRetailerLedgerById(selectedUser._id);
        console.log('[ImportExcel] Updated ledger raw:', updatedLedger);
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

          const sortedTransactions = formattedTransactions.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
          console.log('[ImportExcel] Transactions after format/sort:', sortedTransactions);
          setTransactionData(sortedTransactions);
        } else {
          console.log('[ImportExcel] No ledgers found in updated response');
        }
      } catch (refreshErr) {
        console.error('[ImportExcel] Failed refreshing ledger:', refreshErr);
      }
    } catch (error) {
      console.error('Import Excel error:', error);
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

  // Validation schema for Add Retailer form
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
    name: "",
    email: "",
    phoneNumber: "",
    cnic: "",
    cityID: "",
    shopName: "",
    shopAddress1: "",
    shopAddress2: "",
    shopCategory: "",
    distance: "",
    lng: "",
    lat: "",
    salesPersonID: "",
    image: null,
  };

  const [allInvoices, setAllInvoices] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch all invoices for the selected retailer without aging ranges
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
            } catch (invoiceError) {
              console.error(`Error fetching ${range} invoices for retailer ${selectedUser._id}:`, invoiceError);
            }
          }

          const uniqueInvoices = Array.from(new Set(allInvoiceDetails.map(JSON.stringify)))
            .map(JSON.parse)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

          const formattedInvoices = uniqueInvoices.map((invoice, index) => ({
            sr: index + 1,
            id: invoice._id,
            date: new Date(invoice.createdAt).toLocaleDateString(),
            shopName: selectedUser.shopName || 'N/A',
            total: invoice.totalAmount || 0,
            balance: invoice.balance || 0,
          }));

          setAllInvoices(formattedInvoices);
        } catch (error) {
          console.error('Error fetching all invoices:', error);
          toast.error(error.response?.data?.msg || 'Failed to fetch invoices');
          setAllInvoices([]);
        } finally {
          setLoading(false);
        }
      };
      fetchAllInvoices();
    } else {
      setAllInvoices([]);
    }
  }, [selectedUser?._id]);

  const formatNumber = (num) => {
    return typeof num === 'number' ? num.toLocaleString() : '0';
  };

  const statusToggleHandler = async (retailer) => {
    try {
      setLoading(true);
      await updateRetailerUserStatus(retailer._id, !retailer.isActive);

      setRetailers((prevRetailers) =>
        prevRetailers.map((r) =>
          r._id === retailer._id ? { ...r, isActive: !r.isActive } : r
        )
      );

      toast.success(`Retailer ${!retailer.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error("Error updating retailer status:", error);
      if (error.response) {
        toast.error(
          error.response.data.message ||
          `Failed to update retailer status. Server responded with ${error.response.status}`
        );
      } else if (error.request) {
        toast.error("No response received from server. Please check your network connection.");
      } else {
        toast.error("Error setting up the request. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = retailers;
    switch (filterStatus) {
      case "active":
        filtered = retailers.filter((retailer) => retailer.isActive);
        break;
      case "inactive":
        filtered = retailers.filter((retailer) => !retailer.isActive);
        break;
      default:
        filtered = retailers;
    }
    setFilteredRetailers(filtered);
  }, [filterStatus, retailers]);

  const handleFilter = async () => {
    if (!selectedUser?._id) {
      toast.error('Please select a user first');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

      const response = await getRetailerLedgerById(selectedUser._id);

      if (response.success && response.ledgers) {
        const filteredLedgers = response.ledgers.filter(ledger => {
          const ledgerDate = new Date(ledger.date).toISOString().split('T')[0];
          return ledgerDate >= formattedStartDate && ledgerDate <= formattedEndDate;
        });

        const formattedTransactions = filteredLedgers.map(ledger => ({
          id: ledger.transactionId || ledger._id,
          details: formatLedgerDetails(ledger),
          type: ledger.type,
          dr: ledger.type !== 'PAYMENT' ?
            Number(ledger.amount || 0).toLocaleString() : '0',
          cr: ledger.type === 'PAYMENT' ?
            Number(ledger.amount || 0).toLocaleString() : '0',
          date: ledger.date ?
            new Date(ledger.date).toISOString().split('T')[0] : '-',
          sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
          isApproved: ledger.isApproved === false ? false : true,
          isRejected: ledger.isRejected === true,
          isImported: ledger.isImportedFromExcel === true,
          balance: Number(ledger.balance || 0).toLocaleString()
        }));

        const sortedTransactions = formattedTransactions.sort((a, b) =>
          (b.sortTime || 0) - (a.sortTime || 0)
        );

        setTransactionData(sortedTransactions);

        if (sortedTransactions.length === 0) {
          toast.info('No transactions found for the selected date range');
        }
      } else {
        setTransactionData([]);
        toast.info('No transactions found');
      }
    } catch (error) {
      console.error('Error filtering transactions:', error);
      toast.error(error?.response?.data?.msg || 'Failed to filter transactions');
      setTransactionData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = (e) => {
    const date = e.target.value;
    setStartDate(date);
  };

  const handleEndDateChange = (e) => {
    const date = e.target.value;
    setEndDate(date);
  };

  // Approve recovery entry: call API, then refresh ledger for selected user
  const handleRecoveryToggle = async (transaction) => {
    try {
      if (!transaction?.id) {
        toast.error('Missing ledger ID for approval');
        return;
      }

      setLoading(true);
      // Send explicit payload and use PATCH via API wrapper
      const res = await approveLedger(String(transaction.id), { isApproved: true });
      if (res?.success) {
        toast.success(res?.msg || 'Approved and moved to Ledger');
      } else {
        toast.info(res?.msg || 'Approval processed');
      }

      // Refresh transactions for current retailer
      if (selectedUser?._id) {
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

          const sortedTransactions = formattedTransactions.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
          setTransactionData(sortedTransactions);
        }
      }
    } catch (err) {
      console.error('Approval failed:', err);
      toast.error(err?.response?.data?.msg || 'Failed to approve entry');
    } finally {
      setLoading(false);
    }
  };

  // Approve action: update local UI state, call approve API, revert on failure
  const handleApproveAction = async (transaction) => {
    try {
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: 'approved' }));
      await handleRecoveryToggle(transaction);
    } catch (err) {
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: undefined }));
    }
  };

  // Reject action: call API, update UI, and refresh list
  const handleRejectAction = async (transaction) => {
    try {
      if (!transaction?.id) {
        toast.error('Missing ledger ID for rejection');
        return;
      }
      console.log('[Recovery] Reject requested', {
        ledgerId: transaction.id,
        retailerId: selectedUser?._id,
        currentFlags: {
          isApproved: transaction.isApproved,
          isRejected: transaction.isRejected,
        },
      });
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: 'rejected' }));
      const res = await rejectLedger(String(transaction.id), { isRejected: true });
      console.log('[Recovery] Reject API response', res);
      if (res?.success) {
        toast.success(res?.msg || 'Entry rejected');
      } else {
        toast.info(res?.msg || 'Rejection processed');
      }

      // Refresh transactions for current retailer
      if (selectedUser?._id) {
        const updatedLedger = await getRetailerLedgerById(selectedUser._id);
        console.log('[Recovery] Ledger list refreshed', {
          count: updatedLedger?.ledgers?.length || 0,
        });
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
          }));
          const sorted = formattedTransactions.sort((a, b) => b.sortTime - a.sortTime);
          const refreshed = sorted.find(t => String(t.id) === String(transaction.id));
          console.log('[Recovery] Post-refresh flags for ledger', {
            ledgerId: transaction.id,
            isRejected: refreshed?.isRejected,
            isApproved: refreshed?.isApproved,
          });
          setTransactionData(sorted);
        }
      }
    } catch (err) {
      setActionStatuses((prev) => ({ ...prev, [transaction.id]: undefined }));
      console.error('[Recovery] Reject failed', err);
      toast.error(err?.response?.data?.msg || err.message || 'Failed to reject entry');
    }
  };

  useEffect(() => {
    setStartDate('');
    setEndDate('');
  }, []);

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setSearchTerm(e.target.value);
      const link = `/retailer/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        });
    }
  };

  useEffect(() => {
    setLoading(true);
    const link = `/sale-user/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setSales(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      });
  }, [currentPage, selectedMaritalStatus, selectedCityId]);

  const changeHandler = async (key, value) => {
    setNewSalesPerson((p) => ({
      ...p,
      [key]: value,
    }));
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
          const updatedRetailer = formattedData.find(r => r._id === selectedUser._id);
          if (updatedRetailer) {
            setSelectedUser(updatedRetailer);
          }
        }
      }
    } catch (error) {
      console.error("Error refreshing retailer data:", error);
      toast.error("Failed to refresh retailer data");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRetailers();
  }, []);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await getAllBanks();
        if (response.data?.data) {
          setBanks(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching banks:", error);
        toast.error("Failed to load banks");
      }
    };

    fetchBanks();
  }, []);

  // Fetch sales persons for Add Retailer form
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const response = await getSalesPersons(token);
        setSalesPersons(response.data.data || []);
      } catch (err) {
        console.log("Loading sales persons: ", err.message);
      }
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
    bank: '',
    amount: '',
    details: '',
    date: new Date().toISOString().split('T')[0]
  };

  useEffect(() => {
    const fetchLedgerData = async () => {
      if (!selectedUser?._id) {
        console.log("No selected user ID");
        return;
      }

      console.log("Fetching ledger for ID:", selectedUser._id);

      try {
        setLoading(true);

        const response = await getRetailerLedgerById(selectedUser._id);

        if (response.success && response.ledgers && Array.isArray(response.ledgers)) {
          if (response.ledgers.length === 0) {
            toast.info("No ledger entries found for this retailer");
            setTransactionData([]);
          } else {
            response.ledgers.forEach(ledger => {
              console.log("Ledger Entry:", ledger);
              console.log("Balance in this entry:", ledger.balance);
            });

            const formattedTransactions = response.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: formatLedgerDetails(ledger),
              refNo: ledger.refNo ?? null,
              voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null,
              type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ?
                Number(ledger.amount || 0).toLocaleString() : '0',
              cr: ledger.type === 'PAYMENT' ?
                Number(ledger.amount || 0).toLocaleString() : '0',
              date: ledger.date ?
                new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              image: ledger.image || null,
              balance: Number(ledger.balance || 0).toLocaleString()
            }));

            const sortedTransactions = formattedTransactions.sort((a, b) =>
              (b.sortTime || 0) - (a.sortTime || 0)
            );

            setTransactionData(sortedTransactions);
          }
        } else {
          toast.info("No ledger entries found for this retailer");
          setTransactionData([]);
        }
      } catch (error) {
        console.error("Error details:", {
          message: error.message,
          response: error.response,
          status: error.response?.status
        });
        toast.error(error.response?.data?.msg || "Failed to fetch transaction history");
        setTransactionData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLedgerData();
  }, [selectedUser?._id]);

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    if (!selectedUser?._id) {
      toast.error("No user selected");
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        bankId: values.bank,
        amount: parseFloat(values.amount),
        date: values.date,
        details: values.details || "Payment Transaction",
        isApproved: true
      };

      const response = await addRetailerLedger(selectedUser._id, paymentData);

      if (response) {
        toast.success('Payment added successfully');
        resetForm();
        onClose();

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

            const sortedTransactions = formattedTransactions.sort((a, b) =>
              (b.sortTime || 0) - (a.sortTime || 0)
            );

            setTransactionData(sortedTransactions);
          }

          await fetchRetailers(selectedUser._id);
        } catch (refreshError) {
          console.error("Error refreshing data:", refreshError);
        }
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast.error(error.response?.data?.message || error.message || 'Failed to add payment');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleRowClick = (user) => {
    setSelectedUser(user);
  };

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => {
        setCities({
          isLoaded: true,
          data: res.data.data,
        });
      }).catch(err => {
        console.log("Loading cities: ", err.message);
      });
    }
  }, [cities.isLoaded]);

  const onClose = () => {
    setIsPaymentModalVisible(false);
    setPaymentData({
      bank: '',
      payment: '',
      details: '',
      date: ''
    });
  };

  const handleDeleteLedger = async (ledgerId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this Ledger?");
    if (!confirmDelete) return;

    try {
      setLoading(true);
      const actualLedgerId = ledgerId.replace('#', '');

      const response = await deleteLedger(actualLedgerId);

      if (response.success) {
        toast.success('Ledger deleted successfully');

        if (selectedUser?._id) {
          const updatedLedger = await getRetailerLedgerById(selectedUser._id);

          if (updatedLedger?.ledgers) {
            const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: formatLedgerDetails(ledger),
              refNo: ledger.refNo ?? null,
              voucherNo: ledger.voucherNo ?? null,
              quantity: ledger.quantity ?? null,
              type: ledger.type,
              dr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              cr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              sortTime: new Date(ledger.createdAt || ledger.date).getTime(),
              isApproved: ledger.isApproved === false ? false : true,
              isRejected: ledger.isRejected === true,
              isImported: ledger.isImportedFromExcel === true,
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            const sortedTransactions = formattedTransactions.sort((a, b) =>
              (b.sortTime || 0) - (a.sortTime || 0)
            );

            setTransactionData(sortedTransactions);
          } else {
            setTransactionData([]);
          }

          await fetchRetailers(selectedUser._id);
        }
      } else {
        throw new Error(response.msg || 'Failed to delete ledger');
      }
    } catch (error) {
      console.error("Error deleting ledger:", error);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete ledger');
    } finally {
      setLoading(false);
      setShowDropdown(null);
    }
  };

  const handleEditLedger = async (values, { setSubmitting }) => {
    if (!selectedUser?._id || !selectedLedger?.id) {
      toast.error('Missing required information');
      return;
    }

    try {
      setLoading(true);
      const ledgerId = selectedLedger.id.replace('#', '');
      const companyId = selectedUser._id;
      const amount = parseFloat(values.amount);
      const date = values.date;

      const updateResponse = await updateLedger(ledgerId, companyId, amount, date);

      if (updateResponse.success) {
        try {
          const updatedLedger = await getRetailerLedgerById(selectedUser._id);

          if (updatedLedger?.ledgers) {
          const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
            id: ledger.transactionId || ledger._id,
            details: ledger.description || ledger.details || 'Transaction',
            refNo: ledger.refNo ?? null,
            voucherNo: ledger.voucherNo ?? null,
            quantity: ledger.quantity ?? null,
            type: ledger.type,
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
            const sortedTransactions = formattedTransactions.sort((a, b) =>
              (b.sortTime || 0) - (a.sortTime || 0)
            );

            setTransactionData(sortedTransactions);
            toast.success('Ledger updated successfully');
          }
        } catch (refreshError) {
          console.error("Error refreshing data:", refreshError);
          toast.success('Ledger updated successfully. Please refresh to see the latest data.');
        }
      }

      setShowEditLedger(false);
    } catch (error) {
      console.error("Error updating ledger:", error);
      toast.error(error.response?.data?.msg || error.message || 'Failed to update ledger');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const refreshRetailerData = async () => {
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
      }
    } catch (error) {
      console.error("Error refreshing retailer data:", error);
      toast.error("Failed to refresh retailer data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBackToList = async () => {
    setSelectedUser(null);
    await refreshRetailerData();
  };

  const handleSearch = async () => {
    try {
      setLoading(true);

      if (!searchTerm.trim()) {
        const response = await getAllRetailers();
        if (response?.data?.data) {
          const formattedData = formatRetailerData(response.data.data);
          setSalesData(formattedData);
          setFilteredSalesData(formattedData);
        }
        return;
      }

      const response = await searchRetailerUsers({
        searchTerm: searchTerm.trim(),
        page: currentPage,
        limit: LIMIT
      });

      if (response?.data?.data) {
        const formattedData = formatRetailerData(response.data.data);
        setSalesData(formattedData);
        setFilteredSalesData(formattedData);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error(error.response?.data?.message || "Failed to search retailers");
    } finally {
      setLoading(false);
    }
  };

  const formatRetailerData = (retailers) => {
    return retailers.map(retailer => ({
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
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value === '') {
      setFilteredSalesData(salesData);
    } else {
      const filtered = salesData.filter(retailer =>
        retailer.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSalesData(filtered);
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    console.log("Filter status changed:", filterStatus);
    console.log("Sales data:", salesData);

    let filtered = salesData;
    switch (filterStatus) {
      case 'active':
        filtered = salesData.filter(retailer => retailer.isActive === true);
        break;
      case 'inactive':
        filtered = salesData.filter(retailer => retailer.isActive === false);
        break;
      default:
        filtered = salesData;
    }

    console.log("Filtered data:", filtered);
    setFilteredSalesData(filtered);
  }, [filterStatus, salesData]);

  const handleFilterChange = (e) => {
    const status = e.target.value;
    setFilterStatus(status);
  };

  const handleDropdown = (id) => {
    setShowDropdown(prev => prev === id ? null : id);
  };

  const handleEdit = (data) => {
    setFormVisible(true);
    setNewSalesPerson({
      id: data._id,
      name: data.name,
      email: data.email || "",
      password: "",
      phone: data.phone,
      address: data.address || "",
      image: data.image,
      cnic: data.cnic || "",
      city: data.city || ""
    });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this retailer?");
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await deleteSaleUser(id);
      toast.success("Retailer deleted successfully!");
      await refreshRetailerData();
    } catch (error) {
      console.error("Error deleting retailer:", error);
      toast.error(error.response?.data?.message || "Failed to delete retailer");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptModal(true);
  };

  // Handler for adding a new retailer
  const handleAddRetailer = async (values, { setSubmitting, resetForm }) => {
    try {
      setLoading(true);
      const formData = new FormData();
  
      // Append all form fields to FormData
      formData.append("name", values.name || "");
      formData.append("email", values.email || "");
      formData.append("phoneNumber", values.phoneNumber || "");
      formData.append("cnic", values.cnic || "");
      formData.append("cityID", values.cityID || "");
      formData.append("shopName", values.shopName || "");
      formData.append("shopAddress1", values.shopAddress1 || "");
      formData.append("shopAddress2", values.shopAddress2 || "");
      formData.append("shopCategory", values.shopCategory || "");
      formData.append("distance", values.distance || "");
      formData.append("lng", values.lng || "");
      formData.append("lat", values.lat || "");
      formData.append("salesPersonID", values.salesPersonID || "");
      formData.append("billingAddress", values.billingAddress || ""); // New field
      formData.append("city", values.city || ""); // New field
      formData.append("province", values.province || ""); // New field
      formData.append("postalCode", values.postalCode || ""); // New field
      formData.append("country", values.country || ""); // New field
      formData.append("ntn", values.ntn || ""); // New field
      formData.append("stn", values.stn || ""); // New field
  
      // Append image file if it exists
      if (values.image) {
        formData.append("file", values.image);
      }
  
      // Log FormData for debugging
      console.log("FormData being sent:", [...formData.entries()]);
      const response = await createRetialer(formData, token); // Fixed typo: createRetialer -> createRetailer
  
      if (response.data && response.data.msg === "success") {
        toast.success("Retailer added successfully!");
        await fetchRetailers(); // Refresh the retailer list
        setIsAddRetailerFormVisible(false);
        resetForm();
      } else {
        throw new Error(response.data.msg || "Failed to add retailer");
      }
    } catch (error) {
      console.error("Error adding retailer:", error.response ? error.response.data : error.message);
      toast.error(
        error.response?.data?.msg ||
        error.response?.data?.errors?.map((e) => e.msg).join(", ") ||
        error.message ||
        "Failed to add retailer"
      );
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />

  const closePaymentModal = () => {
    setIsPaymentModalVisible(false);
    setPaymentData({
      bank: '',
      payment: '',
      details: '',
      date: ''
    });
  };

  if (loading) return <Loader />

  return (
    <div className='relative'>
      <Ledger />
      <div className="flex justify-between items-center mt-3">
        {!selectedUser && (
          <h1 className="text-xl text-nowrap font-bold">Customers</h1>
        )}

        <div className="flex gap-7">
          {!selectedUser && (
            <>
              <div className="flex bg-white rounded-xl ml-10 px-1">
                <img src="/Search.svg" alt="search" />
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyPress={handleSearchKeyPress}
                  className="p-2 outline-none rounded-xl"
                  type="search"
                  name="search"
                  placeholder="Search by name"
                />
              </div>

              <select
                value={filterStatus}
                onChange={handleFilterChange}
                className="bg-[#FFFFFF] rounded-lg p-1"
              >
                <option value="all">View All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <button
                className="bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded"
                onClick={() => setIsAddRetailerFormVisible(true)}
              >
                + Add Customer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        {!selectedUser ? (
          <table className="w-full border-separate border-spacing-y-4">
            <thead>
              <tr className="text-left text-gray-500">
                <td>Name</td>
                <td>ID</td>
                <td>Phone no</td>
                <td>Balance</td>
                <td>Last Payment</td>
                <td>Active</td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5934] mx-auto"></div>
                  </td>
                </tr>
              ) : filteredSalesData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-4 bg-white rounded-lg">
                    No retailers found
                  </td>
                </tr>
              ) : (
                filteredSalesData.map((data) => (
                  <tr key={data._id} className="cursor-pointer">
                    <td className="flex items-center gap-2 p-2 rounded-l-lg bg-white">
                      <img
                        src={data.image}
                        alt={data.name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.target.src = '/default-profile.png';
                        }}
                      />
                      <div>
                        <h1 className="font-bold">{data.name}</h1>
                        {data.shopName && data.shopName !== 'N/A' && (
                          <p className="text-sm text-gray-500">{data.shopName}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-2 bg-white uppercase">#{data._id.slice(0, 6)}</td>
                    <td className="p-2 bg-white">{data.phone}</td>
                    <td className="p-2 bg-white">PKR {data.balance}</td>
                    <td className="p-2 bg-white">PKR {data.lastPayment}</td>
                    <td className="p-2 text-2xl cursor-pointer bg-white">
                      <div onClick={() => statusToggleHandler(data)}>
                        {data.isActive ? (
                          <PiToggleRightFill className="text-green-500" />
                        ) : (
                          <PiToggleLeftFill className="text-gray-400" />
                        )}
                      </div>
                    </td>
                    <td className="bg-white rounded-r-xl">
                      <div className="relative p-2 bg-white justify-center items-center rounded-xl border inline-block text-left">
                        <div className="flex gap-5">
                          <FaRegEye
                            className="cursor-pointer"
                            onClick={() => setSelectedUser(data)}
                          />
                          <button className="flex">
                            <HiDotsVertical
                              className="cursor-pointer hover:text-gray-700"
                              onClick={() => handleDropdown(data._id)}
                            />
                          </button>
                        </div>
                        {showDropdown === data._id && (
                          <div className="absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1">
                              <button
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                                onClick={() => {
                                  handleEdit(data);
                                  setShowDropdown(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                onClick={() => {
                                  handleDelete(data._id);
                                  setShowDropdown(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="w-full p-4">
            <div className="flex items-center mb-2">
              <button
                className="text-[#FF5934] mr-4 bg-gray-200 p-1 rounded-lg"
                onClick={handleBackToList}
              >
                <GrFormPrevious size={24} />
              </button>
              <div>
                <h2 className="text-xl font-bold">Sales Details - {selectedUser.name}</h2>
                <p className="text-gray-600">
                  Total Balance: <span className="font-bold text-[#FF5934]">PKR {selectedUser.balance}</span>
                </p>
              </div>
            </div>

            <div className="flex mb-4 space-x-4">
              <button
                className={`px-4 py-2 rounded-t-lg ${activeTab === 'ledger' ? 'bg-[#FF5934] text-white' : 'bg-gray-200 text-gray-600'}`}
                onClick={() => setActiveTab('ledger')}
              >
                Ledger
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg ${activeTab === 'invoice' ? 'bg-[#FF5934] text-white' : 'bg-gray-200 text-gray-600'}`}
                onClick={() => setActiveTab('invoice')}
              >
                Invoice
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg ${activeTab === 'recovery' ? 'bg-[#FF5934] text-white' : 'bg-gray-200 text-gray-600'}`}
                onClick={() => setActiveTab('recovery')}
              >
                Recovery
              </button>
            </div>

            {activeTab === 'ledger' ? (
              <>
                <div className="flex items-center justify-end gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="bg-white p-2 rounded-lg"
                      value={startDate}
                      onChange={handleStartDateChange}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <span>to</span>
                    <input
                      type="date"
                      className="bg-white p-2 rounded-lg"
                      value={endDate}
                      onChange={handleEndDateChange}
                      min={startDate}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <button
                      className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                      onClick={handleFilter}
                      disabled={!startDate || !endDate}
                    >
                      Filter
                    </button>
                  </div>
                  <Link
                    to="/reportpdf"
                    state={{
                      selectedUser,
                      transactionData,
                      type: 'sales'
                    }}
                  >
                    <button className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg">
                      Report
                    </button>
                  </Link>
                  <button className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg" onClick={() => setIsPaymentModalVisible(true)}>
                    Add Payment
                  </button>
                  <label className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg cursor-pointer">
                    {isImporting ? 'Importing…' : 'Import Excel'}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {/* New: Sample import download button */}
                  <a
                    href="/customer_statement_sample.xlsx"
                    download
                    className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                    title="Download sample Excel format"
                  >
                    Sample import
                  </a>
                </div>

                <table className="w-full border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th>ID</th>
                      <th>Details</th>
                      <th>Ref no.</th>
                      <th>V. no.</th>
                      <th className="px-3">Quantity</th>
                      <th>Dr.</th>
                      <th>Cr.</th>
                      <th>Date</th>
                      <th>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerVisibleRows.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center p-4 bg-white rounded-lg">No transactions found</td>
                      </tr>
                    ) : ledgerVisibleRows.map((transaction, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 bg-white rounded-l-xl font-bold">
                            {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                          </td>
                          <td className="p-2 bg-white">{transaction.details}</td>
                          <td className="p-2 bg-white">{transaction.refNo ?? '-'}</td>
                          <td className="p-2 bg-white">{transaction.voucherNo ?? '-'}</td>
                          <td className="p-2 bg-white">{transaction.quantity ?? '-'}</td>
                          <td className="p-2 bg-white text-green-500 font-medium">
                            {transaction.dr !== "0" ? `PKR ${transaction.dr}` : "-"}
                          </td>
                          <td className="p-2 bg-white text-red-500 font-medium">
                            {transaction.cr !== "0" ? `PKR ${transaction.cr}` : "-"}
                          </td>
                          <td className="p-2 bg-white">{transaction.date}</td>
                          <td className="p-2 bg-white">PKR {transaction.balance}</td>
                          <td className="p-2 bg-white rounded-r-xl">
                            <div className="flex items-center space-x-3 pr-0">
                              <div className="relative">
                                <button
                                  className="flex justify-center items-center p-1 hover:bg-gray-100 rounded-lg transition duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDropdown((prev) =>
                                      prev === transaction.id ? null : transaction.id
                                    );
                                  }}
                                  aria-label="More options"
                                >
                                  <HiDotsVertical size={20} className="text-gray-600" />
                                </button>
                                {showDropdown === transaction.id && (
                                  <ClickOutside onClick={() => setShowDropdown(null)}>
                                    <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5">
                                      <div className="flex flex-col gap-2 justify-center items-start">
                                        <button
                                          onClick={() => {
                                            setSelectedLedger(transaction);
                                            setShowEditLedger(true);
                                            setShowDropdown(null);
                                          }}
                                          className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2 text-left"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLedger(transaction.id)}
                                          className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2 text-left"
                                        >
                                          Delete
                                        </button>
                                      </div>
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

                {ledgerRows.length > 0 && (
                  <div
                    className="pagination-container"
                    style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "150px", margin: 0 }}
                  >
                    <button
                      className="flex items-center bg-[#FF5934] text-white mt-4 p-2 rounded-lg "
                      disabled={ledgerPage === 1}
                      onClick={() => setLedgerPage((p) => p - 1)}
                    >
                      <GrFormPrevious className='text-white' />
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span className='mt-4'> {ledgerPage}</span> <span className='mt-4'>/</span>
                      <span className='mt-4'> {ledgerTotalPages || 1}</span>
                    </div>
                    <button
                      className="flex items-center mt-4 bg-[#FF5934] text-white p-2 rounded-lg "
                      onClick={() => setLedgerPage((p) => p + 1)}
                      disabled={ledgerPage >= ledgerTotalPages}
                    >
                      <GrFormNext className='text-white' />
                    </button>
                  </div>
                )}
              </>
            ) : activeTab === 'invoice' ? (
              <div className="w-full">
                <div className="flex items-center justify-end gap-4 mb-6">
                  <Link
                    to="/reportpdf"
                    state={{
                      selectedUser,
                      allInvoices,
                      type: 'sales'
                    }}
                  >
                    <button className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg">
                      Report
                    </button>
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-separate border-spacing-y-4">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="p-2 w-[10%]">Sr.</th>
                        <th className="p-2 w-[20%]">ID</th>
                        <th className="p-2 w-[20%]">Date</th>
                        <th className="p-2 w-[30%] text-right">Amount</th>
                        <th className="p-2 w-[20%] text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="5" className="text-center p-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5934] mx-auto"></div>
                          </td>
                        </tr>
                      ) : allInvoices.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center p-4 bg-white rounded-lg">
                            No invoices found
                          </td>
                        </tr>
                      ) : (
                        allInvoices.map((invoice) => (
                          <tr key={invoice.id} className="bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                            <td className="p-4 rounded-l-lg">{invoice.sr}</td>
                            <td className="p-4 font-bold">#{invoice.id.slice(0, 6)}</td>
                            <td className="p-4">{invoice.date}</td>
                            <td className="p-4 text-right pr-8">PKR {formatNumber(invoice.total)}</td>
                            <td className="p-4 rounded-r-lg flex justify-end">
                              <button
                                className="flex items-center bg-gray-100 text-[#FF5934] p-2 rounded-lg hover:bg-gray-200 transition duration-200"
                                onClick={() => onDownload(invoice)}
                                aria-label="Download Invoice"
                              >
                                <AiOutlineDownload size={20} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-end gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="bg-white p-2 rounded-lg"
                      value={startDate}
                      onChange={handleStartDateChange}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <span>to</span>
                    <input
                      type="date"
                      className="bg-white p-2 rounded-lg"
                      value={endDate}
                      onChange={handleEndDateChange}
                      min={startDate}
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <button
                      className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                      onClick={handleFilter}
                      disabled={!startDate || !endDate}
                    >
                      Filter
                    </button>
                  </div>
                </div>

                <table className="w-full border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th>ID</th>
                      <th>Details</th>
                      <th>Ref no.</th>
                      <th>V. no.</th>
                      <th>Quantity</th>
                      <th>Dr.</th>
                      <th>Cr.</th>
                      <th>Date</th>
                      <th>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryVisibleRows.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center p-4 bg-white rounded-lg">No recovery entries</td>
                      </tr>
                    ) : recoveryVisibleRows.map((transaction, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 bg-white rounded-l-xl font-bold">
                            {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                          </td>
                          <td className="p-2 bg-white">{transaction.details}</td>
                          <td className="p-2 bg-white">{transaction.refNo ?? '-'}</td>
                          <td className="p-2 bg-white">{transaction.voucherNo ?? '-'}</td>
                          <td className="p-2 bg-white">{transaction.quantity ?? '-'}</td>
                          <td className="p-2 bg-white text-green-500 font-medium">
                            {transaction.dr !== "0" ? `PKR ${transaction.dr}` : "-"}
                          </td>
                          <td className="p-2 bg-white text-red-500 font-medium">-</td>
                          <td className="p-2 bg-white">{transaction.date}</td>
                          <td className="p-2 bg-white">PKR {transaction.balance}</td>
                          <td className="p-2 bg-white rounded-r-xl">
                            <div className="flex items-center space-x-3 pr-0">
                              {transaction.isRejected === true ? (
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm font-semibold">Rejected</span>
                              ) : actionStatuses[transaction.id] === 'approved' ? (
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-semibold">Approved</span>
                              ) : actionStatuses[transaction.id] === 'rejected' ? (
                                <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm font-semibold">Rejected</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    className="flex justify-center items-center bg-green-100 text-green-700 p-2 rounded-lg hover:bg-green-200 transition duration-200"
                                    onClick={() => handleApproveAction(transaction)}
                                    aria-label="Approve"
                                    title="Approve"
                                  >
                                    <AiOutlineCheck size={18} />
                                  </button>
                                  <button
                                    className="flex justify-center items-center bg-red-100 text-red-700 p-2 rounded-lg hover:bg-red-200 transition duration-200"
                                    onClick={() => handleRejectAction(transaction)}
                                    aria-label="Reject"
                                    title="Reject"
                                  >
                                    <AiOutlineClose size={18} />
                                  </button>
                                </div>
                              )}

                              {/* View Recovery Image */}
                              <button
                                className="flex justify-center items-center p-2 hover:bg-gray-100 rounded-lg transition duration-200"
                                onClick={() => handleViewRecoveryImage(transaction)}
                                aria-label="View Image"
                                title="View Image"
                              >
                                <FaRegEye size={18} className="text-gray-700" />
                              </button>

                              <div className="relative">
                                <button
                                  className="flex justify-center items-center p-1 hover:bg-gray-100 rounded-lg transition duration-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDropdown((prev) =>
                                      prev === transaction.id ? null : transaction.id
                                    );
                                  }}
                                  aria-label="More options"
                                >
                                  <HiDotsVertical size={20} className="text-gray-600" />
                                </button>
                                {showDropdown === transaction.id && (
                                  <ClickOutside onClick={() => setShowDropdown(null)}>
                                    <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5">
                                      <div className="flex flex-col gap-2 justify-center items-start">
                                        <button
                                          onClick={() => {
                                            setSelectedLedger(transaction);
                                            setShowEditLedger(true);
                                            setShowDropdown(null);
                                          }}
                                          className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2 text-left"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteLedger(transaction.id)}
                                          className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2 text-left"
                                        >
                                          Delete
                                        </button>
                                      </div>
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

                {recoveryRows.length > 0 && (
                  <div
                    className="pagination-container"
                    style={{ display: "flex", alignItems: "center", gap: "10px", maxWidth: "150px", margin: 0 }}
                  >
                    <button
                      className="flex items-center bg-[#FF5934] text-white mt-4 p-2 rounded-lg "
                      disabled={recoveryPage === 1}
                      onClick={() => setRecoveryPage((p) => p - 1)}
                    >
                      <GrFormPrevious className='text-white' />
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span className='mt-4'> {recoveryPage}</span> <span className='mt-4'>/</span>
                      <span className='mt-4'> {recoveryTotalPages || 1}</span>
                    </div>
                    <button
                      className="flex items-center mt-4 bg-[#FF5934] text-white p-2 rounded-lg "
                      onClick={() => setRecoveryPage((p) => p + 1)}
                      disabled={recoveryPage >= recoveryTotalPages}
                    >
                      <GrFormNext className='text-white' />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!selectedUser && (
        <div
          className="pagination-container"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            maxWidth: "150px",
            margin: 0,
          }}
        >
          <button
            className="flex items-center bg-[#FF5934] text-white mt-4 p-2 rounded-lg "
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage((p) => p - 1);
            }}
          >
            <GrFormPrevious className='text-white' />
          </button>
          <div
            style={{ display: "flex", alignItems: "center", gap: "5px" }}
          >
            <span className='mt-4'> {currentPage}</span> <span className='mt-4'>/</span>
            <span className='mt-4'> {totalPages}</span>
          </div>
          <button
            className="flex items-center mt-4 bg-[#FF5934] text-white p-2 rounded-lg "
            onClick={() => {
              setCurrentPage((p) => p + 1);
            }}
            disabled={totalPages <= currentPage}
          >
            <GrFormNext className='text-white' />
          </button>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg">
            <div className="border-b border-gray-300 px-4 py-3">
              <h2 className="text-xl font-bold">Add Payment</h2>
            </div>

            <Formik
              initialValues={initialValues}
              validationSchema={validationSchema}
              onSubmit={handleSubmit}
            >
              {({ values, handleChange, errors, touched }) => (
                <Form>
                  <div className="px-6 py-4">
                    <label className="block text-sm font-medium text-gray-700 mt-4">
                      Select Bank
                    </label>
                    <select
                      name="bank"
                      value={values.bank}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    >
                      <option value="">Select Bank</option>
                      {banks
                        .filter((bank) => bank.isActive)
                        .map((bank) => (
                          <option key={bank._id} value={bank._id}>
                            {bank.bankName} - {bank.accountTitle}
                          </option>
                        ))}
                    </select>
                    {touched.bank && errors.bank && (
                      <div className="text-red-500 text-sm mt-1">{errors.bank}</div>
                    )}
                  </div>

                  <div className="px-6">
                    <input
                      type="number"
                      name="amount"
                      value={values.amount}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                      placeholder="Enter Payment Amount"
                    />
                    {touched.amount && errors.amount && (
                      <div className="text-red-500 text-sm mt-1">{errors.amount}</div>
                    )}
                  </div>

                  <div className="px-6">
                    <label className="block text-sm font-medium text-gray-700 mt-4">
                      Details
                    </label>
                    <textarea
                      name="details"
                      value={values.details}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                      placeholder="Enter Details"
                      rows={4}
                    />
                  </div>

                  <div className="px-6">
                    <input
                      type="date"
                      name="date"
                      value={values.date}
                      onChange={handleChange}
                      max={new Date().toISOString().split("T")[0]}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    {touched.date && errors.date && (
                      <div className="text-red-500 text-sm mt-1">{errors.date}</div>
                    )}
                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={onClose}
                      className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                    >
                      Cancel
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : 'Save'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {isAddRetailerFormVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[600px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Customer</h2>
            </div>
            <Formik
              initialValues={retailerInitialValues}
              validationSchema={retailerValidationSchema}
              onSubmit={handleAddRetailer}
            >
              {({ values, handleChange, errors, touched, setFieldValue }) => (
                <Form>
                  <div className="px-6">
                    <Input
                      name="name"
                      label="Name"
                      placeholder="Enter Name"
                      value={values.name}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.name && touched.name ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="email"
                      label="Email"
                      placeholder="Enter Email"
                      value={values.email}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.email && touched.email ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="phoneNumber"
                      label="Phone Number"
                      placeholder="Enter Phone Number (e.g., +923333333333)"
                      value={values.phoneNumber}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.phoneNumber && touched.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="cnic"
                      label="CNIC"
                      placeholder="Enter CNIC (e.g., xxxxx-xxxxxxx-x)"
                      value={values.cnic}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.cnic && touched.cnic ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <select
                        name="cityID"
                        value={values.cityID}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.cityID && touched.cityID ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select City</option>
                        {cities.data.map((city) => (
                          <option value={city._id} key={city._id}>{city.name}</option>
                        ))}
                      </select>
                    </div>

                    <Input
                      name="shopName"
                      label="Shop Name"
                      placeholder="Enter Shop Name"
                      value={values.shopName}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopName && touched.shopName ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="shopAddress1"
                      label="Shop Address 1"
                      placeholder="Enter Shop Address 1"
                      value={values.shopAddress1}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopAddress1 && touched.shopAddress1 ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="shopAddress2"
                      label="Shop Address 2"
                      placeholder="Enter Shop Address 2"
                      value={values.shopAddress2}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopAddress2 && touched.shopAddress2 ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="shopCategory"
                      label="Shop Category"
                      placeholder="Enter Shop Category"
                      value={values.shopCategory}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.shopCategory && touched.shopCategory ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="distance"
                      label="Distance"
                      placeholder="Enter Distance"
                      value={values.distance}
                      onChange={handleChange}
                      type="number"
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.distance && touched.distance ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="lng"
                      label="Longitude"
                      placeholder="Enter Longitude"
                      value={values.lng}
                      onChange={handleChange}
                      type="number"
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.lng && touched.lng ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      name="lat"
                      label="Latitude"
                      placeholder="Enter Latitude"
                      value={values.lat}
                      onChange={handleChange}
                      type="number"
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.lat && touched.lat ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">Sales Person</label>
                      <select
                        name="salesPersonID"
                        value={values.salesPersonID}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.salesPersonID && touched.salesPersonID ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select Sales Person</option>
                        {salesPersons.map((person) => (
                          <option value={person._id} key={person._id}>{person.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">Image</label>
                      <input
                        type="file"
                        name="image"
                        onChange={(e) => setFieldValue("image", e.currentTarget.files[0])}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.image && touched.image ? 'border-red-500' : 'border-gray-300'}`}
                      />
                    </div>

                    {/* Tab Navigation */}
                    {['address', 'taxInfo'].map((tab) => {
                      const isActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`px-4 py-2 ${isActive ? 'bg-[#FF5934] text-white' : 'text-gray-600'} rounded-t-lg mt-4`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1).replace('Info', ' Info')}
                        </button>
                      );
                    })}

                    {/* Tab Content */}
                    <div className="p-4">
                      {activeTab === 'address' && (
                        <>
                          <Input
                            name="billingAddress"
                            label="Billing Address"
                            placeholder="Billing Address"
                            value={values.billingAddress || ''}
                            onChange={handleChange}
                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-[517px] border border-gray-300"
                          />
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="city"
                              label="City"
                              placeholder="City"
                              value={values.city || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="province"
                              label="Province"
                              placeholder="Province"
                              value={values.province || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="postalCode"
                              label="Postal Code"
                              placeholder="Postal Code"
                              value={values.postalCode || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="country"
                              label="Country"
                              placeholder="Country"
                              value={values.country || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {activeTab === 'taxInfo' && (
                        <>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="ntn"
                              label="NTN"
                              placeholder="NTN"
                              value={values.ntn || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="stn"
                              label="STN"
                              placeholder="STN"
                              value={values.stn || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="mt-2">
                            <Input
                              name="cnic"
                              label="CNIC"
                              placeholder="CNIC"
                              value={values.cnic || ''}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[517px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={() => setIsAddRetailerFormVisible(false)}
                      className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                    >
                      Cancel
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}

      {showEditLedger && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg">
            <div className="border-b border-gray-300 px-4 py-3">
              <h2 className="text-xl font-bold">Edit Ledger</h2>
            </div>
            <Formik
              initialValues={{
                amount: selectedLedger?.dr !== "0" ? selectedLedger?.dr.replace(/[^0-9.]/g, '') : selectedLedger?.cr.replace(/[^0-9.]/g, ''),
                date: selectedLedger?.date
              }}
              validationSchema={yup.object().shape({
                amount: yup.string()
                  .matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number')
                  .required('Amount is required'),
                date: yup.string().required('Date is required')
              })}
              onSubmit={handleEditLedger}
            >
              {({ values, handleChange, errors, touched }) => (
                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                  <div className="px-6">
                    <Input
                      name="amount"
                      label="Amount"
                      placeholder="Enter Amount"
                      value={values.amount}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    <Input
                      type="date"
                      name="date"
                      label="Date"
                      placeholder="Select Date"
                      value={values.date}
                      onChange={handleChange}
                      max={new Date().toISOString().split("T")[0]}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.date && touched.date ? 'border-red-500' : 'border-gray-300'}`}
                    />
                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowEditLedger(false)}
                      className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}

      {isRecoveryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black bg-opacity-40"
            onClick={() => setIsRecoveryDrawerOpen(false)}
          />
          {/* Side Drawer */}
          <div className="w-[380px] max-w-[90vw] bg-white h-full shadow-lg overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Recovery Image</h3>
              <button
                className="p-2 hover:bg-gray-100 rounded"
                aria-label="Close"
                onClick={() => setIsRecoveryDrawerOpen(false)}
              >
                <AiOutlineClose size={18} />
              </button>
            </div>
            <div className="p-4">
              {recoveryImageSrc ? (
                <img
                  src={recoveryImageSrc}
                  alt="Recovery"
                  className="w-full h-auto rounded"
                  onError={(e) => {
                    // Hide image and show 'No image' when load fails
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="text-gray-700">No image</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          transaction={selectedTransaction}
          onClose={() => setShowReceiptModal(false)}
          type="sales"
        />
      )}

    </div>
  );
};

export default LedgerSales;