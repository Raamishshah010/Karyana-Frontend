import { useCallback, useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { CiCirclePlus } from "react-icons/ci";
import { toast } from "react-toastify";
import { FaRegEye } from "react-icons/fa6";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import {
  createProduct,
  deleteProduct,
  bulkDeleteProducts,
  getProducts,
  updateProduct,
  uploadFile,
  getAllCities,
  updateProductStatus,
  getDatas,
  getAllCategories,
  getAllBrands,
  getCityCategories,
  getCategoryBrands,
  getBrand,
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError, ROLES } from "../utils";
import { HiDotsVertical } from "react-icons/hi";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import { Select } from '../components/common/select';
import { Textarea } from '../components/common/textArea';
import '../CSS/Login.css';
import { Spinner } from '../components/common/spinner';
import ClickOutside from '../Hooks/ClickOutside';
import { RxCross2 } from "react-icons/rx";
import { FaFileExport, FaFileImport, FaFileExcel, FaSearch, FaEdit, FaPlus, FaMinus } from "react-icons/fa";
import DragNdrop from '../components/DragDrop';
import EscapeClose from '../components/EscapeClose';
import * as XLSX from 'xlsx';

const Product = () => {
  const [limit, setLimit] = useState(10);
  // Get logged-in admin and determine if user is a Coordinator
  const admin = useSelector((state) => state.admin);
  const isCoordinator = admin?.role?.includes(ROLES[1]);
  // Derive coordinator city id from Redux (supports populated or raw ObjectId)
  const coordinatorCityId = isCoordinator
    ? (admin?.user?.city && typeof admin.user.city === 'object'
        ? admin.user.city._id
        : admin?.user?.city || '')
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
  // Lock city to Coordinator's city if applicable
  const [selectedCityId, setSelectedCityId] = useState(coordinatorCityId);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [formCategories, setFormCategories] = useState({
    isLoaded: false,
    data: [],
  });
  const [formBrands, setFormBrands] = useState({
    isLoaded: false,
    data: [],
  });
  const [categories, setCategories] = useState({
    isLoaded: false,
    data: [],
  });
  const [brands, setBrands] = useState({
    isLoaded: false,
    data: [],
  });
  const [cities, setCities] = useState({ data: [], isLoaded: false });
  const getBrandCategoryId = (brand) => {
    if (!brand || !brand.categoryID) return null;
    if (typeof brand.categoryID === 'string') return brand.categoryID;
    if (typeof brand.categoryID === 'object') {
      return brand.categoryID._id || null;
    }
    return null;
  };
  const filteredFilterBrands = selectedCategoryId
    ? brands.data.filter((brand) => getBrandCategoryId(brand) === selectedCategoryId)
    : brands.data;
  
  // Bulk Discount State
  const [showBulkDiscountModal, setShowBulkDiscountModal] = useState(false);
  const [bulkDiscountProduct, setBulkDiscountProduct] = useState(null);
  const [discountRows, setDiscountRows] = useState([{ quantity: '', discount: '', type: 'Percentage' }]);
  
  // Helper function to get brand name from ID or object
  const getBrandName = (brand) => {
    if (!brand) return '-';
    if (typeof brand === 'string') {
      const found = brands.data.find(b => b._id === brand);
      return found ? found.englishName || found.name || brand : brand;
    }
    return brand.englishName || brand.name || brand._id || '-';
  };

  // Helper function to get category name from ID or object
  const getCategoryName = (category) => {
    if (!category) return '-';
    if (typeof category === 'string') {
      const found = categories.data.find(c => c._id === category);
      return found ? found.englishName || found.name || category : category;
    }
    return category.englishName || category.name || category._id || '-';
  };

  // Helper function to get city name from ID or object
  const getCityName = (city) => {
    if (!city) return '-';
    if (typeof city === 'string') {
      const found = cities.data.find(c => c._id === city);
      return found ? found.name || city : city;
    }
    return city.name || city._id || '-';
  };
  
  // Memoized version of getBrandName to prevent re-renders
  const memoizedGetBrandName = useCallback((brand) => {
    return getBrandName(brand);
  }, [brands.data]);
  
  // Memoized version of getCategoryName to prevent re-renders
  const memoizedGetCategoryName = useCallback((category) => {
    return getCategoryName(category);
  }, [categories.data]);

  const [units, setUnits] = useState({
    isLoaded: false,
    data: [],
  });
  const [bulkOrderIndex, setBulkOrderIndex] = useState(-1);
  const [bulkOrder, setBulkOrder] = useState({
    quantity: "",
    amount: 1,
  });
  const [state, setState] = useState({
    id: "",
    productId: "",
    urduTitle: "",
    englishTitle: "",
    urduDescription: "",
    englishDescription: "",
    image: "",
    categoryID: "",
    cityID: "",
    brandID: "",
    packings: "",
    bulkOrders: [],
    discountType: "Percentage",
    discount: 1,
    stock: 0,
    cortanSize: 0,
    purchaseRate: 0,
    saleRate: 0,
    includeBulkOrder: false,
    isDiscounted: false,
    includePacking: false,
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const { token, role } = admin || {};

  // If coordinator logs in and no city selected yet, set it to their city
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
      console.error('Error downloading sample file:', error);
      toast.error('Failed to download sample file. Please make sure the file exists in the public folder.');
    }
  };

  const handleExportInventory = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      // Use a large limit to get filtered products for export
      // Note: Backend might have its own limits, but 100000 should cover most cases
      queryParams.append('page', 1);
      queryParams.append('limit', 100000); 
      
      if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
      if (selectedCityId) queryParams.append('city', selectedCityId);
      if (selectedBrandId) queryParams.append('brand', selectedBrandId);
      if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
      
      const link = `/product/search?${queryParams.toString()}`;
      const res = await getDatas(link);
      const products = res.data.data;

      if (!products || products.length === 0) {
        toast.info("No products found to export");
        setLoading(false);
        return;
      }

      // Format data for Excel
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
      console.error('Error exporting inventory:', error);
      toast.error('Failed to export inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) {
      toast.info("Please select products to delete");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedProductIds.length} selected products?`)) {
      return;
    }

    try {
      setLoading(true);
      await bulkDeleteProducts(selectedProductIds, token);
      toast.success("Selected products deleted successfully");
      setSelectedProductIds([]);
      // Trigger refresh
      setCurrentPage(1);
      const queryParams = new URLSearchParams();
      queryParams.append('page', 1);
      queryParams.append('limit', limit);
      if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
      if (selectedCityId) queryParams.append('city', selectedCityId);
      if (selectedBrandId) queryParams.append('brand', selectedBrandId);
      if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
      const link = `/product/search?${queryParams.toString()}`;
      const res = await getDatas(link);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      toast.error(error?.response?.data?.msg || 'Failed to delete selected products');
      checkAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === data.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(data.map(product => product._id));
    }
  };

  const toggleSelectProduct = (id) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(pid => pid !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const validations = yup.object().shape({
    productId: yup.string().required("Product ID is required"),
    brandID: yup.string(),
    categoryID: yup.string(),
    cityID: yup.string(),
    stock: yup.number().min(1, "Stock must be at least 1").required("Stock is required"),
    urduTitle: yup.string().required("Title in Urdu is required"),
    englishTitle: yup.string().required("Title in English is required"),
    cortanSize: yup.number().required("Size in carton is required"),
    purchaseRate: yup
      .number()
      .transform((value) => (isNaN(value) ? undefined : value))
      .min(0, "Purchase rate must be a non-negative number")
      .required("Purchase rate is required"),
    price: yup
      .number()
      .transform((value) => (isNaN(value) ? undefined : value))
      .min(0, "Sales rate must be a non-negative number")
      .test(
        "price-test",
        "Sales rate must be greater than or equal to purchase rate",
        function (value) {
          const { purchaseRate } = this.parent;
          // Allow both values to be 0, or ensure price >= purchaseRate
          return (value === 0 && purchaseRate === 0) || 
                 (value !== undefined && purchaseRate !== undefined && value >= purchaseRate);
        }
      )
      .required("Sales rate is required"),
  });

  const clearForm = () => {
    setState({
      id: "",
      productId: "",
      urduTitle: "",
      englishTitle: "",
      urduDescription: "",
      englishDescription: "",
      image: "",
      categoryID: "",
      cityID: "",
      brandID: "",
      packings: "",
      bulkOrders: [],
      discountType: "",
      discount: 1,
      price: 0,
      stock: 0,
      cortanSize: 0,
      purchaseRate: 0,
      includeBulkOrder: false,
      isDiscounted: false,
      includePacking: false,
    });
    setFormCategories({ isLoaded: false, data: [] });
    setFormBrands({ isLoaded: false, data: [] });
  };

  useEffect(() => {
    setLoading(true);
    // Build query parameters, only including non-empty values
    const queryParams = new URLSearchParams();
      queryParams.append('page', currentPage);
      queryParams.append('limit', limit);
      if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
    if (selectedCityId) queryParams.append('city', selectedCityId);
    if (selectedBrandId) queryParams.append('brand', selectedBrandId);
    if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
    
    const link = `/product/search?${queryParams.toString()}`;
    
    getDatas(link).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err?.message || 'An error occurred while fetching products');
      });
  }, [currentPage, limit, debouncedSearchTerm, selectedCityId, selectedCategoryId, selectedBrandId]);

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await getAllCities();
        setCities({ data: res.data.data, isLoaded: true });
      } catch (error) {
        console.error('Error fetching cities:', error);
        toast.error('Failed to load cities data');
      }
    };
    
    fetchCities();
  }, []);

  const populateData = useCallback(async () => {
    if (!cities.isLoaded) {
      getAllCities().then(res => {
        setCities({
          isLoaded: true,
          data: res.data.data,
        });
      });
    }

    if (!categories.isLoaded) {
      const res = await getAllCategories();
      setCategories({
        isLoaded: true,
        data: res.data.data,
      });
    }
    if (!brands.isLoaded) {
      const res = await getAllBrands();
      setBrands({
        isLoaded: true,
        data: res.data.data,
      });
    }
  }, [brands.isLoaded, categories.isLoaded, cities.isLoaded]);

  useEffect(() => {
    populateData();
  }, [populateData]);

  const deleteBulkOrderItem = (index) => {
    const boCopy = [...state.bulkOrders];
    boCopy.splice(index, 1);
    setState(p => ({
      ...p,
      bulkOrders: boCopy
    }));
    setBulkOrderIndex(-1);
    setBulkOrder({
      quantity: "",
      amount: 1,
    });
  };

  const editBuolOrderItem = (index) => {
    const boIndex = [...state.bulkOrders];
    setBulkOrder({
      amount: boIndex[index].amount,
      quantity: boIndex[index].quantity,
    });
    setBulkOrderIndex(index);
  };

  const bulkOrderHandler = () => {
    if (bulkOrder.amount <= 0 || !bulkOrder.quantity.length) {
      return toast.error("All fields are required");
    }
    const c = [...state.bulkOrders];
    if (bulkOrderIndex > -1) {
      c[bulkOrderIndex].quantity = bulkOrder.quantity;
      c[bulkOrderIndex].amount = bulkOrder.amount;
    } else {
      c.push(bulkOrder);
    }
    setState((p) => ({
      ...p,
      bulkOrders: c
    }));
    toast.success(bulkOrderIndex > -1 ? "Updated" : "Added");
    setBulkOrderIndex(-1);
    setBulkOrder({
      amount: 1,
      quantity: ""
    });
  };


  const changeHandler = async (key, value) => {
    console.log(`changeHandler called with ${key}=${value}`);
    
    // Track if we're in edit mode by checking if the modal is open
    const isEditMode = show;
    
    if (key === "cityID" && value) {
      try {
        console.log("Loading categories for city:", value);
        const res = await getCityCategories(value);
        setFormCategories({
          isLoaded: true,
          data: res.data.data || [],
        });
        
        // Only reset brands and other fields if not in edit mode
        if (!isEditMode) {
          setFormBrands({ isLoaded: false, data: [] }); // Reset brands
          setState((p) => ({
            ...p,
            [key]: value,
            categoryID: "",
            brandID: "",
          }));
        } else {
          // In edit mode, just update the city without resetting other fields
          setState((p) => ({
            ...p,
            [key]: value,
          }));
        }

      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      }
    } else if (key === "categoryID" && value) {
      try {
        console.log("Loading brands for category:", value);
        const res = await getCategoryBrands(value);
        setFormBrands({
          isLoaded: true,
          data: res.data.data || [],
        });
        
        // In edit mode, check if we should preserve the brandID
        const currentState = { ...state };
        const shouldPreserveBrand = isEditMode && currentState.brandID;
        
        if (shouldPreserveBrand) {
          console.log("Preserving brand ID in edit mode:", currentState.brandID);
          setState((p) => ({
            ...p,
            [key]: value,
            // Keep the existing brandID
          }));
        } else {
          setState((p) => ({
            ...p,
            [key]: value,
            brandID: "",
          }));
        }

      } catch (error) {
        console.error('Error fetching brands:', error);
        toast.error('Failed to load brands');
      }
    } else {
      setState((p) => ({
        ...p,
        [key]: value,
      }));
    }
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
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      if (res.data.data.length === 0 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      setShow(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      const errorMessage = error.response?.data?.msg || error.message || "Failed to delete product. Please try again.";
      toast.error(errorMessage);
      checkAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const updateData = {
        ...values,
        image: state.image,
        includePacking: state.includePacking,
        includeBulkOrder: state.includeBulkOrder,
        bulkOrders: state.bulkOrders || [],
        isDiscounted: values.isDiscounted || false,
        discountType: values.discountType || 'Percentage',
        discount: values.discount || 0,
      };
  
      if (state.id) {
        updateData.id = state.id;
        updateData.productId = state.productId || values.productId;
        updateData.cityID = values.cityID || state.cityID;
        await updateProduct(updateData, token);
      } else {
        await createProduct(updateData, token);
      }

      const link = `/product/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&brand=${selectedBrandId}&category=${selectedCategoryId}`;
      const res = await getDatas(link);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setShow(false);
      clearForm();
      toast.success(`Product ${state.id ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Error saving product:', error);
      const errorMessage = error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to save product';
      toast.error(errorMessage);
      checkAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async () => {
    try {
      if (stock > 0) {
        setLoading(true);
        await updateProduct(
          {
            ...selectedProduct,
            id: selectedProduct._id,
            stock: stock,
            categoryID: selectedProduct.categoryID?._id || selectedProduct.categoryID,
            cityID: selectedProduct.cityID?._id || selectedProduct.cityID,
            brandID: selectedProduct.brandID?._id || selectedProduct.brandID,
          },
          token
        );
        
        // Update the item in the current data array to reflect the change immediately
        const updatedData = data.map(product => {
          if (product._id === selectedProduct._id) {
            return {
              ...product,
              stock: stock
            };
          }
          return product;
        });
        
        // Update the UI immediately with the changed data
        setData(updatedData);
        
        // Refresh product list with a longer delay to ensure server has processed the update
          setTimeout(() => {
            const queryParams = new URLSearchParams();
            queryParams.append('page', currentPage);
            queryParams.append('limit', limit);
            if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
          if (selectedCityId) queryParams.append('city', selectedCityId);
          if (selectedBrandId) queryParams.append('brand', selectedBrandId);
          if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
          
          const link = `/product/search?${queryParams.toString()}`;
          getDatas(link)
            .then((res) => {
              if (res && res.data) {
                setData(res.data.data);
                setTotalPages(res.data.totalPages);
              } else {
                console.error('Invalid response format when refreshing product list');
              }
              setLoading(false);
            })
            .catch((err) => {
              console.error('Error refreshing product list:', err);
              setLoading(false);
            });
        }, 1500); // Increased to 1500ms delay for better reliability
        setStockModal(false);
        setSelectedProduct(null);
      }
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
      const url = res.data.data;
      setState((p) => ({
        ...p,
        image: url,
      }));
      setFileUpload(false);
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      console.log(`Updating ${name} to ${checked} for product ID: ${item._id}`);
      
      // Create a simple object with only the necessary fields
      const updateData = {
        id: item._id,
        isActive: name === 'isActive' ? checked : item.isActive,
        adminVerified: name === 'adminVerified' ? checked : item.adminVerified
      };
      
      // Log the data being sent
      console.log('Sending update data:', updateData);
      
      const response = await updateProductStatus(updateData, token);
      console.log('Update status response:', response.data);
      
      // Update the item in the current data array to reflect the change immediately
      const updatedData = data.map(product => {
        if (product._id === item._id) {
          return {
            ...product,
            [name]: checked
          };
        }
        return product;
      });
      
      // Update the UI immediately with the changed data
      setData(updatedData);
      
      toast.success('Product status updated successfully');
      
      // Refresh product list with a longer delay to ensure server has processed the update
      setTimeout(() => {
        const queryParams = new URLSearchParams();
        queryParams.append('page', currentPage);
        queryParams.append('limit', limit);
        if (debouncedSearchTerm) queryParams.append('searchTerm', debouncedSearchTerm);
        if (selectedCityId) queryParams.append('city', selectedCityId);
        if (selectedBrandId) queryParams.append('brand', selectedBrandId);
        if (selectedCategoryId) queryParams.append('category', selectedCategoryId);
        
        const link = `/product/search?${queryParams.toString()}`;
        getDatas(link)
          .then((res) => {
            if (res && res.data) {
              setData(res.data.data);
              setTotalPages(res.data.totalPages);
            } else {
              console.error('Invalid response format when refreshing product list');
            }
            setLoading(false);
          })
          .catch((err) => {
            console.error('Error refreshing product list:', err);
            setLoading(false);
          });
      }, 1500); // Increased to 1500ms delay for better reliability
      
      setShow(false);
      clearForm();
    } catch (error) {
      setLoading(false);
      console.error('Error in updateDataHandler:', error);
      
      // Check if it's an authentication error
      checkAuthError(error);
      
      // Display a more descriptive error message
      const errorMessage = error.response?.data?.errors?.[0]?.msg || 
                          error.response?.data?.msg || 
                          error.message || 
                          'Failed to update product status';
      
      toast.error(errorMessage);
    }
  };

 const editHandler = async (item) => {
  try {
    setLoading(true);

    // Extract IDs - handle both populated objects and direct ObjectId strings
    const cityId = item.cityID?._id || item.cityID || "";
    
    // Handle category ID - check for populated object first, then direct ID
    let categoryId = "";
    if (item.category) {
      if (typeof item.category === 'object' && item.category._id) {
        categoryId = item.category._id;
      } else if (typeof item.category === 'string') {
        categoryId = item.category;
      }
    } else if (item.categoryID) {
      if (typeof item.categoryID === 'object' && item.categoryID._id) {
        categoryId = item.categoryID._id;
      } else if (typeof item.categoryID === 'string') {
        categoryId = item.categoryID;
      }
    }
    
    // Handle brand ID - check for populated object first, then direct ID
    let brandId = "";
    if (item.brand) {
      if (typeof item.brand === 'object' && item.brand._id) {
        brandId = item.brand._id;
      } else if (typeof item.brand === 'string') {
        brandId = item.brand;
      }
    } else if (item.brandID) {
      if (typeof item.brandID === 'object' && item.brandID._id) {
        brandId = item.brandID._id;
      } else if (typeof item.brandID === 'string') {
        brandId = item.brandID;
      }
    }
    
    console.log("Editing product with:", {
      cityId,
      categoryId,
      brandId
    });

    // STEP 1: Load all categories first
    let allCategories = [];
    if (categories.isLoaded) {
      allCategories = categories.data;
    } else {
      const categoriesRes = await getAllCategories();
      allCategories = categoriesRes.data.data || [];
      setCategories({ isLoaded: true, data: allCategories });
    }

    // Set form categories immediately
    setFormCategories({ 
      isLoaded: true, 
      data: allCategories 
    });

    // STEP 2: Load brands based on category
    let brandsToLoad = [];
    if (categoryId) {
      try {
        const brandsRes = await getCategoryBrands(categoryId);
        const brandsForCategory = brandsRes.data.data || [];
        
        // Check if the brand exists in the loaded brands
        const brandExists = brandsForCategory.some(brand => 
          brand._id === brandId || 
          (brand.brandId && brand.brandId === brandId)
        );
        
        if (!brandExists && brandId) {
          // If brand not found in category brands, load all brands as fallback
          const allBrandsRes = await getAllBrands();
          brandsToLoad = allBrandsRes.data.data || [];
        } else {
          brandsToLoad = brandsForCategory;
        }
      } catch (error) {
        console.error("Error loading brands for category:", error);
        // Fallback to all brands if category brands fail
        try {
          const allBrandsRes = await getAllBrands();
          brandsToLoad = allBrandsRes.data.data || [];
        } catch (fallbackError) {
          console.error("Error loading all brands as fallback:", fallbackError);
          brandsToLoad = [];
        }
      }
    } else {
      // No category selected, load all brands
      try {
        const allBrandsRes = await getAllBrands();
        brandsToLoad = allBrandsRes.data.data || [];
      } catch (error) {
        console.error("Error loading all brands:", error);
        brandsToLoad = [];
      }
    }

    // Set form brands and ensure we have the brand in the list
    if (brandId && brandsToLoad.length > 0) {
      // Check if the brand exists in the loaded brands
      const brandExists = brandsToLoad.some(brand => 
        brand._id === brandId || 
        (brand.brandId && brand.brandId === brandId)
      );
      
      if (!brandExists) {
        console.log(`Brand with ID ${brandId} not found in loaded brands, attempting to fetch it`);
        try {
          // Try to fetch the specific brand
          const brandRes = await getBrand(brandId);
          if (brandRes.data.data) {
            // Add the brand to the list if found
            brandsToLoad.push(brandRes.data.data);
            console.log(`Added brand to list:`, brandRes.data.data);
          }
        } catch (error) {
          console.error(`Failed to fetch brand with ID ${brandId}:`, error);
        }
      }
    }
    
    // Now set the brands
    setFormBrands({ 
      isLoaded: true, 
      data: brandsToLoad 
    });
    
    console.log(`Loaded ${brandsToLoad.length} brands, brandId=${brandId}`);

    // STEP 3: Now set the state with all data loaded
    const finalState = {
      id: item._id || "",
      productId: item.productId || "",
      englishTitle: item.englishTitle || "",
      urduTitle: item.urduTitle || "",
      urduDescription: item.urduDescription || "",
      englishDescription: item.englishDescription || "",
      price: item.price || 0,
      stock: item.stock || 0,
      image: item.image || "",
      cityID: cityId,
      categoryID: categoryId,
      brandID: brandId,      
      unitID: item.unitID || "",
      discount: item.discount || 0,
      discountType: item.discountType || "Percentage",
      isDiscounted: item.isDiscounted || false,
      isActive: item.isActive !== undefined ? item.isActive : true,
      includeBulkOrder: item.includeBulkOrder || false,
      packings: item.packings || "",
      includePacking: item.includePacking || false,
      purchaseRate: item.purchaseRate || 0,
      purchaseDiscount: item.purchaseDiscount || 0,
      salesDiscount: item.salesDiscount || 0,
      cortanSize: item.cortanSize || 0,
      bulkOrders: item.bulkOrders || [],
    };
    
    console.log("Setting final state with:", {
      categoryID: finalState.categoryID,
      brandID: finalState.brandID
    });
    
    setState(finalState);
    setStock(item.stock || 0);
    setShow(true);

  } catch (error) {
    console.error("Error in editHandler:", error);
    toast.error("Failed to load product data for editing.");
  } finally {
    setLoading(false);
  }
};

  const addHandler = async () => {
    clearForm();
    setShow(true);
  };

  const citySelectHandler = async (e) => {
    // Prevent changing city for Coordinators; lock to their assigned city
    if (isCoordinator) {
      setSelectedCityId(coordinatorCityId || "");
      setCurrentPage(1);
      return;
    }
    const value = e.target.value;
    setSelectedCityId(value || "");
    setCurrentPage(1);
  };

  const categorySelectHandler = async (e) => {
    const value = e.target.value;
    setSelectedCategoryId(value || "");
    setSelectedBrandId("");
    setCurrentPage(1);
  };

  const brandSelectHandler = async (e) => {
    const value = e.target.value;
    setSelectedBrandId(value || "");
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };
  
  const refreshData = () => {
    setSearchTerm('');
    setSelectedCityId(isCoordinator ? coordinatorCityId : '');
    setSelectedBrandId('');
    setSelectedCategoryId('');
    setCurrentPage(1);
  };

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setDebouncedSearchTerm(e.target.value);
      // The API call will be triggered by the useEffect that watches debouncedSearchTerm
    }
  };

  // Bulk Discount Handlers
  const addDiscountRow = () => {
    setDiscountRows([...discountRows, { quantity: '', discount: '', type: 'Percentage' }]);
  };

  const removeDiscountRow = (index) => {
    if (discountRows.length > 1) {
      const newRows = discountRows.filter((_, i) => i !== index);
      setDiscountRows(newRows);
    }
  };

  const updateDiscountRow = (index, field, value) => {
    const newRows = [...discountRows];
    newRows[index][field] = value;
    setDiscountRows(newRows);
  };

  const saveBulkDiscount = async () => {
    // Validate discount rows
    const validRows = discountRows.filter(row => row.quantity && row.discount !== '' && row.type);
    if (validRows.length === 0) {
      toast.error('Please add at least one valid discount row');
      return;
    }

    // Validate that quantities and discounts are valid numbers
    for (const row of validRows) {
      if (isNaN(row.quantity) || row.quantity <= 0) {
        toast.error('Please enter a valid positive number for quantity');
        return;
      }
      if (isNaN(row.discount) || row.discount < 0) {
        toast.error('Please enter a valid non-negative number for discount');
        return;
      }
      if (row.type === 'Percentage' && row.discount > 100) {
        toast.error('Percentage discount cannot exceed 100');
        return;
      }
    }

    try {
      setLoading(true);
      
      // Prepare the bulk discount data
      const bulkDiscountQuantity = validRows.map(row => parseFloat(row.quantity));
      const bulkDiscount = validRows.map(row => parseFloat(row.discount));
      const bulkDiscountType = validRows.map(row => row.type);
      
      const updateData = {
        id: bulkDiscountProduct._id,
        bulkDiscountQuantity,
        bulkDiscount,
        bulkDiscountType,
        discountType: bulkDiscountProduct.discountType || 'Percentage',
        // Include all required fields to pass backend validation
        productId: bulkDiscountProduct.productId,
        englishTitle: bulkDiscountProduct.englishTitle,
        urduTitle: bulkDiscountProduct.urduTitle,
        price: bulkDiscountProduct.price || bulkDiscountProduct.saleRate,
        stock: bulkDiscountProduct.stock,
        cortanSize: bulkDiscountProduct.cortanSize,
        purchaseRate: bulkDiscountProduct.purchaseRate,
        cityID: bulkDiscountProduct.cityID?._id || bulkDiscountProduct.cityID,
        categoryID: bulkDiscountProduct.category?._id || bulkDiscountProduct.category,
        brandID: bulkDiscountProduct.brand?._id || bulkDiscountProduct.brand,
        // Additional required fields for validation
        includePacking: bulkDiscountProduct.includePacking || false,
        includeBulkOrder: bulkDiscountProduct.includeBulkOrder || false,
        isDiscounted: bulkDiscountProduct.isDiscounted || false,
        discount: bulkDiscountProduct.discount || 0,
        bulkOrders: bulkDiscountProduct.bulkOrders || [],
      };
      
      // Call the update API
      await updateProduct(updateData, token);
      
      // Update the product in the current data array
      const updatedData = data.map(product => {
        if (product._id === bulkDiscountProduct._id) {
          return {
            ...product,
            bulkDiscountQuantity,
            bulkDiscount,
            bulkDiscountType,
          };
        }
        return product;
      });
      setData(updatedData);
      
      toast.success('Bulk discount saved successfully!');
      setShowBulkDiscountModal(false);
      setDiscountRows([{ quantity: '', discount: '' }]);
      setBulkDiscountProduct(null);
      
    } catch (error) {
      console.error('Error saving bulk discount:', error);
      const errorMessage = error.response?.data?.errors?.[0]?.msg || 
                          error.response?.data?.msg || 
                          error.message || 
                          'Failed to save bulk discount';
      toast.error(errorMessage);
      checkAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const closeBulkDiscountModal = () => {
    setShowBulkDiscountModal(false);
    setDiscountRows([{ quantity: '', discount: '', type: 'Percentage' }]);
    setBulkDiscountProduct(null);
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      toast.error("No file selected");
      return;
    }
    
    setImportLoading(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No sheets found in the Excel file');
      }
      
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found`);
      }
      
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });
      if (rows.length === 0) {
        throw new Error('Excel sheet is empty');
      }
      
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      const codeIndex = headers.findIndex(header => 
        header && header.toString().trim().toLowerCase() === 'code'
      );
      const locationCodeIndex = headers.findIndex(header => 
        header && header.toString().trim().toLowerCase() === 'fieldb'
      );
  
      if (codeIndex === -1 || locationCodeIndex === -1) {
        throw new Error('Required columns not found');
      }
      
      const filteredRows = dataRows.filter(row => {
        const productCode = row[codeIndex];
        return productCode && String(productCode).trim() !== '';
      });
      
      if (filteredRows.length === 0) {
        throw new Error('No valid products found');
      }
      
      if (!cities.isLoaded || cities.data.length === 0) {
        const citiesRes = await getAllCities();
        setCities({ data: citiesRes.data.data, isLoaded: true });
        var citiesData = citiesRes.data.data;
      } else {
        var citiesData = cities.data;
      }
      
      const [categoriesRes, brandsRes] = await Promise.all([
        getAllCategories(),
        getAllBrands()
      ]);
      
      const allCategories = categoriesRes.data.data;
      const allBrands = brandsRes.data.data;
      
      const jsonData = [];
      const invalidLocationCodes = new Set();
      const skippedProducts = [];
      
      filteredRows.forEach((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          if (header) {
            const cleanHeader = header.toString().trim().toLowerCase().replace(/\s+/g, '');
            obj[cleanHeader] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
          }
        });
        
        const productCode = obj['code'];
        const locationCode = obj['fieldb'];
        
        const matchingCity = citiesData.find(city => 
          String(city.locationId).trim() === locationCode.trim()
        );
        
        if (!matchingCity) {
          invalidLocationCodes.add(locationCode);
          return;
        }
        
        const stockValue = Number(obj['openingqty']) || 0;
        // Truncate decimal values for price fields by using Math.floor
        const salePrice = Math.floor(Number(obj['saleprice/rate'])) || 0;
        const costPrice = Math.floor(Number(obj['cost'])) || 0;
        
        const productData = {
          productId: productCode,
          englishTitle: obj['name'] || productCode,
          urduTitle: obj['name'] || productCode,
          price: salePrice,
          purchaseRate: costPrice,
          saleRate: salePrice,
          stock: stockValue,
          cortanSize: Number(obj['fielda']) || 0,
          packings: obj['saleinformation'] || '',
          image: '',
          urduDescription: obj['saleinformation'] || '',
          englishDescription: obj['saleinformation'] || '',
          cityID: matchingCity._id,
          category: (() => {
            const categoryName = obj['category'] || '';
            if (!categoryName) return null;
            
            const matchedCategory = allCategories.find(
              cat => cat.englishName?.toLowerCase() === categoryName.toLowerCase()
            );
            
            if (!matchedCategory) {
              const errorMsg = `Skipping product ${productCode}: Category "${categoryName}" not found`;
              console.warn(errorMsg);
              skippedProducts.push(errorMsg);
              return null;
            }
            return matchedCategory._id;
          })(),
          brand: (() => {
            const brandName = obj['field1'] || '';
            if (!brandName) {
              const errorMsg = `Skipping product ${productCode}: No brand specified`;
              console.warn(errorMsg);
              skippedProducts.push(errorMsg);
              return null;
            }
            
            const matchedBrand = allBrands.find(
              brand => brand.englishName?.toLowerCase() === brandName.toLowerCase()
            );
            
            if (!matchedBrand) {
              const errorMsg = `Skipping product ${productCode}: Brand "${brandName}" not found`;
              console.warn(errorMsg);
              skippedProducts.push(errorMsg);
              return null;
            }
            return matchedBrand._id;
          })(),
          includePacking: Boolean(obj['saleinformation']),
          includeBulkOrder: false,
          bulkOrders: [],
          isDiscounted: false,
          discountType: 'Percentage',
          discount: 0,
          isActive: true,
          adminVerified: true,
        };
        
        if (productData.category && productData.brand) {
          jsonData.push(productData);
        }
      });
      
      if (jsonData.length === 0) {
        let errorMsg = 'No valid products to import after processing.';
        if (skippedProducts.length > 0) {
          errorMsg += '\n\nSkipped products due to missing categories or brands:\n' + skippedProducts.join('\n');
        }
        throw new Error(errorMsg);
      } else if (skippedProducts.length > 0) {
        console.warn('Some products were skipped due to missing categories or brands:', skippedProducts);
        toast.warn(`${skippedProducts.length} products were skipped due to missing categories or brands.`);
      }
      

      
      const BATCH_SIZE = 50;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const allErrors = [];
      
      for (let i = 0; i < jsonData.length; i += BATCH_SIZE) {
        const batch = jsonData.slice(i, i + BATCH_SIZE);

        
        try {
          const res = await fetch('https://primelinkdistribution.com/api/product/import-excel', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ 
              products: batch,
              isUpdate: true
            }),
          });
          
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          
          const result = await res.json();

          
          if (result.msg === 'success') {
            totalImported += result.imported || 0;
            totalUpdated += result.updated || 0;
            totalFailed += result.failed || 0;
            if (result.errors && result.errors.length > 0) {
              allErrors.push(...result.errors);
            }
          } else {
            throw new Error(result.message || 'Unknown error occurred during batch import');
          }
          
          if (i + BATCH_SIZE < jsonData.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
        } catch (batchError) {
          console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
          allErrors.push({
            batch: Math.floor(i/BATCH_SIZE) + 1,
            error: batchError.message
          });
          totalFailed += batch.length;
        }
      }
      
      const successMessage = `Successfully processed ${jsonData.length} products (${totalImported} new, ${totalUpdated} updated)${totalFailed ? `, ${totalFailed} failed` : ''}`;
      
      if (totalFailed > 0) {
        toast.warning(successMessage);
        if (allErrors.length > 0) {
          console.error("All errors:", allErrors);
          toast.error(`Some items failed to import. Check console for details.`);
        }
      } else {
        toast.success(successMessage);
      }
      
      setShowImportModal(false);
      refreshData();
      
    } catch (err) {
      console.error("=== IMPORT ERROR ===");
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      toast.error(`Failed to import Excel file: ${err.message}`);
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  const handleExportToExcel = () => {
    try {
      setExportLoading(true);
      const products = data || [];
      if (!products || products.length === 0) {
        toast.info('No products found to export');
        return;
      }
      
      const exportData = products.map(product => ({
        'Code': product.productId || '',
        'Name': product.englishTitle || '',
        'FieldA': product.cortanSize?.toString() || '1',
        'FieldB': product.cityID?.locationId || product.cityID?._id || '',
        'Unit': product.unit || 'PCS',
        'Opening Qty': product.stock?.toString() || '0',
        'Sale Price/Rate': product.saleRate ? Math.floor(product.saleRate).toString() : (product.price ? Math.floor(product.price).toString() : '0'),
        'Cost': product.purchaseRate ? Math.floor(product.purchaseRate).toString() : '0',
        'Sale Information': product.packings || ''
      }));
      
      const headers = [
        'Code',
        'Name',
        'FieldA',
        'FieldB',
        'Unit',
        'Opening Qty',
        'Sale Price/Rate',
        'Cost',
        'Sale Information'
      ];
      
      const ws = XLSX.utils.json_to_sheet(exportData, { header: headers });
      const columnWidths = [
        { wch: 15 },
        { wch: 30 },
        { wch: 10 },
        { wch: 15 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 10 },
        { wch: 40 }
      ];
      ws['!cols'] = columnWidths;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `products_export_${date}.xlsx`);
      
      toast.success(`${products.length} products exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Failed to export products: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) return <Loader />;


  return (
    <div className='relative'>
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl font-bold'>Inventory</h1>
        <div className='md:mr-[-110px] md:block hidden w-10'></div>
        <div className='flex flex-wrap gap-4 justify-center items-center p-2'>
          <div className='flex bg-[#FFFFFF] rounded-xl px-1 w-full sm:w-auto'>
            <img src="/Search.svg" alt="search" className='' />
            <input
              onChange={handleSearch}
              onKeyPress={searchHandler}
              value={searchTerm}
              className='p-2 outline-none rounded-xl w-full'
              type="search"
              name="search"
              id=""
              placeholder='Search by title'
            />
          </div>

          <select value={selectedCityId} onChange={citySelectHandler} disabled={isCoordinator} className='bg-[#FFFFFF] rounded-lg p-2 w-full sm:w-auto'>
            <option value="">Select Location</option>
            <option value="">View All</option>
            {cities.data.map((item) => (
              <option value={item._id} key={item._id}>{item.name}</option>
            ))}
          </select>

          <select value={selectedCategoryId} onChange={categorySelectHandler} className='bg-[#FFFFFF] rounded-lg p-2 w-full sm:w-auto'>
            <option value="">Select Category</option>
            <option value="">View All</option>
            {categories.data.map((item) => (
              <option value={item._id} key={item._id}>{item.englishName}</option>
            ))}
          </select>

          <select value={selectedBrandId} onChange={brandSelectHandler} className='bg-[#FFFFFF] rounded-lg p-2 w-full sm:w-auto'>
            <option value="">Select Brand</option>
            <option value="">View All</option>
            {filteredFilterBrands.map((item) => (
              <option value={item._id} key={item._id}>{item.englishName}</option>
            ))}
          </select>

          {!role.includes(ROLES[2]) && (
            <button
              className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto'
              onClick={addHandler}
            >
              + Add Inventory
            </button>
          )}

          <button
            className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto flex items-center gap-1 justify-center'
            onClick={() => setShowImportModal(true)}
          >
            <FaFileImport className="mr-1" />
            Import Excel
          </button>

          <button
            onClick={handleDownloadSample}
            className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto'
          >
            Download Sample
          </button>

          <button
            onClick={handleExportInventory}
            className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto flex items-center gap-1 justify-center'
          >
            <FaFileExport className="mr-1" />
            Export Inventory
          </button>

          {selectedProductIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className='bg-[#FFD7CE] text-[#FF5934] text-nowrap font-bold p-2 rounded w-full sm:w-auto flex items-center gap-1 justify-center'
            >
              <FaMinus className="mr-1" />
              Delete Selected ({selectedProductIds.length})
            </button>
          )}
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left text-gray-500'>
              <td className='p-2'>
                <input 
                  type="checkbox" 
                  checked={data.length > 0 && selectedProductIds.length === data.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </td>
              <td>Image</td>
              <td>Product ID</td>
              <td>Title (EN)</td>
              <td>Category</td>
              <td>Brand</td>
              <td>Price</td>
              <td>In Stock</td>
              {!role.includes(ROLES[2]) && (
                <>
                  <td>Active</td>
                  <td className='text-nowrap'>Admin Verified</td>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((product, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='p-2 bg-[#FFFFFF] rounded-l-xl'>
                  <input 
                    type="checkbox" 
                    checked={selectedProductIds.includes(product._id)}
                    onChange={() => toggleSelectProduct(product._id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className='p-2 bg-[#FFFFFF]'>
                  <img 
                    src={product.image || '/placehold.jpg'} 
                    alt='Product' 
                    className='w-10 h-10 object-cover rounded-full'
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/placehold.jpg';
                    }}
                  />
                </td>
                <td className='p-2 bg-[#FFFFFF] uppercase'>{product.productId || "-"}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.englishTitle}</td>
                <td className='p-2 bg-[#FFFFFF]'>{categories.isLoaded ? memoizedGetCategoryName(product.category) : '...'}</td>
                <td className='p-2 bg-[#FFFFFF]'>{brands.isLoaded ? memoizedGetBrandName(product.brand) : '...'}</td>
                <td className='p-2 bg-[#FFFFFF]'>{Math.floor(product.price)}</td>
                <td className='p-2 bg-[#FFFFFF]'>
                  <div className='flex flex-col text-sm items-center justify-center'>
                    {product.stock}
                  </div>
                </td>
                {!role.includes(ROLES[2]) && (
                  <>
                    <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.isActive, "isActive", product)}>
                      {product.isActive ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}
                    </td>
                    <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}>
                      {product.adminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}
                    </td>
                  </>
                )}
                <td className='bg-[#FFFFFF] rounded-r-xl'>
                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                    <div className='flex gap-5'>
                      <FaRegEye onClick={() => {
                        setStock(product.stock);
                        // Ensure brand information is properly set when viewing product details
                        const productWithBrand = {
                          ...product,
                          brandID: product.brand ? (typeof product.brand === 'string' ? product.brand : product.brand._id) : null
                        };
                        setSelectedProduct(productWithBrand);
                      }} />
                      {!role.includes(ROLES[2]) && (
                        <button className='flex' onClick={() => setShowDropdown(prev => prev === product._id ? "" : product._id)}>
                          <HiDotsVertical />
                        </button>
                      )}
                    </div>
                    {showDropdown === product._id && (
                      <ClickOutside onClick={() => setShowDropdown('')}>
                        <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                          role="menu"
                          aria-orientation="vertical"
                          aria-labelledby="dropdownButton">
                          <div className="flex flex-col gap-2 justify-center items-start" role="none">
                            <li onClick={() => {
                              editHandler(product);
                              setShowDropdown("");
                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                              <button className="btn btn-light">Edit</button>
                            </li>
                            <li onClick={() => {
                              setBulkDiscountProduct(product);
                              
                              // Load existing bulk discount data if available
                              if (product.bulkDiscountQuantity && product.bulkDiscount && 
                                  product.bulkDiscountQuantity.length > 0 && product.bulkDiscount.length > 0) {
                                const existingRows = product.bulkDiscountQuantity.map((quantity, index) => ({
                                  quantity: quantity.toString(),
                                  discount: product.bulkDiscount[index]?.toString() || '',
                                  type: product.bulkDiscountType && product.bulkDiscountType[index] ? product.bulkDiscountType[index] : 'Percentage'
                                }));
                                setDiscountRows(existingRows);
                              } else {
                                // Reset to default single row if no existing data
    setDiscountRows([{ quantity: '', discount: '', type: 'Percentage' }]);
                              }
                              
                              setShowBulkDiscountModal(true);
                              setShowDropdown("");
                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                              <button className="btn btn-light">Bulk Discount</button>
                            </li>
                            <li onClick={() => {
                              deleteHandler(product._id);
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
            )) : (
              <div>No products found!</div>
            )}
          </tbody>
        </table>
      </div>
      <div
        className="pagination-container"
        style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "space-between", margin: 0 }}
      >
        <div className='flex items-center gap-2'>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <GrFormPrevious className='text-white' />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span>{currentPage}</span> <span>/</span>
            <span>{totalPages}</span>
          </div>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={totalPages <= currentPage}
          >
            <GrFormNext className='text-white' />
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-500'>Show:</span>
          <select 
            value={limit} 
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCurrentPage(1);
            }} 
            className='bg-[#FFFFFF] rounded-lg p-1 border text-sm outline-none'
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      {show && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white w-[380px] max-h-[90vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg">
            <div className="border-b border-gray-300 px-4 py-3">
              <h2 className="text-xl font-bold">Add Inventory</h2>
              {loading && <Spinner />}
            </div>
            <Formik
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
              enableReinitialize={true}
            >
              {() => (
                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                  <h6 className="font-semibold p-6 mb-2">Thumbnail</h6>
                  <div className="px-6">
                    <div className="relative h-[200px] flex border border-gray-300 border-dotted flex-col justify-center items-center p-4 rounded-lg mb-4">
                      {state.image ? (
                        <img
                          src={state.image}
                          alt="Preview"
                          className="w-20 h-20 rounded-full cursor-pointer object-cover mb-4"
                        />
                      ) : (
                        <img
                          src="/Avatar.svg"
                          alt="Default Avatar"
                          className="w-20 h-20 mt-2 rounded-full cursor-pointer object-cover mb-4"
                        />
                      )}
                      {fileUpload ? (
                        <Spinner />
                      ) : (
                        <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height="100%" />
                      )}
                    </div>
                    <Input
                      name="productId"
                      label="Product ID"
                      placeholder="Enter unique product ID"
                      changeHandler={changeHandler}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <div className="flex flex-shrink-0 gap-2">
                      <Input
                        name="englishTitle"
                        label="English title"
                        placeholder="Title in english"
                        changeHandler={changeHandler}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                      />
                      <Input
                        name="urduTitle"
                        placeholder="اردو میں عنوان"
                        label="Urdu Title"
                        changeHandler={changeHandler}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                      />
                    </div>
                    <Select
                      name="cityID"
                      label="Location"
                      data={cities.data}
                      searchKey="_id"
                      searchValue="name"
                      value={state.cityID}
                      changeHandler={changeHandler}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <Select
                      name="categoryID"
                      label="Category"
                      data={formCategories.data}
                      searchKey="_id"
                      searchValue="englishName"
                      value={state.categoryID}
                      changeHandler={changeHandler}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <Select
                      name="brandID"
                      label="Brand"
                      data={formBrands.data}
                      searchKey="_id"
                      searchValue="englishName"
                      value={state.brandID}
                      changeHandler={changeHandler}
                      className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                    />
                    <div className="flex flex-shrink-0 gap-2 mt-4">
                      <div className="w-full">
                        <label htmlFor="purchaseRate" className="block text-sm font-medium text-gray-700">
                          Enter Stock
                        </label>
                        <Input
                          name="stock"
                          placeholder="Enter stock"
                          type="number"
                          changeHandler={changeHandler}
                          className="bg-[#EEF0F6] p-3 mt-1 rounded w-full border border-gray-300"
                        />
                      </div>
                      <div className="w-full">
                        <label htmlFor="cortanSize" className="block text-sm font-medium text-gray-700">
                          Enter Cortan Size
                        </label>
                        <Input
                          name="cortanSize"
                          placeholder="Enter cortan rate"
                          type="number"
                          changeHandler={changeHandler}
                          className="bg-[#EEF0F6] p-3 mt-1 rounded w-full border border-gray-300"
                        />
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2 mt-4">
                      <div className="w-full">
                        <label htmlFor="purchaseRate" className="block text-sm font-medium text-gray-700">
                          Purchase Rate
                        </label>
                        <Input
                          name="purchaseRate"
                          placeholder="Enter purchase rate"
                          type="number"
                          changeHandler={changeHandler}
                          className="bg-[#EEF0F6] p-3 mt-1 rounded w-full border border-gray-300"
                        />
                      </div>
                      <div className="w-full">
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                          Sales Rate
                        </label>
                        <Input
                          name="price"
                          placeholder="Enter sales rate"
                          type="number"
                          changeHandler={changeHandler}
                          className="bg-[#EEF0F6] p-3 mt-1 rounded w-full border border-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                    <div
                      onClick={() => {
                        setFileUpload(false);
                        setShow(false);
                      }}
                      className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                    >
                      Cancel
                    </div>
                    <button
                      type="submit"
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
      {selectedProduct && !stockModal && (
        <ClickOutside onClick={() => setSelectedProduct(null)}>
          <div
            className="fixed top-0 right-0 h-full w-[30%] bg-white shadow-lg transition-transform translate-x-0"
            style={{ zIndex: 50 }}
          >
            <div className='h-full overflow-y-auto'>
              <div className='flex flex-col justify-center items-start'>
                <h2 className='text-xl px-4 pt-5 font-bold mb-4'>Product Details</h2>
                <img
                  src={selectedProduct.image || '/placehold.jpg'}
                  alt='Product'
                  className='w-full h-40 object-contain rounded-lg mb-4'
                />
              </div>
              <div className='flex items-center border-b border-gray-300 justify-between'>
                <div className='mb-2 px-4 pt-5 gap-3 font-bold flex flex-col'>
                  <div>{selectedProduct.englishTitle}</div>
                  {/* <div className='urdu mb-3'>{selectedProduct.urduTitle}</div> */}
                </div>
                {selectedProduct.isDiscounted ? (
                  <div className='mb-2 pr-3 ml-32 font-bold text-nowrap text-[#FF5934] items-center'>
                    <div>Price: <span className='line-through'>{Math.floor(selectedProduct.price)}</span></div>
                    <div>Discounted Price: {Math.floor(selectedProduct.price - (selectedProduct.discount / 100 * selectedProduct.price))} RS</div>
                  </div>
                ) : (
                  <div className='mb-2 pr-3 ml-32 font-bold flex justify-end text-nowrap text-[#FF5934] items-center'>
                    {Math.floor(selectedProduct.price)} RS
                  </div>
                )}
              </div>
              <div className='border-b border-gray-300 p-4'>
                <h1 className='font-semibold'>Brand Name</h1>
                <p>{brands.isLoaded ? memoizedGetBrandName(selectedProduct.brand || selectedProduct.brandID) : '...'}</p>
              </div>
              <div className='border-b border-gray-300 p-4'>
                <h1 className='font-semibold'>Purchase Rate</h1>
                <p>{Math.floor(selectedProduct.purchaseRate)} RS</p>
              </div>
              <div className='border-b border-gray-300 p-4'>
                <h1 className='font-semibold'>Sales Rate</h1>
                <p>{Math.floor(selectedProduct.price)} RS</p>
              </div>
              <div className='border-b border-gray-300 p-4'>
                <h1 className='font-semibold'>Carton Size</h1>
                <p>{selectedProduct.cortanSize}</p>
              </div>
              {selectedProduct.bulkOrders && selectedProduct.bulkOrders.length > 0 && (
                <div className='mb-2 p-4 border-b border-gray-300 overflow-x-auto'>
                  <strong>Bulk Orders:</strong>
                  <div className="flex flex-wrap mt-2 items-center gap-2">
                    <div className="flex flex-wrap items-center gap-2 my-3">
                      {selectedProduct.bulkOrders.map((it) => (
                        <div
                          key={it.quantity}
                          className="card flex items-center gap-3 flex-wrap rounded mt-2 w-full md:w-auto"
                        >
                          <div className="flex flex-col p-1 items-start flex-wrap gap-1">
                            <span>{"> " + it.quantity + " items "}</span>
                            <strong>{Math.floor(it.amount) + " RS"}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className='flex justify-between px-4 items-center w-full'>
                <button
                  onClick={() => {
                    setStock(0);
                    setSelectedProduct(null);
                  }}
                  className='text-[#ffff] mb-2 bg-[#FF5934] flex gap-2 w-full justify-center items-center p-2 rounded-xl mt-6'
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ClickOutside>
      )}
      {stockModal && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[380px] max-h-[90vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold mb-4'>Update Stock</h2>
              <div className="w-full flex justify-center items-center p-2 bg-[#EEF0F6] rounded">
                <input
                  className="form-input bg-transparent w-full"
                  placeholder="Amount"
                  type="number"
                  value={stock}
                  min={1}
                  onChange={(e) => {
                    if (parseInt(e.target.value) > 0) {
                      setStock(parseInt(e.target.value));
                    } else {
                      setStock(1);
                    }
                  }}
                />
              </div>
              <div className='flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6'>
                <div
                  onClick={() => {
                    setStockModal(false);
                    setSelectedProduct(null);
                  }}
                  className='bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer'
                >
                  Cancel
                </div>
                <button
                  onClick={() => handleUpdateStock()}
                  className='bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg'
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-[350px] rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Import Excel</h2>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelImport}
              disabled={importLoading}
              className="mb-4"
            />
            <div className="flex gap-4">
              <button
                className="bg-gray-300 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center"
                onClick={() => setShowImportModal(false)}
                disabled={importLoading}
              >
                Cancel
              </button>
            </div>
            {importLoading && <div className="mt-2 text-center">Importing...</div>}
          </div>
        </div>
      )}
      {showBulkDiscountModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white w-[500px] max-h-[90vh] overflow-auto rounded-xl shadow-lg">
            <div className="border-b border-gray-300 px-6 py-4">
              <h2 className="text-xl font-bold">Bulk Discount</h2>
              {bulkDiscountProduct && (
                <p className="text-gray-600 mt-1">Product: {bulkDiscountProduct.englishTitle}</p>
              )}
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="grid grid-cols-4 gap-4 mb-3">
                  <div className="font-semibold text-gray-700">Quantity (Cartons)</div>
                  <div className="font-semibold text-gray-700">Discount</div>
                  <div className="font-semibold text-gray-700">Type</div>
                  <div className="font-semibold text-gray-700">Action</div>
                </div>
                {discountRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 mb-3 items-center">
                    <input
                      type="number"
                      placeholder="Enter cartons"
                      value={row.quantity}
                      onChange={(e) => updateDiscountRow(index, 'quantity', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5934]"
                      min="1"
                    />
                    <input
                      type="number"
                      placeholder="Enter discount"
                      value={row.discount}
                      onChange={(e) => updateDiscountRow(index, 'discount', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5934]"
                      min="0"
                      max={row.type === 'Percentage' ? 100 : undefined}
                    />
                    <select
                      value={row.type}
                      onChange={(e) => updateDiscountRow(index, 'type', e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF5934]"
                    >
                      <option value="Percentage">Percentage</option>
                      <option value="Flat">Flat</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={addDiscountRow}
                        className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 flex items-center justify-center"
                        title="Add Row"
                      >
                        <FaPlus />
                      </button>
                      {discountRows.length > 1 && (
                        <button
                          onClick={() => removeDiscountRow(index)}
                          className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 flex items-center justify-center"
                          title="Remove Row"
                        >
                          <FaMinus />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-300 px-6 py-4 flex gap-4">
              <button
                onClick={closeBulkDiscountModal}
                className="bg-gray-300 w-full flex justify-center items-center h-12 px-4 py-2 rounded-lg text-center hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={saveBulkDiscount}
                className="bg-[#FF5934] w-full h-12 text-white px-4 py-2 rounded-lg hover:bg-[#e04e2b]"
              >
                Save Bulk Discount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Product;
