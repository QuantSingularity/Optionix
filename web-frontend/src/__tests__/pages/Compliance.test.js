import { fireEvent, screen, waitFor } from "@testing-library/react";
import Compliance from "../../pages/Compliance";
import complianceService from "../../services/complianceService";
import { useAuth } from "../../utils/AuthContext";
import { control, setField } from "../../testUtils/fields";
import { renderWithRouter } from "../../testUtils/render";

jest.mock("../../utils/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/complianceService", () => ({
  __esModule: true,
  default: {
    getOverallStatus: jest.fn(),
    getKycStatus: jest.fn(),
    getAmlAlerts: jest.fn(),
    listReports: jest.fn(),
    getAuditLogs: jest.fn(),
    runSanctionsCheck: jest.fn(),
    submitKyc: jest.fn(),
    generateReport: jest.fn(),
    requestGdprAction: jest.fn(),
  },
}));

const refreshProfile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ refreshProfile });
  complianceService.getOverallStatus.mockResolvedValue({
    status: "under_review",
    risk_level: "medium",
    issues_found: ["Missing proof of address"],
    recommendations: ["Upload a utility bill"],
  });
  complianceService.getKycStatus.mockResolvedValue({
    kyc_status: "under_review",
    risk_score: 35,
    kyc_level: 2,
    documents_submitted: 3,
    latest_document: { type: "passport", status: "pending" },
  });
  complianceService.getAmlAlerts.mockResolvedValue({
    alerts: [
      {
        alert_id: "A1",
        alert_type: "structuring",
        risk_score: 72,
        status: "open",
        created_at: "2024-03-15T12:00:00Z",
      },
    ],
  });
  complianceService.listReports.mockResolvedValue({
    reports: [
      {
        report_id: "R1",
        report_type: "monthly",
        regulation_type: "sox",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T00:00:00Z",
        status: "ready",
        generated_at: "2024-02-01T00:00:00Z",
      },
    ],
  });
  complianceService.getAuditLogs.mockResolvedValue({
    logs: [
      {
        log_id: "L1",
        action: "login",
        action_category: "auth",
        status: "success",
        ip_address: "10.0.0.1",
        timestamp: "2024-03-15T12:00:00Z",
      },
      {
        log_id: "L2",
        action: "withdraw",
        action_category: "funds",
        status: "denied",
        timestamp: "2024-03-16T12:00:00Z",
      },
    ],
  });
});

const mount = async () => {
  renderWithRouter(<Compliance />);
  await screen.findByText("Sanctions Screening");
};
const tab = (name) => fireEvent.click(screen.getByRole("button", { name }));

describe("loading", () => {
  it("shows a spinner, then requests every source with its limit", async () => {
    renderWithRouter(<Compliance />);
    expect(screen.queryByText("Compliance")).not.toBeInTheDocument();
    await screen.findByText("Sanctions Screening");
    expect(complianceService.getAmlAlerts).toHaveBeenCalledWith({ limit: 20 });
    expect(complianceService.listReports).toHaveBeenCalledWith({ limit: 20 });
    expect(complianceService.getAuditLogs).toHaveBeenCalledWith({ limit: 25 });
  });

  it("shows an error but still renders the page", async () => {
    complianceService.getKycStatus.mockRejectedValue(
      new Error("KYC service down"),
    );
    renderWithRouter(<Compliance />);
    expect(await screen.findByText("KYC service down")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Overview" }),
    ).toBeInTheDocument();
  });
});

describe("overview tab", () => {
  it("shows status badges and risk score", async () => {
    await mount();
    expect(screen.getAllByText("under review")).toHaveLength(2);
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("35/100")).toBeInTheDocument();
  });

  it("shows dashes when statuses are missing", async () => {
    complianceService.getOverallStatus.mockResolvedValue({});
    complianceService.getKycStatus.mockResolvedValue({});
    await mount();
    expect(screen.getAllByText("-")).toHaveLength(3);
    expect(screen.getByText("-/100")).toBeInTheDocument();
  });

  it("lists issues and recommendations", async () => {
    await mount();
    expect(screen.getByText("Missing proof of address")).toBeInTheDocument();
    expect(screen.getByText("Upload a utility bill")).toBeInTheDocument();
  });

  it("hides the issues card when nothing was found", async () => {
    complianceService.getOverallStatus.mockResolvedValue({
      status: "compliant",
      issues_found: [],
    });
    await mount();
    expect(
      screen.queryByText(/Issues & Recommendations/),
    ).not.toBeInTheDocument();
  });

  it("lists AML alerts, or an empty state", async () => {
    await mount();
    expect(screen.getByText("structuring")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("1 total")).toBeInTheDocument();
  });

  it("shows an empty state without alerts", async () => {
    complianceService.getAmlAlerts.mockResolvedValue({});
    await mount();
    expect(screen.getByText("No active alerts")).toBeInTheDocument();
  });

  describe("sanctions", () => {
    const run = () =>
      fireEvent.click(
        screen.getByRole("button", { name: "Run Sanctions Check" }),
      );

    it("reports a clean result with the lists checked", async () => {
      complianceService.runSanctionsCheck.mockResolvedValue({
        matches_found: false,
        lists_checked: ["OFAC", "EU"],
      });
      await mount();
      run();
      expect(
        await screen.findByText(/No matches found across all screened lists\./),
      ).toBeInTheDocument();
      expect(screen.getByText(/Checked: OFAC, EU\./)).toBeInTheDocument();
    });

    it("reports potential matches", async () => {
      complianceService.runSanctionsCheck.mockResolvedValue({
        matches_found: true,
        lists_checked: ["UN"],
      });
      await mount();
      run();
      expect(
        await screen.findByText(/Potential matches found\. Review required\./),
      ).toBeInTheDocument();
    });

    it("does not crash when the response omits lists_checked", async () => {
      complianceService.runSanctionsCheck.mockResolvedValue({
        matches_found: false,
      });
      await mount();
      run();
      expect(await screen.findByText(/No matches found/)).toBeInTheDocument();
    });

    it("shows an error", async () => {
      complianceService.runSanctionsCheck.mockRejectedValue(
        new Error("Screening unavailable"),
      );
      await mount();
      run();
      expect(
        await screen.findByText("Screening unavailable"),
      ).toBeInTheDocument();
    });

    it("disables the button while checking", async () => {
      complianceService.runSanctionsCheck.mockReturnValue(
        new Promise(() => {}),
      );
      await mount();
      run();
      expect(
        await screen.findByRole("button", { name: /Checking/ }),
      ).toBeDisabled();
    });
  });
});

describe("KYC tab", () => {
  const fillForm = () => {
    setField("Full legal name", "Ada Lovelace");
    setField("Date of birth", "1990-12-10");
    setField("Nationality (ISO 2-letter, e.g. US)", "GB");
    setField("Street address", "1 St James Sq");
    setField("City", "London");
    setField("State / Region", "");
    setField("Postal code", "SW1Y 4JH");
    setField("Country (ISO 2-letter)", "GB");
    setField("Document type", "drivers_license");
    setField("Document number", "X1234567");
    setField("Document country (ISO 2-letter)", "GB");
    setField("Document expiry", "2030-01-01");
  };
  const submit = () =>
    fireEvent.click(
      screen.getByRole("button", { name: "Submit for Verification" }),
    );

  it("shows the status panel", async () => {
    await mount();
    tab("KYC Verification");
    expect(screen.getByText("Documents submitted")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/passport .* pending/)).toBeInTheDocument();
  });

  it("replaces the form with a notice once approved", async () => {
    complianceService.getKycStatus.mockResolvedValue({
      kyc_status: "approved",
    });
    await mount();
    tab("KYC Verification");
    expect(
      screen.getByText(/Your identity has already been verified/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit for Verification" }),
    ).not.toBeInTheDocument();
  });

  it("submits the form, omitting an empty state, then reloads and refreshes the profile", async () => {
    complianceService.submitKyc.mockResolvedValue({});
    await mount();
    tab("KYC Verification");
    fillForm();
    fireEvent.submit(control("Full legal name").closest("form"));
    expect(
      await screen.findByText(/KYC documents submitted/),
    ).toBeInTheDocument();
    expect(complianceService.submitKyc).toHaveBeenCalledWith({
      fullName: "Ada Lovelace",
      dateOfBirth: "1990-12-10",
      nationality: "GB",
      address: {
        street: "1 St James Sq",
        city: "London",
        state: undefined,
        postal_code: "SW1Y 4JH",
        country: "GB",
      },
      documentType: "drivers_license",
      documentNumber: "X1234567",
      documentCountry: "GB",
      documentExpiry: "2030-01-01",
    });
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
    expect(complianceService.getOverallStatus).toHaveBeenCalledTimes(2);
    expect(control("Full legal name")).toHaveValue("");
  });

  it("shows server errors and keeps the form", async () => {
    complianceService.submitKyc.mockRejectedValue(
      new Error("Invalid document"),
    );
    await mount();
    tab("KYC Verification");
    fillForm();
    fireEvent.submit(control("Full legal name").closest("form"));
    expect(await screen.findByText("Invalid document")).toBeInTheDocument();
    expect(control("Full legal name")).toHaveValue("Ada Lovelace");
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it("offers the three document types", async () => {
    await mount();
    tab("KYC Verification");
    expect(
      Array.from(control("Document type").options).map((o) => o.value),
    ).toEqual(["passport", "drivers_license", "national_id"]);
  });
});

describe("reports and audit tab", () => {
  const open = async () => {
    await mount();
    tab("Reports & Audit");
  };

  it("lists reports and audit events", async () => {
    await open();
    expect(screen.getByText("monthly")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByText(/Jan 1, 2024 to Jan 31, 2024/)).toBeInTheDocument();
    expect(screen.getByText("login")).toBeInTheDocument();
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("denied")).toBeInTheDocument();
    expect(screen.getByText("2 recent events")).toBeInTheDocument();
  });

  it("shows empty states", async () => {
    complianceService.listReports.mockResolvedValue({});
    complianceService.getAuditLogs.mockResolvedValue({});
    await open();
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.getByText("No audit events yet")).toBeInTheDocument();
  });

  it("requires both dates before generating", async () => {
    await open();
    fireEvent.submit(control("Period start").closest("form"));
    expect(
      await screen.findByText("Select both a period start and end date."),
    ).toBeInTheDocument();
    expect(complianceService.generateReport).not.toHaveBeenCalled();
  });

  it("generates a report with ISO dates and reloads", async () => {
    complianceService.generateReport.mockResolvedValue({});
    await open();
    setField("Report type", "quarterly");
    setField("Regulation", "mifid_ii");
    setField("Period start", "2024-01-01");
    setField("Period end", "2024-03-31");
    fireEvent.submit(control("Period start").closest("form"));
    await waitFor(() =>
      expect(complianceService.generateReport).toHaveBeenCalledWith({
        reportType: "quarterly",
        regulationType: "mifid_ii",
        periodStart: new Date("2024-01-01").toISOString(),
        periodEnd: new Date("2024-03-31").toISOString(),
      }),
    );
    await waitFor(() =>
      expect(complianceService.getOverallStatus).toHaveBeenCalledTimes(2),
    );
  });

  it("shows generation errors", async () => {
    complianceService.generateReport.mockRejectedValue(
      new Error("Range too large"),
    );
    await open();
    setField("Period start", "2024-01-01");
    setField("Period end", "2024-03-31");
    fireEvent.submit(control("Period start").closest("form"));
    expect(await screen.findByText("Range too large")).toBeInTheDocument();
  });
});

describe("privacy tab", () => {
  const open = async () => {
    await mount();
    tab("Privacy (GDPR)");
  };

  it("submits an access request by default, omitting an empty description", async () => {
    complianceService.requestGdprAction.mockResolvedValue({
      request_id: "REQ-9",
      estimated_completion: "2024-04-14T00:00:00Z",
      verification_required: true,
    });
    await open();
    fireEvent.submit(control("Request type").closest("form"));
    expect(
      await screen.findByText(/Request received \(ID: REQ-9\)/),
    ).toBeInTheDocument();
    expect(complianceService.requestGdprAction).toHaveBeenCalledWith({
      requestType: "access",
      description: undefined,
    });
    expect(
      screen.getByText(/Estimated completion: Apr 14, 2024/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Identity verification will be required/),
    ).toBeInTheDocument();
  });

  it("sends the chosen type and details", async () => {
    complianceService.requestGdprAction.mockResolvedValue({
      request_id: "R",
      estimated_completion: "2024-04-14T00:00:00Z",
    });
    await open();
    setField("Request type", "portability");
    setField("Additional details (optional)", "JSON please");
    fireEvent.submit(control("Request type").closest("form"));
    await waitFor(() =>
      expect(complianceService.requestGdprAction).toHaveBeenCalledWith({
        requestType: "portability",
        description: "JSON please",
      }),
    );
    expect(
      screen.queryByText(/Identity verification will be required/),
    ).not.toBeInTheDocument();
  });

  it("offers all five request types", async () => {
    await open();
    expect(
      Array.from(control("Request type").options).map((o) => o.value),
    ).toEqual([
      "access",
      "rectification",
      "erasure",
      "portability",
      "restriction",
    ]);
  });

  it("shows an error", async () => {
    complianceService.requestGdprAction.mockRejectedValue(
      new Error("Too many requests"),
    );
    await open();
    fireEvent.submit(control("Request type").closest("form"));
    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
  });
});
