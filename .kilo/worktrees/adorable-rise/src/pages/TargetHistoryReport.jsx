import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GrFormPrevious } from 'react-icons/gr';
import logok from '../assets/logokaryana.png';
import { getTargetHistoryBySalespersonId, getSalesPersonBySalesId } from '../APIS';

const TargetHistoryReport = () => {
  const reportRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const salesId = searchParams.get('salesId');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salesPerson, setSalesPerson] = useState(null);

  // Fetch target history data and salesperson
  useEffect(() => {
    const fetchData = async () => {
      if (!salesId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const historyResponse = await getTargetHistoryBySalespersonId(salesId);
        const payload = Array.isArray(historyResponse.data)
          ? historyResponse.data
          : (historyResponse.data?.data || []);

        setHistoryData(payload);

        // Try to fetch salesperson details (for name/phone, etc.)
        try {
          const spResponse = await getSalesPersonBySalesId(salesId);
          if (spResponse.data && spResponse.data.msg === 'success') {
            setSalesPerson(spResponse.data.data);
          } else if (payload.length) {
            const first = payload[0];
            setSalesPerson({
              name: first.name || `Sales ID: ${salesId}`,
              email: first.email || 'N/A',
              phone: first.phone || 'N/A',
              image: first.profilePicture || ''
            });
          }
        } catch (err) {
          if (payload.length) {
            const first = payload[0];
            setSalesPerson({
              name: first.name || `Sales ID: ${salesId}`,
              email: first.email || 'N/A',
              phone: first.phone || 'N/A',
              image: first.profilePicture || ''
            });
          }
        }
      } catch (error) {
        console.error('Error fetching target history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [salesId]);

  // Calculate summary statistics for targets
  const calculateStats = () => {
    const totalEntries = historyData.length;
    const totalAssigned = historyData.reduce((sum, item) => sum + (item.target || 0), 0);
    const totalAchieved = historyData.reduce((sum, item) => sum + (item.achieved || 0), 0);
    const overallPercentage = totalAssigned > 0 ? Math.round((totalAchieved / totalAssigned) * 100) : 0;

    return {
      totalEntries,
      totalAssigned,
      totalAchieved,
      overallPercentage,
    };
  };

  const stats = calculateStats();

  // Download PDF using the same approach as AttendanceReport
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
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
        height: element.scrollHeight,
        width: element.scrollWidth,
        onclone: (clonedDoc) => {
          Array.from(clonedDoc.images).forEach(img => {
            img.style.maxWidth = '100%';
          });
        }
      });

      const data = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`KAR-TargetHistory-${salesPerson?.name || 'report'}-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } finally {
      if (downloadButton) {
        downloadButton.style.display = 'flex';
      }
      hiddenElements.forEach(el => {
        el.style.display = 'block';
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!historyData.length) {
    return <div className="flex justify-center items-center h-screen">No target history available</div>;
  }

  return (
    <div ref={reportRef} className="min-h-screen flex flex-col m-0 p-0">
      <div className="text-white">
        {/* Back Button */}
        <div className="pdf-hidden">
          <button
            onClick={() => navigate(-1)}
            className="text-white text-2xl hover:text-gray-300 bg-[#FF5934] mr-4 p-1 rounded-lg"
            aria-label="Go back"
          >
            <GrFormPrevious />
          </button>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-4 py-6 bg-[#FF5934] mt-0">
          <div>
            <p className="text-xl font-semibold">{salesPerson?.name || 'Sales Person'}</p>
            <p>{salesPerson?.phone || salesPerson?.email || 'N/A'}</p>
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

        {/* Title */}
        <div className="flex flex-col items-center gap-3 pt-16 pb-6">
          <p className="text-xl font-semibold text-black">
            {salesPerson?.name || 'Sales Person'} Target History Report
          </p>
          <p className="text-lg text-black">
            Email/Phone: {salesPerson?.email || salesPerson?.phone || 'N/A'}
          </p>
        </div>
      </div>

      {/* Summary Tables */}
      <div className="w-full px-4 py-6 flex-grow">
        {/* Target Summary */}
        <table className="w-full border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="p-4 border-r border-black">Total Entries</td>
              <td className="p-4 border-r border-black">Total Assigned</td>
              <td className="p-4 border-r border-black">Total Achieved</td>
              <td className="p-4">Overall Percentage</td>
            </tr>
            <tr className="text-right">
              <td className="p-4 border-r border-black">{stats.totalEntries}</td>
              <td className="p-4 border-r border-black">{stats.totalAssigned.toLocaleString()}</td>
              <td className="p-4 border-r border-black">{stats.totalAchieved.toLocaleString()}</td>
              <td className="p-4">{stats.overallPercentage}%</td>
            </tr>
          </tbody>
        </table>

        {/* Details Table */}
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3 text-left border border-gray-300">Month</th>
                <th className="p-3 text-left border border-gray-300">Target Assigned</th>
                <th className="p-3 text-left border border-gray-300">Achieved</th>
                <th className="p-3 text-left border border-gray-300">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((item, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="p-3 border border-gray-300">{item.month}</td>
                  <td className="p-3 border border-gray-300">{(item.target || 0).toLocaleString()}</td>
                  <td className="p-3 border border-gray-300">{(item.achieved || 0).toLocaleString()}</td>
                  <td className="p-3 border border-gray-300">{item.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
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

export default TargetHistoryReport;