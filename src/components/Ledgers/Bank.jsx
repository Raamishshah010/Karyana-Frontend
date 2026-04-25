import { useState, useEffect } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { AiOutlineDownload } from "react-icons/ai";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { MdEdit, MdDelete } from "react-icons/md";
import { useSelector } from "react-redux";
import { Loader } from "../common/loader";
import { Input } from "../common/input";
import { Select } from "../common/select";
import Ledger from './Ledger';
import {
    addBank,
    getAllCities,
    getAllBanks,
    updateBank,
    deleteBank,
    updateBankStatus,
    getTransactions,
    searchBanks,
    getTransactionsByDateRange
} from "../../APIS";
import hbl from '../../assets/HBL.jpg';
import ubl from '../../assets/UBL.png';
import mezan from '../../assets/Mezan.png';
import mcb from '../../assets/MCB.png';
import nbp from '../../assets/NBP.png';
import allied from '../../assets/allied.png';
import ReceiptModal from './ReceiptModal';
import { Link } from "react-router-dom";
import {
    MdSearch, MdFilterList, MdClose, MdArrowBack,
    MdAccountBalance, MdReceipt, MdAddCircleOutline,
} from "react-icons/md";

const LIMIT = 10;

/* ── Toolbar action button ── */
const ToolbarBtn = ({ onClick, children, icon: Icon }) => (
    <button
        onClick={onClick}
        className="flex items-center gap-1.5 bg-[#FFF4F2] hover:bg-[#FFE8E2] border border-[#FFD7CE] text-[#FF5934] text-[13px] font-semibold px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer"
    >
        {Icon && <Icon size={15} />}
        {children}
    </button>
);

const Bank = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);
    const [totalPages, setTotalPages] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);

    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [filterStatus, setFilterStatus] = useState('all');
    const token = useSelector((state) => state.admin.token);
    const [transactionData, setTransactionData] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [cities, setCities] = useState({ isLoaded: false, data: [] });
    const [state, setState] = useState({
        id: "", name: "", email: "", password: "", phone: "",
        address: "", image: "", cnic: "", city: ""
    });
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    /* ─── Fetch Banks ─── */
    useEffect(() => {
        const fetchBanks = async () => {
            try {
                setLoading(true);
                const response = await getAllBanks();
                const banksData = response.data.data;
                setBanks(banksData);
                setFilteredBanks(banksData);
            } catch (error) {
                console.error("Error Fetching Banks:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBanks();
    }, []);

    /* ─── Filter by status ─── */
    useEffect(() => {
        let filtered = banks;
        if (filterStatus === 'active') filtered = banks.filter(b => b.isActive);
        else if (filterStatus === 'inactive') filtered = banks.filter(b => !b.isActive);
        setFilteredBanks(filtered);
    }, [filterStatus, banks]);

    /* ─── Date-range filter ─── */
    const handleFilter = async () => {
        if (!selectedUser?._id) { toast.error('Please select a bank first'); return; }
        if (!startDate || !endDate) { toast.error('Please select both start and end dates'); return; }
        try {
            setLoading(true);
            const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
            const formattedEndDate = new Date(endDate).toISOString().split('T')[0];
            const bankId = selectedUser?.bankId || selectedUser?._id;
            const response = await getTransactionsByDateRange(bankId, formattedStartDate, formattedEndDate);
            if (response?.data) {
                const formatted = response.data.map((t) => ({
                    id: t.id || t._id,
                    sourceName: t.sourceName,
                    details: t.details || t.description,
                    dr: t.dr,
                    cr: t.cr,
                    date: t.date,
                    balance: t.balance.startsWith('PKR ') ? t.balance : `PKR ${Number(t.balance).toLocaleString()}`
                }));
                const sorted = formatted.sort((a, b) => new Date(b.date) - new Date(a.date));
                setTransactions(sorted);
                setTransactionData(sorted);
            } else {
                setTransactions([]);
                setTransactionData([]);
            }
        } catch (error) {
            toast.error(error?.response?.data?.msg || 'Failed to fetch filtered data');
            setTransactions([]);
            setTransactionData([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { setStartDate(''); setEndDate(''); }, []);

    /* ─── Search ─── */
    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (!value.trim()) { setFilteredBanks(banks); return; }
        const lc = value.toLowerCase().trim();
        setFilteredBanks(banks.filter(b =>
            b.bankName.toLowerCase().includes(lc) ||
            b.accountNumber.toLowerCase().includes(lc) ||
            b.accountTitle.toLowerCase().includes(lc)
        ));
    };

    const handleSearchKeyPress = (e) => { if (e.key === 'Enter') handleSearchChange(e); };

    /* ─── Cities ─── */
    useEffect(() => {
        if (!cities.isLoaded) {
            getAllCities().then(res => setCities({ isLoaded: true, data: res.data.data }))
                .catch(err => console.log("Loading cities: ", err.message));
        }
    }, [cities.isLoaded]);

    const clearForm = () => setState({ id: "", name: "", email: "", password: "", phone: "", address: "", image: "", cnic: "", city: "" });

    /* ─── Delete ─── */
    const deleteHandler = async (id) => {
        if (!window.confirm("Are you sure you want to delete this bank?")) return;
        try {
            setLoading(true);
            await deleteBank(id);
            toast.success("Bank deleted successfully!");
            const response = await getAllBanks();
            setBanks(response.data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to delete the bank!");
        } finally {
            setLoading(false);
        }
    };

    /* ─── Bank image ─── */
    const getBankImg = (bankName) => {
        if (bankName === "MCB Bank") return mcb;
        if (bankName === "United Bank Limited") return ubl;
        if (bankName === "Habib Bank Limited") return hbl;
        if (bankName === "National Bank of Pakistan") return nbp;
        if (bankName === "Allied Bank") return allied;
        return "/placeholder_bank.png";
    };

    const bankList = [
        { _id: 1, name: "National Bank of Pakistan", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzR6HWAnZt5wArCw073F33kR0VhVPlNmixvA&s" },
        { _id: 2, name: "Habib Bank Limited", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYSdvQxZgqpqGRRKGYs-AfAsyOmAKJqJhuiQ&s" },
        { _id: 3, name: "United Bank Limited", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeA5W9lazd9LYJmJUMHFZl7raZyvuIFCj0Yg&s" },
        { _id: 4, name: "MCB Bank", image: "https://seeklogo.com/images/M/mcb-bank-logo-34F6A134AD-seeklogo.com.png" },
        { _id: 5, name: "Allied Bank", image: "https://example.com/images/allied-bank.png" },
    ];

    const validationSchema = Yup.object().shape({
        bank: Yup.string().required("Bank is required"),
        accountTitle: Yup.string().required("Account Title is required"),
        accountNumber: Yup.string().required("Account Number is required"),
    });

    /* ─── Submit ─── */
    const handleSubmit = async (values, { resetForm }) => {
        try {
            setLoading(true);
            const selectedBank = bankList.find(b => String(b._id) === String(values.bank));
            if (!selectedBank) { toast.error("Please select a valid bank"); setLoading(false); return; }
            const bankData = { bankName: selectedBank.name, accountTitle: values.accountTitle, accountNumber: values.accountNumber };
            if (state?.id) { await updateBank(state.id, bankData); toast.success("Bank updated successfully!"); }
            else { await addBank(bankData); toast.success("Bank added successfully!"); }
            const response = await getAllBanks();
            setBanks(response.data.data);
            setShow(false); resetForm(); clearForm();
        } catch (error) {
            toast.error(error.response?.data?.msg || error.response?.data?.errors?.[0]?.msg || error.message || "Failed to save the bank!");
        } finally {
            setLoading(false);
        }
    };

    const editHandler = (item) => {
        setShow(true);
        setState({ id: item._id, bank: { _id: item.bankId, name: item.bankName }, accountTitle: item.accountTitle, accountNumber: item.accountNumber });
    };

    const addHandler = () => { clearForm(); setShow(true); };

    /* ─── Status toggle ─── */
    const statusToggleHandler = async (bank) => {
        try {
            setLoading(true);
            await updateBankStatus(bank._id, !bank.isActive);
            setBanks(prev => prev.map(b => b._id === bank._id ? { ...b, isActive: !b.isActive } : b));
            toast.success(`Bank ${!bank.isActive ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update bank status');
        } finally {
            setLoading(false);
        }
    };

    /* ─── Fetch transactions on bank select ─── */
    useEffect(() => {
        const fetchTransactions = async () => {
            if (!selectedUser?._id) return;
            try {
                setLoading(true);
                const response = await getTransactions(selectedUser._id);
                if (response?.data) { setTransactions(response.data); setTransactionData(response.data); }
            } catch (error) {
                toast.error('Failed to fetch transactions');
            } finally {
                setLoading(false);
            }
        };
        fetchTransactions();
    }, [selectedUser?._id]);

    const handleDownload = (transaction) => { setSelectedTransaction(transaction); setShowReceiptModal(true); };

    const inputCls = "bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] focus:ring-2 focus:ring-[#FF5934]/10 px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all placeholder:text-gray-300";

    if (loading) return <Loader />;

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
                .bk-page { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
                .bk-page .table-row { transition: background 0.15s, box-shadow 0.15s; }
                .bk-page .table-row:hover { background: #FFFAF9; box-shadow: 0 0 0 1px #FFD7CE inset; }
                .filter-select-bk {
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
                    background-repeat: no-repeat; background-position: right 10px center; padding-right: 28px;
                }
                @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
                @keyframes overlayIn { from { opacity:0; } to { opacity:1; } }
                .modal-overlay-bk { animation: overlayIn 0.2s ease; }
                .modal-card-bk    { animation: modalIn 0.25s cubic-bezier(0.34,1.2,0.64,1); }
                .no-scroll-bk::-webkit-scrollbar { display: none; }
                .no-scroll-bk { scrollbar-width: none; }
            `}</style>

            <div className="bk-page relative">
                <Ledger />

                {!selectedUser ? (
                    /* ══════════════════════════════════════════
                        BANK LIST VIEW
                    ══════════════════════════════════════════ */
                    <>
                        {/* Page Header */}
                        <div className="flex items-center justify-between mt-6 mb-5">
                            <div>
                                <h1 className="text-[22px] font-bold text-[#111827] tracking-tight">Bank</h1>
                                <p className="text-sm text-[#9CA3AF] mt-0.5">{filteredBanks.length} accounts found</p>
                            </div>
                            <button
                                onClick={addHandler}
                                className="flex items-center gap-2 bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-orange-100 transition-all duration-200"
                            >
                                <MdAddCircleOutline size={18} />
                                Add Bank
                            </button>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm mb-5">
                            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                                <MdSearch size={18} className="text-[#9CA3AF] flex-shrink-0" />
                                <input
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyPress={handleSearchKeyPress}
                                    className="bg-transparent outline-none text-sm text-[#111827] placeholder:text-[#9CA3AF] w-full"
                                    type="search"
                                    placeholder="Search by bank name, account no, or title…"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                                <MdFilterList size={16} className="text-[#9CA3AF]" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="filter-select-bk bg-transparent outline-none text-sm text-[#374151] min-w-[110px]"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-[#FAFAFA]">
                                        {["Bank Name", "Account No", "Account Title", "Recent Activity", "Balance", "Active", "Actions"].map(h => (
                                            <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-4 py-3">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredBanks.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-16 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                                        <MdAccountBalance size={24} className="text-gray-300" />
                                                    </div>
                                                    <p className="text-[#9CA3AF] text-sm font-medium">No banks found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredBanks.map((item) => (
                                        <tr key={item._id} className="table-row cursor-pointer">
                                            {/* Bank Name */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={getBankImg(item.bankName)}
                                                        alt={item.bankName}
                                                        className="w-9 h-9 rounded-full object-cover border border-gray-100 shadow-sm flex-shrink-0"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                    <p className="text-[13px] font-semibold text-[#111827] leading-tight">{item.bankName}</p>
                                                </div>
                                            </td>
                                            {/* Account No */}
                                            <td className="px-4 py-3">
                                                <span className="text-[12px] font-mono font-semibold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                                    {item.accountNumber}
                                                </span>
                                            </td>
                                            {/* Account Title */}
                                            <td className="px-4 py-3 text-[13px] text-[#374151]">{item.accountTitle}</td>
                                            {/* Recent Activity */}
                                            <td className="px-4 py-3 text-[12px] text-[#9CA3AF]">{new Date(item.createdAt).toLocaleDateString()}</td>
                                            {/* Balance */}
                                            <td className="px-4 py-3 text-[13px] font-semibold text-[#111827]">PKR {item.balance}</td>
                                            {/* Active */}
                                            <td className="px-4 py-3">
                                                <button className="flex items-center transition-opacity hover:opacity-80" onClick={() => statusToggleHandler(item)}>
                                                    {item.isActive
                                                        ? <PiToggleRightFill size={26} className="text-emerald-500" />
                                                        : <PiToggleLeftFill size={26} className="text-gray-300" />}
                                                </button>
                                            </td>
                                            {/* Actions */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setSelectedUser(item)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all duration-150"
                                                        title="View"
                                                    >
                                                        <FaRegEye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => editHandler(item)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-[#9CA3AF] hover:text-blue-500 border border-gray-100 transition-all duration-150"
                                                        title="Edit"
                                                    >
                                                        <MdEdit size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteHandler(item._id)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-red-50 text-[#9CA3AF] hover:text-red-500 border border-gray-100 transition-all duration-150"
                                                        title="Delete"
                                                    >
                                                        <MdDelete size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center mt-4">
                            <div className="flex items-center gap-1.5">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                                >
                                    <GrFormPrevious size={16} />
                                </button>
                                <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-[#374151]">
                                    <span className="font-semibold text-[#FF5934]">{currentPage}</span>
                                    <span className="text-gray-300">/</span>
                                    <span>{totalPages}</span>
                                </div>
                                <button
                                    disabled={totalPages <= currentPage}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                                >
                                    <GrFormNext size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ══════════════════════════════════════════
                        TRANSACTION DETAIL VIEW
                    ══════════════════════════════════════════ */
                    <div className="w-full">
                        {/* Detail Header */}
                        <div className="flex items-center gap-3 mt-6 mb-5">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[#374151] hover:bg-[#FF5934] hover:text-white hover:border-[#FF5934] transition-all duration-150 shadow-sm"
                            >
                                <MdArrowBack size={18} />
                            </button>
                            <div>
                                <h2 className="text-[20px] font-bold text-[#111827] tracking-tight">
                                    {selectedUser.bankName}
                                </h2>
                                <p className="text-sm text-[#9CA3AF] mt-0.5">
                                    Balance: <span className="font-bold text-[#FF5934]">PKR {selectedUser.balance}</span>
                                </p>
                            </div>
                        </div>

                        {/* Transaction Card */}
                        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden mb-4">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-gray-100">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {/* Date Filter */}
                                    <div className="flex items-center gap-2 bg-[#F9FAFB] border border-gray-200 rounded-xl px-3 py-2">
                                        <input
                                            type="date"
                                            className="bg-transparent outline-none text-sm text-[#374151]"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                        <span className="text-[#9CA3AF] text-xs">to</span>
                                        <input
                                            type="date"
                                            className="bg-transparent outline-none text-sm text-[#374151]"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            min={startDate}
                                            max={new Date().toISOString().split('T')[0]}
                                        />
                                        <button
                                            onClick={handleFilter}
                                            disabled={!startDate || !endDate}
                                            className="ml-1 bg-[#FF5934] text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-[#e84d2a] transition-colors"
                                        >
                                            Filter
                                        </button>
                                    </div>

                                    {/* Report Button */}
                                    <Link
                                        to="/reportpdf"
                                        state={{ selectedUser, transactionData, startDate, endDate, type: 'bank' }}
                                    >
                                        <ToolbarBtn icon={MdReceipt}>Report</ToolbarBtn>
                                    </Link>
                                </div>
                            </div>

                            {/* Transactions Table */}
                            <div className="overflow-x-auto p-4">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-[#FAFAFA] border-b border-gray-100">
                                            {["ID", "Source", "Details", "Dr.", "Cr.", "Date", "Account Balance", "Action"].map(h => (
                                                <th key={h} className="text-left text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest px-3 py-3">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {transactionData.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-[#9CA3AF] text-sm">No transactions found</td>
                                            </tr>
                                        ) : transactionData.map((transaction) => {
                                            const date = new Date(transaction.date);
                                            const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                                            return (
                                                <tr key={transaction.id} className="table-row">
                                                    <td className="px-3 py-3">
                                                        <span className="text-[11px] font-mono font-bold text-[#6B7280] bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                                            #{typeof transaction.id === 'string'
                                                                ? transaction.id.replace('#', '').slice(0, 6).toUpperCase()
                                                                : transaction.id.toString().slice(0, 6).toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 text-[13px] text-[#374151]">{transaction.sourceName}</td>
                                                    <td className="px-3 py-3 text-[13px] text-[#374151] max-w-[160px] truncate">{transaction.details}</td>
                                                    <td className="px-3 py-3">
                                                        {transaction.dr && transaction.dr !== '0'
                                                            ? <span className="text-[13px] font-semibold text-emerald-600">PKR {transaction.dr}</span>
                                                            : <span className="text-[#9CA3AF]">—</span>}
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        {transaction.cr && transaction.cr !== '0'
                                                            ? <span className="text-[13px] font-semibold text-red-500">PKR {transaction.cr}</span>
                                                            : <span className="text-[#9CA3AF]">—</span>}
                                                    </td>
                                                    <td className="px-3 py-3 text-[12px] text-[#6B7280]">{formattedDate}</td>
                                                    <td className="px-3 py-3 text-[13px] font-semibold text-[#111827]">{transaction.balance}</td>
                                                    <td className="px-3 py-3">
                                                        <button
                                                            onClick={() => handleDownload(transaction)}
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-orange-50 text-[#9CA3AF] hover:text-[#FF5934] border border-gray-100 transition-all"
                                                            title="Download receipt"
                                                        >
                                                            <AiOutlineDownload size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════
                    ADD / EDIT BANK MODAL
                ══════════════════════════════════════════ */}
                {show && (
                    <div className="modal-overlay-bk fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 px-4">
                        <div className="modal-card-bk bg-white w-full max-w-[420px] max-h-[94vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-[#FF5934] to-[#ff8c6b] px-6 pt-5 pb-10 relative overflow-hidden flex-shrink-0">
                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                                <div className="relative flex items-start justify-between">
                                    <div>
                                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">{state?.id ? 'Editing' : 'New Account'}</p>
                                        <h2 className="text-white text-xl font-bold">{state?.id ? 'Edit Bank' : 'Add Bank'}</h2>
                                    </div>
                                    <button
                                        onClick={() => setShow(false)}
                                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                                    >
                                        <MdClose size={16} />
                                    </button>
                                </div>
                            </div>

                            <Formik
                                enableReinitialize
                                initialValues={{
                                    bank: state?.bank?._id || "",
                                    accountTitle: state?.accountTitle || "",
                                    accountNumber: state?.accountNumber || "",
                                }}
                                validationSchema={validationSchema}
                                onSubmit={handleSubmit}
                            >
                                {({ values, handleChange, errors, touched }) => (
                                    <Form className="no-scroll-bk overflow-y-auto flex-1 flex flex-col">
                                        <div className="px-6 py-5 flex flex-col gap-4">
                                            {/* Bank Select */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Bank</label>
                                                <Select
                                                    name="bank"
                                                    label=""
                                                    data={bankList}
                                                    searchKey="_id"
                                                    searchValue="name"
                                                    value={values.bank}
                                                    className={`bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all ${errors.bank && touched.bank ? 'border-red-400' : ''}`}
                                                    disabled={!!state.id}
                                                />
                                                {errors.bank && touched.bank && <p className="text-red-500 text-[11px] mt-1">{errors.bank}</p>}
                                            </div>

                                            {/* Account Title */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Account Title</label>
                                                <Input
                                                    name="accountTitle"
                                                    placeholder="Account Title"
                                                    label=""
                                                    value={values.accountTitle}
                                                    onChange={handleChange}
                                                    className={`bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all ${errors.accountTitle && touched.accountTitle ? 'border-red-400' : ''}`}
                                                />
                                                {errors.accountTitle && touched.accountTitle && <p className="text-red-500 text-[11px] mt-1">{errors.accountTitle}</p>}
                                            </div>

                                            {/* Account Number */}
                                            <div>
                                                <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Account Number</label>
                                                <Input
                                                    name="accountNumber"
                                                    placeholder="Account Number"
                                                    label=""
                                                    value={values.accountNumber}
                                                    onChange={handleChange}
                                                    className={`bg-[#F9FAFB] border border-gray-200 focus:border-[#FF5934] px-3 py-2.5 rounded-xl w-full outline-none text-sm text-[#111827] transition-all ${errors.accountNumber && touched.accountNumber ? 'border-red-400' : ''}`}
                                                />
                                                {errors.accountNumber && touched.accountNumber && <p className="text-red-500 text-[11px] mt-1">{errors.accountNumber}</p>}
                                            </div>
                                        </div>

                                        {/* Footer Buttons */}
                                        <div className="px-6 pb-6 pt-2 border-t border-gray-100 flex gap-3 bg-[#FAFAFA] rounded-b-3xl mt-auto">
                                            <button
                                                type="button"
                                                onClick={() => setShow(false)}
                                                className="flex-1 h-11 rounded-xl border border-gray-200 bg-white text-[#374151] text-sm font-semibold hover:bg-gray-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 h-11 rounded-xl bg-[#FF5934] hover:bg-[#e84d2a] text-white text-sm font-bold shadow-lg shadow-orange-100 transition-all"
                                            >
                                                {state?.id ? 'Save Changes' : 'Add Bank'}
                                            </button>
                                        </div>
                                    </Form>
                                )}
                            </Formik>
                        </div>
                    </div>
                )}

                {/* Receipt Modal */}
                {showReceiptModal && selectedTransaction && (
                    <ReceiptModal
                        transaction={selectedTransaction}
                        onClose={() => setShowReceiptModal(false)}
                    />
                )}
            </div>
        </>
    );
};

export default Bank;