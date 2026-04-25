import { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import useSWR from "swr";
import { toast } from "react-toastify";
import { FaEdit } from "react-icons/fa";

import {
  getSettings,
  updateSettings,
} from "../APIS";
import { checkAuthError } from "../utils";
import { Loader } from '../components/common/loader';

const Terms = () => {
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [state, setState] = useState({
    id: "",
    termsAndConditions: ""
  });

  const { data, mutate, error } = useSWR("/getSettings", () =>
    getSettings()
  );

  const clearForm = () => {
    setState({
      id: "",
      termsAndConditions: ""
    });
  };

  const changeHandler = async (key, value) => {
    setState((p) => ({
      ...p,
      [key]: value,
    }));
  };

  const addHandler = () => {
    setState({
      id: "",
      termsAndConditions: data?.data?.data?.termsAndConditions
    });
    setShow(true)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await updateSettings(
        {
          termsAndConditions: state.termsAndConditions
        }
      );
      setLoading(false);
      mutate();
      setShow(false);
      clearForm();
    } catch (error) {
      checkAuthError(error);
      toast.error(error.message);
    }
  };

  if (error) {
    alert(error.message);
    return <></>;
  }
  if (!data || loading) return <Loader />;

  return (
    <div className='relative'>
      <div className='flex justify-between mt-3'>
        <h1 className='md:text-xl font-bold'>Terms & Conditions</h1>
        <div className='flex gap-7'>
        <button className='bg-[#FFD7CE] flex gap-2 justify-center items-center text-[#FF5934] p-2 rounded' onClick={addHandler}>
          <FaEdit />
            Edit
          </button>
        </div>
      </div>
      <div className='mt-3'>
        <div className='terms' dangerouslySetInnerHTML={{ __html: data?.data?.data.termsAndConditions }} />
      </div>

      {show && (
        <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white w-[35%] max-h-[80vh] overflow-auto p-6 mt-5 mb-5 rounded'>
            <h2 className='text-xl font-bold mb-4'>Edit Terms & Conditions</h2>
            <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
              <ReactQuill
                value={state.termsAndConditions}
                onChange={(v) => changeHandler("termsAndConditions", v)}
                modules={{
                  toolbar: [
                    [{ 'header': '1' }, { 'header': '2' }, { 'font': [] }],
                    [{ size: [] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' },
                    { 'indent': '-1' }, { 'indent': '+1' }],
                    ['link', 'image', 'video'],
                    ['clean']
                  ],
                }}
              />
              <div className='flex justify-between gap-4'>
                <button type='button' onClick={() => setShow(false)} className='bg-gray-300 w-28 p-2 rounded'>
                  Cancel
                </button>
                <button type='submit' className='bg-[#FF5934] w-28 text-white p-2 rounded'>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terms;
