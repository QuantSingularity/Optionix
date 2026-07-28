import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiSearch,
  FiShield,
  FiUserCheck,
} from "react-icons/fi";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardMeta,
  CardTitle,
  CenteredSpinner,
  EmptyState,
  Field,
  Grid,
  HelpText,
  Input,
  Label,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageWrap,
  Segmented,
  SegmentedBtn,
  Select,
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";
import complianceService from "../services/complianceService";
import { extractErrorMessage } from "../services/apiClient";
import { formatDate, formatDateTime } from "../utils/format";
import { useAuth } from "../utils/AuthContext";

const KYC_TONE = {
  verified: "success",
  approved: "success",
  under_review: "warning",
  pending: "neutral",
  rejected: "danger",
};

const COMPLIANCE_TONE = {
  compliant: "success",
  under_review: "warning",
  pending: "neutral",
  non_compliant: "danger",
};

const RISK_TONE = {
  low: "success",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "kyc", label: "KYC Verification" },
  { key: "reports", label: "Reports & Audit" },
  { key: "privacy", label: "Privacy (GDPR)" },
];

const Compliance = () => {
  const { refreshProfile } = useAuth();
  const [tab, setTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [amlAlerts, setAmlAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [sanctionsResult, setSanctionsResult] = useState(null);
  const [sanctionsLoading, setSanctionsLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [st, kyc, aml, rpts, logs] = await Promise.all([
        complianceService.getOverallStatus(),
        complianceService.getKycStatus(),
        complianceService.getAmlAlerts({ limit: 20 }),
        complianceService.listReports({ limit: 20 }),
        complianceService.getAuditLogs({ limit: 25 }),
      ]);
      setStatus(st);
      setKycStatus(kyc);
      setAmlAlerts(aml.alerts || []);
      setReports(rpts.reports || []);
      setAuditLogs(logs.logs || []);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load compliance data."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runSanctionsCheck = async () => {
    setSanctionsLoading(true);
    try {
      const data = await complianceService.runSanctionsCheck();
      setSanctionsResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Sanctions check failed."));
    } finally {
      setSanctionsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageWrap>
        <CenteredSpinner $minHeight="60vh" />
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Compliance</PageTitle>
          <PageSubtitle>
            KYC verification, sanctions screening, regulatory reports, and your
            data rights.
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      <Segmented style={{ marginBottom: 22 }}>
        {TABS.map((t) => (
          <SegmentedBtn
            key={t.key}
            type="button"
            $active={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </SegmentedBtn>
        ))}
      </Segmented>

      {tab === "overview" && (
        <>
          <Grid $cols={4} style={{ marginBottom: 20 }}>
            <Card $pad="16px">
              <StatLabel>Compliance Status</StatLabel>
              <div style={{ marginTop: 8 }}>
                <Badge $tone={COMPLIANCE_TONE[status?.status] || "neutral"}>
                  {status?.status?.replace("_", " ") || "—"}
                </Badge>
              </div>
            </Card>
            <Card $pad="16px">
              <StatLabel>Risk Level</StatLabel>
              <div style={{ marginTop: 8 }}>
                <Badge $tone={RISK_TONE[status?.risk_level] || "neutral"}>
                  {status?.risk_level || "—"}
                </Badge>
              </div>
            </Card>
            <Card $pad="16px">
              <StatLabel>KYC Status</StatLabel>
              <div style={{ marginTop: 8 }}>
                <Badge $tone={KYC_TONE[kycStatus?.kyc_status] || "neutral"}>
                  {kycStatus?.kyc_status?.replace("_", " ") || "—"}
                </Badge>
              </div>
            </Card>
            <Card $pad="16px">
              <StatLabel>Risk Score</StatLabel>
              <StatValue style={{ fontSize: 18, marginTop: 4 }}>
                {kycStatus?.risk_score ?? "—"}/100
              </StatValue>
            </Card>
          </Grid>

          {status?.issues_found?.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <CardHeader>
                <CardTitle>
                  <FiAlertTriangle /> Issues &amp; Recommendations
                </CardTitle>
              </CardHeader>
              <ul style={{ paddingLeft: 20, fontSize: 13.5, lineHeight: 1.9 }}>
                {status.issues_found.map((issue) => (
                  <li key={issue} style={{ color: "#fca5a5" }}>
                    {issue}
                  </li>
                ))}
                {status.recommendations.map((rec) => (
                  <li key={rec} style={{ color: "var(--text-secondary)" }}>
                    {rec}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Grid $cols={2} $gap="18px">
            <Card>
              <CardHeader>
                <CardTitle>
                  <FiSearch /> Sanctions Screening
                </CardTitle>
              </CardHeader>
              <HelpText>
                Screen your profile against OFAC, EU, UN, and HMT UK sanctions
                lists.
              </HelpText>
              <Button
                onClick={runSanctionsCheck}
                disabled={sanctionsLoading}
                style={{ marginTop: 14 }}
              >
                {sanctionsLoading ? "Checking…" : "Run Sanctions Check"}
              </Button>
              {sanctionsResult && (
                <Alert
                  $tone={sanctionsResult.matches_found ? "danger" : "success"}
                  style={{ marginTop: 16 }}
                >
                  {sanctionsResult.matches_found
                    ? "Potential matches found — review required."
                    : "No matches found across all screened lists."}{" "}
                  Checked: {sanctionsResult.lists_checked.join(", ")}.
                </Alert>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  <FiAlertTriangle /> AML Alerts
                </CardTitle>
                <CardMeta>{amlAlerts.length} total</CardMeta>
              </CardHeader>
              {amlAlerts.length > 0 ? (
                <TableScroll>
                  <Table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Risk</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amlAlerts.map((a) => (
                        <tr key={a.alert_id}>
                          <td>{a.alert_type}</td>
                          <td>{a.risk_score}</td>
                          <td>
                            <Badge $tone="warning">{a.status}</Badge>
                          </td>
                          <td>{formatDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableScroll>
              ) : (
                <EmptyState>
                  <FiCheckCircle />
                  <h4>No active alerts</h4>
                  <p>Your account has no flagged transactions.</p>
                </EmptyState>
              )}
            </Card>
          </Grid>
        </>
      )}

      {tab === "kyc" && (
        <KycPanel
          kycStatus={kycStatus}
          onSubmitted={async () => {
            await loadAll();
            await refreshProfile();
          }}
        />
      )}

      {tab === "reports" && (
        <ReportsPanel
          reports={reports}
          auditLogs={auditLogs}
          onGenerated={loadAll}
        />
      )}

      {tab === "privacy" && <PrivacyPanel />}
    </PageWrap>
  );
};

/* ─── KYC Panel ──────────────────────────────────────────────────── */
const emptyKyc = {
  fullName: "",
  dateOfBirth: "",
  nationality: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  documentType: "passport",
  documentNumber: "",
  documentCountry: "",
  documentExpiry: "",
};

const KycPanel = ({ kycStatus, onSubmitted }) => {
  const [form, setForm] = useState(emptyKyc);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const alreadyApproved = kycStatus?.kyc_status === "approved";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await complianceService.submitKyc({
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth,
        nationality: form.nationality,
        address: {
          street: form.street,
          city: form.city,
          state: form.state || undefined,
          postal_code: form.postalCode,
          country: form.country,
        },
        documentType: form.documentType,
        documentNumber: form.documentNumber,
        documentCountry: form.documentCountry,
        documentExpiry: form.documentExpiry,
      });
      setSuccess(
        "KYC documents submitted. Review typically takes 1-3 business days.",
      );
      setForm(emptyKyc);
      onSubmitted?.();
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't submit KYC documents."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>
            <FiUserCheck /> Identity Verification
          </CardTitle>
        </CardHeader>

        {alreadyApproved ? (
          <Alert $tone="success">
            Your identity has already been verified. No further action needed.
          </Alert>
        ) : (
          <>
            {error && <Alert $tone="danger">{error}</Alert>}
            {success && <Alert $tone="success">{success}</Alert>}
            <form onSubmit={handleSubmit}>
              <Grid $cols={2} $gap="12px">
                <Field>
                  <Label>Full legal name</Label>
                  <Input value={form.fullName} onChange={update("fullName")} />
                </Field>
                <Field>
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={update("dateOfBirth")}
                  />
                </Field>
              </Grid>
              <Field>
                <Label>Nationality (ISO 2-letter, e.g. US)</Label>
                <Input
                  value={form.nationality}
                  onChange={update("nationality")}
                  maxLength={2}
                  style={{ textTransform: "uppercase" }}
                />
              </Field>
              <Field>
                <Label>Street address</Label>
                <Input value={form.street} onChange={update("street")} />
              </Field>
              <Grid $cols={3} $gap="12px">
                <Field>
                  <Label>City</Label>
                  <Input value={form.city} onChange={update("city")} />
                </Field>
                <Field>
                  <Label>State / Region</Label>
                  <Input value={form.state} onChange={update("state")} />
                </Field>
                <Field>
                  <Label>Postal code</Label>
                  <Input
                    value={form.postalCode}
                    onChange={update("postalCode")}
                  />
                </Field>
              </Grid>
              <Field>
                <Label>Country (ISO 2-letter)</Label>
                <Input
                  value={form.country}
                  onChange={update("country")}
                  maxLength={2}
                  style={{ textTransform: "uppercase" }}
                />
              </Field>

              <Grid $cols={2} $gap="12px">
                <Field>
                  <Label>Document type</Label>
                  <Select
                    value={form.documentType}
                    onChange={update("documentType")}
                  >
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="national_id">National ID</option>
                  </Select>
                </Field>
                <Field>
                  <Label>Document number</Label>
                  <Input
                    value={form.documentNumber}
                    onChange={update("documentNumber")}
                  />
                </Field>
              </Grid>
              <Grid $cols={2} $gap="12px">
                <Field>
                  <Label>Document country (ISO 2-letter)</Label>
                  <Input
                    value={form.documentCountry}
                    onChange={update("documentCountry")}
                    maxLength={2}
                    style={{ textTransform: "uppercase" }}
                  />
                </Field>
                <Field>
                  <Label>Document expiry</Label>
                  <Input
                    type="date"
                    value={form.documentExpiry}
                    onChange={update("documentExpiry")}
                  />
                </Field>
              </Grid>

              <Button
                type="submit"
                disabled={submitting}
                style={{ width: "100%" }}
              >
                {submitting ? "Submitting…" : "Submit for Verification"}
              </Button>
            </form>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <Grid $cols={1} $gap="14px">
          <div>
            <StatLabel>Current status</StatLabel>
            <div style={{ marginTop: 6 }}>
              <Badge $tone={KYC_TONE[kycStatus?.kyc_status] || "neutral"}>
                {kycStatus?.kyc_status?.replace("_", " ") || "—"}
              </Badge>
            </div>
          </div>
          <div>
            <StatLabel>KYC level</StatLabel>
            <StatValue style={{ fontSize: 16 }}>
              {kycStatus?.kyc_level ?? "—"}
            </StatValue>
          </div>
          <div>
            <StatLabel>Documents submitted</StatLabel>
            <StatValue style={{ fontSize: 16 }}>
              {kycStatus?.documents_submitted ?? 0}
            </StatValue>
          </div>
          {kycStatus?.latest_document && (
            <div>
              <StatLabel>Latest document</StatLabel>
              <StatValue style={{ fontSize: 14 }}>
                {kycStatus.latest_document.type} ·{" "}
                {kycStatus.latest_document.status}
              </StatValue>
            </div>
          )}
        </Grid>
      </Card>
    </Grid>
  );
};

/* ─── Reports & Audit Panel ──────────────────────────────────────── */
const ReportsPanel = ({ reports, auditLogs, onGenerated }) => {
  const [form, setForm] = useState({
    reportType: "monthly",
    regulationType: "sox",
    periodStart: "",
    periodEnd: "",
  });
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.periodStart || !form.periodEnd) {
      setError("Select both a period start and end date.");
      return;
    }
    setGenerating(true);
    try {
      await complianceService.generateReport({
        reportType: form.reportType,
        regulationType: form.regulationType,
        periodStart: new Date(form.periodStart).toISOString(),
        periodEnd: new Date(form.periodEnd).toISOString(),
      });
      await onGenerated?.();
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't generate the report."));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card>
        <CardHeader>
          <CardTitle>
            <FiFileText /> Generate Report
          </CardTitle>
        </CardHeader>
        {error && <Alert $tone="danger">{error}</Alert>}
        <form onSubmit={handleGenerate}>
          <Field>
            <Label>Report type</Label>
            <Select value={form.reportType} onChange={update("reportType")}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </Select>
          </Field>
          <Field>
            <Label>Regulation</Label>
            <Select
              value={form.regulationType}
              onChange={update("regulationType")}
            >
              <option value="sox">SOX</option>
              <option value="mifid_ii">MiFID II</option>
              <option value="dodd_frank">Dodd-Frank</option>
              <option value="basel_iii">Basel III</option>
              <option value="cftc">CFTC</option>
            </Select>
          </Field>
          <Grid $cols={2} $gap="12px">
            <Field>
              <Label>Period start</Label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={update("periodStart")}
              />
            </Field>
            <Field>
              <Label>Period end</Label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={update("periodEnd")}
              />
            </Field>
          </Grid>
          <Button type="submit" disabled={generating} style={{ width: "100%" }}>
            {generating ? "Generating…" : "Generate Report"}
          </Button>
        </form>
      </Card>

      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>
            <FiDownload /> Generated Reports
          </CardTitle>
          <CardMeta>{reports.length} total</CardMeta>
        </CardHeader>
        {reports.length > 0 ? (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Regulation</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Generated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.report_id}>
                    <td style={{ textTransform: "capitalize" }}>
                      {r.report_type}
                    </td>
                    <td style={{ textTransform: "uppercase" }}>
                      {r.regulation_type}
                    </td>
                    <td>
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </td>
                    <td>
                      <Badge $tone="success">{r.status}</Badge>
                    </td>
                    <td>{formatDate(r.generated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState>
            <FiFileText />
            <h4>No reports yet</h4>
            <p>Generate your first regulatory report using the form.</p>
          </EmptyState>
        )}
      </Card>

      <Card style={{ gridColumn: "1 / -1" }}>
        <CardHeader>
          <CardTitle>
            <FiShield /> Audit Trail
          </CardTitle>
          <CardMeta>{auditLogs.length} recent events</CardMeta>
        </CardHeader>
        {auditLogs.length > 0 ? (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>IP</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((l) => (
                  <tr key={l.log_id}>
                    <td>{l.action}</td>
                    <td style={{ textTransform: "capitalize" }}>
                      {l.action_category}
                    </td>
                    <td>
                      <Badge
                        $tone={l.status === "success" ? "success" : "danger"}
                      >
                        {l.status}
                      </Badge>
                    </td>
                    <td>{l.ip_address || "—"}</td>
                    <td>{formatDateTime(l.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState>
            <FiShield />
            <h4>No audit events yet</h4>
          </EmptyState>
        )}
      </Card>
    </Grid>
  );
};

/* ─── Privacy / GDPR Panel ───────────────────────────────────────── */
const PrivacyPanel = () => {
  const [requestType, setRequestType] = useState("access");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await complianceService.requestGdprAction({
        requestType,
        description: description || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't submit that request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid $cols={3} $gap="18px">
      <Card style={{ gridColumn: "span 2" }}>
        <CardHeader>
          <CardTitle>Data Subject Rights (GDPR)</CardTitle>
        </CardHeader>
        <HelpText>
          Request access to, correction of, or deletion of your personal data,
          in line with GDPR and similar regulations.
        </HelpText>
        {error && (
          <Alert $tone="danger" style={{ marginTop: 14 }}>
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <Field>
            <Label>Request type</Label>
            <Select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
            >
              <option value="access">Access my data</option>
              <option value="rectification">Correct my data</option>
              <option value="erasure">
                Erase my data (right to be forgotten)
              </option>
              <option value="portability">Export my data</option>
              <option value="restriction">Restrict processing</option>
            </Select>
          </Field>
          <Field>
            <Label>Additional details (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything we should know about this request"
            />
          </Field>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </form>

        {result && (
          <Alert $tone="success" style={{ marginTop: 18 }}>
            Request received (ID: {result.request_id}). Estimated completion:{" "}
            {formatDate(result.estimated_completion)}.
            {result.verification_required &&
              " Identity verification will be required before this is processed."}
          </Alert>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What to expect</CardTitle>
        </CardHeader>
        <ul
          style={{
            paddingLeft: 18,
            fontSize: 13,
            lineHeight: 2,
            color: "var(--text-secondary)",
          }}
        >
          <li>Access &amp; rectification: typically 14 days</li>
          <li>Erasure &amp; portability: typically 30 days</li>
          <li>Sensitive requests may require identity verification</li>
          <li>You'll be notified by email once your request is processed</li>
        </ul>
      </Card>
    </Grid>
  );
};

export default Compliance;
