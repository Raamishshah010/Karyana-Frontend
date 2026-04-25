import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateInvoice, generateLoadForm, getAllSalesPersons, getCoordinatorOrders, getOrders, getSearchOrders, getWarhouseManagerOrders, updateOrderStatus, getOrdersBySalesPersonAndDate } from "../APIS";
import tick from "/tick.svg"
import { Loader } from '../components/common/loader';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye, FaFileExcel, FaTrash } from "react-icons/fa6";
import DateRangePicker from "../components/DateRangePicker";
import { toast } from 'react-toastify';
import { ORDER_STATUSES, ROLES } from '../utils';
import * as XLSX from 'xlsx';
import EscapeClose from '../components/EscapeClose';
import { useSelector } from 'react-redux';
import InvoiceTemplate from '../components/Report/InvoiceTemplate';

// Utility function to convert any date string to MM/DD/YYYY
function toMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    // YYYY-MM-DD
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    } else if (parseInt(parts[0], 10) > 12) {
      // DD/MM/YYYY -> MM/DD/YYYY
      return `${parts[1]}/${parts[0]}/${parts[2]}`;
    } else {
      // MM/DD/YYYY
      return dateStr;
    }
  }
  return dateStr;
}

const LIMIT = 10;
const Order = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState("");
  const [show, setShow] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const sidebarRef = useRef(null);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  const formatDate = (dateString) => {
    // Format date as DD/MM/YYYY for invoices
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  const dropdownRef = useRef(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [loadFormData, setLoadFormData] = useState({
    salePerson: "",
    date: ""
  });
  const [salesPersons, setSalesPersons] = useState([]);
  const formatDateForInput = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [invoiceData, setInvoiceData] = useState({
    salePerson: "",
    date: formatDateForInput(new Date()) // Set today's date as default
  });
  const { role, user, token } = useSelector((state) => state.admin);
  const [isSatelmentPopupVisible, setIsSatelmentPopupVisible] = useState(false);
  const [adjustedItems, setAdjustedItems] = useState([]);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && show) {
        setShow(false);
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [show]);

  useEffect(() => {
    setLoading(true);
    if (role.includes(ROLES[2])) {
      getWarhouseManagerOrders(currentPage, LIMIT).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    } else if (role.includes(ROLES[1])) {
      getCoordinatorOrders(currentPage, LIMIT, user.city).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    } else {
      getOrders(currentPage, LIMIT).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    }
  }, [currentPage, role, user]);

  const [isLoadFormVisible, setIsLoadFormVisible] = useState(false);
  const [isInvoiceVisible, setIsInvoiceVisible] = useState(false);
  const [showInvoiceTemplate, setShowInvoiceTemplate] = useState(false);
  const [invoiceTemplateData, setInvoiceTemplateData] = useState(null);

  const openInvoiceModal = () => {
    setIsInvoiceVisible(true);
  };

  const closeInvoiceModal = () => {
    setIsInvoiceVisible(false);
  };

  const openLoadFormModal = async () => {
    setLoading(true);
    try {
      if (!salesPersons.length) {
        const res = await getAllSalesPersons();
        setSalesPersons(res.data.data);
      }
      setIsLoadFormVisible(true);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toast.error(err.message);
    }
  };

  const closeLoadFormModal = () => {
    setIsLoadFormVisible(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown("");
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setShow(false);
      }
    };

    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show]);

  const handleEscape = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && show) {
        handleEscape();
      }
    });

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleEscape, show]);

  const dateRangeHandler = async (st, ed) => {
    try {
      const payload = {
        "startDate": st,
        "endDate": ed,
      };
      setLoading(true);
      setEndDate(ed);
      setStartDate(st);
      const res = await getSearchOrders(1, LIMIT, payload);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        try {
          const payload = {
            "startDate": startDate,
            "endDate": endDate,
            "id": searchTerm
          };
          setLoading(true);
          const res = await getSearchOrders(1, LIMIT, payload);
          setData(res.data.data);
          setTotalPages(res.data.totalPages);
          setLoading(false);
        } catch (error) {
          setLoading(false);
          toast.error(error?.response?.data?.errors[0]?.msg);
        }
      } else {
        setCurrentPage(1);
        getOrders(1, LIMIT).then((res) => {
          setData(res.data.data);
          setTotalPages(res.data.totalPages);
          setLoading(false);
        })
          .catch((err) => {
            setLoading(false);
            toast.error(err.message);
          })
      }
    }
  };

  const statusHandler = async (e) => {
    const newStatus = e.target.value;

    // Check if the new status is "Satelment"
    if (newStatus === "Satelment") {
      setAdjustedItems(selectedItem.items.map(item => ({ ...item, adjustedQuantity: item.quantity })));
      setIsSatelmentPopupVisible(true);
      return;
    }

    try {
      // Create payload with only the necessary data
      const pay = {
        status: newStatus
      };

      setLoading(true);
      // Pass the ID separately to updateOrderStatus
      await updateOrderStatus({
        ...pay,
        id: selectedItem._id
      });
      
      // Update the selected item's status and statuses array
      const updatedSelectedItem = {
        ...selectedItem,
        status: newStatus,
        statuses: [...selectedItem.statuses, { status: newStatus, date: new Date() }]
      };
      setSelectedItem(updatedSelectedItem);

      // Refresh the orders list
      const res = await getOrders(1, LIMIT);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
      setShow(false);
      toast.success("Status Updated");
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const decreaseQuantity = (itemId) => {
    setAdjustedItems(prevItems =>
      prevItems.map(item =>
        item.productId?._id === itemId && item.adjustedQuantity > 1
          ? { ...item, adjustedQuantity: item.adjustedQuantity - 1 }
          : item
      )
    );
  };

  const increaseQuantity = (itemId) => {
    setAdjustedItems(prevItems =>
      prevItems.map(item =>
        item.productId?._id === itemId
          ? { ...item, adjustedQuantity: item.adjustedQuantity + 1 }
          : item
      )
    );
  };
  const deleteAdjustedItem = (itemId) => {
    setAdjustedItems(prevItems =>
      prevItems.map(item =>
        item.productId?._id === itemId
          ? { ...item, adjustedQuantity: 0 }
          : item
      )
    );
  };

  const confirmSatelment = async () => {
    try {
      setLoading(true);
      
      // Ensure all items have at least quantity 1
      const validAdjustedItems = adjustedItems.filter(item => item.adjustedQuantity > 0);
      
      if (validAdjustedItems.length === 0) {
        toast.error("Cannot create settlement with zero items");
        setLoading(false);
        return;
      }
      
      // Format the items with proper structure
      const updatedItems = validAdjustedItems.map(item => {
        // Log the item structure for debugging
        console.log("Processing item:", item);
        console.log("Item productId type:", typeof item.productId);
        
        // Ensure we have a valid productId
        let productId;
        if (typeof item.productId === 'object' && item.productId?._id) {
          productId = item.productId._id;
          console.log("Extracted productId from object:", productId);
        } else {
          productId = item.productId;
          console.log("Using productId directly:", productId);
        }
          
        // Get the original item to access its type
        const originalItem = selectedItem.items.find(i => 
          (typeof i.productId === 'object' && i.productId?._id === productId) || 
          i.productId === productId
        );
        
        return {
          productId: productId,
          quantity: item.adjustedQuantity,
          price: item.price,
          type: originalItem?.type || 'piece' // Use the original type or default to 'piece'
        };
      });

      // Calculate the new total based on adjusted quantities
      const total = updatedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      console.log("Calculated total:", total);
      
      // Log the data for debugging
      console.log("Sending items for Satelment:", updatedItems);

      // Create the payload with only the necessary data
      const payload = {
        status: "Satelment",
        items: updatedItems,
        total: total
      };

      // Make the API call with proper error handling
      try {
        await updateOrderStatus({
          ...payload,
          id: selectedItem._id
        });
      } catch (apiError) {
        console.error("API Error:", apiError.response?.data || apiError.message);
        toast.error(apiError.response?.data?.message || "Failed to update order status");
        setLoading(false);
        return;
      }
      
      // Refresh the orders list
      const res = await getOrders(1, LIMIT);
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      
      const updatedSelectedItem = {
        ...selectedItem,
        statuses: [...selectedItem.statuses, { status: "Satelment", date: new Date() }],
        items: updatedItems.map(item => {
          // Find the original item to preserve any other properties
          const originalItem = selectedItem.items.find(i => 
            (typeof i.productId === 'object' && i.productId?._id === item.productId) || 
            i.productId === item.productId
          );
          
          return {
            ...originalItem,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            type: item.type || originalItem?.type || 'piece'
          };
        }),
        total: total,
        status: "Satelment"
      };
      
      setSelectedItem(updatedSelectedItem);
      setIsSatelmentPopupVisible(false);
      toast.success("Satelment Updated");
      setLoading(false);
    } catch (error) {
      setLoading(false);
      toast.error(error.message);
    }
  };

  const cancelSatelment = () => {
    setIsSatelmentPopupVisible(false);
    setAdjustedItems([]);
  };

  const invoiceHandler = async () => {
    try {
      const res = await getAllSalesPersons();
      setSalesPersons(res.data.data);
      openInvoiceModal();
    } catch (error) {
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };

  const generateInvoiceHandler = async () => {
    if (!invoiceData.date.length || !invoiceData.salePerson.length) return toast.error("User and date is required");
    try {
      setLoading(true);
      
      // Always convert to MM/DD/YYYY
      const formattedDate = toMMDDYYYY(invoiceData.date);
      
      // Get orders by sales person and date
      const res = await getOrdersBySalesPersonAndDate({ ...invoiceData, date: formattedDate }, token);
      const orders = res.data.data;
      
      if (!orders || orders.length === 0) {
        toast.error("No orders found for the selected sales person and date");
        setLoading(false);
        return;
      }

      // Get the selected sales person details
      const selectedSalesPerson = salesPersons.find(sp => sp._id === invoiceData.salePerson);
      
      // Prepare data for template
      const templateData = {
        salePerson: selectedSalesPerson,
        date: invoiceData.date,
        orders: orders
      };

      // Set the invoice template data and show the template
      setInvoiceTemplateData(templateData);
      setShowInvoiceTemplate(true);
      setLoading(false);
      closeInvoiceModal();
    } catch (error) {
      setLoading(false);
      toast.error(error.response?.data?.errors[0]?.msg || error.message);
    }
  };

  // Function to handle back to orders
  const handleBackToOrders = () => {
    setShowInvoiceTemplate(false);
    setInvoiceTemplateData(null);
  };

  const loadFormHandler = async () => {
    if (!loadFormData.date.length || !loadFormData.salePerson.length) {
      return toast.error("User and date are required");
    }
    
    try {
      setLoading(true);
      
      // Format date to YYYY-MM-DD to ensure consistency
      const formattedDate = new Date(loadFormData.date).toISOString().split('T')[0];
      
      const res = await generateLoadForm({
        ...loadFormData,
        date: formattedDate
      }, token);
      
      // Get the PDF URL from the response
      const { pdfUrl } = res.data.data;
      
      if (!pdfUrl) {
        throw new Error("Failed to generate PDF");
      }
      
      // Open the PDF in a new tab for download
      window.open(pdfUrl, '_blank');
      
      // Close the modal and reset form
      closeLoadFormModal();
      setLoadFormData({
        salePerson: "",
        date: ""
      });
      
      toast.success("Load form generated successfully");
      
    } catch (error) {
      console.error("Error generating load form:", error);
      toast.error(error.response?.data?.errors?.[0]?.msg || error.message || "Failed to generate load form");
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setCurrentPage(1);
    setSearchTerm("");
    setLoading(true);
    getOrders(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      });
  };

  const orderStatuses = useMemo(() => {
    return ORDER_STATUSES.filter(status => 
      status === "Satelment" || selectedItem?.statuses.findIndex((it) => it.status === status) < 0
    );
  }, [selectedItem]);

  const statusChangeable = useMemo(() => {
    return selectedItem?.statuses.findIndex(it => (
      it.status === ORDER_STATUSES[3] ||
      it.status === ORDER_STATUSES[4]
    )) > 0;
  }, [selectedItem]);

  const calculatedTotal = useMemo(() => {
    return adjustedItems.reduce((sum, item) => sum + (item.adjustedQuantity * item.price), 0);
  }, [adjustedItems]);

  if (loading) return <Loader />;

  // Render invoice template if showInvoiceTemplate is true
  if (showInvoiceTemplate && invoiceTemplateData) {
    // Store the invoice data in localStorage for the InvoiceTemplate component
    localStorage.setItem('invoiceTemplateData', JSON.stringify(invoiceTemplateData));
    
    // Add a back button handler
    const handleBack = () => {
      setShowInvoiceTemplate(false);
      localStorage.removeItem('invoiceTemplateData');
    };
    
    // Use the InvoiceTemplate component
    return (
      <div className="relative">
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-1 rounded-lg flex items-center gap-2"
        >
          <GrFormPrevious size={20} />
          
        </button>
        <InvoiceTemplate />
      </div>
    );
  }
if (loading) return <Loader />;
  // Render normal orders list
  return (
    <div className='relative'>
      <div className='flex items-center justify-between mt-3 ml-8'>
        <div className='inline-block'>
          <h1 className='text-xl mr-2 font-bold'>Orders</h1>
        </div>
        <div className='flex flex-wrap gap-2 items-center'>
          <div className='flex bg-[#FFFFFF] rounded-xl px-1'>
            <img src="/Search.svg" alt="search" className='' />
            <input
              className='p-2 outline-none rounded-xl 2xl:w-[220px]'
              type="search"
              value={searchTerm}
              name="search"
              onChange={e => {
                if (e.target.value.length) {
                  setSearchTerm(e.target.value);
                } else {
                  refreshData();
                }
              }}
              onKeyPress={searchHandler}
              placeholder='Search by id.'
            />
          </div>
          <DateRangePicker submitHandler={dateRangeHandler} sd={startDate} ed={endDate} />
          {
            !role.includes(ROLES[2]) && (
              <>
                <button onClick={invoiceHandler}
                  className="px-4 py-2 rounded-lg bg-[#FFD7CE] text-[#FF5934] transition-colors duration-200"
                >
                  Generate Invoice
                </button>
                <button onClick={openLoadFormModal}
                  className="px-4 py-2 rounded-lg bg-[#FFD7CE] text-[#FF5934] transition-colors duration-200"
                >
                  Generate Load Form
                </button>
              </>
            )
          }
        </div>
      </div>

      {isLoadFormVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-96 relative">
            <h2 className="text-xl px-6 py-4 border-b border-gray-300 font-bold mb-4">Load Form</h2>
            <div className="mb-4 px-6">
              <select
                onChange={(e) => setLoadFormData(p => ({ ...p, salePerson: e.target.value }))}
                id="salesperson"
                className="border border-gray-300 bg-[#0000001A] p-4 w-full rounded-lg"
              >
                <option value="">Select Sale person</option>
                {
                  salesPersons.map((it) => (
                    <option value={it._id} key={it._id}>{it.name}</option>
                  ))
                }
              </select>
            </div>
            <div className="mb-4 px-6">
              <input
                type="date"
                onChange={(e) => setLoadFormData(p => ({ ...p, date: e.target.value }))}
                id="date"
                className="border border-gray-300 p-4 w-full bg-[#0000001A] rounded-lg"
              />
            </div>
            <div className='px-6 py-4 border-t border-gray-300'>
              <button
                onClick={loadFormHandler}
                className="bg-[#FF5934] text-white py-4 px-4 rounded-lg w-full"
              >
                Generate Load Form
              </button>
            </div>
            <button
              className="absolute top-4 right-4 bg-[#0000001A] rounded-full p-1 h-7 w-7 flex justify-center items-center text-gray-600 hover:text-gray-800"
              onClick={closeLoadFormModal}
            >
              X
            </button>
          </div>
        </div>
      )}

      {isInvoiceVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-96 relative">
            <h2 className="text-xl px-6 py-4 border-b border-gray-300 font-bold mb-4">Invoice</h2>
            <div className="mb-4 px-6">
              <select
                onChange={(e) => setInvoiceData(p => ({ ...p, salePerson: e.target.value }))}
                id="salesperson"
                className="border border-gray-300 bg-[#0000001A] p-4 w-full rounded-lg"
              >
                <option value="">Select Sale person</option>
                {
                  salesPersons.map((it) => (
                    <option value={it._id} key={it._id}>{it.name}</option>
                  ))
                }
              </select>
            </div>
            <div className="mb-4 px-6">
              <input
                type="date"
                value={invoiceData.date}
                onChange={(e) => setInvoiceData(p => ({ ...p, date: e.target.value }))}
                id="date"
                className="border border-gray-300 p-4 w-full bg-[#0000001A] rounded-lg"
              />
            </div>
            <div className='px-6 py-4 border-t border-gray-300'>
              <button
                onClick={generateInvoiceHandler}
                className="bg-[#FF5934] text-white py-4 px-4 rounded-lg w-full"
              >
                Generate Invoice
              </button>
            </div>
            <button
              className="absolute top-4 right-4 bg-[#0000001A] rounded-full p-1 h-7 w-7 flex justify-center items-center text-gray-600 hover:text-gray-800"
              onClick={closeInvoiceModal}
            >
              X
            </button>
          </div>
        </div>
      )}

      {isSatelmentPopupVisible && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-96 relative">
            <h2 className="text-xl px-6 py-4 border-b border-gray-300 font-bold mb-4">Adjust Satelment Quantities</h2>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {adjustedItems.map((item) => (
                <div key={item.productId?._id} className="flex items-center justify-between p-4 bg-gray-100 rounded-lg mb-2">
                  <div className="flex items-center">
                    <img
                      src={item.productId?.image}
                      alt={item.productId?.englishTitle}
                      width={50}
                      height={50}
                      className="rounded mr-4"
                    />
                    <div>
                      <h6 className="font-semibold text-lg">{item.productId?.englishTitle}</h6>
                      <p className="text-red-600">{item.price} Rs</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => decreaseQuantity(item.productId?._id)}
                      className="bg-[#FF5934] text-white w-6 h-6 rounded-full flex items-center justify-center"
                      disabled={item.adjustedQuantity <= 1}
                    >
                      -
                    </button>
                    <p className="mx-2">Quantity {item.adjustedQuantity}</p>
                    <button
                      onClick={() => increaseQuantity(item.productId?._id)}
                      className="bg-[#FF5934] text-white w-6 h-6 rounded-full flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={() => deleteAdjustedItem(item.productId?._id)}
                      className="ml-2 bg-red-100 text-red-600 w-7 h-7 rounded-full flex items-center justify-center"
                      title="Remove item"
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-gray-300">
              <p className="text-gray-500 font-semibold">TOTAL</p>
              <p className="font-bold">{calculatedTotal} Rs</p>
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-gray-300">
              <button
                onClick={cancelSatelment}
                className="bg-gray-300 text-black py-2 px-4 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmSatelment}
                className="bg-[#FF5934] text-white py-2 px-4 rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className='Data my-4'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left text-gray-500'>
              <td>ID</td>
              <td>Retailer Name</td>
              <td>Sale Person Name</td>
              <td>Date & Time</td>
              <td>Total Amount</td>
              <td>Status</td>
              <td>Invoice</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((item) => (
              <tr
                key={item._id}
                className='border-b cursor-pointer'
              >
                <td className='p-4 bg-[#FFFFFF] rounded-l-xl uppercase'>#{item._id.substr(item._id.length - 10)}</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.RetailerUser?.name}</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.SaleUser?.name}</td>
                <td className='p-2 bg-[#FFFFFF]'>
                  {new Date(item.createdAt).toLocaleDateString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric'}).replace(/\//g, '/')} |{' '}
                  <span style={{ color: "gray" }}>
                    {new Date(item.createdAt).toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}
                  </span>
                </td>
                <td className='p-2 bg-[#FFFFFF]'>{item.total} Rs</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.status}</td>
                <td className='p-2 bg-[#FFFFFF]'>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        setDownloadingInvoice(item._id);
                        
                        // Debug: Log the complete order item structure
                        console.log('Order Item Structure:', JSON.stringify(item, null, 2));
                        
                        // Always use L101 as the location code for all products
                        // Prepare the data for Excel: one row per item in the order
                        const excelData = (item.items || []).map((orderItem, index) => {
                          // Always use L101 as the location code
                          const locationCode = 'L101';
                          // Use the order ID as Doc No for all items
                          const docNo = item._id.slice(0, 6);
                          
                          return {
                          'Account No.': item.RetailerUser?.userId || '',
                          'Product Code': orderItem.productId?.productId || '',
                          'Invoice Date': formatDate(item.createdAt),
                          'Description': orderItem.productId?.englishTitle || '',
                          'Doc No.': docNo, // Show order ID for all items
                          'Unit': orderItem.type === 'ctn' ? 'CTN' : orderItem.type === 'piece' ? 'PCS' : (orderItem.type || ''),
                          'Quantity': orderItem.quantity || '',
                          'Rate': orderItem.price?.toFixed(2) || '',
                          'Amount': (orderItem.quantity && orderItem.price) ? (orderItem.quantity * orderItem.price) : '',
                          'Discount %': '',
                          'Discount Amount': '',
                          'RM Amount': '',
                          'TO Amount': '',
                          'Tax Code': '',
                          'GST Amount': '',
                          'ADT Code': '',
                          'ADT Amount': '',
                          'FED Code': '',
                          'FED Amount': '',
                          'Project Code': '',
                          'Vehicle': '',
                          'Filter1': '',
                          'Filter2': '',
                          'Filter3': '',
                          'Filter4': '',
                          'Smart Doc 1': '',
                          'Smart Doc 2': '',
                          'Smart Doc 3': '',
                          'Smart Doc 4': '',
                          'Location Code': locationCode
                          };
                        });

                        // Create worksheet
                        const ws = XLSX.utils.json_to_sheet(excelData);
                        // Set column widths (optional, can be adjusted)
                        ws['!cols'] = Array(30).fill({ wch: 15 });

                        // Create workbook
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Invoice');

                        // Generate filename
                        const fileName = `Invoice_${item._id}.xlsx`;

                        // Export the file
                        XLSX.writeFile(wb, fileName);
                        
                      } catch (error) {
                        console.error('Error generating invoice:', error);
                        toast.error('Failed to generate invoice');
                      } finally {
                        setDownloadingInvoice(null);
                      }
                    }}
                    className='text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-50 transition-colors'
                    title='Download Invoice'
                    disabled={downloadingInvoice === item._id}
                  >
                    {downloadingInvoice === item._id ? (
                      <div className='w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin'></div>
                    ) : (
                      <FaFileExcel size={18} />
                    )}
                  </button>
                </td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>
                  <div onClick={() => {
                    setShow(true);
                    setSelectedItem(item);
                    setShowDropdown("");
                  }} className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left" ref={showDropdown === item._id ? dropdownRef : null}>
                    <div>
                      <button
                        className='flex'
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDropdown("");
                          setShow(true);
                        }}
                      >
                        <FaRegEye />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            )) : (
              !loading && (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    No orders found!
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div
        className="pagination-container"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          maxWidth: "150px",
          margin: 0,
        }}
      >
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

      {show && <EscapeClose onClose={handleEscape} />}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full p-10 md:w-[35%] overflow-y-auto bg-white shadow-lg transition-transform ${show ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {show && selectedItem && (
          <div className='flex flex-col'>
            <div className='mb-4 bg-gray-100 rounded-lg'>
              <div className='flex p-4 items-center border-b border-gray-400'>
                <h5 className='text-xl font-bold'>Order Tracking</h5>
              </div>
              <div className="px-6 py-4">
                <div className='flex'>
                  <div className='left p-2 flex flex-col items-center'>
                    {selectedItem?.statuses.map((orderStatus, index) => (
                      <>
                        <div key={orderStatus.status} className='bg-white flex justify-center items-center w-10 h-10 rounded'>
                          <img src={tick} alt={orderStatus.status} />
                        </div>
                        {((selectedItem?.statuses.length - 1) === index || selectedItem?.statuses.length === 1) ? "" : <div className='h-7 border-l border-green-500'></div>}
                      </>
                    ))}
                  </div>
                  <div className='right w-full pt-1 flex-grow-0'>
                    {selectedItem?.statuses.map((orderStatus, index) => (
                      <>
                        <div className='w-full'>
                          <p className='font-medium'>Order {orderStatus.status}</p>
                          <p className='text-gray-400 text-sm'>{new Date(orderStatus.date).toLocaleString()}</p>
                        </div>
                        {((selectedItem?.statuses.length - 1) === index || selectedItem?.statuses.length === 1) ? "" : <div className='h-6'></div>}
                      </>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className='mb-4 bg-gray-100 rounded-lg'>
              <div className='px-4 pt-4 flex border-b border-gray-400 items-center'>
                <h5 className='text-xl font-bold mb-4'>Order Details</h5>
              </div>
              <div className='px-6 py-4'>
                <div className='mb-2'>
                  <h6 className='text-sm text-gray-400'>Order ID</h6>
                  <div className='font-bold'>#{selectedItem._id.substr(0, 5).toUpperCase()}</div>
                </div>
                <div className='mb-2'>
                  <h6 className='text-sm text-gray-400'>Number Of Items</h6>
                  <div className='font-bold'>{selectedItem.items.length}</div>
                </div>
                <div className='mb-2'>
                  <h6 className='text-sm text-gray-400'>Phone Number</h6>
                  <div className='font-bold'>{selectedItem.phoneNumber}</div>
                </div>
                <div className='mb-2'>
                  <h6 className='text-sm text-gray-400'>Delivery Address</h6>
                  <div className='font-bold'>{selectedItem.shippingAddress}</div>
                </div>
                <div className='mb-2'>
                  <h6 className='text-sm text-gray-400'>Expected Delivery</h6>
                  <div className='font-bold'>{new Date(selectedItem.expectedDelivery).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <div className='bg-gray-100 rounded-t-lg'>
              <div className='p-4 border-b border-gray-400 flex items-center'>
                <h5 className='text-xl font-bold'>Items</h5>
              </div>
              <ul className='list-none flex flex-col gap-2 p-0 px-6 py-4'>
                {selectedItem.items.map((item) => {
                  // Get location code from the same source as in InvoiceTemplate.jsx
                  const locationCode = item.productId?.cityID?.locationId || '';
                  
                  return (
                    <li
                      key={item.productId?._id}
                      className='flex items-center justify-between p-5 bg-white rounded-lg'
                    >
                    <div className='flex items-center'>
                      <img
                        src={item.productId?.image}
                        alt={item.productId?.englishTitle}
                        width={70}
                        height={70}
                        className='rounded mr-4'
                      />
                      <div>
                        <h6 className='font-semibold'>{item.productId?.englishTitle}</h6>
                        {(() => {
                          const hasDiscount = Number(item.discountedPrice) > 0 && Number(item.discountedPrice) < Number(item.price);
                          const unitLabel = item.type === 'ctn' ? 'per CTN' : item.type === 'piece' ? 'per PCS' : '';
                          if (hasDiscount) {
                            return (
                              <p className='text-sm'>
                                <span className='text-gray-500 line-through'>{`${Number(item.price).toFixed(2)} Rs`}</span>
                                <span className='text-green-600 ml-2 font-semibold'>{`${Number(item.discountedPrice).toFixed(2)} Rs`}</span>
                                {unitLabel && <span className='text-gray-500 ml-1'>{unitLabel}</span>}
                              </p>
                            );
                          }
                          return (
                            <p className='text-red-600'>
                              {`${Number(item.price).toFixed(2)} Rs ${unitLabel}`}
                            </p>
                          );
                        })()}
                        {locationCode && (
                          <p className='text-gray-500 text-sm mt-1'>Location: {locationCode}</p>
                        )}
                    </div>
                    </div>
                    <div className='text-right'>
                      <p className='text-gray-600'>Quantity</p>
                      <p className='font-medium'>{item.quantity} {item.type === 'ctn' ? 'CTN' : 'PCS'}</p>
                    </div>
                  </li>
                )})}
              </ul>
            </div>

            <div className='flex rounded-b-lg justify-between px-6 border-t border-gray-400 py-4 bg-gray-100'>
              <h6 className='text-lg'>Total</h6>
              <h6 className='text-lg font-bold'>{selectedItem.total} Rs</h6>
            </div>

            <div className='p'>
              <select 
                disabled={statusChangeable} 
                onChange={statusHandler} 
                className='bg-gray-100 w-full p-2 py-3 mt-3 rounded-lg' 
                value={selectedItem?.status}
              >
                {ORDER_STATUSES.map(item => (
                  <option key={item} value={item} className='text-black'>{item}</option>
                ))}
              </select>
            </div>

            <div className='py-4'>
              <button
                className='bg-[#FF5934] text-[#ffff] w-full p-2 rounded-lg'
                onClick={() => setShow(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Order;
