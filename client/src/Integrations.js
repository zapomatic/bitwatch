import React, { useCallback, useEffect, useState } from "react";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Title from "./Title";
import socketIO from "./io";
import "./theme.css";

function Integrations() {
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    socketIO.emit("getIntegrations", {}, (response) => {
      setConfig(response || {});
    });
  }, []);

  const saveConfig = useCallback(() => {
    setSaving(true);
    setSaveMessage("");
    socketIO.emit("saveIntegrations", config, (response) => {
      console.log(response);
      if (response.success) {
        setSaveMessage("Settings saved successfully!");
      } else {
        setSaveMessage("Failed to save settings. Please try again.");
      }
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
          {saveMessage && (
            <Typography
              className={`crystal-status ${
                saveMessage.includes("success")
                  ? "crystal-status-success"
                  : "crystal-status-error"
              }`}
            >
              {saveMessage}
            </Typography>
          )}
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
  );
}

export default Integrations;
