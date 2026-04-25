import React from "react";
import { FaLocationDot } from "react-icons/fa6";
import { GrFormPrevious } from "react-icons/gr";
import { Link } from "react-router-dom";
import GoogleMapComponent from "../components/common/googleMap";

const Reports = () => {
  const [show, setShow] = React.useState(false);
  const attendanceData = [
    { date: "18/09/2025", distance: "12 km" },
    { date: "19/09/2025", distance: "12 km" },
    { date: "20/09/2025", distance: "13 km" },
    { date: "21/09/2025", distance: "10 km" },
    { date: "22/09/2025", distance: "11 km" },
    { date: "23/09/2025", distance: "10 km" },
    { date: "24/09/2025", distance: "09 km" },
    { date: "25/09/2025", distance: "08 km" },
    { date: "26/09/2025", distance: "09 km" },
    { date: "27/09/2025", distance: "10 km" }
  ];
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
            <h1 className='text-xl font-bold ml-3'>Reports</h1>
          </div>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left\ntext-left text-gray-500 '>
              <td>Date</td>
              <td>Total Distance</td>
              <td>Route History</td>
            </tr>
          </thead>
          <tbody className=''>
            {attendanceData.length ? attendanceData.map((data, index) => (
              <tr key={index} className='cursor-pointer'>
                <td className='p-2 bg-[#FFFFFF] font-medium'>{data.date}</td>
                <td className='p-2 bg-[#FFFFFF] font-medium'>{data.distance}</td>
                <td className='p-2 bg-[#FFFFFF] font-medium'>
                  <button  className='bg-[#FFD7CE] text-[#FF5934] p-2 md:text-base text-nowrap rounded font-bold flex items-center gap-2' onClick={() => setShow(true)}>
                    <FaLocationDot />
                    <span> View On Map</span>
                  </button>
                </td>
              </tr>
            )) : <p>No data found</p>}
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
                center={{ lat: 24.8607, lng: 67.0011 }}
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

export default Reports;