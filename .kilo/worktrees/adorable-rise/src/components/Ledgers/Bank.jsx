import { useState, useEffect } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import { AiOutlineDownload } from "react-icons/ai";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import { HiDotsVertical } from "react-icons/hi";
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { AiOutlineCheckCircle, AiOutlineCloseCircle } from "react-icons/ai";
import { useSelector } from "react-redux";
import ClickOutside from "../../Hooks/ClickOutside";
import { Loader } from "../common/loader";
import { Input } from "../common/input";
import { Select } from "../common/select";
import Ledger from './Ledger';
import { checkAuthError, USER_STATUSES } from '../../utils';
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
import placeholder from '../../../public/placeholder.png';
import hbl from '../../assets/HBL.jpg'
import ubl from '../../assets/UBL.png'
import mezan from '../../assets/Mezan.png'
import mcb from '../../assets/MCB.png'
import nbp from '../../assets/NBP.png'
import allied from '../../assets/allied.png'
import ReceiptModal from './ReceiptModal'; // Import the ReceiptModal
import { Link } from "react-router-dom";

const LIMIT = 10;

const Bank = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [show, setShow] = useState(false);
    const [data, setData] = useState([]);
    const [totalPages, setTotalPages] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState("");
    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [filterStatus, setFilterStatus] = useState('all');
    const token = useSelector((state) => state.admin.token);
    const [transactionData, setTransactionData] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [cities, setCities] = useState({
        isLoaded: false,
        data: [],
    });
    const [state, setState] = useState({
        id: "",
        name: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        image: "",
        cnic: "",
        city: ""
    });
    const [showReceiptModal, setShowReceiptModal] = useState(false); // New state for receipt modal
    const [selectedTransaction, setSelectedTransaction] = useState(null); // State for the selected transaction

    // Fetch all banks initially
    useEffect(() => {
        const fetchBanks = async () => {
            try {
                setLoading(true);
                const response = await getAllBanks();
                const banksData = response.data.data;

                setBanks(banksData);
                setFilteredBanks(banksData);
                setLoading(false);
            } catch (error) {
                console.error("Error Fetching Banks:", error);
                setLoading(false);
            }
        };

        fetchBanks();
    }, []);

    // Filter banks based on status
    useEffect(() => {
        let filtered = banks;
        switch (filterStatus) {
            case 'active':
                filtered = filtered.filter(bank => bank.isActive);
                break;
            case 'inactive':
                filtered = filtered.filter(bank => !bank.isActive);
                break;
        }
        setFilteredBanks(filtered);
    }, [filterStatus, banks]);

    const handleFilter = async () => {
        if (!selectedUser?._id) {
            toast.error('Please select a bank first');
            return;
        }

        if (!startDate || !endDate) {
            toast.error('Please select both start and end dates');
            return;
        }

        try {
            setLoading(true);

            const formattedStartDate = new Date(startDate).toISOString().split('T')[0];
            const formattedEndDate = new Date(endDate).toISOString().split('T')[0];

            const bankId = selectedUser?.bankId || selectedUser?._id;

            const response = await getTransactionsByDateRange(
                bankId,
                formattedStartDate,
                formattedEndDate
            );

            console.log('Response Data:', response);

            if (response?.data) {
                const formattedTransactions = response.data.map((transaction) => ({
                    id: transaction.id || transaction._id,
                    sourceName: transaction.sourceName,
                    details: transaction.details || transaction.description,
                    dr: transaction.dr, // Use the dr value directly from the API
                    cr: transaction.cr, // Use the cr value directly from the API
                    date: transaction.date,
                    balance: transaction.balance.startsWith('PKR ')
                        ? transaction.balance
                        : `PKR ${Number(transaction.balance).toLocaleString()}`
                }));

                const sortedTransactions = formattedTransactions.sort((a, b) =>
                    new Date(b.date) - new Date(a.date)
                );

                setTransactions(sortedTransactions);
                setTransactionData(sortedTransactions);
            } else {
                setTransactions([]);
                setTransactionData([]);
            }
        } catch (error) {
            console.error('Error fetching filtered data:', error);
            toast.error(error?.response?.data?.msg || 'Failed to fetch filtered data');
            setTransactions([]);
            setTransactionData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStartDateChange = (e) => {
        const date = e.target.value;
        setStartDate(date);
    };

    const handleEndDateChange = (e) => {
        const date = e.target.value;
        setEndDate(date);
    };

    useEffect(() => {
        setStartDate('');
        setEndDate('');
    }, []);

    const handleSearch = async () => {
        try {
            setLoading(true);

            if (!searchTerm.trim()) {
                setFilteredBanks(banks);
                setLoading(false);
                return;
            }

            const lowercaseSearchTerm = searchTerm.toLowerCase().trim();
            const searchResults = banks.filter(bank =>
                bank.bankName.toLowerCase().includes(lowercaseSearchTerm) ||
                bank.accountNumber.toLowerCase().includes(lowercaseSearchTerm) ||
                bank.accountTitle.toLowerCase().includes(lowercaseSearchTerm)
            );

            setFilteredBanks(searchResults);
        } catch (error) {
            console.error("Search error:", error);
            toast.error("Failed to search banks");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (!value.trim()) {
            setFilteredBanks(banks);
            return;
        }

        const lowercaseSearchTerm = value.toLowerCase().trim();
        const searchResults = banks.filter(bank =>
            bank.bankName.toLowerCase().includes(lowercaseSearchTerm) ||
            bank.accountNumber.toLowerCase().includes(lowercaseSearchTerm) ||
            bank.accountTitle.toLowerCase().includes(lowercaseSearchTerm)
        );

        setFilteredBanks(searchResults);
    };

    const handleFilterChange = (e) => {
        const status = e.target.value;
        setFilterStatus(status);
    };

    useEffect(() => {
        if (!cities.isLoaded) {
            getAllCities().then(res => {
                setCities({
                    isLoaded: true,
                    data: res.data.data,
                });
            }).catch(err => {
                console.log("Loading cities: ", err.message);
            });
        }
    }, [cities.isLoaded]);

    const clearForm = () => {
        setState({
            id: "",
            name: "",
            email: "",
            password: "",
            phone: "",
            address: "",
            image: "",
            cnic: "",
            city: ""
        });
    };

    const deleteHandler = async (id) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this bank?");
        if (!confirmDelete) return;

        try {
            setLoading(true);

            await deleteBank(id);
            toast.success("Bank deleted successfully!");

            const response = await getAllBanks();
            setBanks(response.data.data);
        } catch (error) {
            console.error("Error deleting bank:", error);
            toast.error(
                error.response?.data?.message ||
                error.message ||
                "Failed to delete the bank!"
            );
        } finally {
            setLoading(false);
        }
    };

    const getBankImg = (bankName) => {
        if (bankName === "MCB Bank") {
            return mcb;
        } else if (bankName === "United Bank Limited") {
            return ubl;
        } else if (bankName === "Habib Bank Limited") {
            return hbl;
        } else if (bankName === "National Bank of Pakistan") {
            return nbp;
        } else if (bankName === "Allied Bank") {
            return allied;
        } else {
            // Fallback to public placeholder when a specific bank image is not available
            return "/placeholder_bank.png";
        }
    };

    const bankList = [
        {
            _id: 1,
            name: "National Bank of Pakistan",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQzR6HWAnZt5wArCw073F33kR0VhVPlNmixvA&s",
        },
        {
            _id: 2,
            name: "Habib Bank Limited",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYSdvQxZgqpqGRRKGYs-AfAsyOmAKJqJhuiQ&s",
        },
        {
            _id: 3,
            name: "United Bank Limited",
            image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeA5W9lazd9LYJmJUMHFZl7raZyvuIFCj0Yg&s",
        },
        {
            _id: 4,
            name: "MCB Bank",
            image: "https://seeklogo.com/images/M/mcb-bank-logo-34F6A134AD-seeklogo.com.png",
        },
        {
            _id: 5,
            name: "Allied Bank",
            image: "https://example.com/images/allied-bank.png",
        },
    ];

    const validationSchema = Yup.object().shape({
        bank: Yup.string().required("Bank is required"),
        accountTitle: Yup.string().required("Account Title is required"),
        accountNumber: Yup.string().required("Account Number is required"),
    });

    const handleSubmit = async (values, { resetForm }) => {
        try {
            setLoading(true);
            const selectedBank = bankList.find(
                (b) => String(b._id) === String(values.bank)
            );

            if (!selectedBank) {
                toast.error("Please select a valid bank");
                setLoading(false);
                return;
            }
            const bankData = {
                bankName: selectedBank.name,
                accountTitle: values.accountTitle,
                accountNumber: values.accountNumber,
            };

            if (state?.id) {
                await updateBank(state.id, bankData);
                toast.success("Bank updated successfully!");
            } else {
                await addBank(bankData);
                toast.success("Bank added successfully!");
            }

            const response = await getAllBanks();
            setBanks(response.data.data);

            setShow(false);
            resetForm();
            clearForm();
        } catch (error) {
            console.error("Bank submission error:", error);
            toast.error(
                error.response?.data?.msg ||
                error.response?.data?.errors?.[0]?.msg ||
                error.message ||
                "Failed to save the bank!"
            );
        } finally {
            setLoading(false);
        }
    };

    const editHandler = (item) => {
        setShow(true);
        setState({
            id: item._id,
            bank: {
                _id: item.bankId,
                name: item.bankName,
            },
            accountTitle: item.accountTitle,
            accountNumber: item.accountNumber,
        });
    };

    const addHandler = async () => {
        clearForm();
        setShow(true);
    };

    const statusToggleHandler = async (bank) => {
        try {
            setLoading(true);
            await updateBankStatus(bank._id, !bank.isActive);
            setBanks(prevBanks =>
                prevBanks.map(b =>
                    b._id === bank._id ? { ...b, isActive: !b.isActive } : b
                )
            );

            toast.success(`Bank ${!bank.isActive ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
            console.error("Error updating bank status:", error);

            if (error.response) {
                toast.error(
                    error.response.data.message ||
                    `Failed to update bank status. Server responded with ${error.response.status}`
                );
            } else if (error.request) {
                toast.error("No response received from server. Please check your network connection.");
            } else {
                toast.error("Error setting up the request. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchBanks = async () => {
            try {
                setLoading(true);
                const response = await getAllBanks();

                const banksData = response.data.data;

                if (Array.isArray(banksData) && banksData.length > 0) {
                    setBanks(banksData);
                } else {
                    console.error('No banks found in response', response);
                    setBanks([]);
                }

                setLoading(false);
            } catch (error) {
                console.error("Detailed Error Fetching Banks:", {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                });
                setLoading(false);
                setBanks([]);
            }
        };

        fetchBanks();
    }, []);

    useEffect(() => {
        const fetchTransactions = async () => {
            if (!selectedUser?._id) return;

            try {
                setLoading(true);
                const response = await getTransactions(selectedUser._id);

                if (response?.data) {
                    setTransactions(response.data);
                    setTransactionData(response.data);
                }
            } catch (error) {
                console.error("Error fetching transactions:", error);
                toast.error('Failed to fetch transactions');
            } finally {
                setLoading(false);
            }
        };

        fetchTransactions();
    }, [selectedUser?._id]);

    const handleDownload = (transaction) => {
        setSelectedTransaction(transaction);
        setShowReceiptModal(true);
    };

    if (loading) return <Loader />;
    return (
        <div className="relative">
            <Ledger />
            <div className='flex justify-between items-center mt-3'>
                {!selectedUser && (
                    <h1 className='text-xl text-nowrap font-bold'>Bank</h1>
                )}

                <div className='flex gap-7'>
                    {!selectedUser && (
                        <>
                            <div className='flex bg-[#FFFFFF] rounded-xl ml-10 px-1'>
                                <img src="/Search.svg" alt="search" className='' />
                                <input
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyPress={handleSearchKeyPress}
                                    className='p-2 outline-none rounded-xl'
                                    type="search"
                                    name="search"
                                    placeholder='Search by name'
                                />
                            </div>
                            <select
                                value={filterStatus}
                                onChange={handleFilterChange}
                                className='bg-[#FFFFFF] rounded-lg p-1'
                            >
                                <option value="all">View All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <button className='bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded' onClick={addHandler}>+ Add Bank</button>
                        </>
                    )}
                </div>
            </div>

            <div className='mt-3'>
                {!selectedUser ? (
                    <table className='w-full border-separate border-spacing-y-4'>
                        <thead>
                            <tr className='text-left text-gray-500'>
                                <td>Bank Name</td>
                                <td>Account no</td>
                                <td>Account Title</td>
                                <td>Recent Activity</td>
                                <td>Balance</td>
                                <td>Active</td>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredBanks.map((item) => (
                                <tr key={item._id} className="border-b">
                                    <td className="flex items-center gap-2 p-2 bg-[#FFFFFF] rounded-l-xl">
                                        <img
                                            src={getBankImg(item.bankName)}
                                            alt={item.name}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <span className="font-bold">{item.bankName}</span>
                                    </td>
                                    <td className="p-2 bg-[#FFFFFF]">{item.accountNumber}</td>
                                    <td className="p-2 bg-[#FFFFFF]">{item.accountTitle}</td>
                                    <td className="p-2 bg-[#FFFFFF]">{new Date(item.createdAt).toLocaleDateString()}</td>
                                    <td className="p-2 bg-[#FFFFFF]">PKR {item.balance}</td>
                                    <td
                                        className="p-2 bg-[#FFFFFF] cursor-pointer"
                                        onClick={() => statusToggleHandler(item)}
                                    >
                                        {item.isActive ? (
                                            <PiToggleRightFill size={25} className="text-green-500" />
                                        ) : (
                                            <PiToggleLeftFill size={25} className="text-gray-400" />
                                        )}
                                    </td>
                                    <td className='bg-[#FFFFFF] rounded-r-xl'>
                                        <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                                            <div className='flex gap-5 cursor-pointer'>
                                                <FaRegEye onClick={() => setSelectedUser(item)} />
                                                <button className='flex'
                                                    onClick={() => setShowDropdown(prev => prev === item._id ? "" : item._id)}
                                                >
                                                    <HiDotsVertical />
                                                </button>
                                            </div>
                                            {showDropdown === item._id && (
                                                <ClickOutside onClick={() => setShowDropdown('')}>
                                                    <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                                                        role="menu"
                                                        aria-orientation="vertical"
                                                        aria-labelledby="dropdownButton">
                                                        <div className='flex flex-col gap-2 justify-center items-start' role="none">
                                                            <li onClick={() => {
                                                                editHandler(item);
                                                                setShowDropdown("");
                                                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                                                                <button className="btn btn-light">Edit</button>
                                                            </li>
                                                            <li onClick={() => {
                                                                deleteHandler(item._id);
                                                                setShowDropdown("");
                                                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                                                                <button className="btn btn-light">Delete</button>
                                                            </li>
                                                        </div>
                                                    </div>
                                                </ClickOutside>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="w-full p-4">
                        <div className="flex items-center mb-6">
                            <button
                                className="text-[#FF5934] mr-4 bg-gray-200 p-1 rounded-lg "
                                onClick={() => setSelectedUser(null)}
                            >
                                <GrFormPrevious size={24} />
                            </button>

                            <h2 className="text-xl font-bold">Transaction Details</h2>
                        </div>

                        <div className="flex items-center justify-end gap-4 mb-2 ml-5">
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="bg-[#FFFFFF] p-2 rounded-lg"
                                    value={startDate}
                                    onChange={handleStartDateChange}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    className="bg-[#FFFFFF] p-2 rounded-lg"
                                    value={endDate}
                                    onChange={handleEndDateChange}
                                    min={startDate}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                                <button
                                    className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg w-[100px]"
                                    onClick={handleFilter}
                                    disabled={!startDate || !endDate}
                                >
                                    Filter
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <Link
                                    to="/reportpdf"
                                    state={{
                                        selectedUser,
                                        transactionData,
                                        startDate,
                                        endDate,
                                        type: 'bank'
                                    }}
                                >
                                    <button className="bg-[#FFD7CE] text-[#FF5934] px-4 py-2 rounded-lg w-[100px]">
                                        Report
                                    </button>
                                </Link>
                            </div>
                        </div>

                        <table className="w-full border-separate border-spacing-y-4">
                            <thead>
                                <tr className="text-left text-gray-500">
                                    <th>ID</th>
                                    <th>Source</th>
                                    <th>Details</th>
                                    <th>Dr.</th>
                                    <th>Cr.</th>
                                    <th>Date</th>
                                    <th>Account Balance</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactionData.map((transaction) => {
                                    const date = new Date(transaction.date);
                                    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;

                                    return (
                                        <tr key={transaction.id} className="border-b">
                                            <td className="p-2 bg-[#FFFFFF] rounded-l-xl font-bold">
                                                #{typeof transaction.id === 'string' ?
                                                    transaction.id.replace('#', '').slice(0, 6).toUpperCase() :
                                                    transaction.id.toString().slice(0, 6).toUpperCase()}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF]">
                                                {transaction.sourceName}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF]">
                                                {transaction.details}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF] text-green-500 font-medium">
                                                {transaction.dr && transaction.dr !== '0' ? `PKR ${transaction.dr}` : '-'}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF] text-red-500 font-medium">
                                                {transaction.cr && transaction.cr !== '0' ? `PKR ${transaction.cr}` : "-"}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF]">{formattedDate}</td>
                                            <td className="p-2 bg-[#FFFFFF] font-medium">
                                                {transaction.balance}
                                            </td>
                                            <td className="p-2 bg-[#FFFFFF] rounded-r-xl">
                                                <button
                                                    onClick={() => handleDownload(transaction)}
                                                    className="flex justify-center items-center bg-gray-200 text-[#FF5934] p-2 rounded-lg text-lg font-bold hover:bg-gray-300 transition duration-200"
                                                    aria-label="Download transaction details"
                                                >
                                                    <AiOutlineDownload size={24} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {transactionData.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="p-4 bg-[#FFFFFF] rounded-xl text-center text-gray-500">
                                            No transactions found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div
                className="pagination-container"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    maxWidth: "150px",
                    margin: 0,
                }}
            >
                <button
                    className="flex items-center bg-[#FF5934] text-white mt-4 p-2 rounded-lg "
                    disabled={currentPage === 1}
                    onClick={() => {
                        setCurrentPage((p) => p - 1);
                    }}
                >
                    <GrFormPrevious className='text-white' />
                </button>
                <div
                    style={{ display: "flex", alignItems: "center", gap: "5px" }}
                >
                    <span className='mt-4'> {currentPage}</span> <span className='mt-4'>/</span>
                    <span className='mt-4'> {totalPages}</span>
                </div>
                <button
                    className="flex items-center mt-4 bg-[#FF5934] text-white p-2 rounded-lg "
                    onClick={() => {
                        setCurrentPage((p) => p + 1);
                    }}
                    disabled={totalPages <= currentPage}
                >
                    <GrFormNext className='text-white' />
                </button>
            </div>

            {/* Add Bank Modal */}
            {show && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg">
                        <div className="border-b border-gray-300 px-4 py-3">
                            <h2 className="text-xl font-bold">{state?.id ? "Edit Bank" : "Add Bank"}</h2>
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
                            {({ values, handleChange, setFieldValue }) => (
                                <Form className="overflow-x-hidden overflow-y-auto scrollbar-hide">
                                    <div className="px-6">
                                        <Select
                                            name="bank"
                                            label="Bank"
                                            data={bankList}
                                            searchKey="_id"
                                            searchValue="name"
                                            value={values.bank}
                                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                                            disabled={!!state.id}
                                        />

                                        <Input
                                            name="accountTitle"
                                            placeholder="Account Title"
                                            label="Account Title"
                                            value={values.accountTitle}
                                            onChange={handleChange}
                                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                                        />
                                        <Input
                                            name="accountNumber"
                                            placeholder="Account Number"
                                            label="Account Number"
                                            value={values.accountNumber}
                                            onChange={handleChange}
                                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300"
                                        />
                                    </div>
                                    <div className="flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6">
                                        <div
                                            onClick={() => setShow(false)}
                                            className="bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer"
                                        >
                                            Cancel
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg"
                                        >
                                            Save
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
    );
};

export default Bank;