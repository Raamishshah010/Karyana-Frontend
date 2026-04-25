import { useEffect, useState } from 'react';
import User from './User';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { createCoordinator, deleteCoordinator, getAllCities, getDatas, getCoordinators, updateCoordinator, updateCoordinatorStatus, uploadFile } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Spinner } from '../common/spinner';
import { Textarea } from '../common/textArea';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import { MdSearch, MdFilterList, MdClose, MdEdit, MdDelete, MdPersonAdd, MdRefresh } from "react-icons/md";
import ClickOutside from '../../Hooks/ClickOutside';
import DragNdrop from '../DragDrop';

/* ── tiny badge ── */
const StatusBadge = ({ active }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
      ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const VerifiedBadge = ({ verified }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold
      ${verified ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-500'}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${verified ? 'bg-blue-500' : 'bg-amber-400'}`} />
    {verified ? 'Verified' : 'Pending'}
  </span>
);

const Coordinators = () => {
  const [limit, setLimit] = useState(10);
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
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [state, setState] = useState({
    id: "", name: "", email: "", password: "", phone: "",
    address: "", image: "", cnic: "", city: ""
  });

  const token = useSelector((state) => state.admin.token);

  const validations = yup.object().shape({
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    address: yup.string().required("Address is required"),
    cnic: yup.string().matches("^[0-9]{5}-[0-9]{7}-[0-9]$", 'cnic is not valid e.g xxxxx-xxxxxxx-x').required(),
    password: yup.string().min(6).required(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "phone number is not valid").required(),
  });

  useEffect(() => {
    setLoading(true);
    const link = `/coordinator/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
      setLoading(false);
      setTotalPages(res.data.totalPages);
    }).catch((err) => {
      setLoading(false);
      toast.error(err.message);
    });
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);

  useEffect(() => {
    if (!cities.isLoaded) {
      getAllCities().then(res => {
        setCities({ isLoaded: true, data: res.data.data });
      }).catch(err => console.log("Loading cities: ", err.message));
    }
  }, [cities.isLoaded]);

  const clearForm = () => setState({ id: "", name: "", email: "", password: "", phone: "", address: "", image: "", cnic: "", city: "" });

  const changeHandler = async (key, value) => setState(p => ({ ...p, [key]: value }));

  const deleteHandler = async (id) => {
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteCoordinator(id, token);
      getCoordinators(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
    } catch (error) { checkAuthError(error); toast.error(error.message); }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (state.id.length) {
        await updateCoordinator({ ...values, image: state.image }, token);
      } else {
        await createCoordinator({ ...values, image: state.image }, token);
      }
      setLoading(false);
      getCoordinators(currentPage, limit).then((res) => {
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
    } catch (error) { setImageLoading(false); checkAuthError(error); toast.error(error.message); }
  };

  const editHandler = async (item) => {
    setShow(true);
    setState({ id: item._id, name: item.name, email: item.email, password: item.password, phone: item.phone, address: item.address, image: item.image, cnic: item.cnic, city: item.city?._id });
  };

  const updateDataHandler = async (check, name, item) => {
    try {
      setLoading(true);
      await updateCoordinatorStatus({ ...item, id: item._id, [name]: check }, token);
      const toggledLabel = name === 'isAdminVerified' ? 'Admin Verified' : 'Active';
      toast.success(`${toggledLabel} ${check ? 'enabled' : 'disabled'}`);
      setLoading(false);
      getCoordinators(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) { checkAuthError(error); toast.error(error.message); }
  };

  const citySelectHandler = (e) => {
    setSelectedCityId(e.target.value?.length ? e.target.value : "");
    if (!e.target.value?.length) setCurrentPage(1);
  };

  const statusSelectHandler = (e) => {
    setSelectedMaritalStatus(e.target.value?.length ? e.target.value === USER_STATUSES[0] : "");
    if (!e.target.value?.length) setCurrentPage(1);
  };

  const refreshData = () => {
    setSearchTerm("");
    setLoading(true);
    const link = `/coordinator/search?page=1&limit=${limit}&searchTerm=&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    }).catch((err) => { setLoading(false); toast.error(err.message); });
  };

  const searchHandler = (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      const link = `/coordinator/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      }).catch((err) => { setLoading(false); toast.error(err.message); });
    }
  };

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .coord-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .coord-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .coord-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .coord-page .filter-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
          padding-right: 28px;
        }
        .coord-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .coord-page .action-btn:hover { transform: scale(1.08); }
        .coord-page .slide-panel { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
        .coord-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .coord-page .toggle-btn:hover { opacity: 0.8; }
      `}</style>

      <div className="coord-page">
        <User />

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Coordinators</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} coordinators found</p>
          </div>
          <button
            onClick={() => { clearForm(); setShow(true); }}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdPersonAdd size={18} />
            Add Coordinator
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          {/* Search */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => { if (e.target.value.length) { setSearchTerm(e.target.value); } else { refreshData(); } }}
              onKeyPress={searchHandler}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by name…"
            />
            {searchTerm && (
              <button onClick={refreshData} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                <MdClose size={14} />
              </button>
            )}
          </div>

          {/* City filter */}
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select
              value={selectedCityId}
              onChange={citySelectHandler}
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
              value={selectedMaritalStatus}
              onChange={statusSelectHandler}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
            >
              <option value="">All Status</option>
              {USER_STATUSES.map(status => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#FF5934] px-3 py-2 rounded-xl hover:bg-orange-50 transition-all duration-200"
          >
            <MdRefresh size={16} />
            Reset
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                {["Coordinator", "ID", "Phone", "CNIC", "Earnings", "Active", "Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((item, index) => (
                <tr key={index} className="table-row">
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

                  {/* Earning */}
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">
                    Rs. 0
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center gap-2"
                      onClick={() => updateDataHandler(!item.isActive, "isActive", item)}
                      title={item.isActive ? "Click to deactivate" : "Click to activate"}
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
                      className="toggle-btn flex items-center gap-2"
                      onClick={() => updateDataHandler(!item.isAdminVerified, "isAdminVerified", item)}
                      title={item.isAdminVerified ? "Click to unverify" : "Click to verify"}
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
                      {/* View */}
                      <button
                        onClick={() => setSelectedUser(item)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100"
                        title="View"
                      >
                        <FaRegEye size={14} />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => editHandler(item)}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="Edit"
                      >
                        <MdEdit size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteHandler(item._id)}
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
                      <p className="text-[#9CA3AF] text-sm font-medium">No coordinators found</p>
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
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <GrFormNext size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9CA3AF]">Rows per page</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
              className="filter-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* ── Add / Edit Modal ── */}
        {show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-[380px] max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-[16px] font-bold text-[#111827]">
                    {state.id ? 'Edit Coordinator' : 'Add Coordinator'}
                  </h2>
                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                    {state.id ? 'Update coordinator details' : 'Fill in the details below'}
                  </p>
                </div>
                <button
                  onClick={() => { setImageLoading(false); setShow(false); }}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#6B7280] transition-colors"
                >
                  <MdClose size={16} />
                </button>
              </div>

              <Formik initialValues={state} validationSchema={validations} onSubmit={handleSubmit}>
                {() => (
                  <Form className="overflow-y-auto flex-1 px-6 py-4" style={{ scrollbarWidth: 'none' }}>
                    {/* Profile Image */}
                    <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide mb-2">Profile Image</p>
                    <div className="relative flex border-2 border-dashed border-gray-200 hover:border-[#FF5934]/40 flex-col justify-center items-center p-4 rounded-xl mb-5 bg-gray-50 transition-colors h-[180px]">
                      {state.image ? (
                        <img src={state.image} alt="Preview" className="w-16 h-16 rounded-full object-cover mb-3 ring-4 ring-white shadow-md" />
                      ) : (
                        <img src="/Avatar.svg" alt="Default" className="w-16 h-16 rounded-full object-cover mb-3 opacity-40" />
                      )}
                      {imageLoading ? <Spinner /> : <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height="100%" />}
                    </div>

                    <div className="flex flex-col gap-3">
                      <Input name="name" label="Name" placeholder="Full name" changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors" />

                      <Input name="email" type="email" placeholder="Email address" label="Email" disabled={state.id.length} changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors disabled:opacity-60" />

                      {!state.id && (
                        <Input name="password" type="password" placeholder="Min. 6 characters" label="Password" changeHandler={changeHandler}
                          className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors" />
                      )}

                      <Input name="phone" placeholder="+923001234567" label="Phone" changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors" />

                      <Input name="cnic" placeholder="xxxxx-xxxxxxx-x" label="CNIC" changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors" />

                      <Select name="city" label="City" data={cities.data} searchKey="_id" searchValue="name" value={state.city} changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors" />

                      <Textarea name="address" placeholder="Full address" label="Address" changeHandler={changeHandler}
                        className="bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 mt-1 rounded-xl w-full outline-none text-sm transition-colors resize-none" />
                    </div>

                    {/* Modal Footer */}
                    <div className="flex gap-3 border-t border-gray-100 pt-4 mt-5">
                      <button
                        type="button"
                        onClick={() => { setImageLoading(false); setShow(false); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold shadow-md shadow-orange-100 transition-all duration-200"
                      >
                        {state.id ? 'Save Changes' : 'Add Coordinator'}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}

        {/* ── Detail Slide Panel ── */}
        <div className={`slide-panel fixed top-0 right-0 h-full w-[320px] bg-white shadow-2xl z-40 border-l border-gray-100
          ${selectedUser ? 'translate-x-0' : 'translate-x-full'}`}
        >
          {selectedUser && (
            <div className="flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-[15px] font-bold text-[#111827]">Coordinator Details</h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-[#6B7280] transition-colors"
                >
                  <MdClose size={15} />
                </button>
              </div>

              {/* Profile */}
              <div className="flex flex-col items-center py-6 px-5 border-b border-gray-100 bg-gradient-to-b from-orange-50/30 to-white">
                <div className="relative mb-3">
                  <img
                    src={selectedUser.image || '/Avatar.svg'}
                    alt=""
                    className="w-20 h-20 rounded-2xl object-cover shadow-md ring-4 ring-white"
                    onError={e => { e.target.src = '/Avatar.svg'; }}
                  />
                  <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${selectedUser.isActive ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                </div>
                <h3 className="text-[16px] font-bold text-[#111827] text-center">{selectedUser.name}</h3>
                <p className="text-sm text-[#9CA3AF] mt-0.5 text-center">{selectedUser.email}</p>
                <div className="flex gap-2 mt-3">
                  <StatusBadge active={selectedUser.isActive} />
                  <VerifiedBadge verified={selectedUser.isAdminVerified} />
                </div>
              </div>

              {/* Info Fields */}
              <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'none' }}>
                {[
                  { label: "Phone Number", value: selectedUser.phone },
                  { label: "CNIC", value: selectedUser.cnic },
                  { label: "City", value: selectedUser.city?.name },
                  { label: "Address", value: selectedUser.address },
                ].map(({ label, value }) => (
                  <div key={label} className="mb-4 pb-4 border-b border-gray-50 last:border-0">
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-[13px] text-[#374151] font-medium">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Panel Footer */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => { editHandler(selectedUser); setSelectedUser(null); }}
                  className="flex-1 h-10 rounded-xl bg-[#FF5934]/10 hover:bg-[#FF5934]/20 text-[#FF5934] text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <MdEdit size={15} /> Edit
                </button>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Overlay for slide panel */}
        {selectedUser && (
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setSelectedUser(null)}
          />
        )}
      </div>
    </>
  );
};

export default Coordinators;