import React, { useState, useEffect } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { HiDotsVertical } from "react-icons/hi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { useSelector } from "react-redux";
import ClickOutside from '../Hooks/ClickOutside';
import { Loader } from '../components/common/loader';
import { 
  getAllCoupons, 
  createCoupon, 
  updateCoupon, 
  deleteCoupon, 
  getProducts, 
  getAllRetailers 
} from '../APIS/index';
import { SERVER_URL } from '../utils';


const LIMIT = 10;
const Coupon = () => {
  // Format a date value to YYYY-MM-DD for input[type="date"]
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    expiryDate: '',
    productSelection: 'all',
    selectedProducts: [],
    minOrderLimit: '',
    usageLimit: '',
    retailerSelection: 'all',
    selectedRetailers: [],
    discountType: 'percentage',
    discount: ''
  });

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showRetailerDropdown, setShowRetailerDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [retailerSearchTerm, setRetailerSearchTerm] = useState('');

  // Real data state
  const [products, setProducts] = useState([]);
  const [retailers, setRetailers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get authentication token from Redux store
  const token = useSelector((state) => state.admin.token);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      if (name === 'selectedProducts') {
        setFormData(prev => ({
          ...prev,
          selectedProducts: checked 
            ? [...prev.selectedProducts, value]
            : prev.selectedProducts.filter(id => id !== value)
        }));
      } else if (name === 'selectedRetailers') {
        setFormData(prev => ({
          ...prev,
          selectedRetailers: checked 
            ? [...prev.selectedRetailers, value]
            : prev.selectedRetailers.filter(id => id !== value)
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    
    // Fetch coupons first (most important for this page)
    try {
      // Create authenticated API call for coupons
      const couponsConfig = {
        method: "get",
        url: SERVER_URL + "/coupons/",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "x-auth-token": token })
        },
      };
      
      const couponsRes = await fetch(couponsConfig.url, {
        method: couponsConfig.method,
        headers: couponsConfig.headers
      }).then(res => res.json());
      
      console.log('Coupons API response:', couponsRes);
      
      if (couponsRes && couponsRes.success) {
        // Try different possible data structures
        const couponsData = couponsRes.data?.docs || couponsRes.data || [];
        console.log('Setting coupons:', couponsData);
        setCoupons(couponsData);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }

    // Fetch products (optional for coupon creation)
    try {
      const response = await fetch(`${SERVER_URL}/product/`);
      const productsRes = await response.json();
      if (productsRes.msg === "success") {
        setProducts(productsRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      // Set empty array if products fail to load
      setProducts([]);
    }

    // Fetch retailers (optional for coupon creation)
    try {
      const response = await fetch(`${SERVER_URL}/retailer`);
      const retailersRes = await response.json();
      if (retailersRes.msg === "success") {
        setRetailers(retailersRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching retailers:', error);
      // Set empty array if retailers fail to load
      setRetailers([]);
    }

    setLoading(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Prevent selecting past dates for expiry
      const todayStr = formatDateForInput(new Date());
      // Backend requires expiry to be in the future (strictly > today)
      if (!formData.expiryDate || formData.expiryDate <= todayStr) {
        alert('Expiry date must be in the future (not today).');
        setLoading(false);
        return;
      }
      if (editingCoupon) {
        // Update existing coupon
        const response = await updateCoupon(editingCoupon._id, formData, token);
        if (response.data && response.data.success) {
          setCoupons(prev => prev.map(coupon => 
            coupon._id === editingCoupon._id 
              ? response.data.data
              : coupon
          ));
          setEditingCoupon(null);
        }
      } else {
        // Add new coupon - need to modify createCoupon to accept token
        const response = await createCoupon(formData);
        if (response.data && response.data.success) {
          setCoupons(prev => [response.data.data, ...prev]);
        }
      }
      
      // Reset form
      setFormData({
        code: '',
        expiryDate: '',
        productSelection: 'all',
        selectedProducts: [],
        minOrderLimit: '',
        usageLimit: '',
        retailerSelection: 'all',
        selectedRetailers: [],
        discountType: 'percentage',
        discount: ''
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error saving coupon:', error);
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message || error?.message;
      if (serverMsg) alert(serverMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit coupon
  const handleEdit = (coupon) => {
    // Normalize selectedProducts to IDs for checkbox UI, supporting subdocument format
    const normalizedSelectedProducts = (coupon.selectedProducts || []).map(sp => {
      if (sp && sp.productId) return sp.productId;
      return sp; // legacy ID
    });
    // Normalize selectedRetailers to IDs in case population returned objects
    const normalizedSelectedRetailers = (coupon.selectedRetailers || []).map(r => {
      if (r && r._id) return r._id;
      return r;
    });

    setFormData({
      code: coupon.code,
      expiryDate: formatDateForInput(coupon.expiryDate),
      productSelection: coupon.productSelection,
      selectedProducts: normalizedSelectedProducts,
      minOrderLimit: coupon.minOrderLimit,
      usageLimit: coupon.usageLimit,
      retailerSelection: coupon.retailerSelection,
      selectedRetailers: normalizedSelectedRetailers,
      discountType: coupon.discountType,
      discount: coupon.discount
    });
    setEditingCoupon(coupon);
    setShowForm(true);
  };

  // Handle delete coupon
  const handleDelete = async (couponId) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      setLoading(true);
      try {
        const response = await deleteCoupon(couponId, token);
        if (response.data && response.data.success) {
          setCoupons(prev => prev.filter(coupon => coupon._id !== couponId));
        }
      } catch (error) {
        console.error('Error deleting coupon:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Get product names by IDs
  const getProductNames = (productIds) => {
    return products
      .filter(product => productIds.includes(product._id))
      .map(product => product.name)
      .join(', ');
  };

  // Get retailer names by IDs
  const getRetailerNames = (retailerIds) => {
    return retailers
      .filter(retailer => retailerIds.includes(retailer._id))
      .map(retailer => retailer.name)
      .join(', ');
  };

  // Pagination calculations
  const totalPages = Math.ceil(coupons.length / LIMIT);
  const startIndex = (currentPage - 1) * LIMIT;
  const endIndex = startIndex + LIMIT;
  const currentCoupons = coupons.slice(startIndex, endIndex);

  // Filter coupons based on search term
  const filteredCoupons = currentCoupons.filter(coupon =>
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        
        {/* Loading Overlay */}
        {loading && <Loader />}
        
        {/* Header matching Category page */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Coupon</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by title"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF5934] focus:border-transparent w-80"
              />
            </div>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingCoupon(null);
                setFormData({
                  code: '',
                  expiryDate: '',
                  productSelection: 'all',
                  selectedProducts: [],
                  minOrderLimit: '',
                  usageLimit: '',
                  retailerSelection: 'all',
                  selectedRetailers: [],
                  discountType: 'percentage',
                  discount: ''
                });
              }}
              className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg font-medium hover:bg-[#ffccc1] transition-colors"
            >
              + Add Coupon
            </button>
          </div>
        </div>

        

        {/* Add/Edit Coupon Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">
                  {editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}
                </h2>
            
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coupon Code */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Coupon Code *
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        placeholder="Enter coupon code"
                        required
                      />
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date *
                      </label>
                      <input
                        type="date"
                        name="expiryDate"
                        value={formData.expiryDate}
                        onChange={handleInputChange}
                        // Backend requires strictly future date; set min to tomorrow
                        min={formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000))}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        required
                      />
                    </div>

                    {/* Min Order Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Min Order Limit (Rs.) *
                      </label>
                      <input
                        type="number"
                        name="minOrderLimit"
                        value={formData.minOrderLimit}
                        onChange={handleInputChange}
                        placeholder="e.g., 1000"
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        required
                      />
                    </div>

                    {/* Usage Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Usage Limit *
                      </label>
                      <input
                        type="number"
                        name="usageLimit"
                        value={formData.usageLimit}
                        onChange={handleInputChange}
                        placeholder="e.g., 100"
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        required
                      />
                    </div>

                    {/* Discount Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount Type *
                      </label>
                      <select
                        name="discountType"
                        value={formData.discountType}
                        onChange={handleInputChange}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        required
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="value">Fixed Amount (Rs.)</option>
                      </select>
                    </div>

                    {/* Discount Value */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount {formData.discountType === 'percentage' ? '(%)' : '(Rs.)'} *
                      </label>
                      <input
                        type="number"
                        name="discount"
                        value={formData.discount}
                        onChange={handleInputChange}
                        placeholder={formData.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 50'}
                        className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300 focus:ring-2 focus:ring-[#FF5934] focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  {/* Product Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Selection *
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="productSelection"
                            value="all"
                            checked={formData.productSelection === 'all'}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          Apply to All Products
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="productSelection"
                            value="specific"
                            checked={formData.productSelection === 'specific'}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          Select Specific Products
                        </label>
                      </div>
                      
                      {formData.productSelection === 'specific' && (
                        <ClickOutside onClick={() => setShowProductDropdown(false)}>
                          <div className="relative">
                            <div 
                              className="bg-[#EEF0F6] p-3 rounded border border-gray-300 cursor-pointer flex justify-between items-center"
                              onClick={() => setShowProductDropdown(!showProductDropdown)}
                            >
                              <span className="text-gray-700">
                                {formData.selectedProducts.length > 0 
                                  ? `${formData.selectedProducts.length} product(s) selected`
                                  : 'Select products...'
                                }
                              </span>
                              <svg className={`w-5 h-5 transition-transform ${showProductDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {showProductDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {/* Search products */}
                                <div className="p-2 border-b bg-gray-50">
                                  <input
                                    type="text"
                                    value={productSearchTerm}
                                    onChange={(e) => setProductSearchTerm(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full p-2 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                                {products.length > 0 ? products
                                  .filter(product => {
                                    const q = productSearchTerm.trim().toLowerCase();
                                    if (!q) return true;
                                    const name = (product.englishTitle || product.urduTitle || product.name || '').toLowerCase();
                                    return name.includes(q);
                                  })
                                  .map(product => (
                                  <label key={product._id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      name="selectedProducts"
                                      value={product._id}
                                      checked={formData.selectedProducts.includes(product._id)}
                                      onChange={handleInputChange}
                                      className="mr-3"
                                    />
                                    <span className="text-sm">{product.englishTitle || product.urduTitle || 'Unnamed Product'}</span>
                                  </label>
                                )) : (
                                  <div className="p-3 text-sm text-gray-500">No products available</div>
                                )}
                              </div>
                            )}
                          </div>
                        </ClickOutside>
                      )}
                    </div>
                  </div>

                  {/* Retailer Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retailer Selection *
                    </label>
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="retailerSelection"
                            value="all"
                            checked={formData.retailerSelection === 'all'}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          Apply to All Customers
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="retailerSelection"
                            value="specific"
                            checked={formData.retailerSelection === 'specific'}
                            onChange={handleInputChange}
                            className="mr-2"
                          />
                          Select Specific Customers
                        </label>
                      </div>
                      
                      {formData.retailerSelection === 'specific' && (
                        <ClickOutside onClick={() => setShowRetailerDropdown(false)}>
                          <div className="relative">
                            <div 
                              className="bg-[#EEF0F6] p-3 rounded border border-gray-300 cursor-pointer flex justify-between items-center"
                              onClick={() => setShowRetailerDropdown(!showRetailerDropdown)}
                            >
                              <span className="text-gray-700">
                                {formData.selectedRetailers.length > 0 
                                  ? `${formData.selectedRetailers.length} customer(s) selected`
                                  : 'Select customers...'
                                }
                              </span>
                              <svg className={`w-5 h-5 transition-transform ${showRetailerDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {showRetailerDropdown && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {/* Search customers */}
                                <div className="p-2 border-b bg-gray-50">
                                  <input
                                    type="text"
                                    value={retailerSearchTerm}
                                    onChange={(e) => setRetailerSearchTerm(e.target.value)}
                                    placeholder="Search customers..."
                                    className="w-full p-2 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                                {retailers.length > 0 ? retailers
                                  .filter(retailer => {
                                    const q = retailerSearchTerm.trim().toLowerCase();
                                    if (!q) return true;
                                    const name = (retailer.name || retailer.businessName || retailer.ownerName || '').toLowerCase();
                                    return name.includes(q);
                                  })
                                  .map(retailer => (
                                  <label key={retailer._id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      name="selectedRetailers"
                                      value={retailer._id}
                                      checked={formData.selectedRetailers.includes(retailer._id)}
                                      onChange={handleInputChange}
                                      className="mr-3"
                                    />
                                    <span className="text-sm">{retailer.name || retailer.businessName || 'Unnamed Customer'}</span>
                                  </label>
                                )) : (
                                  <div className="p-3 text-sm text-gray-500">No retailers available</div>
                                )}
                              </div>
                            )}
                          </div>
                        </ClickOutside>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingCoupon(null);
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-6 py-2 text-white rounded-lg transition-colors duration-200 ${
                        loading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-[#FF5934] hover:bg-[#e54e2e]'
                      }`}
                    >
                      {loading 
                        ? (editingCoupon ? 'Updating...' : 'Creating...') 
                        : (editingCoupon ? 'Update Coupon' : 'Create Coupon')
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Coupon Table */}
        <div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-y-4">
              <thead>
                <tr className="bg-[#EEF0F6] text-gray-600 text-sm">
                  <td className="text-left py-3 px-4 font-medium">Code</td>
                  <td className="text-left py-3 px-4 font-medium">Discount</td>
                  <td className="text-left py-3 px-4 font-medium">Expiry Date</td>
                  <td className="text-left py-3 px-4 font-medium">Usage</td>
                  <td className="text-left py-3 px-4 font-medium">Status</td>
                  <td className="text-left py-3 px-4 font-medium">Action</td>
                </tr>
              </thead>
              <tbody>
                {filteredCoupons.map((coupon, index) => {
                  const isExpired = new Date(coupon.expiryDate) < new Date();
                  const usagePercentage = (coupon.currentUsage / coupon.usageLimit) * 100;
                  
                  return (
                    <tr key={coupon._id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-white'} hover:bg-gray-100 transition-colors`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{coupon.code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {coupon.discountType === 'percentage' ? `${coupon.discount}%` : `Rs. ${coupon.discount}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(coupon.expiryDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {coupon.currentUsage}/{coupon.usageLimit}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-[#FF5934] h-2 rounded-full"
                            style={{
                              width: `${Math.min(usagePercentage, 100)}%`
                            }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          isExpired 
                            ? 'bg-red-100 text-red-800' 
                            : usagePercentage >= 100
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {isExpired ? 'Expired' : usagePercentage >= 100 ? 'Used Up' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="relative">
                          <button
                            onClick={() => setShowDropdown(showDropdown === coupon._id ? "" : coupon._id)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <HiDotsVertical className="w-5 h-5" />
                          </button>
                          {showDropdown === coupon._id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    handleEdit(coupon);
                                    setShowDropdown("");
                                  }}
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(coupon._id);
                                    setShowDropdown("");
                                  }}
                                  className="block px-4 py-2 text-sm text-red-600 hover:bg-gray-100 w-full text-left"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredCoupons.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No coupons found</h3>
              <p className="mt-1 text-sm text-gray-500">{searchTerm ? "Try a different search term" : "Get started by creating a new coupon."}</p>
            </div>
          )}
          
        </div>
        {/* Pagination */}
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(endIndex, coupons.length)} of {coupons.length} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GrFormPrevious className="w-5 h-5" />
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === page
                    ? 'bg-[#FF5934] text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GrFormNext className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coupon;
