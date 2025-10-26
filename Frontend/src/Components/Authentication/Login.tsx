import axios from "axios";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const navigate = useNavigate();
  const [datas, setDatas] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Handle input changes
  const handleChange = (e) => {
    setDatas({ ...datas, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  // Handle form submission
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // const { confirmPassword, ...userData } = datas; // remove confirmPassword

  try {
    const response = await axios.post("http://localhost:5000/api/login", datas, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("✅ Response:", response.data);
    alert("login successful!");
    navigate("/chat");
  } catch (error: any) {
    console.error("❌ Error Response:", error.response?.data);
    alert(error.response?.data?.message || "login failed!");
  }
};


  useEffect(() => {
    console.log("Current form data:", datas);
  }, [datas]);

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Left Side - Image */}
      <div className="md:w-1/2 w-full flex items-center justify-center bg-gray-100">
        <img
          src="https://www.shutterstock.com/image-photo/ai-agents-business-analyze-businesses-600nw-2577839733.jpg"
          alt="login Visual"
          className="w-full h-full object-cover md:rounded-r-2xl shadow-lg"
        />
      </div>

      {/* Right Side - Registration Form */}
      <div className="md:w-1/2 w-full flex items-center justify-center bg-white p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-gray-50 p-8 rounded-2xl shadow-lg"
        >
          <h2 className="text-3xl font-semibold mb-6 text-center text-gray-800">
            Login
          </h2>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-gray-600 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={datas.email}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Enter your email"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-gray-600 mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={datas.password}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
              placeholder="Enter your password"
            />
          </div>

          {/* Error / Success Messages */}
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          {success && <p className="text-green-600 text-center mb-4">{success}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
