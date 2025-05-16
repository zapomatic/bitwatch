import React from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatSatoshis } from "../utils/format";

const BalanceCell = ({
  displayBtc,
  error,
  expect,
  label,
  monitor,
  pending,
  queued,
  type,
  value,
  dataTestId,
}) => {
  // Get the monitoring setting for this specific type
  const monitoringSetting = monitor?.[type] || null;

  // Helper to render monitoring icon
  const renderMonitoringIcon = () => {
    // Individual address row - must have monitoring status
    if (monitor) {
      if (!monitoringSetting) {
        console.error(
          `Missing monitoring setting for ${type} on address ${dataTestId}`
        );
        return (
          <WarningIcon
            className="crystal-text-warning"
            sx={{ fontSize: "1rem" }}
            aria-label={`Missing monitoring setting for ${type}`}
            data-testid={`${dataTestId}-${type}-alert-icon`}
          />
        );
      }

      return monitoringSetting === "auto-accept" ? (
        <CheckCircleIcon
          className="crystal-text-success"
          sx={{ fontSize: "1rem" }}
          aria-label={`Auto-accept monitoring for ${type}`}
          data-testid={`${dataTestId}-auto-accept-icon`}
        />
      ) : (
        <NotificationsActiveIcon
          className="crystal-text-warning"
          sx={{ fontSize: "1rem" }}
          aria-label={`Alert monitoring for ${type}`}
          data-testid={`${dataTestId}-alert-icon`}
        />
      );
    }

    // Collection row - show verification status
    return value === expect ? (
      <CheckIcon className="crystal-text-success" sx={{ fontSize: "1rem" }} />
    ) : (
      <WarningIcon className="crystal-text-warning" sx={{ fontSize: "1rem" }} />
    );
  };

  // Convert values to numbers and handle undefined/null
  const actualValue = Number(value) || 0;
  const expectedValue = Number(expect) || 0;
  const diff = actualValue - expectedValue;

  return (
    <Box className="crystal-flex crystal-flex-start crystal-gap-1">
      {label && <Typography className="crystal-text">{label}</Typography>}
      {renderMonitoringIcon()}
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography
          className="crystal-text"
          aria-label="Balance value"
          data-testid={dataTestId}
          sx={{
            opacity: pending || actualValue === 0 ? 0.3 : 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {pending
            ? "queued..."
            : error
            ? "—"
            : formatSatoshis(actualValue, displayBtc)}
          <Tooltip title={queued ? "Balance update queued" : ""}>
            <RefreshIcon
              className="crystal-text-secondary"
              sx={{
                fontSize: "1rem",
                visibility: queued ? "visible" : "hidden",
                animation: queued ? "spin 1s linear infinite" : "none",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            />
          </Tooltip>
          {!pending && !error && diff !== 0 && (
            <Typography
              className={`crystal-text ${
                diff > 0 ? "crystal-text-success" : "crystal-text-danger"
              }`}
              sx={{ fontSize: "0.9em", fontWeight: 500 }}
              aria-label="Balance difference"
              data-testid={`${dataTestId}-diff`}
            >
              ({diff > 0 ? "+" : ""}
              {formatSatoshis(diff, displayBtc)})
            </Typography>
          )}
        </Typography>
        {error && (
          <Tooltip title="Failed to fetch balance">
            <WarningIcon
              className="crystal-text-warning"
              sx={{ fontSize: "1rem" }}
            />
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

export default BalanceCell;
