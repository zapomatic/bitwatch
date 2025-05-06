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
    navigator.clipboard.writeText(address.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2">{address.address.slice(0, 8)}...</Typography>
      <Tooltip title={copied ? "Copied!" : "Copy full address"}>
        <IconButtonStyled
          size="small"
          onClick={handleCopy}
          icon={<ContentCopyIcon fontSize="small" />}
          aria-label="Copy address"
        />
      </Tooltip>
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

    // Find the descriptor that contains this address
    const descriptor = collection.descriptors?.find((d) =>
      d.addresses?.some((a) => a.address === address.address)
    );

    onDelete({
      collection: collection.name,
      address: address.address,
      ...(parentKey?.key ? { extendedKey: parentKey } : {}),
      ...(parentKey?.descriptor
        ? { descriptor: { descriptor: parentKey.descriptor } }
        : {}),
      ...(descriptor && !parentKey
        ? { descriptor: { descriptor: descriptor.descriptor } }
        : {}),
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

  return (
    <TableRow
      className="crystal-table-row address-row"
      data-testid={`${
        parentKey?.descriptor || parentKey?.key || address.address
      }-address-${index}`}
    >
      <TableCell>
        <Typography
          variant="body2"
          data-testid={`${
            parentKey?.descriptor || parentKey?.key || address.address
          }-address-${index}-name`}
        >
          {address.name}
        </Typography>
      </TableCell>
      <TableCell>
        <AddressCell address={address} />
      </TableCell>
      <TableCell>
        <BalanceCell
          balance={address.actual?.chain_in}
          displayBtc={displayBtc}
          data-testid={`${
            parentKey?.descriptor || parentKey?.key || address.address
          }-address-${index}-chain-in`}
        />
      </TableCell>
      <TableCell>
        <BalanceCell
          balance={address.actual?.mempool_in}
          displayBtc={displayBtc}
          data-testid={`${
            parentKey?.descriptor || parentKey?.key || address.address
          }-address-${index}-mempool-in`}
        />
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButtonStyled
            onClick={handleRefresh}
            icon={<RefreshIcon />}
            data-testid={`${
              parentKey?.descriptor || parentKey?.key || address.address
            }-address-${index}-refresh-button`}
            aria-label="Refresh balance"
            disabled={isRefreshing}
          />
          <IconButtonStyled
            onClick={handleEdit}
            icon={<EditIcon />}
            data-testid={`${
              parentKey?.descriptor || parentKey?.key || address.address
            }-address-${index}-edit-button`}
            aria-label="Edit address"
          />
          <IconButtonStyled
            onClick={handleDelete}
            icon={<DeleteIcon />}
            data-testid={`${
              parentKey?.descriptor || parentKey?.key || address.address
            }-address-${index}-delete-button`}
            aria-label="Delete address"
          />
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default AddressRow;
