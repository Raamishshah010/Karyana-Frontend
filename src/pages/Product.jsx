import { useCallback, useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { toast } from "react-toastify";
import { FaRegEye } from "react-icons/fa6";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import {
  createProduct, deleteProduct, bulkDeleteProducts, getProducts,
  updateProduct, uploadFile, getAllCities, updateProductStatus,
  getDatas, getAllCategories, getAllBrands, getCityCategories,
  getCategoryBrands, getBrand,
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError, ROLES } from "../utils";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import { Select } from '../components/common/select';
import { Textarea } from '../components/common/textArea';
import { Spinner } from '../components/common/spinner';
import ClickOutside from '../Hooks/ClickOutside';
import {
  MdSearch, MdClose, MdEdit, MdDelete, MdAdd, MdRefresh,
  MdFilterList, MdFileUpload, MdFileDownload, MdInventory2,
  MdImage, MdCategory, MdBrandingWatermark, MdLocationOn,
  MdLocalOffer, MdWarehouse, MdNumbers,
} from "react-icons/md";
import { FaFileImport, FaFileExport, FaMinus, FaPlus } from "react-icons/fa";
import DragNdrop from '../components/DragDrop';
import EscapeClose from '../components/EscapeClose';
import * as XLSX from 'xlsx';
import placeholder from '../assets/placehold.jpg';

/* ── Reusable field wrapper ── */
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

const Product = () => {
  const [limit, setLimit] = useState(10);
  const admin = useSelector((state) => state.admin);
  const isCoordinator = admin?.role?.includes(ROLES[1]);
  const coordinatorCityId = isCoordinator
    ? (admin?.user?.city && typeof admin.user.city === 'object' ? admin.user.city._id : admin?.user?.city || '')
    : '';

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stock, setStock] = useState(0);
  const [stockModal, setStockModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [showDropdown, setShowDropdown] = useState("");
  const [fileUpload, setFileUpload] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState(coordinatorCityId);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [formCategories, setFormCategories] = useState({ isLoaded: false, data: [] });
  const [formBrands, setFormBrands] = useState({ isLoaded: false, data: [] });
  const [categories, setCategories] = useState({ isLoaded: false, data: [] });
  const [brands, setBrands] = useState({ isLoaded: false, data: [] });
  const [cities, setCities] = useState({ data: [], isLoaded: false });
  const [showBulkDiscountModal, setShowBulkDiscountModal] = useState(false);
  const [bulkDiscountProduct, setBulkDiscountProduct] = useState(null);
  const [discountRows, setDiscountRows] = useState([{ quantity: '', discount: '', type: 'Percentage' }]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const getBrandCategoryId = (brand) => {
    if (!brand || !brand.categoryID) return null;
    if (typeof brand.categoryID === 'string') return brand.categoryID;
    if (typeof brand.categoryID === 'object') return brand.categoryID._id || null;
    return null;
  };
  const filteredFilterBrands = selectedCategoryId
    ? brands.data.filter((brand) => getBrandCategoryId(brand) === selectedCategoryId)
    : brands.data;

  const getBrandName = (brand) => {
    if (!brand) return '-';
    if (typeof brand === 'string') {
      const found = brands.data.find(b => b._id === brand);
      return found ? found.englishName || found.name || brand : brand;
    }
    return brand.englishName || brand.name || brand._id || '-';
  };
  const getCategoryName = (category) => {
    if (!category) return '-';
    if (typeof category === 'string') {
      const found = categories.data.find(c => c._id === category);
      return found ? found.englishName || found.name || category : category;
    }
    return category.englishName || category.name || category._id || '-';
  };
  const getCityName = (city) => {
    if (!city) return '-';
    if (typeof city === 'string') {
      const found = cities.data.find(c => c._id === city);
      return found ? found.name || city : city;
    }
    return city.name || city._id || '-';
  };
  const memoizedGetBrandName = useCallback((brand) => getBrandName(brand), [brands.data]);
  const memoizedGetCategoryName = useCallback((category) => getCategoryName(category), [categories.data]);

  const [units, setUnits] = useState({ isLoaded: false, data: [] });
  const [bulkOrderIndex, setBulkOrderIndex] = useState(-1);
  const [bulkOrder, setBulkOrder] = useState({ quantity: "", amount: 1 });
  const [state, setState] = useState({
    id: "", productId: "", urduTitle: "", englishTitle: "", urduDescription: "",
    englishDescription: "", image: "", categoryID: "", cityID: "", brandID: "",
    packings: "", bulkOrders: [], discountType: "Percentage", discount: 1,
    stock: 0, cortanSize: 0, purchaseRate: 0, saleRate: 0,
    includeBulkOrder: false, isDiscounted: false, includePacking: false,
  });

  const { token, role } = admin || {};

  useEffect(() => {
    if (isCoordinator && coordinatorCityId && selectedCityId !== coordinatorCityId) {
      setSelectedCityId(coordinatorCityId);
      setCurrentPage(1);
    }
  }, [isCoordinator, coordinatorCityId]);

  const handleDownloadSample = () => {
    try {
      const link = document.createElement('a');
      link.href = '/Book1.xlsx';
      link.download = 'Product_Import_Sample.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Failed to download sample file.');
    }
  };

  const handleExportInventory = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.append('page', 1);
      queryParams.append('limit', 100000);
      if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
      if (selectedCityId) queryParams.append('city', selectedCityId);
      if (selectedBrandId) queryParams.append('brand', selectedBrandId);
      if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
      const link = `/product/search?${queryParams.toString()}`;
      const res = await getDatas(link);
      const products = res.data.data;
      if (!products || products.length === 0) { toast.info("No products found to export"); setLoading(false); return; }
      const exportData = products.map(product => ({
        'Product ID': product.productId || '-',
        'Title (EN)': product.englishTitle || '-',
        'Title (UR)': product.urduTitle || '-',
        'Category': getCategoryName(product.category),
        'Brand': getBrandName(product.brand),
        'City': getCityName(product.cityID),
        'Price': product.price || 0,
        'Purchase Rate': product.purchaseRate || 0,
        'Stock': product.stock || 0,
        'Carton Size': product.cortanSize || 0,
        'Status': product.isActive ? 'Active' : 'Inactive'
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
      XLSX.writeFile(workbook, `Inventory_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Inventory exported successfully");
    } catch (error) {
      toast.error('Failed to export inventory');
    } finally { setLoading(false); }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) { toast.info("Please select products to delete"); return; }
    if (!window.confirm(`Are you sure you want to delete ${selectedProductIds.length} selected products?`)) return;
    try {
      setLoading(true);
      await bulkDeleteProducts(selectedProductIds, token);
      toast.success("Selected products deleted successfully");
      setSelectedProductIds([]);
      setCurrentPage(1);
      const queryParams = new URLSearchParams();
      queryParams.append('page', 1); queryParams.append('limit', limit);
      if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
      if (selectedCityId) queryParams.append('city', selectedCityId);
      if (selectedBrandId) queryParams.append('brand', selectedBrandId);
      if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
      const link = `/product/search?${queryParams.toString()}`;
      const res = await getDatas(link);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      toast.error(error?.response?.data?.msg || 'Failed to delete selected products');
      checkAuthError(error);
    } finally { setLoading(false); }
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === data.length) setSelectedProductIds([]);
    else setSelectedProductIds(data.map(product => product._id));
  };

  const toggleSelectProduct = (id) => {
    if (selectedProductIds.includes(id)) setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    else setSelectedProductIds([...selectedProductIds, id]);
  };

  const validations = yup.object().shape({
    productId: yup.string().required("Product ID is required"),
    brandID: yup.string(), categoryID: yup.string(), cityID: yup.string(),
    stock: yup.number().min(1, "Stock must be at least 1").required("Stock is required"),
    urduTitle: yup.string().required("Title in Urdu is required"),
    englishTitle: yup.string().required("Title in English is required"),
    cortanSize: yup.number().required("Size in carton is required"),
    purchaseRate: yup.number().transform((v) => (isNaN(v) ? undefined : v)).min(0).required("Purchase rate is required"),
    price: yup.number().transform((v) => (isNaN(v) ? undefined : v)).min(0)
      .test("price-test", "Sales rate must be >= purchase rate", function (value) {
        const { purchaseRate } = this.parent;
        return (value === 0 && purchaseRate === 0) || (value !== undefined && purchaseRate !== undefined && value >= purchaseRate);
      }).required("Sales rate is required"),
  });

  const clearForm = () => {
    setState({
      id: "", productId: "", urduTitle: "", englishTitle: "", urduDescription: "",
      englishDescription: "", image: "", categoryID: "", cityID: "", brandID: "",
      packings: "", bulkOrders: [], discountType: "", discount: 1, price: 0,
      stock: 0, cortanSize: 0, purchaseRate: 0, includeBulkOrder: false,
      isDiscounted: false, includePacking: false,
    });
    setFormCategories({ isLoaded: false, data: [] });
    setFormBrands({ isLoaded: false, data: [] });
  };

  useEffect(() => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append('page', currentPage); queryParams.append('limit', limit);
    if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
    if (selectedCityId) queryParams.append('city', selectedCityId);
    if (selectedBrandId) queryParams.append('brand', selectedBrandId);
    if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
    const link = `/product/search?${queryParams.toString()}`;
    getDatas(link).then((res) => { setData(res.data.data); setTotalPages(res.data.totalPages); setLoading(false); })
      .catch((err) => { setLoading(false); toast.error(err?.message || 'An error occurred'); });
  }, [currentPage, limit, debouncedSearchTerm, selectedCityId, selectedCategoryId, selectedBrandId]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await getAllCities();
        setCities({ data: res.data.data, isLoaded: true });
      } catch (error) { toast.error('Failed to load cities data'); }
    };
    fetchCities();
  }, []);

  const populateData = useCallback(async () => {
    if (!cities.isLoaded) {
      getAllCities().then(res => setCities({ isLoaded: true, data: res.data.data }));
    }
    if (!categories.isLoaded) {
      const res = await getAllCategories();
      setCategories({ isLoaded: true, data: res.data.data });
    }
    if (!brands.isLoaded) {
      const res = await getAllBrands();
      setBrands({ isLoaded: true, data: res.data.data });
    }
  }, [brands.isLoaded, categories.isLoaded, cities.isLoaded]);

  useEffect(() => { populateData(); }, [populateData]);

  const deleteBulkOrderItem = (index) => {
    const boCopy = [...state.bulkOrders];
    boCopy.splice(index, 1);
    setState(p => ({ ...p, bulkOrders: boCopy }));
    setBulkOrderIndex(-1);
    setBulkOrder({ quantity: "", amount: 1 });
  };

  const editBuolOrderItem = (index) => {
    const boIndex = [...state.bulkOrders];
    setBulkOrder({ amount: boIndex[index].amount, quantity: boIndex[index].quantity });
    setBulkOrderIndex(index);
  };

  const bulkOrderHandler = () => {
    if (bulkOrder.amount <= 0 || !bulkOrder.quantity.length) return toast.error("All fields are required");
    const c = [...state.bulkOrders];
    if (bulkOrderIndex > -1) { c[bulkOrderIndex].quantity = bulkOrder.quantity; c[bulkOrderIndex].amount = bulkOrder.amount; }
    else c.push(bulkOrder);
    setState((p) => ({ ...p, bulkOrders: c }));
    toast.success(bulkOrderIndex > -1 ? "Updated" : "Added");
    setBulkOrderIndex(-1);
    setBulkOrder({ amount: 1, quantity: "" });
  };

  const changeHandler = async (key, value) => {
    const isEditMode = show;
    if (key === "cityID" && value) {
      try {
        const res = await getCityCategories(value);
        setFormCategories({ isLoaded: true, data: res.data.data || [] });
        if (!isEditMode) {
          setFormBrands({ isLoaded: false, data: [] });
          setState((p) => ({ ...p, [key]: value, categoryID: "", brandID: "" }));
        } else setState((p) => ({ ...p, [key]: value }));
      } catch (error) { toast.error('Failed to load categories'); }
    } else if (key === "categoryID" && value) {
      try {
        const res = await getCategoryBrands(value);
        setFormBrands({ isLoaded: true, data: res.data.data || [] });
        const currentState = { ...state };
        const shouldPreserveBrand = isEditMode && currentState.brandID;
        if (shouldPreserveBrand) setState((p) => ({ ...p, [key]: value }));
        else setState((p) => ({ ...p, [key]: value, brandID: "" }));
      } catch (error) { toast.error('Failed to load brands'); }
    } else setState((p) => ({ ...p, [key]: value }));
  };

  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure you want to delete this product?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteProduct(id, token);
      toast.success("Product deleted successfully!");
      const link = `/product/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&brand=${selectedBrandId}&category=${selectedCategoryId}`;
      const res = await getDatas(link);
      setData(res.data.data); setTotalPages(res.data.totalPages);
      if (res.data.data.length === 0 && currentPage > 1) setCurrentPage(prev => prev - 1);
      setShow(false);
    } catch (error) {
      toast.error(error.response?.data?.msg || error.message || "Failed to delete product.");
      checkAuthError(error);
    } finally { setLoading(false); }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const updateData = {
        ...values, image: state.image, includePacking: state.includePacking,
        includeBulkOrder: state.includeBulkOrder, bulkOrders: state.bulkOrders || [],
        isDiscounted: values.isDiscounted || false, discountType: values.discountType || 'Percentage',
        discount: values.discount || 0,
      };
      if (state.id) {
        updateData.id = state.id; updateData.productId = state.productId || values.productId;
        updateData.cityID = values.cityID || state.cityID;
        await updateProduct(updateData, token);
      } else await createProduct(updateData, token);
      const link = `/product/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&brand=${selectedBrandId}&category=${selectedCategoryId}`;
      const res = await getDatas(link);
      setData(res.data.data); setTotalPages(res.data.totalPages);
      setShow(false); clearForm();
      toast.success(`Product ${state.id ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to save product');
      checkAuthError(error);
    } finally { setLoading(false); }
  };

  const handleUpdateStock = async () => {
    try {
      if (stock > 0) {
        setLoading(true);
        await updateProduct({
          ...selectedProduct, id: selectedProduct._id, stock: stock,
          categoryID: selectedProduct.categoryID?._id || selectedProduct.categoryID,
          cityID: selectedProduct.cityID?._id || selectedProduct.cityID,
          brandID: selectedProduct.brandID?._id || selectedProduct.brandID,
        }, token);
        const updatedData = data.map(product => product._id === selectedProduct._id ? { ...product, stock: stock } : product);
        setData(updatedData);
        setTimeout(() => {
          const queryParams = new URLSearchParams();
          queryParams.append('page', currentPage); queryParams.append('limit', limit);
          if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
          if (selectedCityId) queryParams.append('city', selectedCityId);
          if (selectedBrandId) queryParams.append('brand', selectedBrandId);
          if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
          const link = `/product/search?${queryParams.toString()}`;
          getDatas(link).then((res) => { if (res && res.data) { setData(res.data.data); setTotalPages(res.data.totalPages); } setLoading(false); })
            .catch(() => setLoading(false));
        }, 1500);
        setStockModal(false); setSelectedProduct(null);
      }
    } catch (error) {
      setLoading(false); checkAuthError(error);
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
    } catch (error) { checkAuthError(error); toast.error(error.message); }
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      const updateData = { id: item._id, isActive: name === 'isActive' ? checked : item.isActive, adminVerified: name === 'adminVerified' ? checked : item.adminVerified };
      await updateProductStatus(updateData, token);
      const updatedData = data.map(product => product._id === item._id ? { ...product, [name]: checked } : product);
      setData(updatedData);
      toast.success('Product status updated successfully');
      setTimeout(() => {
        const queryParams = new URLSearchParams();
        queryParams.append('page', currentPage); queryParams.append('limit', limit);
        if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
        if (selectedCityId) queryParams.append('city', selectedCityId);
        if (selectedBrandId) queryParams.append('brand', selectedBrandId);
        if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
        const link = `/product/search?${queryParams.toString()}`;
        getDatas(link).then((res) => { if (res && res.data) { setData(res.data.data); setTotalPages(res.data.totalPages); } setLoading(false); })
          .catch(() => setLoading(false));
      }, 1500);
      setShow(false); clearForm();
    } catch (error) {
      setLoading(false); checkAuthError(error);
      toast.error(error.response?.data?.errors?.[0]?.msg || error.response?.data?.msg || error.message || 'Failed to update status');
    }
  };

  const editHandler = async (item) => {
    try {
      setLoading(true);
      const cityId = item.cityID?._id || item.cityID || "";
      let categoryId = "";
      if (item.category) {
        categoryId = typeof item.category === 'object' ? item.category._id || "" : item.category;
      } else if (item.categoryID) {
        categoryId = typeof item.categoryID === 'object' ? item.categoryID._id || "" : item.categoryID;
      }
      let brandId = "";
      if (item.brand) {
        brandId = typeof item.brand === 'object' ? item.brand._id || "" : item.brand;
      } else if (item.brandID) {
        brandId = typeof item.brandID === 'object' ? item.brandID._id || "" : item.brandID;
      }

      let allCategories = [];
      if (categories.isLoaded) allCategories = categories.data;
      else {
        const categoriesRes = await getAllCategories();
        allCategories = categoriesRes.data.data || [];
        setCategories({ isLoaded: true, data: allCategories });
      }
      setFormCategories({ isLoaded: true, data: allCategories });

      let brandsToLoad = [];
      if (categoryId) {
        try {
          const brandsRes = await getCategoryBrands(categoryId);
          const brandsForCategory = brandsRes.data.data || [];
          const brandExists = brandsForCategory.some(brand => brand._id === brandId || (brand.brandId && brand.brandId === brandId));
          if (!brandExists && brandId) { const allBrandsRes = await getAllBrands(); brandsToLoad = allBrandsRes.data.data || []; }
          else brandsToLoad = brandsForCategory;
        } catch (error) {
          try { const allBrandsRes = await getAllBrands(); brandsToLoad = allBrandsRes.data.data || []; } catch { brandsToLoad = []; }
        }
      } else {
        try { const allBrandsRes = await getAllBrands(); brandsToLoad = allBrandsRes.data.data || []; } catch { brandsToLoad = []; }
      }

      if (brandId && brandsToLoad.length > 0) {
        const brandExists = brandsToLoad.some(brand => brand._id === brandId || (brand.brandId && brand.brandId === brandId));
        if (!brandExists) {
          try { const brandRes = await getBrand(brandId); if (brandRes.data.data) brandsToLoad.push(brandRes.data.data); } catch {}
        }
      }
      setFormBrands({ isLoaded: true, data: brandsToLoad });

      setState({
        id: item._id || "", productId: item.productId || "", englishTitle: item.englishTitle || "",
        urduTitle: item.urduTitle || "", urduDescription: item.urduDescription || "",
        englishDescription: item.englishDescription || "", price: item.price || 0,
        stock: item.stock || 0, image: item.image || "", cityID: cityId, categoryID: categoryId,
        brandID: brandId, unitID: item.unitID || "", discount: item.discount || 0,
        discountType: item.discountType || "Percentage", isDiscounted: item.isDiscounted || false,
        isActive: item.isActive !== undefined ? item.isActive : true,
        includeBulkOrder: item.includeBulkOrder || false, packings: item.packings || "",
        includePacking: item.includePacking || false, purchaseRate: item.purchaseRate || 0,
        purchaseDiscount: item.purchaseDiscount || 0, salesDiscount: item.salesDiscount || 0,
        cortanSize: item.cortanSize || 0, bulkOrders: item.bulkOrders || [],
      });
      setStock(item.stock || 0);
      setShow(true);
    } catch (error) {
      toast.error("Failed to load product data for editing.");
    } finally { setLoading(false); }
  };

  const addHandler = async () => { clearForm(); setShow(true); };

  const citySelectHandler = async (e) => {
    if (isCoordinator) { setSelectedCityId(coordinatorCityId || ""); setCurrentPage(1); return; }
    setSelectedCityId(e.target.value || ""); setCurrentPage(1);
  };
  const categorySelectHandler = async (e) => { setSelectedCategoryId(e.target.value || ""); setSelectedBrandId(""); setCurrentPage(1); };
  const brandSelectHandler = async (e) => { setSelectedBrandId(e.target.value || ""); setCurrentPage(1); };
  const handleSearch = (e) => setSearchTerm(e.target.value);

  const refreshData = () => {
    setSearchTerm('');
    setSelectedCityId(isCoordinator ? coordinatorCityId : '');
    setSelectedBrandId(''); setSelectedCategoryId(''); setCurrentPage(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearchTerm(searchTerm); setCurrentPage(1); }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchHandler = async (e) => {
    if (e.key === 'Enter') { setLoading(true); setDebouncedSearchTerm(e.target.value); }
  };

  const addDiscountRow = () => setDiscountRows([...discountRows, { quantity: '', discount: '', type: 'Percentage' }]);
  const removeDiscountRow = (index) => { if (discountRows.length > 1) setDiscountRows(discountRows.filter((_, i) => i !== index)); };
  const updateDiscountRow = (index, field, value) => {
    const newRows = [...discountRows];
    newRows[index][field] = value;
    setDiscountRows(newRows);
  };

  const saveBulkDiscount = async () => {
    const validRows = discountRows.filter(row => row.quantity && row.discount !== '' && row.type);
    if (validRows.length === 0) { toast.error('Please add at least one valid discount row'); return; }
    for (const row of validRows) {
      if (isNaN(row.quantity) || row.quantity <= 0) { toast.error('Please enter a valid positive number for quantity'); return; }
      if (isNaN(row.discount) || row.discount < 0) { toast.error('Please enter a valid non-negative number for discount'); return; }
      if (row.type === 'Percentage' && row.discount > 100) { toast.error('Percentage discount cannot exceed 100'); return; }
    }
    try {
      setLoading(true);
      const bulkDiscountQuantity = validRows.map(row => parseFloat(row.quantity));
      const bulkDiscount = validRows.map(row => parseFloat(row.discount));
      const bulkDiscountType = validRows.map(row => row.type);
      const updateData = {
        id: bulkDiscountProduct._id, bulkDiscountQuantity, bulkDiscount, bulkDiscountType,
        discountType: bulkDiscountProduct.discountType || 'Percentage',
        productId: bulkDiscountProduct.productId, englishTitle: bulkDiscountProduct.englishTitle,
        urduTitle: bulkDiscountProduct.urduTitle, price: bulkDiscountProduct.price || bulkDiscountProduct.saleRate,
        stock: bulkDiscountProduct.stock, cortanSize: bulkDiscountProduct.cortanSize,
        purchaseRate: bulkDiscountProduct.purchaseRate,
        cityID: bulkDiscountProduct.cityID?._id || bulkDiscountProduct.cityID,
        categoryID: bulkDiscountProduct.category?._id || bulkDiscountProduct.category,
        brandID: bulkDiscountProduct.brand?._id || bulkDiscountProduct.brand,
        includePacking: bulkDiscountProduct.includePacking || false,
        includeBulkOrder: bulkDiscountProduct.includeBulkOrder || false,
        isDiscounted: bulkDiscountProduct.isDiscounted || false, discount: bulkDiscountProduct.discount || 0,
        bulkOrders: bulkDiscountProduct.bulkOrders || [],
      };
      await updateProduct(updateData, token);
      setData(data.map(product => product._id === bulkDiscountProduct._id ? { ...product, bulkDiscountQuantity, bulkDiscount, bulkDiscountType } : product));
      toast.success('Bulk discount saved successfully!');
      setShowBulkDiscountModal(false);
      setDiscountRows([{ quantity: '', discount: '' }]);
      setBulkDiscountProduct(null);
    } catch (error) {
      toast.error(error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to save bulk discount');
      checkAuthError(error);
    } finally { setLoading(false); }
  };

  const closeBulkDiscountModal = () => {
    setShowBulkDiscountModal(false);
    setDiscountRows([{ quantity: '', discount: '', type: 'Percentage' }]);
    setBulkDiscountProduct(null);
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) { toast.error("No file selected"); return; }
    setImportLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error('No sheets found in the Excel file');
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new Error(`Sheet "${sheetName}" not found`);
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });
      if (rows.length === 0) throw new Error('Excel sheet is empty');
      const headers = rows[0];
      const dataRows = rows.slice(1);
      const codeIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'code');
      const locationCodeIndex = headers.findIndex(h => h && h.toString().trim().toLowerCase() === 'fieldb');
      if (codeIndex === -1 || locationCodeIndex === -1) throw new Error('Required columns not found');
      const filteredRows = dataRows.filter(row => { const pc = row[codeIndex]; return pc && String(pc).trim() !== ''; });
      if (filteredRows.length === 0) throw new Error('No valid products found');
      if (!cities.isLoaded || cities.data.length === 0) {
        const citiesRes = await getAllCities();
        setCities({ data: citiesRes.data.data, isLoaded: true });
        var citiesData = citiesRes.data.data;
      } else { var citiesData = cities.data; }
      const [categoriesRes, brandsRes] = await Promise.all([getAllCategories(), getAllBrands()]);
      const allCategories = categoriesRes.data.data;
      const allBrands = brandsRes.data.data;
      const jsonData = [];
      const invalidLocationCodes = new Set();
      const skippedProducts = [];
      filteredRows.forEach((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          if (header) { const ch = header.toString().trim().toLowerCase().replace(/\s+/g, ''); obj[ch] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : ''; }
        });
        const productCode = obj['code'];
        const locationCode = obj['fieldb'];
        const matchingCity = citiesData.find(city => String(city.locationId).trim() === locationCode.trim());
        if (!matchingCity) { invalidLocationCodes.add(locationCode); return; }
        const stockValue = Number(obj['openingqty']) || 0;
        const salePrice = Math.floor(Number(obj['saleprice/rate'])) || 0;
        const costPrice = Math.floor(Number(obj['cost'])) || 0;
        const productData = {
          productId: productCode, englishTitle: obj['name'] || productCode, urduTitle: obj['name'] || productCode,
          price: salePrice, purchaseRate: costPrice, saleRate: salePrice, stock: stockValue,
          cortanSize: Number(obj['fielda']) || 0, packings: obj['saleinformation'] || '', image: '',
          urduDescription: obj['saleinformation'] || '', englishDescription: obj['saleinformation'] || '',
          cityID: matchingCity._id,
          category: (() => {
            const cn = obj['category'] || '';
            if (!cn) return null;
            const mc = allCategories.find(cat => cat.englishName?.toLowerCase() === cn.toLowerCase());
            if (!mc) { skippedProducts.push(`Skipping ${productCode}: Category "${cn}" not found`); return null; }
            return mc._id;
          })(),
          brand: (() => {
            const bn = obj['field1'] || '';
            if (!bn) { skippedProducts.push(`Skipping ${productCode}: No brand specified`); return null; }
            const mb = allBrands.find(brand => brand.englishName?.toLowerCase() === bn.toLowerCase());
            if (!mb) { skippedProducts.push(`Skipping ${productCode}: Brand "${bn}" not found`); return null; }
            return mb._id;
          })(),
          includePacking: Boolean(obj['saleinformation']), includeBulkOrder: false, bulkOrders: [],
          isDiscounted: false, discountType: 'Percentage', discount: 0, isActive: true, adminVerified: true,
        };
        if (productData.category && productData.brand) jsonData.push(productData);
      });
      if (jsonData.length === 0) { let em = 'No valid products to import.'; if (skippedProducts.length > 0) em += '\n\nSkipped:\n' + skippedProducts.join('\n'); throw new Error(em); }
      else if (skippedProducts.length > 0) toast.warn(`${skippedProducts.length} products were skipped.`);
      const BATCH_SIZE = 50;
      let totalImported = 0, totalUpdated = 0, totalFailed = 0;
      const allErrors = [];
      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        const batch = jsonData.slice(i, i + BATCH_SIZE);
        try {
          const res = await fetch('https://primelinkdistribution.com/api/product/import-excel', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ products: batch, isUpdate: true }),
          });
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const result = await res.json();
          if (result.msg === 'success') {
            totalImported += result.imported || 0; totalUpdated += result.updated || 0; totalFailed += result.failed || 0;
            if (result.errors && result.errors.length > 0) allErrors.push(...result.errors);
          } else throw new Error(result.message || 'Unknown error during batch import');
          if (i + BATCH_SIZE < jsonData.length) await new Promise(resolve => setTimeout(resolve, 500));
        } catch (batchError) { allErrors.push({ batch: Math.floor(i / BATCH_SIZE) + 1, error: batchError.message }); totalFailed += batch.length; }
      }
      const successMessage = `Successfully processed ${jsonData.length} products (${totalImported} new, ${totalUpdated} updated)${totalFailed ? `, ${totalFailed} failed` : ''}`;
      if (totalFailed > 0) { toast.warning(successMessage); if (allErrors.length > 0) toast.error(`Some items failed. Check console for details.`); }
      else toast.success(successMessage);
      setShowImportModal(false); refreshData();
    } catch (err) { toast.error(`Failed to import: ${err.message}`); }
    finally { setImportLoading(false); e.target.value = ''; }
  };

  const handleExportToExcel = () => {
    try {
      setExportLoading(true);
      const products = data || [];
      if (!products || products.length === 0) { toast.info('No products found to export'); return; }
      const exportData = products.map(product => ({
        'Code': product.productId || '', 'Name': product.englishTitle || '', 'FieldA': product.cortanSize?.toString() || '1',
        'FieldB': product.cityID?.locationId || product.cityID?._id || '', 'Unit': product.unit || 'PCS',
        'Opening Qty': product.stock?.toString() || '0',
        'Sale Price/Rate': product.saleRate ? Math.floor(product.saleRate).toString() : (product.price ? Math.floor(product.price).toString() : '0'),
        'Cost': product.purchaseRate ? Math.floor(product.purchaseRate).toString() : '0', 'Sale Information': product.packings || ''
      }));
      const headers = ['Code', 'Name', 'FieldA', 'FieldB', 'Unit', 'Opening Qty', 'Sale Price/Rate', 'Cost', 'Sale Information'];
      const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
      ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 40 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, `products_export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${products.length} products exported successfully`);
    } catch (error) { toast.error(`Failed to export: ${error.message}`); }
    finally { setExportLoading(false); }
  };

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        .prd-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .prd-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
        .prd-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
        .prd-page .filter-select {
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
        }
        .prd-page .action-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .prd-page .action-btn:hover { transform: scale(1.1); }
        .prd-page .toggle-btn { transition: color 0.15s; cursor: pointer; }
        .prd-page .toggle-btn:hover { opacity: 0.8; }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-overlay { animation: overlayIn 0.2s ease; }
        .modal-card { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; }
        .drag-drop-wrapper { width: 100%; min-width: 0; overflow: hidden; }
        .drag-drop-wrapper > * { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
        .prd-page .action-toolbar-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 13px; border-radius: 10px; font-size: 13px; font-weight: 600;
          border: 1px solid rgba(0,0,0,0.08); background: #fff; color: #374151;
          cursor: pointer; white-space: nowrap;
          transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
        }
        .prd-page .action-toolbar-btn:hover { background: #FFF5F3; color: #FF5934; border-color: #FFD7CE; transform: translateY(-1px); }
        .prd-page .action-toolbar-btn.danger:hover { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
        .prd-page .action-toolbar-btn.primary { background: #FF5934; color: #fff; border-color: #FF5934; box-shadow: 0 2px 8px rgba(255,89,52,0.25); }
        .prd-page .action-toolbar-btn.primary:hover { background: #e84d2a; border-color: #e84d2a; box-shadow: 0 4px 12px rgba(255,89,52,0.35); }
      `}</style>

      <div className="prd-page">
        {/* ── Page Header ── */}
        <div className="flex items-center justify-between mt-6 mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Inventory</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">{data.length} products on this page</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {selectedProductIds.length > 0 && (
              <button onClick={handleBulkDelete} className="action-toolbar-btn danger">
                <FaMinus size={12} /> Delete ({selectedProductIds.length})
              </button>
            )}
            <button onClick={() => setShowImportModal(true)} className="action-toolbar-btn">
              <FaFileImport size={13} /> Import Excel
            </button>
            <button onClick={handleDownloadSample} className="action-toolbar-btn">
              <MdFileDownload size={15} /> Sample
            </button>
            <button onClick={handleExportInventory} className="action-toolbar-btn">
              <FaFileExport size={13} /> Export
            </button>
            {!role.includes(ROLES[2]) && (
              <button onClick={addHandler} className="action-toolbar-btn primary">
                <MdAdd size={16} /> Add Inventory
              </button>
            )}
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
            <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
            <input
              value={searchTerm} onChange={handleSearch} onKeyPress={searchHandler}
              className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
              type="search" placeholder="Search by title…"
            />
            {searchTerm && (
              <button onClick={refreshData} className="text-[#9CA3AF] hover:text-[#FF5934] transition-colors">
                <MdClose size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <MdFilterList size={16} className="text-[#9CA3AF]" />
            <select value={selectedCityId} onChange={citySelectHandler} disabled={isCoordinator}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[120px]">
              <option value="">All Locations</option>
              {cities.data.map(item => <option value={item._id} key={item._id}>{item.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <select value={selectedCategoryId} onChange={categorySelectHandler}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[120px]">
              <option value="">All Categories</option>
              {categories.data.map(item => <option value={item._id} key={item._id}>{item.englishName}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
            <select value={selectedBrandId} onChange={brandSelectHandler}
              className="filter-select bg-transparent outline-none text-sm text-[#374151] min-w-[110px]">
              <option value="">All Brands</option>
              {filteredFilterBrands.map(item => <option value={item._id} key={item._id}>{item.englishName}</option>)}
            </select>
          </div>
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
                <th className="px-4 py-3">
                  <input type="checkbox" checked={data.length > 0 && selectedProductIds.length === data.length}
                    onChange={toggleSelectAll} className="w-4 h-4 cursor-pointer rounded" />
                </th>
                {["Image", "Product", "Category", "Brand", "Price", "Stock",
                  ...(!role.includes(ROLES[2]) ? ["Active", "Verified"] : []),
                  "Actions"].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length ? data.map((product, index) => (
                <tr key={index} className="table-row cursor-pointer">
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedProductIds.includes(product._id)}
                      onChange={() => toggleSelectProduct(product._id)}
                      onClick={(e) => e.stopPropagation()} className="w-4 h-4 cursor-pointer rounded" />
                  </td>

                  {/* Image */}
                  <td className="px-4 py-3">
                    <img src={product.image || '/placehold.jpg'} alt="Product"
                      className="w-10 h-10 object-cover rounded-xl ring-2 ring-white shadow-sm border border-gray-100"
                      onError={(e) => { e.target.onerror = null; e.target.src = '/placehold.jpg'; }} />
                  </td>

                  {/* Product info */}
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-semibold text-[#111827] leading-tight">{product.englishTitle}</p>
                    <span className="text-[11px] font-mono font-semibold text-[#9CA3AF] bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md mt-0.5 inline-block uppercase">
                      {product.productId || "—"}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded-lg font-medium">
                      {categories.isLoaded ? memoizedGetCategoryName(product.category) : '…'}
                    </span>
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[#374151] bg-[#F3F4F6] px-2 py-1 rounded-lg font-medium">
                      {brands.isLoaded ? memoizedGetBrandName(product.brand) : '…'}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-bold text-[#111827]">Rs. {Math.floor(product.price)}</p>
                    <p className="text-[11px] text-[#9CA3AF]">PR: {Math.floor(product.purchaseRate)}</p>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold
                      ${product.stock > 10 ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
                        : product.stock > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-200'
                        : 'bg-red-50 text-red-500 ring-1 ring-red-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0
                        ${product.stock > 10 ? 'bg-emerald-400' : product.stock > 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
                      {product.stock}
                    </span>
                  </td>

                  {/* Toggles */}
                  {!role.includes(ROLES[2]) && (
                    <>
                      <td className="px-4 py-3">
                        <button className="toggle-btn flex items-center"
                          onClick={() => updateDataHandler(!product.isActive, "isActive", product)}>
                          {product.isActive
                            ? <PiToggleRightFill size={26} className="text-emerald-500" />
                            : <PiToggleLeftFill size={26} className="text-gray-300" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="toggle-btn flex items-center"
                          onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}>
                          {product.adminVerified
                            ? <PiToggleRightFill size={26} className="text-blue-500" />
                            : <PiToggleLeftFill size={26} className="text-gray-300" />}
                        </button>
                      </td>
                    </>
                  )}

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setStock(product.stock); setSelectedProduct({ ...product, brandID: product.brand ? (typeof product.brand === 'string' ? product.brand : product.brand._id) : null }); }}
                        className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100"
                        title="View"
                      >
                        <FaRegEye size={14} />
                      </button>
                      {!role.includes(ROLES[2]) && (
                        <>
                          <button onClick={() => editHandler(product)}
                            className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100"
                            title="Edit">
                            <MdEdit size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const hasBulk = product.bulkDiscountQuantity?.length > 0 && product.bulkDiscount?.length > 0;
                              setBulkDiscountProduct(product);
                              setDiscountRows(hasBulk
                                ? product.bulkDiscountQuantity.map((qty, i) => ({ quantity: qty.toString(), discount: product.bulkDiscount[i]?.toString() || '', type: product.bulkDiscountType?.[i] || 'Percentage' }))
                                : [{ quantity: '', discount: '', type: 'Percentage' }]);
                              setShowBulkDiscountModal(true);
                            }}
                            className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-purple-50 text-[#9CA3AF] hover:text-purple-500 border border-gray-100"
                            title="Bulk Discount">
                            <MdLocalOffer size={14} />
                          </button>
                          <button onClick={() => deleteHandler(product._id)}
                            className="action-btn w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100"
                            title="Delete">
                            <MdDelete size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={12} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                        <MdInventory2 size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[#9CA3AF] text-sm font-medium">No products found</p>
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
              disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
            ><GrFormPrevious size={16} /></button>
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
              <span className="font-semibold text-[#FF5934]">{currentPage}</span>
              <span className="text-gray-300">/</span>
              <span>{totalPages}</span>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
              disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
            ><GrFormNext size={16} /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#9CA3AF]">Rows per page</span>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
              className="filter-select bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#374151] outline-none">
              <option value={10}>10</option><option value={15}>15</option>
              <option value={30}>30</option><option value={50}>50</option>
            </select>
          </div>
        </div>


        {/* ═══════════════════════════════════════════════
            ADD / EDIT MODAL
        ═══════════════════════════════════════════════ */}
        {show && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[480px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">

              {/* Header band */}
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10">
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                      {state.id ? 'Editing Product' : 'New Product'}
                    </p>
                    <h2 className="text-white text-xl font-bold">
                      {state.id ? 'Edit Inventory' : 'Add Inventory'}
                    </h2>
                  </div>
                  <button onClick={() => { setFileUpload(false); setShow(false); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors mt-0.5">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <Formik initialValues={state} validationSchema={validations} onSubmit={handleSubmit} enableReinitialize={true}>
                {() => (
                  <Form className="no-scroll overflow-y-auto flex-1 flex flex-col">

                    {/* Image upload card */}
                    <div className="px-6 mt-7 mb-5">
                      <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="relative flex-shrink-0">
                            <img src={state.image || '/Avatar.svg'} alt="Preview"
                              className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white shadow-md"
                              onError={e => { e.target.src = '/Avatar.svg'; }} />
                            {state.image && (
                              <button type="button" onClick={() => setState(p => ({ ...p, image: "" }))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                                <MdClose size={11} />
                              </button>
                            )}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-[13px] font-semibold text-[#111827] mb-0.5">Product Image</p>
                            <p className="text-[11px] text-[#9CA3AF] mb-2">JPG, PNG up to 5MB</p>
                            {fileUpload ? (
                              <div className="flex items-center gap-2 text-[#FF5934] text-xs font-medium"><Spinner /> Uploading…</div>
                            ) : (
                              <div className="drag-drop-wrapper">
                                <DragNdrop onFilesSelected={fileUploadHandler} width="100%" height="36px" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Form fields */}
                    <div className="px-6 pb-6 flex flex-col gap-4">

                      {/* Section: Identity */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />Product Identity<span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <FieldGroup icon={MdNumbers} label="Product ID">
                              <Input name="productId" placeholder="Unique product ID" changeHandler={changeHandler} className={inputCls} />
                            </FieldGroup>
                          </div>
                          <FieldGroup icon={MdInventory2} label="English Title">
                            <Input name="englishTitle" placeholder="Title in English" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdInventory2} label="Urdu Title">
                            <Input name="urduTitle" placeholder="اردو میں عنوان" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                        </div>
                      </div>

                      {/* Section: Classification */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />Classification<span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-1 gap-3">
                          <FieldGroup icon={MdLocationOn} label="Location">
                            <Select name="cityID" data={cities.data} searchKey="_id" searchValue="name" value={state.cityID} changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdCategory} label="Category">
                            <Select name="categoryID" data={formCategories.data} searchKey="_id" searchValue="englishName" value={state.categoryID} changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdBrandingWatermark} label="Brand">
                            <Select name="brandID" data={formBrands.data} searchKey="_id" searchValue="englishName" value={state.brandID} changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                        </div>
                      </div>

                      {/* Section: Pricing & Stock */}
                      <div>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="flex-1 border-t border-gray-100" />Pricing & Stock<span className="flex-1 border-t border-gray-100" />
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup icon={MdWarehouse} label="Stock">
                            <Input name="stock" placeholder="Enter stock" type="number" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdWarehouse} label="Carton Size">
                            <Input name="cortanSize" placeholder="Carton size" type="number" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdLocalOffer} label="Purchase Rate">
                            <Input name="purchaseRate" placeholder="Purchase rate" type="number" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                          <FieldGroup icon={MdLocalOffer} label="Sales Rate">
                            <Input name="price" placeholder="Sales rate" type="number" changeHandler={changeHandler} className={inputCls} />
                          </FieldGroup>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                      <button type="button" onClick={() => { setFileUpload(false); setShow(false); }}
                        className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="submit"
                        className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2">
                        {state.id ? <><MdEdit size={16} /> Save Changes</> : <><MdAdd size={16} /> Add Product</>}
                      </button>
                    </div>
                  </Form>
                )}
              </Formik>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════
            PRODUCT DETAIL PANEL
        ═══════════════════════════════════════════════ */}
        {selectedProduct && !stockModal && (
          <ClickOutside onClick={() => setSelectedProduct(null)}>
            <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
              onClick={() => setSelectedProduct(null)}>
              <div className="modal-card bg-white w-full max-w-[420px] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}>

                {/* Hero */}
                <div className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] px-6 pt-6 pb-16 overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#FF5934]/10" />
                  <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                  <div className="relative flex items-start justify-between mb-4">
                    <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">Product Details</span>
                    <button onClick={() => setSelectedProduct(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors">
                      <MdClose size={15} />
                    </button>
                  </div>
                  <div className="relative flex items-end gap-4">
                    <img src={selectedProduct.image || '/placehold.jpg'} alt="Product"
                      className="w-20 h-20 rounded-2xl object-cover ring-4 ring-[#FF5934]/50 shadow-xl flex-shrink-0"
                      onError={e => { e.target.src = '/placehold.jpg'; }} />
                    <div className="pb-1 min-w-0">
                      <h3 className="text-white text-[16px] font-bold leading-tight truncate">{selectedProduct.englishTitle}</h3>
                      <span className="text-white/40 text-[11px] font-mono uppercase">{selectedProduct.productId}</span>
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold
                          ${selectedProduct.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedProduct.isActive ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                          {selectedProduct.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="-mt-6 mx-5 grid grid-cols-3 gap-2 z-10 relative">
                  {[
                    { label: "Sale Price", value: `Rs. ${Math.floor(selectedProduct.price)}` },
                    { label: "Purchase", value: `Rs. ${Math.floor(selectedProduct.purchaseRate)}` },
                    { label: "Stock", value: selectedProduct.stock },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-md px-3 py-3 text-center">
                      <p className="text-[14px] font-bold text-[#FF5934]">{value}</p>
                      <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-wide mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div className="no-scroll overflow-y-auto px-5 pt-5 pb-4 flex flex-col gap-3">
                  {[
                    { icon: MdCategory, label: "Category", value: categories.isLoaded ? memoizedGetCategoryName(selectedProduct.category) : '…' },
                    { icon: MdBrandingWatermark, label: "Brand", value: brands.isLoaded ? memoizedGetBrandName(selectedProduct.brand || selectedProduct.brandID) : '…' },
                    { icon: MdWarehouse, label: "Carton Size", value: selectedProduct.cortanSize },
                    ...(selectedProduct.isDiscounted ? [{ icon: MdLocalOffer, label: "Discount", value: `${selectedProduct.discount}% off` }] : []),
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                      <div className="w-8 h-8 rounded-xl bg-[#FF5934]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={15} className="text-[#FF5934]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-[13px] text-[#374151] font-medium">{value || <span className="text-gray-300 italic">N/A</span>}</p>
                      </div>
                    </div>
                  ))}
                  {selectedProduct.bulkOrders?.length > 0 && (
                    <div className="bg-[#F9FAFB] rounded-2xl px-4 py-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">Bulk Orders</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.bulkOrders.map((it, i) => (
                          <div key={i} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-center shadow-sm">
                            <p className="text-[11px] text-[#9CA3AF]">{`> ${it.quantity} items`}</p>
                            <p className="text-[13px] font-bold text-[#FF5934]">{Math.floor(it.amount)} Rs</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                  {!role.includes(ROLES[2]) && (
                    <button onClick={() => { editHandler(selectedProduct); setSelectedProduct(null); }}
                      className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-100">
                      <MdEdit size={15} /> Edit Product
                    </button>
                  )}
                  <button onClick={() => setSelectedProduct(null)}
                    className="h-11 px-5 rounded-xl border border-gray-200 hover:bg-gray-50 text-[#374151] text-sm font-semibold transition-colors">
                    Close
                  </button>
                  {!role.includes(ROLES[2]) && (
                    <button onClick={() => { deleteHandler(selectedProduct._id); setSelectedProduct(null); }}
                      className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 flex items-center justify-center transition-colors border border-red-100"
                      title="Delete">
                      <MdDelete size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </ClickOutside>
        )}


        {/* ═══════════════════════════════════════════════
            STOCK UPDATE MODAL
        ═══════════════════════════════════════════════ */}
        {stockModal && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[360px] rounded-3xl shadow-2xl overflow-hidden">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Inventory</p>
                    <h2 className="text-white text-xl font-bold">Update Stock</h2>
                  </div>
                  <button onClick={() => { setStockModal(false); setSelectedProduct(null); }}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <div className="px-6 py-6">
                <FieldGroup icon={MdWarehouse} label="New Stock Amount">
                  <input type="number" value={stock} min={1}
                    onChange={(e) => setStock(parseInt(e.target.value) > 0 ? parseInt(e.target.value) : 1)}
                    className={inputCls} placeholder="Enter stock amount" />
                </FieldGroup>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button type="button" onClick={() => { setStockModal(false); setSelectedProduct(null); }}
                  className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleUpdateStock()}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all">
                  Update Stock
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════
            IMPORT MODAL
        ═══════════════════════════════════════════════ */}
        {showImportModal && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[400px] rounded-3xl shadow-2xl overflow-hidden">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Inventory</p>
                    <h2 className="text-white text-xl font-bold">Import Excel</h2>
                  </div>
                  <button onClick={() => setShowImportModal(false)} disabled={importLoading}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>
              <div className="px-6 py-6">
                <div className="bg-[#F9FAFB] border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#FF5934]/10 flex items-center justify-center mx-auto mb-3">
                    <FaFileImport size={20} className="text-[#FF5934]" />
                  </div>
                  <p className="text-[13px] font-semibold text-[#374151] mb-1">Choose Excel file</p>
                  <p className="text-[11px] text-[#9CA3AF] mb-4">Supports .xlsx and .xls</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF5934] text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-[#e84d2a] transition-colors">
                    <MdFileUpload size={16} />
                    {importLoading ? 'Importing…' : 'Select File'}
                    <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} disabled={importLoading} className="hidden" />
                  </label>
                </div>
              </div>
              <div className="px-6 pb-6">
                <button onClick={() => setShowImportModal(false)} disabled={importLoading}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ═══════════════════════════════════════════════
            BULK DISCOUNT MODAL
        ═══════════════════════════════════════════════ */}
        {showBulkDiscountModal && (
          <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
            <div className="modal-card bg-white w-full max-w-[560px] max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
              <div className="relative bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-8">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Pricing</p>
                    <h2 className="text-white text-xl font-bold">Bulk Discount</h2>
                    {bulkDiscountProduct && (
                      <p className="text-white/60 text-[12px] mt-0.5">{bulkDiscountProduct.englishTitle}</p>
                    )}
                  </div>
                  <button onClick={closeBulkDiscountModal}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                    <MdClose size={16} />
                  </button>
                </div>
              </div>

              <div className="no-scroll overflow-y-auto flex-1 px-6 py-5">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-2 px-1">
                  {["Qty (Cartons)", "Discount", "Type", ""].map((h, i) => (
                    <p key={i} className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{h}</p>
                  ))}
                </div>
                {discountRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-3 items-center">
                    <input type="number" placeholder="e.g. 10" value={row.quantity}
                      onChange={(e) => updateDiscountRow(index, 'quantity', e.target.value)}
                      className={inputCls} min="1" />
                    <input type="number" placeholder="e.g. 5" value={row.discount}
                      onChange={(e) => updateDiscountRow(index, 'discount', e.target.value)}
                      className={inputCls} min="0" max={row.type === 'Percentage' ? 100 : undefined} />
                    <select value={row.type} onChange={(e) => updateDiscountRow(index, 'type', e.target.value)}
                      className={`${inputCls} filter-select`}>
                      <option value="Percentage">Percentage</option>
                      <option value="Flat">Flat</option>
                    </select>
                    <div className="flex gap-1.5">
                      <button onClick={addDiscountRow}
                        className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-500 flex items-center justify-center border border-emerald-200 transition-colors">
                        <FaPlus size={11} />
                      </button>
                      {discountRows.length > 1 && (
                        <button onClick={() => removeDiscountRow(index)}
                          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center border border-red-200 transition-colors">
                          <FaMinus size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl">
                <button onClick={closeBulkDiscountModal}
                  className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={saveBulkDiscount}
                  className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all flex items-center justify-center gap-2">
                  <MdLocalOffer size={15} /> Save Discount
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Product;