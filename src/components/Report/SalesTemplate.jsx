import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GrFormPrevious } from 'react-icons/gr';
import logok from '../../../src/assets/logokaryana.png';

const SalesTemplate = () => {
  const reportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState([]);

  // Extract data from location.state or localStorage
  const { salesData: passedData, selectedUsers } = location.state || {};
  const storedData = JSON.parse(localStorage.getItem('salesReportTemplateData')) || {};

  useEffect(() => {
    if (passedData && passedData.length > 0) {
      setSalesData(passedData);
    } else if (storedData.salesData && storedData.salesData.length > 0) {
      setSalesData(storedData.salesData);
    } else {
      setSalesData([]);
    }
  }, [passedData]);

  // Function to format date as MMM/DD/YYYY (e.g., Feb/02/2023)
  const formatDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // Calculate the date range: first transaction date to last transaction date or today
  const getDateRange = () => {
    if (!salesData || salesData.length === 0) {
      return {
        startDate: storedData.startDate || new Date(),
        endDate: storedData.endDate || new Date(),
      };
    }

    const sortedData = [...salesData].sort((a, b) => 
      new Date(a.date || '2023-04-01') - new Date(b.date || '2023-04-01')
    );
    const firstDate = new Date(sortedData[0].date || storedData.startDate || '2023-04-01');
    const lastDate = new Date(sortedData[sortedData.length - 1].date || storedData.endDate || '2025-04-28');

    return {
      startDate: firstDate,
      endDate: lastDate,
    };
  };

  const { startDate, endDate } = getDateRange();

  // Calculate totals for the summary table
  const calculateTotals = () => {
    const totalQty = salesData.reduce((sum, item) => sum + (item.qty || 0), 0);
    const totalAmount = salesData.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGst = salesData.reduce((sum, item) => sum + (item.gst || 0), 0);
    const totalDiscount = salesData.reduce((sum, item) => sum + (item.discount || 0), 0);
    const totalNetAmount = salesData.reduce((sum, item) => sum + (item.netAmount || 0), 0);

    return {
      totalQty,
      totalAmount,
      totalGst,
      totalDiscount,
      totalNetAmount,
    };
  };

  const downloadPDF = async () => {
    const element = reportRef.current;

    // Temporarily hide the download button and elements with pdf-hidden class
    const downloadButton = element.querySelector('button.flex.items-center.gap-2.px-3.py-1.font-semibold.text-black.bg-white.rounded-md.hover\\:bg-\\[\\#FF5934\\]');
    const hiddenElements = element.querySelectorAll('.pdf-hidden');

    if (downloadButton) {
      downloadButton.style.display = 'none';
    }
    hiddenElements.forEach(el => {
      el.style.display = 'none';
    });

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const data = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position += pdfHeight;
        pdf.addPage();
        pdf.addImage(data, 'PNG', 0, -heightLeft, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`KAR-Sales-Report-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } finally {
      if (downloadButton) {
        downloadButton.style.display = 'flex';
      }
      hiddenElements.forEach(el => {
        el.style.display = 'block';
      });
    }
  };

  if (!salesData || salesData.length === 0) {
    return <div>No data available for report</div>;
  }

  const { totalQty, totalAmount, totalGst, totalDiscount, totalNetAmount } = calculateTotals();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div ref={reportRef} className="min-h-screen flex flex-col m-0 p-0">
      <div className="text-white">
        {/* Back Icon - Only visible on web, not in PDF */}
        <div className="pdf-hidden">
          <button
            onClick={handleBack}
            className="text-white text-2xl hover:text-gray-300 bg-[#FF5934] mr-4 p-1 rounded-lg"
            aria-label="Go back"
          >
            <GrFormPrevious />
          </button>
        </div>

        {/* Header with Content */}
        <div className="flex justify-between items-center px-4 py-6 bg-[#FF5934] mt-0">
          <div>
            <p className="text-xl font-semibold">
              Karyana Sales Report
            </p>
            <p>
              Customer Target vs Achievement Sale Summary
            </p>
          </div>
          <div className="flex items-center gap-2">
            <img src={logok} alt="logo" className="w-30 h-16" />
            <div className="flex mt-2">
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-3 py-1 font-semibold text-black bg-white rounded-md hover:bg-[#FF5934]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 pt-16 pb-6">
          <p className="text-xl font-semibold text-black">
            Karyana - Customer Target vs Achievement Sale Summary
          </p>
          <p className="text-lg text-black">
            Customer: {storedData.customer?.name || 'Selected Customer'}
          </p>
          <p className="text-black">
            <span className="font-medium">Sales Persons: </span>
            {(selectedUsers || storedData.salesPersons || []).map((sp, index, array) => (
              <span key={index}>
                {sp.name}{index < array.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
          <p className="text-black mt-2">
            {formatDate(startDate)} - {formatDate(endDate)}
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="w-full px-4 py-6 flex-grow">
        <table className="w-full border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="p-4 border-r border-black">Total QTY</td>
              <td className="p-4 border-r border-black">Total Amount</td>
              <td className="p-4 border-r border-black">Total GST</td>
              <td className="p-4 border-r border-black">Total Discount</td>
              <td className="p-4">Total Net Amount</td>
            </tr>
            <tr className="text-right">
              <td className="p-4 border-r border-black">{totalQty.toLocaleString()}</td>
              <td className="p-4 border-r border-black">Rs. {totalAmount.toLocaleString()}</td>
              <td className="p-4 border-r border-black">Rs. {totalGst.toLocaleString()}</td>
              <td className="p-4 border-r border-black">Rs. {totalDiscount.toLocaleString()}</td>
              <td className="p-4">Rs. {totalNetAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="w-full px-4 py-6 flex-grow">
        <div className="py-6 font-medium text-black">
          <p>No. of Entries: {salesData.length} (All)</p>
        </div>
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3 text-left border border-gray-300">S#</th>
                <th className="p-3 text-left border border-gray-300">Customer</th>
                <th className="p-3 text-left border border-gray-300">Salesperson</th>
                <th className="p-3 text-right border border-gray-300">Prev Sale</th>
                {/* <th className="p-3 text-left border border-gray-300">Type</th> */}
                <th className="p-3 text-right border border-gray-300">Target</th>
                <th className="p-3 text-right border border-gray-300">Achieved</th>
                <th className="p-3 text-right border border-gray-300">QTY</th>
                <th className="p-3 text-right border border-gray-300">Amount</th>
                <th className="p-3 text-right border border-gray-300">GST</th>
                <th className="p-3 text-right border border-gray-300">Discount</th>
                <th className="p-3 text-right border border-gray-300">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {salesData.map((detail, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="p-3 border border-gray-300">{detail.sr}</td>
                  <td className="p-3 border border-gray-300">{detail.customer}</td>
                  <td className="p-3 border border-gray-300">{detail.salesperson}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.previousSale}</td>
                  {/* <td className="p-3 border border-gray-300">{detail.type}</td> */}
                  <td className="p-3 text-right border border-gray-300">{detail.target}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.achieved}</td>
                  <td className="p-3 text-right border border-gray-300">{detail.qty}</td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.amount.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.gst.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.discount.toLocaleString()}
                  </td>
                  <td className="p-3 text-right border border-gray-300">
                    Rs. {detail.netAmount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-full px-4 py-6">
        <table className="w-full">
          <tr className="bg-gray-300">
            <td className="w-[55%] p-3">Grand Total</td>
            <td className="p-3 text-right text-black">{totalQty.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalAmount.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalGst.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalDiscount.toLocaleString()}</td>
            <td className="p-3 text-right text-black">Rs. {totalNetAmount.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <div className="flex flex-col items-center px-4 py-6 bg-[#FF5934] w-full">
        <img src={logok} alt="logo" className="w-30 h-16" />
        <p className="text-white text-sm pt-3">www.primelinkdistribution.com</p>
        <div className="flex justify-between w-full text-white text-sm">
          <p>Email: office@primelinkdistribution.com</p>
          <p>Phone: +92 341 9527440</p>
        </div>
      </div>
    </div>
  );
};

export default SalesTemplate;