import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div>
      <h1>Road Damage Reporting System</h1>
      <p>Welcome! Please choose an option below:</p>

      <nav>
        <ul>
          <li>
            <Link to="/">User Login</Link>
          </li>
          <li>
            <Link to="/adminlogin">Admin Login</Link>
          </li>
          <li>
            <Link to="/upload">Upload Report</Link>
          </li>
          <li>
            <Link to="/myreports">My Reports</Link>
          </li>
          <li>
            <Link to="/admin-dashboard">Admin Dashboard</Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Home;
