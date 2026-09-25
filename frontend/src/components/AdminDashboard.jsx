import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";


function AdminDashboard() {
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";


  // ============================================================
  // ADMIN AUTHENTICATION
  // ============================================================

  const getAdminToken = () =>
    sessionStorage.getItem("admin_token") ||
    localStorage.getItem("admin_token") ||
    "";

  const getAdminHeaders = (extra = {}) => {
    const token = getAdminToken();

    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...extra,
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    };
  };


  const handleUnauthorized = () => {
    sessionStorage.removeItem("admin_token");

    localStorage.removeItem("role");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_username");

    navigate("/adminlogin", {
      replace: true,
    });
  };


  // ============================================================
  // STATE
  // ============================================================

  const [reports, setReports] = useState([]);

  const [operators, setOperators] = useState([]);

  const [loading, setLoading] = useState(true);

  const [operatorsLoading, setOperatorsLoading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [deletingAll, setDeletingAll] =
    useState(false);

  const [assigningId, setAssigningId] =
    useState(null);

  const [deletingOperatorId, setDeletingOperatorId] =
    useState(null);

  const [creatingOperator, setCreatingOperator] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] =
    useState("");


  // ============================================================
  // OPERATOR FORM
  // ============================================================

  const [operatorUsername, setOperatorUsername] =
    useState("");

  const [operatorPassword, setOperatorPassword] =
    useState("");


  // ============================================================
  // SEARCH / FILTER
  // ============================================================

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [priorityFilter, setPriorityFilter] =
    useState("all");


  // ============================================================
  // SELECTED REPORT
  // ============================================================

  const [selectedReport, setSelectedReport] =
    useState(null);

  const [activeSection, setActiveSection] = useState("overview");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateOperator, setShowCreateOperator] = useState(false);


  // ============================================================
  // FETCH REPORTS
  // ============================================================

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");

      if (!getAdminToken()) {
        throw new Error(
          "Admin session expired. Please login again."
        );
      }

      const response = await fetch(
        `${API_URL}/api/admin/reports`,
        {
          method: "GET",
          headers: getAdminHeaders(),
        }
      );

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          error: `Server returned an invalid response (${response.status}).`,
        };
      }

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to load reports."
        );
      }

      const reportData =
        Array.isArray(data)
          ? data
          : data.reports || [];

      setReports(reportData);

    } catch (err) {
      console.error(
        "Fetch admin reports error:",
        err
      );

      setError(
        err.message ||
          "Unable to load reports."
      );

    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // FETCH OPERATORS
  // ============================================================

  const fetchOperators = async () => {
    try {
      setOperatorsLoading(true);

      const response = await fetch(
        `${API_URL}/api/admin/operators`,
        {
          method: "GET",
          headers: getAdminHeaders(),
        }
      );

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          error: `Server returned an invalid response (${response.status}).`,
        };
      }

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to load operators."
        );
      }

      setOperators(
        Array.isArray(data)
          ? data
          : data.operators || []
      );

    } catch (err) {
      console.error(
        "Fetch operators error:",
        err
      );

      setError(
        err.message ||
          "Unable to load operators."
      );

    } finally {
      setOperatorsLoading(false);
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const token = getAdminToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    fetchReports();
    fetchOperators();
  }, []);


  // ============================================================
  // REPORT STATUS
  // ============================================================

  const getAnalysisStatus = (analysis) => {
    if (
      !analysis ||
      analysis === "Pending analysis"
    ) {
      return {
        label: "Pending",
        className: "pending",
      };
    }

    const text =
      String(analysis).toLowerCase();

    if (
      text.startsWith("ai analysis failed") ||
      text.startsWith(
        "ai analysis temporarily unavailable"
      ) ||
      text.startsWith(
        "ai analysis unavailable"
      )
    ) {
      return {
        label: "Analysis Failed",
        className: "failed",
      };
    }

    return {
      label: "AI Analyzed",
      className: "analyzed",
    };
  };


  // ============================================================
  // TRACKING STATUS
  // ============================================================

  const getTrackingStatus = (report) => {
    const status =
      String(
        report.status || "Unassigned"
      ).toLowerCase();

    if (status === "completed") {
      return {
        label: "Completed",
        className: "completed",
      };
    }

    if (status === "in progress") {
      return {
        label: "In Progress",
        className: "in-progress",
      };
    }

    if (status === "assigned") {
      return {
        label: "Assigned",
        className: "assigned",
      };
    }

    return {
      label: "Unassigned",
      className: "unassigned",
    };
  };


  // ============================================================
  // PRIORITY CLASS
  // ============================================================

  const getPriorityClass = (value) => {
    const normalized =
      String(value || "")
        .toLowerCase();

    if (normalized.includes("critical")) {
      return "critical";
    }

    if (normalized.includes("high")) {
      return "high";
    }

    if (normalized.includes("medium")) {
      return "medium";
    }

    if (normalized.includes("low")) {
      return "low";
    }

    return "normal";
  };


  // ============================================================
  // PRIORITY LABEL
  // ============================================================

  const getPriorityLabel = (report) => {
    return (
      report.priority ||
      "Not determinable"
    );
  };


  // ============================================================
  // PRIORITY SCORE
  // ============================================================

  const getPriorityScore = (report) => {
    const score =
      Number(report.priority_score);

    if (
      Number.isFinite(score) &&
      score >= 0
    ) {
      return score;
    }

    return null;
  };


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return "Date not available";
    }

    const date =
      new Date(dateValue);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(dateValue);
    }

    return date.toLocaleString();
  };


  // ============================================================
  // IMAGE URL
  // ============================================================

  const getImageUrl = (imagePath) => {
    if (!imagePath) {
      return "";
    }

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    return `${API_URL}${
      imagePath.startsWith("/")
        ? ""
        : "/"
    }${imagePath}`;
  };


  // ============================================================
  // CREATE OPERATOR
  // ============================================================

  const createOperator = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!operatorUsername.trim()) {
      setError(
        "Operator username is required."
      );
      return;
    }

    if (!operatorPassword) {
      setError(
        "Operator password is required."
      );
      return;
    }

    if (operatorPassword.length < 6) {
      setError(
        "Operator password must contain at least 6 characters."
      );
      return;
    }

    try {
      setCreatingOperator(true);

      const response = await fetch(
        `${API_URL}/api/admin/operators`,
        {
          method: "POST",
          headers: getAdminHeaders(),
          body: JSON.stringify({
            username:
              operatorUsername.trim(),
            password:
              operatorPassword,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to create operator."
        );
      }

      setOperatorUsername("");
      setOperatorPassword("");
      setShowCreateOperator(false);

      setSuccess(
        "Operator created successfully."
      );

      await fetchOperators();

    } catch (err) {
      console.error(
        "Create operator error:",
        err
      );

      setError(
        err.message ||
          "Unable to create operator."
      );

    } finally {
      setCreatingOperator(false);
    }
  };


  // ============================================================
  // DELETE OPERATOR
  // ============================================================

  const deleteOperator = async (
    operatorId
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this operator?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingOperatorId(
        operatorId
      );

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/operators/${operatorId}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete operator."
        );
      }

      setSuccess(
        "Operator deleted successfully."
      );

      await fetchOperators();
      await fetchReports();

    } catch (err) {
      console.error(
        "Delete operator error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete operator."
      );

    } finally {
      setDeletingOperatorId(null);
    }
  };


  // ============================================================
  // ASSIGN REPORT TO OPERATOR
  // ============================================================

  const assignReport = async (
    reportId,
    operatorId
  ) => {
    if (!operatorId) {
      return;
    }

    try {
      setAssigningId(reportId);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/reports/${reportId}/assign`,
        {
          method: "POST",
          headers: getAdminHeaders(),
          body: JSON.stringify({
            operator_id:
              Number(operatorId),
          }),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to assign report."
        );
      }

      setSuccess(
        "Report assigned to operator successfully."
      );

      await fetchReports();

      if (
        selectedReport &&
        selectedReport.id === reportId
      ) {
        const updated =
          Array.isArray(data.report)
            ? data.report
            : data.report;

        if (updated) {
          setSelectedReport(
            updated
          );
        }
      }

    } catch (err) {
      console.error(
        "Assign report error:",
        err
      );

      setError(
        err.message ||
          "Unable to assign report."
      );

    } finally {
      setAssigningId(null);
    }
  };


  // ============================================================
  // UNASSIGN REPORT
  // ============================================================

  const unassignReport = async (
    reportId
  ) => {
    const confirmed =
      window.confirm(
        "Remove the operator assignment from this report?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setAssigningId(reportId);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/reports/${reportId}/assign`,
        {
          method: "POST",
          headers: getAdminHeaders(),
          body: JSON.stringify({
            operator_id: null,
          }),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to remove assignment."
        );
      }

      setSuccess(
        "Operator assignment removed."
      );

      await fetchReports();

    } catch (err) {
      console.error(
        "Unassign report error:",
        err
      );

      setError(
        err.message ||
          "Unable to remove assignment."
      );

    } finally {
      setAssigningId(null);
    }
  };


  // ============================================================
  // DELETE SINGLE REPORT
  // ============================================================

  const deleteReport = async (
    reportId
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this report? This action cannot be undone."
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(reportId);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/reports/${reportId}`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete the report."
        );
      }

      setReports(
        (currentReports) =>
          currentReports.filter(
            (report) =>
              report.id !== reportId
          )
      );

      if (
        selectedReport?.id ===
        reportId
      ) {
        setSelectedReport(null);
      }

      setSuccess(
        "Report deleted successfully."
      );

    } catch (err) {
      console.error(
        "Delete admin report error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete the report."
      );

    } finally {
      setDeletingId(null);
    }
  };


  // ============================================================
  // DELETE ALL REPORTS
  // ============================================================

  const deleteAllReports = async () => {
    if (reports.length === 0) {
      return;
    }

    const firstConfirm =
      window.confirm(
        `This will permanently delete all ${reports.length} reports and their uploaded images. Continue?`
      );

    if (!firstConfirm) {
      return;
    }

    const secondConfirm =
      window.confirm(
        "Final confirmation: delete ALL reports?"
      );

    if (!secondConfirm) {
      return;
    }

    try {
      setDeletingAll(true);

      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_URL}/api/admin/reports`,
        {
          method: "DELETE",
          headers: getAdminHeaders(),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to delete all reports."
        );
      }

      setReports([]);

      setSelectedReport(null);

      setSuccess(
        "All reports deleted successfully."
      );

    } catch (err) {
      console.error(
        "Delete all reports error:",
        err
      );

      setError(
        err.message ||
          "Unable to delete all reports."
      );

    } finally {
      setDeletingAll(false);
    }
  };


  // ============================================================
  // ADMIN LOGOUT
  // ============================================================

  const handleLogout = () => {
    const token = getAdminToken();

    // Clear local session immediately so logout never waits on the API.
    sessionStorage.removeItem("admin_token");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("role");
    localStorage.removeItem("admin_email");
    localStorage.removeItem("admin_username");

    if (token) {
      fetch(`${API_URL}/api/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    }

    navigate("/adminlogin", { replace: true });
  };


  // ============================================================
  // STATISTICS
  // ============================================================

  const stats = useMemo(() => {
    const pending =
      reports.filter(
        (report) =>
          getAnalysisStatus(
            report.analysis
          ).className === "pending"
      ).length;

    const analyzed =
      reports.filter(
        (report) =>
          getAnalysisStatus(
            report.analysis
          ).className === "analyzed"
      ).length;

    const failed =
      reports.filter(
        (report) =>
          getAnalysisStatus(
            report.analysis
          ).className === "failed"
      ).length;

    const critical =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "critical"
      ).length;

    const high =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "high"
      ).length;

    const medium =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "medium"
      ).length;

    const low =
      reports.filter(
        (report) =>
          String(
            report.priority || ""
          ).toLowerCase() ===
          "low"
      ).length;

    const unassigned =
      reports.filter(
        (report) =>
          !report.assigned_operator_id
      ).length;

    const assigned =
      reports.filter(
        (report) =>
          String(
            report.status || ""
          ).toLowerCase() ===
          "assigned"
      ).length;

    const inProgress =
      reports.filter(
        (report) =>
          String(
            report.status || ""
          ).toLowerCase() ===
          "in progress"
      ).length;

    const completed =
      reports.filter(
        (report) =>
          String(
            report.status || ""
          ).toLowerCase() ===
          "completed"
      ).length;

    return {
      total: reports.length,
      pending,
      analyzed,
      failed,
      critical,
      high,
      medium,
      low,
      unassigned,
      assigned,
      inProgress,
      completed,
    };
  }, [reports]);


  // ============================================================
  // SEARCH + FILTER
  // ============================================================

  const filteredReports = useMemo(() => {
    const searchTerms =
      search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    return reports.filter(
      (report) => {
        const analysisStatus =
          getAnalysisStatus(
            report.analysis
          );

        const priority =
          String(
            report.priority || ""
          )
            .trim()
            .toLowerCase();

        const damageType =
          String(
            report.damage_type || ""
          )
            .trim()
            .toLowerCase();

        const severity =
          String(
            report.severity || ""
          )
            .trim()
            .toLowerCase();

        const trackingStatus =
          String(
            report.status ||
              "Unassigned"
          )
            .trim()
            .toLowerCase();

        const searchableText = [
          report.id,
          report.user_id,
          report.location,
          report.damage_type,
          report.severity,
          report.priority,
          report.priority_score,
          report.status,
          report.assigned_operator_id,
          report.created_at,
        ]
          .map((value) =>
            String(
              value ?? ""
            ).toLowerCase()
          )
          .join(" ");

        const matchesSearch =
          searchTerms.length === 0 ||
          searchTerms.every(
            (term) => {
              return searchableText.includes(
                term
              );
            }
          );

        const matchesStatus =
          statusFilter === "all" ||
          trackingStatus ===
            statusFilter;

        const matchesPriority =
          priorityFilter === "all" ||
          priority ===
            priorityFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesPriority
        );
      }
    );
  }, [
    reports,
    search,
    statusFilter,
    priorityFilter,
  ]);


  // ============================================================
  // FIND OPERATOR
  // ============================================================

  const getOperatorById = (
    operatorId
  ) => {
    if (!operatorId) {
      return null;
    }

    return operators.find(
      (operator) =>
        Number(operator.id) ===
        Number(operatorId)
    );
  };


  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setError("");
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: getAdminHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || "Unable to load users.");
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      console.error("Fetch users error:", err);
      setError(err.message || "Unable to load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const openSection = (section) => {
    setError("");
    setSuccess("");
    setActiveSection(section);
    if (section === "reports") {
      fetchReports();
      fetchOperators();
    } else if (section === "operators") {
      fetchOperators();
    } else if (section === "users") {
      fetchUsers();
    }
  };

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div className="admin-dashboard-brand">
          <div className="admin-dashboard-logo">🛡️</div>
          <div><h2>RoadGuard AI</h2><span>Administration Portal</span></div>
        </div>
        <div className="admin-dashboard-actions">
          <div className="admin-profile"><div className="admin-profile-avatar">A</div><div><strong>Administrator</strong><span>{localStorage.getItem("admin_email") || "admin@gmail.com"}</span></div></div>
        </div>
      </header>
      <div className="admin-layout" style={{display:"grid",gridTemplateColumns:"250px minmax(0,1fr)",minHeight:"calc(100vh - 82px)"}}>
        <aside className="admin-sidebar" style={{padding:"28px 18px",borderRight:"1px solid rgba(15,23,42,.08)",background:"#fff"}}>
          <div style={{fontWeight:800,fontSize:"18px",marginBottom:"24px",padding:"0 12px"}}>🛡️ ADMIN</div>
          <nav style={{display:"grid",gap:"8px"}}>
            <button type="button" onClick={()=>openSection("overview")} className={`admin-sidebar-button ${activeSection === "overview" ? "active" : ""}`}>🏠 Dashboard</button>
            <button type="button" onClick={()=>openSection("users")} className={`admin-sidebar-button ${activeSection === "users" ? "active" : ""}`}>👤 User Management</button>
            <button type="button" onClick={()=>openSection("operators")} className={`admin-sidebar-button ${activeSection === "operators" ? "active" : ""}`}>👷 Operator Management</button>
            <button type="button" onClick={()=>openSection("reports")} className={`admin-sidebar-button ${activeSection === "reports" ? "active" : ""}`}>📋 Reports Management</button>
          </nav>
          <button type="button" onClick={handleLogout} className="admin-sidebar-button" style={{marginTop:"30px"}}>🚪 Logout</button>
        </aside>
        <main className="admin-dashboard-main" style={{minWidth:0}}>
          <div className="admin-dashboard-heading"><div><h1>{activeSection === "overview" ? "ADMIN DASHBOARD" : activeSection === "reports" ? "Reports Management" : activeSection === "operators" ? "Operator Management" : "User Management"}</h1><p>Manage road reports, operators, and registered users.</p></div></div>
          {error && <div className="admin-dashboard-error" style={{marginBottom:"12px"}}>{error}</div>}
          {success && <div style={{padding:"12px 16px",marginBottom:"16px",borderRadius:"10px",background:"rgba(34,197,94,.12)",border:"1px solid rgba(34,197,94,.3)",color:"#166534",fontWeight:600}}>{success}</div>}
          {activeSection === "overview" && (
            <section>
              <div className="admin-stat-grid">
                <div className="admin-stat-card"><span>All Reports</span><strong>{stats.total}</strong></div>
                <div className="admin-stat-card"><span>Assigned</span><strong>{stats.assigned}</strong></div>
                <div className="admin-stat-card"><span>Unassigned</span><strong>{stats.unassigned}</strong></div>
                <div className="admin-stat-card"><span>In Progress</span><strong>{stats.inProgress}</strong></div>
                <div className="admin-stat-card"><span>Completed</span><strong>{stats.completed}</strong></div>
                <div className="admin-stat-card"><span>Critical</span><strong>{stats.critical}</strong></div>
                <div className="admin-stat-card"><span>High</span><strong>{stats.high}</strong></div>
                <div className="admin-stat-card"><span>Medium</span><strong>{stats.medium}</strong></div>
                <div className="admin-stat-card"><span>Low Score</span><strong>{stats.low}</strong></div>
              </div>
            </section>
          )}

          {activeSection === "operators" && (
            <section className="admin-reports-container">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"15px",flexWrap:"wrap",marginBottom:"24px"}}>
                <div><h2>👷 Operator Management</h2><p>Create and manage operators who handle assigned road reports.</p></div>
                <button type="button" className="admin-view-button" onClick={()=>setShowCreateOperator(v=>!v)}>{showCreateOperator?"Close Form":"+ Create Operator"}</button>
              </div>
              {showCreateOperator && (
                <form onSubmit={createOperator} style={{padding:"22px",border:"1px solid #e5e7eb",borderRadius:"14px",marginBottom:"25px",background:"#fff"}}>
                  <h3>Create Operator</h3>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:"15px",marginTop:"15px"}}>
                    <input type="text" value={operatorUsername} onChange={e=>setOperatorUsername(e.target.value)} placeholder="Operator username" disabled={creatingOperator} style={{padding:"12px"}}/>
                    <input type="password" value={operatorPassword} onChange={e=>setOperatorPassword(e.target.value)} placeholder="Operator password" disabled={creatingOperator} style={{padding:"12px"}}/>
                  </div>
                  <button type="submit" className="admin-view-button" disabled={creatingOperator} style={{marginTop:"16px"}}>{creatingOperator?"Creating...":"Create Operator"}</button>
                </form>
              )}
              <h3>Operators List</h3>
              {operatorsLoading ? <div className="admin-empty-state"><p>Loading operators...</p></div> : operators.length===0 ? <div className="admin-empty-state"><h3>No operators found</h3><p>Create an operator to assign road reports.</p></div> : <div style={{display:"grid",gap:"12px",marginTop:"15px"}}>{operators.map(operator=><div key={operator.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"15px",padding:"16px",border:"1px solid #e5e7eb",borderRadius:"12px",background:"#fff"}}><div><strong>{operator.username||operator.email||`Operator #${operator.id}`}</strong><p style={{margin:"5px 0 0"}}>ID: {operator.id} • Role: {operator.role||"operator"}</p></div><button type="button" className="admin-delete-button" onClick={()=>deleteOperator(operator.id)} disabled={deletingOperatorId===operator.id}>{deletingOperatorId===operator.id?"Deleting...":"Delete"}</button></div>)}</div>}
            </section>
          )}

          {activeSection === "users" && (
            <section className="admin-reports-container">
              <h2>👤 User Management</h2>
              <p style={{marginBottom:"24px"}}>Registered RoadGuard users.</p>
              {usersLoading ? <div className="admin-empty-state"><p>Loading users...</p></div> : users.length===0 ? <div className="admin-empty-state"><h3>No users found</h3></div> : <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"#fff"}}><thead><tr><th style={{textAlign:"left",padding:"14px",borderBottom:"1px solid #e5e7eb"}}>ID</th><th style={{textAlign:"left",padding:"14px",borderBottom:"1px solid #e5e7eb"}}>Username / Email</th><th style={{textAlign:"left",padding:"14px",borderBottom:"1px solid #e5e7eb"}}>Role</th></tr></thead><tbody>{users.map(user=><tr key={user.id}><td style={{padding:"14px",borderBottom:"1px solid #f0f0f0"}}>{user.id}</td><td style={{padding:"14px",borderBottom:"1px solid #f0f0f0"}}>{user.username||user.email||"N/A"}</td><td style={{padding:"14px",borderBottom:"1px solid #f0f0f0"}}>{user.role||"user"}</td></tr>)}</tbody></table></div>}
            </section>
          )}

          {activeSection === "reports" && (
            <section
          className="admin-reports-container"
        >

          <div
            className="admin-report-tools"
          >

            <div>

              <h2>
                Report Management
              </h2>

              <p>
                {filteredReports.length}{" "}
                of {reports.length} reports
                shown
              </p>

            </div>


            <div
              className="admin-report-tools-actions"
            >

              <input
                className="admin-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search reports..."
              />


              {/* TRACKING STATUS FILTER */}

              <select
                className="admin-filter"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All Tracking Status
                </option>

                <option value="unassigned">
                  Unassigned
                </option>

                <option value="assigned">
                  Assigned
                </option>

                <option value="in progress">
                  In Progress
                </option>

                <option value="completed">
                  Completed
                </option>

              </select>


              {/* PRIORITY FILTER */}

              <select
                className="admin-filter"
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
              >

                <option value="all">
                  All Priorities
                </option>

                <option value="critical">
                  Critical
                </option>

                <option value="high">
                  High
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="low">
                  Low
                </option>

                <option value="not determinable">
                  Not Determinable
                </option>

              </select>


              <button
                type="button"
                className="admin-delete-all-button"
                onClick={
                  deleteAllReports
                }
                disabled={
                  deletingAll ||
                  reports.length === 0
                }
              >
                {deletingAll
                  ? "Deleting..."
                  : "Delete All"}
              </button>

            </div>

          </div>


          {/* ==================================================
              LOADING
          ================================================== */}

          {loading ? (

            <div
              className="admin-empty-state"
            >

              <div className="admin-loading-spinner"></div>

              <p>
                Loading reports...
              </p>

            </div>

          ) : filteredReports.length === 0 ? (

            <div
              className="admin-empty-state"
            >

              <div className="admin-empty-icon">
                📋
              </div>

              <h3>
                {reports.length === 0
                  ? "No reports available"
                  : "No matching reports"}
              </h3>

              <p>
                {reports.length === 0
                  ? "There are currently no road damage reports."
                  : "Try changing the search or filter."}
              </p>

            </div>

          ) : (

            /* ==================================================
               REPORT GRID
            ================================================== */

            <div
              className="admin-report-grid"
            >

              {filteredReports.map(
                (report) => {

                  const analysisStatus =
                    getAnalysisStatus(
                      report.analysis
                    );

                  const trackingStatus =
                    getTrackingStatus(
                      report
                    );

                  const priority =
                    getPriorityLabel(
                      report
                    );

                  const priorityClass =
                    getPriorityClass(
                      priority
                    );

                  const score =
                    getPriorityScore(
                      report
                    );

                  const assignedOperator =
                    getOperatorById(
                      report.assigned_operator_id
                    );


                  return (

                    <article
                      className="admin-report-card"
                      key={report.id}
                    >

                      {/* IMAGE */}

                      <div
                        className="admin-report-image-wrapper"
                      >

                        {report.image_path ? (

                          <img
                            className="admin-report-image"
                            src={getImageUrl(
                              report.image_path
                            )}
                            alt="Road damage report"
                          />

                        ) : (

                          <div
                            className="admin-report-image-placeholder"
                          >
                            No Image
                          </div>

                        )}


                        <span
                          className={`admin-report-status ${analysisStatus.className}`}
                        >
                          {analysisStatus.label}
                        </span>

                      </div>


                      {/* BODY */}

                      <div
                        className="admin-report-body"
                      >

                        <div
                          className="admin-report-meta"
                        >

                          <span>
                            Report #{report.id}
                          </span>

                          <span>
                            User #{report.user_id}
                          </span>

                        </div>


                        {/* LOCATION */}

                        <div
                          className="admin-report-location"
                        >
                          📍{" "}
                          {report.location ||
                            "Location not available"}
                        </div>


                        {/* AI DATA */}

                        <div
                          style={{
                            display: "grid",
                            gap: "8px",
                            marginTop:
                              "14px",
                          }}
                        >

                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                            }}
                          >
                            <strong>
                              Damage
                            </strong>

                            <span>
                              {report.damage_type ||
                                "Not determinable"}
                            </span>
                          </div>


                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                            }}
                          >
                            <strong>
                              Severity
                            </strong>

                            <span>
                              {report.severity ||
                                "Not determinable"}
                            </span>
                          </div>


                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "10px",
                            }}
                          >
                            <strong>
                              Priority
                            </strong>

                            <span
                              style={{
                                fontWeight:
                                  700,
                                padding:
                                  "4px 10px",
                                borderRadius:
                                  "999px",
                                background:
                                  priorityClass ===
                                  "critical"
                                    ? "rgba(239,68,68,0.16)"
                                    : priorityClass ===
                                      "high"
                                    ? "rgba(249,115,22,0.16)"
                                    : priorityClass ===
                                      "medium"
                                    ? "rgba(234,179,8,0.16)"
                                    : priorityClass ===
                                      "low"
                                    ? "rgba(34,197,94,0.16)"
                                    : "rgba(148,163,184,0.16)",
                              }}
                            >
                              {priority}
                            </span>
                          </div>


                          {score !== null && (

                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                              }}
                            >

                              <strong>
                                Priority Score
                              </strong>

                              <span>
                                {score} / 100
                              </span>

                            </div>

                          )}

                        </div>


                        {/* ==================================================
                            ASSIGNMENT
                        ================================================== */}

                        <div
                          style={{
                            marginTop:
                              "16px",
                            padding:
                              "12px",
                            borderRadius:
                              "10px",
                            background:
                              "rgba(255,255,255,0.04)",
                            border:
                              "1px solid rgba(255,255,255,0.08)",
                          }}
                        >

                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                700,
                              marginBottom:
                                "8px",
                            }}
                          >
                            WORK ASSIGNMENT
                          </div>


                          <div
                            style={{
                              display:
                                "flex",
                              gap: "8px",
                              flexWrap:
                                "wrap",
                            }}
                          >

                            <select
                              value={
                                report.assigned_operator_id ||
                                ""
                              }
                              onChange={(
                                event
                              ) => {

                                const value =
                                  event.target
                                    .value;

                                if (
                                  value
                                ) {
                                  assignReport(
                                    report.id,
                                    value
                                  );
                                }

                              }}
                              disabled={
                                assigningId ===
                                report.id ||
                                operators.length ===
                                  0
                              }
                              style={{
                                flex:
                                  "1 1 180px",
                                padding:
                                  "9px",
                                borderRadius:
                                  "7px",
                                background:
                                  "rgba(255,255,255,0.06)",
                                color:
                                  "inherit",
                                border:
                                  "1px solid rgba(255,255,255,0.12)",
                              }}
                            >

                              <option value="">
                                {operators.length ===
                                0
                                  ? "No operators available"
                                  : "Select operator"}
                              </option>

                              {operators.map(
                                (
                                  operator
                                ) => (

                                  <option
                                    key={
                                      operator.id
                                    }
                                    value={
                                      operator.id
                                    }
                                  >
                                    {operator.username ||
                                      operator.email}
                                  </option>

                                )
                              )}

                            </select>


                            {report.assigned_operator_id && (

                              <button
                                type="button"
                                onClick={() =>
                                  unassignReport(
                                    report.id
                                  )
                                }
                                disabled={
                                  assigningId ===
                                  report.id
                                }
                                style={{
                                  padding:
                                    "8px 10px",
                                  borderRadius:
                                    "7px",
                                  border:
                                    "1px solid rgba(239,68,68,0.35)",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Unassign
                              </button>

                            )}

                          </div>


                          <div
                            style={{
                              marginTop:
                                "9px",
                              fontSize:
                                "12px",
                              opacity:
                                0.75,
                            }}
                          >

                            Operator:{" "}

                            <strong>
                              {assignedOperator
                                ? assignedOperator.username ||
                                  assignedOperator.email
                                : "Not assigned"}
                            </strong>

                          </div>


                          <div
                            style={{
                              marginTop:
                                "6px",
                              fontSize:
                                "12px",
                            }}
                          >

                            Status:{" "}

                            <strong>
                              {trackingStatus.label}
                            </strong>

                          </div>

                        </div>


                        {/* DATE */}

                        <div
                          style={{
                            marginTop:
                              "10px",
                            fontSize:
                              "12px",
                            opacity:
                              0.7,
                          }}
                        >
                          {formatDate(
                            report.created_at
                          )}
                        </div>


                        {/* ANALYSIS PREVIEW */}

                        <p
                          className="admin-report-analysis-preview"
                        >
                          {report.analysis ||
                            "Pending analysis"}
                        </p>


                        {/* ACTIONS */}

                        <div
                          className="admin-report-card-actions"
                        >

                          <button
                            type="button"
                            className="admin-view-button"
                            onClick={() =>
                              setSelectedReport(
                                report
                              )
                            }
                          >
                            View Details
                          </button>


                          <button
                            type="button"
                            className="admin-delete-button"
                            onClick={() =>
                              deleteReport(
                                report.id
                              )
                            }
                            disabled={
                              deletingId ===
                              report.id
                            }
                          >
                            {deletingId ===
                            report.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>

                        </div>

                      </div>

                    </article>

                  );
                }
              )}

            </div>

          )}

        </section>
          )}
        </main>
      </div>

      {/* ======================================================
          REPORT DETAILS MODAL
      ======================================================== */}

      {selectedReport && (

        <div
          className="admin-modal-backdrop"
          onClick={() =>
            setSelectedReport(null)
          }
        >

          <div
            className="admin-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div
              className="admin-modal-header"
            >

              <div>

                <h2>
                  Report #{selectedReport.id}
                </h2>

                <p>
                  Road damage report details
                </p>

              </div>


              <button
                type="button"
                className="admin-modal-close"
                onClick={() =>
                  setSelectedReport(null)
                }
              >
                ×
              </button>

            </div>


            {/* IMAGE */}

            {selectedReport.image_path && (

              <img
                className="admin-modal-image"
                src={getImageUrl(
                  selectedReport.image_path
                )}
                alt="Road damage"
              />

            )}


            {/* CONTENT */}

            <div
              className="admin-modal-content"
            >

              {/* LOCATION */}

              <div
                className="admin-location-box"
              >

                <strong>
                  Location
                </strong>

                <p>
                  {selectedReport.location ||
                    "Location not available"}
                </p>

              </div>


              {/* ==================================================
                  WORK ASSIGNMENT / TRACKING
              ================================================== */}

              <div
                className="admin-analysis-box"
                style={{
                  marginTop: "16px",
                }}
              >

                <strong>
                  Work Assignment & Tracking
                </strong>


                <div
                  style={{
                    display:
                      "grid",
                    gap: "12px",
                    marginTop:
                      "16px",
                  }}
                >

                  {/* ASSIGNMENT */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                        marginBottom:
                          "7px",
                      }}
                    >
                      Assigned Operator
                    </div>


                    <div
                      style={{
                        display:
                          "flex",
                        gap:
                          "8px",
                        alignItems:
                          "center",
                        flexWrap:
                          "wrap",
                      }}
                    >

                      <select
                        value={
                          selectedReport.assigned_operator_id ||
                          ""
                        }
                        onChange={(
                          event
                        ) => {

                          const value =
                            event.target
                              .value;

                          if (
                            value
                          ) {

                            assignReport(
                              selectedReport.id,
                              value
                            );

                          }

                        }}
                        disabled={
                          assigningId ===
                          selectedReport.id
                        }
                        style={{
                          flex:
                            "1 1 220px",
                          padding:
                            "9px",
                          borderRadius:
                            "7px",
                          background:
                            "rgba(255,255,255,0.06)",
                          color:
                            "inherit",
                          border:
                            "1px solid rgba(255,255,255,0.12)",
                        }}
                      >

                        <option value="">
                          Select operator
                        </option>

                        {operators.map(
                          (
                            operator
                          ) => (

                            <option
                              key={
                                operator.id
                              }
                              value={
                                operator.id
                              }
                            >
                              {operator.username ||
                                operator.email}
                            </option>

                          )
                        )}

                      </select>


                      {selectedReport.assigned_operator_id && (

                        <button
                          type="button"
                          onClick={() =>
                            unassignReport(
                              selectedReport.id
                            )
                          }
                          disabled={
                            assigningId ===
                            selectedReport.id
                          }
                        >
                          Unassign
                        </button>

                      )}

                    </div>

                  </div>


                  {/* TRACKING STATUS */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                        marginBottom:
                          "7px",
                      }}
                    >
                      Tracking Status
                    </div>


                    <strong>
                      {
                        getTrackingStatus(
                          selectedReport
                        ).label
                      }
                    </strong>

                  </div>


                  {/* ASSIGNED DATE */}

                  {selectedReport.assigned_at && (

                    <div
                      style={{
                        padding:
                          "12px 14px",
                        borderRadius:
                          "10px",
                        background:
                          "rgba(255,255,255,0.06)",
                        border:
                          "1px solid rgba(255,255,255,0.10)",
                      }}
                    >

                      <div
                        style={{
                          fontSize:
                            "11px",
                          fontWeight:
                            700,
                          textTransform:
                            "uppercase",
                          opacity:
                            0.7,
                          marginBottom:
                            "7px",
                        }}
                      >
                        Assigned At
                      </div>

                      <div>
                        {formatDate(
                          selectedReport.assigned_at
                        )}
                      </div>

                    </div>

                  )}


                  {/* COMPLETED DATE */}

                  {selectedReport.completed_at && (

                    <div
                      style={{
                        padding:
                          "12px 14px",
                        borderRadius:
                          "10px",
                        background:
                          "rgba(255,255,255,0.06)",
                        border:
                          "1px solid rgba(255,255,255,0.10)",
                      }}
                    >

                      <div
                        style={{
                          fontSize:
                            "11px",
                          fontWeight:
                            700,
                          textTransform:
                            "uppercase",
                          opacity:
                            0.7,
                          marginBottom:
                            "7px",
                        }}
                      >
                        Completed At
                      </div>

                      <div>
                        {formatDate(
                          selectedReport.completed_at
                        )}
                      </div>

                    </div>

                  )}

                </div>

              </div>


              {/* ==================================================
                  ROAD DAMAGE ASSESSMENT
              ================================================== */}

              <div
                className="admin-analysis-box"
                style={{
                  marginTop: "16px",
                }}
              >

                <strong>
                  Road Damage Assessment
                </strong>


                <div
                  style={{
                    display:
                      "grid",
                    gap:
                      "12px",
                    marginTop:
                      "16px",
                  }}
                >

                  {/* DAMAGE TYPE */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                      }}
                    >
                      Damage Type
                    </div>

                    <div
                      style={{
                        marginTop:
                          "5px",
                      }}
                    >
                      {selectedReport.damage_type ||
                        "Not determinable"}
                    </div>

                  </div>


                  {/* SEVERITY */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                      }}
                    >
                      Severity
                    </div>

                    <div
                      style={{
                        marginTop:
                          "5px",
                        fontWeight:
                          700,
                      }}
                    >
                      {selectedReport.severity ||
                        "Not determinable"}
                    </div>

                  </div>


                  {/* PRIORITY */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                      }}
                    >
                      Maintenance Priority
                    </div>

                    <div
                      style={{
                        marginTop:
                          "6px",
                        fontWeight:
                          700,
                      }}
                    >
                      {selectedReport.priority ||
                        "Not determinable"}
                    </div>

                  </div>


                  {/* SCORE */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                      }}
                    >
                      Priority Score
                    </div>

                    <div
                      style={{
                        marginTop:
                          "5px",
                        fontSize:
                          "22px",
                        fontWeight:
                          800,
                      }}
                    >
                      {getPriorityScore(
                        selectedReport
                      ) !== null
                        ? `${getPriorityScore(
                            selectedReport
                          )} / 100`
                        : "Not available"}
                    </div>

                  </div>


                  {/* CREATED */}

                  <div
                    style={{
                      padding:
                        "12px 14px",
                      borderRadius:
                        "10px",
                      background:
                        "rgba(255,255,255,0.06)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                    }}
                  >

                    <div
                      style={{
                        fontSize:
                          "11px",
                        fontWeight:
                          700,
                        textTransform:
                          "uppercase",
                        opacity:
                          0.7,
                      }}
                    >
                      Report Created
                    </div>

                    <div
                      style={{
                        marginTop:
                          "5px",
                      }}
                    >
                      {formatDate(
                        selectedReport.created_at
                      )}
                    </div>

                  </div>

                </div>

              </div>


              {/* ==================================================
                  ORIGINAL GEMINI ANALYSIS
              ================================================== */}

              <div
                className="admin-analysis-box"
                style={{
                  marginTop:
                    "16px",
                }}
              >

                <strong>
                  Gemini Analysis
                </strong>

                <p
                  style={{
                    marginTop:
                      "14px",
                    lineHeight:
                      1.6,
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {selectedReport.analysis ||
                    "Pending analysis"}
                </p>

              </div>

            </div>


            {/* MODAL ACTIONS */}

            <div
              className="admin-modal-actions"
            >

              {selectedReport.location && (

                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    selectedReport.location
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-map-button"
                >
                  Open in Maps
                </a>

              )}


              <button
                type="button"
                className="admin-delete-button"
                onClick={() =>
                  deleteReport(
                    selectedReport.id
                  )
                }
                disabled={
                  deletingId ===
                  selectedReport.id
                }
              >
                {deletingId ===
                selectedReport.id
                  ? "Deleting..."
                  : "Delete Report"}
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default AdminDashboard;
