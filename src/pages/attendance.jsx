import React, { useState, useEffect } from "react";
import { FaLocationDot } from "react-icons/fa6";
import { GrFormPrevious } from "react-icons/gr";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import GoogleMapComponent from "../components/common/googleMap";
import { getAttendanceBySalesId } from "../APIS";
import { FaFileAlt } from "react-icons/fa";
import DateRangePicker from "../components/DateRangePicker";

const Attendance = () => {
    const [show, setShow] = useState(false);
    const [attendanceData, setAttendanceData] = useState([]);
    const [totalTimeDisplay, setTotalTimeDisplay] = useState("0m");
    const [selectedDays, setSelectedDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const salesId = searchParams.get('salesId');

    // Function to format time from ISO datetime string to 12-hour format
    const formatTime = (time) => {
        if (!time) return "N/A";
        
        // Handle ISO datetime string (e.g., "2025-10-28T10:49:49.783116")
        let date;
        if (time.includes('T')) {
            date = new Date(time);
        } else {
            // Handle time-only format (e.g., "10:49")
            const [hours, minutes] = time.split(':');
            date = new Date();
            date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        }
        
        // Format to 12-hour format
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Function to format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
    };

    // Function to calculate time difference between check-in and check-out
    const calculateTimeDifference = (checkInTime, checkOutTime) => {
        if (!checkInTime || !checkOutTime) return "0m 0s";
        
        try {
            const checkIn = new Date(checkInTime);
            const checkOut = new Date(checkOutTime);
            
            // Calculate difference in milliseconds
            const timeDiffMs = checkOut - checkIn;
            
            if (timeDiffMs <= 0) return "0m 0s";
            
            // Convert to hours, minutes and seconds
            const totalSeconds = Math.floor(timeDiffMs / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            let result = "";
            if (hours > 0) result += `${hours}h `;
            if (minutes > 0 || hours > 0) result += `${minutes}m `;
            result += `${seconds}s`;
            
            return result.trim();
        } catch (error) {
            console.error("Error calculating time difference:", error);
            return "0m 0s";
        }
    };

    // Function to calculate total hours worked
    const calculateTotalHours = () => {
        let totalSeconds = 0;
        
        attendanceData.forEach(data => {
            if (data.checkInTime && data.checkOutTime) {
                try {
                    const checkIn = new Date(data.checkInTime);
                    const checkOut = new Date(data.checkOutTime);
                    const timeDiffMs = checkOut - checkIn;
                    
                    if (timeDiffMs > 0) {
                        totalSeconds += Math.floor(timeDiffMs / 1000);
                    }
                } catch (error) {
                    console.error("Error calculating time for record:", error);
                }
            }
        });
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        let result = "";
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0 || hours > 0) result += `${minutes}m `;
        result += `${seconds}s`;
        
        return result.trim() || "0s";
    };

    // Function to fetch attendance data
    const fetchAttendanceData = async () => {
        if (!salesId) {
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            const daysToFetch = startDate && endDate ? 365 : selectedDays;
            const response = await getAttendanceBySalesId(salesId, daysToFetch);
            if (response.data.msg === "success") {
                let data = Array.isArray(response.data.data) ? response.data.data : [];
                if (startDate && endDate) {
                    const sd = startDate;
                    const ed = endDate;
                    data = data.filter((r) => {
                        const dStr = r.date
                            ? r.date
                            : (r.checkInTime ? new Date(r.checkInTime).toISOString().slice(0, 10) : null);
                        if (!dStr) return false;
                        return dStr >= sd && dStr <= ed;
                    });
                }
                setAttendanceData(data);
                setTotalTimeDisplay(response.data.totalTimeDisplay || "0m");
            }
        } catch (error) {
            console.error("Error fetching attendance data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when component mounts or when filters change
    useEffect(() => {
        fetchAttendanceData();
    }, [salesId, selectedDays, startDate, endDate]);

    // Handle date range submit
    const handleDateRangeSubmit = (sd, ed) => {
        setStartDate(sd);
        setEndDate(ed);
    };

    // Handle location click
    const handleLocationClick = (lat, lng) => {
        setSelectedLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
        setShow(true);
    };

    return (
        <div className='relative'>
            <div className='flex justify-between items-center mt-3'>
                <div>
                    <h1 className='text-xl font-bold ml-12 mb-2'>Attendance</h1>
                    <div className="flex items-center mb-2">
                        <Link
                            className="text-[#FF5934] mr-4 bg-gray-200 p-1 rounded-lg"
                            to="/attendance-tracking"
                        >
                            <GrFormPrevious size={24} />
                        </Link>
                        <div>
                            <p className="text-gray-600">
                                Total Hours: <span className="font-bold text-[#FF5934]">{calculateTotalHours()}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/attendance-report?salesId=${salesId}`)}
                        className="flex items-center gap-2 px-3 py-1 font-semibold text-white bg-[#FF5934] rounded-md hover:bg-[#e04d2d]"
                        disabled={!attendanceData.length || loading}
                    >
                        <FaFileAlt />
                        Report
                    </button>
                    <DateRangePicker submitHandler={handleDateRangeSubmit} sd={startDate} ed={endDate} />
                </div>
            </div>
            <div className='mt-3'>
                <table className='w-full border-separate border-spacing-y-4'>
                    <thead>
                        <tr className='text-left\ntext-left text-gray-500 '>
                            <td>Date</td>
                            <td>Check In</td>
                            <td>Check Out</td>
                            <td>Total Hours</td>
                        </tr>
                    </thead>
                    <tbody className=''>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="text-center p-4">Loading...</td>
                            </tr>
                        ) : attendanceData.length ? [...attendanceData]
                            .sort((a, b) => {
                                // Sort by date desc, then by check-in time desc
                                const ad = new Date(a.date);
                                const bd = new Date(b.date);
                                const dateDiff = bd - ad;
                                if (dateDiff !== 0) return dateDiff;
                                const ati = a.checkInTime ? new Date(a.checkInTime).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                                const bti = b.checkInTime ? new Date(b.checkInTime).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                                return bti - ati;
                            })
                            .map((data, index) => (
                            <tr key={data._id || index} className='cursor-pointer'>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>{formatDate(data.date)}</td>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>
                                    <div className="flex items-center gap-2">
                                        <span>{formatTime(data.checkInTime)}</span>
                                        {data.lat && data.lng && (
                                            <button 
                                                className="text-blue-500" 
                                                onClick={() => handleLocationClick(data.lat, data.lng)}
                                            >
                                                <FaLocationDot />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>{formatTime(data.checkOutTime)}</td>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>{calculateTimeDifference(data.checkInTime, data.checkOutTime)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="text-center p-4">
                                    {salesId ? "No attendance data found" : "Please select a sales person from attendance tracking"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {show && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg w-96 relative">
                        <h2 className="text-xl px-6 py-4 border-b border-gray-300 font-bold mb-4">Location</h2>
                        <div className="px-6 pb-6">
                            <GoogleMapComponent
                                apiKey="AIzaSyAuJYLmzmglhCpBYTn0BjbJhjWYg0fPEEA"
                                center={selectedLocation || { lat: 24.8607, lng: 67.0011 }}
                                zoom={14}
                            />
                        </div>
                        <button
                            className="absolute top-4 right-4 bg-[#0000001A] rounded-full p-1 h-7 w-7 flex justify-center items-center text-gray-600 hover:text-gray-800"
                            onClick={() => setShow(false)}
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Attendance;
