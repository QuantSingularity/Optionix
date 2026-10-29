import { RefreshControl } from "react-native";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import ComplianceScreen from "../../screens/ComplianceScreen";
import complianceService from "../../services/complianceService";
import { useAuth } from "../../context/AuthContext";
import { paperInputs, typeInto } from "../../testUtils/paper";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../../services/complianceService", () => ({
  __esModule: true,
  default: {
    getOverallStatus: jest.fn(),
    getKycStatus: jest.fn(),
    getAmlAlerts: jest.fn(),
    runSanctionsCheck: jest.fn(),
    submitKyc: jest.fn(),
  },
}));

const refreshProfile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ refreshProfile });
  complianceService.getOverallStatus.mockResolvedValue({ status: "compliant" });
  complianceService.getKycStatus.mockResolvedValue({
    kyc_status: "pending",
    documents_submitted: 2,
  });
  complianceService.getAmlAlerts.mockResolvedValue({
    alerts: [{ alert_id: "A1", alert_type: "structuring", status: "open" }],
  });
});

const mount = async () => {
  render(<ComplianceScreen />);
  await screen.findByText("Sanctions Screening");
};
const openKyc = () => fireEvent.press(screen.getByText("KYC"));

describe("Overview tab", () => {
  it("shows statuses and AML alerts", async () => {
    await mount();
    expect(complianceService.getAmlAlerts).toHaveBeenCalledWith({ limit: 10 });
    expect(screen.getByText("compliant")).toBeTruthy();
    expect(screen.getByText("pending")).toBeTruthy();
    expect(screen.getByText("structuring")).toBeTruthy();
    expect(screen.getByText("open")).toBeTruthy();
    expect(screen.getByText("1 total")).toBeTruthy();
  });

  it("humanises underscored statuses", async () => {
    complianceService.getOverallStatus.mockResolvedValue({
      status: "under_review",
    });
    await mount();
    expect(screen.getByText("under review")).toBeTruthy();
  });

  it("shows dashes for missing statuses and an empty alert state", async () => {
    complianceService.getOverallStatus.mockResolvedValue({});
    complianceService.getKycStatus.mockResolvedValue({});
    complianceService.getAmlAlerts.mockResolvedValue({});
    await mount();
    expect(screen.getAllByText("-")).toHaveLength(2);
    expect(screen.getByText("No active alerts")).toBeTruthy();
  });

  it("shows an error if any request fails", async () => {
    complianceService.getKycStatus.mockRejectedValue(
      new Error("KYC service down"),
    );
    render(<ComplianceScreen />);
    expect(await screen.findByText("KYC service down")).toBeTruthy();
  });

  it("supports pull-to-refresh", async () => {
    await mount();
    await act(async () => {
      screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
    });
    await waitFor(() =>
      expect(complianceService.getOverallStatus).toHaveBeenCalledTimes(2),
    );
  });

  describe("sanctions check", () => {
    it("reports a clean result", async () => {
      complianceService.runSanctionsCheck.mockResolvedValue({
        matches_found: false,
      });
      await mount();
      fireEvent.press(screen.getByText("Run Sanctions Check"));
      expect(
        await screen.findByText("No matches found across all screened lists."),
      ).toBeTruthy();
    });

    it("reports potential matches", async () => {
      complianceService.runSanctionsCheck.mockResolvedValue({
        matches_found: true,
      });
      await mount();
      fireEvent.press(screen.getByText("Run Sanctions Check"));
      expect(await screen.findByText("Potential matches found.")).toBeTruthy();
    });

    it("shows an error", async () => {
      complianceService.runSanctionsCheck.mockRejectedValue(
        new Error("Screening unavailable"),
      );
      await mount();
      fireEvent.press(screen.getByText("Run Sanctions Check"));
      expect(await screen.findByText("Screening unavailable")).toBeTruthy();
    });
  });
});

describe("KYC tab", () => {
  const fillForm = () => {
    [
      "Ada Lovelace",
      "1990-12-10",
      "GB",
      "1 St James Sq",
      "London",
      "SW1Y 4JH",
      "GB",
      "X1234567",
      "GB",
      "2030-01-01",
    ].forEach((v, i) => typeInto(i, v));
  };

  it("shows the documents count", async () => {
    await mount();
    openKyc();
    expect(screen.getByText("Documents submitted")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("replaces the form with a notice once approved", async () => {
    complianceService.getKycStatus.mockResolvedValue({
      kyc_status: "approved",
    });
    await mount();
    openKyc();
    expect(
      screen.getByText("Your identity has already been verified."),
    ).toBeTruthy();
    expect(screen.queryByText("Submit for Verification")).toBeNull();
  });

  it("limits country codes to two characters", async () => {
    await mount();
    openKyc();
    expect(paperInputs()[2].props.maxLength).toBe(2);
    expect(paperInputs()[6].props.maxLength).toBe(2);
    expect(paperInputs()[8].props.maxLength).toBe(2);
  });

  it("submits the form as a passport KYC and refreshes everything", async () => {
    complianceService.submitKyc.mockResolvedValue({});
    await mount();
    openKyc();
    fillForm();
    fireEvent.press(screen.getByText("Submit for Verification"));

    expect(
      await screen.findByText(
        "Submitted. Review typically takes 1-3 business days.",
      ),
    ).toBeTruthy();
    expect(complianceService.submitKyc).toHaveBeenCalledWith({
      fullName: "Ada Lovelace",
      dateOfBirth: "1990-12-10",
      nationality: "GB",
      address: {
        street: "1 St James Sq",
        city: "London",
        postal_code: "SW1Y 4JH",
        country: "GB",
      },
      documentType: "passport",
      documentNumber: "X1234567",
      documentCountry: "GB",
      documentExpiry: "2030-01-01",
    });
    expect(complianceService.getOverallStatus).toHaveBeenCalledTimes(2);
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(paperInputs()[0].props.value).toBe("");
  });

  it("shows server errors in the failure style and keeps the form", async () => {
    complianceService.submitKyc.mockRejectedValue(
      new Error("Invalid document"),
    );
    await mount();
    openKyc();
    fillForm();
    fireEvent.press(screen.getByText("Submit for Verification"));
    expect(await screen.findByText("Invalid document")).toBeTruthy();
    expect(paperInputs()[0].props.value).toBe("Ada Lovelace");
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it("can return to the overview", async () => {
    await mount();
    openKyc();
    fireEvent.press(screen.getByText("Overview"));
    expect(screen.getByText("Sanctions Screening")).toBeTruthy();
  });
});
