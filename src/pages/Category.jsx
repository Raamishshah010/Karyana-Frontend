import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { toast } from "react-toastify";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  getAllCities,
  uploadFile,
  updateCategoryStatus,
  getDatas
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError } from "../utils";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import { Select } from '../components/common/select';
import { Spinner } from '../components/common/spinner';
import ClickOutside from '../Hooks/ClickOutside';
import DragNdrop from '../components/DragDrop';
import EscapeClose from '../components/EscapeClose';
import placeholder from "../../public/placehold.jpg";
import {
  MdSearch, MdClose, MdEdit, MdDelete, MdAdd, MdRefresh,
  MdLocationOn, MdCategory, MdBadge, MdCalendarToday, MdImage,
} from "react-icons/md";

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

const inputCls =
  "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

const Category = () => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [fileUpload, setFileUpload] = useState(false);
  const [cities, setCities] = useState({ isLoaded: false, data: [] });
  const [state, setState] = useState({
    id: "",
    categoryId: "",
    englishName: "",
    urduName: "",
    image: "",
    cityID: ""
  });

  const token = useSelector((state) => state.admin.token);

  useEffect(() => {
    if (searchTerm.length) {
      const link = `/category/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`;
      getDatas(link)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); })
        .catch((err) => toast.error(err.message));
    } else {
      getCategories(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const validations = yup.object().shape({
    categoryId: yup.string().required("Brand ID is required"),
    urduName: yup.string(),
    englishName: yup.string().required("Title in english is required"),
    cityID: yup.string().required("City is required"),
  });

  const clearForm = () => {
    setState({ id: "", categoryId: "", englishName: "", urduName: "", image: "", cityID: "" });
  };

  const changeHandler = async (key, value) => {
    setState((p) => ({ ...p, [key]: value }));
  };

  const deleteHandler = async (id) => {
    if (!window.confirm("Are you sure to delete?")) return;
    try {
      setLoading(true);
      await deleteCategory(id, token);
      getCategories(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
    } catch (error) {
      checkAuthError(error);
      setLoading(false);
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const payload = { ...values };
      if (state.image) payload.image = state.image;
      if (state.id.length) await updateCategory(payload, token);
      else await createCategory(payload, token);
      setLoading(false);
      getCategories(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
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
      setFileUpload(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      setState((p) => ({ ...p, image: res.data.data }));
      setFileUpload(false);
    } catch (error) {
      setFileUpload(false);
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const editHandler = async (item) => {
    if (!cities.isLoaded) {
      const res = await getAllCities();
      setCities({ isLoaded: true, data: res.data.data });
    }
    setShow(true);
    setState({
      id: item._id,
      categoryId: item.categoryId,
      englishName: item.englishName,
      urduName: item.urduName,
      image: item.image,
      cityID: item.cityID?._id,
    });
  };

  const addHandler = async () => {
    if (!cities.isLoaded) {
      const res = await getAllCities();
      setCities({ isLoaded: true, data: res.data.data });
    }
    clearForm();
    setShow(true);
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      await updateCategoryStatus({ ...item, id: item._id, [name]: checked }, token);
      setLoading(false);
      getCategories(currentPage, LIMIT)
        .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
        .catch((err) => { setLoading(false); toast.error(err.message); });
      setShow(false);
      clearForm();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        getDatas(`/category/search/${searchTerm}?page=1&limit=${LIMIT}`)
          .then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); })
          .catch((err) => toast.error(err.message));
      } else {
        setCurrentPage(1);
        if (currentPage === 1) {
          getCategories(1, LIMIT).then((res) => {
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
            setLoading(false);
          });
        }
      }
    }
  };

  const refreshData = () => {
    getCategories(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    });
  };

  if (!data || loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .cat-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .cat-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .cat-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .cat-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .cat-page .action-btn:hover { transform: scale(1.1); }
        .cat-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .cat-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes catModalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes catOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .cat-modal-overlay { animation: catOverlayIn 0.2s ease; }
        .cat-modal-card { animation: catModalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .cat-no-scroll::-webkit-scrollbar { display: none; }
        .cat-no-scroll { scrollbar-width: none; }
        .cat-drag-wrap { width: 100%; min-width: 0; overflow: hidden; }
        .cat-drag-wrap > * { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
      `}</style>

      <div className="cat-page">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Brands</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} brands on this page</p>
          </div>
          <button
            onClick={addHandler}
            className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
          >
            <MdAdd size={18} /> Add Brand
          </button>
        </div>

        {/* ── Filter / Search Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm}
              onChange={e => {
                if (e.target.value.length) setSearchTerm(e.target.value);
                else refreshData();
              }}
              onKeyPress={searchHandler}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search"
              placeholder="Search by title…"
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
                {["Image", "Brand", "Location", "Created On", "Active", "Admin Verified", "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((product, index) => (
                <tr
                  key={index}
                  className="table-row cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  {/* Image */}
                  <td className="px-4 py-3">
                    <img
                      src={product.image || placeholder}
                      alt="Brand"
                      className="w-10 h-10 object-cover rounded-xl ring-2 ring-white shadow-sm border border-gray-100"
                      onError={e => { e.target.src = placeholder; }}
                    />
                  </td>

                  {/* Brand name + ID */}
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-semibold text-[#111827] leading-tight">{product.englishName}</p>
                    <span className="text-[11px] font-mono font-semibold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                      {product.categoryId}
                    </span>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MdLocationOn size={13} className="text-[#9CA3AF] flex-shrink-0" />
                      <span className="text-[13px] text-[#374151]">{product.cityID?.name || '—'}</span>
                    </div>
                  </td>

                  {/* Created On */}
                  <td className="px-4 py-3">
                    <p className="text-[12px] text-[#374151]">{new Date(product.createdAt).toLocaleDateString()}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{new Date(product.createdAt).toLocaleTimeString()}</p>
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={e => { e.stopPropagation(); updateDataHandler(!product.isActive, "isActive", product); }}
                    >
                      {product.isActive
                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>

                  {/* Admin Verified toggle */}
                  <td className="px-4 py-3">
                    <button
                      className="toggle-btn flex items-center"
                      onClick={e => { e.stopPropagation(); updateDataHandler(!product.adminVerified, "adminVerified", product); }}
                    >
                      {product.adminVerified
                        ? <PiToggleRightFill size={26} className="text-blue-500" />
                        : <PiToggleLeftFill size={26} className="text-gray-300" />}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); editHandler(product); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                        title="Edit"
                      >
                        <MdEdit size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteHandler(product._id); }}
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
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdCategory size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No brands found</p>
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
              disabled={totalPages <= currentPage}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <GrFormNext size={16} />
            </button>
          </div>
        </div>


        {/* ═══════════════════════════════════════
            ADD / EDIT MODAL
        ═══════════════════════════════════════ */}
        {show && (
          <div className="cat-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="cat-modal-card bg-white w-full max-w-[460px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Gradient header */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {state.id ? 'Editing Brand' : 'New Brand'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {state.id ? 'Edit Brand' : 'Add Brand'}
                    </h2>
                  </div>
                  <button
                    onClick={() => { setFileUpload(false); setShow(false); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5"
                  >
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={state} validationSchema={validations} onSubmit={handleSubmit} enableReinitialize>
                {() => (
                  <Form className="cat-no-scroll overflow-y-auto flex-1 flex flex-col">

                    {/* Image upload card */}
                    <div className="px-6 mt-7 mb-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img
                              src={state.image || '/Avatar.svg'}
                              alt="Preview"
                              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md"
                              onError={e => { e.target.src = '/Avatar.svg'; }}
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
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[13px] font-semibold text-[#111827] mb-0.5">Brand Image</p>
                            <p className="text-[11px] text-[#9CA3AF] mb-2">JPG, PNG up to 5MB</p>
                            {fileUpload ? (
                              <div className="flex items-center gap-2 text-[#FF5934] text-xs font-medium">
                                <Spinner /> Uploading…
                              </div>
                            ) : (
                              <div className="cat-drag-wrap">
                                <DragNdrop onFilesSelected={fileUploadHandler} width="100%" height="36px" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="px-6 pb-6 flex flex-col gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />Brand Identity<span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="flex flex-col gap-3">
                          <FieldGroup icon={MdBadge} label="Category ID">
                            <Input
                              name="categoryId"
                              placeholder="Enter unique brand ID"
                              changeHandler={changeHandler}
                              value={state.categoryId}
                              className={inputCls}
                            />
                          </FieldGroup>
                          <FieldGroup icon={MdCategory} label="English Name">
                            <Input
                              name="englishName"
                              placeholder="Name in English"
                              changeHandler={changeHandler}
                              className={inputCls}
                            />
                          </FieldGroup>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />Classification<span className="flex-1 border-t border-gray-100" />
                        </p>
                        <FieldGroup icon={MdLocationOn} label="Location">
                          <Select
                            name="cityID"
                            data={cities.data}
                            searchKey="_id"
                            searchValue="name"
                            value={state.cityID}
                            changeHandler={changeHandler}
                            className={inputCls}
                          />
                        </FieldGroup>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button
                        type="button"
                        onClick={() => { setFileUpload(false); setShow(false); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2"
                      >
                        {state.id ? <><MdEdit size={16} /> Save Changes</> : <><MdAdd size={16} /> Add Brand</>}
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
        {selectedProduct && (
          <div
            className="cat-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setSelectedProduct(null)}
          >
            <div
              className="cat-modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >

              {/* Hero */}
              <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                <div className="relative flex items-start justify-between mb-4">
                  <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Brand Details</span>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  >
                    <MdClose size={15} />
                  </button>
                </div>
                <div className="relative flex items-end gap-4">
                  <img
                    src={selectedProduct.image || placeholder}
                    alt=""
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-[#FF5934]/50 shadow-xl flex-shrink-0"
                    onError={e => { e.target.src = placeholder; }}
                  />
                  <div className="pb-1 min-w-0">
                    <h3 className="text-white text-[18px] font-bold leading-tight truncate">{selectedProduct.englishName}</h3>
                    <p className="text-white/40 text-[11px] font-mono mt-0.5">{selectedProduct.categoryId}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${selectedProduct.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedProduct.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                        {selectedProduct.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                        ${selectedProduct.adminVerified ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${selectedProduct.adminVerified ? 'bg-blue-400' : 'bg-amber-400'}`} />
                        {selectedProduct.adminVerified ? 'Verified' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats strip */}
              <div className="-mt-6 mx-5 grid grid-cols-2 gap-2 z-10 relative">
                {[
                  { label: "Category ID", value: selectedProduct.categoryId },
                  { label: "City", value: selectedProduct.cityID?.name || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                    <p className="text-[13px] font-bold text-[#FF5934] truncate">{value}</p>
                    <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Info rows */}
              <div className="cat-no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                {[
                  { icon: MdBadge, label: "Category ID", value: selectedProduct.categoryId, mono: true },
                  { icon: MdLocationOn, label: "Location", value: selectedProduct.cityID?.name },
                  { icon: MdCalendarToday, label: "Created On", value: new Date(selectedProduct.createdAt).toLocaleDateString() },
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
                  onClick={() => { editHandler(selectedProduct); setSelectedProduct(null); }}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100"
                >
                  <MdEdit size={15} /> Edit Brand
                </button>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => { deleteHandler(selectedProduct._id); setSelectedProduct(null); }}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                  title="Delete"
                >
                  <MdDelete size={16} />
                </button>
              </div>

              <EscapeClose onClose={() => setSelectedProduct(null)} />
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default Category;