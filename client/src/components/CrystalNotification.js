import React from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const CrystalNotification = ({ open, onClose, message, severity = "info" }) => (
  <Snackbar
    open={open}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{ vertical: "top", horizontal: "right" }}
    sx={{
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: 9999,
    }}
  >
    <Alert
      onClose={onClose}
      severity={severity}
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
);

export default CrystalNotification;
