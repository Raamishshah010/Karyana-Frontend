import { useEffect, useState } from 'react';
import { PiToggleLeftFill, PiToggleRightFill } from "react-icons/pi";
import { Form, Formik } from "formik";
import * as yup from "yup";
import { toast } from "react-toastify";
import { GrFormNext } from "react-icons/gr";
import { GrFormPrevious } from "react-icons/gr";
import {
  addBanner,
  deleteBanner,
  getBanners,
  updateBanner,
  getAllCities,
  uploadFile,
  updateBannerStatus,
  getDatas
} from "../APIS";
import { useSelector } from "react-redux";
import { checkAuthError } from "../utils";
import { HiDotsVertical } from "react-icons/hi";
import { Loader } from '../components/common/loader';
import { Spinner } from '../components/common/spinner';
import { Input } from '../components/common/input';
import { Select } from '../components/common/select';
import ClickOutside from '../Hooks/ClickOutside';
import DragNdrop from '../components/DragDrop';

const LIMIT = 10;
const Brands = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [fileUpload, setFileUpload] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [cities, setCities] = useState({
    isLoaded: false,
    data: [],
  });
  const [state, setState] = useState({
    id: "",
    alternativeText: "",
    image: "",
    cityID: ""
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isImageModalVisible, setImageModalVisible] = useState(false);
  const [imageToShow, setImageToShow] = useState(null);
  const [showDropdown, setShowDropdown] = useState("");


  useEffect(() => {

    if (searchTerm.length) {
      const link = `/banner/search/${searchTerm}?page=${currentPage}&limit=${LIMIT}`
      getDatas(link).then((res) => {
        setData(res.data.data);
        setTotalPages(res.data.totalPages);
      })
        .catch((err) => {
          toast.error(err.message);
        })
    } else {
      getBanners(currentPage, LIMIT).then((res) => {
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
    alternativeText: yup.string().required("Alternative text is required"),
    cityID: yup.string().required("City is required")
  });

  const clearForm = () => {
    setState({
      id: "",
      alternativeText: "",
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

  const handleImageClick = (e, imageUrl) => {
    e.stopPropagation();
    setImageToShow(imageUrl);
    setImageModalVisible(true);
  };

  const deleteHandler = async (id) => {
    const c = window.confirm("Are you sure to delete?");
    if (!c) return;
    try {
      setLoading(true);
      await deleteBanner(id, token);
      setLoading(false);
      getBanners(currentPage, LIMIT).then((res) => {
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
        await updateBanner(
          {
            ...values,
            image: state.image,
          },
          token
        );
      } else {
        await addBanner(
          {
            ...values,
            image: state.image,
          },
          token
        );
      }
      setLoading(false);
      getBanners(currentPage, LIMIT).then((res) => {
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
      alternativeText: item.alternativeText,
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



  const searchHandler = async (e) => {
    if (e.key === 'Enter') {
      if (searchTerm.length) {
        const link = `/banner/search/${searchTerm}?page=${1}&limit=${LIMIT}`
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
          getBanners(1, LIMIT).then((res) => {
            setData(res.data.data);
            setTotalPages(res.data.totalPages);
            setLoading(false);
          })
        }
      }
    }
  };

  const updateDataHandler = async (checked, name, item) => {
    try {
      console.log(item);

      setLoading(true);
      await updateBannerStatus(
        {
          ...item,
          id: item._id,
          [name]: checked
        },
        token
      );
      setLoading(false);
      getBanners(currentPage, LIMIT).then((res) => {
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
      toast.error(error.message);
    }
  };
  const refreshData = () => {
    getBanners(1, LIMIT).then((res) => {
      setData(res.data.data);
      setTotalPages(res.data.totalPages);
      setLoading(false);
    })
  }

  if (loading) return <Loader />;
  return (
    <div className='relative'>
      <div className='flex justify-between mt-3'>
        <h1 className='text-xl font-bold'>Banners</h1>
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
              className='p-2 outline-none rounded-xl w-[220px]'
              type="search"
              name="search"
              id=""
              placeholder='Search by alternative text'
            />
          </div>
          <button className='bg-[#FFD7CE] text-nowrap text-[#FF5934] font-bold p-2 rounded' onClick={addHandler}>
            + Add Banner
          </button>
        </div>
      </div>
      <div className='mt-3'>
        <table className='w-full border-separate border-spacing-y-4'>
          <thead>
            <tr className='text-left  text-gray-500'>
              <td>Banner</td>
              <td>ID</td>
              <td>Alternate Text</td>
              <td>Created On</td>
              <td>Active</td>
              <td>Admin Verified</td>
            </tr>
          </thead>
          <tbody>
            {data.length ? data.map((product, index) => (
              <tr key={index} className='border-b cursor-pointer'>
                <td className='p-2 rounded-l-xl bg-[#FFFFFF]'>
                  <img
                    src={product.image}
                    alt='Product'
                    className='w-24 h-16 object-cover rounded-lg'
                    onClick={(e) => handleImageClick(e, product.image)}
                  />
                </td>
                <td className='p-2 bg-[#FFFFFF] uppercase'>#{product._id.slice(0, 5)}</td>
                <td className='p-2 bg-[#FFFFFF]'>{product.alternativeText}</td>
                <td className='p-2 bg-[#FFFFFF]'>{new Date(product.createdAt).toLocaleDateString()}</td>
                <td
                  className='p-2 text-2xl bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!product.isActive, "isActive", product)}
                >
                  {product.isActive ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}
                </td>
                <td
                  className='p-2 text-2xl  bg-[#FFFFFF]'
                  onClick={() => updateDataHandler(!product.adminVerified, "adminVerified", product)}
                >
                  {product.adminVerified ? <PiToggleRightFill className='text-green-500' /> : <PiToggleLeftFill className='text-gray-400' />}
                </td>
                <td className='rounded-r-xl bg-[#FFFFFF]'>
                  <div className="relative p-2 bg-[#FFFFFF] justify-center items-center rounded-xl  border inline-block text-left">

                    <button className='flex'
                      onClick={() => setShowDropdown(prev => prev === product._id ? "" : product._id)}
                    >
                      <HiDotsVertical />
                    </button>

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
            )) : (<div>No Banners found!</div>)}
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
          className="flex items-center  bg-[#FF5934] text-white p-2 rounded-lg"
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
              <h2 className='text-xl font-bold'>Add Banner</h2>
            </div>
            <Formik
              initialValues={state}
              validationSchema={validations}
              onSubmit={handleSubmit}
            >
              {() => (
                <Form className='overflow-x-hidden overflow-y-auto scrollbar-hide'>
                  <h6 className='font-semibold mb-2 p-6'>Upload Banner Image</h6>


                  <div className='px-6'>
                    <div className='relative h-[200px] flex border p-4 border-gray-300 border-dotted flex-col justify-center items-center  rounded-lg mb-4'>
                      {state.image ? (
                        <img
                          src={state.image}
                          alt='Preview'
                          className='w-20 h-20 rounded-full object-cover mb-4'
                        />
                      ) : (
                        <img
                          src="/Avatar.svg"
                          alt='Default Avatar'
                          className='w-20 h-20 mt-2 rounded-full object-cover mb-4'
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
                      name="alternativeText"
                      label="Alternative Text"
                      placeholder="Alternative Text"
                      changeHandler={changeHandler}
                      className='bg-[#EEF0F6] p-3  mt-2 rounded w-full border border-gray-300'
                    />

                    <Select
                      name="cityID"
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



      {isImageModalVisible && (
        <div
          className='fixed overflow-auto inset-0 flex items-center justify-center bg-black bg-opacity-75'
          onClick={() => setImageModalVisible(false)}
        >
          <div
            className='relative w-[60%] max-w-[600px] max-h-[70vh]'
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageToShow}
              alt='Enlarged product'
              className='w-full h-full object-contain'
            />
          </div>
        </div>
      )}




      <div
        className={`fixed top-0 right-0 h-full w-[35%] bg-white p-4 shadow-lg transition-transform ${selectedProduct ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedProduct && (
          <div className='flex flex-col justify-center items-center'>
            <h2 className='text-xl font-bold mb-4'>Brand Details</h2>
            <img src={selectedProduct.image} alt='Product' className='w-20 h-20 rounded-full mb-4' />
            <div className='mb-2'>
              <strong>Alternate Test:</strong> {selectedProduct.alternatTest}
            </div>
            <div className='mb-2'>
              <strong>Created On:</strong> {selectedProduct.createdOn}
            </div>
            <div className='mb-2'>
              <strong>Active:</strong> {selectedProduct.active ? 'Yes' : 'No'}
            </div>
            <div className='mb-2'>
              <strong>Admin Verified:</strong> {selectedProduct.adminVerify ? 'Yes' : 'No'}
            </div>
            <button onClick={() => setSelectedProduct(null)} className='bg-gray-300 p-2 rounded mt-4'>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Brands;
