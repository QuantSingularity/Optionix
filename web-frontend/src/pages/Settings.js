import { useCallback, useEffect, useState } from "react";
import {
  FiBriefcase,
  FiLogOut,
  FiPlus,
  FiShield,
  FiUser,
} from "react-icons/fi";
import CreateAccountPrompt from "../components/common/CreateAccountPrompt";
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
  Grid,
  PageHeader,
  PageSubtitle,
  PageTitle,
  PageWrap,
  StatLabel,
  StatValue,
  Table,
  TableScroll,
} from "../components/common/UI";
import tradingService from "../services/tradingService";
import { extractErrorMessage } from "../services/apiClient";
import { formatCurrency, formatDate } from "../utils/format";
import { useAuth } from "../utils/AuthContext";

const KYC_TONE = {
  verified: "success",
  approved: "success",
  under_review: "warning",
  pending: "neutral",
  rejected: "danger",
};

const Settings = () => {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const accts = await tradingService.listAccounts();
      setAccounts(accts);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't load your accounts."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return (
    <PageWrap>
      <PageHeader>
        <div>
          <PageTitle>Settings</PageTitle>
          <PageSubtitle>
            Manage your profile, trading accounts, and security preferences.
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <Alert $tone="danger">{error}</Alert>}

      <Grid $cols={3} $gap="18px" style={{ marginBottom: 20 }}>
        <Card style={{ gridColumn: "span 2" }}>
          <CardHeader>
            <CardTitle>
              <FiUser /> Profile
            </CardTitle>
          </CardHeader>
          <Grid $cols={2} $gap="16px">
            <div>
              <StatLabel>Full name</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {user?.full_name || "—"}
              </StatValue>
            </div>
            <div>
              <StatLabel>Email</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {user?.email || "—"}
              </StatValue>
            </div>
            <div>
              <StatLabel>Role</StatLabel>
              <StatValue style={{ fontSize: 16, textTransform: "capitalize" }}>
                {user?.role || "—"}
              </StatValue>
            </div>
            <div>
              <StatLabel>Member since</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {formatDate(user?.created_at)}
              </StatValue>
            </div>
            <div>
              <StatLabel>Last login</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {user?.last_login
                  ? formatDate(user.last_login)
                  : "This session"}
              </StatValue>
            </div>
            <div>
              <StatLabel>Account verified</StatLabel>
              <div style={{ marginTop: 6 }}>
                <Badge $tone={user?.is_verified ? "success" : "neutral"}>
                  {user?.is_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>
          </Grid>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <FiShield /> Security
            </CardTitle>
          </CardHeader>
          <Grid $cols={1} $gap="14px">
            <div>
              <StatLabel>KYC status</StatLabel>
              <div style={{ marginTop: 6 }}>
                <Badge $tone={KYC_TONE[user?.kyc_status] || "neutral"}>
                  {user?.kyc_status?.replace("_", " ") || "—"}
                </Badge>
              </div>
            </div>
            <div>
              <StatLabel>Two-factor authentication</StatLabel>
              <div style={{ marginTop: 6 }}>
                <Badge $tone={user?.mfa_enabled ? "success" : "neutral"}>
                  {user?.mfa_enabled ? "Enabled" : "Not enabled"}
                </Badge>
              </div>
            </div>
            <div>
              <StatLabel>Risk score</StatLabel>
              <StatValue style={{ fontSize: 16 }}>
                {user?.risk_score ?? "—"}/100
              </StatValue>
            </div>
            <Button
              type="button"
              $variant="danger"
              $sm
              onClick={logout}
              style={{ marginTop: 4 }}
            >
              <FiLogOut /> Sign out
            </Button>
          </Grid>
        </Card>
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle>
            <FiBriefcase /> Trading Accounts
          </CardTitle>
          <Button $sm onClick={() => setShowCreate((s) => !s)}>
            <FiPlus /> New Account
          </Button>
        </CardHeader>

        {showCreate && (
          <div style={{ marginBottom: 20 }}>
            <CreateAccountPrompt
              onCreated={() => {
                setShowCreate(false);
                loadAccounts();
              }}
            />
          </div>
        )}

        {isLoading ? (
          <CenteredSpinner $minHeight="120px" />
        ) : accounts.length > 0 ? (
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Margin Used</th>
                  <th>Opened</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.account_id}>
                    <td style={{ fontSize: 12 }}>
                      {a.account_id.slice(0, 8)}…
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {a.account_type}
                    </td>
                    <td>
                      <Badge
                        $tone={
                          a.account_status === "active" ? "success" : "neutral"
                        }
                      >
                        {a.account_status}
                      </Badge>
                    </td>
                    <td>{formatCurrency(a.balance_usd)}</td>
                    <td>{formatCurrency(a.margin_used)}</td>
                    <td>{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        ) : (
          <EmptyState>
            <FiBriefcase />
            <h4>No trading accounts</h4>
            <p>Open one to start trading.</p>
          </EmptyState>
        )}
        <CardMeta style={{ display: "block", marginTop: 14 }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""} total
        </CardMeta>
      </Card>
    </PageWrap>
  );
};

export default Settings;
