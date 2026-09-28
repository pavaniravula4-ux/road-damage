import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";


function OperatorDashboard() {
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

  const [verifyingReportId, setVerifyingReportId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [loggingOut, setLoggingOut] =
    useState(false);


  // ============================================================
  // OPERATOR INFORMATION
  // ============================================================

  const operatorUsername =
    localStorage.getItem("operator_username") ||
    localStorage.getItem("username") ||
    "Operator";


  const operatorToken =
    sessionStorage.getItem("operator_token");


  const operatorId = Number(
    localStorage.getItem("operator_user_id") ||
    localStorage.getItem("user_id") ||
    0
  );


  // ============================================================
  // CLEAR OPERATOR SESSION
  // ============================================================

  const clearOperatorSession = () => {
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
  };


  // ============================================================
  // FETCH REPORTS
  // ============================================================

  const fetchReports = async () => {
    // Always check the actual session storage.
    // Do not rely on React's loggingOut state because state updates are asynchronous.
    const token = sessionStorage.getItem("operator_token");

    if (!token) {
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


      // ----------------------------------------------------------
      // AUTHENTICATION FAILURE
      // ----------------------------------------------------------

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        // If logout already cleared the token, do nothing.
        if (!sessionStorage.getItem("operator_token")) {
          return;
        }

        clearOperatorSession();
        navigate("/operator-login", { replace: true });
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


      // A logout may have happened while the request was in flight.
      if (!sessionStorage.getItem("operator_token")) {
        return;
      }

      // Keep the saved after-repair image path across page refreshes.
      // This does NOT store the image itself; it only remembers the
      // server path returned after a successful repair verification.
      let savedAfterImages = {};
      try {
        savedAfterImages = JSON.parse(
          localStorage.getItem(
            "roadguard_operator_after_images"
          ) || "{}"
        );
      } catch {
        savedAfterImages = {};
      }

      const reportsWithSavedAfterImages = data.map((item) => {
        const serverAfterPath =
          item.after_work_image_path ||
          item.repair_image_path ||
          item.after_image_path ||
          item.after_image ||
          "";

        const savedAfterPath =
          savedAfterImages[String(item.id)] ||
          "";

        return {
          ...item,
          ...(serverAfterPath
            ? {
                after_work_image_path:
                  serverAfterPath,
              }
            : savedAfterPath
              ? {
                  after_work_image_path:
                    savedAfterPath,
                }
              : {}),
        };
      });

      setReports(reportsWithSavedAfterImages);

    } catch (err) {
      console.error(
        "Operator reports error:",
        err
      );

      // Ignore errors from requests that finished after logout.
      if (sessionStorage.getItem("operator_token")) {
        setError(
          err.message ||
          "Unable to connect to the server."
        );
      }
    } finally {
      setLoading(false);
    }
  };


  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    const token = sessionStorage.getItem("operator_token");

    if (!token) {
      setLoading(false);
      return;
    }

    fetchReports();
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
  // CHECK WHETHER REPORT BELONGS TO CURRENT OPERATOR
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
  // REPORTS ASSIGNED TO THIS OPERATOR
  // ============================================================

  const assignedReports = useMemo(() => {
    // /api/operator/reports already returns the reports assigned
    // to the authenticated operator. Do not filter them again
    // on the frontend, because operator IDs may be stored under
    // different keys and that can hide valid assigned reports.
    return reports;
  }, [reports]);


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
          )
            .toLowerCase();


        const reportId =
          String(
            report.id || ""
          )
            .trim()
            .toLowerCase();


        // --------------------------------------------------------
        // SEARCH
        // --------------------------------------------------------

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


        // --------------------------------------------------------
        // PRIORITY
        // --------------------------------------------------------

        const matchesPriority =
          selectedPriority === "all" ||
          priority ===
            selectedPriority;


        // --------------------------------------------------------
        // STATUS
        // --------------------------------------------------------

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
      clearOperatorSession();

      navigate(
        "/operator-login",
        {
          replace: true,
        }
      );

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


      // --------------------------------------------------------
      // AUTH FAILURE
      // --------------------------------------------------------

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        clearOperatorSession();

        navigate(
          "/operator-login",
          {
            replace: true,
          }
        );

        return;
      }


      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to update report status."
        );
      }


      // --------------------------------------------------------
      // UPDATE LOCAL REPORT LIST
      // --------------------------------------------------------

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
                  report.completed_at,
              };
            }
          )
      );


      // --------------------------------------------------------
      // UPDATE MODAL REPORT
      // --------------------------------------------------------

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
              current.completed_at,
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
  // BEFORE / AFTER REPAIR VERIFICATION
  // ============================================================

  const verifyRepair = async (report, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const token = sessionStorage.getItem("operator_token");

    if (!token) {
      clearOperatorSession();
      navigate("/operator-login", { replace: true });
      return;
    }

    setVerifyingReportId(report.id);
    setError("");

    // Show the selected after-repair photo immediately while the
    // backend saves and verifies it. This is only a frontend preview
    // and does not change the user-upload flow.
    const localAfterImageUrl = URL.createObjectURL(file);

    setReports((previousReports) =>
      previousReports.map((item) =>
        Number(item.id) === Number(report.id)
          ? {
              ...item,
              after_work_image_path: localAfterImageUrl,
            }
          : item
      )
    );

    setSelectedReport((current) =>
      current && Number(current.id) === Number(report.id)
        ? {
            ...current,
            after_work_image_path: localAfterImageUrl,
          }
        : current
    );

    try {
      const formData = new FormData();
      formData.append("after_image", file);

      const response = await fetch(
        `${API_URL}/api/operator/reports/${report.id}/verify-repair`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 401 || response.status === 403) {
        clearOperatorSession();
        navigate("/operator-login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to verify the repair."
        );
      }

      const updatedReport = data.report || data || {};

      // Keep the operator after-repair image completely independent.
      // The backend may return the saved image under any of these names.
      const afterImagePath =
        updatedReport.after_work_image_path ||
        updatedReport.repair_image_path ||
        updatedReport.after_image_path ||
        updatedReport.after_image ||
        "";

      const normalizedReport = {
        ...updatedReport,
        ...(afterImagePath
          ? { after_work_image_path: afterImagePath }
          : {}),
      };

      // Persist only the server-side image path. Never persist a blob URL.
      if (afterImagePath && !afterImagePath.startsWith("blob:")) {
        try {
          const savedAfterImages = JSON.parse(
            localStorage.getItem(
              "roadguard_operator_after_images"
            ) || "{}"
          );

          savedAfterImages[String(report.id)] =
            afterImagePath;

          localStorage.setItem(
            "roadguard_operator_after_images",
            JSON.stringify(savedAfterImages)
          );
        } catch (storageError) {
          console.warn(
            "Unable to save after-repair image path:",
            storageError
          );
        }

        URL.revokeObjectURL(localAfterImageUrl);
      }

      setReports((previousReports) =>
        previousReports.map((item) =>
          Number(item.id) === Number(report.id)
            ? {
                ...item,
                ...normalizedReport,
                ...(afterImagePath
                  ? { after_work_image_path: afterImagePath }
                  : {}),
              }
            : item
        )
      );

      setSelectedReport((current) => {
        if (!current || Number(current.id) !== Number(report.id)) {
          return current;
        }

        return {
          ...current,
          ...normalizedReport,
          ...(afterImagePath
            ? { after_work_image_path: afterImagePath }
            : {}),
        };
      });
    } catch (err) {
      URL.revokeObjectURL(localAfterImageUrl);
      console.error("Repair verification error:", err);
      setError(
        err.message ||
        "Unable to verify the repair."
      );
    } finally {
      setVerifyingReportId(null);
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = () => {
    // Logout must be a pure navigation action.
    // Do not change dashboard state, refresh reports, or call any API.
    clearOperatorSession();
    navigate("/operator-login", {
      replace: true,
    });
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
      ) ||
      path.startsWith(
        "blob:"
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

  const renderRepairVerification = (report) => {
    const afterImagePath =
      report.after_work_image_path ||
      report.repair_image_path ||
      report.after_image_path ||
      report.after_image ||
      "";

    if (!report.verification_status && !afterImagePath) {
      return null;
    }

    const status = report.verification_status || "Needs Review";
    const statusClass =
      status === "Verified"
        ? "operator-verification-verified"
        : status === "Needs Repair"
          ? "operator-verification-needs-repair"
          : "operator-verification-review";

    const resultText = String(
      report.verification_result ||
      report.verification_analysis ||
      ""
    );

    const originalMatch = resultText.match(
      /^Original Damage:\s*(.+)$/im
    );
    const repairMatch = resultText.match(
      /^Repair Detected:\s*(Yes|No|Unclear)\s*$/im
    );
    const explanationMatch = resultText.match(
      /^Explanation:\s*(.+)$/im
    );

    return (
      <div
        style={{
          marginTop: "18px",
          padding: "16px",
          border: "1px solid #dbe4f0",
          borderRadius: "14px",
          background: "#f8fbff",
        }}
      >
        <h4
          style={{
            margin: "0 0 12px",
            fontSize: "15px",
            color: "#10213b",
          }}
        >
          🤖 Gemini Repair Verification
        </h4>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              BEFORE
            </p>

            {report.image_path ? (
              <img
                src={getImageUrl(report.image_path)}
                alt="Original road damage"
                style={{
                  width: "100%",
                  height: "150px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid #dbe4f0",
                }}
              />
            ) : (
              <div
                style={{
                  height: "150px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "10px",
                  border: "1px dashed #b9c7d8",
                  color: "#718096",
                }}
              >
                No before image
              </div>
            )}
          </div>

          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              AFTER
            </p>

            {afterImagePath ? (
              <img
                src={getImageUrl(afterImagePath)}
                alt="After repair"
                style={{
                  width: "100%",
                  height: "150px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid #dbe4f0",
                }}
                onError={(event) => {
                  console.error(
                    "After repair image failed to load:",
                    getImageUrl(afterImagePath)
                  );
                }}
              />
            ) : (
              <div
                style={{
                  height: "150px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "10px",
                  border: "1px dashed #b9c7d8",
                  color: "#718096",
                }}
              >
                No after image
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "12px", lineHeight: 1.6 }}>
          <div>
            <strong>Original Damage:</strong>{" "}
            {originalMatch?.[1] ||
              report.damage_type ||
              "Not determinable"}
          </div>

          <div>
            <strong>Repair Detected:</strong>{" "}
            {repairMatch?.[1] || "Unclear"}
          </div>

          <div>
            <strong>Confidence:</strong>{" "}
            {report.verification_confidence ?? 0}%
          </div>

          <div style={{ marginTop: "6px" }}>
            <strong>Status:</strong>{" "}
            <span className={statusClass}>
              {status === "Verified"
                ? "VERIFIED ✅"
                : status}
            </span>
          </div>

          <p
            style={{
              margin: "8px 0 0",
              color: "#5d6b7e",
              fontSize: "13px",
            }}
          >
            {explanationMatch?.[1] ||
              "Gemini verification completed."}
          </p>
        </div>
      </div>
    );
  };


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
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: "12px",
          marginTop: "18px",
          width: "100%",
        }}
      >

        <button
          type="button"
          className="operator-view-button"
          style={{
            flex: "1 1 150px",
            minWidth: "160px",
            minHeight: "44px",
            whiteSpace: "nowrap",
            margin: 0,
          }}
          onClick={() =>
            setSelectedReport(
              report
            )
          }
        >
          View Details
        </button>


        {status === "Assigned" && (
          <button
            type="button"
            className="operator-start-button"
            style={{
              flex: "1 1 150px",
              minWidth: "160px",
              minHeight: "44px",
              whiteSpace: "nowrap",
              margin: 0,
            }}
            disabled={isUpdating}
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


        {status === "In Progress" && (
          <button
            type="button"
            className="operator-complete-button"
            style={{
              flex: "1 1 150px",
              minWidth: "160px",
              minHeight: "44px",
              whiteSpace: "nowrap",
              margin: 0,
            }}
            disabled={isUpdating}
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


        <label
          style={{
            flex: "1 1 210px",
            minWidth: "210px",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            border: "1px solid #dbe4f0",
            background: "#ffffff",
            color: "#1459b8",
            fontWeight: 700,
            cursor: verifyingReportId === report.id ? "not-allowed" : "pointer",
            opacity: verifyingReportId === report.id ? 0.65 : 1,
          }}
        >
          {verifyingReportId === report.id
            ? "Verifying Repair..."
            : report.verification_status
              ? "Upload New After Photo"
              : "Upload After Photo & Verify"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={verifyingReportId === report.id}
            onChange={(event) => verifyRepair(report, event)}
            style={{ display: "none" }}
          />
        </label>

        {status === "Completed" && (
          <span
            className="operator-completed-label"
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
            onClick={handleLogout}
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
              loading ||
              loggingOut ||
              !sessionStorage.getItem("operator_token")
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


            {/* PRIORITY */}

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


            {/* STATUS */}

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

        {loading &&
          sessionStorage.getItem("operator_token") && (
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
                      key={report.id}
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


                        {/* PRIORITY BADGE */}

                        <span
                          className={
                            `operator-priority-badge ${getPriorityClass(
                              report.priority
                            )}`
                          }
                        >
                          {displayPriority}
                        </span>


                        {/* STATUS BADGE */}

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

                        {renderRepairVerification(report)}


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
                gap: "12px",
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