import React, { useState } from "react";
import { TableRow, TableCell, Box, Typography, Tooltip } from "@mui/material";
import IconButtonStyled from "../components/IconButtonStyled";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import BalanceCell from "./BalanceCell";
import socketIO from "../io";

const AddressCell = ({ address }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    textarea.select();
    const successful = document.execCommand("copy");
    if (successful) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }

    document.body.removeChild(textarea);
  };

  return (
    <Box
      className="crystal-flex crystal-flex-start crystal-gap-1"
      sx={{ width: "100%" }}
    >
      <Box
        component="a"
        href={`https://mempool.space/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="crystal-link"
        onClick={(e) => e.stopPropagation()}
      >
        {`${address.slice(0, 15)}...`}
      </Box>
      <IconButtonStyled
        size="small"
        onClick={handleCopy}
        icon={<ContentCopyIcon fontSize="small" />}
        title={copied ? "Copied!" : "Copy full address"}
      />
    </Box>
  );
};

const AddressRow = ({
  address,
  collection,
  displayBtc,
  setNotification,
  parentKey,
  index,
  onDelete,
  onEditAddress,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRefreshing(true);
    setNotification({
      open: true,
      message: `Refreshing balance for ${address.name}...`,
      severity: "info",
    });

    socketIO.emit(
      "refreshBalance",
      {
        collection: collection.name,
        address: address.address,
      },
      (response) => {
        setIsRefreshing(false);
        if (response.error) {
          setNotification({
            open: true,
            message: `Failed to refresh balance: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Balance refreshed successfully",
            severity: "success",
          });
        }
      }
    );
  };

  const handleEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onEditAddress(collection, {
      ...address,
      parentKey: parentKey,
    });
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Determine if this is an extended key or descriptor address
    const isExtendedKey = collection.extendedKeys?.some(
      (k) => k.key === parentKey
    );
    const isDescriptor = collection.descriptors?.some(
      (d) => d.descriptor === parentKey
    );

    onDelete({
      collection: collection.name,
      address: address.address,
      ...(isExtendedKey ? { extendedKey: parentKey } : {}),
      ...(isDescriptor ? { descriptor: parentKey } : {}),
      message: isExtendedKey
        ? "Remove this address from the extended key set?"
        : isDescriptor
        ? "Remove this address from the descriptor set?"
        : "Remove this address from the collection?",
    });
  };

  const handleSaveExpected = (e) => {
    e.preventDefault();
    e.stopPropagation();
    socketIO.emit(
      "saveExpected",
      {
        collection: collection.name,
        address: address.address,
        actual: address.actual,
        expect: address.actual,
      },
      (response) => {
        if (response.error) {
          setNotification({
            open: true,
            message: `Failed to save expected balance: ${response.error}`,
            severity: "error",
          });
        } else {
          setNotification({
            open: true,
            message: "Expectations saved successfully",
            severity: "success",
          });
        }
      }
    );
  };

  // Helper to check if any balance has changed
  const hasBalanceChanges =
    address.actual &&
    (address.actual.chain_in !== address.expect.chain_in ||
      address.actual.chain_out !== address.expect.chain_out ||
      address.actual.mempool_in !== address.expect.mempool_in ||
      address.actual.mempool_out !== address.expect.mempool_out);

  const testId = parentKey ? `${parentKey}-address-${index}` : address.address;

  return (
    <TableRow
      className="crystal-table-row address-row"
      data-testid={`${testId}-row`}
      aria-label={`Address ${address.name}`}
    >
      <TableCell>
        <Box className="crystal-flex crystal-flex-start crystal-gap-1">
          <Typography className="crystal-text" data-testid={`${testId}-name`}>
            {address.name}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>
        <AddressCell address={address.address} />
      </TableCell>
      <TableCell className="crystal-table-cell">
        <Box className="crystal-flex crystal-flex-start">
          <BalanceCell
            label="⬅️"
            value={address.actual?.chain_in}
            expect={address.expect?.chain_in}
            displayBtc={displayBtc}
            error={address.error}
            pending={!address.actual && !address.error}
            monitor={address.monitor}
            type="chain_in"
            dataTestId={`${testId}-chain-in`}
          />
        </Box>
        <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
          <BalanceCell
            label="➡️"
            value={address.actual?.chain_out}
            expect={address.expect?.chain_out}
            displayBtc={displayBtc}
            error={address.error}
            pending={!address.actual && !address.error}
            monitor={address.monitor}
            type="chain_out"
            dataTestId={`${testId}-chain-out`}
          />
        </Box>
      </TableCell>
      <TableCell className="crystal-table-cell">
        <Box className="crystal-flex crystal-flex-start">
          <BalanceCell
            value={address.actual?.mempool_in}
            expect={address.expect?.mempool_in}
            displayBtc={displayBtc}
            error={address.error}
            pending={!address.actual && !address.error}
            monitor={address.monitor}
            type="mempool_in"
            dataTestId={`${testId}-mempool-in`}
          />
        </Box>
        <Box className="crystal-flex crystal-flex-start" sx={{ mt: 1 }}>
          <BalanceCell
            value={address.actual?.mempool_out}
            expect={address.expect?.mempool_out}
            displayBtc={displayBtc}
            error={address.error}
            pending={!address.actual && !address.error}
            monitor={address.monitor}
            type="mempool_out"
            dataTestId={`${testId}-mempool-out`}
          />
        </Box>
      </TableCell>
      <TableCell>
        <Box className="crystal-flex crystal-flex-start crystal-gap-1">
          <Tooltip
            title={
              address.trackWebsocket
                ? "Real-time balance updates enabled via mempool.space WebSocket"
                : "Real-time balance updates disabled"
            }
            arrow
          >
            <Typography variant="body2">
              {address.trackWebsocket ? (
                <span
                  role="img"
                  aria-label="WebSocket tracking enabled"
                  style={{ color: "#4CAF50" }}
                >
                  ●
                </span>
              ) : (
                <span
                  role="img"
                  aria-label="WebSocket tracking disabled"
                  style={{ color: "#AAA" }}
                >
                  ●
                </span>
              )}
            </Typography>
          </Tooltip>
        </Box>
      </TableCell>
      <TableCell>
        <Box className="crystal-flex crystal-flex-right crystal-gap-1">
          <IconButtonStyled
            size="small"
            icon={<RefreshIcon fontSize="small" />}
            onClick={handleRefresh}
            data-testid={`${testId}-refresh-button`}
            aria-label="Refresh balance"
            disabled={isRefreshing}
          />
          <IconButtonStyled
            size="small"
            onClick={handleEdit}
            icon={<EditIcon fontSize="small" />}
            data-testid={`${testId}-edit-button`}
            aria-label="Edit address"
          />
          {hasBalanceChanges && (
            <IconButtonStyled
              size="small"
              onClick={handleSaveExpected}
              icon={<CheckIcon fontSize="small" />}
              data-testid={`${testId}-accept-button`}
              aria-label="Accept balance changes"
            />
          )}
          <IconButtonStyled
            size="small"
            onClick={handleDelete}
            icon={<DeleteIcon fontSize="small" />}
            variant="danger"
            data-testid={`${testId}-delete-button`}
            aria-label="Delete address"
          />
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default AddressRow;
