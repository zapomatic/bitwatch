import socketIO from "./io";
import { useCallback, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Title from "./Title";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import "./theme.css";

const formatInterval = (ms) => {
  if (!ms) return "";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  } else {
    return `${seconds} second${seconds > 1 ? "s" : ""}`;
  }
};

function Config() {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    socketIO.emit("getConfig", {}, (response) => {
      setConfig(response);
    });
  }, []);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const saveConfig = useCallback(() => {
    setSaving(true);
    socketIO.emit("saveConfig", config, (response) => {
      if (response) {
        setConfig(response);
        setNotification({
          open: true,
          message: "Configuration saved successfully!",
          severity: "success",
        });
      } else {
        setNotification({
          open: true,
          message: "Failed to save configuration. Please try again.",
          severity: "error",
        });
      }
      setSaving(false);
    });
  }, [config]);

  const configLabels = {
    interval: "Update Interval (ms)",
    apiParallelLimit: "API Parallel Requests",
    api: "API Endpoint",
  };

  return (
    <>
      <div className="crystal-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
          }}
        >
          <Title>Configuration</Title>
          <div className="crystal-toggle-group">
            <Button
              className="crystal-button"
              onClick={() =>
                setConfig({
                  ...config,
                  api: "http://10.21.21.26:3006",
                  apiParallelLimit: 100,
                  interval: 60000,
                })
              }
              sx={{
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                "&:hover": {
                  background: "rgba(77, 244, 255, 0.1)",
                  boxShadow: "0 0 10px var(--theme-glow-secondary)",
                },
              }}
            >
              Use Local Node
            </Button>
            <Button
              className="crystal-button"
              onClick={() =>
                setConfig({
                  ...config,
                  api: "https://mempool.space",
                  apiParallelLimit: 5,
                  interval: 600000,
                })
              }
              sx={{
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                "&:hover": {
                  background: "rgba(77, 244, 255, 0.1)",
                  boxShadow: "0 0 10px var(--theme-glow-secondary)",
                },
              }}
            >
              Use Public API
            </Button>
          </div>
        </div>
        <Grid container spacing={3}>
          {Object.keys(config).map((key) => (
            <Grid item xs={12} key={key}>
              <div className="data-item">
                <Typography
                  component="label"
                  htmlFor={key}
                  className="crystal-label"
                >
                  {configLabels[key] || key}
                </Typography>
                <input
                  id={key}
                  className="crystal-input"
                  value={config[key]}
                  onChange={(e) =>
                    setConfig({ ...config, [key]: e.target.value })
                  }
                  style={{ width: "100%" }}
                />
                {key === "interval" && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--theme-accent)",
                      marginTop: "0.25rem",
                      display: "block",
                      fontSize: "0.75rem",
                    }}
                  >
                    Updates every {formatInterval(parseInt(config[key]))} (if
                    running local mempool, you can run this much more
                    frequently)
                  </Typography>
                )}
                {key === "api" && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--theme-accent)",
                      marginTop: "0.25rem",
                      display: "block",
                      fontSize: "0.75rem",
                    }}
                  >
                    Most users should use https://mempool.space (default) or
                    http://10.21.21.26:3006 (umbrel)
                  </Typography>
                )}
                {key === "apiParallelLimit" && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "var(--theme-accent)",
                      marginTop: "0.25rem",
                      display: "block",
                      fontSize: "0.75rem",
                    }}
                  >
                    If you are using your own local mempool instance, you can
                    increase this number to speed up address monitoring.
                  </Typography>
                )}
              </div>
            </Grid>
          ))}
          <Grid item xs={12} sx={{ textAlign: "right", marginTop: 2 }}>
            <Button
              className="crystal-button crystal-button-primary"
              onClick={saveConfig}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </Grid>
        </Grid>
      </div>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{
          position: "fixed",
          top: "16px",
          right: "16px",
          zIndex: 9999,
        }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{
            width: "100%",
            background: "var(--theme-surface)",
            color: "var(--theme-text)",
            border: "1px solid rgba(77, 244, 255, 0.3)",
            boxShadow: "0 0 15px var(--theme-glow-secondary)",
            "& .MuiAlert-icon": {
              color:
                notification.severity === "error"
                  ? "var(--theme-danger)"
                  : notification.severity === "warning"
                  ? "var(--theme-warning)"
                  : "var(--theme-success)",
            },
          }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default Config;
