import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GrFormPrevious } from 'react-icons/gr';
import logok from '../assets/logokaryana.png';
import { getAttendanceBySalesId, getSalesPersonBySalesId } from '../APIS';

const AttendanceReport = () => {
  const reportRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const salesId = searchParams.get('salesId');
  const [attendanceData, setAttendanceData] = useState([]);
  const [totalTimeDisplay, setTotalTimeDisplay] = useState("0m");
  const [loading, setLoading] = useState(true);
  const [salesPerson, setSalesPerson] = useState(null);
  const [selectedDays, setSelectedDays] = useState(30);

  // Format time function
  const formatTime = (time) => {
    if (!time) return "N/A";
    let date;
    if (time.includes('T')) {
        date = new Date(time);
    } else {
        const [hours, minutes] = time.split(':');
        date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    }
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
    });
  };

  // Format date function
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Fetch attendance data
  useEffect(() => {
    const fetchData = async () => {
      if (!salesId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Fetch attendance data
        const attendanceResponse = await getAttendanceBySalesId(salesId, selectedDays);
        
        if (attendanceResponse.data.msg === "success") {
          setAttendanceData(attendanceResponse.data.data);
          setTotalTimeDisplay(attendanceResponse.data.totalTimeDisplay || "0m");
        }

        // Fetch sales person data by salesId to get basicSalary and allowanceDistance
        try {
          const salesPersonResponse = await getSalesPersonBySalesId(salesId);
          
          if (salesPersonResponse.data && salesPersonResponse.data.msg === "success") {
            setSalesPerson(salesPersonResponse.data.data);
          } else {
            // Fallback: Check for salesPersonID in the first attendance record
            if (attendanceResponse.data.data.length > 0) {
              const firstRecord = attendanceResponse.data.data[0];
              
              if (firstRecord.salesPersonID) {
                setSalesPerson(firstRecord.salesPersonID);
              } else {
                setSalesPerson({
                  name: `Sales ID: ${salesId}`,
                  phone: "Contact information not available",
                  basicSalary: 25000,
                  allowanceDistance: 0
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching sales person data:", error);
          // Fallback: Check for salesPersonID in the first attendance record
          if (attendanceResponse.data.data.length > 0) {
            const firstRecord = attendanceResponse.data.data[0];
            
            if (firstRecord.salesPersonID) {
              setSalesPerson(firstRecord.salesPersonID);
            } else {
              setSalesPerson({
                name: `Sales ID: ${salesId}`,
                phone: "Contact information not available",
                basicSalary: 25000,
                allowanceDistance: 0
              });
            }
          }
        }
      } catch (error) {
        console.error("Error fetching attendance data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [salesId, selectedDays]);

  // Calculate attendance statistics
  const calculateStats = () => {
    // Fixed values as per requirements
    const totalWorkingDays = 24;
    const hoursPerDay = 8;
    const expectedTotalHours = totalWorkingDays * hoursPerDay; // 192 hours
    
    // Basic salary from database (fallback to 25000 if not available)
    const basicSalary = salesPerson?.basicSalary || 25000;
    
    // Allowance distance rate from database (fallback to 0 if not available)
    const allowanceDistance = salesPerson?.allowanceDistance || 0;
    
    // Calculate hourly rate: Basic Salary / Total Working Hours
    const hourlyRate = basicSalary / expectedTotalHours;
    
    // Group attendance data by date for unique days (for present/absent calculation)
    const uniqueDaysData = {};
    attendanceData.forEach(data => {
      if (data.checkInTime) {
        // Extract date from checkInTime (assuming format like "2025-10-28T09:00:00")
        const checkInDate = new Date(data.checkInTime);
        const dateKey = checkInDate.toDateString(); // This will give us "Mon Oct 28 2025"
        
        // Only keep the first check-in of each day for present/absent calculation
        if (!uniqueDaysData[dateKey]) {
          uniqueDaysData[dateKey] = data;
        }
      }
    });
    
    // Convert back to array for easier processing
    const uniqueAttendanceData = Object.values(uniqueDaysData);
    
    // Calculate present and absent days based on unique days only
    const presentDays = uniqueAttendanceData.length;
    const absentDays = totalWorkingDays - presentDays;
    
    // Calculate total hours worked by summing all check-in/check-out pairs for each day
    let totalHoursWorked = 0;
    
    // Group all attendance records by date for hours calculation
    const dailyAttendance = {};
    attendanceData.forEach(data => {
      if (data.checkInTime) {
        const checkInDate = new Date(data.checkInTime);
        const dateKey = checkInDate.toDateString();
        
        if (!dailyAttendance[dateKey]) {
          dailyAttendance[dateKey] = [];
        }
        dailyAttendance[dateKey].push(data);
      }
    });
    
    // Calculate total hours for each day by summing all sessions
    Object.values(dailyAttendance).forEach(dayRecords => {
      dayRecords.forEach(data => {
        if (data.checkInTime && data.checkOutTime) {
          const checkIn = new Date(data.checkInTime);
          const checkOut = new Date(data.checkOutTime);
          const timeDiffMs = checkOut - checkIn;
          const hours = timeDiffMs / (1000 * 60 * 60); // Convert milliseconds to hours
          
          if (hours > 0) {
            totalHoursWorked += hours;
          }
        }
      });
    });
    
    // Calculate total distance traveled (sum of all distance values from attendance records)
    let totalDistanceTraveled = 0;
    attendanceData.forEach(data => {
      if (data.distance && data.distance > 0) {
        totalDistanceTraveled += data.distance;
      }
    });
    
    // Calculate allowance based on distance traveled
    const totalAllowance = totalDistanceTraveled * allowanceDistance;
    
    // Calculate final salary based on actual hours worked
    // If user completes less than 192 hours, salary will be deducted
    const hourlyBasedSalary = totalHoursWorked * hourlyRate;
    
    // Final salary = Basic Salary (based on hours worked) + Allowance (km × allowanceDistance)
    const finalSalary = hourlyBasedSalary + totalAllowance;
    
    return {
      totalDays: totalWorkingDays,
      presentDays,
      absentDays,
      totalHours: totalHoursWorked.toFixed(2),
      expectedHours: expectedTotalHours,
      basicSalary,
      hourlyRate: Math.round(hourlyRate),
      totalDistanceTraveled: totalDistanceTraveled.toFixed(2),
      allowanceDistance,
      totalAllowance: totalAllowance.toFixed(2),
      hourlyBasedSalary: hourlyBasedSalary.toFixed(2),
      totalSalary: finalSalary.toFixed(2)
    };
  };

  const stats = calculateStats();

  // Download PDF function
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
            // Ensure all styles are applied to images in the cloned document
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

        // Add the first page
        pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Add additional pages if needed
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(data, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`KAR-Attendance-${salesPerson?.name || 'report'}-${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } finally {
      // Restore the download button and hidden elements
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

  if (!attendanceData.length) {
    return <div className="flex justify-center items-center h-screen">No attendance data available</div>;
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
            <p>{salesPerson?.phone || 'N/A'}</p>
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
            {salesPerson?.name || 'Sales Person'} Attendance Report
          </p>
          <p className="text-lg text-black">
            Phone Number: {salesPerson?.phone || 'N/A'}
          </p>
          <p className="text-black">
            {formatDate(new Date(Date.now() - selectedDays * 24 * 60 * 60 * 1000))} - {formatDate(new Date())}
          </p>
        </div>
      </div>

      {/* Summary Tables */}
      <div className="w-full px-4 py-6 flex-grow">
        {/* Attendance Summary */}
        <table className="w-full border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="p-4 border-r border-black">Total Working Days</td>
              <td className="p-4 border-r border-black">Present Days</td>
              <td className="p-4 border-r border-black">Absent Days</td>
              <td className="p-4">Total Hours</td>
            </tr>
            <tr className="text-right">
              <td className="p-4 border-r border-black">{stats.totalDays}</td>
              <td className="p-4 border-r border-black">{stats.presentDays}</td>
              <td className="p-4 border-r border-black">{stats.absentDays}</td>
              <td className="p-4">{stats.totalHours} hrs</td>
            </tr>
          </tbody>
        </table>
        
        {/* Salary Information */}
        <table className="w-full border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="p-4 border-r border-black">Basic Salary</td>
              <td className="p-4 border-r border-black">Hourly Rate</td>
              <td className="p-4">Final Salary (B.S + km x Allowance)</td>
            </tr>
            <tr className="text-right">
              <td className="p-4 border-r border-black">Rs. {stats.basicSalary.toLocaleString()}</td>
              <td className="p-4 border-r border-black">Rs. {stats.hourlyRate}/hour</td>
              <td className="p-4">Rs. {parseFloat(stats.totalSalary).toLocaleString()}</td>
            </tr>
            <tr className="text-xs text-gray-600">
              <td className="p-2 border-r border-black"></td>
              <td className="p-2 border-r border-black"></td>
              <td className="p-2">Basic Salary: Rs. {stats.basicSalary.toLocaleString()} | Expected Hours: 192 hrs | Present Hours: {stats.totalHours} hrs | Total: Rs. {parseFloat(stats.totalSalary).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Attendance Details */}
      <div className="w-full px-4 py-6 flex-grow">
        <div className="py-6 font-medium text-black">
          <p>No. of Entries: {stats.presentDays} (Unique Days Only - First Check-in)</p>
          <p className="text-sm text-gray-600">Total Records: {attendanceData.length} (Multiple check-ins filtered)</p>
        </div>
        <div className="overflow-x-auto flex-grow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="p-3 text-left border border-gray-300">Date</th>
                <th className="p-3 text-left border border-gray-300">Check In</th>
                <th className="p-3 text-left border border-gray-300">Check Out</th>
                <th className="p-3 text-left border border-gray-300">Hours</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group attendance records by date
                const groupedByDate = {};
                attendanceData.forEach((record) => {
                  if (!record.checkInTime) return;
                  const dateKey = new Date(record.checkInTime).toDateString();
                  if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
                  groupedByDate[dateKey].push(record);
                });

                // For each date, compute earliest check-in, latest check-out, and sum of all sessions
                return Object.values(groupedByDate).map((records, index) => {
                  let earliestCheckIn = null;
                  let latestCheckOut = null;
                  let totalMinutes = 0;

                  records.forEach((r) => {
                    if (r.checkInTime) {
                      const ci = new Date(r.checkInTime);
                      if (!earliestCheckIn || ci < earliestCheckIn) earliestCheckIn = ci;
                    }
                    if (r.checkOutTime) {
                      const co = new Date(r.checkOutTime);
                      if (!latestCheckOut || co > latestCheckOut) latestCheckOut = co;
                    }
                    if (r.checkInTime && r.checkOutTime) {
                      const diffMs = new Date(r.checkOutTime) - new Date(r.checkInTime);
                      if (diffMs > 0) totalMinutes += Math.floor(diffMs / (1000 * 60));
                    }
                  });

                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  const totalDisplay = hours > 0 ? (minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`) : `${minutes}m`;

                  return (
                    <tr key={index} className="border-b border-gray-300">
                      <td className="p-3 border border-gray-300">{earliestCheckIn ? formatDate(earliestCheckIn.toISOString()) : 'N/A'}</td>
                      <td className="p-3 border border-gray-300">{earliestCheckIn ? formatTime(earliestCheckIn.toISOString()) : 'N/A'}</td>
                      <td className="p-3 border border-gray-300">{latestCheckOut ? formatTime(latestCheckOut.toISOString()) : 'N/A'}</td>
                      <td className="p-3 border border-gray-300">{totalDisplay}</td>
                    </tr>
                  );
                });
              })()}
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

export default AttendanceReport;