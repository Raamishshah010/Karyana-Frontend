import React, { useEffect, useState } from 'react';
import { getDatas, getAllRetailers, getOrders } from '../../APIS';
import { Loader } from '../common/loader';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';

const SalesReport = () => {
  const [salesPersons, setSalesPersons] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedSalesPersons, setSelectedSalesPersons] = useState([]);
  const [selectedSalesPersonOptions, setSelectedSalesPersonOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch salespersons
        const salesResponse = await getDatas('/sale-user/search?page=1&limit=1000&searchTerm=&city=&status=');
        console.log('Salesperson Response:', salesResponse);
        if (salesResponse?.data?.data && Array.isArray(salesResponse.data.data)) {
          setSalesPersons(salesResponse.data.data);
        } else {
          throw new Error('Invalid salespersons response format');
        }

        // Fetch customers using getAllRetailers
        const customerResponse = await getAllRetailers();
        console.log('Customer Response:', customerResponse);
        let customerData = [];
        if (customerResponse?.data) {
          if (Array.isArray(customerResponse.data)) {
            customerData = customerResponse.data;
          } else if (customerResponse.data?.data && Array.isArray(customerResponse.data.data)) {
            customerData = customerResponse.data.data;
          } else if (customerResponse.data?.retailers && Array.isArray(customerResponse.data.retailers)) {
            customerData = customerResponse.data.retailers;
          } else {
            throw new Error('Invalid customers response format');
          }
        } else {
          throw new Error('No customer data found in response');
        }
        setCustomers(customerData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message || 'An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRunReport = async () => {
    if (selectedSalesPersons.length === 0 || !selectedCustomer) {
      setError('Please select at least one salesperson and a customer');
      return;
    }

    setDetailsLoading(true);
    try {
      const selectedSalesPersonsData = salesPersons.filter(sp => selectedSalesPersons.includes(sp._id));
      const selectedCustomerData = customers.find(c => c._id === selectedCustomer);

      if (selectedSalesPersonsData.length === 0 || !selectedCustomerData) {
        throw new Error('Selected salesperson(s) or customer not found');
      }

      console.log('Selected Salesperson IDs:', selectedSalesPersons);
      console.log('Selected Customer ID:', selectedCustomer);
      console.log('Selected Salesperson Data:', selectedSalesPersonsData);
      console.log('Selected Customer Data:', selectedCustomerData);

      // Fetch all orders with pagination
      let allOrders = [];
      let currentPage = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const ordersResponse = await getOrders(currentPage, limit);
          console.log(`Orders Response (Page ${currentPage}):`, ordersResponse);
          if (ordersResponse?.data?.data && Array.isArray(ordersResponse.data.data)) {
            allOrders = [...allOrders, ...ordersResponse.data.data];
            hasMore = ordersResponse.data.data.length === limit;
            currentPage++;
          } else {
            hasMore = false;
          }
        } catch (err) {
          console.error(`Error fetching orders (Page ${currentPage}):`, err);
          hasMore = false;
        }
      }

      console.log('All Orders:', allOrders);

      // Filter orders based on selected salespersons and customer
      const filteredOrders = allOrders.filter(order => {
        const saleUserId = order.SaleUser?._id || String(order.SaleUser);
        const retailerUserId = order.RetailerUser?._id || String(order.RetailerUser);
        const saleUserMatch = selectedSalesPersons.includes(saleUserId);
        const retailerUserMatch = retailerUserId === selectedCustomer;
        console.log(
          `Order ${order._id}: SaleUser=${saleUserId}, RetailerUser=${retailerUserId}, ` +
          `SaleUserMatch=${saleUserMatch}, RetailerUserMatch=${retailerUserMatch}`
        );
        return saleUserMatch && retailerUserMatch;
      });

      console.log('Filtered Orders:', filteredOrders);

      if (filteredOrders.length === 0) {
        setError('No orders found for the selected salesperson and customer. Please verify the IDs.');
        setDetailsLoading(false);
        return;
      }

      // Get current date and previous month dates
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      console.log('Current Date:', currentDate);
      console.log('Current Month:', currentMonth);
      console.log('Current Year:', currentYear);
      
      // Get previous month's first and last day
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonthFirstDay = new Date(prevYear, prevMonth, 1);
      const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0);

      console.log('Previous Month First Day:', prevMonthFirstDay);
      console.log('Previous Month Last Day:', prevMonthLastDay);

      // Filter orders for previous month (completed and settlement only)
      const prevMonthOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const isCompleted = order.status?.toLowerCase() === 'completed' || order.status?.toLowerCase() === 'settlement';
        const isInPrevMonth = orderDate >= prevMonthFirstDay && orderDate <= prevMonthLastDay;
        
        console.log('Order:', {
          id: order._id,
          date: orderDate,
          status: order.status,
          isCompleted,
          isInPrevMonth
        });
        
        return isInPrevMonth && isCompleted;
      });

      console.log('Previous Month Orders:', prevMonthOrders);

      // Get count of previous month orders
      const prevMonthOrderCount = prevMonthOrders.length;
      console.log('Previous Month Order Count:', prevMonthOrderCount);

      // Filter current month orders (completed and settlement only)
      const currentMonthOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const isCompleted = order.status?.toLowerCase() === 'completed' || order.status?.toLowerCase() === 'settlement';
        const isCurrentMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        
        return isCurrentMonth && isCompleted;
      });

      console.log('Current Month Orders:', currentMonthOrders);

      // Get count of current month orders
      const currentMonthOrderCount = currentMonthOrders.length;
      console.log('Current Month Order Count:', currentMonthOrderCount);

      // Use all filtered orders for the report to ensure we show data
      const ordersToShow = currentMonthOrders.length > 0 ? currentMonthOrders : filteredOrders;
      
      // Transform orders into sales report format
      const salesData = ordersToShow.map((order, index) => {
        // Find the correct salesperson for this order
        const orderSaleUserId = order.SaleUser?._id || String(order.SaleUser);
        const orderSalesPerson = selectedSalesPersonsData.find(sp => sp._id === orderSaleUserId) || { name: 'Unknown Salesperson' };
        
        return {
          sr: index + 1,
          customer: selectedCustomerData.name || 'Unknown Customer',
          salesperson: orderSalesPerson.name,
          previousSale: prevMonthOrderCount,
          type: order.paymentType || 'COD',
          target: 0, // Placeholder
          achieved: currentMonthOrderCount,
          qty: order.items?.length || 0,
          amount: order.total || 0,
          gst: order.gst || 0,
          netAmount: order.total || 0,
          discount: order.discount || 0,
          date: order.createdAt
        };
      });

      // Save the selected data and fetched sales data to localStorage
      const reportData = {
        salesPersons: selectedSalesPersonsData,
        customer: selectedCustomerData,
        salesData
      };

      localStorage.setItem('salesReportTemplateData', JSON.stringify(reportData));

      // Navigate to the template with sales data
      navigate('/sales-report-template', { state: { salesData, selectedUsers: selectedSalesPersonsData } });
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err.message || 'An error occurred while generating the report');
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 mx-auto max-w-[1400px]">
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <h1 className="text-1xl font-bold">Customer Target vs Achievement Sale Summary</h1>
          <br />
          {/* Filter Section */}
          <div className="mb-6 flex flex-wrap gap-4">
            {/* Multiple Selection for Sales Persons */}
            <div className="flex-grow md:flex-grow-0">
              {loading ? (
                <div className="flex justify-center items-center p-4">
                  <div className="animate-spin h-5 w-5 border-2 border-[#FF5934] border-t-transparent rounded-full"></div>
                </div>
              ) : (
                <Select
                  id="salesPersons"
                  options={salesPersons.map(sp => ({ value: sp._id, label: `${sp.name}` }))}
                  isMulti
                  value={selectedSalesPersonOptions}
                  onChange={(selectedOptions) => {
                    const newSalesPersonIds = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                    setSelectedSalesPersons(newSalesPersonIds);
                    setSelectedSalesPersonOptions(selectedOptions || []);
                  }}
                  placeholder="Select Sales Persons"
                  className="react-select-container w-full"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.375rem',
                      border: '1px solid #D1D5DB',
                      minHeight: '42px',
                      padding: '0px',
                      '&:hover': {
                        border: '1px solid #D1D5DB',
                      },
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999,
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: '#E5E5E5',
                      borderRadius: '9999px',
                      padding: '2px 8px',
                      display: 'flex',
                      alignItems: 'center',
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      padding: '0 4px',
                      color: '#333',
                    }),
                    multiValueRemove: (base) => ({
                      ...base,
                      cursor: 'pointer',
                      padding: '0 4px',
                      '&:hover': {
                        backgroundColor: 'transparent',
                        color: '#666',
                      },
                    }),
                  }}
                />
              )}
            </div>

            {/* Single Selection for Customer */}
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="p-2 border rounded-md flex-grow md:flex-grow-0 h-[42px]"
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleRunReport}
              className="p-2 bg-[#FF5934] text-white rounded-md hover:bg-[#e04a28] transition-colors flex-grow md:flex-grow-0 h-[42px]"
              disabled={detailsLoading}
            >
              {detailsLoading ? 'Loading...' : 'Run report'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {detailsLoading && <Loader />}
        </div>
      </div>
    </div>
  );
};

export default SalesReport;