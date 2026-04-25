import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { toast } from "react-toastify";
import {
  createCity,
  deleteCity,
  getCities,
  getDatas,
  updateCity,
  updateCityStatus
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError, ROLES } from "../utils";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import ClickOutside from '../Hooks/ClickOutside';
import {
  MdSearch, MdClose, MdEdit, MdDelete, MdAdd, MdRefresh,
  MdLocationOn, MdBadge, MdCalendarToday, MdCheckCircle,
} from 'react-icons/md';

const LIMIT = 10;

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

const Cities = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const [state, setState] = useState({ id: "", locationId: "", name: "" });

  const token = useSelector((state) => state.admin.token);

  useEffect(() => {
    const admin = JSON.parse(sessionStorage.getItem('karyana-admin')) || null;
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
      ? (admin?.user?.city && typeof admin.user.city === 'object'
          ? admin.user.city._id
          : admin?.user?.city || '')
      : '';

    if (isCoordinator && coordinatorCityId) {
      getDatas(`/city/${coordinatorCityId}`)
        .then((res) => {
          setData(res?.data?.data ? [res.data.data] : []);
          setTotalPages(1);
          setLoading(false);
        })
        .catch((err) => { setLoading(false); toast.error(err?.message || 'Failed to load city'); });
      return;
    }

    if (searchTerm.length) {
      getDatas(`/city/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); })
        .catch((err) => toast.error(err.message));
    } else {
      getCities(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const validations = yup.object().shape({
    locationId: yup.string().required("Location ID is required"),
    name: yup.string().required("Name is required"),
  });

  const clearForm = () => setState({ id: "", locationId: "", name: "" });

  const changeHandler = (key, value) => setState((p) => ({ ...p, [key]: value }));

  const deleteHandler = async (id) => {
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteCity(id, token);
      getCities(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
    } catch (error) {
      checkAuthError(error);
      setLoading(false);
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      await updateCityStatus({ ...item, id: item._id, [name]: checked }, token);
      getCities(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (state.id.length) await updateCity({ ...values }, token);
      else await createCity({ ...values }, token);
      getCities(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) {
      setLoading(false);
      checkAuthError(error);
      const msg = error.response?.data?.errors?.[0]?.msg;
      if (msg === 'Location ID must be unique') toast.error('Location ID must be unique');
      else if (msg) toast.error(msg);
      else toast.error(error.message);
    }
  };

  const editHandler = (item) => {
    setShow(true);
    setState({ id: item._id, locationId: item.locationId, name: item.name });
  };

  const addHandler = () => { clearForm(); setShow(true); };

  const searchHandler = (e) => {
    if (e.key !== 'Enter') return;
    if (searchTerm.length) {
      getDatas(`/city/search/${searchTerm}?page=1&limit=${LIMIT}`)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); })
        .catch((err) => toast.error(err.message));
    } else {
      setCurrentPage(1);
      if (currentPage === 1) {
        getCities(1, LIMIT).then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); });
      }
    }
  };

  const refreshData = () => {
    const admin = JSON.parse(sessionStorage.getItem('karyana-admin')) || null;
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
      ? (admin?.user?.city && typeof admin.user.city === 'object' ? admin.user.city._id : admin?.user?.city || '')
      : '';

    if (isCoordinator && coordinatorCityId) {
      getDatas(`/city/${coordinatorCityId}`)
        .then((res) => { setData(res?.data?.data ? [res.data.data] : []); setTotalPages(1); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err?.message || 'Failed to load city'); });
      return;
    }
    setSearchTerm('');
    getCities(1, LIMIT).then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); });
  };

  if (!data || loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .city-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .city-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .city-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .city-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .city-page .action-btn:hover { transform: scale(1.1); }
        .city-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .city-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes cityModalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes cityOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .city-modal-overlay { animation: cityOverlayIn 0.2s ease; }
        .city-modal-card { animation: cityModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .city-no-scroll::-webkit-scrollbar { display: none; }
        .city-no-scroll { scrollbar-width: none; }
      `}</style>

      <div className="city-page">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Locations</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} locations on this page</p>
          </div>
          <button
            onClick={addHandler}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdAdd size={18} /> Add Location
          </button>
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
              placeholder="Search by name…"
            />
            {searchTerm && (
              <button onClick={refreshData} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                <MdClose size={14} />
              </button>
            )}
          </div>
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
                {["Location", "Location ID", "Created On", "Active", "Admin Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((item, index) => (
                <tr
                  key={index}
                  className="table-row cursor-pointer"
                  onClick={() => setSelectedCity(item)}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <MdLocationOn size={16} className="text-[#FF5934]" />
                      </div>
                      <span className="text-[13px] font-semibold text-[#111827]">{item.name}</span>
                    </div>
                  </td>

                  {/* Location ID */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-[12px] font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                      {item.locationId}
                    </span>
                  </td>

                  {/* Created On */}
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#374151]">{new Date(item.createdAt).toLocaleDateString()}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{new Date(item.createdAt).toLocaleTimeString()}</p>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={e => { e.stopPropagation(); updateDataHandler(!item.isActive, "isActive", item); }}
                    >
                      {item.isActive
                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>

                  {/* Admin Verified toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={e => { e.stopPropagation(); updateDataHandler(!item.adminVerified, "adminVerified", item); }}
                    >
                      {item.adminVerified
                        ? <PiToggleRightFill size={26} className="text-blue-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); editHandler(item); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="Edit"
                      >
                        <MdEdit size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteHandler(item._id); }}
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
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdLocationOn size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No locations found</p>
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
            ADD / EDIT MODAL
        ═══════════════════════════════════════ */}
        {show && (
          <div className="city-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="city-modal-card bg-white w-full max-w-[420px] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Gradient header */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {state.id ? 'Editing' : 'New'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {state.id ? 'Edit Location' : 'Add Location'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShow(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik
                enableReinitialize
                initialValues={state}
                validationSchema={validations}
                onSubmit={handleSubmit}
              >
                {() => (
                  <Form className="city-no-scroll overflow-y-auto flex-1 flex flex-col">
                    <div className="px-6 pt-7 pb-6 flex flex-col gap-4">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest flex items-center gap-2">
                        <span className="flex-1 border-t border-gray-100" />Location Details<span className="flex-1 border-t border-gray-100" />
                      </p>
                      <FieldGroup icon={MdBadge} label="Location ID">
                        <Input
                          changeHandler={changeHandler}
                          name="locationId"
                          placeholder="e.g. L101"
                          value={state.locationId}
                          className={inputCls}
                        />
                      </FieldGroup>
                      <FieldGroup icon={MdLocationOn} label="City Name">
                        <Input
                          changeHandler={changeHandler}
                          name="name"
                          placeholder="e.g. Karachi"
                          value={state.name}
                          className={inputCls}
                        />
                      </FieldGroup>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                      >
                        {state.id ? <><MdEdit size={16} /> Save Changes</> : <><MdAdd size={16} /> Add Location</>}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════
            DETAIL MODAL
        ═══════════════════════════════════════ */}
        {selectedCity && (
          <div
            className="city-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setSelectedCity(null)}
          >
            <div
              className="city-modal-card bg-white w-full max-w-[400px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Hero */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between mb-4">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Location Details</span>
                  <button
                    onClick={() => setSelectedCity(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative flex items-end gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#FF5934]/20 border border-[#FF5934]/30 flex items-center justify-center flex-shrink-0">
                    <MdLocationOn size={28} className="text-[#FF5934]" />
                  </div>
                  <div className="pb-1 min-w-0">
                    <h3 className="text-white text-[20px] font-bold leading-tight truncate">{selectedCity.name}</h3>
                    <p className="text-white/40 text-[11px] font-mono mt-0.5">{selectedCity.locationId}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${selectedCity.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedCity.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        {selectedCity.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${selectedCity.adminVerified ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedCity.adminVerified ? 'bg-blue-400' : 'bg-amber-400'}`} />
                        {selectedCity.adminVerified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="-mt-6 mx-5 grid grid-cols-2 gap-2 z-10 relative">
                {[
                  { label: "Location ID", value: selectedCity.locationId },
                  { label: "Created", value: new Date(selectedCity.createdAt).toLocaleDateString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className="text-[13px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="city-no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                {[
                  { icon: MdBadge, label: "Location ID", value: selectedCity.locationId, mono: true },
                  { icon: MdLocationOn, label: "City Name", value: selectedCity.name },
                  { icon: MdCalendarToday, label: "Created On", value: new Date(selectedCity.createdAt).toLocaleDateString() },
                  { icon: MdCheckCircle, label: "Status", value: selectedCity.isActive ? 'Active' : 'Inactive' },
                ].map(({ icon: Icon, label, value, mono }) => (
                  <div key={label} className="flex items-start gap-3 bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon size={15} className="text-[#FF5934]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                      <p className={`text-[13px] text-[#374151] font-medium ${mono ? 'font-mono' : ''}`}>
                        {value || <span className="text-gray-300 italic">Not provided</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button
                  onClick={() => { editHandler(selectedCity); setSelectedCity(null); }}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <MdEdit size={15} /> Edit Location
                </button>
                <button
                  onClick={() => setSelectedCity(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { deleteHandler(selectedCity._id); setSelectedCity(null); }}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                  title="Delete"
                >
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Cities;