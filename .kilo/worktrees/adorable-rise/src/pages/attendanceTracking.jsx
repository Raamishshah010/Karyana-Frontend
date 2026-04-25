import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getAllCities, getDatas, getAttendanceBySalesId } from '../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import placeholder from '../assets/placehold.jpg'
import { MdCalendarMonth } from 'react-icons/md';
import { FaRegClock } from 'react-icons/fa';
import { Link, useSearchParams } from 'react-router-dom';
import { ROLES } from '../utils';

const AttandanceTracking = () => {
    const [limit, setLimit] = useState(10);
    const [searchParams, setSearchParams] = useSearchParams();
    // Logged-in admin and coordinator city (supports id or populated object)
    const admin = useSelector((state) => state.admin);
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
        ? (admin?.user?.city && typeof admin.user.city === 'object'
            ? admin.user.city._id
            : admin?.user?.city || '')
        : '';
    const [currentPage, setCurrentPage] = useState(() => {
        // Initialize from URL first, then localStorage, else default to 1
        try {
            const fromUrl = parseInt(new URLSearchParams(window.location.search).get('page') || '', 10);
            if (!Number.isNaN(fromUrl) && fromUrl > 0) return fromUrl;
        } catch (e) {
            // ignore
        }
        try {
            const stored = localStorage.getItem('attendanceTrackingPage');
            if (stored) {
                const p = parseInt(stored, 10);
                if (!Number.isNaN(p) && p > 0) return p;
            }
        } catch (e) {
            // storage not available; ignore
        }
        return 1;
    });
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(() => {
        try {
            const stored = localStorage.getItem('attendanceTrackingData');
            return !stored;
        } catch (e) { return true; }
    });
    const [totalPages, setTotalPages] = useState(() => {
        try {
            const stored = localStorage.getItem('attendanceTrackingTotalPages');
            return stored ? parseInt(stored, 10) : 0;
        } catch (e) { return 0; }
    });
    const [sales, setSales] = useState([]);
    const [salesWithStatus, setSalesWithStatus] = useState(() => {
        try {
            const stored = localStorage.getItem('attendanceTrackingData');
            return stored ? JSON.parse(stored) : [];
        } catch (e) { return []; }
    });
    const [cities, setCities] = useState({
        isLoaded: false,
        data: [],
    });

    // Filters (aligned with Sales.jsx)
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    // Lock selection to coordinator's city by default (if applicable)
    const [selectedCityId, setSelectedCityId] = useState(coordinatorCityId);

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    // Helper: reset to page 1 and show all users
    const refreshAllUsers = () => {
        setSearchTerm('');
        setCurrentPage(1);
    };

    // City select handler: prevent changing city for coordinators
    const citySelectHandler = (e) => {
        if (isCoordinator) {
            setSelectedCityId(coordinatorCityId || '');
            setCurrentPage(1);
            return;
        }
        const value = e.target.value;
        setSelectedCityId(value || '');
        setCurrentPage(1);
    };

    // Function to check if a sales person is online based on attendance data
    const checkOnlineStatus = async (salesId) => {
        try {
            // Fetch only today
            const response = await getAttendanceBySalesId(salesId, 1);
            if (response.data.msg !== "success" || !Array.isArray(response.data.data)) {
                return false;
            }

            const records = response.data.data;
            // Filter to today's date (server uses YYYY-MM-DD as string)
            // Local date in YYYY-MM-DD to match server 'date' field
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todays = records.filter(r => {
                if (r.date) return r.date === todayStr;
                if (r.checkInTime) return new Date(r.checkInTime).toISOString().slice(0, 10) === todayStr;
                return false;
            });

            if (!todays.length) return false;

            // Pick the latest check-in for today
            const normalizeTime = (r) => {
                const t = r.checkInTime ? new Date(r.checkInTime) : (r.createdAt ? new Date(r.createdAt) : null);
                return t && !isNaN(t.getTime()) ? t.getTime() : 0;
            };
            const latest = todays.reduce((a, b) => (normalizeTime(a) >= normalizeTime(b) ? a : b));

            // Online if latest record has check-in and no check-out yet
            return Boolean(latest?.checkInTime) && (!latest?.checkOutTime || latest.checkOutTime === "");
        } catch (error) {
            console.error("Error checking attendance status:", error);
            return false; // Default to offline on error
        }
    };

    // Function to fetch sales data and their attendance status
    const fetchSalesWithStatus = async () => {
        setLoading(true);
        try {
            const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${encodeURIComponent(debouncedSearchTerm)}&city=${encodeURIComponent(selectedCityId)}`;
            const res = await getDatas(link);
            const salesData = res.data.data;
            setTotalPages(res.data.totalPages);

            // Check attendance status for each sales person
            const salesWithStatusPromises = salesData.map(async (salesperson) => {
                const isOnline = await checkOnlineStatus(salesperson._id);
                return {
                    ...salesperson,
                    isOnline: isOnline
                };
            });

            const salesWithStatusData = await Promise.all(salesWithStatusPromises);
            setSalesWithStatus(salesWithStatusData);
            setSales(salesData); // Keep original data for compatibility

            // Persist for faster back navigation
            try {
                localStorage.setItem('attendanceTrackingData', JSON.stringify(salesWithStatusData));
                localStorage.setItem('attendanceTrackingTotalPages', String(res.data.totalPages));
            } catch (e) { /* ignore */ }

            setLoading(false);
        } catch (err) {
            setLoading(false);
            toast.error(err.message);
        }
    };

    useEffect(() => {
        const load = async () => {
            await fetchSalesWithStatus();
            setInitialLoading(false);
        };
        load();
    }, [currentPage, selectedCityId, debouncedSearchTerm, limit]);

    // Persist page changes to URL and localStorage for reliable back navigation
    useEffect(() => {
        try {
            localStorage.setItem('attendanceTrackingPage', String(currentPage));
        } catch (e) {
            // ignore if storage fails
        }
        setSearchParams(prev => {
            const params = new URLSearchParams(prev);
            params.set('page', String(currentPage));
            return params;
        }, { replace: true });
    }, [currentPage, setSearchParams]);

    useEffect(() => {
        if (!cities.isLoaded) {
            getAllCities().then(res => {
                let all = Array.isArray(res?.data?.data) ? res.data.data : [];
                // If coordinator, restrict list to assigned city only
                if (isCoordinator) {
                    all = all.filter((c) => c._id === coordinatorCityId);
                }
                setCities({
                    isLoaded: true,
                    data: all,
                });
                // Ensure selected city is set for coordinators
                if (isCoordinator && coordinatorCityId && selectedCityId !== coordinatorCityId) {
                    setSelectedCityId(coordinatorCityId);
                }
            }).catch(err => {
                console.log("Loading cities: ", err.message);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cities.isLoaded, isCoordinator, coordinatorCityId]);

    // Removed full-page loader to prevent blocking UI on back navigation
    // if (loading) return <Loader />

    return (
        <div className='relative'>
            <div className='flex justify-between items-center mt-3'>
                <h1 className='text-xl font-bold'>Attendance & Tracking</h1>
                {/* Filters: Search by name and Select City (matching Sales.jsx style) */}
                <div className='flex gap-7'>
                    <div className='flex bg-[#FFFFFF] rounded-xl ml-10 px-1'>
                        <img src="/Search.svg" alt="search" className='' />
                        <input
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            onKeyPress={async (e) => {
                                if (e.key === 'Enter') {
                                    await fetchSalesWithStatus();
                                }
                            }}
                            value={searchTerm}
                            className='p-2 outline-none rounded-xl'
                            type='search'
                            name='search'
                            placeholder='Search by name'
                        />
                    </div>
                    <select
                        value={selectedCityId}
                        onChange={citySelectHandler}
                        className='bg-[#FFFFFF] rounded-lg p-1'
                    >
                        {isCoordinator ? (
                            // Show only coordinator's city
                            cities.data.map((city) => (
                                <option value={city._id} key={city._id}>{city.name}</option>
                            ))
                        ) : (
                            <>
                                <option value=''>Select Location</option>
                                <option value=''>View All</option>
                                {cities.data.map((city) => (
                                    <option value={city._id} key={city._id}>{city.name}</option>
                                ))}
                            </>
                        )}
                    </select>
                </div>
            </div>
            <div className='mt-3'>
                <table className='w-full border-separate border-spacing-y-4'>
                    <thead>
                        <tr className='text-left\ntext-left text-gray-500 '>
                            <td>Name</td>
                            <td>Sales ID</td>
                            <td>Active</td>
                            <td>Actions</td>
                        </tr>
                    </thead>
                    <tbody className=''>
                        {salesWithStatus.length ? salesWithStatus.map((data, index) => (
                            <tr key={index} className='cursor-pointer'>
                                <td className='flex items-center gap-2 p-2 rounded-l-lg bg-[#FFFFFF]'>
                                    <img src={data.image || placeholder} alt="" className='w-8 h-8 rounded-full' />
                                    <div>
                                        <h1 className='font-bold'>{data.name}</h1>
                                        <h3 className='text-sm text-gray-400'>{data.email}</h3>
                                    </div>
                                </td>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>#{data._id ? data._id.slice(-6) : '000000'}</td>
                                <td className='p-2 text-2xl cursor-pointer bg-[#FFFFFF]'>
                                    {data.isOnline ? (
                                        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 inset-ring inset-ring-green-600/20">Online</span>
                                    ) : (
                                        <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10">Offline</span>
                                    )}
                                </td>
                                <td className='bg-[#FFFFFF]'>
                                    <div className="relative p-2 rounded-r-xl bg-[#FFFFFF]  max-w-[130px] flex justify-center items-center rounded-xl border gap-5">
                                        <Link to={`/attendance-tracking/attendance?salesId=${data._id}&page=${currentPage}`} >
                                            <MdCalendarMonth size={16} />
                                        </Link>
                                        <Link to={`/attendance-tracking/tracking?salesId=${data._id}&page=${currentPage}`} >
                                            <img src='/locations.png' alt='Locations' className='w-4 h-4' />
                                        </Link>
                                        <Link to={`/attendance-tracking/visits?salesId=${data._id}&page=${currentPage}`} >
                                            <FaRegClock size={14} />
                                        </Link>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            !initialLoading && (
                                <tr>
                                    <td colSpan="4" className="text-center p-4">No data found</td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
            <div
                className="pagination-container mt-4 flex justify-between items-center w-full"
            >
                {/* LEFT SIDE — Pagination */}
                <div className="flex items-center gap-3">
                    <button
                        className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                    >
                        <GrFormPrevious />
                    </button>

                    <div className="flex items-center gap-1">
                        <span>{currentPage}</span>
                        <span>/</span>
                        <span>{totalPages}</span>
                    </div>

                    <button
                        className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={totalPages <= currentPage}
                    >
                        <GrFormNext />
                    </button>
                </div>

                {/* RIGHT SIDE — Show Dropdown */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Show:</span>
                    <select
                        value={limit}
                        onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setCurrentPage(1);
                        }}
                        className="bg-white border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                    >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default AttandanceTracking;
