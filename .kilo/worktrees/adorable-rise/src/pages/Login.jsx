import { useState } from "react";
import { Form, Formik } from "formik";
import img from '/loginf.webp';
import back from '/loginbg.svg';
import '../CSS/Login.css';
import * as yup from "yup";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { loginAdmin, loginCoordinator, loginWarehouseManager } from "../APIS";
import { authHandler } from "../store/reducers";
import { toast } from "react-toastify";
import { Loader } from "../components/common/loader";
import { Input } from "../components/common/input";
import { ROLES } from "../utils";

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(ROLES[0]);
  const navigate = useNavigate();
  const [state] = useState({
    email: "",
    password: "",
  });
  const dispatch = useDispatch();

  const validations = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().min(6).required(),
  });

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      let res = null;
      if (activeTab.includes(ROLES[0])) {
        res = await loginAdmin(values);
      } else if (activeTab.includes(ROLES[1])) {
        res = await loginCoordinator(values);
      } else if (activeTab.includes(ROLES[2])) {
        res = await loginWarehouseManager(values);
      }
      if (res && res.status === 200) {
        const payload = {
          isAuthenticated: true,
          token: res.data.token,
          user: res.data.user,
          role: activeTab
        };
        dispatch(authHandler(payload));
        sessionStorage.setItem("karyana-admin", JSON.stringify({ ...res.data, role: activeTab }));
        if (activeTab.includes(ROLES[2])) {
          navigate("/Product");
        } else if (activeTab.includes(ROLES[1])) {
          navigate("/Users/Sales");
        } else {
          navigate("/dashboard");
        }
        toast.success("Login successfully!");
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      toast.error(error?.response?.data?.errors[0]?.msg);
    }
  };

  const activeTabStyle = " text-orange-600 border-b-2 border-orange-600 cursor-pointer inline-block p-2 text-lg text-blue-600 bg-gray-100 rounded-t-lg active dark:bg-gray-800 dark:text-blue-500";
  const inActiveTabStyle = "cursor-pointer inline-block p-2  rounded-t-lg text-lg hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:hover:text-gray-300";


  if (loading) return <Loader />;

  return (
    <div style={{ backgroundImage: `url(${back})` }} className="main flex justify-center h-screen items-center">
      <div
        style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)' }} // Black shadow with increased blur
        className="container flex md:w-[55%] rounded-xl"
      >
        <div className="left md:w-[62%] h-full">
          <img
            src={img}
            alt=""
            className="rounded-l-xl hidden md:block w-full h-full object-cover"
          />
        </div>


        <div className="right rounded-r-lg bg-white md:w-[45%] p-6">
          <Formik
            initialValues={state}
            validationSchema={validations}
            onSubmit={handleSubmit}
          >
            {() => (
              <>
                <Form>
                  <h1 className="text-[#FF5934] md:text-3xl font-bold karyana">Karyana</h1>
                  <ul className="flex flex-wrap text-sm font-medium text-center text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:text-gray-400">
                    <li className="mr-4">
                      <div onClick={() => setActiveTab(ROLES[0])} className={activeTab.includes(ROLES[0]) ? activeTabStyle : inActiveTabStyle}>Admin</div>
                    </li>
                    <li className="mr-4">
                      <div onClick={() => setActiveTab(ROLES[1])} className={activeTab.includes(ROLES[1]) ? activeTabStyle : inActiveTabStyle}>Coordinator</div>
                    </li>
                    <li>
                      <div onClick={() => setActiveTab(ROLES[2])} className={activeTab.includes(ROLES[2]) ? activeTabStyle : inActiveTabStyle}>WM</div>
                    </li>
                  </ul>

                  <h1 className="inner text-2xl font-bold mt-4"><span className="capitalize">{activeTab}</span></h1>
                  <p className="text-gray-400 mt-3">Please enter the credentials associated with your account.</p>
                  <Input
                    name="email"
                    type="email"
                    placeholder="Email address"
                  />
                  <Input
                    name="password"
                    type="password"
                    placeholder="Password"
                  />
                  <div className="flex justify-center items-center mt-28">
                    <button type="submit" className="bg-[#FF5934] text-white p-3 rounded-lg w-full">Login</button>
                  </div>
                </Form>
              </>
            )}
          </Formik>
        </div>
      </div>
    </div>
  );
};

export default Login;
