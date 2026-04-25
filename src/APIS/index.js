import axios from "axios";
import { SERVER_URL } from "../utils";

export const uploadFile = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/image/upload",
    headers: {
      "Content-Type": "multipart/form-data",
    },
    data: data,
  };
  return await axios.request(config);
};
export const loginWarehouseManager = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/warehouse-manager/login",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const loginCoordinator = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/coordinator/login",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const loginAdmin = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/admin/login",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const getAllCities = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/city`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getCities = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/city/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const createCity = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/city/add",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateCityStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/city/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const updateCity = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/city/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteCity = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/city/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getCityCategories = async (value) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/category/city/` + value,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getAllBrands = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/brand`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getAllCategories = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/category`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getDeletedCategories = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/category/deleted?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getCategories = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/category/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const createCategory = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/category/add",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateCategory = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/category/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const updateCategoryStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/category/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteCategory = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/category/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getDashboardData = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/admin/dashboard`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getAlBrands = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/brand`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getBrands = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/brand/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getCategoryBrands = async (category) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/brand/category/` + category,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getBrand = async (id) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/brand/` + id,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const updateBrandStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/brand/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const createBrand = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/brand/add",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateBrand = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/brand/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteBrand = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/brand/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getSetting = async (token) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/setting`,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const addSetting = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/setting/add`,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const getPlansRequests = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/planrequest`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getVendorPlansRequests = async (id) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/planrequest/` + id,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const updateReadNotificationStatus = async (id, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/notification/update/read/` + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getAdminNotifications = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/notification/admin`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const processRequest = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/planrequest/process/` + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ vendorId: data.vendorId }),
  };
  return await axios.request(config);
};


export const getBanners = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/banner/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateBanner = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/banner/update/` + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const addBanner = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/banner/add`,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const deleteBanner = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + `/banner/delete/` + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getAllSalesPersons = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/sale-user`,
    headers: {
      "Content-Type": "application/json",
    },
    // Add timeout to prevent long-hanging requests
    timeout: 10000,
  };
  
  try {
    console.log(`Fetching sales persons from: ${SERVER_URL}/sale-user`);
    const response = await axios.request(config);
    console.log('Sales persons API response status:', response.status);
    return response;
  } catch (error) {
    console.error('Error in getAllSalesPersons API call:', error);
    // Re-throw the error to be handled by the caller
    throw error;
  }
};
export const getSalesPersons = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/sale-user/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getDatas = async (link) => {
  let config = {
    method: "get",
    url: SERVER_URL + link,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const createSaleUser = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/sale-user/register",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateSaleUser = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/sale-user/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteSaleUser = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/sale-user/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateSaleUserStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/sale-user/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};

export const getAttendanceBySalesId = async (salesPersonID, days = 7) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/attendance/sales/${salesPersonID}?days=${days}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getVisitsBySalesId = async (salesPersonID, days = 7) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/visit/sales/${salesPersonID}?days=${days}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};


export const getWarehouseManagers = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/warehouse-manager/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const createWarehouseManager = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/warehouse-manager/register",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateWarehouseManager = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/warehouse-manager/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteWarehouseManagers = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/warehouse-manager/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateWarehouseManagerStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/warehouse-manager/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};

export const getRetailers = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/retailer/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const createRetialer = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/retailer/add",
    headers: {
      "x-auth-token": token,
    },
    data: data, // Pass FormData directly
  };
  return await axios.request(config);
};
export const updateRetialer = async (id, formData, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/retailer/update/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "multipart/form-data",
    },
    data: formData,
  };
  return await axios.request(config);
};
export const deleteRetialer = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/retailer/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateRetialerStatus = async (data, token) => {
  let config = {
    method: "post",
    // Backend expects verification updates at /retailer/verify/:id
    url: SERVER_URL + "/retailer/verify/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  // Debug logs for troubleshooting
  const safeLogData = { ...data };
  if (safeLogData.password) safeLogData.password = '[REDACTED]';
  console.log('[API] updateRetialerStatus request', { url: config.url, data: safeLogData });
  try {
    const res = await axios.request(config);
    console.log('[API] updateRetialerStatus success', res?.data || res);
    return res;
  } catch (err) {
    console.error('[API] updateRetialerStatus error', err?.response?.data || err?.message || err);
    throw err;
  }
};

export const getSettings = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/setting`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateSettings = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/setting/add",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
}
export const updateBannerStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/banner/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
}


export const getProducts = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/product/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const updateProductStatus = async (data, token) => {
  // Only send the required fields to update status
  const statusData = {
    isActive: data.isActive,
    adminVerified: data.adminVerified
  };
  
  let config = {
    method: "post",
    url: SERVER_URL + "/product/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(statusData),
  };

  try {
    return await axios.request(config);
  } catch (error) {
    console.error('Error updating product status:', error);
    throw error;
  }
};
export const createProduct = async (data, token) => {
  try {
    let config = {
      method: "post",
      url: SERVER_URL + "/product/add",
      headers: {
        "x-auth-token": token,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(data),
    };
    const response = await axios.request(config);
    console.log('createProduct response:', response.data); // Log success
    return response;
  } catch (error) {
    console.error('createProduct error:', error.response?.data || error.message); // Log error
    throw error; // Re-throw to handle in handleSubmit
  }
};
export const updateProduct = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/product/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteProduct = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/product/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const bulkDeleteProducts = async (ids, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/product/bulk-delete",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify({ ids }),
  };
  return await axios.request(config);
};

export const getCoordinatorOrders = async (currentPage, limit, cityId) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/order/coordinator?page=${currentPage}&limit=${limit}&cityId=${cityId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getWarhouseManagerOrders = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/order/warehouse-manager?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const getOrders = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/order/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const updateOrderStatus = async (data) => {
  // Extract id from data object
  const { id, ...dataWithoutId } = data;
  
  console.log("Original data received:", data);
  console.log("ID extracted:", id);
  console.log("Data without ID:", dataWithoutId);
  
  // For Satelment, ensure items are properly formatted
  if (dataWithoutId.status === "Satelment" && dataWithoutId.items) {
    console.log("Processing Satelment items...");
    
    // Make sure each item has the correct structure
    dataWithoutId.items = dataWithoutId.items.map(item => {
      console.log("Original item:", item);
      
      // Ensure productId is a string (not an object)
      const productId = typeof item.productId === 'object' && item.productId?._id 
        ? item.productId._id 
        : item.productId;
      
      console.log("Extracted productId:", productId);
      
      return {
        productId: productId,
        quantity: item.quantity,
        price: item.price,
        type: item.type || 'piece' // Default to 'piece' if type is not provided
      };
    });
    
    // Log the formatted items for debugging
    console.log("Formatted items for Satelment:", dataWithoutId.items);
  }
  
  let config = {
    method: "post",
    url: SERVER_URL + "/order/updatestatus/" + id,
    headers: {
      "Content-Type": "application/json",
    },
    // Send the data without the id to avoid duplication
    data: JSON.stringify(dataWithoutId),
  };
  
  console.log("Final API request config:", config);
  console.log("Request URL:", config.url);
  console.log("Request payload:", config.data);

  try {
    const response = await axios.request(config);
    console.log("API response:", response.data);
    return response;
  } catch (error) {
    console.error("API error:", error.response?.data || error.message);
    throw error;
  }
};
export const getSearchOrders = async (currentPage, limit, data) => {
  let config = {
    method: "post",
    url: SERVER_URL + `/order/filter?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data)
  };
  return await axios.request(config);
};


export const getCoordinators = async (currentPage, limit) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/coordinator/pagination?page=${currentPage}&limit=${limit}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};
export const createCoordinator = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/coordinator/register",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};
export const updateCoordinator = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/coordinator/update/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const deleteCoordinator = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/coordinator/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateCoordinatorStatus = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/coordinator/update/status/" + data.id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};
export const generateInvoice = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/order/report",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};

export const getOrdersBySalesPersonAndDate = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/order/by-salesperson-date",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};

export const generateLoadForm = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/order/load-form",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };

  return await axios.request(config);
};

export const addBank = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/bank/add", 
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const getAllBanks = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + "/bank/getall",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateBank = async (id, data) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/bank/update/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
    data, 
  };

  return await axios.request(config);
};

export const deleteBank = async (id) => {
  const config = {
    method: "delete",
    url: `${SERVER_URL}/bank/delete/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  return await axios.request(config);
};

export const updateBankStatus = async (id, status) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/bank/status/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      status: status,
    },
  };

  return await axios.request(config);
};

export const getTransactions = async (bankId) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/bank/transactions/${bankId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error getting transactions:", error);
    throw error;
  }
};

export const searchBanks = async (query) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/bank/search`,
    params: {
      query: query,
    },
  };

  return await axios.request(config);
};

export const getAllPurchases = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + "/purchase/company/getall",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const addPurchase = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/purchase/company/add", 
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const updatePurchase = async (id, data) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/purchase/company/update/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
    data, 
  };

  return await axios.request(config);
};

export const updatePurchaseStatus = async (id, status) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/purchase/company/status/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      status: status,
    },
  };

  return await axios.request(config);
};

export const searchPurchases = async (query) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/purchase/company/search`,
    params: {
      query: query,
    },
  };

  return await axios.request(config);
};

export const deletePurchase = async (id) => {
  const config = {
    method: "delete",
    url: `${SERVER_URL}/purchase/company/delete/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  return await axios.request(config);
};

export const getAllRetailers = async () => {
  let config = {
    method: "get",
    url: `${SERVER_URL}/retailer`, 
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};


export const getLedgerById = async (id) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/ledger/${id}`, // Adjust the endpoint as needed
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    return response.data; // Assuming the response contains the ledger data
  } catch (error) {
    console.error("Error fetching ledger:", error);
    throw error; // Optionally throw the error to handle it elsewhere
  }
};

export const addLedger = async (id, ledgerData) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/ledger/${id}/add`, 
    headers: {
      "Content-Type": "application/json",
    },
    data: ledgerData, 
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error adding ledger entry:", error);
    throw error; 
  }
};

export const addRetailerLedger = async (id, ledgerData) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/ledger/retailer/${id}/add`,
    headers: {
      "Content-Type": "application/json",
    },
    data: ledgerData,
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error adding retailer ledger entry:", error);
    throw error;
  }
};
export const addDirectPayment = async (id, paymentData) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/ledger/${id}/directadd`, 
    headers: {
      "Content-Type": "application/json",
    },
    data: paymentData, 
  };

  try {
    const response = await axios(config);
    return response.data; 
  } catch (error) {
    console.error("Error adding direct payment:", error);
    throw error; 
  }
};

export const addPurchaseLedger = async (id, purchaseData) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/ledger/${id}/addpurchase`,
    headers: {
      "Content-Type": "application/json",
    },
    data: purchaseData,
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error adding purchase:", error);
    throw error;
  }
};

export const getTransactionsByCompanyId = async (id) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/ledger/transactions/company/${id}`, // Ensure this matches your backend route
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    return response.data; // Assuming the response contains the transaction data
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};

export const getTransactionsByRetailerId = async (id) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/ledger/retailer/${id}`, // Adjusted to match the backend route
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios(config);
    return response.data; // Return the transaction data
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error; // Optionally, throw the error to handle it elsewhere
  }
};

export const getRetailerLedgerById = async (id) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/ledger/retailer/${id}`,
    headers: {
      "Content-Type": "application/json",
    }
  };
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("Error fetching retailer ledger:", error);
    throw error;
  }
};

// Approve a pending ledger entry
export const approveLedger = async (ledgerId, payload = { isApproved: true }) => {
  if (!ledgerId || ledgerId.length !== 24) {
    throw new Error('Invalid Ledger ID format');
  }

  const config = {
    method: 'patch',
    url: `${SERVER_URL}/ledger/${ledgerId}/approve`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: payload,
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error('Error approving ledger:', error.response?.data || error.message);
    throw error;
  }
};

// Reject a pending ledger entry
export const rejectLedger = async (ledgerId, payload = { isRejected: true }) => {
  if (!ledgerId || ledgerId.length !== 24) {
    throw new Error('Invalid Ledger ID format');
  }

  const config = {
    method: 'patch',
    url: `${SERVER_URL}/ledger/${ledgerId}/reject`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: payload,
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error('Error rejecting ledger:', error.response?.data || error.message);
    throw error;
  }
};

export const importRetailerLedgerFromExcel = async (retailerId, formData) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/ledger/retailer/${retailerId}/import-excel`,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    data: formData,
  };

  return await axios.request(config);
};
export const getLedgersByDateRange = async (companyId, startDate, endDate) => {
  const config = {
    method: 'get',
    url: `${SERVER_URL}/ledger/companies/${companyId}/ledgers/filter`, // Updated to match the endpoint
    params: {
      startDate,
      endDate,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Error fetching ledgers by date range:', error);
    throw error;
  }
};


export const getTransactionsByDateRange = async (bankId, startDate, endDate) => {
  const config = {
    method: 'get',
    url: `${SERVER_URL}/bank/${bankId}/transactions/filter`, // Update the URL to match the new endpoint structure
    params: {
      startDate,
      endDate,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Error fetching transactions by date range:', error);
    throw error;
  }
};

export const deleteLedger = async (ledgerId) => {
  // Ensure ledgerId is a valid MongoDB ObjectId
  if (!ledgerId || ledgerId.length !== 24) {
    throw new Error('Invalid Ledger ID format');
  }

  const config = {
    method: "delete",
    url: `${SERVER_URL}/ledger/${ledgerId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error('Error deleting ledger:', error.response?.data || error.message);
    throw error;
  }
};

export const updateLedger = async (ledgerId, companyId, amount, date) => {
  // Validate IDs
  if (!ledgerId || !companyId || ledgerId.length !== 24 || companyId.length !== 24) {
    throw new Error('Invalid Ledger ID or Company ID format');
  }

  const config = {
    method: 'post', // Changed from 'post' to 'put' for updates
    url: `${SERVER_URL}/ledger/${ledgerId}/${companyId}`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      amount,
      date,
    },
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error('Error updating ledger:', error.response?.data || error.message);
    throw error;
  }
};

export const updateRetailerUserStatus = async (id, status) => {
  const config = {
    method: "post",
    url: `${SERVER_URL}/retailer/status/${id}`,
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      status: status,
    },
  };

  return await axios.request(config);
};

// Function to search retailer users
export const searchRetailerUsers = async (query) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/retailer/search`,
    params: query,
  };
console.log(query);
  return await axios.request(config);
};



// Function to search retailer users
export const searchSaleUsers = async (query) => {
  const config = {
    method: "get",
    url: `${SERVER_URL}/retailer/search`,
    params: query,
  };
console.log(query);
  return await axios.request(config);
};

export const getInvoicesByRange = async (retailerId, rangeParam) => {
  const config = {
    method: 'get',
    url: `${SERVER_URL}/invoice/retailer/${retailerId}/range/${rangeParam}`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoices for range ${rangeParam}:`, error);
    throw error;
  }
};

export const getInvoicesByPurchaseId = async (companyId) => {
  const config = {
    method: 'get',
    url: `${SERVER_URL}/purchase-invoices/company/${companyId}`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error fetching invoices for company ${companyId}:`, error);
    throw error;
  }
};

// New function to get all purchase invoices
export const getAllPurchaseInvoices = async () => {
  const config = {
    method: 'get',
    url: `${SERVER_URL}/purchase-invoices/all`,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Error fetching all purchase invoices:', error);
    throw error;
  }
};

export const generatePurchaseInvoicePDF = async (data) => {
  const config = {
    method: 'post',
    url: `${SERVER_URL}/purchase-invoices/generate-pdf`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data, // Send { invoiceId: "full_id" }
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('Error generating purchase invoice PDF:', error);
    throw error;
  }
};

export const getUnits = async (token) => {
  let config = {
    method: "get",
    url: SERVER_URL + "/units",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getPaginatedUnits = async (page = 1, limit = 10, token) => {
  let config = {
    method: "get",
    url: SERVER_URL + "/units/pagination",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    params: {
      page,
      limit,
    },
  };
  return await axios.request(config);
};

export const searchUnits = async (key, page = 1, limit = 10, token) => {
  let config = {
    method: "get",
    url: SERVER_URL + "/units/search/" + key,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    params: {
      page,
      limit,
    },
  };
  return await axios.request(config);
};

export const getUnit = async (id, token) => {
  let config = {
    method: "get",
    url: SERVER_URL + "/units/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const createUnit = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/units/add",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const updateUnit = async (id, data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/units/update/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const updateUnitStatus = async (id, data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/units/update/status/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const deleteUnit = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/units/delete/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const importRetailersFromExcel = async (formData, token) => {
  let config = {
    method: 'post',
    url: SERVER_URL + '/retailer/import-excel',
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-auth-token': token,
    },
    data: formData,
  };
  return await axios.request(config);
};

// export const getAttendanceBySalesId = async (salesId, days = 7) => {
//   let config = {
//     method: "get",
//     url: SERVER_URL + `/attendance/sales/${salesId}?days=${days}`,
//     headers: {
//       "Content-Type": "application/json",
//     },
//   };
//   return await axios.request(config);
// };

// ==================== COUPON APIs ====================

export const getAllCoupons = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + "/coupons/",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const createCoupon = async (data) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/coupons",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const updateCoupon = async (id, data, token) => {
  let config = {
    method: "put",
    url: SERVER_URL + "/coupons/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const deleteCoupon = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + "/coupons/" + id,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getSalesPersonBySalesId = async (salesId) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/sale-user/by-sales-id/${salesId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

// Target API functions
export const getAllTargets = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/targets`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getTargetsBySalesperson = async (salespersonId) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/targets/salesperson/${salespersonId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getTargetsByMonth = async (month, year) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/targets/month/${month}/${year}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const createTarget = async (data, token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/targets/add",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const updateTarget = async (id, data, token) => {
  let config = {
    method: "put",
    url: SERVER_URL + `/targets/update/${id}`,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(data),
  };
  return await axios.request(config);
};

export const deleteTarget = async (id, token) => {
  let config = {
    method: "delete",
    url: SERVER_URL + `/targets/delete/${id}`,
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const updateAllAchievedTargets = async (token) => {
  let config = {
    method: "post",
    url: SERVER_URL + "/targets/update-achieved",
    headers: {
      "x-auth-token": token,
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

// Tracking - get historical routes per salesperson
export const getTrackingHistoryBySalesId = async (salesPersonID, days = 7) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/tracking/history/${salesPersonID}?days=${days}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getAllProducts = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + "/product/get-all",
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getTargetHistoryBySalespersonId = async (salesId) => {
  let config = {
    method: "get",
    url: SERVER_URL + `/targets/history/${salesId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

export const getTargetHistory = async () => {
  let config = {
    method: "get",
    url: SERVER_URL + `/targets/salesperson/${salespersonId}`,
    headers: {
      "Content-Type": "application/json",
    },
  };
  return await axios.request(config);
};

// export const getTargetsByMonth = async (month, year) => {
//   let config = {
//     method: "get",
//     url: SERVER_URL + `/targets/month/${month}/${year}`,
//     headers: {
//       "Content-Type": "application/json",
//     },
//   };
//   return await axios.request(config);
// };

// export const createTarget = async (data, token) => {
//   let config = {
//     method: "post",
//     url: SERVER_URL + "/targets/add",
//     headers: {
//       "x-auth-token": token,
//       "Content-Type": "application/json",
//     },
//     data: JSON.stringify(data),
//   };
//   return await axios.request(config);
// };

// export const updateTarget = async (id, data, token) => {
//   let config = {
//     method: "put",
//     url: SERVER_URL + `/targets/update/${id}`,
//     headers: {
//       "x-auth-token": token,
//       "Content-Type": "application/json",
//     },
//     data: JSON.stringify(data),
//   };
//   return await axios.request(config);
// };

// export const deleteTarget = async (id, token) => {
//   let config = {
//     method: "delete",
//     url: SERVER_URL + `/targets/delete/${id}`,
//     headers: {
//       "x-auth-token": token,
//       "Content-Type": "application/json",
//     },
//   };
//   return await axios.request(config);
// };

// export const updateAllAchievedTargets = async (token) => {
//   let config = {
//     method: "post",
//     url: SERVER_URL + "/targets/update-achieved",
//     headers: {
//       "x-auth-token": token,
//       "Content-Type": "application/json",
//     },
//   };
//   return await axios.request(config);
// };

// export const getAllProducts = async () => {
//   let config = {
//     method: "get",
//     url: SERVER_URL + "/product/get-all",
//     headers: {
//       "Content-Type": "application/json",
//     },
//   };
//   return await axios.request(config);
// };
