import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { toast } from "react-toastify";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import '../CSS/Login.css'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  getAllCities,
  uploadFile,
  updateCategoryStatus,
  getDatas
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError } from "../utils";
import { HiDotsVertical } from "react-icons/hi";
import { Loader } from '../components/common/loader';
import { Input } from '../components/common/input';
import { Select } from '../components/common/select';
import { Spinner } from '../components/common/spinner';
import ClickOutside from '../Hooks/ClickOutside';
import DragNdrop from '../components/DragDrop';
import EscapeClose from '../components/EscapeClose';
import placeholder from "../../public/placehold.jpg"


const LIMIT = 10;
const Category = () => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [fileUpload, setFileUpload] = useState(false);
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [state, setState] = useState({
    id: "",
    categoryId: "",
    englishName: "",
    urduName: "",
    image: "",
    cityID: ""
  });
  useEffect(() => {
    if (searchTerm.length) {
      const link = `/category/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
      })
        .catch((err) => {
          toast.error(err.message);
        })
    } else {
      getCategories(currentPage, LIMIT).then((res) => {
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
    categoryId: yup.string().required("Brand ID is required"),
    urduName: yup.string(),
    englishName: yup.string().required("Title in english is required"),
    cityID: yup.string().required("City is required")
  });

  const clearForm = () => {
    setState({
      id: "",
      categoryId: "",
      englishName: "",
      urduName: "",
      image: "",
      cityID: ""
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
      await deleteCategory(id, token);
      setLoading(false);
      getCategories(currentPage, LIMIT).then((res) => {
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
  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      // Create payload without image if it's empty
      const payload = { ...values };
      if (state.image) {
        payload.image = state.image;
      }
      
      if (state.id.length) {
        await updateCategory(payload, token);
      } else {
        await createCategory(payload, token);
      }
      setLoading(false);
      getCategories(currentPage, LIMIT).then((res) => {
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
      setFileUpload(true);
      const formData = new FormData();
      formData.append("file", files[0]);
      const res = await uploadFile(formData);
      const url = res.data.data;
      setState((p) => ({
        ...p,
        image: url,
      }));

      setFileUpload(false);
    } catch (error) {
      setFileUpload(false);
      checkAuthError(error);
      toast.error(error.message);
    }
  };


  const editHandler = async (item) => {
    if (!cities.isLoaded) {
      const res = await getAllCities();
      setCities({
        isLoaded: true,
        data: res.data.data,
      });
    }
    setShow(true);
    setState({
      id: item._id,
      categoryId: item.categoryId,
      englishName: item.englishName,
      urduName: item.urduName,
      image: item.image,
      cityID: item.cityID?._id
    });
  };
  const addHandler = async () => {
    if (!cities.isLoaded) {
      const res = await getAllCities();
      setCities({
        isLoaded: true,
        data: res.data.data,
      });
    }
    clearForm();
    setShow(true);
  };


  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      await updateCategoryStatus(
        {
          ...item,
          id: item._id,
          [name]: checked
        },
        token
      );
      setLoading(false);
      getCategories(currentPage, LIMIT).then((res) => {
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

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        const link = `/category/search/${searchTerm}?page=${1}&limit=${LIMIT}`
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
          getCategories(1, LIMIT).then((res) => {
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
            setLoading(false);
          })
        }
      }
    }
  };

  const refreshData = () => {
    getCategories(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
  }

  if (!data || loading) return <Loader />;

  return (
    <div className='relative'>
      <div className='flex justify-between  gap-10 items-center mt-3'>
        <h1 className='text-xl font-bold'>Brands</h1>
        <div className='flex gap-2 '>
          <div className='flex  bg-[#FFFFFF] rounded-xl px-1'>
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
              className='p-2 mr-1 outline-none rounded-xl'
              type="search"
              name="search"
              id=""
              placeholder='Search by title'
            />
          </div>
          <div className=''>
            <button className='bg-[#FFD7CE] font-bold text-nowrap text-[#FF5934] p-2 rounded' onClick={addHandler}>
              + Add Brands
            </button>
          </div>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left  text-gray-500 '>
              <td>Image</td>
              {/* <td>ID</td> */}
              <td>Brand ID</td>
              <td>Title (EN)</td>
              {/* <td>Title (UR)</td> */}
              <td>Location</td>
              <td>Created on</td>
              <td>Active</td>
              <td>Admin Verified</td>
              <td></td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((product, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='p-2 rounded-l-xl bg-[#FFFFFF]' >
                  <img src={product.image || placeholder} alt='Product' className='w-10 h-10 object-cover rounded-full' />
                </td>
                {/* <td className='p-2 bg-[#FFFFFF] uppercase'>#{product._id.slice(0, 6)}</td> */}
                <td className='p-2 bg-[#FFFFFF]'>{product.categoryId}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.englishName}</td>
                {/* <td className='text-sm urdu bg-[#FFFFFF]'>{product.urduName}</td> */}
                <td className='text-sm urdu bg-[#FFFFFF]'>{product.cityID?.name}</td>
                <td className='p-2 bg-[#FFFFFF]'>{new Date(product.createdAt).toLocaleDateString()} | <span>{new Date(product.createdAt).toLocaleTimeString()}</span></td>
                <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.isActive, "isActive", product)}>{product.isActive ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}>{product.adminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='bg-[#FFFFFF] rounded-r-xl'>

                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl  border inline-block text-left">
                    <div className='flex gap-5'>
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
            )) : (<div>No Categories found</div>)}
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
          className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg "
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
          className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg "
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
          <div className='bg-white w-[330px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Create Brand</h2>
            </div>
            <Formik
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='overflow-x-hidden overflow-y-auto scrollbar-hide'>
                  <h6 className='font-semibold p-6 mb-2'>Thumbnail</h6>
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

                      {fileUpload ?
                        <Spinner />
                        : (
                          <>
                            <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height='100%' />

                          </>
                        )}
                    </div>
                    <Input
                      name="categoryId"
                      label="Category ID"
                      placeholder="Enter unique brand ID"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                      value={state.categoryId}
                    />

                    <Input
                      name="englishName"
                      label="English Name"
                      placeholder="Name in english"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    />

                    {/* <Input
                      name="urduName"
                      placeholder="اردو میں نام"
                      label="Urdu Name"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                      dir="rtl"
                      style={{ textAlign: 'right' }}
                    /> */}

                    <Select
                      name="cityID"
                      label="Location"
                      data={cities.data}
                      searchKey="_id"
                      searchValue="name"
                      value={state.cityID}
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                    />

                  </div>
                  <div className='flex p-6 justify-between gap-4 border-t border-gray-300 pt-4 mt-6'>
                    <div
                      onClick={() => {
                        setFileUpload(false);
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

      <div
        className={`fixed top-0 right-0 h-full w-[35%] bg-white overflow-y-auto  shadow-lg transition-transform ${selectedProduct ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedProduct && (
          <div className='flex flex-col gap-4'>
            <h2 className='text-xl font-bold mb-4 px-4'>Category Details</h2>
            <img src={selectedProduct.image} alt='Product' className='w-20 h-20 rounded-full mb-4 ml-4' />
            <div className='mb-2 border-b-2 px-4'>
              <strong>Title (EN):</strong> {selectedProduct.englishName}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Title (UR):</strong> {selectedProduct.urduName}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>City:</strong> {selectedProduct.cityID?.name}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>ID:</strong> {selectedProduct._id}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Category ID:</strong> {selectedProduct.categoryId}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Created on:</strong> {new Date(selectedProduct.createdAt).toLocaleDateString()}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Active:</strong> {selectedProduct.isActive ? 'Yes' : 'No'}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Admin Verified:</strong> {selectedProduct.adminVerified ? 'Yes' : 'No'}
            </div>
            <div className='flex mt-16 border-t-2 justify-center items-center w-full px-4'>
              <button onClick={() => setSelectedProduct(null)}
                className='text-[#FF5934] bg-[#FFD7CE] flex gap-2 w-full justify-center items-center p-2 rounded-xl mb-2 mt-6'>
                Close
              </button>
              <EscapeClose onClose={()=>setSelectedProduct(false)}/>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Category;
