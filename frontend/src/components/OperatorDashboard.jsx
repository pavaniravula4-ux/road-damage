import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";


function OperatorDashboard({
  setRole,
  setUserId,
}) {
  const navigate = useNavigate();

  const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://127.0.0.1:5000";


  // ============================================================
  // STATE
  // ============================================================

  const [reports, setReports] = useState([]);

  const [search, setSearch] = useState("");

  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedReport, setSelectedReport] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [updatingReportId, setUpdatingReportId] =
    useState(null);

  const [error, setError] =
    useState("");


  // ============================================================
  // OPERATOR INFORMATION
  // ============================================================

  const operatorUsername =
    localStorage.getItem("operator_username") ||
    localStorage.getItem("username") ||
    "Operator";


  const operatorId = Number(
    localStorage.getItem("operator_user_id") ||
    localStorage.getItem("user_id") ||
    0
  );


  // ============================================================
  // FRONTEND LOGOUT
  //
  // IMPORTANT:
  // There is intentionally NO backend logout request here.
  // This makes logout immediate.
  // ============================================================

  const handleLogout = () => {
    // Remove authentication/session information immediately.

    sessionStorage.removeItem(
      "operator_token"
    );

    localStorage.removeItem(
      "operator_username"
    );

    localStorage.removeItem(
      "operator_user_id"
    );

    localStorage.removeItem(
      "username"
    );

    localStorage.removeItem(
      "user_id"
    );

    localStorage.removeItem(
      "role"
    );


    // IMPORTANT:
    // Update App.jsx React state immediately.
    //
    // Without this, App.jsx may still think the role
    // is "operator" and redirect back to the dashboard.

    if (typeof setRole === "function") {
      setRole(null);
    }

    if (typeof setUserId === "function") {
      setUserId(null);
    }


    // Close modal if open.

    setSelectedReport(null);


    // Navigate immediately.
    //
    // No fetch.
    // No await.
    // No refresh.
    // No report loading.

    navigate(
      "/operator-login",
      {
        replace: true,
      }
    );
  };


  // ============================================================
  // AUTH REDIRECT
  // ============================================================

  const redirectToLogin = () => {
    sessionStorage.removeItem(
      "operator_token"
    );

    localStorage.removeItem(
      "operator_username"
    );

    localStorage.removeItem(
      "operator_user_id"
    );

    localStorage.removeItem(
      "username"
    );

    localStorage.removeItem(
      "user_id"
    );

    localStorage.removeItem(
      "role"
    );


    if (typeof setRole === "function") {
      setRole(null);
    }

    if (typeof setUserId === "function") {
      setUserId(null);
    }


    navigate(
      "/operator-login",
      {
        replace: true,
      }
    );
  };


  // ============================================================
  // FETCH REPORTS
  // ============================================================

  const fetchReports = async () => {
    const token =
      sessionStorage.getItem(
        "operator_token"
      );


    // No token.
    if (!token) {
      setLoading(false);
      redirectToLogin();
      return;
    }


    setLoading(true);
    setError("");


    try {
      const response =
        await fetch(
          `${API_URL}/api/operator/reports`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }


      // ========================================================
      // AUTHENTICATION FAILURE
      // ========================================================

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        redirectToLogin();
        return;
      }


      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to load reports."
        );
      }


      if (!Array.isArray(data)) {
        throw new Error(
          "Invalid report data received from server."
        );
      }


      setReports(data);

    } catch (err) {
      console.error(
        "Operator reports error:",
        err
      );

      setError(
        err.message ||
        "Unable to connect to the server."
      );

    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchReports();

    // Intentionally run only once when dashboard mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ============================================================
  // NORMALIZE STATUS
  // ============================================================

  const normalizeStatus = (status) => {
    const value =
      String(
        status || "Unassigned"
      )
        .trim()
        .toLowerCase();


    if (value === "assigned") {
      return "Assigned";
    }


    if (
      value === "in progress" ||
      value === "in_progress" ||
      value === "in-progress"
    ) {
      return "In Progress";
    }


    if (
      value === "completed" ||
      value === "complete"
    ) {
      return "Completed";
    }


    return "Unassigned";
  };


  // ============================================================
  // NORMALIZE PRIORITY
  // ============================================================

  const normalizePriority = (priority) => {
    const value =
      String(
        priority || ""
      )
        .trim()
        .toLowerCase();


    if (value === "critical") {
      return "critical";
    }


    if (value === "high") {
      return "high";
    }


    if (value === "medium") {
      return "medium";
    }


    if (value === "low") {
      return "low";
    }


    return "";
  };


  // ============================================================
  // CHECK CURRENT OPERATOR
  // ============================================================

  const isAssignedToCurrentOperator = (
    report
  ) => {
    if (!operatorId) {
      return false;
    }


    return (
      Number(
        report.assigned_operator_id
      ) === Number(operatorId)
    );
  };


  // ============================================================
  // ASSIGNED REPORTS
  // ============================================================

  const assignedReports = useMemo(() => {
    return reports.filter(
      (report) =>
        isAssignedToCurrentOperator(
          report
        )
    );
  }, [
    reports,
    operatorId,
  ]);


  // ============================================================
  // FILTER REPORTS
  // ============================================================

  const filteredReports = useMemo(() => {
    const searchText =
      search
        .trim()
        .toLowerCase();


    const selectedPriority =
      String(
        priorityFilter || "all"
      )
        .trim()
        .toLowerCase();


    const selectedStatus =
      String(
        statusFilter || "all"
      )
        .trim()
        .toLowerCase();


    return assignedReports.filter(
      (report) => {

        const damageType =
          String(
            report.damage_type || ""
          )
            .trim()
            .toLowerCase();


        const location =
          String(
            report.location || ""
          )
            .trim()
            .toLowerCase();


        const severity =
          String(
            report.severity || ""
          )
            .trim()
            .toLowerCase();


        const priority =
          normalizePriority(
            report.priority
          );


        const status =
          normalizeStatus(
            report.status
          ).toLowerCase();


        const reportId =
          String(
            report.id || ""
          )
            .trim()
            .toLowerCase();


        const matchesSearch =
          !searchText ||
          damageType.includes(
            searchText
          ) ||
          location.includes(
            searchText
          ) ||
          severity.includes(
            searchText
          ) ||
          priority.includes(
            searchText
          ) ||
          status.includes(
            searchText
          ) ||
          reportId.includes(
            searchText
          );


        const matchesPriority =
          selectedPriority === "all" ||
          priority ===
            selectedPriority;


        const matchesStatus =
          selectedStatus === "all" ||
          status ===
            selectedStatus;


        return (
          matchesSearch &&
          matchesPriority &&
          matchesStatus
        );
      }
    );
  }, [
    assignedReports,
    search,
    priorityFilter,
    statusFilter,
  ]);


  // ============================================================
  // STATISTICS
  // ============================================================

  const totalAssigned =
    assignedReports.length;


  const assignedCount =
    assignedReports.filter(
      (report) =>
        normalizeStatus(
          report.status
        ) === "Assigned"
    ).length;


  const inProgressCount =
    assignedReports.filter(
      (report) =>
        normalizeStatus(
          report.status
        ) === "In Progress"
    ).length;


  const completedCount =
    assignedReports.filter(
      (report) =>
        normalizeStatus(
          report.status
        ) === "Completed"
    ).length;


  const criticalPriorityCount =
    assignedReports.filter(
      (report) =>
        normalizePriority(
          report.priority
        ) === "critical"
    ).length;


  const highPriorityCount =
    assignedReports.filter(
      (report) =>
        normalizePriority(
          report.priority
        ) === "high"
    ).length;


  const mediumPriorityCount =
    assignedReports.filter(
      (report) =>
        normalizePriority(
          report.priority
        ) === "medium"
    ).length;


  const lowPriorityCount =
    assignedReports.filter(
      (report) =>
        normalizePriority(
          report.priority
        ) === "low"
    ).length;


  // ============================================================
  // UPDATE REPORT STATUS
  // ============================================================

  const updateReportStatus = async (
    reportId,
    newStatus
  ) => {

    const token =
      sessionStorage.getItem(
        "operator_token"
      );


    if (!token) {
      redirectToLogin();
      return;
    }


    setUpdatingReportId(
      reportId
    );

    setError("");


    try {
      const response =
        await fetch(
          `${API_URL}/api/operator/reports/${reportId}/status`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              status:
                newStatus,
            }),
          }
        );


      let data = {};

      try {
        data =
          await response.json();
      } catch {
        data = {};
      }


      // ========================================================
      // AUTH FAILURE
      // ========================================================

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        redirectToLogin();
        return;
      }


      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to update report status."
        );
      }


      // ========================================================
      // UPDATE REPORT LOCALLY
      //
      // IMPORTANT:
      // We DO NOT call fetchReports() here.
      //
      // This prevents the dashboard from showing
      // "Loading assigned road reports..." after
      // Start Work / Mark Completed.
      // ========================================================

      setReports(
        (previousReports) =>
          previousReports.map(
            (report) => {

              if (
                Number(report.id) !==
                Number(reportId)
              ) {
                return report;
              }


              return {
                ...report,

                ...(data.report || {}),

                status:
                  data.report?.status ||
                  newStatus,

                assigned_at:
                  data.report?.assigned_at ??
                  report.assigned_at,

                completed_at:
                  data.report?.completed_at ??
                  (
                    newStatus === "Completed"
                      ? new Date().toISOString()
                      : report.completed_at
                  ),
              };
            }
          )
      );


      // ========================================================
      // UPDATE OPEN MODAL
      // ========================================================

      setSelectedReport(
        (current) => {

          if (
            !current ||
            Number(current.id) !==
              Number(reportId)
          ) {
            return current;
          }


          return {
            ...current,

            ...(data.report || {}),

            status:
              data.report?.status ||
              newStatus,

            assigned_at:
              data.report?.assigned_at ??
              current.assigned_at,

            completed_at:
              data.report?.completed_at ??
              (
                newStatus === "Completed"
                  ? new Date().toISOString()
                  : current.completed_at
              ),
          };
        }
      );

    } catch (err) {
      console.error(
        "Status update error:",
        err
      );

      setError(
        err.message ||
        "Unable to update report status."
      );

    } finally {
      setUpdatingReportId(
        null
      );
    }
  };


  // ============================================================
  // START WORK
  // ============================================================

  const handleStartWork = (
    report
  ) => {

    const status =
      normalizeStatus(
        report.status
      );


    if (
      status === "Completed"
    ) {
      return;
    }


    updateReportStatus(
      report.id,
      "In Progress"
    );
  };


  // ============================================================
  // COMPLETE WORK
  // ============================================================

  const handleCompleteWork = (
    report
  ) => {

    const status =
      normalizeStatus(
        report.status
      );


    if (
      status === "Completed"
    ) {
      return;
    }


    updateReportStatus(
      report.id,
      "Completed"
    );
  };


  // ============================================================
  // FORMAT DATE
  // ============================================================

  const formatDate = (
    dateValue
  ) => {

    if (!dateValue) {
      return "Not available";
    }


    const date =
      new Date(dateValue);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(
        dateValue
      );
    }


    return date.toLocaleString(
      "en-IN",
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      }
    );
  };


  // ============================================================
  // PRIORITY CLASS
  // ============================================================

  const getPriorityClass = (
    priority
  ) => {

    const value =
      normalizePriority(
        priority
      );


    if (
      value === "critical"
    ) {
      return "operator-priority-critical";
    }


    if (
      value === "high"
    ) {
      return "operator-priority-high";
    }


    if (
      value === "medium"
    ) {
      return "operator-priority-medium";
    }


    if (
      value === "low"
    ) {
      return "operator-priority-low";
    }


    return "operator-priority-unknown";
  };


  // ============================================================
  // SEVERITY CLASS
  // ============================================================

  const getSeverityClass = (
    severity
  ) => {

    const value =
      String(
        severity || ""
      )
        .trim()
        .toLowerCase();


    if (
      value === "critical"
    ) {
      return "operator-severity-critical";
    }


    if (
      value === "severe"
    ) {
      return "operator-severity-severe";
    }


    if (
      value === "moderate"
    ) {
      return "operator-severity-moderate";
    }


    if (
      value === "minor"
    ) {
      return "operator-severity-minor";
    }


    return "operator-severity-unknown";
  };


  // ============================================================
  // STATUS CLASS
  // ============================================================

  const getStatusClass = (
    status
  ) => {

    const value =
      normalizeStatus(
        status
      );


    if (
      value === "Assigned"
    ) {
      return "operator-status-assigned";
    }


    if (
      value === "In Progress"
    ) {
      return "operator-status-progress";
    }


    if (
      value === "Completed"
    ) {
      return "operator-status-completed";
    }


    return "operator-status-unassigned";
  };


  // ============================================================
  // IMAGE URL
  // ============================================================

  const getImageUrl = (
    imagePath
  ) => {

    if (!imagePath) {
      return "";
    }


    const path =
      String(
        imagePath
      ).trim();


    if (
      path.startsWith(
        "http://"
      ) ||
      path.startsWith(
        "https://"
      )
    ) {
      return path;
    }


    if (
      path.startsWith("/")
    ) {
      return `${API_URL}${path}`;
    }


    return `${API_URL}/${path}`;
  };


  // ============================================================
  // REPORT ACTION BUTTONS
  // ============================================================

  const renderReportActions = (
    report
  ) => {

    const status =
      normalizeStatus(
        report.status
      );


    const isUpdating =
      Number(
        updatingReportId
      ) === Number(
        report.id
      );


    return (
      <div
        className="operator-report-actions"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px",
          marginTop: "18px",
        }}
      >

        {/* VIEW DETAILS */}

        <button
          type="button"
          className="operator-view-button"
          style={{
            flex: "1 1 160px",
            minWidth: "160px",
            whiteSpace: "nowrap",
          }}
          onClick={() =>
            setSelectedReport(
              report
            )
          }
        >
          View Details
        </button>


        {/* START WORK */}

        {status === "Assigned" && (
          <button
            type="button"
            className="operator-start-button"
            style={{
              flex: "1 1 160px",
              minWidth: "160px",
              whiteSpace: "nowrap",
            }}
            disabled={
              isUpdating
            }
            onClick={() =>
              handleStartWork(
                report
              )
            }
          >
            {isUpdating
              ? "Starting..."
              : "Start Work"}
          </button>
        )}


        {/* MARK COMPLETED */}

        {status === "In Progress" && (
          <button
            type="button"
            className="operator-complete-button"
            style={{
              flex: "1 1 160px",
              minWidth: "160px",
              whiteSpace: "nowrap",
            }}
            disabled={
              isUpdating
            }
            onClick={() =>
              handleCompleteWork(
                report
              )
            }
          >
            {isUpdating
              ? "Completing..."
              : "Mark Completed"}
          </button>
        )}


        {/* COMPLETED */}

        {status === "Completed" && (
          <span
            className="operator-completed-label"
            style={{
              minWidth: "160px",
              textAlign: "center",
            }}
          >
            ✓ Completed
          </span>
        )}

      </div>
    );
  };


  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      className="operator-dashboard"
    >

      {/* ========================================================
          HEADER
      ======================================================== */}

      <header
        className="operator-header"
      >

        <div
          className="operator-header-brand"
        >

          <div
            className="operator-header-icon"
          >
            🚧
          </div>


          <div>

            <h1>
              RoadGuard AI
            </h1>

            <p>
              Operator Dashboard
            </p>

          </div>

        </div>


        <div
          className="operator-header-right"
        >

          <div
            className="operator-user-info"
          >

            <span
              className="operator-user-icon"
            >
              🛠️
            </span>


            <div>

              <strong>
                {operatorUsername}
              </strong>

              <small>
                Operator
              </small>

            </div>

          </div>


          <button
            type="button"
            className="operator-logout-button"
            onClick={
              handleLogout
            }
          >
            Logout
          </button>

        </div>

      </header>


      {/* ========================================================
          MAIN
      ======================================================== */}

      <main
        className="operator-main"
      >

        {/* ======================================================
            PAGE HEADING
        ====================================================== */}

        <section
          className="operator-page-heading"
        >

          <div>

            <h2>
              Operations Overview
            </h2>

            <p>
              Manage road-damage reports
              assigned to you.
            </p>

          </div>


          <button
            type="button"
            className="operator-refresh-button"
            onClick={
              fetchReports
            }
            disabled={
              loading
            }
          >
            {loading
              ? "Refreshing..."
              : "↻ Refresh Reports"}
          </button>

        </section>


        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div
            className="operator-error"
          >

            <span>
              !
            </span>


            <div>

              <strong>
                Action could not be completed
              </strong>

              <p>
                {error}
              </p>

            </div>


            <button
              type="button"
              onClick={
                fetchReports
              }
            >
              Retry
            </button>

          </div>
        )}


        {/* ======================================================
            STATUS STATISTICS
        ====================================================== */}

        <section
          className="operator-stat-grid"
        >

          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              📋
            </div>

            <div>

              <span>
                Assigned Reports
              </span>

              <strong>
                {totalAssigned}
              </strong>

            </div>

          </div>


          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🟡
            </div>

            <div>

              <span>
                Assigned
              </span>

              <strong>
                {assignedCount}
              </strong>

            </div>

          </div>


          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🔵
            </div>

            <div>

              <span>
                In Progress
              </span>

              <strong>
                {inProgressCount}
              </strong>

            </div>

          </div>


          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🟢
            </div>

            <div>

              <span>
                Completed
              </span>

              <strong>
                {completedCount}
              </strong>

            </div>

          </div>

        </section>


        {/* ======================================================
            PRIORITY SUMMARY
        ====================================================== */}

        <section
          className="operator-stat-grid"
        >

          {/* CRITICAL */}

          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🚨
            </div>

            <div>

              <span>
                Critical Priority
              </span>

              <strong>
                {criticalPriorityCount}
              </strong>

            </div>

          </div>


          {/* HIGH */}

          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🔴
            </div>

            <div>

              <span>
                High Priority
              </span>

              <strong>
                {highPriorityCount}
              </strong>

            </div>

          </div>


          {/* MEDIUM */}

          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🟠
            </div>

            <div>

              <span>
                Medium Priority
              </span>

              <strong>
                {mediumPriorityCount}
              </strong>

            </div>

          </div>


          {/* LOW */}

          <div
            className="operator-stat-card"
          >

            <div
              className="operator-stat-icon"
            >
              🟢
            </div>

            <div>

              <span>
                Low Priority
              </span>

              <strong>
                {lowPriorityCount}
              </strong>

            </div>

          </div>

        </section>


        {/* ======================================================
            SEARCH AND FILTER
        ====================================================== */}

        <section
          className="operator-tools"
        >

          <div
            className="operator-tools-heading"
          >

            <div>

              <h3>
                My Assigned Reports
              </h3>

              <p>
                {filteredReports.length}
                {" "}
                report
                {filteredReports.length !== 1
                  ? "s"
                  : ""}
                {" "}
                found
              </p>

            </div>

          </div>


          <div
            className="operator-tools-row"
          >

            {/* SEARCH */}

            <div
              className="operator-search-box"
            >

              <span>
                🔎
              </span>


              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search by damage type, location, status, priority or report ID..."
              />


              {search && (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="operator-clear-search"
                >
                  ×
                </button>
              )}

            </div>


            {/* PRIORITY FILTER */}

            <select
              className="operator-priority-filter"
              value={
                priorityFilter
              }
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
                Critical Priority
              </option>

              <option value="high">
                High Priority
              </option>

              <option value="medium">
                Medium Priority
              </option>

              <option value="low">
                Low Priority
              </option>

            </select>


            {/* STATUS FILTER */}

            <select
              className="operator-priority-filter"
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >

              <option value="all">
                All Statuses
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

          </div>

        </section>


        {/* ======================================================
            LOADING
        ====================================================== */}

        {loading && (
          <div
            className="operator-loading"
          >

            <div
              className="operator-spinner"
            ></div>

            <p>
              Loading assigned road reports...
            </p>

          </div>
        )}


        {/* ======================================================
            NO REPORTS
        ====================================================== */}

        {!loading &&
          !error &&
          assignedReports.length === 0 && (

            <div
              className="operator-empty"
            >

              <div>
                📋
              </div>

              <h3>
                No reports assigned
              </h3>

              <p>
                There are currently no road
                damage reports assigned to
                you by the administrator.
              </p>

            </div>

          )}


        {/* ======================================================
            FILTERED EMPTY
        ====================================================== */}

        {!loading &&
          assignedReports.length > 0 &&
          filteredReports.length === 0 && (

            <div
              className="operator-empty"
            >

              <div>
                🔎
              </div>

              <h3>
                No matching reports
              </h3>

              <p>
                Try changing your search,
                priority or status filter.
              </p>

            </div>

          )}


        {/* ======================================================
            REPORT GRID
        ====================================================== */}

        {!loading &&
          filteredReports.length > 0 && (

            <section
              className="operator-report-grid"
            >

              {filteredReports.map(
                (report) => {

                  const status =
                    normalizeStatus(
                      report.status
                    );


                  const priority =
                    normalizePriority(
                      report.priority
                    );


                  const displayPriority =
                    priority
                      ? priority
                          .charAt(0)
                          .toUpperCase() +
                        priority.slice(1)
                      : "Unknown";


                  return (
                    <article
                      className="operator-report-card"
                      key={
                        report.id
                      }
                    >

                      {/* =========================================
                          IMAGE
                      ========================================= */}

                      <div
                        className="operator-report-image"
                      >

                        {report.image_path ? (

                          <img
                            src={
                              getImageUrl(
                                report.image_path
                              )
                            }
                            alt={
                              report.damage_type ||
                              "Road damage"
                            }
                          />

                        ) : (

                          <div
                            className="operator-no-image"
                          >
                            No Image
                          </div>

                        )}


                        {/* PRIORITY */}

                        <span
                          className={
                            `operator-priority-badge ${getPriorityClass(
                              report.priority
                            )}`
                          }
                        >
                          {displayPriority}
                        </span>


                        {/* STATUS */}

                        <span
                          className={
                            `operator-status-badge ${getStatusClass(
                              report.status
                            )}`
                          }
                        >
                          {status}
                        </span>

                      </div>


                      {/* =========================================
                          CONTENT
                      ========================================= */}

                      <div
                        className="operator-report-content"
                      >

                        <div
                          className="operator-report-top"
                        >

                          <div>

                            <span
                              className="operator-report-number"
                            >
                              REPORT #
                              {report.id}
                            </span>


                            <h3>
                              {report.damage_type ||
                                "Road Damage"}
                            </h3>

                          </div>


                          <div
                            className="operator-score"
                          >

                            <span>
                              Score
                            </span>

                            <strong>
                              {
                                report.priority_score ??
                                "—"
                              }
                            </strong>

                          </div>

                        </div>


                        {/* =======================================
                            DETAILS
                        ======================================= */}

                        <div
                          className="operator-report-details"
                        >

                          {/* LOCATION */}

                          <div
                            className="operator-detail-item"
                          >

                            <span>
                              📍
                            </span>

                            <div>

                              <small>
                                Location
                              </small>

                              <strong>
                                {report.location ||
                                  "Not available"}
                              </strong>

                            </div>

                          </div>


                          {/* SEVERITY */}

                          <div
                            className="operator-detail-item"
                          >

                            <span>
                              ⚠️
                            </span>

                            <div>

                              <small>
                                Severity
                              </small>

                              <strong
                                className={
                                  getSeverityClass(
                                    report.severity
                                  )
                                }
                              >
                                {report.severity ||
                                  "Unknown"}
                              </strong>

                            </div>

                          </div>


                          {/* STATUS */}

                          <div
                            className="operator-detail-item"
                          >

                            <span>
                              📌
                            </span>

                            <div>

                              <small>
                                Status
                              </small>

                              <strong>
                                {status}
                              </strong>

                            </div>

                          </div>


                          {/* REPORTED */}

                          <div
                            className="operator-detail-item"
                          >

                            <span>
                              🕒
                            </span>

                            <div>

                              <small>
                                Reported
                              </small>

                              <strong>
                                {formatDate(
                                  report.created_at
                                )}
                              </strong>

                            </div>

                          </div>

                        </div>


                        {/* =======================================
                            TRACKING
                        ======================================= */}

                        <div
                          className="operator-tracking-box"
                        >

                          <h4>
                            Work Tracking
                          </h4>


                          <div
                            className="operator-tracking-row"
                          >

                            <span>
                              Assigned:
                            </span>

                            <strong>
                              {formatDate(
                                report.assigned_at
                              )}
                            </strong>

                          </div>


                          <div
                            className="operator-tracking-row"
                          >

                            <span>
                              Completed:
                            </span>

                            <strong>
                              {formatDate(
                                report.completed_at
                              )}
                            </strong>

                          </div>

                        </div>


                        {/* =======================================
                            ACTIONS
                        ======================================= */}

                        {renderReportActions(
                          report
                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </section>

          )}

      </main>


      {/* ========================================================
          DETAILS MODAL
      ======================================================== */}

      {selectedReport && (

        <div
          className="operator-modal-backdrop"
          onClick={() =>
            setSelectedReport(
              null
            )
          }
        >

          <div
            className="operator-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ==================================================
                MODAL HEADER
            ================================================== */}

            <div
              className="operator-modal-header"
            >

              <div>

                <span>
                  REPORT #
                  {selectedReport.id}
                </span>

                <h2>
                  {selectedReport.damage_type ||
                    "Road Damage"}
                </h2>

              </div>


              <button
                type="button"
                className="operator-modal-close"
                onClick={() =>
                  setSelectedReport(
                    null
                  )
                }
              >
                ×
              </button>

            </div>


            {/* ==================================================
                MODAL BODY
            ================================================== */}

            <div
              className="operator-modal-body"
            >

              {/* IMAGE */}

              {selectedReport.image_path && (

                <img
                  className="operator-modal-image"
                  src={
                    getImageUrl(
                      selectedReport.image_path
                    )
                  }
                  alt={
                    selectedReport.damage_type ||
                    "Road damage"
                  }
                />

              )}


              {/* =================================================
                  INFORMATION GRID
              ================================================= */}

              <div
                className="operator-modal-info-grid"
              >

                <div>

                  <span>
                    Damage Type
                  </span>

                  <strong>
                    {selectedReport.damage_type ||
                      "Not available"}
                  </strong>

                </div>


                <div>

                  <span>
                    Severity
                  </span>

                  <strong
                    className={
                      getSeverityClass(
                        selectedReport.severity
                      )
                    }
                  >
                    {selectedReport.severity ||
                      "Not available"}
                  </strong>

                </div>


                <div>

                  <span>
                    Priority
                  </span>

                  <strong
                    className={
                      getPriorityClass(
                        selectedReport.priority
                      )
                    }
                  >
                    {selectedReport.priority ||
                      "Not available"}
                  </strong>

                </div>


                <div>

                  <span>
                    Priority Score
                  </span>

                  <strong>
                    {
                      selectedReport.priority_score ??
                      "Not available"
                    }
                  </strong>

                </div>


                <div>

                  <span>
                    Status
                  </span>

                  <strong
                    className={
                      getStatusClass(
                        selectedReport.status
                      )
                    }
                  >
                    {normalizeStatus(
                      selectedReport.status
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Location
                  </span>

                  <strong>
                    {selectedReport.location ||
                      "Not available"}
                  </strong>

                </div>


                <div>

                  <span>
                    Reported On
                  </span>

                  <strong>
                    {formatDate(
                      selectedReport.created_at
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Assigned On
                  </span>

                  <strong>
                    {formatDate(
                      selectedReport.assigned_at
                    )}
                  </strong>

                </div>


                <div>

                  <span>
                    Completed On
                  </span>

                  <strong>
                    {formatDate(
                      selectedReport.completed_at
                    )}
                  </strong>

                </div>

              </div>


              {/* =================================================
                  WORK TRACKING
              ================================================= */}

              <div
                className="operator-tracking-box operator-modal-tracking"
              >

                <h3>
                  Work Tracking
                </h3>


                <div
                  className="operator-tracking-timeline"
                >

                  {/* REPORT CREATED */}

                  <div
                    className="operator-tracking-step completed"
                  >

                    <span>
                      ✓
                    </span>

                    <div>

                      <strong>
                        Report Created
                      </strong>

                      <small>
                        {formatDate(
                          selectedReport.created_at
                        )}
                      </small>

                    </div>

                  </div>


                  {/* ASSIGNED */}

                  <div
                    className={
                      selectedReport.assigned_at
                        ? "operator-tracking-step completed"
                        : "operator-tracking-step"
                    }
                  >

                    <span>
                      {selectedReport.assigned_at
                        ? "✓"
                        : "2"}
                    </span>

                    <div>

                      <strong>
                        Assigned to Operator
                      </strong>

                      <small>
                        {formatDate(
                          selectedReport.assigned_at
                        )}
                      </small>

                    </div>

                  </div>


                  {/* IN PROGRESS */}

                  <div
                    className={
                      normalizeStatus(
                        selectedReport.status
                      ) === "In Progress" ||
                      normalizeStatus(
                        selectedReport.status
                      ) === "Completed"
                        ? "operator-tracking-step completed"
                        : "operator-tracking-step"
                    }
                  >

                    <span>
                      {
                        normalizeStatus(
                          selectedReport.status
                        ) === "In Progress" ||
                        normalizeStatus(
                          selectedReport.status
                        ) === "Completed"
                          ? "✓"
                          : "3"
                      }
                    </span>

                    <div>

                      <strong>
                        Work In Progress
                      </strong>

                      <small>
                        {
                          normalizeStatus(
                            selectedReport.status
                          ) === "In Progress" ||
                          normalizeStatus(
                            selectedReport.status
                          ) === "Completed"
                            ? "Work started"
                            : "Not started"
                        }
                      </small>

                    </div>

                  </div>


                  {/* COMPLETED */}

                  <div
                    className={
                      normalizeStatus(
                        selectedReport.status
                      ) === "Completed"
                        ? "operator-tracking-step completed"
                        : "operator-tracking-step"
                    }
                  >

                    <span>
                      {
                        normalizeStatus(
                          selectedReport.status
                        ) === "Completed"
                          ? "✓"
                          : "4"
                      }
                    </span>

                    <div>

                      <strong>
                        Work Completed
                      </strong>

                      <small>
                        {formatDate(
                          selectedReport.completed_at
                        )}
                      </small>

                    </div>

                  </div>

                </div>

              </div>


              {/* =================================================
                  AI ANALYSIS
              ================================================= */}

              <div
                className="operator-analysis-box"
              >

                <h3>
                  AI Analysis
                </h3>

                <p>
                  {selectedReport.analysis ||
                    "No AI analysis available."}
                </p>

              </div>

            </div>


            {/* ==================================================
                MODAL FOOTER
            ================================================== */}

            <div
              className="operator-modal-footer"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "14px",
              }}
            >

              {/* START WORK */}

              {normalizeStatus(
                selectedReport.status
              ) === "Assigned" && (

                <button
                  type="button"
                  className="operator-start-button"
                  style={{
                    minWidth: "150px",
                    whiteSpace: "nowrap",
                  }}
                  disabled={
                    Number(
                      updatingReportId
                    ) === Number(
                      selectedReport.id
                    )
                  }
                  onClick={() =>
                    handleStartWork(
                      selectedReport
                    )
                  }
                >
                  {Number(
                    updatingReportId
                  ) === Number(
                    selectedReport.id
                  )
                    ? "Starting..."
                    : "Start Work"}
                </button>

              )}


              {/* COMPLETE */}

              {normalizeStatus(
                selectedReport.status
              ) === "In Progress" && (

                <button
                  type="button"
                  className="operator-complete-button"
                  style={{
                    minWidth: "150px",
                    whiteSpace: "nowrap",
                  }}
                  disabled={
                    Number(
                      updatingReportId
                    ) === Number(
                      selectedReport.id
                    )
                  }
                  onClick={() =>
                    handleCompleteWork(
                      selectedReport
                    )
                  }
                >
                  {Number(
                    updatingReportId
                  ) === Number(
                    selectedReport.id
                  )
                    ? "Completing..."
                    : "Mark Completed"}
                </button>

              )}


              {/* CLOSE */}

              <button
                type="button"
                className="operator-modal-close-button"
                style={{
                  minWidth: "110px",
                  whiteSpace: "nowrap",
                }}
                onClick={() =>
                  setSelectedReport(
                    null
                  )
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}


export default OperatorDashboard;