import React from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import WarningIcon from "@mui/icons-material/Warning";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { formatSatoshis } from "../utils/format";
import { DEFAULT_EXPECTED_BALANCES } from "../config";

const BalanceCell = ({
  displayBtc,
  error,
  expect = DEFAULT_EXPECTED_BALANCES,
  label,
  monitor,
  pending,
  type,
  value,
}) => {
  if (pending) {
    return (
      <Box className="crystal-flex crystal-flex-start crystal-gap-1">
        <Typography className="crystal-text" sx={{ opacity: 0.5 }}>
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

  const diff = value - (expect[type] || 0);
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
        <Typography className="crystal-text">
          {formatSatoshis(value, displayBtc)}
        </Typography>
        {!isVerified && (
          <Typography
            className={`crystal-text ${
              diff > 0 ? "crystal-text-success" : "crystal-text-danger"
            }`}
            sx={{ fontSize: "0.9em", fontWeight: 500, ml: 1 }}
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
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
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
              />
            ) : (
              <CheckCircleIcon
                className="crystal-text-success"
                sx={{ fontSize: "1rem" }}
              />
            )}
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};

export default BalanceCell;
