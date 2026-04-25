import React, { useState, useEffect } from "react";
import { GrFormPrevious, GrFormNext } from "react-icons/gr";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { getAllTargets, getAllSalesPersons, createTarget, updateTarget, deleteTarget } from "../APIS";
import { FaPlus, FaRegEye } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { toast } from 'react-toastify';
import ClickOutside from '../Hooks/ClickOutside';
import placeholder from '../assets/placehold.jpg';

const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
];

const getMonthName = (n) => MONTHS[parseInt(n) - 1];
const getMonthNumber = (name) => MONTHS.indexOf(name) + 1;
const formatNumber = (n) => (!n && n !== 0 ? 0 : Number(n).toLocaleString());

const EMPTY_FORM = { salesperson: '', month: '', target: '' };

const Target = () => {
    const [targetData, setTargetData]   = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [loading, setLoading]         = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages]   = useState(1);
    const [modalMode, setModalMode]     = useState(null); // 'add' | 'edit' | null
    const [showDropdown, setShowDropdown] = useState("");
    const [formData, setFormData]       = useState(EMPTY_FORM);
    const [editId, setEditId]           = useState(null);
    const [formLoading, setFormLoading] = useState(false);

    const fetchTargets = async () => {
        setLoading(true);
        try {
            const response = await getAllTargets();
            const targets  = response.data.data || [];
            const currentMonth = new Date().getMonth() + 1;

            const processed = targets
                .filter(t => {
                    const m = typeof t.month === 'string' ? getMonthNumber(t.month) : t.month;
                    return m === currentMonth;
                })
                .map(t => ({
                    id:            t._id,
                    name:          t.salesperson?.name  || 'Unknown',
                    email:         t.salesperson?.email || '',
                    city:          t.salesperson?.city?.name || 'N/A',
                    profilePicture:t.salesperson?.image,
                    target:        t.target   || 0,
                    achieved:      t.achieved || 0,
                    percentage:    t.target > 0 ? Math.round((t.achieved / t.target) * 100) : 0,
                    month:         t.month,
                    salespersonId: t.salesperson?._id || t.salesperson,
                }));

            setTargetData(processed);
        } catch (err) {
            toast.error("Failed to fetch targets");
        } finally {
            setLoading(false);
        }
    };

    const fetchSalesPersons = async () => {
        try {
            const res = await getAllSalesPersons();
            setSalesPersons(res.data.data || []);
        } catch { toast.error("Failed to fetch sales persons"); }
    };

    useEffect(() => { fetchTargets(); fetchSalesPersons(); }, [currentPage]);

    const handleInput = (e, setter) =>
        setter(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const openAdd  = () => { setFormData(EMPTY_FORM); setModalMode('add'); };
    const openEdit = (row) => {
        setFormData({
            salesperson: row.salespersonId || '',
            month: String(typeof row.month === 'string' ? getMonthNumber(row.month) : row.month),
            target: String(row.target),
        });
        setEditId(row.id);
        setModalMode('edit');
    };
    const closeModal = () => { setModalMode(null); setFormData(EMPTY_FORM); setEditId(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.salesperson || !formData.month || !formData.target)
            return toast.error("Please fill in all fields");

        setFormLoading(true);
        try {
            const payload = {
                salesperson: formData.salesperson,
                month:       getMonthName(formData.month),
                target:      parseFloat(formData.target),
            };
            if (modalMode === 'add') {
                await createTarget(payload);
                toast.success("Target created!");
            } else {
                await updateTarget(editId, payload);
                toast.success("Target updated!");
            }
            closeModal();
            fetchTargets();
        } catch (err) {
            toast.error(err.response?.data?.message || "Operation failed");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this target?")) return;
        try {
            await deleteTarget(id);
            toast.success("Target deleted!");
            fetchTargets();
        } catch { toast.error("Delete failed"); }
    };

    const pctColor = (p) => p >= 80 ? '#16a34a' : p >= 60 ? '#d97706' : '#dc2626';
    const pctBg    = (p) => p >= 80 ? '#f0fdf4' : p >= 60 ? '#fffbeb' : '#fef2f2';

    return (
        <>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

            .tg-wrap { font-family: 'DM Sans', sans-serif; position: relative; }

            /* ── Top bar ── */
            .tg-topbar { display:flex; justify-content:space-between; align-items:center; margin:12px 0 16px; }
            .tg-title  { font-size:20px; font-weight:600; color:#1a1a1a; margin:0; }

            /* ── Add button (pill style) ── */
            .tg-add-btn {
                display:inline-flex; align-items:center; gap:7px;
                padding:9px 18px; border-radius:11px;
                background: linear-gradient(135deg,#FF5934 0%,#ff7a5a 100%);
                color:#fff; border:none; cursor:pointer;
                font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:500;
                letter-spacing:-0.01em;
                box-shadow:0 2px 8px rgba(255,89,52,0.35),0 1px 2px rgba(255,89,52,0.2);
                transition:background 0.18s, box-shadow 0.18s, transform 0.15s;
            }
            .tg-add-btn:hover {
                background: linear-gradient(135deg,#e84e2b 0%,#ff6a47 100%);
                box-shadow:0 4px 12px rgba(255,89,52,0.45);
                transform:translateY(-1px);
            }

            /* ── Table ── */
            .tg-table { width:100%; border-collapse:separate; border-spacing:0 8px; }
            .tg-table thead td {
                font-size:11px; font-weight:500; color:#9ca3af;
                padding:4px 12px; letter-spacing:0.04em; text-transform:uppercase;
            }
            .tg-table tbody tr { cursor:pointer; transition:transform 0.15s, box-shadow 0.15s; }
            .tg-table tbody tr:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.06); }
            .tg-table tbody tr td { background:#fff; padding:12px 14px; }
            .tg-table tbody tr td:first-child { border-radius:12px 0 0 12px; }
            .tg-table tbody tr td:last-child  { border-radius:0 12px 12px 0; }

            /* ── Progress bar ── */
            .tg-bar-bg  { width:80px; height:5px; background:#f3f4f6; border-radius:99px; margin-top:5px; }
            .tg-bar-fill{ height:5px; border-radius:99px; transition:width 0.4s; }

            /* ── Actions cell ── */
            .tg-actions { display:inline-flex; align-items:center; gap:4px; padding:5px; border-radius:10px; background:#f9fafb; border:1px solid rgba(0,0,0,0.07); }
            .tg-action-btn {
                display:flex; align-items:center; justify-content:center;
                width:30px; height:30px; border-radius:7px; border:none; background:transparent;
                color:#6b7280; cursor:pointer; text-decoration:none;
                transition:background 0.15s, color 0.15s, transform 0.15s;
            }
            .tg-action-btn:hover { background:#FF5934; color:#fff; transform:scale(1.08); }
            .tg-action-divider { width:1px; height:16px; background:rgba(0,0,0,0.08); flex-shrink:0; }

            /* ── Dropdown ── */
            .tg-dropdown {
                position:absolute; right:0; top:calc(100% + 6px); z-index:20;
                min-width:130px; background:#fff; border-radius:12px;
                box-shadow:0 8px 24px rgba(0,0,0,0.12); border:1px solid rgba(0,0,0,0.07);
                overflow:hidden; padding:4px;
            }
            .tg-dropdown-item {
                display:block; width:100%; text-align:left; padding:8px 12px;
                border:none; background:transparent; cursor:pointer; border-radius:8px;
                font-family:'DM Sans',sans-serif; font-size:13.5px; font-weight:500; color:#374151;
                transition:background 0.15s, color 0.15s;
            }
            .tg-dropdown-item:hover         { background:rgba(255,89,52,0.08); color:#FF5934; }
            .tg-dropdown-item.tg-delete:hover{ background:#fef2f2; color:#dc2626; }

            /* ── Pagination ── */
            .tg-pagination { display:flex; justify-content:space-between; align-items:center; margin-top:16px; }
            .tg-page-controls {
                display:inline-flex; align-items:center; gap:4px; padding:6px;
                background:#fff; border-radius:14px;
                box-shadow:0 1px 2px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06);
                border:1px solid rgba(0,0,0,0.07);
            }
            .tg-page-btn {
                display:flex; align-items:center; justify-content:center;
                width:32px; height:32px; border-radius:9px; border:none; background:transparent;
                cursor:pointer; color:#5a5f6e; transition:background 0.15s, color 0.15s;
            }
            .tg-page-btn:hover:not(:disabled) { background:rgba(255,89,52,0.07); color:#FF5934; }
            .tg-page-btn:disabled { opacity:.35; cursor:not-allowed; }
            .tg-page-info { padding:0 10px; font-size:13.5px; font-weight:500; color:#5a5f6e; letter-spacing:-0.01em; }

            /* ── Modal overlay ── */
            .tg-modal-overlay {
                position:fixed; inset:0; z-index:50;
                background:rgba(0,0,0,0.45);
                display:flex; align-items:center; justify-content:center;
                padding:16px;
            }
            .tg-modal {
                background:#fff; border-radius:20px; width:100%; max-width:420px;
                box-shadow:0 24px 64px rgba(0,0,0,0.18);
                padding:28px;
                animation:tg-slide-in 0.2s ease;
            }
            @keyframes tg-slide-in {
                from { opacity:0; transform:translateY(12px) scale(0.98); }
                to   { opacity:1; transform:none; }
            }
            .tg-modal-title { font-size:18px; font-weight:600; color:#1a1a1a; margin:0 0 24px; }

            /* ── Form fields ── */
            .tg-field { margin-bottom:16px; }
            .tg-label { display:block; font-size:12px; font-weight:500; color:#6b7280; margin-bottom:6px; letter-spacing:0.02em; text-transform:uppercase; }
            .tg-input, .tg-select {
                width:100%; padding:11px 14px; border-radius:10px;
                border:1px solid rgba(0,0,0,0.10); background:#f9fafb;
                font-family:'DM Sans',sans-serif; font-size:14px; color:#1a1a1a;
                outline:none; box-sizing:border-box;
                transition:border-color 0.15s, background 0.15s;
                appearance:none; -webkit-appearance:none;
            }
            .tg-input:focus, .tg-select:focus { border-color:#FF5934; background:#fff; box-shadow:0 0 0 3px rgba(255,89,52,0.1); }
            .tg-select {
                background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
                background-repeat:no-repeat; background-position:right 12px center;
                background-color:#f9fafb; padding-right:32px;
            }
            .tg-select:focus { background-color:#fff; }

            /* ── Modal buttons ── */
            .tg-modal-actions { display:flex; gap:10px; margin-top:24px; }
            .tg-btn-cancel {
                flex:1; padding:11px; border-radius:10px; border:1px solid rgba(0,0,0,0.10);
                background:#f3f4f6; color:#374151; cursor:pointer;
                font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500;
                transition:background 0.15s;
            }
            .tg-btn-cancel:hover { background:#e5e7eb; }
            .tg-btn-submit {
                flex:1; padding:11px; border-radius:10px; border:none;
                background:linear-gradient(135deg,#FF5934 0%,#ff7a5a 100%);
                color:#fff; cursor:pointer;
                font-family:'DM Sans',sans-serif; font-size:14px; font-weight:500;
                box-shadow:0 2px 8px rgba(255,89,52,0.3);
                transition:background 0.15s, box-shadow 0.15s, transform 0.15s;
            }
            .tg-btn-submit:hover:not(:disabled) { background:linear-gradient(135deg,#e84e2b 0%,#ff6a47 100%); transform:translateY(-1px); }
            .tg-btn-submit:disabled { opacity:.5; cursor:not-allowed; }

            /* ── Skeleton ── */
            .tg-skeleton td { background:#f3f4f6; animation:shimmer 1.4s infinite linear; }
            @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.5} }
        `}</style>

        <div className="tg-wrap">
            {/* Top bar */}
            <div className="tg-topbar">
                <h1 className="tg-title">Target Management</h1>
                <button className="tg-add-btn" onClick={openAdd}>
                    <FaPlus size={12} />
                    Add Target
                </button>
            </div>

            {/* Table */}
            <table className="tg-table">
                <thead>
                    <tr>
                        <td>Salesperson</td>
                        <td>Target</td>
                        <td>Achieved</td>
                        <td>Progress</td>
                        <td>Month</td>
                        <td>Details</td>
                        <td>Actions</td>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        [1,2,3,4].map(i => (
                            <tr key={i} className="tg-skeleton">
                                <td style={{ borderRadius:'12px 0 0 12px', height:56 }}>&nbsp;</td>
                                <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                <td style={{ borderRadius:'0 12px 12px 0' }}>&nbsp;</td>
                            </tr>
                        ))
                    ) : targetData.length ? targetData.map((row) => (
                        <tr key={row.id}>
                            {/* Salesperson */}
                            <td>
                                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                    <img
                                        src={row.profilePicture || placeholder}
                                        alt={row.name}
                                        style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'1.5px solid rgba(0,0,0,0.08)' }}
                                    />
                                    <div>
                                        <div style={{ fontWeight:600, fontSize:14, color:'#1a1a1a' }}>{row.name}</div>
                                        <div style={{ fontSize:12, color:'#9ca3af' }}>{row.email}</div>
                                    </div>
                                </div>
                            </td>

                            {/* Target */}
                            <td>
                                <span style={{ fontWeight:600, fontSize:14, color:'#1a1a1a' }}>{formatNumber(row.target)}</span>
                                <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>cartons</div>
                            </td>

                            {/* Achieved */}
                            <td>
                                <span style={{ fontWeight:600, fontSize:14, color:'#1a1a1a' }}>{formatNumber(row.achieved)}</span>
                                <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>cartons</div>
                            </td>

                            {/* Progress */}
                            <td>
                                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    <span style={{
                                        display:'inline-flex', alignItems:'center',
                                        padding:'3px 8px', borderRadius:20,
                                        fontSize:12, fontWeight:600,
                                        color: pctColor(row.percentage),
                                        background: pctBg(row.percentage),
                                    }}>
                                        {row.percentage}%
                                    </span>
                                </div>
                                <div className="tg-bar-bg">
                                    <div
                                        className="tg-bar-fill"
                                        style={{
                                            width:`${Math.min(row.percentage, 100)}%`,
                                            background: pctColor(row.percentage),
                                        }}
                                    />
                                </div>
                            </td>

                            {/* Month */}
                            <td>
                                <span style={{
                                    display:'inline-flex', alignItems:'center',
                                    padding:'4px 10px', borderRadius:20,
                                    fontSize:12, fontWeight:500,
                                    background:'#f3f4f6', color:'#6b7280',
                                    border:'1px solid rgba(0,0,0,0.07)',
                                }}>
                                    {typeof row.month === 'string' ? row.month : MONTHS[row.month - 1]}
                                </span>
                            </td>

                            {/* Details */}
                            <td>
                                <Link to={`/target-history/${row.salespersonId}`} className="tg-action-btn" style={{ display:'inline-flex' }}>
                                    <FaRegEye size={15} />
                                </Link>
                            </td>

                            {/* Actions */}
                           <td>
    <div className="tg-actions">
        <button
            className="tg-action-btn"
            title="Edit"
            onClick={() => openEdit(row)}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
        </button>
        <div className="tg-action-divider" />
        <button
            className="tg-action-btn tg-action-delete"
            title="Delete"
            onClick={() => handleDelete(row.id)}
        >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
        </button>
    </div>
</td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="7" style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af', fontSize:14 }}>
                                No targets found for this month
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="tg-pagination">
                    <div className="tg-page-controls">
                        <button className="tg-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                            <GrFormPrevious size={16} />
                        </button>
                        <span className="tg-page-info">{currentPage} / {totalPages}</span>
                        <button className="tg-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                            <GrFormNext size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Add / Edit Modal */}
        {modalMode && (
            <div className="tg-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
                <div className="tg-modal">
                    <h2 className="tg-modal-title">{modalMode === 'add' ? 'Add Target' : 'Edit Target'}</h2>

                    <form onSubmit={handleSubmit}>
                        <div className="tg-field">
                            <label className="tg-label">Salesperson</label>
                            <select name="salesperson" value={formData.salesperson} onChange={e => handleInput(e, setFormData)} className="tg-select" required>
                                <option value="">Choose a salesperson…</option>
                                {salesPersons.map(p => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="tg-field">
                            <label className="tg-label">Month</label>
                            <select name="month" value={formData.month} onChange={e => handleInput(e, setFormData)} className="tg-select" required>
                                <option value="">Select month…</option>
                                {MONTHS.map((m, i) => (
                                    <option key={i} value={String(i + 1)}>{m}</option>
                                ))}
                            </select>
                        </div>

                        <div className="tg-field">
                            <label className="tg-label">Target (cartons)</label>
                            <input
                                type="number" name="target" value={formData.target} min="1"
                                onChange={e => handleInput(e, setFormData)}
                                placeholder="Enter target amount"
                                className="tg-input" required
                            />
                        </div>

                        <div className="tg-modal-actions">
                            <button type="button" className="tg-btn-cancel" onClick={closeModal} disabled={formLoading}>
                                Cancel
                            </button>
                            <button type="submit" className="tg-btn-submit" disabled={formLoading}>
                                {formLoading ? (modalMode === 'add' ? 'Saving…' : 'Updating…') : (modalMode === 'add' ? 'Save Target' : 'Update Target')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        </>
    );
};

export default Target;