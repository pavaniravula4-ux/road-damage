import React, { useState } from "react";
import axios from "../services/api";
import { useNavigate } from "react-router-dom";

function UserLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/user/login", { email, password });
      if (res.data.error) {
        alert(res.data.error);
      } else {
        // ✅ Save user info in localStorage
        localStorage.setItem("userId", res.data.user_id);
        localStorage.setItem("role", res.data.role);

        // ✅ Navigate based on role
        if (res.data.role === "user") {
          navigate("/upload");   // normal user dashboard
        } else if (res.data.role === "admin") {
          navigate("/admin");    // admin dashboard (only if registered as admin in DB)
        }
      }
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>User Login</h2>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit">Login</button>
    </form>
  );
}

export default UserLogin;
