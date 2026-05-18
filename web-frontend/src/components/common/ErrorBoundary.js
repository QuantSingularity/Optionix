import React from "react";

// ErrorBoundary intentionally uses ONLY inline styles for its error UI.
// If styled-components itself is what crashed, we cannot use it to display
// the error — we'd get a second crash and a permanently blank page.

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === "development";

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            backgroundColor: "#131722",
            color: "#ffffff",
            padding: "40px",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{ fontSize: "48px", marginBottom: "16px", lineHeight: 1 }}
          >
            ⚠️
          </div>

          <h2
            style={{
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: 700,
              margin: "0 0 10px",
            }}
          >
            Something went wrong
          </h2>

          <p
            style={{
              color: "#b2b5be",
              fontSize: "15px",
              margin: "0 0 28px",
              textAlign: "center",
              maxWidth: "480px",
            }}
          >
            An unexpected error occurred. Please reload the page to continue.
          </p>

          {isDev && this.state.error && (
            <details
              style={{
                width: "100%",
                maxWidth: "720px",
                marginBottom: "28px",
                cursor: "pointer",
              }}
            >
              <summary
                style={{
                  color: "#b2b5be",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  outline: "none",
                }}
              >
                Error details (development)
              </summary>
              <pre
                style={{
                  backgroundColor: "#1e222d",
                  border: "1px solid #2a2e39",
                  borderRadius: "6px",
                  padding: "14px",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: "12px",
                  color: "#ef5350",
                  margin: 0,
                }}
              >
                <strong>Error:</strong> {this.state.error.toString()}
                {"\n\n"}
                <strong style={{ color: "#b2b5be" }}>Component Stack:</strong>
                {"\n"}
                <span style={{ color: "#b2b5be" }}>
                  {this.state.errorInfo?.componentStack}
                </span>
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReload}
            style={{
              backgroundColor: "#2962ff",
              color: "white",
              padding: "12px 28px",
              border: "none",
              borderRadius: "6px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
