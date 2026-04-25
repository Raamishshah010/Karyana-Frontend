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
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik, FieldArray, Field} from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Spinner } from '../common/spinner';
import { Textarea } from '../common/textArea';
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import ClickOutside from '../../Hooks/ClickOutside';
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import { FaPlus } from 'react-icons/fa';
import GroupedSelect from '../common/GroupedSelect';

const LIMIT = 10;
const Purchase = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [showDropdown, setShowDropdown] = useState("");
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
  // const [transactionData, setTransactionData] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState("");
  const [showEditLedger, setShowEditLedger] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [invoices, setInvoices] = useState([]);
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [products, setProducts] = useState([]);
  const [limit] = useState(100);
  const [state, setState] = useState({
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
  const [paymentData, setPaymentData] = useState({
    bank: '',
    payment: '',
    details: '',
    date: ''
  });
  const [selectedLocation, setSelectedLocation] = useState(null);

  const token = useSelector((state) => state.admin.token);

  const groupedProducts = useMemo(() => {
    if (!products) return [];

    const filteredProducts = products.filter(product =>
      !selectedLocation ||
      product.location === selectedLocation ||
      product.location === undefined
    );

    return Object.entries(
      filteredProducts.reduce((acc, product) => {
        const category = product.category || 'Other';
        if (!acc[category]) {
          acc[category] = [];
        }
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
            const formattedInvoices = response.invoices.map((invoice, index) => ({
              sr: index + 1,
              id: invoice.invoiceId,
              _id: invoice._id.toString(), // Full _id as string
              date: new Date(invoice.date).toLocaleDateString(),
              biltyNumber: invoice.biltyNumber,
              vehicleNumber: invoice.vehicleNumber,
              items: invoice.items.length,
              freightAmount: invoice.freightAmount || 0,
              details: invoice.details,
              total: invoice.totalAmount || 0,
              fullInvoice: invoice // Store full invoice data
            }));
            setInvoices(formattedInvoices);
          } else {
            setInvoices([]);
            toast.info('No invoices found for this company');
          }
        } catch (error) {
          console.error('Error fetching invoices:', error);
          toast.error(error.response?.data?.msg || 'Failed to fetch invoices');
          setInvoices([]);
        } finally {
          setLoading(false);
        }
      };
      fetchInvoices();
    } else {
      setInvoices([]);
    }
  }, [selectedUser?._id]);

  const purchaseValidations = yup.object().shape({
    companyName: yup.string().required("Company Name is required"),
    phone: yup.string()
      .matches(/^(\+92|92|0)?[345]\d{9}$/, "Phone number is not valid e.g +923333333333")
      .required("Phone number is required"),
    address: yup.string().required("Address is required"),
    email: yup.string().email("Invalid email address").nullable(),
    accountNo: yup.string().nullable(),
    title: yup.string().nullable(),
    firstName: yup.string().nullable(),
    lastName: yup.string().nullable(),
    mobile: yup.string()
      .matches(/^(\+92|92|0)?[345]\d{9}$/, "Mobile number is not valid e.g +923333333333")
      .nullable(),
    secondaryPhone: yup.string()
      .matches(/^(\+92|92|0)?[345]\d{9}$/, "Secondary phone number is not valid e.g +923333333333")
      .nullable(),
    website: yup.string().url("Invalid URL").nullable(),
    billingAddress: yup.string().nullable(),
    city: yup.string().nullable(),
    province: yup.string().nullable(),
    postalCode: yup.string().nullable(),
    country: yup.string().nullable(),
    ntn: yup.string().nullable(),
    stn: yup.string().nullable(),
    cnic: yup.string()
      .required("CNIC is required")
      .matches(/^\d{5}-\d{7}-\d{1}$/, "CNIC must be in format xxxxx-xxxxxxx-x"),
    bankName: yup.string().nullable(),
    accountName: yup.string().nullable(),
    accountNumber: yup.string().nullable(),
    iban: yup.string().nullable(),
    swiftCode: yup.string().nullable(),
    bankAddress: yup.string().nullable(),
  });
  const paymentValidationSchema = yup.object().shape({
    bank: yup.string().required('Bank is required'),
    amount: yup
      .string()
      .matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number')
      .required('Amount is required'),
    date: yup.string().required('Date is required'),
    details: yup.string().required('Details are required'),
  });

  const directPaymentValidationSchema = yup.object().shape({
    retailer: yup.string().required('Retailer is required'),
    amount: yup
      .string()
      .matches(/^\d+(\.\d+)?$/, 'Enter a valid positive number')
      .required('Amount is required'),
    date: yup.string().required('Date is required'),
    details: yup.string().required('Details are required'),
  });

  // const products = [
  //   { _id: '1', name: 'Product 1' },
  //   { _id: '2', name: 'Product 2' },
  //   { _id: '3', name: 'Product 3' },
  // ];

  const purchaseValidationSchema = yup.object().shape({
    biltyNumber: yup.string().required('Bilty Number is required'),
    vehicleNumber: yup.string().required('Vehicle Number is required'),
    date: yup.string().required('Date is required'),
    freightAmount: yup.number().min(0, 'Freight amount cannot be negative'),
    items: yup.array().of(
      yup.object().shape({
        product: yup.string().required('Product is required'),
        purchaseRate: yup.number().required('Purchase Rate is required'),
        quantity: yup.number().required('Quantity is required'),
      })
    ),
  });

  const handleFilter = async () => {
    if (!selectedUser?._id) {
      toast.error('Please select a company first');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    try {
      setLoading(true);

      // Format dates to YYYY-MM-DD
      const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
      const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

      console.log('Fetching data for:', {
        companyId: selectedUser._id,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });

      // Use the getLedgersByDateRange service function
      const response = await getLedgersByDateRange(
        selectedUser._id,
        formattedStartDate,
        formattedEndDate
      );

      console.log('API Response:', response);

      if (response?.data) {
        const formattedTransactions = response.data.map((ledger) => ({
          id: ledger.id,
          details: ledger.details || 'Transaction',
          dr: ledger.type === 'PAYMENT' ? Number(ledger.amount).toLocaleString() : '0',
          cr: ledger.type !== 'PAYMENT' ? Number(ledger.amount).toLocaleString() : '0',
          date: ledger.date,
          balance: `PKR ${Number(ledger.balance).toLocaleString()}`,
        }));

        console.log('Formatted Transactions:', formattedTransactions);
        setTransactionData(formattedTransactions);
      } else {
        setTransactionData([]);
      }
    } catch (error) {
      console.error('Error fetching filtered data:', error);
      toast.error(error?.response?.data?.msg || 'Failed to fetch filtered data');
    } finally {
      setLoading(false);
    }
  };
  // Update the date input handlers
  const handleStartDateChange = (e) => {
    const date = e.target.value;
    setStartDate(date);
  };

  const handleEndDateChange = (e) => {
    const date = e.target.value;
    setEndDate(date);
  };
  useEffect(() => {
    // Reset date fields when component is mounted or navigated to
    setStartDate('');
    setEndDate('');
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        console.log('Fetching products...');
        const response = await getProducts(currentPage, limit);
        console.log('API Response:', response);

        // Check if response and response.data exist
        if (!response || !response.data) {
          console.error('Invalid API response structure:', response);
          toast.error('Failed to load products: Invalid response');
          return;
        }

        // Extract products array from response.data.data
        const productsData = response.data.data || [];

        if (Array.isArray(productsData)) {
          console.log('Products fetched successfully:', productsData);
          setProducts(productsData);
        } else {
          console.error('Products data is not an array:', productsData);
          toast.error('Invalid products data format');
        }
      } catch (error) {
        console.error("Error fetching products:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        toast.error('Failed to load products: ' + (error.response?.data?.message || error.message));
      } finally {
        setLoadingProducts(false);
      }
    };

    if (showPurchase) {
      fetchProducts();
    }
  }, [showPurchase, currentPage, limit]);

  // Debug log when products state changes
  useEffect(() => {
    console.log('Current products state:', products);
  }, [products]);


  // Debug log when products state changes
  useEffect(() => {
    console.log('Current products state:', products);
  }, [products]);

  useEffect(() => {
    setLoading(true);
    const link = `/warehouse-manager/search?page=${currentPage}&limit=${LIMIT}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
      setLoading(false);
      setTotalPages(res.data.totalPages);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedMaritalStatus, selectedCityId]);


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


  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setLoading(true);
        const response = await getAllPurchases();

        // The purchases are in response.data.data
        const purchasesData = response.data.data;

        console.log('Extracted Purchases:', purchasesData);

        if (Array.isArray(purchasesData) && purchasesData.length > 0) {
          setPurchases(purchasesData);
        } else {
          console.error('No purchases found in response', response);
          setPurchases([]);
        }

        setLoading(false);
      } catch (error) {
        console.error("Detailed Error Fetching Purchases:", {
          message: error.message,
          response: error.response,
          status: error.response?.status
        });
        setLoading(false);
        setPurchases([]);
      }
    };

    fetchPurchases();
  }, []);

  // Add useEffect to fetch banks
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

  useEffect(() => {
    const fetchRetailers = async () => {
      try {
        const response = await getAllRetailers();
        if (response?.data?.data) {
          setRetailers(response.data.data); // Set the fetched retailers data
        }
      } catch (error) {
        console.error("Error fetching retailers:", error);
        toast.error("Failed to load retailers");
      } finally {
        setLoading(false); // Stop loading after data is fetched or error occurs
      }
    };

    fetchRetailers(); // Call the function to fetch retailers data
  }, []);

  useEffect(() => {
    const fetchLedgerData = async () => {
      if (!selectedUser?._id) {
        console.log("No selected user ID");
        return;
      }

      console.log("Fetching ledger for ID:", selectedUser._id);

      try {
        setLoading(true);

        // Fetch ledger data
        const ledgerResponse = await getLedgerById(selectedUser._id);
        console.log("Ledger Response:", ledgerResponse);  // Log the full response to verify

        if (ledgerResponse && ledgerResponse.ledgers && Array.isArray(ledgerResponse.ledgers)) {
          // Check if there are any ledger entries
          if (ledgerResponse.ledgers.length === 0) {
            toast.info("You don't have any ledger entries for this company.");
            setTransactionData([]);
          } else {
            // Log the ledger items to verify the balance field
            ledgerResponse.ledgers.forEach(ledger => {
              console.log("Ledger Entry:", ledger);
              console.log("Balance in this entry:", ledger.balance);
            });

            const formattedTransactions = ledgerResponse.ledgers.map(ledger => ({
              // id: ledger.transactionId || `#${ledger._id?.slice(0, 6)}` || '#TRX000',
              id: ledger.transactionId || ledger._id,
              details: ledger.description || ledger.details || 'Transaction',
              dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              balance: Number(ledger.balance || 0).toLocaleString()
            }));
            setTransactionData(formattedTransactions);
          }
        } else {
          toast.info("You don't have any ledger entries for this company.");
          setTransactionData([]);
        }
      } catch (error) {
        console.error("Detailed error:", {
          message: error.message,
          response: error.response,
          status: error.response?.status
        });
        toast.error("Failed to fetch transaction history");
        setTransactionData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLedgerData();
  }, [selectedUser?._id]);


  useEffect(() => {
    if (show) {
      setActiveTab("address");
    }
  }, [show]);
  const clearForm = () => {
    setState({
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
  };
  const deleteHandler = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this company?");
    if (!confirmDelete) return;

    try {
      setLoading(true);

      // Call the deletePurchase function
      await deletePurchase(id);
      toast.success("Company deleted successfully!");

      // Optionally refresh the purchases list after deletion
      const response = await getAllPurchases(); // Make sure you have this function to fetch all purchases
      setPurchases(response.data.data);
    } catch (error) {
      console.error("Error deleting purchase:", error);
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Failed to delete the purchase!"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values, { resetForm, setSubmitting, validateForm }) => {
  try {
    // Validate the form and check for CNIC errors
    const errors = await validateForm(values);
    
    // If CNIC is missing or has errors, switch to Tax Info tab
    if (!values.cnic || (errors && errors.cnic)) {
      setActiveTab("taxInfo");
      toast.error("CNIC is required. Please check the Tax Info tab.");
      setSubmitting(false);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setSubmitting(true);

    const purchaseData = {
      companyName: values.companyName,
      phone: values.phone,
      address: values.address,
      email: values.email,
      accountNo: values.accountNo,
      title: values.title,
      firstName: values.firstName,
      lastName: values.lastName,
      mobile: values.mobile,
      secondaryPhone: values.secondaryPhone,
      website: values.website,
      billingAddress: values.billingAddress,
      city: values.city,
      province: values.province,
      postalCode: values.postalCode,
      country: values.country,
      ntn: values.ntn,
      stn: values.stn,
      cnic: values.cnic,
      bankName: values.bankName,
      accountName: values.accountName,
      accountNumber: values.accountNumber,
      iban: values.iban,
      swiftCode: values.swiftCode,
      bankAddress: values.bankAddress,
    };

    let response;
    if (state?.id) {
      // If there's an existing ID, update the purchase
      response = await updatePurchase(state.id, purchaseData);
      toast.success("Purchase updated successfully!");
    } else {
      // If no ID, create a new purchase
      response = await addPurchase(purchaseData);
      toast.success("Company added successfully!");
    }

    // Fetch and update the purchases list
    const updatedPurchasesResponse = await getAllPurchases();
    setPurchases(updatedPurchasesResponse.data.data);

    // Close the modal and reset the form
    setShow(false);
    resetForm();

    // Optional: clear the state
    clearForm();
  } catch (error) {
    console.error("Purchase submission error:", {
      message: error.message,
      response: error.response,
      stack: error.stack,
    });

    // More detailed error handling
    toast.error(
      error.response?.data?.message ||
      error.response?.data?.msg ||
      error.response?.data?.errors?.[0]?.msg ||
      error.message ||
      "Failed to save the purchase!"
    );
  } finally {
    setLoading(false);
    setSubmitting(false);
  }
};


  const editHandler = (item) => {
    setShow(true);
    setState({
      id: item._id,
      companyName: item.companyName,
      phone: item.phone,
      address: item.address,
    });
  };

  const addHandler = async () => {
    clearForm();
    setShow(true);
  };



  const statusToggleHandler = async (purchase) => {
    try {
      setLoading(true); // Show loader
      await updatePurchaseStatus(purchase._id, !purchase.isActive); // Call the API with the toggled status

      // Update the local state to reflect the status change
      setPurchases((prevPurchases) =>
        prevPurchases.map((p) =>
          p._id === purchase._id ? { ...p, isActive: !p.isActive } : p
        )
      );

      // Show success message
      toast.success(`Purchase ${!purchase.isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error("Error updating purchase status:", error);

      // Handle error responses
      if (error.response) {
        toast.error(
          error.response.data.message ||
          `Failed to update purchase status. Server responded with ${error.response.status}`
        );
      } else if (error.request) {
        toast.error("No response received from server. Please check your network connection.");
      } else {
        toast.error("Error setting up the request. Please try again.");
      }
    } finally {
      setLoading(false); // Hide loader
    }
  };

  // Filter purchases based on status
  useEffect(() => {
    let filtered = purchases;
    switch (filterStatus) {
      case 'active':
        filtered = purchases.filter(purchase => purchase.isActive);
        break;
      case 'inactive':
        filtered = purchases.filter(purchase => !purchase.isActive);
        break;
      default:
        filtered = purchases;
    }
    setFilteredPurchases(filtered);
  }, [filterStatus, purchases]);

  const handleFilterChange = (e) => {
    const status = e.target.value;
    setFilterStatus(status);
  };

  const handleSearch = async () => {
    try {
      setLoading(true);

      // If search term is empty, reset to all purchases
      if (!searchTerm.trim()) {
        setFilteredPurchases(purchases);
        setLoading(false);
        return;
      }

      // Call the searchPurchases API with the search term
      const response = await searchPurchases(searchTerm.trim());

      // Assume the API returns an array of matching purchases
      if (response && response.data) {
        setFilteredPurchases(response.data);
      } else {
        setFilteredPurchases([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search purchases");
    } finally {
      setLoading(false);
    }
  };

  // Trigger search when user presses Enter
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Automatically filter as user types (client-side search)
    if (!value.trim()) {
      setFilteredPurchases(purchases);
      return;
    }

    const lowercaseSearchTerm = value.toLowerCase().trim();
    const searchResults = purchases.filter(purchase =>
      purchase.companyName.toLowerCase().includes(lowercaseSearchTerm) ||
      purchase.phone.toLowerCase().includes(lowercaseSearchTerm) ||
      purchase.address.toLowerCase().includes(lowercaseSearchTerm)
    );

    setFilteredPurchases(searchResults);
  };


  const refreshPurchaseData = async () => {
    try {
      setIsRefreshing(true);
      const response = await getAllPurchases();
      if (response?.data?.data) {
        setPurchases(response.data.data);
        setFilteredPurchases(response.data.data);
      }
    } catch (error) {
      console.error("Error refreshing purchase data:", error);
      toast.error("Failed to refresh purchase data");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modify the back button handler
  const handleBackToList = async () => {
    setSelectedUser(null);
    await refreshPurchaseData();
  };

  const handleAddPaymentSubmit = async (values, { resetForm, setSubmitting }) => {
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
        details: values.details || "Payment Transaction"
      };

      const response = await addLedger(selectedUser._id, paymentData);

      if (response) {
        toast.success('Payment added successfully');
        resetForm();
        setShowAddPayment(false);

        // Update ledger data and user balance
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            // Update transactions
            const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: ledger.description || ledger.details || 'Transaction',
              dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            setTransactionData(formattedTransactions);

            // Update selected user's balance
            setSelectedUser(prevUser => ({
              ...prevUser,
              balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0'
            }));
          }
        } catch (refreshError) {
          console.error("Error refreshing ledger:", refreshError);
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

  const handleAddDirectPaymentSubmit = async (values, { resetForm, setSubmitting }) => {
    if (!selectedUser?._id) {
      toast.error("No user selected");
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        retailerId: values.retailer,
        amount: parseFloat(values.amount),
        date: values.date,
        details: values.details || 'Transaction'
      };

      const response = await addDirectPayment(selectedUser._id, paymentData);

      if (response) {
        toast.success('Direct payment added successfully');
        resetForm();
        setShowDirectPayment(false);

        // Update ledger data and user balance
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            // Update transactions
            const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: ledger.details || 'Transaction',
              dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              balance: ledger.balance?.toLocaleString() || '0'
            }));
            setTransactionData(formattedTransactions);

            // Update selected user's balance
            setSelectedUser(prevUser => ({
              ...prevUser,
              balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0'
            }));
          }
        } catch (refreshError) {
          console.error("Error refreshing ledger:", refreshError);
        }
      }
    } catch (error) {
      console.error("Error adding direct payment:", error);
      toast.error(error.response?.data?.message || error.message || 'Failed to add direct payment');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };


  const handleDeleteLedger = async (ledgerId) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this Ledger?");
    if (!confirmDelete) return;

    try {
      setLoading(true);

      // Extract actual ledger ID from the formatted string
      const actualLedgerId = ledgerId.replace('#', '');

      // Call delete API and get the response
      const response = await deleteLedger(actualLedgerId);

      if (response.success) {
        toast.success('Ledger deleted successfully');

        // If it was the last ledger, clear all data and update balances to 0
        if (response.isLastLedger) {
          setTransactionData([]);
          // Update selected user's balance and lastPayment
          setSelectedUser(prevUser => ({
            ...prevUser,
            balance: '0',
            lastPayment: '0'
          }));
          return;
        }

        // Only fetch updated data if we have a selected user and it wasn't the last ledger
        if (selectedUser?._id) {
          try {
            const updatedLedger = await getLedgerById(selectedUser._id);

            if (updatedLedger?.ledgers) {
              // Update transactions
              const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
                // id: ledger.transactionId || `#${ledger._id?.slice(0, 6)}` || '#TRX000',
                id: ledger.transactionId || ledger._id,
                details: ledger.description || ledger.details || 'Transaction',
                dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
                cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
                date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
                balance: ledger.balance?.toLocaleString() || '0'
              }));

              setTransactionData(formattedTransactions);

              // Update selected user's balance
              const latestBalance = updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0';

              // Find the latest payment
              const latestPayment = updatedLedger.ledgers
                .filter(ledger => ledger.type === 'PAYMENT')
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.amount?.toLocaleString() || '0';

              // Update selected user with latest balance and payment
              setSelectedUser(prevUser => ({
                ...prevUser,
                balance: latestBalance,
                lastPayment: latestPayment
              }));

              // Update both salesData and filteredSalesData to reflect the changes
              const updateRetailerData = (prevData) =>
                prevData.map(retailer =>
                  retailer._id === selectedUser._id
                    ? { ...retailer, balance: latestBalance, lastPayment: latestPayment }
                    : retailer
                );

              setSalesData(updateRetailerData);
              setFilteredSalesData(updateRetailerData);
            }
          } catch (refreshError) {
            console.error("Error refreshing ledger:", refreshError);
          }
        }
      } else {
        throw new Error(response.msg || 'Failed to delete ledger');
      }
    } catch (error) {
      console.error("Error deleting ledger:", error);
      toast.error(error.response?.data?.message || error.message || 'Failed to delete ledger');
    } finally {
      setLoading(false);
      setShowDropdown("");
    }
  };

  const handleEditLedger = async (values, { setSubmitting }) => {
    if (!selectedUser?._id || !selectedLedger?.id) {
      toast.error('Missing required information');
      return;
    }

    try {
      setLoading(true);
      console.log(selectedLedger.id);
      const ledgerId = selectedLedger.id.replace('#', '');
      const companyId = selectedUser._id;
      const amount = parseFloat(values.amount);
      const date = values.date;
      await updateLedger(ledgerId, companyId, amount, date);
      toast.success('Ledger updated successfully');
      setShowEditLedger(false);

      // Refresh ledger data
      const updatedLedger = await getLedgerById(selectedUser._id);
      if (updatedLedger?.ledgers) {
        const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
          // id: ledger.transactionId || `#${ledger._id?.slice(0, 6)}` || '#TRX000',
          id: ledger.transactionId || ledger._id,
          details: ledger.description || ledger.details || 'Transaction',
          dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
          cr: ledger.type !== 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
          date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
          balance: ledger.balance?.toLocaleString() || '0'
        }));
        setTransactionData(formattedTransactions);
      }
    } catch (error) {
      console.error("Error updating ledger:", error);
      toast.error(error.response?.data?.message || 'Failed to update ledger');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handlePurchaseSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      setLoading(true);

      // Validate if product is selected
      const hasEmptyProduct = values.items.some(item => !item.product);
      if (hasEmptyProduct) {
        toast.error('Please select a product for all items');
        setLoading(false);
        setSubmitting(false);
        return;
      }

      // Prepare the purchase data
      const purchaseData = {
        biltyNumber: values.biltyNumber,
        vehicleNumber: values.vehicleNumber,
        date: values.date,
        details: values.details || 'Transaction',
        freightAmount: Number(values.freightAmount || 0),
        items: values.items.map(item => ({
          product: item.product,
          quantity: Number(item.quantity) || 0,
          purchaseRate: Number(item.purchaseRate) || 0,
          purchaseDiscount: Number(item.purchaseDiscount) || 0,
          salesRate: Number(item.salesRate) || 0,
          salesDiscount: Number(item.salesDiscount) || 0,
          amount: Number(item.amount) || 0
        }))
      };

      // Ensure selectedUser._id is valid
      if (!selectedUser?._id) {
        toast.error('No company selected');
        setLoading(false);
        setSubmitting(false);
        return;
      }

      const response = await addPurchaseLedger(selectedUser._id, purchaseData);

      if (response?.success) {
        toast.success('Purchase added successfully');
        resetForm();
        setShowPurchase(false);

        // Update ledger data and user balance
        try {
          const updatedLedger = await getLedgerById(selectedUser._id);
          if (updatedLedger && updatedLedger.ledgers) {
            // Update transactions
            const formattedTransactions = updatedLedger.ledgers.map(ledger => ({
              id: ledger.transactionId || ledger._id,
              details: ledger.details || 'Transaction',
              dr: ledger.type === 'PAYMENT' ? ledger.amount?.toLocaleString() || '0' : '0',
              cr: ledger.type === 'PURCHASE' ? ledger.amount?.toLocaleString() || '0' : '0',
              date: ledger.date ? new Date(ledger.date).toISOString().split('T')[0] : '-',
              balance: ledger.balance?.toLocaleString() || '0'
            }));

            // Update the transactionData state with the new transactions
            setTransactionData(formattedTransactions);

            // Update selected user's balance
            setSelectedUser(prevUser => ({
              ...prevUser,
              balance: updatedLedger.ledgers[updatedLedger.ledgers.length - 1]?.balance?.toLocaleString() || '0'
            }));
          }
        } catch (refreshError) {
          console.error("Error refreshing ledger:", refreshError);
          toast.error('Failed to refresh ledger data');
        }
      }
    } catch (error) {
      console.error("Error adding purchase:", error);
      const errorMessage = error.response?.data?.msg || error.message || 'Failed to add purchase';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const onDownloadInvoice = async (invoice) => {
    try {
      const response = await generatePurchaseInvoicePDF({ invoiceId: invoice._id });
      if (response.success) {
        window.open(response.url, '_blank');
      } else {
        toast.error('Failed to generate invoice PDF');
      }
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      toast.error(error.response?.data?.msg || 'Error downloading invoice');
    }
  };


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch cities
        if (!cities.isLoaded) {
          const cityResponse = await getAllCities();
          setCities({
            isLoaded: true,
            data: cityResponse.data.data,
          });
        }

        // Fetch products
        const productResponse = await getProducts(1, 1000); // Adjust pagination as needed
        setProducts(productResponse.data.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cities.isLoaded]);

  // Function to group products by category (or other criteria) after filtering by location
  const getGroupedProducts = (allProducts, selectedLocation) => {
    if (!selectedLocation) return [];

    // Filter products by selected location
    const filteredProducts = allProducts.filter(product => product.cityID?._id === selectedLocation || product.cityID === selectedLocation);

    // Group filtered products by category (assuming products have a categoryID field)
    const grouped = filteredProducts.reduce((acc, product) => {
      const categoryName = product.categoryID?.englishName || 'Other';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push({
        value: product._id,
        label: product.englishTitle || product.urduTitle || 'Unnamed Product',
        data: product,
      });
      return acc;
    }, {});

    // Convert grouped object to react-select compatible format
    return Object.keys(grouped).map(category => ({
      label: category,
      options: grouped[category],
    }));
  };

  if (loading) return <Loader />;



  const closePaymentModal = () => {
    setIsPaymentModalVisible(false);
    setPaymentData({
      bank: '',
      payment: '',
      details: '',
      date: ''
    });
  };


  return (
    <div className='relative'>
      <Ledger />
      {(loading || isRefreshing) && <Loader />}
      <div className="flex justify-between items-center mt-3">
        {/* Conditionally render the Purchase heading */}
        {!selectedUser && (
          <h1 className="text-xl text-nowrap font-bold">Purchase</h1>
        )}

        <div className="flex gap-7">
          {!selectedUser && (
            <>
              <div className='flex bg-[#FFFFFF] rounded-xl ml-10 px-1'>
                <img src="/Search.svg" alt="search" className='' />
                <input
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onKeyPress={handleSearchKeyPress}
                  className='p-2 outline-none rounded-xl'
                  type="search"
                  name="search"
                  placeholder='Search by name'
                />
              </div>
              <select
                value={filterStatus}
                onChange={handleFilterChange}
                className='bg-[#FFFFFF] rounded-lg p-1'
              >
                <option value="all">View All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                className="bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded"
                onClick={addHandler}
              >
                + Add Company
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        {!selectedUser ? (
          // Sales Table View
          <table className="w-full border-separate border-spacing-y-4">
            <thead>
              <tr className="text-left text-gray-500">
                <td>Name</td>
                <td>ID</td>
                <td>Phone no</td>
                <td>Balance</td>
                <td>Last Payment</td>
                <td>Last Activity</td>
                <td>Active</td>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((item, index) => (
                <tr key={index} className="cursor-pointer">
                  <td className="flex items-center gap-2 p-2 rounded-l-lg bg-white">
                    <div className="w-8 h-8 rounded-full border-2 border-black text-black flex items-center justify-center font-bold">
                      {item.companyName ?
                        item.companyName
                          .split(' ')
                          .filter(word => word !== '&')
                          .map(word => word.charAt(0).toUpperCase())
                          .join('')
                        : "NA"}
                    </div>
                    <div>
                      <h1 className="font-bold">{item.companyName || "No Company Name"}</h1>
                    </div>
                  </td>

                  <td className="p-2 bg-white uppercase">#{item._id.slice(0, 6)}</td>
                  <td className="p-2 bg-white">{item.phone}</td>
                  <td className="p-2 bg-white">PKR {item.balance}</td>
                  <td className="p-2 bg-white">PKR {item.lastPayment}</td>
                  <td className="p-2 bg-white">{new Date(item.lastActivity).toLocaleDateString()}</td>
                  <td
                    className="p-2 text-2xl cursor-pointer bg-white"
                    onClick={() => statusToggleHandler(item)}
                  >
                    {item.isActive ? (
                      <PiToggleRightFill className="text-green-500" />
                    ) : (
                      <PiToggleLeftFill className="text-gray-400" />
                    )}
                  </td>
                  <td className="bg-[#FFFFFF] rounded-r-xl">
                    <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                      <div className="flex gap-5">
                        <FaRegEye onClick={() => setSelectedUser(item)} />
                        <button
                          className="flex"
                          onClick={() =>
                            setShowDropdown((prev) => (prev === item._id ? "" : item._id))
                          }
                        >
                          <HiDotsVertical />
                        </button>
                      </div>
                      {showDropdown === item._id && (
                        <ClickOutside onClick={() => setShowDropdown("")}>
                          <div
                            className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="dropdownButton"
                          >
                            <div
                              className="flex flex-col gap-2 justify-center items-start"
                              role="none"
                            >
                              <li
                                onClick={() => {
                                  editHandler(item);
                                  setShowDropdown("");
                                }}
                                className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2"
                              >
                                <button className="btn btn-light">Edit</button>
                              </li>
                              <li onClick={() => {
                                deleteHandler(item._id);
                                setShowDropdown("");
                              }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                                <button className="btn btn-light">Delete</button>
                              </li>
                            </div>
                          </div>
                        </ClickOutside>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

            </tbody>
          </table>
        ) : (
          // Transaction Details View
          <div className="w-full p-4">
            <div className="flex items-center mb-2">
              <button
                className="text-[#FF5934] mr-4 bg-gray-200 p-1 rounded-lg"
                onClick={handleBackToList}
              >
                <GrFormPrevious size={24} />
              </button>
              <div>
                <h2 className="text-xl font-bold">Purchase Details - {selectedUser.companyName}</h2>
                <p className="text-gray-600">
                  Total Balance:{""}
                  <span className="font-bold text-[#FF5934]">
                    PKR {selectedUser.balance}
                  </span>
                </p>
              </div>
            </div>

            {/* Tabs for Ledger and Invoice */}
            <div className="flex mb-4 space-x-4">
              <button
                className={`px-4 py-2 rounded-t-lg ${activeTab === 'ledger' ? 'bg-[#FF5934] text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                onClick={() => setActiveTab('ledger')}
              >
                Ledger
              </button>
              <button
                className={`px-4 py-2 rounded-t-lg ${activeTab === 'invoice' ? 'bg-[#FF5934] text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                onClick={() => setActiveTab('invoice')}
              >
                Invoice
              </button>
            </div>

            {/* Tab Content */}
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
                      startDate,
                      endDate,
                      type: 'purchase',
                    }}
                  >
                    <button className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg">
                      Report
                    </button>
                  </Link>
                  <button
                    className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                    onClick={() => setShowAddPayment(true)}
                  >
                    Add Payments
                  </button>
                  <button
                    className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                    onClick={() => setShowDirectPayment(true)}
                  >
                    Direct Payment
                  </button>
                  <button
                    onClick={() => setShowPurchase(true)}
                    className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg"
                  >
                    Purchase
                  </button>
                </div>

                <table className="w-full border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th>ID</th>
                      <th>Details</th>
                      <th>Dr.</th>
                      <th>Cr.</th>
                      <th>Date</th>
                      <th>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionData.slice().reverse().map((transaction, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 bg-white rounded-l-xl font-bold">
                          {transaction.id ? `#${transaction.id.toString().slice(0, 6).toUpperCase()}` : 'N/A'}
                        </td>
                        <td className="p-2 bg-white">{transaction.details}</td>
                        <td className="p-2 bg-white text-green-500 font-medium">
                          {transaction.dr !== '0' ? `PKR ${transaction.dr}` : '-'}
                        </td>
                        <td className="p-2 bg-white text-red-500 font-medium">
                          {transaction.cr !== '0' ? `PKR ${transaction.cr}` : '-'}
                        </td>
                        <td className="p-2 bg-white">{transaction.date}</td>
                        <td className="p-2 bg-white">PKR {transaction.balance}</td>
                        <td className="p-2 bg-white rounded-r-xl">
                          <div className="flex items-center space-x-3 pr-0">
                            <button
                              className="flex justify-center items-center bg-gray-100 text-[#FF5934] p-2 rounded-lg hover:bg-gray-200 transition duration-200"
                              onClick={() => onDownload(transaction)}
                              aria-label="Download"
                            >
                              <AiOutlineDownload size={20} />
                            </button>
                            <div className="relative">
                              <button
                                className="flex justify-center items-center p-1 hover:bg-gray-100 rounded-lg transition duration-200"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDropdown((prev) =>
                                    prev === transaction.id ? '' : transaction.id
                                  );
                                }}
                                aria-label="More options"
                              >
                                <HiDotsVertical size={20} className="text-gray-600" />
                              </button>
                              {showDropdown === transaction.id && (
                                <ClickOutside onClick={() => setShowDropdown('')}>
                                  <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5">
                                    <div className="flex flex-col gap-2 justify-center items-start">
                                      <button
                                        onClick={() => {
                                          setSelectedLedger(transaction);
                                          setShowEditLedger(true);
                                          setShowDropdown('');
                                        }}
                                        className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2 text-left"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDeleteLedger(transaction.id);
                                        }}
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
              </>
            ) : (
              // Invoice View with Real Data
              <div className="w-full">
                <div className="flex items-center justify-end gap-4 mb-6">
                  <Link
                    to="/reportpdf"
                    state={{
                      selectedUser,
                      allInvoices: invoices,
                      type: 'purchase',
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
                        <th className="p-2">Sr.</th>
                        <th className="p-2">Invoice ID</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Bilty No</th>
                        <th className="p-2">Vehicle No</th>
                        <th className="p-2">Items</th>
                        <th className="p-2">Freight</th>
                        <th className="p-2">Details</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="10" className="text-center p-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FF5934] mx-auto"></div>
                          </td>
                        </tr>
                      ) : invoices.length === 0 ? (
                        <tr>
                          <td colSpan="10" className="text-center p-4 bg-white rounded-lg">
                            No invoices found
                          </td>
                        </tr>
                      ) : (
                        invoices.map((invoice) => (
                          <tr key={invoice.id} className="bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors">
                            <td className="p-4 rounded-l-lg">{invoice.sr}</td>
                            <td className="p-4">
                              <div className="font-bold">#{invoice._id.slice(0, 6)}</div>
                              {/* <div className="text-sm text-gray-500">#{invoice._id}</div> */}
                            </td>
                            <td className="p-4">{invoice.date}</td>
                            <td className="p-4">{invoice.biltyNumber || '-'}</td>
                            <td className="p-4">{invoice.vehicleNumber || '-'}</td>
                            <td className="p-4">{invoice.items}</td>
                            <td className="p-4">PKR {invoice.freightAmount.toLocaleString()}</td>
                            <td className="p-4">{invoice.details || '-'}</td>
                            <td className="p-4 text-right pr-8">PKR {invoice.total.toLocaleString()}</td>
                            <td className="p-4 rounded-r-lg flex justify-end">
                              <button
                                className="flex items-center bg-gray-100 text-[#FF5934] p-2 rounded-lg hover:bg-gray-200 transition duration-200"
                                onClick={() => onDownloadInvoice(invoice)}
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
            )}
          </div>
        )}
      </div>


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

      {show && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[600px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Company</h2>
            </div>
            <Formik
              enableReinitialize
              initialValues={{
                companyName: state?.companyName || "",
                phone: state?.phone || "",
                address: state?.address || "",
                email: state?.email || "",
                accountNo: "",
                title: "",
                firstName: "",
                lastName: "",
                mobile: "",
                // secondaryPhone: "",
                website: "",
                billingAddress: "",
                city: "",
                province: "",
                postalCode: "",
                country: "",
                ntn: "",
                stn: "",
                cnic: "",
                bankName: "",
                accountName: "",
                accountNumber: "",
                iban: "",
                swiftCode: "",
                bankAddress: "",
              }}
              validationSchema={purchaseValidations}
              onSubmit={handleSubmit}
            >
              {({ values, handleChange, handleSubmit, setFieldTouched }) => (
                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                  <div className="px-6">
                    {/* Existing Fields with Backend */}
                    <Input
                      name="companyName"
                      label="Company Name"
                      placeholder="Company Name"
                      value={values.companyName}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />

                    {/* <Input
                      name="phone"
                      label="Phone"
                      placeholder="Phone"
                      value={values.phone}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    /> */}

                    <Input
                      name="address"
                      label="Address"
                      placeholder="Address"
                      value={values.address}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />

                    {/* New Fields Before Tabs */}
                    <Input
                      name="email"
                      label="Email"
                      placeholder="Email"
                      value={values.email}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <Input
                      name="accountNo"
                      label="Account No."
                      placeholder="Account No."
                      value={values.accountNo}
                      onChange={handleChange}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <div className="flex space-x-4 mt-2">
                      <Input
                        name="title"
                        label="Title"
                        placeholder="Title"
                        value={values.title}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                      <Input
                        name="firstName"
                        label="First Name"
                        placeholder="First Name"
                        value={values.firstName}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                    </div>
                    <div className="flex space-x-4 mt-2">
                      <Input
                        name="lastName"
                        label="Last Name"
                        placeholder="Last Name"
                        value={values.lastName}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                      <Input
                        name="mobile"
                        label="Mobile"
                        placeholder="Mobile"
                        value={values.mobile}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                    </div>
                    <div className="flex space-x-4 mt-2">
                      <Input
                        name="phone"
                        label="Phone"
                        placeholder="Phone"
                        value={values.phone}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                      <Input
                        name="website"
                        label="Website"
                        placeholder="Website"
                        value={values.website}
                        onChange={handleChange}
                        className="bg-[#EEF0F6] p-3 rounded w-[260px] border border-gray-300"
                      />
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex space-x-4 mt-4 border-b border-gray-300">
                      <button
                        type="button"
                        onClick={() => setActiveTab("address")}
                        className={`px-4 py-2 ${activeTab === "address" ? "bg-[#FF5934] text-white" : "text-gray-600"} rounded-t-lg`}
                      >
                        Address
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("taxInfo")}
                        className={`px-4 py-2 ${activeTab === "taxInfo" ? "bg-[#FF5934] text-white" : "text-gray-600"} rounded-t-lg`}
                      >
                        Tax Info
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("bank")}
                        className={`px-4 py-2 ${activeTab === "bank" ? "bg-[#FF5934] text-white" : "text-gray-600"} rounded-t-lg`}
                      >
                        Bank
                      </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-4">
                      {activeTab === "address" && (
                        <>
                          <Input
                            name="billingAddress"
                            label="Billing Address"
                            placeholder="Billing Address"
                            value={values.billingAddress}
                            onChange={handleChange}
                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-[517px] border border-gray-300"
                          />
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="city"
                              label="City"
                              placeholder="City"
                              value={values.city}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="province"
                              label="Province"
                              placeholder="Province"
                              value={values.province}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="postalCode"
                              label="Postal Code"
                              placeholder="Postal Code"
                              value={values.postalCode}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="country"
                              label="Country"
                              placeholder="Country"
                              value={values.country}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {activeTab === "taxInfo" && (
                        <>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="ntn"
                              label="NTN"
                              placeholder="NTN"
                              value={values.ntn}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="stn"
                              label="STN"
                              placeholder="STN"
                              value={values.stn}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="mt-2">
                            <Input
                              name="cnic"
                              label="CNIC"
                              placeholder="CNIC"
                              value={values.cnic}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[517px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {activeTab === "bank" && (
                        <>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="bankName"
                              label="Bank Name"
                              placeholder="Bank Name"
                              value={values.bankName}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="accountName"
                              label="Account Name"
                              placeholder="Account Name"
                              value={values.accountName}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="accountNumber"
                              label="Account Number"
                              placeholder="Account Number"
                              value={values.accountNumber}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="iban"
                              label="IBAN"
                              placeholder="IBAN"
                              value={values.iban}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="swiftCode"
                              label="Swift Code"
                              placeholder="Swift Code"
                              value={values.swiftCode}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="bankAddress"
                              label="Address"
                              placeholder="Address"
                              value={values.bankAddress}
                              onChange={handleChange}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={() => {
                        setImageLoading(false);
                        setShow(false);
                      }}
                      className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                    >
                      Cancel
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        // Check if CNIC is empty and switch to Tax Info tab if needed
                        if (!values.cnic) {
                          setActiveTab("taxInfo");
                          // Touch the CNIC field to trigger validation error
                          setFieldTouched('cnic', true, true);
                          toast.error("CNIC is required. Please check the Tax Info tab.");
                          return;
                        }
                        // Otherwise proceed with Formik's handleSubmit
                        handleSubmit(e);
                      }}
                      className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg"
                    >
                      Save
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      )}

      {showAddPayment && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg">
            <div className="border-b border-gray-300 px-4 py-3">
              <h2 className="text-xl font-bold">Add Payments</h2>
            </div>
            <Formik
              initialValues={{
                bank: "",
                amount: "",
                date: "",
                details: "", // New field
              }}
              validationSchema={paymentValidationSchema}
              onSubmit={handleAddPaymentSubmit}
            >
              {({ values, handleChange, errors, touched }) => (
                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                  <div className="px-6">
                    <label className="block text-sm font-medium text-gray-700 mt-4">
                      Select Bank
                    </label>
                    <select
                      name="bank"
                      value={values.bank}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.bank && touched.bank ? 'border-red-500' : 'border-gray-300'
                        }`}
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

                    {errors.bank && touched.bank && (
                      <div className="text-red-500 text-sm mt-1">{errors.bank}</div>
                    )}

                    <Input
                      name="amount"
                      label="Amount"
                      placeholder="Enter Amount"
                      value={values.amount}
                      onChange={handleChange}
                      className={'bg-[#EEF0F6] p-3 mt-2 rounded w-full border'}
                    />

                    {/* New Textarea for Details */}
                    <label htmlFor="details" className="block mt-2 text-gray-700 font-medium">
                      Details
                    </label>
                    <textarea
                      id="details"
                      name="details"
                      placeholder="Enter Payment Details"
                      value={values.details}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.details && touched.details ? 'border-red-500' : 'border-gray-300'
                        }`}
                      rows={4}
                    />
                    {errors.details && touched.details && (
                      <div className="text-red-500 text-sm mt-1">{errors.details}</div>
                    )}

                    <Input
                      type="date"
                      name="date"
                      label="Date"
                      placeholder="Select Date"
                      value={values.date}
                      onChange={handleChange}
                      max={new Date().toISOString().split("T")[0]}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.date && touched.date ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={() => setShowAddPayment(false)}
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


      {showDirectPayment && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Direct Payment</h2>
            </div>
            <Formik
              initialValues={{
                date: "",
                retailer: "",
                modeOfPayment: "",
                amount: "",
                details: "",
              }}
              validationSchema={directPaymentValidationSchema}
              onSubmit={handleAddDirectPaymentSubmit}
            >
              {({ values, handleChange, errors, touched }) => (
                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                  <div className="px-6">

                    {/* Date Field */}
                    <Input
                      type="date"
                      name="date"
                      label="Date"
                      placeholder="Select Date"
                      value={values.date}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.date && touched.date ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    {/* Select Retailer Field */}

                    <select
                      name="retailer"
                      value={values.retailer}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.retailer && touched.retailer ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="">Select Retailer</option>
                      {retailers.map((retailer) => (
                        <option key={retailer._id} value={retailer._id}>
                          {retailer.shopName}
                        </option>
                      ))}
                    </select>
                    {errors.retailer && touched.retailer && (
                      <div className="text-red-500 text-sm mt-1">{errors.retailer}</div>
                    )}

                    {/* Mode of Payment Field */}

                    <select
                      name="modeOfPayment"
                      value={values.modeOfPayment}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.modeOfPayment && touched.modeOfPayment ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="">Select Payment Mode</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                    </select>
                    {errors.modeOfPayment && touched.modeOfPayment && (
                      <div className="text-red-500 text-sm mt-1">{errors.modeOfPayment}</div>
                    )}

                    {/* Amount Field */}
                    <Input
                      name="amount"
                      label="Amount"
                      placeholder="Enter Amount"
                      value={values.amount}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    {/* Details Field */}
                    <label className="block text-sm font-medium text-gray-700 mt-4">Details</label>
                    <textarea
                      name="details"
                      value={values.details}
                      onChange={handleChange}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.details && touched.details ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Enter payment details"
                    />
                    {errors.details && touched.details && (
                      <div className="text-red-500 text-sm mt-1">{errors.details}</div>
                    )}

                  </div>

                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={() => setShowDirectPayment(false)}
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
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />

                    <Input
                      type="date"
                      name="date"
                      label="Date"
                      placeholder="Select Date"
                      value={values.date}
                      onChange={handleChange}
                      max={new Date().toISOString().split("T")[0]}
                      className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.date && touched.date ? 'border-red-500' : 'border-gray-300'
                        }`}
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

{showPurchase && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[900px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Purchase</h2>
            </div>
            <Formik
              initialValues={{
                biltyNumber: '',
                vehicleNumber: '',
                freightAmount: '',
                date: '',
                details: '',
                location: '',
                items: [{
                  product: '',
                  purchaseRate: '',
                  purchaseDiscount: '',
                  quantity: '',
                  amount: 0,
                  discountAmount: 0,
                }],
                totalAmount: 0,
                discountAmount: 0,
                payable: 0,
              }}
              validationSchema={purchaseValidationSchema}
              onSubmit={handlePurchaseSubmit}
            >
              {({ values, handleChange, errors, touched, setFieldValue }) => {
                // Dynamically filter grouped products based on selected location
                const groupedProducts = getGroupedProducts(products, values.location);

                return (
                  <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                    <div className="px-6">
                      <Input
                        name="biltyNumber"
                        label="Bilty Number"
                        placeholder="Enter Bilty Number"
                        value={values.biltyNumber}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.biltyNumber && touched.biltyNumber ? 'border-red-500' : 'border-gray-300'}`}
                      />

                      <Input
                        name="vehicleNumber"
                        label="Vehicle Number"
                        placeholder="Enter Vehicle Number"
                        value={values.vehicleNumber}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.vehicleNumber && touched.vehicleNumber ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <Input
                        name="freightAmount"
                        label="Freight Amount"
                        placeholder="Enter Freight Amount"
                        value={values.freightAmount}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.freightAmount && touched.freightAmount ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <Input
                        type="date"
                        name="date"
                        label="Date"
                        placeholder="Select Date"
                        value={values.date}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.date && touched.date ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <label htmlFor="details" className="block mt-2 text-gray-700 font-medium">
                        Details
                      </label>
                      <textarea
                        id="details"
                        name="details"
                        placeholder="Enter Payment Details"
                        value={values.details}
                        onChange={handleChange}
                        className={`bg-[#EEF0F6] p-3 mt-2 rounded w-full border ${errors.details && touched.details ? 'border-red-500' : 'border-gray-300'}`}
                        rows={4}
                      />

                      {/* Full-width Location Dropdown */}
                      <div className="mt-4 w-full">
                        <label className="block text-sm font-medium text-gray-700">Select Location</label>
                        <select
                          name="location"
                          value={values.location}
                          onChange={(e) => {
                            handleChange(e);
                            setFieldValue('items', [{
                              product: '',
                              purchaseRate: '',
                              purchaseDiscount: '',
                              quantity: '',
                              amount: 0,
                              discountAmount: 0,
                            }]); // Reset items when location changes
                          }}
                          className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                        >
                          <option value="">Select Location</option>
                          {cities.isLoaded && cities.data && cities.data.map((city) => (
                            <option key={city._id} value={city._id || city.name}>
                              {city.name || city._id}
                            </option>
                          ))}
                        </select>
                        {errors.location && touched.location && (
                          <div className="text-red-500 text-sm mt-1">{errors.location}</div>
                        )}
                      </div>

                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">Products</label>
                        <FieldArray name="items">
                          {({ push, remove }) => (
                            <div className="bg-gray-50 p-4 rounded-lg border-t border-b">
                              {/* Headers */}
                              <div className="grid grid-cols-5 gap-4 mb-2">
                                <div className="text-sm font-medium text-gray-700 ml-4">Select Product</div>
                                <div className="text-sm font-medium text-gray-700 ml-2">Purchase Rate</div>
                                <div className="text-sm font-medium text-gray-700 ml-2">Purchase Discount</div>
                                <div className="text-sm font-medium text-gray-700">Quantity</div>
                                <div className="text-sm font-medium text-gray-700">Amount</div>
                              </div>

                              {values.items.map((item, index) => (
                                <div key={index} className="mt-3 p-4 border-b border-gray-300">
                                  <div className="grid grid-cols-5 gap-2">
                                    {/* Searchable Product Dropdown with location filter */}
                                    <div className="relative">
                                      <GroupedSelect
                                        options={groupedProducts}
                                        value={item.product ? {
                                          value: item.product,
                                          label: products.find(p => p._id === item.product)?.englishTitle ||
                                            products.find(p => p._id === item.product)?.urduTitle ||
                                            'Unnamed Product',
                                          data: products.find(p => p._id === item.product),
                                        } : null}
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
                                        placeholder="Select a product..."
                                        className="w-full"
                                        error={touched.items?.[index]?.product && errors.items?.[index]?.product}
                                      />
                                      {touched.items?.[index]?.product && errors.items?.[index]?.product && (
                                        <div className="text-red-500 text-sm mt-1">{errors.items[index].product}</div>
                                      )}
                                    </div>

                                    <Field
                                      type="number"
                                      name={`items.${index}.purchaseRate`}
                                      value={item.purchaseRate}
                                      onChange={(e) => {
                                        handleChange(e);
                                        const quantity = Number(values.items[index].quantity) || 0;
                                        const rate = Number(e.target.value) || 0;
                                        const purchaseDiscount = Number(values.items[index].purchaseDiscount) || 0;
                                        const baseAmount = rate * quantity;
                                        const discountAmount = (baseAmount * purchaseDiscount) / 100;
                                        const newAmount = baseAmount - discountAmount;

                                        setFieldValue(`items.${index}.amount`, newAmount);
                                        setFieldValue(`items.${index}.discountAmount`, discountAmount);

                                        // Calculate total amount and total discount
                                        const totals = values.items.reduce((acc, item, i) => {
                                          const itemDiscountAmount = i === index ? discountAmount : (item.discountAmount || 0);
                                          const itemAmount = i === index ? newAmount : (item.amount || 0);
                                          return {
                                            totalAmount: acc.totalAmount + itemAmount,
                                            totalDiscount: acc.totalDiscount + itemDiscountAmount,
                                          };
                                        }, { totalAmount: 0, totalDiscount: 0 });

                                        setFieldValue('totalAmount', totals.totalAmount);
                                        setFieldValue('discountAmount', totals.totalDiscount);
                                        setFieldValue('payable', totals.totalAmount);
                                      }}
                                      className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                    />

                                    <Field
                                      type="number"
                                      name={`items.${index}.purchaseDiscount`}
                                      value={item.purchaseDiscount}
                                      onChange={(e) => {
                                        handleChange(e);
                                        const quantity = Number(values.items[index].quantity) || 0;
                                        const rate = Number(values.items[index].purchaseRate) || 0;
                                        const purchaseDiscount = Number(e.target.value) || 0;
                                        const baseAmount = rate * quantity;
                                        const discountAmount = (baseAmount * purchaseDiscount) / 100;
                                        const newAmount = baseAmount - discountAmount;

                                        setFieldValue(`items.${index}.amount`, newAmount);
                                        setFieldValue(`items.${index}.discountAmount`, discountAmount);

                                        // Calculate total amount and total discount
                                        const totals = values.items.reduce((acc, item, i) => {
                                          const itemDiscountAmount = i === index ? discountAmount : (item.discountAmount || 0);
                                          const itemAmount = i === index ? newAmount : (item.amount || 0);
                                          return {
                                            totalAmount: acc.totalAmount + itemAmount,
                                            totalDiscount: acc.totalDiscount + itemDiscountAmount,
                                          };
                                        }, { totalAmount: 0, totalDiscount: 0 });

                                        setFieldValue('totalAmount', totals.totalAmount);
                                        setFieldValue('discountAmount', totals.totalDiscount);
                                        setFieldValue('payable', totals.totalAmount);
                                      }}
                                      className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                      placeholder="%"
                                    />

                                    <Field
                                      type="number"
                                      name={`items.${index}.quantity`}
                                      value={item.quantity}
                                      onChange={(e) => {
                                        handleChange(e);
                                        const quantity = Number(e.target.value) || 0;
                                        const rate = Number(values.items[index].purchaseRate) || 0;
                                        const purchaseDiscount = Number(values.items[index].purchaseDiscount) || 0;
                                        const baseAmount = rate * quantity;
                                        const discountAmount = (baseAmount * purchaseDiscount) / 100;
                                        const newAmount = baseAmount - discountAmount;

                                        setFieldValue(`items.${index}.amount`, newAmount);
                                        setFieldValue(`items.${index}.discountAmount`, discountAmount);

                                        // Calculate total amount and total discount
                                        const totals = values.items.reduce((acc, item, i) => {
                                          const itemDiscountAmount = i === index ? discountAmount : (item.discountAmount || 0);
                                          const itemAmount = i === index ? newAmount : (item.amount || 0);
                                          return {
                                            totalAmount: acc.totalAmount + itemAmount,
                                            totalDiscount: acc.totalDiscount + itemDiscountAmount,
                                          };
                                        }, { totalAmount: 0, totalDiscount: 0 });

                                        setFieldValue('totalAmount', totals.totalAmount);
                                        setFieldValue('discountAmount', totals.totalDiscount);
                                        setFieldValue('payable', totals.totalAmount);
                                      }}
                                      className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                    />

                                    <div className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300">
                                      {item.amount.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => push({
                                  product: '',
                                  purchaseRate: '',
                                  purchaseDiscount: '',
                                  quantity: '',
                                  amount: 0,
                                  discountAmount: 0,
                                })}
                                className="mt-4 flex items-center gap-2 text-[#FF5934] hover:text-[#ff4a20]"
                              >
                                <FaPlus size={16} />
                                <span>Add Product</span>
                              </button>
                            </div>
                          )}
                        </FieldArray>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Discount Amount</label>
                            <div className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300">
                              {values.discountAmount.toFixed(2)}
                            </div>
                          </div>

                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700">Payable Amount</label>
                            <div className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300">
                              {values.payable.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xl font-bold mt-4">Total Amount: {values.totalAmount.toFixed(2)}</div>
                    </div>

                    <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                      <div
                        onClick={() => setShowPurchase(false)}
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
                );
              }}
            </Formik>
          </div>
        </div>
      )}

      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          transaction={selectedTransaction}
          onClose={() => setShowReceiptModal(false)}
          type="purchase"
        />
      )}

    </div>
  )
}

export default Purchase
