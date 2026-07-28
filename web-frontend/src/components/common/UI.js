import styled, { css, keyframes } from "styled-components";

/* ─── Shared animations ──────────────────────────────────────────── */
export const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`;
export const spin = keyframes`to{transform:rotate(360deg)}`;

/* ─── Page scaffolding ───────────────────────────────────────────── */
export const PageWrap = styled.div`
  padding: 32px clamp(20px, 4vw, 44px) 64px;
  max-width: 1440px;
  margin: 0 auto;
  animation: ${fadeUp} 0.4s ease both;
`;

export const PageHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
`;

export const PageTitle = styled.h1`
  font-family: "Syne", sans-serif;
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
`;

export const PageSubtitle = styled.p`
  color: var(--text-secondary);
  font-size: 14.5px;
  margin-top: 6px;
  max-width: 640px;
  line-height: 1.6;
`;

/* ─── Grid helpers ───────────────────────────────────────────────── */
export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols || 4}, 1fr);
  gap: ${(p) => p.$gap || "18px"};
  @media (max-width: 1100px) {
    grid-template-columns: repeat(${(p) => Math.min(p.$cols || 4, 2)}, 1fr);
  }
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

/* ─── Card ───────────────────────────────────────────────────────── */
export const Card = styled.div`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: ${(p) => p.$pad || "22px"};
  position: relative;
  transition:
    border-color 0.2s,
    transform 0.2s;
  ${(p) =>
    p.$hoverable &&
    css`
      cursor: pointer;
      &:hover {
        border-color: var(--border-accent);
        transform: translateY(-2px);
      }
    `}
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
`;

export const CardTitle = styled.h3`
  font-family: "Syne", sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const CardMeta = styled.span`
  font-size: 12.5px;
  color: var(--text-secondary);
  font-family: "DM Mono", monospace;
`;

/* ─── Stat block ─────────────────────────────────────────────────── */
export const StatCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const StatLabel = styled.span`
  font-size: 12.5px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const StatValue = styled.span`
  font-family: "DM Mono", monospace;
  font-size: clamp(1.3rem, 2vw, 1.7rem);
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.01em;
`;

export const StatDelta = styled.span`
  font-family: "DM Mono", monospace;
  font-size: 13px;
  font-weight: 500;
  color: ${(p) => (p.$negative ? "var(--danger)" : "var(--success)")};
`;

/* ─── Buttons ────────────────────────────────────────────────────── */
export const Button = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: "DM Sans", sans-serif;
  font-weight: 600;
  font-size: 14px;
  padding: ${(p) => (p.$sm ? "8px 16px" : "12px 22px")};
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;

  ${(p) =>
    p.$variant === "ghost"
      ? css`
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
          border-color: var(--border);
          &:hover {
            background: rgba(255, 255, 255, 0.09);
          }
        `
      : p.$variant === "danger"
        ? css`
            background: rgba(239, 68, 68, 0.12);
            color: #fca5a5;
            border-color: rgba(239, 68, 68, 0.3);
            &:hover {
              background: rgba(239, 68, 68, 0.2);
            }
          `
        : p.$variant === "success"
          ? css`
              background: var(--success);
              color: #fff;
              &:hover {
                background: #0ea271;
              }
            `
          : p.$variant === "gold"
            ? css`
                background: linear-gradient(135deg, #d4af6a, #b8934f);
                color: #14110a;
                &:hover {
                  filter: brightness(1.08);
                }
              `
            : css`
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: #fff;
                &:hover {
                  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
                  transform: translateY(-1px);
                }
              `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }
`;

/* ─── Badges / status pills ──────────────────────────────────────── */
export const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 11px;
  border-radius: 100px;
  font-family: "DM Sans", sans-serif;
  text-transform: capitalize;

  ${(p) => {
    const tone = p.$tone || "neutral";
    const map = {
      success: css`
        background: rgba(16, 185, 129, 0.14);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      `,
      danger: css`
        background: rgba(239, 68, 68, 0.14);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      `,
      warning: css`
        background: rgba(245, 158, 11, 0.14);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      `,
      info: css`
        background: rgba(59, 130, 246, 0.14);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.3);
      `,
      gold: css`
        background: rgba(212, 175, 106, 0.14);
        color: var(--gold);
        border: 1px solid rgba(212, 175, 106, 0.35);
      `,
      neutral: css`
        background: rgba(255, 255, 255, 0.07);
        color: var(--text-secondary);
        border: 1px solid var(--border);
      `,
    };
    return map[tone] || map.neutral;
  }}
`;

/* ─── Form elements ──────────────────────────────────────────────── */
export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 18px;
`;

export const Label = styled.label`
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

export const inputStyles = css`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14.5px;
  color: var(--text-primary);
  font-family: "DM Sans", sans-serif;
  transition: border-color 0.15s;
  width: 100%;

  &:focus {
    outline: none;
    border-color: var(--primary);
  }
  &::placeholder {
    color: #5b6478;
  }
`;

export const Input = styled.input`
  ${inputStyles}
`;
export const Select = styled.select`
  ${inputStyles}
  appearance: none;
`;
export const TextArea = styled.textarea`
  ${inputStyles}
  resize: vertical;
  min-height: 90px;
`;

export const HelpText = styled.span`
  font-size: 12.5px;
  color: var(--text-secondary);
`;

export const ErrorText = styled.span`
  font-size: 13px;
  color: #f87171;
  display: flex;
  align-items: center;
  gap: 6px;
`;

/* ─── Table ──────────────────────────────────────────────────────── */
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;

  thead th {
    text-align: left;
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0 12px 12px;
    border-bottom: 1px solid var(--border);
  }
  tbody td {
    padding: 13px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    font-family: "DM Mono", monospace;
    vertical-align: middle;
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
  tbody tr {
    transition: background 0.15s;
  }
  tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }
`;

export const TableScroll = styled.div`
  overflow-x: auto;
`;

/* ─── Empty / loading states ─────────────────────────────────────── */
export const EmptyState = styled.div`
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);

  svg {
    font-size: 32px;
    color: var(--border-accent);
    margin-bottom: 14px;
  }
  h4 {
    font-family: "Syne", sans-serif;
    color: var(--text-primary);
    font-size: 16px;
    margin-bottom: 6px;
  }
  p {
    font-size: 13.5px;
    max-width: 340px;
    margin: 0 auto;
  }
`;

export const Spinner = styled.div`
  width: ${(p) => p.$size || "22px"};
  height: ${(p) => p.$size || "22px"};
  border-radius: 50%;
  border: 2.5px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--primary);
  animation: ${spin} 0.7s linear infinite;
`;

export const CenteredSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: ${(p) => p.$minHeight || "240px"};
`;

/* ─── Alert banner ───────────────────────────────────────────────── */
export const Alert = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px 16px;
  border-radius: 10px;
  font-size: 13.5px;
  line-height: 1.5;
  margin-bottom: 20px;

  ${(p) =>
    p.$tone === "danger"
      ? css`
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #fca5a5;
        `
      : p.$tone === "success"
        ? css`
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.28);
            color: #6ee7b7;
          `
        : p.$tone === "warning"
          ? css`
              background: rgba(245, 158, 11, 0.1);
              border: 1px solid rgba(245, 158, 11, 0.28);
              color: #fcd34d;
            `
          : css`
              background: rgba(59, 130, 246, 0.1);
              border: 1px solid rgba(59, 130, 246, 0.28);
              color: #93c5fd;
            `}
`;

/* ─── Modal ──────────────────────────────────────────────────────── */
export const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 13, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;

export const ModalBox = styled.div`
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 28px;
  width: 100%;
  max-width: ${(p) => p.$maxWidth || "440px"};
  max-height: 88vh;
  overflow-y: auto;
  animation: ${fadeUp} 0.25s ease both;
`;

/* ─── Segmented control (used for buy/sell, tabs, etc.) ──────────── */
export const Segmented = styled.div`
  display: inline-flex;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 4px;
  gap: 2px;
`;

export const SegmentedBtn = styled.button`
  padding: 8px 18px;
  border-radius: 7px;
  border: none;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  font-family: "DM Sans", sans-serif;
  transition: all 0.15s;
  color: ${(p) => (p.$active ? "#fff" : "var(--text-secondary)")};
  background: ${(p) =>
    p.$active
      ? p.$tone === "danger"
        ? "var(--danger)"
        : p.$tone === "success"
          ? "var(--success)"
          : "var(--primary)"
      : "transparent"};
`;
