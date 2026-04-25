import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getAllCities, getDatas, getAttendanceBySalesId } from '../APIS';
import { toast } from 'react-toastify';
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import placeholder from '../assets/placehold.jpg';
import { MdCalendarMonth } from 'react-icons/md';
import { FaRegClock } from 'react-icons/fa';
import { Link, useSearchParams } from 'react-router-dom';
import { ROLES } from '../utils';

const AttandanceTracking = () => {
    const [limit, setLimit] = useState(10);
    const [searchParams, setSearchParams] = useSearchParams();
    const admin = useSelector((state) => state.admin);
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
        ? (admin?.user?.city && typeof admin.user.city === 'object'
            ? admin.user.city._id
            : admin?.user?.city || '')
        : '';

    const [currentPage, setCurrentPage] = useState(() => {
        try {
            const fromUrl = parseInt(new URLSearchParams(window.location.search).get('page') || '', 10);
            if (!Number.isNaN(fromUrl) && fromUrl > 0) return fromUrl;
        } catch (e) {}
        try {
            const stored = localStorage.getItem('attendanceTrackingPage');
            if (stored) { const p = parseInt(stored, 10); if (!Number.isNaN(p) && p > 0) return p; }
        } catch (e) {}
        return 1;
    });

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(() => {
        try { return !localStorage.getItem('attendanceTrackingData'); } catch (e) { return true; }
    });
    const [totalPages, setTotalPages] = useState(() => {
        try { const s = localStorage.getItem('attendanceTrackingTotalPages'); return s ? parseInt(s, 10) : 0; } catch (e) { return 0; }
    });
    const [sales, setSales] = useState([]);
    const [salesWithStatus, setSalesWithStatus] = useState(() => {
        try { const s = localStorage.getItem('attendanceTrackingData'); return s ? JSON.parse(s) : []; } catch (e) { return []; }
    });
    const [cities, setCities] = useState({ isLoaded: false, data: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedCityId, setSelectedCityId] = useState(coordinatorCityId);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const citySelectHandler = (e) => {
        if (isCoordinator) { setSelectedCityId(coordinatorCityId || ''); setCurrentPage(1); return; }
        setSelectedCityId(e.target.value || '');
        setCurrentPage(1);
    };

    const checkOnlineStatus = async (salesId) => {
        try {
            const response = await getAttendanceBySalesId(salesId, 1);
            if (response.data.msg !== "success" || !Array.isArray(response.data.data)) return false;
            const records = response.data.data;
            const todayStr = new Date().toLocaleDateString('en-CA');
            const todays = records.filter(r => {
                if (r.date) return r.date === todayStr;
                if (r.checkInTime) return new Date(r.checkInTime).toISOString().slice(0, 10) === todayStr;
                return false;
            });
            if (!todays.length) return false;
            const normalizeTime = (r) => { const t = r.checkInTime ? new Date(r.checkInTime) : (r.createdAt ? new Date(r.createdAt) : null); return t && !isNaN(t.getTime()) ? t.getTime() : 0; };
            const latest = todays.reduce((a, b) => (normalizeTime(a) >= normalizeTime(b) ? a : b));
            return Boolean(latest?.checkInTime) && (!latest?.checkOutTime || latest.checkOutTime === "");
        } catch (error) { return false; }
    };

    const fetchSalesWithStatus = async () => {
        setLoading(true);
        try {
            const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${encodeURIComponent(debouncedSearchTerm)}&city=${encodeURIComponent(selectedCityId)}`;
            const res = await getDatas(link);
            const salesData = res.data.data;
            setTotalPages(res.data.totalPages);
            const salesWithStatusData = await Promise.all(
                salesData.map(async (s) => ({ ...s, isOnline: await checkOnlineStatus(s._id) }))
            );
            setSalesWithStatus(salesWithStatusData);
            setSales(salesData);
            try {
                localStorage.setItem('attendanceTrackingData', JSON.stringify(salesWithStatusData));
                localStorage.setItem('attendanceTrackingTotalPages', String(res.data.totalPages));
            } catch (e) {}
            setLoading(false);
        } catch (err) { setLoading(false); toast.error(err.message); }
    };

    useEffect(() => {
        const load = async () => { await fetchSalesWithStatus(); setInitialLoading(false); };
        load();
    }, [currentPage, selectedCityId, debouncedSearchTerm, limit]);

    useEffect(() => {
        try { localStorage.setItem('attendanceTrackingPage', String(currentPage)); } catch (e) {}
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
                if (isCoordinator) all = all.filter((c) => c._id === coordinatorCityId);
                setCities({ isLoaded: true, data: all });
                if (isCoordinator && coordinatorCityId && selectedCityId !== coordinatorCityId) setSelectedCityId(coordinatorCityId);
            }).catch(err => console.log("Loading cities: ", err.message));
        }
    }, [cities.isLoaded, isCoordinator, coordinatorCityId]);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

                .at-wrapper {
                    font-family: 'DM Sans', sans-serif;
                    position: relative;
                }

                /* ── Top bar ── */
                .at-topbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                    margin-bottom: 16px;
                }

                .at-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin: 0;
                }

                /* ── Filter pill container (mirrors User.jsx) ── */
                .at-filters {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px;
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow:
                        0 1px 2px rgba(0,0,0,0.04),
                        0 4px 16px rgba(0,0,0,0.06),
                        inset 0 1px 0 rgba(255,255,255,0.9);
                    border: 1px solid rgba(0,0,0,0.07);
                    position: relative;
                }

                .at-filters::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 16px;
                    background: linear-gradient(135deg, rgba(255,89,52,0.03) 0%, transparent 60%);
                    pointer-events: none;
                }

                .at-divider {
                    width: 1px;
                    background: rgba(0,0,0,0.07);
                    margin: 6px 2px;
                    align-self: stretch;
                    border-radius: 1px;
                }

                /* ── Search input pill ── */
                .at-search-pill {
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    padding: 9px 14px;
                    border-radius: 11px;
                    background: transparent;
                    transition: background 0.18s ease;
                }

                .at-search-pill:focus-within {
                    background: rgba(255, 89, 52, 0.07);
                }

                .at-search-pill input {
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: #1a1a1a;
                    letter-spacing: -0.01em;
                    width: 160px;
                }

                .at-search-pill input::placeholder {
                    color: #9ca3af;
                    font-weight: 400;
                }

                /* ── City select pill ── */
                .at-city-select {
                    appearance: none;
                    -webkit-appearance: none;
                    border: none;
                    outline: none;
                    background: transparent;
                    padding: 9px 28px 9px 14px;
                    border-radius: 11px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: #5a5f6e;
                    letter-spacing: -0.01em;
                    cursor: pointer;
                    transition: background 0.18s ease, color 0.18s ease;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 10px center;
                }

                .at-city-select:hover, .at-city-select:focus {
                    background-color: rgba(255, 89, 52, 0.07);
                    color: #FF5934;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23FF5934' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
                }

                /* ── Table ── */
                .at-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0 8px;
                }

                .at-table thead td {
                    font-size: 13px;
                    font-weight: 500;
                    color: #9ca3af;
                    padding: 4px 10px;
                    letter-spacing: 0.02em;
                    text-transform: uppercase;
                    font-size: 11px;
                }

                .at-table tbody tr {
                    cursor: pointer;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                }

                .at-table tbody tr:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.06);
                }

                .at-table tbody tr td {
                    background: #ffffff;
                    padding: 10px 14px;
                }

                .at-table tbody tr td:first-child {
                    border-radius: 12px 0 0 12px;
                }

                .at-table tbody tr td:last-child {
                    border-radius: 0 12px 12px 0;
                }

                /* ── Status badges ── */
                .badge-online {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    background: #f0fdf4;
                    color: #16a34a;
                    border: 1px solid rgba(22, 163, 74, 0.2);
                }

                .badge-online::before {
                    content: '';
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #16a34a;
                    flex-shrink: 0;
                    animation: pulse-green 2s infinite;
                }

                .badge-offline {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 500;
                    background: #fef2f2;
                    color: #dc2626;
                    border: 1px solid rgba(220, 38, 38, 0.15);
                }

                .badge-offline::before {
                    content: '';
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #dc2626;
                    flex-shrink: 0;
                }

                @keyframes pulse-green {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                /* ── Action buttons ── */
                .at-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 5px;
                    border-radius: 10px;
                    background: #f9fafb;
                    border: 1px solid rgba(0,0,0,0.07);
                }

                .at-action-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 30px;
                    height: 30px;
                    border-radius: 7px;
                    color: #6b7280;
                    text-decoration: none;
                    transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
                }

                .at-action-btn:hover {
                    background: #FF5934;
                    color: #ffffff;
                    transform: scale(1.08);
                }

                .at-action-divider {
                    width: 1px;
                    height: 16px;
                    background: rgba(0,0,0,0.08);
                    flex-shrink: 0;
                }

                /* ── Pagination ── */
                .at-pagination {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 16px;
                }

                .at-page-controls {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px;
                    background: #ffffff;
                    border-radius: 14px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
                    border: 1px solid rgba(0,0,0,0.07);
                }

                .at-page-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 9px;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: #5a5f6e;
                    transition: background 0.15s ease, color 0.15s ease;
                }

                .at-page-btn:hover:not(:disabled) {
                    background: rgba(255, 89, 52, 0.07);
                    color: #FF5934;
                }

                .at-page-btn:disabled {
                    opacity: 0.35;
                    cursor: not-allowed;
                }

                .at-page-info {
                    padding: 0 10px;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: #5a5f6e;
                    letter-spacing: -0.01em;
                }

                .at-show-control {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    background: #ffffff;
                    border-radius: 14px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06);
                    border: 1px solid rgba(0,0,0,0.07);
                }

                .at-show-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #9ca3af;
                }

                .at-show-select {
                    appearance: none;
                    -webkit-appearance: none;
                    border: none;
                    outline: none;
                    background: transparent;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: #5a5f6e;
                    cursor: pointer;
                    padding-right: 16px;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 0px center;
                }

                /* ── Loading skeleton ── */
                .at-skeleton-row td {
                    background: #f3f4f6;
                    animation: shimmer 1.4s infinite linear;
                }

                @keyframes shimmer {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                @media (max-width: 640px) {
                    .at-filters { flex-wrap: wrap; border-radius: 14px; }
                    .at-search-pill input { width: 120px; }
                }
            `}</style>

            <div className="at-wrapper">
                {/* Top bar */}
                <div className="at-topbar">
                    <h1 className="at-title">Attendance & Tracking</h1>

                    <div className="at-filters">
                        {/* Search */}
                        <div className="at-search-pill">
                            <img src="/Search.svg" alt="search" style={{ width: 15, height: 15, opacity: 0.5 }} />
                            <input
                                type="search"
                                name="search"
                                placeholder="Search by name"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                onKeyPress={async (e) => { if (e.key === 'Enter') await fetchSalesWithStatus(); }}
                            />
                        </div>

                        <div className="at-divider" />

                        {/* City select */}
                        <select
                            value={selectedCityId}
                            onChange={citySelectHandler}
                            className="at-city-select"
                        >
                            {isCoordinator ? (
                                cities.data.map((city) => (
                                    <option value={city._id} key={city._id}>{city.name}</option>
                                ))
                            ) : (
                                <>
                                    <option value=''>All locations</option>
                                    {cities.data.map((city) => (
                                        <option value={city._id} key={city._id}>{city.name}</option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <table className="at-table">
                    <thead>
                        <tr>
                            <td>Name</td>
                            <td>Sales ID</td>
                            <td>Status</td>
                            <td>Actions</td>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && salesWithStatus.length === 0 ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <tr key={i} className="at-skeleton-row">
                                    <td style={{ borderRadius: '12px 0 0 12px', height: 56 }}>&nbsp;</td>
                                    <td>&nbsp;</td>
                                    <td>&nbsp;</td>
                                    <td style={{ borderRadius: '0 12px 12px 0' }}>&nbsp;</td>
                                </tr>
                            ))
                        ) : salesWithStatus.length ? (
                            salesWithStatus.map((data, index) => (
                                <tr key={index}>
                                    {/* Name */}
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <img
                                                src={data.image || placeholder}
                                                alt=""
                                                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(0,0,0,0.08)' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{data.name}</div>
                                                <div style={{ fontSize: 12, color: '#9ca3af' }}>{data.email}</div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* ID */}
                                    <td>
                                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#6b7280', background: '#f3f4f6', padding: '3px 8px', borderRadius: 6 }}>
                                            #{data._id ? data._id.slice(-6) : '000000'}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td>
                                        {data.isOnline
                                            ? <span className="badge-online">Online</span>
                                            : <span className="badge-offline">Offline</span>
                                        }
                                    </td>

                                    {/* Actions */}
                                    <td>
                                        <div className="at-actions">
                                            <Link
                                                to={`/attendance-tracking/attendance?salesId=${data._id}&page=${currentPage}`}
                                                className="at-action-btn"
                                                title="Attendance"
                                            >
                                                <MdCalendarMonth size={15} />
                                            </Link>
                                            <div className="at-action-divider" />
                                            <Link
                                                to={`/attendance-tracking/tracking?salesId=${data._id}&page=${currentPage}`}
                                                className="at-action-btn"
                                                title="Tracking"
                                            >
                                                <img src='/locations.png' alt='Locations' style={{ width: 14, height: 14 }} />
                                            </Link>
                                            <div className="at-action-divider" />
                                            <Link
                                                to={`/attendance-tracking/visits?salesId=${data._id}&page=${currentPage}`}
                                                className="at-action-btn"
                                                title="Visits"
                                            >
                                                <FaRegClock size={13} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            !initialLoading && (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 14 }}>
                                        No data found
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="at-pagination">
                    <div className="at-page-controls">
                        <button
                            className="at-page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            <GrFormPrevious size={16} />
                        </button>
                        <span className="at-page-info">{currentPage} / {totalPages}</span>
                        <button
                            className="at-page-btn"
                            disabled={totalPages <= currentPage}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            <GrFormNext size={16} />
                        </button>
                    </div>

                    <div className="at-show-control">
                        <span className="at-show-label">Show</span>
                        <select
                            value={limit}
                            onChange={e => { setLimit(Number(e.target.value)); setCurrentPage(1); }}
                            className="at-show-select"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AttandanceTracking;