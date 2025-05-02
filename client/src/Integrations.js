import React, { useCallback, useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Title from "./Title";
import socketIO from "./io";
import CrystalNotification from "./components/CrystalNotification";
import "./theme.css";

function Integrations() {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    socketIO.emit("getIntegrations", {}, (response) => {
      setConfig(response || {});
    });
  }, []);

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const saveConfig = useCallback(() => {
    console.log("Saving config:", config);
    setSaving(true);
    socketIO.emit("saveIntegrations", config, (response) => {
      console.log("Save response received:", response);
      if (!response) {
        console.error("No response received from saveIntegrations");
        return;
      }
      setNotification({
        open: true,
        message: response.success
          ? "Settings saved successfully!"
          : "Failed to create telegram bot. Check credentials and try again.",
        severity: response.success ? "success" : "error",
      });
      setSaving(false);
    });
  }, [config]);

  const handleChange = (section, field, value) => {
    setConfig((prev) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value,
      },
    }));
  };

  return (
    <>
      <div className="crystal-panel">
        <Title>Integrations</Title>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <div className="data-item">
              <Typography variant="h6" className="crystal-heading">
                Telegram
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography
                    component="label"
                    htmlFor="telegram-token"
                    className="crystal-label"
                  >
                    Bot Token (Create a new bot with{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crystal-link"
                    >
                      @BotFather
                    </a>
                    )
                  </Typography>
                  <input
                    id="telegram-token"
                    className="crystal-input"
                    value={config.telegram?.token || ""}
                    onChange={(e) =>
                      handleChange("telegram", "token", e.target.value)
                    }
                    placeholder="Enter your Telegram bot token"
                    style={{ width: "100%" }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography
                    component="label"
                    htmlFor="telegram-chatid"
                    className="crystal-label"
                  >
                    Chat ID (send a message to{" "}
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crystal-link"
                    >
                      @userinfobot
                    </a>
                    )
                  </Typography>
                  <input
                    id="telegram-chatid"
                    className="crystal-input"
                    value={config.telegram?.chatId || ""}
                    onChange={(e) =>
                      handleChange("telegram", "chatId", e.target.value)
                    }
                    placeholder="Enter your Telegram chat ID"
                    style={{ width: "100%" }}
                  />
                </Grid>
              </Grid>
            </div>
          </Grid>

          <Grid item xs={12} sx={{ textAlign: "right", marginTop: 2 }}>
            <Button
              className="crystal-button crystal-button-primary"
              onClick={saveConfig}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Integrations"}
            </Button>
          </Grid>
        </Grid>
      </div>

      <CrystalNotification
        open={notification.open}
        onClose={handleCloseNotification}
        message={notification.message}
        severity={notification.severity}
      />
    </>
  );
}

export default Integrations;
