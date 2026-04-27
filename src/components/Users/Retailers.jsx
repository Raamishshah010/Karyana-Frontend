import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import User from './User';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import {
  createRetialer, deleteRetialer, getAllCities, getDatas,
  getRetailers, updateRetialerStatus, getSalesPersons, updateRetialer
} from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { checkAuthError, USER_STATUSES } from '../../utils';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import { Formik, Form } from 'formik';
import * as yup from 'yup';
import { Input } from '../common/input';
import placeholder from '../../assets/placehold.jpg';
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdRefresh, MdPhone, MdLocationOn,
  MdBadge, MdEmail, MdLock, MdStorefront, MdLocationCity,
  MdDownload, MdUpload, MdPerson, MdCategory, MdMyLocation
} from "react-icons/md";
import EscapeClose from '../EscapeClose';
import { useFilters } from '../../context/FilterContext'; // ← ADD THIS IMPORT

/* ── Module key — must be unique per page ── */
const MODULE = 'retailers'; // ← ADD THIS

/* ── Status badges ── */
const StatusBadge = ({ active }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
    ${active ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20' : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-gray-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const VerifiedBadge = ({ verified }) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
    ${verified ? 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20' : 'bg-amber-50 text-amber-500 ring-1 ring-amber-200'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${verified ? 'bg-blue-500' : 'bg-amber-400'}`} />
    {verified ? 'Verified' : 'Pending'}
  </span>
);

const FieldGroup = ({ icon: Icon, label, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">
      {Icon && <Icon size={12} className="text-[#FF5934]" />}
      {label}
    </label>
    {children}
  </div>
);

const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";
const inputClsErr = (err, touched) => `${inputCls} ${err && touched ? 'border-red-400 focus:border-red-400' : ''}`;

const EMPTY_FORM = {
  id: '', userId: '', name: '', email: '', phoneNumber: '', cnic: '',
  cityID: '', shopName: '', shopAddress1: '', shopAddress2: '',
  shopCategory: '', distance: '', lng: '', lat: '',
  salesPersonID: '', password: '', image: null,
};

const Retailers = () => {
  /* ── Persistent filter state ── */
  const { getFilters, setFilters, clearFilters, getFilterCount } = useFilters(); // ← ADD
  const savedFilters = getFilters(MODULE); // ← ADD

  /* ── Derive local state from saved filters ── */
  const [limit, setLimit] = useState(savedFilters.limit ?? 10); // ← CHANGED
  const [currentPage, setCurrentPage] = useState(savedFilters.currentPage ?? 1); // ← CHANGED
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? ''); // ← CHANGED
  const [selectedCityId, setSelectedCityId] = useState(savedFilters.selectedCityId ?? ''); // ← CHANGED
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState(savedFilters.selectedStatus ?? ''); // ← CHANGED

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [importing, setImporting] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [salesPersons, setSalesPersons] = useState([]);
  const [editInitialValues, setEditInitialValues] = useState(EMPTY_FORM);

  const token = useSelector((state) => state.admin.token);
  const filterCount = getFilterCount(MODULE); // ← ADD

  /* ── Persist filter changes to context whenever they change ── */
  useEffect(() => { // ← ADD THIS ENTIRE EFFECT
    setFilters(MODULE, {
      searchTerm,
      selectedCityId,
      selectedStatus: selectedMaritalStatus,
      limit,
      currentPage,
    });
  }, [searchTerm, selectedCityId, selectedMaritalStatus, limit, currentPage]);

  const normalizeRetailersList = (list = []) => {
    try {
      return (list || []).map((r) => ({
        ...r,
        isAdminVerified: typeof r.isAdminVerified !== 'undefined' ? !!r.isAdminVerified : !!r.isVerified,
      }));
    } catch (e) {
      return list || [];
    }
  };

  /* ── Excel Import (logic unchanged) ── */
  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv', 'application/octet-stream'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type}. Please upload .xlsx, .xls or .csv files only.`);
      e.target.value = '';
      return;
    }
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const raw = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(raw, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        const headerRow = jsonData[0] || [];
        const findColumnIndex = (names) => {
          const map = headerRow.reduce((acc, val, idx) => { if (val) acc[String(val).toLowerCase().trim()] = idx; return acc; }, {});
          for (const name of names) { const idx = map[name.toLowerCase().trim()]; if (idx !== undefined) return idx; }
          return -1;
        };
        const businessNameIdx = findColumnIndex(['business name', 'shop name', 'shopname', 'business', 'company name']);
        const firstNameIdx = findColumnIndex(['first name', 'name', 'firstname', 'contact person']);
        const phoneIdx = findColumnIndex(['phone', 'phone number', 'phonenumber', 'contact', 'mobile', 'mobile number']);
        const cnicIdx = findColumnIndex(['cnic', 'cninc', 'id card', 'idcard', 'nic']);
        const cityCodeIdx = findColumnIndex(['postal code', 'zip code', 'zip', 'city code', 'location code', 'city', 'location', 'city id', 'location id']);
        const accountNoIdx = findColumnIndex(['account no', 'account', 'account number', 'account no.']) || 4;
        let salesIdIdx = -1;
        headerRow.some((h, idx) => { if (String(h).trim().toLowerCase() === 'field1') { salesIdIdx = idx; return true; } return false; });
        if (salesIdIdx === -1) salesIdIdx = findColumnIndex(['sales id', 'salesid', 'salesperson id', 'salespersonid', 'sales rep id', 'salesrep id']);
        const missing = [];
        if (businessNameIdx === -1) missing.push('Business Name');
        if (phoneIdx === -1) missing.push('Phone');
        if (accountNoIdx === -1) missing.push('Account No');
        if (salesIdIdx === -1) missing.push('Sales ID');
        if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(', ')}`);
        let citiesList = [];
        const cityMap = new Map();
        try {
          const citiesRes = await getAllCities();
          if (citiesRes?.data?.data && Array.isArray(citiesRes.data.data)) citiesList = citiesRes.data.data;
          else if (Array.isArray(citiesRes?.data)) citiesList = citiesRes.data;
          citiesList.forEach(city => { if (city?._id && city?.locationId) cityMap.set(String(city.locationId).trim().toLowerCase(), city._id); });
          if (cityMap.size === 0) throw new Error('No valid city codes found.');
        } catch (err) { throw new Error(`Failed to load city data: ${err.message}`); }
        let successCount = 0;
        const errors = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          const businessName = row[businessNameIdx] ? String(row[businessNameIdx]).trim() : '';
          const firstName = firstNameIdx >= 0 ? String(row[firstNameIdx] || '').trim() : '';
          const phoneNumber = row[phoneIdx] ? String(row[phoneIdx]).trim() : '';
          const cnic = cnicIdx >= 0 ? String(row[cnicIdx] || '').replace(/\D/g, '') : '';
          const accountNo = row[accountNoIdx] ? String(row[accountNoIdx]).trim() : '';
          const cityCode = cityCodeIdx >= 0 ? String(row[cityCodeIdx] || '').trim() : '';
          let salesId = salesIdIdx >= 0 ? String(row[salesIdIdx] ?? '').trim() : '';
          const idMatch = salesId.match(/\[([^\]]+)\]/);
          if (idMatch?.[1]) salesId = idMatch[1].trim();
          const missingFields = [];
          if (!businessName) missingFields.push('Business Name');
          if (!accountNo) missingFields.push('Account No');
          if (!salesId) missingFields.push('Sales ID');
          if (missingFields.length > 0) { errors.push(`Row ${i + 1}: Missing ${missingFields.join(', ')}`); continue; }
          if (!cityCode) { errors.push(`Row ${i + 1}: City code required`); continue; }
          const cityId = cityMap.get(cityCode.toLowerCase());
          if (!cityId) { errors.push(`Row ${i + 1}: Invalid city code "${cityCode}"`); continue; }
          const matchedSP = salesPersons.find(sp => sp.salesId && String(sp.salesId).trim().toLowerCase() === salesId.trim().toLowerCase());
          if (!matchedSP) { errors.push(`Row ${i + 1}: No sales person found with ID "${salesId}"`); continue; }
          const retailerData = {
            userId: accountNo, name: firstName || businessName, phoneNumber, cnic,
            shopName: businessName, shopAddress1: 'Imported from Excel', shopAddress2: 'N/A',
            cityID: cityId, locationCode: cityCode, isActive: true, isAdminVerified: false,
            email: '', lat: 0, lng: 0, distance: 0, shopCategory: 'General Store',
            isFiler: false, ntnNumber: '', stn: '', billingAddress: '',
            city: cityCode, province: '', postalCode: '', country: '',
            balance: 0, lastPayment: 0, salesPersonID: matchedSP._id,
          };
          try {
            await createRetialer(retailerData, token);
            successCount++;
            await new Promise(res => setTimeout(res, 100));
          } catch (apiError) {
            const rd = apiError.response?.data;
            let msg = 'Unknown error';
            if (rd) {
              if (Array.isArray(rd.errors) && rd.errors.length > 0) msg = rd.errors.map(e => e.msg || JSON.stringify(e)).join('; ');
              else if (rd.message) msg = rd.message;
              else msg = JSON.stringify(rd);
            } else if (apiError.message) msg = apiError.message;
            errors.push(`Row ${i + 1}: ${msg}`);
          }
        }
        if (successCount > 0) {
          toast.success(`Imported ${successCount} retailer${successCount > 1 ? 's' : ''}${errors.length > 0 ? ` (${errors.length} failed)` : ''}`);
          const res = await getRetailers(currentPage, limit);
          setData(normalizeRetailersList(res.data.data));
          setTotalPages(res.data.totalPages);
        } else if (errors.length > 0) {
          toast.error(`Import failed: ${errors[0].split(': ')[1] || 'Unknown error'}`);
        }
      } catch (error) {
        toast.error(error.message || 'Failed to process Excel file');
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => { toast.error('Error reading file'); setImporting(false); e.target.value = ''; };
    reader.readAsArrayBuffer(file);
  };

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => setCities({ isLoaded: true, data: res.data.data }))
        .catch(err => console.log("Loading cities:", err.message));
    }
  }, [cities.isLoaded]);

  useEffect(() => {
    getSalesPersons(token).then(res => setSalesPersons(res.data.data || []))
      .catch(err => { console.error(err); toast.error('Failed to load sales persons'); });
  }, [token]);

  useEffect(() => {
    setLoading(true);
    const link = `/retailer/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(normalizeRetailersList(res.data.data));
      setLoading(false);
      setTotalPages(res.data.totalPages);
    }).catch((err) => { setLoading(false); toast.error(err.message); });
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);

  const deleteHandler = async (e, id) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteRetialer(id, token);
      getRetailers(currentPage, limit).then((res) => {
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch(err => { setLoading(false); toast.error(err.message); });
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const updateDataHandler = async (e, check, name, item) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const payload = {
        id: item._id,
        isActive: name === "isActive" ? check : !!item.isActive,
        isVerified: name === "isAdminVerified" ? check : !!item.isAdminVerified,
      };
      await updateRetialerStatus(payload, token);
      toast.success(`${name === 'isAdminVerified' ? 'Admin Verified' : 'Active'} ${check ? 'enabled' : 'disabled'}`);
      setLoading(false);
      getRetailers(currentPage, limit).then((res) => {
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch(err => { setLoading(false); toast.error(err.message); });
    } catch (error) {
      checkAuthError(error);
      toast.error(error?.response?.data?.msg || 'Toggle failed');
    }
  };

  /* ── Filter handlers — update local state AND context ── */
  const handleCityChange = (value) => { // ← CHANGED from citySelectHandler
    setSelectedCityId(value);
    setCurrentPage(1);
    setFilters(MODULE, { selectedCityId: value, currentPage: 1 });
  };

  const handleStatusChange = (value) => { // ← CHANGED from statusSelectHandler
    const mapped = value ? (value === USER_STATUSES[0] ? true : false) : '';
    setSelectedMaritalStatus(mapped);
    setCurrentPage(1);
    setFilters(MODULE, { selectedStatus: mapped, currentPage: 1 });
  };

  const handleSearchChange = (value) => { // ← ADD
    setSearchTerm(value);
    setFilters(MODULE, { searchTerm: value });
    if (!value) triggerSearch(value);
  };

  const triggerSearch = (term = searchTerm) => { // ← ADD (replaces inline search logic)
    setLoading(true);
    getDatas(`/retailer/search?page=${currentPage}&limit=${limit}&searchTerm=${term}&city=${selectedCityId}&status=${selectedMaritalStatus}`)
      .then((res) => { setData(normalizeRetailersList(res.data.data)); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  /* ── Clear all filters ── */
  const handleClearAllFilters = () => { // ← ADD
    setSearchTerm('');
    setSelectedCityId('');
    setSelectedMaritalStatus('');
    setCurrentPage(1);
    clearFilters(MODULE);
    setLoading(true);
    getDatas(`/retailer/search?page=1&limit=${limit}&searchTerm=&city=&status=`)
      .then((res) => { setData(normalizeRetailersList(res.data.data)); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const refreshData = () => { // ← CHANGED (now resets limit too and delegates to clearAll)
    handleClearAllFilters();
    setLimit(10);
    setFilters(MODULE, { limit: 10 });
  };

  const handlePageChange = (next) => { // ← ADD
    setCurrentPage(next);
    setFilters(MODULE, { currentPage: next });
  };

  const handleLimitChange = (val) => { // ← ADD
    setLimit(val);
    setCurrentPage(1);
    setFilters(MODULE, { limit: val, currentPage: 1 });
  };

  const editHandler = async (e, item) => {
    if (e) e.stopPropagation();
    setIsFormVisible(true);
    try {
      const response = await getDatas(`/retailer/${item._id}`);
      const d = response.data?.data || item;
      setEditInitialValues({
        id: d._id, userId: d.userId || '', name: d.name, email: d.email || '',
        phoneNumber: d.phoneNumber, cnic: d.cnic, cityID: d.cityID?._id || d.cityID,
        shopName: d.shopName, shopAddress1: d.shopAddress1, shopAddress2: d.shopAddress2,
        shopCategory: d.shopCategory, distance: d.distance, lng: d.lng, lat: d.lat,
        salesPersonID: d.salesPersonID?._id || d.salesPersonID,
        password: d.password || '', image: null,
      });
    } catch {
      setEditInitialValues({
        id: item._id, userId: item.userId || '', name: item.name, email: item.email || '',
        phoneNumber: item.phoneNumber, cnic: item.cnic, cityID: item.cityID?._id || item.cityID,
        shopName: item.shopName, shopAddress1: item.shopAddress1, shopAddress2: item.shopAddress2,
        shopCategory: item.shopCategory, distance: item.distance, lng: item.lng, lat: item.lat,
        salesPersonID: item.salesPersonID?._id || item.salesPersonID,
        password: '', image: null,
      });
    }
  };

  const validationSchema = yup.object().shape({
    userId: yup.string().required("User ID is required"),
    name: yup.string().required("Name is required"),
    email: yup.string().nullable().email("Invalid email"),
    phoneNumber: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "Phone number is not valid").required("Phone number is required"),
    cnic: yup.string().transform((v) => v ? v.replace(/[^0-9]/g, '') : v).matches(/^[0-9]{13}$|^$/, 'CNIC must be 13 digits').nullable().transform((v) => v || undefined),
    cityID: yup.string().required("City is required"),
    shopName: yup.string().required("Shop name is required"),
    shopAddress1: yup.string().required("Shop address 1 is required"),
    shopAddress2: yup.string().required("Shop address 2 is required"),
    shopCategory: yup.string().required("Shop category is required"),
    distance: yup.number().typeError("Must be a number").required("Distance is required"),
    lng: yup.number().typeError("Must be a number").required("Longitude is required"),
    lat: yup.number().typeError("Must be a number").required("Latitude is required"),
    salesPersonID: yup.string().required("Sales person is required"),
    password: yup.string().nullable(),
    image: yup.mixed().nullable(),
  });

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("userId", values.userId);
      formData.append("name", values.name);
      formData.append("email", values.email || "");
      formData.append("phoneNumber", values.phoneNumber);
      formData.append("cnic", values.cnic ? values.cnic.replace(/[^0-9]/g, '') : '');
      formData.append("cityID", values.cityID);
      formData.append("shopName", values.shopName);
      formData.append("shopAddress1", values.shopAddress1);
      formData.append("shopAddress2", values.shopAddress2);
      formData.append("shopCategory", values.shopCategory);
      formData.append("distance", values.distance || "");
      formData.append("lng", values.lng || "");
      formData.append("lat", values.lat || "");
      formData.append("salesPersonID", values.salesPersonID);
      if (values.password && values.password.trim()) formData.append("password", values.password);
      if (values.image) formData.append("file", values.image);

      if (values.id) {
        await updateRetialer(values.id, formData, token);
        toast.success("Retailer updated successfully!");
      } else {
        const response = await createRetialer(formData, token);
        if (response.data?.msg === "success") toast.success("Retailer added successfully!");
        else throw new Error(response.data?.msg || "Failed to add retailer");
      }
      getRetailers(currentPage, limit).then((res) => {
        setData(normalizeRetailersList(res.data.data));
        setTotalPages(res.data.totalPages);
        setLoading(false);
      });
      setIsFormVisible(false);
      setEditInitialValues(EMPTY_FORM);
      resetForm();
    } catch (error) {
      const dup = error.response?.data?.errors?.find(e => e.msg?.toLowerCase().includes('user id'));
      if (dup) { toast.error(dup.msg); }
      else toast.error(error.response?.data?.msg || error.response?.data?.errors?.map(e => e.msg).join(", ") || error.message || "Failed to save retailer");
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  const handleDownloadSample = () => {
    const link = document.createElement('a');
    link.href = '/customerSample.xlsx';
    link.download = 'Product_Import_Sample.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Status select display value ── */
  const statusDisplayValue = // ← ADD
    selectedMaritalStatus === ''
      ? ''
      : selectedMaritalStatus === true || selectedMaritalStatus === 'true'
        ? USER_STATUSES[0]
        : USER_STATUSES[1];

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        .rt-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .rt-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .rt-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .rt-page .filter-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .rt-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .rt-page .action-btn:hover { transform: scale(1.1); }
        .rt-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .rt-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes rtModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rtOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .rt-modal-overlay { animation: rtOverlayIn 0.2s ease; }
        .rt-modal-card    { animation: rtModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        @keyframes rtRingPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,89,52,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(255,89,52,0); }
        }
        .rt-avatar-ring { animation: rtRingPulse 2.5s ease-in-out infinite; }
        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; }
      `}</style>

      <div className="rt-page">
        <User />

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Customers</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} records found</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Import Excel */}
            <label htmlFor="excel-import" className={`flex items-center gap-2 bg-white border border-gray-200 text-[#374151] text-sm font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
              <MdUpload size={16} className="text-[#FF5934]" />
              {importing ? 'Importing…' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} id="excel-import" onChange={handleExcelImport} disabled={importing} />
            </label>
            {/* Download Sample */}
            <button onClick={handleDownloadSample} className="flex items-center gap-2 bg-white border border-gray-200 text-[#374151] text-sm font-semibold px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all">
              <MdDownload size={16} className="text-[#FF5934]" />
              Sample
            </button>
            {/* Add Retailer */}
            <button
              onClick={() => { setEditInitialValues(EMPTY_FORM); setIsFormVisible(true); }}
              className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
            >
              <MdPersonAdd size={18} />
              Add Retailer
            </button>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)} // ← CHANGED
              onKeyDown={e => e.key === 'Enter' && triggerSearch()} // ← CHANGED
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by name…"
            />
            {searchTerm && (
              <button onClick={() => handleSearchChange('')} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors"> {/* ← CHANGED */}
                <MdClose size={14} />
              </button>
            )}
          </div>

          {/* City filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select
              value={selectedCityId}
              onChange={e => handleCityChange(e.target.value)} // ← CHANGED
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[130px]"
            >
              <option value="">All Locations</option>
              {cities.data.map(city => (
                <option value={city._id} key={city._id}>{city.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <select
              value={statusDisplayValue} // ← CHANGED
              onChange={e => handleStatusChange(e.target.value)} // ← CHANGED
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
            >
              <option value="">All Status</option>
              {USER_STATUSES.map(status => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* ← ADD: Active filter count badge + Clear Filters button */}
          {filterCount > 0 && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#FF5934] bg-[#FF5934]/10 hover:bg-[#FF5934]/20 px-3 py-2 rounded-xl transition-all duration-200"
              title="Clear all active filters"
            >
              <MdClose size={14} />
              Clear Filters
              <span className="w-5 h-5 rounded-full bg-[#FF5934] text-white text-[10px] font-bold flex items-center justify-center leading-none ml-0.5">
                {filterCount}
              </span>
            </button>
          )}

          {/* Reset */}
          <button onClick={refreshData}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200">
            <MdRefresh size={16} /> Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {["Customer", "User ID", "Phone", "CNIC", "Active", "Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((item, index) => (
                <tr key={index} className="table-row cursor-pointer" onClick={() => setSelectedUser(item)}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={(item.image && item.image.length) ? item.image : placeholder}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                          onError={e => { e.target.src = placeholder; }}
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${item.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827] leading-tight">{item.shopName}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{item.email || item.name}</p>
                      </div>
                    </div>
                  </td>
                  {/* User ID */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg uppercase">
                      #{item.userId}
                    </span>
                  </td>
                  {/* Phone */}
                  <td className="px-4 py-3 text-[13px] text-[#374151]">{item.phoneNumber}</td>
                  {/* CNIC */}
                  <td className="px-4 py-3 text-[13px] text-[#374151] font-mono">{item.cnic || '—'}</td>
                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button className="toggle-btn flex items-center" onClick={(e) => updateDataHandler(e, !item.isActive, "isActive", item)}>
                      {item.isActive ? <PiToggleRightFill size={26} className="text-emerald-500" /> : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>
                  {/* Verified toggle */}
                  <td className="px-4 py-3">
                    <button className="toggle-btn flex items-center" onClick={(e) => updateDataHandler(e, !item.isAdminVerified, "isAdminVerified", item)}>
                      {item.isAdminVerified ? <PiToggleRightFill size={26} className="text-blue-500" /> : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedUser(item); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100" title="View">
                        <FaRegEye size={14} />
                      </button>
                      <button onClick={(e) => editHandler(e, item)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100" title="Edit">
                        <MdEdit size={14} />
                      </button>
                      <button onClick={(e) => deleteHandler(e, item._id)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100" title="Delete">
                        <MdDelete size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdFilterList size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No customers found</p>
                      {/* ← CHANGED: show filter count in empty state */}
                      {filterCount > 0 ? (
                        <button onClick={handleClearAllFilters} className="text-[#FF5934] text-xs hover:underline font-medium">
                          Clear {filterCount} active filter{filterCount > 1 ? 's' : ''}
                        </button>
                      ) : (
                        <button onClick={refreshData} className="text-[#FF5934] text-xs hover:underline">Clear filters</button>
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
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)} // ← CHANGED
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
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)} // ← CHANGED
            >
              <GrFormNext size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9CA3AF]">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))} // ← CHANGED
              className="filter-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>


        {/* ═══════════════════════════════════════════════
            ADD / EDIT MODAL
        ═══════════════════════════════════════════════ */}
        {isFormVisible && (
          <div className="rt-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="rt-modal-card bg-white w-full max-w-[560px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Header band */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 flex-shrink-0">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {editInitialValues.id ? 'Editing Profile' : 'New Profile'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {editInitialValues.id ? 'Edit Retailer' : 'Add Retailer'}
                    </h2>
                  </div>
                  <button onClick={() => { setIsFormVisible(false); setEditInitialValues(EMPTY_FORM); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={editInitialValues} enableReinitialize validationSchema={validationSchema} onSubmit={handleSubmit}>
                {({ values, handleChange, errors, touched, setFieldValue }) => (
                  <Form className="no-scroll overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 pt-6 pb-4 flex flex-col gap-4">

                      {/* Personal */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" /> Personal Info <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdBadge} label="User ID">
                            <Input name="userId" placeholder="User ID" value={values.userId} onChange={handleChange}
                              className={inputClsErr(errors.userId, touched.userId)} />
                            {errors.userId && touched.userId && <p className="text-red-400 text-[11px] mt-1">{errors.userId}</p>}
                          </FieldGroup>
                          <FieldGroup icon={MdPerson} label="Name">
                            <Input name="name" placeholder="Full name" value={values.name} onChange={handleChange}
                              className={inputClsErr(errors.name, touched.name)} />
                          </FieldGroup>
                          <FieldGroup icon={MdEmail} label="Email">
                            <Input name="email" type="email" placeholder="email@example.com" value={values.email} onChange={handleChange}
                              className={inputClsErr(errors.email, touched.email)} />
                          </FieldGroup>
                          <FieldGroup icon={MdPhone} label="Phone Number">
                            <Input name="phoneNumber" placeholder="+923001234567" value={values.phoneNumber} onChange={handleChange}
                              className={inputClsErr(errors.phoneNumber, touched.phoneNumber)} />
                            {errors.phoneNumber && touched.phoneNumber && <p className="text-red-400 text-[11px] mt-1">{errors.phoneNumber}</p>}
                          </FieldGroup>
                          <FieldGroup icon={MdBadge} label="CNIC">
                            <Input name="cnic" placeholder="xxxxx-xxxxxxx-x" value={values.cnic} onChange={handleChange}
                              className={inputClsErr(errors.cnic, touched.cnic)} />
                          </FieldGroup>
                          <FieldGroup icon={MdLock} label={editInitialValues.id ? "New Password (optional)" : "Password (optional)"}>
                            <Input name="password" type="text"
                              placeholder={editInitialValues.id ? "Leave empty to keep current" : "Leave empty for no password"}
                              value={values.password} onChange={handleChange} className={inputCls} />
                          </FieldGroup>
                        </div>
                      </div>

                      {/* Shop Info */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" /> Shop Info <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdStorefront} label="Shop Name">
                            <Input name="shopName" placeholder="Shop name" value={values.shopName} onChange={handleChange}
                              className={inputClsErr(errors.shopName, touched.shopName)} />
                          </FieldGroup>
                          <FieldGroup icon={MdCategory} label="Shop Category">
                            <Input name="shopCategory" placeholder="Category" value={values.shopCategory} onChange={handleChange}
                              className={inputClsErr(errors.shopCategory, touched.shopCategory)} />
                          </FieldGroup>
                          <FieldGroup icon={MdLocationOn} label="Shop Address 1">
                            <Input name="shopAddress1" placeholder="Primary address" value={values.shopAddress1} onChange={handleChange}
                              className={inputClsErr(errors.shopAddress1, touched.shopAddress1)} />
                          </FieldGroup>
                          <FieldGroup icon={MdLocationOn} label="Shop Address 2">
                            <Input name="shopAddress2" placeholder="Secondary address" value={values.shopAddress2} onChange={handleChange}
                              className={inputClsErr(errors.shopAddress2, touched.shopAddress2)} />
                          </FieldGroup>
                          <div className="col-span-2">
                            <FieldGroup icon={MdLocationCity} label="City">
                              <select name="cityID" value={values.cityID} onChange={handleChange}
                                className={inputClsErr(errors.cityID, touched.cityID)}>
                                <option value="">Select Location</option>
                                {cities.data.map(city => <option value={city._id} key={city._id}>{city.name}</option>)}
                              </select>
                              {errors.cityID && touched.cityID && <p className="text-red-400 text-[11px] mt-1">{errors.cityID}</p>}
                            </FieldGroup>
                          </div>
                        </div>
                      </div>

                      {/* Location & Assignment */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" /> Location & Assignment <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <FieldGroup icon={MdMyLocation} label="Distance">
                            <Input name="distance" type="number" placeholder="km" value={values.distance} onChange={handleChange}
                              className={inputClsErr(errors.distance, touched.distance)} />
                          </FieldGroup>
                          <FieldGroup icon={MdMyLocation} label="Longitude">
                            <Input name="lng" type="number" placeholder="lng" value={values.lng} onChange={handleChange}
                              className={inputClsErr(errors.lng, touched.lng)} />
                          </FieldGroup>
                          <FieldGroup icon={MdMyLocation} label="Latitude">
                            <Input name="lat" type="number" placeholder="lat" value={values.lat} onChange={handleChange}
                              className={inputClsErr(errors.lat, touched.lat)} />
                          </FieldGroup>
                          <div className="col-span-3">
                            <FieldGroup icon={MdPerson} label="Sales Person">
                              <select name="salesPersonID" value={values.salesPersonID} onChange={handleChange}
                                className={inputClsErr(errors.salesPersonID, touched.salesPersonID)}>
                                <option value="">Select Sales Person</option>
                                {salesPersons.map(p => <option value={p._id} key={p._id}>{p.name}</option>)}
                              </select>
                              {errors.salesPersonID && touched.salesPersonID && <p className="text-red-400 text-[11px] mt-1">{errors.salesPersonID}</p>}
                            </FieldGroup>
                          </div>
                          <div className="col-span-3">
                            <FieldGroup icon={MdUpload} label="Image">
                              <input type="file" name="image" onChange={e => setFieldValue("image", e.currentTarget.files[0])}
                                className={`${inputCls} cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#FF5934]/10 file:text-[#FF5934]`} />
                            </FieldGroup>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl flex-shrink-0">
                      <button type="button"
                        onClick={() => { setIsFormVisible(false); setEditInitialValues(EMPTY_FORM); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all duration-200 flex items-center justify-center gap-2">
                        {editInitialValues.id ? <><MdEdit size={16} /> Save Changes</> : <><MdPersonAdd size={16} /> Add Retailer</>}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════
            DETAIL MODAL
        ═══════════════════════════════════════════════ */}
        {selectedUser && (
          <div className="rt-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setSelectedUser(null)}>
            <div className="rt-modal-card bg-white w-full max-w-[520px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}>

              {/* Hero banner */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden flex-shrink-0">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between mb-4">
                  <div>
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Retailer</span>
                    <p className="text-white/40 text-[11px] font-mono mt-0.5">#{String(selectedUser.userId || '').toUpperCase()}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative flex items-end gap-4">
                  <div className="relative flex-shrink-0">
                    <img src={(selectedUser.image && selectedUser.image.length) ? selectedUser.image : placeholder} alt=""
                      className="rt-avatar-ring w-20 h-20 rounded-2xl object-cover ring-4 ring-[#FF5934]/50 shadow-xl"
                      onError={e => { e.target.src = placeholder; }} />
                    <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-[#16213e] shadow-md flex items-center justify-center ${selectedUser.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${selectedUser.isActive ? 'bg-emerald-200' : 'bg-gray-200'}`} />
                    </span>
                  </div>
                  <div className="pb-1 min-w-0">
                    <h3 className="text-white text-[18px] font-bold leading-tight truncate">{selectedUser.shopName || selectedUser.name}</h3>
                    <p className="text-white/50 text-xs mt-0.5 truncate">{selectedUser.email || selectedUser.name}</p>
                    <div className="flex gap-2 mt-2">
                      <StatusBadge active={selectedUser.isActive} />
                      <VerifiedBadge verified={selectedUser.isAdminVerified} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="-mt-6 mx-5 grid grid-cols-3 gap-2 z-10 relative flex-shrink-0">
                {[
                  { label: "City", value: selectedUser.cityID?.name || '—', color: "text-[#FF5934]" },
                  { label: "Category", value: selectedUser.shopCategory || '—', color: "text-[#111827]" },
                  { label: "Distance", value: selectedUser.distance ? `${selectedUser.distance} km` : '—', color: "text-[#111827]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className={`text-[13px] font-bold truncate ${color}`}>{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info fields */}
              <div className="no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-4" style={{ maxHeight: '55vh' }}>

                {/* Contact */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Contact <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: MdPhone, label: "Phone No.", value: selectedUser.phoneNumber },
                      { icon: MdBadge, label: "CNIC", value: selectedUser.cnic, mono: true },
                      { icon: MdEmail, label: "Email", value: selectedUser.email, span: 2 },
                    ].map(({ icon: Icon, label, value, mono, span }) => (
                      <div key={label} className={`flex items-start gap-2.5 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100 ${span === 2 ? 'col-span-2' : ''}`}>
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={13} className="text-[#FF5934]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className={`text-[13px] font-medium break-all mt-0.5 ${mono ? 'font-mono' : ''} text-[#374151]`}>
                            {value || <span className="text-gray-300 italic text-[12px]">N/A</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shop Details */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Shop Details <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: MdStorefront, label: "Shop Name", value: selectedUser.shopName, span: 2 },
                      { icon: MdCategory, label: "Category", value: selectedUser.shopCategory },
                      { icon: MdLocationCity, label: "City", value: selectedUser.cityID?.name },
                      { icon: MdLocationOn, label: "Address 1", value: selectedUser.shopAddress1, span: 2 },
                      { icon: MdLocationOn, label: "Address 2", value: selectedUser.shopAddress2, span: 2 },
                    ].map(({ icon: Icon, label, value, span }) => (
                      <div key={label} className={`flex items-start gap-2.5 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100 ${span === 2 ? 'col-span-2' : ''}`}>
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={13} className="text-[#FF5934]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className="text-[13px] font-medium break-words mt-0.5 text-[#374151]">
                            {value || <span className="text-gray-300 italic text-[12px]">N/A</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Location <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Distance", value: selectedUser.distance ? `${selectedUser.distance} km` : null },
                      { label: "Longitude", value: selectedUser.lng, mono: true },
                      { label: "Latitude", value: selectedUser.lat, mono: true },
                    ].map(({ label, value, mono }) => (
                      <div key={label} className="flex items-start gap-2 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className={`text-[13px] font-medium mt-0.5 text-[#374151] ${mono ? 'font-mono text-[11px]' : ''}`}>
                            {value ?? <span className="text-gray-300 italic text-[12px]">N/A</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sales Person */}
                {selectedUser.salesPersonID && (
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" /> Assigned To <span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="flex items-center gap-3 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                      <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0">
                        <MdPerson size={15} className="text-[#FF5934]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">Sales Person</p>
                        <p className="text-[13px] font-semibold text-[#111827] mt-0.5">
                          {selectedUser.salesPersonID?.name || selectedUser.salesPersonID}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CNIC images if available */}
                {(selectedUser.cnicFront || selectedUser.cnicBack) && (
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" /> CNIC Images <span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedUser.cnicFront && (
                        <div className="bg-[#F9FAFB] rounded-xl p-2 border border-gray-100">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1.5">Front</p>
                          <img src={selectedUser.cnicFront} alt="CNIC Front" className="w-full h-20 object-cover rounded-lg" />
                        </div>
                      )}
                      {selectedUser.cnicBack && (
                        <div className="bg-[#F9FAFB] rounded-xl p-2 border border-gray-100">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1.5">Back</p>
                          <img src={selectedUser.cnicBack} alt="CNIC Back" className="w-full h-20 object-cover rounded-lg" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer actions */}
              <div className="px-5 pb-5 pt-2 flex gap-2 flex-shrink-0">
                <button onClick={(e) => { editHandler(e, selectedUser); setSelectedUser(null); }}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100">
                  <MdEdit size={15} /> Edit
                </button>
                <button onClick={() => setSelectedUser(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors">
                  Close
                </button>
                <button onClick={(e) => { deleteHandler(e, selectedUser._id); setSelectedUser(null); }}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100" title="Delete">
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
            <EscapeClose onClose={() => setSelectedUser(null)} />
          </div>
        )}
      </div>
    </>
  );
};

export default Retailers;