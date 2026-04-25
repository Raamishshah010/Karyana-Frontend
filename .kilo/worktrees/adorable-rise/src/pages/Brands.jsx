import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import { toast } from "react-toastify";
import {
  createBrand,
  deleteBrand,
  getBrands,
  updateBrand,
  uploadFile,
  getAllCities,
  updateBrandStatus,
  getDatas,
  getCityCategories,
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
import placeholder from '../../public/placehold.jpg'

const LIMIT = 10;
const Brands = () => {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDropdown, setShowDropdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [fileUpload, setFileUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [categories, setCategories] = useState({
    isLoaded: false,
    data: [],
  });
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [state, setState] = useState({
    id: "",
    brandId: "",
    englishName: "",
    urduName: "",
    image: "",
    categoryID: "",
    cityID: "",
    comission: "",
  });

  useEffect(() => {
    if (searchTerm.length) {
      const link = `/brand/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
      })
        .catch((err) => {
          toast.error(err.message);
        })
    } else {
      getBrands(currentPage, LIMIT).then((res) => {
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
    brandId: yup.string().required("Brand ID is required"),
    englishName: yup.string().required("Title in english is required"),
    urduName: yup.string(),
    categoryID: yup.string().required("Brand is required"),
    cityID: yup.string().required("City is required"),
    comission: yup.number().min(1).required(),
  });

  const clearForm = () => {
    setState({
      id: "",
      brandId: "",
      englishName: "",
      urduName: "",
      image: "",
      comission: "",
      categoryID: "",
      cityID: "",
    });
  };

  const changeHandler = async (key, value) => {
    if (key === "cityID" && value) {
      try {
        const res = await getCityCategories(value);
        setCategories({
          isLoaded: true,
          data: res.data.data,
        });
        // Reset category when city changes
        setState(prev => ({
          ...prev,
          categoryID: "",
          [key]: value
        }));
      } catch (error) {
        console.error("Error fetching categories:", error);
        toast.error("Failed to load categories for the selected city");
      }
    } else if (value) {
      setState(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };
  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure to delete?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteBrand(id, token);
      setLoading(false);
      getBrands(currentPage, LIMIT).then((res) => {
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
    const cityCats = categories.data.filter((it) => it.cityID?._id === values.cityID);
    if (!cityCats.find(it => it._id === values.categoryID)) {
      return toast.error("Category is required");
    }
    try {
      setLoading(true);
      // Create payload without image if it's empty
      const payload = { ...values };
      if (state.image) {
        payload.image = state.image;
      }
      
      if (state.id.length) {
        await updateBrand(payload, token);
      } else {
        await createBrand(payload, token);
      }
      setLoading(false);
      getBrands(currentPage, LIMIT).then((res) => {
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
      checkAuthError(error);
      toast.error(error.message);
    }
  };
  const updateDataHandler = async (checked, name, item) => {
    try {
      setLoading(true);
      await updateBrandStatus(
        {
          ...item,
          id: item._id,
          [name]: checked
        },
        token
      );
      setLoading(false);
      getBrands(currentPage, LIMIT).then((res) => {
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
  const editHandler = async (item) => {
    try {
      setLoading(true);
      
      // Load cities if not already loaded
      if (!cities.isLoaded) {
        const citiesRes = await getAllCities();
        setCities({
          isLoaded: true,
          data: citiesRes.data.data,
        });
      }
      
      // Load categories for the brand's city
      if (item.cityID?._id) {
        const categoriesRes = await getCityCategories(item.cityID._id);
        setCategories({
          isLoaded: true,
          data: categoriesRes.data.data,
        });
      }
      
      // Set the form state with the brand data
      setState({
        id: item._id,
        brandId: item.brandId,
        urduName: item.urduName,
        englishName: item.englishName,
        image: item.image,
        comission: item.comission,
        categoryID: item.categoryID?._id || item.categoryID,
        cityID: item.cityID?._id || item.cityID,
      });
      
      setShow(true);
    } catch (error) {
      console.error('Error in editHandler:', error);
      toast.error('Failed to load brand data');
    } finally {
      setLoading(false);
    }
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

  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        const link = `/brand/search/${searchTerm}?page=${1}&limit=${LIMIT}`
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
          getBrands(1, LIMIT).then((res) => {
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
            setLoading(false);
          })
        }
      }
    }
  };
  const refreshData = () => {
    getBrands(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
  }
  if (!data || loading) return <Loader />;
  return (
    <div className='relative'>
      <div className='flex justify-between items-center mt-3'>
        <h1 className='text-xl font-bold'>Category</h1>
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
              placeholder='Search by title'
            />
          </div>
          <button className='bg-[#FFD7CE] text-[#FF5934] p-2 font-bold rounded' onClick={addHandler}>
            + Add Category
          </button>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left  text-gray-500 '>
              <td>Image</td>
              <td>Category ID</td>
              <td>Title (EN)</td>
              {/* <td>Title (UR)</td> */}
              <td>Brand</td>
              <td>Location</td>
              <td>Commision (%)</td>
              <td>Created On</td>
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
                <td className='p-2 bg-[#FFFFFF]'>{product.brandId}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.englishName}</td>
                {/* <td className='text-sm urdu bg-[#FFFFFF]'>{product.urduName}</td> */}
                <td className='p-2 bg-[#FFFFFF]'>{product.categoryID?.englishName}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.cityID?.name}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.comission} %</td>
                <td className='p-2 bg-[#FFFFFF]'>{new Date(product.createdAt).toLocaleDateString()} | <span>{new Date(product.createdAt).toLocaleTimeString()}</span></td>
                <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.isActive, "isActive", product)}>{product.isActive ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='p-2 text-2xl bg-[#FFFFFF]' onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}>{product.adminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}</td>
                <td className='rounded-r-xl bg-[#FFFFFF]'>

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
            )) : (<div>No Categories found!</div>)}
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
          <GrFormPrevious />

        </button>
        <div
          style={{ display: "flex", alignItems: "center", gap: "5px" }}
        >
          <span> {currentPage}</span> <span>/</span>
          <span> {totalPages}</span>
        </div>
        <button
          className="flex items-center bg-[#FF5934] text-white p-2 rounded-lg"
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
          <div className='bg-white w-[350px] max-h-[100vh] overflow-auto mt-5 mb-5 rounded-xl shadow-lg'>
            <div className='border-b border-gray-300 px-4 py-3'>
              <h2 className='text-xl font-bold'>Add Category</h2>
            </div>
            <Formik
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='overflow-x-hidden overflow-y-auto scrollbar-hide'>
                  <h6 className='font-semibold mb-2 p-6'>Thumbnail</h6>

                  <div className='px-6'>
                    <div className='relative h-[200px] flex border p-4 border-gray-300 border-dotted flex-col justify-center items-center  rounded-lg mb-4'>
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
                        <Spinner /> : (
                          <>
                            <DragNdrop onFilesSelected={fileUploadHandler} width="300px" height='100%' />
                          </>
                        )}
                    </div>
                    <Input
                      name="brandId"
                      label="Category ID"
                      placeholder="Enter unique Category ID"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3 mt-2 rounded w-full border border-gray-300'
                      value={state.brandId}
                    />
                    <Input
                      name="englishName"
                      label="English Name"
                      placeholder="Name in English"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'
                    />

                    {/* <Input
                      name="urduName"
                      placeholder="Name in urdu"
                      label="Urdu Name"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'

                    /> */}


                    <Input
                      name="comission"
                      placeholder="Comission %"
                      type="number"
                      label="Comission"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'
                    />

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
                    <Select
                      name="categoryID"
                      label="Brand"
                      data={categories.data}
                      searchKey="_id"
                      searchValue="englishName"
                      value={state.categoryID}
                      changeHandler={(k, v) => {
                        setState(p => ({
                          ...p,
                          [k]: v
                        }));
                      }}
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
                      className='bg-[#FF5934] w-full h-12 rounded-lg mt-4 text-white px-2 py-3 '
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
        className={`fixed top-0 right-0 h-full w-[35%] bg-white shadow-lg transition-transform ${selectedProduct ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedProduct && (
          <div className='flex flex-col'>
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
              <strong>Category:</strong> {selectedProduct.categoryID?.englishName}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Category ID:</strong> {selectedProduct.brandId}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Commission (%):</strong> {selectedProduct.comission}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Created on:</strong> {new Date(selectedProduct.createdAt).toLocaleDateString()}
            </div>
            <div className='mb-2 px-4'>
              <strong>Active:</strong> {selectedProduct.isActive ? 'Yes' : 'No'}
            </div>
            <div className='mb-2 border-b-2 px-4'>
              <strong>Admin Verified:</strong> {selectedProduct.adminVerified ? 'Yes' : 'No'}
            </div>
            <div className='flex mt-16 border-t-2 justify-center items-center w-full px-4'>
              <button onClick={() => setSelectedProduct(null)}
                className='text-[#FF5934] bg-[#FFD7CE] flex gap-2 w-full justify-center items-center p-2 rounded-xl mt-6'>
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Brands;
