import { useEffect, useState } from 'react';
import User from './User';
import { PiToggleLeftFill } from "react-icons/pi";
import { PiToggleRightFill } from "react-icons/pi";
import { createSaleUser, deleteSaleUser, getAllCities, getDatas, getSalesPersons, updateSaleUser, updateSaleUserStatus, uploadFile } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Textarea } from '../common/textArea';
import { FaRegEye } from "react-icons/fa6";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { Spinner } from '../common/spinner';
import ClickOutside from '../../Hooks/ClickOutside';
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';
import placeholder from '../../assets/placehold.jpg'
import AreaSelector from '../common/AreaSelector';

const Sales = () => {
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState('');
  const [sales, setSales] = useState([]);
  const token = useSelector((state) => state.admin.token);
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [activeTab, setActiveTab] = useState('ledger');
  const [isFormVisible, setFormVisible] = useState(false);
  const [isAreaSelectorVisible, setAreaSelectorVisible] = useState(false);
  const [newSalesPerson, setNewSalesPerson] = useState({
    id: "",
    salesId: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    image: "",
    cnic: "",
    city: "",
    target: "",
    billingAddress: "",
    cityTab: "",
    province: "",
    postalCode: "",
    country: "",
    ntn: "",
    stn: "",
    assignedArea: [],
    basicSalary: "",
    allowanceDistance: "",
    dailyAllowance: "",
    miscellaneousAllowance: "",
    checkInTime: "",
    checkOutTime: "",
  });

  const [selectedUser, setSelectedUser] = useState(null);
  // Remember last plain passwords set in this session for each user
  const [lastPasswords, setLastPasswords] = useState({});

  const validations = yup.object().shape({
    salesId: yup.string()
      .required("Sales ID is required")
      .matches(/^[A-Za-z0-9]+$/, "Sales ID can only contain letters and numbers"),
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    password: yup
      .string()
      .min(6, "Password must be at least 6 characters")
      .when('id', {
        is: (id) => !id || id.length === 0,
        then: (schema) => schema.required("Password is required"),
        otherwise: (schema) => schema.notRequired().nullable(),
      }),
    address: yup.string(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "Phone number is not valid e.g +923333333333"),
    billingAddress: yup.string(),
    cityTab: yup.string(),
    province: yup.string(),
    postalCode: yup.string(),
    country: yup.string(),
    ntn: yup.string(),
    stn: yup.string(),
    basicSalary: yup.number().min(0, "Basic salary must be a positive number"),
    allowanceDistance: yup.number().min(0, "Allowance distance must be a positive number"),
    dailyAllowance: yup.number().min(0, "Daily allowance must be a positive number"),
    miscellaneousAllowance: yup.number().min(0, "Miscellaneous allowance must be a positive number"),
    checkInTime: yup.string().test('time-format', 'Invalid time format (HH:MM)', (v) => !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v)),
    checkOutTime: yup.string().test('time-format', 'Invalid time format (HH:MM)', (v) => !v || /^([01]\d|2[0-3]):([0-5]\d)$/.test(v)),
  });

  useEffect(() => {
    setLoading(true);
    const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setSales(res.data.data);
      setLoading(false);
      setTotalPages(res.data.totalPages);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      })
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);

  // Centralized refresh that honors current filters/search/page
  const refreshWithFilters = async (page = currentPage) => {
    try {
      setLoading(true);
      const link = `/sale-user/search?page=${page}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      const res = await getDatas(link);
      setSales(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const changeHandler = (key, value, setFieldValue) => {
    setFieldValue(key, value);
    setNewSalesPerson((p) => ({
      ...p,
      [key]: value,
    }));
  };

  const handleSubmit = async (values, { setSubmitting, validateForm, setErrors }) => {
    try {
      
      // Validate the form
      const errors = await validateForm(values);
      
      // If there are CNIC validation errors, switch to Tax Info tab
      if (errors && errors.cnic) {
        setActiveTab("taxInfo");
        toast.error("CNIC format is invalid. Please check the Tax Info tab.");
        setSubmitting(false);
        return;
      }
      setLoading(true);
      const payload = {
        ...values,
        image: newSalesPerson.image,
        cityTab: values.cityTab,
        assignedArea: newSalesPerson.assignedArea,
      };
      if (newSalesPerson.id.length) {
        await updateSaleUser(payload, token);
        // If password was provided, store it for future edit prefill in this session
        if (values.password && values.password.trim().length) {
          setLastPasswords(prev => ({ ...prev, [newSalesPerson.id]: values.password.trim() }));
        }
      } else {
        await createSaleUser(payload, token);
      }
      // Refresh list with active filters so table doesn't revert to all users
      await refreshWithFilters();
      setLoading(false);
      setFormVisible(false);
      resetForm();
    } catch (error) {
      setLoading(false);
      checkAuthError(error);
      if (error.response?.data?.message?.includes('Sales ID')) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.response?.data?.errors[0]?.msg);
      }
    }
  };

  const handleRowClick = (user) => {
    setSelectedUser(user);
  };

  const fileUploadHandler = async (files) => {
    if (!files[0]) return;
    try {
      setImageLoading(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      const url = res.data.data;
      setNewSalesPerson((p) => ({
        ...p,
        image: url,
      }));
      setImageLoading(false);
    } catch (error) {
      setImageLoading(false);
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const updateDataHandler = async (check, name, item) => {
    try {
      setLoading(true);
      await updateSaleUserStatus(
        {
          ...item,
          id: item._id,
          [name]: check
        },
        token
      );
      await refreshWithFilters();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure to delete?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteSaleUser(id, token);
      await refreshWithFilters();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setNewSalesPerson({
      id: "",
      salesId: "",
      name: "",
      email: "",
      password: "",
      phone: "",
      address: "",
      image: "",
      cnic: "",
      city: "",
      target: "",
      billingAddress: "",
      cityTab: "",
      province: "",
      postalCode: "",
      country: "",
      ntn: "",
      stn: "",
      assignedArea: [],
      basicSalary: "",
      allowanceDistance: "",
      dailyAllowance: "",
      miscellaneousAllowance: "",
      checkInTime: "",
      checkOutTime: "",
    });
  };

  const addHandler = async () => {
    resetForm();
    setFormVisible(true);
  };

  const citySelectHandler = async (e) => {
    if (e.target.value?.length) {
      setSelectedCityId(e.target.value);
    } else {
      setSelectedCityId("");
      setCurrentPage(1);
    }
  };

  const statusSelectHandler = async (e) => {
    if (e.target.value?.length) {
      setSelectedMaritalStatus(e.target.value === USER_STATUSES[0]);
    } else {
      setSelectedMaritalStatus("");
      setCurrentPage(1);
    }
  };

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setSearchTerm(e.target.value);
      const link = `/sale-user/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => {
        setSales(res.data.data);
        setLoading(false);
        setTotalPages(res.data.totalPages);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    }
  };

  const refreshData = () => {
    setSearchTerm("");
    const link = `/sale-user/search?page=${1}&limit=${limit}&searchTerm=&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setSales(res.data.data);
      setTotalPages(res.data.totalPages);
    })
      .catch((err) => {
        toast.error(err.message);
      })
  }

  const editHandler = async (item) => {
    setNewSalesPerson({
      id: item._id,
      salesId: item.salesId || '',
      name: item.name,
      email: item.email,
      // Prefill with the last password set in this session if available
      password: lastPasswords[item._id] || "",
      phone: item.phone,
      address: item.address,
      image: item.image,
      cnic: item.cnic,
      city: item.city?._id,
      target: item.target || "",
      billingAddress: item.billingAddress || "",
      cityTab: item.cityTab || "",
      province: item.province || "",
      postalCode: item.postalCode || "",
      country: item.country || "",
      ntn: item.ntn || "",
      stn: item.stn || "",
      assignedArea: item.assignedArea || [],
      basicSalary: item.basicSalary || "",
      allowanceDistance: item.allowanceDistance || "",
      dailyAllowance: item.dailyAllowance || "",
      miscellaneousAllowance: item.miscellaneousAllowance || "",
      checkInTime: item.checkInTime || "",
      checkOutTime: item.checkOutTime || "",
    });
    setFormVisible(true);
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

  if (loading) return <Loader />

  return (
    <div className='relative'>
      <User />
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl font-bold'>All Sales Person</h1>
        <div className='flex gap-7'>
          <div className='flex bg-[#FFFFFF] rounded-xl ml-10 px-1'>
            <img src="/Search.svg" alt="search" className='' />
            <input
              onChange={e => {
                if (e.target.value.length) {
                  setSearchTerm(e.target.value)
                } else {
                  refreshData()
                }
              }}
              onKeyPress={searchHandler}
              value={searchTerm}
              className='p-2 outline-none rounded-xl'
              type="search"
              name="search"
              id=""
              placeholder='Search by name'
            />
          </div>
          <select value={selectedCityId} onChange={citySelectHandler} className='bg-[#FFFFFF] rounded-lg p-1'>
            <option value="">Select Location</option>
            <option value="">View All</option>
            {cities.data.map((city) => (
              <option value={city._id} key={city._id}>{city.name}</option>
            ))}
          </select>
          <select value={
            selectedMaritalStatus === '' ? ' '
              : selectedMaritalStatus ? USER_STATUSES[0] : USER_STATUSES[1]}
            onChange={statusSelectHandler}
            className='bg-[#FFFFFF] rounded-lg p-1'>
            <option value="">Status</option>
            <option value="">View All</option>
            {USER_STATUSES.map((status) => (
              <option value={status} key={status}>{status}</option>
            ))}
          </select>
          <button className='bg-[#FFD7CE] text-[#FF5934] p-2 md:text-base text-nowrap rounded font-bold' onClick={addHandler}>+ Add Sales person</button>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left\ntext-left text-gray-500 '>
              <td>Name</td>
              <td>Sales ID</td>
              <td>Phone no</td>
              <td>CNIC</td>
              <td>Earning</td>
              <td>Active</td>
              <td>Admin Verified</td>
              <td></td>
            </tr>
          </thead>
          <tbody className=''>
            {sales.length ? sales.map((data, index) => (
              <tr key={index} className='cursor-pointer'>
                <td className='flex items-center gap-2 p-2 rounded-l-lg bg-[#FFFFFF]'>
                  <img src={data.image || placeholder} alt="" className='w-8 h-8 rounded-full' />
                  <div>
                    <h1 className='font-bold'>{data.name}</h1>
                    <h3 className='text-sm text-gray-400'>{data.email}</h3>
                  </div>
                </td>
                <td className='p-2 bg-[#FFFFFF] font-medium'>{data.salesId || 'N/A'}</td>
                <td className='p-2 bg-[#FFFFFF]'>{data.phone}</td>
                <td className='p-2 bg-[#FFFFFF]'>{data.cnic}</td>
                <td className='p-2 bg-[#FFFFFF]'>{0}</td>
                <td className='p-2 text-2xl cursor-pointer bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!data.isActive, "isActive", data)}>
                  {data.isActive ? (
                    <PiToggleRightFill className='text-green-500' />
                  ) : (
                    <PiToggleLeftFill className='text-gray-400' />
                  )}
                </td>
                <td className='p-2 text-2xl bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!data.isAdminVerified, "isAdminVerified", data)}>
                  {data.isAdminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}
                </td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>
                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl border inline-block text-left dropdown">
                    <div className='flex gap-5'>
                      <FaRegEye onClick={() => handleRowClick(data)} />
                      <button className='flex'
                      >
                        <HiDotsVertical onClick={() => setShowDropdown(prev => prev === data._id ? "" : data._id)} />
                      </button>
                    </div>

                    {showDropdown === data._id && (
                      <ClickOutside onClick={() => setShowDropdown('')}>
                        <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                          role="menu"
                          aria-orientation="vertical"
                          aria-labelledby="dropdownButton">
                          <div className="flex flex-col gap-2 justify-center items-start" role="none">
                            <li onClick={() => {
                              editHandler(data);
                              setShowDropdown("");
                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                              <button className="btn btn-light">Edit</button>
                            </li>
                            <li onClick={() => {
                              deleteHandler(data._id);
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
            )) : <p>No data found</p>}
          </tbody>
        </table>
      </div>
      <div
        className="pagination-container mt-3"
        style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "space-between", margin: 0 }}
      >
        <div className='flex items-center gap-2'>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <GrFormPrevious className='text-white' />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span>{currentPage}</span> <span>/</span>
            <span>{totalPages}</span>
          </div>
          <button
            className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <GrFormNext className='text-white' />
          </button>
        </div>

        <div className='flex items-center gap-2'>
          <span className='text-sm text-gray-500'>Show:</span>
          <select 
            value={limit} 
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCurrentPage(1);
            }} 
            className='bg-[#FFFFFF] rounded-lg p-1 border text-sm outline-none'
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      {isFormVisible && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[600px] max-h-[90vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Sales Person</h2>
            </div>
            <Formik
              initialValues={newSalesPerson}
              validationSchema={validations}
              onSubmit={handleSubmit}
              validateOnChange={false}
              validateOnBlur={true}
            >
              {({ values, setFieldValue, errors, touched, handleSubmit }) => (
                <Form className='overflow-x-hidden overflow-y-auto scrollbar-hide'>
                  <h6 className='font-semibold p-6 mb-2'>Profile Image</h6>
                  <div className='px-6'>
                    <div className='relative h-[200px] flex border border-gray-300 border-dotted flex-col justify-center items-center p-4 rounded-lg mb-4'>
                      {newSalesPerson.image ? (
                        <img
                          src={newSalesPerson.image}
                          alt='Preview'
                          className='w-20 h-20 rounded-full cursor-pointer object-cover mb-4'
                        />
                      ) : (
                        <img
                          src="/Avatar.svg"
                          alt='Default Avatar'
                          className='w-20 h-20 mt-2 rounded-full cursor-pointer object-cover mb-4'
                        />
                      )}

                      {imageLoading ?
                        <Spinner />
                        : (
                          <>
                            <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height='100%' />
                          </>
                        )}
                    </div>

                    <Input
                      name="name"
                      label="Name"
                      placeholder="Name"
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                    <Input
                      name="salesId"
                      label="Sales ID"
                      placeholder="Enter unique Sales ID"
                      // disabled={!!newSalesPerson.id} // Disable editing for existing users
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                    <Input
                      name="email"
                      type="email"
                      disabled={newSalesPerson.id.length}
                      placeholder="Email"
                      label="Email"
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mt-3 mb-1">Password</label>
                    <Input
                      name="password"
                      id="password"
                      type="text"
                      placeholder={newSalesPerson.id ? "Enter new password or leave empty to keep current" : "Password"}
                      label={newSalesPerson.id ? "Password (Leave empty to keep current)" : "Password"}
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                    <Input
                      name="phone"
                      placeholder="phone"
                      label="Phone"
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />
                    <Select
                      name="city"
                      label="City"
                      data={cities.data}
                      searchKey="_id"
                      searchValue="name"
                      value={newSalesPerson.city}
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                    {/* <Input
                      name="target"
                      placeholder="Target"
                      label="Target"
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    /> */}

                    <Textarea
                      name="address"
                      placeholder="Address"
                      label="Address"
                      changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                    {['address', 'taxInfo', 'areaAssignment', 'salaryInfo', 'timeslot'].map((tab) => {
                      const isActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`px-4 py-2 ${isActive ? 'bg-[#FF5934] text-white' : 'text-gray-600'} rounded-t-lg mt-4`}
                        >
                          {tab === 'areaAssignment' ? 'Area Assignment' : 
                           tab === 'salaryInfo' ? 'Salary Info' :
                           tab === 'timeslot' ? 'Timeslot' : 
                           tab.charAt(0).toUpperCase() + tab.slice(1).replace('Info', ' Info')}
                        </button>
                      );
                    })}

                    <div className="px-1">
                      {activeTab === 'address' && (
                        <>
                          <Input
                            name="billingAddress"
                            label="Billing Address"
                            placeholder="Billing Address"
                            value={values.billingAddress || ''}
                            changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                            className="bg-[#EEF0F6] p-3 mt-2 rounded w-[517px] border border-gray-300"
                          />
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="cityTab"
                              label="City"
                              placeholder="City"
                              value={values.cityTab || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="province"
                              label="Province"
                              placeholder="Province"
                              value={values.province || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="postalCode"
                              label="Postal Code"
                              placeholder="Postal Code"
                              value={values.postalCode || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="country"
                              label="Country"
                              placeholder="Country"
                              value={values.country || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {activeTab === 'taxInfo' && (
                        <>
                          <div className="flex space-x-4 mt-2">
                            <Input
                              name="ntn"
                              label="NTN"
                              placeholder="NTN"
                              value={values.ntn || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[250px] border border-gray-300"
                            />
                            <Input
                              name="stn"
                              label="STN"
                              placeholder="STN"
                              value={values.stn || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[252px] border border-gray-300"
                            />
                          </div>
                          <div className="mt-2">
                            <Input
                              name="cnic"
                              label="CNIC"
                              placeholder="CNIC (format: xxxxx-xxxxxxx-x)"
                              value={values.cnic || ''}
                              changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                              className="bg-[#EEF0F6] p-3 rounded w-[517px] border border-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {activeTab === 'areaAssignment' && (
                        <div className="mt-4">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="text-lg font-semibold mb-3 text-gray-700">Assigned Area</h3>
                            
                             {newSalesPerson.assignedArea && newSalesPerson.assignedArea.length > 0 ? (
                               <div className="mb-4"> 
                                 <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3"> 
                                   <div className="flex items-center justify-between"> 
                                     <div> 
                                       <p className="text-green-800 font-medium">Area Assigned</p> 
                                       <p className="text-green-600 text-sm"> 
                                         {Array.isArray(newSalesPerson.assignedArea[0])
                                           ? newSalesPerson.assignedArea.reduce((acc, poly) => acc + (Array.isArray(poly) ? poly.length : 0), 0)
                                           : newSalesPerson.assignedArea.length} boundary points defined 
                                       </p> 
                                     </div> 
                                     <div className="w-3 h-3 bg-green-500 rounded-full"></div> 
                                   </div> 
                                 </div> 
                                 
                                 <div className="text-sm text-gray-600 mb-3"> 
                                   <strong>Boundary Coordinates:</strong> 
                                   <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border mt-1"> 
                                     {Array.isArray(newSalesPerson.assignedArea[0])
                                       ? newSalesPerson.assignedArea.map((poly, pIndex) => (
                                           <div key={pIndex} className="mb-2">
                                             <div className="font-medium text-gray-700">Area {pIndex + 1}</div>
                                             {poly.map((point, index) => (
                                               <div key={index} className="text-xs">
                                                 Point {index + 1}: {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
                                               </div>
                                             ))}
                                           </div>
                                         ))
                                       : newSalesPerson.assignedArea.map((point, index) => (
                                           <div key={index} className="text-xs"> 
                                             Point {index + 1}: {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)} 
                                           </div>
                                         ))}
                                   </div> 
                                 </div> 
                               </div> 
                             ) : ( 
                               <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4"> 
                                 <div className="flex items-center"> 
                                   <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div> 
                                   <div> 
                                     <p className="text-yellow-800 font-medium">No Area Assigned</p> 
                                     <p className="text-yellow-600 text-sm"> 
                                       Click "Assign Area" to define the sales territory 
                                     </p> 
                                   </div> 
                                 </div> 
                               </div> 
                             )} 

                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setAreaSelectorVisible(true)}
                                className="flex items-center gap-2 bg-[#FF5934] text-white px-4 py-2 rounded-lg hover:bg-[#e54d2b] transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {newSalesPerson.assignedArea.length > 0 ? 'Edit Area' : 'Assign Area'}
                              </button>
                              
                               {newSalesPerson.assignedArea && newSalesPerson.assignedArea.length > 0 && ( 
                                 <button 
                                   type="button" 
                                   onClick={() => { 
                                     setNewSalesPerson(prev => ({ ...prev, assignedArea: [] })); 
                                     changeHandler('assignedArea', [], setFieldValue); 
                                   }} 
                                   className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors" 
                                 > 
                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"> 
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> 
                                   </svg> 
                                   Clear Area 
                                 </button> 
                               )} 
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'salaryInfo' && (
                        <div className="mt-4">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="text-lg font-semibold mb-3 text-gray-700">Salary Information</h3>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Basic Salary
                                </label>
                                <Input
                                  name="basicSalary"
                                  type="number"
                                  placeholder="Enter basic salary"
                                  value={values.basicSalary || ''}
                                  changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                  className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                />
                              </div>
                              
                              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Allowance Distance (km)
                              </label>
                              <Input
                                name="allowanceDistance"
                                type="number"
                                placeholder="Enter allowance distance in kilometers"
                                value={values.allowanceDistance || ''}
                                changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                              />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Daily Allowance
                                </label>
                                <Input
                                  name="dailyAllowance"
                                  type="number"
                                  placeholder="Enter daily allowance amount"
                                  value={values.dailyAllowance || ''}
                                  changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                  className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Miscellaneous Allowance
                                </label>
                                <Input
                                  name="miscellaneousAllowance"
                                  type="number"
                                  placeholder="Enter miscellaneous allowance amount"
                                  value={values.miscellaneousAllowance || ''}
                                  changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                  className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'timeslot' && (
                        <div className="mt-4">
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="text-lg font-semibold mb-3 text-gray-700">Timeslot</h3>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Check In Time</label>
                                <Input
                                  name="checkInTime"
                                  type="time"
                                  placeholder="HH:MM"
                                  value={values.checkInTime || ''}
                                  changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                  className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Check Out Time</label>
                                <Input
                                  name="checkOutTime"
                                  type="time"
                                  placeholder="HH:MM"
                                  value={values.checkOutTime || ''}
                                  changeHandler={(key, value) => changeHandler(key, value, setFieldValue)}
                                  className="bg-[#EEF0F6] p-3 rounded w-full border border-gray-300"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6'>
                    <div
                      onClick={() => {
                        setImageLoading(false);
                        setFormVisible(false);
                      }}
                      className='bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer'
                    >
                      Cancel
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleSubmit();
                      }}
                      className='bg-[#FF5934] w-full h-12 mt-4 text-white px-2 py-3 rounded-lg'
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
      <div className={`fixed top-0 right-0 h-full w-[30%] bg-white shadow-lg transition-transform ${selectedUser ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedUser && (
          <div className='flex flex-col h-full'>
            <div className='flex flex-col items-start relative flex-grow overflow-y-auto'>
              <h2 className='text-xl font-bold mb-4 px-4 py-2'>Details</h2>
              <img src={selectedUser.image} alt="" className='w-20 h-20 rounded-full mb-4 ml-4' />
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <span className='font-bold'>{selectedUser.name}</span> <br />
                <span className='font-bold text-[#FF5934]'>Sale Person</span> <br />
                <span className='text-gray-600'>{selectedUser.email}</span>
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Phone No:</strong> <br />{selectedUser.phone}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>CNIC:</strong><br /> {selectedUser.cnic}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>City:</strong> <br />{selectedUser.city?.name}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Address:</strong> <br />{selectedUser.address}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Billing Address:</strong> <br />{selectedUser.billingAddress || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Tab City:</strong> <br />{selectedUser.cityTab || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Province:</strong> <br />{selectedUser.province || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Postal Code:</strong> <br />{selectedUser.postalCode || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Country:</strong> <br />{selectedUser.country || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>NTN:</strong> <br />{selectedUser.ntn || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>STN:</strong> <br />{selectedUser.stn || 'N/A'}
              </div>
              <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
                <strong>Assigned Area:</strong> <br />
                {selectedUser.assignedArea && selectedUser.assignedArea.length > 0 ? (
                  <div className="text-sm">
                    <span className="text-green-600 font-medium">
                      ✓ Area Assigned ({selectedUser.assignedArea.length} points)
                    </span>
                    <div className="mt-1 max-h-20 overflow-y-auto text-xs text-gray-600">
                      {selectedUser.assignedArea.slice(0, 3).map((point, index) => (
                        <div key={index}>
                          Point {index + 1}: {point.lat?.toFixed(4)}, {point.lng?.toFixed(4)}
                        </div>
                      ))}
                      {selectedUser.assignedArea.length > 3 && (
                        <div className="text-gray-500">... and {selectedUser.assignedArea.length - 3} more points</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-red-500">No area assigned</span>
                )}
              </div>
            </div>

            <div className='flex justify-center items-center w-full px-4 mb-2'>
              <button onClick={() => setSelectedUser(null)}
                className='text-[#FF5934] bg-[#FFD7CE] flex gap-2 w-full justify-center items-center p-2 rounded-xl'>
                Close
              </button>
              <EscapeClose onClose={() => setSelectedUser(false)} />
            </div>
          </div>
        )}
      </div>

      {/* Area Selector Component */}
      <AreaSelector
        isVisible={isAreaSelectorVisible}
        initialArea={newSalesPerson.assignedArea}
        onAreaChange={(coordinates) => {
          // Preserve all polygons; backend now supports multiple polygons
          setNewSalesPerson(prev => ({ ...prev, assignedArea: coordinates }));
        }}
        onClose={() => setAreaSelectorVisible(false)}
      />
    </div>
  );
};

export default Sales;