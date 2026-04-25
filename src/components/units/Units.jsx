import React, { useState, useEffect } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from 'react-icons/pi';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import { HiDotsVertical } from 'react-icons/hi';
import ClickOutside from '../../Hooks/ClickOutside';
import { getPaginatedUnits, searchUnits, createUnit, updateUnit, updateUnitStatus, deleteUnit } from '../../APIS'; // Adjust path as needed
import { Loader } from '../common/loader';

const Units = () => {
  // State for units data, modal, pagination, search, loading, and saving
  const [units, setUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [showDropdown, setShowDropdown] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false); // For fetching units
  const [isSaving, setIsSaving] = useState(false); // For add/update operations
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Token for API requests
  const token = localStorage.getItem('token');

  // Fetch units (either paginated or search results)
  useEffect(() => {
    const fetchUnits = async () => {
      setLoading(true);
      setError(null);
      try {
        let response;
        if (isSearching && searchQuery) {
          response = await searchUnits(searchQuery, page, limit, token);
        } else {
          response = await getPaginatedUnits(page, limit, token);
        }
        setUnits(response.data.data);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Error fetching units:', error);
        setError('Failed to fetch units. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUnits();
  }, [page, token, searchQuery, isSearching]);

  // Handler for search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setPage(1); // Reset to first page on search
    if (query.trim()) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  };

  // Handler for adding or editing a unit
  const handleSaveUnit = async () => {
    if (!unitName.trim()) {
      setError('Unit name is required.');
      return;
    }

    setIsSaving(true); // Show loader during save operation
    try {
      if (selectedUnit) {
        // Update existing unit
        const data = { name: unitName };
        console.log('Updating unit with ID:', selectedUnit._id, 'Data:', data);
        await updateUnit(selectedUnit._id, data, token);
      } else {
        // Add new unit
        const data = { name: unitName };
        console.log('Creating new unit with Data:', data);
        await createUnit(data, token);
      }

      // Refresh the unit list
      let response;
      if (isSearching && searchQuery) {
        response = await searchUnits(searchQuery, page, limit, token);
      } else {
        response = await getPaginatedUnits(page, limit, token);
      }
      setUnits(response.data.data);
      setTotalPages(response.data.totalPages);

      // Reset modal state
      setShowModal(false);
      setUnitName('');
      setSelectedUnit(null);
      setError(null);
    } catch (error) {
      console.error('Error saving unit:', error);
      setError(error.response?.data?.errors?.[0]?.msg || 'Error saving unit. Please try again.');
    } finally {
      setIsSaving(false); // Hide loader after save operation completes
    }
  };

  // Handler for editing a unit
  const handleEditUnit = (unit) => {
    setSelectedUnit(unit);
    setUnitName(unit.name);
    setShowModal(true);
    setShowDropdown(null);
    setError(null);
  };

  // Handler for toggling unit status (active/inactive)
  const handleToggleStatus = async (unit) => {
    try {
      const data = { isActive: !unit.isActive };
      console.log('Toggling status for unit ID:', unit._id, 'Data:', data);
      await updateUnitStatus(unit._id, data, token);

      // Refresh the unit list
      let response;
      if (isSearching && searchQuery) {
        response = await searchUnits(searchQuery, page, limit, token);
      } else {
        response = await getPaginatedUnits(page, limit, token);
      }
      setUnits(response.data.data);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error('Error updating unit status:', error);
      setError('Error updating unit status. Please try again.');
    }
  };

  // Handler for deleting a unit
  const handleDeleteUnit = async (id) => {
    if (window.confirm('Are you sure you want to delete this unit?')) {
      try {
        console.log('Deleting unit with ID:', id);
        await deleteUnit(id, token);

        // Refresh the unit list
        let response;
        if (isSearching && searchQuery) {
          response = await searchUnits(searchQuery, page, limit, token);
        } else {
          response = await getPaginatedUnits(page, limit, token);
        }
        setUnits(response.data.data);
        setTotalPages(response.data.totalPages);

        setShowDropdown(null);
      } catch (error) {
        console.error('Error deleting unit:', error);
        setError(error.response?.data?.errors?.[0]?.msg || 'Error deleting unit. Please try again.');
      }
    }
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="relative">
      {/* Error Feedback */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <span>{error}</span>
        </div>
      )}

      {/* Header, Search Bar, and Add Unit Button */}
      <div className="flex justify-between items-center mt-3">
        <h1 className="text-xl font-bold">Units</h1>
        <div className="flex gap-7">
          {/* Search Bar (now functional) */}
          <div className="flex bg-[#FFFFFF] rounded-xl px-1">
            <img src="/Search.svg" alt="search" className="" />
            <input
              className="p-2 outline-none rounded-xl"
              type="search"
              placeholder="Search by name"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          {/* Add Unit Button */}
          <button
            className="bg-[#FFD7CE] text-[#FF5934] font-bold p-2 rounded flex items-center"
            onClick={() => {
              setSelectedUnit(null);
              setUnitName('');
              setShowModal(true);
              setError(null);
            }}
          >
            <svg
              className="h-5 w-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Unit
          </button>
        </div>
      </div>

      {/* Unit Table */}
      <div className="mt-3">
        <table className="w-full border-separate border-spacing-y-4">
          <thead>
            <tr className="text-left text-gray-500">
              <td>ID</td>
              <td>Name</td>
              <td>Created Date</td>
              <td>Active</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {units.length > 0 ? (
              units.map((unit, index) => (
                <tr key={index} className="border-b cursor-pointer">
                  <td className="p-5 bg-[#FFFFFF] rounded-l-xl uppercase font-bold">
                    #{unit._id.slice(0, 6)}
                  </td>
                  <td className="p-4 bg-[#FFFFFF]">{unit.name}</td>
                  <td className="p-4 bg-[#FFFFFF]">{new Date(unit.createdAt).toLocaleDateString()}</td>
                  <td className="p-4 bg-[#FFFFFF] text-2xl">
                    <button onClick={() => handleToggleStatus(unit)}>
                      {unit.isActive ? (
                        <PiToggleRightFill className="text-green-500" />
                      ) : (
                        <PiToggleLeftFill className="text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="bg-[#FFFFFF] rounded-r-xl">
                    <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left">
                      <button
                        className="flex"
                        onClick={() => setShowDropdown(showDropdown === unit._id ? null : unit._id)}
                      >
                        <HiDotsVertical />
                      </button>

                      {showDropdown === unit._id && (
                        <ClickOutside onClick={() => setShowDropdown(null)}>
                          <div
                            className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
                            role="menu"
                            aria-orientation="vertical"
                            aria-labelledby="dropdownButton"
                          >
                            <div className="flex flex-col gap-2 justify-center items-start" role="none">
                              <li
                                className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2"
                                onClick={() => handleEditUnit(unit)}
                              >
                                Edit
                              </li>
                              <li
                                className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2"
                                onClick={() => handleDeleteUnit(unit._id)}
                              >
                                Delete
                              </li>
                            </div>
                          </div>
                        </ClickOutside>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-4 bg-[#FFFFFF] text-gray-500">
                  No Units found!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        className="pagination-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          maxWidth: '150px',
          margin: 0,
        }}
      >
        <button
          className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
          onClick={handlePreviousPage}
          disabled={page === 1}
        >
          <GrFormPrevious className="text-white" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>{page}</span> <span>/</span> <span>{totalPages}</span>
        </div>
        <button
          className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
          onClick={handleNextPage}
          disabled={page === totalPages}
        >
          <GrFormNext className="text-white" />
        </button>
      </div>

      {/* Modal Form for Add/Edit Unit with Loader */}
      {(showModal && isSaving) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <Loader /> {/* Show loader while saving */}
        </div>
      )}
      {showModal && !isSaving && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white w-[300px] max-h-[80vh] overflow-auto rounded-xl shadow-lg">
            {/* Header Section */}
            <div className="border-b border-gray-300 px-6 py-4">
              <h1 className="text-xl font-bold">{selectedUnit ? 'Edit Unit' : 'Add Unit'}</h1>
            </div>

            {/* Form Section */}
            <div className="px-6 py-4">
              <input
                type="text"
                placeholder="Unit Name"
                className="bg-[#EEF0F6] border border-gray-300 p-3 rounded-lg w-full mb-2"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
              />
              {error && (
                <div className="text-red-500 text-sm mt-1">{error}</div>
              )}
            </div>

            {/* Buttons Section */}
            <div className="flex justify-between gap-4 px-6 border-t border-gray-300 pt-4">
              <button
                type="button"
                className="bg-gray-200 flex justify-center items-center text-gray-700 p-4 w-full h-12 rounded-lg"
                onClick={() => {
                  setShowModal(false);
                  setUnitName('');
                  setSelectedUnit(null);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-[#FF5934] flex justify-center items-center text-white p-4 mb-4 w-full h-12 rounded-lg"
                onClick={handleSaveUnit}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Units;