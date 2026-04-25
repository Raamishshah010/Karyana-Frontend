import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrFormPrevious } from 'react-icons/gr';
import * as XLSX from 'xlsx';

const InvoiceTemplate = () => {
  const navigate = useNavigate();
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem('invoiceTemplateData');
    if (data) {
      setSelectedDetail(JSON.parse(data));
      localStorage.removeItem('invoiceTemplateData');
    }
  }, []);

  const formatNumber = (num) => {
    return typeof num === 'number' ? num.toFixed(2) : '0.00';
  };

  const formatDate = (dateString) => {
    // Format date as DD/MM/YYYY for invoices
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString();
  };

  const exportToExcel = () => {
    if (!selectedDetail || !selectedDetail.orders) return;

    // Prepare the data for Excel: one row per item in each order
    const excelData = [];
    selectedDetail.orders.forEach((order) => {
      (order.items || []).forEach((item, index) => {
        // Include the order ID in the 'Doc No.' field for all items
        const docNo = order._id.slice(0, 6);
        
        excelData.push({
          'Account No.': order.RetailerUser?.userId || '',
          'Product Code': item.productId?.productId || '',
          'Invoice Date': formatDate(order.createdAt),
          'Description': item.productId?.englishTitle || '',
          'Doc No.': docNo,
          'Unit': item.type === 'ctn' ? 'CTN' : item.type === 'piece' ? 'PCS' : (item.type || ''),
          // Map Quantity column to product stock as per manager's instruction
          //'Quantity': item.productId?.stock ?? '', // <-- Mapped to stock, not order quantity
          'Quantity': item.quantity || '',
          'Rate': item.price?.toFixed(2) || '',
          'Amount': (item.quantity && item.price) 
            ? (item.quantity * item.price).toFixed(2)
            : '0.00',
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
          'Location Code': item.productId?.cityID?.locationId || ''
        });
      });
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    // Set column widths (optional, can be adjusted)
    ws['!cols'] = Array(30).fill({ wch: 15 });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice Report');

    // Generate filename
    const fileName = `${selectedDetail.salePerson.name}_${selectedDetail.date}_Invoice_Report.xlsx`;

    // Export the file
    XLSX.writeFile(wb, fileName);
  };

  if (!selectedDetail) {
    return <div className="p-6 text-red-500 text-center">No data available. Please generate invoice from the Orders page.</div>;
  }

  const { salePerson, date, orders } = selectedDetail;
  const totalAmount = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              className="text-[#FF5934] mr-4 p-1 rounded-lg transition-colors"
              onClick={() => window.close()}
            >
              {/* <GrFormPrevious size={24} /> */}
            </button>
            <div>
              <h2 className="text-xl font-bold">
                Invoice Report - {salePerson.name}
              </h2>
              <p className="text-gray-600">
                Date: <span className="font-bold text-[#FF5934]">{date}</span>
              </p>
              <p className="text-gray-600">
                Total Amount: <span className="font-bold text-[#FF5934]">PKR {formatNumber(totalAmount)}</span>
              </p>
              <p className="text-gray-600">
                Total Orders: <span className="font-bold text-[#FF5934]">{orders.length}</span>
              </p>
            </div>
          </div>
          <button
            className="bg-[#FF5934] text-white px-4 py-2 rounded-lg hover:bg-[#e04e2d] transition-colors"
            onClick={exportToExcel}
          >
            Export to Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="p-3 text-left font-semibold text-gray-700 w-[5%] border-r border-gray-300">Sr.</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[12%] border-r border-gray-300">Order ID</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[15%] border-r border-gray-300">Retailer Name</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[12%] border-r border-gray-300">Sale Person</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[10%] border-r border-gray-300">Date</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[8%] border-r border-gray-300">Time</th>
                <th className="p-3 text-right font-semibold text-gray-700 w-[12%] border-r border-gray-300">Total Amount</th>
                <th className="p-3 text-center font-semibold text-gray-700 w-[10%] border-r border-gray-300">Status</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[12%] border-r border-gray-300">Phone</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[4%]">Items</th>
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((order, index) => (
                  <tr
                    key={order._id}
                    className={`border-b border-gray-300 ${
                      index % 2 === 1 ? 'bg-gray-100' : 'bg-white'
                    } hover:bg-gray-200 transition-colors`}
                  >
                    <td className="p-4 border-r border-gray-300">{index + 1}</td>
                    <td className="p-4 border-r border-gray-300">#{order._id.substr(order._id.length - 10)}</td>
                    <td className="p-4 truncate border-r border-gray-300">{order.RetailerUser?.name || 'N/A'}</td>
                    <td className="p-4 truncate border-r border-gray-300">{order.SaleUser?.name || 'N/A'}</td>
                    <td className="p-4 border-r border-gray-300">{formatDate(order.createdAt)}</td>
                    <td className="p-4 border-r border-gray-300">{formatTime(order.createdAt)}</td>
                    <td className="p-4 text-right border-r border-gray-300">PKR {formatNumber(order.total)}</td>
                    <td className="p-4 text-center border-r border-gray-300">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'Processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'Shipped' ? 'bg-purple-100 text-purple-800' :
                        order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                        order.status === 'Satelment' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 border-r border-gray-300">{order.phoneNumber || 'N/A'}</td>
                    <td className="p-4">{order.items?.length || 0}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="p-4 text-center">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
            {orders.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t border-gray-300">
                  <td colSpan="6" className="p-3 text-right border-r border-gray-300">Total</td>
                  <td className="p-3 text-right border-r border-gray-300">PKR {formatNumber(totalAmount)}</td>
                  <td className="p-3 text-center border-r border-gray-300">{orders.length}</td>
                  <td colSpan="2" className="p-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplate;