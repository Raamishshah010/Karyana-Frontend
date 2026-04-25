/* eslint-disable react/prop-types */
import { useState } from 'react';

const DateRangePicker = ({ submitHandler, sd, ed }) => {
  const [startDate, setStartDate] = useState(sd ?? '');
  const [endDate, setEndDate] = useState(ed ?? '');

  const handleSubmit = () => {
    if (startDate && endDate) {
      submitHandler(startDate, endDate);
    } else {
      alert('Please select both start and end dates.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div>
        <input
          type="date"
          id="startDate"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="outline-none rounded-xl p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <label>to</label>
      <div>
        <input
          type="date"
          id="endDate"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="outline-none  rounded-xl p-2 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={handleSubmit}
        className="px-4 py-2 rounded-lg  bg-[#FFD7CE] text-[#FF5934] transition-colors duration-200"
      >
        Filter
      </button>
    </div>
  );
};

export default DateRangePicker;
