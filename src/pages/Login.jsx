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
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [state] = useState({ email: "", password: "" });
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

  const TABS = [
    { role: ROLES[0], label: "Admin", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    )},
    { role: ROLES[1], label: "Coordinator", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )},
    { role: ROLES[2], label: "Warehouse", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    )},
  ];

  const roleDescriptions = {
    [ROLES[0]]: "Full system access and management",
    [ROLES[1]]: "Coordinate operations and teams",
    [ROLES[2]]: "Manage inventory and products",
  };

  if (loading) return <Loader />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        .login-root { font-family: 'DM Sans', sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,89,52,0.25); }
          50%       { box-shadow: 0 0 0 8px rgba(255,89,52,0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }

        .login-card   { animation: fadeUp 0.5s cubic-bezier(0.34,1.1,0.64,1) both; }
        .login-form   { animation: fadeUp 0.55s 0.1s cubic-bezier(0.34,1.1,0.64,1) both; }
        .tab-slide    { animation: slideIn 0.3s cubic-bezier(0.34,1.1,0.64,1) both; }

        .logo-text {
          background: linear-gradient(135deg, #FF5934 0%, #ff8c6b 50%, #FF5934 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }

        .login-image { animation: float 6s ease-in-out infinite; }

        .left-panel {
          background: linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
        }

        .submit-btn {
          background: linear-gradient(135deg, #FF5934, #ff7c5e);
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #e84d2a, #FF5934);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .submit-btn:hover::after { opacity: 1; }
        .submit-btn span { position: relative; z-index: 1; }
        .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(255,89,52,0.35); }
        .submit-btn:active { transform: translateY(0); }

        .tab-active {
          background: #FF5934;
          color: white;
          box-shadow: 0 4px 12px rgba(255,89,52,0.35);
        }
        .tab-inactive {
          background: #F9FAFB;
          color: #6B7280;
        }
        .tab-inactive:hover { background: #FFF4F2; color: #FF5934; }

        .login-input {
          background: #F9FAFB;
          border: 1.5px solid #E5E7EB;
          border-radius: 12px;
          padding: 12px 16px;
          width: 100%;
          outline: none;
          font-size: 14px;
          color: #111827;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .login-input:focus {
          border-color: #FF5934;
          box-shadow: 0 0 0 3px rgba(255,89,52,0.1);
          background: white;
        }
        .login-input::placeholder { color: #9CA3AF; }

        .input-icon { color: #9CA3AF; transition: color 0.2s; }
        .input-wrap:focus-within .input-icon { color: #FF5934; }

        .dot-pattern {
          background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0);
          background-size: 24px 24px;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: rgba(255,89,52,0.1);
          color: #FF5934;
          border: 1px solid rgba(255,89,52,0.2);
        }

        .no-scroll::-webkit-scrollbar { display: none; }
        .no-scroll { scrollbar-width: none; }
      `}</style>

      <div className="login-root min-h-screen flex items-center justify-center bg-[#F3F4F6] p-4">
        <div className="login-card w-full max-w-[920px] flex rounded-3xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.18)' }}>

          {/* ── Left Panel ── */}
          <div className="left-panel dot-pattern hidden md:flex flex-col justify-between w-[52%] p-10 relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#FF5934]/10" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-white/5" />
            <div className="absolute top-1/2 right-8 w-3 h-3 rounded-full bg-[#FF5934]/50" />
            <div className="absolute top-1/3 left-12 w-2 h-2 rounded-full bg-white/20" />

            {/* Logo */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#FF5934] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 16px rgba(255,89,52,0.4)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                </div>
                <span className="text-white text-xl font-bold tracking-tight">Karyana</span>
              </div>
              <p className="text-white/40 text-[12px] mt-1 ml-11">Management Platform</p>
            </div>

            {/* Illustration area */}
            <div className="relative flex items-center justify-center py-8">
              <div className="login-image relative z-10">
                <img src={img} alt="Login visual" className="w-full max-w-[280px] object-contain drop-shadow-2xl rounded-2xl" />
              </div>
              {/* Glow behind image */}
              <div className="absolute w-52 h-52 rounded-full bg-[#FF5934]/15 blur-3xl" />
            </div>

            {/* Bottom text */}
            <div className="relative">
              <p className="text-white/60 text-[13px] leading-relaxed">
                Manage your supply chain, track inventory, and coordinate your team — all in one place.
              </p>
              <div className="flex items-center gap-2 mt-4">
                {[0,1,2].map(i => (
                  <div key={i} className={`h-1.5 rounded-full transition-all ${i === 0 ? 'w-6 bg-[#FF5934]' : 'w-2 bg-white/20'}`} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Panel ── */}
          <div className="bg-white flex-1 flex flex-col justify-center px-8 py-10 md:px-10">
            <div className="login-form max-w-[340px] w-full mx-auto">

              {/* Mobile logo */}
              <div className="flex items-center gap-2 mb-8 md:hidden">
                <div className="w-8 h-8 rounded-xl bg-[#FF5934] flex items-center justify-center">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                  </svg>
                </div>
                <span className="text-[#FF5934] text-lg font-bold">Karyana</span>
              </div>

              {/* Heading */}
              <div className="mb-7">
                <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-1">Welcome back</p>
                <h1 className="text-[26px] font-bold text-[#111827] leading-tight tracking-tight">Sign in to your account</h1>
                <p className="text-[13px] text-[#9CA3AF] mt-1.5">{roleDescriptions[activeTab]}</p>
              </div>

              {/* Role Tabs */}
              <div className="flex items-center gap-2 mb-7 p-1 bg-[#F3F4F6] rounded-xl">
                {TABS.map(({ role, label, icon }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setActiveTab(role)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-[10px] text-[12px] font-semibold transition-all duration-200
                      ${activeTab === role ? 'tab-active' : 'tab-inactive'}`}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Form */}
              <Formik initialValues={state} validationSchema={validations} onSubmit={handleSubmit}>
                {({ values, handleChange, errors, touched }) => (
                  <Form className="flex flex-col gap-4">

                    {/* Email */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Email Address</label>
                      <div className="input-wrap relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 input-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                          </svg>
                        </div>
                        <input
                          name="email"
                          type="email"
                          placeholder="you@example.com"
                          value={values.email}
                          onChange={handleChange}
                          className={`login-input pl-10 ${errors.email && touched.email ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : ''}`}
                        />
                      </div>
                      {errors.email && touched.email && (
                        <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-widest mb-1.5">Password</label>
                      <div className="input-wrap relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 input-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </div>
                        <input
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Min. 6 characters"
                          value={values.password}
                          onChange={handleChange}
                          className={`login-input pl-10 pr-10 ${errors.password && touched.password ? 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#FF5934] transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                        </button>
                      </div>
                      {errors.password && touched.password && (
                        <p className="text-red-500 text-[11px] mt-1 flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                          {errors.password}
                        </p>
                      )}
                    </div>

                    {/* Active role indicator */}
                    <div className="flex items-center justify-between py-1">
                      <div className="role-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        {TABS.find(t => t.role === activeTab)?.label} Login
                      </div>
                    </div>

                    {/* Submit */}
                    <button type="submit" className="submit-btn w-full h-[48px] rounded-xl text-white text-[14px] font-bold mt-1">
                      <span>Sign In</span>
                    </button>

                  </Form>
                )}
              </Formik>

              {/* Footer */}
              <p className="text-center text-[11px] text-[#9CA3AF] mt-6">
                © {new Date().getFullYear()} Karyana · All rights reserved
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;