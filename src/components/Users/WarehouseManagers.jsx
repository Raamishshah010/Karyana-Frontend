import { useEffect, useState } from 'react';
import User from './User';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import {
  createWarehouseManager, deleteWarehouseManagers, getAllCities, getDatas,
  getWarehouseManagers, updateWarehouseManager, updateWarehouseManagerStatus, uploadFile
} from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Spinner } from '../common/spinner';
import { Textarea } from '../common/textArea';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import {
  MdSearch, MdFilterList, MdClose, MdEdit, MdDelete,
  MdPersonAdd, MdRefresh, MdPhone, MdLocationOn,
  MdBadge, MdEmail, MdLock, MdPerson, MdLocationCity
} from "react-icons/md";
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import { useFilters } from '../../context/FilterContext';

/* ── Module key — unique per page ── */
const MODULE = 'warehouseManagers';

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

const WarehouseManagers = () => {
  /* ── Persistent filter state ── */
  const { getFilters, setFilters, clearFilters, getFilterCount } = useFilters();
  const savedFilters = getFilters(MODULE);

  const [limit, setLimit] = useState(savedFilters.limit ?? 10);
  const [currentPage, setCurrentPage] = useState(savedFilters.currentPage ?? 1);
  const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? '');
  const [selectedCityId, setSelectedCityId] = useState(savedFilters.selectedCityId ?? '');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState(savedFilters.selectedStatus ?? '');

  /* ── Other local state ── */
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [state, setState] = useState({
    id: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: ""
  });

  const token = useSelector((state) => state.admin.token);
  const filterCount = getFilterCount(MODULE);

  /* ── Persist filter changes to context ── */
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
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    address: yup.string().required("Address is required"),
    cnic: yup.string().matches("^[0-9]{5}-[0-9]{7}-[0-9]$", 'cnic is not valid e.g xxxxx-xxxxxxx-x').required(),
    password: yup.string().min(6).required(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "phone number is not valid e.g +923333333333").required(),
  });

  /* ── Fetch data ── */
  useEffect(() => {
    setLoading(true);
    const link = `/warehouse-manager/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
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

  /* ── Form helpers ── */
  const clearForm = () => setState({
    id: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: ""
  });

  const changeHandler = async (key, value) => setState(p => ({ ...p, [key]: value }));

  /* ── CRUD ── */
  const deleteHandler = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteWarehouseManagers(id, token);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (state.id.length) {
        await updateWarehouseManager({ ...values, image: state.image }, token);
      } else {
        await createWarehouseManager({ ...values, image: state.image }, token);
      }
      setLoading(false);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) {
      setLoading(false);
      checkAuthError(error);
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };

  const fileUploadHandler = async (files) => {
    if (!files[0]) return;
    try {
      setImageLoading(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      setState(p => ({ ...p, image: res.data.data }));
      setImageLoading(false);
    } catch (error) {
      setImageLoading(false);
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const editHandler = (e, item) => {
    if (e) e.stopPropagation();
    setShow(true);
    setState({
      id: item._id, name: item.name, email: item.email, password: item.password,
      phone: item.phone, address: item.address, image: item.image,
      cnic: item.cnic, city: item.city?._id
    });
  };

  const updateDataHandler = async (e, check, name, item) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await updateWarehouseManagerStatus({ ...item, id: item._id, [name]: check }, token);
      const toggledLabel = name === 'isAdminVerified' ? 'Admin Verified' : 'Active';
      toast.success(`${toggledLabel} ${check ? 'enabled' : 'disabled'}`);
      setLoading(false);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
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
    const link = `/warehouse-manager/search?page=${currentPage}&limit=${limit}&searchTerm=${term}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link)
      .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedCityId('');
    setSelectedMaritalStatus('');
    setCurrentPage(1);
    clearFilters(MODULE);
    setLoading(true);
    getDatas(`/warehouse-manager/search?page=1&limit=${limit}&searchTerm=&city=&status=`)
      .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
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
        .wm-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .wm-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .wm-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .wm-page .filter-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .wm-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .wm-page .action-btn:hover { transform: scale(1.1); }
        .wm-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .wm-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .modal-overlay { animation: overlayIn 0.2s ease; }
        .modal-card    { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        @keyframes ringPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,89,52,0.3); }
          50%       { box-shadow: 0 0 0 8px rgba(255,89,52,0); }
        }
        .avatar-ring { animation: ringPulse 2.5s ease-in-out infinite; }
        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; }
        .drag-drop-wrapper {
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }
        .drag-drop-wrapper > * {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
      `}</style>

      <div className="wm-page">
        <User />

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Warehouse Managers</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} managers found</p>
          </div>
          <button
            onClick={() => { clearForm(); setShow(true); }}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdPersonAdd size={18} />
            Add Warehouse Manager
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
                {["Manager", "ID", "Phone", "CNIC", "Earnings", "Active", "Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((item, index) => (
                <tr
                  key={index}
                  className="table-row cursor-pointer"
                  onClick={() => setSelectedUser(item)}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <img
                          src={item.image || '/Avatar.svg'}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-white shadow-sm"
                          onError={e => { e.target.src = '/Avatar.svg'; }}
                        />
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${item.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827] leading-tight">{item.name}</p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5">{item.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                      #{item._id.slice(0, 6).toUpperCase()}
                    </span>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 text-[13px] text-[#374151]">{item.phone}</td>

                  {/* CNIC */}
                  <td className="px-4 py-3 text-[13px] text-[#374151] font-mono">{item.cnic}</td>

                  {/* Earnings */}
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">Rs. 0</td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={(e) => updateDataHandler(e, !item.isActive, "isActive", item)}
                      title={item.isActive ? "Deactivate" : "Activate"}
                    >
                      {item.isActive
                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />
                      }
                    </button>
                  </td>

                  {/* Verified toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={(e) => updateDataHandler(e, !item.isAdminVerified, "isAdminVerified", item)}
                      title={item.isAdminVerified ? "Unverify" : "Verify"}
                    >
                      {item.isAdminVerified
                        ? <PiToggleRightFill size={26} className="text-blue-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />
                      }
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(item); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100"
                        title="View"
                      >
                        <FaRegEye size={14} />
                      </button>
                      <button
                        onClick={(e) => editHandler(e, item)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="Edit"
                      >
                        <MdEdit size={14} />
                      </button>
                      <button
                        onClick={(e) => deleteHandler(e, item._id)}
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
                      <p className="text-[#9CA3AF] text-sm font-medium">No warehouse managers found</p>
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
        {show && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[480px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Decorative header band */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {state.id ? 'Editing Profile' : 'New Profile'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {state.id ? 'Edit Warehouse Manager' : 'Add Warehouse Manager'}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setImageLoading(false); setShow(false); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={state} validationSchema={validations} onSubmit={handleSubmit}>
                {() => (
                  <Form className="no-scroll overflow-y-auto flex-1 flex flex-col">

                    {/* ── Avatar upload card ── */}
                    <div className="px-6 mt-7 mb-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                        <div className="flex items-start gap-4 min-w-0">
                          {/* Avatar preview */}
                          <div className="relative flex-shrink-0">
                            <img
                              src={state.image || '/Avatar.svg'}
                              alt="Preview"
                              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md"
                            />
                            {state.image && (
                              <button
                                type="button"
                                onClick={() => setState(p => ({ ...p, image: "" }))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow"
                              >
                                <MdClose size={11} />
                              </button>
                            )}
                          </div>
                          {/* Right side */}
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

                    {/* Form Fields */}
                    <div className="px-6 pb-6 flex flex-col gap-4">

                      {/* Personal */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />
                          Personal Information
                          <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <FieldGroup icon={MdPerson} label="Full Name">
                              <Input name="name" placeholder="e.g. Ahmed Khan" changeHandler={changeHandler}
                                className={inputCls} />
                            </FieldGroup>
                          </div>
                          <FieldGroup icon={MdEmail} label="Email Address">
                            <Input name="email" type="email" placeholder="name@company.com" disabled={!!state.id} changeHandler={changeHandler}
                              className={`${inputCls} ${state.id ? 'opacity-50 cursor-not-allowed' : ''}`} />
                          </FieldGroup>
                          {!state.id && (
                            <FieldGroup icon={MdLock} label="Password">
                              <Input name="password" type="password" placeholder="Min. 6 chars" changeHandler={changeHandler}
                                className={inputCls} />
                            </FieldGroup>
                          )}
                        </div>
                      </div>

                      {/* Contact */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />
                          Contact & Identity
                          <span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdPhone} label="Phone Number">
                            <Input name="phone" placeholder="+923001234567" changeHandler={changeHandler}
                              className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdBadge} label="CNIC">
                            <Input name="cnic" placeholder="xxxxx-xxxxxxx-x" changeHandler={changeHandler}
                              className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdLocationCity} label="City">
                            <Select name="city" data={cities.data} searchKey="_id" searchValue="name" value={state.city} changeHandler={changeHandler}
                              className={inputCls} />
                          </FieldGroup>
                          <div className="col-span-2">
                            <FieldGroup icon={MdLocationOn} label="Address">
                              <Textarea name="address" placeholder="Full warehouse address" changeHandler={changeHandler}
                                className={`${inputCls} resize-none`} />
                            </FieldGroup>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button
                        type="button"
                        onClick={() => { setImageLoading(false); setShow(false); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        {state.id ? <><MdEdit size={16} /> Save Changes</> : <><MdPersonAdd size={16} /> Add Manager</>}
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
              className="modal-card bg-white w-full max-w-[440px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero banner */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="absolute top-4 right-16 w-3 h-3 rounded-full bg-[#FF5934]/40" />

                <div className="relative flex items-start justify-between mb-4">
                  <div>
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Warehouse Manager</span>
                    <p className="text-white/40 text-[11px] font-mono mt-0.5">
                      #{selectedUser._id.slice(0, 8).toUpperCase()}
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
                      src={selectedUser.image || '/Avatar.svg'}
                      alt=""
                      className="avatar-ring w-20 h-20 rounded-2xl object-cover ring-4 ring-[#FF5934]/50 shadow-xl"
                      onError={e => { e.target.src = '/Avatar.svg'; }}
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
                  { label: "Orders", value: "—", color: "text-[#111827]" },
                  { label: "Rating", value: "—", color: "text-[#111827]" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className={`text-[15px] font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info fields */}
              <div className="no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                {[
                  { icon: MdPhone, label: "Phone Number", value: selectedUser.phone },
                  { icon: MdBadge, label: "CNIC", value: selectedUser.cnic, mono: true },
                  { icon: MdLocationCity, label: "City", value: selectedUser.city?.name },
                  { icon: MdLocationOn, label: "Address", value: selectedUser.address },
                ].map(({ icon: Icon, label, value, mono }) => (
                  <div key={label} className="flex items-start gap-3 bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={15} className="text-[#FF5934]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                      <p className={`text-[13px] text-[#374151] font-medium break-words ${mono ? 'font-mono' : ''}`}>
                        {value || <span className="text-gray-300 italic">Not provided</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button
                  onClick={() => { editHandler(null, selectedUser); setSelectedUser(null); }}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <MdEdit size={15} /> Edit Manager
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
    </>
  );
};

export default WarehouseManagers;