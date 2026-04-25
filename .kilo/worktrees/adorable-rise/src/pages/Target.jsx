import React, { useState, useEffect } from "react";
import { GrFormPrevious, GrFormNext } from "react-icons/gr";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { getDatas, getAllTargets, getAllSalesPersons, createTarget, updateTarget, deleteTarget } from "../APIS";
import { FaPlus, FaInfoCircle, FaRegEye } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { toast } from 'react-toastify';
import { Loader } from "../components/common/loader";
import ClickOutside from '../Hooks/ClickOutside';
import placeholder from '../assets/placehold.jpg';

const Target = () => {
    const [targetData, setTargetData] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [selectedDays, setSelectedDays] = useState("30");
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isAddTargetModalVisible, setIsAddTargetModalVisible] = useState(false);
    const [isEditTargetModalVisible, setIsEditTargetModalVisible] = useState(false);
    const [showDropdown, setShowDropdown] = useState("");
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const salesId = searchParams.get('salesId');
    const LIMIT = 10;

    // Form state for Add Target modal
    const [formData, setFormData] = useState({
        salesperson: '',
        month: '',
        target: ''
    });
    
    // Form state for Edit Target modal
    const [editFormData, setEditFormData] = useState({
        id: '',
        salesperson: '',
        month: '',
        target: ''
    });
    const [formLoading, setFormLoading] = useState(false);

    // Function to format numbers
    const formatNumber = (amount) => {
        if (!amount && amount !== 0) return 0;
        return Number(amount).toLocaleString();
    };

    // Function to get percentage color
    const getPercentageColor = (percentage) => {
        if (percentage >= 80) return "text-green-600";
        if (percentage >= 60) return "text-yellow-600";
        return "text-red-600";
    };

    // Function to fetch targets data
    const fetchTargets = async () => {
        setLoading(true);
        try {
            const response = await getAllTargets();
            const targets = response.data.data || [];
            
            console.log("Raw targets from API:", targets);
            
            // Create a map of targets by salesperson for easy lookup
            const targetMap = {};
            targets.forEach(target => {
                console.log("Processing target:", target);
                const key = target.salesperson?._id || target.salesperson;
                if (!targetMap[key]) {
                    targetMap[key] = [];
                }
                targetMap[key].push(target);
            });

            // Get current month and year for filtering
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            // Convert month name to month number for comparison
            const getMonthNumber = (monthName) => {
                const months = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];
                return months.indexOf(monthName) + 1;
            };

            // Process targets to show current month data
            const processedTargets = targets
                .filter(target => {
                    const targetMonth = typeof target.month === 'string' 
                        ? getMonthNumber(target.month) 
                        : target.month;
                    return targetMonth === currentMonth;
                })
                .map(target => ({
                    id: target._id,
                    name: target.salesperson?.name || 'Unknown',
                    email: target.salesperson?.email || '',
                    phone: target.salesperson?.phone || '',
                    city: target.salesperson?.city?.name || 'N/A',
                    profilePicture: target.salesperson?.image,
                    target: target.target || 0,
                    achieved: target.achieved || 0,
                    percentage: target.target > 0 ? Math.round((target.achieved / target.target) * 100) : 0,
                    month: target.month,
                    salespersonId: target.salesperson?._id || target.salesperson
                }));

            console.log("Processed targets:", processedTargets);
            setTargetData(processedTargets);
        } catch (error) {
            console.error("Error fetching targets:", error);
            toast.error("Failed to fetch targets data");
        } finally {
            setLoading(false);
        }
    };

    // Function to fetch sales persons for dropdown
    const fetchSalesPersons = async () => {
        try {
            const res = await getAllSalesPersons();
            setSalesPersons(res.data.data || []);
        } catch (error) {
            console.error("Error fetching sales persons:", error);
            toast.error("Failed to fetch sales persons");
        }
    };

    useEffect(() => {
        fetchTargets();
        fetchSalesPersons();
    }, [currentPage, selectedDays]);

    // Handle days selection change
    const handleDaysChange = (e) => {
        setSelectedDays(e.target.value);
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle edit form input changes
    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Convert month number to month name
    const getMonthName = (monthNumber) => {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        return months[parseInt(monthNumber) - 1];
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.salesperson || !formData.month || !formData.target) {
            toast.error("Please fill in all required fields");
            return;
        }

        setFormLoading(true);
        try {
            const token = localStorage.getItem('token'); // Assuming token is stored in localStorage
            
            const targetData = {
                salesperson: formData.salesperson,
                month: getMonthName(formData.month),
                target: parseFloat(formData.target)
            };

            await createTarget(targetData, token);
            toast.success("Target created successfully!");
            
            // Reset form and close modal
            setFormData({
                salesperson: '',
                month: '',
                target: ''
            });
            setIsAddTargetModalVisible(false);
            
            // Refresh targets data
            fetchTargets();
        } catch (error) {
            console.error("Error creating target:", error);
            toast.error(error.response?.data?.errors || error.response?.data?.message || "Failed to create target");
        } finally {
            setFormLoading(false);
        }
    };

    // Handle modal close
    const handleCloseModal = () => {
        setFormData({
            salesperson: '',
            month: '',
            year: new Date().getFullYear(),
            target: ''
        });
        setIsAddTargetModalVisible(false);
    };

    // Handle edit target
    const handleEditTarget = (target) => {
        // Convert month name to month number for the select dropdown
        const getMonthNumber = (monthName) => {
            const months = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ];
            return months.indexOf(monthName) + 1;
        };

        // Populate edit form with existing target data
        setEditFormData({
            id: target.id,
            salesperson: target.salespersonId || target.salesperson?._id || target.salesperson,
            month: typeof target.month === 'string' ? getMonthNumber(target.month) : target.month,
            target: target.target
        });
        
        setIsEditTargetModalVisible(true);
    };

    // Handle edit form submission
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        
        if (!editFormData.salesperson || !editFormData.month || !editFormData.target) {
            toast.error("Please fill in all required fields");
            return;
        }

        setFormLoading(true);
        try {
            const token = localStorage.getItem('token');
            
            const targetData = {
                salesperson: editFormData.salesperson,
                month: getMonthName(editFormData.month),
                target: parseFloat(editFormData.target)
            };

            await updateTarget(editFormData.id, targetData, token);
            toast.success("Target updated successfully!");
            
            // Reset form and close modal
            setEditFormData({
                id: '',
                salesperson: '',
                month: '',
                target: ''
            });
            setIsEditTargetModalVisible(false);
            
            // Refresh the data
            fetchTargets();
        } catch (error) {
            console.error("Error updating target:", error);
            toast.error(error.response?.data?.message || "Failed to update target");
        } finally {
            setFormLoading(false);
        }
    };

    // Handle delete target
    const handleDeleteTarget = async (targetId) => {
        if (!window.confirm("Are you sure you want to delete this target?")) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await deleteTarget(targetId, token);
            toast.success("Target deleted successfully!");
            fetchTargets(); // Refresh the data
        } catch (error) {
            console.error("Error deleting target:", error);
            toast.error(error.response?.data?.message || "Failed to delete target");
        }
    };

    return (
        <div className='relative'>
            <div className='flex justify-between items-center mt-3'>
                <div>
                    <h1 className='text-xl font-bold ml-2 mb-2'>Target Management</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAddTargetModalVisible(true)}
                        className="flex items-center gap-2 px-3 py-1 font-semibold text-white bg-[#FF5934] rounded-md hover:bg-[#e04d2d]"
                    >
                        <FaPlus />
                        Add Target
                    </button>
                    {/* <select
                        className="bg-[#FFFFFF] rounded-lg p-1"
                        value={selectedDays}
                        onChange={handleDaysChange}
                    >
                        <option value="30">30 Days</option>
                        <option value="60">60 Days</option>
                        <option value="90">90 Days</option>
                        <option value="365">1 Year</option>
                    </select> */}
                </div>
            </div>
            <div className='mt-3'>
                <table className='w-full border-separate border-spacing-y-4'>
                    <thead>
                        <tr className='text-left text-gray-500'>
                            <td>Salesperson</td>
                            <td>Target</td>
                            <td>Achieved</td>
                            <td>Percentage</td>
                            <td>Month</td>
                            <td>Details</td>
                            <td>Actions</td>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="text-center p-4"><Loader /></td>
                            </tr>
                        ) : targetData.length ? targetData.map((data, index) => {
                            const monthNames = ["", "January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December"];
                            return (
                                <tr key={data.id || index} className='cursor-pointer'>
                                    <td className='p-2 bg-[#FFFFFF] font-medium flex items-center gap-2'>
                                        <img 
                                            src={data.profilePicture || placeholder} 
                                            alt={data.name}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <div>
                                            <div className="font-medium">{data.name}</div>
                                            <div className="text-sm text-gray-500">{data.email}</div>
                                        </div>
                                    </td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>{formatNumber(data.target)}</td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>{formatNumber(data.achieved)}</td>
                                    <td className={`p-2 bg-[#FFFFFF] font-medium ${getPercentageColor(data.percentage)}`}>
                                        {data.percentage}%
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                            <div
                                                className="bg-[#FF5934] h-2 rounded-full"
                                                style={{ width: `${Math.min(Number(data.percentage) || 0, 100)}%` }}
                                            ></div>
                                        </div>
                                    </td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>
                                        {typeof data.month === 'string' ? data.month : monthNames[data.month]}
                                    </td>
                                    <td className='p-2 bg-[#FFFFFF] font-medium'>
                                        <Link to={`/target-history/${data.salespersonId}`}>
                                            <FaRegEye size={20} className="text-[#FF6B35]" />
                                        </Link>
                                    </td>
                                    <td className='bg-[#FFFFFF] rounded-r-xl'>
                                        <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                                            <div className='flex gap-5'>
                                                <button className='flex'
                                                    onClick={() => setShowDropdown(prev => prev === data.id ? "" : data.id)}
                                                >
                                                    <HiDotsVertical />
                                                </button>
                                            </div>

                                            {showDropdown === data.id && (
                                                <ClickOutside onClick={() => setShowDropdown('')}>
                                                    <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                                                        role="menu"
                                                        aria-orientation="vertical"
                                                        aria-labelledby="dropdownButton">
                                                        <div className="flex flex-col gap-2 justify-center items-start" role="none">
                                                            <li onClick={() => {
                                                                handleEditTarget(data);
                                                                setShowDropdown("");
                                                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                                                                <button className="btn btn-light">Edit</button>
                                                            </li>
                                                            <li onClick={() => {
                                                                handleDeleteTarget(data.id);
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
                            );
                        }) : (
                            <tr>
                                <td colSpan="6" className="text-center p-4">
                                    No target data found
                                </td>
                            </tr>
                        )}
                     </tbody>
                 </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center mt-6 gap-4">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                    >
                        <GrFormPrevious size={20} />
                        Previous
                    </button>
                    
                    <span className="text-gray-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                    >
                        Next
                        <GrFormNext size={20} />
                    </button>
                </div>
            )}

            {/* Add Target Modal */}
            {isAddTargetModalVisible && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-96 max-w-md mx-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Target</h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Salesperson Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Salesperson
                                </label>
                                <select 
                                    name="salesperson"
                                    value={formData.salesperson}
                                    onChange={handleInputChange}
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                >
                                    <option value="">Choose a salesperson...</option>
                                    {salesPersons.map((person) => (
                                        <option key={person._id} value={person._id}>
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Month Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Month
                                </label>
                                <select 
                                    name="month"
                                    value={formData.month}
                                    onChange={handleInputChange}
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select month...</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                            </div>

                            {/* Target */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Target (in cartons)
                                </label>
                                <input
                                    type="number"
                                    name="target"
                                    value={formData.target}
                                    onChange={handleInputChange}
                                    placeholder="Enter target per ctn"
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                    min="1"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                    disabled={formLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a2b] transition-colors disabled:bg-gray-400"
                                    disabled={formLoading}
                                >
                                    {formLoading ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Target Modal */}
            {isEditTargetModalVisible && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-lg p-6 w-96 max-w-md mx-4">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Edit Target</h2>
                        
                        <form onSubmit={handleEditSubmit} className="space-y-4">
                            {/* Salesperson Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Select Salesperson
                                </label>
                                <select 
                                    name="salesperson"
                                    value={editFormData.salesperson}
                                    onChange={handleEditInputChange}
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                >
                                    <option value="">Choose a salesperson...</option>
                                    {salesPersons.map((person) => (
                                        <option key={person._id} value={person._id}>
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Month Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Month
                                </label>
                                <select 
                                    name="month"
                                    value={editFormData.month}
                                    onChange={handleEditInputChange}
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select month...</option>
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                            </div>

                            {/* Target */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Target (in cartons)
                                </label>
                                <input
                                    type="number"
                                    name="target"
                                    value={editFormData.target}
                                    onChange={handleEditInputChange}
                                    placeholder="Enter target per ctn"
                                    className="w-full bg-[#EEF0F6] rounded-lg p-3 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF6B35] focus:border-transparent"
                                    required
                                    min="1"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditTargetModalVisible(false)}
                                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                    disabled={formLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a2b] transition-colors disabled:bg-gray-400"
                                    disabled={formLoading}
                                >
                                    {formLoading ? "Updating..." : "Update"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
     );
};

export default Target;
