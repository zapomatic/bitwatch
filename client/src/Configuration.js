import socketIO from "./io";
import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Title from "./Title";
import "./theme.css";
import { FormControlLabel, Switch } from "@mui/material";
import CrystalNotification from "./components/CrystalNotification";
import { Box } from "@mui/material";

import { DEFAULT_CONFIG, PRIVATE_CONFIG } from "./config";

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

const Configs = {
  api: {
    label: "API Endpoint",
    help: "Most users should use https://mempool.space (default) or http://10.21.21.26:3006 (umbrel)",
    default: DEFAULT_CONFIG.api,
  },
  interval: {
    label: "Update Interval (ms)",
    help: (value) =>
      `Updates every ${formatInterval(
        parseInt(value)
      )} (if running local mempool, you can run this much more frequently)`,
    default: DEFAULT_CONFIG.interval,
  },
  apiParallelLimit: {
    label: "API Parallel Requests",
    help: "If you are using your own local mempool instance, you can increase this number to speed up address monitoring. If you are only watching a few addresses, you can also increase this when using public mempool.space API, but with a lot of addresses, you will hit rate limits and it will slow things down more.",
    default: DEFAULT_CONFIG.apiParallelLimit,
  },
  apiDelay: {
    label: "API Delay Between Requests (ms)",
    help: "Delay between API requests to avoid rate limiting. This is used when we add an extended pub key and initially scan for balances and when we poll the API for changes on the interval. We will additionally backoff and retry if we get limited.",
    default: DEFAULT_CONFIG.apiDelay,
  },
  debugLogging: {
    label: "Enable Debug Logging",
    help: "Show detailed debug logs in the server console",
    default: DEFAULT_CONFIG.debugLogging,
  },
};

function Config() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    socketIO.emit("getConfig", {}, (response) => {
      const mergedConfig = { ...DEFAULT_CONFIG, ...response };
      console.log(`getConfig`, { response, mergedConfig });
      setConfig(mergedConfig);
    });
  }, []);

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleSave = () => {
    socketIO.emit(
      "saveConfig",
      {
        api: config.api,
        apiDelay: parseInt(config.apiDelay),
        apiParallelLimit: parseInt(config.apiParallelLimit),
        interval: parseInt(config.interval),
        debugLogging: config.debugLogging,
      },
      (response) => {
        if (response.error) {
          return setNotification({
            open: true,
            message: response.error,
            severity: "error",
          });
        }
        setNotification({
          open: true,
          message: "Configuration saved successfully",
          severity: "success",
        });
      }
    );
  };

  const renderConfigField = (key) => {
    if (key === "debugLogging") {
      return (
        <div
          className="data-item"
          style={{
            display: "flex",
            alignItems: "flex-start",
            flexDirection: "column",
          }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={config[key] ?? Configs[key].default}
                onChange={(e) =>
                  setConfig({ ...config, [key]: e.target.checked })
                }
                inputProps={{
                  "aria-label": Configs[key].label,
                  "data-testid": `config-${key}`,
                }}
              />
            }
            label={Configs[key].label}
          />
          {Configs[key].help && (
            <Typography
              variant="caption"
              sx={{
                color: "var(--theme-accent)",
                marginTop: "0.25rem",
                display: "block",
                fontSize: "0.75rem",
              }}
            >
              {typeof Configs[key].help === "function"
                ? Configs[key].help(config[key] ?? Configs[key].default)
                : Configs[key].help}
            </Typography>
          )}
        </div>
      );
    }

    return (
      <div className="data-item">
        <Typography component="label" htmlFor={key} className="crystal-label">
          {Configs[key].label}
        </Typography>
        <input
          id={key}
          className="crystal-input"
          value={config[key] ?? Configs[key].default}
          onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
          style={{ width: "100%" }}
          aria-label={Configs[key].label}
          data-testid={`config-${key}`}
        />
        {Configs[key].help && (
          <Typography
            variant="caption"
            sx={{
              color: "var(--theme-accent)",
              marginTop: "0.25rem",
              display: "block",
              fontSize: "0.75rem",
            }}
          >
            {typeof Configs[key].help === "function"
              ? Configs[key].help(config[key] ?? Configs[key].default)
              : Configs[key].help}
          </Typography>
        )}
      </div>
    );
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
              onClick={() => setConfig(PRIVATE_CONFIG)}
              sx={{
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                "&:hover": {
                  background: "rgba(77, 244, 255, 0.1)",
                  boxShadow: "0 0 10px var(--theme-glow-secondary)",
                },
              }}
              aria-label="Use Local Node"
              data-testid="use-local-node"
            >
              Use Local Node
            </Button>
            <Button
              className="crystal-button"
              onClick={() => setConfig(DEFAULT_CONFIG)}
              sx={{
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                "&:hover": {
                  background: "rgba(77, 244, 255, 0.1)",
                  boxShadow: "0 0 10px var(--theme-glow-secondary)",
                },
              }}
              aria-label="Use Public API"
              data-testid="use-public-api"
            >
              Use Public API
            </Button>
          </div>
        </div>
        <div className="crystal-panel-content">
          <Grid
            container
            spacing={3}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, 1fr)",
              },
              gap: 3,
            }}
          >
            {Object.keys(Configs).map((key) => (
              <Grid item key={key}>
                {renderConfigField(key)}
              </Grid>
            ))}
          </Grid>
          <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
            <Button
              className="crystal-button crystal-button-primary"
              onClick={handleSave}
              aria-label="Save Configuration"
              data-testid="save-configuration"
            >
              Save Configuration
            </Button>
          </Box>
        </div>
      </div>

      <CrystalNotification
        open={notification.open}
        onClose={handleCloseNotification}
        message={notification.message}
        severity={notification.severity}
        testId="config-notification"
      />
    </>
  );
}

export default Config;
