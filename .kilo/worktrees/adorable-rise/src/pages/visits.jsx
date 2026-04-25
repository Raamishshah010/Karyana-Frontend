import React, { useState, useEffect } from "react";
import { FaRegEye } from "react-icons/fa";
import { GrFormPrevious } from "react-icons/gr";
import { Link, useSearchParams } from "react-router-dom";
import { getVisitsBySalesId } from "../APIS";
import DateRangePicker from "../components/DateRangePicker";

const Visits = () => {
    const [visitsData, setVisitsData] = useState([]);
    const [totalTimeDisplay, setTotalTimeDisplay] = useState("0m");
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const [showImage, setShowImage] = useState(false);
    const [selectedImageUrl, setSelectedImageUrl] = useState(null);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const salesId = searchParams.get('salesId');

    // Function to format time from 24-hour to 12-hour format
    const formatTime = (time) => {
        if (!time) return "N/A";
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes || '00'} ${ampm}`;
    };

    // Function to format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
    };

    const calculateTotalDisplay = (rows) => {
        let totalMinutes = 0;
        rows.forEach(r => {
            if (typeof r.duration === 'number') {
                totalMinutes += r.duration;
            }
        });
        if (totalMinutes >= 60) {
            const h = Math.floor(totalMinutes / 60);
            const m = Math.round(totalMinutes % 60);
            return m > 0 ? `${h}h ${m}m` : `${h}h`;
        }
        return `${Math.round(totalMinutes)}m`;
    };

    // Function to fetch visit data
    const fetchVisitData = async () => {
        if (!salesId) {
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            const daysToFetch = startDate && endDate ? 365 : 7;
            const response = await getVisitsBySalesId(salesId, daysToFetch);
            if (response.data.msg === "success") {
                let data = Array.isArray(response.data.data) ? response.data.data : [];
                if (startDate && endDate) {
                    const sd = startDate;
                    const ed = endDate;
                    data = data.filter(v => {
                        const d = v.visitDate;
                        if (!d) return false;
                        return d >= sd && d <= ed;
                    });
                }
                setVisitsData(data);
                setTotalTimeDisplay(calculateTotalDisplay(data));
            }
        } catch (error) {
            console.error("Error fetching visit data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch data when component mounts or when salesId/selectedDays changes
    useEffect(() => {
        fetchVisitData();
    }, [salesId, startDate, endDate]);

    const handleDateRangeSubmit = (sd, ed) => {
        setStartDate(sd);
        setEndDate(ed);
    };

    // Handle image click for Details
    const handleImageClick = (image) => {
        if (!image) return;
        const url = typeof image === "string" ? image.replace(/[`'\"]/g, "").trim() : "";
        if (!url) return;
        setSelectedImageUrl(url);
        setShowImage(true);
    };

    return (
        <div className='relative'>
            <div className='flex justify-between items-center mt-3'>
                <div>
                    <div className="flex items-center">
                        <Link
                            className="text-[#FF5934] bg-gray-200 p-1 rounded-lg"
                            to="/attendance-tracking"
                        >
                            <GrFormPrevious size={24} />
                        </Link>
                        <h1 className='text-xl font-bold ml-3'>Visits</h1>
                    </div>
                </div>
                <div className='flex items-center space-x-4'>
                    <span className='text-sm text-gray-600'>Total Time: {totalTimeDisplay}</span>
                    <DateRangePicker submitHandler={handleDateRangeSubmit} sd={startDate} ed={endDate} />
                </div>
            </div>
            <div className='mt-3'>
                <table className='w-full table-fixed border-separate border-spacing-y-2'>
                    <thead className='bg-gray-50'>
                        <tr>
                            <th className='py-2 px-3 text-left text-xs font-medium text-gray-600'>Retailer</th>
                            <th className='py-2 px-3 text-left text-xs font-medium text-gray-600'>Date</th>
                            <th className='py-2 px-3 text-left text-xs font-medium text-gray-600'>Start Visit</th>
                            <th className='py-2 px-3 text-left text-xs font-medium text-gray-600'>End Visit</th>
                            <th className='py-2 px-3 text-left text-xs font-medium text-gray-600'>Total Time</th>
                            <th className='py-2 px-3 text-center text-xs font-medium text-gray-600 w-16'>Details</th>
                        </tr>
                    </thead>
                    <tbody className=''>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className='py-6 text-center text-gray-500'>
                                    Loading visit data...
                                </td>
                            </tr>
                        ) : visitsData.length > 0 ? (
                            visitsData.map((data, index) => (
                                <tr key={index} className='cursor-pointer'>
                                    <td className='p-2 bg-[#FFFFFF]'>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-shrink-0">
                                                {data.retailerImage ? (
                                                    <img 
                                                        src={data.retailerImage} 
                                                        alt={data.shopName || 'Shop'} 
                                                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                                        onError={(e) => {
                                                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo8L3N2Zz4K';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M12 2L13.09 8.26L20 9L13.09 15.74L12 22L10.91 15.74L4 9L10.91 8.26L12 2Z" fill="#9CA3AF"/>
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {data.shopName || 'Unknown Shop'}
                                                </p>
                                                <p className="text-sm text-gray-500 truncate">
                                                    {data.retailerEmail || 'No email'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>{formatDate(data.visitDate)}</td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>
                                        <div className="flex items-center gap-2">
                                            <span>{formatTime(data.startTime)}</span>
                                        </div>
                                    </td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>{formatTime(data.endTime)}</td>
                                    <td className='py-2 px-3 bg-[#FFFFFF] font-medium'>{data.timeDisplay}</td>
                                    <td className='py-2 px-3 bg-[#FFFFFF] font-medium text-center'>
                                        {data.visitImage || data.image ? (
                                            <button
                                                className="text-orange-500 inline-flex items-center gap-1 hover:underline"
                                                onClick={() => handleImageClick(data.visitImage || data.image)}
                                                title="View Image"
                                            >
                                                <FaRegEye />
                                                <span className="sr-only">View</span>
                                            </button>
                                        ) : (
                                            <span className="text-gray-400">No Image</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className='py-6 text-center text-gray-500'>
                                    No visit data found for the selected period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {showImage && (
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg w-[28rem] relative">
                        <h2 className="text-xl px-6 py-4 border-b border-gray-300 font-bold mb-4">Visit Details</h2>
                        <div className="px-6 pb-6">
                            {selectedImageUrl ? (
                                <img
                                    src={selectedImageUrl}
                                    alt="Visit"
                                    className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
                                    onError={(e) => {
                                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSI4IiB5PSI4Ij4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo8L3N2Zz4K';
                                    }}
                                />
                            ) : (
                                <p className="text-center text-gray-500">No image available</p>
                            )}
                        </div>
                        <button
                            className="absolute top-4 right-4 bg-[#0000001A] rounded-full p-1 h-7 w-7 flex justify-center items-center text-gray-600 hover:text-gray-800"
                            onClick={() => {
                                setShowImage(false);
                                setSelectedImageUrl(null);
                            }}
                        >
                            X
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Visits;
