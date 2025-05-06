import React from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { formatSatoshis } from "../utils/format";

const BalanceCell = ({
  displayBtc,
  error,
  expect,
  label,
  monitor,
  pending,
  type,
  value,
  dataTestId,
}) => {
  if (pending) {
    return (
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography
          className="crystal-text"
          sx={{ opacity: 0.5 }}
          data-testid={dataTestId}
        >
          Loading...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text" sx={{ opacity: 0.5 }}>
          —
        </Typography>
        <Tooltip title="Failed to fetch balance">
          <WarningIcon
            className="crystal-text-warning"
            sx={{ fontSize: "1rem" }}
          />
        </Tooltip>
      </Box>
    );
  }

  // Convert values to numbers and handle undefined/null
  const actualValue = Number(value) || 0;
  const expectedValue = Number(expect) || 0;
  const diff = actualValue - expectedValue;
  const isVerified = diff === 0;

  // Get the monitoring setting for this specific type
  const monitoringSetting = monitor?.[type] || null;

  return (
    <Box className="crystal-flex crystal-flex-start crystal-gap-1">
      {label && <Typography className="crystal-text">{label}</Typography>}
      {!monitoringSetting ? (
        // Collection row - just show verification status
        isVerified ? (
          <CheckIcon
            className="crystal-text-success"
            sx={{ fontSize: "1rem" }}
          />
        ) : (
          <WarningIcon
            className="crystal-text-warning"
            sx={{ fontSize: "1rem" }}
          />
        )
      ) : // Individual address row - show monitoring status
      monitoringSetting === "auto-accept" ? (
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
      )}
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography
          className="crystal-text"
          aria-label="Balance value"
          data-testid={dataTestId}
        >
          {formatSatoshis(actualValue, displayBtc)}
        </Typography>
        {diff !== 0 && (
          <Typography
            className={`crystal-text ${
              diff > 0 ? "crystal-text-success" : "crystal-text-danger"
            }`}
            sx={{ fontSize: "0.9em", fontWeight: 500, ml: 1 }}
            aria-label="Balance difference"
            data-testid={`${dataTestId}-diff`}
          >
            ({diff > 0 ? "+" : ""}
            {formatSatoshis(diff, displayBtc)})
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default BalanceCell;
