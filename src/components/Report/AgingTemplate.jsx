import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrFormPrevious } from 'react-icons/gr';
import * as XLSX from 'xlsx';

const AgingTemplate = () => {
  const navigate = useNavigate();
  const [selectedDetail, setSelectedDetail] = useState(null);

  useEffect(() => {
    const data = localStorage.getItem('agingTemplateData');
    if (data) {
      setSelectedDetail(JSON.parse(data));
      localStorage.removeItem('agingTemplateData');
    }
  }, []);

  const formatNumber = (num) => {
    return typeof num === 'number' ? num.toFixed(2) : '0.00';
  };

  const getRangeLabel = (range) => {
    switch (range) {
      case 'all': return 'All Invoices';
      default: return range;
    }
  };

  const exportToExcel = () => {
    if (!selectedDetail || !selectedDetail.details) return;

    // Prepare the data for Excel
    const excelData = selectedDetail.details.map((detail) => ({
      'Sr.': detail.sr,
      'Date': detail.date,
      'Shop Name': detail.shopName,
      'Invoice ID': `INV-${detail.invoiceId.slice(0, 6)}`,
      'Total (PKR)': formatNumber(detail.total),
      'Balance (PKR)': formatNumber(detail.balance),
      'Aging Days': detail.agingDays,
    }));

    // Add totals row
    excelData.push({
      'Sr.': '',
      'Date': '',
      'Shop Name': '',
      'Invoice ID': 'Total',
      'Total (PKR)': formatNumber(selectedDetail.amount),
      'Balance (PKR)': formatNumber(selectedDetail.balance),
      'Aging Days': '-',
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    const colWidths = [
      { wch: 5 },  // Sr.
      { wch: 15 }, // Date
      { wch: 25 }, // Shop Name
      { wch: 15 }, // Invoice ID
      { wch: 15 }, // Total
      { wch: 15 }, // Balance
      { wch: 15 }, // Aging Days
    ];
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aging Report');

    // Generate filename
    const fileName = `${selectedDetail.retailer.name}_${getRangeLabel(selectedDetail.range)}_Aging_Report.xlsx`;

    // Export the file
    XLSX.writeFile(wb, fileName);
  };

  if (!selectedDetail) {
    return <div className="p-6 text-red-500 text-center">No data available. Please run the report from the Aging Report page.</div>;
  }

  const { retailer, range, amount, balance, details } = selectedDetail;

  return (
    <div className="min-h-screen bg-white">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button
              className="text-[#FF5934] mr-4 bg-gray-200 p-1 rounded-lg hover:bg-gray-300 transition-colors"
              onClick={() => window.close()}
            >
              <GrFormPrevious size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold">
                {retailer.name} - {getRangeLabel(range)}
              </h2>
              <p className="text-gray-600">
                Amount: <span className="font-bold text-[#FF5934]">
                  PKR {formatNumber(amount)}
                </span>
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
                <th className="p-3 text-left font-semibold text-gray-700 w-[15%] border-r border-gray-300">Date</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[20%] border-r border-gray-300">Shop Name</th>
                <th className="p-3 text-left font-semibold text-gray-700 w-[15%] border-r border-gray-300">Invoice ID</th>
                <th className="p-3 text-right font-semibold text-gray-700 w-[15%] border-r border-gray-300">Total</th>
                <th className="p-3 text-right font-semibold text-gray-700 w-[10%] border-r border-gray-300">Balance</th>
                <th className="p-3 text-right font-semibold text-gray-700 w-[15%]">Aging Days</th>
              </tr>
            </thead>
            <tbody>
              {details.length > 0 ? (
                details.map((detail, index) => (
                  <tr
                    key={detail.invoiceId}
                    className={`border-b border-gray-300 ${
                      index % 2 === 1 ? 'bg-gray-100' : 'bg-white'
                    } hover:bg-gray-200 transition-colors`}
                  >
                    <td className="p-4 border-r border-gray-300">{detail.sr}</td>
                    <td className="p-4 border-r border-gray-300">{detail.date}</td>
                    <td className="p-4 truncate border-r border-gray-300">{detail.shopName}</td>
                    <td className="p-4 border-r border-gray-300">INV-{detail.invoiceId.slice(0, 6)}</td>
                    <td className="p-4 text-right border-r border-gray-300">PKR {formatNumber(detail.total)}</td>
                    <td className="p-4 text-right border-r border-gray-300">PKR {formatNumber(detail.balance)}</td>
                    <td className="p-4 text-right">{detail.agingDays}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-4 text-center">
                    No data found
                  </td>
                </tr>
              )}
            </tbody>
            {details.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-bold border-t border-gray-300">
                  <td colSpan="4" className="p-3 text-right border-r border-gray-300"></td>
                  <td className="p-3 text-right border-r border-gray-300">PKR {formatNumber(amount)}</td>
                  <td className="p-3 text-right border-r border-gray-300">PKR {formatNumber(balance)}</td>
                  <td className="p-3 text-right">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AgingTemplate;