import { useEffect, useState } from 'react';
import User from './User';
import { PiToggleLeftFill } from "react-icons/pi";
import { PiToggleRightFill } from "react-icons/pi";
import { createWarehouseManager, deleteWarehouseManagers, getAllCities, getDatas, getWarehouseManagers, updateWarehouseManager, updateWarehouseManagerStatus, uploadFile } from '../../APIS';
import { toast } from 'react-toastify';
import { Loader } from "../common/loader";
import { useSelector } from "react-redux";
import { HiDotsVertical } from "react-icons/hi";
import { checkAuthError, USER_STATUSES } from '../../utils';
import * as yup from "yup";
import { Form, Formik } from "formik";
import { Input } from '../common/input';
import { Select } from '../common/select';
import { Spinner } from '../common/spinner';
import { Textarea } from '../common/textArea';
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { FaRegEye } from "react-icons/fa6";
import ClickOutside from '../../Hooks/ClickOutside';
import DragNdrop from '../DragDrop';
import EscapeClose from '../EscapeClose';


const WarehouseManagers = () => {
  const [limit, setLimit] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [imageLoading, setImageLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [showDropdown, setShowDropdown] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
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

  const token = useSelector((state) => state.admin.token);

  const validations = yup.object().shape({
    email: yup.string().email().required("Email is required"),
    name: yup.string().required("Name is required"),
    city: yup.string().required("City is required"),
    address: yup.string().required("Address is required"),
    cnic: yup.string().matches("^[0-9]{5}-[0-9]{7}-[0-9]$", 'cnic is not valid e.g xxxxx-xxxxxxx-x').required(),
    password: yup.string().min(6).required(),
    phone: yup.string().matches("^(\\+92|92|0)?[345]\\d{9}$", "phone number is not valid e.g +923333333333").required(),
  });
  useEffect(() => {
    setLoading(true);
    const link = `/warehouse-manager/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
      setLoading(false);
      setTotalPages(res.data.totalPages);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      })
  }, [currentPage, limit, selectedMaritalStatus, selectedCityId]);


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

  const changeHandler = async (key, value) => {
    setState((p) => ({
      ...p,
      [key]: value,
    }));
  };
  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure to delete?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteWarehouseManagers(id, token);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
      setShow(false);
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (state.id.length) {
        await updateWarehouseManager(
          {
            ...values,
            image: state.image,
          },
          token
        );
      } else {
        await createWarehouseManager(
          {
            ...values,
            image: state.image,
          },
          token
        );
      }
      setLoading(false);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
      setShow(false);
      clearForm();
    } catch (error) {
      setLoading(false);
      checkAuthError(error);
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };
  const fileUploadHandler = async (files) => {
    if (!files[0]) return;
    try {
      setImageLoading(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      const url = res.data.data;
      setState((p) => ({
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


  const editHandler = async (item) => {
    setShow(true);
    setState({
      id: item._id,
      name: item.name,
      email: item.email,
      password: item.password,
      phone: item.phone,
      address: item.address,
      image: item.image,
      cnic: item.cnic,
      city: item.city?._id
    });
  };
  const addHandler = async () => {
    clearForm();
    setShow(true);
  };


  const updateDataHandler = async (check, name, item) => {
    try {
      setLoading(true);
      await updateWarehouseManagerStatus(
        {
          ...item,
          id: item._id,
          [name]: check
        },
        token
      );
      const toggledLabel = name === 'isAdminVerified' ? 'Admin Verified' : 'Active';
      const stateText = check ? 'enabled' : 'disabled';
      toast.success(`${toggledLabel} ${stateText}`);

      setLoading(false);
      getWarehouseManagers(currentPage, limit).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
      setShow(false);
      clearForm();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
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
  const refreshData = () => {
    setSearchTerm("");
    setLoading(true);
    const link = `/warehouse-manager/search?page=${1}&limit=${limit}&searchTerm=&city=${selectedCityId}&status=${selectedMaritalStatus}`;
    getDatas(link).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
      .catch((err) => {
        setLoading(false);
        toast.error(err.message);
      })
  }
  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      setLoading(true);
      setSearchTerm(e.target.value);
      const link = `/warehouse-manager/search?page=${currentPage}&limit=${limit}&searchTerm=${searchTerm}&city=${selectedCityId}&status=${selectedMaritalStatus}`;
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    }
  };

  if (loading) return <Loader />;

  return (
    <div className='relative'>
      <User />
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl text-nowrap font-bold'>Warehouse Managers</h1>
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
          <select
            value={
              selectedMaritalStatus === '' ? ' '
                : selectedMaritalStatus ? USER_STATUSES[0] : USER_STATUSES[1]}
            onChange={statusSelectHandler} className='bg-[#FFFFFF] rounded-lg p-1'>
            <option value="">Status</option>
            <option value="">View All</option>
            {USER_STATUSES.map((status) => (
              <option value={status} key={status}>{status}</option>
            ))}
          </select>
          <button className='bg-[#FFD7CE] text-[#FF5934] font-bold text-nowrap p-2 rounded' onClick={addHandler}>+ Add Warehouse Manager</button>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left  text-gray-500'>
              <td>Name</td>
              <td>ID</td>
              <td>Phone no</td>
              <td>CNIC</td>
              <td>Earning</td>
              <td>Active</td>
              <td>Admin Verified</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((item, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='flex items-center gap-2 p-2 bg-[#FFFFFF] rounded-l-xl'>
                  <img src={item.image} alt="" className='w-8 h-8 rounded-full' />
                  <div >
                    <h1 className='font-bold'>{item.name}</h1>
                    <h3 className='text-sm text-gray-400'>{item.email}</h3>
                  </div>
                </td>
                <td className='p-2 bg-[#FFFFFF] uppercase'>#{item._id.slice(0, 6)}</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.phone}</td>
                <td className='p-2 bg-[#FFFFFF]'>{item.cnic}</td>
                <td className='p-2 bg-[#FFFFFF]'>{0}</td>
                <td className='p-2 bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!item.isActive, "isActive", item)}
                >{item.isActive ? <PiToggleRightFill size={25} className='text-green-500' /> : <PiToggleLeftFill size={25} className='text-gray-400' />}</td>
                <td className='p-2 bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!item.isAdminVerified, "isAdminVerified", item)}
                >{item.isAdminVerified ? <PiToggleRightFill size={25} className='text-green-500' /> : <PiToggleLeftFill size={25} className='text-gray-400' />}</td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>

                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl  border inline-block text-left">
                    <div className='flex gap-5'>
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
                          <div className="flex flex-col gap-2 justify-center items-start" role="none">
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
      {show && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Warehouse manager</h2>
            </div>
            <Formik
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='overflow-x-hidden overflow-y-auto  scrollbar-hide'>
                  <h6 className='font-semibold p-6 mb-2'>Profile Image</h6>
                  <div className='px-6'>

                    <div className='relative h-[200px] flex border border-gray-300 border-dotted flex-col justify-center items-center p-4 rounded-lg mb-4'>
                      {state.image ? (
                        <img
                          src={state.image}
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
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />

                    <Input
                      name="email"
                      type="email"
                      placeholder="Email"
                      label="Email"
                      disabled={state.id.length}
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                    {!state.id && (
                      <Input
                        name="password"
                        type="password"
                        placeholder="password"
                        label="Password"
                        changeHandler={changeHandler}
                        className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'
                      />
                    )}


                    <Input
                      name="phone"
                      placeholder="Phone"
                      label="Phone"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                    <Input
                      name="cnic"
                      placeholder="CNIC"
                      label="CNIC"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                    <Select
                      name="city"
                      label="City"
                      data={cities.data}
                      searchKey="_id"
                      searchValue="name"
                      value={state.city}
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                    <Textarea
                      name="address"
                      placeholder="Address"
                      label="Address"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />
                  </div>
                  <div className='flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6'>
                    <div
                      onClick={() => {
                        setImageLoading(false);
                        setShow(false);
                      }}
                      className='bg-gray-300 mt-4 w-full flex justify-center items-center h-12 px-2 py-3 rounded-lg text-center cursor-pointer'
                    >
                      Cancel
                    </div>
                    <button
                      type="submit"
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
          <div className='flex flex-col items-start relative h-full'>
            <h2 className='text-xl font-bold mb-4 px-4 py-2'>Details</h2>
            <img src={selectedUser.image} alt="" className='w-20 h-20 rounded-full mb-4 ml-4' />
            <div style={{ borderBottom: "1px solid rgb(223 223 223)" }} className='mb-2 w-full px-4'>
              <span className='font-bold'>{selectedUser.name}</span> <br />
              {/* Static data */}
              <span className='font-bold text-[#FF5934]'>WareHouse Manager</span> <br />
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
            <div className='absolute bottom-2 flex mt-16 justify-center items-center w-full px-4'>
              <button onClick={() => setSelectedUser(null)}
                className='text-[#FF5934] bg-[#FFD7CE] flex gap-2 w-full justify-center items-center p-2 rounded-xl mt-6'>
                Close
                {/* <RxCross2 /> */}
              </button>
              <EscapeClose onClose={()=>setSelectedUser(false)}/>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default WarehouseManagers;
