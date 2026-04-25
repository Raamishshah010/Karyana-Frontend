import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { toast } from "react-toastify";
import {
  createCity,
  deleteCity,
  getCities,
  getDatas,
  updateCity,
  updateCityStatus
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError, ROLES } from "../utils";
import { HiDotsVertical } from "react-icons/hi";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import ClickOutside from '../Hooks/ClickOutside';

const LIMIT = 10;
const Cities = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState("");
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [state, setState] = useState({
    id: "",
    locationId: "",
    name: ""
  });
  

  useEffect(() => {
    const admin = JSON.parse(sessionStorage.getItem('karyana-admin')) || null;
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
      ? (admin?.user?.city && typeof admin.user.city === 'object'
          ? admin.user.city._id
          : admin?.user?.city || '')
      : '';

    if (isCoordinator && coordinatorCityId) {
      const link = `/city/${coordinatorCityId}`;
      getDatas(link)
        .then((res) => {
          const city = res?.data?.data ? [res.data.data] : [];
          setData(city);
          setTotalPages(1);
          setLoading(false);
        })
        .catch((err) => {
          setLoading(false);
          toast.error(err?.message || 'Failed to load city');
        });
      return;
    }

    if (searchTerm.length) {
      const link = `/city/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
      })
        .catch((err) => {
          toast.error(err.message);
        })
    } else {
      getCities(currentPage, LIMIT).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
        setLoading(false);
      })
        .catch((err) => {
          setLoading(false);
          toast.error(err.message);
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const token = useSelector((state) => state.admin.token);

  const validations = yup.object().shape({
    locationId: yup.string().required("Location ID is required"),
    name: yup.string().required("Name is required"),
  });

  const clearForm = () => {
    setState({
      id: "",
      locationId: "",
      name: ""
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
      await deleteCity(id, token);
      setLoading(false);
      getCities(currentPage, LIMIT).then((res) => {
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
      setLoading(false);
      toast.error(error.response?.data?.errors[0]?.msg);
    }
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      await updateCityStatus(
        {
          ...item,
          id: item._id,
          [name]: checked
        },
        token
      );
      setLoading(false);
      getCities(currentPage, LIMIT).then((res) => {
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

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      if (state.id.length) {
        await updateCity(
          {
            ...values
          },
          token
        );
      } else {
        await createCity(
          {
            ...values
          },
          token
        );
      }
      setLoading(false);
      getCities(currentPage, LIMIT).then((res) => {
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
      // Show a user-friendly toast if the error is about unique Location ID
      const msg = error.response?.data?.errors?.[0]?.msg;
      if (msg === 'Location ID must be unique') {
        toast.error('Location ID must be unique');
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error(error.message);
      }
    }
  };

  const editHandler = async (item) => {
    setShow(true);
    setState({
      id: item._id,
      locationId: item.locationId,
      name: item.name
    });
  };

  const addHandler = async () => {
    clearForm();
    setShow(true);
  };
  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        const link = `/city/search/${searchTerm}?page=${1}&limit=${LIMIT}`
        getDatas(link).then((res) => {
          setData(res.data.data);
          setTotalPages(res.data.totalPages);
        })
          .catch((err) => {
            toast.error(err.message);
          })
      } else {
        setCurrentPage(1);
        if (currentPage === 1) {
          getCities(1, LIMIT).then((res) => {
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
            setLoading(false);
          })
        }
      }
    }
  };
  const refreshData = () => {
    const admin = JSON.parse(sessionStorage.getItem('karyana-admin')) || null;
    const isCoordinator = admin?.role?.includes(ROLES[1]);
    const coordinatorCityId = isCoordinator
      ? (admin?.user?.city && typeof admin.user.city === 'object'
          ? admin.user.city._id
          : admin?.user?.city || '')
      : '';

    if (isCoordinator && coordinatorCityId) {
      const link = `/city/${coordinatorCityId}`;
      getDatas(link).then((res) => {
        const city = res?.data?.data ? [res.data.data] : [];
        setData(city);
        setTotalPages(1);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
        toast.error(err?.message || 'Failed to load city');
      });
      return;
    }
    getCities(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
  }
  if (!data || loading) return <Loader />;

  return (
    <div className='relative'>
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl font-bold'>Locations</h1>
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
              className='p-2 outline-none rounded-xl'
              type="search"
              name="search"
              id=""
              placeholder='Search by name'
            />
          </div>
          <button className='bg-[#FFD7CE] text-[#FF5934] font-bold p-2 rounded' onClick={addHandler}>
            + Add Location
          </button>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left  text-gray-500'>
              <td>Location ID</td>
              <td>Name</td>
              <td>Created Date</td>
              <td>Active</td>
              <td>Admin Verified</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((product, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='p-5 bg-[#FFFFFF] rounded-l-xl'>{product.locationId}</td>
                <td className='p-4 bg-[#FFFFFF]'>{product.name}</td>
                <td className='p-4 bg-[#FFFFFF]'>{new Date(product.createdAt).toLocaleDateString()}</td>
                <td className='p-4 bg-[#FFFFFF] text-2xl' onClick={() => updateDataHandler(!product.isActive, "isActive", product)}>{product.isActive ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}>{product.adminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>

                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl  border inline-block text-left">
                    <div>
                      <button className='flex'
                        onClick={() => setShowDropdown(prev => prev === product._id ? "" : product._id)}
                      >
                        <HiDotsVertical />
                      </button>
                    </div>

                    {showDropdown === product._id && (
                      <ClickOutside onClick={() => setShowDropdown('')}>
                        <div className="p-2 z-10 origin-top-right absolute right-0 mt-2 w-36 rounded-md shadow-lg bg-slate-100 ring-1 ring-black ring-opacity-5"
                          role="menu"
                          aria-orientation="vertical"
                          aria-labelledby="dropdownButton">
                          <div className="flex flex-col gap-2 justify-center items-start" role="none">
                            <li onClick={() => {
                              editHandler(product);
                              setShowDropdown("");
                            }} className="list-none hover:bg-[#FFD7CE] font-bold rounded w-full p-2">
                              <button className="btn btn-light">Edit</button>
                            </li>
                            <li onClick={() => {
                              deleteHandler(product._id);
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
            )) : (<div> No cities found!</div>)}
          </tbody>
        </table>
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
          className="flex items-center  bg-[#FF5934] text-white p-2 rounded-lg "
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
          <span> {currentPage}</span> <span>/</span>
          <span> {totalPages}</span>
        </div>
        <button
          className="flex items-center  bg-[#FF5934] text-white p-2 rounded-lg "
          onClick={() => {
            setCurrentPage((p) => p + 1);
          }}
          disabled={totalPages <= currentPage}
        >
          <GrFormNext className='text-white' />
        </button>
      </div>

      {show && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[300px] max-h-[80vh] overflow-auto rounded-xl shadow-lg'>
            {/* Header Section */}
            <div className='border-b border-gray-300 px-6 py-4'>
              <h1 className='text-xl font-bold'>
                {state?.id.length ? "Edit Location" : "Add Location"}
              </h1>
            </div>

            {/* Form Section */}
            <Formik
              enableReinitialize={true}
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='flex  flex-col '>
                  <div className='px-6 py-4'>
                    <Input
                      changeHandler={changeHandler}
                      name='locationId'
                      id='locationId'
                      placeholder='Location ID'
                      className='bg-[#EEF0F6] border border-gray-300 p-3 rounded-lg w-full mb-2'
                    />
                    <Input
                      changeHandler={changeHandler}
                      name='name'
                      id='name'
                      placeholder='City Name'
                      className='bg-[#EEF0F6] border border-gray-300 p-3 rounded-lg w-full mb-2'
                    />
              
                  </div>
                  <div className='flex justify-between gap-4 px-6 border-t border-gray-300 pt-4 '>
                    <button
                      onClick={() => setShow(false)}
                      type='button'
                      className='bg-gray-200 flex justify-center items-center text-gray-700 p-4 w-full h-12 rounded-lg '
                    >
                      Cancel
                    </button>
                    <button
                      type='submit'
                      className='bg-[#FF5934] flex justify-center items-center text-white p-4 mb-4 w-full h-12 rounded-lg '
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

    </div>
  );
};
export default Cities;
