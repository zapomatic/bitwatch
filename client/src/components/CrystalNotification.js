import React from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const CrystalNotification = ({
  open,
  onClose,
  message,
  severity = "info",
  testId = "notification",
}) => (
  <div
    style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: "100%",
      zIndex: 9999,
      pointerEvents: "none",
      display: "flex",
      justifyContent: "flex-end",
      padding: "16px",
    }}
  >
    <Snackbar
      open={open}
      autoHideDuration={6000}
      onClose={onClose}
      style={{
        position: "static",
        pointerEvents: "auto",
      }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        data-testid={testId}
        sx={{
          width: "100%",
          background: "var(--theme-surface)",
          color: "var(--theme-text)",
          border: "1px solid rgba(77, 244, 255, 0.3)",
          boxShadow: "0 0 15px var(--theme-glow-secondary)",
          "& .MuiAlert-icon": {
            color:
              severity === "error"
                ? "var(--theme-danger)"
                : severity === "warning"
                ? "var(--theme-warning)"
                : "var(--theme-success)",
          },
        }}
      >
        {message}
      </Alert>
    </Snackbar>
  </div>
);

export default CrystalNotification;
