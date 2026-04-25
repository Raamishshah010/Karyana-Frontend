import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTargetHistoryBySalespersonId } from '../APIS'; 
import { Loader } from '../components/common/loader';
import placeholder from '../assets/placehold.jpg';
import { GrFormPrevious } from "react-icons/gr";


const TargetHistory = () => {
    const { salesId } = useParams();
    const [targetHistory, setTargetHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Helpers to match Target.jsx UI
    const formatNumber = (amount) => {
        if (!amount && amount !== 0) return 0;
        return Number(amount).toLocaleString();
    };

    const getPercentageColor = (percentage) => {
        if (percentage >= 80) return "text-green-600";
        if (percentage >= 60) return "text-yellow-600";
        return "text-red-600";
    };

    // Local dummy data fallback
    const localDummyData = [
        {
            name: "Local Dummy Salesperson",
            email: "dummy.salesperson@gmail.com",
            profilePicture: "",
            month: "January",
            target: 100,
            achieved: 80,
            percentage: 80,
        },
        {
            name: "Local Dummy Salesperson",
            email: "dummy.salesperson@gmail.com",
            profilePicture: "",
            month: "February",
            target: 120,
            achieved: 130,
            percentage: 108,
        },
        {
            name: "Local Dummy Salesperson",
            email: "dummy.salesperson@gmail.com",
            profilePicture: "",
            month: "March",
            target: 150,
            achieved: 100,
            percentage: 66,
        },
    ];

    useEffect(() => {
        console.log('TargetHistory: salesId from useParams', salesId); // Debug log
        const fetchTargetHistory = async () => {
            if (!salesId) {
                setError('Salesperson ID not provided.');
                setLoading(false);
                console.log('TargetHistory: Salesperson ID not provided.'); // Debug log
                return;
            }
            try {
                setLoading(true);
                const response = await getTargetHistoryBySalespersonId(salesId);
                const payload = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                console.log('TargetHistory: API payload', payload); // Debug log
                setTargetHistory(payload);
            } catch (err) {
                setError('An error occurred while fetching target history.');
                console.error('TargetHistory: Error fetching target history:', err); // Debug log
            } finally {
                setLoading(false);
            }
        };

        fetchTargetHistory();
    }, [salesId]);

    // Skip loader for now to ensure table renders

    if (error) {
        return <div className="text-center text-red-500 mt-10">Error: {error}</div>;
    }

    console.log('TargetHistory: targetHistory content', targetHistory); // Debug log

    // Display only real API data now
    const displayData = targetHistory;

    const monthNames = ["", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

    return (
        <div className='relative'>
            <div className='flex justify-between items-center mt-3'>
                <div className='flex items-center gap-2'>
                    <Link to='/target' aria-label='Back to Target'>
                        <GrFormPrevious size={24} className='text-gray-700 hover:text-gray-900' />
                    </Link>
                    <h1 className='text-xl font-bold ml-2 mb-2'>Target History</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to={`/target-history/report?salesId=${salesId}`}
                        className="flex items-center gap-2 px-3 py-1 font-semibold text-white bg-[#FF5934] rounded-md hover:bg-[#e04d2d]"
                        aria-label="Open Target History Report"
                    >
                        Report
                    </Link>
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
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="text-center p-4"><Loader /></td>
                            </tr>
                        ) : displayData.length ? displayData.map((data, index) => (
                            <tr key={index} className='cursor-pointer'>
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
                                </td>
                                <td className='p-2 bg-[#FFFFFF] font-medium'>
                                    {typeof data.month === 'string' ? data.month : monthNames[data.month]}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="text-center p-4">
                                    No target history found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TargetHistory;