import { useEffect, useMemo, useState } from 'react';
import {
  getAllPurchases, getLedgerById, getInvoicesByPurchaseId,
  addPurchaseLedger, getAllCities, getDatas,
} from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaPlus, FaTrash } from 'react-icons/fa';
import { Form, Formik, FieldArray, Field } from "formik";
import * as yup from "yup";
import GroupedSelect from '../components/common/GroupedSelect';
import {
  MdSearch, MdFilterList, MdClose, MdBusiness, MdRefresh,
  MdAddCircleOutline, MdLocalShipping, MdWarehouse,
} from "react-icons/md";

const LIMIT = 10;
const DASH = '-';

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";
const labelCls = "block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5";

const INITIAL_PURCHASE_FORM = {
  supplier: '',
  address: '',
  billNo: '',
  date: '',
  termDays: '',
  dueDate: '',
  vehicleNumber: '',
  biltyNumber: '',
  transportDetails: '',
  freightAmount: '',
  location: '',
  details: '',
  items: [{ product: '', purchaseRate: '', purchaseDiscount: '', quantity: '', amount: 0, discountAmount: 0 }],
  totalAmount: 0,
  discountAmount: 0,
  payable: 0,
};

const emptyLineItem = () => ({
  product: '',
  purchaseRate: '',
  purchaseDiscount: '',
  quantity: '',
  amount: 0,
  discountAmount: 0,
});

const extractList = (res) => {
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.ledgers)) return res.ledgers;
  if (Array.isArray(res?.invoices)) return res.invoices;
  if (Array.isArray(res)) return res;
  return [];
};

const formatPKR = (value) => {
  const number = Number(value || 0);
  return `PKR ${number.toLocaleString('en-PK')}`;
};

const formatMoneyValue = (value) => {
  if (value === null || value === undefined) {
    return <span className="text-[#D1D5DB] text-[11px]">{DASH}</span>;
  }
  return formatPKR(value);
};

const formatNumberValue = (value) => {
  if (value === null || value === undefined) {
    return <span className="text-[#D1D5DB] text-[11px]">{DASH}</span>;
  }
  return value;
};

const getCompanyInitials = (name = '') => {
  const initials = name
    .split(' ')
    .filter((word) => word && word !== '&')
    .map((word) => word[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  return initials || 'NA';
};

const filterPurchases = (data, term, status) => {
  let result = data;

  if (status === 'active') result = result.filter((purchase) => purchase.isActive);
  if (status === 'inactive') result = result.filter((purchase) => !purchase.isActive);

  if (term.trim()) {
    const value = term.toLowerCase();
    result = result.filter((purchase) =>
      purchase.companyName?.toLowerCase().includes(value) ||
      purchase.phone?.toLowerCase().includes(value) ||
      purchase.address?.toLowerCase().includes(value)
    );
  }

  return result;
};

const calculateLineTotals = (item) => {
  const rate = Number(item.purchaseRate) || 0;
  const quantity = Number(item.quantity) || 0;
  const discount = Number(item.purchaseDiscount) || 0;
  const baseAmount = rate * quantity;
  const discountAmount = (baseAmount * discount) / 100;
  const amount = Math.max(baseAmount - discountAmount, 0);

  return { amount, discountAmount };
};

const calculateTotals = (items) => {
  return items.reduce((acc, item) => {
    const line = calculateLineTotals(item);
    return {
      totalAmount: acc.totalAmount + line.amount,
      totalDiscount: acc.totalDiscount + line.discountAmount,
    };
  }, { totalAmount: 0, totalDiscount: 0 });
};

const syncLineAndTotals = (items, index, patch, setFieldValue) => {
  const updatedItems = items.map((item, itemIndex) =>
    itemIndex === index ? { ...item, ...patch } : item
  );
  const lineTotals = calculateLineTotals(updatedItems[index]);
  const totals = calculateTotals(updatedItems);

  setFieldValue(`items.${index}.amount`, lineTotals.amount);
  setFieldValue(`items.${index}.discountAmount`, lineTotals.discountAmount);
  setFieldValue('totalAmount', totals.totalAmount);
  setFieldValue('discountAmount', totals.totalDiscount);
  setFieldValue('payable', totals.totalAmount);
};

const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 whitespace-nowrap
    ${active
      ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
      : 'bg-gray-50 text-gray-400 ring-gray-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const PaginationBar = ({ page, totalPages, onPrev, onNext }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
    <p className="text-[12px] text-[#9CA3AF]">
      Page {page} of {totalPages || 1}
    </p>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={page === 1}
        onClick={onPrev}
        aria-label="Previous page"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <GrFormPrevious size={16} />
      </button>
      <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
        <span className="font-semibold text-[#FF5934]">{page}</span>
        <span className="text-gray-300 mx-1">/</span>
        <span className="text-[#374151]">{totalPages || 1}</span>
      </div>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={onNext}
        aria-label="Next page"
        className="flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        <GrFormNext size={16} />
      </button>
    </div>
  </div>
);

const Shimmer = () => <span className="pur-shimmer" />;

const EmptyState = () => (
  <div className="py-16 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <MdBusiness size={24} className="text-gray-300" />
      </div>
      <p className="text-[#9CA3AF] text-sm font-medium">No companies found</p>
    </div>
  </div>
);

const CompanyIdentity = ({ item, compact = false }) => (
  <div className="flex items-center gap-3 min-w-0">
    <div className={`${compact ? 'w-10 h-10' : 'w-9 h-9'} rounded-full bg-gradient-to-br from-[#FF5934] to-[#ff8c6b] text-white flex items-center justify-center font-bold text-[12px] flex-shrink-0 shadow-sm`}>
      {getCompanyInitials(item.companyName)}
    </div>
    <div className="min-w-0">
      <p className={`${compact ? 'text-[14px]' : 'text-[13px]'} font-semibold text-[#111827] truncate`}>
        {item.companyName || DASH}
      </p>
      {item.email && <p className="text-[11px] text-[#9CA3AF] truncate">{item.email}</p>}
    </div>
  </div>
);

const MobileInfo = ({ label, value, tone = 'default' }) => {
  const toneClass = tone === 'green'
    ? 'text-emerald-600'
    : tone === 'red'
      ? 'text-red-500'
      : tone === 'orange'
        ? 'text-[#FF5934]'
        : 'text-[#111827]';

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
      <div className={`text-[13px] font-semibold break-words ${toneClass}`}>{value}</div>
    </div>
  );
};

const PurchaseMobileCard = ({ item }) => {
  const isLoading = item._totalDr === null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <CompanyIdentity item={item} compact />
        <StatusBadge active={item.isActive} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MobileInfo label="ID" value={`#${item._id?.slice(0, 6) || DASH}`} />
        <MobileInfo label="Phone" value={item.phone || DASH} />
        <MobileInfo label="Balance" value={formatPKR(item.balance)} />
        <MobileInfo label="Last Payment" value={formatPKR(item.lastPayment)} />
        <MobileInfo label="Total Dr." value={isLoading ? <Shimmer /> : formatMoneyValue(item._totalDr)} tone="green" />
        <MobileInfo label="Total Cr." value={isLoading ? <Shimmer /> : formatMoneyValue(item._totalCr)} tone="red" />
        <MobileInfo label="Last Transaction" value={isLoading ? <Shimmer /> : (item._lastTransaction || DASH)} />
        <MobileInfo label="Invoices" value={isLoading ? <Shimmer /> : formatNumberValue(item._invoiceCount)} tone="orange" />
      </div>

      <div className="mt-3 border-t border-gray-100 pt-3">
        <MobileInfo label="Address" value={item.address || DASH} />
      </div>
    </div>
  );
};

const safeFetchLedger = async (companyId) => {
  try {
    const ledgers = extractList(await getLedgerById(companyId));
    let totalDr = 0;
    let totalCr = 0;

    ledgers.forEach((ledger) => {
      const amount = Number(ledger.amount || 0);
      if (ledger.type === 'PAYMENT') totalDr += amount;
      else totalCr += amount;
    });

    const dates = ledgers
      .map((ledger) => (ledger.date ? new Date(ledger.date) : null))
      .filter((date) => date && !Number.isNaN(date.getTime()));

    return {
      totalDr,
      totalCr,
      lastTransaction: dates.length
        ? new Date(Math.max(...dates)).toLocaleDateString('en-GB')
        : DASH,
    };
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.warn(`Ledger fetch warning for ${companyId}:`, err?.response?.status || err.message);
    }
    return { totalDr: 0, totalCr: 0, lastTransaction: DASH };
  }
};

const safeFetchInvoices = async (companyId) => {
  try {
    return extractList(await getInvoicesByPurchaseId(companyId)).length;
  } catch (err) {
    if (err?.response?.status !== 404) {
      console.warn(`Invoice fetch warning for ${companyId}:`, err?.response?.status || err.message);
    }
    return 0;
  }
};

const safeFetchProductsByCity = async (cityId) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('page', 1);
    queryParams.append('limit', 500);
    if (cityId) queryParams.append('city', cityId);
    return extractList(await getDatas(`/product/search?${queryParams.toString()}`));
  } catch (err) {
    console.warn('Products fetch failed:', err?.response?.status || err.message);
    return [];
  }
};

const safeFetchCities = async () => {
  try {
    return extractList(await getAllCities());
  } catch (err) {
    console.warn('Cities fetch failed:', err?.response?.status || err.message);
    return [];
  }
};

const Purchases = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cities, setCities] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const schema = useMemo(() => yup.object().shape({
    supplier: yup.string().required('Supplier is required'),
    billNo: yup.string().required('Bill No is required'),
    date: yup.string().required('Date is required'),
    location: yup.string().required('Warehouse is required'),
    items: yup.array().of(yup.object().shape({
      product: yup.string().required('Product is required'),
      purchaseRate: yup.number().required('Rate is required').min(0),
      quantity: yup.number().required('Quantity is required').min(1),
    })).min(1),
  }), []);

  const groupedProducts = useMemo(() => {
    if (!products.length) return [];

    const grouped = products.reduce((acc, product) => {
      const category =
        product.categoryID?.englishName ||
        product.category?.englishName ||
        product.category?.name ||
        product.categoryName ||
        'General';

      if (!acc[category]) acc[category] = [];
      acc[category].push({
        value: product._id,
        label: product.englishTitle || product.urduTitle || product.name || 'Unnamed',
        data: product,
      });
      return acc;
    }, {});

    return Object.keys(grouped).map((category) => ({
      label: category,
      options: grouped[category],
    }));
  }, [products]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const companies = extractList(await getAllPurchases());
      setSuppliers(companies);

      if (!companies.length) {
        setRows([]);
        setFilteredRows([]);
        setTotalPages(1);
        return;
      }

      const seeded = companies.map((company) => ({
        ...company,
        _totalDr: null,
        _totalCr: null,
        _lastTransaction: null,
        _invoiceCount: null,
      }));

      setRows(seeded);
      setFilteredRows(filterPurchases(seeded, searchTerm, filterStatus));
      setTotalPages(Math.ceil(seeded.length / LIMIT) || 1);
      setLoading(false);

      setFetchingDetails(true);
      const enriched = await Promise.all(
        companies.map(async (company) => {
          const [ledger, invoiceCount] = await Promise.all([
            safeFetchLedger(company._id),
            safeFetchInvoices(company._id),
          ]);

          return {
            ...company,
            _totalDr: ledger.totalDr,
            _totalCr: ledger.totalCr,
            _lastTransaction: ledger.lastTransaction,
            _invoiceCount: invoiceCount,
          };
        })
      );

      const nextRows = filterPurchases(enriched, searchTerm, filterStatus);
      setRows(enriched);
      setFilteredRows(nextRows);
      setTotalPages(Math.ceil(nextRows.length / LIMIT) || 1);
    } catch (err) {
      toast.error('Failed to load purchases');
      console.error('fetchAll error:', err);
      setRows([]);
      setFilteredRows([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setFetchingDetails(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const result = filterPurchases(rows, searchTerm, filterStatus);
    setFilteredRows(result);
    setTotalPages(Math.ceil(result.length / LIMIT) || 1);
    setCurrentPage(1);
  }, [searchTerm, filterStatus, rows]);

  const openModal = async () => {
    setShowModal(true);
    setProducts([]);

    try {
      setModalLoading(true);
      const cityList = await safeFetchCities();
      setCities(cityList);
      if (!cityList.length) toast.warn('No warehouses/cities found');
    } catch (err) {
      console.error('openModal error:', err);
      toast.error('Failed to load warehouses');
    } finally {
      setModalLoading(false);
    }
  };

  const handleWarehouseChange = async (cityId, setFieldValue) => {
    setFieldValue('location', cityId);
    setFieldValue('items', [emptyLineItem()]);
    setFieldValue('totalAmount', 0);
    setFieldValue('discountAmount', 0);
    setFieldValue('payable', 0);
    setProducts([]);

    if (!cityId) return;

    try {
      setProductsLoading(true);
      const productList = await safeFetchProductsByCity(cityId);
      setProducts(productList);
      if (!productList.length) toast.warn('No products found for this warehouse');
    } catch (err) {
      console.error('handleWarehouseChange error:', err);
      toast.error('Failed to load products for this warehouse');
    } finally {
      setProductsLoading(false);
    }
  };

  const calcDueDate = (date, termDays) => {
    if (!date || !termDays) return '';
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + Number(termDays));
    return nextDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (values, { resetForm, setSubmitting }) => {
    try {
      setModalLoading(true);

      if (values.items.some((item) => !item.product)) {
        toast.error('Select a product for all rows');
        return;
      }

      const payload = {
        billNo: values.billNo,
        biltyNumber: values.biltyNumber,
        vehicleNumber: values.vehicleNumber,
        transportDetails: values.transportDetails,
        date: values.date,
        termDays: values.termDays ? Number(values.termDays) : undefined,
        dueDate: values.dueDate,
        freightAmount: Number(values.freightAmount || 0),
        details: values.details,
        items: values.items.map((item) => {
          const lineTotals = calculateLineTotals(item);
          return {
            product: item.product,
            quantity: Number(item.quantity) || 0,
            purchaseRate: Number(item.purchaseRate) || 0,
            purchaseDiscount: Number(item.purchaseDiscount) || 0,
            salesRate: Number(item.purchaseRate) || 0,
            salesDiscount: Number(item.purchaseDiscount) || 0,
            amount: lineTotals.amount,
          };
        }),
      };

      const res = await addPurchaseLedger(values.supplier, payload);

      if (res?.success) {
        toast.success('Purchase added successfully');
        resetForm();
        setShowModal(false);
        fetchAll();
      } else {
        toast.error(res?.msg || 'Failed to add purchase');
      }
    } catch (err) {
      toast.error(err.response?.data?.msg || err.message || 'Failed to add purchase');
    } finally {
      setModalLoading(false);
      setSubmitting(false);
    }
  };

  const start = (currentPage - 1) * LIMIT;
  const paginatedRows = filteredRows.slice(start, start + LIMIT);

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .pur-page { font-family: 'DM Sans','Segoe UI',sans-serif; }
        .pur-page .trow { transition: background 0.15s, box-shadow 0.15s; }
        .pur-page .trow:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .pur-sel {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .pur-shimmer {
          background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px; display: inline-block; height: 13px; width: 64px;
        }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes purModalIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:none} }
        @keyframes purOverlay { from{opacity:0} to{opacity:1} }
        .pur-overlay { animation: purOverlay 0.2s ease; }
        .pur-modal { animation: purModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .pur-scroll::-webkit-scrollbar { display: none; }
        .pur-scroll { scrollbar-width: none; }
        .sec-label {
          font-size: 10px; font-weight: 700; color: #FF5934;
          text-transform: uppercase; letter-spacing: .1em;
          display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
        }
        .sec-label::after { content:''; flex:1; height:1px; background:#FFE0D8; }
      `}</style>

      <div className="pur-page px-3 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Purchases</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              {filteredRows.length} companies
              {fetchingDetails && (
                <span className="block sm:inline sm:ml-2 text-[#FF5934] text-[11px] font-semibold animate-pulse">
                  Loading details...
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading || fetchingDetails}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-[#374151] text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <MdRefresh size={16} className="text-[#FF5934]" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openModal}
              className="flex items-center justify-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold px-3 sm:px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all"
            >
              <MdAddCircleOutline size={17} />
              Add Purchase
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-0">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full min-w-0"
              type="search"
              placeholder="Search by name, phone, address..."
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-[#9CA3AF] hover:text-[#FF5934] flex-shrink-0"
                aria-label="Clear search"
              >
                <MdClose size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 w-full sm:w-auto">
            <MdFilterList size={16} className="text-[#9CA3AF] flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="pur-sel bg-transparent outline-none text-sm text-[#374151] w-full sm:min-w-[120px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="hidden md:block bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                  {['Company', 'ID', 'Phone', 'Address', 'Balance', 'Last Payment', 'Total Dr.', 'Total Cr.', 'Last Transaction', 'Invoices', 'Status'].map((heading) => (
                    <th key={heading} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3 whitespace-nowrap">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={11}>
                      <EmptyState />
                    </td>
                  </tr>
                ) : paginatedRows.map((item, index) => {
                  const isLoading = item._totalDr === null;

                  return (
                    <tr key={item._id || index} className="trow">
                      <td className="px-4 py-3">
                        <CompanyIdentity item={item} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                          #{item._id?.slice(0, 6) || DASH}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{item.phone || DASH}</td>
                      <td className="px-4 py-3 max-w-[140px]">
                        <p className="text-[13px] text-[#374151] truncate">{item.address || DASH}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-semibold text-[#111827]">{formatPKR(item.balance)}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#374151] whitespace-nowrap">{formatPKR(item.lastPayment)}</td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[13px] font-semibold text-emerald-600">{formatMoneyValue(item._totalDr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[13px] font-semibold text-red-500">{formatMoneyValue(item._totalCr)}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? <Shimmer /> : <span className="text-[12px] text-[#6B7280]">{item._lastTransaction || DASH}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isLoading ? (
                          <Shimmer />
                        ) : (
                          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-orange-50 border border-orange-100 text-[11px] font-bold text-[#FF5934]">
                            {formatNumberValue(item._invoiceCount)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={item.isActive} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {paginatedRows.length === 0 ? <EmptyState /> : paginatedRows.map((item, index) => (
            <PurchaseMobileCard key={item._id || index} item={item} />
          ))}
        </div>

        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          onPrev={() => setCurrentPage((page) => Math.max(page - 1, 1))}
          onNext={() => setCurrentPage((page) => Math.min(page + 1, totalPages || 1))}
        />

        {showModal && (
          <div className="pur-overlay fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-3 sm:px-4 py-3 sm:py-6">
            <div className="pur-modal bg-white w-full max-w-[1040px] max-h-[calc(100vh-24px)] sm:max-h-[94vh] overflow-hidden rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col">
              <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-4 sm:px-6 pt-5 pb-7 relative overflow-hidden flex-shrink-0">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">New Entry</p>
                    <h2 className="text-white text-xl font-bold">Add Purchase</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0"
                    aria-label="Close purchase modal"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              {modalLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#9CA3AF]">Loading warehouses...</p>
                </div>
              ) : (
                <Formik
                  initialValues={INITIAL_PURCHASE_FORM}
                  validationSchema={schema}
                  onSubmit={handleSubmit}
                >
                  {({ values, handleChange, errors, touched, setFieldValue }) => (
                    <Form className="pur-scroll overflow-y-auto flex-1 flex flex-col">
                      <div className="px-4 sm:px-6 py-5 flex flex-col gap-5">
                        <section>
                          <p className="sec-label">Purchase Info</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            <div>
                              <label className={labelCls}>
                                Supplier <span className="text-[#FF5934]">*</span>
                              </label>
                              <select
                                name="supplier"
                                value={values.supplier}
                                onChange={(event) => {
                                  handleChange(event);
                                  const supplier = suppliers.find((item) => item._id === event.target.value);
                                  setFieldValue('address', supplier?.address || '');
                                }}
                                className={`${inputCls} pur-sel ${errors.supplier && touched.supplier ? 'border-red-400' : ''}`}
                              >
                                <option value="">Select Supplier...</option>
                                {suppliers.map((supplier) => (
                                  <option key={supplier._id} value={supplier._id}>
                                    {supplier.companyName}
                                  </option>
                                ))}
                              </select>
                              {errors.supplier && touched.supplier && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.supplier}</p>
                              )}
                            </div>

                            <div className="sm:col-span-2">
                              <label className={labelCls}>Address</label>
                              <input name="address" placeholder="Address" value={values.address} onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                              <label className={labelCls}>
                                Bill No <span className="text-[#FF5934]">*</span>
                              </label>
                              <input
                                name="billNo"
                                placeholder="Bill No"
                                value={values.billNo}
                                onChange={handleChange}
                                className={`${inputCls} ${errors.billNo && touched.billNo ? 'border-red-400' : ''}`}
                              />
                              {errors.billNo && touched.billNo && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.billNo}</p>
                              )}
                            </div>

                            <div>
                              <label className={labelCls}>
                                Date <span className="text-[#FF5934]">*</span>
                              </label>
                              <input
                                type="date"
                                name="date"
                                value={values.date}
                                onChange={(event) => {
                                  handleChange(event);
                                  if (values.termDays) setFieldValue('dueDate', calcDueDate(event.target.value, values.termDays));
                                }}
                                max={new Date().toISOString().split('T')[0]}
                                className={`${inputCls} ${errors.date && touched.date ? 'border-red-400' : ''}`}
                              />
                              {errors.date && touched.date && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.date}</p>
                              )}
                            </div>

                            <div>
                              <label className={labelCls}>Term Days</label>
                              <input
                                type="number"
                                name="termDays"
                                placeholder="e.g. 30"
                                value={values.termDays}
                                onChange={(event) => {
                                  handleChange(event);
                                  if (values.date) setFieldValue('dueDate', calcDueDate(values.date, event.target.value));
                                }}
                                className={inputCls}
                                min="0"
                              />
                            </div>

                            <div>
                              <label className={labelCls}>
                                Due Date
                                <span className="ml-1 text-[9px] font-normal normal-case tracking-normal text-[#9CA3AF]">auto from term days</span>
                              </label>
                              <input type="date" name="dueDate" value={values.dueDate} onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                              <label className={labelCls}>Vehicle Number</label>
                              <input name="vehicleNumber" placeholder="Vehicle Number" value={values.vehicleNumber} onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                              <label className={labelCls}>Bilty Number</label>
                              <input name="biltyNumber" placeholder="Bilty Number" value={values.biltyNumber} onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                              <label className={labelCls}>Freight Amount</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF] font-semibold pointer-events-none">PKR</span>
                                <input name="freightAmount" placeholder="0.00" value={values.freightAmount} onChange={handleChange} className={`${inputCls} pl-12`} />
                              </div>
                            </div>

                            <div className="sm:col-span-2">
                              <label className={labelCls}>Transport Details</label>
                              <input name="transportDetails" placeholder="Transport Details" value={values.transportDetails} onChange={handleChange} className={inputCls} />
                            </div>

                            <div>
                              <label className={labelCls}>
                                <span className="flex items-center gap-1.5">
                                  <MdWarehouse size={12} className="text-[#FF5934]" />
                                  Location / Warehouse <span className="text-[#FF5934]">*</span>
                                </span>
                              </label>
                              <select
                                name="location"
                                value={values.location}
                                onChange={(event) => handleWarehouseChange(event.target.value, setFieldValue)}
                                className={`${inputCls} pur-sel ${errors.location && touched.location ? 'border-red-400' : ''}`}
                              >
                                <option value="">
                                  {cities.length === 0 ? 'No warehouses available' : 'Select Warehouse...'}
                                </option>
                                {cities.map((city) => (
                                  <option key={city._id} value={city._id}>
                                    {city.name}{city.address ? ` - ${city.address}` : ''}
                                  </option>
                                ))}
                              </select>

                              {errors.location && touched.location && (
                                <p className="text-red-500 text-[11px] mt-1">{errors.location}</p>
                              )}
                              {cities.length === 0 && (
                                <p className="text-[10px] text-red-400 mt-1">No warehouses loaded. Check your Cities API.</p>
                              )}
                              {cities.length > 0 && !values.location && (
                                <p className="text-[10px] text-[#9CA3AF] mt-1">
                                  {cities.length} warehouse{cities.length !== 1 ? 's' : ''} available. Select one to load products.
                                </p>
                              )}
                              {values.location && productsLoading && (
                                <p className="text-[10px] text-[#FF5934] mt-1 flex items-center gap-1 animate-pulse">
                                  <MdWarehouse size={10} /> Loading products...
                                </p>
                              )}
                              {values.location && !productsLoading && (
                                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                  <MdWarehouse size={10} />
                                  {cities.find((city) => city._id === values.location)?.name} - {products.length} product{products.length !== 1 ? 's' : ''} loaded
                                </p>
                              )}
                            </div>

                            <div className="sm:col-span-2 lg:col-span-3">
                              <label className={labelCls}>Details / Notes</label>
                              <textarea
                                name="details"
                                placeholder="Enter details..."
                                value={values.details}
                                onChange={handleChange}
                                className={`${inputCls} resize-none`}
                                rows={2}
                              />
                            </div>
                          </div>
                        </section>

                        <section>
                          <p className="sec-label">Products</p>

                          {!values.location && (
                            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-3">
                              <MdWarehouse size={16} className="text-amber-500 flex-shrink-0" />
                              <p className="text-[12px] text-amber-700 font-medium">
                                Select a <strong>warehouse</strong> above to load available products.
                              </p>
                            </div>
                          )}

                          {values.location && productsLoading && (
                            <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-3">
                              <div className="w-4 h-4 border-2 border-[#FF5934] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                              <p className="text-[12px] text-orange-700 font-medium">Loading products for this warehouse...</p>
                            </div>
                          )}

                          {values.location && !productsLoading && products.length === 0 && (
                            <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 mb-3">
                              <MdWarehouse size={16} className="text-orange-400 flex-shrink-0" />
                              <p className="text-[12px] text-orange-700 font-medium">No products found for this warehouse.</p>
                            </div>
                          )}

                          {values.location && !productsLoading && products.length > 0 && (
                            <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold mb-3">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              {products.length} product{products.length !== 1 ? 's' : ''} available for this warehouse
                            </div>
                          )}

                          <FieldArray name="items">
                            {({ push, remove }) => (
                              <div className="bg-[#F9FAFB] rounded-2xl border border-gray-100 p-3 sm:p-4">
                                <div className="hidden lg:grid grid-cols-[minmax(220px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_40px] gap-3 mb-2 px-1">
                                  {['Product', 'Purchase Rate', 'Discount %', 'Quantity', 'Amount', ''].map((heading) => (
                                    <div key={heading || 'actions'} className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                                      {heading}
                                    </div>
                                  ))}
                                </div>

                                <div className="space-y-3">
                                  {values.items.map((item, index) => (
                                    <div
                                      key={index}
                                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(110px,1fr)_40px] gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0 items-start"
                                    >
                                      <div className="sm:col-span-2 lg:col-span-1 min-w-0">
                                        <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Product</label>
                                        <GroupedSelect
                                          options={groupedProducts}
                                          value={item.product ? {
                                            value: item.product,
                                            label: products.find((product) => product._id === item.product)?.englishTitle || 'Product',
                                            data: products.find((product) => product._id === item.product),
                                          } : null}
                                          onChange={(option) => {
                                            const selected = option?.data;
                                            const patch = selected
                                              ? {
                                                  product: selected._id,
                                                  purchaseRate: selected.purchaseRate || '',
                                                  purchaseDiscount: selected.purchaseDiscount || '',
                                                }
                                              : { product: '', purchaseRate: '', purchaseDiscount: '' };

                                            setFieldValue(`items.${index}.product`, patch.product);
                                            setFieldValue(`items.${index}.purchaseRate`, patch.purchaseRate);
                                            setFieldValue(`items.${index}.purchaseDiscount`, patch.purchaseDiscount);
                                            syncLineAndTotals(values.items, index, patch, setFieldValue);
                                          }}
                                          placeholder={!values.location ? 'Select warehouse first...' : productsLoading ? 'Loading products...' : 'Select product...'}
                                          isDisabled={!values.location || productsLoading}
                                        />
                                        {touched.items?.[index]?.product && errors.items?.[index]?.product && (
                                          <p className="text-red-500 text-[10px] mt-1">{errors.items[index].product}</p>
                                        )}
                                      </div>

                                      <div>
                                        <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Purchase Rate</label>
                                        <Field
                                          type="number"
                                          name={`items.${index}.purchaseRate`}
                                          value={item.purchaseRate}
                                          onChange={(event) => {
                                            handleChange(event);
                                            syncLineAndTotals(values.items, index, { purchaseRate: event.target.value }, setFieldValue);
                                          }}
                                          placeholder="0.00"
                                          className={inputCls}
                                        />
                                      </div>

                                      <div>
                                        <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Discount %</label>
                                        <Field
                                          type="number"
                                          name={`items.${index}.purchaseDiscount`}
                                          value={item.purchaseDiscount}
                                          onChange={(event) => {
                                            handleChange(event);
                                            syncLineAndTotals(values.items, index, { purchaseDiscount: event.target.value }, setFieldValue);
                                          }}
                                          placeholder="%"
                                          className={inputCls}
                                        />
                                      </div>

                                      <div>
                                        <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Quantity</label>
                                        <Field
                                          type="number"
                                          name={`items.${index}.quantity`}
                                          value={item.quantity}
                                          onChange={(event) => {
                                            handleChange(event);
                                            syncLineAndTotals(values.items, index, { quantity: event.target.value }, setFieldValue);
                                          }}
                                          placeholder="0"
                                          className={inputCls}
                                        />
                                      </div>

                                      <div>
                                        <label className="lg:hidden block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Amount</label>
                                        <div className={`${inputCls} flex items-center font-semibold text-[#111827] bg-white min-h-[42px]`}>
                                          {Number(item.amount || 0).toFixed(2)}
                                        </div>
                                      </div>

                                      <div className="flex sm:block items-end justify-end">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextItems = values.items.filter((_, itemIndex) => itemIndex !== index);
                                            const totals = calculateTotals(nextItems);
                                            remove(index);
                                            setFieldValue('totalAmount', totals.totalAmount);
                                            setFieldValue('discountAmount', totals.totalDiscount);
                                            setFieldValue('payable', totals.totalAmount);
                                          }}
                                          disabled={values.items.length === 1}
                                          className="w-10 h-10 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-400 border border-red-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed lg:mt-1"
                                          aria-label="Remove product"
                                        >
                                          <FaTrash size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => push(emptyLineItem())}
                                  className="mt-3 flex items-center gap-2 text-[#FF5934] hover:text-[#e84d2a] text-[13px] font-semibold transition-colors"
                                >
                                  <FaPlus size={12} /> Add Product
                                </button>
                              </div>
                            )}
                          </FieldArray>
                        </section>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F9FAFB] rounded-2xl p-4 border border-gray-100">
                          {[
                            { label: 'Discount Amount', value: Number(values.discountAmount).toFixed(2) },
                            { label: 'Payable Amount', value: Number(values.payable).toFixed(2) },
                            { label: 'Total Amount', value: Number(values.totalAmount).toFixed(2), hi: true },
                          ].map(({ label, value, hi }) => (
                            <div key={label}>
                              <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                              <p className={`text-[15px] font-bold ${hi ? 'text-[#FF5934]' : 'text-[#111827]'}`}>PKR {value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="sticky bottom-0 px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 bg-[#FAFAFA] rounded-b-2xl sm:rounded-b-3xl mt-auto">
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={modalLoading || productsLoading}
                          className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                        >
                          {modalLoading
                            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                            : <><MdLocalShipping size={16} /> Save Purchase</>}
                        </button>
                      </div>
                    </Form>
                  )}
                </Formik>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Purchases;
