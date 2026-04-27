import { useEffect, useState } from 'react';
import User from './User';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { createSaleUser, deleteSaleUser, getAllCities, getDatas, updateSaleUser, updateSaleUserStatus, uploadFile } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Textarea } from '../common/textArea';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { Spinner } from '../common/spinner';
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdRefresh, MdPhone, MdLocationOn,
  MdBadge, MdEmail, MdLock, MdPerson, MdLocationCity,
  MdAttachMoney, MdAccessTime, MdMap, MdReceipt
} from "react-icons/md";
import { FaRegEye } from "react-icons/fa6";
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import placeholder from '../../assets/placehold.jpg';
import AreaSelector from '../common/AreaSelector';
import { useFilters } from '../../context/FilterContext';

/* ── Module key ── */
const MODULE = 'sales';

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

/* ── Reusable form field wrapper ── */
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

const TABS = [
  { key: 'address', label: 'Address', icon: MdLocationOn },
  { key: 'taxInfo', label: 'Tax Info', icon: MdReceipt },
  { key: 'areaAssignment', label: 'Area', icon: MdMap },
  { key: 'salaryInfo', label: 'Salary', icon: MdAttachMoney },
  { key: 'timeslot', label: 'Timeslot', icon: MdAccessTime },
];

const Sales = () => {
  /* ── Persistent filter state ── */
  const { getFilters, setFilters, clearFilters, getFilterCount } = useFilters();
  const savedFilters = getFilters(MODULE);

  const [limit, setLimit] = useState(savedFilters.limit ?? 10);
  const [currentPage, setCurrentPage] = useState(savedFilters.currentPage ?? 1);
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? '');
  const [selectedCityId, setSelectedCityId] = useState(savedFilters.selectedCityId ?? '');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState(savedFilters.selectedStatus ?? '');

  /* ── Other local state ── */
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [sales, setSales] = useState([]);
  const token = useSelector((state) => state.admin.token);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [activeTab, setActiveTab] = useState('address');
  const [isFormVisible, setFormVisible] = useState(false);
  const [isAreaSelectorVisible, setAreaSelectorVisible] = useState(false);
  const [newSalesPerson, setNewSalesPerson] = useState({
    id: "", salesId: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: "", target: "",
    billingAddress: "", cityTab: "", province: "", postalCode: "",
    country: "", ntn: "", stn: "", assignedArea: [],
    basicSalary: "", allowanceDistance: "", dailyAllowance: "",
    miscellaneousAllowance: "", checkInTime: "", checkOutTime: "",
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [lastPasswords, setLastPasswords] = useState({});

  const filterCount = getFilterCount(MODULE);

  /* ── Persist filters to context ── */
  useEffect(() => {
    setFilters(MODULE, {
      searchTerm,
      selectedCityId,
      selectedStatus: selectedMaritalStatus,
      limit,
      currentPage,
    });
  }, [searchTerm, selectedCityId, selectedMaritalStatus, limit, currentPage]);

  /* ── Validation schema ── */
  const validations = yup.object().shape({
    salesId: yup.string()
      .required("Sales ID is required")
      .matches(/^[A-Za-z0-9]+$/, "Sales ID can only contain letters and numbers"),
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    password: yup.string().min(6, "Password must be at least 6 characters")
      .when('id', {
        is: (id) => !id || id.length === 0,
        then: (schema) => schema.required("Password is required"),
        otherwise: (schema) => schema.notRequired().nullable(),
      }),
    address: yup.string(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "Phone number is not valid e.g +923333333333"),
    billingAddress: yup.string(),
    cityTab: yup.string(),
    province: yup.string(),
    postalCode: yup.string(),
    country: yup.string(),
    ntn: yup.string(),
    stn: yup.string(),
    basicSalary: yup.number().min(0, "Basic salary must be a positive number"),
    allowanceDistance: yup.number().min(0, "Allowance distance must be a positive number"),
    dailyAllowance: yup.number().min(0, "Daily allowance must be a positive number"),
    miscellaneousAllowance: yup.number().min(0, "Miscellaneous allowance must be a positive number"),
    checkInTime: yup.string().test('time-format', 'Invalid time format (HH:MM)', (v) => !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v)),
    checkOutTime: yup.string().test('time-format', 'Invalid time format (HH:MM)', (v) => !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v)),
  });

  /* ── Fetch data ── */
  useEffect(() => {
    setLoading(true);
    const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setSales(res.data.data);
      setLoading(false);
      setTotalPages(res.data.totalPages);
    }).catch((err) => { setLoading(false); toast.error(err.message); });
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);

  /* ── Load cities ── */
  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => {
        setCities({ isLoaded: true, data: res.data.data });
      }).catch(err => console.log("Loading cities: ", err.message));
    }
  }, [cities.isLoaded]);

  const refreshWithFilters = async (page = currentPage) => {
    try {
      setLoading(true);
      const link = `/sale-user/search?page=${page}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      const res = await getDatas(link);
      setSales(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeHandler = (key, value, setFieldValue) => {
    setFieldValue(key, value);
    setNewSalesPerson((p) => ({ ...p, [key]: value }));
  };

  const handleSubmit = async (values, { setSubmitting, validateForm }) => {
    try {
      const errors = await validateForm(values);
      if (errors && errors.cnic) {
        setActiveTab("taxInfo");
        toast.error("CNIC format is invalid. Please check the Tax Info tab.");
        setSubmitting(false);
        return;
      }
      setLoading(true);
      const payload = {
        ...values,
        image: newSalesPerson.image,
        cityTab: values.cityTab,
        assignedArea: newSalesPerson.assignedArea,
      };
      if (newSalesPerson.id.length) {
        await updateSaleUser(payload, token);
        if (values.password && values.password.trim().length) {
          setLastPasswords(prev => ({ ...prev, [newSalesPerson.id]: values.password.trim() }));
        }
      } else {
        await createSaleUser(payload, token);
      }
      await refreshWithFilters();
      setLoading(false);
      setFormVisible(false);
      resetForm();
    } catch (error) {
      setLoading(false);
      checkAuthError(error);
      if (error.response?.data?.message?.includes('Sales ID')) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.response?.data?.errors[0]?.msg);
      }
    }
  };

  const fileUploadHandler = async (files) => {
    if (!files[0]) return;
    try {
      setImageLoading(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      setNewSalesPerson((p) => ({ ...p, image: res.data.data }));
      setImageLoading(false);
    } catch (error) {
      setImageLoading(false);
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const updateDataHandler = async (check, name, item) => {
    try {
      setLoading(true);
      await updateSaleUserStatus({ ...item, id: item._id, [name]: check }, token);
      await refreshWithFilters();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteHandler = async (e, id) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteSaleUser(id, token);
      await refreshWithFilters();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setNewSalesPerson({
      id: "", salesId: "", name: "", email: "", password: "", phone: "",
      address: "", image: "", cnic: "", city: "", target: "",
      billingAddress: "", cityTab: "", province: "", postalCode: "",
      country: "", ntn: "", stn: "", assignedArea: [],
      basicSalary: "", allowanceDistance: "", dailyAllowance: "",
      miscellaneousAllowance: "", checkInTime: "", checkOutTime: "",
    });
  };

  const addHandler = () => { resetForm(); setFormVisible(true); };

  const editHandler = (e, item) => {
    if (e) e.stopPropagation();
    setNewSalesPerson({
      id: item._id,
      salesId: item.salesId || '',
      name: item.name,
      email: item.email,
      password: lastPasswords[item._id] || "",
      phone: item.phone,
      address: item.address,
      image: item.image,
      cnic: item.cnic,
      city: item.city?._id,
      target: item.target || "",
      billingAddress: item.billingAddress || "",
      cityTab: item.cityTab || "",
      province: item.province || "",
      postalCode: item.postalCode || "",
      country: item.country || "",
      ntn: item.ntn || "",
      stn: item.stn || "",
      assignedArea: item.assignedArea || [],
      basicSalary: item.basicSalary || "",
      allowanceDistance: item.allowanceDistance || "",
      dailyAllowance: item.dailyAllowance || "",
      miscellaneousAllowance: item.miscellaneousAllowance || "",
      checkInTime: item.checkInTime || "",
      checkOutTime: item.checkOutTime || "",
    });
    setFormVisible(true);
  };

  /* ── Filter handlers ── */
  const handleCityChange = (value) => {
    setSelectedCityId(value);
    setCurrentPage(1);
    setFilters(MODULE, { selectedCityId: value, currentPage: 1 });
  };

  const handleStatusChange = (value) => {
    const mapped = value ? (value === USER_STATUSES[0] ? 'true' : 'false') : '';
    setSelectedMaritalStatus(mapped);
    setCurrentPage(1);
    setFilters(MODULE, { selectedStatus: mapped, currentPage: 1 });
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setFilters(MODULE, { searchTerm: value });
    if (!value) triggerSearch(value);
  };

  const triggerSearch = (term = searchTerm) => {
    setLoading(true);
    const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${term}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link)
      .then((res) => { setSales(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedCityId('');
    setSelectedMaritalStatus('');
    setCurrentPage(1);
    clearFilters(MODULE);
    setLoading(true);
    getDatas(`/sale-user/search?page=1&limit=${limit}&searchTerm=&city=&status=`)
      .then((res) => { setSales(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const refreshData = () => {
    handleClearAllFilters();
    setLimit(10);
    setFilters(MODULE, { limit: 10 });
  };

  const handlePageChange = (next) => {
    setCurrentPage(next);
    setFilters(MODULE, { currentPage: next });
  };

  const handleLimitChange = (val) => {
    setLimit(val);
    setCurrentPage(1);
    setFilters(MODULE, { limit: val, currentPage: 1 });
  };

  /* ── Status display value for controlled <select> ── */
  const statusDisplayValue =
    selectedMaritalStatus === ''
      ? ''
      : selectedMaritalStatus === 'true'
        ? USER_STATUSES[0]
        : USER_STATUSES[1];

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        .sp-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .sp-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .sp-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .sp-page .filter-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .sp-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .sp-page .action-btn:hover { transform: scale(1.1); }
        .sp-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .sp-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-overlay { animation: overlayIn 0.2s ease; }
        .modal-card    { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,89,52,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(255,89,52,0); }
        }
        .avatar-ring { animation: ringPulse 2.5s ease-in-out infinite; }
        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; }
        .drag-drop-wrapper { width: 100%; min-width: 0; overflow: hidden; }
        .drag-drop-wrapper > * { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
        .tab-btn { transition: all 0.15s; border-bottom: 2px solid transparent; }
        .tab-btn.active { border-bottom-color: #FF5934; color: #FF5934; }
        .tab-btn:not(.active) { color: #6B7280; }
        .tab-btn:not(.active):hover { color: #374151; background: #F9FAFB; }
      `}</style>

      <div className="sp-page">
        <User />

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Sales Persons</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{sales.length} records found</p>
          </div>
          <button
            onClick={addHandler}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdPersonAdd size={18} />
            Add Sales Person
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">

          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerSearch()}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by name…"
            />
            {searchTerm && (
              <button
                onClick={() => handleSearchChange('')}
                className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors flex-shrink-0"
              >
                <MdClose size={14} />
              </button>
            )}
          </div>

          {/* City filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select
              value={selectedCityId}
              onChange={e => handleCityChange(e.target.value)}
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
              value={statusDisplayValue}
              onChange={e => handleStatusChange(e.target.value)}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
            >
              <option value="">All Status</option>
              {USER_STATUSES.map(status => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters badge — only shown when filters are active */}
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
                {["Sales Person", "Sales ID", "Phone", "CNIC", "Earnings", "Active", "Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.length ? sales.map((data, index) => (
                <tr key={index} className="table-row cursor-pointer" onClick={() => setSelectedUser(data)}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={data.image || placeholder}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                          onError={e => { e.target.src = placeholder; }}
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${data.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827] leading-tight">{data.name}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{data.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Sales ID */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                      {data.salesId || 'N/A'}
                    </span>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 text-[13px] text-[#374151]">{data.phone}</td>

                  {/* CNIC */}
                  <td className="px-4 py-3 text-[13px] text-[#374151] font-mono">{data.cnic}</td>

                  {/* Earnings */}
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">Rs. 0</td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={(e) => { e.stopPropagation(); updateDataHandler(!data.isActive, "isActive", data); }}
                      title={data.isActive ? "Deactivate" : "Activate"}
                    >
                      {data.isActive
                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />
                      }
                    </button>
                  </td>

                  {/* Verified toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={(e) => { e.stopPropagation(); updateDataHandler(!data.isAdminVerified, "isAdminVerified", data); }}
                      title={data.isAdminVerified ? "Unverify" : "Verify"}
                    >
                      {data.isAdminVerified
                        ? <PiToggleRightFill size={26} className="text-blue-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />
                      }
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(data); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100"
                        title="View"
                      >
                        <FaRegEye size={14} />
                      </button>
                      <button
                        onClick={(e) => editHandler(e, data)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="Edit"
                      >
                        <MdEdit size={14} />
                      </button>
                      <button
                        onClick={(e) => deleteHandler(e, data._id)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100"
                        title="Delete"
                      >
                        <MdDelete size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdFilterList size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No sales persons found</p>
                      {filterCount > 0 && (
                        <button
                          onClick={handleClearAllFilters}
                          className="text-[#FF5934] text-xs hover:underline font-medium"
                        >
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
          <div className="flex items-center gap-1.5">
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
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
              onClick={() => handlePageChange(currentPage + 1)}
            >
              <GrFormNext size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9CA3AF]">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
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
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[560px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Decorative header band */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {newSalesPerson.id ? 'Editing Profile' : 'New Profile'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {newSalesPerson.id ? 'Edit Sales Person' : 'Add Sales Person'}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setImageLoading(false); setFormVisible(false); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                initialValues={newSalesPerson}
                validationSchema={validations}
                onSubmit={handleSubmit}
                validateOnChange={false}
                validateOnBlur={true}
              >
                {({ values, setFieldValue, handleSubmit }) => (
                  <Form className="no-scroll overflow-y-auto flex-1 flex flex-col">

                    {/* ── Avatar upload card ── */}
                    <div className="px-6 mt-7 mb-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={newSalesPerson.image || '/Avatar.svg'}
                              alt="Preview"
                              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md"
                            />
                            {newSalesPerson.image && (
                              <button
                                type="button"
                                onClick={() => setNewSalesPerson(p => ({ ...p, image: "" }))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                              >
                                <MdClose size={11} />
                              </button>
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[13px] font-semibold text-[#111827] mb-0.5">Profile Photo</p>
                            <p className="text-[11px] text-[#9CA3AF] mb-2">JPG, PNG up to 5MB</p>
                            {imageLoading ? (
                              <div className="flex items-center gap-2 text-[#FF5934] text-xs font-medium">
                                <Spinner /> Uploading…
                              </div>
                            ) : (
                              <div className="drag-drop-wrapper">
                                <DragNdrop onFilesSelected={fileUploadHandler} width="100%" height="36px" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Core Fields */}
                    <div className="px-6 flex flex-col gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />
                          Personal Information
                          <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <FieldGroup icon={MdPerson} label="Full Name">
                              <Input name="name" placeholder="e.g. Ahmed Khan" changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                          </div>
                          <FieldGroup icon={MdBadge} label="Sales ID">
                            <Input name="salesId" placeholder="Unique Sales ID" changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdEmail} label="Email Address">
                            <Input name="email" type="email" placeholder="name@company.com" disabled={!!newSalesPerson.id} changeHandler={(k, v) => changeHandler(k, v, setFieldValue)}
                              className={`${inputCls} ${newSalesPerson.id ? 'opacity-50 cursor-not-allowed' : ''}`} />
                          </FieldGroup>
                          <FieldGroup icon={MdLock} label={newSalesPerson.id ? "New Password (optional)" : "Password"}>
                            <Input name="password" type="text"
                              placeholder={newSalesPerson.id ? "Leave empty to keep current" : "Min. 6 chars"}
                              changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdPhone} label="Phone Number">
                            <Input name="phone" placeholder="+923001234567" changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                          </FieldGroup>
                          <div className="col-span-2">
                            <FieldGroup icon={MdLocationCity} label="City">
                              <Select name="city" data={cities.data} searchKey="_id" searchValue="name" value={newSalesPerson.city}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                          </div>
                          <div className="col-span-2">
                            <FieldGroup icon={MdLocationOn} label="Address">
                              <Textarea name="address" placeholder="Full address" changeHandler={(k, v) => changeHandler(k, v, setFieldValue)}
                                className={`${inputCls} resize-none`} />
                            </FieldGroup>
                          </div>
                        </div>
                      </div>

                      {/* ── Tab Navigation ── */}
                      <div>
                        <div className="flex border-b border-gray-100 mb-4 gap-1">
                          {TABS.map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setActiveTab(key)}
                              className={`tab-btn flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold rounded-t-lg ${activeTab === key ? 'active' : ''}`}
                            >
                              <Icon size={13} />
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Address Tab */}
                        {activeTab === 'address' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <FieldGroup icon={MdLocationOn} label="Billing Address">
                                <Input name="billingAddress" placeholder="Billing Address" value={values.billingAddress || ''}
                                  changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                              </FieldGroup>
                            </div>
                            <FieldGroup icon={MdLocationCity} label="City (Billing)">
                              <Input name="cityTab" placeholder="City" value={values.cityTab || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdLocationOn} label="Province">
                              <Input name="province" placeholder="Province" value={values.province || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdLocationOn} label="Postal Code">
                              <Input name="postalCode" placeholder="Postal Code" value={values.postalCode || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdLocationOn} label="Country">
                              <Input name="country" placeholder="Country" value={values.country || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                          </div>
                        )}

                        {/* Tax Info Tab */}
                        {activeTab === 'taxInfo' && (
                          <div className="grid grid-cols-2 gap-3">
                            <FieldGroup icon={MdReceipt} label="NTN">
                              <Input name="ntn" placeholder="NTN" value={values.ntn || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdReceipt} label="STN">
                              <Input name="stn" placeholder="STN" value={values.stn || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <div className="col-span-2">
                              <FieldGroup icon={MdBadge} label="CNIC">
                                <Input name="cnic" placeholder="xxxxx-xxxxxxx-x" value={values.cnic || ''}
                                  changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                              </FieldGroup>
                            </div>
                          </div>
                        )}

                        {/* Area Assignment Tab */}
                        {activeTab === 'areaAssignment' && (
                          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            {newSalesPerson.assignedArea && newSalesPerson.assignedArea.length > 0 ? (
                              <div className="mb-4">
                                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3">
                                  <div>
                                    <p className="text-emerald-800 font-semibold text-sm">Area Assigned</p>
                                    <p className="text-emerald-600 text-xs mt-0.5">
                                      {Array.isArray(newSalesPerson.assignedArea[0])
                                        ? newSalesPerson.assignedArea.reduce((acc, poly) => acc + (Array.isArray(poly) ? poly.length : 0), 0)
                                        : newSalesPerson.assignedArea.length} boundary points defined
                                    </p>
                                  </div>
                                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                                </div>
                                <div className="max-h-28 overflow-y-auto bg-white p-2 rounded-xl border border-gray-100 text-xs text-gray-500">
                                  {Array.isArray(newSalesPerson.assignedArea[0])
                                    ? newSalesPerson.assignedArea.map((poly, pIndex) => (
                                        <div key={pIndex} className="mb-1">
                                          <span className="font-medium text-gray-700">Area {pIndex + 1}: </span>
                                          {poly.map((point, i) => (
                                            <span key={i}>({Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}){i < poly.length - 1 ? ' · ' : ''}</span>
                                          ))}
                                        </div>
                                      ))
                                    : newSalesPerson.assignedArea.map((point, i) => (
                                        <span key={i}>({Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}){i < newSalesPerson.assignedArea.length - 1 ? ' · ' : ''}</span>
                                      ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full flex-shrink-0" />
                                <div>
                                  <p className="text-amber-800 font-semibold text-sm">No Area Assigned</p>
                                  <p className="text-amber-600 text-xs mt-0.5">Click "Assign Area" to define the sales territory</p>
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setAreaSelectorVisible(true)}
                                className="flex items-center gap-2 bg-[#FF5934] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#e54d2b] transition-colors"
                              >
                                <MdMap size={15} />
                                {newSalesPerson.assignedArea.length > 0 ? 'Edit Area' : 'Assign Area'}
                              </button>
                              {newSalesPerson.assignedArea && newSalesPerson.assignedArea.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => { setNewSalesPerson(prev => ({ ...prev, assignedArea: [] })); changeHandler('assignedArea', [], setFieldValue); }}
                                  className="flex items-center gap-2 bg-red-50 text-red-500 border border-red-100 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                                >
                                  <MdDelete size={15} />
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Salary Info Tab */}
                        {activeTab === 'salaryInfo' && (
                          <div className="grid grid-cols-2 gap-3">
                            <FieldGroup icon={MdAttachMoney} label="Basic Salary">
                              <Input name="basicSalary" type="number" placeholder="0.00" value={values.basicSalary || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdAttachMoney} label="Allowance Distance (km)">
                              <Input name="allowanceDistance" type="number" placeholder="0" value={values.allowanceDistance || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdAttachMoney} label="Daily Allowance">
                              <Input name="dailyAllowance" type="number" placeholder="0.00" value={values.dailyAllowance || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdAttachMoney} label="Misc. Allowance">
                              <Input name="miscellaneousAllowance" type="number" placeholder="0.00" value={values.miscellaneousAllowance || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                          </div>
                        )}

                        {/* Timeslot Tab */}
                        {activeTab === 'timeslot' && (
                          <div className="grid grid-cols-2 gap-3">
                            <FieldGroup icon={MdAccessTime} label="Check In Time">
                              <Input name="checkInTime" type="time" placeholder="HH:MM" value={values.checkInTime || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                            <FieldGroup icon={MdAccessTime} label="Check Out Time">
                              <Input name="checkOutTime" type="time" placeholder="HH:MM" value={values.checkOutTime || ''}
                                changeHandler={(k, v) => changeHandler(k, v, setFieldValue)} className={inputCls} />
                            </FieldGroup>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 mt-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button
                        type="button"
                        onClick={() => { setImageLoading(false); setFormVisible(false); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit()}
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        {newSalesPerson.id ? <><MdEdit size={16} /> Save Changes</> : <><MdPersonAdd size={16} /> Add Sales Person</>}
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
          <div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setSelectedUser(null)}
          >
            <div
              className="modal-card bg-white w-full max-w-[540px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero banner */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute top-4 right-16 w-3 h-3 rounded-full bg-[#FF5934]/40" />
                <div className="relative flex items-start justify-between mb-4">
                  <div>
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Sales Person</span>
                    <p className="text-white/40 text-[11px] font-mono mt-0.5">
                      {selectedUser.salesId ? `ID: ${selectedUser.salesId}` : `#${selectedUser._id.slice(0, 8).toUpperCase()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative flex items-end gap-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={selectedUser.image || placeholder}
                      alt=""
                      className="avatar-ring w-20 h-20 rounded-2xl object-cover ring-4 ring-[#FF5934]/50 shadow-xl"
                      onError={e => { e.target.src = placeholder; }}
                    />
                    <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-[#16213e] shadow-md flex items-center justify-center
                      ${selectedUser.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${selectedUser.isActive ? 'bg-emerald-200' : 'bg-gray-200'}`} />
                    </span>
                  </div>
                  <div className="pb-1 min-w-0">
                    <h3 className="text-white text-[18px] font-bold leading-tight truncate">{selectedUser.name}</h3>
                    <p className="text-white/50 text-xs mt-0.5 truncate">{selectedUser.email}</p>
                    <div className="flex gap-2 mt-2">
                      <StatusBadge active={selectedUser.isActive} />
                      <VerifiedBadge verified={selectedUser.isAdminVerified} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="-mt-6 mx-5 grid grid-cols-3 gap-2 z-10 relative">
                {[
                  { label: "Earnings", value: "Rs. 0", color: "text-[#FF5934]" },
                  { label: "Salary", value: selectedUser.basicSalary ? `Rs. ${selectedUser.basicSalary}` : "—", color: "text-[#111827]" },
                  { label: "Area", value: selectedUser.assignedArea?.length > 0 ? "Assigned" : "None", color: selectedUser.assignedArea?.length > 0 ? "text-emerald-600" : "text-[#9CA3AF]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className={`text-[14px] font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info fields */}
              <div className="no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-4" style={{ maxHeight: '60vh' }}>

                {/* Contact Info */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Contact <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: MdPhone, label: "Phone No.", value: selectedUser.phone },
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

                {/* Location Info */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Location <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: MdLocationCity, label: "City", value: selectedUser.city?.name, span: 2 },
                      { icon: MdLocationOn, label: "Address", value: selectedUser.address, span: 2 },
                      { icon: MdLocationOn, label: "Billing Address", value: selectedUser.billingAddress, span: 2 },
                      { icon: MdLocationCity, label: "Tab City", value: selectedUser.cityTab },
                      { icon: MdLocationOn, label: "Province", value: selectedUser.province },
                      { icon: MdLocationOn, label: "Postal Code", value: selectedUser.postalCode },
                      { icon: MdLocationOn, label: "Country", value: selectedUser.country },
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

                {/* Tax Info */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Tax Info <span className="flex-1 border-t border-gray-100" />
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: MdReceipt, label: "NTN", value: selectedUser.ntn },
                      { icon: MdReceipt, label: "STN", value: selectedUser.stn },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-start gap-2.5 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                        <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon size={13} className="text-[#FF5934]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                          <p className="text-[13px] font-medium mt-0.5 text-[#374151]">
                            {value || <span className="text-gray-300 italic text-[12px]">N/A</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Salary Info */}
                {(selectedUser.basicSalary || selectedUser.dailyAllowance || selectedUser.miscellaneousAllowance || selectedUser.allowanceDistance) && (
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" /> Salary <span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Basic Salary", value: selectedUser.basicSalary ? `Rs. ${selectedUser.basicSalary}` : null },
                        { label: "Distance Allow.", value: selectedUser.allowanceDistance ? `${selectedUser.allowanceDistance} km` : null },
                        { label: "Daily Allowance", value: selectedUser.dailyAllowance ? `Rs. ${selectedUser.dailyAllowance}` : null },
                        { label: "Misc. Allowance", value: selectedUser.miscellaneousAllowance ? `Rs. ${selectedUser.miscellaneousAllowance}` : null },
                      ].filter(f => f.value).map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-2.5 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MdAttachMoney size={13} className="text-[#FF5934]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                            <p className="text-[13px] font-semibold mt-0.5 text-[#111827]">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeslot */}
                {(selectedUser.checkInTime || selectedUser.checkOutTime) && (
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="flex-1 border-t border-gray-100" /> Work Hours <span className="flex-1 border-t border-gray-100" />
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Check In", value: selectedUser.checkInTime },
                        { label: "Check Out", value: selectedUser.checkOutTime },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-start gap-2.5 bg-[#F9FAFB] rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className="w-7 h-7 rounded-lg bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MdAccessTime size={13} className="text-[#FF5934]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{label}</p>
                            <p className="text-[13px] font-semibold mt-0.5 text-[#111827]">
                              {value || <span className="text-gray-300 italic text-[12px]">N/A</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assigned Area */}
                <div>
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="flex-1 border-t border-gray-100" /> Assigned Area <span className="flex-1 border-t border-gray-100" />
                  </p>
                  {selectedUser.assignedArea && selectedUser.assignedArea.length > 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <p className="text-emerald-800 font-semibold text-[13px]">
                          Area Assigned — {Array.isArray(selectedUser.assignedArea[0])
                            ? selectedUser.assignedArea.reduce((acc, poly) => acc + (Array.isArray(poly) ? poly.length : 0), 0)
                            : selectedUser.assignedArea.length} boundary points
                        </p>
                      </div>
                      <div className="max-h-24 overflow-y-auto text-[11px] text-emerald-700 font-mono bg-white/60 rounded-lg p-2">
                        {Array.isArray(selectedUser.assignedArea[0])
                          ? selectedUser.assignedArea.map((poly, pIndex) => (
                              <div key={pIndex} className="mb-1">
                                <span className="font-bold">Area {pIndex + 1}: </span>
                                {poly.slice(0, 3).map((point, i) => (
                                  <span key={i}>({Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}){i < Math.min(poly.length, 3) - 1 ? ' · ' : ''}</span>
                                ))}
                                {poly.length > 3 && <span className="text-emerald-500"> +{poly.length - 3} more</span>}
                              </div>
                            ))
                          : <>
                              {selectedUser.assignedArea.slice(0, 4).map((point, i) => (
                                <span key={i}>({Number(point.lat).toFixed(4)}, {Number(point.lng).toFixed(4)}){i < Math.min(selectedUser.assignedArea.length, 4) - 1 ? ' · ' : ''}</span>
                              ))}
                              {selectedUser.assignedArea.length > 4 && <span className="text-emerald-500"> +{selectedUser.assignedArea.length - 4} more</span>}
                            </>
                        }
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0" />
                      <p className="text-red-500 text-[13px] font-medium">No area assigned</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer actions */}
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button
                  onClick={() => { editHandler(null, selectedUser); setSelectedUser(null); }}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <MdEdit size={15} /> Edit
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={(e) => { deleteHandler(e, selectedUser._id); setSelectedUser(null); }}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                  title="Delete"
                >
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
            <EscapeClose onClose={() => setSelectedUser(null)} />
          </div>
        )}
      </div>

      {/* Area Selector Component */}
      <AreaSelector
        isVisible={isAreaSelectorVisible}
        initialArea={newSalesPerson.assignedArea}
        onAreaChange={(coordinates) => {
          setNewSalesPerson(prev => ({ ...prev, assignedArea: coordinates }));
        }}
        onClose={() => setAreaSelectorVisible(false)}
      />
    </>
  );
};

export default Sales;