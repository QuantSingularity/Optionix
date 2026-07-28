import apiClient from "./api";

const complianceService = {
  submitKyc: ({
    fullName,
    dateOfBirth,
    nationality,
    address,
    documentType,
    documentNumber,
    documentCountry,
    documentExpiry,
  }) =>
    apiClient
      .post("/compliance/kyc/submit", {
        full_name: fullName,
        date_of_birth: dateOfBirth,
        nationality,
        address,
        document_type: documentType,
        document_number: documentNumber,
        document_country: documentCountry,
        document_expiry: documentExpiry,
      })
      .then((r) => r.data),

  getKycStatus: () =>
    apiClient.get("/compliance/kyc/status").then((r) => r.data),

  runSanctionsCheck: () =>
    apiClient.post("/compliance/sanctions/check").then((r) => r.data),

  getAmlAlerts: (params = {}) =>
    apiClient.get("/compliance/aml/alerts", { params }).then((r) => r.data),

  generateReport: ({
    reportType,
    regulationType,
    periodStart,
    periodEnd,
    includeDetails,
  }) =>
    apiClient
      .post("/compliance/reports/generate", {
        report_type: reportType,
        regulation_type: regulationType,
        period_start: periodStart,
        period_end: periodEnd,
        include_details: !!includeDetails,
      })
      .then((r) => r.data),

  listReports: (params = {}) =>
    apiClient.get("/compliance/reports", { params }).then((r) => r.data),

  requestGdprAction: ({ requestType, description, verificationMethod }) =>
    apiClient
      .post("/compliance/gdpr/request", {
        request_type: requestType,
        description,
        verification_method: verificationMethod,
      })
      .then((r) => r.data),

  getAuditLogs: (params = {}) =>
    apiClient.get("/compliance/audit-logs", { params }).then((r) => r.data),

  getOverallStatus: () =>
    apiClient.get("/compliance/status").then((r) => r.data),
};

export default complianceService;
