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
          data-testid={`${dataTestId}-loading`}
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

  return (
    <Box className="crystal-flex crystal-flex-start crystal-gap-1">
      {label && <Typography className="crystal-text">{label}</Typography>}
      {isVerified ? (
        <CheckIcon className="crystal-text-success" sx={{ fontSize: "1rem" }} />
      ) : (
        <WarningIcon
          className="crystal-text-warning"
          sx={{ fontSize: "1rem" }}
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
        {!isVerified && (
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
      {monitor && type && (
        <Box
          className="crystal-flex crystal-flex-start crystal-gap-1"
          sx={{ ml: 1 }}
        >
          <Tooltip
            title={`Incoming: ${
              monitor[`${type}_in`] === "alert"
                ? "Alert on changes"
                : "Auto-accept changes"
            }`}
          >
            {monitor[`${type}_in`] === "alert" ? (
              <NotificationsActiveIcon
                className="crystal-text-warning"
                sx={{ fontSize: "1rem" }}
                aria-label="Incoming alert status"
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
                aria-label="Incoming auto-accept status"
              />
            )}
          </Tooltip>
          <Tooltip
            title={`Outgoing: ${
              monitor[`${type}_out`] === "alert"
                ? "Alert on changes"
                : "Auto-accept changes"
            }`}
          >
            {monitor[`${type}_out`] === "alert" ? (
              <NotificationsActiveIcon
                className="crystal-text-warning"
                sx={{ fontSize: "1rem" }}
                aria-label="Outgoing alert status"
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
                aria-label="Outgoing auto-accept status"
              />
            )}
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default BalanceCell;
